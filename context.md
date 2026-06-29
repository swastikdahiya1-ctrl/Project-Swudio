# Project Swudio - Handoff & Development Context

This document provides a comprehensive overview of the **Project Swudio** workspace to enable quick onboarding in a new agent chat session. It details the stack, architecture, implemented features, decisions, and critical pending bugs.

---

## 🛠️ Technology Stack
1. **Frontend Core**: Vanilla HTML5, Vanilla JavaScript (ES Modules), and modern Vanilla CSS.
2. **Database & Auth (Cloud)**: Supabase (Auth + PostgreSQL database for storage).
3. **Database (Local/Offline)**: IndexedDB (implemented via `js/db.js`) for offline-first data persistence.
4. **Libraries**:
   - **GSAP (GreenSock)**: UI transitions and stagger animations.
   - **Tabler Icons (`ti-`)**: SVG icon set loaded via stylesheet.
   - **canvas-confetti**: Celebration animations on completion milestones (`lib/confetti.browser.min.js`).

---

## 🗺️ Project Structure
- `index.html`: Base template, script loader, and auth container.
- `style.css`: Premium cyber/hacker styling (dark mode, glassmorphism, IBM Plex Mono & Inter typography, CSS Grid/Flex layout, responsive design).
- `js/`:
  - `main.js`: App bootstrapper, routing system (`nav()`), and base layout renderer.
  - `state.js`: In-memory global state (`state.projects`, `state.ideas`, `state.archives`, and routing parameters).
  - `db.js`: IndexedDB engine. Manages local storage transactions, schemas, and boots app data into local state.
  - `ui.js`: Layout renderer for the sidebar, dashboard, and global UI overlays (modals, auth pages).
  - `project.js`: Overview, ideas, visual script, and board initialization inside individual projects.
  - `tasks.js`: Master project task list manager, filtering logic, and custom task elements.
  - `shots.js`: Shots management view, drag-and-drop lists, and shot progress timelines.
  - `sync.js`: Supabase auth handlers and IndexedDB <-> Cloud sync engine.

---

## ✨ Features Implemented
1. **Offline-First Storage**: IndexedDB mirrors local changes instantly. If the user chooses "Continue Offline (Local Mode)", they can use the app without cloud accounts.
2. **Dashboard**: Revamped layout listing active projects, plus a quick "Idea Inbox" at the bottom to send raw notes to your thoughts.
3. **Project Board**: Canvas tool featuring dragging, drawing pencil paths, connecting elements, erasing, and zooming.
4. **Project Tasks**:
   - Tab filters: **ALL**, **PENDING** (0 checklists completed), **IN PROGRESS** (at least 1 checklist item ticked), and **COMPLETED** (all checklists ticked).
   - Auto-expanding textareas: Replaced plain text `<input>` fields with auto-expanding textareas so long text wraps beautifully (especially on mobile/Nord CE 4).
   - Inline due dates colored by proximity (normal vs. approaching deadline).
5. **Shots Pipeline**:
   - Shot lists with interactive status cards (NOT STARTED, WIP, COMPLETE).
   - Interactive 2D/3D custom task lists.
   - **Confetti celebration** triggers in both PC and Mobile layouts when the final task of a shot is checked off.
6. **Force Cloud Save**: A dedicated **SAVE TO CLOUD** button at the footer of the sidebar which forces an immediate Supabase push with real-time feedback (SAVING, SAVED, FAILED).

---

## ⚠️ Critical Bugs & Pain Points (Priority Fixes)

### 1. Silent Cloud Sync Failures (Data Loss Root Cause)
- **Problem**: `pushProject(p, userId)`, `pushIdea(i, userId)`, and `pushArchive(a, userId)` catch errors internally (or log them to `console.error`) but **do not propagate them** back up. 
- **Consequence**: `forceCloudSync()` catches no exceptions, assumes the sync was successful, and returns `true`. The UI shows a green **SAVED** checkmark even if the Supabase push was completely rejected by Database triggers or RLS policies!
- **Fix**: Modify `pushProject` and other sync functions to throw errors on failure instead of just logging.

### 2. Destructive Data Overwrite on Sign-in/Sync-down
- **Problem**: When a user logs in, `syncDown()` runs and downloads cloud database records. If the cloud database is empty (because previous silent pushes failed), it replaces the local IndexedDB arrays with empty arrays. 
- **Consequence**: Users experience catastrophic data loss upon logging back in.
- **Fix**: Merge local data safely with cloud data based on `lastEdited` timestamps, or warn the user before overwriting non-empty local databases.

### 3. Missing Sync Columns
- **Problem**: `pushProject` currently syncs the following project fields to the database: `id`, `user_id`, `title`, `description`, `thumbnail`, `pinned`, `visualScriptBlocks`, `shots`, `ideas`, and `tasks`.
- **Consequence**: Important properties like `p.projectBoardData` (the entire drawing canvas, pencil paths, arrows, board notes), `p.tasksSort`, and `p.tasksFilter` are **completely left out** of the Supabase sync payload and are permanently lost on reload!
- **Fix**: Update the `pushProject` database schema schema and query payload to store `projectBoardData` and sorting configurations.

---

## 🚀 How to Start Developing
1. Open terminal and run `npx serve` in the project root to run locally at `http://localhost:3000`.
2. Supabase API tokens are hardcoded as defaults in `js/sync.js` (`DEFAULT_SUPABASE_URL` and `DEFAULT_SUPABASE_ANON_KEY`).
3. Make sure to check the developer tools console while editing/testing to verify if Supabase queries are rejecting any payloads.
