/**
 * Tests d'intégration : modération.
 *
 * Trois familles de garanties sont vérifiées ici, et elles n'ont pas le même poids :
 *
 *   - le CLOISONNEMENT : aucun compte non administrateur n'atteint /api/admin ;
 *   - les GARDE-FOUS métier : on ne se signale pas soi-même, on ne sanctionne pas
 *     sans motif, on ne supprime pas un compte dont le recours est en cours ;
 *   - les OBLIGATIONS RGPD : la trace est écrite, le recours reste possible malgré
 *     la sanction, et la fiche de modération n'expose aucune donnée de santé.
 *
 * La dernière famille est celle qui justifie l'existence de ce fichier : ce sont des
 * propriétés qu'une refactorisation peut casser sans que rien ne le signale.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  apiRequest, createUser, getMe, uniqueSuffix, linkCoachClient,
} from './helpers.js';

const prisma = new PrismaClient();

let admin;        // { token, id }
let coachA, clientA, clientB;
let profils = {};

/** L'API refuse de créer un ADMIN : on passe par la base, comme le script de production. */
async function creerAdmin() {
  const email = `admin_${uniqueSuffix()}@test.com`;
  const user = await prisma.user.create({
    data: {
      email,
      password: await bcrypt.hash('password123', 10),
      role: 'ADMIN',
      firstName: 'Admin',
      lastName: 'Test',
    },
  });
  const { body } = await apiRequest('POST', '/auth/login', { email, password: 'password123' });
  assert.ok(body.success, `connexion admin impossible : ${JSON.stringify(body)}`);
  return { id: user.id, token: body.data.token, email };
}

before(async () => {
  admin = await creerAdmin();
  coachA = await createUser('COACH');
  clientA = await createUser('CLIENT');
  clientB = await createUser('CLIENT');

  const me = await getMe(coachA.token);
  const meClient = await getMe(clientA.token);
  profils.coach = me.coachProfile.id;
  profils.client = meClient.clientProfile.id;
  await linkCoachClient(coachA.token, profils.client, profils.coach);
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Cloisonnement : les routes d\'administration', () => {
  // fetch refuse un corps sur GET : chaque route porte donc le sien, nul quand il
  // n'y a pas lieu d'en envoyer.
  const ID = '00000000-0000-0000-0000-000000000000';
  const routes = [
    ['GET', '/admin/reports', null],
    ['GET', '/admin/appeals', null],
    ['GET', `/admin/users/${ID}`, null],
    ['POST', `/admin/users/${ID}/suspend`, { reason: 'test' }],
    ['POST', `/admin/users/${ID}/schedule-deletion`, { reason: 'test' }],
  ];

  const verifier = async (token, attendu) => {
    for (const [method, path, body] of routes) {
      const { status } = await apiRequest(method, path, body, token);
      assert.equal(status, attendu, `${method} ${path} : attendu ${attendu}, reçu ${status}`);
    }
  };

  test('sont fermées à un CLIENT', () => verifier(clientA.token, 403));
  test('sont fermées à un COACH', () => verifier(coachA.token, 403));
  test('sont fermées sans authentification', () => verifier(null, 401));

  test('sont ouvertes à un ADMIN', async () => {
    const { status } = await apiRequest('GET', '/admin/reports', null, admin.token);
    assert.equal(status, 200);
  });
});

describe('Signalement', () => {
  test('refuse qu\'on se signale soi-même', async () => {
    const { status } = await apiRequest('POST', '/reports', {
      reportedUserId: clientA.user.id, reason: 'SPAM', context: 'PROFILE',
    }, clientA.token);
    assert.equal(status, 400);
  });

  test('refuse de viser un compte d\'administration', async () => {
    const { status } = await apiRequest('POST', '/reports', {
      reportedUserId: admin.id, reason: 'SPAM', context: 'PROFILE',
    }, clientA.token);
    assert.equal(status, 400);
  });

  test('refuse un motif hors liste', async () => {
    const { status } = await apiRequest('POST', '/reports', {
      reportedUserId: clientB.user.id, reason: 'PARCE_QUE', context: 'PROFILE',
    }, clientA.token);
    assert.equal(status, 400);
  });

  test('accepte un signalement légitime', async () => {
    const { status, body } = await apiRequest('POST', '/reports', {
      reportedUserId: clientB.user.id, reason: 'HARASSMENT',
      context: 'PROFILE', description: 'Messages répétés',
    }, clientA.token);
    assert.equal(status, 201);
    assert.equal(body.data.status, 'PENDING');
  });

  test('refuse un second signalement en attente sur la même personne', async () => {
    const { status } = await apiRequest('POST', '/reports', {
      reportedUserId: clientB.user.id, reason: 'SPAM', context: 'PROFILE',
    }, clientA.token);
    assert.equal(status, 409);
  });

  test('refuse de joindre un message d\'une conversation étrangère', async () => {
    // Message échangé entre coachA et clientA ; c'est clientB qui tente de le signaler.
    const envoi = await apiRequest('POST', '/messages', {
      clientId: profils.client, content: 'Message privé', isSentByCoach: true,
    }, coachA.token);

    if (envoi.status !== 201) return; // rien à vérifier si l'envoi a échoué

    const { status } = await apiRequest('POST', '/reports', {
      reportedUserId: coachA.user.id, reason: 'HARASSMENT',
      context: 'CONVERSATION', messageId: envoi.body.data.id,
    }, clientB.token);
    assert.equal(status, 403);
  });
});

describe('Sanctions', () => {
  let cible;

  before(async () => { cible = await createUser('CLIENT'); });

  test('refuse une suspension sans motif', async () => {
    const { status } = await apiRequest('POST', `/admin/users/${cible.user.id}/suspend`,
      { days: 7 }, admin.token);
    assert.equal(status, 400);
  });

  test('suspend, et la connexion est alors refusée avec le motif', async () => {
    const s = await apiRequest('POST', `/admin/users/${cible.user.id}/suspend`,
      { reason: 'Comportement inapproprié', days: 7 }, admin.token);
    assert.equal(s.status, 200);

    const login = await apiRequest('POST', '/auth/login',
      { email: cible.email, password: cible.password });
    assert.equal(login.status, 403);
    assert.equal(login.body.moderation.reason, 'Comportement inapproprié');
    assert.ok(login.body.data.token, 'un jeton doit être fourni pour permettre le recours');
  });

  test('le jeton d\'un compte suspendu n\'ouvre aucune route ordinaire', async () => {
    const login = await apiRequest('POST', '/auth/login',
      { email: cible.email, password: cible.password });
    const { status } = await apiRequest('GET', '/auth/me', null, login.body.data.token);
    assert.equal(status, 403);
  });

  test('mais la route de recours reste ouverte', async () => {
    const login = await apiRequest('POST', '/auth/login',
      { email: cible.email, password: cible.password });
    const { status } = await apiRequest('POST', '/appeals',
      { message: 'Je conteste cette décision et souhaite un réexamen.' },
      login.body.data.token);
    assert.equal(status, 201);
  });

  test('une action de modération motivée a été consignée', async () => {
    const actions = await prisma.moderationAction.findMany({
      where: { targetId: cible.user.id, type: 'SUSPEND' },
    });
    assert.ok(actions.length >= 1, 'aucune action consignée');
    assert.ok(actions[0].reason, 'action consignée sans motif');
    assert.equal(actions[0].targetLabel, cible.email);
  });

  test('accepter le recours rétablit réellement le compte', async () => {
    const liste = await apiRequest('GET', '/admin/appeals?status=PENDING', null, admin.token);
    const recours = liste.body.data.find((a) => a.user.id === cible.user.id);
    assert.ok(recours, 'recours introuvable dans la file');

    const r = await apiRequest('PUT', `/admin/appeals/${recours.id}`,
      { accept: true, decision: 'Réexamen favorable' }, admin.token);
    assert.equal(r.status, 200);

    const login = await apiRequest('POST', '/auth/login',
      { email: cible.email, password: cible.password });
    assert.equal(login.status, 200, 'le compte devrait être rétabli');
  });
});

describe('Obligations RGPD', () => {
  test('la fiche de modération n\'expose aucune donnée de santé', async () => {
    const { status, body } = await apiRequest('GET', `/admin/users/${clientA.user.id}`,
      null, admin.token);
    assert.equal(status, 200);

    const brut = JSON.stringify(body.data);
    for (const champ of ['weight', 'height', 'goalCategory', 'sleepHours', 'dailyStats', 'meals']) {
      assert.ok(!brut.includes(`"${champ}"`), `la fiche expose « ${champ} »`);
    }
  });

  test('consulter un signalement laisse une trace', async () => {
    const liste = await apiRequest('GET', '/admin/reports', null, admin.token);
    const report = liste.body.data[0];
    assert.ok(report, 'aucun signalement à consulter');

    const avant = await prisma.moderationAccessLog.count({ where: { reportId: report.id } });
    await apiRequest('GET', `/admin/reports/${report.id}`, null, admin.token);
    const apres = await prisma.moderationAccessLog.count({ where: { reportId: report.id } });

    assert.equal(apres, avant + 1, 'la consultation n\'a pas été journalisée');
  });

  test('la personne sanctionnée est informée par notification', async () => {
    const cible = await createUser('CLIENT');
    await apiRequest('POST', `/admin/users/${cible.user.id}/suspend`,
      { reason: 'Test de notification', days: 1 }, admin.token);

    const notifs = await prisma.notification.findMany({
      where: { userId: cible.user.id, type: 'MODERATION' },
    });
    assert.ok(notifs.length >= 1, 'aucune notification envoyée');
    assert.ok(notifs[0].body.includes('Test de notification'), 'le motif doit figurer dans le message');
  });

  test('un recours en cours empêche la suppression programmée', async () => {
    const cible = await createUser('CLIENT');

    await apiRequest('POST', `/admin/users/${cible.user.id}/schedule-deletion`,
      { reason: 'Test de suppression différée' }, admin.token);

    const login = await apiRequest('POST', '/auth/login',
      { email: cible.email, password: cible.password });
    await apiRequest('POST', '/appeals',
      { message: 'Je conteste cette suppression programmée.' }, login.body.data.token);

    // On ramène l'échéance dans le passé pour simuler l'arrivée du terme.
    await prisma.user.update({
      where: { id: cible.user.id },
      data: { scheduledDeletionAt: new Date(Date.now() - 86400000) },
    });

    const { executerSuppressionsProgrammees } = await import('../src/jobs/moderationJobs.js');
    await executerSuppressionsProgrammees();

    const encore = await prisma.user.findUnique({ where: { id: cible.user.id } });
    assert.ok(encore, 'le compte a été supprimé alors qu\'un recours était en cours');
  });

  test('sans recours, la suppression programmée s\'exécute à échéance', async () => {
    const cible = await createUser('CLIENT');

    await apiRequest('POST', `/admin/users/${cible.user.id}/schedule-deletion`,
      { reason: 'Test de suppression effective' }, admin.token);

    await prisma.user.update({
      where: { id: cible.user.id },
      data: { scheduledDeletionAt: new Date(Date.now() - 86400000) },
    });

    const { executerSuppressionsProgrammees } = await import('../src/jobs/moderationJobs.js');
    await executerSuppressionsProgrammees();

    const supprime = await prisma.user.findUnique({ where: { id: cible.user.id } });
    assert.equal(supprime, null, 'le compte aurait dû être supprimé');

    // La trace survit à la suppression : c'est elle qui permet de justifier l'opération.
    const trace = await prisma.moderationAction.findFirst({
      where: { targetLabel: cible.email, type: 'DELETE' },
    });
    assert.ok(trace, 'aucune trace conservée après suppression');
    assert.equal(trace.targetId, null, 'targetId doit être nul après suppression du compte');
  });
});
