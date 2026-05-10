const Navbar = {
  render() {
    const navbar = document.getElementById('navbar');
    const bottomNav = document.getElementById('bottom-nav');

    if (!Store.isLoggedIn()) {
      navbar.classList.add('hidden');
      bottomNav.classList.add('hidden');
      return;
    }

    navbar.classList.remove('hidden');
    bottomNav.classList.remove('hidden');

    const user = Store.get('user');

    navbar.innerHTML = `
      <div class="navbar-inner">
        <a href="#/dashboard" class="navbar-brand">
          <span class="brand-icon">📚</span>
          <span class="brand-text">Reverso SR</span>
        </a>
        <div class="navbar-actions">
          <button class="btn-icon" id="btn-notifications" title="Bildirimler">
            🔔 <span id="notif-badge" class="badge hidden">0</span>
          </button>
          <div class="user-menu">
            <button class="btn-icon user-avatar" id="btn-user-menu">
              ${(user?.display_name || user?.username || 'U')[0].toUpperCase()}
            </button>
            <div class="user-dropdown hidden" id="user-dropdown">
              <div class="dropdown-header">
                <strong>${user?.display_name || user?.username || 'Kullanıcı'}</strong>
                <small>${user?.email || ''}</small>
              </div>
              <a href="#/settings" class="dropdown-item">⚙️ Ayarlar</a>
              <button class="dropdown-item" onclick="Store.logout()">🚪 Çıkış Yap</button>
            </div>
          </div>
        </div>
      </div>
    `;

    const currentPage = Store.get('currentPage');
    const navItems = [
      { path: '/dashboard', icon: '🏠', label: 'Ana Sayfa' },
      { path: '/review', icon: '📖', label: 'Çalış' },
      { path: '/add-word', icon: '➕', label: 'Ekle' },
      { path: '/dictionary', icon: '📖', label: 'Sözlük' },
      { path: '/stats', icon: '📊', label: 'İstatistik' }
    ];

    bottomNav.innerHTML = navItems.map(item => `
      <a href="#${item.path}" class="bottom-nav-item ${currentPage === item.path.slice(1) ? 'active' : ''}">
        <span class="bottom-nav-icon">${item.icon}</span>
        <span class="bottom-nav-label">${item.label}</span>
      </a>
    `).join('');

    document.getElementById('btn-user-menu')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('user-dropdown')?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      document.getElementById('user-dropdown')?.classList.add('hidden');
    });
  },

  update() {
    this.render();
  }
};