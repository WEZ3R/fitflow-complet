/**
 * Tests d'intégration : analytics de suivi quotidien — /analytics/clients et /analytics/stats
 *
 * Ces tests existent à cause d'une panne constatée en production le 30/08/2026 :
 * l'écran « Analyse des performances » affichait « Aucune donnée » quel que soit le
 * client sélectionné. La liste de gauche affichait pourtant cinq clients.
 *
 * La cause tenait à deux sources de vérité pour un même lien. Depuis le passage au
 * multi-coach, la relation vit dans la table de liaison `ClientCoach` ; le champ
 * hérité `clientProfile.coachId` n'est plus alimenté. `/analytics/clients` interrogeait
 * la table de liaison — d'où les cinq clients — pendant que `/analytics/stats` filtrait
 * encore sur le champ hérité, et ne trouvait donc personne.
 *
 * Le test qui suit reproduit exactement cette situation : `linkCoachClient` ne crée
 * que la relation `ClientCoach`, jamais le champ hérité. Un coach ainsi rattaché doit
 * retrouver son client par les deux endpoints, sans quoi la régression est de retour.
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, dateOffset, todayLocal } from './helpers.js';

let coachToken, clientToken;
let coachProfile, clientProfile;

const START_DATE = dateOffset(-30);
const END_DATE = todayLocal();

before(async () => {
  const coach = await createUser('COACH');
  const client = await createUser('CLIENT');
  coachToken = coach.token;
  clientToken = client.token;

  coachProfile = (await getMe(coachToken)).coachProfile;
  clientProfile = (await getMe(clientToken)).clientProfile;

  // Uniquement la table de liaison — c'est le chemin réel de l'application.
  await linkCoachClient(coachToken, clientProfile.id, coachProfile.id);
});

describe('Analytics — le lien coach-client passe par la table de liaison', () => {
  test('la liste des clients renvoie le client rattaché', async () => {
    const { status, body } = await apiRequest('GET', '/analytics/clients', null, coachToken);
    assert.equal(status, 200);
    const ids = (body.data ?? []).map((c) => c.id);
    assert.ok(
      ids.includes(clientProfile.id),
      'le client rattaché doit figurer dans /analytics/clients'
    );
  });

  test('les statistiques du client rattaché sont accessibles', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/stats?clientIds=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );

    // Le point de la régression : un 404 « Aucun client trouvé » ici signifie que la
    // requête est repassée sur le champ hérité `clientProfile.coachId`.
    assert.equal(
      status,
      200,
      `attendu 200, reçu ${status} — ${body.message ?? ''} (régression du lien multi-coach ?)`
    );
    assert.equal(body.success, true);
  });

  test('sans clientIds, le coach obtient ses propres clients', async () => {
    const { status } = await apiRequest(
      'GET',
      `/analytics/stats?startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
  });

  test('un coach ne peut pas lire les statistiques du client d’un autre', async () => {
    const autre = await createUser('COACH');
    const { status } = await apiRequest(
      'GET',
      `/analytics/stats?clientIds=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      autre.token
    );
    // Aucun client ne correspond pour ce coach : le filtre de propriété doit tenir.
    assert.equal(status, 404, 'un coach étranger ne doit obtenir aucun client');
  });
});
