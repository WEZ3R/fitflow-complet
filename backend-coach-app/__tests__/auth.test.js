/**
 * Tests d'intégration : Authentification
 * Couvre : register, login, getMe, updateProfile
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, uniqueSuffix, createUser } from './helpers.js';

describe('Auth - Register', () => {
  test('inscription client réussie', async () => {
    const s = uniqueSuffix();
    const { status, body } = await apiRequest('POST', '/auth/register', {
      email: `client_reg_${s}@test.com`,
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'CLIENT',
    });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.ok(body.data.token);
    assert.equal(body.data.user.role, 'CLIENT');
    assert.equal(body.data.user.email, `client_reg_${s}@test.com`);
  });

  test('inscription coach réussie', async () => {
    const s = uniqueSuffix();
    const { status, body } = await apiRequest('POST', '/auth/register', {
      email: `coach_reg_${s}@test.com`,
      password: 'password123',
      firstName: 'Sophie',
      lastName: 'Martin',
      role: 'COACH',
    });
    assert.equal(status, 201);
    assert.equal(body.success, true);
    assert.equal(body.data.user.role, 'COACH');
  });

  test('inscription sans email → erreur 400', async () => {
    const { status, body } = await apiRequest('POST', '/auth/register', {
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Dupont',
      role: 'CLIENT',
    });
    assert.equal(status, 400);
    assert.equal(body.success, false);
  });

  test('inscription avec email déjà utilisé → erreur', async () => {
    const s = uniqueSuffix();
    const email = `dup_${s}@test.com`;
    await apiRequest('POST', '/auth/register', {
      email,
      password: 'password123',
      firstName: 'Jean',
      lastName: 'Test',
      role: 'CLIENT',
    });
    const { status, body } = await apiRequest('POST', '/auth/register', {
      email,
      password: 'password123',
      firstName: 'Jean2',
      lastName: 'Test2',
      role: 'CLIENT',
    });
    assert.equal(body.success, false);
  });
});

describe('Auth - Login', () => {
  test('login réussi retourne un token', async () => {
    const { email, password } = await createUser('CLIENT');
    const { status, body } = await apiRequest('POST', '/auth/login', { email, password });
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.ok(body.data.token);
  });

  test('mauvais mot de passe → erreur 401', async () => {
    const { email } = await createUser('CLIENT');
    const { status, body } = await apiRequest('POST', '/auth/login', {
      email,
      password: 'wrongpassword',
    });
    assert.equal(status, 401);
    assert.equal(body.success, false);
  });

  test('email inexistant → erreur', async () => {
    const { status, body } = await apiRequest('POST', '/auth/login', {
      email: 'nonexistent@test.com',
      password: 'password123',
    });
    assert.equal(body.success, false);
  });
});

describe('Auth - GetMe', () => {
  test('GET /auth/me retourne le profil utilisateur', async () => {
    const { token, user } = await createUser('CLIENT');
    const { status, body } = await apiRequest('GET', '/auth/me', null, token);
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.id, user.id);
    assert.equal(body.data.email, user.email);
  });

  test('GET /auth/me sans token → 401', async () => {
    const { status, body } = await apiRequest('GET', '/auth/me');
    assert.equal(status, 401);
    assert.equal(body.success, false);
  });

  test('GET /auth/me avec token invalide → 401', async () => {
    const { status, body } = await apiRequest('GET', '/auth/me', null, 'invalid.token.here');
    assert.equal(status, 401);
    assert.equal(body.success, false);
  });
});
