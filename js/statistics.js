/* =========================================================
   ONE FOR ALL — COSMOS
   js/statistics.js
   学習時間の集計・グラフ
   ========================================================= */

"use strict";

import {
  getTodayKey,
  toDateKey,
  addDays,
  formatDuration,
  escapeHTML
} from "./storage.js";

import { getStudyData } from "./study.js";

let selectedPeriod = "week";

function getPeriodRecords(records) {
  const today = getTodayKey();

  if (selectedPeriod === "today") {
    return records.filter((record) => record.date === today);
  }

  if (selectedPeriod === "week") {
    const start = toDateKey(addDays(new Date(), -6));
    return records.filter(
      (record) => record.date >= start && record.date <= today
    );
  }

  if (selectedPeriod === "month") {
    const start = toDateKey(addDays(new Date(), -29));
    return records.filter(
      (record) => record.date >= start && record.date <= today
    );
  }

  return records;
}

function getSubjectName(id, subjects) {
  return subjects.find((subject) => subject.id === id)?.name || "科目未設定";
}

function groupBySubject(records, subjects) {
  const groups = new Map();

  records.forEach((record) => {
    const name = getSubjectName(record.subjectId, subjects);
    groups.set(name, (groups.get(name) || 0) + Number(record.seconds || 0));
  });

  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

function groupByDate(records) {
  const groups = new Map();

  records.forEach((record) => {
    if (!record.date) return;
    groups.set(record.date, (groups.get(record.date) || 0) + Number(record.seconds || 0));
  });

  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function renderTotal(seconds) {
  document.querySelectorAll(
    "#statistics-total, #total-study-time, [data-statistics-total]"
  ).forEach((element) => {
    element.textContent = formatDuration(seconds);
  });
}

function renderSubjectBreakdown(groups) {
  const container =
    document.querySelector("#statistics-subjects") ||
    document.querySelector("#subject-breakdown");

  if (!container) return;

  container.replaceChildren();

  const total = groups.reduce((sum, entry) => sum + entry[1], 0);

  if (!groups.length || total <= 0) {
    container.innerHTML = '<p class="empty-state">学習記録がありません</p>';
    return;
  }

  groups.forEach(([name, seconds], index) => {
    const percent = Math.round((seconds / total) * 100);

    const row = document.createElement("div");
    row.className = "statistics-subject-row";
    row.innerHTML = `
      <div class="statistics-subject-heading">
        <span>${escapeHTML(name)}</span>
        <strong>${formatDuration(seconds)} ・ ${percent}%</strong>
      </div>
      <div class="progress-track">
        <div class="progress-fill statistics-color-${index % 8}"
          style="width:${percent}%"></div>
      </div>
    `;

    container.appendChild(row);
  });
}

function renderBarChart(dateGroups) {
  const container =
    document.querySelector("#bar-chart") ||
    document.querySelector("#statistics-chart");

  if (!container) return;

  container.replaceChildren();

  const lastSevenDays = [];

  for (let i = 6; i >= 0; i--) {
    const date = toDateKey(addDays(new Date(), -i));
    const seconds = dateGroups.find((entry) => entry[0] === date)?.[1] || 0;
    lastSevenDays.push({ date, seconds });
  }

  const maxSeconds = Math.max(1, ...lastSevenDays.map((item) => item.seconds));

  lastSevenDays.forEach((item) => {
    const bar = document.createElement("div");
    bar.className = "chart-bar-item";

    const height = Math.max(2, (item.seconds / maxSeconds) * 100);
    const day = item.date.slice(5).replace("-", "/");

    bar.innerHTML = `
      <span class="chart-bar-value">${formatDuration(item.seconds)}</span>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="height:${height}%"></div>
      </div>
      <span class="chart-bar-label">${escapeHTML(day)}</span>
    `;

    container.appendChild(bar);
  });
}

function renderGoalProgress() {
  const element = document.querySelector("#statistics-progress");
  if (!element) return;

  const study = getStudyData();
  const today = getTodayKey();

  const todaySeconds = study.records
    .filter((record) => record.date === today)
    .reduce((sum, record) => sum + Number(record.seconds || 0), 0);

  const dailyGoalMinutes = Number(
    localStorage.getItem("oneforall-daily-study-goal") || 120
  );

  const target = Math.max(1, dailyGoalMinutes * 60);
  const percent = Math.min(100, Math.round((todaySeconds / target) * 100));

  element.style.width = `${percent}%`;

  const label = document.querySelector("#statistics-progress-label");
  if (label) {
    label.textContent =
      `今日 ${formatDuration(todaySeconds)} / 目標 ${formatDuration(target)}（${percent}%）`;
  }
}

function renderStatistics() {
  const study = getStudyData();
  const records = getPeriodRecords(study.records);
  const total = records.reduce(
    (sum, record) => sum + Number(record.seconds || 0),
    0
  );

  renderTotal(total);
  renderSubjectBreakdown(groupBySubject(records, study.subjects));
  renderBarChart(groupByDate(study.records));
  renderGoalProgress();
}

function bindPeriodButtons() {
  document.querySelectorAll("[data-stat-period]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPeriod = button.dataset.statPeriod;

      document.querySelectorAll("[data-stat-period]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });

      renderStatistics();
    });
  });
}

export function initStatistics() {
  bindPeriodButtons();
  renderStatistics();

  window.addEventListener("cosmos:viewchange", (event) => {
    if (event.detail?.view === "statistics") renderStatistics();
  });

  window.addEventListener("cosmos:datachange", renderStatistics);
}