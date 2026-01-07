document.addEventListener('DOMContentLoaded', () => {
    // --- State & Constants ---
    const STORAGE_KEY_TASKS = 'dailyTask_tasks';
    const STORAGE_KEY_USER = 'dailyTask_user';
    let currentUser = JSON.parse(localStorage.getItem(STORAGE_KEY_USER)) || null;
    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY_TASKS)) || [];
    let notificationPermission = Notification.permission;

    // --- DOM Elements ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const userAvatar = document.getElementById('user-avatar');
    const displayUsername = document.getElementById('display-username');
    const logoutBtn = document.getElementById('logout-btn');

    // Navigation
    const navItems = document.querySelectorAll('.sidebar nav li');
    const contentViews = document.querySelectorAll('.content-view');
    const pageTitle = document.getElementById('page-title');
    const currentDateEl = document.getElementById('current-date');

    // Dashboard Stats
    const countToday = document.getElementById('count-today');
    const countPending = document.getElementById('count-pending');
    const countCompleted = document.getElementById('count-completed');
    const countOverdue = document.getElementById('count-overdue');
    const dashboardTasksList = document.getElementById('dashboard-tasks');

    // Task & Modal
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskModal = document.getElementById('task-modal');
    const closeModalBtn = document.getElementById('close-modal'); // Assuming you might add this id to the 'x' or use cancel
    const cancelTaskBtn = document.getElementById('cancel-task');
    const taskForm = document.getElementById('task-form');
    const modalTitle = document.getElementById('modal-title');

    // Filter
    const filterBtns = document.querySelectorAll('.filter-btn');
    const allTasksList = document.getElementById('all-tasks-list');
    const historyList = document.getElementById('history-list');

    // Calendar
    const calendarMonthYear = document.getElementById('calendar-month-year');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    let currentCalendarDate = new Date();

    // Notifications
    const notificationBanner = document.getElementById('notification-banner');
    const enableNotificationsBtn = document.getElementById('enable-notifications');
    const dismissNotificationsBtn = document.getElementById('dismiss-notifications');

    // --- Initialization ---
    init();

    function init() {
        if (currentUser) {
            showApp();
        } else {
            showAuth();
        }
        updateDateDisplay();
        checkNotificationPermission();

        // Start "Backend" Crons
        setInterval(checkReminders, 60000); // Check every minute
    }

    // --- Auth Functions ---
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        if (username) {
            currentUser = { username: username, joined: new Date().toISOString() };
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
            showApp();
        }
    });

    logoutBtn.addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem(STORAGE_KEY_USER);
        showAuth();
    });

    function showAuth() {
        authContainer.classList.remove('hidden');
        appContainer.classList.add('hidden');
    }

    function showApp() {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        displayUsername.textContent = currentUser.username;
        userAvatar.textContent = currentUser.username.charAt(0).toUpperCase();
        renderDashboard();
    }

    // --- Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Update Active State
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Show View
            const viewId = item.dataset.view;
            contentViews.forEach(view => view.classList.add('hidden'));
            document.getElementById(`view-${viewId}`).classList.remove('hidden');

            // Update Title
            pageTitle.textContent = item.querySelector('span:last-child').textContent;

            // Refresh Data
            if (viewId === 'dashboard') renderDashboard();
            if (viewId === 'tasks') renderAllTasks();
            if (viewId === 'calendar') renderCalendar();
            if (viewId === 'history') renderHistory();
        });
    });

    function updateDateDisplay() {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        currentDateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }

    // --- Task Management ---
    function saveTasks() {
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
        renderDashboard(); // Always refresh dashboard stats
    }

    // Modal Handling
    addTaskBtn.addEventListener('click', () => openModal());
    document.getElementById('close-modal').addEventListener('click', closeModal);
    cancelTaskBtn.addEventListener('click', closeModal);

    function openModal(task = null) {
        taskModal.classList.remove('hidden');
        if (task) {
            modalTitle.textContent = 'Edit Task';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-desc').value = task.description;
            document.getElementById('task-date').value = task.date;
            document.getElementById('task-time').value = task.time;
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-status').value = task.status;
            document.getElementById('task-customer-email').value = task.customerEmail || '';
            document.getElementById('task-customer-whatsapp').value = task.customerWhatsapp || '';
            document.getElementById('task-bill-amount').value = task.billAmount || '';
        } else {
            modalTitle.textContent = 'Create New Task';
            taskForm.reset();
            document.getElementById('task-id').value = '';
            // Default to today
            document.getElementById('task-date').valueAsDate = new Date();
            document.getElementById('task-status').value = 'pending';
            document.getElementById('task-customer-email').value = '';
            document.getElementById('task-customer-whatsapp').value = '';
            document.getElementById('task-bill-amount').value = '';
        }
    }

    function closeModal() {
        taskModal.classList.add('hidden');
    }

    taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;

        const newTask = {
            id: id ? id : Date.now().toString(),
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            date: document.getElementById('task-date').value,
            time: document.getElementById('task-time').value,
            priority: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value,
            customerEmail: document.getElementById('task-customer-email').value,
            customerWhatsapp: document.getElementById('task-customer-whatsapp').value,
            billAmount: document.getElementById('task-bill-amount').value,
            createdAt: id ? tasks.find(t => t.id === id).createdAt : new Date().toISOString()
        };

        if (id) {
            // Update existing
            const index = tasks.findIndex(t => t.id === id);

            // Check if status changed to completed for notification
            if (tasks[index].status !== 'completed' && newTask.status === 'completed') {
                const username = currentUser ? currentUser.username : 'User';
                sendNotification(`Task Completed: ${newTask.title}`, `Great job ${username}!`);

                // Prompt to send client email/whatsapp
                if (newTask.customerEmail || newTask.customerWhatsapp) {
                    handleCustomerNotification(newTask);
                }
            }

            tasks[index] = newTask;
        } else {
            // Create new
            tasks.push(newTask);
        }

        saveTasks();
        closeModal();

        // Refresh current view
        const activeView = document.querySelector('.sidebar nav li.active').dataset.view;
        if (activeView === 'tasks') renderAllTasks();
        else if (activeView === 'calendar') renderCalendar();
        else if (activeView === 'history') renderHistory();
    });

    // --- Rendering Logic ---

    function getTaskStatusClass(task) {
        // Calculate overdue
        const dueDateTime = new Date(`${task.date}T${task.time}`);
        const now = new Date();

        if (task.status === 'completed') return 'completed';
        if (task.status !== 'completed' && dueDateTime < now) return 'overdue';
        return task.status;
    }

    function renderTaskItem(task) {
        const isOverdue = getTaskStatusClass(task) === 'overdue';
        const statusDisplay = isOverdue ? 'Overdue' : task.status.replace('-', ' ');
        const statusColor = isOverdue ? 'red' : (task.status === 'completed' ? 'green' : (task.status === 'in-progress' ? 'blue' : 'gray'));

        return `
            <div class="task-item" style="border-left: 4px solid var(--${task.priority === 'high' ? 'danger' : (task.priority === 'medium' ? 'warning' : 'success')}-color)">
                <div class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}" onclick="toggleTaskStatus('${task.id}')">
                    ${task.status === 'completed' ? '<span class="material-symbols-rounded" style="font-size: 18px; color: white;">check</span>' : ''}
                </div>
                <div class="task-details">
                    <div class="task-title" style="${task.status === 'completed' ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${task.title}</div>
                    <div class="task-meta">
                        <span><span class="material-symbols-rounded" style="font-size: 14px;">calendar_today</span> ${task.date} ${task.time}</span>
                        <span class="priority-badge priority-${task.priority}">${task.priority}</span>
                        <span style="color: ${statusColor}; text-transform: capitalize;">${statusDisplay}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="icon-btn" onclick="editTask('${task.id}')"><span class="material-symbols-rounded">edit</span></button>
                    <button class="icon-btn btn-delete" onclick="deleteTask('${task.id}')"><span class="material-symbols-rounded">delete</span></button>
                </div>
            </div>
        `;
    }

    function renderDashboard() {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        const todayTasks = tasks.filter(t => t.date === todayStr && t.status !== 'completed');
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const overdueTasks = tasks.filter(t => {
            const due = new Date(`${t.date}T${t.time}`);
            return t.status !== 'completed' && due < now;
        });

        countToday.innerText = todayTasks.length;
        countPending.innerText = pendingTasks.length;
        countCompleted.innerText = completedTasks.length;
        countOverdue.innerText = overdueTasks.length;

        // Render Today's List
        if (todayTasks.length > 0) {
            dashboardTasksList.innerHTML = todayTasks.map(renderTaskItem).join('');
        } else {
            dashboardTasksList.innerHTML = '<div class="empty-state" style="text-align:center; padding: 20px; color: var(--text-secondary);">No active tasks for today!</div>';
        }
    }

    function renderAllTasks(filter = 'all') {
        let filteredCallback = () => true;
        if (filter === 'pending') filteredCallback = t => t.status === 'pending';
        if (filter === 'in-progress') filteredCallback = t => t.status === 'in-progress';
        if (filter === 'completed') filteredCallback = t => t.status === 'completed';

        const filtered = tasks.filter(filteredCallback);
        allTasksList.innerHTML = filtered.length ? filtered.map(renderTaskItem).join('') : '<div class="empty-state" style="text-align:center; padding: 20px;">No tasks found.</div>';
    }

    function renderHistory() {
        const completed = tasks.filter(t => t.status === 'completed').sort((a, b) => new Date(b.date) - new Date(a.date));
        historyList.innerHTML = completed.length ? completed.map(renderTaskItem).join('') : '<div class="empty-state" style="text-align:center; padding: 20px;">No task history yet.</div>';
    }

    // Filter Buttons Logic
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderAllTasks(btn.dataset.filter);
        });
    });

    // --- Global Functions (Exposed to window for HTML onclicks) ---
    window.toggleTaskStatus = function (id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            if (task.status === 'completed') {
                task.status = 'pending'; // Re-open
            } else {
                task.status = 'completed';
                const username = currentUser ? currentUser.username : 'User';
                sendNotification(`Task Completed`, `Great job ${username}! You finished '${task.title}'!`);

                // Prompt to send client email/whatsapp
                if (task.customerEmail || task.customerWhatsapp) {
                    setTimeout(() => handleCustomerNotification(task), 500);
                }
            }
            saveTasks();
        }
    };

    window.editTask = function (id) {
        const task = tasks.find(t => t.id === id);
        if (task) openModal(task);
    };

    window.deleteTask = function (id) {
        if (confirm('Are you sure you want to delete this task?')) {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();

            // Refresh
            const activeView = document.querySelector('.sidebar nav li.active').dataset.view;
            if (activeView === 'dashboard') renderDashboard();
            if (activeView === 'tasks') renderAllTasks();
            if (activeView === 'calendar') renderCalendar();
            if (activeView === 'history') renderHistory();
        }
    };

    // --- Calendar Logic ---
    function renderCalendar() {
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();

        // Month names
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

        // Days calculation
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayIndex = firstDay.getDay(); // 0 = Sunday

        calendarGrid.innerHTML = '';

        // Headers (S M T W T F S) could be added to HTML statically
        const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        dayHeaders.forEach(d => {
            const el = document.createElement('div');
            el.style.textAlign = 'center';
            el.style.color = 'var(--text-secondary)';
            el.style.marginBottom = '8px';
            el.innerText = d;
            calendarGrid.appendChild(el);
        });

        // Empty slots
        for (let i = 0; i < startDayIndex; i++) {
            const el = document.createElement('div');
            calendarGrid.appendChild(el);
        }

        // Days
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTasks = tasks.filter(t => t.date === dateStr);
            const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

            const dayEl = document.createElement('div');
            dayEl.className = `calendar-day ${isToday ? 'today' : ''} ${dayTasks.length ? 'has-task' : ''}`;

            let dotsHtml = '';
            if (dayTasks.length > 0) {
                const pendingCount = dayTasks.filter(t => t.status !== 'completed').length;
                if (pendingCount > 0) dotsHtml = `<span class="dots"><span class="dot"></span></span>`;
            }

            dayEl.innerHTML = `<span>${day}</span>${dotsHtml}`;
            calendarGrid.appendChild(dayEl);
        }
    }

    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar();
    });


    // --- Notifications System ---
    function checkNotificationPermission() {
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification");
        } else if (Notification.permission === "default") {
            notificationBanner.classList.remove('hidden');
        }
    }

    enableNotificationsBtn.addEventListener('click', () => {
        Notification.requestPermission().then(permission => {
            notificationPermission = permission;
            if (permission === 'granted') {
                new Notification("Notifications Enabled", { body: "You will now receive task reminders!" });
            }
            notificationBanner.classList.add('hidden');
        });
    });

    dismissNotificationsBtn.addEventListener('click', () => {
        notificationBanner.classList.add('hidden');
    });

    function sendNotification(title, body) {
        if (Notification.permission === "granted") {
            new Notification(title, { body: body, icon: 'https://cdn-icons-png.flaticon.com/512/9329/9329869.png' });
        }
    }

    function checkReminders() {
        const now = new Date();
        tasks.forEach(task => {
            if (task.status === 'completed') return;

            const dueTime = new Date(`${task.date}T${task.time}`);
            const timeDiff = dueTime - now;

            // Notify if due in 15 minutes (approx 900000ms)
            // Logic: if diff is between 14min and 15min, alert. 
            // Better: store 'notified' flag for the specific reminder type.
            // For simplicity in this demo: strict window check or assumes browser is open.

            // Check for Exact Overdue (within last minute)
            if (timeDiff < 0 && timeDiff > -60000 && !task.overdueNotified) {
                sendNotification(`Task Overdue: ${task.title}`, `This task was due at ${task.time}`);
                task.overdueNotified = true;
                saveTasks();
            }

            // Check for Upcoming (15 min before)
            if (timeDiff > 0 && timeDiff < 900000 && !task.upcomingNotified) {
                sendNotification(`Upcoming Task: ${task.title}`, `Due in 15 minutes!`);
                task.upcomingNotified = true;
                saveTasks();
            }
        });
    }

    function handleCustomerNotification(task) {
        const hasEmail = !!task.customerEmail;
        const hasWhatsapp = !!task.customerWhatsapp;
        const billAmount = task.billAmount ? `Amount: ₹${task.billAmount}` : '';

        let msg = `Task "${task.title}" is done. Notify customer via:`;
        if (hasEmail) msg += `\n- Email (${task.customerEmail})`;
        if (hasWhatsapp) msg += `\n- WhatsApp (${task.customerWhatsapp})`;

        if (!confirm(msg)) return;

        // WhatsApp
        if (hasWhatsapp) {
            let waBody = `Hello, your task "${task.title}" is successfully completed.`;
            if (billAmount) waBody += `\n\nTotal Bill: ${billAmount}\nPlease make the payment.`;

            const waUrl = `https://wa.me/${task.customerWhatsapp}?text=${encodeURIComponent(waBody)}`;
            window.open(waUrl, '_blank');
        }

        // Email
        if (hasEmail) {
            const subject = `Task Completed: ${task.title}`;
            let body = `Hello,\n\nWe are pleased to inform you that your assigned task "${task.title}" has been successfully completed.\n\nTask Details:\n- Title: ${task.title}\n- Completed On: ${new Date().toLocaleDateString()}`;

            if (billAmount) {
                body += `\n\n--------------------------------\nINVOICE DETAILS\n--------------------------------\n${billAmount}\nStatus: Due\n\nPlease make the payment at your earliest convenience.`;
            }

            body += `\n\nThank you for your business.\n\nBest regards,\n${currentUser ? currentUser.username : 'Management Team'}`;
            window.location.href = `mailto:${task.customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    }

    // Initial Render call
    if (currentUser) renderDashboard();
});
