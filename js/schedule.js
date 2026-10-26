/* =========================================================
   ONE FOR ALL — COSMOS
   js/schedule.js

   ・週間予定表（月曜日〜日曜日）
   ・06:00〜翌日02:00の予定管理
   ・予定とタスクの連携
   ・予定とタスクの色分け
   ・カレンダーの曜日色と祝日表示
   ・学習記録の実施時刻表示
   ・学習予定と実績の比較
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const COLORS = [
    "#8eafff",
    "#c0a1ff",
    "#69dfc4",
    "#f4c77b",
    "#ff9dc5",
    "#86d99b",
    "#ff827e",
    "#67c9f5",
    "#b5a1ff"
  ];

  const CAL_KEY = "personal-calendar-v1";
  const STUDY_KEY = "oneforall-study-v1";
  const PLAN_KEY = "oneforall-week-schedule-v1";

  const uid = () => {
    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;
  };

  const read = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error(`[COSMOS] 読み込み失敗: ${key}`, error);
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`[COSMOS] 保存失敗: ${key}`, error);
      alert("保存できませんでした。端末の空き容量やブラウザの設定を確認してください。");
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

  const dateKey = date =>
    `${date.getFullYear()}-${String(date.getMonth() + 1)
      .padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  const parseDate = key => {
    if (!key || typeof key !== "string") {
      return new Date(NaN);
    }

    const parts = key.split("-").map(Number);

    if (parts.length !== 3 || parts.some(Number.isNaN)) {
      return new Date(NaN);
    }

    return new Date(parts[0], parts[1] - 1, parts[2]);
  };

  const addDays = (date, amount) => {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  };

  const formatDate = date =>
    `${date.getMonth() + 1}/${date.getDate()}`;

  const formatClock = date =>
    date.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });

  const clockText = totalMinutes => {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes)
      .padStart(2, "0")}`;
  };

  const timeText = seconds => {
    const totalMinutes = Math.floor(
      Math.max(0, Number(seconds) || 0) / 60
    );

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours
      ? `${hours}時間${minutes}分`
      : `${minutes}分`;
  };

  /* =====================================================
     保存データ
     ===================================================== */

  let calendar = read(CAL_KEY, {
    events: [],
    tasks: []
  });

  if (!calendar || typeof calendar !== "object") {
    calendar = { events: [], tasks: [] };
  }

  if (!Array.isArray(calendar.events)) {
    calendar.events = [];
  }

  if (!Array.isArray(calendar.tasks)) {
    calendar.tasks = [];
  }

  let plans = read(PLAN_KEY, []);

  if (!Array.isArray(plans)) {
    plans = [];
  }

  let selectedWeek = new Date();
  selectedWeek.setHours(0, 0, 0, 0);

  let editingPlanId = null;
  let observer = null;
  let refreshQueued = false;

  function saveCalendar() {
    return write(CAL_KEY, calendar);
  }

  function savePlans() {
    return write(PLAN_KEY, plans);
  }

  function reloadCalendar() {
    const data = read(CAL_KEY, {
      events: [],
      tasks: []
    });

    calendar = data && typeof data === "object"
      ? data
      : { events: [], tasks: [] };

    if (!Array.isArray(calendar.events)) {
      calendar.events = [];
    }

    if (!Array.isArray(calendar.tasks)) {
      calendar.tasks = [];
    }
  }

  function reloadPlans() {
    const data = read(PLAN_KEY, []);
    plans = Array.isArray(data) ? data : [];
  }

  function getWeekStart(date) {
    const result = new Date(date);

    result.setDate(
      result.getDate() - ((result.getDay() + 6) % 7)
    );

    result.setHours(0, 0, 0, 0);

    return result;
  }

  /* =====================================================
     日本の祝日
     ===================================================== */

  function vernalEquinox(year) {
    return Math.floor(
      20.8431 +
      0.242194 * (year - 1980) -
      Math.floor((year - 1980) / 4)
    );
  }

  function autumnalEquinox(year) {
    return Math.floor(
      23.2488 +
      0.242194 * (year - 1980) -
      Math.floor((year - 1980) / 4)
    );
  }

  function nthMonday(year, month, n) {
    const first = new Date(year, month - 1, 1);

    return 1 +
      ((8 - first.getDay()) % 7) +
      (n - 1) * 7;
  }

  function holidaySet(year) {
    const holidays = new Map();

    const put = (month, day, name) => {
      const key =
        `${year}-${String(month).padStart(2, "0")}-` +
        `${String(day).padStart(2, "0")}`;

      holidays.set(key, name);
    };

    put(1, 1, "元日");
    put(2, 11, "建国記念の日");
    put(2, 23, "天皇誕生日");
    put(4, 29, "昭和の日");
    put(5, 3, "憲法記念日");
    put(5, 4, "みどりの日");
    put(5, 5, "こどもの日");
    put(8, 11, "山の日");
    put(11, 3, "文化の日");
    put(11, 23, "勤労感謝の日");

    put(1, nthMonday(year, 1, 2), "成人の日");
    put(7, nthMonday(year, 7, 3), "海の日");
    put(9, nthMonday(year, 9, 3), "敬老の日");
    put(10, nthMonday(year, 10, 2), "スポーツの日");

    put(3, vernalEquinox(year), "春分の日");
    put(9, autumnalEquinox(year), "秋分の日");

    /*
      振替休日。
      日曜日の祝日の次の日から、祝日でない日を探す。
    */
    const originals = [...holidays.keys()].sort();

    for (const key of originals) {
      const date = parseDate(key);

      if (date.getDay() !== 0) {
        continue;
      }

      let substitute = addDays(date, 1);

      while (holidays.has(dateKey(substitute))) {
        substitute = addDays(substitute, 1);
      }

      holidays.set(dateKey(substitute), "振替休日");
    }

    /*
      国民の休日。
      前日と翌日が祝日で、当日が祝日でない平日。
    */
    for (let month = 1; month <= 12; month++) {
      const lastDay = new Date(year, month, 0).getDate();

      for (let day = 2; day < lastDay; day++) {
        const date = new Date(year, month - 1, day);
        const key = dateKey(date);

        if (
          holidays.has(key) ||
          date.getDay() === 0 ||
          date.getDay() === 6
        ) {
          continue;
        }

        const before = dateKey(addDays(date, -1));
        const after = dateKey(addDays(date, 1));

        if (holidays.has(before) && holidays.has(after)) {
          holidays.set(key, "国民の休日");
        }
      }
    }

    return holidays;
  }

  const holidayCache = new Map();

  function holidayName(date) {
    const year = date.getFullYear();

    if (!holidayCache.has(year)) {
      holidayCache.set(year, holidaySet(year));
    }

    return holidayCache.get(year).get(dateKey(date)) || "";
  }

  /* =====================================================
     追加スタイル
     ===================================================== */

  function installStyles() {
    if ($("#cosmos-schedule-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "cosmos-schedule-style";

    style.textContent = `
      .cosmos-schedule-panel {
        margin: 18px 0;
        padding: 16px;
        border: 1px solid rgba(142,175,255,.2);
        border-radius: 18px;
        background: rgba(12,20,43,.92);
        color: #edf2ff;
      }

      .cosmos-schedule-panel h2,
      .cosmos-schedule-panel h3 {
        margin-top: 0;
      }

      .cosmos-schedule-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin: 12px 0;
      }

      .cosmos-schedule-actions button,
      .cosmos-plan-form button {
        border: 1px solid rgba(142,175,255,.3);
        border-radius: 10px;
        padding: 10px 13px;
        background: #172344;
        color: #edf2ff;
        cursor: pointer;
      }

      .cosmos-week-label {
        color: #aab8d8;
        font-size: 12px;
      }

      .cosmos-week-scroll {
        overflow-x: auto;
        overscroll-behavior-x: contain;
        border-radius: 10px;
      }

      .cosmos-week-grid {
        display: grid;
        grid-template-columns: 58px repeat(7, minmax(105px, 1fr));
        min-width: 795px;
      }

      .cosmos-week-cell {
        border-right: 1px solid rgba(142,175,255,.12);
        border-bottom: 1px solid rgba(142,175,255,.12);
        min-height: 52px;
        padding: 4px;
        box-sizing: border-box;
      }

      .cosmos-week-head {
        position: sticky;
        top: 0;
        z-index: 2;
        background: #111a35;
        text-align: center;
        padding: 9px 3px;
        border-bottom: 1px solid rgba(142,175,255,.25);
        box-sizing: border-box;
      }

      .cosmos-hour {
        font-size: 11px;
        color: #9eafd3;
        text-align: center;
        padding-top: 7px;
      }

      .cosmos-plan {
        display: block;
        width: 100%;
        margin: 2px 0;
        padding: 6px 5px;
        text-align: left;
        border: 0;
        border-left: 3px solid var(--plan-color);
        border-radius: 6px;
        background: color-mix(in srgb, var(--plan-color) 20%, #101a34);
        color: #fff;
        font-size: 11px;
        overflow-wrap: anywhere;
        cursor: pointer;
      }

      .cosmos-plan small {
        display: block;
        opacity: .9;
        margin-top: 3px;
      }

      .cosmos-plan-form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .cosmos-plan-form label {
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 12px;
        color: #b9c7e5;
      }

      .cosmos-plan-form input:not([type="checkbox"]),
      .cosmos-plan-form select,
      .cosmos-plan-form textarea {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        border: 1px solid rgba(142,175,255,.3);
        border-radius: 9px;
        padding: 10px;
        background: #0c142b;
        color: #fff;
      }

      .cosmos-plan-form .wide {
        grid-column: 1 / -1;
      }

      .cosmos-plan-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        grid-column: 1 / -1;
      }

      .cosmos-plan-buttons .save {
        background: #314e91;
      }

      .cosmos-plan-buttons .delete {
        background: #632f4b;
      }

      .cosmos-plan-note {
        font-size: 12px;
        line-height: 1.6;
        color: #aab8d8;
      }

      .cosmos-actual {
        padding: 10px;
        border-radius: 10px;
        background: rgba(105,223,196,.08);
        margin-top: 8px;
        font-size: 12px;
        line-height: 1.8;
      }

      .cosmos-color-input {
        width: 48px !important;
        height: 38px;
        padding: 3px !important;
        cursor: pointer;
      }

      .cosmos-calendar-holiday {
        color: #ff777f !important;
      }

      .cosmos-calendar-saturday {
        color: #69c9ff !important;
      }

      .cosmos-calendar-head {
        text-align: center !important;
        box-sizing: border-box;
      }

      .cosmos-calendar-cell {
        min-width: 0;
        box-sizing: border-box;
      }

      .cosmos-event-label {
        display: block;
        margin-top: 5px;
        padding: 5px 7px;
        border-left: 3px solid var(--event-color);
        border-radius: 5px;
        background: color-mix(in srgb, var(--event-color) 18%, transparent);
        font-size: 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }

      .cosmos-schedule-panel .muted {
        color: #aab8d8;
      }

      @media (max-width: 520px) {
        .cosmos-schedule-panel {
          padding: 12px;
        }

        .cosmos-plan-form {
          grid-template-columns: 1fr;
        }

        .cosmos-plan-form .wide,
        .cosmos-plan-buttons {
          grid-column: 1;
        }
      }
    `;

    document.head.append(style);
  }

  /* =====================================================
     週間予定表の設置
     ===================================================== */

  function installPlanner() {
    const view = $("#view-calendar");

    if (!view || $("#cosmos-week-planner")) {
      return;
    }

    const panel = document.createElement("section");
    panel.id = "cosmos-week-planner";
    panel.className = "cosmos-schedule-panel";

    panel.innerHTML = `
      <p class="cosmos-week-label">WEEKLY PLANNER</p>
      <h2>週間予定表</h2>

      <p class="cosmos-plan-note">
        月曜日から日曜日まで、06:00〜翌日02:00の予定を登録できます。
        予定はこの端末に保存されます。
      </p>

      <div class="cosmos-schedule-actions">
        <button type="button" id="cosmos-week-prev">‹ 前の週</button>
        <button type="button" id="cosmos-week-today">今週</button>
        <button type="button" id="cosmos-week-next">次の週 ›</button>
        <button type="button" id="cosmos-plan-add">＋ 予定を追加</button>
      </div>

      <h3 id="cosmos-week-title"></h3>

      <div class="cosmos-week-scroll">
        <div id="cosmos-week-grid" class="cosmos-week-grid"></div>
      </div>

      <div class="cosmos-actual" id="cosmos-week-summary"></div>

      <p class="cosmos-plan-note">
        予定をタスク一覧に連携できます。
        学習予定は、同じ日付の学習記録と比較します。
      </p>

      <div id="cosmos-plan-editor" hidden>
        <h3 id="cosmos-plan-editor-title">予定を追加</h3>

        <form id="cosmos-plan-form" class="cosmos-plan-form">
          <label class="wide">
            予定の名前
            <input id="cosmos-plan-title" maxlength="120" required>
          </label>

          <label>
            日付
            <input id="cosmos-plan-date" type="date" required>
          </label>

          <label>
            色
            <input id="cosmos-plan-color" class="cosmos-color-input"
              type="color" value="#8eafff">
          </label>

          <label>
            開始時刻
            <select id="cosmos-plan-start"></select>
          </label>

          <label>
            終了時刻
            <select id="cosmos-plan-end"></select>
          </label>

          <label class="wide">
            メモ
            <textarea id="cosmos-plan-notes" rows="2" maxlength="500"></textarea>
          </label>

          <label class="wide">
            <span>
              <input id="cosmos-plan-task" type="checkbox" checked>
              タスク一覧にも追加する
            </span>
          </label>

          <label class="wide">
            <span>
              <input id="cosmos-plan-study" type="checkbox">
              学習予定として実績を比較する
            </span>
          </label>

          <label class="wide">
            比較する科目名（任意）
            <input id="cosmos-plan-subject" placeholder="例：数学">
          </label>

          <label class="wide">
            比較する学習項目名（任意）
            <input id="cosmos-plan-item" placeholder="例：二次関数">
          </label>

          <div class="cosmos-plan-buttons">
            <button class="save" type="submit">保存</button>
            <button id="cosmos-plan-cancel" type="button">キャンセル</button>
            <button id="cosmos-plan-delete" class="delete"
              type="button" hidden>削除</button>
          </div>
        </form>
      </div>
    `;

    const calendarPanel = view.querySelector(".calendar-panel");

    if (calendarPanel) {
      calendarPanel.after(panel);
    } else {
      view.prepend(panel);
    }

    const start = $("#cosmos-plan-start");
    const end = $("#cosmos-plan-end");

    // 06:00〜翌日02:00、30分単位
    for (let total = 360; total <= 1560; total += 30) {
      const label = clockText(total);
      const option = new Option(label, String(total));

      start.add(option);
      end.add(option.cloneNode(true));
    }

    start.value = "540";
    end.value = "600";

    $("#cosmos-week-prev").addEventListener("click", () => {
      selectedWeek = addDays(selectedWeek, -7);
      renderPlanner();
    });

    $("#cosmos-week-next").addEventListener("click", () => {
      selectedWeek = addDays(selectedWeek, 7);
      renderPlanner();
    });

    $("#cosmos-week-today").addEventListener("click", () => {
      selectedWeek = new Date();
      selectedWeek.setHours(0, 0, 0, 0);
      renderPlanner();
    });

    $("#cosmos-plan-add").addEventListener("click", () => {
      openPlan();
    });

    $("#cosmos-plan-cancel").addEventListener("click", () => {
      $("#cosmos-plan-editor").hidden = true;
    });

    $("#cosmos-plan-form").addEventListener("submit", savePlan);
    $("#cosmos-plan-delete").addEventListener("click", deletePlan);

    renderPlanner();
  }

  /* =====================================================
     予定の編集
     ===================================================== */

  function openPlan(plan = null, day = null) {
    editingPlanId = plan?.id || null;

    $("#cosmos-plan-editor").hidden = false;

    $("#cosmos-plan-editor-title").textContent =
      plan ? "予定を編集" : "予定を追加";

    $("#cosmos-plan-title").value = plan?.title || "";
    $("#cosmos-plan-date").value =
      plan?.date || dateKey(day || new Date());

    $("#cosmos-plan-start").value =
      String(plan?.startMinutes ?? 540);

    $("#cosmos-plan-end").value =
      String(plan?.endMinutes ?? 600);

    $("#cosmos-plan-color").value =
      plan?.color || COLORS[0];

    $("#cosmos-plan-notes").value = plan?.notes || "";

    $("#cosmos-plan-task").checked =
      plan?.createTask !== false;

    $("#cosmos-plan-study").checked =
      Boolean(plan?.study);

    $("#cosmos-plan-subject").value =
      plan?.subject || "";

    $("#cosmos-plan-item").value =
      plan?.item || "";

    $("#cosmos-plan-delete").hidden = !plan;

    $("#cosmos-plan-editor").scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  function savePlan(event) {
    event.preventDefault();

    const title = $("#cosmos-plan-title").value.trim();
    const date = $("#cosmos-plan-date").value;
    const startMinutes = Number($("#cosmos-plan-start").value);
    const endMinutes = Number($("#cosmos-plan-end").value);

    if (!title || !date) {
      alert("予定名と日付を入力してください。");
      return;
    }

    if (
      !Number.isFinite(startMinutes) ||
      !Number.isFinite(endMinutes) ||
      endMinutes <= startMinutes
    ) {
      alert("終了時刻は開始時刻より後にしてください。");
      return;
    }

    const old = plans.find(plan => plan.id === editingPlanId);

    const plan = {
      id: editingPlanId || uid(),
      title,
      date,
      startMinutes,
      endMinutes,
      color: $("#cosmos-plan-color").value || COLORS[0],
      notes: $("#cosmos-plan-notes").value.trim(),
      createTask: $("#cosmos-plan-task").checked,
      study: $("#cosmos-plan-study").checked,
      subject: $("#cosmos-plan-subject").value.trim(),
      item: $("#cosmos-plan-item").value.trim(),
      taskId: old?.taskId || null,
      createdAt: old?.createdAt || Date.now()
    };

    const existingIndex = plans.findIndex(
      item => item.id === plan.id
    );

    if (existingIndex >= 0) {
      plans[existingIndex] = plan;
    } else {
      plans.push(plan);
    }

    // 予定とタスクを同期
    if (plan.createTask) {
      let task = calendar.tasks.find(
        item => item.id === plan.taskId
      );

      if (!task) {
        task = {
          id: uid(),
          title: plan.title,
          date: plan.date,
          notes: plan.notes,
          completed: false,
          color: plan.color,
          planId: plan.id
        };

        calendar.tasks.push(task);
        plan.taskId = task.id;
      } else {
        task.title = plan.title;
        task.date = plan.date;
        task.notes = plan.notes;
        task.color = plan.color;
        task.planId = plan.id;
      }
    } else if (plan.taskId) {
      calendar.tasks = calendar.tasks.filter(
        task => task.id !== plan.taskId
      );

      plan.taskId = null;
    }

    if (!saveCalendar()) {
      return;
    }

    if (!savePlans()) {
      return;
    }

    $("#cosmos-plan-editor").hidden = true;

    renderPlanner();
    window.dispatchEvent(
      new CustomEvent("cosmos-schedule-updated")
    );
  }

  function deletePlan() {
    if (!editingPlanId) {
      return;
    }

    if (!confirm("この予定を削除しますか？")) {
      return;
    }

    const plan = plans.find(
      item => item.id === editingPlanId
    );

    plans = plans.filter(
      item => item.id !== editingPlanId
    );

    if (plan?.taskId) {
      calendar.tasks = calendar.tasks.filter(
        task => task.id !== plan.taskId
      );

      saveCalendar();
    }

    savePlans();

    $("#cosmos-plan-editor").hidden = true;

    renderPlanner();

    window.dispatchEvent(
      new CustomEvent("cosmos-schedule-updated")
    );
  }

  /* =====================================================
     週間予定表の描画
     ===================================================== */

  function renderPlanner() {
    const grid = $("#cosmos-week-grid");

    if (!grid) {
      return;
    }

    const monday = getWeekStart(selectedWeek);
    const sunday = addDays(monday, 6);

    $("#cosmos-week-title").textContent =
      `${formatDate(monday)} 〜 ${formatDate(sunday)}`;

    grid.replaceChildren();

    const corner = document.createElement("div");
    corner.className = "cosmos-week-head";
    corner.textContent = "時刻";
    grid.append(corner);

    const days = Array.from(
      { length: 7 },
      (_, index) => addDays(monday, index)
    );

    const weekdays = ["月", "火", "水", "木", "金", "土", "日"];

    days.forEach(day => {
      const head = document.createElement("div");
      head.className = "cosmos-week-head";

      const weekdayIndex = (day.getDay() + 6) % 7;
      const holiday = holidayName(day);

      head.textContent =
        `${weekdays[weekdayIndex]} ${formatDate(day)}` +
        (holiday ? ` ${holiday}` : "");

      if (day.getDay() === 0 || holiday) {
        head.style.color = "#ff777f";
      } else if (day.getDay() === 6) {
        head.style.color = "#69c9ff";
      }

      grid.append(head);
    });

    // 06:00〜翌日02:00。30分単位
    for (let time = 360; time < 1560; time += 30) {
      const minute = time % 60;

      const label = document.createElement("div");
      label.className = "cosmos-week-cell cosmos-hour";
      label.textContent = minute === 0 ? clockText(time) : "·";

      grid.append(label);

      days.forEach(day => {
        const cell = document.createElement("div");
        cell.className = "cosmos-week-cell";
        cell.dataset.date = dateKey(day);
        cell.dataset.minute = String(time);

        const dayPlans = plans.filter(plan =>
          plan.date === dateKey(day) &&
          time >= Number(plan.startMinutes) &&
          time < Number(plan.endMinutes)
        );

        dayPlans.forEach(plan => {
          // 予定の開始時刻のセルにだけボタンを表示
          if (time !== Number(plan.startMinutes)) {
            return;
          }

          const button = document.createElement("button");
          button.type = "button";
          button.className = "cosmos-plan";

          button.style.setProperty(
            "--plan-color",
            plan.color || COLORS[0]
          );

          button.innerHTML =
            `${escapeHTML(plan.title)}` +
            `<small>${escapeHTML(clockText(plan.startMinutes))}` +
            `–${escapeHTML(clockText(plan.endMinutes))}</small>`;

          button.addEventListener("click", event => {
            event.stopPropagation();
            openPlan(plan);
          });

          cell.append(button);
        });

        cell.addEventListener("click", event => {
          if (event.target.closest("button")) {
            return;
          }

          openPlan(null, day);

          $("#cosmos-plan-start").value = String(time);

          $("#cosmos-plan-end").value =
            String(Math.min(1560, time + 60));
        });

        grid.append(cell);
      });
    }

    renderPlanSummary(monday, sunday);
  }

  /* =====================================================
     学習予定と実績の比較
     ===================================================== */

  function renderPlanSummary(start, end) {
    const summary = $("#cosmos-week-summary");

    if (!summary) {
      return;
    }

    const plansInWeek = plans.filter(plan => {
      const date = parseDate(plan.date);

      return date >= start && date <= end;
    });

    const plannedMinutes = plansInWeek.reduce(
      (total, plan) =>
        total + Number(plan.endMinutes) -
        Number(plan.startMinutes),
      0
    );

    const studyData = read(STUDY_KEY, {});
    const records = Array.isArray(studyData.records)
      ? studyData.records
      : [];

    const comparisons = plansInWeek.filter(plan => plan.study);

    let actualSeconds = 0;
    let expectedMinutes = 0;

    comparisons.forEach(plan => {
      expectedMinutes +=
        Number(plan.endMinutes) - Number(plan.startMinutes);

      records.forEach(record => {
        const subject = String(
          record.subject || record.category || ""
        ).trim();

        const item = String(
          record.item || record.title || ""
        ).trim();

        const recordDate = String(
          record.date || record.day || ""
        ).slice(0, 10);

        const seconds = Number(
          record.durationSeconds ??
          record.elapsedSeconds ??
          (Number(record.minutes) || 0) * 60
        ) || 0;

        const subjectMatches =
          !plan.subject || subject === plan.subject;

        const itemMatches =
          !plan.item || item === plan.item;

        if (
          recordDate === plan.date &&
          subjectMatches &&
          itemMatches
        ) {
          actualSeconds += Math.max(0, seconds);
        }
      });
    });

    const actualMinutes = Math.floor(actualSeconds / 60);
    const difference = actualMinutes - expectedMinutes;

    let differenceText = "比較対象の学習予定はありません";

    if (comparisons.length) {
      const sign = difference >= 0 ? "+" : "−";

      differenceText =
        sign + timeText(Math.abs(difference) * 60);
    }

    summary.innerHTML =
      `<b>今週の予定時間：</b>` +
      `${Math.floor(plannedMinutes / 60)}時間` +
      `${plannedMinutes % 60}分<br>` +
      `<b>学習予定の実績：</b>${timeText(actualSeconds)}<br>` +
      `<b>実績 − 予定：</b>${escapeHTML(differenceText)}<br>` +
      `<span class="cosmos-plan-note">` +
      `実績は同じ日付の学習記録から集計します。` +
      `科目・項目名を指定した場合は一致する記録だけを集計します。` +
      `</span>`;
  }

  /* =====================================================
     既存カレンダーの曜日色・祝日色
     ===================================================== */

  function decorateCalendar() {
    const grid = $("#calendar-grid");

    if (!grid) {
      return;
    }

    const children = [...grid.children];

    if (children.length < 7) {
      return;
    }

    const headings = children.slice(0, 7);

    headings.forEach((heading, index) => {
      heading.classList.add("cosmos-calendar-head");
      heading.style.textAlign = "center";
      heading.style.justifyContent = "center";
      heading.style.boxSizing = "border-box";

      if (index === 0) {
        heading.style.color = "#ff777f";
      } else if (index === 6) {
        heading.style.color = "#69c9ff";
      } else {
        heading.style.color = "";
      }
    });

    const cells = children.slice(7);
    const monthTitle = $("#month-title")?.textContent || "";
    const match = monthTitle.match(/(\d+)年(\d+)月/);

    cells.forEach((cell, index) => {
      const weekday = index % 7;

      cell.classList.add("cosmos-calendar-cell");

      cell.classList.remove(
        "cosmos-calendar-holiday",
        "cosmos-calendar-saturday"
      );

      const number = cell.querySelector(".day-number");

      if (!number) {
        return;
      }

      if (cell.classList.contains("outside")) {
        return;
      }

      if (!match) {
        if (weekday === 0) {
          number.style.color = "#ff777f";
        } else if (weekday === 6) {
          number.style.color = "#69c9ff";
        }

        return;
      }

      const year = Number(match[1]);
      const month = Number(match[2]);
      const dayNumber = Number(number.textContent);

      const date = new Date(year, month - 1, dayNumber);
      const holiday = holidayName(date);

      if (weekday === 0 || holiday) {
        cell.classList.add("cosmos-calendar-holiday");
        number.style.color = "#ff777f";

        if (holiday) {
          number.title = holiday;
        }
      } else if (weekday === 6) {
        cell.classList.add("cosmos-calendar-saturday");
        number.style.color = "#69c9ff";
      } else {
        number.style.color = "";
        number.removeAttribute("title");
      }
    });
  }

  /* =====================================================
     予定カードの色
     ===================================================== */

  function decorateCalendarItems() {
    const box = $("#day-items");

    if (!box) {
      return;
    }

    const selectedText =
      $("#selected-date-title")?.textContent || "";

    const dateMatch = selectedText.match(
      /(\d{4})[\/年-](\d{1,2})[\/月-](\d{1,2})/
    );

    const selectedDate = dateMatch
      ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`
      : "";

    [...box.querySelectorAll(".event-card")].forEach(row => {
      const title =
        row.querySelector("h3")?.textContent?.trim() || "";

      const event = calendar.events.find(item =>
        item.title === title &&
        (!selectedDate || item.date === selectedDate)
      );

      if (!event) {
        return;
      }

      const color = event.color || COLORS[0];

      row.style.borderLeft = `3px solid ${color}`;
      row.style.paddingLeft = "10px";
      row.style.borderRadius = "8px";
      row.style.background =
        `color-mix(in srgb, ${color} 9%, transparent)`;

      const stripe = row.querySelector(".event-stripe");

      if (stripe) {
        stripe.style.background = color;
      }
    });
  }

  /* =====================================================
     タスクカードの色
     ===================================================== */

  function decorateTasks() {
    const box = $("#task-list");

    if (!box) {
      return;
    }

    [...box.querySelectorAll(".task-row")].forEach(row => {
      const title =
        row.querySelector(".task-main strong")?.textContent?.trim() || "";

      const task = calendar.tasks.find(
        item => item.title === title
      );

      if (!task?.color) {
        return;
      }

      row.style.borderLeft = `3px solid ${task.color}`;
      row.style.paddingLeft = "10px";
      row.style.borderRadius = "8px";
      row.style.background =
        `color-mix(in srgb, ${task.color} 9%, transparent)`;
    });
  }

  /* =====================================================
     予定・タスクの色選択欄
     ===================================================== */

  function addColorControls() {
    const eventForm = $("#event-form");

    if (eventForm && !$("#event-color")) {
      const label = document.createElement("label");

      label.innerHTML =
        `色 <input id="event-color" type="color" ` +
        `value="${COLORS[0]}" class="cosmos-color-input">`;

      eventForm.append(label);
    }

    const taskForm = $("#task-form");

    if (taskForm && !$("#task-color")) {
      const label = document.createElement("label");

      label.innerHTML =
        `色 <input id="task-color" type="color" ` +
        `value="${COLORS[1]}" class="cosmos-color-input">`;

      taskForm.append(label);
    }

    if (
      eventForm &&
      !eventForm.dataset.cosmosColorHook
    ) {
      eventForm.dataset.cosmosColorHook = "1";

      eventForm.addEventListener("submit", () => {
        setTimeout(() => {
          reloadCalendar();

          const id = $("#event-id")?.value;

          const event = calendar.events.find(
            item => item.id === id
          );

          if (!event) {
            refreshDecorations();
            return;
          }

          event.color = $("#event-color")?.value || COLORS[0];

          saveCalendar();
          refreshDecorations();
        }, 100);
      });
    }

    if (
      taskForm &&
      !taskForm.dataset.cosmosColorHook
    ) {
      taskForm.dataset.cosmosColorHook = "1";

      taskForm.addEventListener("submit", () => {
        setTimeout(() => {
          reloadCalendar();

          const id = $("#task-id")?.value;

          const task = calendar.tasks.find(
            item => item.id === id
          );

          if (!task) {
            refreshDecorations();
            return;
          }

          task.color = $("#task-color")?.value || COLORS[1];

          saveCalendar();
          refreshDecorations();
        }, 100);
      });
    }
  }

  function setColorFields() {
    reloadCalendar();

    const eventId = $("#event-id")?.value;
    const taskId = $("#task-id")?.value;

    const event = calendar.events.find(
      item => item.id === eventId
    );

    const task = calendar.tasks.find(
      item => item.id === taskId
    );

    if ($("#event-color")) {
      $("#event-color").value = event?.color || COLORS[0];
    }

    if ($("#task-color")) {
      $("#task-color").value = task?.color || COLORS[1];
    }
  }

  /* =====================================================
     学習記録に実施時刻を表示
     ===================================================== */

  function decorateStudyTimes() {
    const studyData = read(STUDY_KEY, {});
    const records = Array.isArray(studyData.records)
      ? studyData.records
      : [];

    const lists = [
      $("#period-records"),
      $("#home-records")
    ].filter(Boolean);

    lists.forEach(list => {
      [...list.querySelectorAll(".record")].forEach(row => {
        const title =
          row.querySelector("b")?.textContent?.trim() || "";

        const small = row.querySelector("small");

        if (!small || small.dataset.cosmosTime) {
          return;
        }

        const text = small.textContent || "";

        const record = records.find(item => {
          const itemTitle = item.item || item.title || "";

          return (
            itemTitle === title &&
            text.includes(String(item.date || ""))
          );
        });

        if (!record) {
          return;
        }

        const timestamp = Number(
          record.createdAt ??
          record.timestamp ??
          record.startedAt
        );

        if (!timestamp) {
          return;
        }

        const time = formatClock(new Date(timestamp));

        small.textContent = `${text} · 記録 ${time}`;
        small.dataset.cosmosTime = "1";
      });
    });
  }

  /* =====================================================
     更新処理
     ===================================================== */

  function refreshDecorations() {
    decorateCalendar();
    decorateCalendarItems();
    decorateTasks();
    decorateStudyTimes();
  }

  function scheduleRefresh() {
    if (refreshQueued) {
      return;
    }

    refreshQueued = true;

    requestAnimationFrame(() => {
      refreshQueued = false;

      addColorControls();
      refreshDecorations();
    });
  }

  function installObserver() {
    const target = $("#view-calendar");

    if (!target) {
      console.warn(
        "[COSMOS] #view-calendar が見つかりません。週間予定表を設置できません。"
      );

      return;
    }

    if (observer) {
      observer.disconnect();
    }

    observer = new MutationObserver(scheduleRefresh);

    observer.observe(target, {
      childList: true,
      subtree: true
    });

    addColorControls();
    refreshDecorations();

    document.addEventListener("click", event => {
      if (
        event.target.closest(
          "#add-event-day, #add-task-button, #day-items button, #task-list button"
        )
      ) {
        setTimeout(setColorFields, 100);
      }
    });
  }

  /* =====================================================
     初期化
     ===================================================== */

  function init() {
    try {
      installStyles();
      installPlanner();
      installObserver();

      window.addEventListener("cosmos-schedule-updated", () => {
        reloadCalendar();
        reloadPlans();
        renderPlanner();
        refreshDecorations();
      });

      window.addEventListener("storage", event => {
        if (event.key === CAL_KEY) {
          reloadCalendar();
          refreshDecorations();
        }

        if (event.key === PLAN_KEY) {
          reloadPlans();
          renderPlanner();
        }
      });

      console.info("[COSMOS] schedule.js を初期化しました。");
    } catch (error) {
      console.error(
        "[COSMOS] schedule.js の初期化に失敗しました。",
        error
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true
    });
  } else {
    init();
  }
})();