const STORAGE_KEYS = {
  plans: 'one-for-all-plans-v1',
  logs: 'one-for-all-logs-v1',
  settings: 'one-for-all-settings-v1',
  goals: 'one-for-all-goals-v1'
};

const DEFAULT_SETTINGS = {
  today: true,
  schedule: true,
  timer: true,
  records: true,
  goals: true,
  rocket: true,
  review: true,
  settings: true
};

const holidayMap = new Map([
  ['2025-01-01', '元日'],
  ['2025-01-13', '成人の日'],
  ['2025-02-11', '建国記念の日'],
  ['2025-02-23', '天皇誕生日'],
  ['2025-03-21', '春分の日'],
  ['2025-04-29', '昭和の日'],
  ['2025-05-03', '憲法記念日'],
  ['2025-05-04', 'みどりの日'],
  ['2025-05-05', 'こどもの日'],
  ['2025-07-21', '海の日'],
  ['2025-08-11', '山の日'],
  ['2025-09-22', '敬老の日'],
  ['2025-10-13', 'スポーツの日'],
  ['2025-11-03', '文化の日'],
  ['2025-11-23', '勤労感謝の日'],
  ['2026-01-01', '元日'],
  ['2026-01-12', '成人の日'],
  ['2026-02-11', '建国記念の日'],
  ['2026-02-23', '天皇誕生日'],
  ['2026-03-20', '春分の日'],
  ['2026-04-29', '昭和の日'],
  ['2026-05-03', '憲法記念日'],
  ['2026-05-04', 'みどりの日'],
  ['2026-05-05', 'こどもの日'],
  ['2026-07-20', '海の日'],
  ['2026-08-11', '山の日'],
  ['2026-09-21', '敬老の日'],
  ['2026-10-12', 'スポーツの日'],
  ['2026-11-03', '文化の日'],
  ['2026-11-23', '勤労感謝の日']
]);

const state = {
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()),
  activePage: 'today',
  timerSeconds: 0,
  timerRunning: false,
  timerIntervalId: null
};

function dateKey(date) {
  const target = date instanceof Date ? date : new Date(date);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadData(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.error('保存データの読み込みに失敗しました', error);
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPlans(date) {
  const targetDate = dateKey(date);
  return loadData(STORAGE_KEYS.plans, []).filter(item => item.date === targetDate);
}

function getLogs(date) {
  const targetDate = dateKey(date);
  return loadData(STORAGE_KEYS.logs, []).filter(item => item.date === targetDate);
}

function getAllPlans() {
  return loadData(STORAGE_KEYS.plans, []);
}

function getAllLogs() {
  return loadData(STORAGE_KEYS.logs, []);
}

function formatMinutes(minutes) {
  return `${Number(minutes || 0)}分`;
}

function getSettings() {
  const saved = loadData(STORAGE_KEYS.settings, {});
  return { ...DEFAULT_SETTINGS, ...saved };
}

function saveSettings(settings) {
  saveData(STORAGE_KEYS.settings, settings);
}

function getDefaultGoals() {
  return [
    { id: 'goal-1', text: '毎日 30 分勉強する', done: false },
    { id: 'goal-2', text: '1 週間で 3 回復習する', done: false },
    { id: 'goal-3', text: '今週の学習を振り返る', done: false }
  ];
}

function getGoals() {
  return loadData(STORAGE_KEYS.goals, getDefaultGoals());
}

function saveGoals(goals) {
  saveData(STORAGE_KEYS.goals, goals);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[char]));
}

function updateSelectedDateLabel() {
  const label = document.getElementById('selectedDateLabel');
  if (label) {
    label.textContent = dateKey(state.selectedDate);
  }

  const planDateInput = document.getElementById('planDate');
  const logDateInput = document.getElementById('logDate');
  if (planDateInput) planDateInput.value = dateKey(state.selectedDate);
  if (logDateInput) logDateInput.value = dateKey(state.selectedDate);
}

function isHoliday(date) {
  return holidayMap.has(dateKey(date));
}

function getCalendarCells() {
  const year = state.currentMonth.getFullYear();
  const month = state.currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    cells.push(cell);
  }
  return cells;
}

function renderCalendar() {
  const monthLabel = document.getElementById('monthLabel');
  if (monthLabel) {
    monthLabel.textContent = `${state.currentMonth.getFullYear()}年${state.currentMonth.getMonth() + 1}月`;
  }

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  const cells = getCalendarCells();
  grid.innerHTML = cells.map(date => {
    const key = dateKey(date);
    const currentMonth = date.getMonth() === state.currentMonth.getMonth();
    const selected = key === dateKey(state.selectedDate);
    const holiday = isHoliday(date);
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const planCount = getPlans(key).length;
    const logCount = getLogs(key).length;

    const classes = [
      'day-cell',
      currentMonth ? '' : 'outside-month',
      selected ? 'selected' : '',
      weekend ? 'weekend' : '',
      holiday ? 'holiday' : '',
      date.getDay() === 0 ? 'sun-day' : '',
      date.getDay() === 6 ? 'sat-day' : ''
    ].filter(Boolean).join(' ');

    return `
      <button type="button" class="${classes}" data-date="${key}" aria-label="${key}を選択">
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
      const selectedDate = new Date(`${button.dataset.date}T00:00:00`);
      state.selectedDate = selectedDate;
      updateSelectedDateLabel();
      renderCalendar();
      renderSummary();
      renderDayLists();
      setActivePage('schedule');
    });
  });
}

function buildSummaryFrom(dateKeyValue) {
  const plans = getPlans(dateKeyValue);
  const logs = getLogs(dateKeyValue);
  const planMinutes = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const actualMinutes = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = planMinutes > 0 ? Math.min(100, Math.round((actualMinutes / planMinutes) * 100)) : 0;

  return { plans, logs, planMinutes, actualMinutes, rate };
}

function renderSummary() {
  const key = dateKey(state.selectedDate);
  const { plans, logs, planMinutes, actualMinutes, rate } = buildSummaryFrom(key);

  const plannedMinutesEl = document.getElementById('plannedMinutes');
  const actualMinutesEl = document.getElementById('actualMinutes');
  const progressRateEl = document.getElementById('progressRate');
  const badgeEl = document.getElementById('summaryBadge');
  const reflectionText = document.getElementById('reflectionText');

  if (plannedMinutesEl) plannedMinutesEl.textContent = formatMinutes(planMinutes);
  if (actualMinutesEl) actualMinutesEl.textContent = formatMinutes(actualMinutes);
  if (progressRateEl) progressRateEl.textContent = `${rate}%`;

  if (badgeEl) {
    if (actualMinutes > planMinutes) {
      badgeEl.textContent = '上回った';
      badgeEl.style.background = 'rgba(126, 240, 198, 0.12)';
      badgeEl.style.color = '#b9fdd8';
    } else if (actualMinutes >= planMinutes * 0.8) {
      badgeEl.textContent = '順調';
      badgeEl.style.background = 'rgba(114, 211, 255, 0.1)';
      badgeEl.style.color = '#bfe9ff';
    } else {
      badgeEl.textContent = '見直し';
      badgeEl.style.background = 'rgba(255, 153, 120, 0.12)';
      badgeEl.style.color = '#ffd1bf';
    }
  }

  if (reflectionText) {
    if (planMinutes === 0 && actualMinutes === 0) {
      reflectionText.textContent = '今日は何をやるかを決めて、少しずつ進めていきましょう。';
      return;
    }

    if (actualMinutes >= planMinutes) {
      reflectionText.textContent = '予定以上に進められていて、良いペースです。次は余裕を持って整理しましょう。';
    } else if (actualMinutes > 0) {
      reflectionText.textContent = `予定の${Math.max(0, Math.round((actualMinutes / Math.max(planMinutes, 1)) * 100))}%まで進めました。少しずつでも継続が大事です。`;
    } else {
      reflectionText.textContent = 'まだ実績がありません。小さな一歩から始めてみましょう。';
    }
  }
}

function renderDayLists() {
  const key = dateKey(state.selectedDate);
  const planList = document.getElementById('planList');
  const logList = document.getElementById('logList');

  const plans = getPlans(key);
  const logs = getLogs(key);

  if (planList) {
    if (plans.length === 0) {
      planList.innerHTML = '<li class="empty-state">予定はまだありません。</li>';
    } else {
      planList.innerHTML = plans.map(item => `
        <li>
          <div class="item-text">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="small-muted">${escapeHtml(item.category || '一般')} · ${formatMinutes(item.minutes)}</span>
            ${item.start || item.end ? `<span class="small-muted">${escapeHtml(item.start || '--')}〜${escapeHtml(item.end || '--')}</span>` : ''}
            ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
          </div>
          <button class="delete-button" type="button" data-delete-plan="${item.id}">削除</button>
        </li>
      `).join('');
    }
  }

  if (logList) {
    if (logs.length === 0) {
      logList.innerHTML = '<li class="empty-state">実績はまだありません。</li>';
    } else {
      logList.innerHTML = logs.map(item => `
        <li>
          <div class="item-text">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="small-muted">${formatMinutes(item.minutes)}</span>
            ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
          </div>
          <button class="delete-button" type="button" data-delete-log="${item.id}">削除</button>
        </li>
      `).join('');
    }
  }
}

function addId() {
  return `item_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
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

  const items = getAllPlans();
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
  state.selectedDate = new Date(`${date}T00:00:00`);
  updateSelectedDateLabel();
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderTodayPage();
  renderReviewPage();
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

  const items = getAllLogs();
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
  state.selectedDate = new Date(`${date}T00:00:00`);
  updateSelectedDateLabel();
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderTodayPage();
  renderReviewPage();
  renderRecordPage();
}

function deletePlan(id) {
  const items = getAllPlans().filter(item => item.id !== id);
  saveData(STORAGE_KEYS.plans, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderTodayPage();
  renderReviewPage();
}

function deleteLog(id) {
  const items = getAllLogs().filter(item => item.id !== id);
  saveData(STORAGE_KEYS.logs, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderTodayPage();
  renderReviewPage();
  renderRecordPage();
}

function renderTodayPage() {
  const todayKey = dateKey(new Date());
  const plans = getPlans(todayKey);
  const logs = getLogs(todayKey);

  const planMinutes = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const actualMinutes = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = planMinutes > 0 ? Math.min(100, Math.round((actualMinutes / planMinutes) * 100)) : 0;

  const todayPlanMinutesEl = document.getElementById('todayPlanMinutes');
  const todayActualMinutesEl = document.getElementById('todayActualMinutes');
  const todayProgressRateEl = document.getElementById('todayProgressRate');
  const todayMessageEl = document.getElementById('todayMessage');
  const todayPlanListEl = document.getElementById('todayPlanList');
  const todayLogListEl = document.getElementById('todayLogList');

  if (todayPlanMinutesEl) todayPlanMinutesEl.textContent = formatMinutes(planMinutes);
  if (todayActualMinutesEl) todayActualMinutesEl.textContent = formatMinutes(actualMinutes);
  if (todayProgressRateEl) todayProgressRateEl.textContent = `${rate}%`;

  if (todayMessageEl) {
    if (planMinutes === 0 && actualMinutes === 0) {
      todayMessageEl.textContent = '今日の目標を決めて、一歩ずつ始めましょう。';
    } else if (actualMinutes >= planMinutes) {
      todayMessageEl.textContent = '予定以上に進めていて、最高の調子です。';
    } else if (actualMinutes > 0) {
      todayMessageEl.textContent = `今日の${Math.round((actualMinutes / Math.max(planMinutes, 1)) * 100)}%まで進めました。継続が力になります。`;
    } else {
      todayMessageEl.textContent = 'まだ始めたばかりです。小さく始めて前に進みましょう。';
    }
  }

  if (todayPlanListEl) {
    if (plans.length === 0) {
      todayPlanListEl.innerHTML = '<li class="empty-state">今日の予定はまだありません。</li>';
    } else {
      todayPlanListEl.innerHTML = plans.map(item => `
        <li>
          <div class="item-text">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="small-muted">${escapeHtml(item.category || '一般')} · ${formatMinutes(item.minutes)}</span>
            ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
          </div>
        </li>
      `).join('');
    }
  }

  if (todayLogListEl) {
    if (logs.length === 0) {
      todayLogListEl.innerHTML = '<li class="empty-state">今日の実績はまだありません。</li>';
    } else {
      todayLogListEl.innerHTML = logs.map(item => `
        <li>
          <div class="item-text">
            <strong>${escapeHtml(item.title)}</strong>
            <span class="small-muted">${formatMinutes(item.minutes)}</span>
            ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
          </div>
        </li>
      `).join('');
    }
  }
}

function renderGoalsPage() {
  const goalListEl = document.getElementById('goalList');
  if (!goalListEl) return;

  const goals = getGoals();
  const completeCount = goals.filter(goal => goal.done).length;
  const progressPercent = goals.length ? Math.round((completeCount / goals.length) * 100) : 0;

  const ring = document.getElementById('goalProgressRing');
  if (ring) {
    ring.style.background = `conic-gradient(#7ad6ff 0 ${progressPercent}%, rgba(255,255,255,0.08) ${progressPercent}% 100%)`;
    ring.innerHTML = `<span>${progressPercent}%</span>`;
  }

  goalListEl.innerHTML = goals.map(goal => `
    <li>
      <label class="goal-row">
        <input type="checkbox" data-goal-id="${goal.id}" ${goal.done ? 'checked' : ''} />
        <span>${escapeHtml(goal.text)}</span>
      </label>
    </li>
  `).join('');

  document.querySelectorAll('[data-goal-id]').forEach(input => {
    input.addEventListener('change', event => {
      const target = event.currentTarget;
      const goals = getGoals();
      const next = goals.map(goal => goal.id === target.dataset.goalId ? { ...goal, done: target.checked } : goal);
      saveGoals(next);
      renderGoalsPage();
      renderRocketPage();
    });
  });
}

function renderRocketPage() {
  const goals = getGoals();
  const doneCount = goals.filter(item => item.done).length;
  const progress = goals.length ? Math.round((doneCount / goals.length) * 100) : 0;
  const rocketLevelText = document.getElementById('rocketLevelText');
  const rocketProgress = document.getElementById('rocketProgress');

  if (rocketLevelText) {
    const level = Math.min(5, Math.max(1, Math.ceil(progress / 20)));
    rocketLevelText.textContent = `レベル ${level}`;
  }

  if (rocketProgress) {
    rocketProgress.style.width = `${Math.min(100, progress)}%`;
  }
}

function renderReviewPage() {
  const allPlans = getAllPlans();
  const allLogs = getAllLogs();

  const planTotal = allPlans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const logTotal = allLogs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = planTotal > 0 ? Math.min(100, Math.round((logTotal / planTotal) * 100)) : 0;

  const reviewPlanTotalEl = document.getElementById('reviewPlanTotal');
  const reviewLogTotalEl = document.getElementById('reviewLogTotal');
  const reviewRateEl = document.getElementById('reviewRate');
  const reviewMessageEl = document.getElementById('reviewMessage');

  if (reviewPlanTotalEl) reviewPlanTotalEl.textContent = formatMinutes(planTotal);
  if (reviewLogTotalEl) reviewLogTotalEl.textContent = formatMinutes(logTotal);
  if (reviewRateEl) reviewRateEl.textContent = `${rate}%`;

  if (reviewMessageEl) {
    if (logTotal === 0 && planTotal === 0) {
      reviewMessageEl.textContent = '学習の軌道を作って、今日から一歩を積み上げましょう。';
    } else if (rate >= 100) {
      reviewMessageEl.textContent = '予定をしっかりこなせています。次は深く理解する時間を増やしましょう。';
    } else if (rate >= 70) {
      reviewMessageEl.textContent = '良いペースです。少しずつ習慣を続けると大きく伸びます。';
    } else {
      reviewMessageEl.textContent = 'まだまだ伸びます。無理をせず、短い時間でも継続を大切にしましょう。';
    }
  }
}

function renderRecordPage() {
  const recordList = document.getElementById('recordList');
  if (!recordList) return;

  const logs = getAllLogs().sort((a, b) => b.date.localeCompare(a.date));
  if (logs.length === 0) {
    recordList.innerHTML = '<div class="empty-state">記録がまだありません。</div>';
    return;
  }

  recordList.innerHTML = logs.map(log => `
    <div class="record-item">
      <div class="item-text">
        <strong>${escapeHtml(log.title)}</strong>
        <span class="small-muted">${escapeHtml(log.date)} · ${formatMinutes(log.minutes)}</span>
        ${log.memo ? `<span class="small-muted">${escapeHtml(log.memo)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderBottomNav() {
  const bottomNav = document.getElementById('bottomNav');
  if (!bottomNav) return;

  const settings = getSettings();
  const items = [
    { key: 'today', label: '今日' },
    { key: 'schedule', label: '日程' },
    { key: 'timer', label: 'タイマー' },
    { key: 'records', label: '記録' },
    { key: 'goals', label: '目標' },
    { key: 'rocket', label: 'ロケット' },
    { key: 'review', label: '振り返り' },
    { key: 'settings', label: '設定' }
  ];

  const visibleItems = items.filter(item => settings[item.key]);

  bottomNav.innerHTML = visibleItems.map(item => `
    <button type="button" class="${state.activePage === item.key ? 'active' : ''}" data-page="${item.key}">${item.label}</button>
  `).join('');

  bottomNav.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => {
      const nextPage = button.dataset.page;
      setActivePage(nextPage);
    });
  });
}

function setActivePage(pageName) {
  state.activePage = pageName;

  document.querySelectorAll('[data-page-section]').forEach(section => {
    section.classList.toggle('active', section.id === `page-${pageName}`);
    section.hidden = section.id !== `page-${pageName}`;
  });

  document.querySelectorAll('.side-nav-item').forEach(button => {
    button.classList.toggle('active', button.dataset.page === pageName);
  });

  renderBottomNav();
}

function toggleMenu(isOpen) {
  const sideMenu = document.getElementById('sideMenu');
  const backdrop = document.getElementById('menuBackdrop');

  if (!sideMenu || !backdrop) return;

  sideMenu.classList.toggle('open', isOpen);
  sideMenu.setAttribute('aria-hidden', String(!isOpen));
  backdrop.hidden = !isOpen;
}

function bindMenuEvents() {
  const menuToggle = document.getElementById('menuToggle');
  const menuClose = document.getElementById('menuClose');
  const backdrop = document.getElementById('menuBackdrop');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      const sideMenu = document.getElementById('sideMenu');
      const isOpen = sideMenu && sideMenu.classList.contains('open');
      toggleMenu(!isOpen);
    });
  }

  if (menuClose) {
    menuClose.addEventListener('click', () => toggleMenu(false));
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => toggleMenu(false));
  }

  document.querySelectorAll('.side-nav-item').forEach(button => {
    button.addEventListener('click', () => {
      setActivePage(button.dataset.page);
      toggleMenu(false);
    });
  });
}

function bindSchedulingEvents() {
  const prevButton = document.getElementById('prevMonth');
  const nextButton = document.getElementById('nextMonth');

  if (prevButton) {
    prevButton.addEventListener('click', () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() - 1, 1);
      renderCalendar();
    });
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => {
      state.currentMonth = new Date(state.currentMonth.getFullYear(), state.currentMonth.getMonth() + 1, 1);
      renderCalendar();
    });
  }

  const planForm = document.getElementById('planForm');
  const logForm = document.getElementById('logForm');

  if (planForm) planForm.addEventListener('submit', handlePlanSubmit);
  if (logForm) logForm.addEventListener('submit', handleLogSubmit);

  const planList = document.getElementById('planList');
  const logList = document.getElementById('logList');

  if (planList) {
    planList.addEventListener('click', event => {
      const target = event.target.closest('[data-delete-plan]');
      if (target) deletePlan(target.dataset.deletePlan);
    });
  }

  if (logList) {
    logList.addEventListener('click', event => {
      const target = event.target.closest('[data-delete-log]');
      if (target) deleteLog(target.dataset.deleteLog);
    });
  }
}

function bindSettingsEvents() {
  const settingInputs = document.querySelectorAll('[data-bottom-item]');
  settingInputs.forEach(input => {
    input.addEventListener('change', () => {
      const settings = getSettings();
      settings[input.dataset.bottomItem] = input.checked;
      saveSettings(settings);
      renderBottomNav();
    });
  });
}

function formatTimerDisplay(totalSeconds) {
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function renderTimer() {
  const display = document.getElementById('timerDisplay');
  const status = document.getElementById('timerStatus');

  if (display) display.textContent = formatTimerDisplay(state.timerSeconds);
  if (status) status.textContent = state.timerRunning ? '勉強中' : '停止中';
}

function startTimer() {
  if (state.timerRunning) return;
  state.timerRunning = true;
  state.timerIntervalId = window.setInterval(() => {
    state.timerSeconds += 1;
    renderTimer();
  }, 1000);
  renderTimer();
}

function pauseTimer() {
  if (!state.timerRunning) return;
  state.timerRunning = false;
  clearInterval(state.timerIntervalId);
  renderTimer();
}

function resetTimer() {
  pauseTimer();
  state.timerSeconds = 0;
  renderTimer();
}

function bindTimerEvents() {
  document.getElementById('timerStart')?.addEventListener('click', startTimer);
  document.getElementById('timerPause')?.addEventListener('click', pauseTimer);
  document.getElementById('timerReset')?.addEventListener('click', resetTimer);
}

function initialize() {
  const today = new Date();
  state.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  state.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const settings = getSettings();
  document.querySelectorAll('[data-bottom-item]').forEach(input => {
    input.checked = !!settings[input.dataset.bottomItem];
  });

  bindMenuEvents();
  bindSchedulingEvents();
  bindSettingsEvents();
  bindTimerEvents();

  updateSelectedDateLabel();
  renderCalendar();
  renderSummary();
  renderDayLists();
  renderTodayPage();
  renderGoalsPage();
  renderRocketPage();
  renderReviewPage();
  renderRecordPage();
  renderBottomNav();
  renderTimer();
  setActivePage(state.activePage);
}

window.addEventListener('DOMContentLoaded', initialize);
