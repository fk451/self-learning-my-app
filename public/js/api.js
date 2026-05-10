/**
 * API İletişim Katmanı
 */
const API = {
  baseUrl: '/api',

  async request(method, endpoint, data = null) {
    const config = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };

    const token = Store.get('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);

      if (response.status === 401) {
        Store.logout();
        Toast.show('Oturum süresi doldu', 'error');
        return null;
      }

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || 'Bir hata oluştu');
      }

      return json;
    } catch (err) {
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        Toast.show('Bağlantı hatası — Çevrimdışı mısınız?', 'warning');
        return null;
      }
      throw err;
    }
  },

  // Auth
  login: (data) => API.request('POST', '/auth/login', data),
  register: (data) => API.request('POST', '/auth/register', data),
  getProfile: () => API.request('GET', '/auth/me'),
  updateProfile: (data) => API.request('PUT', '/auth/me', data),

  // Words
  getWords: (params = '') => API.request('GET', `/words?${params}`),
  getWord: (id) => API.request('GET', `/words/${id}`),
  addWord: (data) => API.request('POST', '/words', data),
  updateWord: (id, data) => API.request('PUT', `/words/${id}`, data),
  deleteWord: (id) => API.request('DELETE', `/words/${id}`),
  getMasteryStats: () => API.request('GET', '/words/stats/mastery'),
  
   // Lookup — YENİ
  lookupWord: (word) => API.request('GET', `/lookup/search/${encodeURIComponent(word)}`),
  

  // Review
  getDueWords: (type = 'daily_review') => API.request('GET', `/review/due?session_type=${type}`),
  submitReview: (data) => API.request('POST', '/review/submit', data),

  // Sessions
  startSession: (data) => API.request('POST', '/sessions/start', data),
  completeSession: (id, data) => API.request('PUT', `/sessions/${id}/complete`, data),
  getSessions: (params = '') => API.request('GET', `/sessions?${params}`),

  // Stats
  getDashboard: () => API.request('GET', '/stats/dashboard'),
  getPosDistribution: () => API.request('GET', '/stats/pos-distribution'),
  getWeeklyStats: (weeks = 4) => API.request('GET', `/stats/weekly?weeks=${weeks}`),
  getLeeches: () => API.request('GET', '/stats/leeches'),

  // Tags
  getTags: () => API.request('GET', '/tags'),
  createTag: (data) => API.request('POST', '/tags', data),
  updateTag: (id, data) => API.request('PUT', `/tags/${id}`, data),
  deleteTag: (id) => API.request('DELETE', `/tags/${id}`),
  assignTag: (data) => API.request('POST', '/tags/assign', data),
  unassignTag: (wordId, tagId) => API.request('DELETE', `/tags/unassign/${wordId}/${tagId}`),

  // Notifications
  getSchedules: () => API.request('GET', '/notifications/schedules'),
  createSchedule: (data) => API.request('POST', '/notifications/schedules', data),
  updateSchedule: (id, data) => API.request('PUT', `/notifications/schedules/${id}`, data),
  deleteSchedule: (id) => API.request('DELETE', `/notifications/schedules/${id}`),
  getNotificationLogs: (params = '') => API.request('GET', `/notifications/logs?${params}`),
  markRead: (id) => API.request('PUT', `/notifications/logs/${id}/read`),
  markAllRead: () => API.request('PUT', '/notifications/logs/read-all'),

  // Settings
  getSettings: () => API.request('GET', '/settings'),
  updateSettings: (data) => API.request('PUT', '/settings', data)
};