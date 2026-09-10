/**
 * Tests d'intégration : cloisonnement des données entre comptes
 *
 * Construit deux paires coach/client indépendantes (A et B), puis vérifie que B ne peut
 * atteindre aucune ressource de A, tout en s'assurant que A garde accès aux siennes.
 *
 * Ces endpoints n'appliquaient aucune vérification d'appartenance : n'importe quel compte
 * authentifié pouvait lire une conversation privée, modifier le journal alimentaire d'un
 * autre client ou supprimer le template d'un coach concurrent.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, uniqueSuffix } from './helpers.js';

/** Crée un écosystème complet et isolé : coach, client, relation, programme, séance, repas, message, template */
async function makePair(tag) {
  const coach = await createUser('COACH', `authz${tag}c_${uniqueSuffix()}`);
  const client = await createUser('CLIENT', `authz${tag}l_${uniqueSuffix()}`);

  const coachMe = await getMe(coach.token);
  const clientMe = await getMe(client.token);
  const coachProfileId = coachMe.coachProfile.id;
  const clientProfileId = clientMe.clientProfile.id;

  const relation = await linkCoachClient(coach.token, clientProfileId, coachProfileId);

  const program = await apiRequest('POST', '/programs', {
    clientId: clientProfileId,
    title: `Programme ${tag}`,
    description: 'cloisonnement',
    startDate: new Date().toISOString(),
  }, coach.token);

  const programId = program.body.data.id;

  const session = await apiRequest('POST', '/sessions', {
    programId,
    date: new Date().toISOString(),
    exercises: [{ name: 'Squat', category: 'MAIN', sets: 3, reps: '10', order: 0 }],
  }, coach.token);

  const meal = await apiRequest('POST', '/meals', {
    clientId: clientProfileId,
    date: new Date().toISOString(),
    mealType: 'LUNCH',
    description: 'repas privé',
    calories: 500,
  }, client.token);

  const message = await apiRequest('POST', '/messages', {
    coachId: coachProfileId,
    clientId: clientProfileId,
    content: 'message privé',
    isSentByCoach: true,
  }, coach.token);

  const template = await apiRequest('POST', '/templates', {
    name: `Template ${tag}`,
    description: 'cloisonnement',
    cycleDays: 7,
    sessionsData: [],
  }, coach.token);

  // Une fixture incomplète rendrait les assertions vides — on échoue explicitement.
  assert.ok(session.body.data?.id, `séance ${tag} non créée : ${JSON.stringify(session.body)}`);
  assert.ok(meal.body.data?.id, `repas ${tag} non créé : ${JSON.stringify(meal.body)}`);
  assert.ok(message.body.data?.id, `message ${tag} non créé : ${JSON.stringify(message.body)}`);
  assert.ok(template.body.data?.id, `template ${tag} non créé : ${JSON.stringify(template.body)}`);

  return {
    coachToken: coach.token,
    clientToken: client.token,
    coachProfileId,
    clientProfileId,
    relationId: relation.id,
    programId,
    sessionId: session.body.data.id,
    exerciseId: session.body.data.exercises[0].id,
    mealId: meal.body.data.id,
    messageId: message.body.data.id,
    templateId: template.body.data.id,
  };
}

let A, B;

before(async () => {
  A = await makePair('A');
  B = await makePair('B');
});

describe('Cloisonnement : B ne doit atteindre aucune ressource de A', () => {
  const forbidden = () => [
    ['lire la conversation privée', 'GET', `/messages/conversation/${A.coachProfileId}/${A.clientProfileId}`, B.coachToken],
    ['supprimer un message', 'DELETE', `/messages/${A.messageId}`, B.coachToken],
    ['marquer un message comme lu', 'PATCH', `/messages/${A.messageId}/read`, B.coachToken],
    ['lire les tips du client', 'GET', `/messages/tips/client/${A.clientProfileId}`, B.coachToken],
    ['lire le journal alimentaire', 'GET', `/meals/client/${A.clientProfileId}`, B.coachToken],
    ['modifier un repas', 'PUT', `/meals/${A.mealId}`, B.coachToken],
    ['supprimer un repas', 'DELETE', `/meals/${A.mealId}`, B.coachToken],
    ['lire une séance', 'GET', `/sessions/${A.sessionId}`, B.coachToken],
    ['valider une séance', 'PUT', `/sessions/${A.sessionId}/validate`, B.clientToken],
    ['lister les séances du programme', 'GET', `/sessions/program/${A.programId}`, B.coachToken],
    ['commenter une séance', 'POST', `/sessions/${A.sessionId}/comments`, B.coachToken],
    ['lire les séries d\'un exercice', 'GET', `/set-completions/exercise/${A.exerciseId}`, B.coachToken],
    ['lire les séries d\'une séance', 'GET', `/set-completions/session/${A.sessionId}`, B.coachToken],
    ['lire un template', 'GET', `/templates/${A.templateId}`, B.coachToken],
    ['supprimer un template', 'DELETE', `/templates/${A.templateId}`, B.coachToken],
    ['rompre la relation coach-client', 'DELETE', `/client-coaches/${A.relationId}`, B.coachToken],
    ['lister les coachs du client', 'GET', `/client-coaches/client/${A.clientProfileId}`, B.coachToken],
    ['lister les clients du coach', 'GET', `/client-coaches/coach/${A.coachProfileId}`, B.coachToken],
  ];

  test('chaque tentative renvoie 403', async () => {
    for (const [label, method, path, token] of forbidden()) {
      const body = method === 'PUT' || method === 'POST' ? {} : null;
      const { status } = await apiRequest(method, path, body, token);
      assert.equal(status, 403, `${label} : attendu 403, reçu ${status}`);
    }
  });
});

describe('Non-régression : A garde accès à ses propres ressources', () => {
  const allowed = () => [
    ['conversation vue par le coach', `/messages/conversation/${A.coachProfileId}/${A.clientProfileId}`, A.coachToken],
    ['conversation vue par le client', `/messages/conversation/${A.coachProfileId}/${A.clientProfileId}`, A.clientToken],
    ['repas vus par le client', `/meals/client/${A.clientProfileId}`, A.clientToken],
    ['repas vus par son coach', `/meals/client/${A.clientProfileId}`, A.coachToken],
    ['séance vue par le coach', `/sessions/${A.sessionId}`, A.coachToken],
    ['séance vue par le client', `/sessions/${A.sessionId}`, A.clientToken],
    ['séances du programme', `/sessions/program/${A.programId}`, A.coachToken],
    ['séries vues par le coach', `/set-completions/exercise/${A.exerciseId}`, A.coachToken],
    ['template vu par son propriétaire', `/templates/${A.templateId}`, A.coachToken],
    ['coachs listés par le client', `/client-coaches/client/${A.clientProfileId}`, A.clientToken],
    ['clients listés par le coach', `/client-coaches/coach/${A.coachProfileId}`, A.coachToken],
  ];

  test('chaque accès légitime renvoie 200', async () => {
    for (const [label, path, token] of allowed()) {
      const { status } = await apiRequest('GET', path, null, token);
      assert.equal(status, 200, `${label} : attendu 200, reçu ${status}`);
    }
  });
});
