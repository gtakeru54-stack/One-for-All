
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/habits.js
 *
 * 習慣づくりシステム
 *
 * 担当:
 * - 習慣の追加・編集・削除
 * - 習慣ごとの開始タイミング
 * - 最低限の行動目標
 * - 毎日の達成記録
 * - 連続達成日数
 * - 習慣の達成状況
 *
 * 注意:
 * このファイルは習慣データを管理します。
 * 画面表示や通知は別モジュールで接続します。
 */

import {
  STORAGE_KEYS,
  loadArray,
  saveData,
  createId,
  getTodayKey
} from "./storage.js";

// --------------------------------------------------
// 保存先
// --------------------------------------------------

const HABITS_STORAGE_KEY =
  STORAGE_KEYS?.habits ?? "oneforall-habits-v1";

// --------------------------------------------------
// 内部処理
// --------------------------------------------------

function getAllHabits() {
  return loadArray(HABITS_STORAGE_KEY).filter(
    habit =>
      habit &&
      typeof habit === "object" &&
      typeof habit.id === "string"
  );
}

function saveHabits(habits) {
  saveData(HABITS_STORAGE_KEY, habits);
}

function notifyHabitChange(type, habit = null) {
  if (typeof document === "undefined") {
    return;
  }

  document.dispatchEvent(
    new CustomEvent("cosmos:habits-change", {
      detail: {
        type,
        habit
      }
    })
  );
}

function normalizeText(value, maxLength = 160) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function normalizeDate(value) {
  const date = String(value ?? "").trim();

  if (!date) {
    return "";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const parsed = new Date(`${date}T00:00:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return null;
  }

  return date;
}

function normalizeDays(value) {
  if (!Array.isArray(value)) {
    return [1, 2, 3, 4, 5, 6, 0];
  }

  const result = [
    ...new Set(
      value
        .map(Number)
        .filter(day =>
          Number.isInteger(day) &&
          day >= 0 &&
          day <= 6
        )
    )
  ];

  return result.sort((a, b) => a - b);
}

function normalizeMinimumMinutes(value) {
  const minutes = Number(value ?? 5);

  if (!Number.isFinite(minutes)) {
    return 5;
  }

  return Math.max(
    1,
    Math.min(1440, Math.round(minutes))
  );
}

function normalizeHabitInput(input = {}) {
  const name = normalizeText(input.name, 100);

  if (!name) {
    return {
      ok: false,
      error: "習慣の名前を入力してください。"
    };
  }

  const createdDate = normalizeDate(
    input.startDate || getTodayKey()
  );

  if (createdDate === null) {
    return {
      ok: false,
      error: "開始日が正しくありません。"
    };
  }

  return {
    ok: true,
    habit: {
      name,
      description: normalizeText(
        input.description,
        500
      ),
      cue: normalizeText(
        input.cue,
        200
      ),
      minimumAction: normalizeText(
        input.minimumAction || "5分だけ取り組む",
        200
      ),
      minimumMinutes: normalizeMinimumMinutes(
        input.minimumMinutes ?? 5
      ),
      days: normalizeDays(input.days),
      startDate: createdDate,
      active: input.active !== false,
      color: normalizeText(input.color, 30),
      icon: normalizeText(input.icon, 30)
    }
  };
}

// --------------------------------------------------
// 習慣の取得
// --------------------------------------------------

/**
 * 登録されているすべての習慣を取得します。
 */
export function getHabits() {
  return getAllHabits();
}

/**
 * IDで習慣を取得します。
 */
export function getHabitById(id) {
  return getAllHabits().find(
    habit => habit.id === String(id)
  ) ?? null;
}

/**
 * 有効な習慣だけを取得します。
 */
export function getActiveHabits() {
  return getAllHabits().filter(
    habit => habit.active !== false
  );
}

// --------------------------------------------------
// 習慣の追加・編集・削除
// --------------------------------------------------

/**
 * 習慣を追加します。
 *
 * 例:
 * addHabit({
 *   name: "英単語を覚える",
 *   cue: "夕食のあと",
 *   minimumAction: "英単語を5個確認する",
 *   minimumMinutes: 5
 * })
 */
export function addHabit(input = {}) {
  const habits = getAllHabits();
  const normalized = normalizeHabitInput(input);

  if (!normalized.ok) {
    return {
      error: normalized.error
    };
  }

  const duplicate = habits.some(
    habit =>
      habit.name.toLowerCase() ===
      normalized.habit.name.toLowerCase()
  );

  if (duplicate) {
    return {
      error: "同じ名前の習慣がすでにあります。"
    };
  }

  const now = new Date().toISOString();

  const habit = {
    id: createId(),
    ...normalized.habit,
    createdAt: now,
    updatedAt: now
  };

  habits.push(habit);
  saveHabits(habits);

  notifyHabitChange("created", habit);

  return habit;
}

/**
 * 習慣を編集します。
 * 変更する項目だけ渡すこともできます。
 */
export function updateHabit(id, changes = {}) {
  const habits = getAllHabits();
  const index = habits.findIndex(
    habit => habit.id === String(id)
  );

  if (index === -1) {
    return {
      error: "習慣が見つかりません。"
    };
  }

  const existing = habits[index];

  const merged = {
    ...existing,
    ...changes
  };

  const normalized = normalizeHabitInput(merged);

  if (!normalized.ok) {
    return {
      error: normalized.error
    };
  }

  const duplicate = habits.some(
    habit =>
      habit.id !== existing.id &&
      habit.name.toLowerCase() ===
      normalized.habit.name.toLowerCase()
  );

  if (duplicate) {
    return {
      error: "同じ名前の習慣がすでにあります。"
    };
  }

  const updated = {
    ...existing,
    ...normalized.habit,
    updatedAt: new Date().toISOString()
  };

  habits[index] = updated;
  saveHabits(habits);

  notifyHabitChange("updated", updated);

  return updated;
}

/**
 * 習慣を削除します。
 * 過去の達成履歴は削除しません。
 */
export function deleteHabit(id) {
  const habits = getAllHabits();
  const targetId = String(id);

  const existing = habits.find(
    habit => habit.id === targetId
  );

  if (!existing) {
    return {
      error: "習慣が見つかりません。"
    };
  }

  saveHabits(
    habits.filter(habit => habit.id !== targetId)
  );

  notifyHabitChange("deleted", {
    id: targetId,
    name: existing.name
  });

  return {
    success: true,
    id: targetId
  };
}

// --------------------------------------------------
// 毎日の達成履歴
// --------------------------------------------------

/**
 * 習慣の達成履歴を取得します。
 *
 * 保存形式:
 * {
 *   "habit-id": {
 *     "2026-10-27": {
 *       completed: true,
 *       completedAt: "..."
 *     }
 *   }
 * }
 */
export function getHabitHistory() {
  return loadArray(
    `${HABITS_STORAGE_KEY}-history`
  );
}

/*
 * 履歴は配列ではなく、習慣IDと日付をキーにした
 * オブジェクトとして保存します。
 */
function loadHistoryObject() {
  const raw = localStorage.getItem(
    `${HABITS_STORAGE_KEY}-history`
  );

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveHistoryObject(history) {
  saveData(
    `${HABITS_STORAGE_KEY}-history`,
    history
  );
}

/**
 * 習慣を指定日に達成済みにします。
 */
export function completeHabit(
  habitId,
  date = getTodayKey()
) {
  const habit = getHabitById(habitId);

  if (!habit) {
    return {
      error: "習慣が見つかりません。"
    };
  }

  const dateKey = normalizeDate(date);

  if (!dateKey) {
    return {
      error: "日付が正しくありません。"
    };
  }

  if (dateKey < habit.startDate) {
    return {
      error: "習慣の開始日より前の日付は記録できません。"
    };
  }

  const history = loadHistoryObject();

  if (!history[habit.id]) {
    history[habit.id] = {};
  }

  const previous = history[habit.id][dateKey];

  history[habit.id][dateKey] = {
    completed: true,
    completedAt:
      previous?.completedAt ||
      new Date().toISOString()
  };

  saveHistoryObject(history);

  notifyHabitChange("completed", {
    habitId: habit.id,
    date: dateKey
  });

  return {
    success: true,
    habitId: habit.id,
    date: dateKey
  };
}

/**
 * 習慣の達成記録を取り消します。
 */
export function undoHabitCompletion(
  habitId,
  date = getTodayKey()
) {
  const habit = getHabitById(habitId);

  if (!habit) {
    return {
      error: "習慣が見つかりません。"
    };
  }

  const dateKey = normalizeDate(date);

  if (!dateKey) {
    return {
      error: "日付が正しくありません。"
    };
  }

  const history = loadHistoryObject();

  if (history[habit.id]) {
    delete history[habit.id][dateKey];

    if (
      Object.keys(history[habit.id]).length === 0
    ) {
      delete history[habit.id];
    }
  }

  saveHistoryObject(history);

  notifyHabitChange("undone", {
    habitId: habit.id,
    date: dateKey
  });

  return {
    success: true,
    habitId: habit.id,
    date: dateKey
  };
}

/**
 * 指定日の達成状態を取得します。
 */
export function isHabitCompleted(
  habitId,
  date = getTodayKey()
) {
  const history = loadHistoryObject();

  return Boolean(
    history[String(habitId)]?.[date]?.completed
  );
}

/**
 * 指定日の習慣一覧と達成状況を取得します。
 */
export function getHabitsForDate(
  date = getTodayKey()
) {
  const dateKey = normalizeDate(date);

  if (!dateKey) {
    return [];
  }

  const history = loadHistoryObject();

  return getActiveHabits()
    .filter(habit =>
      habit.startDate <= dateKey &&
      habit.days.includes(
        new Date(`${dateKey}T00:00:00`).getDay()
      )
    )
    .map(habit => ({
      ...habit,
      completed: Boolean(
        history[habit.id]?.[dateKey]?.completed
      )
    }));
}

// --------------------------------------------------
// 継続状況
// --------------------------------------------------

/**
 * 習慣の連続達成日数を取得します。
 *
 * 今日まだ達成していない場合でも、
 * 昨日まで連続していればその日数を返します。
 */
export function getHabitStreak(
  habitId,
  referenceDate = getTodayKey()
) {
  const habit = getHabitById(habitId);

  if (!habit) {
    return 0;
  }

  const history = loadHistoryObject();
  const habitHistory = history[habit.id] || {};

  const reference = normalizeDate(referenceDate);

  if (!reference) {
    return 0;
  }

  let current = new Date(`${reference}T00:00:00`);

  if (!habitHistory[reference]?.completed) {
    current.setDate(current.getDate() - 1);
  }

  let streak = 0;

  while (true) {
    const dateKey = current.toISOString().slice(0, 10);

    if (dateKey < habit.startDate) {
      break;
    }

    const day = current.getDay();

    // 習慣を実施しない曜日は連続日数に含めません。
    if (habit.days.includes(day)) {
      if (!habitHistory[dateKey]?.completed) {
        break;
      }

      streak += 1;
    }

    current.setDate(current.getDate() - 1);
  }

  return streak;
}

/**
 * 習慣の達成状況を集計します。
 */
export function getHabitSummary(
  date = getTodayKey()
) {
  const habits = getHabitsForDate(date);

  const total = habits.length;

  const completed = habits.filter(
    habit => habit.completed
  ).length;

  return {
    date,
    total,
    completed,
    remaining: total - completed,
    percentage: total > 0
      ? Math.round(completed / total * 100)
      : 0,
    habits
  };
}

/**
 * 過去の達成回数を取得します。
 */
export function getHabitCompletionCount(habitId) {
  const history = loadHistoryObject();
  const habitHistory = history[String(habitId)] || {};

  return Object.values(habitHistory).filter(
    entry => entry?.completed
  ).length;
}
