
(() => {
  "use strict";

  const STORAGE_KEY = "personal-calendar-v1";
  const STUDY_KEY = "one-for-all-study-v1";
  const $ = (selector) => document.querySelector(selector);
  const todayKey = () => dateKey(new Date());
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parseDate = (value) => {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const makeId = () => globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  const displayDate = (key) => {
    if (!key) return "期限なし";
    const d = parseDate(key);
    return `${d.getMonth() + 1}月${d.getDate()}日（${"日月火水木金土"[d.getDay()]}）`;
  };
  const durationText = (seconds) => {
    const minutes = Math.floor(Math.max(0, seconds) / 60);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours}時間${rest}分` : `${rest}分`;
  };
  const clockText = (seconds) => {
    seconds = Math.max(0, Math.floor(seconds));
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  let state = { events: [], tasks: [] };
  let study = { items: [], sessions: [], active: null };
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();
  let selectedDate = todayKey();
  let toastTimeout;

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      state.events = Array.isArray(saved.events) ? saved.events : [];
      state.tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
    } catch (error) {
      console.error("予定・タスクを読み込めませんでした", error);
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
      study.active = saved.active && saved.active.startedAt && saved.active.itemId
        ? saved.active : null;
    } catch (error) {
      console.error("学習記録を読み込めませんでした", error);
      study = { items: [], sessions: [], active: null };
    }
  }
  function saveStudy() {
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify(study));
    } catch (error) {
      console.error(error);
      toast("学習記録を保存できませんでした。空き容量を確認してください。");
    }
  }

  function allSessions() {
    const sessions = [...study.sessions];
    if (study.active) {
      const start = new Date(study.active.startedAt).getTime();
      const now = Date.now();
      if (Number.isFinite(start) && now > start) {
        sessions.push({
          id: "active-preview",
          itemId: study.active.itemId,
          startedAt: study.active.startedAt,
          endedAt: new Date(now).toISOString(),
          seconds: Math.floor((now - start) / 1000),
          date: dateKey(new Date(start)),
          activePreview: true
        });
      }
    }
    return sessions;
  }

  function sessionSeconds(session) {
    if (Number.isFinite(session.seconds)) return Math.max(0, session.seconds);
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.endedAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(0, Math.floor((end - start) / 1000)) : 0;
  }

  function sumSessions(sessions) {
    return sessions.reduce((sum, session) => sum + sessionSeconds(session), 0);
  }

  function daySessions(key) {
    return allSessions().filter(session => session.date === key);
  }

  function weekStartKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 6);
    return dateKey(d);
  }

  function totalSeconds() {
    return sumSessions(allSessions());
  }

  function todaySeconds() {
    return sumSessions(daySessions(todayKey()));
  }

  function weekSeconds() {
    const start = weekStartKey();
    return sumSessions(allSessions().filter(s => s.date >= start && s.date <= todayKey()));
  }

  function itemName(id) {
    return study.items.find(item => item.id === id)?.name || "削除済みの項目";
  }

  function renderStudyStats() {
    $("#home-today").textContent = durationText(todaySeconds());
    $("#home-week").textContent = durationText(weekSeconds());
    $("#home-total").textContent = durationText(totalSeconds());
    $("#record-today").textContent = durationText(todaySeconds());
    $("#record-week").textContent = durationText(weekSeconds());
    $("#record-total").textContent = durationText(totalSeconds());
  }

  function renderStudyItems() {
    const container = $("#study-item-list");
    const select = $("#timer-item-select");
    container.replaceChildren();
    select.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = study.items.length ? "学習項目を選択してください" : "先に学習項目を追加してください";
    select.append(placeholder);

    study.items.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.append(option);

      const total = sumSessions(allSessions().filter(s => s.itemId === item.id));
      const row = document.createElement("article");
      row.className = "study-item";
      row.innerHTML = `
        <div class="study-item-info">
          <strong>${escapeHtml(item.name)}</strong>
          <small>累計 ${escapeHtml(durationText(total))}</small>
        </div>
        <div class="study-actions">
          <button class="secondary-button" type="button" data-study-start="${escapeHtml(item.id)}">計測</button>
          <button class="secondary-button" type="button" data-study-rename="${escapeHtml(item.id)}">名前変更</button>
          <button class="danger-button" type="button" data-study-delete="${escapeHtml(item.id)}">削除</button>
        </div>`;
      container.append(row);
    });

    if (!study.items.length) {
      container.innerHTML = '<div class="study-empty">学習項目はまだありません。上の入力欄から「英語」「数学」などを追加してください。</div>';
    }

    if (study.active) {
      select.value = study.active.itemId;
      select.disabled = true;
    } else {
      select.disabled = false;
    }

    container.querySelectorAll("[data-study-start]").forEach(button => {
      button.addEventListener("click", () => {
        const id = button.dataset.studyStart;
        $("#timer-item-select").value = id;
        document.dispatchEvent(new CustomEvent("oneforall:go-timer"));
      });
    });

    container.querySelectorAll("[data-study-rename]").forEach(button => {
      button.addEventListener("click", () => {
        const item = study.items.find(x => x.id === button.dataset.studyRename);
        if (!item) return;
        const name = prompt("新しい項目名を入力してください", item.name);
        if (name === null) return;
        if (!name.trim()) return toast("項目名を入力してください。");
        item.name = name.trim().slice(0, 80);
        saveStudy();
        renderStudy();
        toast("学習項目を変更しました。");
      });
    });

    container.querySelectorAll("[data-study-delete]").forEach(button => {
      button.addEventListener("click", () => {
        const item = study.items.find(x => x.id === button.dataset.studyDelete);
        if (!item) return;
        if (study.active?.itemId === item.id) {
          return toast("計測中の項目は削除できません。先にタイマーを終了してください。");
        }
        if (!confirm(`「${item.name}」を削除しますか？\n過去の学習記録は残り、項目名は「削除済みの項目」と表示されます。`)) return;
        study.items = study.items.filter(x => x.id !== item.id);
        saveStudy();
        renderStudy();
        toast("学習項目を削除しました。");
      });
    });
  }

  function renderTimer() {
    const clock = $("#timer-clock");
    const status = $("#timer-status");
    const startButton = $("#timer-start");
    const stopButton = $("#timer-stop");
    if (!study.active) {
      clock.textContent = "00:00:00";
      status.textContent = "計測していません";
      startButton.disabled = false;
      stopButton.disabled = true;
      $("#timer-item-select").disabled = false;
      return;
    }
    const elapsed = Math.floor((Date.now() - new Date(study.active.startedAt).getTime()) / 1000);
    clock.textContent = clockText(elapsed);
    status.textContent = `計測中：${itemName(study.active.itemId)}`;
    startButton.disabled = true;
    stopButton.disabled = false;
    $("#timer-item-select").disabled = true;
  }

  function renderRecent() {
    const container = $("#home-recent");
    container.replaceChildren();
    const sessions = [...study.sessions].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt)).slice(0, 5);
    if (!sessions.length) {
      container.innerHTML = '<div class="study-empty">学習記録はまだありません。学習項目を登録して、タイマーを使ってみましょう。</div>';
      return;
    }
    sessions.forEach(session => {
      const row = document.createElement("div");
      row.className = "study-history-row";
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
      seconds: sumSessions(sessions.filter(s => s.itemId === item.id))
    })).sort((a, b) => b.seconds - a.seconds);

    if (!groups.length) {
      byItem.innerHTML = '<div class="study-empty">学習項目を追加すると、ここに項目別の合計が表示されます。</div>';
    } else {
      groups.forEach(group => {
        const row = document.createElement("div");
        row.className = "study-item";
        row.innerHTML = `<div class="study-item-info"><strong>${escapeHtml(group.item.name)}</strong><small>累計学習時間</small></div><strong class="study-item-time">${escapeHtml(durationText(group.seconds))}</strong>`;
        byItem.append(row);
      });
    }

    const filter = $("#record-date").value;
    const filtered = filter ? sessions.filter(s => s.date === filter) : sessions;
    if (!filtered.length) {
      history.innerHTML = `<div class="study-empty">${filter ? "この日の学習記録はありません。" : "まだ学習記録がありません。タイマーを使うと、ここに記録されます。"}</div>`;
      return;
    }
    filtered.forEach(session => {
      const row = document.createElement("div");
      row.className = "study-history-row";
      const start = new Date(session.startedAt);
      const end = new Date(session.endedAt);
      const time = `${start.toLocaleTimeString("ja-JP", {hour:"2-digit",minute:"2-digit"})}–${end.toLocaleTimeString("ja-JP", {hour:"2-digit",minute:"2-digit"})}`;
      row.innerHTML = `<span>${escapeHtml(itemName(session.itemId))}<br><small>${escapeHtml(displayDate(session.date))}</small></span><span>${escapeHtml(durationText(sessionSeconds(session)))}<br><small>${escapeHtml(time)}</small></span>`;
      history.append(row);
    });
  }

  function renderStudy() {
    renderStudyStats();
    renderStudyItems();
    renderTimer();
    renderRecent();
    renderRecords();
  }

  $("#study-item-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#study-item-name");
    const name = input.value.trim();
    if (!name) return toast("学習項目名を入力してください。");
    if (study.items.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      return toast("同じ名前の学習項目があります。");
    }
    study.items.push({ id: makeId(), name: name.slice(0, 80), createdAt: new Date().toISOString() });
    input.value = "";
    saveStudy();
    renderStudy();
    toast("学習項目を追加しました。");
  });

  $("#timer-start").addEventListener("click", () => {
    if (study.active) return toast("すでに計測中です。");
    const itemId = $("#timer-item-select").value;
    if (!study.items.some(item => item.id === itemId)) return toast("先に学習項目を選択してください。");
    study.active = { itemId, startedAt: new Date().toISOString() };
    saveStudy();
    renderStudy();
    toast("タイマーを開始しました。");
  });

  $("#timer-stop").addEventListener("click", () => {
    if (!study.active) return;
    const startMs = new Date(study.active.startedAt).getTime();
    const end = new Date();
    const seconds = Math.max(0, Math.floor((end.getTime() - startMs) / 1000));
    const startedAt = study.active.startedAt;
    const itemId = study.active.itemId;
    if (seconds < 1) return toast("記録できる時間がありません。");
    study.sessions.push({
      id: makeId(),
      itemId,
      startedAt,
      endedAt: end.toISOString(),
      seconds,
      date: dateKey(new Date(startMs))
    });
    study.active = null;
    saveStudy();
    renderStudy();
    toast(`学習時間 ${durationText(seconds)} を保存しました。`);
  });

  $("#record-date").addEventListener("change", renderRecords);
  $("#record-date-clear").addEventListener("click", () => {
    $("#record-date").value = "";
    renderRecords();
  });

  document.addEventListener("oneforall:go-timer", () => {
    document.querySelector('[data-view="home-view"]').classList.remove("active");
    document.querySelectorAll(".app-view").forEach(view => {
      view.hidden = view.id !== "timer-view";
    });
    document.querySelectorAll(".bottom-nav [data-view]").forEach(button => {
      const active = button.dataset.view === "study-items-view";
      button.classList.toggle("active", active);
    });
    window.scrollTo(0, 0);
  });

  // カレンダー・予定・タスク
  function eventsOn(date) { return state.events.filter(event => event.date === date); }
  function tasksOn(date) { return state.tasks.filter(task => task.date === date && !task.completed); }

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
    const events = eventsOn(selectedDate).sort((a, b) => (a.start || "99:99").localeCompare(b.start || "99:99"));
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
      card.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
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
        renderAll();
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

  function renderAll() {
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
    renderAll();
    closeDialog(eventDialog);
    toast(index >= 0 ? "予定を更新しました。" : "予定を追加しました。");
  });

  $("#delete-event").addEventListener("click", () => {
    const id = $("#event-id").value;
    const event = state.events.find(x => x.id === id);
    if (!event || !confirm(`「${event.title}」を削除しますか？`)) return;
    state.events = state.events.filter(x => x.id !== id);
    saveState();
    renderAll();
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
    renderAll();
    closeDialog(taskDialog);
    toast(index >= 0 ? "タスクを更新しました。" : "タスクを追加しました。");
  });

  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    const task = state.tasks.find(x => x.id === id);
    if (!task || !confirm(`「${task.title}」を削除しますか？`)) return;
    state.tasks = state.tasks.filter(x => x.id !== id);
    saveState();
    renderAll();
    closeDialog(taskDialog);
    toast("タスクを削除しました。");
  });

  $("#quick-task-form").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#quick-task-title");
    const title = input.value.trim();
    if (!title) return;
    state.tasks.push({ id: makeId(), title, date: selectedDate, notes: "", completed: false });
    input.value = "";
    saveState();
    renderAll();
    toast("タスクを追加しました。");
  });

  $("#prev-month").addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  });
  $("#next-month").addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    renderCalendar();
  });
  $("#today-button").addEventListener("click", () => {
    const now = new Date();
    selectedDate = dateKey(now);
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    renderAll();
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

  $("#export-button").addEventListener("click", () => {
    const backup = { ...state, study };
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
      if (!confirm("現在の予定・タスクを置き換えますか？バックアップに学習データが含まれていれば学習データも読み込みます。")) return;
      state = { events: parsed.events, tasks: parsed.tasks };
      if (parsed.study && Array.isArray(parsed.study.items) && Array.isArray(parsed.study.sessions)) {
        study = {
          items: parsed.study.items,
          sessions: parsed.study.sessions,
          active: parsed.study.active || null
        };
        saveStudy();
      }
      saveState();
      renderAll();
      renderStudy();
      toast("データを読み込みました。");
    } catch (error) {
      console.error(error);
      toast("読み込みに失敗しました。正しいバックアップを選んでください。");
    } finally {
      event.target.value = "";
    }
  });

  document.addEventListener("oneforall:viewchange", () => {
    renderStudy();
    renderAll();
  });

  loadState();
  loadStudy();
  renderAll();
  renderStudy();

  // 表示中はタイマー表示と集計を定期更新。経過時間は開始時刻から計算する。
  setInterval(() => {
    if (study.active) {
      renderTimer();
      renderStudyStats();
    }
  }, 1000);
})();
