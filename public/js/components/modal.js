/**
 * Modal Component
 */
const Modal = {
  show(title, content, actions = []) {
    const overlay = document.getElementById('modal-overlay');

    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="Modal.hide()">×</button>
        </div>
        <div class="modal-body">${content}</div>
        ${actions.length > 0 ? `
          <div class="modal-actions">
            ${actions.map(a => `
              <button class="btn ${a.class || 'btn-secondary'}" id="modal-action-${a.id || ''}">${a.label}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    overlay.classList.remove('hidden');

    // Dışarı tıklama ile kapat
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.hide();
    });

    // Action handler bağla
    actions.forEach(a => {
      if (a.handler) {
        const btn = document.getElementById(`modal-action-${a.id}`);
        if (btn) btn.addEventListener('click', a.handler);
      }
    });
  },

  confirm(title, message) {
    return new Promise(resolve => {
      Modal.show(title, `<p>${message}</p>`, [
        { id: 'cancel', label: 'İptal', class: 'btn-secondary', handler: () => { Modal.hide(); resolve(false); } },
        { id: 'confirm', label: 'Onayla', class: 'btn-danger', handler: () => { Modal.hide(); resolve(true); } }
      ]);
    });
  },

  hide() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }
};