/**
 * Envoie une réponse de succès standardisée
 * @param {Object} res - Express response object
 * @param {*} data - Données à renvoyer
 * @param {string} message - Message de succès
 * @param {number} statusCode - Code de statut HTTP
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Envoie une réponse d'erreur standardisée
 * @param {Object} res - Express response object
 * @param {string} message - Message d'erreur
 * @param {number} statusCode - Code de statut HTTP
 * @param {*} errors - Détails des erreurs
 */
export const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};
