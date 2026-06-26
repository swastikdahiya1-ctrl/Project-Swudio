import { state } from './state.js';
import { uid, openPromptModal, openConfirmModal } from './utils.js';
import { saveAll, makeChecklist } from './db.js';

function getShotStatus(s) {
    if (!s.tasks || s.tasks.length === 0) return 'Not Started';
    const done = s.tasks.filter(t => t.done).length;
    let status = 'Not Started';
    if (done === 0) status = 'Not Started';
    else if (done === s.tasks.length) status = 'Complete';
    else status = 'WIP';
    
    if (s.status !== status) {
        s.status = status;
    }
    return status;
}

export function renderShots(c, p) {
    if (!p) return;
    if (state.S.shotId) {
        renderShotDetail(c, p, state.S.shotId);
        return;
    }
    const g = document.createElement('div');
    g.style.padding = '40px';
    g.style.maxWidth = '1200px';
    g.style.margin = '0 auto';

    const filterCounts = {
        all: p.shots ? p.shots.length : 0,
        notStarted: p.shots ? p.shots.filter(s => getShotStatus(s) === 'Not Started').length : 0,
        wip: p.shots ? p.shots.filter(s => getShotStatus(s) === 'WIP').length : 0,
        complete: p.shots ? p.shots.filter(s => getShotStatus(s) === 'Complete').length : 0
    };

    // Aggregate task completion across all shots for the progress bar
    let totalTasks = 0, doneTasks = 0;
    (p.shots || []).forEach(s => {
        if (s.tasks) { totalTasks += s.tasks.length; doneTasks += s.tasks.filter(t => t.done).length; }
    });
    let tCount = filterCounts.all;
    let cCount = filterCounts.complete;
    let pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
    let remaining = tCount - cCount;

    g.innerHTML = `
    <div class="shots-header-revamp" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
        <div class="shots-header-titles">
            <h1>SHOTS</h1>
            <p>ALL SHOTS IN YOUR PROJECT.</p>
        </div>
        <button class="btn btn-ghost" id="new-shot-btn" style="border-radius:0; border:1px solid #333; color:var(--text-main); font-size:11px; padding:6px 12px; display:flex; align-items:center; gap:6px;"><i class="ti ti-plus"></i> NEW SHOT</button>
    </div>

    <div class="shots-dash-bar-revamp">
      <div class="shots-filters">
        <button class="shot-filter-btn ${state.S.shotsFilter === 'All' ? 'active' : ''}" data-f="All">ALL <span>${filterCounts.all}</span></button>
        <button class="shot-filter-btn ${state.S.shotsFilter === 'Not Started' ? 'active' : ''}" data-f="Not Started">NOT STARTED <span>${filterCounts.notStarted}</span></button>
        <button class="shot-filter-btn ${state.S.shotsFilter === 'WIP' ? 'active' : ''}" data-f="WIP">WIP <span>${filterCounts.wip}</span></button>
        <button class="shot-filter-btn ${state.S.shotsFilter === 'Complete' ? 'active' : ''}" data-f="Complete">COMPLETE <span>${filterCounts.complete}</span></button>
      </div>
      <div class="dash-divider"></div>
      <div class="dash-stat-block">
        TOTAL SHOTS
        <div class="dash-stat-val">${tCount}</div>
      </div>
      <div class="dash-divider"></div>
      <div class="dash-prog-container">
        <div class="dash-prog-top">
          <span>% COMPLETE</span>
          <span>${pct}%</span>
        </div>
        <div class="dash-prog-track">
          <div class="dash-prog-fill" style="width: ${pct}%;"></div>
        </div>
      </div>
      <div class="dash-divider"></div>
      <div class="dash-stat-block">
        EST. REMAINING
        <div class="dash-stat-val">${remaining} SHOTS</div>
      </div>
    </div>

    <div class="shots-grid-revamp" id="sg-container"></div>
    `;

    c.innerHTML = '';
    c.appendChild(g);

    g.querySelector('#new-shot-btn').addEventListener('click', () => {
        openPromptModal("New Shot", "Enter shot title", "Title", "", val => {
            if (val.trim()) {
                p.shots = p.shots || [];
                const n = p.shots.length + 1;
                p.shots.push({
                    id: uid(),
                    title: val.trim(),
                    number: n,
                    status: 'Not Started',
                    type: '3D',
                    tasks: makeChecklist('3D')
                });
                p.lastEdited = new Date().toISOString();
                saveAll();
                renderShots(c, p);
            }
        });
    });

    g.querySelectorAll('.shot-filter-btn').forEach(f => f.addEventListener('click', (e) => {
        state.S.shotsFilter = e.currentTarget.dataset.f;
        renderShots(c, p);
    }));

    const sg = g.querySelector('#sg-container');
    let fShots = p.shots || [];
    if (state.S.shotsFilter !== 'All') {
        fShots = fShots.filter(s => getShotStatus(s) === state.S.shotsFilter);
    }

    if (fShots.length === 0) {
        sg.innerHTML = `<div style="color:var(--text-muted); font-family:'IBM Plex Mono', monospace; font-size:12px;">No shots match this filter.</div>`;
    }

    sg.innerHTML = fShots.map(s => {
        const thumb = s.heroImage || '';
        let sType = s.type || '2D';
        const tasksLen = s.tasks ? s.tasks.length : 0;
        const tasksDone = s.tasks ? s.tasks.filter(t => t.done).length : 0;
        let sPct = tasksLen === 0 ? 0 : Math.round((tasksDone/tasksLen)*100);
        const status = getShotStatus(s);
        let sClass = 'box-ns';
        let sBg = '#555';
        let sTxt = 'NOT STARTED';
        if (status === 'WIP') { sClass = 'box-wip'; sBg = 'var(--accent-blue)'; sTxt = 'WIP'; }
        if (status === 'Complete') { sClass = 'box-comp'; sBg = 'var(--accent-green)'; sTxt = 'COMPLETE'; }

        return `
    <div class="shot-card-revamp" data-sid="${s.id}">
      <div class="shot-thumb-area">
        <div class="shot-badge badge-tl">SHOT ${s.number < 10 ? '0' + s.number : s.number}</div>
        <div class="shot-badge badge-tr"><i class="ti ti-grip-vertical"></i></div>
        <div class="shot-badge badge-br">${sType}</div>
        ${thumb ? `<img src="${thumb}" alt="" draggable="false">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#333;"><i class="ti ti-camera-off" style="font-size:24px;"></i></div>`}
      </div>
      <div class="shot-info-area">
        <div class="shot-info-top">
          <div class="shot-card-title-revamp">${s.title}</div>
          <div class="shot-actions">
            <button class="shot-edit-btn" data-sid="${s.id}" style="background:transparent; border:none; color:#888; cursor:pointer;"><i class="ti ti-pencil"></i></button>
            <button class="shot-del-btn" data-sid="${s.id}" style="background:transparent; border:none; color:#888; cursor:pointer;"><i class="ti ti-trash"></i></button>
          </div>
        </div>
        <div class="shot-prog-row">
          <div class="shot-status-box ${sClass}">${sTxt}</div>
          <div class="shot-mini-track">
            <div class="shot-mini-fill" style="width:${sPct}%; background:${sBg};"></div>
          </div>
          <div class="shot-pct-txt">${sPct}%</div>
        </div>
      </div>
    </div>`;
    }).join('');

    // Interactions
    g.querySelectorAll('.shot-card-revamp').forEach(card => card.addEventListener('click', (e) => {
        if (e.target.closest('.shot-edit-btn') || e.target.closest('.shot-del-btn') || e.target.closest('.badge-tr')) return;
        state.S.shotId = card.dataset.sid; import('./main.js').then(m => m.render());
    }));

    g.querySelectorAll('.shot-edit-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.sid;
        const s = p.shots.find(x => x.id === sid);
        import('./utils.js').then(({ openModal, closeModal }) => {
            openModal(`<div class="modal modal-sm">
                <h2>Edit Shot</h2>
                <div class="modal-sub">Update this shot's details.</div>
                <div class="field"><label>Title</label><input id="edit-shot-title" value="${s.title || ''}"/></div>
                <div class="field" style="margin-top:12px;">
                    <label style="margin-bottom:8px; display:block;">Type</label>
                    <div style="display:flex; gap:0;">
                        <button id="type-3d-btn" style="flex:1; padding:8px; border:1px solid #333; background:${s.type==='3D'?'#222':'transparent'}; color:${s.type==='3D'?'#fff':'#888'}; font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; border-radius:0;">3D</button>
                        <button id="type-2d-btn" style="flex:1; padding:8px; border:1px solid #333; border-left:none; background:${s.type==='2D'?'#222':'transparent'}; color:${s.type==='2D'?'#fff':'#888'}; font-family:'IBM Plex Mono',monospace; font-size:11px; cursor:pointer; border-radius:0;">2D</button>
                    </div>
                </div>
                <div class="modal-actions" style="margin-top:16px;">
                    <button class="btn btn-ghost" id="edit-shot-cancel">Cancel</button>
                    <button class="btn btn-primary" id="edit-shot-confirm">Save</button>
                </div>
            </div>`);
            let selectedType = s.type || '3D';
            const btn3d = document.getElementById('type-3d-btn');
            const btn2d = document.getElementById('type-2d-btn');
            const setType = t => {
                selectedType = t;
                btn3d.style.background = t === '3D' ? '#222' : 'transparent';
                btn3d.style.color = t === '3D' ? '#fff' : '#888';
                btn2d.style.background = t === '2D' ? '#222' : 'transparent';
                btn2d.style.color = t === '2D' ? '#fff' : '#888';
            };
            btn3d.addEventListener('click', () => setType('3D'));
            btn2d.addEventListener('click', () => setType('2D'));
            document.getElementById('edit-shot-cancel').addEventListener('click', closeModal);
            document.getElementById('edit-shot-confirm').addEventListener('click', () => {
                const newTitle = document.getElementById('edit-shot-title').value.trim();
                if (newTitle) s.title = newTitle;
                if (selectedType !== s.type) {
                    s.type = selectedType;
                    s.tasks = makeChecklist(selectedType);
                }
                p.lastEdited = new Date().toISOString();
                saveAll();
                closeModal();
                renderShots(c, p);
            });
            const inp = document.getElementById('edit-shot-title');
            inp.focus();
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('edit-shot-confirm').click(); });
        });
    }));

    g.querySelectorAll('.shot-del-btn').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sid = btn.dataset.sid;
        const s = p.shots.find(x => x.id === sid);
        openConfirmModal("Delete Shot", `Are you sure you want to delete SHOT ${s.number}?`, "Delete", () => {
            const idx = p.shots.findIndex(x => x.id === sid);
            if (idx > -1) {
                const deleted = p.shots.splice(idx, 1)[0];
                state.archives.push({ type: 'shot', data: deleted, archivedAt: new Date().toISOString() });
                p.shots.forEach((x, i) => x.number = i + 1);
                p.lastEdited = new Date().toISOString(); saveAll(); renderShots(c, p);
            }
        });
    }));

    // Drag and Drop reordering
    let draggedItem = null;
    g.querySelectorAll('.shot-card-revamp').forEach(card => {
        const handle = card.querySelector('.badge-tr');
        if(handle) {
            handle.addEventListener('mousedown', () => { card.setAttribute('draggable', 'true'); });
            handle.addEventListener('mouseup', () => { card.removeAttribute('draggable'); });
            handle.addEventListener('mouseleave', () => { card.removeAttribute('draggable'); });
        }
        
        card.addEventListener('dragstart', function(e) {
            draggedItem = this;
            e.dataTransfer.effectAllowed = "move";
            setTimeout(() => this.style.opacity = '0.5', 0);
        });

        card.addEventListener('dragend', function() {
            setTimeout(() => {
                this.style.opacity = '1';
                draggedItem = null;
                this.removeAttribute('draggable');
                
                const newIds = Array.from(g.querySelectorAll('.shot-card-revamp')).map(el => el.dataset.sid);
                p.shots.sort((a, b) => newIds.indexOf(a.id) - newIds.indexOf(b.id));
                p.shots.forEach((x, i) => x.number = i + 1);
                p.lastEdited = new Date().toISOString(); saveAll();
                
                renderShots(c, p);
            }, 0);
        });

        card.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
        });

        card.addEventListener('dragenter', function(e) {
            e.preventDefault();
            if (draggedItem !== this) {
                this.style.borderColor = 'var(--accent-blue)';
            }
        });

        card.addEventListener('dragleave', function() {
            this.style.borderColor = '';
        });

        card.addEventListener('drop', function(e) {
            e.stopPropagation();
            this.style.borderColor = '';
            if (draggedItem !== this) {
                const allCards = Array.from(g.querySelectorAll('.shot-card-revamp'));
                const draggedIdx = allCards.indexOf(draggedItem);
                const thisIdx = allCards.indexOf(this);
                if (draggedIdx < thisIdx) {
                    this.parentNode.insertBefore(draggedItem, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedItem, this);
                }
            }
            return false;
        });
    });

    if (typeof gsap !== 'undefined' && !window._reduceMotion) {
        import('./utils.js').then(({ getBootConfig }) => {
            const cfg = getBootConfig('shots');
            window._bootedProjects = window._bootedProjects || {};
            window._bootedProjects.shots = window._bootedProjects.shots || {};
            
            if (!window._bootedProjects.shots[p.id]) {
                const header = c.querySelector('.shots-header-revamp');
                const dashBar = c.querySelector('.shots-dash-bar-revamp');
                const cards = Array.from(c.querySelectorAll('.shot-card-revamp'));
                
                const toAnimate = [];
                if (header) toAnimate.push(header);
                if (dashBar) toAnimate.push(dashBar);
                if (cards.length > 0) toAnimate.push(...cards);

                if (toAnimate.length > 0) {
                    gsap.set(toAnimate, { y: cfg.offset, opacity: 0 });
                    
                    const tl = gsap.timeline();
                    tl.to(toAnimate, {
                        y: 0,
                        opacity: 1,
                        duration: cfg.duration,
                        stagger: cfg.stagger,
                        ease: cfg.ease
                    });
                    
                    window._bootedProjects.shots[p.id] = true;
                }
            }
        });
    }
}

function renderShotDetail(c, p, sid) {
    const s = p.shots.find(x => x.id === sid);
    if (!s) { state.S.shotId = null; import('./main.js').then(m => m.render()); return; }
    if (s.projectId === undefined) s.projectId = p.id;

    const d = s.tasks ? s.tasks.filter(t => t.done).length : 0;
    const t = s.tasks ? s.tasks.length : 0;
    const pc = t === 0 ? 0 : Math.round((d / t) * 100);
    
    // pagination logic
    const shotIndex = p.shots.indexOf(s);
    const hasPrev = shotIndex > 0;
    const hasNext = shotIndex < p.shots.length - 1;

    c.innerHTML = `
    <div class="shot-aside-overlay" id="shot-aside-overlay"></div>
    <div class="page" style="padding:40px; max-width:1400px; margin:0 auto; padding-bottom:100px;">
      <div class="shot-top-nav">
        <div class="shot-top-left">
          <button class="back-btn-revamp" id="sd-back" style="border-radius:0;"><i class="ti ti-arrow-left"></i> BACK TO SHOTS</button>
          <div style="width:1px; height:16px; background:#1e1e1e;"></div>
          <div class="shot-title-big">SHOT ${s.number}</div>
        </div>
        <div class="shot-top-right" style="display:flex; align-items:center;">
          <button class="shot-badge-btn" id="sd-toggle-aside" style="border-radius:0; margin-right: 8px;" title="View Tasks"><i class="ti ti-list-check"></i></button>
          <div class="toggle-2d3d" style="display:flex; border:1px solid #333; margin-right: 16px;">
              <button id="btn-3d" style="background:${s.type==='3D'?'#222':'transparent'}; color:${s.type==='3D'?'#fff':'#888'}; border:none; padding:4px 12px; font-family:'IBM Plex Mono', monospace; font-size:12px; cursor:pointer;">3D</button>
              <button id="btn-2d" style="background:${s.type==='2D'?'#222':'transparent'}; color:${s.type==='2D'?'#fff':'#888'}; border:none; padding:4px 12px; font-family:'IBM Plex Mono', monospace; font-size:12px; cursor:pointer;">2D</button>
          </div>
          <button class="shot-badge-btn active" id="sd-edit-t" style="border-radius:0;"><i class="ti ti-pencil"></i></button>
          <button class="shot-action-btn del" id="sd-del" style="border-radius:0; color:#ff4444;"><i class="ti ti-trash"></i></button>
        </div>
      </div>

      <div class="shot-detail-layout" style="display:grid; grid-template-columns: 2fr 1fr; gap:40px; margin-top:20px;">
        <!-- Main Column -->
        <div class="shot-main-col" style="display:flex; flex-direction:column; gap:40px;">
          <div class="shot-hero-box" id="sd-hero" style="border-radius:0;">
             ${s.heroImage ? `<img src="${s.heroImage}" alt="" draggable="false">` : `<i class="ti ti-camera" style="font-size:48px; color:#141414;"></i><span style="position:absolute; bottom:16px; font-size:10px; color:#555; text-transform:uppercase; letter-spacing:1px;">Click to set hero frame</span>`}
             <input type="file" id="hero-up" style="display:none;" accept="image/*"/>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
             <div>
                <div class="section-label-revamp" style="margin-bottom:16px;">SYNOPSIS</div>
                <textarea id="sd-synopsis" class="shot-textarea-revamp" placeholder="What happens in this shot?" style="border-radius:0; height:80px; resize:none;">${s.synopsis || ''}</textarea>
             </div>
             <div>
                <div class="section-label-revamp" style="margin-bottom:16px;">PURPOSE</div>
                <textarea id="sd-purpose" class="shot-textarea-revamp" placeholder="Why does this shot exist?" style="border-radius:0; height:80px; resize:none;">${s.purpose || ''}</textarea>
             </div>
          </div>

          <div>
             <div class="section-label-revamp" style="margin-bottom:16px;">STORYBOARD</div>
             <div class="storyboard-grid-revamp" id="sd-sb-grid" style="display:flex; flex-wrap:nowrap; gap:20px; overflow-x:auto; padding-bottom:16px;"></div>
          </div>
          
          <div>
             <div class="section-label-revamp" style="margin-bottom:16px;">SHOT IDEAS</div>
             <div id="sd-ideas-list" style="display:flex; flex-direction:column; gap:10px;"></div>
             <button id="add-idea-btn" style="width:100%; padding:12px; background:transparent; border:1px solid #1e1e1e; color:#888; font-family:'IBM Plex Mono', monospace; font-size:9px; cursor:pointer; letter-spacing:1px; margin-top:16px; text-transform:uppercase;">+ ASSIGN / ADD IDEA</button>
          </div>
        </div>

        <!-- Sidebar Column -->
        <div class="shot-side-col">
          <div class="shot-aside-close-mobile" style="display:none; justify-content:flex-end; margin-bottom:16px; width:100%;">
             <button class="icon-btn" id="shot-aside-close-btn" style="padding:6px; color:#ff4444; background:none; border:none; cursor:pointer;"><i class="ti ti-x" style="font-size:18px;"></i></button>
          </div>
          <div style="background:transparent; border:1px solid #141414; padding:24px;">
            <div class="section-label-revamp" style="margin-bottom:16px;">SHOT PROGRESS</div>
            <div class="side-prog-large">${pc}%</div>
            <div class="side-prog-track" style="border-radius:0;"><div class="side-prog-fill" style="width:${pc}%; border-radius:0;"></div></div>
            <div class="side-prog-stats" style="margin-bottom:24px;">${d} / ${t} tasks completed</div>
            
            <div class="task-list-revamp" id="sd-tasks"></div>
            <button class="add-task-btn" id="new-task-btn" style="border-radius:0; margin-top:16px;"><i class="ti ti-plus"></i> ADD TASK</button>
          </div>
          
          <div style="margin-top:40px;">
             <div class="section-label-revamp" style="margin-bottom:16px;">LESSONS LEARNED</div>
             <textarea id="sd-lessons" class="shot-textarea-revamp" placeholder="What did you learn while making this shot?" style="border-radius:0; height:120px; border:1px solid #141414; background:transparent; color:#ccc;">${s.lessons || ''}</textarea>
          </div>
        </div>
      </div>
      
      <!-- Pagination -->
      <div style="position:fixed; bottom:40px; right:40px; display:flex; gap:10px; z-index:100;">
         ${hasPrev ? `<button id="prev-shot" style="border:1px solid #333; background:#000; color:#fff; padding:10px 20px; font-family:'IBM Plex Mono', monospace; cursor:pointer; font-size:10px; letter-spacing:1px; border-radius:0;"><i class="ti ti-arrow-left"></i> PREV SHOT</button>` : ''}
         ${hasNext ? `<button id="next-shot" style="border:1px solid #333; background:#000; color:#fff; padding:10px 20px; font-family:'IBM Plex Mono', monospace; cursor:pointer; font-size:10px; letter-spacing:1px; border-radius:0;">NEXT SHOT <i class="ti ti-arrow-right"></i></button>` : ''}
      </div>
    </div>`;

    document.getElementById('sd-back').addEventListener('click', () => {
        const appRoot = document.getElementById('app-root');
        if (appRoot) appRoot.classList.remove('shot-aside-open');
        state.S.shotId = null; import('./main.js').then(m => m.render());
    });

    const toggleAsideBtn = document.getElementById('sd-toggle-aside');
    const asideCloseBtn = document.getElementById('shot-aside-close-btn');
    const asideOverlay = document.getElementById('shot-aside-overlay');
    const appRoot = document.getElementById('app-root');

    if (toggleAsideBtn && appRoot) {
        toggleAsideBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appRoot.classList.toggle('shot-aside-open');
        });
    }

    if (asideCloseBtn && appRoot) {
        asideCloseBtn.addEventListener('click', () => {
            appRoot.classList.remove('shot-aside-open');
        });
    }

    if (asideOverlay && appRoot) {
        asideOverlay.addEventListener('click', () => {
            appRoot.classList.remove('shot-aside-open');
        });
    }

    document.getElementById('sd-edit-t').addEventListener('click', () => {
        openPromptModal("Edit Shot Title", "Update title", "Title", s.title, val => {
            if (val.trim()) { s.title = val.trim(); p.lastEdited = new Date().toISOString(); saveAll(); renderShotDetail(c, p, sid); }
        });
    });

    document.getElementById('sd-del').addEventListener('click', () => {
        openConfirmModal("Delete Shot", `Are you sure you want to delete SHOT ${s.number}?`, "Delete", () => {
            const idx = p.shots.findIndex(x => x.id === sid);
            if (idx > -1) {
                const deleted = p.shots.splice(idx, 1)[0];
                state.archives.push({ type: 'shot', data: deleted, archivedAt: new Date().toISOString() });
                p.shots.forEach((x, i) => x.number = i + 1);
                state.S.shotId = null; p.lastEdited = new Date().toISOString(); saveAll(); import('./main.js').then(m => m.render());
            }
        });
    });

    document.getElementById('btn-3d').addEventListener('click', () => {
        if (s.type === '3D') return;
        openConfirmModal(
            "Switch to 3D?",
            "Are you sure you want to switch to the 3D pipeline? This will reset the checklist to 3D tasks.",
            "Switch",
            () => {
                s.type = '3D';
                s.tasks = makeChecklist('3D');
                p.lastEdited = new Date().toISOString();
                saveAll();
                renderShotDetail(c, p, sid);
            }
        );
    });
    document.getElementById('btn-2d').addEventListener('click', () => {
        if (s.type === '2D') return;
        openConfirmModal(
            "Switch to 2D?",
            "Are you sure you want to switch to the 2D pipeline? This will reset the checklist to 2D tasks.",
            "Switch",
            () => {
                s.type = '2D';
                s.tasks = makeChecklist('2D');
                p.lastEdited = new Date().toISOString();
                saveAll();
                renderShotDetail(c, p, sid);
            }
        );
    });

    if(hasPrev) document.getElementById('prev-shot').addEventListener('click', () => {
        const appRoot = document.getElementById('app-root');
        if (appRoot) appRoot.classList.remove('shot-aside-open');
        state.S.shotId = p.shots[shotIndex - 1].id; import('./main.js').then(m => m.render());
    });
    if(hasNext) document.getElementById('next-shot').addEventListener('click', () => {
        const appRoot = document.getElementById('app-root');
        if (appRoot) appRoot.classList.remove('shot-aside-open');
        state.S.shotId = p.shots[shotIndex + 1].id; import('./main.js').then(m => m.render());
    });

    document.getElementById('sd-hero').addEventListener('click', () => document.getElementById('hero-up').click());
    document.getElementById('hero-up').addEventListener('change', e => {
        const f = e.target.files[0]; if(!f) return;
        import('./utils.js').then(m => m.compressImage(f, r => {
            s.heroImage = r; p.lastEdited = new Date().toISOString(); saveAll(); renderShotDetail(c, p, sid);
        }));
    });

    let synTmo = null;
    document.getElementById('sd-synopsis').addEventListener('input', e => {
        clearTimeout(synTmo);
        synTmo = setTimeout(() => { s.synopsis = e.target.value; p.lastEdited = new Date().toISOString(); saveAll(); }, 500);
    });

    let purpTmo = null;
    document.getElementById('sd-purpose').addEventListener('input', e => {
        clearTimeout(purpTmo);
        purpTmo = setTimeout(() => { s.purpose = e.target.value; p.lastEdited = new Date().toISOString(); saveAll(); }, 500);
    });

    const rt = () => {
        const tc = document.getElementById('sd-tasks');
        if (!s.tasks || s.tasks.length === 0) { tc.innerHTML = '<div style="color:#555; font-size:11px;">No tasks.</div>'; return; }
        tc.innerHTML = s.tasks.map((t, i) => `
      <div class="task-row-revamp">
        <div class="task-check ${t.done ? 'done' : ''}" data-idx="${i}" style="border-radius:0;"><i class="ti ti-check"></i></div>
        <div class="task-name" style="${t.done ? 'opacity:0.3;' : ''}"><span style="${t.done ? 'text-decoration:line-through;' : ''}">${t.text}</span></div>
        <button class="task-del" data-idx="${i}" style="border-radius:0; margin-left:auto;"><i class="ti ti-x"></i></button>
      </div>
    `).join('');

        tc.querySelectorAll('.task-check').forEach(chk => chk.addEventListener('click', () => {
            const wasDone = s.tasks[chk.dataset.idx].done;
            s.tasks[chk.dataset.idx].done = !wasDone;
            getShotStatus(s);
            if (!wasDone && s.tasks.every(t => t.done) && typeof window.confetti !== 'undefined') {
                window.confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 99999 });
            }
            p.lastEdited = new Date().toISOString(); saveAll(); renderShotDetail(c, p, sid); import('./ui.js').then(ui => ui.renderSidebar());
        }));
        tc.querySelectorAll('.task-del').forEach(btn => btn.addEventListener('click', () => {
            s.tasks.splice(btn.dataset.idx, 1);
            getShotStatus(s);
            p.lastEdited = new Date().toISOString(); saveAll(); renderShotDetail(c, p, sid); import('./ui.js').then(ui => ui.renderSidebar());
        }));
    };
    rt();

    document.getElementById('new-task-btn').addEventListener('click', () => {
        openPromptModal("Add Custom Task", "Enter task description", "Task", "", val => {
            if(val.trim()) {
                s.tasks.push({ text: val.trim(), done: false });
                getShotStatus(s);
                p.lastEdited = new Date().toISOString(); saveAll(); renderShotDetail(c, p, sid); import('./ui.js').then(ui => ui.renderSidebar());
            }
        });
    });

    let letmo = null;
    document.getElementById('sd-lessons').addEventListener('input', e => {
        clearTimeout(letmo);
        letmo = setTimeout(() => { s.lessons = e.target.value; p.lastEdited = new Date().toISOString(); saveAll(); }, 500);
    });

    const renderSB = () => {
        const bg = document.getElementById('sd-sb-grid');
        s.storyboards = s.storyboards || [];
        bg.innerHTML = s.storyboards.map((sb, i) => `
        <div class="sb-card-revamp" data-idx="${i}" style="border-radius:0; width: 200px; flex-shrink:0; display:flex; flex-direction:column;">
           <div class="sb-img-area" style="border-radius:0; position:relative; height:120px; flex-shrink:0;">
             <div class="sb-num-badge" style="border-radius:0; background:#000; color:#fff; position:absolute; bottom:8px; left:8px; padding:2px 6px; font-size:10px; z-index:2;">${i+1 < 10 ? '0'+(i+1) : i+1}</div>
             ${sb.img ? `<img src="${sb.img}" alt="" draggable="false" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; border:1px solid #141414; box-sizing:border-box;"><i class="ti ti-photo" style="color:#333; font-size:24px;"></i></div>`}
             <button class="sb-del-btn" data-idx="${i}" style="border-radius:0; position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); border:none; color:#ff4444; cursor:pointer; padding:4px; z-index:2;"><i class="ti ti-trash"></i></button>
           </div>
           <textarea class="sb-caption-input" placeholder="Caption..." data-idx="${i}" style="border-radius:0; background:transparent; border:1px solid #141414; border-top:none; width:100%; color:#888; font-family:'IBM Plex Mono', monospace; font-size:10px; padding:8px; resize:none; overflow:hidden; min-height:40px; box-sizing:border-box;">${sb.caption || ''}</textarea>
        </div>
        `).join('') + `
        <label class="add-frame-btn" style="border-radius:0; width:200px; height:150px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; justify-content:center; border:1px dashed #141414; cursor:pointer; color:#555; font-size:10px; font-family:'IBM Plex Mono', monospace; gap:8px;">
            <i class="ti ti-plus" style="font-size:24px;"></i> ADD FRAME 
            <input type="file" id="up-sb" style="display:none;" accept="image/*"/>
        </label>
        `;

        bg.querySelectorAll('.sb-del-btn').forEach(b => b.addEventListener('click', e => {
            s.storyboards.splice(b.dataset.idx, 1); p.lastEdited = new Date().toISOString(); saveAll(); renderSB();
        }));
        bg.querySelectorAll('.sb-caption-input').forEach(ta => ta.addEventListener('input', e => {
            s.storyboards[ta.dataset.idx].caption = e.target.value;
            p.lastEdited = new Date().toISOString(); saveAll();
        }));
        // For auto-resizing textareas
        bg.querySelectorAll('.sb-caption-input').forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight) + 'px';
            ta.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
        });
        const upSb = document.getElementById('up-sb');
        if (upSb) {
            upSb.addEventListener('change', e => {
                const f = e.target.files[0]; if(!f) return;
                import('./utils.js').then(m => m.compressImage(f, r => {
                    s.storyboards.push({ img: r, caption: '' });
                    p.lastEdited = new Date().toISOString(); saveAll(); renderSB();
                }));
            });
        }
    };
    renderSB();

    const renderIdeas = () => {
        const list = document.getElementById('sd-ideas-list');
        s.ideas = s.ideas || [];
        
        if (s.ideas.length === 0) {
            list.innerHTML = '<div style="color:#555; font-size:11px; padding:12px; border:1px solid #141414;">No ideas assigned to this shot.</div>';
            return;
        }

        list.innerHTML = s.ideas.map(idea => `
            <div style="display:flex; align-items:center; border:1px solid #141414; padding:12px 16px; gap:16px;">
                <i class="ti ti-bulb" style="color:#888;"></i>
                <div style="flex:1; color:#ccc; font-size:12px;">${idea.text}</div>
                <button class="idea-edit-btn" data-id="${idea.id}" style="background:none; border:none; color:#888; cursor:pointer;"><i class="ti ti-pencil"></i></button>
                <button class="idea-del-btn" data-id="${idea.id}" style="background:none; border:none; color:#ff4444; cursor:pointer;"><i class="ti ti-x"></i></button>
            </div>
        `).join('');

        list.querySelectorAll('.idea-edit-btn').forEach(btn => btn.addEventListener('click', () => {
            const idea = s.ideas.find(i => i.id === btn.dataset.id);
            openPromptModal("Edit Idea", "Update text", "Idea", idea.text, val => {
                if(val.trim()) { idea.text = val.trim(); p.lastEdited = new Date().toISOString(); saveAll(); renderIdeas(); }
            });
        }));

        list.querySelectorAll('.idea-del-btn').forEach(btn => btn.addEventListener('click', () => {
            const idx = s.ideas.findIndex(i => i.id === btn.dataset.id);
            if (idx > -1) {
                const idea = s.ideas.splice(idx, 1)[0];
                p.ideas = p.ideas || [];
                p.ideas.push(idea); // revert to project ideas
                p.lastEdited = new Date().toISOString(); saveAll(); renderIdeas();
            }
        }));
    };
    renderIdeas();

    document.getElementById('add-idea-btn').addEventListener('click', () => {
        openPromptModal("Add Idea", "Enter new idea for this shot", "Idea", "", val => {
            if(val.trim()) {
                const newIdea = {
                    id: uid(),
                    text: val.trim(),
                    createdAt: new Date().toISOString()
                };
                s.ideas = s.ideas || [];
                s.ideas.push(newIdea);
                p.lastEdited = new Date().toISOString(); saveAll(); renderIdeas();
            }
        });
    });

    if (typeof gsap !== 'undefined' && !window._reduceMotion) {
        import('./utils.js').then(({ getBootConfig }) => {
            const cfg = getBootConfig('shots');
            window._bootedProjects = window._bootedProjects || {};
            window._bootedProjects.shotDetail = window._bootedProjects.shotDetail || {};
            
            if (!window._bootedProjects.shotDetail[sid]) {
                const topNav = c.querySelector('.shot-top-nav');
                const mainCol = c.querySelector('.shot-main-col');
                const sideCol = c.querySelector('.shot-side-col');
                
                const toAnimate = [];
                if (topNav) toAnimate.push(topNav);
                if (mainCol) toAnimate.push(mainCol);
                if (sideCol) toAnimate.push(sideCol);

                if (toAnimate.length > 0) {
                    gsap.set(toAnimate, { y: cfg.offset, opacity: 0 });
                    
                    const tl = gsap.timeline();
                    tl.to(toAnimate, {
                        y: 0,
                        opacity: 1,
                        duration: cfg.duration,
                        stagger: cfg.stagger,
                        ease: cfg.ease
                    });
                    
                    window._bootedProjects.shotDetail[sid] = true;
                }
            }
        });
    }
}
