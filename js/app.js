

(() => {

  "use strict";

  const STORAGE_KEY = "personal-calendar-v1";

  const STUDY_KEY = "one-for-all-study-v1";

  const GOAL_KEY = "one-for-all-goals-v1";

  const $ = selector => document.querySelector(selector);

  const dateKey = date =>

    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const todayKey = () => dateKey(new Date());

  const parseDate = value => {

    const [y, m, d] = value.split("-").map(Number);

    return new Date(y, m - 1, d);

  };

  const makeId = () => globalThis.crypto?.randomUUID

    ? crypto.randomUUID()

    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({

    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"

  }[c]));

  const displayDate = key => {

    if (!key) return "期限なし";

    const date = parseDate(key);

    return `${date.getMonth() + 1}月${date.getDate()}日（${"日月火水木金土"[date.getDay()]}）`;

  };

  const durationText = seconds => {

    const minutes = Math.floor(Math.max(0, seconds) / 60);

    const hours = Math.floor(minutes / 60);

    const rest = minutes % 60;

    return hours ? `${hours}時間${rest}分` : `${rest}分`;

  };

  const clockText = seconds => {

    seconds = Math.max(0, Math.floor(seconds));

    return [

      String(Math.floor(seconds / 3600)).padStart(2, "0"),

      String(Math.floor((seconds % 3600) / 60)).padStart(2, "0"),

      String(seconds % 60).padStart(2, "0")

    ].join(":");

  };

  const startOfWeek = date => {

    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const day = result.getDay();

    result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));

    return result;

  };

  const addDays = (date, amount) => {

    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    result.setDate(result.getDate() + amount);

    return result;

  };

  let state = { events: [], tasks: [] };

  let study = { items: [], sessions: [], active: null };

  let goals = {

    university: "",

    faculty: "",

    department: "",

    examDate: "",

    dailyMinutes: 0,

    weeklyMinutes: 0,

    monthlyMinutes: 0,

    subjectWeekly: {}

  };

  let viewYear = new Date().getFullYear();

  let viewMonth = new Date().getMonth();

  let selectedDate = todayKey();

  let chartAnchor = new Date();

  let toastTimeout;

  function toast(message) {

    const element = $("#toast");

    if (!element) return;

    element.textContent = message;

    element.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => element.classList.remove("show"), 2600);

  }

  function loadState() {

    try {

      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      state.events = Array.isArray(saved.events) ? saved.events : [];

      state.tasks = Array.isArray(saved.tasks) ? saved.tasks : [];

    } catch (error) {

      console.error("予定・タスクの読み込みに失敗しました", error);

      state = { events: [], tasks: [] };

    }

  }

  function saveState() {

    try {

      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    } catch (error) {

      console.error(error);

      toast("予定・タスクを保存できませんでした。");

    }

  }

  function loadStudy() {

    try {

      const saved = JSON.parse(localStorage.getItem(STUDY_KEY) || "{}");

      study.items = Array.isArray(saved.items) ? saved.items : [];

      study.sessions = Array.isArray(saved.sessions) ? saved.sessions : [];

      study.active = saved.active?.startedAt && saved.active?.itemId

        ? saved.active : null;

    } catch (error) {

      console.error("学習記録の読み込みに失敗しました", error);

      study = { items: [], sessions: [], active: null };

    }

  }

  function saveStudy() {

    try {

      localStorage.setItem(STUDY_KEY, JSON.stringify(study));

    } catch (error) {

      console.error(error);

      toast("学習記録を保存できませんでした。");

    }

  }

  function loadGoals() {

    try {

      const saved = JSON.parse(localStorage.getItem(GOAL_KEY) || "{}");

      goals = {

        university: String(saved.university || ""),

        faculty: String(saved.faculty || ""),

        department: String(saved.department || ""),

        examDate: String(saved.examDate || ""),

        dailyMinutes: Math.max(0, Number(saved.dailyMinutes) || 0),

        weeklyMinutes: Math.max(0, Number(saved.weeklyMinutes) || 0),

        monthlyMinutes: Math.max(0, Number(saved.monthlyMinutes) || 0),

        subjectWeekly: saved.subjectWeekly && typeof saved.subjectWeekly === "object"

          ? saved.subjectWeekly : {}

      };

    } catch (error) {

      console.error("目標の読み込みに失敗しました", error);

    }

  }

  function saveGoals() {

    try {

      localStorage.setItem(GOAL_KEY, JSON.stringify(goals));

    } catch (error) {

      console.error(error);

      toast("目標を保存できませんでした。");

    }

  }

  function sessionSeconds(session) {

    if (Number.isFinite(session.seconds)) return Math.max(0, session.seconds);

    const start = new Date(session.startedAt).getTime();

    const end = new Date(session.endedAt).getTime();

    return Number.isFinite(start) && Number.isFinite(end)

      ? Math.max(0, Math.floor((end - start) / 1000)) : 0;

  }

  function allSessions() {

    const sessions = [...study.sessions];

    if (study.active) {

      const start = new Date(study.active.startedAt).getTime();

      if (Number.isFinite(start) && Date.now() > start) {

        sessions.push({

          id: "active-preview",

          itemId: study.active.itemId,

          startedAt: study.active.startedAt,

          endedAt: new Date().toISOString(),

          seconds: Math.floor((Date.now() - start) / 1000),

          date: dateKey(new Date(start)),

          activePreview: true

        });

      }

    }

    return sessions;

  }

  function sumSessions(sessions) {

    return sessions.reduce((total, session) => total + sessionSeconds(session), 0);

  }

  function sessionsForDate(key) {

    return allSessions().filter(session => session.date === key);

  }

  function sessionsInRange(start, end) {

    const startKey = dateKey(start);

    const endKey = dateKey(end);

    return allSessions().filter(session => session.date >= startKey && session.date <= endKey);

  }

  function todaySeconds() {

    return sumSessions(sessionsForDate(todayKey()));

  }

  function weekSeconds() {

    const start = startOfWeek(new Date());

    const end = addDays(start, 6);

    return sumSessions(sessionsInRange(start, end));

  }

  function monthSeconds() {

    const now = new Date();

    return sumSessions(sessionsInRange(

      new Date(now.getFullYear(), now.getMonth(), 1),

      new Date(now.getFullYear(), now.getMonth() + 1, 0)

    ));

  }

  function totalSeconds() {

    return sumSessions(allSessions());

  }

  function itemName(id) {

    return study.items.find(item => item.id === id)?.name || "削除済みの項目";

  }

  function itemSeconds(id, sessions = allSessions()) {

    return sumSessions(sessions.filter(session => session.itemId === id));

  }

  function progressPercent(actualMinutes, targetMinutes) {

    if (!targetMinutes || targetMinutes <= 0) return null;

    return Math.min(100, Math.round(actualMinutes / targetMinutes * 100));

  }

  function renderStats() {

    $("#home-today").textContent = durationText(todaySeconds());

    $("#home-week").textContent = durationText(weekSeconds());

    $("#home-total").textContent = durationText(totalSeconds());

    $("#record-today").textContent = durationText(todaySeconds());

    $("#record-week").textContent = durationText(weekSeconds());

    $("#record-total").textContent = durationText(totalSeconds());

  }

  // 学習項目

  function renderStudyItems() {

    const container = $("#study-item-list");

    const select = $("#timer-item-select");

    container.replaceChildren();

    select.replaceChildren();

    const placeholder = document.createElement("option");

    placeholder.value = "";

    placeholder.textContent = study.items.length

      ? "学習項目を選択してください"

      : "先に学習項目を追加してください";

    select.append(placeholder);

    study.items.forEach(item => {

      const option = document.createElement("option");

      option.value = item.id;

      option.textContent = item.name;

      select.append(option);

      const row = document.createElement("article");

      row.className = "moon-item";

      row.innerHTML = `

        <div class="moon-item-main">

          <strong>${escapeHtml(item.name)}</strong>

          <small>累計 ${escapeHtml(durationText(itemSeconds(item.id)))}</small>

        </div>

        <div class="moon-row">

          <button class="moon-btn" type="button" data-start-item="${escapeHtml(item.id)}">計測</button>

          <button class="moon-btn" type="button" data-rename-item="${escapeHtml(item.id)}">名前変更</button>

          <button class="moon-btn danger" type="button" data-delete-item="${escapeHtml(item.id)}">削除</button>

        </div>`;

      container.append(row);

    });

    if (!study.items.length) {

      container.innerHTML = '<div class="moon-empty">学習項目はまだありません。上の欄から英語・数学などを追加してください。</div>';

    }

    if (study.active) {

      select.value = study.active.itemId;

      select.disabled = true;

    } else {

      select.disabled = false;

    }

    container.querySelectorAll("[data-start-item]").forEach(button => {

      button.addEventListener("click", () => {

        $("#timer-item-select").value = button.dataset.startItem;

        document.dispatchEvent(new CustomEvent("oneforall:navigate", { detail: { view: "timer-view" } }));

      });

    });

    container.querySelectorAll("[data-rename-item]").forEach(button => {

      button.addEventListener("click", () => {

        const item = study.items.find(x => x.id === button.dataset.renameItem);

        if (!item) return;

        const name = prompt("新しい項目名を入力してください", item.name);

        if (name === null) return;

        if (!name.trim()) return toast("項目名を入力してください。");

        const cleanName = name.trim().slice(0, 80);

        if (study.items.some(x => x.id !== item.id && x.name.toLowerCase() === cleanName.toLowerCase())) {

          return toast("同じ名前の項目があります。");

        }

        item.name = cleanName;

        saveStudy();

        renderStudy();

        toast("項目名を変更しました。");

      });

    });

    container.querySelectorAll("[data-delete-item]").forEach(button => {

      button.addEventListener("click", () => {

        const item = study.items.find(x => x.id === button.dataset.deleteItem);

        if (!item) return;

        if (study.active?.itemId === item.id) {

          return toast("計測中の項目は削除できません。");

        }

        if (!confirm(`「${item.name}」を削除しますか？\n過去の学習記録は残ります。`)) return;

        study.items = study.items.filter(x => x.id !== item.id);

        delete goals.subjectWeekly[item.id];

        saveStudy();

        saveGoals();

        renderEverything();

        toast("学習項目を削除しました。");

      });

    });

  }

  $("#study-item-form").addEventListener("submit", event => {

    event.preventDefault();

    const input = $("#study-item-name");

    const name = input.value.trim();

    if (!name) return toast("学習項目名を入力してください。");

    if (study.items.some(item => item.name.toLowerCase() === name.toLowerCase())) {

      return toast("同じ名前の学習項目があります。");

    }

    study.items.push({

      id: makeId(),

      name: name.slice(0, 80),

      createdAt: new Date().toISOString()

    });

    input.value = "";

    saveStudy();

    renderEverything();

    toast("学習項目を追加しました。");

  });

  // タイマー

  function renderTimer() {

    const clock = $("#timer-clock");

    const status = $("#timer-status");

    const startButton = $("#timer-start");

    const stopButton = $("#timer-stop");

    const select = $("#timer-item-select");

    if (!study.active) {

      clock.textContent = "00:00:00";

      status.textContent = "計測していません";

      startButton.disabled = false;

      stopButton.disabled = true;

      select.disabled = false;

      return;

    }

    const start = new Date(study.active.startedAt).getTime();

    const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));

    clock.textContent = clockText(elapsed);

    status.textContent = `計測中：${itemName(study.active.itemId)}`;

    startButton.disabled = true;

    stopButton.disabled = false;

    select.disabled = true;

    select.value = study.active.itemId;

  }

  $("#timer-start").addEventListener("click", () => {

    if (study.active) return toast("すでに計測中です。");

    const itemId = $("#timer-item-select").value;

    if (!study.items.some(item => item.id === itemId)) {

      return toast("先に学習項目を選択してください。");

    }

    study.active = { itemId, startedAt: new Date().toISOString() };

    saveStudy();

    renderEverything();

    toast("タイマーを開始しました。");

  });

  $("#timer-stop").addEventListener("click", () => {

    if (!study.active) return;

    const startMs = new Date(study.active.startedAt).getTime();

    const end = new Date();

    const seconds = Math.max(0, Math.floor((end.getTime() - startMs) / 1000));

    if (seconds < 1) return toast("記録できる時間がありません。");

    study.sessions.push({

      id: makeId(),

      itemId: study.active.itemId,

      startedAt: study.active.startedAt,

      endedAt: end.toISOString(),

      seconds,

      date: dateKey(new Date(startMs))

    });

    study.active = null;

    saveStudy();

    renderEverything();

    toast(`学習時間 ${durationText(seconds)} を保存しました。`);

  });

  // 学習グラフの期間を作成

  function getChartRange() {

    const period = $("#chart-period").value;

    const anchor = new Date(chartAnchor.getFullYear(), chartAnchor.getMonth(), chartAnchor.getDate());

    if (period === "week") {

      const start = startOfWeek(anchor);

      const end = addDays(start, 6);

      return {

        period,

        start,

        end,

        label: `${start.getMonth() + 1}/${start.getDate()}〜${end.getMonth() + 1}/${end.getDate()}`,

        slots: Array.from({ length: 7 }, (_, i) => {

          const date = addDays(start, i);

          return { key: dateKey(date), label: ["月", "火", "水", "木", "金", "土", "日"][i], date };

        })

      };

    }

    if (period === "month") {

      const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);

      const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

      const count = end.getDate();

      return {

        period,

        start,

        end,

        label: `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`,

        slots: Array.from({ length: count }, (_, i) => {

          const date = new Date(anchor.getFullYear(), anchor.getMonth(), i + 1);

          return { key: dateKey(date), label: String(i + 1), date };

        })

      };

    }

    const start = new Date(anchor.getFullYear(), 0, 1);

    const end = new Date(anchor.getFullYear(), 11, 31);

    return {

      period,

      start,

      end,

      label: `${anchor.getFullYear()}年`,

      slots: Array.from({ length: 12 }, (_, i) => ({

        key: `${anchor.getFullYear()}-${String(i + 1).padStart(2, "0")}`,

        label: `${i + 1}月`,

        date: new Date(anchor.getFullYear(), i, 1),

        month: i

      }))

    };

  }

  function sessionsForChartSlot(session, range) {

    if (range.period === "year") {

      const sessionDate = parseDate(session.date);

      return sessionDate.getFullYear() === range.start.getFullYear();

    }

    return session.date >= dateKey(range.start) && session.date <= dateKey(range.end);

  }

  function secondsForSlot(slot, range, sessions) {

    if (range.period === "year") {

      return sumSessions(sessions.filter(session => {

        const date = parseDate(session.date);

        return date.getFullYear() === range.start.getFullYear() &&

          date.getMonth() === slot.month;

      }));

    }

    return sumSessions(sessions.filter(session => session.date === slot.key));

  }

  function secondsForPeriod(range, sessions = allSessions()) {

    return sumSessions(sessions.filter(session => sessionsForChartSlot(session, range)));

  }

  function goalForPeriod(range) {

    if (range.period === "week") return goals.weeklyMinutes;

    if (range.period === "month") return goals.monthlyMinutes;

    return 0;

  }

  function renderDailyChart(range, sessions) {

    const values = range.slots.map(slot => ({

      ...slot,

      seconds: secondsForSlot(slot, range, sessions)

    }));

    const width = 680;

    const height = 280;

    const left = 44;

    const right = 12;

    const top = 24;

    const bottom = 42;

    const plotWidth = width - left - right;

    const plotHeight = height - top - bottom;

    const maxMinutes = Math.max(60, ...values.map(v => Math.ceil(v.seconds / 60 / 30) * 30));

    const maxValue = maxMinutes * 60;

    const step = plotWidth / values.length;

    const barWidth = Math.max(4, Math.min(26, step * .58));

    const tickValues = [0, .25, .5, .75, 1];

    let svg = `<svg class="moon-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="期間内の日ごとの学習時間グラフ">

      <defs><linearGradient id="moonBarGradient" x1="0" y1="1" x2="0" y2="0">

      <stop offset="0%" stop-color="#8dbdff"/><stop offset="100%" stop-color="#d1c6ff"/>

      </linearGradient></defs>`;

    tickValues.forEach(fraction => {

      const y = top + plotHeight * (1 - fraction);

      const minutes = Math.round(maxMinutes * fraction);

      svg += `<line class="chart-grid" x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"/>`;

      svg += `<text x="${left - 7}" y="${y + 4}" text-anchor="end">${minutes}</text>`;

    });

    values.forEach((value, index) => {

      const xCenter = left + step * (index + .5);

      const barHeight = value.seconds / maxValue * plotHeight;

      const y = top + plotHeight - barHeight;

      const x = xCenter - barWidth / 2;

      const safeHeight = Math.max(2, barHeight);

      svg += `<rect class="${value.seconds ? "chart-bar" : "chart-bar-empty"}" x="${x}" y="${value.seconds ? y : top + plotHeight - 2}" width="${barWidth}" height="${safeHeight}" rx="4">

        <title>${escapeHtml(value.label)}：${escapeHtml(durationText(value.seconds))}</title></rect>`;

      const showLabel = range.period !== "month" || index === 0 || index === values.length - 1 || index % 5 === 0;

      if (showLabel) {

        svg += `<text x="${xCenter}" y="${height - 16}" text-anchor="middle">${escapeHtml(value.label)}</text>`;

      }

    });

    svg += `<text x="5" y="13">分</text></svg>`;

    $("#study-chart").innerHTML = svg;

    $("#chart-title").textContent = "日ごとの学習時間";

    $("#chart-caption").textContent = range.period === "week"

      ? "月曜日から日曜日までの学習時間です。"

      : range.period === "month"

        ? "選択した月の日ごとの学習時間です。"

        : "選択した年の月ごとの学習時間です。";

    return values;

  }

  function renderSubjectChart(range, sessions) {

    const items = study.items.map(item => ({

      id: item.id,

      name: item.name,

      seconds: sumSessions(sessions.filter(session =>

        session.itemId === item.id && sessionsForChartSlot(session, range)

      ))

    })).sort((a, b) => b.seconds - a.seconds);

    if (!items.length) {

      $("#study-chart").innerHTML = '<div class="moon-empty">学習項目を登録すると、科目別グラフを表示できます。</div>';

      $("#chart-title").textContent = "科目別の学習時間";

      $("#chart-caption").textContent = "科目ごとの合計時間を比較します。";

      return items;

    }

    const width = 680;

    const rowHeight = 43;

    const height = Math.max(130, items.length * rowHeight + 35);

    const left = Math.min(205, Math.max(105, Math.max(...items.map(x => x.name.length)) * 13 + 25));

    const right = 55;

    const plotWidth = width - left - right;

    const maxSeconds = Math.max(60, ...items.map(x => x.seconds));

    let svg = `<svg class="moon-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="科目別の学習時間グラフ">

      <defs><linearGradient id="moonBarGradient" x1="0" y1="0" x2="1" y2="0">

      <stop offset="0%" stop-color="#8dbdff"/><stop offset="100%" stop-color="#d1c6ff"/>

      </linearGradient></defs>`;

    items.forEach((item, index) => {

      const y = 22 + index * rowHeight;

      const barWidth = item.seconds / maxSeconds * plotWidth;

      svg += `<text x="${left - 10}" y="${y + 15}" text-anchor="end">${escapeHtml(item.name.slice(0, 15))}</text>`;

      svg += `<rect class="chart-bar-empty" x="${left}" y="${y}" width="${plotWidth}" height="21" rx="5"/>`;

      if (item.seconds > 0) {

        svg += `<rect class="chart-bar" x="${left}" y="${y}" width="${Math.max(2, barWidth)}" height="21" rx="5"><title>${escapeHtml(item.name)}：${escapeHtml(durationText(item.seconds))}</title></rect>`;

      }

      svg += `<text x="${Math.min(width - right + 5, left + barWidth + 7)}" y="${y + 15}">${escapeHtml(durationText(item.seconds))}</text>`;

    });

    svg += "</svg>";

    $("#study-chart").innerHTML = svg;

    $("#chart-title").textContent = "科目別の学習時間";

    $("#chart-caption").textContent = "現在登録されている学習項目のうち、選択期間内の学習時間を比較しています。";

    return items;

  }

  function renderChartBreakdown(range, sessions) {

    const container = $("#chart-breakdown");

    container.replaceChildren();

    const items = study.items.map(item => ({

      name: item.name,

      seconds: sumSessions(sessions.filter(session =>

        session.itemId === item.id && sessionsForChartSlot(session, range)

      ))

    })).sort((a, b) => b.seconds - a.seconds);

    if (!items.length) {

      container.innerHTML = '<div class="moon-empty">この期間に表示できる学習項目はありません。</div>';

      return;

    }

    items.forEach(item => {

      const row = document.createElement("div");

      row.className = "moon-item";

      row.innerHTML = `<div class="moon-item-main"><strong>${escapeHtml(item.name)}</strong><small>選択期間内の学習時間</small></div><strong class="moon-item-total">${escapeHtml(durationText(item.seconds))}</strong>`;

      container.append(row);

    });

  }

  function renderCharts() {

    const range = getChartRange();

    const sessions = allSessions();

    const seconds = secondsForPeriod(range, sessions);

    const actualMinutes = Math.floor(seconds / 60);

    const targetMinutes = goalForPeriod(range);

    const rate = progressPercent(actualMinutes, targetMinutes);

    $("#chart-period-label").textContent = range.label;

    $("#chart-period-total").textContent = durationText(seconds);

    const dayCount = range.period === "week"

      ? 7

      : range.period === "month"

        ? range.end.getDate()

        : 12;

    $("#chart-average").textContent = durationText(seconds / dayCount);

    $("#chart-goal-rate").textContent = rate === null ? "—" : `${rate}%`;

    if ($("#chart-type").value === "subject") {

      renderSubjectChart(range, sessions);

    } else {

      renderDailyChart(range, sessions);

    }

    renderChartBreakdown(range, sessions);

  }

  $("#chart-period").addEventListener("change", () => {

    chartAnchor = new Date();

    renderCharts();

  });

  $("#chart-type").addEventListener("change", renderCharts);

  $("#chart-prev").addEventListener("click", () => {

    const period = $("#chart-period").value;

    if (period === "week") chartAnchor = addDays(chartAnchor, -7);

    else if (period === "month") chartAnchor = new Date(chartAnchor.getFullYear(), chartAnchor.getMonth() - 1, 1);

    else chartAnchor = new Date(chartAnchor.getFullYear() - 1, 0, 1);

    renderCharts();

  });

  $("#chart-next").addEventListener("click", () => {

    const period = $("#chart-period").value;

    if (period === "week") chartAnchor = addDays(chartAnchor, 7);

    else if (period === "month") chartAnchor = new Date(chartAnchor.getFullYear(), chartAnchor.getMonth() + 1, 1);

    else chartAnchor = new Date(chartAnchor.getFullYear() + 1, 0, 1);

    renderCharts();

  });

  // 目標設定

  function renderSubjectGoalFields() {

    const container = $("#subject-goal-fields");

    container.replaceChildren();

    if (!study.items.length) {

      container.innerHTML = '<div class="moon-empty">先に「学習項目」で科目を登録すると、科目別の目標を設定できます。</div>';

      return;

    }

    study.items.forEach(item => {

      const wrapper = document.createElement("div");

      wrapper.className = "moon-field";

      const label = document.createElement("label");

      label.htmlFor = `subject-goal-${item.id}`;

      label.textContent = `${item.name}：1週間の目標（分）`;

      const input = document.createElement("input");

      input.type = "number";

      input.min = "0";

      input.max = "10080";

      input.step = "15";

      input.id = `subject-goal-${item.id}`;

      input.dataset.subjectGoalId = item.id;

      input.value = goals.subjectWeekly[item.id] || "";

      input.placeholder = "例：180";

      wrapper.append(label, input);

      container.append(wrapper);

    });

  }

  function fillGoalForm() {

    $("#goal-university").value = goals.university;

    $("#goal-faculty").value = goals.faculty;

    $("#goal-department").value = goals.department;

    $("#goal-exam-date").value = goals.examDate;

    $("#goal-daily").value = goals.dailyMinutes || "";

    $("#goal-weekly").value = goals.weeklyMinutes || "";

    $("#goal-monthly").value = goals.monthlyMinutes || "";

    renderSubjectGoalFields();

  }

  $("#goal-form").addEventListener("submit", event => {

    event.preventDefault();

    const readNumber = selector => {

      const value = Number($(selector).value);

      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

    };

    const subjectWeekly = {};

    document.querySelectorAll("[data-subject-goal-id]").forEach(input => {

      const value = Number(input.value);

      if (Number.isFinite(value) && value > 0) {

        subjectWeekly[input.dataset.subjectGoalId] = Math.min(10080, Math.floor(value));

      }

    });

    goals = {

      university: $("#goal-university").value.trim(),

      faculty: $("#goal-faculty").value.trim(),

      department: $("#goal-department").value.trim(),

      examDate: $("#goal-exam-date").value,

      dailyMinutes: Math.min(1440, readNumber("#goal-daily")),

      weeklyMinutes: Math.min(10080, readNumber("#goal-weekly")),

      monthlyMinutes: Math.min(44640, readNumber("#goal-monthly")),

      subjectWeekly

    };

    saveGoals();

    renderEverything();

    toast("目標を保存しました。");

  });

  function renderGoalProgress() {

    const homeSummary = $("#home-goal-summary");

    const homeStaircase = $("#home-staircase");

    const homeProgress = $("#home-goal-progress");

    const progressList = $("#goal-progress-list");

    const school = [goals.university, goals.faculty, goals.department].filter(Boolean).join(" · ");

    homeSummary.textContent = school

      ? `目指す場所：${school}${goals.examDate ? ` · 受験予定 ${goals.examDate}` : ""}`

      : "志望大学を登録して、目標への道しるべを作りましょう。";

    const dailyRate = progressPercent(Math.floor(todaySeconds() / 60), goals.dailyMinutes);

    const step = dailyRate === null ? 0 : Math.min(5, Math.floor(dailyRate / 20) + (dailyRate >= 100 ? 0 : 0));

    homeStaircase.replaceChildren();

    const labels = [

      "第一段：小さな一歩",

      "第二段：集中の芽",

      "第三段：知識の積み重ね",

      "第四段：未来への視界",

      "第五段：月に近づく"

    ];

    labels.forEach((label, index) => {

      const el = document.createElement("div");

      el.className = `moon-step${index < step ? " current" : ""}`;

      el.textContent = `${index + 1}. ${label}`;

      homeStaircase.append(el);

    });

    if (dailyRate === null) {

      homeProgress.innerHTML = '<p class="moon-muted">1日の目標時間を設定すると、今日の達成率がここに表示されます。</p>';

    } else {

      homeProgress.innerHTML = `

        <div class="moon-row" style="justify-content:space-between;margin:10px 0">

          <span class="moon-muted">今日の目標達成率</span><strong>${dailyRate}%</strong>

        </div>

        <div class="moon-progress-track"><div class="moon-progress-fill" style="width:${dailyRate}%"></div></div>

        <p class="moon-muted" style="margin-top:7px">${durationText(todaySeconds())} / ${durationText(goals.dailyMinutes * 60)}</p>`;

    }

    progressList.replaceChildren();

    const daily = {

      label: "今日の学習時間",

      actual: todaySeconds(),

      target: goals.dailyMinutes * 60,

      targetMinutes: goals.dailyMinutes

    };

    const weekly = {

      label: "今週の学習時間（月〜日）",

      actual: weekSeconds(),

      target: goals.weeklyMinutes * 60,

      targetMinutes: goals.weeklyMinutes

    };

    const monthly = {

      label: "今月の学習時間",

      actual: monthSeconds(),

      target: goals.monthlyMinutes * 60,

      targetMinutes: goals.monthlyMinutes

    };

    [daily, weekly, monthly].forEach(item => {

      const rate = progressPercent(Math.floor(item.actual / 60), item.targetMinutes);

      const card = document.createElement("div");

      card.className = "moon-goal-card";

      card.innerHTML = `

        <strong>${escapeHtml(item.label)}</strong>

        <div class="moon-row" style="justify-content:space-between;margin:7px 0">

          <small>${escapeHtml(durationText(item.actual))} / ${item.targetMinutes ? escapeHtml(durationText(item.target)) : "目標未設定"}</small>

          <small>${rate === null ? "—" : `${rate}%`}</small>

        </div>

        <div class="moon-progress-track"><div class="moon-progress-fill" style="width:${rate === null ? 0 : rate}%"></div></div>`;

      progressList.append(card);

    });

    study.items.forEach(item => {

      const targetMinutes = Number(goals.subjectWeekly[item.id]) || 0;

      if (!targetMinutes) return;

      const weekStart = startOfWeek(new Date());

      const weekEnd = addDays(weekStart, 6);

      const actual = sumSessions(sessionsInRange(weekStart, weekEnd).filter(s => s.itemId === item.id));

      const rate = progressPercent(Math.floor(actual / 60), targetMinutes);

      const card = document.createElement("div");

      card.className = "moon-goal-card";

      card.innerHTML = `

        <strong>${escapeHtml(item.name)}：週間目標</strong>

        <div class="moon-row" style="justify-content:space-between;margin:7px 0">

          <small>${escapeHtml(durationText(actual))} / ${escapeHtml(durationText(targetMinutes * 60))}</small>

          <small>${rate}%</small>

        </div>

        <div class="moon-progress-track"><div class="moon-progress-fill" style="width:${rate}%"></div></div>`;

      progressList.append(card);

    });

    if (!progressList.children.length) {

      progressList.innerHTML = '<div class="moon-empty">目標を設定すると、ここに達成状況が表示されます。</div>';

    }

  }

  // 学習履歴

  function renderRecent() {

    const container = $("#home-recent");

    container.replaceChildren();

    const sessions = [...study.sessions]

      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt))

      .slice(0, 5);

    if (!sessions.length) {

      container.innerHTML = '<div class="moon-empty">学習記録はまだありません。学習項目を登録してタイマーを使ってみましょう。</div>';

      return;

    }

    sessions.forEach(session => {

      const row = document.createElement("div");

      row.className = "moon-history-row";

      row.innerHTML = `<span>${escapeHtml(itemName(session.itemId))}</span><span>${escapeHtml(displayDate(session.date))} · ${escapeHtml(durationText(sessionSeconds(session)))}</span>`;

      container.append(row);

    });

  }

  function renderRecords() {

    const byItem = $("#record-by-item");

    const history = $("#record-history");

    byItem.replaceChildren();

    history.replaceChildren();

    const sessions = [...study.sessions].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));

    const groups = study.items.map(item => ({

      item,

      seconds: itemSeconds(item.id, sessions)

    })).sort((a, b) => b.seconds - a.seconds);

    if (!groups.length) {

      byItem.innerHTML = '<div class="moon-empty">学習項目を追加すると、項目別の合計が表示されます。</div>';

    } else {

      groups.forEach(group => {

        const row = document.createElement("div");

        row.className = "moon-item";

        row.innerHTML = `<div class="moon-item-main"><strong>${escapeHtml(group.item.name)}</strong><small>累計学習時間</small></div><strong class="moon-item-total">${escapeHtml(durationText(group.seconds))}</strong>`;

        byItem.append(row);

      });

    }

    const filter = $("#record-date").value;

    const filtered = filter ? sessions.filter(session => session.date === filter) : sessions;

    if (!filtered.length) {

      history.innerHTML = `<div class="moon-empty">${filter ? "この日の学習記録はありません。" : "まだ学習記録がありません。"}</div>`;

      return;

    }

    filtered.forEach(session => {

      const row = document.createElement("div");

      row.className = "moon-history-row";

      const start = new Date(session.startedAt);

      const end = new Date(session.endedAt);

      const time = `${start.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}–${end.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}`;

      row.innerHTML = `<span>${escapeHtml(itemName(session.itemId))}<br><small>${escapeHtml(displayDate(session.date))}</small></span><span>${escapeHtml(durationText(sessionSeconds(session)))}<br><small>${escapeHtml(time)}</small></span>`;

      history.append(row);

    });

  }

  $("#record-date").addEventListener("change", renderRecords);

  $("#record-date-clear").addEventListener("click", () => {

    $("#record-date").value = "";

    renderRecords();

  });

  // カレンダー・予定・タスク

  function eventsOn(date) {

    return state.events.filter(event => event.date === date);

  }

  function tasksOn(date) {

    return state.tasks.filter(task => task.date === date && !task.completed);

  }

  function renderCalendar() {

    $("#month-title").textContent = `${viewYear}年${viewMonth + 1}月`;

    const grid = $("#calendar-grid");

    grid.replaceChildren();

    const first = new Date(viewYear, viewMonth, 1);

    const start = new Date(viewYear, viewMonth, 1 - first.getDay());

    const today = todayKey();

    for (let i = 0; i < 42; i++) {

      const date = new Date(start);

      date.setDate(start.getDate() + i);

      const key = dateKey(date);

      const events = eventsOn(key);

      const tasks = tasksOn(key);

      const button = document.createElement("button");

      button.type = "button";

      button.className = "day-cell";

      if (date.getMonth() !== viewMonth) button.classList.add("outside");

      if (key === selectedDate) button.classList.add("selected");

      if (key === today) button.classList.add("today");

      button.setAttribute("aria-label", `${displayDate(key)}、予定${events.length}件、タスク${tasks.length}件`);

      button.innerHTML = `<span class="day-number">${date.getDate()}</span><span class="day-markers">${events.length ? '<i class="dot event-dot"></i>' : ""}${tasks.length ? '<i class="dot task-dot"></i>' : ""}</span>`;

      button.addEventListener("click", () => {

        selectedDate = key;

        viewYear = date.getFullYear();

        viewMonth = date.getMonth();

        renderAll();

      });

      grid.append(button);

    }

  }

  function renderDayItems() {

    $("#selected-date-title").textContent = displayDate(selectedDate);

    const container = $("#day-items");

    container.replaceChildren();

    const events = eventsOn(selectedDate).sort((a, b) =>

      (a.start || "99:99").localeCompare(b.start || "99:99")

    );

    if (!events.length) {

      container.innerHTML = '<div class="empty-state">この日の予定はありません。＋から追加できます。</div>';

      return;

    }

    events.forEach(event => {

      const card = document.createElement("article");

      card.className = "event-card";

      card.tabIndex = 0;

      card.setAttribute("role", "button");

      const time = event.start ? `${event.start}${event.end ? `–${event.end}` : ""}` : "時刻未設定";

      card.innerHTML = `<span class="event-stripe ${escapeHtml(event.color || "blue")}"></span><div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.notes || (event.reminder ? "通知設定あり" : "詳細なし"))}</p></div><span class="event-time">${escapeHtml(time)}</span>`;

      card.addEventListener("click", () => openEventDialog(event));

      card.addEventListener("keydown", eventKey => {

        if (eventKey.key === "Enter" || eventKey.key === " ") {

          eventKey.preventDefault();

          openEventDialog(event);

        }

      });

      container.append(card);

    });

  }

  function renderTasks() {

    const container = $("#task-list");

    container.replaceChildren();

    const tasks = [...state.tasks].sort((a, b) => {

      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);

      return (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");

    });

    if (!tasks.length) {

      container.innerHTML = '<div class="empty-state">タスクはまだありません。上から追加できます。</div>';

      return;

    }

    tasks.forEach(task => {

      const row = document.createElement("div");

      row.className = `task-row${task.completed ? " completed" : ""}`;

      const checkbox = document.createElement("input");

      checkbox.type = "checkbox";

      checkbox.checked = Boolean(task.completed);

      checkbox.setAttribute("aria-label", `${task.title}を完了にする`);

      checkbox.addEventListener("change", () => {

        task.completed = checkbox.checked;

        saveState();

        renderCalendarAndTasks();

      });

      const main = document.createElement("div");

      main.className = "task-main";

      main.tabIndex = 0;

      main.innerHTML = `<strong>${escapeHtml(task.title)}</strong><small>${task.date ? `期限：${displayDate(task.date)}` : "期限なし"}${task.notes ? ` · ${escapeHtml(task.notes)}` : ""}</small>`;

      main.addEventListener("click", () => openTaskDialog(task));

      const edit = document.createElement("button");

      edit.type = "button";

      edit.className = "task-edit";

      edit.textContent = "•••";

      edit.addEventListener("click", () => openTaskDialog(task));

      row.append(checkbox, main, edit);

      container.append(row);

    });

  }

  function renderCalendarAndTasks() {

    renderCalendar();

    renderDayItems();

    renderTasks();

  }

  const eventDialog = $("#event-dialog");

  const taskDialog = $("#task-dialog");

  function openEventDialog(event = null) {

    $("#event-form").reset();

    $("#event-id").value = event?.id || "";

    $("#event-title").value = event?.title || "";

    $("#event-date").value = event?.date || selectedDate;

    $("#event-start").value = event?.start || "";

    $("#event-end").value = event?.end || "";

    $("#event-color").value = event?.color || "blue";

    $("#event-notes").value = event?.notes || "";

    $("#event-reminder").checked = Boolean(event?.reminder);

    $("#event-dialog-title").textContent = event ? "予定を編集" : "予定を追加";

    $("#delete-event").classList.toggle("hidden", !event);

    if (eventDialog.showModal) eventDialog.showModal();

    else eventDialog.setAttribute("open", "");

  }

  function openTaskDialog(task = null) {

    $("#task-form").reset();

    $("#task-id").value = task?.id || "";

    $("#task-title").value = task?.title || "";

    $("#task-date").value = task?.date || selectedDate;

    $("#task-notes").value = task?.notes || "";

    $("#task-dialog-title").textContent = task ? "タスクを編集" : "タスクを追加";

    $("#delete-task").classList.toggle("hidden", !task);

    if (taskDialog.showModal) taskDialog.showModal();

    else taskDialog.setAttribute("open", "");

  }

  function closeDialog(dialog) {

    if (dialog.close) dialog.close();

    else dialog.removeAttribute("open");

  }

  $("#event-form").addEventListener("submit", event => {

    event.preventDefault();

    const id = $("#event-id").value;

    const date = $("#event-date").value;

    const start = $("#event-start").value;

    const end = $("#event-end").value;

    if (!date) return toast("日付を入力してください。");

    if (start && end && end < start) return toast("終了時刻は開始時刻以降にしてください。");

    const item = {

      id: id || makeId(),

      title: $("#event-title").value.trim(),

      date, start, end,

      color: $("#event-color").value,

      notes: $("#event-notes").value.trim(),

      reminder: $("#event-reminder").checked

    };

    if (!item.title) return toast("予定名を入力してください。");

    const index = state.events.findIndex(x => x.id === id);

    if (index >= 0) state.events[index] = item;

    else state.events.push(item);

    selectedDate = date;

    const d = parseDate(date);

    viewYear = d.getFullYear();

    viewMonth = d.getMonth();

    saveState();

    renderCalendarAndTasks();

    closeDialog(eventDialog);

    toast(index >= 0 ? "予定を更新しました。" : "予定を追加しました。");

  });

  $("#delete-event").addEventListener("click", () => {

    const id = $("#event-id").value;

    const event = state.events.find(x => x.id === id);

    if (!event || !confirm(`「${event.title}」を削除しますか？`)) return;

    state.events = state.events.filter(x => x.id !== id);

    saveState();

    renderCalendarAndTasks();

    closeDialog(eventDialog);

    toast("予定を削除しました。");

  });

  $("#task-form").addEventListener("submit", event => {

    event.preventDefault();

    const id = $("#task-id").value;

    const old = state.tasks.find(x => x.id === id);

    const task = {

      id: id || makeId(),

      title: $("#task-title").value.trim(),

      date: $("#task-date").value,

      notes: $("#task-notes").value.trim(),

      completed: old?.completed || false

    };

    if (!task.title) return toast("タスク名を入力してください。");

    const index = state.tasks.findIndex(x => x.id === id);

    if (index >= 0) state.tasks[index] = task;

    else state.tasks.push(task);

    saveState();

    renderCalendarAndTasks();

    closeDialog(taskDialog);

    toast(index >= 0 ? "タスクを更新しました。" : "タスクを追加しました。");

  });

  $("#delete-task").addEventListener("click", () => {

    const id = $("#task-id").value;

    const task = state.tasks.find(x => x.id === id);

    if (!task || !confirm(`「${task.title}」を削除しますか？`)) return;

    state.tasks = state.tasks.filter(x => x.id !== id);

    saveState();

    renderCalendarAndTasks();

    closeDialog(taskDialog);

    toast("タスクを削除しました。");

  });

  $("#quick-task-form").addEventListener("submit", event => {

    event.preventDefault();

    const input = $("#quick-task-title");

    const title = input.value.trim();

    if (!title) return;

    state.tasks.push({

      id: makeId(),

      title,

      date: selectedDate,

      notes: "",

      completed: false

    });

    input.value = "";

    saveState();

    renderCalendarAndTasks();

    toast("タスクを追加しました。");

  });

  $("#prev-month").addEventListener("click", () => {

    const date = new Date(viewYear, viewMonth - 1, 1);

    viewYear = date.getFullYear();

    viewMonth = date.getMonth();

    renderCalendarAndTasks();

  });

  $("#next-month").addEventListener("click", () => {

    const date = new Date(viewYear, viewMonth + 1, 1);

    viewYear = date.getFullYear();

    viewMonth = date.getMonth();

    renderCalendarAndTasks();

  });

  $("#today-button").addEventListener("click", () => {

    const now = new Date();

    selectedDate = dateKey(now);

    viewYear = now.getFullYear();

    viewMonth = now.getMonth();

    renderCalendarAndTasks();

  });

  $("#add-event-top").addEventListener("click", () => openEventDialog());

  $("#add-event-day").addEventListener("click", () => openEventDialog());

  $("#add-task-button").addEventListener("click", () => openTaskDialog());

  document.querySelectorAll(".close-dialog").forEach(button => {

    button.addEventListener("click", () => closeDialog(button.closest("dialog")));

  });

  [eventDialog, taskDialog].forEach(dialog => {

    dialog.addEventListener("click", event => {

      if (event.target === dialog) closeDialog(dialog);

    });

  });

  // バックアップ：旧形式も読み込めるようにする

  $("#export-button").addEventListener("click", () => {

    const backup = { ...state, study, goals };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `one-for-all-backup-${todayKey()}.json`;

    document.body.append(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    toast("バックアップを書き出しました。");

  });

  $("#import-file").addEventListener("change", async event => {

    const file = event.target.files?.[0];

    if (!file) return;

    try {

      const parsed = JSON.parse(await file.text());

      if (!parsed || !Array.isArray(parsed.events) || !Array.isArray(parsed.tasks)) {

        throw new Error("バックアップ形式が違います");

      }

      if (!confirm("現在の予定・タスクを置き換えますか？バックアップに学習記録や目標があれば、それらも読み込みます。")) return;

      state = { events: parsed.events, tasks: parsed.tasks };

      if (parsed.study && Array.isArray(parsed.study.items) && Array.isArray(parsed.study.sessions)) {

        study = {

          items: parsed.study.items,

          sessions: parsed.study.sessions,

          active: parsed.study.active || null

        };

        saveStudy();

      }

      if (parsed.goals && typeof parsed.goals === "object") {

        goals = {

          university: String(parsed.goals.university || ""),

          faculty: String(parsed.goals.faculty || ""),

          department: String(parsed.goals.department || ""),

          examDate: String(parsed.goals.examDate || ""),

          dailyMinutes: Math.max(0, Number(parsed.goals.dailyMinutes) || 0),

          weeklyMinutes: Math.max(0, Number(parsed.goals.weeklyMinutes) || 0),

          monthlyMinutes: Math.max(0, Number(parsed.goals.monthlyMinutes) || 0),

          subjectWeekly: parsed.goals.subjectWeekly && typeof parsed.goals.subjectWeekly === "object"

            ? parsed.goals.subjectWeekly : {}

        };

        saveGoals();

      }

      saveState();

      fillGoalForm();

      renderEverything();

      toast("データを読み込みました。");

    } catch (error) {

      console.error(error);

      toast("読み込みに失敗しました。正しいバックアップを選んでください。");

    } finally {

      event.target.value = "";

    }

  });

  function renderStudy() {

    renderStats();

    renderStudyItems();

    renderTimer();

    renderRecent();

    renderRecords();

    renderCharts();

    renderGoalProgress();

  }

  function renderEverything() {

    renderCalendarAndTasks();

    renderStudy();

  }

  document.addEventListener("oneforall:viewchange", event => {

    if (event.detail?.view === "goals-view") fillGoalForm();

    renderEverything();

  });

  // 初期化

  loadState();

  loadStudy();

  loadGoals();

  fillGoalForm();

  renderEverything();

  // タイマーは開始時刻を基準にするため、表示更新の遅れで時間が失われない

  setInterval(() => {

    if (study.active) {

      renderTimer();

      renderStats();

      renderGoalProgress();

      renderCharts();

    }

  }, 1000);

})();