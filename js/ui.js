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

    sb.innerHTML = `
    <div class="sb-logo-wrap"><div class="sb-logo">S</div></div>
    
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
             <button class="icon-btn" id="db-export-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Backup Data"><i class="ti ti-download" style="font-size:12px;"></i> EXPORT</button>
             <label class="icon-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace; cursor:pointer;" title="Restore Data"><i class="ti ti-upload" style="font-size:12px;"></i> IMPORT<input type="file" id="db-import-btn" style="display:none;" accept=".json"></label>
          </div>
          <div style="display:flex; gap:8px;">
             <button class="icon-btn" id="db-config-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Database Settings"><i class="ti ti-settings" style="font-size:12px;"></i> DB CONFIG</button>
             ${isConfigured() ? '<button class="icon-btn" id="sb-signout-btn" style="font-size:9px; color:#c53d3d; gap:4px; text-transform:uppercase; font-family:\'IBM Plex Mono\', monospace;" title="Sign Out"><i class="ti ti-logout" style="font-size:12px;"></i> OUT</button>' : ''}
          </div>
       </div>
       <div id="sb-clock" style="color:#333;">${formatDateTime(new Date().toISOString())}</div>
    </div>
  `;

    sb.querySelector('#sb-home').addEventListener('click', () => nav('dashboard'));
    sb.querySelector('#sb-allideas').addEventListener('click', () => nav('all-ideas'));
    sb.querySelector('#sb-trash').addEventListener('click', () => nav('trash'));

    sb.querySelector('#db-export-btn').addEventListener('click', () => {
        const data = { projects: state.projects, ideas: state.ideas, archives: state.archives };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `StudioPM_Backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    sb.querySelector('#db-import-btn').addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.projects) state.projects = data.projects;
                if (data.ideas) state.ideas = data.ideas;
                if (data.archives) state.archives = data.archives;
                saveAll();
                renderSidebar();
                import('./main.js').then(m => { m.nav('dashboard'); m.render(); });
            } catch(err) {
                openConfirmModal("Error", "Failed to parse JSON file.", "OK", () => {});
            }
        };
        r.readAsText(f);
        e.target.value = '';
    });

    sb.querySelector('#db-config-btn').addEventListener('click', () => {
        openDbConfigModal();
    });

    if (isConfigured()) {
        const signOutBtn = sb.querySelector('#sb-signout-btn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                await signOut();
                window.location.reload();
            });
        }
    }

    sb.querySelectorAll('.sb-proj-header').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.closest('.pin-btn')) return;
            const pid = el.dataset.togglePid;

            if (pid === state.S.projectId && state.S.view !== 'dashboard' && state.S.view !== 'all-ideas' && state.S.view !== 'trash') return;

            const isExpanded = state.expandedProjectsState.includes(pid);
            const navEl = el.nextElementSibling;

            if (isExpanded && navEl && navEl.classList.contains('sb-proj-nav')) {
                if (typeof gsap !== 'undefined') gsap.to(navEl, {
                    height: 0, opacity: 0, duration: 0.35, ease: "power2.inOut",
                    onComplete: () => {
                        state.expandedProjectsState = state.expandedProjectsState.filter(id => id !== pid);
                        renderSidebar();
                    }
                });
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

    if (window._gsapTargetId && typeof gsap !== 'undefined') {
        const openedHeader = sb.querySelector(`.sb-proj-header[data-toggle-pid="${window._gsapTargetId}"]`);
        if (openedHeader && openedHeader.nextElementSibling) {
            gsap.from(openedHeader.nextElementSibling, { height: 0, opacity: 0, duration: 0.4, ease: "back.out(1.5)" });
            gsap.from(openedHeader.nextElementSibling.querySelectorAll('.sb-item'), { x: -15, opacity: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" });
        }
        window._gsapTargetId = null;
    }

    const activeNav = sb.querySelector('.sb-proj-nav-item.active');
    const indicator = sb.querySelector('.nav-indicator');

    if (activeNav && indicator && typeof gsap !== 'undefined') {
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

    if (topActiveNav && topBgHighlight && typeof gsap !== 'undefined') {
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

    if (typeof gsap !== 'undefined' && !window._appHasBooted) {
        const cards = m.querySelectorAll('.project-card, .new-card');
        const topbarBtn = m.querySelector('#btn-new-proj');
        const dashTitle = m.querySelector('.welcome h1');
        const dashSub = m.querySelector('.welcome p');
        const headers = m.querySelectorAll('.dash-section-header');
        const ideas = m.querySelectorAll('.idea-input-row, .dash-idea-row');
        const sidebarItems = document.querySelectorAll('.sidebar .sb-logo-wrap, .sidebar .sb-label, .sidebar .sb-item, .sidebar .sb-proj-header, .sidebar .sb-footer');

        // Hide all elements FIRST (synchronous, immediate) —
        // these styles are committed before the app root is revealed
        gsap.set(cards, { opacity: 0, y: 50 });
        gsap.set(topbarBtn, { opacity: 0, y: -20 });
        gsap.set([dashTitle, dashSub], { clipPath: "polygon(0% -50%, 0% -50%, 0% 150%, 0% 150%)" });
        gsap.set(headers, { opacity: 0, y: 10 });
        gsap.set(ideas, { opacity: 0, y: 50 });
        gsap.set(sidebarItems, { opacity: 0, y: 40 });

        // Build the timeline PAUSED — bootApp will play() it after the first
        // browser paint with the hidden elements, eliminating any flash
        const tl = gsap.timeline({ paused: true });
        tl.to(cards, { y: 0, opacity: 1, duration: 0.5, stagger: 0.2, ease: "back.out(1.2)" }, 0);
        tl.to(dashTitle, { clipPath: "polygon(0% -50%, 110% -50%, 110% 150%, 0% 150%)", duration: 0.8, ease: "back.out(1.2)" }, 0.1)
            .to(dashSub, { clipPath: "polygon(0% -50%, 110% -50%, 110% 150%, 0% 150%)", duration: 0.8, ease: "back.out(1.2)" }, 0.2);
        tl.to(sidebarItems, { y: 0, opacity: 1, duration: 0.5, stagger: 0.03, ease: "back.out(1.2)" }, 0.15);
        tl.to(topbarBtn, { y: 0, opacity: 1, duration: 0.5, ease: "back.out(1.2)" }, 0.2);
        tl.to(headers, { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.2)" }, 0.5)
            .to(ideas, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: "back.out(1.2)" }, 0.2);

        window._pendingBootTL = tl;
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
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div class="project-title" style="margin-bottom:0; font-size:11px; font-weight:600; color:#DDDDDE; font-family: 'IBM Plex Mono', monospace;">${p.title || 'UNTITLED'}</div>
          <button class="icon-btn del-proj-btn" data-pid="${p.id}" style="padding:0; margin-top:-2px; color:#555;"><i class="ti ti-trash"></i></button>
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
        if (typeof gsap !== 'undefined') {
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
            statusEl.innerText = "REGISTRATION SUCCESSFUL. CHECK YOUR EMAIL FOR CONFIRMATION.";
        } else {
            await signIn(email, password);
            statusEl.className = "auth-status-msg success";
            statusEl.innerText = "AUTHENTICATED successfully.";
            
            // Sync down user state
            await syncDown();
            
            // Reinitialize DOM layout
            const appRoot = document.getElementById('app-root');
            appRoot.innerHTML = `
                <div class="sidebar" id="sidebar"></div>
                <div class="main" id="main"></div>
            `;
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
}
