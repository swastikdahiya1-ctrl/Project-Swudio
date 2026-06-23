import { state } from './state.js';
import { initDB } from './db.js';
import { renderSidebar, renderDashboard, renderAllIdeas, renderTrash, openNewProjModal } from './ui.js';
import { renderProject } from './project.js';

export function nav(view, projId = null, opts = {}) {
    state.viewHistory.push(JSON.parse(JSON.stringify(state.S)));
    state.S.view = view;
    if (projId) state.S.projectId = projId;
    if (opts.tab) state.S.tab = opts.tab;
    if (opts.shotId) state.S.shotId = opts.shotId;
    else if (view === 'project' && opts.tab !== 'shots') state.S.shotId = null;
    
    // Default to projects tab in trash
    if (view === 'trash' && !state.S.trashTab) state.S.trashTab = 'projects';

    render();
}

export function render() {
    renderSidebar();
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

function bootApp() {
    const splash = document.getElementById('splash-screen');
    const appRoot = document.getElementById('app-root');
    
    if (typeof gsap !== 'undefined') {
        gsap.to(splash, {
            opacity: 0, duration: 0.6, ease: "power2.inOut",
            onComplete: () => {
                if(splash) splash.style.display = 'none';

                // 1. Render while appRoot is still opacity:0.
                //    renderDashboard() calls gsap.set() to hide all elements
                //    and stores a PAUSED timeline in window._pendingBootTL.
                render();

                // 2. Double-RAF: give the browser one full paint cycle to
                //    commit the gsap.set() hidden states BEFORE we reveal
                //    the app root. Without this, the browser can paint
                //    elements at their natural positions for 1-2 frames
                //    (the visible "hitch") before GSAP hides them.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if(appRoot) appRoot.style.opacity = '1';
                        // 3. NOW play the animation — elements go from their
                        //    hidden initial state to their final positions.
                        if (window._pendingBootTL) {
                            window._pendingBootTL.play();
                            window._pendingBootTL = null;
                        }
                    });
                });
            }
        });
    } else {
        // GSAP unavailable fallback
        if (splash) {
            splash.style.transition = 'opacity 0.6s ease-in-out';
            splash.style.opacity = '0';
            const finishBoot = () => {
                splash.style.display = 'none';
                render();
                if(appRoot) appRoot.style.opacity = '1';
            };
            splash.addEventListener('transitionend', finishBoot, { once: true });
            setTimeout(() => {
                if (splash.style.display !== 'none') finishBoot();
            }, 750);
        } else {
            render();
            if(appRoot) appRoot.style.opacity = '1';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Listen for custom global keybinds
    window.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'p') { e.preventDefault(); openNewProjModal(); }
    });

    initDB(() => {
        bootApp();
    });
});
