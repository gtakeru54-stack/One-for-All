/* =========================================================
   ONE FOR ALL — COSMOS
   js/schedule.js
   週間予定表・学習計画・実績比較
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  const STORAGE = {
    calendar: "personal-calendar-v1",
    study: "oneforall-study-v1",
    weekly: "oneforall-weekly-plan-v1"
  };

  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

  const COLORS = [
    "#8eafff",
    "#c0a1ff",
    "#69dfc4",
    "#f4c77b",
    "#ff9dc5",
    "#86d99b"
  ];

  const todayKey = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseDate = key => {
    const [y, m, d] = String(key).split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const uid = () =>
    crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

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
      alert("保存できませんでした。端末の空き容量を確認してください。");
      return false;
    }
  };

  const minutesBetween = (start, end) => {
    if (!start || !end) return 0;

    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    let minutes = (eh * 60 + em) - (sh * 60 + sm);

    // 日付をまたぐ予定にも対応
    if (minutes < 0) minutes += 1440;

    return minutes;
  };

  const formatMinutes = value => {
    const minutes = Math.max(0, Math.round(value || 0));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours && rest) return `${hours}時間${rest}分`;
    if (hours) return `${hours}時間`;
    return `${rest}分`;
  };

  const startOfWeek = date => {
    const result = new Date(date);
    result.setDate(result.getDate() - result.getDay());
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const calendar = read(STORAGE.calendar, {
    events: [],
    tasks: []
  });

  if (!Array.isArray(calendar.events)) calendar.events = [];
  if (!Array.isArray(calendar.tasks)) calendar.tasks = [];

  const study = read(STORAGE.study, {
    subjects: [],
    items: [],
    records: []
  });

  if (!Array.isArray(study.records)) study.records = [];

  let weeklyPlans = read(STORAGE.weekly, []);

  if (!Array.isArray(weeklyPlans)) weeklyPlans = [];

  let weekDate = new Date();
  let activeCalendarTab = "weekly";

  function saveCalendar() {
    save(STORAGE.calendar, calendar);
  }

  function saveWeekly() {
    save(STORAGE.weekly, weeklyPlans);
  }

  function getWeekDays() {
    const first = startOfWeek(weekDate);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);

      return {
        date,
        key: todayKey(date),
        label: DAYS[date.getDay()]
      };
    });
  }

  function getPlansForDate(dateKey) {
    return weeklyPlans.filter(plan => plan.date === dateKey);
  }

  function getEventsForDate(dateKey) {
    return calendar.events.filter(event => event.date === dateKey);
  }

  function getActualMinutes(plan) {
    const records = study.records || [];

    return records.reduce((total, record) => {
      if (record.date !== plan.date) return total;

      const subject = String(
        record.subject || record.category || ""
      );

      const item = String(
        record.item || record.title || ""
      );

      const matchesSubject =
        !plan.subject || subject === plan.subject;

      const matchesItem =
        !plan.item || item === plan.item;

      if (!matchesSubject || !matchesItem) return total;

      const seconds = Number(
        record.durationSeconds ??
        record.seconds ??
        ((Number(record.minutes) || 0) * 60)
      );

      return total + Math.max(0, seconds) / 60;
    }, 0);
  }

  function ensureStyles() {
    if ($("#weekly-planner-style")) return;

    const style = document.createElement("style");
    style.id = "weekly-planner-style";

    style.textContent = `
      .schedule-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 0 0 16px;
      }

      .schedule-tab {
        min-height: 43px;
        border: 1px solid rgba(145,173,255,.2);
        border-radius: 13px;
        color: #aab8d8;
        background: rgba(255,255,255,.035);
        font-weight: 700;
      }

      .schedule-tab.active {
        color: #fff;
        border-color: #8eafff;
        background: rgba(142,175,255,.18);
      }

      .weekly-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 14px;
      }

      .weekly-toolbar h2 {
        margin: 0;
        font-size: 16px;
        text-align: center;
      }

      .weekly-days {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 4px;
      }

      .weekly-day {
        min-width: 0;
        padding: 8px 2px;
        border: 1px solid rgba(145,173,255,.13);
        border-radius: 10px;
        background: rgba(255,255,255,.025);
        text-align: center;
        cursor: pointer;
      }

      .weekly-day.today {
        border-color: #69dfc4;
        background: rgba(105,223,196,.1);
      }

      .weekly-day.selected {
        outline: 2px solid #8eafff;
      }

      .weekly-day small,
      .weekly-day strong {
        display: block;
      }

      .weekly-day small {
        color: #9ba9c7;
        font-size: 10px;
      }

      .weekly-day strong {
        margin-top: 4px;
        font-size: 13px;
      }

      .weekly-day .day-dot {
        display: block;
        width: 5px;
        height: 5px;
        margin: 5px auto 0;
        border-radius: 50%;
        background: #8eafff;
      }

      .weekly-plan-list {
        display: grid;
        gap: 10px;
      }

      .weekly-plan {
        padding: 12px;
        border: 1px solid rgba(145,173,255,.16);
        border-radius: 14px;
        background: rgba(255,255,255,.035);
      }

      .weekly-plan-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }

      .weekly-plan h3 {
        margin: 0;
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .weekly-plan p {
        margin: 5px 0 0;
        font-size: 11px;
        color: #9ba9c7;
      }

      .weekly-plan-actions {
        display: flex;
        gap: 6px;
        margin-top: 10px;
      }

      .weekly-plan-actions button {
        flex: 1;
        min-height: 34px;
        border-radius: 9px;
        font-size: 11px;
      }

      .weekly-progress {
        height: 7px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 99px;
        background: rgba(140,157,196,.16);
      }

      .weekly-progress span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg,#8eafff,#69dfc4);
      }

      .weekly-compare {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }

      .weekly-compare > div {
        padding: 9px;
        border-radius: 10px;
        background: rgba(255,255,255,.04);
      }

      .weekly-compare small,
      .weekly-compare strong {
        display: block;
      }

      .weekly-compare small {
        color: #9ba9c7;
        font-size: 10px;
      }

      .weekly-compare strong {
        margin-top: 4px;
        font-size: 14px;
      }

      .weekly-summary {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 7px;
        margin-bottom: 14px;
      }

      .weekly-summary > div {
        padding: 10px 7px;
        border: 1px solid rgba(145,173,255,.12);
        border-radius: 12px;
        background: rgba(255,255,255,.025);
      }

      .weekly-summary small,
      .weekly-summary strong {
        display: block;
      }

      .weekly-summary small {
        color: #9ba9c7;
        font-size: 10px;
      }

      .weekly-summary strong {
        margin-top: 5px;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .weekly-form {
        display: grid;
        gap: 10px;
      }

      .weekly-form .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .weekly-form input,
      .weekly-form select,
      .weekly-form textarea {
        width: 100%;
        box-sizing: border-box;
      }

      .weekly-empty {
        padding: 22px 10px;
        text-align: center;
        color: #9ba9c7;
        font-size: 12px;
      }

      @media (max-width: 380px) {
        .weekly-day {
          padding: 7px 1px;
        }
        .weekly-day small {
          font-size: 9px;
        }
        .weekly-day strong {
          font-size: 12px;
        }
      }
    `;

    document.head.append(style);
  }

  function ensureWeeklyInterface() {
    const view = $("#view-calendar");
    if (!view || $("#weekly-planner")) return;

    const heading = view.querySelector(".page-heading");
    if (!heading) return;

    const tabs = document.createElement("div");
    tabs.className = "schedule-tabs";
    tabs.innerHTML = `
      <button type="button" class="schedule-tab active"
        data-schedule-tab="weekly">週間予定表</button>
      <button type="button" class="schedule-tab"
        data-schedule-tab="calendar">カレンダー・タスク</button>
    `;

    const planner = document.createElement("section");
    planner.id = "weekly-planner";

    planner.innerHTML = `
      <div class="panel">
        <div class="weekly-toolbar">
          <button type="button" class="secondary-button"
            id="weekly-prev">‹</button>
          <h2 id="weekly-title">週間予定表</h2>
          <button type="button" class="secondary-button"
            id="weekly-next">›</button>
        </div>

        <div class="weekly-summary">
          <div>
            <small>計画時間</small>
            <strong id="weekly-planned-total">0分</strong>
          </div>
          <div>
            <small>実績時間</small>
            <strong id="weekly-actual-total">0分</strong>
          </div>
          <div>
            <small>達成率</small>
            <strong id="weekly-achievement">0%</strong>
          </div>
        </div>

        <div class="weekly-days" id="weekly-days"></div>
      </div>

      <div class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">DAILY PLAN</p>
            <h2 id="weekly-selected-title">今日の計画</h2>
          </div>
          <button type="button" class="primary-button"
            id="weekly-add-plan">＋ 学習計画</button>
        </div>

        <div id="weekly-plan-list" class="weekly-plan-list"></div>
      </div>

      <dialog id="weekly-plan-dialog" class="dialog">
        <form id="weekly-plan-form" class="weekly-form">
          <div class="dialog-head">
            <h2 id="weekly-dialog-title">学習計画を追加</h2>
            <button type="button" class="close-dialog"
              id="weekly-close-dialog">×</button>
          </div>

          <input type="hidden" id="weekly-plan-id">

          <label>
            学習内容
            <input id="weekly-plan-title" maxlength="120"
              required placeholder="例：数学・二次関数">
          </label>

          <label>
            科目
            <input id="weekly-plan-subject" maxlength="60"
              placeholder="例：数学">
          </label>

          <label>
            学習項目
            <input id="weekly-plan-item" maxlength="100"
              placeholder="例：問題集 p.20〜25">
          </label>

          <label>
            日付
            <input id="weekly-plan-date" type="date" required>
          </label>

          <div class="form-row">
            <label>
              開始時刻
              <input id="weekly-plan-start" type="time" required>
            </label>
            <label>
              終了時刻
              <input id="weekly-plan-end" type="time" required>
            </label>
          </div>

          <label>
            メモ
            <textarea id="weekly-plan-notes" rows="2"
              maxlength="300"></textarea>
          </label>

          <div class="dialog-actions">
            <button type="button" class="secondary-button"
              id="weekly-cancel-plan">キャンセル</button>
            <button type="submit" class="primary-button">保存</button>
          </div>
        </form>
      </dialog>
    `;

    heading.after(tabs, planner);

    tabs.querySelectorAll("[data-schedule-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activeCalendarTab = button.dataset.scheduleTab;

        tabs.querySelectorAll(".schedule-tab").forEach(tab => {
          tab.classList.toggle("active", tab === button);
        });

        planner.hidden = activeCalendarTab !== "weekly";

        [
          ".calendar-panel",
          "#view-calendar > .panel:not(#weekly-planner .panel)"
        ].forEach(selector => {
          view.querySelectorAll(selector).forEach(element => {
            if (element.closest("#weekly-planner")) return;
            element.hidden = activeCalendarTab === "weekly";
          });
        });

        if (activeCalendarTab === "weekly") {
          renderWeekly();
        }
      });
    });

    $("#weekly-prev").addEventListener("click", () => {
      weekDate.setDate(weekDate.getDate() - 7);
      renderWeekly();
    });

    $("#weekly-next").addEventListener("click", () => {
      weekDate.setDate(weekDate.getDate() + 7);
      renderWeekly();
    });

    $("#weekly-add-plan").addEventListener("click", () => {
      openPlanDialog();
    });

    $("#weekly-close-dialog").addEventListener("click", closePlanDialog);
    $("#weekly-cancel-plan").addEventListener("click", closePlanDialog);

    $("#weekly-plan-form").addEventListener("submit", event => {
      event.preventDefault();
      savePlanFromForm();
    });

    planner.hidden = true;
  }

  let selectedDay = todayKey();
  let editingPlanId = null;

  function openPlanDialog(plan = null) {
    const dialog = $("#weekly-plan-dialog");
    const form = $("#weekly-plan-form");

    if (!dialog || !form) return;

    form.reset();

    editingPlanId = plan?.id || null;

    $("#weekly-dialog-title").textContent =
      plan ? "学習計画を編集" : "学習計画を追加";

    $("#weekly-plan-id").value = plan?.id || "";
    $("#weekly-plan-title").value = plan?.title || "";
    $("#weekly-plan-subject").value = plan?.subject || "";
    $("#weekly-plan-item").value = plan?.item || "";
    $("#weekly-plan-date").value = plan?.date || selectedDay;
    $("#weekly-plan-start").value = plan?.start || "16:00";
    $("#weekly-plan-end").value = plan?.end || "17:00";
    $("#weekly-plan-notes").value = plan?.notes || "";

    if (!dialog.open) dialog.showModal();
  }

  function closePlanDialog() {
    const dialog = $("#weekly-plan-dialog");
    if (dialog?.open) dialog.close();
  }

  function savePlanFromForm() {
    const title = $("#weekly-plan-title").value.trim();
    const subject = $("#weekly-plan-subject").value.trim();
    const item = $("#weekly-plan-item").value.trim();
    const date = $("#weekly-plan-date").value;
    const start = $("#weekly-plan-start").value;
    const end = $("#weekly-plan-end").value;
    const notes = $("#weekly-plan-notes").value.trim();

    if (!title || !date || !start || !end) {
      alert("学習内容・日付・開始時刻・終了時刻を入力してください。");
      return;
    }

    if (minutesBetween(start, end) <= 0) {
      alert("終了時刻は開始時刻より後にしてください。");
      return;
    }

    const existing = editingPlanId
      ? weeklyPlans.find(plan => plan.id === editingPlanId)
      : null;

    const plan = {
      ...(existing || {}),
      id: existing?.id || uid(),
      title,
      subject,
      item,
      date,
      start,
      end,
      notes,
      updatedAt: Date.now()
    };

    if (existing) {
      weeklyPlans = weeklyPlans.map(old =>
        old.id === existing.id ? plan : old
      );
    } else {
      plan.createdAt = Date.now();
      weeklyPlans.push(plan);
    }

    // 学習計画を通常のタスク一覧にも登録する。
    // すでに同じ計画IDのタスクがあれば二重登録しない。
    const taskId = `weekly-${plan.id}`;
    const task = calendar.tasks.find(t =>
      t.id === taskId || t.weeklyPlanId === plan.id
    );

    const taskData = {
      id: task?.id || taskId,
      weeklyPlanId: plan.id,
      title: `学習：${plan.title}`,
      date: plan.date,
      notes: `${plan.start}〜${plan.end}${plan.notes ? " / " + plan.notes : ""}`,
      completed: Boolean(task?.completed),
      createdAt: task?.createdAt || Date.now()
    };

    if (task) {
      Object.assign(task, taskData);
    } else {
      calendar.tasks.push(taskData);
    }

    saveWeekly();
    saveCalendar();
    closePlanDialog();

    selectedDay = date;
    weekDate = parseDate(date);

    renderWeekly();

    const toast = $("#toast");
    if (toast) {
      toast.textContent = "学習計画を保存し、タスクにも追加しました。";
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2400);
    }
  }

  function deletePlan(plan) {
    if (!confirm(`「${plan.title}」の学習計画を削除しますか？`)) {
      return;
    }

    weeklyPlans = weeklyPlans.filter(item => item.id !== plan.id);

    // 計画に紐づくタスクも削除する
    calendar.tasks = calendar.tasks.filter(task =>
      task.weeklyPlanId !== plan.id &&
      task.id !== `weekly-${plan.id}`
    );

    saveWeekly();
    saveCalendar();
    renderWeekly();
  }

  function renderWeekHeader(days) {
    const container = $("#weekly-days");
    if (!container) return;

    container.innerHTML = days.map(day => {
      const plans = getPlansForDate(day.key);
      const events = getEventsForDate(day.key);
      const isToday = day.key === todayKey();
      const isSelected = day.key === selectedDay;

      return `
        <button type="button"
          class="weekly-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}"
          data-week-date="${day.key}">
          <small>${day.label}</small>
          <strong>${day.date.getDate()}</strong>
          ${plans.length || events.length
            ? '<span class="day-dot"></span>'
            : ""}
        </button>
      `;
    }).join("");

    container.querySelectorAll("[data-week-date]").forEach(button => {
      button.addEventListener("click", () => {
        selectedDay = button.dataset.weekDate;
        renderWeekly();
      });
    });
  }

  function renderPlanCard(plan) {
    const plannedMinutes = minutesBetween(plan.start, plan.end);
    const actualMinutes = getActualMinutes(plan);
    const percentage = plannedMinutes
      ? Math.min(100, Math.round(actualMinutes / plannedMinutes * 100))
      : 0;

    const over = actualMinutes > plannedMinutes;

    return `
      <article class="weekly-plan">
        <div class="weekly-plan-top">
          <div>
            <h3>${escapeHTML(plan.title)}</h3>
            <p>
              ${escapeHTML(plan.start)}〜${escapeHTML(plan.end)}
              · 計画 ${formatMinutes(plannedMinutes)}
            </p>
            ${plan.subject
              ? `<p>科目：${escapeHTML(plan.subject)}</p>`
              : ""}
            ${plan.item
              ? `<p>項目：${escapeHTML(plan.item)}</p>`
              : ""}
            ${plan.notes
              ? `<p>${escapeHTML(plan.notes)}</p>`
              : ""}
          </div>
        </div>

        <div class="weekly-compare">
          <div>
            <small>計画時間</small>
            <strong>${formatMinutes(plannedMinutes)}</strong>
          </div>
          <div>
            <small>実際の学習時間</small>
            <strong>${formatMinutes(actualMinutes)}</strong>
          </div>
        </div>

        <div class="weekly-progress">
          <span style="width:${percentage}%"></span>
        </div>

        <p>
          ${over
            ? `計画より ${formatMinutes(actualMinutes - plannedMinutes)} 多く学習`
            : `達成率 ${percentage}% · 残り ${formatMinutes(plannedMinutes - actualMinutes)}`}
        </p>

        <div class="weekly-plan-actions">
          <button type="button" class="secondary-button"
            data-edit-plan="${escapeHTML(plan.id)}">編集</button>
          <button type="button" class="secondary-button"
            data-delete-plan="${escapeHTML(plan.id)}">削除</button>
        </div>
      </article>
    `;
  }

  function renderWeekly() {
    const days = getWeekDays();

    const first = days[0].date;
    const last = days[6].date;

    $("#weekly-title").textContent =
      `${first.getFullYear()}年${first.getMonth() + 1}月${first.getDate()}日〜` +
      `${last.getMonth() + 1}月${last.getDate()}日`;

    renderWeekHeader(days);

    const plans = weeklyPlans.filter(plan =>
      days.some(day => day.key === plan.date)
    );

    const plannedTotal = plans.reduce((sum, plan) =>
      sum + minutesBetween(plan.start, plan.end), 0
    );

    const actualTotal = plans.reduce((sum, plan) =>
      sum + getActualMinutes(plan), 0
    );

    const achievement = plannedTotal
      ? Math.round(actualTotal / plannedTotal * 100)
      : 0;

    $("#weekly-planned-total").textContent =
      formatMinutes(plannedTotal);

    $("#weekly-actual-total").textContent =
      formatMinutes(actualTotal);

    $("#weekly-achievement").textContent =
      `${achievement}%`;

    const date = parseDate(selectedDay);

    $("#weekly-selected-title").textContent =
      `${date.getMonth() + 1}月${date.getDate()}日（${DAYS[date.getDay()]}）の計画`;

    const selectedPlans = getPlansForDate(selectedDay)
      .sort((a, b) => a.start.localeCompare(b.start));

    const selectedEvents = getEventsForDate(selectedDay)
      .sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));

    const list = $("#weekly-plan-list");

    const planHTML = selectedPlans.map(renderPlanCard).join("");

    const eventHTML = selectedEvents.map(event => `
      <article class="weekly-plan">
        <div class="weekly-plan-top">
          <div>
            <h3>📅 ${escapeHTML(event.title)}</h3>
            <p>
              ${escapeHTML(event.start || "時刻未設定")}
              ${event.end ? `〜${escapeHTML(event.end)}` : ""}
            </p>
            ${event.notes ? `<p>${escapeHTML(event.notes)}</p>` : ""}
          </div>
        </div>
        <p>既存のカレンダー予定</p>
      </article>
    `).join("");

    list.innerHTML = planHTML + eventHTML ||
      '<div class="weekly-empty">この日の予定はありません。<br>「＋ 学習計画」から追加できます。</div>';

    list.querySelectorAll("[data-edit-plan]").forEach(button => {
      button.addEventListener("click", () => {
        const plan = weeklyPlans.find(item =>
          item.id === button.dataset.editPlan
        );
        if (plan) openPlanDialog(plan);
      });
    });

    list.querySelectorAll("[data-delete-plan]").forEach(button => {
      button.addEventListener("click", () => {
        const plan = weeklyPlans.find(item =>
          item.id === button.dataset.deletePlan
        );
        if (plan) deletePlan(plan);
      });
    });
  }

  function init() {
    ensureStyles();
    ensureWeeklyInterface();

    if (!$("#weekly-planner")) return;

    selectedDay = todayKey();
    renderWeekly();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // 学習記録が保存された後に週間予定表を更新するための公開関数
  window.OneForAllWeeklyPlanner = {
    refresh: renderWeekly,
    getPlans: () => [...weeklyPlans],
    getActualMinutes
  };
})();