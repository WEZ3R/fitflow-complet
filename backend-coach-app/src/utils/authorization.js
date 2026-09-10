/**
 * Vérifications d'appartenance partagées.
 *
 * Ces règles étaient auparavant réécrites à la main dans chaque controller — ou oubliées.
 * Les centraliser garantit que tous les endpoints appliquent la même définition d'un
 * accès légitime, et qu'un nouvel endpoint hérite de la règle plutôt que de la redéfinir.
 *
 * Convention : chaque helper renvoie `true` si l'accès est autorisé, `false` sinon.
 * Les controllers restent responsables du code HTTP (403).
 */

import prisma from '../config/database.js';

/**
 * Récupère les profils coach et client de l'utilisateur connecté.
 * Un utilisateur n'a qu'un seul des deux, selon son rôle.
 */
export const resolveProfiles = async (userId) => {
  const [coachProfile, clientProfile] = await Promise.all([
    prisma.coachProfile.findUnique({ where: { userId }, select: { id: true } }),
    prisma.clientProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);
  return { coachProfile, clientProfile };
};

/**
 * L'utilisateur peut-il accéder aux données d'un client ?
 * Vrai si c'est le client lui-même, ou un coach lié à ce client par une relation active.
 */
export const canAccessClient = async (userId, clientId) => {
  if (!clientId) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);

  if (clientProfile?.id === clientId) return true;
  if (!coachProfile) return false;

  const relation = await prisma.clientCoach.findFirst({
    where: { coachId: coachProfile.id, clientId, isActive: true },
    select: { id: true },
  });
  return !!relation;
};

/**
 * L'utilisateur est-il partie à la conversation entre ce coach et ce client ?
 * Une conversation n'appartient qu'à ses deux participants.
 */
export const canAccessConversation = async (userId, coachId, clientId) => {
  if (!coachId || !clientId) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);
  if (coachProfile?.id === coachId) return true;
  if (clientProfile?.id === clientId) return true;
  return false;
};

/**
 * L'utilisateur peut-il accéder à ce programme ?
 * Vrai pour le coach propriétaire et pour le client auquel il est assigné.
 */
export const canAccessProgram = async (userId, programId) => {
  if (!programId) return false;

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { coachId: true, clientId: true },
  });
  if (!program) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);
  if (coachProfile?.id === program.coachId) return true;
  if (clientProfile?.id === program.clientId) return true;
  return false;
};

/**
 * L'utilisateur peut-il accéder à cette séance ?
 * L'appartenance remonte la chaîne Session → Program.
 */
export const canAccessSession = async (userId, sessionId) => {
  if (!sessionId) return false;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { program: { select: { coachId: true, clientId: true } } },
  });
  if (!session?.program) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);
  if (coachProfile?.id === session.program.coachId) return true;
  if (clientProfile?.id === session.program.clientId) return true;
  return false;
};

/**
 * L'utilisateur peut-il accéder à cet exercice ?
 * Chaîne Exercise → Session → Program.
 */
export const canAccessExercise = async (userId, exerciseId) => {
  if (!exerciseId) return false;

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    select: { session: { select: { program: { select: { coachId: true, clientId: true } } } } },
  });
  const program = exercise?.session?.program;
  if (!program) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);
  if (coachProfile?.id === program.coachId) return true;
  if (clientProfile?.id === program.clientId) return true;
  return false;
};

/**
 * L'utilisateur est-il le coach propriétaire de ce template ?
 * Les templates ne sont jamais partagés entre coachs.
 */
export const ownsTemplate = async (userId, templateId) => {
  if (!templateId) return false;

  const template = await prisma.programTemplate.findUnique({
    where: { id: templateId },
    select: { coachId: true },
  });
  if (!template) return false;

  const { coachProfile } = await resolveProfiles(userId);
  return coachProfile?.id === template.coachId;
};

/**
 * L'utilisateur est-il partie à cette relation coach-client ?
 * Le coach comme le client peuvent la consulter et y mettre fin.
 */
export const canAccessRelation = async (userId, relationId) => {
  if (!relationId) return false;

  const relation = await prisma.clientCoach.findUnique({
    where: { id: relationId },
    select: { coachId: true, clientId: true },
  });
  if (!relation) return false;

  const { coachProfile, clientProfile } = await resolveProfiles(userId);
  if (coachProfile?.id === relation.coachId) return true;
  if (clientProfile?.id === relation.clientId) return true;
  return false;
};
