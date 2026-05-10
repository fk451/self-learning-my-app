/**
 * Giriş Sayfası
 */
const LoginPage = {
  async render(container) {
    container.innerHTML = `
      <div class="auth-page">
        <div class="auth-card">
          <div class="auth-header">
            <span class="auth-icon">📚</span>
            <h1>Reverso SR</h1>
            <p>Kelime öğrenmenin en akıllı yolu</p>
          </div>

          <form id="login-form" class="auth-form">
            <div class="form-group">
              <label for="login-input">Email veya Kullanıcı Adı</label>
              <input type="text" id="login-input" required autocomplete="username"
                     placeholder="email@örnek.com veya kullanıcıadı">
            </div>

            <div class="form-group">
              <label for="password-input">Şifre</label>
              <input type="password" id="password-input" required autocomplete="current-password"
                     placeholder="••••••••">
            </div>

            <button type="submit" class="btn btn-primary btn-block" id="login-btn">
              Giriş Yap
            </button>
          </form>

          <div class="auth-footer">
            <p>Hesabınız yok mu? <a href="#/register">Kayıt Ol</a></p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('login-btn');
      btn.disabled = true;
      btn.textContent = 'Giriş yapılıyor...';

      try {
        const data = await API.login({
          login: document.getElementById('login-input').value,
          password: document.getElementById('password-input').value
        });

        if (data) {
          Store.set('token', data.token);
          Store.set('user', data.user);
          Toast.show('Hoş geldiniz! 👋', 'success');
          Router.navigate('/dashboard');
        }
      } catch (err) {
        Toast.show(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Giriş Yap';
      }
    });
  }
};

Router.register('/login', (container) => LoginPage.render(container));