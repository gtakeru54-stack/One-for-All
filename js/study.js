/* =========================================================
   ALGOL — STUDY CONSTELLATION
   js/study.js

   学習管理システム

   役割:
   - 科目管理
   - 学習項目管理
   - 学習タイマー
   - 手動学習記録
   - 学習記録の編集・削除
   - 学習時間集計

   保存処理は store.js に統一する。
   ========================================================= */

import {
  loadData,
  saveData
} from "./store.js";

/* =========================================================
   01. CONSTANTS
   ========================================================= */

const STUDY_KEYS = {
  subjects: "subjects",
  items: "studyItems",
  records: "studyRecords"
};

const TIMER_STORAGE_KEY = "algol-active-study-timer-v1";

const DEFAULT_SUBJECT_COLOR = "#91aaff";

const SUBJECT_COLORS = [
  "#91aaff",
  "#72e1ed",
  "#b49aff",
  "#ed9ed4",
  "#7fe0b2",
  "#f4d58a",
  "#ff929e",
  "#91c8ff",
  "#b7d78a",
  "#e5a77d"
];

/* =========================================================
   02. UTILITIES
   ========================================================= */

function createId(prefix = "study") {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function nowISO() {
  return new Date().toISOString();
}

function isValidDate(value) {
  return (
    typeof value === "string" &&
    !Number.isNaN(new Date(value).getTime())
  );
}

function normalizeMinutes(value) {
  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return 0;
  }

  return Math.max(0, Math.floor(minutes));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function getDateKey(date = new Date()) {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertText(value, label) {
  const text = normalizeText(value);

  if (!text) {
    throw new Error(`${label}を入力してください。`);
  }

  return text;
}

/* =========================================================
   03. DATA ACCESS
   ========================================================= */

function getSubjects() {
  const data = loadData(STUDY_KEYS.subjects, []);

  return Array.isArray(data) ? data : [];
}

function getItems() {
  const data = loadData(STUDY_KEYS.items, []);

  return Array.isArray(data) ? data : [];
}

function getRecords() {
  const data = loadData(STUDY_KEYS.records, []);

  return Array.isArray(data) ? data : [];
}

function saveSubjects(data) {
  saveData(STUDY_KEYS.subjects, data);
}

function saveItems(data) {
  saveData(STUDY_KEYS.items, data);
}

function saveRecords(data) {
  saveData(STUDY_KEYS.records, data);
}

/* =========================================================
   04. SUBJECT MANAGEMENT
   ========================================================= */

export function getAllSubjects() {
  return clone(getSubjects());
}

export function getSubject(subjectId) {
  return getSubjects().find(
    subject => subject.id === subjectId
  ) || null;
}

export function addSubject({
  name,
  color = null,
  description = ""
}) {
  const subjectName = assertText(name, "科目名");

  const subjects = getSubjects();

  if (
    subjects.some(
      subject =>
        normalizeText(subject.name) === subjectName
    )
  ) {
    throw new Error("同じ名前の科目が既に存在します。");
  }

  const index = subjects.length;

  const subject = {
    id: createId("subject"),
    name: subjectName,
    color:
      color ||
      SUBJECT_COLORS[index % SUBJECT_COLORS.length],
    description: normalizeText(description),
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  subjects.push(subject);

  saveSubjects(subjects);

  return clone(subject);
}

export function updateSubject(subjectId, changes = {}) {
  const subjects = getSubjects();

  const index = subjects.findIndex(
    subject => subject.id === subjectId
  );

  if (index === -1) {
    throw new Error("科目が見つかりません。");
  }

  const current = subjects[index];

  const nextName =
    changes.name !== undefined
      ? assertText(changes.name, "科目名")
      : current.name;

  const duplicated = subjects.some(
    subject =>
      subject.id !== subjectId &&
      normalizeText(subject.name) === nextName
  );

  if (duplicated) {
    throw new Error("同じ名前の科目が既に存在します。");
  }

  subjects[index] = {
    ...current,
    ...changes,
    id: current.id,
    name: nextName,
    updatedAt: nowISO()
  };

  saveSubjects(subjects);

  return clone(subjects[index]);
}

export function deleteSubject(subjectId) {
  const subjects = getSubjects();

  const target = subjects.find(
    subject => subject.id === subjectId
  );

  if (!target) {
    return false;
  }

  /*
   * 学習記録や学習項目は削除しない。
   * 過去の記録を失わないようにする。
   */

  saveSubjects(
    subjects.filter(
      subject => subject.id !== subjectId
    )
  );

  return true;
}

/* =========================================================
   05. STUDY ITEM MANAGEMENT
   ========================================================= */

export function getAllStudyItems() {
  return clone(getItems());
}

export function getStudyItemsBySubject(subjectId) {
  return clone(
    getItems().filter(
      item => item.subjectId === subjectId
    )
  );
}

export function getStudyItem(itemId) {
  return getItems().find(
    item => item.id === itemId
  ) || null;
}

export function addStudyItem({
  subjectId,
  name,
  description = ""
}) {
  const subject = getSubject(subjectId);

  if (!subject) {
    throw new Error("対象の科目が見つかりません。");
  }

  const itemName = assertText(name, "学習項目名");

  const items = getItems();

  const duplicated = items.some(
    item =>
      item.subjectId === subjectId &&
      normalizeText(item.name) === itemName
  );

  if (duplicated) {
    throw new Error("同じ学習項目が既に存在します。");
  }

  const item = {
    id: createId("item"),
    subjectId,
    name: itemName,
    description: normalizeText(description),
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  items.push(item);

  saveItems(items);

  return clone(item);
}

export function updateStudyItem(itemId, changes = {}) {
  const items = getItems();

  const index = items.findIndex(
    item => item.id === itemId
  );

  if (index === -1) {
    throw new Error("学習項目が見つかりません。");
  }

  const current = items[index];

  const nextName =
    changes.name !== undefined
      ? assertText(changes.name, "学習項目名")
      : current.name;

  const nextSubjectId =
    changes.subjectId !== undefined
      ? changes.subjectId
      : current.subjectId;

  if (!getSubject(nextSubjectId)) {
    throw new Error("対象の科目が見つかりません。");
  }

  const duplicated = items.some(
    item =>
      item.id !== itemId &&
      item.subjectId === nextSubjectId &&
      normalizeText(item.name) === nextName
  );

  if (duplicated) {
    throw new Error("同じ学習項目が既に存在します。");
  }

  items[index] = {
    ...current,
    ...changes,
    id: current.id,
    name: nextName,
    subjectId: nextSubjectId,
    updatedAt: nowISO()
  };

  saveItems(items);

  return clone(items[index]);
}

export function deleteStudyItem(itemId) {
  const items = getItems();

  const exists = items.some(
    item => item.id === itemId
  );

  if (!exists) {
    return false;
  }

  /*
   * 過去の学習記録は残す。
   */

  saveItems(
    items.filter(item => item.id !== itemId)
  );

  return true;
}

/* =========================================================
   06. STUDY RECORD NORMALIZATION
   ========================================================= */

function createStudyRecord({
  subjectId,
  itemId = null,
  minutes,
  date = getDateKey(),
  note = "",
  source = "manual"
}) {
  const subject = getSubject(subjectId);

  if (!subject) {
    throw new Error("科目が見つかりません。");
  }

  const normalizedMinutes = normalizeMinutes(minutes);

  if (normalizedMinutes <= 0) {
    throw new Error("学習時間は1分以上にしてください。");
  }

  if (itemId) {
    const item = getStudyItem(itemId);

    if (!item || item.subjectId !== subjectId) {
      throw new Error("学習項目が正しくありません。");
    }
  }

  const normalizedDate = String(date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
    throw new Error("日付の形式が正しくありません。");
  }

  return {
    id: createId("record"),
    subjectId,
    itemId,
    minutes: normalizedMinutes,
    date: normalizedDate,
    note: normalizeText(note),
    source,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };
}

/* =========================================================
   07. MANUAL STUDY RECORD
   ========================================================= */

export function addStudyRecord(options = {}) {
  const record = createStudyRecord({
    ...options,
    source: "manual"
  });

  const records = getRecords();

  records.push(record);

  saveRecords(records);

  return clone(record);
}

/* =========================================================
   08. TIMER STATE
   ========================================================= */

function loadTimerState() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const state = JSON.parse(raw);

    if (!state || typeof state !== "object") {
      return null;
    }

    return state;
  } catch (error) {
    console.error(
      "[ALGOL] Timer state could not be loaded.",
      error
    );

    return null;
  }
}

function saveTimerState(state) {
  try {
    if (state === null) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
      return;
    }

    localStorage.setItem(
      TIMER_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error(
      "[ALGOL] Timer state could not be saved.",
      error
    );

    throw new Error("タイマー状態を保存できませんでした。");
  }
}

let timerState = loadTimerState();

/* =========================================================
   09. TIMER ELAPSED TIME
   ========================================================= */

function getElapsedMilliseconds(state = timerState) {
  if (!state) {
    return 0;
  }

  const accumulated = Math.max(
    0,
    Number(state.accumulatedMilliseconds) || 0
  );

  if (state.status !== "running") {
    return accumulated;
  }

  const startedAt = new Date(
    state.startedAt
  ).getTime();

  if (!Number.isFinite(startedAt)) {
    return accumulated;
  }

  return accumulated + Math.max(
    0,
    Date.now() - startedAt
  );
}

export function getTimerStatus() {
  if (!timerState) {
    return {
      active: false,
      status: "idle",
      elapsedMilliseconds: 0,
      elapsedSeconds: 0,
      elapsedMinutes: 0
    };
  }

  const elapsedMilliseconds =
    getElapsedMilliseconds();

  return {
    active: true,
    status: timerState.status,
    subjectId: timerState.subjectId,
    itemId: timerState.itemId,
    startedAt: timerState.startedAt,
    elapsedMilliseconds,
    elapsedSeconds: Math.floor(
      elapsedMilliseconds / 1000
    ),
    elapsedMinutes: Math.floor(
      elapsedMilliseconds / 60000
    )
  };
}

/* =========================================================
   10. TIMER START
   ========================================================= */

export function startStudyTimer({
  subjectId,
  itemId = null
}) {
  if (timerState) {
    throw new Error(
      "既にタイマーが動作中、または一時停止中です。"
    );
  }

  if (!getSubject(subjectId)) {
    throw new Error("科目が見つかりません。");
  }

  if (itemId) {
    const item = getStudyItem(itemId);

    if (!item || item.subjectId !== subjectId) {
      throw new Error("学習項目が正しくありません。");
    }
  }

  timerState = {
    id: createId("timer"),
    subjectId,
    itemId,
    status: "running",
    startedAt: nowISO(),
    accumulatedMilliseconds: 0,
    createdAt: nowISO()
  };

  saveTimerState(timerState);

  return getTimerStatus();
}

/* =========================================================
   11. TIMER PAUSE
   ========================================================= */

export function pauseStudyTimer() {
  if (!timerState) {
    throw new Error("動作中のタイマーがありません。");
  }

  if (timerState.status !== "running") {
    return getTimerStatus();
  }

  timerState.accumulatedMilliseconds =
    getElapsedMilliseconds(timerState);

  timerState.status = "paused";
  timerState.startedAt = null;

  saveTimerState(timerState);

  return getTimerStatus();
}

/* =========================================================
   12. TIMER RESUME
   ========================================================= */

export function resumeStudyTimer() {
  if (!timerState) {
    throw new Error("再開できるタイマーがありません。");
  }

  if (timerState.status !== "paused") {
    return getTimerStatus();
  }

  timerState.status = "running";
  timerState.startedAt = nowISO();

  saveTimerState(timerState);

  return getTimerStatus();
}

/* =========================================================
   13. TIMER CANCEL
   ========================================================= */

export function cancelStudyTimer() {
  if (!timerState) {
    return false;
  }

  timerState = null;

  saveTimerState(null);

  return true;
}

/* =========================================================
   14. TIMER FINISH
   ========================================================= */

export function finishStudyTimer({
  note = ""
} = {}) {
  if (!timerState) {
    throw new Error("終了できるタイマーがありません。");
  }

  const elapsedMilliseconds =
    getElapsedMilliseconds(timerState);

  const minutes = Math.floor(
    elapsedMilliseconds / 60000
  );

  if (minutes <= 0) {
    throw new Error(
      "学習時間が1分未満のため記録できません。"
    );
  }

  const record = createStudyRecord({
    subjectId: timerState.subjectId,
    itemId: timerState.itemId,
    minutes,
    date: getDateKey(timerState.createdAt),
    note,
    source: "timer"
  });

  const records = getRecords();

  records.push(record);

  /*
   * 記録の保存に成功してからタイマーを消す。
   * 保存失敗時にタイマー情報を失わない。
   */

  saveRecords(records);

  timerState = null;

  saveTimerState(null);

  return clone(record);
}

/* =========================================================
   15. RECORD MANAGEMENT
   ========================================================= */

export function getAllStudyRecords() {
  return clone(getRecords());
}

export function getStudyRecord(recordId) {
  return getRecords().find(
    record => record.id === recordId
  ) || null;
}

export function updateStudyRecord(recordId, changes = {}) {
  const records = getRecords();

  const index = records.findIndex(
    record => record.id === recordId
  );

  if (index === -1) {
    throw new Error("学習記録が見つかりません。");
  }

  const current = records[index];

  const subjectId =
    changes.subjectId ?? current.subjectId;

  const itemId =
    changes.itemId !== undefined
      ? changes.itemId
      : current.itemId;

  const minutes =
    changes.minutes !== undefined
      ? normalizeMinutes(changes.minutes)
      : current.minutes;

  const date =
    changes.date !== undefined
      ? String(changes.date)
      : current.date;

  if (!getSubject(subjectId)) {
    throw new Error("科目が見つかりません。");
  }

  if (minutes <= 0) {
    throw new Error("学習時間は1分以上にしてください。");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日付の形式が正しくありません。");
  }

  if (itemId) {
    const item = getStudyItem(itemId);

    if (!item || item.subjectId !== subjectId) {
      throw new Error("学習項目が正しくありません。");
    }
  }

  records[index] = {
    ...current,
    ...changes,
    id: current.id,
    subjectId,
    itemId,
    minutes,
    date,
    updatedAt: nowISO()
  };

  saveRecords(records);

  return clone(records[index]);
}

export function deleteStudyRecord(recordId) {
  const records = getRecords();

  const exists = records.some(
    record => record.id === recordId
  );

  if (!exists) {
    return false;
  }

  saveRecords(
    records.filter(
      record => record.id !== recordId
    )
  );

  return true;
}

/* =========================================================
   16. STUDY TIME AGGREGATION
   ========================================================= */

export function getTotalStudyMinutes({
  from = null,
  to = null,
  subjectId = null,
  itemId = null
} = {}) {
  const records = getRecords();

  return records.reduce((total, record) => {
    if (
      subjectId &&
      record.subjectId !== subjectId
    ) {
      return total;
    }

    if (
      itemId &&
      record.itemId !== itemId
    ) {
      return total;
    }

    if (from && record.date < from) {
      return total;
    }

    if (to && record.date > to) {
      return total;
    }

    return total + normalizeMinutes(record.minutes);
  }, 0);
}

/* =========================================================
   17. SUBJECT TOTALS
   ========================================================= */

export function getStudyMinutesBySubject(options = {}) {
  const subjects = getSubjects();

  return subjects.map(subject => ({
    subjectId: subject.id,
    name: subject.name,
    color: subject.color || DEFAULT_SUBJECT_COLOR,
    minutes: getTotalStudyMinutes({
      ...options,
      subjectId: subject.id
    })
  }));
}

/* =========================================================
   18. ITEM TOTALS
   ========================================================= */

export function getStudyMinutesByItem(options = {}) {
  const items = getItems();

  return items.map(item => ({
    itemId: item.id,
    subjectId: item.subjectId,
    name: item.name,
    minutes: getTotalStudyMinutes({
      ...options,
      itemId: item.id
    })
  }));
}

/* =========================================================
   19. DAILY STUDY TOTAL
   ========================================================= */

export function getDailyStudyMinutes(date = getDateKey()) {
  return getTotalStudyMinutes({
    from: date,
    to: date
  });
}

/* =========================================================
   20. WEEKLY STUDY TOTAL
   ========================================================= */

export function getWeeklyStudyMinutes(date = new Date()) {
  const target = new Date(date);

  const day = target.getDay();

  const start = new Date(target);

  start.setDate(
    target.getDate() - day
  );

  const end = new Date(start);

  end.setDate(
    start.getDate() + 6
  );

  return getTotalStudyMinutes({
    from: getDateKey(start),
    to: getDateKey(end)
  });
}

/* =========================================================
   21. MONTHLY STUDY TOTAL
   ========================================================= */

export function getMonthlyStudyMinutes(date = new Date()) {
  const target = new Date(date);

  const year = target.getFullYear();
  const month = target.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return getTotalStudyMinutes({
    from: getDateKey(start),
    to: getDateKey(end)
  });
}

/* =========================================================
   22. DAILY STUDY HISTORY
   ========================================================= */

export function getDailyStudyHistory({
  from,
  to
} = {}) {
  if (!from || !to) {
    throw new Error("集計期間を指定してください。");
  }

  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    throw new Error("集計期間が正しくありません。");
  }

  const result = [];

  const cursor = new Date(start);

  while (cursor <= end) {
    const date = getDateKey(cursor);

    result.push({
      date,
      minutes: getDailyStudyMinutes(date)
    });

    cursor.setDate(
      cursor.getDate() + 1
    );
  }

  return result;
}

/* =========================================================
   23. RECENT RECORDS
   ========================================================= */

export function getRecentStudyRecords(limit = 10) {
  const safeLimit = Math.max(
    0,
    normalizeMinutes(limit)
  );

  return clone(
    getRecords()
      .sort((a, b) => {
        const dateA = new Date(
          a.createdAt || a.date
        ).getTime();

        const dateB = new Date(
          b.createdAt || b.date
        ).getTime();

        return dateB - dateA;
      })
      .slice(0, safeLimit)
  );
}

/* =========================================================
   24. FORMAT TIME
   ========================================================= */

export function formatStudyMinutes(minutes) {
  const total = normalizeMinutes(minutes);

  const hours = Math.floor(total / 60);
  const remaining = total % 60;

  if (hours <= 0) {
    return `${remaining}分`;
  }

  if (remaining <= 0) {
    return `${hours}時間`;
  }

  return `${hours}時間${remaining}分`;
}

export function formatTimer(milliseconds) {
  const totalSeconds = Math.floor(
    Math.max(0, milliseconds) / 1000
  );

  const hours = Math.floor(totalSeconds / 3600);

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

/* =========================================================
   25. EXPORT DEFAULT
   ========================================================= */

export default {
  getAllSubjects,
  getSubject,
  addSubject,
  updateSubject,
  deleteSubject,

  getAllStudyItems,
  getStudyItemsBySubject,
  getStudyItem,
  addStudyItem,
  updateStudyItem,
  deleteStudyItem,

  addStudyRecord,
  getAllStudyRecords,
  getStudyRecord,
  updateStudyRecord,
  deleteStudyRecord,

  startStudyTimer,
  pauseStudyTimer,
  resumeStudyTimer,
  cancelStudyTimer,
  finishStudyTimer,
  getTimerStatus,

  getTotalStudyMinutes,
  getStudyMinutesBySubject,
  getStudyMinutesByItem,
  getDailyStudyMinutes,
  getWeeklyStudyMinutes,
  getMonthlyStudyMinutes,
  getDailyStudyHistory,
  getRecentStudyRecords,

  formatStudyMinutes,
  formatTimer
};

/* =========================================================
   END OF ALGOL STUDY
   ========================================================= */