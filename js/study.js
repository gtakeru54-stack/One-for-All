
/* =========================================================
   ONE FOR ALL COSMOS
   js/study.js

   学習記録システム
   ・科目 / 学習項目の管理
   ・学習タイマー
   ・手動での学習時間追加
   ・今日 / 1週間 / 全期間の集計
   ・学習履歴
   ・データの保存

   保存処理：既存の js/store.js を利用
   ========================================================= */

"use strict";

import { store } from "./store.js";

/* =========================================================
   1. 基本設定
   ========================================================= */

const DEFAULT_SUBJECTS = [
  {
    id: "math",
    name: "数学",
    color: "#6C9EFF",
    items: []
  },
  {
    id: "english",
    name: "英語",
    color: "#B69CFF",
    items: []
  },
  {
    id: "japanese",
    name: "国語",
    color: "#FF9E9E",
    items: []
  },
  {
    id: "science",
    name: "理科",
    color: "#65D6B0",
    items: []
  },
  {
    id: "social",
    name: "社会",
    color: "#FFC46B",
    items: []
  }
];

const MAX_HISTORY = 10000;

/* =========================================================
   2. 共通関数
   ========================================================= */

function createId(prefix = "study") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 9)
  );
}

function now() {
  return Date.now();
}

function isValidMinutes(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= 1440
  );
}

function localDateKey(timestamp = now()) {
  const date = new Date(timestamp);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfLocalDay(timestamp = now()) {
  const date = new Date(timestamp);

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function normalizeSubject(subject) {
  return {
    id: String(subject.id || createId("subject")),
    name: String(subject.name || "未分類"),
    color: String(subject.color || "#8B9BB4"),
    items: Array.isArray(subject.items)
      ? subject.items.map(item => {
          if (typeof item === "string") {
            return {
              id: createId("item"),
              name: item
            };
          }

          return {
            id: String(item.id || createId("item")),
            name: String(item.name || "未設定")
          };
        })
      : []
  };
}

function normalizeRecord(record) {
  const minutes = Number(record.minutes);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    return null;
  }

  const timestamp = Number(record.timestamp) || now();

  return {
    id: String(record.id || createId("record")),
    subjectId: String(record.subjectId || "other"),
    subjectName: String(record.subjectName || "未分類"),
    itemId: String(record.itemId || ""),
    itemName: String(record.itemName || "自由学習"),
    minutes,
    timestamp,
    date: String(record.date || localDateKey(timestamp)),
    source: record.source === "manual" ? "manual" : "timer",
    note: String(record.note || "")
  };
}

/* =========================================================
   3. データ読み込み
   ========================================================= */

function loadStudyData() {
  const data = store.study.load({});

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {
      version: 1,
      subjects: DEFAULT_SUBJECTS.map(normalizeSubject),
      records: []
    };
  }

  const subjects = Array.isArray(data.subjects)
    ? data.subjects.map(normalizeSubject)
    : DEFAULT_SUBJECTS.map(normalizeSubject);

  const records = Array.isArray(data.records)
    ? data.records
        .map(normalizeRecord)
        .filter(Boolean)
        .slice(-MAX_HISTORY)
    : [];

  return {
    ...data,
    version: 1,
    subjects,
    records
  };
}

function saveStudyData(data) {
  return store.study.save(data);
}

function mutateStudyData(mutator) {
  const data = loadStudyData();

  const result = mutator(data);

  if (result === false) {
    return false;
  }

  if (!saveStudyData(data)) {
    throw new Error(
      "学習データを保存できませんでした。端末の保存容量や設定を確認してください。"
    );
  }

  return result === undefined ? true : result;
}

/* =========================================================
   4. 科目管理
   ========================================================= */

export function getSubjects() {
  return loadStudyData().subjects.map(subject => ({
    ...subject,
    items: subject.items.map(item => ({ ...item }))
  }));
}

export function addSubject(name, color = "#8B9BB4") {
  const subjectName = String(name || "").trim();

  if (!subjectName) {
    throw new Error("科目名を入力してください。");
  }

  const data = loadStudyData();

  if (
    data.subjects.some(
      subject => subject.name.toLowerCase() === subjectName.toLowerCase()
    )
  ) {
    throw new Error("同じ名前の科目がすでにあります。");
  }

  const subject = {
    id: createId("subject"),
    name: subjectName,
    color: String(color || "#8B9BB4"),
    items: []
  };

  data.subjects.push(subject);

  if (!saveStudyData(data)) {
    throw new Error("科目を保存できませんでした。");
  }

  return { ...subject, items: [] };
}

export function renameSubject(subjectId, newName) {
  const name = String(newName || "").trim();

  if (!name) {
    throw new Error("新しい科目名を入力してください。");
  }

  return mutateStudyData(data => {
    const subject = data.subjects.find(
      item => item.id === String(subjectId)
    );

    if (!subject) {
      throw new Error("科目が見つかりません。");
    }

    if (
      data.subjects.some(
        item =>
          item.id !== subject.id &&
          item.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new Error("同じ名前の科目がすでにあります。");
    }

    subject.name = name;
  });
}

export function deleteSubject(subjectId) {
  const id = String(subjectId);

  return mutateStudyData(data => {
    const index = data.subjects.findIndex(
      subject => subject.id === id
    );

    if (index === -1) {
      throw new Error("科目が見つかりません。");
    }

    /*
     * 過去の記録は削除しない。
     * 記録には当時の科目名が保存されている。
     */
    data.subjects.splice(index, 1);
  });
}

/* =========================================================
   5. 学習項目管理
   ========================================================= */

export function addStudyItem(subjectId, itemName) {
  const name = String(itemName || "").trim();

  if (!name) {
    throw new Error("学習項目名を入力してください。");
  }

  let createdItem = null;

  mutateStudyData(data => {
    const subject = data.subjects.find(
      item => item.id === String(subjectId)
    );

    if (!subject) {
      throw new Error("科目が見つかりません。");
    }

    if (
      subject.items.some(
        item => item.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      throw new Error("同じ学習項目がすでにあります。");
    }

    createdItem = {
      id: createId("item"),
      name
    };

    subject.items.push(createdItem);
  });

  return { ...createdItem };
}

export function renameStudyItem(subjectId, itemId, newName) {
  const name = String(newName || "").trim();

  if (!name) {
    throw new Error("新しい学習項目名を入力してください。");
  }

  return mutateStudyData(data => {
    const subject = data.subjects.find(
      item => item.id === String(subjectId)
    );

    if (!subject) {
      throw new Error("科目が見つかりません。");
    }

    const item = subject.items.find(
      entry => entry.id === String(itemId)
    );

    if (!item) {
      throw new Error("学習項目が見つかりません。");
    }

    item.name = name;
  });
}

export function deleteStudyItem(subjectId, itemId) {
  return mutateStudyData(data => {
    const subject = data.subjects.find(
      item => item.id === String(subjectId)
    );

    if (!subject) {
      throw new Error("科目が見つかりません。");
    }

    const index = subject.items.findIndex(
      item => item.id === String(itemId)
    );

    if (index === -1) {
      throw new Error("学習項目が見つかりません。");
    }

    /*
     * 過去の学習記録は削除しない。
     */
    subject.items.splice(index, 1);
  });
}

/* =========================================================
   6. 学習記録の追加
   ========================================================= */

function resolveStudyTarget(data, subjectId, itemId) {
  const subject = data.subjects.find(
    entry => entry.id === String(subjectId)
  );

  if (!subject) {
    throw new Error("科目を選択してください。");
  }

  let item = null;

  if (itemId) {
    item = subject.items.find(
      entry => entry.id === String(itemId)
    );

    if (!item) {
      throw new Error("学習項目が見つかりません。");
    }
  }

  return { subject, item };
}

function insertRecord(data, record) {
  data.records.push(record);

  if (data.records.length > MAX_HISTORY) {
    data.records.splice(
      0,
      data.records.length - MAX_HISTORY
    );
  }

  return record;
}

/**
 * 手動で学習時間を記録する。
 *
 * @param {Object} options
 * @param {string} options.subjectId 科目ID
 * @param {string} [options.itemId] 学習項目ID
 * @param {number} options.minutes 学習時間（分）
 * @param {string} [options.note] メモ
 */
export function addManualStudyTime({
  subjectId,
  itemId = "",
  minutes,
  note = ""
} = {}) {
  const value = Number(minutes);

  if (!isValidMinutes(value)) {
    throw new Error(
      "学習時間は1分以上、1440分以下で入力してください。"
    );
  }

  let createdRecord = null;

  mutateStudyData(data => {
    const { subject, item } = resolveStudyTarget(
      data,
      subjectId,
      itemId
    );

    const timestamp = now();

    createdRecord = insertRecord(data, {
      id: createId("record"),
      subjectId: subject.id,
      subjectName: subject.name,
      itemId: item ? item.id : "",
      itemName: item ? item.name : "自由学習",
      minutes: value,
      timestamp,
      date: localDateKey(timestamp),
      source: "manual",
      note: String(note || "").trim()
    });
  });

  return { ...createdRecord };
}

/**
 * タイマーで計測した時間を学習記録に追加する。
 *
 * @param {Object} options
 * @param {string} options.subjectId 科目ID
 * @param {string} [options.itemId] 学習項目ID
 * @param {number} options.minutes 学習時間（分）
 * @param {string} [options.note] メモ
 */
export function addTimedStudyRecord({
  subjectId,
  itemId = "",
  minutes,
  note = ""
} = {}) {
  const value = Number(minutes);

  if (!isValidMinutes(value)) {
    throw new Error("記録する学習時間が正しくありません。");
  }

  let createdRecord = null;

  mutateStudyData(data => {
    const { subject, item } = resolveStudyTarget(
      data,
      subjectId,
      itemId
    );

    const timestamp = now();

    createdRecord = insertRecord(data, {
      id: createId("record"),
      subjectId: subject.id,
      subjectName: subject.name,
      itemId: item ? item.id : "",
      itemName: item ? item.name : "自由学習",
      minutes: value,
      timestamp,
      date: localDateKey(timestamp),
      source: "timer",
      note: String(note || "").trim()
    });
  });

  return { ...createdRecord };
}

/* =========================================================
   7. 学習記録の取得・削除
   ========================================================= */

export function getStudyRecords({
  from,
  to,
  subjectId,
  limit = MAX_HISTORY
} = {}) {
  let records = loadStudyData().records;

  if (from) {
    records = records.filter(record => record.date >= from);
  }

  if (to) {
    records = records.filter(record => record.date <= to);
  }

  if (subjectId) {
    records = records.filter(
      record => record.subjectId === String(subjectId)
    );
  }

  const safeLimit = Math.max(
    0,
    Math.min(MAX_HISTORY, Number(limit) || MAX_HISTORY)
  );

  return records
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, safeLimit)
    .map(record => ({ ...record }));
}

export function deleteStudyRecord(recordId) {
  return mutateStudyData(data => {
    const index = data.records.findIndex(
      record => record.id === String(recordId)
    );

    if (index === -1) {
      throw new Error("学習記録が見つかりません。");
    }

    data.records.splice(index, 1);
  });
}

/* =========================================================
   8. 学習時間の集計
   ========================================================= */

function sumMinutes(records) {
  return records.reduce(
    (total, record) => total + Number(record.minutes || 0),
    0
  );
}

export function getTodayStudyMinutes() {
  const today = localDateKey();

  return sumMinutes(
    getStudyRecords({ from: today, to: today })
  );
}

export function getWeekStudyMinutes() {
  const today = startOfLocalDay();

  /*
   * 今日を含む直近7日間。
   */
  const from = localDateKey(
    today - 6 * 24 * 60 * 60 * 1000
  );

  const to = localDateKey(today);

  return sumMinutes(
    getStudyRecords({ from, to })
  );
}

export function getTotalStudyMinutes() {
  return sumMinutes(getStudyRecords());
}

/**
 * 今日・1週間・全期間の学習時間を返す。
 */
export function getStudySummary() {
  return {
    todayMinutes: getTodayStudyMinutes(),
    weekMinutes: getWeekStudyMinutes(),
    totalMinutes: getTotalStudyMinutes()
  };
}

/* =========================================================
   9. 科目別の学習時間
   ========================================================= */

export function getSubjectStudyStats({
  from,
  to
} = {}) {
  const subjects = getSubjects();

  const records = getStudyRecords({ from, to });

  const stats = subjects.map(subject => ({
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    minutes: 0,
    recordCount: 0
  }));

  const index = new Map(
    stats.map(stat => [stat.subjectId, stat])
  );

  for (const record of records) {
    let stat = index.get(record.subjectId);

    /*
     * 削除済み科目の過去記録も集計から失わない。
     */
    if (!stat) {
      stat = {
        subjectId: record.subjectId,
        subjectName: record.subjectName || "未分類",
        color: "#8B9BB4",
        minutes: 0,
        recordCount: 0
      };

      stats.push(stat);
      index.set(stat.subjectId, stat);
    }

    stat.minutes += record.minutes;
    stat.recordCount += 1;
  }

  return stats.sort((a, b) => b.minutes - a.minutes);
}

/* =========================================================
   10. 日別の学習時間
   ========================================================= */

export function getDailyStudyStats(days = 7) {
  const count = Math.max(
    1,
    Math.min(366, Math.floor(Number(days) || 7))
  );

  const today = startOfLocalDay();
  const daily = [];

  for (let offset = count - 1; offset >= 0; offset--) {
    const timestamp = today - offset * 24 * 60 * 60 * 1000;
    const date = localDateKey(timestamp);

    daily.push({
      date,
      minutes: 0,
      recordCount: 0
    });
  }

  const index = new Map(
    daily.map(day => [day.date, day])
  );

  const records = getStudyRecords();

  for (const record of records) {
    const day = index.get(record.date);

    if (!day) {
      continue;
    }

    day.minutes += record.minutes;
    day.recordCount += 1;
  }

  return daily;
}

/* =========================================================
   11. 学習時間の表示用変換
   ========================================================= */

export function formatStudyTime(minutes) {
  const value = Math.max(
    0,
    Math.floor(Number(minutes) || 0)
  );

  const hours = Math.floor(value / 60);
  const remainingMinutes = value % 60;

  if (hours === 0) {
    return `${remainingMinutes}分`;
  }

  if (remainingMinutes === 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${remainingMinutes}分`;
}

/* =========================================================
   12. タイマー
   ========================================================= */

function loadTimerState() {
  const state = store.timer.load(null);

  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state)
  ) {
    return {
      running: false,
      startedAt: null,
      subjectId: "",
      itemId: "",
      note: ""
    };
  }

  return {
    running: Boolean(state.running),
    startedAt: Number(state.startedAt) || null,
    subjectId: String(state.subjectId || ""),
    itemId: String(state.itemId || ""),
    note: String(state.note || "")
  };
}

function saveTimerState(state) {
  const saved = store.timer.save(state);

  if (!saved) {
    throw new Error("タイマーの状態を保存できませんでした。");
  }

  return state;
}

/**
 * タイマーの状態を取得する。
 */
export function getTimerState() {
  const state = loadTimerState();

  let elapsedSeconds = 0;

  if (state.running && state.startedAt) {
    elapsedSeconds = Math.max(
      0,
      Math.floor((now() - state.startedAt) / 1000)
    );
  }

  return {
    ...state,
    elapsedSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60)
  };
}

/**
 * タイマーを開始する。
 */
export function startStudyTimer({
  subjectId,
  itemId = "",
  note = ""
} = {}) {
  if (!subjectId) {
    throw new Error("科目を選択してください。");
  }

  const data = loadStudyData();

  resolveStudyTarget(data, subjectId, itemId);

  const current = loadTimerState();

  if (current.running) {
    throw new Error("タイマーはすでに動作中です。");
  }

  const state = {
    running: true,
    startedAt: now(),
    subjectId: String(subjectId),
    itemId: String(itemId || ""),
    note: String(note || "").trim()
  };

  saveTimerState(state);

  return getTimerState();
}

/**
 * タイマーを停止し、計測時間を記録する。
 *
 * 1分未満の場合は自動で切り捨てず、
 * 記録せずに終了するかどうかを呼び出し側で判断できる。
 */
export function stopStudyTimer() {
  const state = loadTimerState();

  if (!state.running || !state.startedAt) {
    throw new Error("動作中のタイマーがありません。");
  }

  const elapsedSeconds = Math.max(
    0,
    Math.floor((now() - state.startedAt) / 1000)
  );

  const minutes = Math.floor(elapsedSeconds / 60);

  if (minutes < 1) {
    return {
      saved: false,
      elapsedSeconds,
      elapsedMinutes: 0,
      message: "計測時間が1分未満のため、学習記録は保存されていません。"
    };
  }

  /*
   * 先に学習記録を保存する。
   * 記録保存に失敗した場合はタイマーを残す。
   */
  const record = addTimedStudyRecord({
    subjectId: state.subjectId,
    itemId: state.itemId,
    minutes,
    note: state.note
  });

  saveTimerState({
    running: false,
    startedAt: null,
    subjectId: "",
    itemId: "",
    note: ""
  });

  return {
    saved: true,
    elapsedSeconds,
    elapsedMinutes: minutes,
    record
  };
}

/**
 * タイマーをリセットする。
 *
 * 記録を追加せず、計測中の時間を破棄する。
 */
export function resetStudyTimer() {
  saveTimerState({
    running: false,
    startedAt: null,
    subjectId: "",
    itemId: "",
    note: ""
  });

  return getTimerState();
}

/* =========================================================
   13. 初期化
   ========================================================= */

/**
 * 初期データがない場合に限り、初期科目を登録する。
 *
 * 既存の学習記録や科目は削除しない。
 */
export function initializeStudy() {
  const data = loadStudyData();

  if (data.subjects.length === 0) {
    data.subjects = DEFAULT_SUBJECTS.map(normalizeSubject);
  }

  if (!saveStudyData(data)) {
    throw new Error("学習データを初期化できませんでした。");
  }

  return {
    subjects: data.subjects.length,
    records: data.records.length
  };
}

/* =========================================================
   14. 学習機能のまとめ
   ========================================================= */

export const study = Object.freeze({
  initialize: initializeStudy,

  getSubjects,
  addSubject,
  renameSubject,
  deleteSubject,

  addStudyItem,
  renameStudyItem,
  deleteStudyItem,

  addManualStudyTime,
  addTimedStudyRecord,
  getStudyRecords,
  deleteStudyRecord,

  getTodayStudyMinutes,
  getWeekStudyMinutes,
  getTotalStudyMinutes,
  getStudySummary,

  getSubjectStudyStats,
  getDailyStudyStats,
  formatStudyTime,

  getTimerState,
  startStudyTimer,
  stopStudyTimer,
  resetStudyTimer
});
