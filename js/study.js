
"use strict";

/*
 * ONE FOR ALL — COSMOS
 * js/study.js
 *
 * 学習データ管理システム
 *
 * 担当:
 * - 科目の管理
 * - 学習項目の管理
 * - 学習記録の管理
 * - 学習時間の集計
 *
 * 保存先: localStorage
 */

import {
  STORAGE_KEYS,
  loadObject,
  saveData,
  createId,
  getTodayKey
} from "./storage.js";

const STUDY_KEY = STORAGE_KEYS.study;

/**
 * 学習データの初期構造を作成します。
 */
function createEmptyStudyData() {
  return {
    subjects: [],
    items: [],
    records: []
  };
}

/**
 * 保存された学習データを読み込みます。
 */
export function loadStudyData() {
  const data = loadObject(STUDY_KEY, createEmptyStudyData());

  return {
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    items: Array.isArray(data.items) ? data.items : [],
    records: Array.isArray(data.records) ? data.records : []
  };
}

/**
 * 学習データを保存します。
 */
export function saveStudyData(data) {
  if (!data || typeof data !== "object") {
    return false;
  }

  if (
    !Array.isArray(data.subjects) ||
    !Array.isArray(data.items) ||
    !Array.isArray(data.records)
  ) {
    console.error("[COSMOS] 学習データの形式が正しくありません。");
    return false;
  }

  return saveData(STUDY_KEY, data);
}

/**
 * 新しい科目を作成します。
 */
export function createSubject(name) {
  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    return {
      success: false,
      error: "科目名を入力してください。"
    };
  }

  const data = loadStudyData();

  const duplicate = data.subjects.some(
    subject => subject.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (duplicate) {
    return {
      success: false,
      error: "同じ名前の科目がすでにあります。"
    };
  }

  const subject = {
    id: createId(),
    name: normalizedName,
    createdAt: new Date().toISOString()
  };

  data.subjects.push(subject);

  if (!saveStudyData(data)) {
    return {
      success: false,
      error: "科目を保存できませんでした。"
    };
  }

  return {
    success: true,
    subject
  };
}

/**
 * 科目を削除します。
 * 学習記録は履歴として残し、関連する学習項目を削除します。
 */
export function deleteSubject(subjectId) {
  const data = loadStudyData();

  const subject = data.subjects.find(
    item => item.id === subjectId
  );

  if (!subject) {
    return {
      success: false,
      error: "科目が見つかりません。"
    };
  }

  const removedItemIds = new Set(
    data.items
      .filter(item => item.subjectId === subjectId)
      .map(item => item.id)
  );

  data.subjects = data.subjects.filter(
    item => item.id !== subjectId
  );

  data.items = data.items.filter(
    item => item.subjectId !== subjectId
  );

  // 過去の記録は削除しません。
  // 科目や項目が存在しなくなっても、学習時間の履歴を保護します。

  if (!saveStudyData(data)) {
    return {
      success: false,
      error: "科目を削除できませんでした。"
    };
  }

  return {
    success: true,
    subject,
    removedItemIds: [...removedItemIds]
  };
}

/**
 * 学習項目を追加します。
 */
export function createStudyItem(subjectId, name) {
  const normalizedName = String(name ?? "").trim();

  if (!normalizedName) {
    return {
      success: false,
      error: "学習項目名を入力してください。"
    };
  }

  const data = loadStudyData();

  const subjectExists = data.subjects.some(
    subject => subject.id === subjectId
  );

  if (!subjectExists) {
    return {
      success: false,
      error: "登録済みの科目を選択してください。"
    };
  }

  const duplicate = data.items.some(
    item =>
      item.subjectId === subjectId &&
      item.name.toLowerCase() === normalizedName.toLowerCase()
  );

  if (duplicate) {
    return {
      success: false,
      error: "同じ名前の学習項目がすでにあります。"
    };
  }

  const item = {
    id: createId(),
    subjectId,
    name: normalizedName,
    createdAt: new Date().toISOString()
  };

  data.items.push(item);

  if (!saveStudyData(data)) {
    return {
      success: false,
      error: "学習項目を保存できませんでした。"
    };
  }

  return {
    success: true,
    item
  };
}

/**
 * 学習項目を削除します。
 * 過去の学習記録は残します。
 */
export function deleteStudyItem(itemId) {
  const data = loadStudyData();

  const item = data.items.find(
    entry => entry.id === itemId
  );

  if (!item) {
    return {
      success: false,
      error: "学習項目が見つかりません。"
    };
  }

  data.items = data.items.filter(
    entry => entry.id !== itemId
  );

  if (!saveStudyData(data)) {
    return {
      success: false,
      error: "学習項目を削除できませんでした。"
    };
  }

  return {
    success: true,
    item
  };
}

/**
 * 学習記録を追加します。
 *
 * seconds: 学習時間（秒）
 * date: YYYY-MM-DD
 * source: timer / manual など
 */
export function addStudyRecord({
  subjectId,
  itemId = null,
  seconds,
  date = getTodayKey(),
  notes = "",
  source = "manual"
}) {
  const duration = Math.floor(Number(seconds) || 0);

  if (!Number.isFinite(duration) || duration <= 0) {
    return {
      success: false,
      error: "1秒以上の学習時間を指定してください。"
    };
  }

  const data = loadStudyData();

  if (!data.subjects.some(subject => subject.id === subjectId)) {
    return {
      success: false,
      error: "登録済みの科目を選択してください。"
    };
  }

  if (
    itemId &&
    !data.items.some(
      item => item.id === itemId && item.subjectId === subjectId
    )
  ) {
    return {
      success: false,
      error: "選択した学習項目が科目と一致しません。"
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return {
      success: false,
      error: "日付は YYYY-MM-DD 形式で指定してください。"
    };
  }

  const record = {
    id: createId(),
    subjectId,
    itemId,
    seconds: duration,
    date,
    notes: String(notes ?? "").trim(),
    createdAt: new Date().toISOString(),
    source: String(source || "manual")
  };

  data.records.push(record);

  if (!saveStudyData(data)) {
    return {
      success: false,
      error: "学習記録を保存できませんでした。"
    };
  }

  return {
    success: true,
    record
  };
}

/**
 * 学習時間を合計します。
 */
export function sumStudySeconds(records = []) {
  if (!Array.isArray(records)) {
    return 0;
  }

  return records.reduce((total, record) => {
    return total + Math.max(0, Number(record.seconds) || 0);
  }, 0);
}

/**
 * 科目別の学習時間を返します。
 */
export function getSubjectStudySeconds(subjectId) {
  const data = loadStudyData();

  return sumStudySeconds(
    data.records.filter(record => record.subjectId === subjectId)
  );
}

/**
 * 学習項目別の学習時間を返します。
 */
export function getItemStudySeconds(itemId) {
  const data = loadStudyData();

  return sumStudySeconds(
    data.records.filter(record => record.itemId === itemId)
  );
}

/**
 * 指定日の学習時間を返します。
 */
export function getDailyStudySeconds(date = getTodayKey()) {
  const data = loadStudyData();

  return sumStudySeconds(
    data.records.filter(record => record.date === date)
  );
}

/**
 * 全期間の学習時間を返します。
 */
export function getTotalStudySeconds() {
  const data = loadStudyData();

  return sumStudySeconds(data.records);
}

/**
 * 学習データ全体の概要を返します。
 */
export function getStudySummary() {
  const data = loadStudyData();

  return {
    subjectCount: data.subjects.length,
    itemCount: data.items.length,
    recordCount: data.records.length,
    todaySeconds: sumStudySeconds(
      data.records.filter(record => record.date === getTodayKey())
    ),
    totalSeconds: sumStudySeconds(data.records)
  };
}
