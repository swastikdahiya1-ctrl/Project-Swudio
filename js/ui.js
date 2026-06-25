import { state } from './state.js';
import { uid, formatDateTime } from './utils.js';
import { saveAll } from './db.js';
import { openConfirmModal, openPromptModal, closeModal, openModal } from './utils.js';
import { nav, render, bootApp } from './main.js';
import { projProg, shotCounts } from './project.js';
import { signIn, signUp, signOut, saveConfig, isConfigured, syncDown, deleteProjectFromCloud, deleteIdeaFromCloud, deleteArchiveFromCloud } from './sync.js';

export function renderSidebar() {
    const sb = document.getElementById('sidebar');
    if (!sb) return;
    let projHTML = '';

    let sorted = [...state.projects].sort((a, b) => {
        if (a.id === state.S.projectId) return -1;
        if (b.id === state.S.projectId) return 1;
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
    });

    sorted.forEach(p => {
        const isCurrent = p.id === state.S.projectId && state.S.view !== 'dashboard' && state.S.view !== 'all-ideas' && state.S.view !== 'trash';
        const isExpanded = isCurrent || state.expandedProjectsState.includes(p.id);
        const pinColor = p.pinned ? '#DDDDDE' : '#444';

        projHTML += `
       <div class="sb-proj-header ${isCurrent ? 'active' : ''}" data-toggle-pid="${p.id}">
         <div style="display:flex; align-items:center; gap:8px;">
           ${isCurrent ? '<div style="width:12px; height:12px; flex-shrink:0;"></div>' : `<i class="ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'}" style="font-size:12px; color:#555;"></i>`}
           <span class="sb-proj-text" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">${p.title || 'UNTITLED'}</span>
         </div>
         <button class="icon-btn pin-btn" data-pin-id="${p.id}" style="padding:2px; color:${pinColor};"><i class="ti ti-pin"></i></button>
       </div>
     `;

        if (isExpanded) {
            projHTML += `<div class="sb-proj-nav" style="position:relative;">
         ${isCurrent ? '<div class="nav-indicator"></div>' : ''}
         ${[['overview', 'ti-home', 'OVERVIEW'], ['script', 'ti-writing', 'VISUAL SCRIPT'], ['board', 'ti-layout-board', 'PROJECT BOARD'], ['shots', 'ti-camera', 'SHOTS']].map(([t, ic, lb]) => `<div class="sb-item sb-proj-nav-item ${state.S.tab === t.toLowerCase() && isCurrent ? 'active' : ''}" data-pid="${p.id}" data-tab="${t.toLowerCase()}"><i class="ti ${ic}"></i><span>${lb}</span></div>`).join('')}
       </div>`;
        }
    });

    const bypassAuth = sessionStorage.getItem('bypass_auth') === 'true';
    const authBtnHtml = bypassAuth 
        ? '<button class="btn btn-ghost" id="sb-signin-btn" style="border-radius:0; font-size:9px; padding:4px 8px; font-family:\'IBM Plex Mono\', monospace;" title="Sign In"><i class="ti ti-login" style="font-size:12px;"></i> SIGN IN</button>'
        : '<button class="btn btn-ghost" id="sb-signout-btn" style="border-radius:0; font-size:9px; padding:4px 8px; font-family:\'IBM Plex Mono\', monospace; color:#c53d3d; border-color:#522;" title="Sign Out" onmouseover="this.style.borderColor=\'#833\';this.style.color=\'#e55\'" onmouseout="this.style.borderColor=\'#522\';this.style.color=\'#c53d3d\'"><i class="ti ti-logout" style="font-size:12px;"></i> OUT</button>';

    sb.innerHTML = `
    <div class="sb-logo-wrap" style="display:flex; align-items:center; gap:12px;">
      <div class="sb-logo">S</div>
      ${authBtnHtml}
    </div>
    
    <div class="sb-section" style="position:relative;">
      <div class="sb-label">WORKSPACE</div>
      ${(state.S.view === 'dashboard' || state.S.view === 'all-ideas' || state.S.view === 'trash') ? '<div class="workspace-bg-highlight"></div>' : ''}
      <div class="sb-item ${state.S.view === 'dashboard' ? 'active' : ''}" id="sb-home"><i class="ti ti-home"></i><span class="sb-item-text">HOME</span></div>
      <div class="sb-item ${state.S.view === 'all-ideas' ? 'active' : ''}" id="sb-allideas"><i class="ti ti-bulb"></i><span class="sb-item-text">ALL IDEAS</span></div>
      <div class="sb-item ${state.S.view === 'trash' ? 'active' : ''}" id="sb-trash"><i class="ti ti-trash"></i><span class="sb-item-text">ARCHIVE</span></div>
    </div>
    
    <div class="sb-section" style="margin-top:24px;">
      <div class="sb-label">PROJECTS</div>
      ${projHTML}
    </div>
    
    <div class="sb-footer" style="display:flex; flex-direction:column; gap:12px;">
       <div style="display:flex; flex-direction:column; gap:8px; border-bottom:1px solid #161616; padding-bottom:12px;">
          <div style="display:flex; gap:8px;">
             <button class="icon-btn" id="sb-settings-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Settings"><i class="ti ti-settings" style="font-size:12px;"></i> SETTINGS</button>
             <button class="icon-btn" id="sb-replay-boot-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Replay Animation"><i class="ti ti-player-play" style="font-size:12px;"></i> REPLAY</button>
          </div>
       </div>
       <div id="sb-clock" style="color:#333;">${formatDateTime(new Date().toISOString())}</div>
    </div>
  `;

    sb.querySelector('#sb-home').addEventListener('click', () => nav('dashboard'));
    sb.querySelector('#sb-allideas').addEventListener('click', () => nav('all-ideas'));
    sb.querySelector('#sb-trash').addEventListener('click', () => nav('trash'));

    sb.querySelector('#sb-settings-btn').addEventListener('click', () => {
        openSettingsModal();
    });

    sb.querySelector('#sb-replay-boot-btn').addEventListener('click', () => {
        if (window._reduceMotion || typeof gsap === 'undefined') return;
        
        const view = state.S.view;
        const pId = state.S.projectId;
        const tab = state.S.tab;
        
        if (view === 'dashboard' || view === 'all-ideas' || view === 'trash') {
            window._appHasBooted = false;
            document.body.classList.add('is-booting');
            import('./main.js').then(m => {
                m.render();
                setTimeout(() => {
                    document.body.classList.remove('is-booting');
                    if (window._pendingBootTL) {
                        window._pendingBootTL.play();
                        window._pendingBootTL = null;
                    }
                }, 50);
            });
        } else if (view === 'project' && window._bootedProjects) {
            if (tab === 'overview' && window._bootedProjects.overview) {
                window._bootedProjects.overview[pId] = false;
            } else if (tab === 'script' && window._bootedProjects.vs) {
                window._bootedProjects.vs[pId] = false;
            } else if (tab === 'board' && window._bootedProjects.board) {
                window._bootedProjects.board[pId] = false;
            } else if (tab === 'shots' && window._bootedProjects.shots) {
                if (state.S.shotId && window._bootedProjects.shotDetail) {
                    window._bootedProjects.shotDetail[state.S.shotId] = false;
                } else {
                    window._bootedProjects.shots[pId] = false;
                }
            }
            import('./main.js').then(m => m.render());
        }
    });

    const signOutBtn = sb.querySelector('#sb-signout-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await signOut();
            window.location.reload();
        });
    }

    const signInBtn = sb.querySelector('#sb-signin-btn');
    if (signInBtn) {
        signInBtn.addEventListener('click', () => {
            sessionStorage.removeItem('bypass_auth');
            window.location.reload();
        });
    }

    sb.querySelectorAll('.sb-proj-header').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.pin-btn')) return;
            const pid = el.dataset.togglePid;

            if (pid === state.S.projectId && state.S.view !== 'dashboard' && state.S.view !== 'all-ideas' && state.S.view !== 'trash') return;

            const isExpanded = state.expandedProjectsState.includes(pid);
            const navEl = el.nextElementSibling;

            if (isExpanded && navEl && navEl.classList.contains('sb-proj-nav')) {
                if (typeof gsap !== 'undefined' && !window._reduceMotion) {
                    gsap.to(navEl, {
                        height: 0, opacity: 0, duration: 0.35, ease: "power2.inOut",
                        onComplete: () => {
                            state.expandedProjectsState = state.expandedProjectsState.filter(id => id !== pid);
                            renderSidebar();
                        }
                    });
                } else {
                    state.expandedProjectsState = state.expandedProjectsState.filter(id => id !== pid);
                    renderSidebar();
                }
            } else if (!isExpanded) {
                state.expandedProjectsState.push(pid);
                window._gsapTargetId = pid;
                renderSidebar();
            }
        });
    });

    sb.querySelectorAll('.sb-proj-nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            nav('project', el.dataset.pid, { tab: el.dataset.tab });
        });
    });

    sb.querySelectorAll('.pin-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const p = state.projects.find(x => x.id === btn.dataset.pinId);
            if (p) { p.pinned = !p.pinned; saveAll(); renderSidebar(); }
        });
    });

    if (window._gsapTargetId && typeof gsap !== 'undefined' && !window._reduceMotion) {
        const openedHeader = sb.querySelector(`.sb-proj-header[data-toggle-pid="${window._gsapTargetId}"]`);
        if (openedHeader && openedHeader.nextElementSibling) {
            gsap.from(openedHeader.nextElementSibling, { height: 0, opacity: 0, duration: 0.4, ease: "back.out(1.5)" });
            gsap.from(openedHeader.nextElementSibling.querySelectorAll('.sb-item'), { x: -15, opacity: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" });
        }
        window._gsapTargetId = null;
    }

    const activeNav = sb.querySelector('.sb-proj-nav-item.active');
    const indicator = sb.querySelector('.nav-indicator');

    if (activeNav && indicator && typeof gsap !== 'undefined' && !window._reduceMotion) {
        const targetY = activeNav.offsetTop;
        if (window._lastNavY === undefined || window._lastNavPid !== state.S.projectId) {
            gsap.set(indicator, { y: targetY });
        } else {
            gsap.fromTo(indicator, { y: window._lastNavY }, { y: targetY, duration: 0.35, ease: "back.out(1.2)" });
        }
        window._lastNavY = targetY;
        window._lastNavPid = state.S.projectId;
    }

    const topActiveNav = sb.querySelector('#sb-home.active, #sb-allideas.active, #sb-trash.active');
    const topBgHighlight = sb.querySelector('.workspace-bg-highlight');

    if (topActiveNav && topBgHighlight && typeof gsap !== 'undefined' && !window._reduceMotion) {
        const targetY = topActiveNav.offsetTop;
        gsap.set(topBgHighlight, { width: topActiveNav.offsetWidth, height: topActiveNav.offsetHeight, left: topActiveNav.offsetLeft });
        if (window._lastTopBgY === undefined) {
            gsap.set(topBgHighlight, { y: targetY });
        } else {
            gsap.fromTo(topBgHighlight, { y: window._lastTopBgY }, { y: targetY, duration: 0.35, ease: "back.out(1.2)" });
        }
        window._lastTopBgY = targetY;
    } else {
        window._lastTopBgY = undefined;
    }
}

export function renderDashboard(m) {
    const activeCount = state.projects.length < 10 ? '0' + state.projects.length : state.projects.length;
    m.innerHTML = `<div class="dashboard-revamp">
    <div class="hud-tl hud-corner"></div><div class="hud-tr hud-corner"></div><div class="hud-bl hud-corner"></div><div class="hud-br hud-corner"></div>

    <div class="page-topbar">
      <div class="welcome">
        <h1>WELCOME BACK, SWASTIK.</h1>
        <p>PICK UP WHERE YOU LEFT OFF OR START SOMETHING NEW.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-proj"><i class="ti ti-plus" style="font-size:12px;"></i> <span>NEW PROJECT</span></button>
    </div>

    <div class="dash-section-header">
       <div class="dash-sec-title">ACTIVE PROJECTS</div>
       <div class="dash-sec-line"></div>
       <div class="dash-sec-count">${activeCount} ACTIVE</div>
    </div>
    
    <div class="projects-grid" id="proj-grid"></div>

    <div class="dash-section-header" style="margin-top:16px;">
       <div class="dash-sec-title">IDEA INBOX</div>
       <div class="dash-sec-line"></div>
    </div>

    <div class="idea-input-row">
      <input class="idea-input" id="idea-inp" placeholder="TYPE AN IDEA..."/>
      <button class="idea-send" id="idea-send-btn"><i class="ti ti-arrow-right"></i></button>
    </div>
    
    <div id="ideas-list" style="display:flex; flex-direction:column;"></div>
  </div>`;

    renderProjGrid();
    renderIdeasList();

    document.getElementById('btn-new-proj').addEventListener('click', () => openNewProjModal());
    document.getElementById('idea-send-btn').addEventListener('click', handleIdeaSend);
    document.getElementById('idea-inp').addEventListener('keydown', e => { if (e.key === 'Enter') handleIdeaSend(); });

    if (typeof gsap !== 'undefined' && !window._reduceMotion && !window._appHasBooted) {
        import('./utils.js').then(({ getBootConfig }) => {
            const cfg = getBootConfig('dashboard');
            const cards = m.querySelectorAll('.project-card, .new-card');
            const topbarBtn = m.querySelector('#btn-new-proj');
            const dashTitle = m.querySelector('.welcome h1');
            const dashSub = m.querySelector('.welcome p');
            const headers = m.querySelectorAll('.dash-section-header');
            const ideas = m.querySelectorAll('.idea-input-row, .dash-idea-row');
            const sidebarItems = document.querySelectorAll('.sidebar .sb-logo-wrap, .sidebar .sb-label, .sidebar .sb-item, .sidebar .sb-proj-header, .sidebar .sb-footer');

            // Hide all elements FIRST (synchronous, immediate)
            gsap.set(cards, { opacity: 0, y: cfg.offset });
            gsap.set(topbarBtn, { opacity: 0, y: -20 });
            gsap.set([dashTitle, dashSub], { clipPath: "polygon(0% -50%, 0% -50%, 0% 150%, 0% 150%)" });
            gsap.set(headers, { opacity: 0, y: 10 });
            gsap.set(ideas, { opacity: 0, y: cfg.offset });
            gsap.set(sidebarItems, { opacity: 0, y: 40 });

            // Build the timeline PAUSED
            const tl = gsap.timeline({ paused: true });
            tl.to(cards, { y: 0, opacity: 1, duration: cfg.duration, stagger: cfg.stagger, ease: cfg.ease }, 0);
            tl.to(dashTitle, { clipPath: "polygon(0% -50%, 110% -50%, 110% 150%, 0% 150%)", duration: 0.8, ease: "back.out(1.2)" }, 0.1)
                .to(dashSub, { clipPath: "polygon(0% -50%, 110% -50%, 110% 150%, 0% 150%)", duration: 0.8, ease: "back.out(1.2)" }, 0.2);
            tl.to(sidebarItems, { y: 0, opacity: 1, duration: cfg.duration, stagger: cfg.stagger * 0.3, ease: cfg.ease }, 0.15);
            tl.to(topbarBtn, { y: 0, opacity: 1, duration: cfg.duration, ease: cfg.ease }, 0.2);
            tl.to(headers, { y: 0, opacity: 1, duration: cfg.duration, stagger: cfg.stagger, ease: cfg.ease }, 0.5)
                .to(ideas, { y: 0, opacity: 1, duration: cfg.duration, stagger: cfg.stagger * 0.5, ease: cfg.ease }, 0.2);

            window._pendingBootTL = tl;
            // Since this is async (import), if the bootApp() was already called synchronously by main.js, 
            // we should manually play it now. But bootApp uses setTimeout 50ms, so it might be fine.
            if (!document.body.classList.contains('is-booting')) {
                tl.play();
            }
        });
        window._appHasBooted = true;
    }
}

function renderProjGrid() {
    const g = document.getElementById('proj-grid'); if (!g) return;
    g.innerHTML = '';
    state.projects.forEach(p => {
        const pg = projProg(p), counts = shotCounts(p);

        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
      <div class="project-thumb">${p.thumbnail ? `<img src="${p.thumbnail}" alt="" draggable="false">` : `<i class="ti ti-video project-thumb-icon" style="color:#222;"></i>`}</div>
      <div class="project-info" style="padding:16px;">
        <div style="display:flex; justify-content:flex-start; align-items:center; gap:8px;">
          <div class="project-title" style="margin-bottom:0; font-size:11px; font-weight:600; color:#DDDDDE; font-family: 'IBM Plex Mono', monospace; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.title || 'UNTITLED'}</div>
          <button class="icon-btn del-proj-btn" data-pid="${p.id}" style="padding:0; color:#555; display:flex; align-items:center;"><i class="ti ti-trash"></i></button>
        </div>
        
        <div style="display:flex; align-items:baseline; gap:8px; margin:18px 0 10px;">
          <span style="font-size:22px; font-weight:500; color:#DDDDDE; line-height:1; letter-spacing:-0.02em;">${pg}%</span>
          <span style="font-size:9px; color:#555; font-weight:600;">MISSION PROGRESS</span>
        </div>
        
        <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${pg}%;"></div></div>
        
        <div class="project-stats" style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; font-size:9px; align-items:start;">
          <div style="text-align:left;">
            <div style="color:#DDDDDE; font-size:12px; font-weight:500; margin-bottom:6px;">${counts.complete}</div>
            <div style="color:#555; margin-bottom:2px;">SHOTS</div>
            <div style="color:#5aaa80;">COMPLETED</div>
          </div>
          <div style="text-align:center;">
            <div style="color:#DDDDDE; font-size:12px; font-weight:500; margin-bottom:6px;">${counts.wip}</div>
            <div style="color:#555;">WIP</div>
          </div>
          <div style="text-align:right;">
            <div style="color:#DDDDDE; font-size:12px; font-weight:500; margin-bottom:6px;">${counts.ns}</div>
            <div style="color:#555;">LEFT</div>
          </div>
        </div>
      </div>`;

        card.addEventListener('click', () => nav('project', p.id, { tab: 'overview' }));
        card.querySelector('.del-proj-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openPromptModal("Delete Project", `Type "${p.title}" to confirm deletion.`, "Confirm Name", "", (val) => {
                if (val === p.title) {
                    const idx = state.projects.findIndex(x => x.id === p.id);
                    if (idx > -1) {
                        const deleted = state.projects.splice(idx, 1)[0];
                        state.archives.push({ type: 'project', data: deleted, archivedAt: new Date().toISOString() });
                        deleteProjectFromCloud(p.id);
                        saveAll(); renderDashboard(document.getElementById('main')); renderSidebar();
                    }
                } else {
                    openConfirmModal("Error", "Name didn't match. Deletion aborted.", "OK", () => { });
                }
            });
        });
        g.appendChild(card);
    });

    const nc = document.createElement('div');
    nc.className = 'new-card';
    nc.innerHTML = `<i class="ti ti-plus" style="font-size:20px;"></i><span style="font-size:10px;">NEW PROJECT</span>`;
    nc.addEventListener('click', () => openNewProjModal());
    g.appendChild(nc);
}

function renderIdeasList() {
    const list = document.getElementById('ideas-list'); if (!list) return;
    const unassigned = state.ideas.filter(i => !i.projectId).slice(0, 5);
    list.innerHTML = '';

    if (!unassigned.length) {
        list.innerHTML = `<div style="padding:20px 0; color:#333; font-size:10px;">NO IDEAS LOGGED.</div>`;
        return;
    }

    unassigned.forEach(idea => {
        const item = document.createElement('div');
        item.className = 'dash-idea-row';
        item.style.cssText = "display:flex; align-items:center; padding:12px 0; border-bottom:1px solid #161616;";
        item.innerHTML = `
      <div style="width:6px; height:6px; background:#f5a623; margin-right:16px; flex-shrink:0;"></div>
      <span style="flex:1; color:#aaa; font-size:10px; line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${idea.text || idea.title}</span>
      <span style="color:#555; font-size:9px; margin-right:24px; flex-shrink:0;">${formatDateTime(idea.createdAt)}</span>
      <div class="dash-idea-actions" style="display:flex; gap:8px; flex-shrink:0;">
        <button class="icon-btn edit-idea" data-id="${idea.id}" style="color:#555; padding:2px;"><i class="ti ti-pencil"></i></button>
        <button class="icon-btn assign-idea" data-id="${idea.id}" style="color:#555; padding:2px;"><i class="ti ti-folder"></i></button>
        <button class="icon-btn del-idea" data-id="${idea.id}" style="color:#cc5555; padding:2px;"><i class="ti ti-trash"></i></button>
      </div>`;
        list.appendChild(item);
    });

    list.querySelectorAll('.del-idea').forEach(b => b.addEventListener('click', () => {
        openConfirmModal('Delete Idea', 'Are you sure you want to delete this idea?', 'Delete', () => {
            state.ideas = state.ideas.filter(i => i.id !== b.dataset.id); 
            deleteIdeaFromCloud(b.dataset.id);
            saveAll(); renderIdeasList();
        });
    }));
    list.querySelectorAll('.edit-idea').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const idea = state.ideas.find(i => i.id === btn.dataset.id);
        openPromptModal("Edit Idea", "Update your idea text.", "Idea", idea.text || idea.title, (newText) => {
            if (newText && newText.trim()) { idea.text = newText.trim(); idea.title = newText.trim(); saveAll(); renderIdeasList(); }
        });
    }));
    list.querySelectorAll('.assign-idea').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const idea = state.ideas.find(i => i.id === btn.dataset.id);
        openAssignModal(idea.text || idea.title, idea.id);
    }));
}

function handleIdeaSend() {
    const inp = document.getElementById('idea-inp'); const text = inp ? inp.value.trim() : '';
    if (!text) return; inp.value = ''; openAssignModal(text);
}

export function renderAllIdeas(m) {
    let allIdeas = state.ideas || [];

    m.innerHTML = `
    <div class="page" style="padding: 40px; max-width: 900px;">
        <div style="margin-bottom: 32px;">
            <div style="font-size: 16px; font-weight: 600; color: #DDDDDE; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">ALL IDEAS</div>
            <div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">YOUR UNASSIGNED CREATIVE INBOX.</div>
        </div>

        <div class="quick-capture-bar">
            <input type="text" id="ai-quick-input" placeholder="QUICK CAPTURE..." autocomplete="off">
            <button id="ai-quick-submit"><i class="ti ti-arrow-right"></i></button>
        </div>

        <div class="ai-list-container" id="ai-list"></div>
    </div>
    `;

    const listCon = document.getElementById('ai-list');

    const renderList = () => {
        listCon.innerHTML = '';
        const sorted = [...allIdeas].filter(i => !i.projectId).sort((a, b) => b.id - a.id);

        sorted.forEach((idObj) => {
            const d = new Date(parseInt(idObj.id) || Date.now());
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

            const row = document.createElement('div');
            row.className = 'ai-row';
            row.innerHTML = `
                <i class="ti ti-bulb ai-bulb"></i>
                <div class="ai-title-input" contenteditable="true" style="flex:1; background:transparent; border:none; color:#DDDDDE; font-size:12px; outline:none; font-family:inherit; min-height:16px; overflow-wrap:anywhere; word-break:break-word;">${idObj.title || idObj.text || ''}</div>
                <div class="ai-date">${dateStr}</div>
                <div class="ai-actions">
                    <button class="ai-btn move" title="Assign to Project"><i class="ti ti-folder"></i></button>
                    <button class="ai-btn del" title="Delete"><i class="ti ti-trash"></i></button>
                </div>
            `;

            row.querySelector('.ai-title-input').addEventListener('input', (e) => {
                const val = e.target.innerText;
                idObj.title = val;
                idObj.text = val;
                saveAll();
            });
            row.querySelector('.move').addEventListener('click', () => {
                openAssignModal(idObj.title || idObj.text, idObj.id);
            });
            row.querySelector('.del').addEventListener('click', () => {
                openConfirmModal('DELETE IDEA', 'Permanently delete this idea from your inbox?', 'DELETE', () => {
                    const idx = allIdeas.findIndex(x => x.id === idObj.id);
                    if (idx > -1) allIdeas.splice(idx, 1);
                    saveAll(); renderList();
                });
            });
            listCon.appendChild(row);
        });
    };

    renderList();

    const input = document.getElementById('ai-quick-input');
    const submit = document.getElementById('ai-quick-submit');

    const addIdea = () => {
        const val = input.value.trim();
        if (!val) return;
        const newIdea = { id: Date.now().toString(), title: val, text: val };
        allIdeas.push(newIdea);
        saveAll();
        input.value = '';
        renderList();
    };

    submit.addEventListener('click', addIdea);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addIdea();
    });
}

export function renderTrash(m) {
    m.innerHTML = `
    <div class="page" style="padding: 40px; max-width: 900px;">
        <div style="margin-bottom: 32px;">
            <div style="font-size: 16px; font-weight: 600; color: #DDDDDE; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">ARCHIVE / TRASH</div>
            <div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">DELETED PROJECTS AND SHOTS (KEPT FOR 30 DAYS).</div>
        </div>
        
        <div class="shots-dash-bar-revamp" style="border-top:none; border-bottom:none; margin-bottom:24px; padding:0;">
          <div class="shots-filters">
           <button class="shot-filter-btn ${state.S.trashTab !== 'shots' ? 'active' : ''}" id="tab-projects">PROJECTS</button>
           <button class="shot-filter-btn ${state.S.trashTab === 'shots' ? 'active' : ''}" id="tab-shots">SHOTS</button>
          </div>
        </div>

        <div class="ai-list-container" id="trash-list"></div>
    </div>
    `;

    document.getElementById('tab-projects').addEventListener('click', () => { state.S.trashTab = 'projects'; renderTrash(m); });
    document.getElementById('tab-shots').addEventListener('click', () => { state.S.trashTab = 'shots'; renderTrash(m); });

    const listCon = document.getElementById('trash-list');
    listCon.innerHTML = '';

    const filterType = state.S.trashTab === 'shots' ? 'shot' : 'project';
    const items = state.archives.filter(x => x.type === filterType).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

    if (items.length === 0) {
        listCon.innerHTML = `<div style="padding:20px 0; color:#555; font-size:10px;">ARCHIVE EMPTY.</div>`;
        return;
    }

    items.forEach(item => {
        const d = new Date(item.archivedAt);
        const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 3600 * 24));
        const remDays = 30 - diffDays;
        const displayTxt = item.data.title || 'Untitled';

        const row = document.createElement('div');
        row.className = 'ai-row';
        row.innerHTML = `
            <i class="ti ${filterType === 'shot' ? 'ti-camera' : 'ti-folder'} ai-bulb"></i>
            <div class="ai-title" style="flex:1;">${displayTxt}</div>
            <div class="ai-date" style="margin-right:16px;">${remDays} DAYS LEFT</div>
            <div class="ai-actions" style="display:flex; gap:12px;">
                <button class="btn btn-ghost restore-btn" data-id="${item.data.id}" style="padding:4px 8px; font-size:9px;">RESTORE</button>
                <button class="icon-btn del-btn" data-id="${item.data.id}" style="color:#cc5555; padding:4px;"><i class="ti ti-trash"></i></button>
            </div>
        `;

        row.querySelector('.restore-btn').addEventListener('click', () => {
            const idx = state.archives.findIndex(x => x.data.id === item.data.id);
            if (idx > -1) {
                const recovered = state.archives.splice(idx, 1)[0];
                deleteArchiveFromCloud(recovered.data.id);
                if (recovered.type === 'project') state.projects.push(recovered.data);
                else if (recovered.type === 'shot') {
                    // Try to find parent project
                    const parentId = recovered.data.projectId; // Need to ensure shot holds projectId
                    let parent = state.projects.find(p => p.id === parentId);
                    if (parent) { parent.shots.push(recovered.data); parent.shots.forEach((s, i) => s.number = i + 1); }
                    else {
                        // If project is gone, recover it to the first project? Or just fail safely
                        openConfirmModal("Parent Missing", "The parent project is deleted. Restore the project first.", "OK", () => { });
                        state.archives.push(recovered); // put back
                        return;
                    }
                }
                saveAll(); renderTrash(m); renderSidebar();
            }
        });

        row.querySelector('.del-btn').addEventListener('click', () => {
            openConfirmModal('DELETE FOREVER', 'Permanently destroy this item? It cannot be recovered.', 'DESTROY', () => {
                state.archives = state.archives.filter(x => x.data.id !== item.data.id);
                deleteArchiveFromCloud(item.data.id);
                saveAll(); renderTrash(m);
            });
        });

        listCon.appendChild(row);
    });
}

// Global modal for New Project and Idea Assignments
export function openNewProjModal() {
    let thumb = null;
    openModal(`<div class="modal">
    <h2>New project</h2><div class="modal-sub">Give it a name to get started.</div>
    <div class="field"><label>Title</label><input id="np-t" placeholder="Untitled Project"/></div>
    <div class="field"><label>Description <span style="color:#333;">(optional)</span></label><textarea id="np-d" placeholder="What's this about?"></textarea></div>
    <div class="field"><label>Thumbnail <span style="color:#333;">(optional)</span></label>
      <label class="thumb-upload" id="np-thumb-lbl"><i class="ti ti-upload"></i>Upload image<input type="file" accept="image/*" id="np-thumb"/></label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="np-cancel">Cancel</button>
      <button class="btn btn-primary" id="np-create">Create Project</button>
    </div>
  </div>`);
    document.getElementById('np-thumb').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        import('./utils.js').then(m => m.compressImage(f, (res) => {
            thumb = res;
            const lbl = document.getElementById('np-thumb-lbl');
            lbl.innerHTML = `<img src="${thumb}" alt="" draggable="false"><input type="file" accept="image/*" id="np-thumb"/>`;
            document.getElementById('np-thumb').addEventListener('change', e2 => {
                if (e2.target.files[0]) m.compressImage(e2.target.files[0], (res2) => {
                    thumb = res2;
                    lbl.querySelector('img').src = thumb;
                });
            });
        }));
    });
    document.getElementById('np-cancel').addEventListener('click', closeModal);
    document.getElementById('np-create').addEventListener('click', () => {
        const title = document.getElementById('np-t').value.trim() || 'Untitled Project';
        const desc = document.getElementById('np-d').value.trim();

        import('./state.js').then(m => {
            let initialColor = m.BLOCK_PALETTE[Math.floor(Math.random() * m.BLOCK_PALETTE.length)];
            const p = {
                id: uid(),
                title,
                description: desc,
                thumbnail: thumb,
                genre: '',
                format: '',
                duration: '',
                status: 'Not Started',
                createdAt: new Date().toISOString(),
                lastEdited: new Date().toISOString(),
                visualScriptBlocks: [{ id: uid(), text: '', shotId: null, color: initialColor }],
                shots: [],
                ideas: [],
                projectBoardData: { elements: [] }
            };
            state.projects.push(p);
            saveAll();
            closeModal();
            render();
        });
    });
}

export function openAssignModal(text, existingId = null) {
    openModal(`<div class="modal modal-sm">
    <h2>Assign to a project?</h2>
    <div class="modal-preview-text">"${text.length > 44 ? text.slice(0, 44) + '…' : text}"</div>
    ${state.projects.map(p => `<div class="assign-opt" data-pid="${p.id}"><i class="ti ti-folder"></i>${p.title || 'Untitled'}</div>`).join('')}
    <div class="assign-divider"></div>
    <div class="assign-opt" data-pid="none"><i class="ti ti-inbox"></i>Leave unassigned</div>
    <button class="modal-cancel-link" id="assign-cancel">Cancel</button>
  </div>`);
    document.getElementById('assign-cancel').addEventListener('click', closeModal);
    document.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
        const pid = el.dataset.pid === 'none' ? null : el.dataset.pid;

        if (existingId) {
            const ideaIndex = state.ideas.findIndex(i => i.id === existingId);
            if (ideaIndex > -1) {
                const idea = state.ideas.splice(ideaIndex, 1)[0];
                if (pid) {
                    const pr = state.projects.find(p => p.id === pid);
                    if (pr) { pr.ideas = pr.ideas || []; pr.ideas.push(idea); }
                } else {
                    state.ideas.push(idea);
                }
            }
        } else {
            const idea = { id: uid(), text: text, title: text, projectId: pid, createdAt: new Date().toISOString() };
            if (pid) {
                const pr = state.projects.find(p => p.id === pid);
                if (pr) { pr.ideas = pr.ideas || []; pr.ideas.push(idea); }
            } else {
                state.ideas.push(idea);
            }
        }

        saveAll();
        closeModal();
        if (state.S.view === 'dashboard') renderDashboard(document.getElementById('main'));
        else if (state.S.view === 'all-ideas') renderAllIdeas(document.getElementById('main'));
        else if (state.S.view === 'project' && state.S.tab === 'overview') render();
    }));
}

// ─── AUTH SCREEN RENDERING & ACTIONS ───
export function renderAuthScreen() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) return;

    let isSignUpMode = false;

    function renderForm() {
        appRoot.innerHTML = `
            <div class="auth-overlay">
                <button class="auth-config-trigger" id="auth-cfg-btn" title="Database Settings">
                    <i class="ti ti-settings"></i>
                </button>
                
                <div class="auth-card">
                    <div class="auth-card-title">STUDIO PM // ${isSignUpMode ? 'CREATE ACCOUNT' : 'SECURE SIGN IN'}</div>
                    
                    <div class="auth-input-group">
                        <label>EMAIL ADDRESS</label>
                        <input type="email" id="auth-email" class="auth-input" placeholder="EMAIL@EXAMPLE.COM" autocomplete="email"/>
                    </div>
                    
                    <div class="auth-input-group">
                        <label>PASSWORD</label>
                        <input type="password" id="auth-password" class="auth-input" placeholder="••••••••••••" autocomplete="current-password"/>
                    </div>
                    
                    <button class="auth-btn-primary" id="auth-submit-btn">
                        ${isSignUpMode ? 'REGISTER' : 'LOG IN'}
                    </button>
                    
                    <div class="auth-toggle-link" id="auth-toggle-btn">
                        ${isSignUpMode ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : 'NEED AN ACCOUNT? SIGN UP'}
                    </div>

                    <div style="display:flex; justify-content:center; margin-top:16px; width: 100%;">
                        <button class="btn btn-ghost" id="auth-bypass-btn" style="font-size:9px; letter-spacing:1.5px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace; width:100%; border:1px solid #222; padding:10px; cursor:pointer;">
                            <i class="ti ti-plug-off" style="margin-right:6px;"></i> Continue offline (Local Mode)
                        </button>
                    </div>
                    
                    <div class="auth-status-msg" id="auth-status"></div>
                </div>
            </div>
        `;

        // Bind events
        document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
        document.getElementById('auth-toggle-btn').addEventListener('click', () => {
            isSignUpMode = !isSignUpMode;
            renderForm();
        });
        document.getElementById('auth-cfg-btn').addEventListener('click', openDbConfigModal);
        
        const bypassBtn = document.getElementById('auth-bypass-btn');
        if (bypassBtn) {
            bypassBtn.addEventListener('click', () => {
                sessionStorage.setItem('bypass_auth', 'true');
                // Restore the original app DOM structure that renderAuthScreen destroyed
                const appRoot = document.getElementById('app-root');
                if (appRoot) {
                    appRoot.innerHTML = `
                        <div class="sidebar-overlay" id="sidebar-overlay"></div>
                        <div class="sidebar" id="sidebar"></div>
                        <div class="main" id="main"></div>
                    `;
                    appRoot.style.opacity = '0';
                }
                // Re-bind mobile sidebar overlay listener (since DOM was recreated)
                const newOverlay = document.getElementById('sidebar-overlay');
                if (newOverlay && appRoot) {
                    newOverlay.addEventListener('click', () => {
                        appRoot.classList.remove('sidebar-open');
                    });
                }
                import('./main.js').then(m => {
                    m.bootApp();
                });
            });
        }
        
        const emailInp = document.getElementById('auth-email');
        const passInp = document.getElementById('auth-password');
        const handleEnter = (e) => { if (e.key === 'Enter') handleAuthSubmit(); };
        if (emailInp) emailInp.addEventListener('keydown', handleEnter);
        if (passInp) passInp.addEventListener('keydown', handleEnter);
    }

    renderForm();

    const splash = document.getElementById('splash-screen');
    if (appRoot) appRoot.style.opacity = '1';
    document.body.classList.remove('is-booting');
    
    if (splash) {
        if (typeof gsap !== 'undefined' && !window._reduceMotion) {
            gsap.to(splash, {
                opacity: 0, duration: 0.6, ease: "power2.inOut",
                onComplete: () => { splash.style.display = 'none'; }
            });
        } else {
            splash.style.transition = 'opacity 0.6s ease-in-out';
            splash.style.opacity = '0';
            setTimeout(() => { splash.style.display = 'none'; }, 600);
        }
    }
}

async function handleAuthSubmit() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const statusEl = document.getElementById('auth-status');
    const submitBtn = document.getElementById('auth-submit-btn');

    if (!email || !password) {
        statusEl.className = "auth-status-msg error";
        statusEl.innerText = "ERROR: EMAIL AND PASSWORD REQUIRED.";
        return;
    }

    statusEl.className = "auth-status-msg";
    statusEl.innerText = "PROCESSING...";
    submitBtn.disabled = true;

    try {
        const isSignUpMode = document.getElementById('auth-submit-btn').innerText === 'REGISTER';
        if (isSignUpMode) {
            await signUp(email, password);
            statusEl.className = "auth-status-msg success";
            statusEl.innerText = "ACCOUNT CREATED. LOGGING YOU IN...";

            // Auto sign-in after signup (email confirmation is disabled)
            try {
                await signIn(email, password);
                await syncDown();

                // Reinitialize DOM layout
                const appRoot = document.getElementById('app-root');
                appRoot.innerHTML = `
                    <div class="sidebar-overlay" id="sidebar-overlay"></div>
                    <div class="sidebar" id="sidebar"></div>
                    <div class="main" id="main"></div>
                `;
                // Re-bind mobile sidebar overlay listener
                const newOverlay = document.getElementById('sidebar-overlay');
                if (newOverlay && appRoot) {
                    newOverlay.addEventListener('click', () => {
                        appRoot.classList.remove('sidebar-open');
                    });
                }
                bootApp();
            } catch (loginErr) {
                statusEl.className = "auth-status-msg success";
                statusEl.innerText = "ACCOUNT CREATED. PLEASE SIGN IN.";
            }
        } else {
            await signIn(email, password);
            statusEl.className = "auth-status-msg success";
            statusEl.innerText = "AUTHENTICATED SUCCESSFULLY.";
            
            // Sync down user state
            await syncDown();
            
            // Reinitialize DOM layout
            const appRoot = document.getElementById('app-root');
            appRoot.innerHTML = `
                <div class="sidebar-overlay" id="sidebar-overlay"></div>
                <div class="sidebar" id="sidebar"></div>
                <div class="main" id="main"></div>
            `;
            // Re-bind mobile sidebar overlay listener
            const newOverlay = document.getElementById('sidebar-overlay');
            if (newOverlay && appRoot) {
                newOverlay.addEventListener('click', () => {
                    appRoot.classList.remove('sidebar-open');
                });
            }
            bootApp();
        }
    } catch (err) {
        statusEl.className = "auth-status-msg error";
        statusEl.innerText = `ERROR: ${err.message.toUpperCase()}`;
    } finally {
        submitBtn.disabled = false;
    }
}

export function openDbConfigModal() {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'auth-modal-overlay';
    modalDiv.id = 'auth-config-modal';
    
    const curUrl = localStorage.getItem('supabase_url') || '';
    const curKey = localStorage.getItem('supabase_anon_key') || '';
    
    modalDiv.innerHTML = `
        <div class="auth-modal">
            <h3>DATABASE CONNECTION SETTINGS</h3>
            
            <div class="auth-input-group">
                <label>SUPABASE URL</label>
                <input type="text" id="cfg-url" class="auth-input" placeholder="HTTPS://XYZ.SUPABASE.CO" value="${curUrl}"/>
            </div>
            
            <div class="auth-input-group">
                <label>SUPABASE PUBLIC ANON KEY</label>
                <input type="text" id="cfg-key" class="auth-input" placeholder="API ANON KEY" value="${curKey}"/>
            </div>
            
            <div class="auth-modal-actions">
                <button class="auth-modal-btn" id="cfg-cancel-btn">CANCEL</button>
                <button class="auth-modal-btn primary" id="cfg-save-btn">SAVE CONFIG</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    
    document.getElementById('cfg-cancel-btn').addEventListener('click', () => {
        modalDiv.remove();
    });
    
    document.getElementById('cfg-save-btn').addEventListener('click', () => {
        const url = document.getElementById('cfg-url').value.trim();
        const key = document.getElementById('cfg-key').value.trim();
        
        if (url && key) {
            saveConfig(url, key);
            modalDiv.remove();
            window.location.reload();
        } else if (!url && !key) {
            localStorage.removeItem('supabase_url');
            localStorage.removeItem('supabase_anon_key');
            modalDiv.remove();
            window.location.reload();
        } else {
            alert("BOTH SUPABASE URL AND ANON KEY ARE REQUIRED.");
        }
    });
    // end openDbConfigModal implementation
}
let lastSettingsMainTab = 'tab-account';
let lastBootTab = 'dashboard';

export function openSettingsModal() {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.style.zIndex = '9999';
    modalDiv.innerHTML = `
        <div class="modal" style="width:500px; padding:0; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #161616; padding:16px 20px;">
                <h2 style="margin:0; font-family:'IBM Plex Mono', monospace; font-size:12px; letter-spacing:1px; color:#ddd;">GLOBAL SETTINGS</h2>
                <button class="icon-btn" id="close-settings-btn"><i class="ti ti-x"></i></button>
            </div>
            <div style="display:flex; flex:1; min-height:300px;">
                <!-- Tabs -->
                <div style="width:140px; border-right:1px solid #161616; display:flex; flex-direction:column; padding:12px 0;">
                    <button class="btn btn-ghost settings-tab ${lastSettingsMainTab==='tab-account'?'active':''}" data-tab="tab-account" style="justify-content:flex-start; border:none; border-radius:0; padding:10px 20px; font-family:'IBM Plex Mono', monospace; font-size:10px; background:${lastSettingsMainTab==='tab-account'?'#111':'transparent'}">ACCOUNT</button>
                    <button class="btn btn-ghost settings-tab ${lastSettingsMainTab==='tab-data'?'active':''}" data-tab="tab-data" style="justify-content:flex-start; border:none; border-radius:0; padding:10px 20px; font-family:'IBM Plex Mono', monospace; font-size:10px; background:${lastSettingsMainTab==='tab-data'?'#111':'transparent'}">DATA & BACKUP</button>
                    <button class="btn btn-ghost settings-tab ${lastSettingsMainTab==='tab-appearance'?'active':''}" data-tab="tab-appearance" style="justify-content:flex-start; border:none; border-radius:0; padding:10px 20px; font-family:'IBM Plex Mono', monospace; font-size:10px; background:${lastSettingsMainTab==='tab-appearance'?'#111':'transparent'}">APPEARANCE</button>
                    <button class="btn btn-ghost settings-tab ${lastSettingsMainTab==='tab-pref'?'active':''}" data-tab="tab-pref" style="justify-content:flex-start; border:none; border-radius:0; padding:10px 20px; font-family:'IBM Plex Mono', monospace; font-size:10px; background:${lastSettingsMainTab==='tab-pref'?'#111':'transparent'}">PREFERENCES</button>
                    <button class="btn btn-ghost settings-tab ${lastSettingsMainTab==='tab-boot'?'active':''}" data-tab="tab-boot" style="justify-content:flex-start; border:none; border-radius:0; padding:10px 20px; font-family:'IBM Plex Mono', monospace; font-size:10px; background:${lastSettingsMainTab==='tab-boot'?'#111':'transparent'}">BOOT ANIMATION</button>
                </div>
                <!-- Content -->
                <div style="flex:1; padding:20px; background:#0B0B0B; position:relative;">
                    
                    <div id="tab-account" class="settings-content" style="display:${lastSettingsMainTab==='tab-account'?'block':'none'};">
                        <div class="sec-label">Danger Zone</div>
                        <p style="font-size:11px; color:#666; margin-bottom:12px;">Deleting your account will permanently wipe all your data from the cloud. This cannot be undone.</p>
                        <button class="btn btn-danger" id="init-delete-btn" style="width:100%; font-family:'IBM Plex Mono', monospace; justify-content:center;">DELETE ACCOUNT</button>
                        
                        <div id="delete-confirm-zone" style="display:none; margin-top:16px; border:1px solid #c53d3d; padding:16px; background:rgba(197, 61, 61, 0.05);">
                            <p style="font-size:11px; color:#c53d3d; margin-bottom:8px;">Type <strong>DELETE</strong> below to confirm:</p>
                            <input type="text" id="delete-confirm-input" class="idea-input" style="width:100%; margin-bottom:12px; text-transform:uppercase;" autocomplete="off" />
                            <button class="btn btn-danger" id="final-delete-btn" disabled style="width:100%; justify-content:center;">PERMANENTLY DELETE</button>
                        </div>
                    </div>

                    <div id="tab-data" class="settings-content" style="display:none;">
                        <div class="sec-label">Backup & Restore</div>
                        <button class="btn btn-ghost" id="stgs-export-btn" style="width:100%; margin-bottom:12px; justify-content:center; font-family:'IBM Plex Mono', monospace;"><i class="ti ti-download"></i> EXPORT DATA (.JSON)</button>
                        <label class="btn btn-ghost" style="width:100%; justify-content:center; cursor:pointer; margin-bottom:24px; font-family:'IBM Plex Mono', monospace;"><i class="ti ti-upload"></i> IMPORT DATA<input type="file" id="stgs-import-btn" style="display:none;" accept=".json"></label>
                        
                        <div class="sec-label" style="color:#c53d3d;">Local Cache</div>
                        <p style="font-size:11px; color:#666; margin-bottom:12px;">Wipes the offline IndexedDB. (Will re-sync from cloud on next login).</p>
                        <button class="btn btn-ghost" id="stgs-wipe-btn" style="width:100%; color:#c53d3d; border-color:#522; justify-content:center; font-family:'IBM Plex Mono', monospace;">WIPE LOCAL CACHE</button>
                    </div>

                    <div id="tab-appearance" class="settings-content" style="display:${lastSettingsMainTab==='tab-appearance'?'block':'none'};">
                        <div class="sec-label" style="margin-top:24px;">Animations</div>
                        <label style="display:flex; align-items:center; gap:8px; font-size:11px; cursor:pointer;">
                            <input type="checkbox" id="reduce-motion-chk"> Reduce Motion (Disable GSAP)
                        </label>
                    </div>

                    <div id="tab-pref" class="settings-content" style="display:${lastSettingsMainTab==='tab-pref'?'block':'none'};">
                        <div class="sec-label" style="margin-top:24px;">Auto-Save Delay</div>
                        <select id="autosave-sel" class="idea-input" style="width:100%;">
                            <option value="1000">1 Second (Aggressive)</option>
                            <option value="2000">2 Seconds (Default)</option>
                            <option value="5000">5 Seconds (Relaxed)</option>
                        </select>
                    </div>

                    <div id="tab-boot" class="settings-content" style="display:${lastSettingsMainTab==='tab-boot'?'block':'none'};">
                        <div class="sec-label">Boot Sequence Config</div>
                        <div style="display:flex; border-bottom:1px solid #161616; margin-bottom:16px;">
                            <button class="btn btn-ghost boot-tab ${lastBootTab==='dashboard'?'active':''}" data-btab="dashboard" style="border-radius:0; padding:8px 8px; font-size:9px; color:${lastBootTab==='dashboard'?'#fff':'#888'};">DASHBOARD</button>
                            <button class="btn btn-ghost boot-tab ${lastBootTab==='overview'?'active':''}" data-btab="overview" style="border-radius:0; padding:8px 8px; font-size:9px; color:${lastBootTab==='overview'?'#fff':'#888'};">OVERVIEW</button>
                            <button class="btn btn-ghost boot-tab ${lastBootTab==='script'?'active':''}" data-btab="script" style="border-radius:0; padding:8px 8px; font-size:9px; color:${lastBootTab==='script'?'#fff':'#888'};">SCRIPT</button>
                            <button class="btn btn-ghost boot-tab ${lastBootTab==='board'?'active':''}" data-btab="board" style="border-radius:0; padding:8px 8px; font-size:9px; color:${lastBootTab==='board'?'#fff':'#888'};">BOARD</button>
                            <button class="btn btn-ghost boot-tab ${lastBootTab==='shots'?'active':''}" data-btab="shots" style="border-radius:0; padding:8px 8px; font-size:9px; color:${lastBootTab==='shots'?'#fff':'#888'};">SHOTS</button>
                        </div>
                        <div id="boot-settings-container" style="display:flex; flex-direction:column; gap:16px;">
                            <!-- populated dynamically -->
                        </div>
                    </div>

                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalDiv);

    document.getElementById('close-settings-btn').addEventListener('click', () => modalDiv.remove());
    modalDiv.addEventListener('mousedown', (e) => {
        if (e.target === modalDiv) {
            modalDiv.remove();
        }
    });

    const tabs = modalDiv.querySelectorAll('.settings-tab');
    const contents = modalDiv.querySelectorAll('.settings-content');
    tabs.forEach(t => {
        t.addEventListener('click', () => {
            tabs.forEach(btn => {
                btn.style.background = 'transparent';
                btn.classList.remove('active');
            });
            t.style.background = '#111';
            t.classList.add('active');
            contents.forEach(c => c.style.display = 'none');
            const target = document.getElementById(t.dataset.tab);
            if (target) target.style.display = 'block';
            lastSettingsMainTab = t.dataset.tab;
        });
    });

    import('./utils.js').then(({ getBootConfig }) => {
        const bootTabs = modalDiv.querySelectorAll('.boot-tab');
        const bootCont = document.getElementById('boot-settings-container');
        let currentBootTab = lastBootTab;
        
        const renderBootSettings = () => {
            if (!bootCont) return;
            const cfg = getBootConfig(currentBootTab);
            
            bootCont.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:11px; display:flex; justify-content:space-between; color:#aaa;">Offset (Y pixels) <span id="val-off" style="color:#fff;">${cfg.offset}</span></label>
                    <input type="range" id="boot-offset" min="0" max="200" step="5" value="${cfg.offset}" style="width:100%; accent-color:var(--accent-blue);" />
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:11px; display:flex; justify-content:space-between; color:#aaa;">Stagger (seconds) <span id="val-stag" style="color:#fff;">${cfg.stagger}</span></label>
                    <input type="range" id="boot-stagger" min="0" max="0.5" step="0.01" value="${cfg.stagger}" style="width:100%; accent-color:var(--accent-blue);" />
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:11px; display:flex; justify-content:space-between; color:#aaa;">Duration (seconds) <span id="val-dur" style="color:#fff;">${cfg.duration}</span></label>
                    <input type="range" id="boot-dur" min="0.1" max="2" step="0.1" value="${cfg.duration}" style="width:100%; accent-color:var(--accent-blue);" />
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <label style="font-size:11px; color:#aaa;">Easing Curve</label>
                    <select id="boot-ease" class="idea-input" style="width:100%; font-family:'IBM Plex Mono', monospace; font-size:11px; padding:6px; height:auto; color:#fff;">
                        <option value="back.out(1.2)" ${cfg.ease==='back.out(1.2)'?'selected':''}>Back Out</option>
                        <option value="power2.out" ${cfg.ease==='power2.out'?'selected':''}>Power2 Out</option>
                        <option value="power3.out" ${cfg.ease==='power3.out'?'selected':''}>Power3 Out</option>
                        <option value="elastic.out(1, 0.5)" ${cfg.ease==='elastic.out(1, 0.5)'?'selected':''}>Elastic Out</option>
                        <option value="bounce.out" ${cfg.ease==='bounce.out'?'selected':''}>Bounce Out</option>
                    </select>
                </div>
                <div style="display:flex; justify-content:flex-end; margin-top:8px;">
                    <button class="btn btn-ghost" id="boot-reset" style="font-size:10px;"><i class="ti ti-refresh"></i> RESET DEFAULTS</button>
                </div>
            `;
            
            const saveCfg = () => {
                const o = parseInt(document.getElementById('boot-offset').value);
                const s = parseFloat(document.getElementById('boot-stagger').value);
                const d = parseFloat(document.getElementById('boot-dur').value);
                const e = document.getElementById('boot-ease').value;
                document.getElementById('val-off').innerText = o;
                document.getElementById('val-stag').innerText = s;
                document.getElementById('val-dur').innerText = d;
                
                try {
                    const stored = JSON.parse(localStorage.getItem('studio_boot_settings') || '{}');
                    if (!stored[currentBootTab]) stored[currentBootTab] = {};
                    stored[currentBootTab] = { offset: o, stagger: s, duration: d, ease: e };
                    localStorage.setItem('studio_boot_settings', JSON.stringify(stored));
                } catch(err) {}
            };
            
            document.getElementById('boot-offset').addEventListener('input', saveCfg);
            document.getElementById('boot-stagger').addEventListener('input', saveCfg);
            document.getElementById('boot-dur').addEventListener('input', saveCfg);
            document.getElementById('boot-ease').addEventListener('change', saveCfg);
            
            document.getElementById('boot-reset').addEventListener('click', () => {
                try {
                    const stored = JSON.parse(localStorage.getItem('studio_boot_settings') || '{}');
                    delete stored[currentBootTab];
                    localStorage.setItem('studio_boot_settings', JSON.stringify(stored));
                } catch(err) {}
                renderBootSettings();
            });
        };
        
        bootTabs.forEach(t => t.addEventListener('click', () => {
            bootTabs.forEach(b => { b.style.color = '#888'; b.classList.remove('active'); });
            t.style.color = '#fff';
            t.classList.add('active');
            currentBootTab = t.dataset.btab;
            lastBootTab = currentBootTab;
            renderBootSettings();
        }));
        
        renderBootSettings();
    });

    const initDelBtn = document.getElementById('init-delete-btn');
    const confZone = document.getElementById('delete-confirm-zone');
    const confInput = document.getElementById('delete-confirm-input');
    const finalDelBtn = document.getElementById('final-delete-btn');

    if (initDelBtn) {
        initDelBtn.addEventListener('click', () => {
            initDelBtn.style.display = 'none';
            confZone.style.display = 'block';
        });
    }

    if (confInput) {
        confInput.addEventListener('input', () => {
            finalDelBtn.disabled = confInput.value !== 'DELETE';
        });
    }

    if (finalDelBtn) {
        finalDelBtn.addEventListener('click', async () => {
            finalDelBtn.innerHTML = `<i class="ti ti-loader" style="animation: spin 1s linear infinite;"></i> DELETING...`;
            import('./sync.js').then(async sync => {
                await sync.deleteUserAccount();
                modalDiv.remove();
                window.location.reload();
            });
        });
    }

    const exportBtn = document.getElementById('stgs-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const data = { projects: state.projects, ideas: state.ideas, archives: state.archives };
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `StudioPM_Backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    const importBtn = document.getElementById('stgs-import-btn');
    if (importBtn) {
        importBtn.addEventListener('change', e => {
            const f = e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = ev => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.projects) state.projects = data.projects;
                    if (data.ideas) state.ideas = data.ideas;
                    if (data.archives) state.archives = data.archives;
                    import('./db.js').then(db => db.saveAll());
                    renderSidebar();
                    import('./main.js').then(m => { m.nav('dashboard'); m.render(); modalDiv.remove(); });
                } catch(err) {
                    alert("Failed to parse JSON file.");
                }
            };
            r.readAsText(f);
            e.target.value = '';
        });
    }

    const wipeBtn = document.getElementById('stgs-wipe-btn');
    if (wipeBtn) {
        wipeBtn.addEventListener('click', () => {
            if (confirm("Are you sure you want to wipe the local cache?")) {
                const req = indexedDB.deleteDatabase('StudioPM');
                req.onsuccess = () => window.location.reload();
            }
        });
    }
    
    // ─── Toggles & Prefs ───
    const motionChk = document.getElementById('reduce-motion-chk');
    motionChk.checked = localStorage.getItem('studio_reduce_motion') === 'true';
    motionChk.addEventListener('change', e => {
        localStorage.setItem('studio_reduce_motion', e.target.checked);
        if (e.target.checked) window._reduceMotion = true;
        else window._reduceMotion = false;
        
        document.body.classList.toggle('reduce-motion', e.target.checked);
    });
    
    const autosaveSel = document.getElementById('autosave-sel');
    autosaveSel.value = localStorage.getItem('studio_autosave_delay') || '2000';
    autosaveSel.addEventListener('change', e => {
        localStorage.setItem('studio_autosave_delay', e.target.value);
        window._autoSaveDelay = parseInt(e.target.value);
    });
}
