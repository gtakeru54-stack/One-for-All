/* =========================================================
ONE FOR ALL — COSMOS
js/schedule.js
週間予定表・予定とタスクの色・祝日・学習実績
========================================================= */

“use strict”;

(() => {
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? “”).replace(/[&<>”’]/g, c => ({
“&”: “&”, “<”: “<”, “>”: “>”, ‘”’: “"”, “’”: “'”
}[c]));
const uid = () => crypto.randomUUID
? crypto.randomUUID()
: ${Date.now()}-${Math.random().toString(16).slice(2)};

const CAL_KEY = “personal-calendar-v1”;
const STUDY_KEY = “oneforall-study-v1”;
const PLAN_KEY = “oneforall-week-schedule-v1”;

const COLORS = [
“#8eafff”, “#c0a1ff”, “#69dfc4”,
“#f4c77b”, “#ff9dc5”, “#86d99b”,
“#ff827e”, “#67c9f5”, “#b5a1ff”
];

const read = (key, fallback) => {
try {
const value = localStorage.getItem(key);
return value ? JSON.parse(value) : fallback;
} catch {
return fallback;
}
};

const write = (key, value) => {
try {
localStorage.setItem(key, JSON.stringify(value));
return true;
} catch {
alert(“保存できませんでした。端末の空き容量を確認してください。”);
return false;
}
};

const dateKey = d =>
${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")};

const parseDate = key => {
const [y, m, d] = key.split(”-”).map(Number);
return new Date(y, m - 1, d);
};

const addDays = (date, amount) => {
const result = new Date(date);
result.setDate(result.getDate() + amount);
return result;
};

const minutes = time => {
if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
const [h, m] = time.split(”:”).map(Number);
return h * 60 + m;
};

const timeText = seconds => {
const mins = Math.floor(Math.max(0, seconds) / 60);
const hours = Math.floor(mins / 60);
return hours ? ${hours}時間${mins % 60}分 : ${mins}分;
};

let calendar = read(CAL_KEY, { events: [], tasks: [] });
if (!Array.isArray(calendar.events)) calendar.events = [];
if (!Array.isArray(calendar.tasks)) calendar.tasks = [];

let plans = read(PLAN_KEY, []);
if (!Array.isArray(plans)) plans = [];

let selectedWeek = new Date();
selectedWeek.setHours(0, 0, 0, 0);

let editingPlanId = null;

function saveCalendar() {
write(CAL_KEY, calendar);
}

function savePlans() {
write(PLAN_KEY, plans);
}

function getWeekStart(date) {
const d = new Date(date);
d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
d.setHours(0, 0, 0, 0);
return d;
}

function formatDate(date) {
return ${date.getMonth() + 1}/${date.getDate()};
}

function formatClock(date) {
return date.toLocaleTimeString(“ja-JP”, {
hour: “2-digit”,
minute: “2-digit”,
hour12: false
});
}

/* 日本の祝日計算 */

function vernalEquinox(year) {
return Math.floor(20.8431 + 0.242194 * (year - 1980)
- Math.floor((year - 1980) / 4));
}

function autumnalEquinox(year) {
return Math.floor(23.2488 + 0.242194 * (year - 1980)
- Math.floor((year - 1980) / 4));
}

function nthMonday(year, month, n) {
const first = new Date(year, month - 1, 1);
return 1 + ((8 - first.getDay()) % 7) + (n - 1) * 7;
}

function holidaySet(year) {
const map = new Map();

const put = (month, day, name) => {
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  map.set(key, name);
};
put(1, 1, "元日");
put(2, 11, "建国記念の日");
put(2, 23, "天皇誕生日");
put(4, 29, "昭和の日");
put(5, 3, "憲法記念日");
put(5, 4, "みどりの日");
put(5, 5, "こどもの日");
put(8, 11, "山の日");
put(11, 3, "文化の日");
put(11, 23, "勤労感謝の日");
put(1, nthMonday(year, 1, 2), "成人の日");
put(7, nthMonday(year, 7, 3), "海の日");
put(9, nthMonday(year, 9, 3), "敬老の日");
put(10, nthMonday(year, 10, 2), "スポーツの日");
put(3, vernalEquinox(year), "春分の日");
put(9, autumnalEquinox(year), "秋分の日");
// 振替休日：祝日が日曜日なら次の祝日でない日
const original = [...map.keys()].sort();
for (const key of original) {
  const d = parseDate(key);
  if (d.getDay() !== 0) continue;
  let substitute = addDays(d, 1);
  while (map.has(dateKey(substitute))) {
    substitute = addDays(substitute, 1);
  }
  map.set(dateKey(substitute), "振替休日");
}
// 国民の休日：祝日に挟まれた平日
for (let month = 1; month <= 12; month++) {
  const last = new Date(year, month, 0).getDate();
  for (let day = 2; day < last; day++) {
    const d = new Date(year, month - 1, day);
    const key = dateKey(d);
    if (map.has(key) || d.getDay() === 0 || d.getDay() === 6) continue;
    const before = dateKey(addDays(d, -1));
    const after = dateKey(addDays(d, 1));
    if (map.has(before) && map.has(after)) {
      map.set(key, "国民の休日");
    }
  }
}
return map;

}

function holidayName(date) {
return holidaySet(date.getFullYear()).get(dateKey(date)) || “”;
}

/* 追加画面 */

function installStyles() {
if ($(”#cosmos-schedule-style”)) return;

const style = document.createElement("style");
style.id = "cosmos-schedule-style";
style.textContent = `
  .cosmos-schedule-panel{margin:18px 0;padding:16px;border:1px solid rgba(142,175,255,.2);border-radius:18px;background:rgba(12,20,43,.8);color:#edf2ff}
  .cosmos-schedule-panel h2,.cosmos-schedule-panel h3{margin-top:0}
  .cosmos-schedule-actions{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
  .cosmos-schedule-actions button,.cosmos-plan-form button{border:1px solid rgba(142,175,255,.3);border-radius:10px;padding:10px 13px;background:#172344;color:#edf2ff}
  .cosmos-week-label{color:#aab8d8;font-size:12px}
  .cosmos-week-scroll{overflow-x:auto;overscroll-behavior-x:contain}
  .cosmos-week-grid{display:grid;grid-template-columns:58px repeat(7,minmax(105px,1fr));min-width:795px}
  .cosmos-week-cell{border-right:1px solid rgba(142,175,255,.12);border-bottom:1px solid rgba(142,175,255,.12);min-height:52px;padding:4px;box-sizing:border-box}
  .cosmos-week-head{position:sticky;top:0;z-index:2;background:#111a35;text-align:center;padding:9px 3px;border-bottom:1px solid rgba(142,175,255,.25)}
  .cosmos-hour{font-size:11px;color:#9eafd3;text-align:center;padding-top:7px}
  .cosmos-plan{display:block;width:100%;margin:2px 0;padding:6px 5px;text-align:left;border:0;border-left:3px solid var(--plan-color);border-radius:6px;background:color-mix(in srgb,var(--plan-color) 20%,#101a34);color:#fff;font-size:11px;overflow-wrap:anywhere}
  .cosmos-plan small{display:block;opacity:.85;margin-top:3px}
  .cosmos-plan-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .cosmos-plan-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#b9c7e5}
  .cosmos-plan-form input,.cosmos-plan-form select,.cosmos-plan-form textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid rgba(142,175,255,.3);border-radius:9px;padding:10px;background:#0c142b;color:#fff}
  .cosmos-plan-form .wide{grid-column:1/-1}
  .cosmos-plan-buttons{display:flex;gap:8px;flex-wrap:wrap;grid-column:1/-1}
  .cosmos-plan-buttons .save{background:#314e91}
  .cosmos-plan-buttons .delete{background:#632f4b}
  .cosmos-plan-note{font-size:12px;line-height:1.6;color:#aab8d8}
  .cosmos-actual{padding:10px;border-radius:10px;background:rgba(105,223,196,.08);margin-top:8px;font-size:12px}
  .cosmos-color-input{width:42px!important;height:38px;padding:3px!important}
  .cosmos-event-label{display:block;margin-top:5px;padding:5px 7px;border-left:3px solid var(--event-color);border-radius:5px;background:color-mix(in srgb,var(--event-color) 18%,transparent);font-size:10px;line-height:1.35;overflow-wrap:anywhere}
  .cosmos-calendar-holiday{color:#ff777f!important}
  .cosmos-calendar-saturday{color:#69c9ff!important}
  .cosmos-calendar-head{display:flex;justify-content:center;align-items:center;text-align:center}
  .cosmos-calendar-cell{min-width:0;box-sizing:border-box}
  .cosmos-schedule-panel .muted{color:#aab8d8}
  @media(max-width:520px){.cosmos-schedule-panel{padding:12px}.cosmos-plan-form{grid-template-columns:1fr}.cosmos-plan-form .wide,.cosmos-plan-buttons{grid-column:1}}
`;
document.head.append(style);

}

function installPlanner() {
const view = $(”#view-calendar”);
if (!view || $(”#cosmos-week-planner”)) return;

const panel = document.createElement("section");
panel.id = "cosmos-week-planner";
panel.className = "cosmos-schedule-panel";
panel.innerHTML = `
  <p class="cosmos-week-label">WEEKLY PLANNER</p>
  <h2>週間予定表</h2>
  <p class="cosmos-plan-note">月曜日から日曜日まで、朝6時〜翌日2時の予定を登録できます。予定はこの端末に保存されます。</p>
  <div class="cosmos-schedule-actions">
    <button type="button" id="cosmos-week-prev">‹ 前の週</button>
    <button type="button" id="cosmos-week-today">今週</button>
    <button type="button" id="cosmos-week-next">次の週 ›</button>
    <button type="button" id="cosmos-plan-add">＋ 予定を追加</button>
  </div>
  <h3 id="cosmos-week-title"></h3>
  <div class="cosmos-week-scroll"><div id="cosmos-week-grid" class="cosmos-week-grid"></div></div>
  <div class="cosmos-actual" id="cosmos-week-summary"></div>
  <p class="cosmos-plan-note">予定表に登録した内容はタスク一覧にも連携できます。学習時間の実績は、同じ科目・項目で記録した学習時間を使って比較します。</p>
  <div id="cosmos-plan-editor" hidden>
    <h3 id="cosmos-plan-editor-title">予定を追加</h3>
    <form id="cosmos-plan-form" class="cosmos-plan-form">
      <label class="wide">予定の名前<input id="cosmos-plan-title" maxlength="120" required></label>
      <label>日付<input id="cosmos-plan-date" type="date" required></label>
      <label>色<input id="cosmos-plan-color" class="cosmos-color-input" type="color" value="#8eafff"></label>
      <label>開始時刻<select id="cosmos-plan-start"></select></label>
      <label>終了時刻<select id="cosmos-plan-end"></select></label>
      <label class="wide">メモ<textarea id="cosmos-plan-notes" rows="2" maxlength="500"></textarea></label>
      <label class="wide"><span><input id="cosmos-plan-task" type="checkbox" checked> タスク一覧にも追加する</span></label>
      <label class="wide"><span><input id="cosmos-plan-study" type="checkbox"> 学習予定として実績を比較する</span></label>
      <label class="wide">比較する科目名（任意）<input id="cosmos-plan-subject" placeholder="例：数学"></label>
      <label class="wide">比較する学習項目名（任意）<input id="cosmos-plan-item" placeholder="例：二次関数"></label>
      <div class="cosmos-plan-buttons">
        <button class="save" type="submit">保存</button>
        <button id="cosmos-plan-cancel" type="button">キャンセル</button>
        <button id="cosmos-plan-delete" class="delete" type="button" hidden>削除</button>
      </div>
    </form>
  </div>`;
const calendarPanel = view.querySelector(".calendar-panel");
if (calendarPanel) calendarPanel.after(panel);
else view.prepend(panel);
const start = $("#cosmos-plan-start");
const end = $("#cosmos-plan-end");
for (let m = 6 * 60; m <= 26 * 60; m += 30) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  const label = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  const value = String(m);
  start.add(new Option(label, value));
  end.add(new Option(label, value));
}
start.value = "540";
end.value = "600";
$("#cosmos-week-prev").addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, -7);
  renderPlanner();
});
$("#cosmos-week-next").addEventListener("click", () => {
  selectedWeek = addDays(selectedWeek, 7);
  renderPlanner();
});
$("#cosmos-week-today").addEventListener("click", () => {
  selectedWeek = new Date();
  renderPlanner();
});
$("#cosmos-plan-add").addEventListener("click", () => openPlan());
$("#cosmos-plan-cancel").addEventListener("click", () => {
  $("#cosmos-plan-editor").hidden = true;
});
$("#cosmos-plan-form").addEventListener("submit", savePlan);
$("#cosmos-plan-delete").addEventListener("click", deletePlan);
renderPlanner();

}

function openPlan(plan = null, day = null) {
editingPlanId = plan?.id || null;
$(”#cosmos-plan-editor”).hidden = false;
$(”#cosmos-plan-editor-title”).textContent = plan ? “予定を編集” : “予定を追加”;
$(”#cosmos-plan-title”).value = plan?.title || “”;
$(”#cosmos-plan-date”).value = plan?.date || dateKey(day || new Date());
$(”#cosmos-plan-start”).value = String(plan?.startMinutes ?? 540);
$(”#cosmos-plan-end”).value = String(plan?.endMinutes ?? 600);
$(”#cosmos-plan-color”).value = plan?.color || COLORS[0];
$(”#cosmos-plan-notes”).value = plan?.notes || “”;
$(”#cosmos-plan-task”).checked = plan?.createTask !== false;
$(”#cosmos-plan-study”).checked = Boolean(plan?.study);
$(”#cosmos-plan-subject”).value = plan?.subject || “”;
$(”#cosmos-plan-item”).value = plan?.item || “”;
$(”#cosmos-plan-delete”).hidden = !plan;
$(”#cosmos-plan-editor”).scrollIntoView({ behavior: “smooth”, block: “nearest” });
}

function savePlan(event) {
event.preventDefault();

const title = $("#cosmos-plan-title").value.trim();
const date = $("#cosmos-plan-date").value;
const startMinutes = Number($("#cosmos-plan-start").value);
const endMinutes = Number($("#cosmos-plan-end").value);
if (!title || !date) return;
if (endMinutes <= startMinutes) {
  alert("終了時刻は開始時刻より後にしてください。");
  return;
}
const old = plans.find(p => p.id === editingPlanId);
const plan = {
  id: editingPlanId || uid(),
  title,
  date,
  startMinutes,
  endMinutes,
  color: $("#cosmos-plan-color").value || COLORS[0],
  notes: $("#cosmos-plan-notes").value.trim(),
  createTask: $("#cosmos-plan-task").checked,
  study: $("#cosmos-plan-study").checked,
  subject: $("#cosmos-plan-subject").value.trim(),
  item: $("#cosmos-plan-item").value.trim(),
  taskId: old?.taskId || null,
  createdAt: old?.createdAt || Date.now()
};
const index = plans.findIndex(p => p.id === plan.id);
if (index >= 0) plans[index] = plan;
else plans.push(plan);
// タスク一覧と連携。予定の編集時は連携先タスクも更新する。
if (plan.createTask) {
  let task = calendar.tasks.find(t => t.id === plan.taskId);
  if (!task) {
    task = {
      id: uid(),
      title: plan.title,
      date: plan.date,
      notes: plan.notes,
      completed: false,
      color: plan.color,
      planId: plan.id
    };
    calendar.tasks.push(task);
    plan.taskId = task.id;
  } else {
    task.title = plan.title;
    task.date = plan.date;
    task.notes = plan.notes;
    task.color = plan.color;
    task.planId = plan.id;
  }
} else if (plan.taskId) {
  calendar.tasks = calendar.tasks.filter(t => t.id !== plan.taskId);
  plan.taskId = null;
}
savePlans();
saveCalendar();
$("#cosmos-plan-editor").hidden = true;
renderPlanner();
window.dispatchEvent(new CustomEvent("cosmos-schedule-updated"));

}

function deletePlan() {
if (!editingPlanId) return;
if (!confirm(“この予定を削除しますか？”)) return;

const plan = plans.find(p => p.id === editingPlanId);
plans = plans.filter(p => p.id !== editingPlanId);
if (plan?.taskId) {
  calendar.tasks = calendar.tasks.filter(t => t.id !== plan.taskId);
  saveCalendar();
}
savePlans();
$("#cosmos-plan-editor").hidden = true;
renderPlanner();
window.dispatchEvent(new CustomEvent("cosmos-schedule-updated"));

}

function renderPlanner() {
const grid = $(”#cosmos-week-grid”);
if (!grid) return;

const monday = getWeekStart(selectedWeek);
const sunday = addDays(monday, 6);
$("#cosmos-week-title").textContent =
  `${formatDate(monday)} 〜 ${formatDate(sunday)}`;
grid.replaceChildren();
const blank = document.createElement("div");
blank.className = "cosmos-week-head";
blank.textContent = "時刻";
grid.append(blank);
const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
days.forEach(day => {
  const head = document.createElement("div");
  head.className = "cosmos-week-head";
  head.innerHTML = `<b>${["月", "火", "水", "木", "金", "土", "日"][day.getDay() === 0 ? 6 : day.getDay() - 1]}</b><br>${formatDate(day)}`;
  if (day.getDay() === 0 || holidayName(day)) head.style.color = "#ff777f";
  if (day.getDay() === 6) head.style.color = "#69c9ff";
  grid.append(head);
});
// 06:00〜翌日02:00。30分単位で表示。
for (let time = 360; time < 1560; time += 30) {
  const hour = Math.floor(time / 60);
  const minute = time % 60;
  const clock = `${String(hour % 24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const label = document.createElement("div");
  label.className = "cosmos-week-cell cosmos-hour";
  label.textContent = minute === 0 ? clock : "·";
  grid.append(label);
  days.forEach(day => {
    const cell = document.createElement("div");
    cell.className = "cosmos-week-cell";
    cell.dataset.date = dateKey(day);
    cell.dataset.minute = String(time);
    const dayPlans = plans.filter(p => {
      if (p.date !== dateKey(day)) return false;
      return time >= p.startMinutes && time < p.endMinutes;
    });
    dayPlans.forEach(plan => {
      // 予定の開始時刻のセルにのみボタンを置く
      if (time !== plan.startMinutes) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cosmos-plan";
      button.style.setProperty("--plan-color", plan.color || COLORS[0]);
      button.innerHTML = `${esc(plan.title)}<small>${esc(clockText(plan.startMinutes))}–${esc(clockText(plan.endMinutes))}</small>`;
      button.addEventListener("click", () => openPlan(plan));
      cell.append(button);
    });
    cell.addEventListener("click", event => {
      if (event.target.closest("button")) return;
      openPlan(null, day);
      $("#cosmos-plan-start").value = String(time);
      $("#cosmos-plan-end").value = String(Math.min(1560, time + 60));
    });
    grid.append(cell);
  });
}
renderPlanSummary(monday, sunday);

}

function clockText(totalMinutes) {
const h = Math.floor(totalMinutes / 60) % 24;
const m = totalMinutes % 60;
return ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")};
}

function renderPlanSummary(start, end) {
const plansInWeek = plans.filter(p => {
const d = parseDate(p.date);
return d >= start && d <= end;
});

const planned = plansInWeek.reduce((sum, p) => sum + p.endMinutes - p.startMinutes, 0);
const study = read(STUDY_KEY, {});
const records = Array.isArray(study.records) ? study.records : [];
const comparisons = plansInWeek.filter(p => p.study);
const actual = comparisons.reduce((sum, plan) => {
  return sum + records.reduce((total, r) => {
    const subject = r.subject || r.category || "";
    const item = r.item || r.title || "";
    const seconds = Number(r.durationSeconds ?? (Number(r.minutes) || 0) * 60) || 0;
    const subjectMatch = !plan.subject || subject === plan.subject;
    const itemMatch = !plan.item || item === plan.item;
    return total + (subjectMatch && itemMatch && r.date === plan.date ? seconds / 60 : 0);
  }, 0);
}, 0);
const difference = actual - comparisons.reduce(
  (sum, p) => sum + p.endMinutes - p.startMinutes, 0
);
$("#cosmos-week-summary").innerHTML =
  `<b>今週の予定時間：</b>${Math.floor(planned / 60)}時間${planned % 60}分<br>` +
  `<b>学習予定の実績：</b>${timeText(actual * 60)}<br>` +
  `<b>実績 − 予定：</b>${comparisons.length ? (difference >= 0 ? "+" : "−") + timeText(Math.abs(difference) * 60) : "比較対象の学習予定はありません"}<br>` +
  `<span class="cosmos-plan-note">実績は同じ日付・指定した科目名／項目名の学習記録から集計します。科目・項目名を空欄にすると、指定条件が広くなります。</span>`;

}

/* カレンダーの曜日色と予定名を補助 */

function decorateCalendar() {
const grid = $(”#calendar-grid”);
if (!grid) return;

const children = [...grid.children];
const headings = children.slice(0, 7);
headings.forEach((heading, index) => {
  heading.classList.add("cosmos-calendar-head");
  heading.style.textAlign = "center";
  heading.style.justifyContent = "center";
  heading.style.padding = "8px 0";
  heading.style.boxSizing = "border-box";
  if (index === 0) heading.style.color = "#ff777f";
  if (index === 6) heading.style.color = "#69c9ff";
});
const cells = children.slice(7);
cells.forEach((cell, index) => {
  const day = index % 7;
  cell.classList.add("cosmos-calendar-cell");
  cell.style.textAlign = "center";
  if (day === 0) cell.classList.add("cosmos-calendar-holiday");
  if (day === 6) cell.classList.add("cosmos-calendar-saturday");
  const number = cell.querySelector(".day-number");
  if (number && cell.classList.contains("outside")) return;
  const title = number ? number.textContent : "";
  const monthTitle = $("#month-title")?.textContent || "";
  const match = monthTitle.match(/(\d+)年(\d+)月/);
  if (!match || !number) return;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const dayNum = Number(title);
  const cellDate = cell.classList.contains("outside")
    ? null
    : new Date(year, month - 1, dayNum);
  if (cellDate && holidayName(cellDate)) {
    cell.classList.add("cosmos-calendar-holiday");
    number.title = holidayName(cellDate);
    number.style.color = "#ff777f";
  }
  if (cellDate && day === 6) number.style.color = "#69c9ff";
});

}

function decorateCalendarItems() {
const box = $(”#day-items”);
if (!box) return;

[...box.querySelectorAll(".event-card")].forEach(row => {
  const title = row.querySelector("h3")?.textContent || "";
  const dateTextContent = $("#selected-date-title")?.textContent || "";
  const dateMatch = dateTextContent.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  const date = dateMatch
    ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, "0")}-${String(dateMatch[3]).padStart(2, "0")}`
    : "";
  const event = calendar.events.find(e => e.title === title && e.date === date);
  if (!event) return;
  const color = event.color || COLORS[0];
  row.style.borderLeft = `3px solid ${color}`;
  row.style.paddingLeft = "10px";
  row.style.borderRadius = "8px";
  row.style.background = `color-mix(in srgb, ${color} 9%, transparent)`;
  const stripe = row.querySelector(".event-stripe");
  if (stripe) stripe.style.background = color;
});
[...box.querySelectorAll(".event-card")].forEach(row => {
  const title = row.querySelector("h3")?.textContent || "";
  const p = row.querySelector("p");
  const small = row.querySelector("small");
  const text = [p?.textContent, small?.textContent].filter(Boolean).join(" ");
  if (text.trim()) return;
  const label = document.createElement("small");
  label.textContent = title;
  row.append(label);
});

}

function decorateTasks() {
const box = $(”#task-list”);
if (!box) return;

[...box.querySelectorAll(".task-row")].forEach(row => {
  const title = row.querySelector(".task-main strong")?.textContent || "";
  const task = calendar.tasks.find(t => t.title === title);
  if (!task?.color) return;
  row.style.borderLeft = `3px solid ${task.color}`;
  row.style.paddingLeft = "10px";
  row.style.borderRadius = "8px";
  row.style.background = `color-mix(in srgb, ${task.color} 9%, transparent)`;
});

}

function addColorControls() {
const eventForm = $(”#event-form”);
if (eventForm && !$(”#event-color”)) {
const label = document.createElement(“label”);
label.innerHTML = 色 <input id="event-color" type="color" value="${COLORS[0]}" class="cosmos-color-input">;
eventForm.append(label);
}

const taskForm = $("#task-form");
if (taskForm && !$("#task-color")) {
  const label = document.createElement("label");
  label.innerHTML = `色 <input id="task-color" type="color" value="${COLORS[1]}" class="cosmos-color-input">`;
  taskForm.append(label);
}
const eventFormElement = $("#event-form");
if (eventFormElement && !eventFormElement.dataset.cosmosColorHook) {
  eventFormElement.dataset.cosmosColorHook = "1";
  eventFormElement.addEventListener("submit", () => {
    setTimeout(() => {
      const id = $("#event-id")?.value;
      const event = calendar.events.find(e => e.id === id);
      if (!event) return;
      event.color = $("#event-color")?.value || COLORS[0];
      saveCalendar();
      decorateCalendarItems();
    }, 0);
  });
}
const taskFormElement = $("#task-form");
if (taskFormElement && !taskFormElement.dataset.cosmosColorHook) {
  taskFormElement.dataset.cosmosColorHook = "1";
  taskFormElement.addEventListener("submit", () => {
    setTimeout(() => {
      const id = $("#task-id")?.value;
      const task = calendar.tasks.find(t => t.id === id);
      if (!task) return;
      task.color = $("#task-color")?.value || COLORS[1];
      saveCalendar();
      decorateTasks();
    }, 0);
  });
}

}

function setColorFields() {
const eventId = $(”#event-id”)?.value;
const taskId = $(”#task-id”)?.value;

const event = calendar.events.find(e => e.id === eventId);
const task = calendar.tasks.find(t => t.id === taskId);
if ($("#event-color")) $("#event-color").value = event?.color || COLORS[0];
if ($("#task-color")) $("#task-color").value = task?.color || COLORS[1];

}

function decorateStudyTimes() {
const lists = [$(”#period-records”), $(”#home-records”)].filter(Boolean);

lists.forEach(list => {
  [...list.querySelectorAll(".record")].forEach(row => {
    const title = row.querySelector("b")?.textContent || "";
    const small = row.querySelector("small");
    if (!small || small.dataset.cosmosTime) return;
    const text = small.textContent || "";
    const record = read(STUDY_KEY, {}).records?.find(r =>
      (r.item || r.title) === title &&
      text.includes(r.date || "")
    );
    if (!record) return;
    const timestamp = Number(record.createdAt);
    if (!timestamp) return;
    const time = formatClock(new Date(timestamp));
    small.textContent = `${text} · 記録 ${time}`;
    small.dataset.cosmosTime = "1";
  });
});

}

function refreshDecorations() {
decorateCalendar();
decorateCalendarItems();
decorateTasks();
decorateStudyTimes();
}

function installObserver() {
const target = $(”#view-calendar”);
if (!target) return;

const observer = new MutationObserver(() => {
  addColorControls();
  refreshDecorations();
});
observer.observe(target, {
  childList: true,
  subtree: true
});
addColorControls();
refreshDecorations();
// 予定・タスクの編集画面が開かれた後に、保存済みの色を反映
document.addEventListener("click", event => {
  if (event.target.closest("#add-event-day, #add-task-button, #day-items button, #task-list button")) {
    setTimeout(setColorFields, 50);
  }
});

}

function init() {
installStyles();
installPlanner();
installObserver();

window.addEventListener("cosmos-schedule-updated", () => {
  calendar = read(CAL_KEY, { events: [], tasks: [] });
  plans = read(PLAN_KEY, []);
  renderPlanner();
  refreshDecorations();
});

}

if (document.readyState === “loading”) {
document.addEventListener(“DOMContentLoaded”, init, { once: true });
} else {
init();
}
})();