import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} payload - Données à inclure dans le token
 * @returns {string} Token JWT
 */
export const generateToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Token à vérifier
 * @returns {Object} Payload décodé
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Invalid token');
  }
};
