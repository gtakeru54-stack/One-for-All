(() => {
  "use strict";

  const STORAGE_KEY = "personal-calendar-v1";
  const $ = (selector) => document.querySelector(selector);
  const today = new Date();
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parseDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };
  const makeId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
  const displayDate = (key, includeWeekday = true) => {
    if (!key) return "期限なし";
    const date = parseDate(key);
    return `${date.getMonth() + 1}月${date.getDate()}日${includeWeekday ? `（${"日月火水木金土"[date.getDay()]}）` : ""}`;
  };

  let state = { events: [], tasks: [] };
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let selectedDate = dateKey(today);
  let toastTimeout = null;
  const reminded = new Set();

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        state.events = Array.isArray(parsed.events) ? parsed.events : [];
        state.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      }
    } catch (error) {
      console.error("保存データの読み込みに失敗しました", error);
      showToast("保存データを読み込めませんでした。");
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("保存に失敗しました", error);
      showToast("保存できませんでした。データを書き出してください。");
    }
  }
  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 2600);
  }
  function eventsOn(date) { return state.events.filter((event) => event.date === date); }
  function tasksOn(date) { return state.tasks.filter((task) => task.date === date && !task.completed); }

  function renderCalendar() {
    $("#month-title").textContent = `${viewYear}年${viewMonth + 1}月`;
    const grid = $("#calendar-grid");
    grid.replaceChildren();
    const first = new Date(viewYear, viewMonth, 1);
    const start = new Date(viewYear, viewMonth, 1 - first.getDay());
    const todayKey = dateKey(new Date());
    for (let index = 0; index < 42; index++) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = dateKey(date);
      const events = eventsOn(key);
      const tasks = tasksOn(key);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "day-cell";
      if (date.getMonth() !== viewMonth) button.classList.add("outside");
      if (key === selectedDate) button.classList.add("selected");
      if (key === todayKey) button.classList.add("today");
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
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "この日の予定はありません。＋から追加できます。";
      container.append(empty);
      return;
    }
    events.forEach((event) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${event.title}を編集`);
      const time = event.start ? `${event.start}${event.end ? `–${event.end}` : ""}` : "時刻未設定";
      card.innerHTML = `<span class="event-stripe ${escapeHtml(event.color || "blue")}"></span><div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.notes || (event.reminder ? "通知設定あり" : "詳細なし"))}</p></div><span class="event-time">${escapeHtml(time)}</span>`;
      const edit = () => openEventDialog(event);
      card.addEventListener("click", edit);
      card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); edit(); } });
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
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "タスクはまだありません。上から追加できます。";
      container.append(empty);
      return;
    }
    tasks.forEach((task) => {
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
      main.addEventListener("keydown", (e) => { if (e.key === "Enter") openTaskDialog(task); });
      const edit = document.createElement("button");
      edit.className = "task-edit";
      edit.type = "button";
      edit.textContent = "•••";
      edit.setAttribute("aria-label", `${task.title}を編集`);
      edit.addEventListener("click", () => openTaskDialog(task));
      row.append(checkbox, main, edit);
      container.append(row);
    });
  }

  function renderAll() { renderCalendar(); renderDayItems(); renderTasks(); }

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
    if (typeof eventDialog.showModal === "function") eventDialog.showModal();
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
    if (typeof taskDialog.showModal === "function") taskDialog.showModal();
    else taskDialog.setAttribute("open", "");
  }
  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  $("#event-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#event-id").value;
    const date = $("#event-date").value;
    const start = $("#event-start").value;
    const end = $("#event-end").value;
    if (!date) { showToast("日付を入力してください。"); return; }
    if (start && end && end < start) { showToast("終了時刻は開始時刻以降にしてください。"); return; }
    const event = {
      id: id || makeId(),
      title: $("#event-title").value.trim(),
      date, start, end,
      color: $("#event-color").value,
      notes: $("#event-notes").value.trim(),
      reminder: $("#event-reminder").checked
    };
    if (!event.title) { showToast("予定名を入力してください。"); return; }
    const index = state.events.findIndex((item) => item.id === id);
    if (index >= 0) state.events[index] = event; else state.events.push(event);
    selectedDate = date;
    const d = parseDate(date); viewYear = d.getFullYear(); viewMonth = d.getMonth();
    saveState(); renderAll(); closeDialog(eventDialog);
    if (event.reminder) requestNotificationPermission();
    showToast(index >= 0 ? "予定を更新しました。" : "予定を追加しました。");
  });

  $("#delete-event").addEventListener("click", () => {
    const id = $("#event-id").value;
    const event = state.events.find((item) => item.id === id);
    if (!event || !confirm(`「${event.title}」を削除しますか？`)) return;
    state.events = state.events.filter((item) => item.id !== id);
    saveState(); renderAll(); closeDialog(eventDialog); showToast("予定を削除しました。");
  });

  $("#task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#task-id").value;
    const task = {
      id: id || makeId(),
      title: $("#task-title").value.trim(),
      date: $("#task-date").value,
      notes: $("#task-notes").value.trim(),
      completed: state.tasks.find((item) => item.id === id)?.completed || false
    };
    if (!task.title) { showToast("タスク名を入力してください。"); return; }
    const index = state.tasks.findIndex((item) => item.id === id);
    if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
    saveState(); renderAll(); closeDialog(taskDialog);
    showToast(index >= 0 ? "タスクを更新しました。" : "タスクを追加しました。");
  });
  $("#delete-task").addEventListener("click", () => {
    const id = $("#task-id").value;
    const task = state.tasks.find((item) => item.id === id);
    if (!task || !confirm(`「${task.title}」を削除しますか？`)) return;
    state.tasks = state.tasks.filter((item) => item.id !== id);
    saveState(); renderAll(); closeDialog(taskDialog); showToast("タスクを削除しました。");
  });

  $("#quick-task-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#quick-task-title");
    const title = input.value.trim();
    if (!title) return;
    state.tasks.push({ id: makeId(), title, date: selectedDate, notes: "", completed: false });
    input.value = "";
    saveState(); renderAll(); showToast("タスクを追加しました。");
  });

  $("#prev-month").addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth - 1, 1); viewYear = d.getFullYear(); viewMonth = d.getMonth(); renderCalendar();
  });
  $("#next-month").addEventListener("click", () => {
    const d = new Date(viewYear, viewMonth + 1, 1); viewYear = d.getFullYear(); viewMonth = d.getMonth(); renderCalendar();
  });
  $("#today-button").addEventListener("click", () => {
    const now = new Date(); selectedDate = dateKey(now); viewYear = now.getFullYear(); viewMonth = now.getMonth(); renderAll();
  });
  $("#add-event-top").addEventListener("click", () => openEventDialog());
  $("#add-event-day").addEventListener("click", () => openEventDialog());
  $("#add-task-button").addEventListener("click", () => openTaskDialog());
  document.querySelectorAll(".close-dialog").forEach((button) => button.addEventListener("click", () => {
    closeDialog(button.closest("dialog"));
  }));
  [eventDialog, taskDialog].forEach((dialog) => dialog.addEventListener("click", (e) => {
    if (e.target === dialog) closeDialog(dialog);
  }));

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      showToast("このブラウザは通知に対応していません。"); return;
    }
    if (Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch (_) {}
    }
    if (Notification.permission === "granted") showToast("ブラウザ通知を許可しました。");
    else showToast("通知は許可されていません。");
  }
  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const currentMinute = `${dateKey(now)} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    state.events.filter((event) => event.reminder && event.start).forEach((event) => {
      const key = `${event.id}:${currentMinute}`;
      if (`${event.date} ${event.start}` === currentMinute && !reminded.has(key)) {
        reminded.add(key);
        try { new Notification("予定の時間です", { body: event.title }); } catch (error) { console.warn(error); }
      }
    });
  }

  $("#export-button").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `calendar-backup-${dateKey(new Date())}.json`;
    document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
    showToast("バックアップを書き出しました。");
  });
  $("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || !Array.isArray(parsed.events) || !Array.isArray(parsed.tasks)) throw new Error("形式が違います");
      if (!confirm("現在の予定とタスクを読み込んだデータで置き換えますか？")) return;
      state = {
        events: parsed.events.filter((x) => x && typeof x.title === "string" && typeof x.date === "string"),
        tasks: parsed.tasks.filter((x) => x && typeof x.title === "string")
      };
      saveState(); renderAll(); showToast("データを読み込みました。");
    } catch (error) {
      showToast("読み込みに失敗しました。正しいバックアップファイルを選んでください。");
    } finally { e.target.value = ""; }
  });

  loadState();
  renderAll();
  setInterval(checkReminders, 15000);
})();
