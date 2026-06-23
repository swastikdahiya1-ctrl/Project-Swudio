export const state = {
    projects: [],
    ideas: [],
    archives: [], // For the new Trash/Archive system
    expandedProjectsState: [],
    viewHistory: [],
    S: {
        view: 'dashboard',
        projectId: null,
        shotId: null,
        tab: 'overview',
        canvasTool: 'select',
        vsSidebarOpen: true,
        boardPan: { x: 0, y: 0 },
        boardZoom: 1,
        shotsFilter: 'All'
    }
};

export const SHOT_COLORS = ['#5588ff', '#ff5588', '#55ff88', '#f5a623', '#9b51e0', '#00bfa5', '#00bcd4'];
export const BLOCK_PALETTE = ['#5588ff', '#ff5588', '#55ff88', '#f5a623', '#9b51e0', '#00bfa5', '#00bcd4'];
export const CHECKLIST_3D = ['Storyboard', 'Blocked', 'Animation', 'Secondary Animation', 'Sound', 'Post Production', 'Export'];
export const CHECKLIST_2D = ['Storyboard', 'Rough Animation', 'Tie Down', 'Cleanup', 'Color', 'Compositing', 'Export'];
