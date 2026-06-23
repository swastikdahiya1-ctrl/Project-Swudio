import { state } from './state.js';
import { saveAll } from './db.js';

// ─── PERMANENT HOSTING CREDENTIALS ───
// Paste your Supabase project keys here to make the login screen load by default for everyone
const DEFAULT_SUPABASE_URL = "https://gqmqfennyioguszfgkte.supabase.co"; 
const DEFAULT_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbXFmZW5ueWlvZ3VzemZna3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjk5MzgsImV4cCI6MjA5NzgwNTkzOH0.q1WmS9rMSLT758eMlfBeoUL9n4rVqI7LL_IgIe7iOg4";

let supabaseClient = null;

export function isConfigured() {
    const url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
    const key = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;
    return !!(url && key);
}

export function saveConfig(url, key) {
    localStorage.setItem('supabase_url', url.trim());
    localStorage.setItem('supabase_anon_key', key.trim());
    supabaseClient = null; // Force re-initialization
    return initSupabase();
}

export function initSupabase() {
    if (supabaseClient) return supabaseClient;
    
    const url = localStorage.getItem('supabase_url') || DEFAULT_SUPABASE_URL;
    const key = localStorage.getItem('supabase_anon_key') || DEFAULT_SUPABASE_ANON_KEY;
    
    if (url && key && window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(url, key);
            console.log("Supabase Client initialized successfully.");
        } catch (e) {
            console.error("Failed to initialize Supabase client:", e);
        }
    }
    return supabaseClient;
}

export function getClient() {
    if (!supabaseClient) initSupabase();
    return supabaseClient;
}

export async function getCurrentUser() {
    const supabase = getClient();
    if (!supabase) return null;
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) return null;
        return user;
    } catch (e) {
        return null;
    }
}

export async function signUp(email, password) {
    const supabase = getClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

export async function signIn(email, password) {
    const supabase = getClient();
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
}

export async function signOut() {
    sessionStorage.removeItem('bypass_auth');
    const supabase = getClient();
    if (supabase) {
        try {
            await supabase.auth.signOut();
        } catch(e) {}
    }
    // Clear local cache state to prevent data leakage between logins
    state.projects = [];
    state.ideas = [];
    state.archives = [];
    saveAll();
}

// ─── CLOUD DELETION TRIGGERS ───
export async function deleteProjectFromCloud(pid) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('projects').delete().eq('id', pid);
    if (error) console.error("Error deleting project from cloud:", error);
}

export async function deleteIdeaFromCloud(iid) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('ideas').delete().eq('id', iid);
    if (error) console.error("Error deleting idea from cloud:", error);
}

export async function deleteArchiveFromCloud(aid) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('archives').delete().eq('id', aid);
    if (error) console.error("Error deleting archive from cloud:", error);
}

// ─── CLOUD SYNC OPERATIONS ───
export async function deleteUserAccount() {
    const supabase = getClient();
    if (!supabase) return;
    const user = await getCurrentUser();
    if (!user) return;
    
    // Wipe their data from tables
    await supabase.from('projects').delete().eq('user_id', user.id);
    await supabase.from('ideas').delete().eq('user_id', user.id);
    await supabase.from('archives').delete().eq('user_id', user.id);
    
    // Attempt to call delete_user RPC if it exists
    try {
        await supabase.rpc('delete_user');
    } catch(e) {}
    
    await signOut();
}
async function pushProject(p, userId) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('projects').upsert({
        id: p.id,
        user_id: userId,
        title: p.title || 'UNTITLED',
        description: p.description || '',
        thumbnail: p.thumbnail || '',
        pinned: !!p.pinned,
        visualScriptBlocks: p.visualScriptBlocks || [],
        shots: p.shots || [],
        ideas: p.ideas || [],
        lastEdited: p.lastEdited || new Date().toISOString()
    });
    if (error) console.error(`Error syncing project ${p.id}:`, error);
}

async function pushIdea(i, userId) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('ideas').upsert({
        id: i.id,
        user_id: userId,
        text: i.text || '',
        created_at: i.created_at || new Date().toISOString()
    });
    if (error) console.error(`Error syncing idea ${i.id}:`, error);
}

async function pushArchive(a, userId) {
    const supabase = getClient();
    if (!supabase) return;
    const { error } = await supabase.from('archives').upsert({
        id: a.data.id,
        user_id: userId,
        type: a.type || 'project',
        originalData: a.data || {},
        archivedAt: a.archivedAt || new Date().toISOString()
    });
    if (error) console.error(`Error syncing archive ${a.data.id}:`, error);
}

let syncTimeout = null;
export function triggerCloudSync() {
    const supabase = getClient();
    if (!supabase) return;
    
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        const user = await getCurrentUser();
        if (!user) return;
        
        console.log("Triggering background cloud sync...");
        // Sync all local records to Supabase
        for (const p of state.projects) {
            await pushProject(p, user.id);
        }
        for (const i of state.ideas) {
            await pushIdea(i, user.id);
        }
        for (const a of state.archives) {
            await pushArchive(a, user.id);
        }
        console.log("Background cloud sync complete.");
    }, window._autoSaveDelay || 2000);
}

export async function syncDown() {
    const supabase = getClient();
    if (!supabase) return false;
    const user = await getCurrentUser();
    if (!user) return false;

    console.log("Syncing down user data from cloud...");
    try {
        const [pRes, iRes, aRes] = await Promise.all([
            supabase.from('projects').select('*'),
            supabase.from('ideas').select('*'),
            supabase.from('archives').select('*')
        ]);

        if (pRes.error) throw pRes.error;
        if (iRes.error) throw iRes.error;
        if (aRes.error) throw aRes.error;

        state.projects = pRes.data || [];
        state.ideas = iRes.data || [];
        state.archives = (aRes.data || []).map(a => ({
            type: a.type,
            data: a.originalData,
            archivedAt: a.archivedAt
        }));

        // Save downloaded state locally to IndexedDB
        saveAll();
        console.log("Sync down completed successfully.");
        return true;
    } catch (e) {
        console.error("Failed to sync down database from cloud:", e);
        return false;
    }
}
