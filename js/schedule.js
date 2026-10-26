
/* =========================================================
   ONE FOR ALL — COSMOS
   js/schedule.js
   週間時間割・予定・学習計画・実績比較
   表示時間：06:00〜翌日02:00

   修正内容：
   ・app.js と共通の保存先から予定・タスクを読み込む
   ・calendarEvents / calendarTasks の未定義を解消
   ・週間予定表は曜日が横、時間が縦の表形式を維持
   ・予定の追加・編集後に週間予定表を更新
   ========================================================= */

"use strict";

(() => {
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  const STORAGE = {
    events: "oneforall-events-v1",
    tasks: "oneforall-tasks-v1",
    study: "oneforall-study-v1",
    weekly: "oneforall-weekly-plan-v1"
  };

  const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

  const START_MINUTE = 6 * 60;
  const END_MINUTE = 26 * 60;
  const HOUR_HEIGHT = 54;
  const TOTAL_HEIGHT = 20 * HOUR_HEIGHT;

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

  const pad = value => String(value).padStart(2, "0");

  const dateKey = date =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

  const parseDate = key => {
    const [year, month, day] = String(key).split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const uid = () =>
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const toMinutes = value => {
    if (!value || !/^\d{1,2}:\d{2}$/.test(value)) {
      return null;
    }

    const [hour, minute] = value.split(":").map(Number);

    if (hour > 47 || minute > 59) {
      return null;
    }

    return hour * 60 + minute;
  };

  const duration = (start, end) => {
    const startMinutes = toMinutes(start);
    const endMinutes = toMinutes(end);

    if (startMinutes === null || endMinutes === null) {
      return 0;
    }

    return Math.max(0, endMinutes - startMinutes);
  };

  const fmtMinutes = value => {
    const minutes = Math.max(0, Math.round(Number(value) || 0));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;

    if (hours && remainder) {
      return `${hours}時間${remainder}分`;
    }

    if (hours) {
      return `${hours}時間`;
    }

    return `${remainder}分`;
  };

  const timeText = minutes => {
    const dayOffset = Math.floor(minutes / 1440);
    const withinDay = ((minutes % 1440) + 1440) % 1440;
    const hour = Math.floor(withinDay / 60);
    const minute = withinDay % 60;
    const suffix = dayOffset > 0 ? "翌" : "";

    return `${suffix}${pad(hour)}:${pad(minute)}`;
  };

  const startOfWeek = date => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() - result.getDay());
    return result;
  };

  // =========================================================
  // 保存データ
  // =========================================================

  let calendarEvents = read(STORAGE.events, []);
  if (!Array.isArray(calendarEvents)) {
    calendarEvents = [];
  }

  let calendarTasks = read(STORAGE.tasks, []);
  if (!Array.isArray(calendarTasks)) {
    calendarTasks = [];
  }

  let study = read(STORAGE.study, {
    subjects: [],
    items: [],
    records: []
  });

  if (!study || typeof study !== "object") {
    study = {
      subjects: [],
      items: [],
      records: []
    };
  }

  if (!Array.isArray(study.records)) {
    study.records = [];
  }

  let plans = read(STORAGE.weekly, []);
  if (!Array.isArray(plans)) {
    plans = [];
  }

  let weekDate = new Date();
  let selectedDate = dateKey(new Date());
  let activeTab = "weekly";

  function syncStoredData() {
    const updatedEvents = read(STORAGE.events, []);
    const updatedTasks = read(STORAGE.tasks, []);
    const updatedStudy = read(STORAGE.study, {
      subjects: [],
      items: [],
      records: []
    });
    const updatedPlans = read(STORAGE.weekly, []);

    calendarEvents = Array.isArray(updatedEvents)
      ? updatedEvents
      : [];

    calendarTasks = Array.isArray(updatedTasks)
      ? updatedTasks
      : [];

    if (
      updatedStudy &&
      typeof updatedStudy === "object" &&
      Array.isArray(updatedStudy.records)
    ) {
      study = updatedStudy;
    }

    if (Array.isArray(updatedPlans)) {
      plans = updatedPlans;
    }
  }

  function persistCalendar() {
    const eventsSaved = save(STORAGE.events, calendarEvents);
    const tasksSaved = save(STORAGE.tasks, calendarTasks);

    return eventsSaved && tasksSaved;
  }

  function persistPlans() {
    return save(STORAGE.weekly, plans);
  }

  // =========================================================
  // スタイル
  // =========================================================

  function injectStyles() {
    if ($("#weekly-timetable-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "weekly-timetable-style";

    style.textContent = `
      #weekly-planner[hidden],
      #weekly-planner .weekly-hidden {
        display: none !important;
      }

      .schedule-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 0 0 14px;
      }

      .schedule-tab {
        min-height: 44px;
        border-radius: 12px;
        border: 1px solid rgba(142,175,255,.22);
        background: rgba(255,255,255,.035);
        color: #aab8d8;
        font-weight: 700;
      }

      .schedule-tab.active {
        color: #fff;
        border-color: #8eafff;
        background: rgba(142,175,255,.18);
      }

      .weekly-summary {
        display: grid;
        grid-template-columns: repeat(3,minmax(0,1fr));
        gap: 7px;
        margin-bottom: 12px;
      }

      .weekly-summary > div {
        min-width: 0;
        padding: 10px 7px;
        border-radius: 11px;
        border: 1px solid rgba(142,175,255,.15);
        background: rgba(255,255,255,.035);
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

      .weekly-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin: 10px 0 13px;
        color: #aab8d8;
        font-size: 11px;
      }

      .weekly-legend span {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }

      .weekly-legend i {
        display: inline-block;
        width: 9px;
        height: 9px;
        border-radius: 3px;
      }

      .weekly-scroll {
        overflow-x: auto;
        overflow-y: auto;
        max-height: min(72vh, 780px);
        border: 1px solid rgba(142,175,255,.16);
        border-radius: 12px;
        background: rgba(4,9,25,.5);
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }

      .weekly-grid {
        display: grid;
        grid-template-columns: 43px repeat(7,minmax(92px,1fr));
        min-width: 687px;
        position: relative;
      }

      .weekly-corner,
      .weekly-day-heading {
        position: sticky;
        top: 0;
        z-index: 8;
        height: 48px;
        box-sizing: border-box;
        border-bottom: 1px solid rgba(142,175,255,.2);
        background: #0c142a;
      }

      .weekly-corner {
        left: 0;
        z-index: 10;
        border-right: 1px solid rgba(142,175,255,.18);
      }

      .weekly-day-heading {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-right: 1px solid rgba(142,175,255,.1);
        color: #c8d4f0;
        font-size: 11px;
      }

      .weekly-day-heading strong {
        font-size: 13px;
      }

      .weekly-day-heading.today {
        color: #69dfc4;
        background: #102335;
      }

      .weekly-time-column {
        position: sticky;
        left: 0;
        z-index: 5;
        background: #0c142a;
        border-right: 1px solid rgba(142,175,255,.18);
      }

      .weekly-time-label {
        position: absolute;
        right: 4px;
        transform: translateY(-50%);
        color: #91a1c2;
        font-size: 9px;
        white-space: nowrap;
      }

      .weekly-day-column {
        position: relative;
        height: ${TOTAL_HEIGHT}px;
        border-right: 1px solid rgba(142,175,255,.1);
        background-image:
          repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent ${HOUR_HEIGHT - 1}px,
            rgba(142,175,255,.15) ${HOUR_HEIGHT - 1}px,
            rgba(142,175,255,.15) ${HOUR_HEIGHT}px
          ),
          repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent ${HOUR_HEIGHT / 2 - 1}px,
            rgba(142,175,255,.055) ${HOUR_HEIGHT / 2 - 1}px,
            rgba(142,175,255,.055) ${HOUR_HEIGHT / 2}px
          );
      }

      .weekly-day-column.selected {
        background-color: rgba(142,175,255,.045);
      }

      .weekly-block {
        position: absolute;
        box-sizing: border-box;
        left: 3px;
        right: 3px;
        min-height: 8px;
        padding: 4px;
        overflow: hidden;
        border-radius: 6px;
        border-left: 3px solid;
        font-size: 10px;
        line-height: 1.25;
        overflow-wrap: anywhere;
        cursor: pointer;
        z-index: 2;
      }

      .weekly-block strong,
      .weekly-block small {
        display: block;
      }

      .weekly-block strong {
        font-size: 10px;
        margin-bottom: 3px;
      }

      .weekly-block small {
        font-size: 9px;
        opacity: .92;
      }

      .weekly-block.plan {
        color: #e5edff;
        background: rgba(73,115,220,.75);
        border-color: #8eafff;
      }

      .weekly-block.event {
        color: #f0e6ff;
        background: rgba(129,83,184,.72);
        border-color: #c0a1ff;
      }

      .weekly-block.actual {
        color: #d9fff5;
        background: rgba(38,145,119,.8);
        border-color: #69dfc4;
      }

      .weekly-block.completed {
        opacity: .72;
      }

      .weekly-today-line {
        position: absolute;
        z-index: 4;
        left: 0;
        right: 0;
        border-top: 2px solid #69dfc4;
        pointer-events: none;
      }

      .weekly-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 7px;
        margin-bottom: 12px;
      }

      .weekly-toolbar h2 {
        margin: 0;
        font-size: 14px;
        text-align: center;
      }

      .weekly-day-list {
        display: grid;
        gap: 10px;
      }

      .weekly-plan-card {
        padding: 12px;
        border: 1px solid rgba(142,175,255,.16);
        border-radius: 12px;
        background: rgba(255,255,255,.035);
      }

      .weekly-plan-card h3 {
        margin: 0;
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .weekly-plan-card p {
        margin: 5px 0 0;
        color: #aab8d8;
        font-size: 11px;
      }

      .weekly-compare-bars {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }

      .weekly-compare-row {
        display: grid;
        grid-template-columns: 68px 1fr 55px;
        align-items: center;
        gap: 7px;
        font-size: 10px;
      }

      .weekly-compare-track {
        height: 10px;
        overflow: hidden;
        border-radius: 20px;
        background: rgba(142,175,255,.12);
      }

      .weekly-compare-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      .weekly-compare-track .planned-bar {
        background: #8eafff;
      }

      .weekly-compare-track .actual-bar {
        background: #69dfc4;
      }

      .weekly-compare-row strong {
        text-align: right;
        font-size: 10px;
      }

      .weekly-card-actions {
        display: flex;
        gap: 7px;
        margin-top: 10px;
      }

      .weekly-card-actions button {
        flex: 1;
        min-height: 34px;
        border-radius: 9px;
      }

      .weekly-empty {
        padding: 24px 10px;
        color: #9ba9c7;
        text-align: center;
        font-size: 12px;
      }

      .weekly-note {
        margin: 9px 0 0;
        color: #93a4c7;
        font-size: 10px;
        line-height: 1.6;
      }

      @media(max-width:420px) {
        .weekly-grid {
          grid-template-columns: 39px repeat(7,minmax(88px,1fr));
          min-width: 655px;
        }
      }
    `;

    document.head.append(style);
  }

  // =========================================================
  // 学習記録
  // =========================================================

  function getActualRecords(date) {
    return study.records.filter(record => record.date === date);
  }

  function recordMinutes(record) {
    const seconds = Number(
      record.durationSeconds ??
      record.seconds ??
      record.elapsedSeconds ??
      0
    );

    if (seconds > 0) {
      return seconds / 60;
    }

    const minutes = Number(record.minutes);
    if (minutes > 0) {
      return minutes;
    }

    const hours = Number(record.hours);
    if (hours > 0) {
      return hours * 60;
    }

    return 0;
  }

  function recordStart(record) {
    return record.startTime || record.start || record.startAt || "";
  }

  function recordEnd(record) {
    return record.endTime || record.end || record.endAt || "";
  }

  function planMinutes(plan) {
    return duration(plan.start, plan.end);
  }

  function actualMinutesForPlan(plan) {
    const relevant = getActualRecords(plan.date).filter(record => {
      const subject = String(
        record.subject || record.category || record.subjectId || ""
      );

      const item = String(
        record.item || record.title || record.itemId || ""
      );

      return (!plan.subject || subject === plan.subject) &&
        (!plan.item || item === plan.item);
    });

    return relevant.reduce(
      (sum, record) => sum + recordMinutes(record),
      0
    );
  }

  function planDay(date) {
    return plans.filter(plan => plan.date === date);
  }

  function eventsDay(date) {
    return calendarEvents.filter(event => event.date === date);
  }

  // =========================================================
  // 週間予定表：曜日が横、時間が縦の表形式
  // =========================================================

  function makeTimeline() {
    const wrapper = $("#weekly-timetable");
    if (!wrapper) return;

    const firstDay = startOfWeek(weekDate);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(firstDay);
      date.setDate(date.getDate() + index);

      return {
        date,
        key: dateKey(date)
      };
    });

    const hourLabels = [];

    for (
      let minute = START_MINUTE;
      minute <= END_MINUTE;
      minute += 60
    ) {
      const top =
        ((minute - START_MINUTE) / 60) * HOUR_HEIGHT;

      hourLabels.push(
        `<span class="weekly-time-label" style="top:${top}px">${timeText(minute)}</span>`
      );
    }

    const header = `
      <div class="weekly-corner"></div>
      ${days.map(day => {
        const isToday = day.key === dateKey(new Date());

        return `
          <button type="button"
            class="weekly-day-heading ${isToday ? "today" : ""}"
            data-select-day="${day.key}">
            <span>${DAY_NAMES[day.date.getDay()]}</span>
            <strong>${day.date.getMonth() + 1}/${day.date.getDate()}</strong>
          </button>
        `;
      }).join("")}
    `;

    let columns = `
      <div class="weekly-time-column" style="height:${TOTAL_HEIGHT}px">
        ${hourLabels.join("")}
      </div>
    `;

    for (const day of days) {
      const selected = day.key === selectedDate;
      const blocks = [];

      // 学習計画（青）
      for (const plan of planDay(day.key)) {
        const start = toMinutes(plan.start);
        const end = toMinutes(plan.end);

        if (start === null || end === null) {
          continue;
        }

        const normalizedStart =
          start < START_MINUTE ? start + 1440 : start;

        const normalizedEnd =
          end <= start ? end + 1440 : end;

        const top = normalizedStart - START_MINUTE;
        const bottom = normalizedEnd - START_MINUTE;

        if (
          bottom <= 0 ||
          top >= END_MINUTE - START_MINUTE
        ) {
          continue;
        }

        const visibleTop = Math.max(0, top);
        const visibleBottom = Math.min(
          END_MINUTE - START_MINUTE,
          bottom
        );

        const actual = actualMinutesForPlan(plan);
        const planned = planMinutes(plan);

        blocks.push({
          top: visibleTop,
          html: `
            <button type="button"
              class="weekly-block plan"
              style="top:${visibleTop / 60 * HOUR_HEIGHT}px;height:${Math.max(8, (visibleBottom - visibleTop) / 60 * HOUR_HEIGHT)}px"
              data-edit-week-plan="${escapeHTML(plan.id)}"
              title="${escapeHTML(plan.title)}">
              <strong>${escapeHTML(plan.title)}</strong>
              <small>${escapeHTML(plan.start)}–${escapeHTML(plan.end)}</small>
              <small>計画 ${fmtMinutes(planned)}</small>
              <small>実績 ${fmtMinutes(actual)}</small>
            </button>
          `
        });
      }

      // 既存のカレンダー予定（紫）
      for (const event of eventsDay(day.key)) {
        if (!event.start) {
          continue;
        }

        const start = toMinutes(event.start);
        const end = toMinutes(event.end) ?? (
          start === null ? null : start + 30
        );

        if (start === null || end === null) {
          continue;
        }

        const normalizedStart =
          start < START_MINUTE ? start + 1440 : start;

        const normalizedEnd =
          end <= start ? end + 1440 : end;

        const top = normalizedStart - START_MINUTE;
        const bottom = normalizedEnd - START_MINUTE;

        if (
          bottom <= 0 ||
          top >= END_MINUTE - START_MINUTE
        ) {
          continue;
        }

        const visibleTop = Math.max(0, top);
        const visibleBottom = Math.min(
          END_MINUTE - START_MINUTE,
          bottom
        );

        blocks.push({
          top: visibleTop,
          html: `
            <button type="button"
              class="weekly-block event"
              style="top:${visibleTop / 60 * HOUR_HEIGHT}px;height:${Math.max(8, (visibleBottom - visibleTop) / 60 * HOUR_HEIGHT)}px"
              data-open-calendar-event="${escapeHTML(event.id || "")}"
              title="${escapeHTML(event.title)}">
              <strong>${escapeHTML(event.title)}</strong>
              <small>${escapeHTML(event.start)}–${escapeHTML(event.end || "")}</small>
            </button>
          `
        });
      }

      // 開始・終了時刻が記録されている学習実績（緑）
      for (const record of getActualRecords(day.key)) {
        const startText = recordStart(record);
        const endText = recordEnd(record);

        const start = toMinutes(startText);
        const end = toMinutes(endText);

        if (
          start === null ||
          end === null ||
          end <= start
        ) {
          continue;
        }

        const top = start - START_MINUTE;
        const bottom = end - START_MINUTE;

        if (
          bottom <= 0 ||
          top >= END_MINUTE - START_MINUTE
        ) {
          continue;
        }

        const visibleTop = Math.max(0, top);
        const visibleBottom = Math.min(
          END_MINUTE - START_MINUTE,
          bottom
        );

        const subject =
          record.subject || record.category || "学習実績";

        const item = record.item || record.title || "";

        blocks.push({
          top: visibleTop,
          html: `
            <div class="weekly-block actual"
              style="top:${visibleTop / 60 * HOUR_HEIGHT}px;height:${Math.max(8, (visibleBottom - visibleTop) / 60 * HOUR_HEIGHT)}px"
              title="実績：${escapeHTML(subject)}">
              <strong>✓ ${escapeHTML(subject)}</strong>
              <small>${escapeHTML(startText)}–${escapeHTML(endText)}</small>
              ${item ? `<small>${escapeHTML(item)}</small>` : ""}
            </div>
          `
        });
      }

      // 現在時刻を示す線
      const now = new Date();
      let nowLine = "";

      if (day.key === dateKey(now)) {
        const currentMinutes =
          now.getHours() * 60 + now.getMinutes();

        if (
          currentMinutes >= START_MINUTE &&
          currentMinutes <= END_MINUTE
        ) {
          const top =
            ((currentMinutes - START_MINUTE) / 60) * HOUR_HEIGHT;

          nowLine = `
            <div class="weekly-today-line"
              style="top:${top}px"></div>
          `;
        }
      }

      columns += `
        <div class="weekly-day-column ${selected ? "selected" : ""}"
          data-column-date="${day.key}">
          ${blocks
            .sort((a, b) => a.top - b.top)
            .map(block => block.html)
            .join("")}
          ${nowLine}
        </div>
      `;
    }

    wrapper.innerHTML = `
      <div class="weekly-grid">
        ${header}
        ${columns}
      </div>
    `;

    wrapper.querySelectorAll("[data-select-day]").forEach(button => {
      button.addEventListener("click", () => {
        selectedDate = button.dataset.selectDay;
        renderWeekly();
      });
    });

    wrapper.querySelectorAll("[data-edit-week-plan]").forEach(button => {
      button.addEventListener("click", () => {
        const plan = plans.find(
          item => item.id === button.dataset.editWeekPlan
        );

        if (plan) {
          openPlanDialog(plan);
        }
      });
    });

    wrapper.querySelectorAll("[data-open-calendar-event]").forEach(button => {
      button.addEventListener("click", () => {
        const event = calendarEvents.find(item =>
          String(item.id || "") === button.dataset.openCalendarEvent
        );

        if (!event) {
          return;
        }

        const dialog = $("#event-dialog");
        if (!dialog) {
          return;
        }

        const setValue = (selector, value) => {
          const element = $(selector);

          if (element) {
            element.value = value || "";
          }
        };

        setValue("#event-id", event.id);
        setValue("#event-title", event.title);
        setValue("#event-date", event.date || selectedDate);
        setValue("#event-start", event.start);
        setValue("#event-end", event.end);
        setValue("#event-notes", event.notes);

        if (!dialog.open) {
          dialog.showModal();
        }
      });
    });
  }

  // =========================================================
  // 週間の計画・実績比較
  // =========================================================

  function renderComparison() {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = startOfWeek(weekDate);
      date.setDate(date.getDate() + index);
      return dateKey(date);
    });

    const weeklyPlans = plans.filter(plan =>
      days.includes(plan.date)
    );

    const planned = weeklyPlans.reduce(
      (sum, plan) => sum + planMinutes(plan),
      0
    );

    const actual = days.reduce((sum, day) =>
      sum + getActualRecords(day).reduce(
        (subtotal, record) => subtotal + recordMinutes(record),
        0
      ),
      0
    );

    const rate = planned > 0
      ? Math.round(actual / planned * 100)
      : 0;

    const plannedTotal = $("#weekly-planned-total");
    const actualTotal = $("#weekly-actual-total");
    const achievement = $("#weekly-achievement");
    const comparison = $("#weekly-comparison");

    if (plannedTotal) {
      plannedTotal.textContent = fmtMinutes(planned);
    }

    if (actualTotal) {
      actualTotal.textContent = fmtMinutes(actual);
    }

    if (achievement) {
      achievement.textContent = `${rate}%`;
    }

    if (!comparison) {
      return;
    }

    const max = Math.max(planned, actual, 1);

    comparison.innerHTML = `
      <div class="weekly-compare-bars">
        <div class="weekly-compare-row">
          <span>計画時間</span>
          <div class="weekly-compare-track">
            <span class="planned-bar"
              style="width:${planned / max * 100}%"></span>
          </div>
          <strong>${fmtMinutes(planned)}</strong>
        </div>
        <div class="weekly-compare-row">
          <span>実績時間</span>
          <div class="weekly-compare-track">
            <span class="actual-bar"
              style="width:${actual / max * 100}%"></span>
          </div>
          <strong>${fmtMinutes(actual)}</strong>
        </div>
      </div>
    `;
  }

  // =========================================================
  // 選択日の学習計画一覧
  // =========================================================

  function renderDayCards() {
    const date = parseDate(selectedDate);
    const title = $("#weekly-selected-title");

    if (title) {
      title.textContent =
        `${date.getMonth() + 1}月${date.getDate()}日（${DAY_NAMES[date.getDay()]}）`;
    }

    const container = $("#weekly-plan-list");
    if (!container) {
      return;
    }

    const dayPlans = plans
      .filter(plan => plan.date === selectedDate)
      .sort((a, b) =>
        String(a.start).localeCompare(String(b.start))
      );

    if (!dayPlans.length) {
      container.innerHTML =
        '<div class="weekly-empty">この日の学習計画はありません。</div>';
      return;
    }

    container.innerHTML = dayPlans.map(plan => {
      const expected = planMinutes(plan);
      const actual = actualMinutesForPlan(plan);
      const max = Math.max(expected, actual, 1);

      return `
        <article class="weekly-plan-card">
          <h3>${escapeHTML(plan.title)}</h3>
          <p>${escapeHTML(plan.start)}〜${escapeHTML(plan.end)}</p>
          ${plan.subject
            ? `<p>科目：${escapeHTML(plan.subject)}</p>`
            : ""}
          ${plan.item
            ? `<p>項目：${escapeHTML(plan.item)}</p>`
            : ""}
          ${plan.notes
            ? `<p>${escapeHTML(plan.notes)}</p>`
            : ""}

          <div class="weekly-compare-bars">
            <div class="weekly-compare-row">
              <span>計画</span>
              <div class="weekly-compare-track">
                <span class="planned-bar"
                  style="width:${expected / max * 100}%"></span>
              </div>
              <strong>${fmtMinutes(expected)}</strong>
            </div>
            <div class="weekly-compare-row">
              <span>実績</span>
              <div class="weekly-compare-track">
                <span class="actual-bar"
                  style="width:${actual / max * 100}%"></span>
              </div>
              <strong>${fmtMinutes(actual)}</strong>
            </div>
          </div>

          <p>達成率：${expected
            ? Math.round(actual / expected * 100)
            : 0}%</p>

          <div class="weekly-card-actions">
            <button class="secondary-button" type="button"
              data-edit-plan="${escapeHTML(plan.id)}">編集</button>
            <button class="secondary-button" type="button"
              data-delete-plan="${escapeHTML(plan.id)}">削除</button>
          </div>
        </article>
      `;
    }).join("");

    container.querySelectorAll("[data-edit-plan]").forEach(button => {
      button.addEventListener("click", () => {
        const plan = plans.find(
          item => item.id === button.dataset.editPlan
        );

        if (plan) {
          openPlanDialog(plan);
        }
      });
    });

    container.querySelectorAll("[data-delete-plan]").forEach(button => {
      button.addEventListener("click", () => {
        const plan = plans.find(
          item => item.id === button.dataset.deletePlan
        );

        if (plan) {
          deletePlan(plan);
        }
      });
    });
  }

  // =========================================================
  // 週間予定表の描画
  // =========================================================

  function renderWeekly() {
    if (!$("#weekly-planner")) {
      return;
    }

    syncStoredData();

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = startOfWeek(weekDate);
      date.setDate(date.getDate() + index);
      return date;
    });

    const first = days[0];
    const last = days[6];
    const title = $("#weekly-title");

    if (title) {
      title.textContent =
        `${first.getFullYear()}年${first.getMonth() + 1}月${first.getDate()}日〜` +
        `${last.getMonth() + 1}月${last.getDate()}日`;
    }

    makeTimeline();
    renderComparison();
    renderDayCards();
  }

  // =========================================================
  // 学習計画ダイアログ
  // =========================================================

  function openPlanDialog(plan = null) {
    const dialog = $("#weekly-plan-dialog");
    const form = $("#weekly-plan-form");

    if (!dialog || !form) {
      return;
    }

    form.reset();

    $("#weekly-plan-id").value = plan?.id || "";
    $("#weekly-plan-title").value = plan?.title || "";
    $("#weekly-plan-subject").value = plan?.subject || "";
    $("#weekly-plan-item").value = plan?.item || "";
    $("#weekly-plan-date").value = plan?.date || selectedDate;
    $("#weekly-plan-start").value = plan?.start || "16:00";
    $("#weekly-plan-end").value = plan?.end || "17:00";
    $("#weekly-plan-notes").value = plan?.notes || "";

    if (!dialog.open) {
      dialog.showModal();
    }
  }

  function closePlanDialog() {
    const dialog = $("#weekly-plan-dialog");

    if (dialog?.open) {
      dialog.close();
    }
  }

  function savePlanFromForm() {
    const id = $("#weekly-plan-id").value;
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

    if (duration(start, end) <= 0) {
      alert("終了時刻は開始時刻より後にしてください。");
      return;
    }

    syncStoredData();

    const old = plans.find(plan => plan.id === id);

    const plan = {
      ...(old || {}),
      id: old?.id || uid(),
      title,
      subject,
      item,
      date,
      start,
      end,
      notes,
      updatedAt: Date.now()
    };

    if (old) {
      plans = plans.map(planItem =>
        planItem.id === old.id ? plan : planItem
      );
    } else {
      plan.createdAt = Date.now();
      plans.push(plan);
    }

    // 学習計画をタスクにも反映する。
    // 計画IDを利用して同じタスクが重複するのを防ぐ。
    const taskId = `weekly-${plan.id}`;

    const task = calendarTasks.find(existingTask =>
      existingTask.weeklyPlanId === plan.id ||
      existingTask.id === taskId
    );

    const taskData = {
      id: task?.id || taskId,
      weeklyPlanId: plan.id,
      title: `学習：${plan.title}`,
      date: plan.date,
      notes:
        `${plan.start}〜${plan.end}` +
        `${plan.notes ? " / " + plan.notes : ""}`,
      done: Boolean(task?.done),
      createdAt: task?.createdAt || Date.now()
    };

    if (task) {
      Object.assign(task, taskData);
    } else {
      calendarTasks.push(taskData);
    }

    const plansSaved = persistPlans();
    const calendarSaved = persistCalendar();

    selectedDate = date;
    weekDate = parseDate(date);

    closePlanDialog();
    renderWeekly();

    const toast = $("#toast");

    if (toast) {
      toast.textContent =
        plansSaved && calendarSaved
          ? "学習計画を保存し、タスクにも追加しました。"
          : "保存に失敗したデータがある可能性があります。";

      toast.classList.add("show");

      setTimeout(() => {
        toast.classList.remove("show");
      }, 2200);
    }
  }

  function deletePlan(plan) {
    if (!confirm(`「${plan.title}」の学習計画を削除しますか？`)) {
      return;
    }

    syncStoredData();

    plans = plans.filter(item => item.id !== plan.id);

    calendarTasks = calendarTasks.filter(task =>
      task.weeklyPlanId !== plan.id &&
      task.id !== `weekly-${plan.id}`
    );

    persistPlans();
    persistCalendar();
    renderWeekly();
  }

  // =========================================================
  // 画面・タブの作成
  // =========================================================

  function setupUI() {
    const view = $("#view-calendar");

    if (!view || $("#weekly-planner")) {
      return;
    }

    const heading = view.querySelector(".page-heading");

    if (!heading) {
      return;
    }

    const tabs = document.createElement("div");
    tabs.className = "schedule-tabs";

    tabs.innerHTML = `
      <button type="button"
        class="schedule-tab active"
        data-schedule-tab="weekly">週間予定表</button>
      <button type="button"
        class="schedule-tab"
        data-schedule-tab="calendar">カレンダー・タスク</button>
    `;

    const planner = document.createElement("div");
    planner.id = "weekly-planner";

    planner.innerHTML = `
      <div class="panel">
        <div class="weekly-toolbar">
          <button type="button" class="secondary-button"
            id="weekly-prev" aria-label="前の週">‹</button>
          <h2 id="weekly-title">週間予定表</h2>
          <button type="button" class="secondary-button"
            id="weekly-next" aria-label="次の週">›</button>
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
            <small>計画比</small>
            <strong id="weekly-achievement">0%</strong>
          </div>
        </div>

        <div class="weekly-legend">
          <span><i style="background:#8eafff"></i>学習計画</span>
          <span><i style="background:#c0a1ff"></i>既存の予定</span>
          <span><i style="background:#69dfc4"></i>時刻付き学習実績</span>
        </div>

        <div class="weekly-scroll" id="weekly-timetable"></div>

        <p class="weekly-note">
          表示時間は6:00〜翌2:00です。
          スマホでは表を左右にスライドして曜日を確認できます。
          青は学習計画、紫は既存の予定、緑は時刻付きの学習実績です。
        </p>
      </div>

      <div class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">PLAN VS ACTUAL</p>
            <h2>計画と実績の比較</h2>
          </div>
          <button type="button" class="primary-button"
            id="weekly-add-plan">＋ 学習計画</button>
        </div>
        <div id="weekly-comparison"></div>
      </div>

      <div class="panel">
        <div class="section-head">
          <div>
            <p class="eyebrow">DAILY PLAN</p>
            <h2 id="weekly-selected-title">今日の計画</h2>
          </div>
        </div>
        <div id="weekly-plan-list" class="weekly-day-list"></div>
      </div>

      <dialog id="weekly-plan-dialog" class="dialog">
        <form id="weekly-plan-form">
          <div class="dialog-head">
            <h2>学習計画</h2>
            <button type="button" class="close-dialog"
              id="weekly-close-dialog">×</button>
          </div>

          <input type="hidden" id="weekly-plan-id">

          <label>
            学習内容
            <input id="weekly-plan-title" maxlength="120" required
              placeholder="例：数学・二次関数">
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
            <textarea id="weekly-plan-notes"
              rows="2" maxlength="300"></textarea>
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

    const existingCalendarPanels = [
      view.querySelector(".calendar-panel"),
      view.querySelector("#day-items")?.closest(".panel"),
      view.querySelector("#task-list")?.closest(".panel")
    ].filter(Boolean);

    function selectTab(tab) {
      activeTab = tab;

      tabs.querySelectorAll(".schedule-tab").forEach(button => {
        button.classList.toggle(
          "active",
          button.dataset.scheduleTab === tab
        );
      });

      planner.hidden = tab !== "weekly";

      existingCalendarPanels.forEach(panel => {
        panel.hidden = tab === "weekly";
      });

      if (tab === "weekly") {
        renderWeekly();
      }
    }

    tabs.querySelectorAll("[data-schedule-tab]").forEach(button => {
      button.addEventListener("click", () => {
        selectTab(button.dataset.scheduleTab);
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

    selectTab("weekly");
  }

  // =========================================================
  // 初期化・更新監視
  // =========================================================

  function init() {
    injectStyles();
    setupUI();

    // 別タブや別画面で保存データが変更された場合に再描画する。
    window.addEventListener("storage", event => {
      if (
        ![
          STORAGE.study,
          STORAGE.events,
          STORAGE.tasks,
          STORAGE.weekly
        ].includes(event.key)
      ) {
        return;
      }

      syncStoredData();
      renderWeekly();
    });

    // app.js が予定を追加・編集・削除した後の再描画用。
    // 同じ画面内の更新イベントにも対応する。
    window.addEventListener("oneforall-calendar-updated", () => {
      syncStoredData();
      renderWeekly();
    });

    window.addEventListener("oneforall-study-updated", () => {
      syncStoredData();
      renderWeekly();
    });
  }

  window.OneForAllWeeklyPlanner = {
    refresh: () => {
      syncStoredData();
      renderWeekly();
    },

    getPlans: () => [...plans],

    getActualMinutes: actualMinutesForPlan
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
