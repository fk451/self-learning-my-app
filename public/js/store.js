/**
 * Basit Global State Yönetimi
 */
const Store = {
  _state: {
    user: null,
    token: localStorage.getItem('reverso_token') || null,
    theme: localStorage.getItem('reverso_theme') || 'system',
    settings: null,
    currentPage: 'dashboard'
  },

  _listeners: [],

  get(key) {
    return this._state[key];
  },

  set(key, value) {
    this._state[key] = value;

    // Persist
    if (key === 'token') {
      if (value) localStorage.setItem('reverso_token', value);
      else localStorage.removeItem('reverso_token');
    }
    if (key === 'theme') {
      localStorage.setItem('reverso_theme', value);
      this.applyTheme(value);
    }

    this._listeners.forEach(fn => fn(key, value));
  },

  subscribe(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  },

  isLoggedIn() {
    return !!this._state.token;
  },

  logout() {
    this.set('token', null);
    this.set('user', null);
    this.set('settings', null);
    window.location.hash = '#/login';
  },

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  },

  init() {
    this.applyTheme(this._state.theme);
    // Sistem teması değişikliğini dinle
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this._state.theme === 'system') this.applyTheme('system');
    });
  }
};