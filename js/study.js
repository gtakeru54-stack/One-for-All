/* =========================================================
   ONE FOR ALL — COSMOS
   js/study.js
   科目・学習項目・学習記録
   ========================================================= */

"use strict";

import {
  STORAGE_KEYS,
  loadData,
  saveData,
  createId,
  getTodayKey,
  toNonNegativeInteger,
  formatDuration,
  escapeHTML
} from "./storage.js";

let studyData = {
  subjects: [],
  items: [],
  records: []
};

function normalizeStudyData(data) {
  if (Array.isArray(data)) {
    return { subjects: [], items: [], records: data };
  }

  return {
    subjects: Array.isArray(data?.subjects) ? data.subjects : [],
    items: Array.isArray(data?.items) ? data.items : [],
    records: Array.isArray(data?.records) ? data.records : []
  };
}

function saveStudy() {
  saveData(STORAGE_KEYS.study, studyData);
  renderStudy();
  window.dispatchEvent(new Event("cosmos:datachange"));
}

function subjectName(id) {
  return studyData.subjects.find((subject) => subject.id === id)?.name
    || "科目未設定";
}

function itemName(id) {
  return studyData.items.find((item) => item.id === id)?.name
    || "学習項目未設定";
}

function totalSeconds(records) {
  return records.reduce(
    (sum, record) => sum + toNonNegativeInteger(record.seconds),
    0
  );
}

function renderSubjects() {
  const container = document.querySelector("#subject-list");
  if (!container) return;

  container.replaceChildren();

  if (!studyData.subjects.length) {
    container.innerHTML = '<p class="empty-state">科目を追加してください</p>';
  }

  studyData.subjects.forEach((subject) => {
    const subjectItems = studyData.items.filter(
      (item) => item.subjectId === subject.id
    );

    const records = studyData.records.filter(
      (record) => record.subjectId === subject.id
    );

    const card = document.createElement("article");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="subject-card-main">
        <strong>${escapeHTML(subject.name)}</strong>
        <span>${subjectItems.length}項目</span>
        <p>${formatDuration(totalSeconds(records))}</p>
      </div>
      <button type="button" data-delete-subject="${escapeHTML(subject.id)}"
        class="delete-button">削除</button>
    `;

    container.appendChild(card);
  });
}

function renderStudyItems() {
  const container = document.querySelector("#item-list");
  if (!container) return;

  container.replaceChildren();

  if (!studyData.items.length) {
    container.innerHTML = '<p class="empty-state">学習項目を追加してください</p>';
  }

  studyData.items.forEach((item) => {
    const records = studyData.records.filter(
      (record) => record.itemId === item.id
    );

    const card = document.createElement("article");
    card.className = "study-item-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHTML(item.name)}</strong>
        <p>${escapeHTML(subjectName(item.subjectId))}</p>
        <span>累計：${formatDuration(totalSeconds(records))}</span>
      </div>
      <button type="button" data-start-item="${escapeHTML(item.id)}"
        class="primary-button">この項目を学習</button>
      <button type="button" data-delete-item="${escapeHTML(item.id)}"
        class="delete-button">削除</button>
    `;

    container.appendChild(card);
  });
}

function renderStudySelects() {
  document.querySelectorAll(
    "#item-subject, #record-subject, #timer-subject"
  ).forEach((select) => {
    const previousValue = select.value;
    select.replaceChildren();

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "科目を選択";
    select.appendChild(empty);

    studyData.subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      select.appendChild(option);
    });

    if (studyData.subjects.some((subject) => subject.id === previousValue)) {
      select.value = previousValue;
    }
  });

  document.querySelectorAll("#record-item, #timer-item").forEach((select) => {
    const previousValue = select.value;
    select.replaceChildren();

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "学習項目を選択";
    select.appendChild(empty);

    studyData.items.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${subjectName(item.subjectId)} / ${item.name}`;
      select.appendChild(option);
    });

    if (studyData.items.some((item) => item.id === previousValue)) {
      select.value = previousValue;
    }
  });
}

function renderRecentRecords() {
  const container = document.querySelector("#study-record-list");
  if (!container) return;

  container.replaceChildren();

  const records = [...studyData.records]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 30);

  if (!records.length) {
    container.innerHTML = '<p class="empty-state">学習記録はまだありません</p>';
    return;
  }

  records.forEach((record) => {
    const row = document.createElement("article");
    row.className = "study-record-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHTML(itemName(record.itemId))}</strong>
        <p>${escapeHTML(subjectName(record.subjectId))} ・ ${escapeHTML(record.date || "")}</p>
      </div>
      <strong>${formatDuration(toNonNegativeInteger(record.seconds))}</strong>
      <button type="button" class="delete-button"
        data-delete-record="${escapeHTML(record.id)}">削除</button>
    `;
    container.appendChild(row);
  });
}

function renderStudy() {
  renderSubjects();
  renderStudyItems();
  renderStudySelects();
  renderRecentRecords();
}

function bindStudyForms() {
  const subjectForm = document.querySelector("#subject-form");

  subjectForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const input =
      form.querySelector('[name="name"]') ||
      document.querySelector("#subject-name");

    const name = input?.value?.trim();
    if (!name) return;

    studyData.subjects.push({
      id: createId("subject"),
      name,
      createdAt: new Date().toISOString()
    });

    form.reset();
    saveStudy();
    form.closest("dialog")?.close();
  });

  const itemForm = document.querySelector("#item-form");

  itemForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const name =
      form.querySelector('[name="name"]')?.value?.trim() ||
      document.querySelector("#item-name")?.value?.trim();

    const subjectId =
      form.querySelector('[name="subjectId"]')?.value ||
      document.querySelector("#item-subject")?.value;

    if (!name || !subjectId) return;

    studyData.items.push({
      id: createId("item"),
      name,
      subjectId,
      createdAt: new Date().toISOString()
    });

    form.reset();
    saveStudy();
    form.closest("dialog")?.close();
  });

  const recordForm =
    document.querySelector("#manual-record-form") ||
    document.querySelector("#record-form");

  recordForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const subjectId =
      form.querySelector('[name="subjectId"]')?.value ||
      document.querySelector("#record-subject")?.value;

    const itemId =
      form.querySelector('[name="itemId"]')?.value ||
      document.querySelector("#record-item")?.value;

    const minutes = Number(
      form.querySelector('[name="minutes"]')?.value ||
      document.querySelector("#record-minutes")?.value ||
      0
    );

    const date =
      form.querySelector('[name="date"]')?.value ||
      document.querySelector("#record-date")?.value ||
      getTodayKey();

    if (!subjectId || !itemId || !Number.isFinite(minutes) || minutes <= 0) {
      return;
    }

    studyData.records.push({
      id: createId("record"),
      subjectId,
      itemId,
      seconds: Math.round(minutes * 60),
      date,
      createdAt: new Date().toISOString(),
      source: "manual"
    });

    form.reset();
    saveStudy();
    form.closest("dialog")?.close();
  });

  document.addEventListener("click", (event) => {
    const subjectButton = event.target.closest("[data-delete-subject]");

    if (subjectButton) {
      const id = subjectButton.dataset.deleteSubject;
      const subjectItems = studyData.items.filter((item) => item.subjectId === id);
      const itemIds = subjectItems.map((item) => item.id);

      studyData.subjects = studyData.subjects.filter((item) => item.id !== id);
      studyData.items = studyData.items.filter((item) => item.subjectId !== id);
      studyData.records = studyData.records.filter(
        (record) => record.subjectId !== id && !itemIds.includes(record.itemId)
      );

      saveStudy();
      return;
    }

    const itemButton = event.target.closest("[data-delete-item]");

    if (itemButton) {
      const id = itemButton.dataset.deleteItem;
      studyData.items = studyData.items.filter((item) => item.id !== id);
      studyData.records = studyData.records.filter((record) => record.itemId !== id);
      saveStudy();
      return;
    }

    const recordButton = event.target.closest("[data-delete-record]");

    if (recordButton) {
      const id = recordButton.dataset.deleteRecord;
      studyData.records = studyData.records.filter((record) => record.id !== id);
      saveStudy();
      return;
    }

    const startButton = event.target.closest("[data-start-item]");

    if (startButton) {
      const item = studyData.items.find(
        (entry) => entry.id === startButton.dataset.startItem
      );

      if (item) {
        const subjectSelect = document.querySelector("#timer-subject");
        const itemSelect = document.querySelector("#timer-item");

        if (subjectSelect) subjectSelect.value = item.subjectId;
        if (itemSelect) itemSelect.value = item.id;

        window.dispatchEvent(
          new CustomEvent("cosmos:starttimer", { detail: item })
        );
      }
    }
  });
}

export function getStudyData() {
  return studyData;
}

export function addStudyRecord(record) {
  const seconds = toNonNegativeInteger(record.seconds);

  if (seconds <= 0) return;

  studyData.records.push({
    id: createId("record"),
    subjectId: record.subjectId || "",
    itemId: record.itemId || "",
    seconds,
    date: record.date || getTodayKey(),
    createdAt: new Date().toISOString(),
    source: record.source || "timer"
  });

  saveStudy();
}

export function initStudy() {
  studyData = normalizeStudyData(
    loadData(STORAGE_KEYS.study, {
      subjects: [],
      items: [],
      records: []
    })
  );

  bindStudyForms();
  renderStudy();

  window.addEventListener("cosmos:viewchange", (event) => {
    if (event.detail?.view === "study") renderStudy();
  });

  window.addEventListener("cosmos:datachange", renderStudy);
}