/**
 * Tests d'intégration : Statistiques quotidiennes
 * Couvre : upsertDailyStat, getClientStats, getAggregatedStats, getStatByDate
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, todayLocal, dateOffset } from './helpers.js';

let coachToken, clientToken;
let coachProfile, clientProfile;

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
});

describe('Stats - Upsert', () => {
  test('client enregistre ses stats du jour', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/stats',
      {
        clientId: clientProfile.id,
        date: todayLocal(),
        sleepHours: 7.5,
        waterIntake: 2.0,
        weight: 70.5,
      },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.clientId, clientProfile.id);
    assert.equal(body.data.sleepHours, 7.5);
    assert.equal(body.data.waterIntake, 2.0);
  });

  test('upsert met à jour les stats existantes', async () => {
    const date = dateOffset(-1);
    await apiRequest(
      'POST',
      '/stats',
      { clientId: clientProfile.id, date, sleepHours: 6 },
      clientToken
    );
    const { body } = await apiRequest(
      'POST',
      '/stats',
      { clientId: clientProfile.id, date, sleepHours: 8 },
      clientToken
    );
    assert.equal(body.success, true);
    assert.equal(body.data.sleepHours, 8);
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', '/stats', {
      clientId: clientProfile.id,
      date: todayLocal(),
      sleepHours: 7,
    });
    assert.equal(status, 401);
  });
});

describe('Stats - Lecture', () => {
  before(async () => {
    // Créer quelques stats
    for (let i = 0; i < 3; i++) {
      await apiRequest(
        'POST',
        '/stats',
        {
          clientId: clientProfile.id,
          date: dateOffset(-i - 2),
          sleepHours: 7 + i * 0.5,
          waterIntake: 1.5 + i * 0.3,
        },
        clientToken
      );
    }
  });

  test('client récupère ses propres stats', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  test('coach récupère les stats de son client', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
  });

  test('autre utilisateur ne peut pas voir les stats → 403', async () => {
    const otherCoach = await createUser('COACH');
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}`,
      null,
      otherCoach.token
    );
    assert.equal(status, 403);
    assert.equal(body.success, false);
  });

  test('récupérer les stats agrégées', async () => {
    const start = dateOffset(-10);
    const end = todayLocal();
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}/aggregated?startDate=${start}&endDate=${end}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.count >= 0);
    assert.ok(body.data.averages);
    assert.ok(body.data.totals);
  });

  test('récupérer une stat par date', async () => {
    const date = todayLocal();
    // S'assurer qu'il y a une stat pour aujourd'hui
    await apiRequest(
      'POST',
      '/stats',
      { clientId: clientProfile.id, date, sleepHours: 7 },
      clientToken
    );
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}/date/${date}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.clientId, clientProfile.id);
  });

  test('stat par date inexistante → 404', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/stats/client/${clientProfile.id}/date/1990-01-01`,
      null,
      clientToken
    );
    assert.equal(status, 404);
  });
});
