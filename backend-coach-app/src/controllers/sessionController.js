import prisma from '../config/database.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';
import { canAccessProgram, canAccessSession } from '../utils/authorization.js';

/**
 * Créer ou mettre à jour une session
 */
export const upsertSession = async (req, res) => {
  try {
    const { id, programId, date, status, isRestDay, name, notes, exercises } = req.body;

    // Vérifier que le coach est propriétaire du programme
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    const resolvedProgramId = id
      ? (await prisma.session.findUnique({ where: { id }, select: { programId: true } }))?.programId
      : programId;

    if (!resolvedProgramId) {
      return sendError(res, 'Programme introuvable', 404);
    }

    const program = await prisma.program.findUnique({ where: { id: resolvedProgramId } });
    if (!program) {
      return sendError(res, 'Programme non trouvé', 404);
    }
    if (program.coachId !== coachProfile.id) {
      return sendError(res, 'Accès non autorisé à ce programme', 403);
    }

    // Vérifier si la session existe déjà
    let existingSession = null;

    if (id) {
      // Si un ID est fourni, chercher par ID
      existingSession = await prisma.session.findUnique({
        where: { id },
      });
    } else {
      // Sinon, chercher par programId et date
      existingSession = await prisma.session.findUnique({
        where: {
          programId_date: {
            programId,
            date: new Date(date),
          },
        },
      });
    }

    let session;

    if (existingSession) {
      // Mettre à jour la session existante
      session = await prisma.session.update({
        where: { id: existingSession.id },
        data: {
          status,
          name: name ?? existingSession.name,
          isRestDay,
          notes,
        },
      });

      // Remplacer les exercices (même si la liste est vide)
      if (exercises !== undefined) {
        await prisma.exercise.deleteMany({
          where: { sessionId: session.id },
        });

        if (exercises.length > 0) {
          await prisma.exercise.createMany({
            data: exercises.map((ex, index) => ({
              sessionId: session.id,
              name: ex.name,
              category: ex.category,
              sets: ex.sets ?? null,
              reps: ex.reps || null,
              weight: ex.weight || null,
              weightsPerSet: ex.weightsPerSet ?? null,
              duration: ex.duration || null,
              restTime: ex.restTime || null,
              videoUrl: ex.videoUrl || null,
              gifUrl: ex.gifUrl || null,
              description: ex.description || null,
              exerciseRefId: ex.exerciseRefId || null,
              supersetGroup: ex.supersetGroup || null,
              order: index,
            })),
          });
        }
      }
    } else {
      // Créer une nouvelle session
      session = await prisma.session.create({
        data: {
          programId,
          date: new Date(date),
          status: status || 'DRAFT',
          name: name || null,
          isRestDay: isRestDay || false,
          notes,
          exercises: exercises
            ? {
                create: exercises.map((ex, index) => ({
                  name: ex.name,
                  category: ex.category,
                  sets: ex.sets ?? null,
                  reps: ex.reps || null,
                  weight: ex.weight || null,
                  weightsPerSet: ex.weightsPerSet ?? null,
                  duration: ex.duration || null,
                  restTime: ex.restTime || null,
                  videoUrl: ex.videoUrl || null,
                  gifUrl: ex.gifUrl || null,
                  description: ex.description || null,
                  exerciseRefId: ex.exerciseRefId || null,
                  supersetGroup: ex.supersetGroup || null,
                  order: index,
                })),
              }
            : undefined,
        },
      });
    }

    // Récupérer la session complète avec les exercices
    const fullSession = await prisma.session.findUnique({
      where: { id: session.id },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            setCompletions: {
              orderBy: { setNumber: 'asc' },
            },
            exerciseRef: true,
          },
        },
      },
    });

    sendSuccess(res, fullSession, 'Session saved successfully', existingSession ? 200 : 201);
  } catch (error) {
    console.error('Upsert session error:', error);
    sendError(res, 'Failed to save session', 500);
  }
};

/**
 * Récupérer les sessions d'un programme
 */
export const getSessionsByProgram = async (req, res) => {
  try {
    const { programId } = req.params;
    const { startDate, endDate } = req.query;

    if (!(await canAccessProgram(req.user.id, programId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const where = {
      programId,
      ...(startDate &&
        endDate && {
          date: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
    };

    const sessions = await prisma.session.findMany({
      where,
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            setCompletions: {
              orderBy: { setNumber: 'asc' },
            },
            exerciseRef: true,
          },
        },
        comments: true,
      },
      orderBy: { date: 'asc' },
    });

    sendSuccess(res, sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    sendError(res, 'Failed to get sessions', 500);
  }
};

/**
 * Récupérer une session par ID
 */
export const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await canAccessSession(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            setCompletions: {
              orderBy: { setNumber: 'asc' },
            },
            exerciseRef: true,
          },
        },
        comments: true,
      },
    });

    if (!session) {
      return sendError(res, 'Session not found', 404);
    }

    sendSuccess(res, session);
  } catch (error) {
    console.error('Get session error:', error);
    sendError(res, 'Failed to get session', 500);
  }
};

/**
 * Supprimer une session
 */
export const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le coach est propriétaire de la session
    const coachProfile = await prisma.coachProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!coachProfile) {
      return sendError(res, 'Profil coach non trouvé', 404);
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { program: { select: { coachId: true } } },
    });
    if (!session) {
      return sendError(res, 'Session non trouvée', 404);
    }
    if (session.program.coachId !== coachProfile.id) {
      return sendError(res, 'Accès non autorisé à cette session', 403);
    }

    await prisma.session.delete({
      where: { id },
    });

    sendSuccess(res, null, 'Session deleted successfully');
  } catch (error) {
    console.error('Delete session error:', error);
    sendError(res, 'Failed to delete session', 500);
  }
};

/**
 * Valider une session (marquer comme DONE)
 */
export const validateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { durationSeconds } = req.body;

    if (!(await canAccessSession(req.user.id, id))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    const session = await prisma.session.update({
      where: { id },
      data: {
        status: 'DONE',
        completedByClient: true,
        ...(durationSeconds != null && { durationSeconds: parseInt(durationSeconds) }),
      },
      include: {
        exercises: {
          orderBy: { order: 'asc' },
          include: {
            setCompletions: {
              orderBy: { setNumber: 'asc' },
            },
            exerciseRef: true,
          },
        },
      },
    });

    sendSuccess(res, session, 'Session validated successfully');
  } catch (error) {
    console.error('Validate session error:', error);
    sendError(res, 'Failed to validate session', 500);
  }
};

/**
 * Ajouter un commentaire à une session
 */
export const addSessionComment = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content, date, isPastComment } = req.body;

    if (!(await canAccessSession(req.user.id, sessionId))) {
      return sendError(res, 'Accès non autorisé', 403);
    }

    // Le client du commentaire est déduit du programme de la séance, jamais du corps de
    // la requête : une séance n'appartient qu'à un seul client, et faire confiance au
    // clientId envoyé permettait d'écrire un commentaire au nom de n'importe qui.
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { program: { select: { clientId: true } } },
    });
    if (!session?.program) return sendError(res, 'Séance introuvable', 404);

    const comment = await prisma.comment.create({
      data: {
        sessionId,
        clientId: session.program.clientId,
        content,
        date: new Date(date),
        isPastComment,
      },
    });

    sendSuccess(res, comment, 'Comment added successfully', 201);
  } catch (error) {
    console.error('Add comment error:', error);
    sendError(res, 'Failed to add comment', 500);
  }
};
