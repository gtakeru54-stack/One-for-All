/* =========================================================
   ONE FOR ALL — COSMOS
   js/goals.js
   目標・目標マップ
   ========================================================= */

"use strict";

import {
  STORAGE_KEYS,
  loadData,
  saveData,
  createId,
  escapeHTML
} from "./storage.js";

let goalsData = { goals: [] };

function normalizeGoals(data) {
  if (Array.isArray(data)) return { goals: data };
  return { goals: Array.isArray(data?.goals) ? data.goals : [] };
}

function persistGoals() {
  saveData(STORAGE_KEYS.goals, goalsData);
  renderGoals();
  window.dispatchEvent(new Event("cosmos:datachange"));
}

function renderGoalList() {
  const container =
    document.querySelector("#goal-list") ||
    document.querySelector("#goals-list");

  if (!container) return;

  container.replaceChildren();

  if (!goalsData.goals.length) {
    container.innerHTML = '<p class="empty-state">目標を追加しましょう</p>';
    return;
  }

  goalsData.goals.forEach((goal) => {
    const card = document.createElement("article");
    card.className = `goal-card ${goal.completed ? "completed" : ""}`;

    const progress = Math.max(0, Math.min(100, Number(goal.progress || 0)));

    card.innerHTML = `
      <div class="goal-card-heading">
        <strong>${escapeHTML(goal.title)}</strong>
        <span>${goal.completed ? "達成済み" : `${progress}%`}</span>
      </div>
      <p>${escapeHTML(goal.description || "")}</p>
      ${goal.deadline ? `<p>期限：${escapeHTML(goal.deadline)}</p>` : ""}
      <div class="progress-track">
        <div class="progress-fill" style="width:${goal.completed ? 100 : progress}%"></div>
      </div>
      <div class="goal-card-actions">
        <button type="button" data-goal-progress="${escapeHTML(goal.id)}">進捗を更新</button>
        <button type="button" data-goal-complete="${escapeHTML(goal.id)}">
          ${goal.completed ? "未達成に戻す" : "達成"}
        </button>
        <button type="button" data-goal-delete="${escapeHTML(goal.id)}">削除</button>
      </div>
    `;

    container.appendChild(card);
  });
}

function renderGoalMap() {
  const world = document.querySelector("#goal-world");
  if (!world) return;

  world.replaceChildren();

  if (!goalsData.goals.length) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%");
    text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("fill", "currentColor");
    text.textContent = "目標を追加してマップを作ろう";
    world.appendChild(text);
    return;
  }

  const ns = "http://www.w3.org/2000/svg";
  const width = 600;
  const height = 360;
  const centerX = width / 2;
  const centerY = height / 2;

  goalsData.goals.forEach((goal, index) => {
    const angle = (Math.PI * 2 * index) / goalsData.goals.length - Math.PI / 2;
    const radius = goalsData.goals.length === 1 ? 0 : 125;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(centerX));
    line.setAttribute("y1", String(centerY));
    line.setAttribute("x2", String(x));
    line.setAttribute("y2", String(y));
    line.setAttribute("stroke", "currentColor");
    line.setAttribute("stroke-opacity", "0.35");
    line.setAttribute("stroke-width", "2");
    world.appendChild(line);

    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(x));
    circle.setAttribute("cy", String(y));
    circle.setAttribute("r", "28");
    circle.setAttribute("fill", goal.completed ? "#5ce1a5" : "#7c8cff");
    circle.setAttribute("stroke", "#ffffff");
    circle.setAttribute("stroke-opacity", "0.7");
    circle.setAttribute("stroke-width", "2");
    world.appendChild(circle);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(y + 45));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "currentColor");
    label.setAttribute("font-size", "12");
    label.textContent =
      goal.title.length > 10 ? `${goal.title.slice(0, 10)}…` : goal.title;
    world.appendChild(label);
  });

  const center = document.createElementNS(ns, "circle");
  center.setAttribute("cx", String(centerX));
  center.setAttribute("cy", String(centerY));
  center.setAttribute("r", "35");
  center.setAttribute("fill", "#f4c95d");
  world.appendChild(center);

  const centerLabel = document.createElementNS(ns, "text");
  centerLabel.setAttribute("x", String(centerX));
  centerLabel.setAttribute("y", String(centerY + 5));
  centerLabel.setAttribute("text-anchor", "middle");
  centerLabel.setAttribute("fill", "#10152a");
  centerLabel.setAttribute("font-size", "13");
  centerLabel.setAttribute("font-weight", "bold");
  centerLabel.textContent = "GOAL";
  world.appendChild(centerLabel);
}

function renderGoals() {
  renderGoalList();
  renderGoalMap();
}

function bindGoalForm() {
  const form =
    document.querySelector("#goal-form") ||
    document.querySelector("#add-goal-form");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();

    const title =
      form.querySelector('[name="title"]')?.value?.trim() ||
      document.querySelector("#goal-title")?.value?.trim();

    if (!title) return;

    const description =
      form.querySelector('[name="description"]')?.value?.trim() ||
      document.querySelector("#goal-description")?.value?.trim() ||
      "";

    const deadline =
      form.querySelector('[name="deadline"]')?.value ||
      document.querySelector("#goal-deadline")?.value ||
      "";

    goalsData.goals.push({
      id: createId("goal"),
      title,
      description,
      deadline,
      progress: 0,
      completed: false,
      penaltyApplied: false,
      createdAt: new Date().toISOString()
    });

    form.reset();
    persistGoals();
    form.closest("dialog")?.close();
  });

  document.addEventListener("click", (event) => {
    const progressButton = event.target.closest("[data-goal-progress]");

    if (progressButton) {
      const goal = goalsData.goals.find(
        (item) => item.id === progressButton.dataset.goalProgress
      );

      if (!goal) return;

      const answer = window.prompt(
        "進捗を0〜100の数字で入力してください",
        String(goal.progress || 0)
      );

      if (answer === null) return;

      const value = Number(answer);
      if (!Number.isFinite(value)) return;

      goal.progress = Math.max(0, Math.min(100, Math.round(value)));

      if (goal.progress >= 100) goal.completed = true;

      persistGoals();
      return;
    }

    const completeButton = event.target.closest("[data-goal-complete]");

    if (completeButton) {
      const goal = goalsData.goals.find(
        (item) => item.id === completeButton.dataset.goalComplete
      );

      if (!goal) return;

      goal.completed = !goal.completed;
      goal.progress = goal.completed ? 100 : Math.min(99, goal.progress || 0);

      persistGoals();
      return;
    }

    const deleteButton = event.target.closest("[data-goal-delete]");

    if (deleteButton) {
      const id = deleteButton.dataset.goalDelete;
      goalsData.goals = goalsData.goals.filter((item) => item.id !== id);
      persistGoals();
    }
  });
}

export function getGoalsData() {
  return goalsData;
}

export function initGoals() {
  goalsData = normalizeGoals(loadData(STORAGE_KEYS.goals, { goals: [] }));
  bindGoalForm();
  renderGoals();

  window.addEventListener("cosmos:viewchange", (event) => {
    if (event.detail?.view === "goals") renderGoals();
  });

  window.addEventListener("cosmos:datachange", renderGoals);
}