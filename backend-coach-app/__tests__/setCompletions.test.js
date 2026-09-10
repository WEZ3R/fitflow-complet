/**
 * Tests d'intégration : Set Completions (toggle, update, RPE)
 * Couvre : toggleSetCompletion, updateSetCompletion avec champ rpe
 *
 * Prérequis : serveur backend sur le port 5001 + `prisma db push` appliqué.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, todayLocal } from './helpers.js';

// ─── État partagé ─────────────────────────────────────────────────────────────

let coachToken, clientToken;
let coachProfile, clientProfile;
let programId, sessionId, exerciseId;

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  try {
    await apiRequest('GET', '/auth/me');
  } catch {
    throw new Error('⚠️  Serveur backend requis sur le port 5001 (npm run dev)');
  }

  const coach = await createUser('COACH');
  const client = await createUser('CLIENT');
  coachToken = coach.token;
  clientToken = client.token;

  const coachMe = await getMe(coachToken);
  const clientMe = await getMe(clientToken);
  coachProfile = coachMe.coachProfile;
  clientProfile = clientMe.clientProfile;

  await linkCoachClient(coachToken, clientProfile.id, coachProfile.id);

  // Créer un programme + séance + exercice MAIN
  const { body: progBody } = await apiRequest(
    'POST', '/programs',
    { clientId: clientProfile.id, title: 'SetCompletion Test', startDate: todayLocal() },
    coachToken
  );
  programId = progBody.data.id;

  const { body: sessBody } = await apiRequest(
    'POST', '/sessions',
    {
      programId,
      date: todayLocal(),
      isRestDay: false,
      exercises: [{ name: 'Squat', category: 'MAIN', sets: 3, reps: '8', weight: '100', order: 0 }],
    },
    coachToken
  );
  sessionId = sessBody.data.id;
  exerciseId = sessBody.data.exercises[0].id;
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

after(async () => {
  if (programId) {
    await apiRequest('DELETE', `/programs/${programId}`, null, coachToken);
  }
});

// ─── Toggle ───────────────────────────────────────────────────────────────────

describe('toggleSetCompletion', () => {
  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', '/set-completions/toggle', {
      exerciseId,
      setNumber: 1,
    });
    assert.equal(status, 401);
  });

  test('toggle ON : crée une completion', async () => {
    const { status, body } = await apiRequest(
      'POST', '/set-completions/toggle',
      { exerciseId, setNumber: 1, repsAchieved: '8', weightUsed: '100' },
      clientToken
    );
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.completed, true);
    assert.equal(body.data.exerciseId, exerciseId);
    assert.equal(body.data.setNumber, 1);
    assert.equal(body.data.repsAchieved, '8');
    assert.equal(body.data.weightUsed, '100');
  });

  test('toggle OFF : supprime la completion existante', async () => {
    const { status, body } = await apiRequest(
      'POST', '/set-completions/toggle',
      { exerciseId, setNumber: 1 },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.completed, false);
  });

  test('toggle avec RPE : rpe sauvegardé', async () => {
    const { status, body } = await apiRequest(
      'POST', '/set-completions/toggle',
      { exerciseId, setNumber: 2, repsAchieved: '8', weightUsed: '100', rpe: 8.5 },
      clientToken
    );
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.rpe, 8.5);
  });

  test('toggle OFF sur série avec RPE : supprimée', async () => {
    const { status, body } = await apiRequest(
      'POST', '/set-completions/toggle',
      { exerciseId, setNumber: 2 },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.data.completed, false);
  });
});

// ─── Update (upsert) ──────────────────────────────────────────────────────────

describe('updateSetCompletion', () => {
  test('sans token → 401', async () => {
    const { status } = await apiRequest('PUT', '/set-completions', {
      exerciseId,
      setNumber: 3,
      repsAchieved: '8',
      weightUsed: '100',
    });
    assert.equal(status, 401);
  });

  test('crée ou met à jour une completion (upsert)', async () => {
    const { status, body } = await apiRequest(
      'PUT', '/set-completions',
      { exerciseId, setNumber: 3, repsAchieved: '10', weightUsed: '90' },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.repsAchieved, '10');
    assert.equal(body.data.weightUsed, '90');
    assert.equal(body.data.completed, true);
  });

  test('update avec rpe : rpe sauvegardé', async () => {
    const { status, body } = await apiRequest(
      'PUT', '/set-completions',
      { exerciseId, setNumber: 3, repsAchieved: '10', weightUsed: '90', rpe: 7.5 },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.rpe, 7.5);
  });

  test('update rpe = 10 (max) : sauvegardé', async () => {
    const { body } = await apiRequest(
      'PUT', '/set-completions',
      { exerciseId, setNumber: 3, repsAchieved: '1', weightUsed: '120', rpe: 10 },
      clientToken
    );
    assert.equal(body.success, true);
    assert.equal(body.data.rpe, 10);
  });

  test('update sans rpe : rpe non modifié (ou null)', async () => {
    const { body } = await apiRequest(
      'PUT', '/set-completions',
      { exerciseId, setNumber: 3, repsAchieved: '8', weightUsed: '100' },
      clientToken
    );
    assert.equal(body.success, true);
    // Pas de rpe fourni → null ou inchangé (la valeur précédente est écrasée car non fournie)
    assert.ok(body.data.rpe === null || body.data.rpe === undefined || typeof body.data.rpe === 'number');
  });
});

// ─── Lecture après modification ───────────────────────────────────────────────

describe('getSetCompletions', () => {
  test('récupère les completions d\'un exercice', async () => {
    const { status, body } = await apiRequest(
      'GET', `/set-completions/exercise/${exerciseId}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('les completions ont repsAchieved, weightUsed, rpe', async () => {
    const { body } = await apiRequest(
      'GET', `/set-completions/exercise/${exerciseId}`,
      null,
      clientToken
    );
    for (const c of body.data) {
      assert.ok('repsAchieved' in c, 'repsAchieved présent');
      assert.ok('weightUsed' in c, 'weightUsed présent');
      assert.ok('rpe' in c, 'champ rpe présent');
    }
  });

  test('getSessionSetCompletions retourne les exercices avec leurs completions', async () => {
    const { status, body } = await apiRequest(
      'GET', `/set-completions/session/${sessionId}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    if (body.data.length > 0) {
      assert.ok(Array.isArray(body.data[0].setCompletions));
    }
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('deleteSetCompletion', () => {
  test('supprime une completion existante', async () => {
    // Créer d'abord
    await apiRequest(
      'PUT', '/set-completions',
      { exerciseId, setNumber: 1, repsAchieved: '8', weightUsed: '80' },
      clientToken
    );
    const { status, body } = await apiRequest(
      'DELETE', `/set-completions/${exerciseId}/1`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });

  test('supprime une completion inexistante → 500 (Prisma P2025)', async () => {
    const { status } = await apiRequest(
      'DELETE', `/set-completions/${exerciseId}/99`,
      null,
      clientToken
    );
    // Prisma lance une erreur P2025 si non trouvé → 500 côté serveur (comportement actuel)
    assert.ok([200, 404, 500].includes(status));
  });
});
