import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

/**
 * Hash un mot de passe
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Mot de passe hashé
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare un mot de passe avec son hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash à comparer
 * @returns {Promise<boolean>} True si le mot de passe correspond
 */
export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
