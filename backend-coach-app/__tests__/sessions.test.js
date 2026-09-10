/**
 * Tests d'intégration — Création et récupération des séances
 *
 * Prérequis : le serveur backend doit tourner sur le port 5001.
 * Lancer avec : npm test
 *
 * Ce que ces tests vérifient :
 *  1. Inscription coach + client
 *  2. Liaison coach-client (M2M ClientCoach)
 *  3. Création d'un programme pour le client
 *  4. Création d'une séance avec exercices complets
 *  5. Récupération de la séance par le coach (champs exacts)
 *  6. Visibilité de la séance côté client (getClientPrograms)
 *  7. Correspondance de date (séance d'aujourd'hui détectée)
 *  8. Mise à jour de la séance (upsert) — les exercices sont remplacés
 *  9. Séance de repos (isRestDay)
 * 10. Suppression de séance
 * 11. Nettoyage complet des données de test
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Retourne la date locale au format YYYY-MM-DD (sans dépendance externe)
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const BASE = process.env.TEST_API_URL || 'http://localhost:5001/api';
const SUFFIX = Date.now(); // Évite les collisions d'email entre runs

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function api(method, path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ─── État partagé entre les tests ─────────────────────────────────────────────

let coachToken, clientToken;
let coachProfileId, clientProfileId;
let clientCoachRelationId;
let programId;
let sessionId;

// ─── Suite de tests ──────────────────────────────────────────────────────────

describe('Sessions — pipeline complet', () => {

  // ── Setup : créer coach + client ──────────────────────────────────────────

  before(async () => {
    // Vérifier que le serveur est accessible
    try {
      const { status } = await api('GET', '/auth/me', undefined, undefined);
      // 401 = serveur ok mais non authentifié, c'est ce qu'on attend
      assert.notEqual(status, undefined, 'Le serveur ne répond pas');
    } catch {
      throw new Error('⚠️  Le serveur backend doit être démarré sur le port 5001 (npm run dev)');
    }

    // Inscrire le coach de test
    const coachRes = await api('POST', '/auth/register', {
      email: `coach_test_${SUFFIX}@fitflow.test`,
      password: 'password123',
      role: 'COACH',
      firstName: 'Sarah',
      lastName: `Test${SUFFIX}`,
    });
    assert.equal(coachRes.status, 201, `Inscription coach échouée: ${coachRes.data.message}`);
    coachToken = coachRes.data.data.token;

    // Inscrire le client de test
    const clientRes = await api('POST', '/auth/register', {
      email: `client_test_${SUFFIX}@fitflow.test`,
      password: 'password123',
      role: 'CLIENT',
      firstName: 'Marc',
      lastName: `Test${SUFFIX}`,
    });
    assert.equal(clientRes.status, 201, `Inscription client échouée: ${clientRes.data.message}`);
    clientToken = clientRes.data.data.token;

    // Récupérer les IDs de profil
    const coachMe = await api('GET', '/auth/me', undefined, coachToken);
    coachProfileId = coachMe.data.data.coachProfile.id;

    const clientMe = await api('GET', '/auth/me', undefined, clientToken);
    clientProfileId = clientMe.data.data.clientProfile.id;

    // Créer la liaison coach-client (M2M)
    const relationRes = await api('POST', '/client-coaches', {
      clientId: clientProfileId,
      coachId: coachProfileId,
      isPrimary: true,
    }, coachToken);
    assert.equal(relationRes.status, 201, `Liaison coach-client échouée: ${relationRes.data.message}`);
    clientCoachRelationId = relationRes.data.data.id;
  });

  // ── Teardown : nettoyer toutes les données de test ────────────────────────

  after(async () => {
    // Supprimer dans l'ordre inverse des dépendances
    // (les sessions/exercices sont supprimés en cascade avec le programme)
    if (programId) {
      await api('DELETE', `/programs/${programId}`, undefined, coachToken);
    }
    if (clientCoachRelationId) {
      await api('DELETE', `/client-coaches/${clientCoachRelationId}`, undefined, coachToken);
    }
    // Supprimer les comptes utilisateurs via Prisma direct n'est pas accessible
    // en test d'intégration — les utilisateurs de test resteront en base
    // (emails uniques avec timestamp, pas de pollution fonctionnelle)
    console.log('\n🧹 Nettoyage terminé');
    console.log(`   Programme ${programId} supprimé`);
    console.log(`   Relation ClientCoach ${clientCoachRelationId} retirée`);
    console.log(`   Utilisateurs test (emails *_${SUFFIX}@fitflow.test) conservés en base`);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 1 : Création d'un programme lié au client
  // ─────────────────────────────────────────────────────────────────────────────

  test('1 - Le coach peut créer un programme pour son client (validation M2M)', async () => {
    const today = todayLocal();

    const res = await api('POST', '/programs', {
      clientId: clientProfileId,
      title: `Programme Test ${SUFFIX}`,
      description: 'Créé par les tests automatisés',
      startDate: today,
    }, coachToken);

    assert.equal(res.status, 201, `Création programme échouée: ${res.data.message}`);
    assert.ok(res.data.data.id, 'Le programme doit avoir un ID');
    assert.equal(res.data.data.clientId, clientProfileId, 'Le clientId doit correspondre au profil client');
    assert.equal(res.data.data.isActive, true, 'Le programme doit être actif par défaut');

    programId = res.data.data.id;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 2 : Création d'une séance avec exercices complets
  // ─────────────────────────────────────────────────────────────────────────────

  test('2 - Le coach peut créer une séance avec exercices', async () => {
    const today = todayLocal();

    const payload = {
      programId,
      date: today,
      status: 'DRAFT',
      notes: 'Séance test automatisée',
      isRestDay: false,
      exercises: [
        {
          name: 'Échauffement course',
          category: 'WARMUP',
          duration: '10min',
          order: 0,
        },
        {
          name: 'Développé couché',
          category: 'MAIN',
          sets: 4,
          reps: '8-10',
          weight: '80kg',
          restTime: '2:00',
          description: 'Barre avec grip standard',
          order: 1,
        },
        {
          name: 'Tapis de course',
          category: 'CARDIO',
          sets: 1,
          duration: '20min',
          restTime: '0:00',
          order: 2,
        },
        {
          name: 'Étirements quadriceps',
          category: 'STRETCHING',
          duration: '5min',
          order: 3,
        },
      ],
    };

    const res = await api('POST', '/sessions', payload, coachToken);

    assert.equal(res.status, 201, `Création séance échouée: ${res.data.message}`);
    assert.ok(res.data.data.id, 'La séance doit avoir un ID');
    assert.equal(res.data.data.programId, programId);
    assert.equal(res.data.data.status, 'DRAFT');
    assert.equal(res.data.data.isRestDay, false);
    assert.equal(res.data.data.notes, 'Séance test automatisée');
    assert.equal(res.data.data.exercises.length, 4, 'La séance doit avoir 4 exercices');

    sessionId = res.data.data.id;
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 3 : Vérification des champs exercices
  // ─────────────────────────────────────────────────────────────────────────────

  test('3 - Les champs exercices sont correctement sauvegardés', async () => {
    const res = await api('GET', `/sessions/${sessionId}`, undefined, coachToken);

    assert.equal(res.status, 200);
    const exercises = res.data.data.exercises;

    // Vérifier l'ordre
    assert.equal(exercises[0].category, 'WARMUP');
    assert.equal(exercises[1].category, 'MAIN');
    assert.equal(exercises[2].category, 'CARDIO');
    assert.equal(exercises[3].category, 'STRETCHING');

    // WARMUP : duration uniquement
    const warmup = exercises[0];
    assert.equal(warmup.name, 'Échauffement course');
    assert.equal(warmup.duration, '10min');
    assert.equal(warmup.sets, null);
    assert.equal(warmup.reps, null);

    // MAIN : sets, reps, weight, restTime
    const main = exercises[1];
    assert.equal(main.name, 'Développé couché');
    assert.equal(main.sets, 4);
    assert.equal(main.reps, '8-10');
    assert.equal(main.weight, '80kg');
    assert.equal(main.restTime, '2:00');
    assert.equal(main.description, 'Barre avec grip standard');

    // CARDIO : duration + sets
    const cardio = exercises[2];
    assert.equal(cardio.name, 'Tapis de course');
    assert.equal(cardio.duration, '20min');
    assert.equal(cardio.sets, 1);

    // STRETCHING : duration
    const stretch = exercises[3];
    assert.equal(stretch.name, 'Étirements quadriceps');
    assert.equal(stretch.duration, '5min');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 4 : La séance apparaît dans les programmes du client
  // ─────────────────────────────────────────────────────────────────────────────

  test('4 - La séance est visible côté client (getClientPrograms)', async () => {
    const res = await api('GET', '/programs/client', undefined, clientToken);

    assert.equal(res.status, 200, `Récupération programmes client échouée: ${res.data.message}`);
    assert.ok(Array.isArray(res.data.data), 'Les programmes doivent être un tableau');

    const program = res.data.data.find(p => p.id === programId);
    assert.ok(program, 'Le programme créé doit apparaître côté client');
    assert.equal(program.clientId, clientProfileId, 'Le clientId doit être le profil client');
    assert.ok(Array.isArray(program.sessions), 'Les sessions doivent être incluses');
    assert.equal(program.sessions.length, 1, 'Le programme doit avoir 1 séance');
    assert.equal(program.sessions[0].id, sessionId);
    assert.equal(program.sessions[0].exercises.length, 4, 'Les 4 exercices doivent être inclus');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 5 : La séance du jour est détectée (logique mobile)
  // ─────────────────────────────────────────────────────────────────────────────

  test("5 - La séance d'aujourd'hui est correctement détectée (logique dashboard mobile)", async () => {
    const res = await api('GET', '/programs/client', undefined, clientToken);
    const program = res.data.data.find(p => p.id === programId);
    const sessions = program.sessions;

    const today = todayLocal();

    // Simulation de getTodaySession() du DashboardScreen.js
    const todaySession = sessions.find(s => s.date.startsWith(today));
    assert.ok(todaySession, `Aucune séance trouvée pour aujourd'hui (${today}). Date stockée: ${sessions[0]?.date}`);
    assert.equal(todaySession.id, sessionId);

    // Simulation de getUpcomingSessions() (séances futures uniquement)
    const upcomingSessions = sessions.filter(s => dateLocal(new Date(s.date)) > today);
    assert.equal(upcomingSessions.length, 0, "Aucune séance future attendue (la séance est aujourd'hui)");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 6 : Upsert par ID — les exercices sont remplacés
  // ─────────────────────────────────────────────────────────────────────────────

  test('6 - Mise à jour de séance (upsert par ID) : exercices remplacés', async () => {
    const today = todayLocal();

    const res = await api('POST', '/sessions', {
      id: sessionId,
      programId,
      date: today,
      status: 'DONE',
      notes: 'Séance modifiée',
      isRestDay: false,
      exercises: [
        {
          name: 'Squat',
          category: 'MAIN',
          sets: 5,
          reps: '5',
          weight: '100kg',
          order: 0,
        },
      ],
    }, coachToken);

    assert.equal(res.status, 200, `Mise à jour séance échouée: ${res.data.message}`);
    assert.equal(res.data.data.id, sessionId, 'Le même ID de séance doit être retourné');
    assert.equal(res.data.data.status, 'DONE');
    assert.equal(res.data.data.notes, 'Séance modifiée');
    assert.equal(res.data.data.exercises.length, 1, 'Les 4 anciens exercices doivent être remplacés par 1');
    assert.equal(res.data.data.exercises[0].name, 'Squat');
    assert.equal(res.data.data.exercises[0].sets, 5);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 7 : Upsert avec liste vide — tous les exercices supprimés
  // ─────────────────────────────────────────────────────────────────────────────

  test('7 - Upsert avec exercises=[] vide supprime tous les exercices', async () => {
    const today = todayLocal();

    const res = await api('POST', '/sessions', {
      id: sessionId,
      programId,
      date: today,
      status: 'DRAFT',
      notes: 'Séance vide',
      isRestDay: false,
      exercises: [],
    }, coachToken);

    assert.equal(res.status, 200);
    assert.equal(res.data.data.exercises.length, 0, 'Tous les exercices doivent être supprimés');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 8 : Création d'une séance de repos
  // ─────────────────────────────────────────────────────────────────────────────

  test('8 - Création séance de repos (isRestDay=true)', async () => {
    const tomorrow = dateLocal(new Date(Date.now() + 86400000));

    const res = await api('POST', '/sessions', {
      programId,
      date: tomorrow,
      status: 'DRAFT',
      isRestDay: true,
      exercises: [],
    }, coachToken);

    assert.equal(res.status, 201, `Création séance repos échouée: ${res.data.message}`);
    assert.equal(res.data.data.isRestDay, true);
    assert.equal(res.data.data.exercises.length, 0);

    // Vérifier que cette séance n'apparaît pas comme séance "du jour"
    const clientRes = await api('GET', '/programs/client', undefined, clientToken);
    const program = clientRes.data.data.find(p => p.id === programId);
    const today = todayLocal();
    const todaySession = program.sessions.find(s => s.date.startsWith(today));

    // La séance d'aujourd'hui est bien la séance d'entraînement (sessionId), pas celle de demain
    if (todaySession) {
      assert.equal(todaySession.isRestDay, false, "La séance d'aujourd'hui ne doit pas être un jour de repos");
    }

    // La séance de repos doit apparaître dans les séances à venir
    const upcomingSessions = program.sessions.filter(s => dateLocal(new Date(s.date)) > today);
    const restDayInFuture = upcomingSessions.find(s => s.isRestDay);
    assert.ok(restDayInFuture, 'La séance de repos doit apparaître dans les séances futures');

    // Nettoyer la séance de repos (cascade pas nécessaire, suppression directe)
    await api('DELETE', `/sessions/${res.data.data.id}`, undefined, coachToken);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 9 : Un client ne peut pas créer une séance (COACH only)
  // ─────────────────────────────────────────────────────────────────────────────

  test('9 - Un client ne peut pas créer une séance (403)', async () => {
    const today = todayLocal();

    const res = await api('POST', '/sessions', {
      programId,
      date: today,
      status: 'DRAFT',
      isRestDay: false,
      exercises: [],
    }, clientToken);

    assert.equal(res.status, 403, 'Un client doit recevoir 403 en tentant de créer une séance');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 10 : Un appel sans token est rejeté (401)
  // ─────────────────────────────────────────────────────────────────────────────

  test('10 - Appel sans authentification rejeté (401)', async () => {
    const res = await api('GET', `/sessions/${sessionId}`);
    assert.equal(res.status, 401, 'Un appel sans token doit retourner 401');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 11 : Récupération des séances par programme
  // ─────────────────────────────────────────────────────────────────────────────

  test('11 - Récupération des séances par programme (getSessionsByProgram)', async () => {
    const res = await api('GET', `/sessions/program/${programId}`, undefined, coachToken);

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.data.data));
    // La séance d'aujourd'hui doit apparaître (celle de repos a été supprimée)
    const session = res.data.data.find(s => s.id === sessionId);
    assert.ok(session, 'La séance doit être récupérable via getSessionsByProgram');
    assert.ok(Array.isArray(session.exercises));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // TEST 12 : Pas de doublon par date (contrainte programId_date)
  // ─────────────────────────────────────────────────────────────────────────────

  test('12 - Pas de doublon par date (upsert sans ID utilise programId+date)', async () => {
    const today = todayLocal();

    // Upsert sans ID pour la même date → doit mettre à jour, pas créer
    const res = await api('POST', '/sessions', {
      programId,
      date: today,
      status: 'DRAFT',
      notes: 'Test no-duplicate',
      isRestDay: false,
      exercises: [],
    }, coachToken);

    // Doit retourner 200 (update) pas 201 (create) et garder le même ID
    assert.equal(res.status, 200, 'Un upsert sans ID sur une date existante doit être un UPDATE (200)');
    assert.equal(res.data.data.id, sessionId, "L'ID de la séance doit rester le même");
    assert.equal(res.data.data.notes, 'Test no-duplicate');

    // Vérifier qu'il n'y a toujours qu'une seule séance à cette date
    const listRes = await api('GET', `/sessions/program/${programId}`, undefined, coachToken);
    const sessionsToday = listRes.data.data.filter(s => s.date.startsWith(today));
    assert.equal(sessionsToday.length, 1, 'Il ne doit y avoir qu\'une seule séance par date');
  });

});
