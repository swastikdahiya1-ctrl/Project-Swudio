import { state } from './state.js';
import { initDB } from './db.js';
import { renderSidebar, renderDashboard, renderAllIdeas, renderTrash, openNewProjModal } from './ui.js';
import { renderProject } from './project.js';
import { initSupabase, getCurrentUser, syncDown, isConfigured } from './sync.js';

export function nav(view, projId = null, opts = {}) {
    state.viewHistory.push(JSON.parse(JSON.stringify(state.S)));
    state.S.view = view;
    if (projId) state.S.projectId = projId;
    if (opts.tab) state.S.tab = opts.tab;
    if (opts.shotId) state.S.shotId = opts.shotId;
    else if (view === 'project' && opts.tab !== 'shots') state.S.shotId = null;
    
    // Default to projects tab in trash
    if (view === 'trash' && !state.S.trashTab) state.S.trashTab = 'projects';

    // Auto-close mobile sidebar drawer on navigation
    const appRoot = document.getElementById('app-root');
    if (appRoot) appRoot.classList.remove('sidebar-open');

    render();
}

export function render() {
    renderSidebar();

    // Update Mobile Top Bar Title
    const titleEl = document.getElementById('mobile-view-title');
    if (titleEl) {
        if (state.S.view === 'dashboard') {
            titleEl.innerText = "STUDIO PM // HOME";
        } else if (state.S.view === 'all-ideas') {
            titleEl.innerText = "STUDIO PM // IDEAS";
        } else if (state.S.view === 'trash') {
            titleEl.innerText = "STUDIO PM // ARCHIVE";
        } else if (state.S.view === 'project') {
            const p = state.projects.find(x => x.id === state.S.projectId);
            titleEl.innerText = p ? p.title.toUpperCase() : "STUDIO PM // PROJECT";
        }
    }

    const m = document.getElementById('main');
    if (!m) return;
    
    if (state.S.view === 'dashboard') {
        renderDashboard(m);
    } else if (state.S.view === 'all-ideas') {
        renderAllIdeas(m);
    } else if (state.S.view === 'trash') {
        renderTrash(m);
    } else if (state.S.view === 'project') {
        const p = state.projects.find(x => x.id === state.S.projectId);
        if (p) renderProject(m, p);
        else nav('dashboard');
    }
}

export function bootApp() {
    const splash = document.getElementById('splash-screen');
    const appRoot = document.getElementById('app-root');
    
    // 1. Render the DOM immediately.
    //    renderDashboard() builds the HTML, calls gsap.set() to hide elements,
    //    and stores the paused boot timeline in window._pendingBootTL.
    render();

    if (typeof gsap !== 'undefined' && !window._reduceMotion) {
        // 2. Double-RAF: give the browser one full paint cycle to commit the 
        //    DOM and GSAP inline styles while STILL BEHIND the solid splash screen.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                // Reveal the app container (its contents are currently opacity:0 from gsap.set)
                if (appRoot) appRoot.style.opacity = '1';

                // 3. NOW fade out the splash screen. 
                //    Any FOUC or layout shifts happened invisibly behind it.
                gsap.to(splash, {
                    opacity: 0, duration: 0.6, ease: "power2.inOut",
                    onComplete: () => {
                        if (splash) splash.style.display = 'none';
                        
                        // Remove booting class so GSAP animation can play
                        document.body.classList.remove('is-booting');

                        // 4. Play the GSAP reveal animation
                        if (window._pendingBootTL) {
                            window._pendingBootTL.play();
                            window._pendingBootTL = null;
                        }
                    }
                });
            });
        });
    } else {
        // GSAP unavailable fallback
        document.body.classList.remove('is-booting');
        if (appRoot) appRoot.style.opacity = '1';
        if (splash) {
            splash.style.transition = 'opacity 0.6s ease-in-out';
            splash.style.opacity = '0';
            const finishBoot = () => {
                if (splash) splash.style.display = 'none';
            };
            splash.addEventListener('transitionend', finishBoot, { once: true });
            setTimeout(() => {
                if (splash && splash.style.display !== 'none') finishBoot();
            }, 750);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // APPLY GLOBAL SETTINGS
    window._reduceMotion = localStorage.getItem('studio_reduce_motion') === 'true';
    if (window._reduceMotion) document.body.classList.add('reduce-motion');
    window._autoSaveDelay = parseInt(localStorage.getItem('studio_autosave_delay') || '2000');

    // Listen for custom global keybinds
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'p') { e.preventDefault(); import('./ui.js').then(ui => ui.openNewProjModal()); }
    });

    // Mobile menu drawer toggle listeners
    const menuBtn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('sidebar-overlay');
    const appRoot = document.getElementById('app-root');

    if (menuBtn && appRoot) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appRoot.classList.toggle('sidebar-open');
        });
    }

    if (overlay && appRoot) {
        overlay.addEventListener('click', () => {
            appRoot.classList.remove('sidebar-open');
        });
    }

    // Wait for BOTH the DB and fonts before booting.
    const dbPromise   = new Promise(resolve => initDB(resolve));
    const fontPromise = Promise.race([
        document.fonts.ready,
        new Promise(resolve => setTimeout(resolve, 2000)) // 2s safety cap
    ]);

    Promise.all([dbPromise, fontPromise]).then(async () => {
        initSupabase();

        const bypassAuth = sessionStorage.getItem('bypass_auth') === 'true';

        if (isConfigured() && !bypassAuth) {
            const user = await getCurrentUser();
            if (user) {
                // Sync cloud data to local IndexedDB first on boot
                await syncDown();
                bootApp();
            } else {
                // If Supabase is configured but no session exists, show login screen
                import('./ui.js').then(ui => {
                    ui.renderAuthScreen();
                });
            }
        } else {
            // Local-only fallback
            bootApp();
        }
    });
});
