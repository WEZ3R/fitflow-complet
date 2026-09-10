/**
 * Tests d'intégration : Analytics musculation (Phase 1 + Phase 2)
 * Couvre les 7 endpoints /analytics/workout/*
 *
 * Prérequis : serveur backend sur le port 5001 + DB avec exerciseReferences.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, dateOffset, todayLocal } from './helpers.js';

// ─── État partagé ─────────────────────────────────────────────────────────────

let coachToken, clientToken, otherCoachToken;
let coachProfile, clientProfile;
let programId, sessionId, exerciseId;
let exerciseRefId; // ID d'une ExerciseReference réelle en base

const START_DATE = dateOffset(-30);
const END_DATE = todayLocal();

// ─── Setup ────────────────────────────────────────────────────────────────────

before(async () => {
  // Vérifier que le serveur tourne
  try {
    await apiRequest('GET', '/auth/me');
  } catch {
    throw new Error('⚠️  Serveur backend requis sur le port 5001 (npm run dev)');
  }

  const coach = await createUser('COACH');
  const client = await createUser('CLIENT');
  otherCoachToken = (await createUser('COACH')).token;

  coachToken = coach.token;
  clientToken = client.token;

  const coachMe = await getMe(coachToken);
  const clientMe = await getMe(clientToken);
  coachProfile = coachMe.coachProfile;
  clientProfile = clientMe.clientProfile;

  // Mettre à jour le poids du client (requis pour strength-standards)
  await apiRequest('PUT', '/auth/profile', { weight: 80 }, clientToken);

  await linkCoachClient(coachToken, clientProfile.id, coachProfile.id);

  // Récupérer un exerciseRef réel (CHEST + Barre)
  const { body: refBody } = await apiRequest(
    'GET',
    '/exercise-refs/search?q=DC+Barre&limit=1',
    null,
    coachToken
  );
  if (refBody.data?.exercises?.length > 0) {
    exerciseRefId = refBody.data.exercises[0].id;
  }

  // Créer un programme
  const { body: progBody } = await apiRequest(
    'POST',
    '/programs',
    {
      clientId: clientProfile.id,
      title: 'Programme Analytics Test',
      startDate: START_DATE,
    },
    coachToken
  );
  programId = progBody.data.id;

  // Créer une séance avec un exercice lié à exerciseRefId
  const sessionExercises = [
    {
      name: 'DC Barre',
      category: 'MAIN',
      sets: 3,
      reps: '8',
      weight: '80',
      order: 0,
      exerciseRefId: exerciseRefId || undefined,
    },
  ];

  const { body: sessBody } = await apiRequest(
    'POST',
    '/sessions',
    {
      programId,
      date: todayLocal(),
      isRestDay: false,
      exercises: sessionExercises,
    },
    coachToken
  );
  sessionId = sessBody.data.id;
  exerciseId = sessBody.data.exercises?.[0]?.id;

  // Compléter des séries (client)
  if (exerciseId) {
    for (let i = 1; i <= 3; i++) {
      await apiRequest(
        'POST',
        '/set-completions/toggle',
        {
          exerciseId,
          setNumber: i,
          repsAchieved: '8',
          weightUsed: '80',
        },
        clientToken
      );
    }
  }

  // Valider la séance (marquer completedByClient)
  if (sessionId) {
    await apiRequest(
      'POST',
      `/sessions/${sessionId}/validate`,
      { durationSeconds: 3600 },
      clientToken
    );
  }
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

after(async () => {
  if (programId) {
    await apiRequest('DELETE', `/programs/${programId}`, null, coachToken);
  }
});

// ─── Tests communs d'authentification ─────────────────────────────────────────

describe('Auth — endpoints protégés', () => {
  const endpoints = [
    `/analytics/workout/estimated-1rm?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
    `/analytics/workout/volume?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
    `/analytics/workout/completion?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
    `/analytics/workout/load-progression?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
    `/analytics/workout/inol?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
    `/analytics/workout/strength-standards?clientId=x`,
    `/analytics/workout/volume-landmarks?clientId=x&startDate=2026-01-01&endDate=2026-03-31`,
  ];

  for (const endpoint of endpoints) {
    test(`GET ${endpoint.split('?')[0]} sans token → 401`, async () => {
      const { status } = await apiRequest('GET', endpoint);
      assert.equal(status, 401);
    });
  }
});

// ─── Paramètres manquants ─────────────────────────────────────────────────────

describe('Paramètres — validation', () => {
  test('estimated-1rm sans clientId → 400', async () => {
    const { status } = await apiRequest(
      'GET',
      '/analytics/workout/estimated-1rm?startDate=2026-01-01&endDate=2026-03-31',
      null,
      coachToken
    );
    assert.equal(status, 400);
  });

  test('volume sans startDate → 400', async () => {
    const { status } = await apiRequest(
      'GET',
      `/analytics/workout/volume?clientId=${clientProfile.id}&endDate=2026-03-31`,
      null,
      coachToken
    );
    assert.equal(status, 400);
  });

  test('completion sans endDate → 400', async () => {
    const { status } = await apiRequest(
      'GET',
      `/analytics/workout/completion?clientId=${clientProfile.id}&startDate=2026-01-01`,
      null,
      coachToken
    );
    assert.equal(status, 400);
  });
});

// ─── Accès non autorisé ───────────────────────────────────────────────────────

describe('Accès — coach non lié → 403', () => {
  test('autre coach ne peut pas accéder aux données', async () => {
    const { status } = await apiRequest(
      'GET',
      `/analytics/workout/estimated-1rm?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      otherCoachToken
    );
    assert.equal(status, 403);
  });
});

// ─── 1RM estimé ───────────────────────────────────────────────────────────────

describe('getEstimated1RM', () => {
  test('retourne la structure attendue', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/estimated-1rm?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.exercises), 'exercises doit être un tableau');
  });

  test('exercices avec exerciseRefId ont weeklyData', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/estimated-1rm?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    if (body.data.exercises.length > 0) {
      const ex = body.data.exercises[0];
      assert.ok(ex.exerciseRefId, 'exerciseRefId présent');
      assert.ok(ex.exerciseName, 'exerciseName présent');
      assert.ok(Array.isArray(ex.weeklyData), 'weeklyData est un tableau');
      if (ex.weeklyData.length > 0) {
        assert.ok(ex.weeklyData[0].week, 'week au format YYYY-Www');
        assert.ok(typeof ex.weeklyData[0].estimated1RM === 'number', 'estimated1RM est un nombre');
      }
    }
  });
});

// ─── Volume hebdomadaire ───────────────────────────────────────────────────────

describe('getWeeklyVolume', () => {
  test('retourne weeklyVolume et totalByMuscle', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/volume?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.weeklyVolume), 'weeklyVolume est un tableau');
    assert.ok(typeof body.data.totalByMuscle === 'object', 'totalByMuscle est un objet');
  });

  test('chaque entrée weeklyVolume a week + muscleGroups + total', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/volume?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    for (const entry of body.data.weeklyVolume) {
      assert.ok(entry.week, 'week présent');
      assert.ok(typeof entry.muscleGroups === 'object', 'muscleGroups est un objet');
      assert.ok(typeof entry.total === 'number', 'total est un nombre');
    }
  });
});

// ─── Complétion + streak ───────────────────────────────────────────────────────

describe('getCompletionAndStreak', () => {
  test('retourne currentStreak, longestStreak, weeklyCompletion', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/completion?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(typeof body.data.currentStreak === 'number', 'currentStreak est un nombre');
    assert.ok(typeof body.data.longestStreak === 'number', 'longestStreak est un nombre');
    assert.ok(Array.isArray(body.data.weeklyCompletion), 'weeklyCompletion est un tableau');
  });

  test('chaque entrée weeklyCompletion a week + completed + total + rate', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/completion?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    for (const entry of body.data.weeklyCompletion) {
      assert.ok(entry.week, 'week présent');
      assert.ok(typeof entry.completed === 'number', 'completed est un nombre');
      assert.ok(typeof entry.total === 'number', 'total est un nombre');
      assert.ok(typeof entry.rate === 'number', 'rate entre 0 et 1');
      assert.ok(entry.rate >= 0 && entry.rate <= 100, 'rate entre 0 et 100');
    }
  });

  test('longestStreak >= currentStreak', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/completion?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.ok(body.data.longestStreak >= body.data.currentStreak);
  });
});

// ─── Progression de charge ─────────────────────────────────────────────────────

describe('getLoadProgression', () => {
  test('retourne la structure attendue', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/load-progression?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.exercises), 'exercises est un tableau');
  });

  test('exercices ont weeklyData avec maxWeight', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/load-progression?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    for (const ex of body.data.exercises) {
      assert.ok(ex.exerciseRefId, 'exerciseRefId présent');
      assert.ok(Array.isArray(ex.weeklyData), 'weeklyData est un tableau');
      for (const wd of ex.weeklyData) {
        assert.ok(wd.week, 'week présent');
        assert.ok(typeof wd.maxWeight === 'number', 'maxWeight est un nombre');
      }
    }
  });
});

// ─── INOL (Phase 2) ───────────────────────────────────────────────────────────

describe('getSessionINOL', () => {
  test('retourne la structure attendue', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/inol?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.sessions), 'sessions est un tableau');
  });

  test('chaque session a date, sessionId, totalINOL', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/inol?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    for (const s of body.data.sessions) {
      assert.ok(s.sessionId, 'sessionId présent');
      assert.ok(s.date, 'date présente');
      assert.ok(typeof s.totalINOL === 'number', 'totalINOL est un nombre');
      assert.ok(s.totalINOL >= 0, 'totalINOL >= 0');
    }
  });
});

// ─── Standards de force (Phase 2) ─────────────────────────────────────────────

describe('getStrengthStandards', () => {
  test('retourne bodyweight, gender, exercises', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/strength-standards?clientId=${clientProfile.id}`,
      null,
      coachToken
    );
    // 200 si poids renseigné, 422 si non renseigné
    assert.ok([200, 422].includes(status), `status inattendu: ${status}`);
    if (status === 200) {
      assert.equal(body.success, true);
      assert.ok(Array.isArray(body.data.exercises), 'exercises est un tableau');
      for (const ex of body.data.exercises) {
        assert.ok(ex.exerciseName, 'exerciseName présent');
        assert.ok(typeof ex.estimated1RM === 'number', 'estimated1RM est un nombre');
        assert.ok(typeof ex.ratio === 'number', 'ratio est un nombre');
        assert.ok(ex.level, 'level présent');
        assert.ok(['beginner', 'novice', 'intermediate', 'advanced', 'elite'].includes(ex.level));
      }
    }
  });
});

// ─── Volume Landmarks (Phase 2) ───────────────────────────────────────────────

describe('getVolumeLandmarks', () => {
  test('retourne muscleGroups avec zones', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/analytics/workout/volume-landmarks?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data.muscleGroups), 'muscleGroups est un tableau');
  });

  test('chaque muscleGroup a zone et landmarks', async () => {
    const { body } = await apiRequest(
      'GET',
      `/analytics/workout/volume-landmarks?clientId=${clientProfile.id}&startDate=${START_DATE}&endDate=${END_DATE}`,
      null,
      coachToken
    );
    const validZones = ['below_mev', 'mev_to_mav', 'mav', 'mav_to_mrv', 'above_mrv'];
    for (const mg of body.data.muscleGroups) {
      assert.ok(mg.name, 'name présent');
      assert.ok(typeof mg.weeklyAvgSets === 'number', 'weeklyAvgSets est un nombre');
      assert.ok(typeof mg.mev === 'number', 'mev présent');
      assert.ok(typeof mg.mavLow === 'number', 'mavLow présent');
      assert.ok(typeof mg.mavHigh === 'number', 'mavHigh présent');
      assert.ok(typeof mg.mrv === 'number', 'mrv présent');
      assert.ok(validZones.includes(mg.zone), `zone "${mg.zone}" invalide`);
    }
  });
});
