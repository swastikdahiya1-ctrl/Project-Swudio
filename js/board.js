import { state } from './state.js';
import { uid, openConfirmModal } from './utils.js';
import { saveAll } from './db.js';

export function renderBoard(c, p) {
    c.innerHTML = `
    <div class="board-revamp" style="width:100%; height:100%; display:flex; flex-direction:column; background:var(--bg-base); position:relative; overflow:hidden;">
      <div class="page-topbar" style="padding: 24px 40px; margin-bottom:0; background: var(--bg-base); border-bottom:1px solid #141414; display:flex; justify-content:space-between; align-items:center; position:relative; z-index:20;">
        <div class="welcome">
          <h1 style="font-size:20px; font-weight:500; color:var(--text-main); text-transform:uppercase; margin:0; letter-spacing:1px;">PROJECT BOARD</h1>
          <p style="font-size:10px; color:var(--text-muted); font-family:'IBM Plex Mono', monospace; text-transform:uppercase; margin:4px 0 0 0;">${(p.title || 'Untitled Project').toUpperCase()} ENVIRONMENT</p>
        </div>
        <button id="board-clear" class="btn btn-ghost" style="border-radius:0; border:1px solid #333; color:var(--text-main); font-size:11px; padding:6px 12px; display:flex; align-items:center; gap:6px;">
          <i class="ti ti-trash"></i> CLEAR
        </button>
      </div>

      <div class="canvas-wrap" id="board-container" style="position:relative; flex:1; overflow:hidden; outline:none;" tabindex="0">
        
        <div class="canvas-toolbar" style="position:absolute; top:24px; left:50%; transform:translateX(-50%); display:flex; background:#0D0D0D; border:1px solid #222; border-radius:2px; padding:4px; gap:4px; z-index:20;">
          <button class="tool-btn ${state.S.canvasTool === 'select' ? 'active' : ''}" data-tool="select" title="Select / Move"><i class="ti ti-pointer"></i></button>
          <button class="tool-btn ${state.S.canvasTool === 'text' ? 'active' : ''}" data-tool="text" title="Add Text"><i class="ti ti-typography"></i></button>
          <button class="tool-btn ${state.S.canvasTool === 'image' ? 'active' : ''}" data-tool="image" title="Add Image"><i class="ti ti-photo"></i></button>
          <button class="tool-btn ${state.S.canvasTool === 'arrow' ? 'active' : ''}" data-tool="arrow" title="Add Arrow"><i class="ti ti-arrow-right"></i></button>
          <div style="width:1px; background:#1E1E1E; margin:0 8px;"></div>
          <button class="tool-btn ${state.S.canvasTool === 'pencil' ? 'active' : ''}" data-tool="pencil" title="Pencil"><i class="ti ti-pencil"></i></button>
          <button class="tool-btn ${state.S.canvasTool === 'eraser' ? 'active' : ''}" data-tool="eraser" title="Eraser"><i class="ti ti-eraser"></i></button>
          <div style="width:1px; background:#1E1E1E; margin:0 8px;"></div>
          <button class="tool-btn" id="board-undo" title="Undo"><i class="ti ti-arrow-back-up"></i></button>
          <button class="tool-btn" id="board-redo" title="Redo"><i class="ti ti-arrow-forward-up"></i></button>
          <div style="width:1px; background:#1E1E1E; margin:0 8px;"></div>
          <button class="tool-btn" id="board-trash" title="Delete Selected"><i class="ti ti-trash"></i></button>
        </div>

        <div class="canvas-legend" style="position:absolute; bottom:24px; left:50%; transform:translateX(-50%); background:rgba(13,13,13,0.8); border:1px solid #222; padding:8px 16px; border-radius:2px; display:flex; gap:16px; font-size:9px; color:#666; pointer-events:none; z-index:20;">
            <span><b>V</b> SELECT</span>
            <span><b>A</b> ARROW</span>
            <span><b>T</b> TEXT</span>
            <span><b>P</b> PENCIL</span>
            <span><b>E</b> ERASER</span>
        </div>

        <div class="canvas-zoom" style="position:absolute; bottom:24px; right:24px; background:#0D0D0D; border:1px solid #222; border-radius:2px; padding:4px 8px; font-size:10px; color:var(--text-muted); display:flex; align-items:center; gap:8px; z-index:20;">
            <button class="zoom-btn" id="board-zoom-out"><i class="ti ti-minus"></i></button>
            <span id="zoom-level">100%</span>
            <button class="zoom-btn" id="board-zoom-in"><i class="ti ti-plus"></i></button>
        </div>
        
        <div id="board-transform-layer" class="canvas-inner" style="position:absolute; top:0; left:0; width:100%; height:100%; transform-origin:0 0;">
            <!-- SVG for pencil paths and arrow shapes. Must fill the full canvas. -->
            <svg id="board-drawing" style="position:absolute; top:0; left:0; width:100%; height:100%; overflow:visible; pointer-events:none; z-index:1;">
                <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#D0D0D0"/>
                    </marker>
                </defs>
            </svg>
            <div id="board-elements" style="position:absolute; top:0; left:0; width:100%; height:100%; z-index:2;"></div>
        </div>

        <input type="file" id="board-img-upload" accept="image/*" style="display:none;"/>
      </div>
    </div>`;

    if (!p.projectBoardData) p.projectBoardData = { elements: [], paths: [] };
    if (!p.projectBoardData.paths) p.projectBoardData.paths = [];
    // Migrate any legacy separate arrows into the elements array
    if (p.projectBoardData.arrows && p.projectBoardData.arrows.length > 0) {
        p.projectBoardData.arrows.forEach(a => {
            p.projectBoardData.elements.push({
                id: a.id || uid(), type: 'arrow',
                x1: a.x1, y1: a.y1, x2: a.x2, y2: a.y2,
                x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2),
                w: Math.max(Math.abs(a.x2 - a.x1), 20),
                h: Math.max(Math.abs(a.y2 - a.y1), 20),
                z: p.projectBoardData.elements.length
            });
        });
        p.projectBoardData.arrows = [];
        saveAll();
    }

    let hist = [JSON.stringify(p.projectBoardData)];
    let hIdx = 0;

    const container = document.getElementById('board-container');
    const transformLayer = document.getElementById('board-transform-layer');
    const boardEls = document.getElementById('board-elements');
    const boardDrawing = document.getElementById('board-drawing');
    const zLvl = document.getElementById('zoom-level');

    let selectedElementId = null;

    function saveState() {
        p.projectBoardData.elements = p.projectBoardData.elements.filter(el => !(el.type === 'text' && !el.content.trim()));
        hist = hist.slice(0, hIdx + 1);
        hist.push(JSON.stringify(p.projectBoardData));
        hIdx++;
        p.lastEdited = new Date().toISOString();
        saveAll();
    }

    document.getElementById('board-undo').addEventListener('click', () => {
        if (hIdx > 0) { hIdx--; p.projectBoardData = JSON.parse(hist[hIdx]); saveAll(); draw(); drawPaths(); }
    });
    document.getElementById('board-redo').addEventListener('click', () => {
        if (hIdx < hist.length - 1) { hIdx++; p.projectBoardData = JSON.parse(hist[hIdx]); saveAll(); draw(); drawPaths(); }
    });

    function setTool(tool) {
        state.S.canvasTool = tool;
        document.querySelectorAll('.tool-btn[data-tool]').forEach(x => x.classList.remove('active'));
        const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
        if (btn) btn.classList.add('active');
        if (tool === 'select') {
            container.style.cursor = 'grab';
        } else if (tool === 'eraser') {
            container.style.cursor = 'cell';
        } else {
            container.style.cursor = 'crosshair';
        }
        if (tool === 'image') document.getElementById('board-img-upload').click();
    }

    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.addEventListener('click', () => {
        setTool(b.dataset.tool);
    }));

    if (window.boardKeyHandler) window.removeEventListener('keydown', window.boardKeyHandler);
    window.boardKeyHandler = e => {
        if (state.S.tab !== 'board') return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        switch (e.key.toLowerCase()) {
            case 'v': setTool('select'); break;
            case 'a': setTool('arrow'); break;
            case 't': setTool('text'); break;
            case 'p': setTool('pencil'); break;
            case 'e': setTool('eraser'); break;
        }
    };
    window.addEventListener('keydown', window.boardKeyHandler);

    document.getElementById('board-trash').addEventListener('click', () => {
        if (selectedElementId) {
            p.projectBoardData.elements = p.projectBoardData.elements.filter(x => x.id !== selectedElementId);
            selectedElementId = null;
            saveState(); draw();
        }
    });

    document.getElementById('board-clear').addEventListener('click', () => {
        openConfirmModal("Clear Canvas", "Are you sure you want to completely clear the project board? This action can be undone via the Undo button.", "Clear", () => {
            p.projectBoardData.elements = [];
            p.projectBoardData.paths = [];
            p.projectBoardData.arrows = [];
            selectedElementId = null;
            saveState(); draw(); drawPaths();
        });
    });

    document.getElementById('board-img-upload').addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        setTool('select');
        const cx = (-state.S.boardPan.x + container.clientWidth / 2) / state.S.boardZoom;
        const cy = (-state.S.boardPan.y + container.clientHeight / 2) / state.S.boardZoom;
        import('./utils.js').then(m => m.compressImage(f, r => {
            const img = new Image(); img.src = r;
            img.onload = () => {
                let w = img.width, h = img.height;
                if (w > 300) { h *= 300 / w; w = 300; }
                p.projectBoardData.elements.push({ id: uid(), type: 'image', src: r, x: cx - w / 2, y: cy - h / 2, w, h, z: p.projectBoardData.elements.length });
                saveState(); draw();
            };
        }));
    });

    const updZ = () => {
        zLvl.innerText = Math.round(state.S.boardZoom * 100) + '%';
        transformLayer.style.transform = `translate(${state.S.boardPan.x}px, ${state.S.boardPan.y}px) scale(${state.S.boardZoom})`;
    };
    document.getElementById('board-zoom-in').addEventListener('click', () => { state.S.boardZoom = Math.min(5, state.S.boardZoom + 0.1); updZ(); });
    document.getElementById('board-zoom-out').addEventListener('click', () => { state.S.boardZoom = Math.max(0.1, state.S.boardZoom - 0.1); updZ(); });
    updZ();

    let isPan = false, px = 0, py = 0;
    // Pencil state
    let isDrawingPencil = false;
    let currentPath = null;
    let livePathEl = null;
    // Eraser state
    let isErasing = false;
    let didErase = false;
    // Shape / Arrow drag state
    let isShaping = false;
    let shapeStart = null;
    let shapeDragEl = null;
    let arrowId = null;
    // Rotation state
    let isRotatingEl = false;
    let rotCenterX = 0, rotCenterY = 0;
    let origRotation = 0;
    let isResizingSide = false;

    const getPointerPos = (e) => {
        const rect = container.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - state.S.boardPan.x) / state.S.boardZoom,
            y: (e.clientY - rect.top - state.S.boardPan.y) / state.S.boardZoom
        };
    };

    // ─── Eraser: segment-level erasing. Splits paths at erased segments. ───────
    const erasePaths = (pos) => {
        const eraserRadius = 18 / state.S.boardZoom;
        const newPaths = [];

        p.projectBoardData.paths.forEach(path => {
            const pts = path.points;
            let segment = [];
            let changed = false;

            for (let i = 0; i < pts.length; i++) {
                const hit = Math.hypot(pts[i].x - pos.x, pts[i].y - pos.y) < eraserRadius;
                if (hit) {
                    changed = true;
                    // Close out the current segment (must have ≥2 pts to be a valid path)
                    if (segment.length >= 2) {
                        newPaths.push({ id: uid(), points: segment, z: path.z });
                    }
                    segment = [];
                } else {
                    segment.push(pts[i]);
                }
            }
            // Flush last segment
            if (segment.length >= 2) {
                newPaths.push({ id: changed ? uid() : path.id, points: segment, z: path.z });
            } else if (!changed) {
                // Path untouched — keep it intact
                newPaths.push(path);
            }
        });

        const before = p.projectBoardData.paths.length;
        const afterLen = newPaths.length;
        const totalPtsBefore = p.projectBoardData.paths.reduce((a, b) => a + b.points.length, 0);
        const totalPtsAfter = newPaths.reduce((a, b) => a + b.points.length, 0);

        if (afterLen !== before || totalPtsAfter !== totalPtsBefore) {
            p.projectBoardData.paths = newPaths;
            didErase = true;
            drawPaths();
        }
    };

    // ─── Mousedown ──────────────────────────────────────────────────────────────
    container.addEventListener('mousedown', e => {
        if (e.target === container || e.target === transformLayer ||
            e.target.id === 'board-elements' || e.target.id === 'board-drawing') {
            selectedElementId = null;
            document.querySelectorAll('.canvas-el').forEach(n => n.classList.remove('selected'));
        }

        const tool = state.S.canvasTool;

        // Middle/right button → pan
        if (e.button === 1 || e.button === 2) {
            isPan = true; px = e.clientX; py = e.clientY;
            container.style.cursor = 'grabbing';
            return;
        }

        if (e.button !== 0) return;

        // ── TEXT: Direct DOM injection — no draw() so focus() works synchronously ──
        if (tool === 'text') {
            e.preventDefault();
            if (e.target.closest('.canvas-el')) return;
            const pos = getPointerPos(e);
            const newId = uid();
            const newElData = { id: newId, type: 'text', content: '', x: pos.x, y: pos.y, w: 220, h: 44, z: p.projectBoardData.elements.length, fontSize: 14, rotation: 0 };
            p.projectBoardData.elements.push(newElData);

            // Build wrapper directly without calling draw()
            const wrapper = document.createElement('div');
            wrapper.className = 'canvas-el selected';
            wrapper.style.cssText = `left:${pos.x}px; top:${pos.y}px; width:220px; height:44px; z-index:${newElData.z};`;
            wrapper.dataset.id = newId;

            const ta = document.createElement('textarea');
            ta.spellcheck = false;
            ta.placeholder = 'Type here...';
            ta.style.cssText = 'width:100%; height:100%; background:transparent; border:none; resize:none; outline:none; font-family:\'IBM Plex Mono\', monospace; text-transform:uppercase; color:var(--text-main); font-size:14px; padding:4px;';

            const inner = document.createElement('div');
            inner.className = 'el-inner';
            inner.style.cssText = 'width:100%; height:100%;';
            inner.appendChild(ta);

            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'el-resize';
            resizeHandle.innerHTML = '<i class="ti ti-arrows-diagonal"></i>';

            const rotHandle = document.createElement('div');
            rotHandle.className = 'el-rotate';
            rotHandle.innerHTML = '<i class="ti ti-rotate"></i>';

            const sideHandle = document.createElement('div');
            sideHandle.className = 'el-resize-side';
            sideHandle.innerHTML = '<i class="ti ti-arrows-left-right"></i>';

            wrapper.appendChild(inner);
            wrapper.appendChild(sideHandle);
            wrapper.appendChild(resizeHandle);
            wrapper.appendChild(rotHandle);
            boardEls.appendChild(wrapper);

            selectedElementId = newId;
            setTool('select');

            ta.addEventListener('input', () => { 
                newElData.content = ta.value; 
                ta.style.height = '1px';
                newElData.h = Math.max(44, ta.scrollHeight);
                ta.style.height = '100%';
                wrapper.style.height = newElData.h + 'px';
            });
            ta.addEventListener('blur', () => {
                if (!newElData.content.trim()) {
                    p.projectBoardData.elements = p.projectBoardData.elements.filter(x => x.id !== newId);
                } else {
                    saveState();
                }
                draw(); // Clean full rebuild after done editing
            });

            // Focus synchronously — no setTimeout, no preventDefault needed
            ta.focus();
            return;
        }



        // ── ARROW (drag to draw) ──
        if (tool === 'arrow') {
            isShaping = true;
            shapeStart = getPointerPos(e);
            arrowId = uid();
            // Create a live SVG line with arrowhead as a preview
            shapeDragEl = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            shapeDragEl.setAttribute('id', 'live-arrow');
            shapeDragEl.setAttribute('x1', shapeStart.x);
            shapeDragEl.setAttribute('y1', shapeStart.y);
            shapeDragEl.setAttribute('x2', shapeStart.x);
            shapeDragEl.setAttribute('y2', shapeStart.y);
            shapeDragEl.setAttribute('stroke', '#D0D0D0');
            shapeDragEl.setAttribute('stroke-width', '2');
            shapeDragEl.setAttribute('marker-end', 'url(#arrowhead)');
            shapeDragEl.setAttribute('pointer-events', 'none');
            boardDrawing.appendChild(shapeDragEl);
            return;
        }

        // ── PENCIL ──
        if (tool === 'pencil') {
            isDrawingPencil = true;
            const pos = getPointerPos(e);
            currentPath = { id: uid(), points: [pos], z: p.projectBoardData.paths.length };
            p.projectBoardData.paths.push(currentPath);

            // Create the live SVG path element immediately (visible from first point)
            livePathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            livePathEl.setAttribute('stroke', '#D0D0D0');
            livePathEl.setAttribute('stroke-width', '3');
            livePathEl.setAttribute('fill', 'none');
            livePathEl.setAttribute('stroke-linecap', 'round');
            livePathEl.setAttribute('stroke-linejoin', 'round');
            livePathEl.setAttribute('d', `M ${pos.x} ${pos.y}`);
            boardDrawing.appendChild(livePathEl);
            return;
        }

        // ── ERASER ──
        if (tool === 'eraser') {
            isErasing = true;
            didErase = false;
            erasePaths(getPointerPos(e));
            return;
        }
    });

    // ─── Mousemove ──────────────────────────────────────────────────────────────
    window.addEventListener('mousemove', e => {
        if (isPan) {
            state.S.boardPan.x += (e.clientX - px);
            state.S.boardPan.y += (e.clientY - py);
            px = e.clientX; py = e.clientY;
            updZ();
            return;
        }

        if (isResizingSide && activeEl) {
            const dx = (e.clientX - rStartX) / state.S.boardZoom;
            activeEl.w = Math.max(44, origW + dx);
            const wrapper = document.querySelector(`.canvas-el[data-id="${activeEl.id}"]`);
            if (wrapper) {
                wrapper.style.width = activeEl.w + 'px';
                if (activeEl.type === 'text') {
                    const inner = wrapper.querySelector('textarea');
                    if (inner) {
                        inner.style.height = '1px';
                        activeEl.h = Math.max(44, inner.scrollHeight);
                        inner.style.height = '100%';
                        wrapper.style.height = activeEl.h + 'px';
                    }
                }
            }
            return;
        }

        if (isRotatingEl && activeEl) {
            const angle = Math.atan2(e.clientY - rotCenterY, e.clientX - rotCenterX) * (180 / Math.PI) + 90;
            activeEl.rotation = angle;
            const wrapper = document.querySelector(`.canvas-el[data-id="${activeEl.id}"]`);
            if (wrapper) wrapper.style.transform = `rotate(${angle}deg)`;
            return;
        }

        if (isDrawingPencil && currentPath && livePathEl) {
            const pos = getPointerPos(e);
            currentPath.points.push(pos);
            // Update live path: build the d string from all points
            const d = 'M ' + currentPath.points.map(pt => `${pt.x} ${pt.y}`).join(' L ');
            livePathEl.setAttribute('d', d);
            return;
        }

        if (isErasing) {
            erasePaths(getPointerPos(e));
            return;
        }

        if (isShaping && shapeStart) {
            const pos = getPointerPos(e);
            if (state.S.canvasTool === 'arrow' && shapeDragEl) {
                shapeDragEl.setAttribute('x2', pos.x);
                shapeDragEl.setAttribute('y2', pos.y);
            }
        }
    });

    // ─── Mouseup ────────────────────────────────────────────────────────────────
    window.addEventListener('mouseup', e => {
        if (isPan) {
            isPan = false;
            container.style.cursor = state.S.canvasTool === 'select' ? 'grab' : 'crosshair';
        }

        if (isRotatingEl) {
            isRotatingEl = false;
            activeEl = null;
            saveState();
        }

        if (isDrawingPencil) {
            isDrawingPencil = false;
            livePathEl = null;
            // Remove paths that are just a single tap (0 or 1 points)
            if (currentPath && currentPath.points.length < 2) {
                p.projectBoardData.paths = p.projectBoardData.paths.filter(path => path.id !== currentPath.id);
            }
            currentPath = null;
            saveState();
            drawPaths();
        }

        if (isErasing) {
            isErasing = false;
            if (didErase) saveState();
            didErase = false;
        }

        if (isShaping && shapeStart) {
            const pos = getPointerPos(e);
            const tool = state.S.canvasTool;

            if (tool === 'arrow') {
                // Remove the live SVG line preview
                if (shapeDragEl && shapeDragEl.parentNode) shapeDragEl.parentNode.removeChild(shapeDragEl);
                const dx = pos.x - shapeStart.x;
                const dy = pos.y - shapeStart.y;
                if (Math.hypot(dx, dy) > 10) {
                    // Store arrow as an element so it gets drag/resize like other elements
                    const x1 = shapeStart.x, y1 = shapeStart.y, x2 = pos.x, y2 = pos.y;
                    p.projectBoardData.elements.push({
                        id: arrowId, type: 'arrow',
                        x1, y1, x2, y2,
                        x: Math.min(x1, x2), y: Math.min(y1, y2),
                        w: Math.max(Math.abs(x2 - x1), 20),
                        h: Math.max(Math.abs(y2 - y1), 20),
                        z: p.projectBoardData.elements.length
                    });
                    saveState(); draw(); drawPaths();
                }
            }

            isShaping = false;
            shapeStart = null;
            shapeDragEl = null;
            arrowId = null;
        }
    });

    // ─── Wheel zoom (cursor-centric) ────────────────────────────────────────────
    container.addEventListener('wheel', e => {
        e.preventDefault();
        const oldZoom = state.S.boardZoom;
        const zoomSpeed = 0.001;
        const z = state.S.boardZoom - e.deltaY * zoomSpeed;
        state.S.boardZoom = Math.min(5, Math.max(0.1, z));
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        state.S.boardPan.x = mouseX - (mouseX - state.S.boardPan.x) * (state.S.boardZoom / oldZoom);
        state.S.boardPan.y = mouseY - (mouseY - state.S.boardPan.y) * (state.S.boardZoom / oldZoom);
        updZ();
    }, { passive: false });

    // ─── Draw all pencil paths into the SVG ─────────────────────────────────────
    function drawPaths() {
        // Clear all children except the <defs> block (which holds the arrowhead marker)
        Array.from(boardDrawing.childNodes).forEach(node => {
            if (node.nodeName !== 'defs') boardDrawing.removeChild(node);
        });

        // Pencil paths only (arrows are now DOM elements in draw())
        p.projectBoardData.paths.forEach(path => {
            if (path.points.length < 2) return;
            const d = 'M ' + path.points.map(pt => `${pt.x} ${pt.y}`).join(' L ');
            const pEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pEl.setAttribute('d', d);
            pEl.setAttribute('stroke', '#D0D0D0');
            pEl.setAttribute('stroke-width', '3');
            pEl.setAttribute('fill', 'none');
            pEl.setAttribute('stroke-linecap', 'round');
            pEl.setAttribute('stroke-linejoin', 'round');
            pEl.setAttribute('pointer-events', 'none');
            boardDrawing.appendChild(pEl);
        });
    }

    // ─── Element drag / resize state ──────────────────────────────────
    let isDraggingEl = false, startX, startY, origX, origY, origX1, origY1, origX2, origY2, activeEl;
    let isResizingEl = false, rStartX, rStartY, origW, origH, origFS;

    window.addEventListener('mousemove', e => {
        if (isDraggingEl && activeEl) {
            const dx = (e.clientX - startX) / state.S.boardZoom;
            const dy = (e.clientY - startY) / state.S.boardZoom;
            activeEl.x = origX + dx; activeEl.y = origY + dy;
            // For arrows: keep line endpoints in sync with the wrapper position
            if (activeEl.type === 'arrow') {
                activeEl.x1 = origX1 + dx; activeEl.y1 = origY1 + dy;
                activeEl.x2 = origX2 + dx; activeEl.y2 = origY2 + dy;
            }
            const wrapper = document.querySelector(`.canvas-el[data-id="${activeEl.id}"]`);
            if (wrapper) {
                wrapper.style.left = activeEl.x + 'px';
                wrapper.style.top = activeEl.y + 'px';
            }
        }
        if (isResizingEl && activeEl) {
            const dx = (e.clientX - rStartX) / state.S.boardZoom;
            const scale = Math.max(0.2, (origW + dx) / origW);
            activeEl.w = origW * scale;
            activeEl.h = origH * scale;
            if (activeEl.type === 'arrow') {
                activeEl.x1 = activeEl.x + (origX1 - origX) * scale;
                activeEl.y1 = activeEl.y + (origY1 - origY) * scale;
                activeEl.x2 = activeEl.x + (origX2 - origX) * scale;
                activeEl.y2 = activeEl.y + (origY2 - origY) * scale;
            }
            const wrapper = document.querySelector(`.canvas-el[data-id="${activeEl.id}"]`);
            if (wrapper) {
                wrapper.style.width = activeEl.w + 'px';
                wrapper.style.height = activeEl.h + 'px';
                if (activeEl.type === 'text') {
                    activeEl.fontSize = origFS * scale;
                    const inner = wrapper.querySelector('textarea');
                    if (inner) inner.style.fontSize = activeEl.fontSize + 'px';
                }
                if (activeEl.type === 'arrow') {
                    const svg = wrapper.querySelector('svg');
                    if (svg) {
                        const line = svg.querySelector('line');
                        if (line) {
                            line.setAttribute('x1', activeEl.x1 - activeEl.x);
                            line.setAttribute('y1', activeEl.y1 - activeEl.y);
                            line.setAttribute('x2', activeEl.x2 - activeEl.x);
                            line.setAttribute('y2', activeEl.y2 - activeEl.y);
                        }
                    }
                }
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingEl) { isDraggingEl = false; activeEl = null; saveState(); }
        if (isResizingEl) { isResizingEl = false; activeEl = null; saveState(); }
        if (isResizingSide) { isResizingSide = false; activeEl = null; saveState(); }
    });

    // ─── Draw DOM elements (text, image, rect) ──────────────────────────────────
    function draw() {
        boardEls.innerHTML = '';
        const sorted = [...p.projectBoardData.elements].sort((a, b) => a.z - b.z);
        sorted.forEach(el => {
            const wrapper = document.createElement('div');
            wrapper.className = `canvas-el ${selectedElementId === el.id ? 'selected' : ''}`;
            wrapper.style.left = el.x + 'px';
            wrapper.style.top = el.y + 'px';
            wrapper.style.width = el.w + 'px';
            wrapper.style.height = el.h + 'px';
            wrapper.style.zIndex = el.z;
            // For arrows: make the hit-target large enough to click, but show no border
            if (el.type === 'arrow') wrapper.style.background = 'transparent';
            wrapper.dataset.id = el.id;

            let content = '';
            if (el.type === 'text') {
                content = `<textarea spellcheck="false" placeholder="Type here..." style="width:100%; height:100%; background:transparent; border:none; resize:none; outline:none; font-family:'IBM Plex Mono', monospace; text-transform:uppercase; color:var(--text-main); font-size:${el.fontSize || 14}px; padding:4px;">${el.content}</textarea>`;
            } else if (el.type === 'image') {
                content = `<img src="${el.src}" draggable="false" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">`;
            } else if (el.type === 'arrow') {
                const lx1 = el.x1 - el.x, ly1 = el.y1 - el.y;
                const lx2 = el.x2 - el.x, ly2 = el.y2 - el.y;
                content = `<svg width="100%" height="100%" style="overflow:visible; pointer-events:none;" xmlns="http://www.w3.org/2000/svg">
                    <defs><marker id="ah-${el.id}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="#D0D0D0"/></marker></defs>
                    <line x1="${lx1}" y1="${ly1}" x2="${lx2}" y2="${ly2}" stroke="#D0D0D0" stroke-width="2" marker-end="url(#ah-${el.id})"/>
                </svg>`;
            }

            // Apply rotation if stored
            const rot = el.rotation || 0;
            wrapper.innerHTML = `
        <div class="el-inner" style="width:100%; height:100%;">
            ${content}
        </div>
        ${el.type === 'text' ? '<div class="el-drag"><i class="ti ti-arrows-move"></i></div><div class="el-resize-side"><i class="ti ti-arrows-left-right"></i></div>' : ''}
        <div class="el-resize"><i class="ti ti-arrows-diagonal"></i></div>
        <div class="el-rotate"><i class="ti ti-rotate"></i></div>
      `;
            if (rot) wrapper.style.transform = `rotate(${rot}deg)`;
            boardEls.appendChild(wrapper);

            const inner = el.type === 'text' ? wrapper.querySelector('textarea') : null;
            if (inner) {
                inner.addEventListener('input', ev => { 
                    el.content = ev.target.value; 
                    inner.style.height = '1px';
                    el.h = Math.max(44, inner.scrollHeight);
                    inner.style.height = '100%';
                    wrapper.style.height = el.h + 'px';
                });
                inner.addEventListener('blur', () => {
                    const lastState = JSON.parse(hist[hIdx]).elements || [];
                    if (el.content !== (lastState.find(x => x.id === el.id) || {}).content) saveState();
                    if (!el.content.trim()) {
                        p.projectBoardData.elements = p.projectBoardData.elements.filter(x => x.id !== el.id);
                        saveState(); draw();
                    }
                });
            }

            wrapper.addEventListener('mousedown', e => {
                if (e.target.closest('.el-resize') || e.target.closest('.el-rotate') || e.target.closest('.el-resize-side') || e.button !== 0 || state.S.canvasTool !== 'select') return;

                selectedElementId = el.id;
                document.querySelectorAll('.canvas-el').forEach(n => n.classList.remove('selected'));
                wrapper.classList.add('selected');

                // Never start a drag when the user clicks directly on the textarea — let it get focus
                if (e.target.tagName === 'TEXTAREA') return;

                isDraggingEl = true;
                activeEl = el;
                startX = e.clientX; startY = e.clientY;
                origX = el.x; origY = el.y;
                // Store original arrow endpoints so we can offset them on drag
                if (el.type === 'arrow') {
                    origX1 = el.x1; origY1 = el.y1;
                    origX2 = el.x2; origY2 = el.y2;
                }

                const maxZ = Math.max(...p.projectBoardData.elements.map(x => x.z), 0);
                if (el.z < maxZ) { el.z = maxZ + 1; wrapper.style.zIndex = el.z; }
                e.stopPropagation();
            });

            const handle = wrapper.querySelector('.el-resize');
            if (handle) {
                handle.addEventListener('mousedown', e => {
                    if (e.button !== 0 || state.S.canvasTool !== 'select') return;
                    selectedElementId = el.id;
                    document.querySelectorAll('.canvas-el').forEach(n => n.classList.remove('selected'));
                    wrapper.classList.add('selected');

                    isResizingEl = true;
                    activeEl = el;
                    rStartX = e.clientX; rStartY = e.clientY;
                    origW = el.w; origH = el.h;
                    origFS = el.fontSize || 14;
                    origX = el.x; origY = el.y;
                    if (el.type === 'arrow') {
                        origX1 = el.x1; origY1 = el.y1;
                        origX2 = el.x2; origY2 = el.y2;
                    }
                    e.stopPropagation();
                });
            }

            const sideHandle = wrapper.querySelector('.el-resize-side');
            if (sideHandle) {
                sideHandle.addEventListener('mousedown', e => {
                    if (e.button !== 0 || state.S.canvasTool !== 'select') return;
                    selectedElementId = el.id;
                    document.querySelectorAll('.canvas-el').forEach(n => n.classList.remove('selected'));
                    wrapper.classList.add('selected');

                    isResizingSide = true;
                    activeEl = el;
                    rStartX = e.clientX; rStartY = e.clientY;
                    origW = el.w; origH = el.h;
                    e.stopPropagation();
                });
            }

            // Rotate handle
            const rotHandle = wrapper.querySelector('.el-rotate');
            if (rotHandle) {
                rotHandle.addEventListener('mousedown', e => {
                    if (e.button !== 0 || state.S.canvasTool !== 'select') return;
                    selectedElementId = el.id;
                    document.querySelectorAll('.canvas-el').forEach(n => n.classList.remove('selected'));
                    wrapper.classList.add('selected');

                    isRotatingEl = true;
                    activeEl = el;
                    origRotation = el.rotation || 0;
                    // Center of wrapper in screen space
                    const rect = wrapper.getBoundingClientRect();
                    rotCenterX = rect.left + rect.width / 2;
                    rotCenterY = rect.top + rect.height / 2;
                    e.stopPropagation();
                });
            }
        });
    }

    draw();
    drawPaths();
}
