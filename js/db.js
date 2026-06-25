import { state, CHECKLIST_3D, CHECKLIST_2D, BLOCK_PALETTE } from './state.js';
import { uid } from './utils.js';
import { triggerCloudSync } from './sync.js';

const DB_NAME = 'StudioPM_DB';
const DB_VERSION = 2; // Incremented for archives support
let db = null;

export function makeChecklist(type) {
    return (type === '3D' ? CHECKLIST_3D : CHECKLIST_2D).map(l => ({ id: uid(), text: l, done: false }));
}

export function initDB(callback) {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
        const database = e.target.result;
        if (!database.objectStoreNames.contains('state')) {
            database.createObjectStore('state');
        }
    };
    request.onsuccess = (e) => {
        db = e.target.result;
        loadMasterData(callback);
    };
    request.onerror = (e) => {
        console.error('Database initialization failed. Check browser privacy settings.', e);
        // Fallback for when IndexedDB is completely blocked
        alert("CRITICAL ERROR: IndexedDB is blocked. App cannot save data. Check privacy settings.");
    };
}

function loadMasterData(callback) {
    const tx = db.transaction(['state'], 'readonly');
    const store = tx.objectStore('state');
    const reqP = store.get('projects');
    const reqI = store.get('ideas');
    const reqA = store.get('archives');

    let loadedP = null, loadedI = null, loadedA = null;
    reqP.onsuccess = () => { loadedP = reqP.result; };
    reqI.onsuccess = () => { loadedI = reqI.result; };
    reqA.onsuccess = () => { loadedA = reqA.result; };

    tx.oncomplete = () => {
        // Migration from legacy localStorage projects and ideas on clean IndexedDB
        if (!loadedP) {
            try {
                const oldP = localStorage.getItem('cpm_projects');
                const oldI = localStorage.getItem('cpm_ideas');
                if (oldP) loadedP = JSON.parse(oldP);
                if (oldI) loadedI = JSON.parse(oldI);
            } catch (err) { }
        }

        state.projects = Array.isArray(loadedP) ? loadedP : [];
        state.ideas = Array.isArray(loadedI) ? loadedI : [];
        state.archives = Array.isArray(loadedA) ? loadedA : [];

        sanitizeRecords();
        callback();
    };
}

function sanitizeRecords() {
    if (!Array.isArray(state.projects)) state.projects = [];
    if (!Array.isArray(state.ideas)) state.ideas = [];
    if (!Array.isArray(state.archives)) state.archives = [];

    // Purge archives older than 30 days
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    state.archives = state.archives.filter(item => {
        const archivedAt = new Date(item.archivedAt).getTime();
        return (now - archivedAt) < thirtyDays;
    });

    state.projects.forEach(p => {
        if (p.pinned === undefined) p.pinned = false;
        if (!p.shots) p.shots = [];
        if (!p.tasks) p.tasks = [];
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

export function saveAll() {
    if (!db) return;
    const tx = db.transaction(['state'], 'readwrite');
    const store = tx.objectStore('state');
    store.put(state.projects, 'projects');
    store.put(state.ideas, 'ideas');
    store.put(state.archives, 'archives');
    triggerCloudSync();
}
