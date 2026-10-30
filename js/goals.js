
/* =========================================================
   ALGOL — Study Constellation
   js/goals.js

   目標星図・目標管理・習慣管理

   主な仕様
   ・目標を親子関係で管理
   ・親目標の進捗率は子目標から算出
   ・子目標が完了しても親目標は自動完了しない
   ・目標の追加、編集、削除、並び替え
   ・習慣の追加、編集、削除、実行記録
   ・データは localStorage に保存
   ========================================================= */

"use strict";

import { loadData, saveData } from "./store.js";

/* =========================================================
   保存キー
   ========================================================= */

const STORAGE = {
  goals: "goals",
  habits: "habits"
};

/* =========================================================
   共通関数
   ========================================================= */

function createId(prefix = "algol") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function now() {
  return new Date().toISOString();
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, number));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function sortByOrder(items) {
  return [...items].sort((a, b) => {
    return (a.order ?? 0) - (b.order ?? 0);
  });
}

/* =========================================================
   目標データ取得
   ========================================================= */

export function getAllGoals() {
  const goals = loadData(STORAGE.goals, []);

  return Array.isArray(goals) ? goals : [];
}

export function getGoal(goalId) {
  return getAllGoals().find(goal => goal.id === goalId) ?? null;
}

export function getRootGoals() {
  const goals = getAllGoals();

  return sortByOrder(
    goals.filter(goal => !goal.parentId)
  );
}

export function getChildGoals(parentId) {
  const goals = getAllGoals();

  return sortByOrder(
    goals.filter(goal => goal.parentId === parentId)
  );
}

export function getGoalTree(rootId = null) {
  const goals = getAllGoals();

  function buildTree(parentId, ancestors = new Set()) {
    return sortByOrder(
      goals.filter(goal => (goal.parentId ?? null) === parentId)
    ).map(goal => {
      if (ancestors.has(goal.id)) {
        return {
          ...goal,
          children: [],
          hasCircularReference: true
        };
      }

      const nextAncestors = new Set(ancestors);
      nextAncestors.add(goal.id);

      return {
        ...goal,
        children: buildTree(goal.id, nextAncestors)
      };
    });
  }

  if (rootId) {
    const root = getGoal(rootId);

    if (!root) {
      return [];
    }

    return [{
      ...root,
      children: buildTree(root.id, new Set([root.id]))
    }];
  }

  return buildTree(null);
}

/* =========================================================
   目標追加
   ========================================================= */

export function addGoal(data = {}) {
  const title = normalizeText(data.title);

  if (!title) {
    throw new Error("目標名を入力してください。");
  }

  const goals = getAllGoals();

  const parentId = data.parentId || null;

  if (parentId && !goals.some(goal => goal.id === parentId)) {
    throw new Error("指定された親目標が見つかりません。");
  }

  const goal = {
    id: createId("goal"),
    title,
    description: normalizeText(data.description),
    parentId,
    order: Number.isFinite(Number(data.order))
      ? Number(data.order)
      : goals.filter(item => item.parentId === parentId).length,

    status: ["not_started", "in_progress", "completed"].includes(data.status)
      ? data.status
      : "not_started",

    manualProgress: clamp(data.progress ?? 0),
    deadline: data.deadline || null,
    color: data.color || "#91aaff",

    createdAt: now(),
    updatedAt: now()
  };

  goals.push(goal);
  saveData(STORAGE.goals, goals);

  return goal;
}

/* =========================================================
   目標編集
   ========================================================= */

export function updateGoal(goalId, updates = {}) {
  const goals = getAllGoals();
  const index = goals.findIndex(goal => goal.id === goalId);

  if (index === -1) {
    throw new Error("編集する目標が見つかりません。");
  }

  const current = goals[index];
  const next = { ...current };

  if (updates.title !== undefined) {
    const title = normalizeText(updates.title);

    if (!title) {
      throw new Error("目標名を入力してください。");
    }

    next.title = title;
  }

  if (updates.description !== undefined) {
    next.description = normalizeText(updates.description);
  }

  if (updates.parentId !== undefined) {
    const parentId = updates.parentId || null;

    if (parentId === goalId) {
      throw new Error("自分自身を親目標には設定できません。");
    }

    if (parentId && !goals.some(goal => goal.id === parentId)) {
      throw new Error("指定された親目標が見つかりません。");
    }

    if (parentId && isGoalDescendant(goalId, parentId)) {
      throw new Error("子孫の目標を親目標には設定できません。");
    }

    next.parentId = parentId;
  }

  if (updates.order !== undefined) {
    next.order = Number(updates.order) || 0;
  }

  if (updates.status !== undefined) {
    if (!["not_started", "in_progress", "completed"].includes(updates.status)) {
      throw new Error("指定された目標ステータスは使用できません。");
    }

    next.status = updates.status;
  }

  if (updates.progress !== undefined) {
    next.manualProgress = clamp(updates.progress);
  }

  if (updates.deadline !== undefined) {
    next.deadline = updates.deadline || null;
  }

  if (updates.color !== undefined) {
    next.color = updates.color || "#91aaff";
  }

  next.updatedAt = now();

  goals[index] = next;
  saveData(STORAGE.goals, goals);

  return next;
}

/* =========================================================
   子孫関係の確認
   ========================================================= */

export function isGoalDescendant(ancestorId, targetId) {
  if (ancestorId === targetId) {
    return true;
  }

  const goals = getAllGoals();
  const visited = new Set();

  function search(parentId) {
    if (visited.has(parentId)) {
      return false;
    }

    visited.add(parentId);

    const children = goals.filter(
      goal => goal.parentId === parentId
    );

    for (const child of children) {
      if (child.id === targetId) {
        return true;
      }

      if (search(child.id)) {
        return true;
      }
    }

    return false;
  }

  return search(ancestorId);
}

/* =========================================================
   目標の進捗率
   ========================================================= */

/*
  子目標がある場合：
  子目標の進捗率の平均を親目標の進捗率とする。

  子目標がない場合：
  自分自身の manualProgress を使用する。

  completed の場合は進捗率を100%として扱う。

  重要：
  この関数は進捗率を計算するだけ。
  親目標の status は変更しない。
*/

export function getGoalProgress(goalId, visited = new Set()) {
  const goal = getGoal(goalId);

  if (!goal) {
    return 0;
  }

  if (goal.status === "completed") {
    return 100;
  }

  if (visited.has(goalId)) {
    return clamp(goal.manualProgress ?? 0);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(goalId);

  const children = getChildGoals(goalId);

  if (children.length === 0) {
    return clamp(goal.manualProgress ?? 0);
  }

  const total = children.reduce((sum, child) => {
    return sum + getGoalProgress(child.id, nextVisited);
  }, 0);

  return Math.round(total / children.length);
}

export function getGoalProgressInfo(goalId) {
  const goal = getGoal(goalId);

  if (!goal) {
    return null;
  }

  const children = getChildGoals(goalId);
  const progress = getGoalProgress(goalId);

  return {
    id: goal.id,
    title: goal.title,
    progress,
    status: goal.status,
    childCount: children.length,
    completedChildren: children.filter(
      child => child.status === "completed"
    ).length,
    isCompleted: goal.status === "completed"
  };
}

/* =========================================================
   目標ステータス
   ========================================================= */

export function setGoalStatus(goalId, status) {
  if (!["not_started", "in_progress", "completed"].includes(status)) {
    throw new Error("指定されたステータスは使用できません。");
  }

  return updateGoal(goalId, { status });
}

export function completeGoal(goalId) {
  return setGoalStatus(goalId, "completed");
}

export function reopenGoal(goalId) {
  return setGoalStatus(goalId, "in_progress");
}

/* =========================================================
   目標削除
   ========================================================= */

export function deleteGoal(goalId, options = {}) {
  const goals = getAllGoals();
  const exists = goals.some(goal => goal.id === goalId);

  if (!exists) {
    return false;
  }

  const deleteChildren = options.deleteChildren === true;

  if (deleteChildren) {
    const idsToDelete = new Set([goalId]);

    let changed = true;

    while (changed) {
      changed = false;

      for (const goal of goals) {
        if (
          goal.parentId &&
          idsToDelete.has(goal.parentId) &&
          !idsToDelete.has(goal.id)
        ) {
          idsToDelete.add(goal.id);
          changed = true;
        }
      }
    }

    saveData(
      STORAGE.goals,
      goals.filter(goal => !idsToDelete.has(goal.id))
    );
  } else {
    const parent = getGoal(goalId);

    const remaining = goals
      .filter(goal => goal.id !== goalId)
      .map(goal => {
        if (goal.parentId === goalId) {
          return {
            ...goal,
            parentId: parent?.parentId ?? null,
            updatedAt: now()
          };
        }

        return goal;
      });

    saveData(STORAGE.goals, remaining);
  }

  return true;
}

/* =========================================================
   目標の並び替え
   ========================================================= */

export function reorderGoals(goalIds = []) {
  if (!Array.isArray(goalIds)) {
    throw new Error("目標IDの配列を指定してください。");
  }

  const goals = getAllGoals();
  const orderMap = new Map(
    goalIds.map((id, index) => [id, index])
  );

  const updated = goals.map(goal => {
    if (!orderMap.has(goal.id)) {
      return goal;
    }

    return {
      ...goal,
      order: orderMap.get(goal.id),
      updatedAt: now()
    };
  });

  saveData(STORAGE.goals, updated);

  return sortByOrder(updated);
}

/* =========================================================
   目標の集計
   ========================================================= */

export function getGoalSummary() {
  const goals = getAllGoals();

  const completed = goals.filter(
    goal => goal.status === "completed"
  ).length;

  const inProgress = goals.filter(
    goal => goal.status === "in_progress"
  ).length;

  const notStarted = goals.filter(
    goal => goal.status === "not_started"
  ).length;

  const averageProgress = goals.length
    ? Math.round(
        goals.reduce(
          (sum, goal) => sum + getGoalProgress(goal.id),
          0
        ) / goals.length
      )
    : 0;

  return {
    total: goals.length,
    completed,
    inProgress,
    notStarted,
    averageProgress
  };
}

export function getUpcomingGoals(limit = 5) {
  const today = getDateKey();

  return getAllGoals()
    .filter(goal => {
      return (
        goal.deadline &&
        goal.deadline >= today &&
        goal.status !== "completed"
      );
    })
    .sort((a, b) => {
      return a.deadline.localeCompare(b.deadline);
    })
    .slice(0, Math.max(0, limit));
}

/* =========================================================
   習慣管理
   ========================================================= */

export function getAllHabits() {
  const habits = loadData(STORAGE.habits, []);

  return Array.isArray(habits) ? habits : [];
}

export function getHabit(habitId) {
  return getAllHabits().find(
    habit => habit.id === habitId
  ) ?? null;
}

export function addHabit(data = {}) {
  const title = normalizeText(data.title);

  if (!title) {
    throw new Error("習慣名を入力してください。");
  }

  const habit = {
    id: createId("habit"),
    title,
    description: normalizeText(data.description),

    frequency: data.frequency === "weekly"
      ? "weekly"
      : "daily",

    targetPerWeek: Math.max(
      1,
      Math.min(7, Number(data.targetPerWeek) || 3)
    ),

    logs: [],
    color: data.color || "#72e1ed",
    createdAt: now(),
    updatedAt: now()
  };

  const habits = getAllHabits();
  habits.push(habit);

  saveData(STORAGE.habits, habits);

  return habit;
}

export function updateHabit(habitId, updates = {}) {
  const habits = getAllHabits();
  const index = habits.findIndex(
    habit => habit.id === habitId
  );

  if (index === -1) {
    throw new Error("編集する習慣が見つかりません。");
  }

  const habit = { ...habits[index] };

  if (updates.title !== undefined) {
    const title = normalizeText(updates.title);

    if (!title) {
      throw new Error("習慣名を入力してください。");
    }

    habit.title = title;
  }

  if (updates.description !== undefined) {
    habit.description = normalizeText(updates.description);
  }

  if (updates.frequency !== undefined) {
    habit.frequency = updates.frequency === "weekly"
      ? "weekly"
      : "daily";
  }

  if (updates.targetPerWeek !== undefined) {
    habit.targetPerWeek = Math.max(
      1,
      Math.min(7, Number(updates.targetPerWeek) || 1)
    );
  }

  if (updates.color !== undefined) {
    habit.color = updates.color || "#72e1ed";
  }

  habit.updatedAt = now();

  habits[index] = habit;
  saveData(STORAGE.habits, habits);

  return habit;
}

/* =========================================================
   習慣の実行記録
   ========================================================= */

export function recordHabit(habitId, date = getDateKey()) {
  const habits = getAllHabits();
  const index = habits.findIndex(
    habit => habit.id === habitId
  );

  if (index === -1) {
    throw new Error("記録する習慣が見つかりません。");
  }

  const habit = { ...habits[index] };
  const logs = Array.isArray(habit.logs)
    ? [...habit.logs]
    : [];

  if (!logs.includes(date)) {
    logs.push(date);
  }

  habit.logs = logs.sort();
  habit.updatedAt = now();

  habits[index] = habit;
  saveData(STORAGE.habits, habits);

  return habit;
}

export function removeHabitRecord(habitId, date = getDateKey()) {
  const habits = getAllHabits();
  const index = habits.findIndex(
    habit => habit.id === habitId
  );

  if (index === -1) {
    return false;
  }

  const habit = { ...habits[index] };

  habit.logs = (habit.logs || []).filter(
    logDate => logDate !== date
  );

  habit.updatedAt = now();

  habits[index] = habit;
  saveData(STORAGE.habits, habits);

  return true;
}

export function hasHabitRecord(habitId, date = getDateKey()) {
  const habit = getHabit(habitId);

  return Boolean(
    habit &&
    Array.isArray(habit.logs) &&
    habit.logs.includes(date)
  );
}

export function deleteHabit(habitId) {
  const habits = getAllHabits();
  const remaining = habits.filter(
    habit => habit.id !== habitId
  );

  if (remaining.length === habits.length) {
    return false;
  }

  saveData(STORAGE.habits, remaining);

  return true;
}

/* =========================================================
   習慣の集計
   ========================================================= */

export function getHabitStreak(habitId, fromDate = new Date()) {
  const habit = getHabit(habitId);

  if (!habit || !Array.isArray(habit.logs)) {
    return 0;
  }

  const logSet = new Set(habit.logs);
  const cursor = new Date(fromDate);
  let streak = 0;

  cursor.setHours(0, 0, 0, 0);

  while (logSet.has(getDateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function getHabitWeeklyCount(habitId, date = new Date()) {
  const habit = getHabit(habitId);

  if (!habit || !Array.isArray(habit.logs)) {
    return 0;
  }

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const day = target.getDay();
  target.setDate(target.getDate() - day);

  const weekDates = [];

  for (let i = 0; i < 7; i++) {
    weekDates.push(getDateKey(target));
    target.setDate(target.getDate() + 1);
  }

  const logSet = new Set(habit.logs);

  return weekDates.filter(dateKey => logSet.has(dateKey)).length;
}

export function getHabitSummary(date = new Date()) {
  const habits = getAllHabits();

  const today = getDateKey(date);

  const completedToday = habits.filter(habit => {
    return Array.isArray(habit.logs) &&
      habit.logs.includes(today);
  }).length;

  const weeklyCompleted = habits.filter(habit => {
    const count = getHabitWeeklyCount(habit.id, date);

    if (habit.frequency === "weekly") {
      return count >= habit.targetPerWeek;
    }

    return count > 0;
  }).length;

  return {
    total: habits.length,
    completedToday,
    weeklyCompleted,
    remainingToday: Math.max(0, habits.length - completedToday)
  };
}

/* =========================================================
   初期データ
   ========================================================= */

export function initializeGoals() {
  const goals = getAllGoals();
  const habits = getAllHabits();

  if (!Array.isArray(goals)) {
    saveData(STORAGE.goals, []);
  }

  if (!Array.isArray(habits)) {
    saveData(STORAGE.habits, []);
  }

  return {
    goals: getAllGoals(),
    habits: getAllHabits()
  };
}

/* =========================================================
   デフォルトエクスポート
   ========================================================= */

export default {
  getAllGoals,
  getGoal,
  getRootGoals,
  getChildGoals,
  getGoalTree,

  addGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,

  isGoalDescendant,
  getGoalProgress,
  getGoalProgressInfo,

  setGoalStatus,
  completeGoal,
  reopenGoal,

  getGoalSummary,
  getUpcomingGoals,

  getAllHabits,
  getHabit,
  addHabit,
  updateHabit,
  deleteHabit,

  recordHabit,
  removeHabitRecord,
  hasHabitRecord,

  getHabitStreak,
  getHabitWeeklyCount,
  getHabitSummary,

  initializeGoals
};
