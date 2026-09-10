import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from '../../config';

// Cache mémoire du token — évite de lire SecureStore à chaque requête (interdit en background iOS)
let _tokenCache = null;

// Storage wrapper qui fonctionne sur web et mobile
const storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key, value) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  async deleteItem(key) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }
};

// Mettre à jour le cache mémoire (appelé depuis AuthContext après login/logout)
export const setTokenCache = (token) => {
  _tokenCache = token;
};

/**
 * Jeton courant, pour les consommateurs hors axios — aujourd'hui la liaison WebSocket.
 * Passe par le même cache et le même stockage que l'intercepteur : un second chemin
 * d'accès au jeton finirait par diverger de celui-ci.
 */
export const getToken = async () => {
  if (_tokenCache) return _tokenCache;
  _tokenCache = await storage.getItem('token');
  return _tokenCache;
};

const api = axios.create({
  baseURL: API_URL,
  // Sans délai maximal, une API injoignable ne renvoie jamais : l'écran reste en
  // chargement indéfiniment et l'utilisateur n'a aucune indication de ce qui se passe.
  // Un échec explicite vaut mieux qu'une attente sans fin.
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token JWT à chaque requête
// Utilise le cache mémoire en priorité pour éviter SecureStore en background
api.interceptors.request.use(
  async (config) => {
    let token = _tokenCache;
    if (!token) {
      // Premier appel ou après redémarrage : lit SecureStore une seule fois
      token = await storage.getItem('token');
      _tokenCache = token;
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Callback appelé lors d'un 401 pour déconnecter l'utilisateur dans le contexte React
let _onUnauthorized = null;
let _unauthorizedHandled = false;
export const setUnauthorizedCallback = (cb) => {
  _onUnauthorized = cb;
  _unauthorizedHandled = false; // reset quand le callback est mis à jour (reconnexion)
};

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !_unauthorizedHandled) {
      _unauthorizedHandled = true;
      await storage.deleteItem('token');
      await storage.deleteItem('user');
      if (_onUnauthorized) _onUnauthorized();
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  logout: async () => {
    await storage.deleteItem('token');
    await storage.deleteItem('user');
  },
  saveToken: async (token) => {
    await storage.setItem('token', token);
  },
  saveUser: async (user) => {
    await storage.setItem('user', JSON.stringify(user));
  },
  getUser: async () => {
    const user = await storage.getItem('user');
    return user ? JSON.parse(user) : null;
  },
  getToken: async () => {
    return await storage.getItem('token');
  },
};

// Programs API
export const programsAPI = {
  getClientPrograms: () => api.get('/programs/client'),
  getById: (id) => api.get(`/programs/${id}`),
  getCoachPrograms: () => api.get('/programs/coach'),
  create: (data) => api.post('/programs', data),
  update: (id, data) => api.put(`/programs/${id}`, data),
  delete: (id) => api.delete(`/programs/${id}`),
};

// Sessions API
export const sessionsAPI = {
  getById: (id) => api.get(`/sessions/${id}`),
  getByProgram: (programId, params) => api.get(`/sessions/program/${programId}`, { params }),
  validateSession: (id, durationSeconds) => api.put(`/sessions/${id}/validate`, durationSeconds != null ? { durationSeconds } : {}),
  upsert: (data) => api.post('/sessions', data),
  delete: (id) => api.delete(`/sessions/${id}`),
};

// Set Completions API
export const setCompletionsAPI = {
  update: (data) => api.put('/set-completions', data),
  delete: (exerciseId, setNumber) => api.delete(`/set-completions/${exerciseId}/${setNumber}`),
  getBySession: (sessionId) => api.get(`/set-completions/session/${sessionId}`),
};

// Daily Stats API
export const statsAPI = {
  upsert: (data) => api.post('/stats', data),
  getClientStats: (clientId, params) => api.get(`/stats/client/${clientId}`, { params }),
  getByDate: (clientId, date) => api.get(`/stats/client/${clientId}/date/${date}`),
};

// Meals API
export const mealsAPI = {
  create: (data) => api.post('/meals', data),
  getClientMeals: (clientId, params) => api.get(`/meals/client/${clientId}`, { params }),
  delete: (id) => api.delete(`/meals/${id}`),
};

// Food API (base Ciqual locale)
export const foodAPI = {
  search: (query, page) => api.get('/food/search', { params: { q: query, page } }),
  getByCode: (code) => api.get(`/food/${code}`),
};

// Exercise References API (ExerciseDB)
export const exerciseRefsAPI = {
  search: (query, limit) => api.get('/exercise-refs/search', { params: { q: query, limit } }),
  getById: (id) => api.get(`/exercise-refs/${id}`),
};

// Clients API
export const clientsAPI = {
  getMe: () => api.get('/clients/me'),
  getById: (id) => api.get(`/clients/${id}`),
  updateMe: (data) => {
    const isFormData = data instanceof FormData;
    return api.put('/clients/me', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
  },
  getCoachClients: () => api.get('/clients/coach'),
};

// Coaches API
export const coachesAPI = {
  getAll: () => api.get('/coaches'),
  getById: (id) => api.get(`/coaches/public/${id}`),
  getMe: () => api.get('/coaches/me'),
  updateMyProfile: (data) => {
    const isFormData = data instanceof FormData;
    return api.put('/coaches/me', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {});
  },
  upsertReview: (coachId, data) => api.post(`/coaches/${coachId}/reviews`, data),
  deleteReview: (coachId) => api.delete(`/coaches/${coachId}/reviews`),
};

// Requests API
export const requestsAPI = {
  send: (data) => api.post('/requests', data),
  getSent: () => api.get('/requests/sent'),
  accept: (requestId) => api.put(`/requests/${requestId}/accept`),
  reject: (requestId) => api.put(`/requests/${requestId}/reject`),
};

// Messages API
export const messagesAPI = {
  getConversation: (coachId, clientId) => api.get(`/messages/conversation/${coachId}/${clientId}`),
  send: (data) => api.post('/messages', data),
  markAsRead: (id) => api.patch(`/messages/${id}/read`),
  getUnreadCount: () => api.get('/messages/unread-count'),
  getUnreadCountsByConversation: () => api.get('/messages/unread-counts'),
  getConversationPartners: () => api.get('/messages/conversations'),
  markConversationAsRead: (coachId, clientId) =>
    api.patch(`/messages/conversation/${coachId}/${clientId}/read`),
};

// Client Coaches API (relations M2M)
export const clientCoachesAPI = {
  setPrimary: (id) => api.patch(`/client-coaches/${id}/primary`),
  remove: (id) => api.delete(`/client-coaches/${id}`),
};

// Custom Goals API
export const goalsAPI = {
  toggleCompletion: (goalId, date, completed) =>
    api.post(`/goals/${goalId}/complete`, { date, completed }),
  getCompletions: (date) => api.get(`/goals/completions?date=${date}`),
};

// Appointments API
export const appointmentsAPI = {
  getAll: (params) => api.get('/appointments', { params }),
  getUpcoming: () => api.get('/appointments/upcoming'),
  getById: (id) => api.get(`/appointments/${id}`),
  create: (data) => api.post('/appointments', data),
  confirm: (id) => api.put(`/appointments/${id}/confirm`),
  cancel: (id, scope) => api.put(`/appointments/${id}/cancel`, {}, scope ? { params: { scope } } : {}),
  delete: (id, scope) => api.delete(`/appointments/${id}`, { params: scope ? { scope } : undefined }),
};

// Gyms API
export const gymsAPI = {
  search: (city, lat, lng, radius) => {
    const params = { radius: radius || 5000 };
    if (city) params.city = city;
    if (lat != null) params.lat = lat;
    if (lng != null) params.lng = lng;
    return api.get('/gyms/search', { params });
  },
};

// Onboarding API
export const onboardingAPI = {
  submitClient: (payload) => api.put('/clients/onboarding', payload),
  submitCoach: (payload) => api.put('/coaches/onboarding', payload),
  getRecommendedCoaches: () => api.get('/coaches/recommended'),
};

// Templates de programme
export const templatesAPI = {
  getAll: () => api.get('/templates'),
  getById: (id) => api.get(`/templates/${id}`),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  apply: (templateId, data) => api.post(`/templates/${templateId}/apply`, data),
};

// Templates de séance
export const sessionTemplatesAPI = {
  getAll: () => api.get('/session-templates'),
  getById: (id) => api.get(`/session-templates/${id}`),
  create: (data) => api.post('/session-templates', data),
  update: (id, data) => api.put(`/session-templates/${id}`, data),
  delete: (id) => api.delete(`/session-templates/${id}`),
};

// Nutrition API
export const nutritionAPI = {
  calculate: (data) => api.post('/nutrition/calculate', data),
};

// Analytics API
export const analyticsAPI = {
  getCoachClients: () => api.get('/analytics/clients'),
  getClientStats: (params) => api.get('/analytics/stats', { params }),
  getClientProgress: (params) => api.get('/analytics/progress', { params }),
  getEstimated1RM: (params) => api.get('/analytics/workout/estimated-1rm', { params }),
  getWeeklyVolume: (params) => api.get('/analytics/workout/volume', { params }),
  getCompletion: (params) => api.get('/analytics/workout/completion', { params }),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export default api;
