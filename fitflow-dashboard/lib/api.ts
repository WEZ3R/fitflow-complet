import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthEndpoint = error.config?.url?.includes("/auth/login") || error.config?.url?.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthEndpoint) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// Helper pour créer un FormData à partir d'un objet
function toFormData(data: Record<string, unknown>): FormData {
  const formData = new FormData();
  Object.keys(data).forEach((key) => {
    const value = data[key];
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value as string | Blob);
      }
    }
  });
  return formData;
}

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; firstName: string; lastName: string; role: string; phone?: string }) =>
    api.post("/auth/register", data),
  login: (data: { email: string; password: string }) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
};

export const onboardingAPI = {
  submitClient: (payload: object) => api.put("/clients/onboarding", payload),
  submitCoach: (payload: object) => api.put("/coaches/onboarding", payload),
  searchGyms: (city: string) => api.get("/gyms/search", { params: { city } }),
  searchGymsInDb: (q: string, city?: string) =>
    api.get("/gyms/db-search", { params: { q, ...(city ? { city } : {}) } }),
  /**
   * Salles contenues dans l'emprise visible de la carte.
   * `q` est filtré par le serveur, pour que la carte et la liste montrent le même
   * jeu de résultats et que la recherche ne soit pas bornée aux lignes déjà chargées.
   */
  gymsInBbox: (
    b: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    limit = 300,
    q?: string,
  ) => api.get("/gyms/bbox", { params: { ...b, limit, ...(q ? { q } : {}) } }),
};

// Programs API
export const programsAPI = {
  create: (data: Record<string, unknown>) => api.post("/programs", data),
  getCoachPrograms: () => api.get("/programs/coach"),
  getClientPrograms: () => api.get("/programs/client"),
  getById: (id: string) => api.get(`/programs/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/programs/${id}`, data),
  delete: (id: string) => api.delete(`/programs/${id}`),
};

// Sessions API
export const sessionsAPI = {
  upsert: (data: Record<string, unknown>) => api.post("/sessions", data),
  validate: (id: string) => api.put(`/sessions/${id}/validate`),
  getByProgram: (programId: string, params?: Record<string, unknown>) =>
    api.get(`/sessions/program/${programId}`, { params }),
  getById: (id: string) => api.get(`/sessions/${id}`),
  delete: (id: string) => api.delete(`/sessions/${id}`),
  addComment: (sessionId: string, data: Record<string, unknown>) =>
    api.post(`/sessions/${sessionId}/comments`, data),
};

// Set Completions API
export const setCompletionsAPI = {
  update: (data: Record<string, unknown>) => api.put("/set-completions", data),
  delete: (exerciseId: string, setNumber: number) =>
    api.delete(`/set-completions/${exerciseId}/${setNumber}`),
  getByExercise: (exerciseId: string) => api.get(`/set-completions/exercise/${exerciseId}`),
  getBySession: (sessionId: string) => api.get(`/set-completions/session/${sessionId}`),
};

// Meals API
export const mealsAPI = {
  create: (data: Record<string, unknown>) => {
    return api.post("/meals", toFormData(data), {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  getClientMeals: (clientId: string, params?: Record<string, unknown>) =>
    api.get(`/meals/client/${clientId}`, { params }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/meals/${id}`, data),
  delete: (id: string) => api.delete(`/meals/${id}`),
};

// Stats API
export const statsAPI = {
  upsert: (data: Record<string, unknown>) => api.post("/stats", data),
  getClientStats: (clientId: string, params?: Record<string, unknown>) =>
    api.get(`/stats/client/${clientId}`, { params }),
  getAggregated: (clientId: string, params?: Record<string, unknown>) =>
    api.get(`/stats/client/${clientId}/aggregated`, { params }),
  getByDate: (clientId: string, date: string) => api.get(`/stats/client/${clientId}/date/${date}`),
};

// Messages API
export const messagesAPI = {
  send: (data: Record<string, unknown>) => api.post("/messages", data),
  getConversation: (coachId: string, clientId: string) =>
    api.get(`/messages/conversation/${coachId}/${clientId}`),
  getClientTips: (clientId: string, params?: Record<string, unknown>) =>
    api.get(`/messages/tips/client/${clientId}`, { params }),
  markAsRead: (id: string) => api.patch(`/messages/${id}/read`),
  delete: (id: string) => api.delete(`/messages/${id}`),
  getUnreadCount: () => api.get("/messages/unread-count"),
  getUnreadCountsByConversation: () => api.get("/messages/unread-counts"),
  markConversationAsRead: (coachId: string, clientId: string) =>
    api.patch(`/messages/conversation/${coachId}/${clientId}/read`),
};

// Clients API
export const clientsAPI = {
  getCoachClients: () => api.get("/clients/coach"),
  getById: (id: string) => api.get(`/clients/${id}`),
  getProspectiveClients: () => api.get("/clients/prospection"),
  updateMyProfile: (data: Record<string, unknown>) => {
    const formData = toFormData(data);
    return api.put("/clients/me", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Requests API
export const requestsAPI = {
  accept: (requestId: string) => api.put(`/requests/${requestId}/accept`),
  reject: (requestId: string) => api.put(`/requests/${requestId}/reject`),
};

// Templates API
export const templatesAPI = {
  create: (data: Record<string, unknown>) => api.post("/templates", data),
  getAll: () => api.get("/templates"),
  getById: (id: string) => api.get(`/templates/${id}`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  apply: (templateId: string, data: Record<string, unknown>) =>
    api.post(`/templates/${templateId}/apply`, data),
};

// Nutrition API
export const nutritionAPI = {
  calculate: (data: {
    clientId: string;
    activityFactor: number;
    objective: "maintien" | "prise_de_masse" | "seche";
    surplus?: number;
    deficit?: number;
  }) => api.post("/nutrition/calculate", data),
};

// Session Templates API
export const sessionTemplatesAPI = {
  getAll: () => api.get("/session-templates"),
  getById: (id: string) => api.get(`/session-templates/${id}`),
  create: (data: Record<string, unknown>) => api.post("/session-templates", data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/session-templates/${id}`, data),
  delete: (id: string) => api.delete(`/session-templates/${id}`),
};

// Analytics API
export const analyticsAPI = {
  getCoachClients: () => api.get("/analytics/clients"),
  getClientStats: (params?: Record<string, unknown>) => api.get("/analytics/stats", { params }),
  getClientProgress: (params?: Record<string, unknown>) => api.get("/analytics/progress", { params }),
  getGoalsCompletion: (params?: Record<string, unknown>) => api.get("/analytics/goals", { params }),
  // Analytics musculation
  getEstimated1RM: (params: Record<string, unknown>) => api.get("/analytics/workout/estimated-1rm", { params }),
  getWeeklyVolume: (params: Record<string, unknown>) => api.get("/analytics/workout/volume", { params }),
  getCompletion: (params: Record<string, unknown>) => api.get("/analytics/workout/completion", { params }),
  getLoadProgression: (params: Record<string, unknown>) => api.get("/analytics/workout/load-progression", { params }),
  getSessionINOL: (params: Record<string, unknown>) => api.get("/analytics/workout/inol", { params }),
  getStrengthStandards: (params: Record<string, unknown>) => api.get("/analytics/workout/strength-standards", { params }),
  getVolumeLandmarks: (params: Record<string, unknown>) => api.get("/analytics/workout/volume-landmarks", { params }),
};

// Coaches API (public)
export const coachesAPI = {
  getAll: () => api.get("/coaches"),
  getById: (id: string) => api.get(`/coaches/public/${id}`),
  getMyProfile: () => api.get("/coaches/me"),
  updateMyProfile: (data: Record<string, unknown>) => {
    return api.put("/coaches/me", toFormData(data), {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

// Exercise References API (ExerciseDB)
export const exerciseRefsAPI = {
  search: (query: string, limit?: number) =>
    api.get("/exercise-refs/search", { params: { q: query, limit } }),
  getById: (id: string) => api.get(`/exercise-refs/${id}`),
};

// Client Coaches API (relations M2M)
export const clientCoachesAPI = {
  setPrimary: (id: string) => api.patch(`/client-coaches/${id}/primary`),
  remove: (id: string) => api.delete(`/client-coaches/${id}`),
};

// Appointments API
export const appointmentsAPI = {
  create: (data: Record<string, unknown>) => api.post("/appointments", data),
  getAll: (params?: Record<string, unknown>) => api.get("/appointments", { params }),
  getUpcoming: () => api.get("/appointments/upcoming"),
  getById: (id: string) => api.get(`/appointments/${id}`),
  confirm: (id: string) => api.put(`/appointments/${id}/confirm`),
  update: (id: string, data: Record<string, unknown>) => api.put(`/appointments/${id}`, data),
  cancel: (id: string, scope?: "single" | "series") =>
    api.put(`/appointments/${id}/cancel`, undefined, { params: scope ? { scope } : undefined }),
  delete: (id: string, scope?: "single" | "series") =>
    api.delete(`/appointments/${id}`, { params: scope ? { scope } : undefined }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => api.get("/notifications"),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/read-all"),
};

// Availability API
export const availabilityAPI = {
  // CLIENT : ses propres créneaux
  getMyAvailability: () => api.get("/availability/me"),
  setMyAvailability: (slots: Array<{ dayOfWeek: number; startTime: string; endTime: string; contactTypes: string[] }>) =>
    api.put("/availability", { slots }),
  // COACH : disponibilités d'un client
  getClientAvailability: (clientId: string, month?: string) =>
    api.get(`/availability/${clientId}`, { params: month ? { month } : undefined }),
  // CLIENT : agenda du coach (vérif blocage)
  getCoachAvailability: (coachId: string) => api.get(`/availability/coach/${coachId}`),
  // COACH : son propre agenda bloqué
  getMyScheduleBlocks: () => api.get("/availability/coach/blocks"),
  addScheduleBlock: (data: { dayOfWeek?: number; date?: string; reason?: string }) =>
    api.post("/availability/coach/blocks", data),
  removeScheduleBlock: (blockId: string) => api.delete(`/availability/coach/blocks/${blockId}`),
};

// Block API (coach bloque un client)
export const blockAPI = {
  getStatus: (clientId: string) => api.get(`/availability/client-block/${clientId}`),
  block: (clientId: string, data?: { blockedUntil?: string; reason?: string }) =>
    api.post(`/availability/client-block/${clientId}`, data || {}),
  unblock: (clientId: string) => api.delete(`/availability/client-block/${clientId}`),
};

// Food API (base Ciqual locale)
export const foodAPI = {
  search: (query: string, page?: number) =>
    api.get("/food/search", { params: { q: query, page } }),
  getByCode: (code: string) =>
    api.get(`/food/${code}`),
};

export default api;

// ─── Modération ───────────────────────────────────────────────────────────────

/** Signalement — accessible à tout compte actif, coach comme client. */
export const reportsAPI = {
  create: (data: {
    reportedUserId: string;
    reason: string;
    context: "PROFILE" | "CONVERSATION";
    description?: string;
    messageId?: string;
  }) => api.post("/reports", data),
  mine: () => api.get("/reports/mine"),
};

/** Recours — reste joignable avec un compte suspendu. */
export const appealsAPI = {
  create: (message: string) => api.post("/appeals", { message }),
  mine: () => api.get("/appeals/mine"),
};

/**
 * Administration. Toutes ces routes exigent le rôle ADMIN côté serveur : masquer
 * les écrans dans l'interface est un confort, pas une protection.
 */
export const adminAPI = {
  reports: (status?: string) => api.get("/admin/reports", { params: status ? { status } : {} }),
  report: (id: string) => api.get(`/admin/reports/${id}`),
  dismissReport: (id: string, reason: string) => api.put(`/admin/reports/${id}/dismiss`, { reason }),

  userFile: (id: string) => api.get(`/admin/users/${id}`),
  suspend: (id: string, data: { reason: string; days?: number; reportId?: string }) =>
    api.post(`/admin/users/${id}/suspend`, data),
  unsuspend: (id: string, reason: string) => api.post(`/admin/users/${id}/unsuspend`, { reason }),
  scheduleDeletion: (id: string, data: { reason: string; reportId?: string }) =>
    api.post(`/admin/users/${id}/schedule-deletion`, data),
  cancelDeletion: (id: string, reason: string) =>
    api.post(`/admin/users/${id}/cancel-deletion`, { reason }),

  appeals: (status?: string) => api.get("/admin/appeals", { params: status ? { status } : {} }),
  reviewAppeal: (id: string, data: { accept: boolean; decision: string }) =>
    api.put(`/admin/appeals/${id}`, data),
};
