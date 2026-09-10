/**
 * Tests d'intégration : Programmes
 * Couvre : createProgram, getCoachPrograms, getClientPrograms, getProgramById, updateProgram, deleteProgram
 */

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, createUser, linkCoachClient, getMe, createProgram } from './helpers.js';

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

  // Lier le client au coach
  await linkCoachClient(coachToken, clientProfile.id, coachProfile.id);
});

describe('Programmes - Création', () => {
  test('coach crée un programme pour son client', async () => {
    const program = await createProgram(coachToken, clientProfile.id);
    assert.ok(program.id);
    assert.equal(program.clientId, clientProfile.id);
    assert.equal(program.coachId, coachProfile.id);
  });

  test('coach ne peut pas créer un programme pour un client non assigné', async () => {
    const otherClient = await createUser('CLIENT');
    const otherClientMe = await getMe(otherClient.token);
    const { body } = await apiRequest(
      'POST',
      '/programs',
      {
        clientId: otherClientMe.clientProfile.id,
        title: 'Programme non autorisé',
        startDate: new Date().toISOString(),
      },
      coachToken
    );
    assert.equal(body.success, false);
    assert.equal(body.message, 'Client not found or not assigned to this coach');
  });

  test('client ne peut pas créer un programme → 403', async () => {
    const { status, body } = await apiRequest(
      'POST',
      '/programs',
      { clientId: clientProfile.id, title: 'Programme', startDate: new Date().toISOString() },
      clientToken
    );
    assert.equal(status, 403);
  });

  test('sans token → 401', async () => {
    const { status } = await apiRequest('POST', '/programs', {
      clientId: clientProfile.id,
      title: 'Programme',
      startDate: new Date().toISOString(),
    });
    assert.equal(status, 401);
  });
});

describe('Programmes - Lecture', () => {
  let programId;

  before(async () => {
    const program = await createProgram(coachToken, clientProfile.id);
    programId = program.id;
  });

  test('coach récupère ses programmes', async () => {
    const { status, body } = await apiRequest('GET', '/programs/coach', null, coachToken);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);
  });

  test('client récupère ses programmes', async () => {
    const { status, body } = await apiRequest('GET', '/programs/client', null, clientToken);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    const ids = body.data.map((p) => p.id);
    assert.ok(ids.includes(programId));
  });

  test('récupérer un programme par ID', async () => {
    const { status, body } = await apiRequest('GET', `/programs/${programId}`, null, coachToken);
    assert.equal(status, 200);
    assert.equal(body.data.id, programId);
  });

  test('programme inexistant → 404', async () => {
    const { status, body } = await apiRequest(
      'GET',
      '/programs/00000000-0000-0000-0000-000000000000',
      null,
      coachToken
    );
    assert.equal(status, 404);
  });
});

describe('Programmes - Mise à jour', () => {
  test('coach met à jour un programme', async () => {
    const program = await createProgram(coachToken, clientProfile.id);
    const { status, body } = await apiRequest(
      'PUT',
      `/programs/${program.id}`,
      { title: 'Titre Modifié', description: 'Nouvelle description' },
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.data.title, 'Titre Modifié');
  });
});

describe('Programmes - Suppression', () => {
  test('coach supprime un programme', async () => {
    const program = await createProgram(coachToken, clientProfile.id);
    const { status, body } = await apiRequest(
      'DELETE',
      `/programs/${program.id}`,
      null,
      coachToken
    );
    assert.equal(status, 200);
    assert.equal(body.success, true);

    // Vérifier la suppression
    const { body: getBody } = await apiRequest('GET', `/programs/${program.id}`, null, coachToken);
    assert.equal(getBody.success, false);
  });
});
