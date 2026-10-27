
/* =========================================================
   ONE FOR ALL COSMOS
   js/goals.js

   目標マップ・スキルツリー管理
   ・目標の追加 / 編集 / 削除
   ・達成状態の管理
   ・目標同士の接続
   ・必要勉強時間 / 達成率
   ・自動保存
   ========================================================= */

"use strict";

import { store } from "./store.js";

const STORAGE_VERSION = 1;

/* =========================================================
   基本データ
   ========================================================= */

const DEFAULT_GOALS = [
  {
    id: "goal-root",
    title: "自分の未来",
    description: "自分が目指す未来に向けて進む",
    category: "life",
    parentId: null,
    requiredMinutes: 0,
    completed: false,
    position: { x: 50, y: 8 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "goal-study",
    title: "学力を高める",
    description: "毎日の学習を積み重ねる",
    category: "study",
    parentId: "goal-root",
    requiredMinutes: 6000,
    completed: false,
    position: { x: 50, y: 30 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "goal-habit",
    title: "学習習慣を作る",
    description: "毎日少しずつ勉強する",
    category: "habit",
    parentId: "goal-root",
    requiredMinutes: 1800,
    completed: false,
    position: { x: 25, y: 30 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  },
  {
    id: "goal-future",
    title: "志望校・将来の目標",
    description: "自分の目標に向けて準備する",
    category: "future",
    parentId: "goal-study",
    requiredMinutes: 12000,
    completed: false,
    position: { x: 75, y: 52 },
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
];

/* =========================================================
   内部ユーティリティ
   ========================================================= */

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return (
    "goal-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10)
  );
}

function now() {
  return Date.now();
}

function normalizePosition(position) {
  const x = Number(position?.x);
  const y = Number(position?.y);

  return {
    x: Number.isFinite(x) ? Math.max(0, Math.min(100, x)) : 50,
    y: Number.isFinite(y) ? Math.max(0, Math.min(100, y)) : 50
  };
}

function normalizeGoal(goal) {
  const timestamp = now();

  return {
    id: String(goal.id || createId()),
    title: String(goal.title || "新しい目標").trim(),
    description: String(goal.description || ""),
    category: String(goal.category || "general"),
    parentId: goal.parentId ? String(goal.parentId) : null,
    requiredMinutes: Math.max(
      0,
      Math.floor(Number(goal.requiredMinutes) || 0)
    ),
    completed: Boolean(goal.completed),
    position: normalizePosition(goal.position),
    createdAt: Number(goal.createdAt) || timestamp,
    updatedAt: Number(goal.updatedAt) || timestamp,
    color: String(goal.color || ""),
    icon: String(goal.icon || "✦"),
    order: Number.isFinite(Number(goal.order))
      ? Number(goal.order)
      : 0
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* =========================================================
   保存データの読み込み
   ========================================================= */

function createDefaultData() {
  return {
    version: STORAGE_VERSION,
    goals: clone(DEFAULT_GOALS),
    selectedGoalId: "goal-study",
    lastUpdated: now()
  };
}

function loadGoalData() {
  let saved;

  try {
    saved = store.goals.load(null);
  } catch (error) {
    console.error("[Goals] データ読み込みエラー:", error);
    saved = null;
  }

  if (Array.isArray(saved)) {
    return {
      version: STORAGE_VERSION,
      goals: saved.map(normalizeGoal),
      selectedGoalId: saved[0]?.id || null,
      lastUpdated: now()
    };
  }

  if (!saved || typeof saved !== "object") {
    return createDefaultData();
  }

  const goals = Array.isArray(saved.goals)
    ? saved.goals.map(normalizeGoal)
    : clone(DEFAULT_GOALS).map(normalizeGoal);

  return {
    version: STORAGE_VERSION,
    goals,
    selectedGoalId: saved.selectedGoalId || goals[0]?.id || null,
    lastUpdated: Number(saved.lastUpdated) || now()
  };
}

let data = loadGoalData();

/* =========================================================
   保存
   ========================================================= */

function saveGoalData() {
  data.lastUpdated = now();

  try {
    return store.goals.save(data);
  } catch (error) {
    console.error("[Goals] データ保存エラー:", error);
    return false;
  }
}

/* =========================================================
   目標取得
   ========================================================= */

function getGoals() {
  return clone(data.goals);
}

function getGoal(goalId) {
  const goal = data.goals.find(item => item.id === goalId);
  return goal ? clone(goal) : null;
}

function getSelectedGoal() {
  return getGoal(data.selectedGoalId);
}

function getSelectedGoalId() {
  return data.selectedGoalId;
}

function selectGoal(goalId) {
  const exists = data.goals.some(item => item.id === goalId);

  if (!exists) {
    return false;
  }

  data.selectedGoalId = goalId;
  saveGoalData();

  return true;
}

/* =========================================================
   目標の追加
   ========================================================= */

function addGoal(options = {}) {
  const title = String(options.title || "").trim();

  if (!title) {
    return {
      success: false,
      message: "目標の名前を入力してください。"
    };
  }

  const parentId = options.parentId || null;

  if (
    parentId &&
    !data.goals.some(goal => goal.id === parentId)
  ) {
    return {
      success: false,
      message: "接続先の目標が見つかりません。"
    };
  }

  const goal = normalizeGoal({
    ...options,
    id: createId(),
    title,
    parentId,
    createdAt: now(),
    updatedAt: now()
  });

  data.goals.push(goal);
  data.selectedGoalId = goal.id;

  const saved = saveGoalData();

  return {
    success: saved !== false,
    message: saved === false
      ? "目標を追加しましたが、保存に失敗しました。"
      : "目標を追加しました。",
    goal: clone(goal)
  };
}

/* =========================================================
   目標の編集
   ========================================================= */

function updateGoal(goalId, changes = {}) {
  const index = data.goals.findIndex(goal => goal.id === goalId);

  if (index === -1) {
    return {
      success: false,
      message: "編集する目標が見つかりません。"
    };
  }

  const current = data.goals[index];
  const nextTitle = changes.title === undefined
    ? current.title
    : String(changes.title).trim();

  if (!nextTitle) {
    return {
      success: false,
      message: "目標の名前を入力してください。"
    };
  }

  if (changes.parentId === goalId) {
    return {
      success: false,
      message: "自分自身を接続先にはできません。"
    };
  }

  const nextParentId = changes.parentId === undefined
    ? current.parentId
    : changes.parentId || null;

  if (
    nextParentId &&
    !data.goals.some(goal => goal.id === nextParentId)
  ) {
    return {
      success: false,
      message: "接続先の目標が見つかりません。"
    };
  }

  if (nextParentId && isDescendant(nextParentId, goalId)) {
    return {
      success: false,
      message: "目標同士が循環する接続はできません。"
    };
  }

  const allowed = [
    "description",
    "category",
    "requiredMinutes",
    "completed",
    "position",
    "color",
    "icon",
    "order"
  ];

  const updated = {
    ...current,
    title: nextTitle,
    parentId: nextParentId,
    updatedAt: now()
  };

  for (const key of allowed) {
    if (changes[key] !== undefined) {
      updated[key] = changes[key];
    }
  }

  const normalized = normalizeGoal(updated);
  normalized.createdAt = current.createdAt;
  normalized.updatedAt = now();

  data.goals[index] = normalized;

  return {
    success: saveGoalData() !== false,
    message: "目標を更新しました。",
    goal: clone(normalized)
  };
}

/* =========================================================
   接続関係の確認
   ========================================================= */

function getChildren(goalId) {
  return clone(
    data.goals.filter(goal => goal.parentId === goalId)
  );
}

function getParent(goalId) {
  const goal = data.goals.find(item => item.id === goalId);

  if (!goal || !goal.parentId) {
    return null;
  }

  return getGoal(goal.parentId);
}

function getRoots() {
  return clone(data.goals.filter(goal => !goal.parentId));
}

function isDescendant(possibleDescendantId, ancestorId) {
  let current = data.goals.find(
    goal => goal.id === possibleDescendantId
  );

  const visited = new Set();

  while (current && current.parentId) {
    if (current.parentId === ancestorId) {
      return true;
    }

    if (visited.has(current.id)) {
      return true;
    }

    visited.add(current.id);

    current = data.goals.find(
      goal => goal.id === current.parentId
    );
  }

  return false;
}

function getDescendants(goalId) {
  const result = [];
  const queue = [goalId];
  const visited = new Set([goalId]);

  while (queue.length > 0) {
    const currentId = queue.shift();

    for (const child of data.goals) {
      if (
        child.parentId === currentId &&
        !visited.has(child.id)
      ) {
        visited.add(child.id);
        result.push(child);
        queue.push(child.id);
      }
    }
  }

  return clone(result);
}

/* =========================================================
   接続先の変更
   ========================================================= */

function connectGoal(goalId, parentId) {
  return updateGoal(goalId, { parentId: parentId || null });
}

function disconnectGoal(goalId) {
  return updateGoal(goalId, { parentId: null });
}

/* =========================================================
   達成状態
   ========================================================= */

function setGoalCompleted(goalId, completed = true) {
  return updateGoal(goalId, { completed: Boolean(completed) });
}

function toggleGoalCompleted(goalId) {
  const goal = data.goals.find(item => item.id === goalId);

  if (!goal) {
    return {
      success: false,
      message: "目標が見つかりません。"
    };
  }

  return setGoalCompleted(goalId, !goal.completed);
}

function getCompletionStats() {
  const total = data.goals.length;
  const completed = data.goals.filter(goal => goal.completed).length;

  return {
    total,
    completed,
    remaining: total - completed,
    percentage: total === 0
      ? 0
      : Math.round((completed / total) * 100)
  };
}

/* =========================================================
   勉強時間と目標達成率
   ========================================================= */

function getStudyMinutesForGoal(goalId, studyMinutesByGoal = {}) {
  const value = Number(studyMinutesByGoal[goalId]);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function getGoalProgress(goalId, studyMinutesByGoal = {}) {
  const goal = data.goals.find(item => item.id === goalId);

  if (!goal) {
    return null;
  }

  const studiedMinutes = getStudyMinutesForGoal(
    goalId,
    studyMinutesByGoal
  );

  const requiredMinutes = goal.requiredMinutes;
  const percentage = requiredMinutes <= 0
    ? (goal.completed ? 100 : 0)
    : Math.min(
        100,
        Math.round((studiedMinutes / requiredMinutes) * 100)
      );

  return {
    goalId,
    title: goal.title,
    completed: goal.completed,
    studiedMinutes,
    requiredMinutes,
    remainingMinutes: Math.max(
      0,
      requiredMinutes - studiedMinutes
    ),
    percentage
  };
}

function getTotalRequiredMinutes() {
  return data.goals.reduce(
    (total, goal) => total + goal.requiredMinutes,
    0
  );
}

/* =========================================================
   目標削除
   ========================================================= */

function deleteGoal(goalId, options = {}) {
  const goal = data.goals.find(item => item.id === goalId);

  if (!goal) {
    return {
      success: false,
      message: "削除する目標が見つかりません。"
    };
  }

  const descendants = getDescendants(goalId);
  const deleteChildren = Boolean(options.deleteChildren);

  if (descendants.length > 0 && !deleteChildren) {
    // 子目標を削除せず、削除対象の親を外す
    for (const child of data.goals) {
      if (child.parentId === goalId) {
        child.parentId = goal.parentId || null;
        child.updatedAt = now();
      }
    }
  }

  const deleteIds = new Set([
    goalId,
    ...(deleteChildren
      ? descendants.map(item => item.id)
      : [])
  ]);

  data.goals = data.goals.filter(
    item => !deleteIds.has(item.id)
  );

  if (deleteIds.has(data.selectedGoalId)) {
    data.selectedGoalId = data.goals[0]?.id || null;
  }

  return {
    success: saveGoalData() !== false,
    message: "目標を削除しました。"
  };
}

/* =========================================================
   目標マップ用データ
   ========================================================= */

function getGoalMapData(studyMinutesByGoal = {}) {
  const goals = data.goals.map(goal => {
    const progress = getGoalProgress(
      goal.id,
      studyMinutesByGoal
    );

    return {
      ...clone(goal),
      progress
    };
  });

  const links = data.goals
    .filter(goal => goal.parentId)
    .map(goal => ({
      from: goal.parentId,
      to: goal.id
    }));

  return {
    goals,
    links,
    stats: getCompletionStats(),
    selectedGoalId: data.selectedGoalId
  };
}

/* =========================================================
   検索
   ========================================================= */

function searchGoals(query) {
  const keyword = String(query || "")
    .trim()
    .toLowerCase();

  if (!keyword) {
    return getGoals();
  }

  return clone(
    data.goals.filter(goal =>
      goal.title.toLowerCase().includes(keyword) ||
      goal.description.toLowerCase().includes(keyword) ||
      goal.category.toLowerCase().includes(keyword)
    )
  );
}

/* =========================================================
   並び替え
   ========================================================= */

function reorderGoals(goalIds = []) {
  if (!Array.isArray(goalIds)) {
    return false;
  }

  const orderMap = new Map(
    goalIds.map((id, index) => [id, index])
  );

  data.goals = data.goals.map(goal => ({
    ...goal,
    order: orderMap.has(goal.id)
      ? orderMap.get(goal.id)
      : goal.order
  }));

  saveGoalData();

  return true;
}

function getSortedGoals() {
  return clone(
    [...data.goals].sort((a, b) => {
      if (a.order !== b.order) {
        return a.order - b.order;
      }

      return a.createdAt - b.createdAt;
    })
  );
}

/* =========================================================
   初期化・リセット
   ========================================================= */

function initializeGoals() {
  data = loadGoalData();

  if (data.goals.length === 0) {
    data = createDefaultData();
    saveGoalData();
  }

  return getGoals();
}

function resetGoals() {
  data = createDefaultData();
  saveGoalData();

  return getGoals();
}

/* =========================================================
   公開API
   ========================================================= */

export const goals = Object.freeze({
  initializeGoals,
  getGoals,
  getGoal,
  getSelectedGoal,
  getSelectedGoalId,
  selectGoal,

  addGoal,
  updateGoal,
  deleteGoal,

  getChildren,
  getParent,
  getRoots,
  getDescendants,
  isDescendant,

  connectGoal,
  disconnectGoal,

  setGoalCompleted,
  toggleGoalCompleted,
  getCompletionStats,

  getGoalProgress,
  getTotalRequiredMinutes,

  getGoalMapData,
  searchGoals,
  reorderGoals,
  getSortedGoals,

  resetGoals,
  save: saveGoalData
});

export default goals;
