const STORAGE_KEYS = {
  plans: 'one-for-all-plans-v1',
  logs: 'one-for-all-logs-v1',
  settings: 'one-for-all-bottom-nav-v1'
};

const defaultBottomNav = [
  'today',
  'schedule',
  'timer',
  'records',
  'review',
  'settings'
];

const labels = {
  today: '今日',
  schedule: '日程',
  timer: 'タイマー',
  records: '記録',
  goals: '目標',
  rocket: 'ロケット',
  review: '振り返り',
  settings: '設定'
};

const state = {
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: new Date(),
  currentPage: 'today',
  timerSeconds: 0,
  timerRunning: false,
  timerIntervalId: null,
  bottomNav: loadSettings()
};

const holidayMap = new Map([
  ['2025-01-01', '元日'], ['2025-01-13', '成人の日'], ['2025-02-11', '建国記念の日'], ['2025-02-23', '天皇誕生日'], ['2025-03-21', '春分の日'], ['2025-04-29', '昭和の日'], ['2025-05-03', '憲法記念日'], ['2025-05-04', 'みどりの日'], ['2025-05-05', 'こどもの日'], ['2025-07-21', '海の日'], ['2025-08-11', '山の日'], ['2025-09-22', '敬老の日'], ['2025-10-13', 'スポーツの日'], ['2025-11-03', '文化の日'], ['2025-11-23', '勤労感謝の日'],
  ['2026-01-01', '元日'], ['2026-01-12', '成人の日'], ['2026-02-11', '建国記念の日'], ['2026-02-23', '天皇誕生日'], ['2026-03-20', '春分の日'], ['2026-04-29', '昭和の日'], ['2026-05-03', '憲法記念日'], ['2026-05-04', 'みどりの日'], ['2026-05-05', 'こどもの日'], ['2026-07-20', '海の日'], ['2026-08-11', '山の日'], ['2026-09-21', '敬老の日'], ['2026-10-12', 'スポーツの日'], ['2026-11-03', '文化の日'], ['2026-11-23', '勤労感謝の日']
]);

function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadSettings() {
  const saved = loadData(STORAGE_KEYS.settings, defaultBottomNav);
  if (!Array.isArray(saved) || saved.length === 0) {
    return [...defaultBottomNav];
  }
  return saved.filter(item => labels[item]);
}

function saveSettings() {
  saveData(STORAGE_KEYS.settings, state.bottomNav);
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getPlans(date) {
  const items = loadData(STORAGE_KEYS.plans, []);
  return items.filter(item => item.date === date);
}

function getLogs(date) {
  const items = loadData(STORAGE_KEYS.logs, []);
  return items.filter(item => item.date === date);
}

function getAllPlans() {
  return loadData(STORAGE_KEYS.plans, []);
}

function getAllLogs() {
  return loadData(STORAGE_KEYS.logs, []);
}

function addId() {
  return `item_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function renderPage(page) {
  state.currentPage = page;
  document.querySelectorAll('[data-page-section]').forEach(section => {
    const isVisible = section.id === `page-${page}`;
    section.hidden = !isVisible;
    section.classList.toggle('active', isVisible);
  });

  document.querySelectorAll('.side-nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });

  renderBottomNav();
}

function openMenu() {
  const menu = document.getElementById('sideMenu');
  const backdrop = document.getElementById('menuBackdrop');
  menu.classList.add('open');
  backdrop.hidden = false;
  menu.setAttribute('aria-hidden', 'false');
}

function closeMenu() {
  const menu = document.getElementById('sideMenu');
  const backdrop = document.getElementById('menuBackdrop');
  menu.classList.remove('open');
  backdrop.hidden = true;
  menu.setAttribute('aria-hidden', 'true');
}

function renderBottomNav() {
  const nav = document.getElementById('bottomNav');
  const visible = state.bottomNav.filter(item => labels[item]);

  nav.innerHTML = visible.map(item => `
    <button type="button" data-bottom-page="${item}" class="${state.currentPage === item ? 'active' : ''}">${labels[item]}</button>
  `).join('');

  nav.querySelectorAll('[data-bottom-page]').forEach(button => {
    button.addEventListener('click', () => {
      renderPage(button.dataset.bottomPage);
      closeMenu();
    });
  });
}

function updateSettingsUI() {
  document.querySelectorAll('[data-bottom-item]').forEach(input => {
    input.checked = state.bottomNav.includes(input.dataset.bottomItem);
  });
}

function updateSettingsFromUI() {
  const checked = [...document.querySelectorAll('[data-bottom-item]:checked')].map(input => input.dataset.bottomItem);
  if (checked.length === 0) {
    state.bottomNav = [...defaultBottomNav];
  } else {
    state.bottomNav = checked;
  }
  saveSettings();
  renderBottomNav();
}

function updateSelectedDateLabel() {
  const label = document.getElementById('selectedDateLabel');
  label.textContent = dateKey(state.selectedDate);

  document.getElementById('planDate').value = dateKey(state.selectedDate);
  document.getElementById('logDate').value = dateKey(state.selectedDate);
}

function isHoliday(date) {
  return holidayMap.has(dateKey(date));
}

function renderCalendar() {
  const monthLabel = document.getElementById('monthLabel');
  monthLabel.textContent = `${state.currentMonth.getFullYear()}年${state.currentMonth.getMonth() + 1}月`;

  const grid = document.getElementById('calendarGrid');
  const first = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push(date);
  }

  grid.innerHTML = cells.map(date => {
    const key = dateKey(date);
    const currentMonth = date.getMonth() === state.currentMonth.getMonth();
    const selected = key === dateKey(state.selectedDate);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const holiday = isHoliday(date);
    const planCount = getPlans(key).length;
    const logCount = getLogs(key).length;

    const classNames = [
      'day-cell',
      !currentMonth ? 'outside-month' : '',
      selected ? 'selected' : '',
      weekend ? 'weekend' : '',
      holiday ? 'holiday' : '',
      date.getDay() === 0 ? 'sun-day' : '',
      date.getDay() === 6 ? 'sat-day' : ''
    ].filter(Boolean).join(' ');

    return `
      <button type="button" class="${classNames}" data-date="${key}">
        <span class="day-number">${date.getDate()}</span>
        <div class="day-meta">
          ${planCount ? `<span class="day-pill">予定 ${planCount}</span>` : ''}
          ${logCount ? `<span class="day-pill">実績 ${logCount}</span>` : ''}
          ${holiday ? `<span class="day-pill">祝日</span>` : ''}
        </div>
      </button>
    `;
  }).join('');

  document.querySelectorAll('[data-date]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedDate = new Date(`${button.dataset.date}T00:00:00`);
      updateSelectedDateLabel();
      renderCalendar();
      renderSummary();
      renderDayLists();
    });
  });
}

function renderSummary() {
  const key = dateKey(state.selectedDate);
  const plans = getPlans(key);
  const logs = getLogs(key);

  const plannedMinutes = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const actualMinutes = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = plannedMinutes > 0 ? Math.min(100, Math.round((actualMinutes / plannedMinutes) * 100)) : 0;

  document.getElementById('plannedMinutes').textContent = `${plannedMinutes}分`;
  document.getElementById('actualMinutes').textContent = `${actualMinutes}分`;
  document.getElementById('progressRate').textContent = `${rate}%`;

  const badge = document.getElementById('summaryBadge');
  if (actualMinutes > plannedMinutes) {
    badge.textContent = '上回った';
    badge.style.background = 'rgba(126,240,195,0.12)';
    badge.style.color = '#dffef0';
  } else if (actualMinutes >= plannedMinutes * 0.8) {
    badge.textContent = '順調';
    badge.style.background = 'rgba(122,214,255,0.10)';
    badge.style.color = '#d9f5ff';
  } else {
    badge.textContent = '見直し';
    badge.style.background = 'rgba(255,125,136,0.12)';
    badge.style.color = '#ffd9de';
  }

  const reflectionText = document.getElementById('reflectionText');
  if (plannedMinutes === 0 && actualMinutes === 0) {
    reflectionText.textContent = '今日は何をやるかを決めて、少しずつ進めましょう。';
    return;
  }

  if (actualMinutes >= plannedMinutes) {
    reflectionText.textContent = '予定以上に進められています。いいペースです。';
  } else if (actualMinutes > 0) {
    reflectionText.textContent = `予定の${Math.max(0, Math.round((actualMinutes / Math.max(plannedMinutes, 1)) * 100))}%まで進めました。少しずつ継続できてます。`;
  } else {
    reflectionText.textContent = 'まだ実績がありません。小さな一歩から始めましょう。';
  }
}

function renderDayLists() {
  const key = dateKey(state.selectedDate);
  const plans = getPlans(key);
  const logs = getLogs(key);

  const planList = document.getElementById('planList');
  planList.innerHTML = plans.length
    ? plans.map(item => `
      <li>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="muted-text">${escapeHtml(item.category || '一般')} · ${item.minutes}分</div>
          ${item.start || item.end ? `<div class="muted-text">${escapeHtml(item.start || '--')}〜${escapeHtml(item.end || '--')}</div>` : ''}
          ${item.memo ? `<div class="muted-text">${escapeHtml(item.memo)}</div>` : ''}
        </div>
        <button class="delete-button" type="button" data-delete-plan="${item.id}">削除</button>
      </li>
    `).join('')
    : '<li><span class="muted-text">予定はまだありません。</span></li>';

  const logList = document.getElementById('logList');
  logList.innerHTML = logs.length
    ? logs.map(item => `
      <li>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="muted-text">${item.minutes}分</div>
          ${item.memo ? `<div class="muted-text">${escapeHtml(item.memo)}</div>` : ''}
        </div>
        <button class="delete-button" type="button" data-delete-log="${item.id}">削除</button>
      </li>
    `).join('')
    : '<li><span class="muted-text">実績はまだありません。</span></li>';

  document.querySelectorAll('[data-delete-plan]').forEach(button => {
    button.addEventListener('click', (event) => {
      deletePlan(event.currentTarget.dataset.deletePlan);
    });
  });

  document.querySelectorAll('[data-delete-log]').forEach(button => {
    button.addEventListener('click', (event) => {
      deleteLog(event.currentTarget.dataset.deleteLog);
    });
  });
}

function renderToday() {
  const todayKey = dateKey(new Date());
  const plans = getPlans(todayKey);
  const logs = getLogs(todayKey);
  const planMinutes = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const actualMinutes = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = planMinutes > 0 ? Math.min(100, Math.round((actualMinutes / planMinutes) * 100)) : 0;

  document.getElementById('todayPlanMinutes').textContent = `${planMinutes}分`;
  document.getElementById('todayActualMinutes').textContent = `${actualMinutes}分`;
  document.getElementById('todayProgressRate').textContent = `${rate}%`;

  const todayPlanList = document.getElementById('todayPlanList');
  todayPlanList.innerHTML = plans.length
    ? plans.map(item => `<li><span>${escapeHtml(item.title)}</span><span>${item.minutes}分</span></li>`).join('')
    : '<li><span class="muted-text">予定はまだありません</span></li>';

  const todayLogList = document.getElementById('todayLogList');
  todayLogList.innerHTML = logs.length
    ? logs.map(item => `<li><span>${escapeHtml(item.title)}</span><span>${item.minutes}分</span></li>`).join('')
    : '<li><span class="muted-text">実績はまだありません</span></li>';

  const message = document.getElementById('todayMessage');
  if (actualMinutes >= planMinutes && planMinutes > 0) {
    message.textContent = '予定以上に進めています。良いペースです。';
  } else if (actualMinutes > 0) {
    message.textContent = '少しずつ進んでいます。今日も続けましょう。';
  } else {
    message.textContent = '今日の一歩を始めましょう。';
  }
}

function renderRecords() {
  const records = [...getAllPlans(), ...getAllLogs()].sort((a, b) => {
    const dateA = a.date || '0000-00-00';
    const dateB = b.date || '0000-00-00';
    return dateB.localeCompare(dateA);
  });

  const list = document.getElementById('recordList');
  list.innerHTML = records.length
    ? records.map(item => `
      <li>
        <div>
          <strong>${escapeHtml(item.title || '記録')}</strong>
          <div class="muted-text">${escapeHtml(item.date || '')} · ${item.minutes || 0}分</div>
        </div>
      </li>
    `).join('')
    : '<li><span class="muted-text">記録はまだありません。</span></li>';
}

function renderReview() {
  const plans = getAllPlans();
  const logs = getAllLogs();
  const totalPlan = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const totalLog = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = totalPlan > 0 ? Math.min(100, Math.round((totalLog / totalPlan) * 100)) : 0;

  document.getElementById('reviewPlanTotal').textContent = `${totalPlan}分`;
  document.getElementById('reviewLogTotal').textContent = `${totalLog}分`;
  document.getElementById('reviewRate').textContent = `${rate}%`;

  const reviewMessage = document.getElementById('reviewMessage');
  if (rate >= 100) {
    reviewMessage.textContent = '予定どおり進められていて、かなり順調です。';
  } else if (rate >= 70) {
    reviewMessage.textContent = 'よく続けています。少しだけ調整するとさらに安定します。';
  } else if (rate > 0) {
    reviewMessage.textContent = 'まだ伸びしろがあります。毎日小さく積み上げていきましょう。';
  } else {
    reviewMessage.textContent = 'まだまだ伸びます。まずは今日の一歩を始めてください。';
  }
}

function renderGoals() {
  const goals = [
    { label: '今週の学習', value: 75 },
    { label: '毎日の継続', value: 80 },
    { label: '記録の習慣', value: 90 }
  ];

  const goalList = document.getElementById('goalList');
  goalList.innerHTML = goals.map(goal => `
    <li>
      <div>
        <strong>${escapeHtml(goal.label)}</strong>
        <div class="muted-text">${goal.value}%</div>
      </div>
      <span>${goal.value}%</span>
    </li>
  `).join('');

  const ring = document.getElementById('goalProgressRing');
  ring.innerHTML = '<span>75%</span>';
  ring.style.background = 'conic-gradient(var(--accent) 0 75%, rgba(255,255,255,0.08) 75% 100%)';
}

function renderRocket() {
  const levelText = document.getElementById('rocketLevelText');
  const progress = document.getElementById('rocketProgress');
  levelText.textContent = 'レベル 3';
  progress.style.width = '75%';
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay');
  const totalSeconds = state.timerSeconds;
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  display.textContent = `${hours}:${minutes}:${seconds}`;

  const status = document.getElementById('timerStatus');
  status.textContent = state.timerRunning ? '学習中' : '停止中';
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  state.timerIntervalId = setInterval(() => {
    state.timerSeconds += 1;
    updateTimerDisplay();
  }, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  state.timerRunning = false;
  clearInterval(state.timerIntervalId);
  updateTimerDisplay();
}

function resetTimer() {
  pauseTimer();
  state.timerSeconds = 0;
  updateTimerDisplay();
}

function saveTimerToLog() {
  const minutes = Math.max(1, Math.round(state.timerSeconds / 60));
  const existing = loadData(STORAGE_KEYS.logs, []);
  existing.push({
    id: addId(),
    date: dateKey(new Date()),
    title: '勉強タイマー',
    minutes,
    memo: 'タイマーから記録'
  });
  saveData(STORAGE_KEYS.logs, existing);
  renderToday();
  renderReview();
  renderRecords();
  renderSummary();
  renderDayLists();
}

function handlePlanSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.title.value.trim();
  const date = form.date.value || dateKey(state.selectedDate);
  const minutes = Number(form.minutes.value || 0);

  if (!title || minutes <= 0) {
    alert('タイトルと予定時間を入力してください。');
    return;
  }

  const items = loadData(STORAGE_KEYS.plans, []);
  items.push({
    id: addId(),
    title,
    date,
    start: form.start.value || '',
    end: form.end.value || '',
    minutes,
    category: form.category.value,
    memo: form.memo.value.trim()
  });

  saveData(STORAGE_KEYS.plans, items);
  form.reset();
  form.date.value = date;
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderToday();
  renderReview();
}

function handleLogSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const title = form.title.value.trim();
  const date = form.date.value || dateKey(state.selectedDate);
  const minutes = Number(form.minutes.value || 0);

  if (!title || minutes <= 0) {
    alert('やったことと時間を入力してください。');
    return;
  }

  const items = loadData(STORAGE_KEYS.logs, []);
  items.push({
    id: addId(),
    title,
    date,
    minutes,
    memo: form.memo.value.trim()
  });

  saveData(STORAGE_KEYS.logs, items);
  form.reset();
  form.date.value = date;
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderToday();
  renderReview();
  renderRecords();
}

function deletePlan(id) {
  const items = loadData(STORAGE_KEYS.plans, []).filter(item => item.id !== id);
  saveData(STORAGE_KEYS.plans, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderToday();
  renderReview();
}

function deleteLog(id) {
  const items = loadData(STORAGE_KEYS.logs, []).filter(item => item.id !== id);
  saveData(STORAGE_KEYS.logs, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderToday();
  renderReview();
  renderRecords();
}

function bindEvents() {
  document.getElementById('menuToggle').addEventListener('click', openMenu);
  document.getElementById('menuClose').addEventListener('click', closeMenu);
  document.getElementById('menuBackdrop').addEventListener('click', closeMenu);

  document.querySelectorAll('.side-nav-item').forEach(button => {
    button.addEventListener('click', () => {
      renderPage(button.dataset.page);
      closeMenu();
    });
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  document.getElementById('planForm').addEventListener('submit', handlePlanSubmit);
  document.getElementById('logForm').addEventListener('submit', handleLogSubmit);

  document.getElementById('timerStart').addEventListener('click', startTimer);
  document.getElementById('timerPause').addEventListener('click', pauseTimer);
  document.getElementById('timerReset').addEventListener('click', () => {
    resetTimer();
    saveTimerToLog();
  });

  document.querySelectorAll('[data-bottom-item]').forEach(input => {
    input.addEventListener('change', updateSettingsFromUI);
  });
}

function initialize() {
  const today = new Date();
  state.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  state.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  updateSelectedDateLabel();
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderToday();
  renderRecords();
  renderGoals();
  renderRocket();
  renderReview();
  renderBottomNav();
  updateSettingsUI();
  bindEvents();
  renderPage('today');
  updateTimerDisplay();
}

window.addEventListener('DOMContentLoaded', initialize);

window.addEventListener('beforeunload', () => {
  if (state.timerRunning) {
    pauseTimer();
  }
});
