// === User & Auth ===
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  // ADMIN n'a ni coachProfile ni clientProfile : c'est ce qui l'empêche
  // structurellement d'accéder aux données métier, et non un simple contrôle.
  role: "COACH" | "CLIENT" | "ADMIN";
  coachProfile?: CoachProfile;
  clientProfile?: ClientProfile;
  createdAt: string;
  updatedAt: string;

  // Statut de modération, renvoyé par l'API sur les fiches d'administration.
  status?: "ACTIVE" | "SUSPENDED" | "PENDING_DELETION";
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
  scheduledDeletionAt?: string | null;
}

// === Modération ===

export type ReportReason =
  | "HARASSMENT" | "SPAM" | "INAPPROPRIATE_CONTENT" | "FAKE_PROFILE" | "OTHER";

export type ReportStatus = "PENDING" | "REVIEWING" | "ACTIONED" | "DISMISSED";

export interface Report {
  id: string;
  reason: ReportReason;
  description?: string | null;
  context: "PROFILE" | "CONVERSATION";
  messageId?: string | null;
  status: ReportStatus;
  resolution?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  reported: User;
  reporter?: { id: string; email: string; firstName?: string; lastName?: string } | null;
  conversation?: ModerationMessage[] | null;
  conversationAccess?: string;
}

export interface ModerationMessage {
  id: string;
  content: string;
  type: string;
  isSentByCoach: boolean;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  type: string;
  reason: string;
  createdAt: string;
  moderator?: { email: string } | null;
}

/**
 * Fiche de modération d'un compte, telle que la renvoie `GET /admin/users/:id`.
 * Volontairement pauvre : ni profil, ni statistiques, ni données de santé.
 */
export interface UserFile {
  user: User & {
    suspendedAt?: string | null;
    suspendedUntil?: string | null;
    suspensionReason?: string | null;
    scheduledDeletionAt?: string | null;
  };
  signalements: Array<{
    id: string;
    reason: ReportReason;
    status: ReportStatus;
    createdAt: string;
  }>;
  sanctions: ModerationAction[];
  recours: Array<{ id: string; status: string; createdAt: string }>;
}

export interface Appeal {
  id: string;
  message: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  decision?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  user?: User;
}

export interface CoachProfile {
  id: string;
  userId: string;
  bio?: string;
  city?: string;
  isRemote: boolean;
  profilePicture?: string;
  trainingLocations: string[];
  rating: number;
  ratingCount: number;
  onboardingCompletedAt?: string;
  user: User;
  reviews?: Review[];
}

export interface ClientCoachRelation {
  id: string;
  coachId: string;
  isPrimary: boolean;
  isActive: boolean;
  startDate: string;
  coach: {
    id: string;
    bio?: string;
    profilePicture?: string;
    user: { firstName: string; lastName: string; email: string };
  };
}

export interface ClientProfile {
  id: string;
  userId: string;
  coachId?: string;
  weight?: number;
  height?: number;
  dateOfBirth?: string;
  gender?: string;
  goals?: string;
  level?: string;
  profilePicture?: string;
  city?: string;
  trainingLocations: string[];
  onboardingCompletedAt?: string;
  user: User;
  coach?: CoachProfile;
  requestStatus?: string;
  requestId?: string;
  requestMessage?: string;
  requestDate?: string;
  createdAt: string;
  coaches?: ClientCoachRelation[];
}

export interface ProspectiveClient extends ClientProfile {
  score: number;
  matchDetails: {
    cityMatch: boolean;
    commonLocations: string[];
  };
}

// === Programs ===
export interface Program {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  cycleDays?: number;
  isActive: boolean;
  clientId: string;
  coachId: string;
  dietEnabled: boolean;
  dietType?: string;
  targetCalories?: number;
  waterTrackingEnabled: boolean;
  waterGoal?: number;
  sleepTrackingEnabled: boolean;
  weightTrackingEnabled: boolean;
  sessions?: Session[];
  createdAt: string;
  updatedAt: string;
}

// === Sessions ===
export interface Session {
  id: string;
  programId: string;
  date: string;
  status: "EMPTY" | "DRAFT" | "DONE";
  name?: string;
  notes?: string;
  isRestDay: boolean;
  completedByClient: boolean;
  exercises?: Exercise[];
  createdAt: string;
  updatedAt: string;
}

// === Exercises ===
export interface Exercise {
  id: string;
  sessionId: string;
  name: string;
  category: "WARMUP" | "MAIN" | "RENFORCEMENT" | "CARDIO" | "STRETCHING";
  order: number;
  sets?: number;
  reps?: string;
  weight?: string;
  weightsPerSet?: string[];
  duration?: string;
  restTime?: string;
  videoUrl?: string;
  gifUrl?: string;
  description?: string;
  exerciseRefId?: string;
  exerciseRef?: ExerciseReference;
  setCompletions?: SetCompletion[];
  supersetGroup?: string | null;
}

// === Exercise Reference (ExerciseDB) ===
export interface ExerciseReference {
  id: string;
  exerciseDbId: string;
  name: string;
  bodyParts: string[];
  targetMuscles: string[];
  secondaryMuscles: string[];
  equipments: string[];
  exerciseType: string;
  gifUrl?: string;
  instructions: string[];
}

export interface SetCompletion {
  id: string;
  exerciseId: string;
  setNumber: number;
  repsAchieved: string;
  /** Temps tenu, pour un exercice de catégorie RENFORCEMENT. */
  durationAchieved?: string;
  weightUsed: string;
  completed: boolean;
}

// === Stats ===
export interface DailyStat {
  id: string;
  clientId: string;
  date: string;
  sleepHours?: number;
  bedTime?: string;
  wakeTime?: string;
  waterIntake?: number;
  weight?: number;
  workoutTime?: string;
  workoutDuration?: number;
  totalCalories?: number;
  calories?: number;
}

// === Meals ===
export interface Meal {
  id: string;
  clientId: string;
  date: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  photo?: string;
}

// === Food (Base Ciqual) ===
export interface FoodProduct {
  id: string;
  ciqualCode: string;
  name: string;
  groupName?: string;
  energyKcal100g: number;
  proteins100g: number;
  carbohydrates100g: number;
  fat100g: number;
  fiber100g: number;
  sugars100g: number;
  salt100g: number;
}

// === Messages ===
export interface Message {
  id: string;
  coachId: string;
  clientId: string;
  content: string;
  type: "CHAT" | "TIP" | "APPOINTMENT_PROPOSAL";
  isSentByCoach: boolean;
  isRead: boolean;
  appointmentId?: string;
  appointment?: {
    id: string;
    title: string;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    meetingType?: string;
    locationType: LocationType;
    locationDetail?: string;
    status: AppointmentStatus;
    rrule?: string;
    parentId?: string;
  };
  createdAt: string;
}

// === Availability ===
export type ContactType = "PHONE" | "GYM" | "CAFE" | "VISIO";

export interface ClientAvailability {
  id: string;
  clientId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  contactTypes: ContactType[];
  createdAt: string;
  updatedAt: string;
}

export interface CoachScheduleBlock {
  id: string;
  coachId: string;
  dayOfWeek?: number;
  date?: string;
  reason?: string;
  createdAt: string;
}

export interface CoachClientBlock {
  id: string;
  coachId: string;
  clientId: string;
  blockedUntil?: string | null;
  reason?: string | null;
  createdAt: string;
}

export interface BlockStatus {
  isBlocked: boolean;
  block: CoachClientBlock | null;
}

// === Appointments ===
export type AppointmentStatus = "PROPOSED" | "CONFIRMED" | "CANCELLED";
export type LocationType = "PHYSICAL" | "REMOTE" | "PHONE" | "GYM" | "CAFE" | "VISIO";

export interface Appointment {
  id: string;
  title: string;
  coachId: string;
  coach?: { id: string; user: { firstName: string; lastName: string } };
  clientId?: string;
  client?: { id: string; user: { firstName: string; lastName: string } };
  startAt: string;
  endAt: string;
  durationMinutes: number;
  locationType: LocationType;
  locationDetail?: string;
  meetingType?: string;
  status: AppointmentStatus;
  rrule?: string;
  parentId?: string;
  message?: Message;
  createdAt: string;
  updatedAt: string;
}

// === Reviews ===
export interface Review {
  id: string;
  clientId: string;
  coachId: string;
  rating: number;
  comment?: string;
  client: { user: User };
  createdAt: string;
}
