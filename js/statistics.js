
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/statistics.js
 *
 * 学習時間の集計・統計システム
 *
 * 担当:
 * - 今日・今週・今月・全期間の学習時間
 * - 教科別の学習時間
 * - 日別の学習時間
 * - 目標達成率
 * - 学習記録の集計
 *
 * グラフの描画は画面側のモジュールが担当します。
 */

import {
  loadStudyData,
  getDailyStudySeconds,
  getTotalStudySeconds
} from "./study.js";

// --------------------------------------------------
// 日付処理
// --------------------------------------------------

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (
    Number.isNaN(date.getTime()) ||
    toDateKey(date) !== value
  ) {
    return null;
  }

  return date;
}

function getStartOfWeek(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  // 月曜日を週の始まりにします。
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;

  result.setDate(result.getDate() + difference);

  return result;
}

function getStartOfMonth(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1
  );
}

function isDateBetween(dateKey, start, end) {
  const date = parseDateKey(dateKey);

  if (!date) {
    return false;
  }

  return date >= start && date < end;
}

// --------------------------------------------------
// 学習記録の取得
// --------------------------------------------------

function getRecords() {
  const data = loadStudyData();

  return Array.isArray(data.records)
    ? data.records
    : [];
}

function getRecordDate(record) {
  if (typeof record.date === "string") {
    return record.date;
  }

  if (typeof record.dateKey === "string") {
    return record.dateKey;
  }

  if (typeof record.startedAt === "string") {
    return record.startedAt.slice(0, 10);
  }

  if (typeof record.createdAt === "string") {
    return record.createdAt.slice(0, 10);
  }

  return "";
}

function getRecordSeconds(record) {
  const seconds = Number(
    record.seconds ??
    record.durationSeconds ??
    record.studySeconds ??
    0
  );

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 0;
  }

  return Math.floor(seconds);
}

function getRecordSubjectId(record) {
  return String(
    record.subjectId ??
    record.subject ??
    ""
  );
}

// --------------------------------------------------
// 期間別の集計
// --------------------------------------------------

/**
 * 今日の学習時間を秒単位で取得します。
 */
export function getTodaySeconds(referenceDate = new Date()) {
  return getDailyStudySeconds(toDateKey(referenceDate));
}

/**
 * 今週の学習時間を取得します。
 * 週の始まりは月曜日です。
 */
export function getWeekSeconds(referenceDate = new Date()) {
  const start = getStartOfWeek(referenceDate);
  const end = new Date(start);

  end.setDate(end.getDate() + 7);

  return sumRecords(
    getRecords().filter(record =>
      isDateBetween(getRecordDate(record), start, end)
    )
  );
}

/**
 * 今月の学習時間を取得します。
 */
export function getMonthSeconds(referenceDate = new Date()) {
  const start = getStartOfMonth(referenceDate);

  const end = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    1
  );

  return sumRecords(
    getRecords().filter(record =>
      isDateBetween(getRecordDate(record), start, end)
    )
  );
}

/**
 * 全期間の学習時間を取得します。
 */
export function getAllTimeSeconds() {
  return getTotalStudySeconds();
}

// --------------------------------------------------
// 日別集計
// --------------------------------------------------

/**
 * 指定した日数分の日別学習時間を取得します。
 *
 * 例:
 * getDailySeries(7)
 *
 * 戻り値:
 * [
 *   { date: "2026-10-21", seconds: 3600 },
 *   ...
 * ]
 */
export function getDailySeries(
  days = 7,
  referenceDate = new Date()
) {
  const count = Math.max(
    1,
    Math.min(366, Math.floor(Number(days) || 7))
  );

  const result = [];
  const current = new Date(referenceDate);

  current.setHours(0, 0, 0, 0);
  current.setDate(current.getDate() - count + 1);

  for (let index = 0; index < count; index += 1) {
    const dateKey = toDateKey(current);

    result.push({
      date: dateKey,
      seconds: sumRecords(
        getRecords().filter(record =>
          getRecordDate(record) === dateKey
        )
      )
    });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

// --------------------------------------------------
// 教科別集計
// --------------------------------------------------

/**
 * 教科別の学習時間を取得します。
 *
 * 戻り値:
 * [
 *   {
 *     subjectId: "...",
 *     subjectName: "...",
 *     seconds: 3600
 *   }
 * ]
 */
export function getSubjectBreakdown() {
  const data = loadStudyData();

  const subjects = Array.isArray(data.subjects)
    ? data.subjects
    : [];

  const records = getRecords();
  const totals = new Map();

  for (const subject of subjects) {
    totals.set(String(subject.id), {
      subjectId: String(subject.id),
      subjectName: String(subject.name ?? "名称未設定"),
      seconds: 0
    });
  }

  for (const record of records) {
    const subjectId = getRecordSubjectId(record);
    const seconds = getRecordSeconds(record);

    if (!subjectId || seconds <= 0) {
      continue;
    }

    if (!totals.has(subjectId)) {
      totals.set(subjectId, {
        subjectId,
        subjectName: "その他",
        seconds: 0
      });
    }

    totals.get(subjectId).seconds += seconds;
  }

  return Array.from(totals.values())
    .filter(subject => subject.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

/**
 * 指定期間内の教科別学習時間を取得します。
 *
 * options.startDate: 開始日 YYYY-MM-DD
 * options.endDate: 終了日 YYYY-MM-DD（この日を含む）
 */
export function getSubjectBreakdownForPeriod({
  startDate,
  endDate
} = {}) {
  const data = loadStudyData();

  const subjects = Array.isArray(data.subjects)
    ? data.subjects
    : [];

  const start = startDate
    ? parseDateKey(startDate)
    : null;

  const endInclusive = endDate
    ? parseDateKey(endDate)
    : null;

  if (
    (startDate && !start) ||
    (endDate && !endInclusive) ||
    (start && endInclusive && start > endInclusive)
  ) {
    return [];
  }

  const endExclusive = endInclusive
    ? new Date(
        endInclusive.getFullYear(),
        endInclusive.getMonth(),
        endInclusive.getDate() + 1
      )
    : null;

  const totals = new Map();

  for (const subject of subjects) {
    totals.set(String(subject.id), {
      subjectId: String(subject.id),
      subjectName: String(subject.name ?? "名称未設定"),
      seconds: 0
    });
  }

  for (const record of getRecords()) {
    const dateKey = getRecordDate(record);
    const date = parseDateKey(dateKey);

    if (!date) {
      continue;
    }

    if (start && date < start) {
      continue;
    }

    if (endExclusive && date >= endExclusive) {
      continue;
    }

    const subjectId = getRecordSubjectId(record);
    const seconds = getRecordSeconds(record);

    if (!subjectId || seconds <= 0) {
      continue;
    }

    if (!totals.has(subjectId)) {
      totals.set(subjectId, {
        subjectId,
        subjectName: "その他",
        seconds: 0
      });
    }

    totals.get(subjectId).seconds += seconds;
  }

  return Array.from(totals.values())
    .filter(subject => subject.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
}

// --------------------------------------------------
// 目標達成率
// --------------------------------------------------

/**
 * 1日の学習目標に対する達成状況を取得します。
 *
 * targetSeconds は秒単位です。
 */
export function getDailyGoalProgress(
  targetSeconds,
  referenceDate = new Date()
) {
  const target = Math.max(
    0,
    Number(targetSeconds) || 0
  );

  const studied = getTodaySeconds(referenceDate);

  const remaining = Math.max(0, target - studied);

  const percentage = target > 0
    ? Math.min(100, Math.round(studied / target * 100))
    : 0;

  return {
    targetSeconds: target,
    studiedSeconds: studied,
    remainingSeconds: remaining,
    percentage,
    achieved: target > 0 && studied >= target
  };
}

/**
 * 週の学習目標に対する達成状況を取得します。
 */
export function getWeeklyGoalProgress(
  targetSeconds,
  referenceDate = new Date()
) {
  const target = Math.max(
    0,
    Number(targetSeconds) || 0
  );

  const studied = getWeekSeconds(referenceDate);
  const remaining = Math.max(0, target - studied);

  const percentage = target > 0
    ? Math.min(100, Math.round(studied / target * 100))
    : 0;

  return {
    targetSeconds: target,
    studiedSeconds: studied,
    remainingSeconds: remaining,
    percentage,
    achieved: target > 0 && studied >= target
  };
}

// --------------------------------------------------
// 学習統計まとめ
// --------------------------------------------------

/**
 * ホーム画面や統計画面で使用する集計結果です。
 */
export function getStatisticsSummary({
  dailyTargetSeconds = 0,
  weeklyTargetSeconds = 0,
  referenceDate = new Date()
} = {}) {
  const today = getTodaySeconds(referenceDate);
  const week = getWeekSeconds(referenceDate);
  const month = getMonthSeconds(referenceDate);
  const allTime = getAllTimeSeconds();

  return {
    todaySeconds: today,
    weekSeconds: week,
    monthSeconds: month,
    allTimeSeconds: allTime,

    todayGoal: getDailyGoalProgress(
      dailyTargetSeconds,
      referenceDate
    ),

    weekGoal: getWeeklyGoalProgress(
      weeklyTargetSeconds,
      referenceDate
    ),

    subjectBreakdown: getSubjectBreakdown(),

    dailySeries: getDailySeries(7, referenceDate)
  };
}

// --------------------------------------------------
// 内部集計
// --------------------------------------------------

function sumRecords(records) {
  return records.reduce(
    (total, record) => total + getRecordSeconds(record),
    0
  );
}
