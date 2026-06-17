// ─── UTILS & COMPRESSOR ─────────────────────────────────────
function compressImage(file, callback) {
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

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatDateTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const pad = n => n < 10 ? '0' + n : n;
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} • ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ─── INDEXEDDB ASYNC STORAGE ENGINE ─────────────────────────
const DB_NAME = 'StudioPM_DB';
const DB_VERSION = 1;
let db = null;

let projects = [];
let ideas = [];
let expandedProjectsState = [];

const SHOT_COLORS = ['#5588ff', '#ff5588', '#55ff88', '#f5a623', '#9b51e0', '#00bfa5', '#00bcd4'];
const BLOCK_PALETTE = ['#5588ff', '#ff5588', '#55ff88', '#f5a623', '#9b51e0', '#00bfa5', '#00bcd4'];
const CHECKLIST_3D = ['Storyboard', 'Blocked', 'Animation', 'Secondary Animation', 'Sound', 'Post Production', 'Export'];
const CHECKLIST_2D = ['Storyboard', 'Rough Animation', 'Tie Down', 'Cleanup', 'Color', 'Compositing', 'Export'];

function makeChecklist(type) {
    return (type === '3D' ? CHECKLIST_3D : CHECKLIST_2D).map(l => ({ id: uid(), text: l, done: false }));
}

function initDB(callback) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('state')) {
            database.createObjectStore('state');
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        migrateOldStorage(callback);
    };
    request.onerror = (e) => {
        console.error('Database initialization failed. Check browser privacy settings.', e);
    };
}

function migrateOldStorage(callback) {
    const tx = db.transaction(['state'], 'readwrite');
    const store = tx.objectStore('state');

    const reqProjects = store.get('projects');
    reqProjects.onsuccess = () => {
        if (!reqProjects.result) {
            try {
                const oldP = localStorage.getItem('cpm_projects');
                const oldI = localStorage.getItem('cpm_ideas');
                const writeTx = db.transaction(['state'], 'readwrite');
                const writeStore = writeTx.objectStore('state');
                if (oldP) writeStore.put(JSON.parse(oldP), 'projects');
                if (oldI) writeStore.put(JSON.parse(oldI), 'ideas');
            } catch (err) { }
        }
        loadMasterData(callback);
    };
}

function loadMasterData(callback) {
    const tx = db.transaction(['state'], 'readonly');
    const store = tx.objectStore('state');
    const reqP = store.get('projects');
    const reqI = store.get('ideas');

    let loadedP = [], loadedI = [];
    reqP.onsuccess = () => { if (reqP.result) loadedP = reqP.result; };
    reqI.onsuccess = () => { if (reqI.result) loadedI = reqI.result; };

    tx.oncomplete = () => {
        projects = loadedP;
        ideas = loadedI;
        sanitizeRecords();
        callback();
    };
}

function sanitizeRecords() {
    if (!Array.isArray(projects)) projects = [];
    if (!Array.isArray(ideas)) ideas = [];

    projects.forEach(p => {
        if (p.pinned === undefined) p.pinned = false;
        if (!p.shots) p.shots = [];
        if (typeof p.visualScript === 'string') {
            p.visualScriptBlocks = p.visualScript.trim() ? [{ id: uid(), text: p.visualScript, shotId: null }] : [];
            delete p.visualScript;
        }
        if (!p.visualScriptBlocks) p.visualScriptBlocks = [];

        p.visualScriptBlocks.forEach((b, i) => {
            if (!b.color) {
                let prev = i > 0 ? p.visualScriptBlocks[i - 1].color : null;
                let opts = BLOCK_PALETTE.filter(c => c !== prev);
                b.color = opts[Math.floor(Math.random() * opts.length)];
            }
        });

        p.shots.forEach((s, i) => {
            if (typeof s.number !== 'number' || isNaN(s.number)) s.number = i + 1;
            if (!s.title || s.title.includes('undefined') || s.title.includes('NaN')) s.title = `Shot ${s.number}`;
            if (!s.tasks) s.tasks = s.checklist ? s.checklist.map(c => ({ text: c.label, done: c.checked })) : makeChecklist(s.type);
            if (s.lessons === undefined) { s.lessons = ''; delete s.assets; }
        });
    });
    saveAll();
}

function saveAll() {
    if (!db) return;
    const tx = db.transaction(['state'], 'readwrite');
    const store = tx.objectStore('state');
    store.put(projects, 'projects');
    store.put(ideas, 'ideas');
}

// ─── STATE & HISTORY ─────────────────────────────────────────
let S = { view: 'dashboard', projectId: null, shotId: null, tab: 'overview', canvasTool: 'select', vsSidebarOpen: true };
let viewHistory = [];

document.addEventListener('mouseup', e => {
    if (e.button === 3) {
        if (viewHistory.length > 0) {
            S = JSON.parse(viewHistory.pop());
            render();
        } else {
            if (S.view === 'shot') { nav('project', S.projectId, { tab: 'shots' }); }
            else if (S.view === 'project') { nav('dashboard'); }
        }
    }
});

// ─── GLOBAL PASTE LISTENER (CANVAS) ──────────────────────────
document.addEventListener('paste', e => {
    if (S.view !== 'project' || S.tab !== 'board') return;
    if (['TEXTAREA', 'INPUT'].includes(e.target.tagName)) return;

    const bd = getProj()?.projectBoardData;
    if (!bd) return;

    const rect = document.getElementById('canvas-surface').getBoundingClientRect();
    const cx = (-S.boardPan.x + rect.width / 2) / S.boardZoom;
    const cy = (-S.boardPan.y + rect.height / 2) / S.boardZoom;

    const items = e.clipboardData.items;
    let imageFound = false;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            imageFound = true;
            const file = items[i].getAsFile();
            compressImage(file, (res) => {
                if (typeof boardPushHistory === 'function') boardPushHistory();
                bd.elements.push({ id: uid(), type: 'image', x: cx - 110, y: cy - 75, w: 220, h: 150, src: res, rot: 0 });
                saveAll();
                renderBoard(document.getElementById('main'));
            });
            break;
        }
    }

    if (!imageFound) {
        const text = e.clipboardData.getData('text/plain');
        if (text && text.trim()) {
            if (typeof boardPushHistory === 'function') boardPushHistory();
            bd.elements.push({ id: uid(), type: 'text', x: cx - 100, y: cy - 30, w: 200, h: 60, content: text.trim(), fontSize: 14, rot: 0 });
            saveAll();
            renderBoard(document.getElementById('main'));
        }
    }
});

// ─── COMPUTED ────────────────────────────────────────────────
function shotProg(s) {
    if (!s.tasks || s.tasks.length === 0) return 0;
    const done = s.tasks.filter(t => t.done).length;
    const prog = Math.round((done / s.tasks.length) * 100);
    s.progress = prog; // Cache it so the dashboard stays perfectly synced
    return prog;
}

function shotStatus(p) { return p === 100 ? 'Complete' : p > 0 ? 'WIP' : 'Not Started'; }
function projProg(proj) { if (!proj.shots || !proj.shots.length) return 0; return Math.round(proj.shots.reduce((s, sh) => s + shotProg(sh), 0) / proj.shots.length); }

function shotCounts(proj) {
    const r = { complete: 0, wip: 0, ns: 0 };
    (proj.shots || []).forEach(s => {
        const p = shotProg(s);
        if (p === 100) r.complete++;
        else if (p > 0) r.wip++;
        else r.ns++;
    });
    return r;
}

function getProj() { return projects.find(p => p.id === S.projectId); }
function getShot() { const pr = getProj(); return pr ? pr.shots.find(s => s.id === S.shotId) : null; }
function statusClass(p) { return p === 100 ? 'complete' : p > 0 ? 'wip' : 'ns'; }

setInterval(() => {
    const clk = document.getElementById('sb-clock');
    if (clk) clk.textContent = formatDateTime(new Date().toISOString());
}, 1000);

// ─── RENDER ROUTER ───────────────────────────────────────────
function nav(view, projectId, extra) {
    const stateStr = JSON.stringify(S);
    if (viewHistory.length === 0 || viewHistory[viewHistory.length - 1] !== stateStr) {
        viewHistory.push(stateStr);
        if (viewHistory.length > 50) viewHistory.shift();
    }

    const safeView = (view || 'dashboard').toLowerCase();
    const safeTab = (extra && extra.tab) ? extra.tab.toLowerCase() : (S.tab || 'overview');

    S = { ...S, view: safeView, projectId: projectId || S.projectId, ...extra, tab: safeTab };
    render();
}

function render() {
    renderSidebar();
    const m = document.getElementById('main');
    m.className = 'main';

    if (S.view === 'dashboard') {
        m.className = 'main dashboard-bg';
        renderDashboard(m);
    }
    else if (S.view === 'all-ideas') {
        renderAllIdeas(m);
    }
    else if (S.view === 'project') {
        if (S.tab === 'overview') {
            m.className = 'main dashboard-bg';
            renderOverview(m);
        }
        else if (S.tab === 'script') {
            m.className = 'main dashboard-bg';
            renderScript(m);
        }
        else if (S.tab === 'board') {
            m.className = 'main dashboard-bg';
            renderBoard(m);
        }
        else if (S.tab === 'shots') renderShots(m);
    }
    else if (S.view === 'shot') { renderShotDetail(m); }
}

// ─── NEW SIDEBAR (HUD STYLE WITH GSAP) ───────────────────────
function renderSidebar(){
  const sb=document.getElementById('sidebar');
  let projHTML = '';
  
  let sorted = [...projects].sort((a,b) => {
     if(a.id === S.projectId) return -1;
     if(b.id === S.projectId) return 1;
     if(a.pinned && !b.pinned) return -1;
     if(!a.pinned && b.pinned) return 1;
     return 0;
  });

  sorted.forEach(p => {
     const isCurrent = p.id === S.projectId && S.view !== 'dashboard' && S.view !== 'all-ideas';
     const isExpanded = isCurrent || expandedProjectsState.includes(p.id);
     const pinColor = p.pinned ? '#DDDDDE' : '#444';
     
     projHTML += `
       <div class="sb-proj-header ${isCurrent ? 'active' : ''}" data-toggle-pid="${p.id}">
         <div style="display:flex; align-items:center; gap:8px;">
           ${isCurrent ? '<div style="width:12px; height:12px; flex-shrink:0;"></div>' : `<i class="ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'}" style="font-size:12px; color:#555;"></i>`}
           <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;">${p.title||'UNTITLED'}</span>
         </div>
         <button class="icon-btn pin-btn" data-pin-id="${p.id}" style="padding:2px; color:${pinColor};"><i class="ti ti-pin"></i></button>
       </div>
     `;
     
     if(isExpanded) {
       projHTML += `<div class="sb-proj-nav" style="position:relative;">
         ${isCurrent ? '<div class="nav-indicator"></div>' : ''}
         ${[['overview','ti-home','OVERVIEW'],['script','ti-writing','VISUAL SCRIPT'],['board','ti-layout-board','PROJECT BOARD'],['shots','ti-camera','SHOTS']].map(([t,ic,lb])=>`<div class="sb-item sb-proj-nav-item ${S.tab===t.toLowerCase()&&isCurrent?'active':''}" data-pid="${p.id}" data-tab="${t.toLowerCase()}"><i class="ti ${ic}"></i><span>${lb}</span></div>`).join('')}
       </div>`;
     }
  });

  sb.innerHTML = `
    <div class="sb-logo-wrap"><div class="sb-logo">S</div></div>
    
    <div class="sb-section" style="position:relative;">
      <div class="sb-label">WORKSPACE</div>
      ${(S.view === 'dashboard' || S.view === 'all-ideas') ? '<div class="workspace-bg-highlight"></div>' : ''}
      <div class="sb-item ${S.view==='dashboard'?'active':''}" id="sb-home"><i class="ti ti-home"></i>HOME</div>
      <div class="sb-item ${S.view==='all-ideas'?'active':''}" id="sb-allideas"><i class="ti ti-bulb"></i>ALL IDEAS</div>
    </div>
    
    <div class="sb-section" style="margin-top:24px;">
      <div class="sb-label">PROJECTS</div>
      ${projHTML}
    </div>
    
    <div class="sb-footer" style="display:flex; flex-direction:column; gap:12px;">
       <div style="display:flex; gap:8px; border-bottom:1px solid #161616; padding-bottom:12px;">
          <button class="icon-btn" id="db-export-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Backup Data"><i class="ti ti-download" style="font-size:12px;"></i> EXPORT</button>
          <button class="icon-btn" id="db-import-btn" style="font-size:9px; color:#555; gap:4px; text-transform:uppercase; font-family:'IBM Plex Mono', monospace;" title="Restore Data"><i class="ti ti-upload" style="font-size:12px;"></i> IMPORT</button>
       </div>
       <div id="sb-clock" style="color:#333;">${formatDateTime(new Date().toISOString())}</div>
    </div>
  `;

  sb.querySelector('#sb-home').addEventListener('click',()=>nav('dashboard'));
  sb.querySelector('#sb-allideas').addEventListener('click',()=>nav('all-ideas'));
  
  sb.querySelectorAll('.sb-proj-header').forEach(el=>{
    el.addEventListener('click', (e) => {
       if(e.target.closest('.pin-btn')) return; 
       const pid = el.dataset.togglePid;
       
       // Lock the active project folder
       if (pid === S.projectId && S.view !== 'dashboard' && S.view !== 'all-ideas') return;
       
       const isExpanded = expandedProjectsState.includes(pid);
       const navEl = el.nextElementSibling; 
       
       if(isExpanded && navEl && navEl.classList.contains('sb-proj-nav')) {
          gsap.to(navEl, {
              height: 0, opacity: 0, duration: 0.35, ease: "power2.inOut",
              onComplete: () => {
                  expandedProjectsState = expandedProjectsState.filter(id => id !== pid);
                  renderSidebar();
              }
          });
       } else if (!isExpanded) {
          expandedProjectsState.push(pid);
          window._gsapTargetId = pid; 
          renderSidebar(); 
       }
    });
  });
  
  sb.querySelectorAll('.sb-proj-nav-item').forEach(el=>{
    el.addEventListener('click', (e) => {
       e.stopPropagation();
       nav('project', el.dataset.pid, {tab: el.dataset.tab});
    });
  });
  
  sb.querySelectorAll('.pin-btn').forEach(btn => {
     btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = projects.find(x => x.id === btn.dataset.pinId);
        if(p) { p.pinned = !p.pinned; saveAll(); renderSidebar(); }
     });
  });

  if (window._gsapTargetId) {
      const openedHeader = sb.querySelector(`.sb-proj-header[data-toggle-pid="${window._gsapTargetId}"]`);
      if (openedHeader && openedHeader.nextElementSibling) {
          gsap.from(openedHeader.nextElementSibling, { height: 0, opacity: 0, duration: 0.4, ease: "back.out(1.5)" });
          gsap.from(openedHeader.nextElementSibling.querySelectorAll('.sb-item'), { x: -15, opacity: 0, duration: 0.3, stagger: 0.05, ease: "power2.out" });
      }
      window._gsapTargetId = null; 
  }

  // --- GSAP SLIDING INDICATOR (PROJECT FOLDERS) ---
  const activeNav = sb.querySelector('.sb-proj-nav-item.active');
  const indicator = sb.querySelector('.nav-indicator');

  if (activeNav && indicator) {
      const targetY = activeNav.offsetTop; 
      if (window._lastNavY === undefined || window._lastNavPid !== S.projectId) {
          gsap.set(indicator, { y: targetY });
      } else {
          gsap.fromTo(indicator, { y: window._lastNavY }, { y: targetY, duration: 0.35, ease: "back.out(1.2)" });
      }
      window._lastNavY = targetY;
      window._lastNavPid = S.projectId;
  }

  // --- GSAP SLIDING BACKGROUND (TOP WORKSPACE) ---
  const topActiveNav = sb.querySelector('#sb-home.active, #sb-allideas.active');
  const topBgHighlight = sb.querySelector('.workspace-bg-highlight');

  if (topActiveNav && topBgHighlight) {
      const targetY = topActiveNav.offsetTop; 
      
      gsap.set(topBgHighlight, { 
          width: topActiveNav.offsetWidth, 
          height: topActiveNav.offsetHeight, 
          left: topActiveNav.offsetLeft 
      });
      
      if (window._lastTopBgY === undefined) {
          gsap.set(topBgHighlight, { y: targetY });
      } else {
          gsap.fromTo(topBgHighlight, 
              { y: window._lastTopBgY }, 
              { y: targetY, duration: 0.35, ease: "back.out(1.2)" } 
          );
      }
      window._lastTopBgY = targetY;
  } else {
      window._lastTopBgY = undefined; 
  }
}

// ─── DASHBOARD ───────────────────────────────────────────────
function renderDashboard(m) {
    const activeCount = projects.length < 10 ? '0' + projects.length : projects.length;
    m.innerHTML = `<div class="dashboard-revamp">
    <div class="hud-tl hud-corner"></div><div class="hud-tr hud-corner"></div><div class="hud-bl hud-corner"></div><div class="hud-br hud-corner"></div>

    <div class="page-topbar">
      <div class="welcome">
        <h1>WELCOME BACK.</h1>
        <p>PICK UP WHERE YOU LEFT OFF OR START SOMETHING NEW.</p>
      </div>
      <button class="btn btn-primary" id="btn-new-proj"><i class="ti ti-plus" style="font-size:12px;"></i> NEW PROJECT</button>
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
}

function renderProjGrid() {
    const g = document.getElementById('proj-grid'); if (!g) return;
    g.innerHTML = '';
    projects.forEach(p => {
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
                if (val === p.title) { projects = projects.filter(x => x.id !== p.id); saveAll(); renderDashboard(document.getElementById('main')); renderSidebar(); }
                else { alert("Name didn't match."); }
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
    const unassigned = ideas.filter(i => !i.projectId).slice(0, 5);
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
      <div style="width:6px; height:6px; background:#f5a623; border-radius:1px; margin-right:16px; flex-shrink:0;"></div>
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
            ideas = ideas.filter(i => i.id !== b.dataset.id); saveAll(); renderIdeasList();
        });
    }));
    list.querySelectorAll('.edit-idea').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const idea = ideas.find(i => i.id === btn.dataset.id);
        openPromptModal("Edit Idea", "Update your idea text.", "Idea", idea.text || idea.title, (newText) => {
            if (newText && newText.trim()) { idea.text = newText.trim(); idea.title = newText.trim(); saveAll(); renderIdeasList(); }
        });
    }));
    list.querySelectorAll('.assign-idea').forEach(btn => btn.addEventListener('click', e => {
        e.stopPropagation();
        const idea = ideas.find(i => i.id === btn.dataset.id);
        openAssignModal(idea.text || idea.title, idea.id);
    }));
}

function handleIdeaSend() {
    const inp = document.getElementById('idea-inp'); const text = inp ? inp.value.trim() : '';
    if (!text) return; inp.value = ''; openAssignModal(text);
}

// ─── ALL IDEAS VIEW ──────────────────────────────────────────
function renderAllIdeas(m) {
    let allIdeas = typeof ideas !== 'undefined' ? ideas : [];

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
                <div class="ai-title">${idObj.title || idObj.text || ''}</div>
                <div class="ai-date">${dateStr}</div>
                <div class="ai-actions">
                    <button class="ai-btn edit" title="Edit"><i class="ti ti-pencil"></i></button>
                    <button class="ai-btn move" title="Assign to Project"><i class="ti ti-folder"></i></button>
                    <button class="ai-btn del" title="Delete"><i class="ti ti-trash"></i></button>
                </div>
            `;

            row.querySelector('.edit').addEventListener('click', () => {
                const newT = prompt('Edit idea:', idObj.title || idObj.text);
                if (newT) { idObj.title = newT; idObj.text = newT; saveAll(); renderList(); }
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

// ─── OVERVIEW ────────────────────────────────────────────────
function renderOverview(m) {
    const proj = getProj(); if (!proj) return;

    const isEmpty = proj.shots.length === 0;
    const pg = projProg(proj), counts = shotCounts(proj), total = proj.shots.length;

    const R = 38, cx = 50, cy = 50, circ = 2 * Math.PI * R;
    const compD = total ? (counts.complete / total) * circ : 0, wipD = total ? (counts.wip / total) * circ : 0, nsD = total ? (counts.ns / total) * circ : 0;

    let contentHTML = `
    <div class="ov-header">
       <div class="ov-title-row">
         <span class="ov-title" id="ov-title-text">${proj.title || 'UNTITLED'}</span>
         <button class="icon-btn" id="ov-edit-btn" title="Edit brief" style="padding:2px;"><i class="ti ti-pencil"></i></button>
       </div>
       <div class="ov-subtitle">${proj.description || 'A documentary project'}</div>
    </div>
    
    <div class="ov-prog-container">
      <span class="ov-prog-label">PROJECT PROGRESS</span>
      <div class="ov-prog-bar-wrap">
        <div class="ov-prog-fill" style="width:${pg}%;"></div>
      </div>
      <span class="ov-prog-pct">${pg}%</span>
      <span class="ov-prog-count">${counts.complete} / ${total} shots</span>
    </div>

    <div class="ov-grid">
      <div class="ov-card">
        <div class="ov-card-title">PROJECT SUMMARY</div>
        <div class="sum-row"><span class="sum-key">Genre</span><span class="sum-val">${proj.genre || '—'}</span></div>
        <div class="sum-row"><span class="sum-key">Format</span><span class="sum-val">${proj.format || '—'}</span></div>
        <div class="sum-row"><span class="sum-key">Duration</span><span class="sum-val">${proj.duration || '—'}</span></div>
        <div class="sum-row"><span class="sum-key">Status</span><span class="sum-val">${proj.status}</span></div>
        <div class="sum-row" style="border-bottom:none;"><span class="sum-key">Created</span><span class="sum-val">${fmtDate(proj.createdAt)}</span></div>
        <button class="card-bottom-btn" id="edit-brief-btn"><i class="ti ti-pencil"></i> EDIT BRIEF</button>
      </div>
      
      <div class="ov-card">
        <div class="ov-card-title">PRODUCTION OVERVIEW</div>
        <div class="donut-wrap">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#222" stroke-width="12"/>
            ${total > 0 ? `
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#5aaa80" stroke-width="12" stroke-dasharray="${compD} ${circ}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})"/>
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#4285f4" stroke-width="12" stroke-dasharray="${wipD} ${circ}" stroke-dashoffset="${-compD}" transform="rotate(-90 ${cx} ${cy})"/>
            <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#333" stroke-width="12" stroke-dasharray="${nsD} ${circ}" stroke-dashoffset="${-(compD + wipD)}" transform="rotate(-90 ${cx} ${cy})"/>` : ''}
            <text x="${cx}" y="${cy - 2}" text-anchor="middle" dominant-baseline="middle" fill="#DDDDDE" font-size="24" font-weight="500">${total}</text>
            <text x="${cx}" y="${cy + 14}" text-anchor="middle" dominant-baseline="middle" fill="#555" font-size="8">shots</text>
          </svg>
          <div class="donut-legend">
            <div class="legend-row"><div class="legend-dot" style="background:#5aaa80"></div><span class="legend-count">${counts.complete}</span><span class="legend-lbl">Complete</span></div>
            <div class="legend-row"><div class="legend-dot" style="background:#4285f4"></div><span class="legend-count">${counts.wip}</span><span class="legend-lbl">WIP</span></div>
            <div class="legend-row"><div class="legend-dot" style="background:#333"></div><span class="legend-count">${counts.ns}</span><span class="legend-lbl">Not started</span></div>
          </div>
        </div>
      </div>
      
      <div class="ov-card">
        <div class="ov-card-title">SHOT OVERVIEW</div>
        <div class="shot-ov-list">
          ${proj.shots.length ? proj.shots.map(s => {
        const sp = shotProg(s), ss = shotStatus(sp), sc = statusClass(sp);
        return `<div class="shot-ov-row" data-sid="${s.id}" title="Jump to Shot">
              <div class="shot-thumb-sm">${s.heroImage ? `<img src="${s.heroImage}" alt="" draggable="false">` : `<i class="ti ti-photo" style="font-size:12px;color:#2e2e2e;"></i>`}</div>
              <span class="shot-ov-title">${s.title || ('Shot ' + s.number)}</span>
              <span class="status-badge ${sc}">${ss.toUpperCase()}</span>
              <div class="mini-bar-wrap"><div class="mini-bar-fill" style="width:${sp}%"></div></div>
              <span class="shot-pct">${sp}%</span>
            </div>`;
    }).join('') : `<div style="font-size:10px; color:#555;">No shots created yet.</div>`}
        </div>
      </div>
      
      <div class="ov-card">
        <div class="ov-card-title">IDEAS</div>
        <div class="ideas-card-list">
          ${(proj.ideas || []).filter(i => !i.shotId).length ? (proj.ideas || []).filter(i => !i.shotId).map(i => `
            <div class="idea-item">
              <i class="ti ti-bulb" style="color:#cda04d; font-size:12px;"></i>
              <span class="idea-card-text">${i.text || i.title}</span>
              <div class="idea-actions">
                <button class="icon-btn assign-to-shot-btn" data-iid="${i.id}" title="Assign to specific shot"><i class="ti ti-target"></i></button>
                <button class="icon-btn edit-proj-idea-btn" data-iid="${i.id}"><i class="ti ti-pencil"></i></button>
                <button class="icon-btn del-proj-idea-btn del" data-iid="${i.id}"><i class="ti ti-trash"></i></button>
              </div>
            </div>
          `).join('') : `<div style="font-size:10px; color:#555;">No ideas assigned to project.</div>`}
        </div>
        <button class="card-bottom-btn" id="ov-add-idea-btn"><i class="ti ti-plus"></i> ADD IDEA</button>
      </div>
    </div>
  `;

    if (isEmpty) {
        m.innerHTML = `<div class="overview-revamp" style="position:relative;">
        <div style="filter:blur(8px); opacity:0.3; pointer-events:none;">${contentHTML}</div>
        <div style="position:absolute; top:30%; left:50%; transform:translate(-50%, -50%); text-align:center; background:#0B0B0B; padding:32px; border:1px solid #333; z-index:10; min-width: 400px; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
           <i class="ti ti-rocket" style="font-size:32px; color:#DDDDDE; margin-bottom:16px;"></i>
           <h2 style="font-size:14px; margin-bottom:8px; font-weight:500; color:#DDDDDE;">PROJECT INITIALIZED.</h2>
           <p style="font-size:10px; color:#888; margin-bottom:24px;">YOUR OVERVIEW IS EMPTY. AWAITING FIRST DIRECTIVE.</p>
           <div style="display:flex; gap:12px; justify-content:center;">
               <button class="btn btn-primary" id="emp-script"><i class="ti ti-writing"></i>DRAFT SCRIPT</button>
               <button class="btn btn-ghost" id="emp-board"><i class="ti ti-layout-board"></i>OPEN BOARD</button>
               <button class="btn btn-ghost" id="emp-shot"><i class="ti ti-camera"></i>ADD SHOT</button>
           </div>
        </div>
     </div>`;
        document.getElementById('emp-script').addEventListener('click', () => nav('project', proj.id, { tab: 'script' }));
        document.getElementById('emp-board').addEventListener('click', () => nav('project', proj.id, { tab: 'board' }));
        document.getElementById('emp-shot').addEventListener('click', () => nav('project', proj.id, { tab: 'shots' }));
    } else {
        m.innerHTML = `<div class="overview-revamp">${contentHTML}</div>`;
    }

    if (!isEmpty) {
        m.querySelectorAll('.shot-ov-row').forEach(row => {
            row.addEventListener('click', () => { nav('shot', proj.id, { shotId: row.dataset.sid }); });
        });

        m.querySelectorAll('.assign-to-shot-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idea = proj.ideas.find(x => x.id === btn.dataset.iid);
                openIdeaToShotModal(proj, idea, m);
            });
        });

        m.querySelectorAll('.edit-proj-idea-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idea = proj.ideas.find(x => x.id === btn.dataset.iid);
                openPromptModal("Edit Idea", "Update your idea text.", "Idea", idea.text || idea.title, (newText) => {
                    if (newText && newText.trim()) { idea.text = newText.trim(); idea.title = newText.trim(); saveAll(); render(); }
                });
            });
        });

        m.querySelectorAll('.del-proj-idea-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                openConfirmModal('Delete Idea', 'Are you sure you want to delete this project idea?', 'Delete', () => {
                    proj.ideas = proj.ideas.filter(x => x.id !== btn.dataset.iid); saveAll(); render();
                });
            });
        });

        document.getElementById('ov-edit-btn').addEventListener('click', () => openEditBriefModal(proj));
        document.getElementById('edit-brief-btn').addEventListener('click', () => openEditBriefModal(proj));
        document.getElementById('ov-add-idea-btn').addEventListener('click', () => {
            openPromptModal("New Idea", "Capture a new idea for this project.", "Idea", "", (text) => {
                if (text && text.trim()) {
                    const idea = { id: uid(), text: text.trim(), title: text.trim(), projectId: proj.id, shotId: null, createdAt: new Date().toISOString() };
                    proj.ideas = proj.ideas || []; proj.ideas.push(idea); saveAll(); render();
                }
            });
        });
    }
}

function openIdeaToShotModal(proj, idea, m) {
    openModal(`<div class="modal modal-sm">
    <h2>Assign Idea to Shot</h2>
    <div class="modal-preview-text">"${idea.title ? (idea.title.length > 44 ? idea.title.slice(0, 44) + '…' : idea.title) : ''}"</div>
    <div style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
      ${proj.shots.map(s => `
        <div class="assign-opt" data-sid="${s.id}"><i class="ti ti-camera"></i>${s.title || ('Shot ' + s.number)}</div>
      `).join('')}
    </div>
    <div class="assign-divider"></div>
    <div class="assign-opt" data-sid="none"><i class="ti ti-x"></i>Remove from specific shot</div>
    <button class="modal-cancel-link" id="is-cancel">Cancel</button>
  </div>`);

    document.getElementById('is-cancel').addEventListener('click', closeModal);
    document.querySelectorAll('[data-sid]').forEach(el => {
        el.addEventListener('click', () => {
            idea.shotId = el.dataset.sid === 'none' ? null : el.dataset.sid;
            saveAll(); closeModal();
            if (S.tab === 'overview') renderOverview(m);
            else if (S.tab === 'script') renderScript(m);
        });
    });
}

function openBlockToShotModal(block, proj, callback) {
    openModal(`<div class="modal modal-sm">
    <h2>Tag Block to Shot</h2>
    <div class="modal-preview-text">"${block.text.length > 44 ? block.text.slice(0, 44) + '…' : block.text}"</div>
    <div style="max-height:240px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
      ${proj.shots.map(s => `
        <div class="assign-opt" data-sid="${s.id}"><i class="ti ti-camera"></i>${s.title || ('Shot ' + s.number)}</div>
      `).join('')}
    </div>
    <div class="assign-divider"></div>
    <div class="assign-opt" data-sid="none"><i class="ti ti-x"></i>Untag block</div>
    <button class="modal-cancel-link" id="is-cancel">Cancel</button>
  </div>`);

    document.getElementById('is-cancel').addEventListener('click', closeModal);
    document.querySelectorAll('[data-sid]').forEach(el => {
        el.addEventListener('click', () => {
            block.shotId = el.dataset.sid === 'none' ? null : el.dataset.sid;
            saveAll(); closeModal(); callback();
        });
    });
}

// ─── VISUAL SCRIPT ───────────────────────────────────────────
let vsDragSrcEl = null;

function renderScript(m) {
    const proj = getProj(); if (!proj) return;
    if (!proj.visualScriptBlocks) proj.visualScriptBlocks = [];
    if (proj.visualScriptBlocks.length === 0) {
        let opts = BLOCK_PALETTE.slice();
        let color = opts[Math.floor(Math.random() * opts.length)];
        proj.visualScriptBlocks.push({ id: uid(), text: '', shotId: null, color: color });
    }

    const wc = proj.visualScriptBlocks.reduce((acc, b) => acc + b.text.trim().split(/\s+/).filter(Boolean).length, 0);

    m.innerHTML = `<div class="vs-revamp">
    <div class="hud-tl hud-corner"></div><div class="hud-tr hud-corner"></div><div class="hud-bl hud-corner"></div><div class="hud-br hud-corner"></div>
    
    <div class="page-topbar">
      <div class="welcome">
        <h1>VISUAL SCRIPT <i class="ti ti-pencil" style="font-size:14px; color:#555; margin-left:4px;"></i></h1>
        <p>${proj.title || 'UNTITLED'}</p>
      </div>
      <div style="display:flex; gap:12px;">
         <button class="btn btn-ghost" id="vs-toggle-sidebar"><i class="ti ti-layout-sidebar-right"></i> TOGGLE IDEAS PANEL</button>
      </div>
    </div>
    
    <div style="display:flex; gap:32px; height:calc(100vh - 180px);">
       
       <div style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
          <div class="vs-toolbar">
            <span id="vs-wordcount">${wc} WORDS</span>
          </div>
          
          <div class="vs-blocks-wrap" id="vs-blocks-container">
             ${proj.visualScriptBlocks.map((b, i) => {
        let shotName = '[ + TAG ]';
        let tagClass = '';
        let color = b.color || '#222';
        let btnColor = '#555';
        let hasTag = false;

        if (b.shotId) {
            const sIdx = proj.shots.findIndex(x => x.id === b.shotId);
            if (sIdx > -1) {
                const s = proj.shots[sIdx];
                shotName = `[ SHOT ${String(s.number).padStart(2, '0')} ]`;
                tagClass = 'tagged';
                btnColor = color;
                hasTag = true;
            }
        }
        const isHeader = b.text.startsWith('# ');

        return `
                <div class="vs-block-row ${tagClass}" data-idx="${i}" style="border-left-color:${color}; display:flex; align-items:flex-start; padding:16px 0; border-bottom:1px solid #1E1E1E;">
                   <div class="vs-drag-handle" style="padding:0 12px; color:#444; font-size:12px; cursor:grab;">⋮⋮</div>
                   <div style="display:flex; flex-direction:column; gap:12px; width:100px; flex-shrink:0;">
                       <button class="vs-tag-btn ${tagClass}" data-idx="${i}" style="color:${btnColor}; font-size:10px; font-family:inherit; background:none; border:none; text-align:left; cursor:pointer;">${shotName}</button>
                       ${hasTag ? `<button class="icon-btn vs-reassign-btn" data-idx="${i}" style="padding:0; color:${btnColor}; font-size:12px; justify-content:flex-start;" title="Reassign shot"><i class="ti ti-target"></i></button>` : `<button class="icon-btn vs-reassign-btn" data-idx="${i}" style="padding:0; color:#444; font-size:12px; justify-content:flex-start;" title="Assign to shot"><i class="ti ti-target"></i></button>`}
                   </div>
                   <textarea class="vs-textarea ${isHeader ? 'header-mode' : ''}" data-idx="${i}" placeholder="WRITE SCENE..." style="flex:1; background:transparent; border:none; color:#DDDDDE; font-family:inherit; font-size:11px; resize:none; outline:none; line-height:1.6;">${b.text}</textarea>
                   <div class="vs-block-actions">
                      <button class="icon-btn del-block-btn" data-idx="${i}" style="color:#cc5555; padding:8px;"><i class="ti ti-trash"></i></button>
                   </div>
                </div>`;
    }).join('')}
             <button class="vs-add-block-btn" id="vs-add-block" style="margin-top:12px; border-style:dashed;">+ ADD BLOCK</button>
             <div style="font-size:9px; color:#555; margin-top:32px; text-align:center;"><i class="ti ti-info-circle"></i> TIP: START A BLOCK WITH # TO INSTANTLY FORMAT IT AS A SCENE HEADER.</div>
          </div>
       </div>
       
       ${S.vsSidebarOpen ? `
       <div style="width:300px; border-left:1px solid #1E1E1E; padding-left:24px; display:flex; flex-direction:column;">
          <div style="font-size:10px; font-weight:600; color:#aaa; margin-bottom:16px;">PROJECT IDEAS</div>
          <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:16px; margin-bottom:24px;">
             ${(proj.ideas || []).filter(i => !i.shotId).length === 0 ? `<div style="font-size:10px; color:#555;">NO IDEAS ASSIGNED.</div>` : ''}
             ${(proj.ideas || []).filter(i => !i.shotId).map(i => `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #161616; padding-bottom:12px;">
                   <div style="display:flex; flex-direction:column; gap:8px; flex:1; padding-right:12px;">
                      <span style="font-size:10px; color:#ccc; line-height:1.4;">${i.text || i.title}</span>
                      <span style="font-size:8px; color:#555; background:#111; padding:2px 6px; border-radius:2px; border:1px solid #1E1E1E; width:max-content;">UNASSIGNED</span>
                   </div>
                   <button class="icon-btn vs-assign-shot" data-iid="${i.id}" style="color:#5aaa80; padding:2px;"><i class="ti ti-target"></i></button>
                </div>
             `).join('')}
          </div>
          
          <div style="font-size:10px; font-weight:600; color:#aaa; margin-bottom:16px;">GLOBAL INBOX</div>
          <div style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">
             ${ideas.filter(i => !i.projectId).length === 0 ? `<div style="font-size:10px; color:#555;">INBOX EMPTY.</div>` : ''}
             ${ideas.filter(i => !i.projectId).map(i => `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid #161616; padding-bottom:12px;">
                   <div style="display:flex; flex-direction:column; gap:8px; flex:1; padding-right:12px;">
                      <span style="font-size:10px; color:#ccc; line-height:1.4;">${i.text || i.title}</span>
                   </div>
                   <button class="icon-btn vs-pull-idea" data-iid="${i.id}" style="color:#6688cc; padding:2px;"><i class="ti ti-arrow-down-left"></i></button>
                </div>
             `).join('')}
          </div>
       </div>
       ` : ''}

    </div>
  </div>`;

    document.getElementById('vs-toggle-sidebar').addEventListener('click', () => { S.vsSidebarOpen = !S.vsSidebarOpen; renderScript(m); });

    // Script Block Drag & Drop
    const rows = m.querySelectorAll('.vs-block-row');
    rows.forEach(row => {
        const handle = row.querySelector('.vs-drag-handle');
        if (handle) {
            handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
            handle.addEventListener('mouseup', () => row.setAttribute('draggable', 'false'));
            handle.addEventListener('mouseleave', () => row.setAttribute('draggable', 'false'));
        }

        row.addEventListener('dragstart', function (e) {
            vsDragSrcEl = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            this.style.opacity = '0.4';
        });
        row.addEventListener('dragover', function (e) {
            if (e.preventDefault) { e.preventDefault(); }
            e.dataTransfer.dropEffect = 'move';
            this.classList.add('drag-over');
            return false;
        });
        row.addEventListener('dragleave', function (e) {
            this.classList.remove('drag-over');
        });
        row.addEventListener('drop', function (e) {
            if (e.stopPropagation) { e.stopPropagation(); }
            if (vsDragSrcEl !== this) {
                const srcIdx = parseInt(vsDragSrcEl.dataset.idx);
                const tgtIdx = parseInt(this.dataset.idx);
                const b = proj.visualScriptBlocks.splice(srcIdx, 1)[0];
                proj.visualScriptBlocks.splice(tgtIdx, 0, b);
                saveAll(); renderScript(m);
            }
            return false;
        });
        row.addEventListener('dragend', function (e) {
            this.style.opacity = '1';
            this.setAttribute('draggable', 'false');
            rows.forEach(r => r.classList.remove('drag-over'));
        });
    });

    // Textarea Logic
    m.querySelectorAll('.vs-textarea').forEach(ta => {
        ta.style.height = ta.scrollHeight + 'px';

        ta.addEventListener('input', e => {
            const val = e.target.value;
            if (val.startsWith('# ')) ta.classList.add('header-mode');
            else ta.classList.remove('header-mode');

            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';

            proj.visualScriptBlocks[ta.dataset.idx].text = val;
            saveAll();

            const newWc = proj.visualScriptBlocks.reduce((acc, b) => acc + b.text.trim().split(/\s+/).filter(Boolean).length, 0);
            document.getElementById('vs-wordcount').textContent = newWc + ' WORDS';
        });

        ta.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const val = e.target.value;
                if (ta.selectionStart === val.length) {
                    e.preventDefault();
                    const idx = parseInt(ta.dataset.idx);

                    let prev = proj.visualScriptBlocks[idx].color;
                    let opts = BLOCK_PALETTE.filter(c => c !== prev);
                    let newColor = opts[Math.floor(Math.random() * opts.length)];

                    proj.visualScriptBlocks.splice(idx + 1, 0, { id: uid(), text: '', shotId: null, color: newColor });
                    saveAll(); renderScript(m);
                    setTimeout(() => {
                        const newTa = document.querySelector(`.vs-textarea[data-idx="${idx + 1}"]`);
                        if (newTa) newTa.focus();
                    }, 50);
                }
            }
        });
    });

    document.getElementById('vs-add-block').addEventListener('click', () => {
        let prev = proj.visualScriptBlocks.length > 0 ? proj.visualScriptBlocks[proj.visualScriptBlocks.length - 1].color : null;
        let opts = BLOCK_PALETTE.filter(c => c !== prev);
        let newColor = opts[Math.floor(Math.random() * opts.length)];

        proj.visualScriptBlocks.push({ id: uid(), text: '', shotId: null, color: newColor });
        saveAll(); renderScript(m);
        setTimeout(() => {
            const tas = document.querySelectorAll('.vs-textarea');
            if (tas.length) tas[tas.length - 1].focus();
        }, 50);
    });

    m.querySelectorAll('.vs-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const block = proj.visualScriptBlocks[idx];
            if (block.shotId) {
                nav('shot', proj.id, { shotId: block.shotId });
            } else {
                openBlockToShotModal(block, proj, () => renderScript(m));
            }
        });
    });

    m.querySelectorAll('.vs-reassign-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            const block = proj.visualScriptBlocks[idx];
            openBlockToShotModal(block, proj, () => renderScript(m));
        });
    });

    m.querySelectorAll('.del-block-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx);
            openConfirmModal('Delete Block', 'Are you sure you want to delete this script block?', 'Delete', () => {
                proj.visualScriptBlocks.splice(idx, 1);
                saveAll(); renderScript(m);
            });
        });
    });

    if (S.vsSidebarOpen) {
        m.querySelectorAll('.vs-assign-shot').forEach(btn => {
            btn.addEventListener('click', () => {
                const idea = proj.ideas.find(x => x.id === btn.dataset.iid);
                openIdeaToShotModal(proj, idea, m);
            });
        });
        m.querySelectorAll('.vs-pull-idea').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = ideas.findIndex(x => x.id === btn.dataset.iid);
                if (idx > -1) {
                    const idea = ideas.splice(idx, 1)[0];
                    idea.projectId = proj.id;
                    proj.ideas = proj.ideas || [];
                    proj.ideas.push(idea);
                    saveAll(); renderScript(m);
                }
            });
        });
    }
}


// ─── PROJECT BOARD ───────────────────────────────────────────
if(S.boardPan === undefined) { S.boardPan = {x:0, y:0}; S.boardZoom = 1; }
let undoStack = [];
let redoStack = [];

function boardPushHistory() {
   const proj = getProj();
   if (!proj || !proj.projectBoardData) return;
   undoStack.push(JSON.stringify(proj.projectBoardData.elements));
   if (undoStack.length > 50) undoStack.shift(); 
   redoStack = []; 
}

function boardDoUndo() {
   const proj = getProj();
   if (!proj || undoStack.length === 0) return;
   redoStack.push(JSON.stringify(proj.projectBoardData.elements));
   proj.projectBoardData.elements = JSON.parse(undoStack.pop());
   saveAll(); renderBoard(document.getElementById('main'));
}

function boardDoRedo() {
   const proj = getProj();
   if (!proj || redoStack.length === 0) return;
   undoStack.push(JSON.stringify(proj.projectBoardData.elements));
   proj.projectBoardData.elements = JSON.parse(redoStack.pop());
   saveAll(); renderBoard(document.getElementById('main'));
}

let _boardMoveHandler = null;
let _boardUpHandler = null;

function renderBoard(m) {
    const proj = getProj(); if (!proj) return;
    if (!proj.projectBoardData || !proj.projectBoardData.elements) proj.projectBoardData = { elements: [] };
    const bd = proj.projectBoardData;
    let selectedIds = [], dragging = [], resizing = null, rotating = null, panning = false, drawingPath = false, currentPath = null, dragStart = { x: 0, y: 0 }, lastMouse = { x: 0, y: 0 };

    // 1. INSTANT DOM SHELL (No massive canvas dimensions yet to prevent layout thrashing)
    m.innerHTML = `<div class="board-revamp">
    <div class="page-topbar">
      <div class="welcome"><h1>PROJECT BOARD</h1><p>${proj.title || 'UNTITLED'}</p></div>
      <button class="btn btn-ghost" id="board-clear-btn" style="border:1px dashed #333;"><i class="ti ti-trash"></i> CLEAR</button>
    </div>
    
    <div class="canvas-wrap" id="canvas-wrap">
      <div class="hud-tl hud-corner" style="z-index:20;"></div><div class="hud-tr hud-corner" style="z-index:20;"></div><div class="hud-bl hud-corner" style="z-index:20;"></div><div class="hud-br hud-corner" style="z-index:20;"></div>
      
      <div class="canvas-toolbar">
        <button class="tool-btn active" data-tool="select" title="Select (V)"><i class="ti ti-pointer"></i></button>
        <button class="tool-btn" data-tool="text" title="Text (T)"><i class="ti ti-letter-t"></i></button>
        <button class="tool-btn" data-tool="image" title="Image"><i class="ti ti-photo"></i></button>
        <div class="tool-sep"></div>
        <button class="tool-btn" data-tool="rect" title="Rectangle"><i class="ti ti-square"></i></button>
        <button class="tool-btn" data-tool="arrow" title="Arrow (A)"><i class="ti ti-arrow-right"></i></button>
        <div class="tool-sep"></div>
        <button class="tool-btn" data-tool="pencil" title="Pencil (P)"><i class="ti ti-pencil"></i></button>
        <button class="tool-btn" data-tool="eraser" title="Eraser (E)"><i class="ti ti-eraser"></i></button>
        <div class="tool-sep"></div>
        <button class="tool-btn" id="undo-btn" title="Undo (Ctrl+Z)"><i class="ti ti-arrow-back-up"></i></button>
        <button class="tool-btn" id="redo-btn" title="Redo (Ctrl+Y)"><i class="ti ti-arrow-forward-up"></i></button>
        <div class="tool-sep"></div>
        <button class="tool-btn" id="del-el-btn" title="Delete selected"><i class="ti ti-trash"></i></button>
      </div>
      
      <div class="canvas-surface" id="canvas-surface" tabindex="0">
        <div class="canvas-inner" id="canvas-inner">
           <canvas id="canvas-draw-layer" style="position:absolute; top:-2000px; left:-2000px; pointer-events:none; z-index:1;"></canvas>
           <div id="canvas-objects" style="position:absolute; top:0; left:0; width:1px; height:1px; overflow:visible; z-index:2;"></div>
        </div>
        <div class="canvas-hint" id="canvas-hint"><i class="ti ti-layout-board"></i><p>SELECT A TOOL TO ADD ELEMENTS.<br>PASTE IMAGES OR TEXT ANYTIME. SCROLL TO ZOOM.</p></div>
      </div>
      
      <div class="canvas-zoom">
        <button class="zoom-btn" id="zoom-out"><i class="ti ti-minus"></i></button>
        <span id="zoom-label">${Math.round(S.boardZoom * 100)}%</span>
        <button class="zoom-btn" id="zoom-in"><i class="ti ti-plus"></i></button>
      </div>
      
      <div class="canvas-legend">
         <span><b>V</b> SELECT</span>
         <span><b>A</b> ARROW</span>
         <span><b>T</b> TEXT</span>
         <span><b>P</b> PENCIL</span>
         <span><b>E</b> ERASER</span>
      </div>
      
      <input type="file" accept="image/*" id="board-img-input" style="display:none"/>
    </div>
  </div>`;

    // 2. YIELD THREAD TO LET UI CLICK RESOLVE INSTANTLY
    setTimeout(() => {
        if (S.view !== 'project' || S.tab !== 'board') return;

        const surface = document.getElementById('canvas-surface');
        const inner = document.getElementById('canvas-inner');
        const objectsContainer = document.getElementById('canvas-objects');
        const hint = document.getElementById('canvas-hint');
        const cvs = document.getElementById('canvas-draw-layer');
        
        // 3. LAZY-LOAD THE 64MB CANVAS MEMORY
        cvs.width = 4000;
        cvs.height = 4000;
        const ctx = cvs.getContext('2d', { desynchronized: true }); // GPU acceleration flag

        surface.focus();

        function applyTransform() { inner.style.transform = `translate(${S.boardPan.x}px,${S.boardPan.y}px) scale(${S.boardZoom})`; }
        function updateZoomLabel() { document.getElementById('zoom-label').textContent = Math.round(S.boardZoom * 100) + '%'; }
        function showHint() { hint.style.display = bd.elements.length ? 'none' : 'block'; }

        function setTool(toolName) {
            S.canvasTool = toolName;
            document.querySelectorAll('.canvas-toolbar [data-tool]').forEach(b => b.classList.remove('active'));
            const activeBtn = document.querySelector(`.canvas-toolbar [data-tool="${toolName}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        function renderElements() {
            objectsContainer.innerHTML = '';
            showHint();

            ctx.clearRect(0, 0, 4000, 4000);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            bd.elements.filter(e => e.type === 'stroke').forEach(stroke => {
                ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
                ctx.lineWidth = stroke.tool === 'eraser' ? 24 : 4;
                ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : '#DDDDDE';
                ctx.beginPath();
                stroke.points.forEach((p, i) => {
                    const cx = p.x + 2000;
                    const cy = p.y + 2000;
                    if (i === 0) ctx.moveTo(cx, cy);
                    else ctx.lineTo(cx, cy);
                });
                ctx.stroke();
            });

            // 4. BATCH DOM INJECTION (Prevents slow loop rendering)
            const frag = document.createDocumentFragment();

            bd.elements.filter(e => e.type !== 'stroke').forEach(el => {
                const div = document.createElement('div');
                div.className = 'canvas-el' + (selectedIds.includes(el.id) ? ' selected' : '');
                div.dataset.id = el.id;
                div.style.cssText = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;transform:rotate(${el.rot || 0}deg);`;

                let htmlStr = '';
                if (el.type === 'text') {
                    htmlStr = `<div class="el-inner" style="width:100%;height:100%;background:transparent;display:flex;align-items:center;justify-content:center;overflow:hidden;"><textarea data-elid="${el.id}" style="width:100%;height:100%;background:transparent;border:1px dashed transparent;outline:none;color:#DDDDDE;font-family:inherit;font-size:${el.fontSize || 14}px;resize:none;cursor:text;text-align:center;overflow:hidden;text-transform:uppercase;">${el.content || ''}</textarea></div>`;
                } else if (el.type === 'image') {
                    htmlStr = `<div class="el-inner" style="width:100%;height:100%;"><img src="${el.src}" decoding="async" draggable="false" style="width:100%;height:100%;object-fit:fill;display:block;border-radius:2px;pointer-events:none;"></div>`;
                } else if (el.type === 'rect') {
                    htmlStr = `<div class="el-inner" style="width:100%;height:100%;background:#1e1e1e;border:1px solid #444;border-radius:2px;"></div>`;
                } else if (el.type === 'arrow') {
                    const svgW = Math.max(el.w, 20), svgH = Math.max(el.h, 20);
                    htmlStr = `<div class="el-inner" style="width:100%;height:100%;"><svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="overflow:visible"><defs><marker id="ah" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#888"/></marker></defs><line x1="4" y1="${svgH / 2}" x2="${svgW - 8}" y2="${svgH / 2}" stroke="#888" stroke-width="1.5" marker-end="url(#ah)"/></svg></div>`;
                }

                div.innerHTML = htmlStr + `<div class="el-resize"><i class="ti ti-arrows-diagonal"></i></div><div class="el-rotate"><i class="ti ti-rotate"></i></div>`;
                frag.appendChild(div);

                const ta = div.querySelector('textarea');
                if (ta) {
                    ta.addEventListener('input', e => {
                        const found = bd.elements.find(x => x.id === el.id);
                        if (found) {
                            found.content = e.target.value;
                            ta.style.height = '1px';
                            let newH = Math.max(found.h, ta.scrollHeight);
                            ta.style.height = '100%';
                            if (newH > found.h) { found.h = newH; div.style.height = newH + 'px'; }
                            saveAll();
                        }
                    });
                    ta.addEventListener('focus', e => { e.target.style.border = '1px dashed #555'; });
                    ta.addEventListener('blur', e => { e.target.style.border = '1px dashed transparent'; boardPushHistory(); });
                    ta.addEventListener('mousedown', e => {
                        if (S.canvasTool === 'select' && selectedIds.includes(el.id)) { e.stopPropagation(); }
                    });
                }

                div.addEventListener('mousedown', e => {
                    if (e.button === 1 || e.button !== 0) return;
                    if (e.target.closest('.el-resize') || e.target.closest('.el-rotate')) return;

                    setTool('select');
                    if (e.shiftKey) {
                        if (selectedIds.includes(el.id)) selectedIds = selectedIds.filter(id => id !== el.id);
                        else selectedIds.push(el.id);
                    } else {
                        if (!selectedIds.includes(el.id)) selectedIds = [el.id];
                    }

                    dragStart = { x: e.clientX, y: e.clientY };
                    dragging = selectedIds.map(id => {
                        const xel = bd.elements.find(x => x.id === id);
                        return { id, ox: xel.x, oy: xel.y };
                    });

                    e.stopPropagation(); renderElements();
                });

                const rh = div.querySelector('.el-resize');
                if (rh) {
                    rh.addEventListener('mousedown', e => {
                        e.stopPropagation(); selectedIds = [el.id];
                        resizing = { id: el.id, startX: e.clientX, startY: e.clientY, ow: el.w, oh: el.h };
                        renderElements();
                    });
                }

                const rot = div.querySelector('.el-rotate');
                if (rot) {
                    rot.addEventListener('mousedown', e => {
                        e.stopPropagation(); selectedIds = [el.id];
                        const rect = div.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2;
                        const cy = rect.top + rect.height / 2;
                        const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
                        rotating = { id: el.id, cx, cy, startAngle, oRot: el.rot || 0 };
                        renderElements();
                    });
                }
            });
            
            // Dump batched memory to screen instantly
            objectsContainer.appendChild(frag);
        }

        // Keybinds
        surface.addEventListener('keydown', e => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); boardDoUndo(); return; }
            if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); boardDoRedo(); return; }

            switch (e.key.toLowerCase()) {
                case 'v': setTool('select'); break;
                case 'a': setTool('arrow'); break;
                case 't': setTool('text'); break;
                case 'p': setTool('pencil'); break;
                case 'e': setTool('eraser'); break;
            }
        });

        if (_boardMoveHandler) document.removeEventListener('mousemove', _boardMoveHandler);
        if (_boardUpHandler) document.removeEventListener('mouseup', _boardUpHandler);

        _boardMoveHandler = e => {
            if (S.view !== 'project' || S.tab !== 'board') return;

            if (drawingPath && currentPath) {
                const rect = document.getElementById('canvas-surface').getBoundingClientRect();
                const x = (e.clientX - rect.left - S.boardPan.x) / S.boardZoom; const y = (e.clientY - rect.top - S.boardPan.y) / S.boardZoom;
                currentPath.points.push({ x, y });
                
                ctx.globalCompositeOperation = currentPath.tool === 'eraser' ? 'destination-out' : 'source-over';
                ctx.lineWidth = currentPath.tool === 'eraser' ? 24 : 4;
                ctx.strokeStyle = currentPath.tool === 'eraser' ? 'rgba(0,0,0,1)' : '#DDDDDE';
                ctx.lineTo(x + 2000, y + 2000);
                ctx.stroke();
                return;
            }

            if (panning) {
                S.boardPan.x += e.clientX - lastMouse.x;
                S.boardPan.y += e.clientY - lastMouse.y;
                lastMouse = { x: e.clientX, y: e.clientY };
                applyTransform();
            }

            if (dragging.length) {
                if (!dragStart.pushed) { boardPushHistory(); dragStart.pushed = true; }
                const dx = (e.clientX - dragStart.x) / S.boardZoom;
                const dy = (e.clientY - dragStart.y) / S.boardZoom;
                dragging.forEach(d => {
                    const el = bd.elements.find(x => x.id === d.id);
                    if (el) {
                        el.x = d.ox + dx; el.y = d.oy + dy;
                        const domEl = document.querySelector(`.canvas-el[data-id="${el.id}"]`);
                        if (domEl) { domEl.style.left = el.x + 'px'; domEl.style.top = el.y + 'px'; }
                    }
                });
            }

            if (resizing) {
                if (!resizing.pushed) { boardPushHistory(); resizing.pushed = true; }
                const el = bd.elements.find(x => x.id === resizing.id);
                if (el) {
                    let newW = Math.max(40, resizing.ow + (e.clientX - resizing.startX) / S.boardZoom);
                    let newH = Math.max(20, resizing.oh + (e.clientY - resizing.startY) / S.boardZoom);
                    if (el.type === 'image' && !e.ctrlKey) {
                        const aspect = resizing.ow / resizing.oh;
                        newH = newW / aspect;
                    }
                    el.w = newW; el.h = newH;
                    const domEl = document.querySelector(`.canvas-el[data-id="${el.id}"]`);
                    if (domEl) { domEl.style.width = el.w + 'px'; domEl.style.height = el.h + 'px'; }
                }
            }

            if (rotating) {
                if (!rotating.pushed) { boardPushHistory(); rotating.pushed = true; }
                const el = bd.elements.find(x => x.id === rotating.id);
                if (el) {
                    const angle = Math.atan2(e.clientY - rotating.cy, e.clientX - rotating.cx) * 180 / Math.PI;
                    let delta = angle - rotating.startAngle;
                    el.rot = (rotating.oRot + delta) % 360;
                    const domEl = document.querySelector(`.canvas-el[data-id="${el.id}"]`);
                    if (domEl) { domEl.style.transform = `rotate(${el.rot}deg)`; }
                }
            }
        };

        _boardUpHandler = () => {
            if (S.view !== 'project' || S.tab !== 'board') return;
            if (dragging.length || resizing || rotating || drawingPath) saveAll();
            panning = false; dragging = []; resizing = null; rotating = null; drawingPath = false; dragStart.pushed = false;
        };

        document.addEventListener('mousemove', _boardMoveHandler);
        document.addEventListener('mouseup', _boardUpHandler);

        surface.addEventListener('mousedown', e => {
            if (e.button === 1) {
                panning = true; lastMouse = { x: e.clientX, y: e.clientY };
                e.preventDefault(); return;
            }

            if (e.button !== 0) return;

            if (S.canvasTool === 'pencil' || S.canvasTool === 'eraser') {
                panning = false; drawingPath = true;
                boardPushHistory();
                const rect = document.getElementById('canvas-surface').getBoundingClientRect();
                const x = (e.clientX - rect.left - S.boardPan.x) / S.boardZoom; const y = (e.clientY - rect.top - S.boardPan.y) / S.boardZoom;
                currentPath = { id: uid(), type: 'stroke', tool: S.canvasTool, points: [{ x, y }] };
                bd.elements.push(currentPath);
                
                ctx.beginPath();
                ctx.moveTo(x + 2000, y + 2000);
                return;
            }

            if (S.canvasTool === 'select') {
                if (!dragging.length && !resizing && !rotating) {
                    if (e.target.id === 'canvas-surface' || e.target.id === 'canvas-draw-layer') {
                        selectedIds = []; renderElements();
                    }
                }
                return;
            }

            const rect = document.getElementById('canvas-surface').getBoundingClientRect();
            const x = (e.clientX - rect.left - S.boardPan.x) / S.boardZoom, y = (e.clientY - rect.top - S.boardPan.y) / S.boardZoom;

            boardPushHistory();

            if (S.canvasTool === 'text') {
                const id = uid();
                bd.elements.push({ id, type: 'text', x, y, w: 160, h: 40, content: '', fontSize: 14, rot: 0 });
                setTool('select');
                selectedIds = [id];
                saveAll(); renderElements();
                setTimeout(() => { const t = document.querySelector(`textarea[data-elid="${id}"]`); if (t) t.focus(); }, 10);
            }
            else if (S.canvasTool === 'rect') { bd.elements.push({ id: uid(), type: 'rect', x, y, w: 160, h: 100, rot: 0 }); saveAll(); renderElements(); }
            else if (S.canvasTool === 'arrow') { bd.elements.push({ id: uid(), type: 'arrow', x, y, w: 140, h: 30, rot: 0 }); saveAll(); renderElements(); }
            else if (S.canvasTool === 'image') { document.getElementById('board-img-input').click(); lastMouse = { x, y }; }
        });

        surface.addEventListener('wheel', e => {
            e.preventDefault();
            const rect = document.getElementById('canvas-surface').getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const rx = (mx - S.boardPan.x) / S.boardZoom;
            const ry = (my - S.boardPan.y) / S.boardZoom;
            const newZoom = Math.min(3, Math.max(0.2, S.boardZoom + (e.deltaY < 0 ? 0.1 : -0.1)));
            S.boardPan.x = mx - rx * newZoom;
            S.boardPan.y = my - ry * newZoom;
            S.boardZoom = newZoom;
            applyTransform();
            updateZoomLabel();
        }, { passive: false });

        function zoomToCenter(newZoom) {
            const rect = document.getElementById('canvas-surface').getBoundingClientRect();
            const mx = rect.width / 2;
            const my = rect.height / 2;
            const rx = (mx - S.boardPan.x) / S.boardZoom;
            const ry = (my - S.boardPan.y) / S.boardZoom;
            S.boardPan.x = mx - rx * newZoom;
            S.boardPan.y = my - ry * newZoom;
            S.boardZoom = newZoom;
            applyTransform();
            updateZoomLabel();
        }

        document.getElementById('board-img-input').addEventListener('change', e => {
            const f = e.target.files[0]; if (!f) return;
            compressImage(f, (res) => {
                boardPushHistory();
                bd.elements.push({ id: uid(), type: 'image', x: lastMouse.x || 100, y: lastMouse.y || 100, w: 220, h: 150, src: res, rot: 0 });
                saveAll(); renderElements(); applyTransform();
            });
            e.target.value = '';
        });

        m.querySelectorAll('[data-tool]').forEach(btn => btn.addEventListener('click', () => { setTool(btn.dataset.tool); renderElements(); }));

        document.getElementById('undo-btn').addEventListener('click', () => boardDoUndo());
        document.getElementById('redo-btn').addEventListener('click', () => boardDoRedo());

        document.getElementById('zoom-in').addEventListener('click', () => zoomToCenter(Math.min(3, S.boardZoom + 0.1)));
        document.getElementById('zoom-out').addEventListener('click', () => zoomToCenter(Math.max(0.2, S.boardZoom - 0.1)));

        document.getElementById('del-el-btn').addEventListener('click', () => {
            if (!selectedIds.length) return;
            boardPushHistory();
            bd.elements = bd.elements.filter(e => !selectedIds.includes(e.id));
            selectedIds = []; saveAll(); renderElements(); applyTransform();
        });
        
        document.getElementById('board-clear-btn').addEventListener('click', () => {
            openConfirmModal('Clear Board', 'Are you sure you want to delete everything on the board?', 'Clear', () => {
                boardPushHistory();
                bd.elements = []; selectedIds = []; saveAll(); renderElements(); applyTransform();
            });
        });

        applyTransform(); renderElements();

    }, 20); // 20ms yield unlocks the single thread
}
// ─── SHOTS GRID ──────────────────────────────────────────────
function renderShots(m) {
    const proj = getProj(); if (!proj) return;
    let filter = S.shotsFilter || 'All';
    const pg = projProg(proj), counts = shotCounts(proj), total = proj.shots.length;

    const filtered = proj.shots.filter(s => {
        if (filter === 'All') return true;
        const p = shotProg(s), ss = shotStatus(p);
        return ss.toLowerCase() === filter.toLowerCase();
    });

    m.innerHTML = `<div class="page">
    
    <div class="shots-header-revamp">
       <div class="shots-header-titles">
           <h1>Shots</h1>
           <p>All shots in your project.</p>
       </div>
       <button class="btn btn-ghost" id="new-shot-btn" style="border: 1px solid #333;"><i class="ti ti-plus"></i> NEW SHOT</button>
    </div>
    
    <div class="shots-dash-bar-revamp">
       <div class="shots-filters">
          <button class="shot-filter-btn ${filter === 'All' ? 'active' : ''}" data-f="All">ALL <span>${total}</span></button>
          <button class="shot-filter-btn ${filter === 'Not Started' ? 'active' : ''}" data-f="Not Started">NOT STARTED <span>${counts.ns}</span></button>
          <button class="shot-filter-btn ${filter === 'WIP' ? 'active' : ''}" data-f="WIP">WIP <span>${counts.wip}</span></button>
          <button class="shot-filter-btn ${filter === 'Complete' ? 'active' : ''}" data-f="Complete">COMPLETE <span>${counts.complete}</span></button>
       </div>
       <div class="dash-divider"></div>
       <div class="dash-stat-block"><span class="dash-stat-label">TOTAL SHOTS</span><span class="dash-stat-val">${total}</span></div>
       <div class="dash-prog-container">
          <div class="dash-prog-top"><span>% COMPLETE</span><span>${pg}%</span></div>
          <div class="dash-prog-track"><div class="dash-prog-fill" style="width:${pg}%;"></div></div>
       </div>
       <div class="dash-divider" style="margin: 0 32px 0 0;"></div>
       <div class="dash-stat-block"><span class="dash-stat-label">EST. REMAINING</span><span class="dash-stat-val" style="color:#888;">~${counts.wip + counts.ns} TASKS</span></div>
    </div>
    
    <div class="shots-grid-revamp" id="shots-grid"></div>
  </div>`;

    const grid = document.getElementById('shots-grid');

    filtered.forEach(s => {
        const sp = shotProg(s), ss = shotStatus(sp);
        let boxClass = 'box-ns', barColor = '#333';
        if (sp > 0 && sp < 100) { boxClass = 'box-wip'; barColor = '#4285f4'; }
        if (sp === 100) { boxClass = 'box-comp'; barColor = '#5aaa80'; }

        const card = document.createElement('div');
        card.className = 'shot-card-revamp';
        card.dataset.sid = s.id;

        card.innerHTML = `
      <div class="shot-thumb-area">
        <div class="shot-badge badge-tl">SHOT ${String(s.number).padStart(2, '0')}</div>
        <div class="shot-badge badge-tr drag-handle"><i class="ti ti-grip-vertical"></i></div>
        <div class="shot-badge badge-br">${s.type || '2D'}</div>
        ${s.heroImage ? `<img src="${s.heroImage}" alt="" draggable="false">` : `<i class="ti ti-photo" style="font-size:24px;color:#1e1e1e;"></i>`}
      </div>
      <div class="shot-info-area">
        <div class="shot-info-top">
           <div class="shot-card-title-revamp">${s.title || ('Shot ' + s.number)}</div>
           <div class="shot-actions">
              <button class="icon-btn edit-shot-grid-btn" data-sid="${s.id}" style="padding:0; color:#555;"><i class="ti ti-pencil"></i></button>
              <button class="icon-btn del-shot-grid-btn" data-sid="${s.id}" style="padding:0; color:#555;"><i class="ti ti-trash"></i></button>
           </div>
        </div>
        <div class="shot-prog-row">
          <div class="shot-status-box ${boxClass}">${ss}</div>
          <div class="shot-mini-track"><div class="shot-mini-fill" style="width:${sp}%; background:${barColor};"></div></div>
          <div class="shot-pct-txt">${sp}%</div>
        </div>
      </div>`;

        card.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('.drag-handle')) { nav('shot', proj.id, { shotId: s.id }); }
        });

        const handle = card.querySelector('.drag-handle');
        handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
        handle.addEventListener('mouseup', () => card.setAttribute('draggable', 'false'));
        handle.addEventListener('mouseleave', () => card.setAttribute('draggable', 'false'));

        card.addEventListener('dragstart', function (e) {
            window.shotDragSrcId = this.dataset.sid;
            e.dataTransfer.effectAllowed = 'move';
            this.style.opacity = '0.4';
        });
        card.addEventListener('dragover', function (e) {
            e.preventDefault(); this.style.borderColor = '#555'; return false;
        });
        card.addEventListener('dragleave', function (e) { this.style.borderColor = ''; });
        card.addEventListener('drop', function (e) {
            e.stopPropagation();
            const tgtId = this.dataset.sid;
            if (window.shotDragSrcId && window.shotDragSrcId !== tgtId) {
                const srcIdx = proj.shots.findIndex(x => x.id === window.shotDragSrcId);
                const tgtIdx = proj.shots.findIndex(x => x.id === tgtId);
                if (srcIdx > -1 && tgtIdx > -1) {
                    const sObj = proj.shots.splice(srcIdx, 1)[0];
                    proj.shots.splice(tgtIdx, 0, sObj);
                    proj.shots.forEach((shot, index) => shot.number = index + 1);
                    saveAll(); renderShots(m);
                }
            }
            return false;
        });
        card.addEventListener('dragend', function (e) {
            this.style.opacity = '1';
            m.querySelectorAll('.shot-card-revamp').forEach(c => c.style.borderColor = '');
            this.setAttribute('draggable', 'false');
        });

        card.querySelector('.edit-shot-grid-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openPromptModal('RENAME SHOT', 'Enter a new name for this shot.', 'Shot Name', s.title, (newT) => {
                if (newT && newT.trim()) { s.title = newT.trim(); saveAll(); renderShots(m); }
            });
        });

        card.querySelector('.del-shot-grid-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openConfirmModal('DELETE SHOT', 'Permanently wipe this shot from the project?', 'DELETE', () => {
                proj.shots = proj.shots.filter(x => x.id !== s.id);
                proj.shots.forEach((shot, index) => shot.number = index + 1);
                saveAll(); renderShots(m);
            });
        });

        grid.appendChild(card);
    });

    if (!filtered.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1; margin-top: 32px;"><i class="ti ti-camera"></i><p>${filter === 'All' ? 'NO SHOTS LOGGED.' : 'NO SHOTS WITH THIS STATUS.'}</p></div>`;
    }

    m.querySelectorAll('[data-f]').forEach(btn => {
        btn.addEventListener('click', () => { S.shotsFilter = btn.dataset.f; renderShots(m); });
    });

    document.getElementById('new-shot-btn').addEventListener('click', () => {
        openPromptModal('NEW SHOT', 'Enter type (2D or 3D)', 'Shot Type', '3D', (type) => {
            if (type && (type.toUpperCase() === '2D' || type.toUpperCase() === '3D')) {
                proj.shots.push({ id: uid(), title: `Shot ${total + 1}`, number: total + 1, type: type.toUpperCase(), tasks: makeChecklist(type.toUpperCase()) });
                saveAll(); renderShots(m);
            } else {
                alert('Invalid type. Must be 2D or 3D.');
            }
        });
    });
}

// ─── SHOT DETAILS ────────────────────────────────────────────
function renderShotDetail(m) {
    const proj = getProj();
    if (!proj) return;
    const s = proj.shots.find(x => x.id === S.shotId);
    if (!s) { nav('project', proj.id, { tab: 'shots' }); return; }

    if (!s.tasks || s.tasks.length === 0) {
        const t3D = ['Storyboard', 'Blocked', 'Animation', 'Secondary Animation', 'Sound', 'Post Production', 'Export'];
        const t2D = ['Storyboard', 'Rough Animation', 'Tie Down', 'Cleanup', 'Color', 'Compositing', 'Export'];
        const defaults = (s.type === '3D') ? t3D : t2D;
        s.tasks = defaults.map(text => ({ text, done: false }));
        saveAll();
    }

    if (!s.frames) s.frames = [];

    const totalTasks = s.tasks.length;
    const doneTasks = s.tasks.filter(t => t.done).length;
    const prog = shotProg(s);

    const sIdx = proj.shots.findIndex(x => x.id === s.id);
    const prevShot = sIdx > 0 ? proj.shots[sIdx - 1] : null;
    const nextShot = sIdx < proj.shots.length - 1 ? proj.shots[sIdx + 1] : null;

    const is3D = s.type === '3D';

    m.innerHTML = `
    <div class="page" style="padding-bottom: 100px;">
        <div class="shot-top-nav">
            <div class="shot-top-left">
                <button class="back-btn-revamp" id="sd-back"><i class="ti ti-arrow-left"></i> BACK TO SHOTS</button>
                <div class="shot-title-big">${s.title || ('SHOT ' + s.number)}</div>
            </div>
            <div class="shot-top-right">
                <button class="shot-badge-btn ${is3D ? 'active' : ''}" id="btn-type-3d">3D</button>
                <button class="shot-badge-btn ${!is3D ? 'active' : ''}" id="btn-type-2d">2D</button>
                <button class="shot-action-btn" id="sd-edit" title="Edit Info"><i class="ti ti-pencil"></i></button>
                <button class="shot-action-btn del" id="sd-del" title="Delete Shot"><i class="ti ti-trash"></i></button>
            </div>
        </div>

        <div class="shot-detail-layout">
            <div class="shot-main-col">
                <div class="shot-hero-box" id="sd-hero">
                    ${s.heroImage ? `<img src="${s.heroImage}" alt="">` : `<i class="ti ti-photo" style="font-size:32px; color:#1e1e1e;"></i>`}
                </div>

                <div class="shot-text-grid">
                    <div>
                        <div class="section-label-revamp">SYNOPSIS</div>
                        <textarea class="shot-textarea-revamp" id="sd-synopsis" placeholder="What happens in this shot?">${s.description || ''}</textarea>
                    </div>
                    <div>
                        <div class="section-label-revamp">PURPOSE</div>
                        <textarea class="shot-textarea-revamp" id="sd-purpose" placeholder="Why does this shot exist?">${s.purpose || ''}</textarea>
                    </div>
                </div>

                <div class="shot-storyboard-sec">
                    <div class="section-label-revamp">STORYBOARD</div>
                    <div class="storyboard-grid-revamp" id="sd-frames"></div>
                </div>

                <div class="shot-ideas-sec">
                    <div class="section-label-revamp">SHOT IDEAS</div>
                    <div class="ideas-list-revamp" id="sd-ideas"></div>
                    <button class="add-idea-btn" id="sd-add-idea">+ ASSIGN / ADD IDEA</button>
                </div>
            </div>

            <div class="shot-side-col">
                <div class="shot-prog-block">
                    <div class="section-label-revamp">SHOT PROGRESS</div>
                    <div class="side-prog-large">${prog}%</div>
                    <div class="side-prog-track"><div class="side-prog-fill" style="width:${prog}%;"></div></div>
                    <div class="side-prog-stats">${doneTasks} / ${totalTasks} tasks completed</div>
                    
                    <div class="task-list-revamp" id="sd-tasks"></div>
                    <button class="add-task-btn" id="sd-add-task">+ ADD TASK</button>
                </div>

                <div class="shot-lessons-block" style="margin-top: 16px;">
                    <div class="section-label-revamp">LESSONS LEARNED</div>
                    <textarea class="shot-textarea-revamp" id="sd-lessons" placeholder="What did you learn while making this shot?">${s.lessons || ''}</textarea>
                </div>
            </div>
        </div>

        <div class="shot-bottom-nav">
            ${prevShot ? `<button class="nav-shot-btn" id="sd-prev"><i class="ti ti-arrow-left"></i> &nbsp; PREV SHOT</button>` : ''}
            ${nextShot ? `<button class="nav-shot-btn" id="sd-next">NEXT SHOT &nbsp; <i class="ti ti-arrow-right"></i></button>` : ''}
        </div>
    </div>`;

    document.getElementById('sd-back').addEventListener('click', () => nav('project', proj.id, { tab: 'shots' }));
    
    document.getElementById('sd-edit').addEventListener('click', () => {
        openPromptModal('RENAME SHOT', 'Enter a new name for this shot.', 'Shot Name', s.title, (title) => {
            if (title && title.trim()) { s.title = title.trim(); saveAll(); renderShotDetail(m); }
        });
    });
    
    document.getElementById('sd-del').addEventListener('click', () => {
        openConfirmModal('DELETE SHOT', 'Permanently wipe this shot from the project?', 'DELETE', () => {
            proj.shots = proj.shots.filter(x => x.id !== s.id);
            proj.shots.forEach((shot, index) => shot.number = index + 1);
            saveAll(); nav('project', proj.id, { tab: 'shots' });
        });
    });

    const handleTypeSwitch = (newType) => {
        if (s.type === newType) return;
        s.type = newType;
        if (confirm(`Switching to ${newType}. Do you want to load the default ${newType} checklist? (This will overwrite current tasks)`)) {
            const t3D = ['Storyboard', 'Blocked', 'Animation', 'Secondary Animation', 'Sound', 'Post Production', 'Export'];
            const t2D = ['Storyboard', 'Rough Animation', 'Tie Down', 'Cleanup', 'Color', 'Compositing', 'Export'];
            const defaults = (newType === '3D') ? t3D : t2D;
            s.tasks = defaults.map(text => ({ text, done: false }));
        }
        saveAll(); renderShotDetail(m);
    };

    document.getElementById('btn-type-3d').addEventListener('click', () => handleTypeSwitch('3D'));
    document.getElementById('btn-type-2d').addEventListener('click', () => handleTypeSwitch('2D'));

    ['synopsis', 'purpose', 'lessons'].forEach(field => {
        const el = document.getElementById(`sd-${field}`);
        if (el) {
            el.addEventListener('blur', () => {
                if (field === 'synopsis') s.description = el.value;
                else s[field] = el.value;
                saveAll();
            });
        }
    });

    const taskCon = document.getElementById('sd-tasks');
    s.tasks.forEach((t, i) => {
        const row = document.createElement('div');
        row.className = 'task-row-revamp';
        row.innerHTML = `
            <div class="task-check ${t.done ? 'done' : ''}"><i class="ti ti-check"></i></div>
            <div class="task-name">${t.text}</div>
            <button class="task-del"><i class="ti ti-x"></i></button>
        `;
        row.querySelector('.task-check').addEventListener('click', () => {
            const oldProg = shotProg(s); // Measure progress BEFORE the click
            
            t.done = !t.done;
            s.progress = shotProg(s); // Measure progress AFTER the click
            saveAll();
            
            // If we weren't at 100 before, and we are at 100 now -> FIRE
            if (oldProg < 100 && s.progress === 100) {
                confetti({
                    particleCount: 120,
                    spread: 80,
                    origin: { y: 0.6 },
                    colors: ['#DDDDDE', '#5aaa80', '#4285f4', '#f5a623'] // Tactical studio colors
                });
            }
            
            renderShotDetail(m);
        });
        row.querySelector('.task-del').addEventListener('click', () => {
            s.tasks.splice(i, 1);
            s.progress = shotProg(s);
            saveAll();
            renderShotDetail(m);
        });
        taskCon.appendChild(row);
    });

    document.getElementById('sd-add-task').addEventListener('click', () => {
        openPromptModal('NEW TASK', 'Create a new checklist item.', 'Task Name', '', (name) => {
            if (name && name.trim()) {
                s.tasks.push({ text: name.trim(), done: false });
                s.progress = shotProg(s);
                saveAll();
                renderShotDetail(m);
            }
        });
    });

    if (!s.linkedIdeas) s.linkedIdeas = [];
    if (!proj.ideas) proj.ideas = [];

    const ideaCon = document.getElementById('sd-ideas');
    const linked = proj.ideas.filter(x => s.linkedIdeas.includes(x.id) || x.linkedShotId === s.id || x.shotId === s.id);

    linked.forEach(idea => {
        const displayTxt = idea.text || idea.title || '';
        const row = document.createElement('div');
        row.className = 'idea-row-revamp';
        row.innerHTML = `
            <i class="ti ti-bulb idea-icon"></i>
            <div class="idea-text">${displayTxt}</div>
            <div class="idea-actions">
                <button class="icon-btn edit-linked-idea" style="padding:0;color:#555;" title="Edit Idea"><i class="ti ti-pencil"></i></button>
                <button class="icon-btn unlink-idea" style="padding:0;color:#ff4a4a;" title="Unlink Idea"><i class="ti ti-x"></i></button>
            </div>
        `;
        row.querySelector('.edit-linked-idea').addEventListener('click', () => {
            const newText = prompt('Edit idea:', displayTxt);
            if (newText) {
                idea.text = newText;
                idea.title = newText;
                saveAll();
                renderShotDetail(m);
            }
        });
        row.querySelector('.unlink-idea').addEventListener('click', () => {
            s.linkedIdeas = s.linkedIdeas.filter(id => id !== idea.id);
            idea.linkedShotId = null;
            idea.shotId = null;
            saveAll();
            renderShotDetail(m);
        });
        ideaCon.appendChild(row);
    });

    document.getElementById('sd-add-idea').addEventListener('click', () => {
        openPromptModal('NEW SHOT IDEA', 'Enter a new idea for this shot.', 'Idea Text', '', (text) => {
            if (text && text.trim()) {
                const newIdea = { id: Date.now().toString(), text: text.trim(), title: text.trim(), shotId: s.id, status: 'New' };
                proj.ideas.push(newIdea);
                s.linkedIdeas.push(newIdea.id);
                saveAll();
                renderShotDetail(m);
            }
        });
    });

    const frameCon = document.getElementById('sd-frames');
    s.frames.forEach((f, i) => {
        const card = document.createElement('div');
        card.className = 'sb-card-revamp';
        card.innerHTML = `
            <div class="sb-img-area">
                <div class="sb-num-badge">${String(i + 1).padStart(2, '0')}</div>
                <button class="sb-del-btn"><i class="ti ti-trash"></i></button>
                ${f.img ? `<img src="${f.img}">` : `<i class="ti ti-photo" style="color:#1e1e1e; font-size:24px;"></i>`}
            </div>
            <textarea class="sb-caption-input" placeholder="Caption..." oninput="this.style.height='';this.style.height=this.scrollHeight+'px'">${f.caption || ''}</textarea>
        `;
        
        // TACTICAL DELETE MODAL
        card.querySelector('.sb-del-btn').addEventListener('click', (e) => {
            e.stopPropagation(); 
            openConfirmModal('DELETE FRAME', 'Permanently delete this storyboard frame?', 'DELETE', () => {
                s.frames.splice(i, 1); 
                saveAll(); 
                renderShotDetail(m);
            });
        });
        
        const input = card.querySelector('.sb-caption-input');
        // Auto-scale it on first load if there's already text inside
        setTimeout(() => { input.style.height = ''; input.style.height = input.scrollHeight + 'px'; }, 10);
        
        input.addEventListener('blur', () => { f.caption = input.value; saveAll(); });
        card.querySelector('.sb-img-area').addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            uploadImageTrigger(b64 => { f.img = b64; saveAll(); renderShotDetail(m); });
        });
        frameCon.appendChild(card);
    });

    const addFrameBtn = document.createElement('button');
    addFrameBtn.className = 'add-frame-btn';
    addFrameBtn.innerHTML = `<i class="ti ti-plus" style="font-size:16px;"></i> ADD FRAME`;
    addFrameBtn.addEventListener('click', () => {
        s.frames.push({ id: Date.now().toString(), img: '', caption: '' });
        saveAll();
        renderShotDetail(m);
    });
    frameCon.appendChild(addFrameBtn);

    if (prevShot) { document.getElementById('sd-prev').addEventListener('click', () => nav('shot', proj.id, { shotId: prevShot.id })); }
    if (nextShot) { document.getElementById('sd-next').addEventListener('click', () => nav('shot', proj.id, { shotId: nextShot.id })); }

    document.getElementById('sd-hero').addEventListener('click', () => {
        uploadImageTrigger(b64 => { s.heroImage = b64; saveAll(); renderShotDetail(m); });
    });
}

// ─── UTILS: FILE INJECTOR & MODALS ───────────────────────────
function uploadImageTrigger(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        if (e.target.files[0]) compressImage(e.target.files[0], callback);
    };
    input.click();
}

function openModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-overlay" id="modal-overlay">${html}</div>`;
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target.id === 'modal-overlay') closeModal();
    });
}

function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
}

function openConfirmModal(title, message, confirmText, onConfirm) {
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

function openPromptModal(title, subtitle, label, initialValue, onConfirm) {
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

function openNewProjModal() {
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
        compressImage(f, (res) => {
            thumb = res;
            const lbl = document.getElementById('np-thumb-lbl');
            lbl.innerHTML = `<img src="${thumb}" alt="" draggable="false"><input type="file" accept="image/*" id="np-thumb"/>`;
            document.getElementById('np-thumb').addEventListener('change', e2 => {
                if (e2.target.files[0]) compressImage(e2.target.files[0], (res2) => {
                    thumb = res2;
                    lbl.querySelector('img').src = thumb;
                });
            });
        });
    });
    document.getElementById('np-cancel').addEventListener('click', closeModal);
    document.getElementById('np-create').addEventListener('click', () => {
        const title = document.getElementById('np-t').value.trim() || 'Untitled Project';
        const desc = document.getElementById('np-d').value.trim();

        let initialColor = BLOCK_PALETTE[Math.floor(Math.random() * BLOCK_PALETTE.length)];
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
        projects.push(p);
        saveAll();
        closeModal();
        render();
    });
}

function openAssignModal(text, existingId = null) {
    openModal(`<div class="modal modal-sm">
    <h2>Assign to a project?</h2>
    <div class="modal-preview-text">"${text.length > 44 ? text.slice(0, 44) + '…' : text}"</div>
    ${projects.map(p => `<div class="assign-opt" data-pid="${p.id}"><i class="ti ti-folder"></i>${p.title || 'Untitled'}</div>`).join('')}
    <div class="assign-divider"></div>
    <div class="assign-opt" data-pid="none"><i class="ti ti-inbox"></i>Leave unassigned</div>
    <button class="modal-cancel-link" id="assign-cancel">Cancel</button>
  </div>`);
    document.getElementById('assign-cancel').addEventListener('click', closeModal);
    document.querySelectorAll('[data-pid]').forEach(el => el.addEventListener('click', () => {
        const pid = el.dataset.pid === 'none' ? null : el.dataset.pid;

        if (existingId) {
            const ideaIndex = ideas.findIndex(i => i.id === existingId);
            if (ideaIndex > -1) {
                const idea = ideas.splice(ideaIndex, 1)[0];
                if (pid) {
                    const pr = projects.find(p => p.id === pid);
                    if (pr) { pr.ideas = pr.ideas || []; pr.ideas.push(idea); }
                } else {
                    ideas.push(idea);
                }
            }
        } else {
            const idea = { id: uid(), text: text, title: text, projectId: pid, createdAt: new Date().toISOString() };
            if (pid) {
                const pr = projects.find(p => p.id === pid);
                if (pr) { pr.ideas = pr.ideas || []; pr.ideas.push(idea); }
            } else {
                ideas.push(idea);
            }
        }

        saveAll();
        closeModal();
        if (S.view === 'dashboard') renderDashboard(document.getElementById('main'));
        else if (S.view === 'all-ideas') renderAllIdeas(document.getElementById('main'));
        else if (S.view === 'project' && S.tab === 'overview') render();
    }));
}

function openEditBriefModal(proj) {
    let thumb = proj.thumbnail;
    openModal(`<div class="modal" style="width:400px;">
    <h2>Edit project brief</h2><div class="modal-sub">Update your project details.</div>
    <div class="field"><label>Title</label><input id="eb-t" value="${proj.title || ''}"/></div>
    <div class="field"><label>Description</label><textarea id="eb-d">${proj.description || ''}</textarea></div>
    <div class="field"><label>Genre</label><input id="eb-g" value="${proj.genre || ''}"/></div>
    <div class="field"><label>Format</label><input id="eb-f" value="${proj.format || ''}"/></div>
    <div class="field"><label>Duration</label><input id="eb-dur" value="${proj.duration || ''}"/></div>
    <div class="field"><label>Status</label>
      <select id="eb-s">
        <option ${proj.status === 'Not Started' ? 'selected' : ''}>Not Started</option>
        <option ${proj.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
        <option ${proj.status === 'Complete' ? 'selected' : ''}>Complete</option>
      </select>
    </div>
    <div class="field"><label>Thumbnail</label>
      <label class="thumb-upload" id="eb-thumb-lbl">${proj.thumbnail ? `<img src="${proj.thumbnail}" alt="" draggable="false">` : '<i class="ti ti-upload"></i>Upload image'}<input type="file" accept="image/*" id="eb-thumb"/></label>
    </div>
    <div class="modal-actions">
      <button class="btn btn-ghost" id="eb-cancel">Cancel</button>
      <button class="btn btn-primary" id="eb-save">Save Changes</button>
    </div>
  </div>`);
    document.getElementById('eb-thumb').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        compressImage(f, (res) => {
            thumb = res;
            const lbl = document.getElementById('eb-thumb-lbl');
            let img = lbl.querySelector('img');
            if (!img) {
                img = document.createElement('img');
                lbl.prepend(img);
            }
            img.src = thumb;
        });
    });
    document.getElementById('eb-cancel').addEventListener('click', closeModal);
    document.getElementById('eb-save').addEventListener('click', () => {
        proj.title = document.getElementById('eb-t').value.trim() || proj.title || 'Untitled';
        proj.description = document.getElementById('eb-d').value.trim();
        proj.genre = document.getElementById('eb-g').value.trim();
        proj.format = document.getElementById('eb-f').value.trim();
        proj.duration = document.getElementById('eb-dur').value.trim();
        proj.status = document.getElementById('eb-s').value;
        proj.thumbnail = thumb;
        proj.lastEdited = new Date().toISOString();
        saveAll();
        closeModal();
        render();
    });
}

// ─── SYSTEM INITIALIZATION ───
initDB(() => {
    render();
});
// ─── DATA EXPORT & IMPORT ENGINE ────────────────────────────
document.body.addEventListener('click', e => {
    // 1. EXPORT TO FILE
    if (e.target.closest('#db-export-btn')) {
        const backupData = {
            projects: projects,
            ideas: ideas
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `StudioPM_Backup_${Date.now().toString(36).toUpperCase()}.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    }

    // 2. IMPORT FROM FILE
    if (e.target.closest('#db-import-btn')) {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = event => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (Array.isArray(importedData.projects) && Array.isArray(importedData.ideas)) {
                        openConfirmModal('RESTORE DATA', 'This will completely overwrite your current workspace with the backup file. Proceed?', 'OVERWRITE', () => {
                            projects = importedData.projects;
                            ideas = importedData.ideas;
                            saveAll();
                            render();
                        });
                    } else {
                        alert('Invalid backup file structure.');
                    }
                } catch (err) {
                    alert('Failed to parse backup file.');
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    }
});