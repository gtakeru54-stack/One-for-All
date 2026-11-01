const STORAGE_KEYS = {
  plans: 'one-for-all-plans-v1',
  logs: 'one-for-all-logs-v1'
};

const state = {
  currentMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: new Date()
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

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
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
  const items = loadData(STORAGE_KEYS.plans, []);
  return items.filter(item => item.date === date);
}

function getLogs(date) {
  const items = loadData(STORAGE_KEYS.logs, []);
  return items.filter(item => item.date === date);
}

function updateSelectedDateLabel() {
  const label = document.getElementById('selectedDateLabel');
  label.textContent = dateKey(state.selectedDate);

  const planDateInput = document.getElementById('planDate');
  const logDateInput = document.getElementById('logDate');
  planDateInput.value = dateKey(state.selectedDate);
  logDateInput.value = dateKey(state.selectedDate);
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
  monthLabel.textContent = `${state.currentMonth.getFullYear()}年${state.currentMonth.getMonth() + 1}月`;

  const grid = document.getElementById('calendarGrid');
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
      <button type="button" class="${classes}" data-date="${key}">
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

  const planMinutes = plans.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const actualMinutes = logs.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const rate = planMinutes > 0 ? Math.min(100, Math.round((actualMinutes / planMinutes) * 100)) : 0;

  const plannedMinutesEl = document.getElementById('plannedMinutes');
  const actualMinutesEl = document.getElementById('actualMinutes');
  const progressRateEl = document.getElementById('progressRate');
  const badgeEl = document.getElementById('summaryBadge');
  const reflectionText = document.getElementById('reflectionText');

  plannedMinutesEl.textContent = `${planMinutes}分`;
  actualMinutesEl.textContent = `${actualMinutes}分`;
  progressRateEl.textContent = `${rate}%`;

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

function renderDayLists() {
  const key = dateKey(state.selectedDate);
  const planList = document.getElementById('planList');
  const logList = document.getElementById('logList');

  const plans = getPlans(key);
  const logs = getLogs(key);

  if (plans.length === 0) {
    planList.innerHTML = '<li class="empty-state">予定はまだありません。</li>';
  } else {
    planList.innerHTML = plans.map(item => `
      <li>
        <div class="item-text">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="small-muted">${escapeHtml(item.category || '一般')} · ${item.minutes}分</span>
          ${item.start || item.end ? `<span class="small-muted">${escapeHtml(item.start || '--')}〜${escapeHtml(item.end || '--')}</span>` : ''}
          ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
        </div>
        <button class="delete-button" type="button" data-delete-plan="${item.id}">削除</button>
      </li>
    `).join('');
  }

  if (logs.length === 0) {
    logList.innerHTML = '<li class="empty-state">実績はまだありません。</li>';
  } else {
    logList.innerHTML = logs.map(item => `
      <li>
        <div class="item-text">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="small-muted">${item.minutes}分</span>
          ${item.memo ? `<span class="small-muted">${escapeHtml(item.memo)}</span>` : ''}
        </div>
        <button class="delete-button" type="button" data-delete-log="${item.id}">削除</button>
      </li>
    `).join('');
  }
}

function addId() {
  return `item_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
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
}

function deletePlan(id) {
  const items = loadData(STORAGE_KEYS.plans, []).filter(item => item.id !== id);
  saveData(STORAGE_KEYS.plans, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
}

function deleteLog(id) {
  const items = loadData(STORAGE_KEYS.logs, []).filter(item => item.id !== id);
  saveData(STORAGE_KEYS.logs, items);
  renderCalendar();
  renderSummary();
  renderDayLists();
}

function bindEvents() {
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

  document.getElementById('planList').addEventListener('click', event => {
    const target = event.target.closest('[data-delete-plan]');
    if (target) deletePlan(target.dataset.deletePlan);
  });

  document.getElementById('logList').addEventListener('click', event => {
    const target = event.target.closest('[data-delete-log]');
    if (target) deleteLog(target.dataset.deleteLog);
  });
}

function initialize() {
  const today = new Date();
  state.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  state.selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  updateSelectedDateLabel();
  renderCalendar();
  renderSummary();
  renderDayLists();
  bindEvents();
}

window.addEventListener('DOMContentLoaded', initialize);
