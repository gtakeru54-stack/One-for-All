"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/app.js
 *
 * 全機能をこのファイルに集約したバージョン。
 * HTMLの各IDに対応し、追加モジュールを読み込まずに動作します。
 * 保存先はブラウザのlocalStorageです。
 */

(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  const KEYS = {
    study: "oneforall-study-v1",
    events: "oneforall-events-v1",
    tasks: "oneforall-tasks-v1",
    goals: "oneforall-goals-v1",
    finance: "oneforall-finance-v1",
    target: "oneforall-target-v1",
    dailyGoal: "oneforall-daily-study-goal"
  };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const dateKey = date => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      console.error(`保存データの読み込みに失敗: ${key}`, error);
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`保存に失敗: ${key}`, error);
      notify("保存できませんでした。端末の空き容量を確認してください。");
      return false;
    }
  };

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const formatMinutes = seconds => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours}時間${rest}分` : `${minutes}分`;
  };

  const formatClock = seconds => {
    const n = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = String(Math.floor(n / 3600)).padStart(2, "0");
    const m = String(Math.floor((n % 3600) / 60)).padStart(2, "0");
    const s = String(n % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const formatDate = value => {
    if (!value) return "日付未設定";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  let toastTimer = null;

  function notify(message) {
    const toast = $("#toast");
    if (!toast) {
      console.info(message);
      return;
    }
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  }

  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (dialog instanceof HTMLDialogElement) {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.hidden = false;
    }
  }

  function closeDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (dialog instanceof HTMLDialogElement) {
      if (dialog.open) dialog.close();
    } else {
      dialog.hidden = true;
    }
  }

  // --------------------------------------------------
  // データ
  // --------------------------------------------------

  function loadStudy() {
    const data = read(KEYS.study, {});
    return {
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      items: Array.isArray(data.items) ? data.items : [],
      records: Array.isArray(data.records) ? data.records : []
    };
  }

  let study = loadStudy();

  function saveStudy() {
    write(KEYS.study, study);
    renderStudy();
    renderHome();
    renderStatistics();
    renderCalendar();
  }

  function loadEvents() {
    const data = read(KEYS.events, []);
    return Array.isArray(data) ? data : [];
  }

  function loadTasks() {
    const data = read(KEYS.tasks, []);
    return Array.isArray(data) ? data : [];
  }

  function loadGoals() {
    const data = read(KEYS.goals, []);
    return Array.isArray(data) ? data : [];
  }

  function loadFinance() {
    const data = read(KEYS.finance, null);
    if (data && typeof data === "object") {
      return {
        cr: Number(data.cr) || 0,
        debt: Number(data.debt) || 0,
        unpaid: Number(data.unpaid) || 0,
        history: Array.isArray(data.history) ? data.history : [],
        missions: Array.isArray(data.missions) ? data.missions : []
      };
    }
    return {
      cr: 1400,
      debt: 0,
      unpaid: 0,
      history: [],
      missions: []
    };
  }

  let events = loadEvents();
  let tasks = loadTasks();
  let goals = loadGoals();
  let finance = loadFinance();

  function saveEvents() {
    write(KEYS.events, events);
    renderCalendar();
  }

  function saveTasks() {
    write(KEYS.tasks, tasks);
    renderCalendar();
  }

  function saveGoals() {
    write(KEYS.goals, goals);
    renderGoals();
  }

  function saveFinance() {
    write(KEYS.finance, finance);
    renderFinance();
    renderHome();
  }

  // --------------------------------------------------
  // 画面切り替え
  // --------------------------------------------------

  const VIEW_NAMES = [
    "home", "calendar", "study",
    "statistics", "goals", "rocket"
  ];

  function showView(name) {
    if (!VIEW_NAMES.includes(name)) name = "home";

    $$("main > section[id^='view-']").forEach(section => {
      const active = section.id === `view-${name}`;
      section.hidden = !active;
      section.classList.toggle("active", active);
      section.setAttribute("aria-hidden", String(!active));
    });

    $$("[data-view]").forEach(button => {
      const active = button.dataset.view === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });

    window.scrollTo({ top: 0, behavior: "auto" });

    if (name === "calendar") renderCalendar();
    if (name === "study") renderStudy();
    if (name === "statistics") renderStatistics();
    if (name === "goals") renderGoals();
    if (name === "rocket") renderFinance();
  }

  function initNavigation() {
    document.addEventListener("click", event => {
      const button = event.target.closest("[data-view]");
      if (!button) return;
      event.preventDefault();
      showView(button.dataset.view);
    });

    document.addEventListener("click", event => {
      const button = event.target.closest("[data-close]");
      if (!button) return;
      closeDialog(button.dataset.close);
    });

    $$(".app-dialog").forEach(dialog => {
      dialog.addEventListener("click", event => {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  // --------------------------------------------------
  // 学習記録
  // --------------------------------------------------

  let selectedSubjectId = null;
  let selectedTimerItemId = null;

  function subjectName(id) {
    return study.subjects.find(item => item.id === id)?.name || "科目なし";
  }

  function itemName(id) {
    return study.items.find(item => item.id === id)?.name || "項目なし";
  }

  function recordsForSubject(id) {
    return study.records.filter(record => record.subjectId === id);
  }

  function totalSeconds(records) {
    return records.reduce((sum, record) =>
      sum + Math.max(0, Number(record.seconds) || 0), 0);
  }

  function renderStudySelects() {
    const subjectSelects = [
      $("#manual-subject")
    ].filter(Boolean);

    subjectSelects.forEach(select => {
      const previous = select.value;
      select.innerHTML =
        '<option value="">科目を選択</option>' +
        study.subjects.map(subject =>
          `<option value="${escapeHTML(subject.id)}">${escapeHTML(subject.name)}</option>`
        ).join("");

      if (study.subjects.some(subject => subject.id === previous)) {
        select.value = previous;
      } else if (selectedSubjectId &&
          study.subjects.some(subject => subject.id === selectedSubjectId)) {
        select.value = selectedSubjectId;
      }
    });

    const itemSelect = $("#manual-item");
    if (itemSelect) {
      const subjectId = $("#manual-subject")?.value || "";
      const previous = itemSelect.value;
      const available = study.items.filter(item =>
        !subjectId || item.subjectId === subjectId
      );

      itemSelect.innerHTML =
        '<option value="">項目を選択（任意）</option>' +
        available.map(item =>
          `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`
        ).join("");

      if (available.some(item => item.id === previous)) {
        itemSelect.value = previous;
      }
    }
  }

  function renderStudy() {
    renderStudySelects();

    const list = $("#subject-list");
    if (list) {
      if (!study.subjects.length) {
        list.innerHTML =
          '<p class="muted">まだ科目がありません。「＋ 科目」から登録してください。</p>';
      } else {
        list.innerHTML = study.subjects.map(subject => {
          const seconds = totalSeconds(recordsForSubject(subject.id));
          const count = study.items.filter(item =>
            item.subjectId === subject.id
          ).length;

          return `
            <article class="subject-card panel">
              <div>
                <strong>${escapeHTML(subject.name)}</strong>
                <p class="muted">${count}項目 · 累計 ${formatMinutes(seconds)}</p>
              </div>
              <div class="button-row">
                <button class="secondary-button" type="button"
                  data-subject-open="${escapeHTML(subject.id)}">詳細</button>
                <button class="danger-button" type="button"
                  data-subject-delete="${escapeHTML(subject.id)}">削除</button>
              </div>
            </article>`;
        }).join("");
      }
    }

    const detail = $("#subject-detail");
    const current = study.subjects.find(item => item.id === selectedSubjectId);

    if (detail) detail.hidden = !current;

    if (current) {
      if ($("#detail-title")) $("#detail-title").textContent = current.name;
      const itemList = $("#item-list");
      const subjectItems = study.items.filter(item =>
        item.subjectId === current.id
      );

      if (itemList) {
        if (!subjectItems.length) {
          itemList.innerHTML =
            '<p class="muted">学習項目がありません。「＋ 学習項目」から追加できます。</p>';
        } else {
          itemList.innerHTML = subjectItems.map(item => {
            const seconds = totalSeconds(
              study.records.filter(record => record.itemId === item.id)
            );
            return `
              <article class="subject-card panel">
                <div>
                  <strong>${escapeHTML(item.name)}</strong>
                  <p class="muted">累計 ${formatMinutes(seconds)}</p>
                </div>
                <div class="button-row">
                  <button class="primary-button" type="button"
                    data-start-item="${escapeHTML(item.id)}">学習する</button>
                  <button class="danger-button" type="button"
                    data-item-delete="${escapeHTML(item.id)}">削除</button>
                </div>
              </article>`;
          }).join("");
        }
      }
    }

    const homeRecords = $("#home-records");
    if (homeRecords) {
      const recent = [...study.records]
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 5);

      homeRecords.innerHTML = recent.length ? recent.map(record => `
        <article class="subject-card panel">
          <div>
            <strong>${escapeHTML(subjectName(record.subjectId))}</strong>
            <p class="muted">${escapeHTML(record.itemId ? itemName(record.itemId) : record.notes || "学習記録")} · ${formatDate(record.date)}</p>
          </div>
          <strong>${formatMinutes(record.seconds)}</strong>
        </article>
      `).join("") : '<p class="muted">学習記録はまだありません。</p>';
    }
  }

  function initStudy() {
    $("#add-subject")?.addEventListener("click", () => {
      $("#subject-name").value = "";
      openDialog("subject-dialog");
      setTimeout(() => $("#subject-name")?.focus(), 50);
    });

    $("#subject-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const input = $("#subject-name");
      const name = input?.value.trim();
      if (!name) return;

      const subject = { id: makeId(), name, createdAt: new Date().toISOString() };
      study.subjects.push(subject);
      selectedSubjectId = subject.id;
      saveStudy();
      closeDialog("subject-dialog");
      notify("科目を登録しました。");
    });

    $("#subject-list")?.addEventListener("click", event => {
      const open = event.target.closest("[data-subject-open]");
      const remove = event.target.closest("[data-subject-delete]");

      if (open) {
        selectedSubjectId = open.dataset.subjectOpen;
        renderStudy();
      }

      if (remove) {
        const id = remove.dataset.subjectDelete;
        const subject = study.subjects.find(item => item.id === id);
        if (!subject) return;
        if (!confirm(`「${subject.name}」と関連する学習項目を削除しますか？学習記録自体は残ります。`)) return;

        const itemIds = study.items.filter(item => item.subjectId === id).map(item => item.id);
        study.subjects = study.subjects.filter(item => item.id !== id);
        study.items = study.items.filter(item => item.subjectId !== id);
        if (selectedSubjectId === id) selectedSubjectId = null;
        if (selectedTimerItemId && itemIds.includes(selectedTimerItemId)) {
          selectedTimerItemId = null;
        }
        saveStudy();
        notify("科目を削除しました。");
      }
    });

    $("#close-subject")?.addEventListener("click", () => {
      selectedSubjectId = null;
      renderStudy();
    });

    $("#add-item")?.addEventListener("click", () => {
      if (!study.subjects.some(item => item.id === selectedSubjectId)) {
        notify("先に科目の詳細を開いてください。");
        return;
      }
      $("#item-name").value = "";
      openDialog("item-dialog");
      setTimeout(() => $("#item-name")?.focus(), 50);
    });

    $("#item-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const name = $("#item-name")?.value.trim();
      if (!name || !selectedSubjectId) return;

      study.items.push({
        id: makeId(),
        subjectId: selectedSubjectId,
        name,
        createdAt: new Date().toISOString()
      });

      saveStudy();
      closeDialog("item-dialog");
      notify("学習項目を登録しました。");
    });

    $("#item-list")?.addEventListener("click", event => {
      const remove = event.target.closest("[data-item-delete]");
      const start = event.target.closest("[data-start-item]");

      if (remove) {
        const id = remove.dataset.itemDelete;
        const item = study.items.find(entry => entry.id === id);
        if (!item) return;
        if (!confirm(`「${item.name}」を削除しますか？`)) return;

        study.items = study.items.filter(entry => entry.id !== id);
        if (selectedTimerItemId === id) selectedTimerItemId = null;
        saveStudy();
        notify("学習項目を削除しました。");
      }

      if (start) {
        selectedTimerItemId = start.dataset.startItem;
        const item = study.items.find(entry => entry.id === selectedTimerItemId);
        if (!item) return;
        selectedSubjectId = item.subjectId;
        $("#timer-label").textContent = `${subjectName(item.subjectId)}：${item.name}`;
        $("#timer-panel").hidden = false;
        renderStudy();
        $("#timer-panel").scrollIntoView({ behavior: "smooth", block: "start" });
        notify("タイマーを開始できます。");
      }
    });

    $("#manual-subject")?.addEventListener("change", () => {
      renderStudySelects();
    });

    $("#manual-record-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const subjectId = $("#manual-subject")?.value;
      const itemId = $("#manual-item")?.value || null;
      const hours = Number($("#manual-hours")?.value);
      const minutes = Number($("#manual-minutes")?.value);
      const date = $("#manual-date")?.value || todayKey();
      const notes = $("#manual-notes")?.value.trim() || "";

      if (!study.subjects.some(subject => subject.id === subjectId)) {
        notify("科目を選択してください。");
        return;
      }

      if (!Number.isFinite(hours) || hours < 0 ||
          !Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
        notify("時間と分を正しく入力してください。");
        return;
      }

      const seconds = Math.round(hours * 3600 + minutes * 60);
      if (seconds <= 0) {
        notify("1分以上の学習時間を入力してください。");
        return;
      }

      study.records.push({
        id: makeId(),
        subjectId,
        itemId,
        seconds,
        date,
        notes,
        createdAt: new Date().toISOString(),
        source: "manual"
      });

      saveStudy();
      $("#manual-hours").value = "0";
      $("#manual-minutes").value = "30";
      $("#manual-notes").value = "";
      notify("学習時間を保存しました。");
    });

    if ($("#manual-date") && !$("#manual-date").value) {
      $("#manual-date").value = todayKey();
    }

    renderStudy();
  }

  // --------------------------------------------------
  // タイマー
  // --------------------------------------------------

  let timerRunning = false;
  let timerStartedAt = 0;
  let timerElapsed = 0;
  let timerInterval = null;

  function currentTimerSeconds() {
    return timerElapsed + (timerRunning
      ? Math.floor((Date.now() - timerStartedAt) / 1000)
      : 0);
  }

  function updateTimerDisplay() {
    const seconds = currentTimerSeconds();
    if ($("#timer-display")) {
      $("#timer-display").textContent = formatClock(seconds);
    }
    if ($("#timer-state")) {
      $("#timer-state").textContent = timerRunning
        ? "計測中です。終了すると学習記録に保存されます。"
        : seconds > 0
          ? "一時停止中です。再開または記録して終了できます。"
          : "開始すると学習時間を計測します。";
    }

    if ($("#timer-start")) $("#timer-start").disabled = timerRunning;
    if ($("#timer-pause")) $("#timer-pause").disabled = !timerRunning;
    if ($("#timer-finish")) $("#timer-finish").disabled = seconds <= 0;
  }

  function initTimer() {
    $("#timer-start")?.addEventListener("click", () => {
      if (timerRunning) return;

      if (!selectedSubjectId ||
          !study.subjects.some(subject => subject.id === selectedSubjectId)) {
        const subjectId = $("#manual-subject")?.value;
        if (study.subjects.some(subject => subject.id === subjectId)) {
          selectedSubjectId = subjectId;
        } else if (study.subjects.length) {
          selectedSubjectId = study.subjects[0].id;
        } else {
          notify("先に科目を登録してください。");
          return;
        }
      }

      timerRunning = true;
      timerStartedAt = Date.now();
      $("#timer-panel").hidden = false;
      if (selectedTimerItemId) {
        const item = study.items.find(entry => entry.id === selectedTimerItemId);
        $("#timer-label").textContent = item
          ? `${subjectName(item.subjectId)}：${item.name}`
          : `${subjectName(selectedSubjectId)}：学習タイマー`;
      } else {
        $("#timer-label").textContent = `${subjectName(selectedSubjectId)}：学習タイマー`;
      }

      clearInterval(timerInterval);
      timerInterval = setInterval(updateTimerDisplay, 250);
      updateTimerDisplay();
    });

    $("#timer-pause")?.addEventListener("click", () => {
      if (!timerRunning) return;
      timerElapsed = currentTimerSeconds();
      timerRunning = false;
      clearInterval(timerInterval);
      updateTimerDisplay();
    });

    $("#timer-finish")?.addEventListener("click", () => {
      if (timerRunning) {
        timerElapsed = currentTimerSeconds();
        timerRunning = false;
      }

      clearInterval(timerInterval);
      const seconds = timerElapsed;

      if (seconds <= 0) {
        notify("記録する時間がありません。");
        updateTimerDisplay();
        return;
      }

      if (!study.subjects.some(subject => subject.id === selectedSubjectId)) {
        notify("記録先の科目を選択してください。");
        updateTimerDisplay();
        return;
      }

      study.records.push({
        id: makeId(),
        subjectId: selectedSubjectId,
        itemId: selectedTimerItemId,
        seconds,
        date: todayKey(),
        notes: "",
        createdAt: new Date().toISOString(),
        source: "timer"
      });

      timerElapsed = 0;
      timerStartedAt = 0;
      selectedTimerItemId = null;
      saveStudy();
      updateTimerDisplay();
      notify("タイマーの時間を保存しました。");
    });

    updateTimerDisplay();
  }

  // --------------------------------------------------
  // ホーム
  // --------------------------------------------------

  function renderHome() {
    const today = todayKey();
    const now = new Date();
    const weekStart = new Date(now);
    const day = (weekStart.getDay() + 6) % 7;
    weekStart.setDate(weekStart.getDate() - day);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartKey = dateKey(weekStart);

    const todayRecords = study.records.filter(record => record.date === today);
    const weekRecords = study.records.filter(record =>
      record.date >= weekStartKey && record.date <= today
    );

    const todaySeconds = totalSeconds(todayRecords);
    const weekSeconds = totalSeconds(weekRecords);
    const allSeconds = totalSeconds(study.records);

    if ($("#today-chip")) $("#today-chip").textContent = formatDate(today);
    if ($("#home-today")) $("#home-today").textContent = formatMinutes(todaySeconds);
    if ($("#stat-today")) $("#stat-today").textContent = formatMinutes(todaySeconds);
    if ($("#stat-week")) $("#stat-week").textContent = formatMinutes(weekSeconds);
    if ($("#stat-all")) $("#stat-all").textContent =
      `${(allSeconds / 3600).toFixed(1)}時間`;
    if ($("#stat-subjects")) $("#stat-subjects").textContent =
      String(study.subjects.length);

    const dailyGoal = Math.max(1, Number(localStorage.getItem(KEYS.dailyGoal)) || 120);
    const percent = Math.min(100, Math.round(todaySeconds / (dailyGoal * 60) * 100));

    if ($("#home-progress")) $("#home-progress").style.width = `${percent}%`;
    if ($("#home-progress-label")) $("#home-progress-label").textContent = `${percent}%`;

    if ($("#home-cr")) $("#home-cr").textContent = `${finance.cr.toLocaleString("ja-JP")} CR`;
    if ($("#home-debt")) $("#home-debt").textContent = `${finance.debt.toLocaleString("ja-JP")} CR`;
  }

  // --------------------------------------------------
  // カレンダー・予定・タスク
  // --------------------------------------------------

  let calendarMonth = new Date();
  let selectedDate = todayKey();

  function initCalendar() {
    $("#prev-month")?.addEventListener("click", () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() - 1,
        1
      );
      renderCalendar();
    });

    $("#next-month")?.addEventListener("click", () => {
      calendarMonth = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth() + 1,
        1
      );
      renderCalendar();
    });

    $("#today-button")?.addEventListener("click", () => {
      calendarMonth = new Date();
      selectedDate = todayKey();
      renderCalendar();
    });

    $("#add-event-day")?.addEventListener("click", () => openEventForm());
    $("#add-task-button")?.addEventListener("click", () => {
      $("#task-id").value = "";
      $("#task-title").value = "";
      $("#task-date").value = selectedDate || todayKey();
      $("#task-notes").value = "";
      $("#task-dialog-title").textContent = "タスクを追加";
      $("#delete-task").hidden = true;
      openDialog("task-dialog");
    });

    $("#event-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const id = $("#event-id").value;
      const title = $("#event-title").value.trim();
      const date = $("#event-date").value;
      if (!title || !date) return;

      const entry = {
        id: id || makeId(),
        title,
        date,
        start: $("#event-start").value,
        end: $("#event-end").value,
        notes: $("#event-notes").value.trim()
      };

      if (id) events = events.map(item => item.id === id ? entry : item);
      else events.push(entry);

      selectedDate = date;
      calendarMonth = new Date(`${date}T00:00:00`);
      saveEvents();
      closeDialog("event-dialog");
      notify("予定を保存しました。");
    });

    $("#delete-event")?.addEventListener("click", () => {
      const id = $("#event-id").value;
      if (!id || !confirm("この予定を削除しますか？")) return;
      events = events.filter(item => item.id !== id);
      saveEvents();
      closeDialog("event-dialog");
      notify("予定を削除しました。");
    });

    $("#quick-task-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const title = $("#quick-task-title").value.trim();
      if (!title) return;

      tasks.push({
        id: makeId(),
        title,
        date: selectedDate || todayKey(),
        notes: "",
        done: false,
        createdAt: new Date().toISOString()
      });

      $("#quick-task-title").value = "";
      saveTasks();
      notify("タスクを追加しました。");
    });

    $("#task-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const id = $("#task-id").value;
      const title = $("#task-title").value.trim();
      if (!title) return;

      const old = tasks.find(item => item.id === id);
      const entry = {
        id: id || makeId(),
        title,
        date: $("#task-date").value,
        notes: $("#task-notes").value.trim(),
        done: old?.done || false,
        createdAt: old?.createdAt || new Date().toISOString()
      };

      if (id) tasks = tasks.map(item => item.id === id ? entry : item);
      else tasks.push(entry);

      saveTasks();
      closeDialog("task-dialog");
      notify("タスクを保存しました。");
    });

    $("#delete-task")?.addEventListener("click", () => {
      const id = $("#task-id").value;
      if (!id || !confirm("このタスクを削除しますか？")) return;
      tasks = tasks.filter(item => item.id !== id);
      saveTasks();
      closeDialog("task-dialog");
      notify("タスクを削除しました。");
    });

    $("#day-items")?.addEventListener("click", event => {
      const edit = event.target.closest("[data-event-edit]");
      if (edit) {
        const entry = events.find(item => item.id === edit.dataset.eventEdit);
        if (entry) openEventForm(entry);
      }
    });

    $("#task-list")?.addEventListener("click", event => {
      const toggle = event.target.closest("[data-task-toggle]");
      const edit = event.target.closest("[data-task-edit]");
      const remove = event.target.closest("[data-task-delete]");

      if (toggle) {
        const task = tasks.find(item => item.id === toggle.dataset.taskToggle);
        if (task) {
          task.done = !task.done;
          saveTasks();
        }
      }

      if (edit) {
        const task = tasks.find(item => item.id === edit.dataset.taskEdit);
        if (!task) return;
        $("#task-id").value = task.id;
        $("#task-title").value = task.title;
        $("#task-date").value = task.date || "";
        $("#task-notes").value = task.notes || "";
        $("#task-dialog-title").textContent = "タスクを編集";
        $("#delete-task").hidden = false;
        openDialog("task-dialog");
      }

      if (remove) {
        const id = remove.dataset.taskDelete;
        if (!confirm("このタスクを削除しますか？")) return;
        tasks = tasks.filter(item => item.id !== id);
        saveTasks();
      }
    });

    renderCalendar();
  }

  function openEventForm(entry = null) {
    $("#event-id").value = entry?.id || "";
    $("#event-title").value = entry?.title || "";
    $("#event-date").value = entry?.date || selectedDate || todayKey();
    $("#event-start").value = entry?.start || "";
    $("#event-end").value = entry?.end || "";
    $("#event-notes").value = entry?.notes || "";
    $("#event-dialog-title").textContent = entry ? "予定を編集" : "予定を追加";
    $("#delete-event").hidden = !entry;
    openDialog("event-dialog");
  }

  function renderCalendar() {
    const grid = $("#calendar-grid");
    if (!grid) return;

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    if ($("#month-title")) $("#month-title").textContent = `${year}年${month + 1}月`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

    let html = weekdays.map(day => `<div class="calendar-weekday">${day}</div>`).join("");

    for (let i = 0; i < firstDay; i++) {
      html += '<div class="calendar-day empty" aria-hidden="true"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const weekday = new Date(year, month, day).getDay();
      const dayEvents = events.filter(item => item.date === key).length;
      const dayTasks = tasks.filter(item => item.date === key && !item.done).length;
      const classes = [
        "calendar-day",
        key === todayKey() ? "today" : "",
        key === selectedDate ? "selected" : "",
        weekday === 0 ? "sunday" : "",
        weekday === 6 ? "saturday" : ""
      ].filter(Boolean).join(" ");

      html += `
        <button type="button" class="${classes}" data-calendar-date="${key}">
          <span>${day}</span>
          <small>${dayEvents ? `●${dayEvents}` : ""}${dayTasks ? ` ◆${dayTasks}` : ""}</small>
        </button>`;
    }

    grid.innerHTML = html;

    grid.onclick = event => {
      const button = event.target.closest("[data-calendar-date]");
      if (!button) return;
      selectedDate = button.dataset.calendarDate;
      renderCalendar();
    };

    if ($("#selected-date-title")) {
      $("#selected-date-title").textContent =
        selectedDate === todayKey() ? "今日の予定" : formatDate(selectedDate);
    }

    const dayItems = $("#day-items");
    if (dayItems) {
      const selectedEvents = events.filter(item => item.date === selectedDate);
      dayItems.innerHTML = selectedEvents.length
        ? selectedEvents.map(item => `
          <article class="subject-card panel">
            <div>
              <strong>${escapeHTML(item.title)}</strong>
              <p class="muted">${escapeHTML([item.start, item.end].filter(Boolean).join("〜") || "時間未設定")}</p>
              ${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ""}
            </div>
            <button class="secondary-button" type="button"
              data-event-edit="${escapeHTML(item.id)}">編集</button>
          </article>`).join("")
        : '<p class="muted">この日の予定はありません。</p>';
    }

    const taskList = $("#task-list");
    if (taskList) {
      const visibleTasks = [...tasks].sort((a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.date || "9999").localeCompare(b.date || "9999")
      );

      taskList.innerHTML = visibleTasks.length
        ? visibleTasks.map(task => `
          <article class="subject-card panel">
            <div>
              <strong>${task.done ? "✓ " : ""}${escapeHTML(task.title)}</strong>
              <p class="muted">${task.date ? formatDate(task.date) : "期限なし"}</p>
              ${task.notes ? `<p>${escapeHTML(task.notes)}</p>` : ""}
            </div>
            <div class="button-row">
              <button class="secondary-button" type="button"
                data-task-toggle="${escapeHTML(task.id)}">${task.done ? "未完了に戻す" : "完了"}</button>
              <button class="secondary-button" type="button"
                data-task-edit="${escapeHTML(task.id)}">編集</button>
              <button class="danger-button" type="button"
                data-task-delete="${escapeHTML(task.id)}">削除</button>
            </div>
          </article>`).join("")
        : '<p class="muted">タスクはありません。</p>';
    }
  }

  // --------------------------------------------------
  // 統計・グラフ
  // --------------------------------------------------

  let selectedPeriod = "day";

  function initStatistics() {
    $$("[data-period]").forEach(button => {
      button.addEventListener("click", () => {
        selectedPeriod = button.dataset.period;
        $$("[data-period]").forEach(item =>
          item.classList.toggle("active", item === button)
        );
        renderStatistics();
      });
    });

    $("#target-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const kind = $("#target-kind").value;
      const value = Math.max(1, Number($("#target-value").value) || 1);
      const unit = $("#target-unit").value;
      write(KEYS.target, { kind, value, unit });
      notify("学習目標を保存しました。");
      renderStatistics();
      renderHome();
    });

    $("#target-kind")?.addEventListener("change", () => {
      const time = $("#target-kind").value === "time";
      if ($("#target-unit-label")) $("#target-unit-label").hidden = !time;
      renderStatistics();
    });

    const target = read(KEYS.target, null);
    if (target) {
      if ($("#target-kind")) $("#target-kind").value = target.kind || "time";
      if ($("#target-value")) $("#target-value").value = target.value || 120;
      if ($("#target-unit")) $("#target-unit").value = target.unit || "minutes";
      if ($("#target-unit-label")) {
        $("#target-unit-label").hidden = target.kind === "quantity";
      }
    }

    renderStatistics();
  }

  function periodRecords() {
    const today = todayKey();
    const now = new Date();

    if (selectedPeriod === "day") {
      return study.records.filter(record => record.date === today);
    }

    if (selectedPeriod === "week") {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      const startKey = dateKey(start);
      return study.records.filter(record => record.date >= startKey && record.date <= today);
    }

    if (selectedPeriod === "month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return study.records.filter(record => record.date >= dateKey(start) && record.date <= today);
    }

    return [...study.records];
  }

  function renderStatistics() {
    const records = periodRecords();
    const seconds = totalSeconds(records);
    const titles = { day: "今日", week: "過去7日間", month: "今月", all: "全期間" };

    if ($("#period-title")) $("#period-title").textContent = titles[selectedPeriod];
    if ($("#period-total")) $("#period-total").textContent = formatMinutes(seconds);

    const bySubject = new Map();
    records.forEach(record => {
      const name = subjectName(record.subjectId);
      bySubject.set(name, (bySubject.get(name) || 0) + (Number(record.seconds) || 0));
    });

    const breakdown = [...bySubject.entries()].sort((a, b) => b[1] - a[1]);
    const colors = ["#91c9ff", "#c5a2ff", "#ff8499", "#83dfc1", "#f5d77c", "#9da9ff", "#ffb987"];

    if ($("#subject-breakdown")) {
      $("#subject-breakdown").innerHTML = breakdown.length
        ? breakdown.map(([name, value], index) => {
          const percent = seconds ? Math.round(value / seconds * 100) : 0;
          return `
            <div class="breakdown-row">
              <div class="breakdown-label">
                <span class="legend-dot" style="background:${colors[index % colors.length]}"></span>
                <span>${escapeHTML(name)}</span>
                <strong>${formatMinutes(value)}</strong>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width:${percent}%;background:${colors[index % colors.length]}"></div>
              </div>
            </div>`;
        }).join("")
        : '<p class="muted">データがまだありません。</p>';
    }

    if ($("#bar-chart-legend")) {
      $("#bar-chart-legend").innerHTML = breakdown.map(([name, value], index) => `
        <p>${escapeHTML(name)}：${formatMinutes(value)}（${seconds ? Math.round(value / seconds * 100) : 0}%）</p>
      `).join("");
    }

    const target = read(KEYS.target, { kind: "time", value: 120, unit: "minutes" });
    const targetKind = target.kind || "time";
    const targetValue = Math.max(1, Number(target.value) || 120);
    const targetSeconds = targetKind === "quantity"
      ? targetValue
      : targetValue * (target.unit === "hours" ? 3600 : 60);

    const actual = targetKind === "quantity"
      ? new Set(records.map(record => record.itemId).filter(Boolean)).size
      : seconds;

    const progress = Math.min(100, Math.round(actual / targetSeconds * 100));
    const targetUnit = targetKind === "quantity"
      ? "項目"
      : target.unit === "hours" ? "時間" : "分";
    const actualText = targetKind === "quantity"
      ? `${actual} / ${targetValue}項目`
      : `${Math.floor(actual / (target.unit === "hours" ? 3600 : 60))} / ${targetValue}${targetUnit}`;

    if ($("#donut-percent")) $("#donut-percent").textContent = `${progress}%`;
    if ($("#target-progress-text")) $("#target-progress-text").textContent = actualText;
    if ($("#statistics-progress")) $("#statistics-progress").style.width = `${progress}%`;
    if ($("#target-explain")) {
      $("#target-explain").textContent = `${titles[selectedPeriod]}の目標達成率です。`;
    }

    const history = $("#period-records");
    if (history) {
      const recent = [...records].sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || "")
      );

      history.innerHTML = recent.length ? recent.map(record => `
        <article class="subject-card panel">
          <div>
            <strong>${escapeHTML(subjectName(record.subjectId))}</strong>
            <p class="muted">${escapeHTML(record.itemId ? itemName(record.itemId) : record.notes || "学習記録")} · ${formatDate(record.date)}</p>
          </div>
          <strong>${formatMinutes(record.seconds)}</strong>
        </article>
      `).join("") : '<p class="muted">この期間の記録はありません。</p>';
    }

    drawChart(records);
  }

  function drawChart(records) {
    const canvas = $("#bar-chart");
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width || 320));
    const height = 220;
    const ratio = window.devicePixelRatio || 1;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);

    const days = selectedPeriod === "day" ? 1 :
      selectedPeriod === "week" ? 7 :
      selectedPeriod === "month" ? new Date().getDate() : 7;

    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = dateKey(d);
      labels.push(selectedPeriod === "day" ? "今日" : `${d.getMonth() + 1}/${d.getDate()}`);
      values.push(totalSeconds(records.filter(record => record.date === key)) / 60);
    }

    if (selectedPeriod === "all") {
      labels.length = 0;
      values.length = 0;
      const grouped = new Map();
      records.forEach(record => {
        const key = record.date || "日付なし";
        grouped.set(key, (grouped.get(key) || 0) + (Number(record.seconds) || 0) / 60);
      });
      [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-7).forEach(([key, value]) => {
        labels.push(key.slice(5));
        values.push(value);
      });
    }

    const padding = { left: 36, right: 10, top: 16, bottom: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const max = Math.max(30, ...values) * 1.15;
    const slot = chartWidth / Math.max(values.length, 1);
    const barWidth = Math.max(4, Math.min(28, slot * 0.55));

    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartHeight * i / 4;
      ctx.strokeStyle = "rgba(180,195,230,0.16)";
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(210,220,245,0.75)";
      ctx.fillText(String(Math.round(max * (4 - i) / 4)), padding.left - 7, y);
    }

    values.forEach((value, index) => {
      const barHeight = chartHeight * value / max;
      const x = padding.left + slot * index + (slot - barWidth) / 2;
      const y = padding.top + chartHeight - barHeight;
      ctx.fillStyle = "#91c9ff";
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), 4);
      ctx.fill();

      ctx.fillStyle = "rgba(210,220,245,0.8)";
      ctx.textAlign = "center";
      ctx.fillText(labels[index] || "", x + barWidth / 2, height - 12);
    });
  }

  // --------------------------------------------------
  // 目標マップ
  // --------------------------------------------------

  let selectedGoalId = null;
  let goalScale = 1;

  function initGoals() {
    $("#add-goal")?.addEventListener("click", () => openGoalForm());
    $("#add-child-goal")?.addEventListener("click", () => {
      const parent = goals.find(goal => goal.id === selectedGoalId);
      if (!parent) {
        notify("先に目標を選択してください。");
        return;
      }
      openGoalForm(null, parent.id);
    });

    $("#edit-goal")?.addEventListener("click", () => {
      const goal = goals.find(item => item.id === selectedGoalId);
      if (goal) openGoalForm(goal);
    });

    $("#delete-goal")?.addEventListener("click", () => {
      const goal = goals.find(item => item.id === selectedGoalId);
      if (!goal) return;
      if (!confirm(`「${goal.name}」とその子目標を削除しますか？`)) return;

      const ids = new Set([goal.id]);
      let changed = true;
      while (changed) {
        changed = false;
        goals.forEach(item => {
          if (ids.has(item.parentId) && !ids.has(item.id)) {
            ids.add(item.id);
            changed = true;
          }
        });
      }
      goals = goals.filter(item => !ids.has(item.id));
      selectedGoalId = null;
      saveGoals();
      notify("目標を削除しました。");
    });

    $("#toggle-goal-done")?.addEventListener("click", () => {
      const goal = goals.find(item => item.id === selectedGoalId);
      if (!goal) return;
      goal.done = !goal.done;
      saveGoals();
    });

    $("#reset-map")?.addEventListener("click", () => {
      goalScale = 1;
      renderGoals();
    });

    $("#zoom-in")?.addEventListener("click", () => {
      goalScale = Math.min(2, goalScale + 0.1);
      applyGoalScale();
    });

    $("#zoom-out")?.addEventListener("click", () => {
      goalScale = Math.max(0.5, goalScale - 0.1);
      applyGoalScale();
    });

    $("#goal-form")?.addEventListener("submit", event => {
      event.preventDefault();

      const editId = $("#goal-form").dataset.editId || "";
      const name = $("#goal-name").value.trim();
      if (!name) return;

      const type = $("#goal-type").value;
      let parentId = $("#goal-parent").value || null;
      if (type === "final") parentId = null;

      const existing = goals.find(item => item.id === editId);
      const goal = {
        id: editId || makeId(),
        name,
        type,
        parentId,
        dueDate: $("#goal-due-date").value,
        note: $("#goal-note").value.trim(),
        done: existing?.done || false,
        createdAt: existing?.createdAt || new Date().toISOString()
      };

      if (editId) goals = goals.map(item => item.id === editId ? goal : item);
      else goals.push(goal);

      selectedGoalId = goal.id;
      delete $("#goal-form").dataset.editId;
      saveGoals();
      closeDialog("goal-dialog");
      notify("目標を保存しました。");
    });

    const svg = $("#goal-svg");
    svg?.addEventListener("click", event => {
      const node = event.target.closest("[data-goal-node]");
      if (!node) return;
      selectedGoalId = node.dataset.goalNode;
      renderGoals();
    });

    renderGoals();
  }

  function openGoalForm(goal = null, parentId = null) {
    const form = $("#goal-form");
    if (!form) return;

    form.dataset.editId = goal?.id || "";
    $("#goal-dialog-title").textContent = goal ? "目標を編集" : "目標を追加";
    $("#goal-name").value = goal?.name || "";
    $("#goal-type").value = goal?.type || (parentId ? "small" : "final");
    $("#goal-due-date").value = goal?.dueDate || "";
    $("#goal-note").value = goal?.note || "";

    const parentSelect = $("#goal-parent");
    const available = goals.filter(item => item.id !== goal?.id);
    parentSelect.innerHTML = '<option value="">親目標なし</option>' +
      available.map(item =>
        `<option value="${escapeHTML(item.id)}">${escapeHTML(item.name)}</option>`
      ).join("");
    parentSelect.value = parentId || goal?.parentId || "";

    $("#goal-type").onchange = () => {
      $("#goal-parent-field").hidden = $("#goal-type").value === "final";
    };
    $("#goal-parent-field").hidden = $("#goal-type").value === "final";

    openDialog("goal-dialog");
  }

  function goalProgress(goal) {
    if (goal.done) return 100;
    const children = goals.filter(item => item.parentId === goal.id);
    if (!children.length) return 0;
    return Math.round(children.reduce((sum, item) => sum + goalProgress(item), 0) / children.length);
  }

  function renderGoals() {
    const world = $("#goal-world");
    if (!world) return;

    if (!goals.length) {
      world.innerHTML = `
        <text x="500" y="330" text-anchor="middle" fill="#b9c7e9" font-size="24">
          「＋ 目標を追加」から始めましょう
        </text>`;
      if ($("#selected-goal-title")) $("#selected-goal-title").textContent = "最終目標";
      if ($("#selected-goal-desc")) $("#selected-goal-desc").textContent = "目標をタップすると詳細が表示されます。";
      if ($("#selected-goal-progress-label")) $("#selected-goal-progress-label").textContent = "達成率 0%";
      if ($("#selected-goal-progress-bar")) $("#selected-goal-progress-bar").style.width = "0%";
      if ($("#selected-goal-due")) $("#selected-goal-due").textContent = "期限未設定";
      return;
    }

    if (!goals.some(goal => goal.id === selectedGoalId)) {
      selectedGoalId = goals.find(goal => goal.type === "final")?.id || goals[0].id;
    }

    const roots = goals.filter(goal => !goal.parentId);
    const positions = new Map();
    const rootY = 90;
    const rootGap = 1000 / (roots.length + 1);

    roots.forEach((root, index) => {
      positions.set(root.id, { x: rootGap * (index + 1), y: rootY });
      const children = goals.filter(goal => goal.parentId === root.id);
      const gap = 800 / (children.length + 1);
      children.forEach((child, childIndex) => {
        positions.set(child.id, { x: 100 + gap * (childIndex + 1), y: 290 });
        const leaves = goals.filter(goal => goal.parentId === child.id);
        const leafGap = 700 / (leaves.length + 1);
        leaves.forEach((leaf, leafIndex) => {
          positions.set(leaf.id, { x: 150 + leafGap * (leafIndex + 1), y: 500 });
        });
      });
    });

    goals.forEach((goal, index) => {
      if (!positions.has(goal.id)) {
        positions.set(goal.id, { x: 100 + (index % 5) * 190, y: 600 });
      }
    });

    let html = "";
    goals.forEach(goal => {
      const from = positions.get(goal.parentId);
      const to = positions.get(goal.id);
      if (goal.parentId && from && to) {
        html += `<path d="M ${from.x} ${from.y + 25} C ${from.x} ${from.y + 85}, ${to.x} ${to.y - 85}, ${to.x} ${to.y - 25}"
          fill="none" stroke="#667eb5" stroke-width="3" opacity=".75"/>`;
      }
    });

    goals.forEach(goal => {
      const point = positions.get(goal.id);
      const selected = goal.id === selectedGoalId;
      const color = goal.done ? "#83dfc1" :
        goal.type === "final" ? "#c5a2ff" :
        goal.type === "intermediate" ? "#91c9ff" : "#ffcf9b";
      const label = goal.name.length > 12 ? `${goal.name.slice(0, 11)}…` : goal.name;

      html += `
        <g data-goal-node="${escapeHTML(goal.id)}" role="button" tabindex="0"
          style="cursor:pointer" aria-label="${escapeHTML(goal.name)}">
          <circle cx="${point.x}" cy="${point.y}" r="${selected ? 35 : 29}"
            fill="${color}" fill-opacity="${selected ? ".32" : ".18"}"
            stroke="${color}" stroke-width="${selected ? 4 : 2}"/>
          <circle cx="${point.x}" cy="${point.y}" r="6" fill="${color}"/>
          <text x="${point.x}" y="${point.y + 48}" text-anchor="middle"
            fill="#eaf0ff" font-size="15">${escapeHTML(label)}</text>
          <text x="${point.x}" y="${point.y + 66}" text-anchor="middle"
            fill="#aab9dc" font-size="11">${goal.done ? "達成" : `${goalProgress(goal)}%`}</text>
        </g>`;
    });

    world.innerHTML = html;
    applyGoalScale();

    const selected = goals.find(goal => goal.id === selectedGoalId);
    if (!selected) return;

    const progress = goalProgress(selected);
    if ($("#selected-goal-title")) $("#selected-goal-title").textContent = selected.name;
    if ($("#selected-goal-desc")) {
      $("#selected-goal-desc").textContent = selected.note || "この目標の説明はまだありません。";
    }
    if ($("#selected-goal-progress-bar")) {
      $("#selected-goal-progress-bar").style.width = `${progress}%`;
    }
    if ($("#selected-goal-progress-label")) {
      $("#selected-goal-progress-label").textContent = `達成率 ${progress}%`;
    }
    if ($("#selected-goal-due")) {
      $("#selected-goal-due").textContent = selected.dueDate
        ? `期限 ${formatDate(selected.dueDate)}`
        : "期限未設定";
    }
    if ($("#toggle-goal-done")) {
      $("#toggle-goal-done").textContent = selected.done ? "達成を取り消す" : "✓ 達成にする";
    }
  }

  function applyGoalScale() {
    const world = $("#goal-world");
    if (world) world.setAttribute("transform", `scale(${goalScale})`);
  }

  // --------------------------------------------------
  // ロケット・経済
  // --------------------------------------------------

  function initRocket() {
    $("#rocket-open-finance")?.addEventListener("click", () => {
      renderFinance();
      openDialog("rocket-finance-dialog");
    });

    $("#rocket-open-history")?.addEventListener("click", () => {
      $("#rocket-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    renderFinance();
  }

  function renderFinance() {
    const money = amount => `${Math.round(Number(amount) || 0).toLocaleString("ja-JP")} CR`;

    ["#rocket-cr", "#home-cr", "#finance-cr"].forEach(selector => {
      if ($(selector)) $(selector).textContent = money(finance.cr);
    });
    ["#rocket-debt", "#home-debt", "#finance-debt"].forEach(selector => {
      if ($(selector)) $(selector).textContent = money(finance.debt);
    });
    ["#rocket-unpaid", "#finance-unpaid"].forEach(selector => {
      if ($(selector)) $(selector).textContent = money(finance.unpaid);
    });
    if ($("#rocket-interest")) $("#rocket-interest").textContent = "日利 5%";

    const history = $("#rocket-history");
    if (history) {
      history.innerHTML = finance.history.length
        ? [...finance.history].reverse().slice(0, 20).map(item => `
          <article class="subject-card panel">
            <div>
              <strong>${escapeHTML(item.title || "取引")}</strong>
              <p class="muted">${escapeHTML(item.date || "")}</p>
            </div>
            <strong>${money(item.amount)}</strong>
          </article>`).join("")
        : '<p class="muted">取引履歴はまだありません。</p>';
    }

    const missions = $("#rocket-missions");
    if (missions) {
      missions.innerHTML = finance.missions.length
        ? finance.missions.map(item => `
          <article class="subject-card panel">
            <div>
              <strong>${escapeHTML(item.name || "宇宙開発計画")}</strong>
              <p class="muted">${escapeHTML(item.note || "")}</p>
            </div>
          </article>`).join("")
        : '<p class="muted">宇宙開発ミッションは、今後のアップデートで追加できます。</p>';
    }
  }

  // --------------------------------------------------
  // 起動
  // --------------------------------------------------

  function initialize() {
    try {
      initNavigation();
      initStudy();
      initTimer();
      initCalendar();
      initStatistics();
      initGoals();
      initRocket();

      if ($("#today-chip")) $("#today-chip").textContent = formatDate(todayKey());

      renderHome();
      renderStudy();
      renderCalendar();
      renderStatistics();
      renderGoals();
      renderFinance();

      window.addEventListener("resize", () => {
        if ($("#view-statistics") && !$("#view-statistics").hidden) {
          drawChart(periodRecords());
        }
      });

      console.info("ONE FOR ALL — COSMOS 起動完了");
    } 
} catch (error) {
  console.error("COSMOSの起動中にエラーが発生しました:", error);

  const message = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);

  const toast = document.querySelector("#toast");

  if (toast) {
    toast.textContent = `起動エラー：${message}`;
    toast.classList.add("visible");
    toast.style.whiteSpace = "normal";
    toast.style.overflowWrap = "anywhere";
    toast.style.zIndex = "99999";
  } else {
    alert(`起動エラー：${message}`);
  }
}

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})(); 