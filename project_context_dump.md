# Studio PM - Project Context & Architecture Dump

This document serves as an exhaustive, dense technical context transfer containing the architecture, state layout, UI changes, and interaction systems of **Studio PM**.

---

## 1. Core Architecture & Tech Stack

Studio PM is a local-first creative pipeline management app built using a **Vanilla Trifecta** architecture.

*   **View & Routing Engine (`js/main.js`, `js/ui.js`):**
    *   No framework routers. App navigation is driven by updating the transient state `state.S.view` via the `nav(view, projectId, options)` helper, followed by calling a global `render()` function.
    *   `render()` reads the state and dynamically injects HTML strings into `div#main` using template literals.
*   **State Management (`js/state.js`):**
    *   Driven by a single exported `state` object:
        ```javascript
        export const state = {
            projects: [],             // Active project definitions
            ideas: [],                // Global ideas in global inbox
            archives: [],             // Soft-deleted entities (projects/shots) pruned after 30 days
            expandedProjectsState: [],// Sidebar open/collapsed state tracking
            viewHistory: [],          // Undo navigation stack
            S: {                      // Transient session configuration
                view: 'dashboard',
                projectId: null,
                shotId: null,
                tab: 'overview',      // 'overview', 'script', 'board', 'shots'
                canvasTool: 'select', // Project Board active tool
                vsSidebarOpen: true,
                boardPan: { x: 0, y: 0 },
                boardZoom: 1,
                shotsFilter: 'All'
            }
        };
        ```
*   **Database & Storage (`js/db.js`):**
    *   Async persistent store built with IndexedDB (`DB_NAME = 'StudioPM_DB'`, `DB_VERSION = 2`).
    *   Saves the `projects`, `ideas`, and `archives` arrays under the single `'state'` object store.
    *   Exposes a central synchronization helper `saveAll()` which updates the object store entries.
    *   Performs database migration from legacy `localStorage` values (`cpm_projects`, `cpm_ideas`) and runs data sanitization on startup (e.g. generating sequence numbers, cleaning titles, translating visual scripts from strings to array blocks).
*   **Visual Libraries & Dependencies:**
    *   **GSAP (GreenSock):** Handles load timelines and transition sequences (e.g. `splash-screen` fade out, project donut charts).
    *   **Tabler Icons:** Standardized glyph set.
    *   **Confetti:** Interactive completions (e.g. when completing checklists).

---

## 2. Recent UI Refactoring & Verification State

### Task 1: Project Board Regressions & Features (Completed & Verified)
*   **Visual Regression Fixed:** Fixed layout breaking where elements forced to the left and pointer event propagation failed. Restored exact positions, canvas layer transforms, and absolute-positioned elements.
*   **Mouse Wheel Zoom:** Altered from requiring `Ctrl + Wheel` to standard `Wheel` action. Zoom scales relative to coordinates of mouse pointer.
*   **Tool Additions:**
    *   **Trash Tool:** Deletes selected element.
    *   **Pencil Tool:** Instantiates drag-based freehand drawing vectors on SVG overlay.
    *   **Eraser Tool:** Computes point-to-point intersections within a distance radius and filters out drawing paths.
    *   **Clear Canvas:** Triggers confirmation modal dialog prior to resetting canvas arrays.
*   **Undo/Redo Stack:** Preserves history by deep-cloning canvas JSON data (`project.projectBoardData`) at mutations.

### Task 2: Shots Section Regressions & Reordering (Completed & Verified)
*   **Visual Rollback:** Rebuilt Grid and filter tabs matching `references/SHOTSmain_original`. Layout filters (All, Not Started, WIP, Complete) moved directly below heading titles.
*   **Card Specifications:**
    *   Card identifiers changed from shorthand values (e.g. `sh01`) to sequence text `"SHOT X"`.
    *   Added edit/delete control icons inside the metadata banner.
    *   Added `badge-tr` handles for card dragging.
*   **Drag-and-Drop Reordering:** HTML5 Drag-and-Drop API reorders the shots array on card drop. Display numbers recalculate sequentially (`1 to N`), while internal IDs and properties remain stable.

---

## 3. Project Board Canvas Deep-Dive

The board is a Figma-style workspace operating on dual-layer coordinates:
*   **Drawing Layer (`#board-drawing` SVG):** Renders lines as `<path>` nodes. Line coordinates are saved inside the `project.projectBoardData.paths` array as collections of raw coordinates.
*   **DOM Layer (`#board-elements` HTML):** Renders textareas, shape divs, and images wrapped inside absolute `.canvas-el` container divisions.

### Coordinate Transformation
*   Coordinate translations map screen events to canvas space via zoom factor:
    ```javascript
    const getPointerPos = (e) => {
        const rect = container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - state.S.boardPan.x) / state.S.boardZoom,
            y: (e.clientY - rect.top - state.S.boardPan.y) / state.S.boardZoom
        };
    };
    ```
*   Text boxes maintain proportional inside text layout by calculating scale deltas during resize, updating both wrapper size properties and internal style properties (`activeEl.fontSize = origFS * scale`).

---

## 4. Shots & "Inside Shot" Details Logic

### State Parameters
*   `state.S.shotsFilter` filters cards on the list screen.
*   `state.S.shotId` activates the Inside Shot detailed rendering state.

### Shot Detail View Layout & Features (`js/shots.js`)
*   **2D/3D Pipeline Toggle:** Switch updates `shot.type` field. Swapping pipeline formats triggers task creation utilizing static defaults (`CHECKLIST_3D` vs `CHECKLIST_2D` templates).
*   **Synopsis & Purpose:** Dedicated textareas for content context. Edits use debounced handlers to update database properties (500ms debounce).
*   **Storyboard Box Collection:**
    *   Outputs horizontal layout arrays for frame panels.
    *   Caption input textareas auto-resize height boundaries depending on textual volume (`ta.style.height = ta.scrollHeight + 'px'`).
*   **Shot Ideas CRUD & Reversion Mechanics:**
    *   Sub-ideas list displays dedicated tasks/notes tied to the shot card.
    *   **Reversion Rule:** Clicking the delete cross button on a shot-level idea removes the entry from the shot list (`s.ideas`) and pushes/appends it back into the general ideas directory of the parent project (`p.ideas`), preserving data.
*   **Shot Navigation:** Previous Shot / Next Shot buttons compute next-door sequence indexes using standard array offsets.

---

## 5. Coding & Styling Preferences

*   **Zero Frameworks:** Strictly pure HTML, CSS, and JS. Do not import React, Vue, Tailwind, or jQuery libraries.
*   **Sharp Visuals (Brutalist style):** Enforce strict `border-radius: 0 !important` configuration across every button, card, textbox, input element, and modal structure.
*   **No Native Dialogs:** Avoid browser-native alerts, prompts, or confirmations. Leverage custom layouts (`openModal`, `openConfirmModal`, `openPromptModal` utilities in `js/utils.js`).
*   **Animation Control:** GSAP manages complex load sequences. Disable native CSS transitions on variables animated by GSAP to avoid conflict stuttering.
*   **Checklist Strikethrough Rule:** The strikethrough decoration must span only across the text characters, not cross the entire row layout. Avoid applying `text-decoration` to blocks containing `flex: 1` directly; instead, wrap the inner text container in inline-display tags (e.g. `<span>`).
