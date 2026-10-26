/* =========================================================
ONE FOR ALL — COSMOS
js/study.js
科目・学習項目・学習記録
========================================================= */

“use strict”;

import {
STORAGE_KEYS,
loadData,
saveData,
createId,
getTodayKey,
toNonNegativeInteger,
formatDuration,
escapeHTML
} from “./storage.js”;

let studyData = {
subjects: [],
items: [],
records: []
};

let selectedSubjectId = “”;

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
window.dispatchEvent(new Event(“cosmos:datachange”));
}

function subjectName(id) {
return studyData.subjects.find((subject) => subject.id === id)?.name
|| “科目未設定”;
}

function itemName(id) {
return studyData.items.find((item) => item.id === id)?.name
|| “学習項目未設定”;
}

function totalSeconds(records) {
return records.reduce(
(sum, record) => sum + toNonNegativeInteger(record.seconds),
0
);
}

function openDialog(id) {
const dialog = document.getElementById(id);
if (!dialog) {
console.error(ダイアログが見つかりません: ${id});
return;
}

if (dialog instanceof HTMLDialogElement) {
if (!dialog.open) dialog.showModal();
} else {
dialog.hidden = false;
}
}

function closeDialog(element) {
const dialog = element?.closest(“dialog”);
if (dialog?.open) dialog.close();
}

function renderSubjects() {
const container = document.querySelector(”#subject-list”);
if (!container) return;

container.replaceChildren();

if (!studyData.subjects.length) {
container.innerHTML = ‘科目を追加してください’;
return;
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
  <button type="button" data-open-subject="${escapeHTML(subject.id)}"
    class="secondary-button">詳細</button>
  <button type="button" data-delete-subject="${escapeHTML(subject.id)}"
    class="delete-button">削除</button>
`;
container.appendChild(card);

});
}

function renderStudyItems() {
const container = document.querySelector(”#item-list”);
if (!container) return;

container.replaceChildren();

const items = selectedSubjectId
? studyData.items.filter((item) => item.subjectId === selectedSubjectId)
: studyData.items;

if (!items.length) {
container.innerHTML = ‘学習項目を追加してください’;
return;
}

items.forEach((item) => {
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

function populateSelect(select, options, placeholder, selectedValue = “”) {
if (!select) return;

select.replaceChildren();

const empty = document.createElement(“option”);
empty.value = “”;
empty.textContent = placeholder;
select.appendChild(empty);

options.forEach((entry) => {
const option = document.createElement(“option”);
option.value = entry.value;
option.textContent = entry.label;
select.appendChild(option);
});

if (options.some((entry) => entry.value === selectedValue)) {
select.value = selectedValue;
}
}

function renderStudySelects() {
const subjectOptions = studyData.subjects.map((subject) => ({
value: subject.id,
label: subject.name
}));

[
“#item-subject”,
“#record-subject”,
“#timer-subject”,
“#manual-subject”
].forEach((selector) => {
const select = document.querySelector(selector);
if (!select) return;

const previousValue = select.value;
populateSelect(
  select,
  subjectOptions,
  "科目を選択",
  previousValue
);

});

[
“#record-item”,
“#timer-item”,
“#manual-item”
].forEach((selector) => {
const select = document.querySelector(selector);
if (!select) return;

const previousValue = select.value;
const subjectSelect = document.querySelector(
  selector === "#manual-item" ? "#manual-subject" :
  selector === "#timer-item" ? "#timer-subject" : "#record-subject"
);
const subjectId = subjectSelect?.value || "";
const items = studyData.items.filter(
  (item) => !subjectId || item.subjectId === subjectId
);
populateSelect(
  select,
  items.map((item) => ({
    value: item.id,
    label: `${subjectName(item.subjectId)} / ${item.name}`
  })),
  "学習項目を選択",
  previousValue
);

});

const itemSubject = document.querySelector(”#item-subject”);
if (itemSubject && selectedSubjectId) {
itemSubject.value = selectedSubjectId;
}
}

function renderRecentRecords() {
const container = document.querySelector(”#study-record-list”);
if (!container) return;

container.replaceChildren();

const records = […studyData.records]
.sort((a, b) =>
String(b.createdAt || “”).localeCompare(String(a.createdAt || “”))
)
.slice(0, 30);

if (!records.length) {
container.innerHTML = ‘学習記録はまだありません’;
return;
}

records.forEach((record) => {
const row = document.createElement(“article”);
row.className = “study-record-row”;
row.innerHTML = <div> <strong>${escapeHTML(itemName(record.itemId))}</strong> <p>${escapeHTML(subjectName(record.subjectId))} ・ ${escapeHTML(record.date || "")}</p> </div> <strong>${formatDuration(toNonNegativeInteger(record.seconds))}</strong> <button type="button" class="delete-button" data-delete-record="${escapeHTML(record.id)}">削除</button>;
container.appendChild(row);
});
}

function renderStudy() {
renderSubjects();
renderStudyItems();
renderStudySelects();
renderRecentRecords();
}

function showSubjectDetail(subjectId) {
const subject = studyData.subjects.find(
(entry) => entry.id === subjectId
);
if (!subject) return;

selectedSubjectId = subject.id;

const detail = document.querySelector(”#subject-detail”);
const title = document.querySelector(”#detail-title”);

if (title) title.textContent = subject.name;
if (detail) detail.hidden = false;

renderStudyItems();
renderStudySelects();

document.querySelector(”#subject-detail”)?.scrollIntoView({
behavior: “smooth”,
block: “start”
});
}

function bindStudyForms() {
document.querySelector(”#add-subject”)?.addEventListener(“click”, () => {
const form = document.querySelector(”#subject-form”);
form?.reset();
openDialog(“subject-dialog”);
});

document.querySelector(”#add-item”)?.addEventListener(“click”, () => {
if (!selectedSubjectId && studyData.subjects.length === 1) {
selectedSubjectId = studyData.subjects[0].id;
}

if (!selectedSubjectId) {
  alert("先に科目の「詳細」を開いてください。");
  return;
}
const form = document.querySelector("#item-form");
form?.reset();
const subjectSelect = document.querySelector("#item-subject");
if (subjectSelect) {
  subjectSelect.value = selectedSubjectId;
}
openDialog("item-dialog");

});

document.querySelector(”#close-subject”)?.addEventListener(“click”, () => {
const detail = document.querySelector(”#subject-detail”);
if (detail) detail.hidden = true;

selectedSubjectId = "";
renderStudyItems();

});

const subjectForm = document.querySelector(”#subject-form”);
subjectForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const input = document.querySelector("#subject-name");
const name = input?.value.trim();
if (!name) {
  input?.focus();
  return;
}
studyData.subjects.push({
  id: createId("subject"),
  name,
  createdAt: new Date().toISOString()
});
closeDialog(subjectForm);
subjectForm.reset();
saveStudy();

});

const itemForm = document.querySelector(”#item-form”);
itemForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const name = document.querySelector("#item-name")?.value.trim();
const subjectId =
  document.querySelector("#item-subject")?.value || selectedSubjectId;
if (!name || !subjectId) {
  alert("項目名と科目を選択してください。");
  return;
}
studyData.items.push({
  id: createId("item"),
  name,
  subjectId,
  createdAt: new Date().toISOString()
});
closeDialog(itemForm);
itemForm.reset();
saveStudy();

});

const manualForm = document.querySelector(”#manual-record-form”);
manualForm?.addEventListener(“submit”, (event) => {
event.preventDefault();

const subjectId = document.querySelector("#manual-subject")?.value || "";
const itemId = document.querySelector("#manual-item")?.value || "";
const hours = Number(document.querySelector("#manual-hours")?.value || 0);
const minutes = Number(document.querySelector("#manual-minutes")?.value || 0);
const seconds = Math.round((hours * 60 + minutes) * 60);
const date =
  document.querySelector("#manual-date")?.value || getTodayKey();
if (!subjectId || !Number.isFinite(seconds) || seconds <= 0) {
  alert("科目を選び、1分以上の学習時間を入力してください。");
  return;
}
if (itemId) {
  const item = studyData.items.find((entry) => entry.id === itemId);
  if (item && item.subjectId !== subjectId) {
    alert("選択した科目と学習項目が一致していません。");
    return;
  }
}
studyData.records.push({
  id: createId("record"),
  subjectId,
  itemId,
  seconds,
  date,
  notes: document.querySelector("#manual-notes")?.value.trim() || "",
  createdAt: new Date().toISOString(),
  source: "manual"
});
manualForm.reset();
const dateInput = document.querySelector("#manual-date");
if (dateInput) dateInput.value = getTodayKey();
const hoursInput = document.querySelector("#manual-hours");
const minutesInput = document.querySelector("#manual-minutes");
if (hoursInput) hoursInput.value = "0";
if (minutesInput) minutesInput.value = "30";
saveStudy();
alert("学習時間を保存しました。");

});

document.addEventListener(“change”, (event) => {
if (
event.target.matches(”#manual-subject, #timer-subject, #record-subject”)
) {
renderStudySelects();
}
});

document.addEventListener(“click”, (event) => {
const target = event.target;
if (!(target instanceof Element)) return;

const subjectOpen = target.closest("[data-open-subject]");
if (subjectOpen) {
  showSubjectDetail(subjectOpen.dataset.openSubject);
  return;
}
const subjectDelete = target.closest("[data-delete-subject]");
if (subjectDelete) {
  const id = subjectDelete.dataset.deleteSubject;
  const itemIds = studyData.items
    .filter((item) => item.subjectId === id)
    .map((item) => item.id);
  studyData.subjects = studyData.subjects.filter(
    (subject) => subject.id !== id
  );
  studyData.items = studyData.items.filter(
    (item) => item.subjectId !== id
  );
  studyData.records = studyData.records.filter(
    (record) =>
      record.subjectId !== id && !itemIds.includes(record.itemId)
  );
  if (selectedSubjectId === id) {
    selectedSubjectId = "";
    const detail = document.querySelector("#subject-detail");
    if (detail) detail.hidden = true;
  }
  saveStudy();
  return;
}
const itemDelete = target.closest("[data-delete-item]");
if (itemDelete) {
  const id = itemDelete.dataset.deleteItem;
  studyData.items = studyData.items.filter((item) => item.id !== id);
  studyData.records = studyData.records.filter(
    (record) => record.itemId !== id
  );
  saveStudy();
  return;
}
const recordDelete = target.closest("[data-delete-record]");
if (recordDelete) {
  const id = recordDelete.dataset.deleteRecord;
  studyData.records = studyData.records.filter(
    (record) => record.id !== id
  );
  saveStudy();
  return;
}
const startButton = target.closest("[data-start-item]");
if (startButton) {
  const item = studyData.items.find(
    (entry) => entry.id === startButton.dataset.startItem
  );
  if (!item) return;
  const subjectSelect = document.querySelector("#timer-subject");
  const itemSelect = document.querySelector("#timer-item");
  if (subjectSelect) subjectSelect.value = item.subjectId;
  if (itemSelect) itemSelect.value = item.id;
  const label = document.querySelector("#timer-label");
  if (label) label.textContent = `${item.name} の学習タイマー`;
  const timerPanel = document.querySelector("#timer-panel");
  if (timerPanel) timerPanel.hidden = false;
  window.dispatchEvent(
    new CustomEvent("cosmos:starttimer", { detail: item })
  );
  timerPanel?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
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
id: createId(“record”),
subjectId: record.subjectId || “”,
itemId: record.itemId || “”,
seconds,
date: record.date || getTodayKey(),
createdAt: new Date().toISOString(),
source: record.source || “timer”
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

const manualDate = document.querySelector(”#manual-date”);
if (manualDate && !manualDate.value) {
manualDate.value = getTodayKey();
}

renderStudy();

window.addEventListener(“cosmos:viewchange”, (event) => {
if (event.detail?.view === “study”) renderStudy();
});

window.addEventListener(“cosmos:datachange”, renderStudy);

console.info(“学習機能の初期化完了”);
}