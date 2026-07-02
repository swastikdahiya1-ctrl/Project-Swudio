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

export function getBootConfig(view) {
    const defaultSettings = {
        dashboard: { offset: 50, stagger: 0.1, duration: 0.5, ease: "back.out(1.2)" },
        overview:  { offset: 20, stagger: 0.05, duration: 0.5, ease: "back.out(1.2)" },
        script:    { offset: 20, stagger: 0.05, duration: 0.5, ease: "back.out(1.2)" },
        board:     { offset: 20, stagger: 0.1, duration: 0.5, ease: "back.out(1.2)" },
        shots:     { offset: 50, stagger: 0.15, duration: 0.5, ease: "back.out(1.2)" },
    };
    try {
        const stored = JSON.parse(localStorage.getItem('studio_boot_settings') || '{}');
        return { ...defaultSettings[view], ...(stored[view] || {}) };
    } catch (e) {
        return defaultSettings[view];
    }
}

let undoToastTimeout = null;

export function showUndoToast(message, onUndo) {
    let toast = document.getElementById('undo-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'undo-toast';
        toast.className = 'undo-toast hidden';
        toast.innerHTML = `
            <div class="undo-toast-content">
                <div style="width: 20px; height: 20px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 4px;">
                    <i class="ti ti-check" style="color: #000; font-size: 14px; font-weight: bold;"></i>
                </div>
                <span id="undo-toast-text"></span>
                <button id="undo-toast-btn">UNDO</button>
                <button id="undo-toast-close"><i class="ti ti-x"></i></button>
            </div>
        `;
        document.body.appendChild(toast);

        const style = document.createElement('style');
        style.innerHTML = `
            .undo-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: #1e1e1e;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 12px 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                z-index: 10000;
                transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
                opacity: 0;
                pointer-events: none;
            }
            .undo-toast.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }
            .undo-toast-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            #undo-toast-text {
                color: #fff;
                font-size: 0.9rem;
                margin-right: 8px;
            }
            #undo-toast-btn {
                background: none;
                border: none;
                color: #fff;
                font-weight: 600;
                font-size: 0.9rem;
                cursor: pointer;
                text-decoration: underline;
                padding: 0;
                margin-left: 8px;
                border-right: 1px solid #333;
                padding-right: 12px;
            }
            #undo-toast-btn:hover { color: #10b981; }
            #undo-toast-close {
                background: none;
                border: none;
                color: #888;
                font-size: 1.1rem;
                cursor: pointer;
                padding: 0;
                margin-left: 4px;
                display: flex;
                align-items: center;
            }
            #undo-toast-close:hover { color: #fff; }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('undo-toast-text').innerText = message;
    
    const btn = document.getElementById('undo-toast-btn');
    const closeBtn = document.getElementById('undo-toast-close');
    
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    const newCloseBtn = closeBtn.cloneNode(true);
    closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

    const hide = () => {
        toast.classList.remove('show');
        if (undoToastTimeout) clearTimeout(undoToastTimeout);
    };

    newBtn.addEventListener('click', () => {
        hide();
        if (onUndo) onUndo();
    });

    newCloseBtn.addEventListener('click', hide);

    toast.classList.remove('show');
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    if (undoToastTimeout) clearTimeout(undoToastTimeout);
    undoToastTimeout = setTimeout(() => {
        hide();
    }, 6000);
}
