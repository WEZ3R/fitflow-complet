import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

// GET /api/session-templates
export const getSessionTemplates = async (req, res) => {
  try {
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const templates = await prisma.sessionTemplate.findMany({
      where: { coachId: coachProfile.id },
      orderBy: { updatedAt: 'desc' },
    });

    sendSuccess(res, templates);
  } catch (error) {
    console.error('getSessionTemplates error:', error);
    sendError(res, 'Échec de la récupération', 500);
  }
};

// GET /api/session-templates/:id
export const getSessionTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const template = await prisma.sessionTemplate.findUnique({ where: { id } });
    if (!template) return sendError(res, 'Template introuvable', 404);
    if (template.coachId !== coachProfile.id) return sendError(res, 'Accès non autorisé', 403);

    sendSuccess(res, template);
  } catch (error) {
    console.error('getSessionTemplateById error:', error);
    sendError(res, 'Échec de la récupération', 500);
  }
};

// POST /api/session-templates
export const createSessionTemplate = async (req, res) => {
  try {
    const { name, description, exercisesData } = req.body;
    if (!name?.trim()) return sendError(res, 'Le nom est requis', 400);

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const template = await prisma.sessionTemplate.create({
      data: {
        coachId: coachProfile.id,
        name: name.trim(),
        description: description?.trim() || null,
        exercisesData: exercisesData || [],
      },
    });

    sendSuccess(res, template, 'Template de séance créé', 201);
  } catch (error) {
    console.error('createSessionTemplate error:', error);
    sendError(res, 'Échec de la création', 500);
  }
};

// PUT /api/session-templates/:id
export const updateSessionTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, exercisesData } = req.body;

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const existing = await prisma.sessionTemplate.findUnique({ where: { id } });
    if (!existing) return sendError(res, 'Template introuvable', 404);
    if (existing.coachId !== coachProfile.id) return sendError(res, 'Accès non autorisé', 403);

    const updated = await prisma.sessionTemplate.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(exercisesData !== undefined ? { exercisesData } : {}),
      },
    });

    sendSuccess(res, updated, 'Template mis à jour');
  } catch (error) {
    console.error('updateSessionTemplate error:', error);
    sendError(res, 'Échec de la mise à jour', 500);
  }
};

// DELETE /api/session-templates/:id
export const deleteSessionTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    const coachProfile = await prisma.coachProfile.findUnique({ where: { userId: req.user.id } });
    if (!coachProfile) return sendError(res, 'Profil coach introuvable', 404);

    const existing = await prisma.sessionTemplate.findUnique({ where: { id } });
    if (!existing) return sendError(res, 'Template introuvable', 404);
    if (existing.coachId !== coachProfile.id) return sendError(res, 'Accès non autorisé', 403);

    await prisma.sessionTemplate.delete({ where: { id } });

    sendSuccess(res, null, 'Template supprimé');
  } catch (error) {
    console.error('deleteSessionTemplate error:', error);
    sendError(res, 'Échec de la suppression', 500);
  }
};
