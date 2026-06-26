import { state } from './state.js';
import { saveAll } from './db.js';
import { uid, openConfirmModal } from './utils.js';

export function renderProjectTasks(m, p) {
    if (!p.tasks) p.tasks = [];
    if (!p.tasksSort) p.tasksSort = 'due_date';
    if (!p.tasksFilter) p.tasksFilter = 'all';

    // Update computed 'completed' state for all tasks BEFORE rendering so tabs reflect correct counts
    p.tasks.forEach(t => {
        if (t.checklists && t.checklists.length > 0) {
            t.completed = t.checklists.every(c => c.done);
        } else {
            t.completed = false; // Cannot complete if no checklists
        }
    });

    m.innerHTML = `
    <div class="page" style="padding: 40px; max-width: 900px; padding-bottom:100px;">
        <div style="margin-bottom: 32px; display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
                <div style="font-size: 16px; font-weight: 600; color: #DDDDDE; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">PROJECT TASKS</div>
                <div style="font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 1px;">STAY ON TOP OF WHAT NEEDS TO GET DONE.</div>
            </div>
            <button class="btn btn-ghost" id="new-task-btn" style="font-size:10px; padding:6px 12px;"><i class="ti ti-plus"></i> NEW TASK</button>
        </div>
        
        <div class="tasks-bar" style="display:flex; justify-content:space-between; border-bottom:1px solid #161616; padding-bottom:12px; margin-bottom:24px;">
            <div class="tasks-tabs" style="display:flex; gap:24px;">
                <button class="task-tab-btn ${p.tasksFilter === 'all' ? 'active' : ''}" data-filter="all">ALL <span class="count">${p.tasks.length}</span></button>
                <button class="task-tab-btn ${p.tasksFilter === 'pending' ? 'active' : ''}" data-filter="pending">PENDING <span class="count">${p.tasks.filter(t => !t.completed).length}</span></button>
                <button class="task-tab-btn ${p.tasksFilter === 'inprogress' ? 'active' : ''}" data-filter="inprogress">IN PROGRESS <span class="count">${p.tasks.filter(t => t.checklists && t.checklists.some(c => c.done) && !t.completed).length}</span></button>
                <button class="task-tab-btn ${p.tasksFilter === 'completed' ? 'active' : ''}" data-filter="completed">COMPLETED <span class="count">${p.tasks.filter(t => t.completed).length}</span></button>
            </div>
            <div class="tasks-sort" style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:10px; color:#555; text-transform:uppercase;">SORT BY:</span>
                <select id="tasks-sort-sel" style="background:transparent; border:none; color:#DDDDDE; font-family:'IBM Plex Mono', monospace; font-size:10px; outline:none; cursor:pointer;">
                    <option value="due_date" ${p.tasksSort === 'due_date' ? 'selected' : ''}>DUE DATE</option>
                    <option value="manual" ${p.tasksSort === 'manual' ? 'selected' : ''}>MANUAL</option>
                </select>
            </div>
        </div>

        <div id="tasks-list" class="tasks-list"></div>
    </div>
    `;

    m.querySelectorAll('.task-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            p.tasksFilter = e.currentTarget.dataset.filter;
            saveAll();
            renderProjectTasks(m, p);
        });
    });

    const sortSel = m.querySelector('#tasks-sort-sel');
    if (sortSel) {
        sortSel.addEventListener('change', (e) => {
            p.tasksSort = e.target.value;
            saveAll();
            renderProjectTasks(m, p);
        });
    }

    const newTaskBtn = m.querySelector('#new-task-btn');
    if (newTaskBtn) {
        newTaskBtn.addEventListener('click', () => {
        const d = new Date();
        d.setDate(d.getDate() + 7); // Default due date 7 days from now
        const newTask = {
            id: uid(),
            title: '', // Empty title so placeholder shows
            completed: false,
            dueDate: d.toISOString(),
            checklists: []
        };
        p.tasks.push(newTask);
        saveAll();
        renderProjectTasks(m, p);
        });
    }

    renderTasksList(m, p);
}

function renderTasksList(m, p) {
    const listCon = m.querySelector('.tasks-list');
    if (!listCon) return;

    listCon.innerHTML = '';
    
    // Note: t.completed is already updated in renderProjectTasks

    let filtered = p.tasks.filter(t => {
        if (p.tasksFilter === 'all') return true;
        if (p.tasksFilter === 'pending') return !t.completed;
        if (p.tasksFilter === 'completed') return t.completed;
        if (p.tasksFilter === 'inprogress') {
            return !t.completed && t.checklists && t.checklists.some(c => c.done);
        }
        return true;
    });

    if (p.tasksSort === 'due_date') {
        filtered.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    }

    if (filtered.length === 0) {
        listCon.innerHTML = '<div style="color:#555; font-size:10px; padding:20px 0;">NO TASKS FOUND.</div>';
        return;
    }

    filtered.forEach((task, index) => {
        const taskEl = document.createElement('div');
        taskEl.className = 'task-block' + (task.completed ? ' completed' : '');
        taskEl.dataset.id = task.id;
        
        // Due Date coloring
        const now = new Date();
        const dDate = new Date(task.dueDate);
        const diffDays = (dDate - now) / (1000 * 60 * 60 * 24);
        let dateColorClass = '';
        if (!task.completed) {
            if (diffDays <= 3) {
                dateColorClass = 'approaching'; // Red
            } else {
                dateColorClass = 'normal'; // White
            }
        } else {
            dateColorClass = 'done'; // Greenish
        }

        const dateStr = dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let checklistHTML = '';
        (task.checklists || []).forEach((c, cIdx) => {
            checklistHTML += `
                <div class="task-checklist-item" data-cidx="${cIdx}">
                    <div class="task-circle sm ${c.done ? 'checked' : ''}"><i class="ti ti-check"></i></div>
                    <textarea rows="1" class="checklist-input ${c.done ? 'done-text' : ''}" placeholder="Checklist item..." style="resize:none; overflow:hidden;">${c.text || ''}</textarea>
                    <button class="icon-btn del-check-btn"><i class="ti ti-trash"></i></button>
                </div>
            `;
        });

        // The master circle is completely derived and un-clickable
        taskEl.innerHTML = `
            <div class="task-header">
                <div class="task-circle derived ${task.completed ? 'checked' : ''}"><i class="ti ti-check"></i></div>
                <textarea rows="1" class="task-title-input ${task.completed ? 'done-text' : ''}" placeholder="New Task" style="resize:none; overflow:hidden;">${task.title || ''}</textarea>
                <div style="flex:1;"></div>
                <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin-right:16px;">
                    <div style="font-size:8px; color:#555; text-transform:uppercase; letter-spacing:1px;">DUE DATE</div>
                    <input type="date" class="task-date-input ${dateColorClass}" value="${dDate.toISOString().split('T')[0]}" />
                </div>
                <div class="task-actions">
                    <button class="icon-btn del-task-btn" style="color:#cc5555;"><i class="ti ti-trash"></i></button>
                </div>
            </div>
            <div class="task-checklists">
                ${checklistHTML}
                <div class="task-checklist-add">
                    <button class="btn btn-ghost add-check-btn" style="font-size:9px; padding:4px 8px; border:none; color:#555;"><i class="ti ti-plus"></i> ADD ITEM</button>
                </div>
            </div>
        `;

        listCon.appendChild(taskEl);

        const titleInp = taskEl.querySelector('.task-title-input');
        titleInp.addEventListener('change', (e) => {
            task.title = e.target.value;
            saveAll();
        });
        titleInp.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        // Init height
        setTimeout(() => {
            titleInp.style.height = 'auto';
            titleInp.style.height = titleInp.scrollHeight + 'px';
        }, 0);

        const dateInp = taskEl.querySelector('.task-date-input');
        dateInp.addEventListener('change', (e) => {
            if(e.target.value) {
                task.dueDate = new Date(e.target.value).toISOString();
                saveAll();
                renderProjectTasks(m, p);
            }
        });

        taskEl.querySelector('.del-task-btn').addEventListener('click', () => {
            openConfirmModal("Delete Task", "Are you sure you want to delete this task?", "Delete", () => {
                p.tasks = p.tasks.filter(t => t.id !== task.id);
                saveAll();
                renderProjectTasks(m, p);
            });
        });

        taskEl.querySelector('.add-check-btn').addEventListener('click', () => {
            if(!task.checklists) task.checklists = [];
            task.checklists.push({ text: '', done: false });
            saveAll();
            renderProjectTasks(m, p);
        });

        taskEl.querySelectorAll('.task-checklist-item').forEach(cEl => {
            const idx = parseInt(cEl.dataset.cidx);
            cEl.querySelector('.task-circle.sm').addEventListener('click', () => {
                task.checklists[idx].done = !task.checklists[idx].done;
                saveAll();
                renderProjectTasks(m, p);
            });
            const chkInp = cEl.querySelector('.checklist-input');
            chkInp.addEventListener('change', (e) => {
                task.checklists[idx].text = e.target.value;
                saveAll();
            });
            chkInp.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = this.scrollHeight + 'px';
            });
            // Init height
            setTimeout(() => {
                chkInp.style.height = 'auto';
                chkInp.style.height = chkInp.scrollHeight + 'px';
            }, 0);
            cEl.querySelector('.del-check-btn').addEventListener('click', () => {
                task.checklists.splice(idx, 1);
                saveAll();
                renderProjectTasks(m, p);
            });
        });
    });

    if (p.tasksSort === 'manual' && typeof Draggable !== 'undefined') {
        Draggable.create('.task-block', {
            type: 'y',
            bounds: '.tasks-list',
            onDragStart: function() {
                this.target.classList.add('dragging');
            },
            onDragEnd: function() {
                this.target.classList.remove('dragging');
                // Basic reorder logic for DOM to array mapping
                const blocks = Array.from(listCon.querySelectorAll('.task-block'));
                // Sort blocks based on vertical position
                blocks.sort((a, b) => {
                    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
                });
                
                const newOrderIds = blocks.map(b => b.dataset.id);
                const newTasks = [];
                newOrderIds.forEach(id => {
                    const t = p.tasks.find(x => x.id === id);
                    if(t) newTasks.push(t);
                });
                // Add any missing tasks back just in case filters were applied
                p.tasks.forEach(t => {
                    if(!newTasks.includes(t)) newTasks.push(t);
                });
                p.tasks = newTasks;
                saveAll();
                renderProjectTasks(m, p);
            }
        });
    }
}
