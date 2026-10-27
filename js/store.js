
"use strict";

/* =========================================================
   ONE FOR ALL COSMOS
   js/store.js
   共通データ保存・読み込み・初期化・移行
   ========================================================= */

const PREFIX = "ofa-cosmos-";
const VERSION = 1;

const DEFAULTS = {
  version: VERSION,
  settings: {
    dailyGoal: 120,
    weeklyGoal: 840,
    minimumAction: 5,
    animations: true,
    theme: "cosmos",
    shortcuts: [
      "home",
      "study",
      "calendar",
      "statistics",
      "goals",
      "rocket",
      "economy"
    ]
  },
  subjects: [
    { id: "math", name: "数学", color: "#7c9cff", items: [] },
    { id: "english", name: "英語", color: "#65d6ad", items: [] },
    { id: "japanese", name: "国語", color: "#ff9b9b", items: [] },
    { id: "science", name: "理科", color: "#c49bff", items: [] },
    { id: "social", name: "社会", color: "#ffc778", items: [] }
  ],
  studyRecords: [],
  timer: {
    running: false,
    startedAt: null,
    subjectId: null,
    itemId: null,
    accumulatedMs: 0
  },
  calendar: {
    events: [],
    tasks: [],
    timetable: []
  },
  goals: {
    nodes: [],
    habits: [],
    goals: []
  },
  rocket: {
    level: 1,
    experience: 0,
    claimedMissions: [],
    parts: [],
    explored: []
  },
  economy: {
    balance: 0,
    loans: [],
    transactions: [],
    lastInterestDate: null
  },
  countdowns: [],
  notifications: [],
  meta: {
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
};

const clone = value => JSON.parse(JSON.stringify(value));

function makeId(prefix = "item") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36).slice(2, 9)}`;
}

function isObject(value) {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function mergeDefaults(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(savedValue)
      ? savedValue
      : clone(defaultValue);
  }

  if (isObject(defaultValue)) {
    const result = {};
    const saved = isObject(savedValue) ? savedValue : {};

    for (const key of Object.keys(defaultValue)) {
      result[key] = key in saved
        ? mergeDefaults(defaultValue[key], saved[key])
        : clone(defaultValue[key]);
    }

    for (const key of Object.keys(saved)) {
      if (!(key in result)) result[key] = saved[key];
    }

    return result;
  }

  return savedValue === undefined
    ? defaultValue
    : savedValue;
}

function storageKey(name) {
  return PREFIX + name;
}

function readRaw(name) {
  try {
    const raw = localStorage.getItem(storageKey(name));
    return raw === null ? null : JSON.parse(raw);
  } catch (error) {
    console.error(`[COSMOS] 読み込み失敗: ${name}`, error);
    return null;
  }
}

function writeRaw(name, value) {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[COSMOS] 保存失敗: ${name}`, error);
    return false;
  }
}

let data = null;
let saveTimer = null;

function load() {
  if (data) return data;

  const saved = readRaw("database");
  data = mergeDefaults(DEFAULTS, saved);

  if (!Array.isArray(data.studyRecords)) data.studyRecords = [];
  if (!Array.isArray(data.subjects)) data.subjects = [];
  if (!Array.isArray(data.calendar.events)) data.calendar.events = [];
  if (!Array.isArray(data.calendar.tasks)) data.calendar.tasks = [];
  if (!Array.isArray(data.goals.goals)) data.goals.goals = [];
  if (!Array.isArray(data.countdowns)) data.countdowns = [];

  data.version = VERSION;
  save();

  return data;
}

function save() {
  if (!data) return false;

  data.meta.updatedAt = new Date().toISOString();
  return writeRaw("database", data);
}

function saveSoon() {
  if (saveTimer !== null) clearTimeout(saveTimer);

  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 150);
}

function get(path, fallback = undefined) {
  const keys = Array.isArray(path) ? path : String(path).split(".");
  let value = load();

  for (const key of keys) {
    if (value == null || !(key in Object(value))) return fallback;
    value = value[key];
  }

  return value === undefined ? fallback : value;
}

function set(path, value) {
  const keys = Array.isArray(path) ? path : String(path).split(".");
  if (!keys.length) return false;

  let target = load();

  for (const key of keys.slice(0, -1)) {
    if (!isObject(target[key]) && !Array.isArray(target[key])) {
      target[key] = {};
    }
    target = target[key];
  }

  target[keys[keys.length - 1]] = value;
  saveSoon();
  emit("change", { path: keys.join("."), value });

  return true;
}

function update(path, updater) {
  if (typeof updater !== "function") {
    throw new TypeError("updater は関数で指定してください");
  }

  const previous = get(path);
  return set(path, updater(clone(previous)));
}

function list(path) {
  const value = get(path, []);
  return Array.isArray(value) ? value : [];
}

function add(path, item) {
  const items = list(path);
  const entry = {
    id: item?.id || makeId(),
    createdAt: item?.createdAt || new Date().toISOString(),
    ...item
  };

  items.push(entry);
  set(path, items);

  emit("add", { path, item: entry });
  return entry;
}

function remove(path, id) {
  const items = list(path);
  const next = items.filter(item => item.id !== id);

  if (next.length === items.length) return false;

  set(path, next);
  emit("remove", { path, id });
  return true;
}

function replace(path, id, changes) {
  const items = list(path);
  const index = items.findIndex(item => item.id === id);

  if (index < 0) return false;

  items[index] = { ...items[index], ...changes, id };
  set(path, items);

  emit("update", { path, item: items[index] });
  return items[index];
}

function clearAll() {
  const confirmed = window.confirm(
    "COSMOSの保存データをすべて初期化します。\n" +
    "この操作は元に戻せません。事前にバックアップしてください。"
  );

  if (!confirmed) return false;

  data = clone(DEFAULTS);
  save();
  emit("reset", null);

  return true;
}

function exportData() {
  const backup = JSON.stringify(load(), null, 2);
  const blob = new Blob([backup], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `one-for-all-cosmos-${new Date()
    .toISOString().slice(0, 10)}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return true;
}

async function importData(file) {
  if (!file) throw new Error("ファイルが選択されていません");

  const text = await file.text();
  const imported = JSON.parse(text);

  if (!isObject(imported)) {
    throw new Error("バックアップの形式が正しくありません");
  }

  const next = mergeDefaults(DEFAULTS, imported);

  if (!Array.isArray(next.studyRecords) ||
      !Array.isArray(next.subjects) ||
      !isObject(next.calendar) ||
      !isObject(next.economy)) {
    throw new Error("必要なデータが不足しています");
  }

  const confirmed = window.confirm(
    "バックアップを読み込みます。\n" +
    "現在のデータは読み込んだ内容に置き換わります。"
  );

  if (!confirmed) return false;

  data = next;
  data.version = VERSION;

  if (!save()) {
    throw new Error("データを保存できませんでした");
  }

  emit("import", null);
  return true;
}

const listeners = new Map();

function on(eventName, callback) {
  if (typeof callback !== "function") return () => {};

  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }

  listeners.get(eventName).add(callback);

  return () => off(eventName, callback);
}

function off(eventName, callback) {
  listeners.get(eventName)?.delete(callback);
}

function emit(eventName, detail) {
  for (const callback of listeners.get(eventName) || []) {
    try {
      callback(detail, load());
    } catch (error) {
      console.error(`[COSMOS] イベント処理失敗: ${eventName}`, error);
    }
  }

  try {
    document.dispatchEvent(
      new CustomEvent(`cosmos:data-${eventName}`, { detail })
    );
  } catch (_) {}
}

function getStudyMinutes(date = null) {
  const records = list("studyRecords");
  const target = date ? String(date).slice(0, 10) : null;

  return records.reduce((total, record) => {
    if (target && String(record.date || "").slice(0, 10) !== target) {
      return total;
    }

    return total + Math.max(0, Number(record.minutes) || 0);
  }, 0);
}

function getSubjectMinutes(subjectId, since = null) {
  return list("studyRecords").reduce((total, record) => {
    if (record.subjectId !== subjectId) return total;
    if (since && record.date < since) return total;

    return total + Math.max(0, Number(record.minutes) || 0);
  }, 0);
}

function addStudyRecord(record) {
  const minutes = Number(record?.minutes);

  if (!Number.isFinite(minutes) || minutes <= 0) {
    throw new Error("学習時間は0より大きい数値にしてください");
  }

  const date = String(
    record.date || new Date().toISOString().slice(0, 10)
  ).slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("日付の形式が正しくありません");
  }

  return add("studyRecords", {
    subjectId: record.subjectId || "",
    itemId: record.itemId || "",
    subject: record.subject || "",
    item: record.item || "",
    minutes,
    date,
    note: record.note || "",
    source: record.source || "manual"
  });
}

const Store = {
  VERSION,
  makeId,
  clone,
  load,
  save,
  saveSoon,
  get,
  set,
  update,
  list,
  add,
  remove,
  replace,
  on,
  off,
  emit,
  getStudyMinutes,
  getSubjectMinutes,
  addStudyRecord,
  exportData,
  importData,
  clearAll
};

export { Store };
export default Store;
