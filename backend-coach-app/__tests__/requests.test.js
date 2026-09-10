/**
 * Tests d'intégration : Demandes coach
 * Couvre : createRequest (CLIENT), getSentRequests (CLIENT), getReceivedRequests (COACH),
 *           acceptRequest (COACH), rejectRequest (COACH)
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, getMe } from './helpers.js';

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
});

describe('Demandes - Envoi (CLIENT → COACH)', () => {
  test('client envoie une demande à un coach', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coachProfile.id, message: 'Je souhaite votre accompagnement !' },
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'pending');
    assert.equal(body.data.coachId, coachProfile.id);
    assert.equal(body.data.clientId, clientProfile.id);
  });

  test('envoi en doublon → erreur', async () => {
    const { body } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coachProfile.id, message: 'Doublon' },
      clientToken
    );
    assert.equal(body.success, false);
  });

  test('message manquant → erreur 400', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coachProfile.id },
      clientToken
    );
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('coach ne peut pas envoyer une demande → 403', async () => {
    const { status } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coachProfile.id, message: 'Interdit' },
      coachToken
    );
    assert.equal(status, 403);
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', '/requests', {
      coachId: coachProfile.id,
      message: 'Test',
    });
    assert.equal(status, 401);
  });
});

describe('Demandes - Lecture', () => {
  test('client voit ses demandes envoyées', async () => {
    const { status, body } = await apiRequest('GET', '/requests/sent', null, clientToken);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    assert.equal(body.data[0].clientId, clientProfile.id);
  });

  test('coach voit les demandes reçues', async () => {
    const { status, body } = await apiRequest('GET', '/requests/received', null, coachToken);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    const myRequest = body.data.find((r) => r.clientId === clientProfile.id);
    assert.ok(myRequest, 'La demande envoyée doit être visible par le coach');
  });

  test('client ne peut pas voir les demandes reçues → 403', async () => {
    const { status } = await apiRequest('GET', '/requests/received', null, clientToken);
    assert.equal(status, 403);
  });
});

describe('Demandes - Accepter', () => {
  let requestId;

  before(async () => {
    // Nouveau trio pour éviter l'état "déjà assigné"
    const coach2 = await createUser('COACH');
    const client2 = await createUser('CLIENT');
    const coach2Me = await getMe(coach2.token);

    const { body } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coach2Me.coachProfile.id, message: 'Demande test acceptation' },
      client2.token
    );
    assert.equal(body.success, true, `Création demande échouée: ${JSON.stringify(body)}`);
    requestId = body.data.id;

    // Stocker les tokens
    globalThis._acceptCoachToken = coach2.token;
    globalThis._acceptCoach2Profile = coach2Me.coachProfile;
  });

  test('coach accepte une demande', async () => {
    const { status, body } = await apiRequest(
      'PUT',
      `/requests/${requestId}/accept`,
      {},
      globalThis._acceptCoachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'accepted');
  });
});

describe('Demandes - Refuser', () => {
  test('coach refuse une demande', async () => {
    const coach3 = await createUser('COACH');
    const client3 = await createUser('CLIENT');
    const coach3Me = await getMe(coach3.token);

    const { body: reqBody } = await apiRequest(
      'POST',
      '/requests',
      { coachId: coach3Me.coachProfile.id, message: 'Demande test refus' },
      client3.token
    );
    assert.equal(reqBody.success, true);

    const { status, body } = await apiRequest(
      'PUT',
      `/requests/${reqBody.data.id}/reject`,
      {},
      coach3.token
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'rejected');
  });
});
