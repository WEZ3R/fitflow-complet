/**
 * Tests d'intégration : Objectifs personnalisés
 * Couvre : toggleGoalCompletion (POST /:goalId/complete), getGoalCompletions (GET /completions)
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, todayLocal } from './helpers.js';

let coachToken, clientToken;
let coachProfile, clientProfile;
let goalId;

before(async () => {
  const coach = await createUser('COACH');
  const client = await createUser('CLIENT');
  coachToken = coach.token;
  clientToken = client.token;

  const coachMe = await getMe(coachToken);
  const clientMe = await getMe(clientToken);
  coachProfile = coachMe.coachProfile;
  clientProfile = clientMe.clientProfile;

  await linkCoachClient(coachToken, clientProfile.id, coachProfile.id);

  // Créer un programme avec des objectifs personnalisés
  const { body } = await apiRequest(
    'POST',
    '/programs',
    {
      clientId: clientProfile.id,
      title: 'Programme avec objectifs',
      startDate: new Date().toISOString(),
      customGoals: [
        { title: "Boire 2L d'eau par jour", description: 'Hydratation' },
        { title: 'Dormir 8h par nuit', description: 'Récupération' },
      ],
    },
    coachToken
  );
  assert.equal(body.success, true, `Création programme échouée: ${JSON.stringify(body)}`);
  goalId = body.data.customGoals?.[0]?.id;
  assert.ok(goalId, 'Un goalId doit être créé');
});

describe('Objectifs - Toggle complétion', () => {
  test('client coche un objectif (completed: true)', async () => {
    const { status, body } = await apiRequest(
      'POST',
      `/goals/${goalId}/complete`,
      { date: todayLocal(), completed: true },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.completed, true);
    assert.equal(body.data.customGoalId, goalId);
  });

  test('client dé-coche un objectif (completed: false)', async () => {
    const { status, body } = await apiRequest(
      'POST',
      `/goals/${goalId}/complete`,
      { date: todayLocal(), completed: false },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.completed, false);
  });

  test('objectif inexistant → 404', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/goals/00000000-0000-0000-0000-000000000000/complete',
      { date: todayLocal(), completed: true },
      clientToken
    );
    assert.equal(status, 404);
    assert.equal(body.success, false);
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', `/goals/${goalId}/complete`, {
      date: todayLocal(),
      completed: true,
    });
    assert.equal(status, 401);
  });
});

describe('Objectifs - Lecture des complétions', () => {
  before(async () => {
    // Re-cocher l'objectif pour avoir une donnée
    await apiRequest(
      'POST',
      `/goals/${goalId}/complete`,
      { date: todayLocal(), completed: true },
      clientToken
    );
  });

  test('client récupère ses complétions du jour', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/goals/completions?date=${todayLocal()}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    assert.ok(body.data[0].customGoal, 'La complétion doit inclure le détail de l\'objectif');
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('GET', `/goals/completions?date=${todayLocal()}`);
    assert.equal(status, 401);
  });
});
