/* =========================================================
   ALGOL — STUDY CONSTELLATION
   js/store.js

   共通データ保存システム

   役割:
   - localStorage管理
   - 既存データの引き継ぎ
   - データ形式のバージョン管理
   - バックアップ・復元
   - 保存エラーへの対応

   注意:
   - 既存データを勝手に削除しない
   - 保存キーを勝手に変更しない
   ========================================================= */

const ALGOL_STORE_VERSION = 1;

const ALGOL_STORAGE_KEYS = Object.freeze({
  subjects: "one-for-all-subjects-v1",
  studyRecords: "one-for-all-study-records-v1",
  studyItems: "one-for-all-study-items-v1",
  goals: "one-for-all-goals-v1",
  countdown: "one-for-all-countdown-v1",
  settings: "one-for-all-settings-v1",

  calendar: "personal-calendar-v1",
  tasks: "personal-tasks-v1",

  meta: "algol-storage-meta-v1",
  economy: "algol-economy-v1",
  rocket: "algol-rocket-v1",
  habits: "algol-habits-v1",
  notifications: "algol-notifications-v1"
});

/* =========================================================
   01. ERROR
   ========================================================= */

export class AlgolStoreError extends Error {
  constructor(message, key = null, cause = null) {
    super(message);

    this.name = "AlgolStoreError";
    this.key = key;
    this.cause = cause;
  }
}

/* =========================================================
   02. STORAGE AVAILABILITY
   ========================================================= */

function getStorage() {
  try {
    if (typeof localStorage === "undefined") {
      throw new Error("localStorage is unavailable.");
    }

    const testKey = "__algol_storage_test__";

    localStorage.setItem(testKey, "ok");
    localStorage.removeItem(testKey);

    return localStorage;
  } catch (error) {
    throw new AlgolStoreError(
      "端末の保存領域を利用できません。",
      null,
      error
    );
  }
}

/* =========================================================
   03. JSON UTILITIES
   ========================================================= */

function cloneData(value) {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value));
}

function parseJSON(raw, fallback, key) {
  if (raw === null || raw === undefined) {
    return cloneData(fallback);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(
      `[ALGOL] JSON parse failed: ${key}`,
      error
    );

    return cloneData(fallback);
  }
}

/* =========================================================
   04. DEFAULT DATA
   ========================================================= */

export const ALGOL_DEFAULTS = Object.freeze({
  subjects: [],
  studyRecords: [],
  studyItems: [],
  goals: [],
  countdown: [],
  settings: {
    dailyTarget: 60,
    weeklyTarget: 420,
    theme: "dark",
    animations: true
  },
  calendar: [],
  tasks: [],
  economy: {
    balance: 0,
    transactions: [],
    loans: []
  },
  rocket: {
    experience: 0,
    level: 1,
    parts: [],
    missions: [],
    exploration: []
  },
  habits: [],
  notifications: []
});

/* =========================================================
   05. KEY VALIDATION
   ========================================================= */

function getKey(name) {
  const key = ALGOL_STORAGE_KEYS[name];

  if (!key) {
    throw new AlgolStoreError(
      `不明な保存項目です: ${name}`
    );
  }

  return key;
}

/* =========================================================
   06. READ
   ========================================================= */

export function loadData(name, fallback = undefined) {
  const storage = getStorage();
  const key = getKey(name);

  const defaultValue =
    fallback !== undefined
      ? fallback
      : ALGOL_DEFAULTS[name];

  const raw = storage.getItem(key);

  return parseJSON(raw, defaultValue, key);
}

/* =========================================================
   07. SAVE
   ========================================================= */

export function saveData(name, value) {
  const storage = getStorage();
  const key = getKey(name);

  if (value === undefined) {
    throw new AlgolStoreError(
      "undefinedは保存できません。",
      key
    );
  }

  let serialized;

  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    throw new AlgolStoreError(
      "データをJSONに変換できませんでした。",
      key,
      error
    );
  }

  if (serialized === undefined) {
    throw new AlgolStoreError(
      "保存可能なデータではありません。",
      key
    );
  }

  try {
    storage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(
      `[ALGOL] Save failed: ${name}`,
      error
    );

    throw new AlgolStoreError(
      "データを保存できませんでした。端末の空き容量を確認してください。",
      key,
      error
    );
  }
}

/* =========================================================
   08. UPDATE
   ========================================================= */

export function updateData(name, updater, fallback = undefined) {
  if (typeof updater !== "function") {
    throw new AlgolStoreError(
      "更新処理には関数を指定してください。"
    );
  }

  const current = loadData(name, fallback);
  const next = updater(cloneData(current));

  if (next === undefined) {
    throw new AlgolStoreError(
      "更新結果がundefinedになりました。",
      getKey(name)
    );
  }

  saveData(name, next);

  return next;
}

/* =========================================================
   09. REMOVE
   ========================================================= */

export function removeData(name) {
  const storage = getStorage();
  const key = getKey(name);

  storage.removeItem(key);

  return true;
}

/* =========================================================
   10. CHECK
   ========================================================= */

export function hasData(name) {
  const storage = getStorage();
  const key = getKey(name);

  return storage.getItem(key) !== null;
}

/* =========================================================
   11. STORAGE META
   ========================================================= */

function loadMeta() {
  const storage = getStorage();

  return parseJSON(
    storage.getItem(ALGOL_STORAGE_KEYS.meta),
    {
      version: ALGOL_STORE_VERSION,
      createdAt: null,
      updatedAt: null
    },
    ALGOL_STORAGE_KEYS.meta
  );
}

function saveMeta(meta) {
  const storage = getStorage();

  storage.setItem(
    ALGOL_STORAGE_KEYS.meta,
    JSON.stringify(meta)
  );
}

/* =========================================================
   12. INITIALIZATION
   ========================================================= */

export function initializeStore() {
  const storage = getStorage();
  const meta = loadMeta();

  /*
   * 既存データを確認する。
   * データが存在する場合は上書きしない。
   */

  for (const name of Object.keys(ALGOL_DEFAULTS)) {
    const key = ALGOL_STORAGE_KEYS[name];

    if (!key) {
      continue;
    }

    if (storage.getItem(key) === null) {
      storage.setItem(
        key,
        JSON.stringify(cloneData(ALGOL_DEFAULTS[name]))
      );
    }
  }

  const now = new Date().toISOString();

  saveMeta({
    ...meta,
    version: ALGOL_STORE_VERSION,
    createdAt: meta.createdAt || now,
    updatedAt: now
  });

  return true;
}

/* =========================================================
   13. BACKUP
   ========================================================= */

export function createBackup() {
  const storage = getStorage();

  const data = {};

  for (const [name, key] of Object.entries(ALGOL_STORAGE_KEYS)) {
    const raw = storage.getItem(key);

    if (raw === null) {
      continue;
    }

    data[name] = parseJSON(raw, null, key);
  }

  return {
    application: "ALGOL",
    format: "algol-backup",
    version: ALGOL_STORE_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
}

/* =========================================================
   14. BACKUP DOWNLOAD
   ========================================================= */

export function downloadBackup() {
  const backup = createBackup();

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    {
      type: "application/json"
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  const date = new Date()
    .toISOString()
    .slice(0, 10);

  link.href = url;
  link.download = `ALGOL-backup-${date}.json`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  return true;
}

/* =========================================================
   15. BACKUP VALIDATION
   ========================================================= */

export function validateBackup(backup) {
  if (!backup || typeof backup !== "object") {
    return false;
  }

  if (backup.application !== "ALGOL") {
    return false;
  }

  if (backup.format !== "algol-backup") {
    return false;
  }

  if (!backup.data || typeof backup.data !== "object") {
    return false;
  }

  return true;
}

/* =========================================================
   16. RESTORE
   ========================================================= */

export function restoreBackup(backup) {
  if (!validateBackup(backup)) {
    throw new AlgolStoreError(
      "ALGOLのバックアップ形式ではありません。"
    );
  }

  const storage = getStorage();

  /*
   * 復元前に現在のデータを退避する。
   * 復元中に失敗した場合に元へ戻せるようにする。
   */

  const previous = {};

  for (const [name, key] of Object.entries(ALGOL_STORAGE_KEYS)) {
    previous[name] = storage.getItem(key);
  }

  try {
    for (const [name, key] of Object.entries(ALGOL_STORAGE_KEYS)) {
      if (
        name === "meta" ||
        !Object.prototype.hasOwnProperty.call(
          backup.data,
          name
        )
      ) {
        continue;
      }

      const serialized = JSON.stringify(
        backup.data[name]
      );

      if (serialized === undefined) {
        throw new Error(
          `Invalid backup data: ${name}`
        );
      }

      storage.setItem(key, serialized);
    }

    const meta = loadMeta();

    saveMeta({
      ...meta,
      version: ALGOL_STORE_VERSION,
      updatedAt: new Date().toISOString()
    });

    return true;
  } catch (error) {
    /*
     * 復元失敗時は復元前の状態へ戻す。
     */

    for (const [name, key] of Object.entries(ALGOL_STORAGE_KEYS)) {
      const oldValue = previous[name];

      if (oldValue === null || oldValue === undefined) {
        storage.removeItem(key);
      } else {
        storage.setItem(key, oldValue);
      }
    }

    throw new AlgolStoreError(
      "バックアップの復元に失敗しました。元のデータに戻しました。",
      null,
      error
    );
  }
}

/* =========================================================
   17. BACKUP FILE READER
   ========================================================= */

export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File)) {
      reject(
        new AlgolStoreError(
          "バックアップファイルを選択してください。"
        )
      );

      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);

        if (!validateBackup(backup)) {
          throw new Error(
            "バックアップ形式が正しくありません。"
          );
        }

        resolve(backup);
      } catch (error) {
        reject(
          new AlgolStoreError(
            "バックアップファイルを読み込めませんでした。",
            null,
            error
          )
        );
      }
    };

    reader.onerror = () => {
      reject(
        new AlgolStoreError(
          "ファイルの読み込みに失敗しました。"
        )
      );
    };

    reader.readAsText(file);
  });
}

/* =========================================================
   18. STORAGE INFORMATION
   ========================================================= */

export function getStorageInfo() {
  const storage = getStorage();

  const result = {};

  for (const [name, key] of Object.entries(ALGOL_STORAGE_KEYS)) {
    const raw = storage.getItem(key);

    result[name] = {
      exists: raw !== null,
      characters: raw ? raw.length : 0
    };
  }

  return result;
}

/* =========================================================
   19. EXPORT DEFAULT
   ========================================================= */

export default {
  version: ALGOL_STORE_VERSION,
  keys: ALGOL_STORAGE_KEYS,
  defaults: ALGOL_DEFAULTS,

  initializeStore,

  loadData,
  saveData,
  updateData,
  removeData,
  hasData,

  createBackup,
  downloadBackup,
  validateBackup,
  restoreBackup,
  readBackupFile,

  getStorageInfo
};

/* =========================================================
   END OF ALGOL STORE
   ========================================================= */