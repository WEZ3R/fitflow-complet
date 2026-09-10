import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

/**
 * Rechercher des aliments dans la base Ciqual
 * GET /api/food/search?q=banane&page=1
 */
export const searchFood = async (req, res) => {
  try {
    const { q, page = 1 } = req.query;

    if (!q || q.trim().length < 2) {
      return sendError(res, 'Le terme de recherche doit contenir au moins 2 caractères', 400);
    }

    const pageSize = 20;
    const skip = (parseInt(page) - 1) * pageSize;
    const term = q.trim();

    // Tri : d'abord les aliments qui commencent par le terme, puis ceux qui le contiennent
    const [products, totalResult] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM ciqual_foods
        WHERE name ILIKE ${'%' + term + '%'}
        ORDER BY
          CASE WHEN name ILIKE ${term + '%'} THEN 0 ELSE 1 END,
          name ASC
        LIMIT ${pageSize} OFFSET ${skip}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM ciqual_foods
        WHERE name ILIKE ${'%' + term + '%'}
      `,
    ]);

    const total = totalResult[0]?.count ?? 0;

    sendSuccess(res, {
      products,
      total,
      page: parseInt(page),
      pageSize,
    }, 'Recherche effectuée');
  } catch (error) {
    console.error('Search food error:', error);
    sendError(res, 'Erreur lors de la recherche alimentaire', 500);
  }
};

/**
 * Récupérer un aliment par code Ciqual
 * GET /api/food/:code
 */
export const getFoodByCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return sendError(res, 'Code Ciqual requis', 400);
    }

    const product = await prisma.ciqualFood.findUnique({
      where: { ciqualCode: code },
    });

    if (!product) {
      return sendError(res, 'Aliment non trouvé', 404);
    }

    sendSuccess(res, product, 'Aliment trouvé');
  } catch (error) {
    console.error('Get food by code error:', error);
    sendError(res, "Erreur lors de la récupération de l'aliment", 500);
  }
};
