const RegisterPage = {
  async render(container) {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <span class="auth-icon">📚</span>
            <h1>Kayıt Ol</h1>
            <p>Hemen öğrenmeye başla</p>
          </div>

          <form id="register-form" class="auth-form">
            <div class="form-group">
              <label for="reg-email">Email</label>
              <input type="email" id="reg-email" required placeholder="email@örnek.com" autocomplete="email">
            </div>

            <div class="form-group">
              <label for="reg-username">Kullanıcı Adı</label>
              <input type="text" id="reg-username" required placeholder="kullaniciadi" autocomplete="username" minlength="3" maxlength="50">
            </div>

            <div class="form-group">
              <label for="reg-displayname">Görünen Ad (opsiyonel)</label>
              <input type="text" id="reg-displayname" placeholder="Adınız Soyadınız">
            </div>

            <div class="form-group">
              <label for="reg-password">Şifre</label>
              <input type="password" id="reg-password" required minlength="6" placeholder="En az 6 karakter" autocomplete="new-password">
            </div>

            <div class="form-group">
              <label for="reg-password2">Şifre Tekrar</label>
              <input type="password" id="reg-password2" required placeholder="Tekrar girin" autocomplete="new-password">
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="register-btn">
              Kayıt Ol
            </button>
          </form>

          <div class="auth-footer">
            <p>Zaten hesabınız var mı? <a href="#/login">Giriş Yap</a></p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = document.getElementById('reg-password').value;
      const password2 = document.getElementById('reg-password2').value;

      if (password !== password2) {
        Toast.show('Şifreler eşleşmiyor', 'error');
        return;
      }

      const btn = document.getElementById('register-btn');
      btn.disabled = true;
      btn.textContent = 'Kayıt yapılıyor...';

      try {
        const data = await API.register({
          email: document.getElementById('reg-email').value,
          username: document.getElementById('reg-username').value,
          display_name: document.getElementById('reg-displayname').value || undefined,
          password
        });

        if (data) {
          Store.set('token', data.token);
          Store.set('user', data.user);
          Toast.show('Kayıt başarılı! 🎉', 'success');
          Router.navigate('/dashboard');
        }
      } catch (err) {
        Toast.show(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Kayıt Ol';
      }
    });
  }
};

Router.register('/register', (container) => RegisterPage.render(container));