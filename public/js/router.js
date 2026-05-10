/**
 * Hash-tabanlı SPA Router
 */
const Router = {
  routes: {},
  currentPage: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    window.location.hash = `#${path}`;
  },

  async resolve() {
    const hash = window.location.hash.slice(1) || '/dashboard';
    const [path, ...paramParts] = hash.split('/').filter(Boolean);
    const route = `/${path}`;
    const params = paramParts;

    // Auth kontrolü
    const publicRoutes = ['/login', '/register'];
    if (!Store.isLoggedIn() && !publicRoutes.includes(route)) {
      window.location.hash = '#/login';
      return;
    }
    if (Store.isLoggedIn() && publicRoutes.includes(route)) {
      window.location.hash = '#/dashboard';
      return;
    }

    const handler = this.routes[route];
    if (handler) {
      Store.set('currentPage', path);
      this.currentPage = path;

      const mainContent = document.getElementById('main-content');
      mainContent.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

      try {
        await handler(mainContent, ...params);
      } catch (err) {
        console.error('Page render error:', err);
        mainContent.innerHTML = `
          <div class="error-page">
            <div class="error-icon">⚠️</div>
            <h2>Bir hata oluştu</h2>
            <p>${err.message}</p>
            <button class="btn btn-primary" onclick="location.reload()">Yenile</button>
          </div>`;
      }

      // Navbar güncelle
      Navbar.update();
    } else {
      document.getElementById('main-content').innerHTML = `
        <div class="error-page">
          <div class="error-icon">🔍</div>
          <h2>Sayfa Bulunamadı</h2>
          <a href="#/dashboard" class="btn btn-primary">Ana Sayfaya Dön</a>
        </div>`;
    }
  },

  init() {
    window.addEventListener('hashchange', () => this.resolve());
    this.resolve();
  }
};