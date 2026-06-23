export function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const cvs = document.createElement('canvas');
            const max = 800;
            let w = img.width, h = img.height;
            if (w > max || h > max) {
                if (w > h) { h *= max / w; w = max; }
                else { w *= max / h; h = max; }
            }
            cvs.width = w; cvs.height = h;
            cvs.getContext('2d').drawImage(img, 0, 0, w, h);
            callback(cvs.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

export function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function formatDateTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const pad = n => n < 10 ? '0' + n : n;
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
}

export function openModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay">${html}</div>`;
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target.id === 'modal-overlay') closeModal();
    });
}

export function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

export function openConfirmModal(title, message, confirmText, onConfirm) {
    openModal(`<div class="modal modal-sm">
    <h2>${title}</h2><div class="modal-sub">${message}</div>
    <div class="modal-actions" style="margin-top:24px;">
      <button class="btn btn-ghost" id="confirm-cancel">Cancel</button>
      <button class="btn btn-danger" id="confirm-go">${confirmText}</button>
    </div>
  </div>`);
    document.getElementById('confirm-cancel').addEventListener('click', closeModal);
    document.getElementById('confirm-go').addEventListener('click', () => { onConfirm(); closeModal(); });
}

export function openPromptModal(title, subtitle, label, initialValue, onConfirm) {
    openModal(`<div class="modal modal-sm">
    <h2>${title}</h2><div class="modal-sub">${subtitle}</div>
    <div class="field"><label>${label}</label><input id="prompt-input" value="${initialValue}"/></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="prompt-cancel">Cancel</button>
      <button class="btn btn-primary" id="prompt-confirm">Confirm</button>
    </div>
  </div>`);
    document.getElementById('prompt-cancel').addEventListener('click', closeModal);
    document.getElementById('prompt-confirm').addEventListener('click', () => {
        onConfirm(document.getElementById('prompt-input').value); closeModal();
    });
    const inp = document.getElementById('prompt-input');
    inp.focus();
    inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('prompt-confirm').click();
    });
}
