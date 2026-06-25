import { state, BLOCK_PALETTE } from './state.js';
import { uid, formatDateTime, openPromptModal, openModal, closeModal, openConfirmModal } from './utils.js';
import { saveAll } from './db.js';
import { renderShots } from './shots.js';
import { renderBoard } from './board.js';
import { renderProjectTasks } from './tasks.js';

export function projProg(p) {
    if (!p.shots || p.shots.length === 0) return 0;
    let tot = 0, done = 0;
    p.shots.forEach(s => {
        if (!s.tasks) return;
        tot += s.tasks.length;
        done += s.tasks.filter(t => t.done).length;
    });
    return tot === 0 ? 0 : Math.round((done / tot) * 100);
}

export function shotCounts(p) {
    let c = 0, w = 0, n = 0;
    if (!p.shots) return { complete: c, wip: w, ns: n };
    p.shots.forEach(s => {
        if (!s.tasks || s.tasks.length === 0) { n++; return; }
        const d = s.tasks.filter(t => t.done).length;
        if (d === 0) n++;
        else if (d === s.tasks.length) c++;
        else w++;
    });
    return { complete: c, wip: w, ns: n };
}

export function renderProject(m, p) {
    let t = state.S.tab;
    
    // Redirect Project Board to Overview tab on mobile screens
    if (t === 'board' && window.innerWidth <= 768) {
        state.S.tab = 'overview';
        t = 'overview';
    }

    const isOver = t === 'overview';
    const isTasks = t === 'tasks';
    const isScript = t === 'script';
    const isBoard = t === 'board';
    const isShots = t === 'shots';

    m.innerHTML = `<div id="proj-content" style="height: 100%; width: 100%; position: relative;"></div>`;
    const c = document.getElementById('proj-content');
    if (isOver) renderOverview(c, p);
    else if (isTasks) renderProjectTasks(c, p);
    else if (isScript) renderScript(c, p);
    else if (isBoard) renderBoard(c, p);
    else if (isShots) renderShots(c, p);
}

function renderOverview(c, p) {
    const sc = shotCounts(p);
    const prog = projProg(p);
    const total = sc.complete + sc.wip + sc.ns;
    
    const R = 36;
    const circ = 2 * Math.PI * R;
    const compD = total > 0 ? (sc.complete / total) * circ : 0;
    const wipD = total > 0 ? (sc.wip / total) * circ : 0;
    const nsD = total > 0 ? (sc.ns / total) * circ : 0;
    const cx = 50, cy = 50;
    
    c.innerHTML = `
    <div class="overview-revamp">
      <div class="ov-header">
        <div class="ov-title-row">
          <div class="ov-title" id="pt-${p.id}">${p.title || 'UNTITLED PROJECT'}</div>
          <button class="icon-btn" id="edit-title"><i class="ti ti-pencil"></i></button>
        </div>
        <div class="ov-subtitle">${p.description || 'A documentary project'}</div>
      </div>
      
      <div class="ov-prog-container">
        <div class="ov-prog-label">PROJECT PROGRESS</div>
        <div class="ov-prog-bar-wrap"><div class="ov-prog-fill" style="width:${prog}%;"></div></div>
        <div class="ov-prog-pct">${prog}%</div>
        <div class="ov-prog-count"><span style="border:1px solid #1A1A1A; padding:4px 8px; border-radius:2px; color:#555; background:var(--bg-dark);"><span style="color:var(--text-main);">${sc.complete}</span> / ${total} shots</span></div>
      </div>
      
      <div class="ov-grid">
        <div class="ov-card">
           <div class="ov-card-title">PROJECT SUMMARY</div>
           <div class="sum-row"><div class="sum-key" style="text-transform:capitalize;">Genre</div><div class="sum-val" id="d-genre">${p.genre || '—'}</div></div>
           <div class="sum-row"><div class="sum-key" style="text-transform:capitalize;">Format</div><div class="sum-val" id="d-format">${p.format || '—'}</div></div>
           <div class="sum-row"><div class="sum-key" style="text-transform:capitalize;">Duration</div><div class="sum-val" id="d-duration">${p.duration || '—'}</div></div>
           <div class="sum-row"><div class="sum-key" style="text-transform:capitalize;">Status</div><div class="sum-val" id="d-status">${p.status || 'Not Started'}</div></div>
           <div class="sum-row" style="border-bottom:none;"><div class="sum-key" style="text-transform:capitalize;">Created</div><div class="sum-val">${formatDateTime(p.createdAt).split('•')[0]}</div></div>
           <div style="margin-top:auto; border-top:1px solid #1A1A1A; margin-bottom: 0; margin-left: -20px; margin-right: -20px; padding: 16px 20px 0; display:flex; justify-content:center; gap:24px;">
             <button class="card-bottom-btn" id="edit-desc" style="margin-top:0; width:auto; padding:0; display:flex; gap:8px; align-items:center;"><i class="ti ti-pencil"></i> EDIT BRIEF</button>
             <label class="card-bottom-btn" style="margin-top:0; width:auto; padding:0; display:flex; gap:8px; align-items:center; cursor:pointer;">
                <i class="ti ti-upload"></i> UPLOAD THUMBNAIL <input type="file" id="change-thumb" style="display:none;" accept="image/*"/>
             </label>
           </div>
        </div>
        
        <div class="ov-card">
           <div class="ov-card-title">PRODUCTION OVERVIEW</div>
           <div class="donut-wrap">
             <svg width="120" height="120" viewBox="0 0 100 100">
                <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#222" stroke-width="12"/>
                ${total > 0 && compD > 0 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--accent-green)" stroke-width="12" stroke-dasharray="${compD} ${circ}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
                ${total > 0 && wipD > 0 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--accent-blue)" stroke-width="12" stroke-dasharray="${wipD} ${circ}" stroke-dashoffset="${-compD}" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
                ${total > 0 && nsD > 0 ? `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#333" stroke-width="12" stroke-dasharray="${nsD} ${circ}" stroke-dashoffset="${-(compD + wipD)}" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
                <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="middle" fill="#DDDDDE" font-size="24" font-weight="500">${total}</text>
                <text x="${cx}" y="${cy + 14}" text-anchor="middle" dominant-baseline="middle" fill="#555" font-size="8">shots</text>
             </svg>
             <div class="donut-legend">
               <div class="legend-row"><div class="legend-dot" style="background:var(--accent-green)"></div><span class="legend-count">${sc.complete}</span><span class="legend-lbl">Complete</span></div>
               <div class="legend-row"><div class="legend-dot" style="background:var(--accent-blue)"></div><span class="legend-count">${sc.wip}</span><span class="legend-lbl">WIP</span></div>
               <div class="legend-row"><div class="legend-dot" style="background:#333"></div><span class="legend-count">${sc.ns}</span><span class="legend-lbl">Not started</span></div>
             </div>
           </div>
        </div>
        
        <div class="ov-card" style="padding:0; display:flex; flex-direction:column;">
           <div class="ov-card-title" style="padding: 20px 20px 0;">SHOT OVERVIEW</div>
           <div class="shot-ov-list" id="proj-shots-list" style="padding:0 20px 20px; flex:1; overflow-y:auto;"></div>
        </div>
        
        <div class="ov-card" style="padding:0; display:flex; flex-direction:column;">
           <div class="ov-card-title" style="padding: 20px 20px 0;">IDEAS</div>
           <div id="proj-ideas-list" class="ideas-card-list" style="padding:0 20px; flex:1; overflow-y:auto;"></div>
           <button class="card-bottom-btn" id="add-idea-btn" style="border-top:1px solid #1A1A1A; margin:0; padding:16px; width:100%; justify-content:center; border-radius:0;"><i class="ti ti-plus"></i> ADD IDEA</button>
        </div>
      </div>
    </div>`;

    document.getElementById('edit-title').addEventListener('click', () => {
        openModal(`<div class="modal modal-sm">
            <h2>Edit Title</h2>
            <div class="modal-sub">Update project title and subtitle</div>
            <div class="field"><label>Title</label><input id="edit-title-input" value="${p.title || ''}"/></div>
            <div class="field" style="margin-top:12px;"><label>Subtitle</label><input id="edit-subtitle-input" value="${p.description || ''}"/></div>
            <div class="modal-actions" style="margin-top:16px;">
                <button class="btn btn-ghost" id="title-cancel">Cancel</button>
                <button class="btn btn-primary" id="title-save">Confirm</button>
            </div>
        </div>`);
        document.getElementById('title-cancel').addEventListener('click', closeModal);
        document.getElementById('title-save').addEventListener('click', () => {
            const nt = document.getElementById('edit-title-input').value.trim();
            const nd = document.getElementById('edit-subtitle-input').value.trim();
            if (nt) p.title = nt;
            p.description = nd;
            p.lastEdited = new Date().toISOString();
            saveAll(); closeModal(); renderOverview(c, p); import('./ui.js').then(ui => ui.renderSidebar());
        });
        const inp = document.getElementById('edit-title-input');
        inp.focus();
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('title-save').click(); });
        document.getElementById('edit-subtitle-input').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('title-save').click(); });
    });

    document.getElementById('edit-desc').addEventListener('click', () => {
        const statuses = ['Not Started', 'Pre-Production', 'In Progress', 'Post-Production', 'Completed'];
        const statusOpts = statuses.map(s => `<option value="${s}" ${p.status === s ? 'selected' : ''} style="background:var(--bg-dark);">${s}</option>`).join('');
        openModal(`<div class="modal modal-sm">
      <h2>Edit Brief</h2>
      <div class="modal-sub">Update project summary details</div>
      <div class="field"><label>Genre</label><input id="brief-genre" value="${p.genre || ''}"/></div>
      <div class="field" style="margin-top:12px;"><label>Format</label><input id="brief-format" value="${p.format || ''}"/></div>
      <div class="field" style="margin-top:12px;"><label>Duration</label><input id="brief-duration" value="${p.duration || ''}"/></div>
      <div class="field" style="margin-top:12px;">
        <label>Status</label>
        <select id="brief-status" style="width:100%; padding:8px; background:transparent; border:1px solid #333; color:var(--text-main); font-family:'IBM Plex Mono', monospace; font-size:11px; outline:none; text-transform:uppercase;">
          ${statusOpts}
        </select>
      </div>
      <div class="modal-actions" style="margin-top:16px;">
        <button class="btn btn-ghost" id="desc-cancel">Cancel</button>
        <button class="btn btn-primary" id="desc-save">Confirm</button>
      </div>
    </div>`);
        document.getElementById('desc-cancel').addEventListener('click', closeModal);
        document.getElementById('desc-save').addEventListener('click', () => {
            p.genre = document.getElementById('brief-genre').value.trim();
            p.format = document.getElementById('brief-format').value.trim();
            p.duration = document.getElementById('brief-duration').value.trim();
            p.status = document.getElementById('brief-status').value;
            p.lastEdited = new Date().toISOString();
            saveAll(); closeModal(); renderOverview(c, p);
        });
    });

    document.getElementById('change-thumb').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        import('./utils.js').then(m => m.compressImage(f, r => {
            p.thumbnail = r; p.lastEdited = new Date().toISOString(); saveAll(); renderOverview(c, p); import('./ui.js').then(ui => ui.renderDashboard(document.getElementById('main')));
        }));
    });



    const renderShotsList = () => {
        const sl = document.getElementById('proj-shots-list');
        const pShots = (p.shots || []);
        if (pShots.length === 0) {
            sl.innerHTML = `<div style="color:#555; font-size:11px; padding-top:12px;">No shots created yet.</div>`;
            return;
        }
        sl.innerHTML = pShots.map(s => {
            const d = s.tasks ? s.tasks.filter(t => t.done).length : 0;
            const t = s.tasks ? s.tasks.length : 0;
            const pc = t === 0 ? 0 : Math.round((d / t) * 100);
            let st = pc === 100 ? 'COMPLETE' : (pc === 0 ? 'NOT STARTED' : 'WIP');
            let stC = pc === 100 ? 'complete' : (pc === 0 ? 'ns' : 'wip');
            let tColor = pc === 100 ? 'var(--accent-green)' : (pc === 0 ? '#444' : 'var(--accent-blue)');

            return `<div class="shot-ov-row" data-sid="${s.id}">
              <div class="shot-thumb-sm">
                ${s.heroImage ? `<img src="${s.heroImage}">` : `<i class="ti ti-lock" style="color:#333; font-size:10px;"></i>`}
              </div>
              <div class="shot-ov-title">${s.title}</div>
              <div class="status-badge ${stC}">${st}</div>
              <div class="mini-bar-wrap"><div class="mini-bar-fill" style="width:${pc}%; background:${tColor};"></div></div>
              <div class="shot-pct">${pc}%</div>
            </div>`;
        }).join('');
        
        sl.querySelectorAll('.shot-ov-row').forEach(row => row.addEventListener('click', () => {
            import('./state.js').then(st => { 
                st.state.S.shotId = row.dataset.sid; 
                st.state.S.tab = 'shots';
                import('./main.js').then(m => m.render()); 
                import('./ui.js').then(ui => ui.renderSidebar());
            });
        }));
    };
    renderShotsList();

    const renderPi = () => {
        const il = document.getElementById('proj-ideas-list');
        const pIdeas = (p.ideas || []);
        if (pIdeas.length === 0) {
            il.innerHTML = `<div style="color:#555; font-size:11px; padding-top:12px;">No ideas attached to this project.</div>`;
            return;
        }
        il.innerHTML = pIdeas.map(i => `<div class="idea-item">
      <i class="ti ti-bulb" style="color:#d4a373; font-size:14px;"></i>
      <div class="idea-card-text">${i.text}</div>
      <div class="idea-actions">
        <button class="icon-btn focus-pidea" data-id="${i.id}"><i class="ti ti-target"></i></button>
        <button class="icon-btn edit-pidea" data-id="${i.id}"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn del-pidea del" data-id="${i.id}"><i class="ti ti-trash"></i></button>
      </div>
    </div>`).join('');
    
        il.querySelectorAll('.del-pidea').forEach(btn => btn.addEventListener('click', () => {
            import('./utils.js').then(u => u.openConfirmModal("Delete Idea", "Are you sure you want to delete this idea?", "Delete", () => {
                p.ideas = p.ideas.filter(x => x.id !== btn.dataset.id); saveAll(); renderPi();
            }));
        }));
        
        il.querySelectorAll('.edit-pidea').forEach(btn => btn.addEventListener('click', () => {
            const targetIdea = p.ideas.find(x => x.id === btn.dataset.id);
            if(targetIdea) {
                openPromptModal("Edit Idea", "Update this idea", "Idea", targetIdea.text, val => {
                    if(val.trim()) { targetIdea.text = val.trim(); targetIdea.lastEdited = new Date().toISOString(); saveAll(); renderPi(); }
                });
            }
        }));

        il.querySelectorAll('.focus-pidea').forEach(btn => btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const idea = p.ideas.find(x => x.id === id);
            if (idea) {
                if (!p.shots || p.shots.length === 0) {
                    openConfirmModal("No Shots Available", "Please create a shot first before assigning an idea.", "OK", () => {});
                    return;
                }
                const selectOpts = p.shots.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
                
                openModal(`
                  <div class="modal modal-sm">
                    <h2>Assign Idea</h2>
                    <p class="modal-sub">Assign this idea to a specific shot.</p>
                    <div class="field">
                       <select id="shot-select">${selectOpts}</select>
                    </div>
                    <div class="modal-actions">
                      <button class="btn btn-ghost" id="assign-cancel">Cancel</button>
                      <button class="btn btn-primary" id="assign-confirm">Assign</button>
                    </div>
                  </div>
                `);
                
                document.getElementById('assign-cancel').addEventListener('click', closeModal);
                document.getElementById('assign-confirm').addEventListener('click', () => {
                    const sid = document.getElementById('shot-select').value;
                    const shot = p.shots.find(x => x.id === sid);
                    if (shot) {
                        if (!shot.tasks) shot.tasks = [];
                        shot.tasks.push({ text: idea.text, done: false });
                        p.ideas = p.ideas.filter(x => x.id !== id);
                        saveAll();
                        closeModal();
                        renderOverview(c, p);
                    }
                });
            }
        }));
    };
    renderPi();

    document.getElementById('add-idea-btn').addEventListener('click', () => {
        openPromptModal("Add Idea", "Quickly log a new idea for this project", "Idea", "", val => {
            if (val.trim()) {
                p.ideas = p.ideas || [];
                p.ideas.push({ id: uid(), text: val.trim(), createdAt: new Date().toISOString() });
                saveAll(); renderPi();
            }
        });
    });

    // Boot up animation sequence for the Overview
    if (typeof gsap !== 'undefined' && !window._reduceMotion) {
        import('./utils.js').then(({ getBootConfig }) => {
            const cfg = getBootConfig('overview');
            const cards = Array.from(c.querySelectorAll('.ov-card'));
            const progContainer = c.querySelector('.ov-prog-container');
            const progFill = c.querySelector('.ov-prog-fill');
            
            if (cards.length && progContainer && progFill) {
                const targetWidth = progFill.style.width;
                
                window._bootedProjects = window._bootedProjects || {};
                window._bootedProjects.overview = window._bootedProjects.overview || {};
                
                if (!window._bootedProjects.overview[p.id]) {
                    // Hide elements initially
                    gsap.set([...cards, progContainer], { y: cfg.offset, opacity: 0 });
                    gsap.set(progFill, { width: "0%" });
                    
                    // Animate sequence: Project Summary, Production, Shots, Ideas, Progress Block
                    const tl = gsap.timeline();
                    tl.to([...cards, progContainer], {
                        y: 0,
                        opacity: 1,
                        duration: cfg.duration,
                        stagger: cfg.stagger,
                        ease: cfg.ease
                    });
                    
                    // Then slide the progress bar fill
                    tl.to(progFill, {
                        width: targetWidth,
                        duration: 1.0,
                        ease: "power3.out"
                    }, "-=" + (cfg.duration * 0.6)); // Overlap with container slide-in
                    
                    window._bootedProjects.overview[p.id] = true;
                }
            }
        });
    }
}

export function renderScript(c, p) {
    if (!p.visualScriptBlocks || p.visualScriptBlocks.length === 0) {
        let initialColor = BLOCK_PALETTE[Math.floor(Math.random() * BLOCK_PALETTE.length)];
        p.visualScriptBlocks = [{ id: uid(), text: '', shotId: null, color: initialColor }];
        saveAll();
    }

    const wordCount = p.visualScriptBlocks.map(b => b.text).join(' ').trim().split(/\s+/).filter(w => w.length > 0).length;

    c.innerHTML = `
    <div class="vs-revamp">
      <div class="page-topbar">
        <div class="welcome">
          <h1 style="gap:12px;">VISUAL SCRIPT</h1>
          <p style="margin-bottom:16px;">${p.title ? p.title.toUpperCase() : 'UNTITLED PROJECT'}</p>
          <div class="vs-word-count">${wordCount} WORDS</div>
        </div>
        <button class="btn btn-ghost" id="vs-toggle-panel" style="padding:10px 16px;"><i class="ti ti-layout-sidebar-right-expand"></i> TOGGLE IDEAS PANEL</button>
      </div>
      <div class="vs-layout-container">
        <div class="vs-ideas-overlay" id="vs-ideas-overlay"></div>
        <div class="vs-blocks-wrap" id="vs-list"></div>
        <div id="vs-ideas-drawer" class="vs-ideas-drawer ${window.innerWidth <= 768 ? 'hidden' : ''}">
          <div id="vs-ideas-drawer-content"></div>
        </div>
      </div>
    </div>`;

    const vsOverlay = document.getElementById('vs-ideas-overlay');
    if (vsOverlay) {
        vsOverlay.addEventListener('click', () => {
            const drawer = document.getElementById('vs-ideas-drawer');
            if (drawer) drawer.classList.add('hidden');
            vsOverlay.classList.remove('active');
        });
    }

    document.getElementById('vs-toggle-panel').addEventListener('click', () => {
        const drawer = document.getElementById('vs-ideas-drawer');
        drawer.classList.toggle('hidden');
        if (vsOverlay) {
            vsOverlay.classList.toggle('active', !drawer.classList.contains('hidden'));
        }
    });

    refreshVS(p);
    renderVSIdeasDrawer(p);

    if (typeof gsap !== 'undefined' && !window._reduceMotion) {
        import('./utils.js').then(({ getBootConfig }) => {
            const cfg = getBootConfig('script');
            window._bootedProjects = window._bootedProjects || {};
            window._bootedProjects.vs = window._bootedProjects.vs || {};
            
            if (!window._bootedProjects.vs[p.id]) {
                const blocks = Array.from(c.querySelectorAll('.vs-block-row'));
                const addWrapper = c.querySelector('.vs-add-wrapper');
                
                const toAnimate = [];
                if (blocks.length > 0) toAnimate.push(...blocks);
                if (addWrapper) toAnimate.push(addWrapper);

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
                    
                    window._bootedProjects.vs[p.id] = true;
                }
            }
        });
    }
}

function renderVSIdeasDrawer(p) {
    const d = document.getElementById('vs-ideas-drawer-content');
    if (!d) return;

    const pIdeas = p.ideas || [];
    const gIdeas = state.ideas || [];

    d.innerHTML = `
      <div class="vs-ideas-header-mobile" style="display:none; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid #1e1e1e; padding-bottom:12px; width: 100%;">
         <span style="font-family:'IBM Plex Mono', monospace; font-size:10px; color:#aaa; letter-spacing:1px;">IDEAS PANEL</span>
         <button class="icon-btn" id="vs-ideas-close-btn" style="padding:6px; color:#ff4444; cursor:pointer; background:none; border:none;"><i class="ti ti-x" style="font-size:16px;"></i></button>
      </div>
      <div class="ideas-section">
        <div class="ideas-sec-title">PROJECT IDEAS</div>
        <div class="ideas-sec-list">
          ${pIdeas.map(i => `
            <div class="idea-row-revamp">
              <div class="idea-text-wrap">
                 <div class="idea-text">${i.text}</div>
                 <div class="idea-badge">UNASSIGNED</div>
              </div>
              <button class="icon-btn assign-to-shot" data-id="${i.id}"><i class="ti ti-target" style="color:var(--accent-green)"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="ideas-section" style="margin-top:32px;">
        <div class="ideas-sec-title">GLOBAL INBOX</div>
        <div class="ideas-sec-list">
          ${gIdeas.map(i => `
            <div class="idea-row-revamp">
              <div class="idea-text-wrap">
                 <div class="idea-text">${i.text}</div>
              </div>
              <button class="icon-btn move-to-project" data-id="${i.id}"><i class="ti ti-arrow-down-left" style="color:var(--accent-blue)"></i></button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('vs-ideas-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            const drawer = document.getElementById('vs-ideas-drawer');
            if (drawer) drawer.classList.add('hidden');
            const vsOverlay = document.getElementById('vs-ideas-overlay');
            if (vsOverlay) vsOverlay.classList.remove('active');
        });
    }

    d.querySelectorAll('.move-to-project').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const idea = state.ideas.find(x => x.id === id);
            if (idea) {
                state.ideas = state.ideas.filter(x => x.id !== id);
                if (!p.ideas) p.ideas = [];
                p.ideas.push(idea);
                saveAll();
                renderVSIdeasDrawer(p);
            }
        });
    });

    d.querySelectorAll('.assign-to-shot').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const idea = p.ideas.find(x => x.id === id);
            if (idea) {
                if (!p.shots || p.shots.length === 0) {
                    openConfirmModal("No Shots Available", "Please create a shot first before assigning an idea.", "OK", () => {});
                    return;
                }
                const selectOpts = p.shots.map(s => `<option value="${s.id}">${s.title}</option>`).join('');
                
                openModal(`
                  <div class="modal modal-sm">
                    <h2>Assign Idea</h2>
                    <p class="modal-sub">Assign this idea to a specific shot.</p>
                    <div class="field">
                       <select id="shot-select">${selectOpts}</select>
                    </div>
                    <div class="modal-actions">
                      <button class="btn btn-ghost" id="assign-cancel">Cancel</button>
                      <button class="btn btn-primary" id="assign-confirm">Assign</button>
                    </div>
                  </div>
                `);
                
                document.getElementById('assign-cancel').addEventListener('click', closeModal);
                document.getElementById('assign-confirm').addEventListener('click', () => {
                    const sid = document.getElementById('shot-select').value;
                    const shot = p.shots.find(x => x.id === sid);
                    if (shot) {
                        if (!shot.tasks) shot.tasks = [];
                        shot.tasks.push({ text: idea.text, done: false });
                        p.ideas = p.ideas.filter(x => x.id !== id);
                        saveAll();
                        closeModal();
                        renderVSIdeasDrawer(p);
                    }
                });
            }
        });
    });
}

function getShotTag(p, shotId) {
    if (!p.shots) return '+ TAG';
    const s = p.shots.find(x => x.id === shotId);
    if (s) {
        let numStr = s.number < 10 ? '0' + s.number : s.number;
        return `SHOT ${numStr}`;
    }
    return '+ TAG';
}

function refreshVS(p) {
    const list = document.getElementById('vs-list');
    
    list.innerHTML = p.visualScriptBlocks.map((b, i) => `
    <div class="vs-block-row" data-id="${b.id}" style="border-left-color: ${b.color};">
      <div class="vs-block-left-col">
         <div class="vs-drag-handle"><i class="ti ti-grid-dots"></i></div>
      </div>
      <div class="vs-block-right-col">
         <button class="vs-tag-btn" style="color:${b.color};">[ ${b.shotId ? getShotTag(p, b.shotId) : '+ TAG'} ]</button>
         <textarea class="vs-textarea" data-id="${b.id}" placeholder="Write scene...">${b.text}</textarea>
      </div>
      <button class="icon-btn del-vs-btn" data-id="${b.id}"><i class="ti ti-trash"></i></button>
    </div>
  `).join('') + `
    <div class="vs-add-wrapper">
       <button class="vs-add-block-btn" id="vs-add-btn">+ ADD BLOCK</button>
       <div class="vs-tip"><i class="ti ti-info-circle"></i> TIP: START A BLOCK WITH # TO INSTANTLY FORMAT IT AS A SCENE HEADER.</div>
    </div>
  `;

    document.getElementById('vs-add-btn').addEventListener('click', () => {
        let prevColor = p.visualScriptBlocks.length > 0 ? p.visualScriptBlocks[p.visualScriptBlocks.length - 1].color : null;
        let opts = BLOCK_PALETTE.filter(c => c !== prevColor);
        let newColor = opts[Math.floor(Math.random() * opts.length)];
        const newB = { id: uid(), text: '', shotId: null, color: newColor };
        p.visualScriptBlocks.push(newB);
        p.lastEdited = new Date().toISOString();
        saveAll();
        refreshVS(p);
        
        // Auto-focus the new block
        setTimeout(() => {
            const newTa = document.querySelector(`.vs-textarea[data-id="${newB.id}"]`);
            if (newTa) {
                newTa.focus();
                // Scroll to bottom
                const listEl = document.getElementById('vs-list');
                listEl.scrollTop = listEl.scrollHeight;
            }
        }, 50);
    });

    list.querySelectorAll('.vs-textarea').forEach(ta => {
        const resize = () => {
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight) + 'px';
        };
        // Initial resize might need a slight delay if DOM isn't fully painted
        setTimeout(resize, 10);
        
        ta.addEventListener('input', (e) => {
            resize();
            const b = p.visualScriptBlocks.find(x => x.id === ta.dataset.id);
            if (b) {
                b.text = e.target.value;
                p.lastEdited = new Date().toISOString();
                saveAll();
                
                const wordCount = p.visualScriptBlocks.map(bl => bl.text).join(' ').trim().split(/\s+/).filter(w => w.length > 0).length;
                const wcEl = document.querySelector('.vs-word-count');
                if (wcEl) wcEl.textContent = wordCount + ' WORDS';
            }
        });
    });

    list.querySelectorAll('.vs-block-row').forEach(item => {
        item.addEventListener('mouseenter', () => { const btn = item.querySelector('.del-vs-btn'); if (btn) btn.style.opacity = 1; });
        item.addEventListener('mouseleave', () => { const btn = item.querySelector('.del-vs-btn'); if(btn) btn.style.opacity = 0; });
    });

    list.querySelectorAll('.del-vs-btn').forEach(btn => btn.addEventListener('click', () => {
        openConfirmModal("Delete Block", "Delete this script block?", "Delete", () => {
            p.visualScriptBlocks = p.visualScriptBlocks.filter(x => x.id !== btn.dataset.id);
            saveAll(); refreshVS(p);
        });
    }));

    list.querySelectorAll('.vs-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const blockRow = btn.closest('.vs-block-row');
            if (!blockRow) return;
            const blockId = blockRow.dataset.id;
            const block = p.visualScriptBlocks.find(x => x.id === blockId);
            if (block) {
                const unlinkOpt = `<div class="assign-opt" data-sid="none"><i class="ti ti-x"></i>None / Unlink</div>`;
                const shotOpts = (p.shots || []).map(s => `
                    <div class="assign-opt ${block.shotId === s.id ? 'active' : ''}" data-sid="${s.id}">
                        <i class="ti ti-camera"></i>SH ${s.number < 10 ? '0' + s.number : s.number} — ${s.title}
                    </div>
                `).join('');
                
                openModal(`
                  <div class="modal modal-sm">
                    <h2>Tag Block to Shot</h2>
                    <p class="modal-sub">Link this visual script block to a shot.</p>
                    <div style="max-height: 250px; overflow-y: auto; margin-bottom: 16px;">
                      ${shotOpts || '<div style="color:#555; font-size:10px; padding:8px 0;">No shots created yet.</div>'}
                      ${shotOpts ? '<div class="assign-divider"></div>' : ''}
                      ${unlinkOpt}
                    </div>
                    <button class="modal-cancel-link" id="tag-cancel">Cancel</button>
                  </div>
                `);
                
                document.getElementById('tag-cancel').addEventListener('click', closeModal);
                document.querySelectorAll('[data-sid]').forEach(el => {
                    el.addEventListener('click', () => {
                        const sid = el.dataset.sid === 'none' ? null : el.dataset.sid;
                        block.shotId = sid;
                        p.lastEdited = new Date().toISOString();
                        saveAll();
                        closeModal();
                        refreshVS(p);
                    });
                });
            }
        });
    });

    if (typeof Draggable !== 'undefined') {
        const items = Array.from(list.querySelectorAll('.vs-block-row'));
        items.forEach((item, index) => {
            Draggable.create(item, {
                type: "y",
                bounds: list,
                cursor: "grabbing",
                trigger: item.querySelector('.vs-drag-handle'),
                onDragStart: function() {
                    this.target.style.zIndex = 1000;
                    this.target.style.background = '#111';
                    this.target.style.border = '1px solid #333';
                    this.target.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
                },
                onDrag: function() {
                    const dragTop = this.target.getBoundingClientRect().top;
                    items.forEach(otherItem => {
                        if (otherItem === this.target) return;
                        const otherTop = otherItem.getBoundingClientRect().top;
                        const otherHeight = otherItem.offsetHeight;
                        if (dragTop > otherTop - otherHeight/2 && dragTop < otherTop + otherHeight/2) {
                            const currentIdx = items.indexOf(this.target);
                            const otherIdx = items.indexOf(otherItem);
                            if (currentIdx < otherIdx) {
                                otherItem.parentNode.insertBefore(this.target, otherItem.nextSibling);
                            } else {
                                otherItem.parentNode.insertBefore(this.target, otherItem);
                            }
                            items.splice(currentIdx, 1);
                            items.splice(otherIdx, 0, this.target);
                            gsap.set(this.target, {y: 0});
                            this.update();
                        }
                    });
                },
                onDragEnd: function() {
                    this.target.style.zIndex = '';
                    this.target.style.background = '';
                    this.target.style.border = '';
                    this.target.style.boxShadow = '';
                    gsap.set(this.target, {y: 0});
                    const newIds = items.map(el => el.dataset.id);
                    p.visualScriptBlocks.sort((a, b) => newIds.indexOf(a.id) - newIds.indexOf(b.id));
                    p.lastEdited = new Date().toISOString();
                    saveAll();
                    refreshVS(p);
                }
            });
        });
    }
}
