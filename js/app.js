/* ONE FOR ALL — COSMOS
   js/app.js
   index.html 対応版
*/
"use strict";

(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const KEYS = {
    study: "oneforall-study-v1",
    timer: "oneforall-timer-v1",
    goals: "oneforall-goals-v1",
    calendar: "personal-calendar-v1",
    countdowns: "oneforall-countdowns-v1"
  };

  const COLORS = [
    "#8eafff", "#c0a1ff", "#69dfc4",
    "#f4c77b", "#ff9dc5", "#86d99b"
  ];

  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const esc = value =>
    String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  };

  const save = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      toast("保存できませんでした。端末の空き容量を確認してください。");
      return false;
    }
  };

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  const todayKey = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const localDate = key => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const dayOffset = (date, amount) => {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  };

  const duration = seconds => {
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}時間${minutes % 60}分` : `${minutes}分`;
  };

  const timerText = seconds =>
    [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), Math.floor(seconds % 60)]
      .map(n => String(n).padStart(2, "0"))
      .join(":");

  const empty = message =>
    `<div class="empty"><span>✧</span><p>${esc(message)}</p></div>`;

  // 学習データを既存の保存形式から読み込む
  const oldStudy = read(KEYS.study, {});

  const state = {
    subjects: Array.isArray(oldStudy.subjects) ? oldStudy.subjects : [],
    items: Array.isArray(oldStudy.items) ? oldStudy.items : [],
    records: (Array.isArray(oldStudy.records) ? oldStudy.records : []).map(r => ({
      id: String(r.id || uid()),
      subject: String(r.subject || r.category || "未分類"),
      item: String(r.item || r.title || "学習"),
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || "") ? r.date : todayKey(),
      seconds: Math.max(0, Math.round(Number(
        r.durationSeconds ?? (Number(r.minutes) || 0) * 60
      ) || 0)),
      createdAt: Number(r.createdAt) || Date.now(),
      note: String(r.note || "")
    })),
    targets: oldStudy.targets || {
      day: { kind: "time", value: 120, unit: "minutes" },
      week: { kind: "time", value: 600, unit: "minutes" },
      month: { kind: "time", value: 2400, unit: "minutes" }
    }
  };

  (Array.isArray(oldStudy.categories) ? oldStudy.categories : []).forEach(name => {
    if (name && !state.subjects.some(s => s.name === name)) {
      state.subjects.push({ id: uid(), name });
    }
  });

  state.records.forEach(r => {
    if (!state.subjects.some(s => s.name === r.subject)) {
      state.subjects.push({ id: uid(), name: r.subject });
    }
  });

  if (!state.subjects.length) {
    state.subjects = [
      { id: uid(), name: "数学" },
      { id: uid(), name: "英語" },
      { id: uid(), name: "理科" }
    ];
  }

  state.items = state.items.map(i => ({
    id: String(i.id || uid()),
    subjectId: String(
      i.subjectId ||
      state.subjects.find(s => s.name === i.subject)?.id ||
      state.subjects[0].id
    ),
    name: String(i.name || i.title || "学習項目")
  }));

  state.records.forEach(r => {
    const subject = state.subjects.find(s => s.name === r.subject);
    if (subject && !state.items.some(i =>
      i.subjectId === subject.id && i.name === r.item
    )) {
      state.items.push({ id: uid(), subjectId: subject.id, name: r.item });
    }
  });

  let selectedSubject = state.subjects[0]?.id || "";
  let selectedItem = "";
  let period = "day";

  let timer = read(KEYS.timer, {
    elapsedSeconds: 0,
    running: false,
    paused: false,
    startedAt: null,
    subjectId: "",
    itemId: ""
  });

  let elapsedBase = Math.max(0, Number(timer.elapsedSeconds) || 0);
  let startedAt = timer.running && timer.startedAt ? Number(timer.startedAt) : null;
  let running = Boolean(startedAt);
  let paused = Boolean(timer.paused);
  let tick = null;

  function elapsed() {
    return elapsedBase +
      (running && startedAt ? Math.max(0, (Date.now() - startedAt) / 1000) : 0);
  }

  function persistStudy() {
    save(KEYS.study, {
      subjects: state.subjects,
      items: state.items,
      records: state.records.map(r => ({
        id: r.id,
        category: r.subject,
        item: r.item,
        date: r.date,
        durationSeconds: r.seconds,
        createdAt: r.createdAt,
        note: r.note || ""
      })),
      categories: state.subjects.map(s => s.name),
      dailyGoalMinutes: 120,
      targets: state.targets
    });
  }

  function persistTimer() {
    save(KEYS.timer, {
      elapsedSeconds: Math.floor(elapsed()),
      running,
      paused,
      startedAt,
      subjectId: timer.subjectId || selectedSubject,
      itemId: timer.itemId || selectedItem
    });
  }

  function total(records) {
    return records.reduce((sum, r) => sum + r.seconds, 0);
  }

  function recordsForDates(start, end) {
    return state.records.filter(r => r.date >= start && r.date <= end);
  }

  function recordHTML(r) {
    const color = COLORS[Math.abs(r.subject.length) % COLORS.length];
    return `<article class="record">
      <i style="background:${color}"></i>
      <div><b>${esc(r.item)}</b><small>${esc(r.subject)} · ${esc(r.date)}${r.note ? " · " + esc(r.note) : ""}</small></div>
      <strong>${duration(r.seconds)}</strong>
    </article>`;
  }

  // ナビゲーション
  function showView(name) {
    $$(".view").forEach(view => {
      const active = view.id === `view-${name}`;
      view.hidden = !active;
      view.classList.toggle("active", active);
    });

    $$(".nav-item").forEach(button =>
      button.classList.toggle("active", button.dataset.view === name)
    );

    if (name === "home") renderHome();
    if (name === "subjects") renderSubjects();
    if (name === "records") renderRecords();
    if (name === "goals") renderGoals();
    if (name === "calendar") renderCalendarAll();

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  $$("[data-view]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      showView(button.dataset.view);
    });
  });

  $$("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const dialog = $("#" + button.dataset.close);
      if (dialog) dialog.close();
    });
  });

  const todayChip = $("#today-chip");
  if (todayChip) {
    todayChip.textContent = new Date().toLocaleDateString("ja-JP", {
      month: "short", day: "numeric", weekday: "short"
    });
  }

  // ホーム画面
  function renderHome() {
    const today = total(recordsForDates(todayKey(), todayKey()));
    const date = localDate(todayKey());
    const monday = dayOffset(date, -((date.getDay() + 6) % 7));
    const sunday = dayOffset(monday, 6);
    const week = total(recordsForDates(todayKey(monday), todayKey(sunday)));
    const all = total(state.records);

    $("#home-today").textContent = duration(today);
    $("#stat-today").textContent = duration(today);
    $("#stat-week").textContent = duration(week);
    $("#stat-all").textContent = duration(all);

    const target = state.targets.day || { value: 120, unit: "minutes" };
    const targetSeconds = Number(target.value || 120) *
      (target.unit === "hours" ? 3600 : 60);
    const pct = Math.min(100, Math.round(today / Math.max(1, targetSeconds) * 100));

    $("#home-progress").style.width = pct + "%";
    $("#home-progress-label").textContent = `今日の目標 ${pct}%`;

    const recent = [...state.records]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4);

    $("#home-records").innerHTML = recent.length
      ? recent.map(recordHTML).join("")
      : empty("学習記録はまだありません。科目からタイマーを使って記録しましょう。");

    renderCountdowns();
  }

  // 科目と学習項目
  function renderSubjects() {
    $("#subject-list").innerHTML = state.subjects.map((s, index) => {
      const items = state.items.filter(i => i.subjectId === s.id).length;
      const seconds = total(state.records.filter(r => r.subject === s.name));

      return `<button class="subject-card ${selectedSubject === s.id ? "selected" : ""}" data-subject="${esc(s.id)}">
        <span class="subject-symbol" style="--subject-color:${COLORS[index % COLORS.length]}">✦</span>
        <span><b>${esc(s.name)}</b><small>${items}項目 · 累計 ${duration(seconds)}</small></span>
        <span>›</span>
      </button>`;
    }).join("") || empty("まず科目を作成してください。");

    $$("[data-subject]").forEach(button => {
      button.addEventListener("click", () => {
        selectedSubject = button.dataset.subject;
        selectedItem = "";
        renderSubjects();
        renderSubjectDetail();
      });
    });

    updateManualSubjects();
    renderSubjectDetail();
  }

  function renderSubjectDetail() {
    const subject = state.subjects.find(s => s.id === selectedSubject);
    if (!subject) {
      $("#subject-detail").hidden = true;
      return;
    }

    $("#subject-detail").hidden = false;
    $("#detail-title").textContent = subject.name;

    const items = state.items.filter(i => i.subjectId === subject.id);

    $("#item-list").innerHTML = items.map(item => {
      const records = state.records.filter(r =>
        r.subject === subject.name && r.item === item.name
      );

      const sum = total(records);
      const weekStart = todayKey(dayOffset(
        localDate(todayKey()),
        -((localDate(todayKey()).getDay() + 6) % 7)
      ));
      const week = total(records.filter(r => r.date >= weekStart && r.date <= todayKey()));
      const day = total(records.filter(r => r.date === todayKey()));

      return `<article class="item-card">
        <div><b>${esc(item.name)}</b><small>累計 ${duration(sum)} · 今週 ${duration(week)} · 今日 ${duration(day)}</small></div>
        <button class="primary-button start-item" data-item="${esc(item.id)}">▶ 計測</button>
      </article>`;
    }).join("") || empty("この科目に学習項目はありません。「学習項目」から追加できます。");

    $$(".start-item").forEach(button => {
      button.addEventListener("click", () => startForItem(button.dataset.item));
    });

    updateManualItems();

    const hasTimer = timer.subjectId === subject.id &&
      (elapsed() > 0 || running || paused);

    $("#timer-panel").hidden = !hasTimer;

    if (hasTimer) {
      selectedItem = timer.itemId;
      const item = state.items.find(i => i.id === selectedItem);
      $("#timer-label").textContent = `${subject.name} · ${item?.name || "学習"}`;
      updateTimerUI();
    }
  }

  $("#add-subject").addEventListener("click", () => {
    $("#subject-form").reset();
    $("#subject-dialog").showModal();
  });

  $("#subject-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#subject-name").value.trim();
    if (!name) return;

    if (state.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      return toast("同じ名前の科目があります。");
    }

    const subject = { id: uid(), name };
    state.subjects.push(subject);
    selectedSubject = subject.id;

    persistStudy();
    $("#subject-dialog").close();
    renderSubjects();
    renderHome();
    toast("科目を作成しました。");
  });

  $("#close-subject").addEventListener("click", () => {
    $("#subject-detail").hidden = true;
  });

  $("#add-item").addEventListener("click", () => {
    if (!selectedSubject) return toast("先に科目を選んでください。");
    $("#item-form").reset();
    $("#item-dialog").showModal();
  });

  $("#item-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#item-name").value.trim();
    if (!name || !selectedSubject) return;

    const item = { id: uid(), subjectId: selectedSubject, name };
    state.items.push(item);
    selectedItem = item.id;

    persistStudy();
    $("#item-dialog").close();
    renderSubjects();
    renderHome();
    toast("学習項目を追加しました。");
  });

  // タイマー
  function startForItem(id) {
    const item = state.items.find(i => i.id === id);
    if (!item) return;

    if (elapsed() > 0 &&
        (timer.itemId !== id || timer.subjectId !== item.subjectId)) {
      if (!confirm("計測中の時間があります。今の計測を記録せずに切り替えますか？")) return;
      elapsedBase = 0;
      running = false;
      paused = false;
      startedAt = null;
    }

    selectedSubject = item.subjectId;
    selectedItem = id;
    timer.subjectId = item.subjectId;
    timer.itemId = id;

    $("#timer-panel").hidden = false;

    const subject = state.subjects.find(s => s.id === selectedSubject);
    $("#timer-label").textContent = `${subject?.name || ""} · ${item.name}`;

    renderSubjects();
    startTimer();
    $("#timer-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateTimerUI() {
    $("#timer-display").textContent = timerText(elapsed());
    $("#timer-start").disabled = running;
    $("#timer-pause").disabled = !running;
    $("#timer-finish").disabled = elapsed() < 1;
    $("#timer-state").textContent = running
      ? "計測中です。別画面に移動しても時間は進みます。"
      : paused ? "一時停止中です。" : "開始すると学習時間を計測します。";
    $("#timer-start").textContent = paused ? "▶ 再開" : "▶ 開始";
  }

  function startTimer() {
    if (running) return;
    if (!timer.itemId) return toast("学習項目を選んでください。");

    running = true;
    paused = false;
    startedAt = Date.now();
    persistTimer();

    if (tick) clearInterval(tick);
    tick = setInterval(() => {
      updateTimerUI();
      persistTimer();
    }, 500);

    updateTimerUI();
  }

  function pauseTimer() {
    if (!running) return;

    elapsedBase = elapsed();
    running = false;
    paused = true;
    startedAt = null;

    if (tick) clearInterval(tick);
    tick = null;

    persistTimer();
    updateTimerUI();
  }

  function finishTimer() {
    const seconds = Math.floor(elapsed());
    if (seconds < 1) return toast("記録できる時間がありません。");

    const subject = state.subjects.find(s => s.id === timer.subjectId);
    const item = state.items.find(i => i.id === timer.itemId);

    state.records.push({
      id: uid(),
      subject: subject?.name || "未分類",
      item: item?.name || "学習",
      date: todayKey(),
      seconds,
      createdAt: Date.now(),
      note: ""
    });

    elapsedBase = 0;
    running = false;
    paused = false;
    startedAt = null;

    if (tick) clearInterval(tick);
    tick = null;

    persistStudy();
    persistTimer();
    updateTimerUI();
    renderSubjects();
    renderHome();
    renderRecords();
    toast(`${duration(seconds)}を記録しました。`);
  }

  $("#timer-start").addEventListener("click", startTimer);
  $("#timer-pause").addEventListener("click", pauseTimer);
  $("#timer-finish").addEventListener("click", finishTimer);

  // 手動学習記録
  function updateManualSubjects() {
    const select = $("#manual-subject");
    if (!select) return;

    const previous = select.value;
    select.innerHTML = '<option value="">科目を選択</option>' +
      state.subjects.map(s =>
        `<option value="${esc(s.id)}">${esc(s.name)}</option>`
      ).join("");

    if (state.subjects.some(s => s.id === previous)) select.value = previous;
    else if (selectedSubject) select.value = selectedSubject;

    updateManualItems();
  }

  function updateManualItems() {
    const subjectSelect = $("#manual-subject");
    const itemSelect = $("#manual-item");
    if (!subjectSelect || !itemSelect) return;

    const subjectId = subjectSelect.value || selectedSubject;
    const previous = itemSelect.value;

    itemSelect.innerHTML = '<option value="">項目を選択（任意）</option>' +
      state.items.filter(i => i.subjectId === subjectId).map(i =>
        `<option value="${esc(i.id)}">${esc(i.name)}</option>`
      ).join("");

    if (state.items.some(i => i.id === previous)) itemSelect.value = previous;
  }

  $("#manual-subject")?.addEventListener("change", updateManualItems);

  if ($("#manual-date")) $("#manual-date").value = todayKey();

  $("#manual-time-form")?.addEventListener("submit", event => {
    event.preventDefault();

    const subjectId = $("#manual-subject").value;
    const itemId = $("#manual-item").value;
    const minutes = Number($("#manual-minutes").value);
    const date = $("#manual-date").value || todayKey();
    const note = $("#manual-note").value.trim();

    if (!subjectId) return toast("科目を選択してください。");
    if (!Number.isFinite(minutes) || minutes < 1) {
      return toast("学習時間を1分以上で入力してください。");
    }

    const subject = state.subjects.find(s => s.id === subjectId);
    if (!subject) return toast("科目が見つかりません。");

    let item = state.items.find(i => i.id === itemId);

    if (!item && itemId) {
      return toast("学習項目が見つかりません。");
    }

    if (!item) {
      item = { id: uid(), subjectId, name: "手動記録" };
      state.items.push(item);
    }

    state.records.push({
      id: uid(),
      subject: subject.name,
      item: item.name,
      date,
      seconds: Math.round(minutes * 60),
      createdAt: Date.now(),
      note
    });

    persistStudy();
    event.target.reset();
    $("#manual-date").value = todayKey();

    renderSubjects();
    renderHome();
    renderRecords();
    toast(`${minutes}分を学習記録に追加しました。`);
  });

  // グラフ・期間別集計
  function currentRange() {
    const today = localDate(todayKey());

    if (period === "day") {
      return {
        start: todayKey(),
        end: todayKey(),
        title: "今日",
        labels: ["今日"],
        dates: [todayKey()]
      };
    }

    if (period === "week") {
      const monday = dayOffset(today, -((today.getDay() + 6) % 7));
      const dates = Array.from({ length: 7 }, (_, i) =>
        todayKey(dayOffset(monday, i))
      );

      return {
        start: dates[0],
        end: dates[6],
        title: "今週（月〜日）",
        labels: dates.map(k => {
          const d = localDate(k);
          return `${d.getMonth() + 1}/${d.getDate()}`;
        }),
        dates
      };
    }

    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const dates = Array.from({ length: end.getDate() }, (_, i) =>
      todayKey(dayOffset(start, i))
    );

    return {
      start: dates[0],
      end: dates[dates.length - 1],
      title: `${today.getFullYear()}年${today.getMonth() + 1}月`,
      labels: dates.map(k => String(localDate(k).getDate())),
      dates
    };
  }

  function renderRecords() {
    const range = currentRange();
    const records = recordsForDates(range.start, range.end);
    const seconds = total(records);

    $("#period-title").textContent = range.title;
    $("#period-total").textContent = duration(seconds);

    $$(".segmented button").forEach(button =>
      button.classList.toggle("active", button.dataset.period === period)
    );

    drawBars(range, records);
    drawDonut(records);

    const bySubject = {};
    records.forEach(r => {
      bySubject[r.subject] = (bySubject[r.subject] || 0) + r.seconds;
    });

    const entries = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);

    $("#subject-breakdown").innerHTML = entries.length
      ? entries.map(([name, value], i) => `
        <div class="break-row">
          <div>
            <span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>
            <b>${esc(name)}</b><strong>${duration(value)}</strong>
          </div>
          <div class="progress-track">
            <span style="width:${seconds ? value / seconds * 100 : 0}%;background:${COLORS[i % COLORS.length]}"></span>
          </div>
        </div>`).join("")
      : empty("この期間の学習記録はありません。");

    $("#period-records").innerHTML = records.length
      ? [...records].sort((a, b) =>
          b.date.localeCompare(a.date) || b.createdAt - a.createdAt
        ).map(recordHTML).join("")
      : empty("この期間の記録はまだありません。");
  }

  $$(".segmented button").forEach(button => {
    button.addEventListener("click", () => {
      period = button.dataset.period;
      renderRecords();
    });
  });

  function drawBars(range, records) {
    const canvas = $("#bar-chart");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(280, rect.width);
    const height = 220;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const values = range.dates.map(date =>
      total(records.filter(r => r.date === date))
    );

    const max = Math.max(60, ...values);
    const pad = { l: 8, r: 8, t: 18, b: 30 };
    const plotW = width - pad.l - pad.r;
    const plotH = height - pad.t - pad.b;

    for (let i = 0; i < 4; i++) {
      const y = pad.t + plotH * i / 3;
      ctx.strokeStyle = "rgba(160,180,230,.15)";
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(width - pad.r, y);
      ctx.stroke();
    }

    const step = plotW / Math.max(1, values.length);
    const barW = Math.max(3, Math.min(24, step * 0.55));

    values.forEach((value, i) => {
      const barH = value / max * (plotH - 5);
      const x = pad.l + i * step + (step - barW) / 2;
      const y = pad.t + plotH - barH;

      const gradient = ctx.createLinearGradient(0, y, 0, pad.t + plotH);
      gradient.addColorStop(0, COLORS[i % COLORS.length]);
      gradient.addColorStop(1, "#7168ce");

      ctx.fillStyle = gradient;
      ctx.beginPath();

      if (ctx.roundRect) ctx.roundRect(x, y, barW, Math.max(1, barH), 4);
      else ctx.rect(x, y, barW, Math.max(1, barH));

      ctx.fill();

      if (values.length <= 7 || i % 5 === 0 || i === values.length - 1) {
        ctx.fillStyle = "#8998b9";
        ctx.font = "10px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(range.labels[i], x + barW / 2, height - 9);
      }
    });
  }

  function drawDonut(records) {
    const config = state.targets[period] || {
      kind: "time",
      value: period === "day" ? 120 : period === "week" ? 600 : 2400,
      unit: "minutes"
    };

    $("#target-kind").value = config.kind;
    $("#target-value").value = config.value;
    $("#target-unit").value = config.unit || "minutes";
    $("#target-unit-label").style.display =
      config.kind === "time" ? "grid" : "none";

    const actual = config.kind === "time"
      ? total(records) / (config.unit === "hours" ? 3600 : 60)
      : new Set(records.map(r => `${r.subject}|${r.item}`)).size;

    const target = Math.max(1, Number(config.value) || 1);
    const pct = Math.min(100, Math.round(actual / target * 100));

    $("#donut").style.background =
      `conic-gradient(#91adff ${pct * 3.6}deg, rgba(140,157,196,.16) 0deg)`;

    $("#donut-percent").textContent = pct + "%";
    $("#target-progress-text").textContent =
      `${Math.round(actual * 10) / 10} / ${target} ` +
      (config.kind === "time"
        ? (config.unit === "hours" ? "時間" : "分")
        : "項目");

    $("#target-explain").textContent = pct >= 100
      ? "目標達成！設定した目標をクリアしました。"
      : `あと ${Math.max(0, Math.ceil(target - actual))}` +
        (config.kind === "time"
          ? (config.unit === "hours" ? "時間" : "分")
          : "項目") + "で目標達成です。";
  }

  $("#target-kind").addEventListener("change", () => {
    $("#target-unit-label").style.display =
      $("#target-kind").value === "time" ? "grid" : "none";
  });

  $("#save-target").addEventListener("click", () => {
    const value = Number($("#target-value").value);

    if (!Number.isFinite(value) || value < 1) {
      return toast("目標値は1以上にしてください。");
    }

    state.targets[period] = {
      kind: $("#target-kind").value,
      value,
      unit: $("#target-unit").value
    };

    persistStudy();
    renderRecords();
    renderHome();
    toast("この期間の目標を保存しました。");
  });

  window.addEventListener("resize", () => {
    if (!$("#view-records").hidden) renderRecords();
  });

  // 目標マップ
  let goals = read(KEYS.goals, null);

  if (!Array.isArray(goals) || !goals.length) {
    goals = [
      {
        id: uid(), name: "最終目標", note: "ここに叶えたい目標を書く",
        parentId: null, final: true, type: "final", done: false, dueDate: ""
      },
      {
        id: uid(), name: "中間目標", note: "最初の大きな一歩",
        parentId: null, final: false, type: "intermediate", done: false, dueDate: ""
      }
    ];
  }

  if (!goals.some(g => g.final)) goals[0].final = true;

  let selectedGoalId = goals.find(g => g.final)?.id || goals[0]?.id;
  let editingGoalId = null;
  let pan = { x: 0, y: 0, scale: 1 };
  let dragging = null;
  let pinchStart = null;
  let pointers = new Map();

  function persistGoals() {
    save(KEYS.goals, goals);
  }

  function goalProgress(goal) {
    const children = goals.filter(g => g.parentId === goal.id);
    if (!children.length) return goal.done ? 100 : 0;
    return Math.round(children.reduce((sum, g) => sum + goalProgress(g), 0) / children.length);
  }

  function renderGoals() {
    const svg = $("#goal-world");
    if (!svg) return;

    svg.replaceChildren();

    const root = goals.find(g => g.final) || goals[0];
    if (!root) return;

    const positions = new Map([[root.id, { x: 500, y: 100 }]]);
    const children = id => goals.filter(g => g.parentId === id);

    function place(parent, depth) {
      const kids = children(parent.id);
      kids.forEach((goal, index) => {
        const x = Math.max(120, Math.min(
          880,
          (positions.get(parent.id)?.x || 500) +
          (index - (kids.length - 1) / 2) * (depth === 1 ? 270 : 180)
        ));

        positions.set(goal.id, { x, y: 100 + depth * 165 });
        place(goal, depth + 1);
      });
    }

    place(root, 1);

    goals.filter(g => !positions.has(g.id)).forEach((goal, i) => {
      positions.set(goal.id, { x: 150 + (i % 4) * 230, y: 430 + Math.floor(i / 4) * 130 });
    });

    const ns = "http://www.w3.org/2000/svg";

    goals.forEach(goal => {
      if (!goal.parentId || !positions.has(goal.parentId)) return;

      const a = positions.get(goal.parentId);
      const b = positions.get(goal.id);
      const path = document.createElementNS(ns, "path");

      path.setAttribute("d",
        `M ${a.x} ${a.y + 38} C ${a.x} ${a.y + 85}, ${b.x} ${b.y - 60}, ${b.x} ${b.y - 38}`
      );
      path.setAttribute("class", "goal-branch");
      svg.append(path);
    });

    goals.forEach(goal => {
      const p = positions.get(goal.id);
      const group = document.createElementNS(ns, "g");

      group.setAttribute("transform", `translate(${p.x - 105},${p.y - 38})`);
      group.setAttribute("class",
        `goal-node ${goal.id === selectedGoalId ? "chosen" : ""} ${goal.final ? "final" : ""}`
      );
      group.style.cursor = "pointer";

      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("width", "210");
      rect.setAttribute("height", "76");
      rect.setAttribute("rx", goal.final ? "15" : "12");
      group.append(rect);

      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", "105");
      text.setAttribute("y", "31");
      text.setAttribute("text-anchor", "middle");
      text.textContent = goal.name.length > 15
        ? goal.name.slice(0, 14) + "…"
        : goal.name;
      group.append(text);

      const sub = document.createElementNS(ns, "text");
      sub.setAttribute("x", "105");
      sub.setAttribute("y", "55");
      sub.setAttribute("text-anchor", "middle");
      sub.setAttribute("class", "goal-node-sub");
      sub.textContent = `${goal.done ? "✓ 達成" : "目標"} · ${goalProgress(goal)}%`;
      group.append(sub);

      group.addEventListener("click", () => selectGoal(goal.id));
      svg.append(group);
    });

    const moon = document.createElementNS(ns, "g");
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "500");
    circle.setAttribute("cy", "635");
    circle.setAttribute("r", "28");
    circle.setAttribute("fill", "#dce7ff");
    circle.setAttribute("stroke", "#a9bfff");
    circle.setAttribute("stroke-width", "2");
    moon.append(circle);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", "500");
    label.setAttribute("y", "680");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "#dce7ff");
    label.setAttribute("font-size", "15");
    label.textContent = "☾ MOON · 目標達成";
    moon.append(label);
    svg.append(moon);

    svg.setAttribute("transform", `translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
    selectGoal(goals.some(g => g.id === selectedGoalId) ? selectedGoalId : root.id, false);
  }

  function selectGoal(id, redraw = true) {
    selectedGoalId = id;
    const goal = goals.find(g => g.id === id);
    if (!goal) return;

    $("#selected-goal-title").textContent = goal.name;
    $("#selected-goal-desc").textContent = goal.note || "メモはありません。";
    $("#selected-goal-progress-label").textContent = `達成率 ${goalProgress(goal)}%`;
    $("#selected-goal-progress-bar").style.width = `${goalProgress(goal)}%`;
    $("#selected-goal-due").textContent = goal.dueDate
      ? `期限：${goal.dueDate}`
      : "期限未設定";
    $("#selected-goal-progress-note").textContent =
      goal.done ? "この目標は達成済みです。" : "子目標の達成状況から自動計算します。";
    $("#toggle-goal-done").textContent = goal.done ? "↶ 未達成に戻す" : "✓ 達成にする";

    if (redraw) renderGoals();
    else {
      $$(".goal-node").forEach(node => {
        node.classList.toggle("chosen",
          node.querySelector("text")?.textContent ===
          (goal.name.length > 15 ? goal.name.slice(0, 14) + "…" : goal.name)
        );
      });
    }
  }

  function openGoalDialog(goal = null, parentId = null) {
    editingGoalId = goal?.id || null;

    $("#goal-dialog-title").textContent = goal ? "目標を編集" : "目標を追加";
    $("#goal-name").value = goal?.name || "";
    $("#goal-note").value = goal?.note || "";
    $("#goal-type").value = goal?.type || (goal?.final ? "final" : "intermediate");
    $("#goal-due-date").value = goal?.dueDate || "";

    const parentSelect = $("#goal-parent");
    parentSelect.innerHTML = '<option value="">親目標なし</option>' +
      goals.filter(g => g.id !== goal?.id).map(g =>
        `<option value="${esc(g.id)}">${esc(g.name)}</option>`
      ).join("");

    parentSelect.value = parentId || goal?.parentId || "";
    $("#goal-dialog").showModal();
  }

  $("#add-goal").addEventListener("click", () => openGoalDialog());
  $("#add-child-goal").addEventListener("click", () => openGoalDialog(null, selectedGoalId));

  $("#edit-goal").addEventListener("click", () => {
    const goal = goals.find(g => g.id === selectedGoalId);
    if (goal) openGoalDialog(goal);
  });

  $("#toggle-goal-done").addEventListener("click", () => {
    const goal = goals.find(g => g.id === selectedGoalId);
    if (!goal) return;
    goal.done = !goal.done;
    persistGoals();
    renderGoals();
    toast(goal.done ? "目標を達成済みにしました。" : "未達成に戻しました。");
  });

  $("#goal-form").addEventListener("submit", event => {
    event.preventDefault();

    const name = $("#goal-name").value.trim();
    if (!name) return;

    const type = $("#goal-type").value;
    const parentId = $("#goal-parent").value || null;
    const dueDate = $("#goal-due-date").value;
    const note = $("#goal-note").value.trim();

    if (editingGoalId && parentId === editingGoalId) {
      return toast("自分自身を親目標にはできません。");
    }

    if (type === "final") goals.forEach(g => {
      g.final = false;
      if (g.type === "final") g.type = "intermediate";
    });

    if (editingGoalId) {
      const goal = goals.find(g => g.id === editingGoalId);
      if (!goal) return;

      Object.assign(goal, {
        name, note, parentId, dueDate,
        type, final: type === "final"
      });
    } else {
      const goal = {
        id: uid(), name, note, parentId, dueDate,
        type, final: type === "final", done: false
      };
      goals.push(goal);
      selectedGoalId = goal.id;
    }

    if (!goals.some(g => g.final)) goals[0].final = true;

    persistGoals();
    $("#goal-dialog").close();
    renderGoals();
    toast("目標を保存しました。");
  });

  $("#delete-goal").addEventListener("click", () => {
    const goal = goals.find(g => g.id === selectedGoalId);
    if (!goal) return;

    if (goal.final && goals.length > 1) {
      return toast("先に別の目標を最終目標にしてください。");
    }

    if (!confirm(`「${goal.name}」を削除しますか？`)) return;

    goals = goals.filter(g => g.id !== goal.id);
    goals.forEach(g => {
      if (g.parentId === goal.id) g.parentId = null;
    });

    if (!goals.some(g => g.final) && goals.length) goals[0].final = true;

    selectedGoalId = goals.find(g => g.final)?.id || goals[0]?.id || null;
    persistGoals();
    renderGoals();
  });

  function zoom(factor) {
    pan.scale = Math.max(0.45, Math.min(2.2, pan.scale * factor));
    $("#goal-world").setAttribute("transform",
      `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
    );
  }

  $("#zoom-in").addEventListener("click", () => zoom(1.15));
  $("#zoom-out").addEventListener("click", () => zoom(1 / 1.15));

  $("#reset-map").addEventListener("click", () => {
    pan = { x: 0, y: 0, scale: 1 };
    renderGoals();
  });

  const goalCanvas = $("#goal-canvas");

  goalCanvas.addEventListener("pointerdown", event => {
    if (event.target.closest(".goal-node")) return;

    goalCanvas.setPointerCapture(event.pointerId);
    dragging = {
      x: event.clientX,
      y: event.clientY,
      px: pan.x,
      py: pan.y
    };
  });

  goalCanvas.addEventListener("pointermove", event => {
    if (!dragging) return;

    pan.x = dragging.px + event.clientX - dragging.x;
    pan.y = dragging.py + event.clientY - dragging.y;

    $("#goal-world").setAttribute("transform",
      `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
    );
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(name => {
    goalCanvas.addEventListener(name, () => dragging = null);
  });

  // カウントダウン
  let countdowns = read(KEYS.countdowns, []);
  if (!Array.isArray(countdowns)) countdowns = [];

  function daysUntil(dateKey) {
    const target = localDate(dateKey);
    const today = localDate(todayKey());
    return Math.round((target - today) / 86400000);
  }

  function renderCountdowns() {
    const list = $("#countdown-list");
    if (!list) return;

    if (!countdowns.length) {
      list.innerHTML = empty("受験・テスト・提出日などを登録できます。");
      return;
    }

    countdowns.sort((a, b) => a.date.localeCompare(b.date));

    list.innerHTML = countdowns.map(item => {
      const days = daysUntil(item.date);
      const label = days > 0
        ? `あと ${days} 日`
        : days === 0 ? "今日！" : `${Math.abs(days)} 日経過`;

      return `<article class="countdown-item">
        <div class="countdown-copy">
          <strong>${esc(item.name)}</strong>
          <small>${esc(item.date.replaceAll("-", "/"))}</small>
        </div>
        <div class="countdown-number">${label}</div>
        <button type="button" class="countdown-delete" data-countdown-delete="${esc(item.id)}" aria-label="削除">×</button>
      </article>`;
    }).join("");

    $$("[data-countdown-delete]").forEach(button => {
      button.addEventListener("click", () => {
        const item = countdowns.find(c => c.id === button.dataset.countdownDelete);
        if (!item || !confirm(`「${item.name}」を削除しますか？`)) return;

        countdowns = countdowns.filter(c => c.id !== item.id);
        save(KEYS.countdowns, countdowns);
        renderCountdowns();
      });
    });
  }

  $("#add-countdown").addEventListener("click", () => {
    $("#countdown-id").value = "";
    $("#countdown-title").value = "";
    $("#countdown-date").value = todayKey();
    $("#countdown-note").value = "";
    $("#countdown-dialog-title").textContent = "イベントを追加";
    $("#delete-countdown").hidden = true;
    $("#countdown-dialog").showModal();
  });

  $("#countdown-form").addEventListener("submit", event => {
    event.preventDefault();

    const id = $("#countdown-id").value;
    const name = $("#countdown-title").value.trim();
    const date = $("#countdown-date").value;
    const note = $("#countdown-note").value.trim();

    if (!name || !date) return toast("イベント名と日付を入力してください。");

    const item = { id: id || uid(), name, date, note };
    const index = countdowns.findIndex(c => c.id === item.id);

    if (index < 0) countdowns.push(item);
    else countdowns[index] = item;

    save(KEYS.countdowns, countdowns);
    $("#countdown-dialog").close();
    renderCountdowns();
    toast("カウントダウンを保存しました。");
  });

  $("#delete-countdown").addEventListener("click", () => {
    const id = $("#countdown-id").value;
    if (!id || !confirm("このイベントを削除しますか？")) return;

    countdowns = countdowns.filter(c => c.id !== id);
    save(KEYS.countdowns, countdowns);
    $("#countdown-dialog").close();
    renderCountdowns();
  });

  // カレンダーとタスク
  const oldCalendar = read(KEYS.calendar, {});
  const calendar = {
    events: Array.isArray(oldCalendar.events) ? oldCalendar.events : [],
    tasks: Array.isArray(oldCalendar.tasks) ? oldCalendar.tasks : []
  };

  let calDate = new Date();
  let selectedDate = todayKey();

  const saveCalendar = () => save(KEYS.calendar, calendar);

  const dateText = key => {
    const date = localDate(key);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${"日月火水木金土"[date.getDay()]}）`;
  };

  const dayEvents = key => calendar.events.filter(event => event.date === key);

  function renderCalendar() {
    const grid = $("#calendar-grid");
    if (!grid) return;

    $("#month-title").textContent =
      `${calDate.getFullYear()}年${calDate.getMonth() + 1}月`;

    grid.replaceChildren();

    // 曜日見出し
    ["日", "月", "火", "水", "木", "金", "土"].forEach((name, index) => {
      const heading = document.createElement("div");
      heading.className = `calendar-weekday weekday-${index}`;
      heading.textContent = name;
      grid.append(heading);
    });

    const first = new Date(calDate.getFullYear(), calDate.getMonth(), 1);
    const start = dayOffset(first, -first.getDay());

    for (let i = 0; i < 42; i++) {
      const date = dayOffset(start, i);
      const key = todayKey(date);
      const button = document.createElement("button");

      button.type = "button";
      button.className = "calendar-day day-cell" +
        (date.getMonth() !== calDate.getMonth() ? " outside" : "") +
        (key === todayKey() ? " today" : "") +
        (key === selectedDate ? " selected" : "");

      const hasEvents = dayEvents(key).length > 0;
      const hasTasks = calendar.tasks.some(t => t.date === key && !t.completed);

      button.innerHTML = `
        <span class="day-number">${date.getDate()}</span>
        <span class="day-markers">
          ${hasEvents ? '<i class="event-dot"></i>' : ""}
          ${hasTasks ? '<i class="task-dot"></i>' : ""}
        </span>`;

      button.addEventListener("click", () => {
        selectedDate = key;
        calDate = new Date(date.getFullYear(), date.getMonth(), 1);
        renderCalendarAll();
      });

      grid.append(button);
    }
  }

  function renderDayItems() {
    const box = $("#day-items");
    if (!box) return;

    $("#selected-date-title").textContent = dateText(selectedDate) + " の予定";
    box.replaceChildren();

    const events = dayEvents(selectedDate).sort((a, b) =>
      (a.start || "").localeCompare(b.start || "")
    );

    if (!events.length) {
      box.innerHTML = empty("この日の予定はありません。＋予定から追加できます。");
    }

    events.forEach(item => {
      const row = document.createElement("article");
      row.className = "event-card";
      row.innerHTML = `
        <i class="event-stripe"></i>
        <div>
          <h3>${esc(item.title)}</h3>
          <p>${esc(item.notes || "")}</p>
          <small>${esc(item.start || "時間指定なし")}${item.end ? "〜" + esc(item.end) : ""}</small>
        </div>
        <button class="secondary-button" type="button">編集</button>`;

      row.querySelector("button").addEventListener("click", () => openEvent(item));
      box.append(row);
    });
  }

  function renderTasks() {
    const box = $("#task-list");
    if (!box) return;

    box.replaceChildren();

    if (!calendar.tasks.length) {
      box.innerHTML = empty("タスクはまだありません。");
      return;
    }

    calendar.tasks.forEach(task => {
      const row = document.createElement("div");
      row.className = "task-row" + (task.completed ? " done" : "");

      row.innerHTML = `
        <input type="checkbox" ${task.completed ? "checked" : ""} aria-label="完了">
        <div class="task-main">
          <strong>${esc(task.title)}</strong>
          <small>${task.date ? "期限：" + esc(dateText(task.date)) : "期限なし"}</small>
        </div>
        <button class="secondary-button" type="button">編集</button>`;

      row.querySelector("input").addEventListener("change", event => {
        task.completed = event.target.checked;
        saveCalendar();
        renderTasks();
        renderCalendar();
      });

      row.querySelector("button").addEventListener("click", () => openTask(task));
      box.append(row);
    });
  }

  function renderCalendarAll() {
    renderCalendar();
    renderDayItems();
    renderTasks();
  }

  function openEvent(item = null) {
    $("#event-form").reset();
    $("#event-id").value = item?.id || "";
    $("#event-title").value = item?.title || "";
    $("#event-date").value = item?.date || selectedDate;
    $("#event-start").value = item?.start || "";
    $("#event-end").value = item?.end || "";
    $("#event-notes").value = item?.notes || "";
    $("#event-dialog-title").textContent = item ? "予定を編集" : "予定を追加";
    $("#delete-event").hidden = !item;
    $("#event-dialog").showModal();
  }

  function openTask(task = null) {
    $("#task-form").reset();
    $("#task-id").value = task?.id || "";
    $("#task-title").value = task?.title || "";
    $("#task-date").value = task?.date || selectedDate;
    $("#task-notes").value = task?.notes || "";
    $("#task-dialog-title").textContent = task ? "タスクを編集" : "タスクを追加";
    $("#delete-task").hidden = !task;
    $("#task-dialog").showModal();
  }

  $("#add-event-day").addEventListener("click", () => openEvent());
  $("#add-task-button").addEventListener("click", () => openTask());

  $("#event-form").addEventListener("submit", event => {
    event.preventDefault();

    const item = {
      id: $("#event-id").value || uid(),
      title: $("#event-title").value.trim(),
      date: $("#event-date").value,
      start: $("#event-start").value,
      end: $("#event-end").value,
      notes: $("#event-notes").value.trim()
    };

    if (!item.title || !item.date) return toast("予定名と日付を入力してください。");

    const index = calendar.events.findIndex(e => e.id === item.id);
    if (index < 0) calendar.events.push(item);
    else calendar.events[index] = item;

    selectedDate = item.date;
    const date = localDate(item.date);
    calDate = new Date(date.getFullYear(), date.getMonth(), 1);

    saveCalendar();
    $("#event-dialog").close();
    renderCalendarAll();
    toast("予定を保存しました。");
  });

  $("#delete-event").addEventListener("click", () => {
    const id = $("#event-id").value;
    if (!id || !confirm("この予定を削除しますか？")) return;

    calendar.events.splice(
      0,
      calendar.events.length,
      ...calendar.events.filter(e => e.id !== id)
    );

    saveCalendar();
    $("#event-dialog").close();
    renderCalendarAll();
  });

  $("#task-form").addEventListener("submit", event => {
    event.preventDefault();

    const id = $("#task-id").value;
    const old = calendar.tasks.find(t => t.id === id);

    const task = {
      id: id || uid(),
      title: $("#task-title").value.trim(),
      date: $("#task-date").value,
      notes: $("#task-notes").value.trim(),
      completed: old?.completed || false
    };

    if (!task.title) return;

    const index = calendar.tasks.findIndex(t => t.id === task.id);
    if (index < 0) calendar.tasks.push(task);
    else calendar.tasks[index] = task;

    saveCalendar();
    $("#task-dialog").close();
    renderCalendarAll();
    toast("タスクを保存しました。");
  });

  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    if (!id || !confirm("このタスクを削除しますか？")) return;

    calendar.tasks.splice(
      0,
      calendar.tasks.length,
      ...calendar.tasks.filter(t => t.id !== id)
    );

    saveCalendar();
    $("#task-dialog").close();
    renderCalendarAll();
  });

  $("#quick-task-form").addEventListener("submit", event => {
    event.preventDefault();

    const title = $("#quick-task-title").value.trim();
    if (!title) return;

    calendar.tasks.push({
      id: uid(),
      title,
      date: selectedDate,
      notes: "",
      completed: false
    });

    event.target.reset();
    saveCalendar();
    renderCalendarAll();
    toast("タスクを追加しました。");
  });

  $("#prev-month").addEventListener("click", () => {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1);
    renderCalendar();
  });

  $("#next-month").addEventListener("click", () => {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
    renderCalendar();
  });

  $("#today-button").addEventListener("click", () => {
    selectedDate = todayKey();
    const date = new Date();
    calDate = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendarAll();
  });

  // 起動時の初期化
  if (running) {
    tick = setInterval(() => {
      updateTimerUI();
      persistTimer();
    }, 500);
  } else if (elapsedBase > 0) {
    paused = true;
  }

  if (timer.subjectId && state.subjects.some(s => s.id === timer.subjectId)) {
    selectedSubject = timer.subjectId;
  }
  if (timer.itemId && state.items.some(i => i.id === timer.itemId)) {
    selectedItem = timer.itemId;
  }

  // カレンダーの日付マスを必ず描画する
  persistStudy();
  renderHome();
  renderSubjects();
  renderRecords();
  renderGoals();
  renderCalendarAll();
  updateTimerUI();

  document.addEventListener("visibilitychange", () => {
    if (running) persistTimer();
    if (!document.hidden) {
      updateTimerUI();
      renderHome();
      if (!$("#view-calendar").hidden) renderCalendarAll();
    }
  });

  window.addEventListener("beforeunload", persistTimer);
})();