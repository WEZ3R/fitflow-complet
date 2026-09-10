/**
 * Tests d'intégration : Messages
 * Couvre : sendMessage, getConversation, getClientTips, markAsRead
 * Note : coachId et clientId dans les messages sont des Profile IDs (pas User IDs)
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe } from './helpers.js';

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

describe('Messages - Envoi', () => {
  test('coach envoie un message CHAT au client', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/messages',
      {
        coachId: coachProfile.id,
        clientId: clientProfile.id,
        content: 'Bonjour, comment tu vas ?',
        type: 'CHAT',
        isSentByCoach: true,
      },
      coachToken
    );
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.content, 'Bonjour, comment tu vas ?');
    assert.equal(body.data.type, 'CHAT');
    assert.equal(body.data.isSentByCoach, true);
  });

  test('client envoie un message CHAT au coach', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/messages',
      {
        coachId: coachProfile.id,
        clientId: clientProfile.id,
        content: 'Je vais bien merci !',
        type: 'CHAT',
        isSentByCoach: false,
      },
      clientToken
    );
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.isSentByCoach, false);
  });

  test('coach envoie un conseil (TIP)', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/messages',
      {
        coachId: coachProfile.id,
        clientId: clientProfile.id,
        content: "Pense à bien t'hydrater !",
        type: 'TIP',
        isSentByCoach: true,
      },
      coachToken
    );
    assert.equal(status, 201);
    assert.equal(body.data.type, 'TIP');
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', '/messages', {
      coachId: coachProfile.id,
      clientId: clientProfile.id,
      content: 'Test',
    });
    assert.equal(status, 401);
  });
});

describe('Messages - Lecture conversation', () => {
  before(async () => {
    // Créer quelques messages supplémentaires
    await apiRequest(
      'POST',
      '/messages',
      {
        coachId: coachProfile.id,
        clientId: clientProfile.id,
        content: 'Séance demain à 9h !',
        type: 'CHAT',
        isSentByCoach: true,
      },
      coachToken
    );
  });

  test('récupérer la conversation entre coach et client', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/messages/conversation/${coachProfile.id}/${clientProfile.id}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
    // Vérifier que seuls les types CHAT/APPOINTMENT_PROPOSAL sont retournés
    const chatMessages = body.data.filter(
      (m) => m.type === 'CHAT' || m.type === 'APPOINTMENT_PROPOSAL'
    );
    assert.equal(chatMessages.length, body.data.length);
  });

  test('récupérer les conseils (TIP) pour un client', async () => {
    const { status, body } = await apiRequest(
      'GET',
      `/messages/tips/client/${clientProfile.id}`,
      null,
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    // Vérifier que seuls les TIPs sont retournés
    const nonTips = body.data.filter((m) => m.type !== 'TIP');
    assert.equal(nonTips.length, 0);
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest(
      'GET',
      `/messages/conversation/${coachProfile.id}/${clientProfile.id}`
    );
    assert.equal(status, 401);
  });
});

describe('Messages - Marquer comme lu', () => {
  let messageId;

  before(async () => {
    const { body } = await apiRequest(
      'POST',
      '/messages',
      {
        coachId: coachProfile.id,
        clientId: clientProfile.id,
        content: 'Message à marquer lu',
        type: 'CHAT',
        isSentByCoach: true,
      },
      coachToken
    );
    messageId = body.data?.id;
  });

  test('marquer un message comme lu', async () => {
    if (!messageId) return;
    const { status, body } = await apiRequest(
      'PATCH',
      `/messages/${messageId}/read`,
      {},
      clientToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);
  });
});
