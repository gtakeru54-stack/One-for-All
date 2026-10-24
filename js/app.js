
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const COLORS = {
    "数学": "#9aa9ff", "英語": "#5bd6bf", "国語": "#ffbc78",
    "理科": "#d6a0ff", "社会": "#ff8fa8", "情報": "#84c9ff", "その他": "#b1bdd3"
  };
  const SUBJECTS = Object.keys(COLORS);
  const CAL_KEY = "personal-calendar-v1";
  const STUDY_KEY = "algol-study-v1";
  const GOAL_KEY = "algol-goals-v1";
  const todayKey = () => keyOf(new Date());
  const keyOf = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const dateOf = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
  const id = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const minutes = seconds => Math.round((seconds || 0) / 60);
  const fmt = n => {
    n = Math.max(0, Math.round(n || 0));
    const h = Math.floor(n / 60), m = n % 60;
    return h ? `${h}時間${m ? `${m}分` : ""}` : `${m}分`;
  };
  const fmtClock = sec => {
    sec = Math.max(0, Math.floor(sec));
    return [Math.floor(sec/3600), Math.floor(sec/60)%60, sec%60].map(n => String(n).padStart(2,"0")).join(":");
  };
  const weekStart = d => {
    const x = new Date(d.getFullYear(),d.getMonth(),d.getDate());
    x.setDate(x.getDate() - ((x.getDay()+6)%7));
    return x;
  };
  const monthStart = d => new Date(d.getFullYear(),d.getMonth(),1);
  const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
  const sameDay = (a,b) => keyOf(a) === keyOf(b);
  const dayDiff = (a,b) => Math.round((dateOf(keyOf(a))-dateOf(keyOf(b)))/86400000);
  const startOf = (date,period) => period==="day" ? dateOf(keyOf(date)) : period==="week" ? weekStart(date) : monthStart(date);
  const periodEnd = (start,period) => period==="day" ? addDays(start,1) : period==="week" ? addDays(start,7) : new Date(start.getFullYear(),start.getMonth()+1,1);
  const inRange = (date,start,end) => date >= start && date < end;

  let calendar = { events: [], tasks: [] };
  let study = { items: [], sessions: [], active: null };
  let goals = { title:"", description:"", deadline:"", daily:60, weekly:600, monthly:2400, branches:[] };
  let viewDate = new Date();
  let selectedDate = todayKey();
  let chartOffset = 0;
  let timerTicker = null;
  let toastTicker = null;

  function load() {
    try {
      const c = JSON.parse(localStorage.getItem(CAL_KEY) || "{}");
      calendar.events = Array.isArray(c.events) ? c.events : [];
      calendar.tasks = Array.isArray(c.tasks) ? c.tasks : [];
    } catch {}
    try {
      const s = JSON.parse(localStorage.getItem(STUDY_KEY) || "{}");
      study.items = Array.isArray(s.items) ? s.items : [];
      study.sessions = Array.isArray(s.sessions) ? s.sessions : [];
      study.active = s.active || null;
    } catch {}
    try {
      const g = JSON.parse(localStorage.getItem(GOAL_KEY) || "{}");
      goals = { ...goals, ...g, branches:Array.isArray(g.branches) ? g.branches : [] };
    } catch {}
    if (!study.items.length) {
      study.items = [
        { id:id(), name:"数学", subject:"数学" },
        { id:id(), name:"英語", subject:"英語" }
      ];
      saveStudy();
    }
    $("#manual-date").value = todayKey();
    $("#event-date").value = selectedDate;
    $("#task-date").value = selectedDate;
    $("#record-date").value = "";
    $("#timer-stop").disabled = !study.active;
    if (study.active) {
      $("#timer-subject").value = study.active.subject || "数学";
      $("#timer-detail").value = study.active.detail || "";
      $("#timer-status").textContent = "計測中です。ページを開き直しても計測は続きます。";
      startTicker();
    }
    $("#goal-target-select").value = "weekly";
  }

  function saveCalendar() {
    try { localStorage.setItem(CAL_KEY, JSON.stringify(calendar)); }
    catch { toast("カレンダーを保存できませんでした。"); }
  }
  function saveStudy() {
    try { localStorage.setItem(STUDY_KEY, JSON.stringify(study)); }
    catch { toast("学習記録を保存できませんでした。バックアップを作成してください。"); }
  }
  function saveGoals() {
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(goals)); }
    catch { toast("目標を保存できませんでした。"); }
  }
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTicker);
    toastTicker = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function showView(viewId) {
    $$(".view").forEach(v => v.hidden = v.id !== viewId);
    $$(".bottom-nav [data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === viewId));
    if (viewId === "analysis-view") renderAnalysis();
    if (viewId === "goals-view") renderGoals();
    if (viewId === "record-view") renderHistory();
    if (viewId === "home-view") renderHome();
    if (viewId === "calendar-view") renderCalendar();
    window.scrollTo({ top:0, behavior:"auto" });
  }
  $$("[data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("#manual-add-top").addEventListener("click", () => showView("timer-view"));

  // Study records
  function addSession(subject,detail,seconds,date=todayKey(),source="manual") {
    seconds = Math.floor(Number(seconds) || 0);
    if (seconds <= 0) { toast("0分の記録は保存できません。"); return false; }
    study.sessions.push({ id:id(), subject:SUBJECTS.includes(subject)?subject:"その他",
      detail:(detail || "").trim(), seconds, date, source, createdAt:Date.now() });
    saveStudy();
    renderAllStudy();
    toast("学習記録を保存しました。");
    return true;
  }
  $("#manual-form").addEventListener("submit", e => {
    e.preventDefault();
    const h = Number($("#manual-hours").value);
    const m = Number($("#manual-minutes").value);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || h > 24 || m > 59 || h*60+m <= 0) {
      toast("1分以上の時間を入力してください。"); return;
    }
    if (h*60+m > 1440) { toast("1回の記録は24時間以内にしてください。"); return; }
    if (addSession($("#manual-subject").value,$("#manual-detail").value,(h*60+m)*60,$("#manual-date").value)) {
      $("#manual-detail").value = "";
    }
  });

  $("#timer-start").addEventListener("click", () => {
    if (study.active) return;
    study.active = { startedAt:Date.now(), subject:$("#timer-subject").value,
      detail:$("#timer-detail").value.trim(), date:todayKey() };
    saveStudy();
    $("#timer-start").disabled = true;
    $("#timer-stop").disabled = false;
    $("#timer-status").textContent = "計測中です。終了すると記録が保存されます。";
    startTicker();
  });
  $("#timer-stop").addEventListener("click", () => {
    if (!study.active) return;
    const active = study.active;
    const elapsed = Math.floor((Date.now()-active.startedAt)/1000);
    study.active = null;
    clearInterval(timerTicker);
    timerTicker = null;
    $("#timer-clock").textContent = "00:00:00";
    $("#timer-start").disabled = false;
    $("#timer-stop").disabled = true;
    $("#timer-status").textContent = "計測を終了しました。";
    if (elapsed > 0) addSession(active.subject,active.detail,elapsed,active.date,"timer");
    else { saveStudy(); toast("記録できる時間がありませんでした。"); }
  });
  function startTicker() {
    clearInterval(timerTicker);
    const update = () => {
      if (!study.active) return;
      $("#timer-clock").textContent = fmtClock((Date.now()-study.active.startedAt)/1000);
    };
    update();
    timerTicker = setInterval(update,1000);
  }

  $("#study-item-form").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("#study-item-name").value.trim();
    if (!name) return;
    study.items.push({ id:id(), name, subject:$("#study-item-subject").value });
    saveStudy();
    $("#study-item-name").value = "";
    renderItems();
    toast("学習項目を追加しました。");
  });
  function renderItems() {
    const box = $("#study-item-list");
    box.replaceChildren();
    study.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "log-row";
      row.innerHTML = `<div><strong>${esc(item.name)}</strong><small>${esc(item.subject)}</small></div><button type="button">削除</button>`;
      row.querySelector("button").addEventListener("click", () => {
        if (!confirm(`「${item.name}」を学習項目から削除しますか？過去の記録は残ります。`)) return;
        study.items = study.items.filter(x => x.id !== item.id);
        saveStudy(); renderItems();
      });
      box.append(row);
    });
  }

  // Aggregation
  function totalSeconds(start,end,subject=null) {
    return study.sessions.reduce((sum,s) => {
      const d = dateOf(s.date);
      return inRange(d,start,end) && (!subject || s.subject===subject) ? sum+s.seconds : sum;
    },0);
  }
  function totalForDay(date) {
    const start = dateOf(date), end = addDays(start,1);
    return minutes(totalSeconds(start,end));
  }
  function getGoalTarget(period) {
    return Math.max(0,Number(period==="day" ? goals.daily : period==="week" ? goals.weekly : goals.monthly) || 0);
  }
  function getCurrentPeriod(period) {
    const now = new Date();
    const start = startOf(now,period);
    return { start, end:periodEnd(start,period) };
  }
  function rateFor(period) {
    const {start,end} = getCurrentPeriod(period);
    const target = getGoalTarget(period);
    const actual = minutes(totalSeconds(start,end));
    return { actual,target,rate:target ? Math.min(100,Math.round(actual/target*100)) : 0 };
  }
  function renderHome() {
    const today = rateFor("day");
    const week = rateFor("week");
    $("#home-today").textContent = fmt(today.actual);
    $("#home-week").textContent = fmt(week.actual);
    $("#home-total").textContent = fmt(minutes(study.sessions.reduce((s,x)=>s+x.seconds,0)));
    $("#home-goal-title").textContent = goals.title || "目標を設定しよう";
    $("#home-goal-description").textContent = goals.description || "目標を決めると、そこまでの道筋を作れます。";
    const target = $("#goal-target-select").value || "weekly";
    const r = rateFor(target);
    $("#home-goal-bar").style.width = `${r.rate}%`;
    $("#home-goal-progress").textContent = r.target ? `${r.rate}% 達成 · ${fmt(r.actual)} / ${fmt(r.target)}` : "目標未設定";
    const stairs = $("#home-staircase");
    stairs.replaceChildren();
    const count = Math.max(5,Math.min(10,goals.branches.length+3));
    for (let i=0;i<count;i++) {
      const step = document.createElement("div");
      step.className = `moon-step${i===count-1?" current":""}`;
      step.style.height = `${16+i*5}px`;
      stairs.append(step);
    }
    const recent = $("#home-recent");
    recent.replaceChildren();
    const list = [...study.sessions].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,4);
    if (!list.length) recent.innerHTML = '<div class="empty-state">まだ記録がありません。学習を記録すると、ここに表示されます。</div>';
    list.forEach(s => recent.append(makeLogRow(s,false)));
  }

  // Charts: stacked bars by subject
  function shiftChartPeriod(period,offset) {
    const now = new Date();
    if (period==="day") return addDays(now,offset);
    if (period==="week") return addDays(weekStart(now),offset*7);
    return new Date(now.getFullYear(),now.getMonth()+offset,1);
  }
  function renderAnalysis() {
    const period = $("#chart-period").value;
    const type = $("#chart-type").value;
    const anchor = shiftChartPeriod(period,chartOffset);
    let start,end,label;
    if (period==="day") {
      start=dateOf(keyOf(anchor)); end=addDays(start,1);
      label=anchor.toLocaleDateString("ja-JP",{year:"numeric",month:"long",day:"numeric"});
    } else if (period==="week") {
      start=weekStart(anchor); end=addDays(start,7);
      label=`${start.getMonth()+1}/${start.getDate()}〜${addDays(end,-1).getMonth()+1}/${addDays(end,-1).getDate()}`;
    } else {
      start=monthStart(anchor); end=new Date(start.getFullYear(),start.getMonth()+1,1);
      label=`${start.getFullYear()}年${start.getMonth()+1}月`;
    }
    $("#chart-period-label").textContent=label;
    const total=minutes(totalSeconds(start,end));
    $("#chart-period-total").textContent=fmt(total);
    const chart=$("#study-chart");
    chart.replaceChildren();
    const points=[];
    if (type==="daily") {
      const count=period==="day"?1:period==="week"?7:new Date(start.getFullYear(),start.getMonth()+1,0).getDate();
      for(let i=0;i<count;i++) {
        const d=addDays(start,i);
        points.push({label:period==="day"?"今日":period==="week"?"日月火水木金土"[d.getDay()]:String(d.getDate()),
          date:d,values:Object.fromEntries(SUBJECTS.map(sub=>[sub,minutes(totalSeconds(d,addDays(d,1),sub))]))});
      }
    } else {
      points.push({label:"合計",date:start,values:Object.fromEntries(SUBJECTS.map(sub=>[sub,minutes(totalSeconds(start,end,sub))]))});
    }
    const max=Math.max(1,...points.map(p=>SUBJECTS.reduce((n,s)=>n+p.values[s],0)));
    points.forEach(p=>{
      const col=document.createElement("div");
      col.className="chart-column";
      const area=document.createElement("div"); area.className="bar-area";
      const stack=document.createElement("div"); stack.className="chart-stack";
      stack.style.height=`${Math.max(2,SUBJECTS.reduce((n,s)=>n+p.values[s],0)/max*100)}%`;
      SUBJECTS.forEach(sub=>{
        const val=p.values[sub];
        if(!val)return;
        const seg=document.createElement("div"); seg.className="chart-segment";
        seg.style.height=`${val/Math.max(1,SUBJECTS.reduce((n,s)=>n+p.values[s],0))*100}%`;
        seg.style.background=COLORS[sub]; seg.title=`${sub}: ${fmt(val)}`;
        stack.append(seg);
      });
      area.append(stack); col.append(area);
      const label=document.createElement("span"); label.className="chart-label"; label.textContent=p.label; col.append(label);
      chart.append(col);
    });
    const legend=$("#chart-legend"); legend.replaceChildren();
    SUBJECTS.filter(sub=>study.sessions.some(s=>s.subject===sub && inRange(dateOf(s.date),start,end))).forEach(sub=>{
      const item=document.createElement("span"); item.className="legend-item";
      item.innerHTML=`<i class="legend-dot" style="background:${COLORS[sub]}"></i>${esc(sub)}`;
      legend.append(item);
    });
    const targetPeriod=$("#goal-target-select").value || "weekly";
    const targetData=rateFor(targetPeriod);
    $("#chart-goal-rate").textContent=`${targetData.rate}%`;
    $("#goal-donut").style.background=`conic-gradient(var(--primary) ${targetData.rate}%, #27334f ${targetData.rate}%)`;
    $("#donut-title").textContent=targetPeriod==="daily"?"今日の目標":targetPeriod==="weekly"?"今週の目標":"今月の目標";
    $("#donut-detail").textContent=targetData.target?`${fmt(targetData.actual)} / ${fmt(targetData.target)}${targetData.actual>=targetData.target?" · 目標達成！":` · あと${fmt(targetData.target-targetData.actual)}`}`:"目標時間を設定してください。";
    $("#chart-average").textContent=period==="week"?`1日平均 ${fmt(Math.round(total/7))}`:period==="month"?`1日平均 ${fmt(Math.round(total/Math.max(1,dayDiff(end,start))))}`:"";
    renderBreakdown(start,end);
  }
  function renderBreakdown(start,end) {
    const box=$("#chart-breakdown"); box.replaceChildren();
    const totals=SUBJECTS.map(subject=>({subject,minutes:minutes(totalSeconds(start,end,subject))}));
    const max=Math.max(1,...totals.map(x=>x.minutes));
    totals.forEach(x=>{
      if(!x.minutes)return;
      const row=document.createElement("div"); row.className="breakdown-row";
      row.innerHTML=`<strong>${esc(x.subject)}</strong><div class="mini-track"><div class="mini-fill" style="width:${x.minutes/max*100}%;background:${COLORS[x.subject]}"></div></div><span>${fmt(x.minutes)}</span>`;
      box.append(row);
    });
    if(!box.children.length) box.innerHTML='<div class="empty-state">この期間の学習記録はありません。</div>';
  }
  $("#chart-period").addEventListener("change",()=>{chartOffset=0;renderAnalysis();});
  $("#chart-type").addEventListener("change",renderAnalysis);
  $("#chart-prev").addEventListener("click",()=>{chartOffset--;renderAnalysis();});
  $("#chart-next").addEventListener("click",()=>{if(chartOffset<0){chartOffset++;renderAnalysis();}});
  $("#goal-target-select").addEventListener("change",()=>{renderAnalysis();renderHome();});

  // Goals and branching map
  $("#goal-form").addEventListener("submit",e=>{
    e.preventDefault();
    goals.title=$("#goal-title").value.trim();
    goals.description=$("#goal-description").value.trim();
    goals.deadline=$("#goal-deadline").value;
    goals.daily=Math.max(0,Number($("#goal-daily").value)||0);
    goals.weekly=Math.max(0,Number($("#goal-weekly").value)||0);
    goals.monthly=Math.max(0,Number($("#goal-monthly").value)||0);
    saveGoals(); renderAllStudy(); renderGoals(); toast("目標を保存しました。");
  });
  function renderGoals() {
    $("#goal-title").value=goals.title;
    $("#goal-description").value=goals.description;
    $("#goal-deadline").value=goals.deadline;
    $("#goal-daily").value=goals.daily;
    $("#goal-weekly").value=goals.weekly;
    $("#goal-monthly").value=goals.monthly;
    const parent=$("#branch-parent"); parent.replaceChildren();
    const root=document.createElement("option"); root.value="root"; root.textContent=goals.title||"最終目標"; parent.append(root);
    goals.branches.forEach(b=>{const opt=document.createElement("option");opt.value=b.id;opt.textContent="└ "+b.title;parent.append(opt);});
    const map=$("#goal-map"); map.replaceChildren();
    if(!goals.title) map.innerHTML='<div class="empty-state">最初に最終目標を保存してください。</div>';
    else {
      map.append(makeBranchNode({id:"root",title:goals.title,detail:goals.description,root:true,done:false}));
      const addChildren=(parentId,depth)=>{
        goals.branches.filter(b=>b.parentId===parentId).forEach(b=>{
          const node=makeBranchNode(b);
          if(depth>0) node.style.marginLeft=`${Math.min(depth*16,80)}px`;
          map.append(node); addChildren(b.id,depth+1);
        });
      };
      addChildren("root",1);
    }
  }
  function makeBranchNode(branch) {
    const node=document.createElement("article");
    node.className=`branch-node${branch.root?" root":""}${branch.done?" done":""}`;
    const deadline=branch.deadline?`期限：${esc(branch.deadline)}`:"期限なし";
    node.innerHTML=`<div class="branch-title">${branch.done?"✓ ":""}${esc(branch.title)}</div>
      ${branch.detail?`<div class="branch-detail">${esc(branch.detail)}</div>`:""}
      <div class="branch-meta">${deadline}</div>
      ${branch.root?"":`<div class="branch-actions"><button type="button" class="toggle-branch">${branch.done?"未完了に戻す":"✓ 完了にする"}</button><button type="button" class="edit-branch">編集</button><button type="button" class="delete-branch">削除</button></div>`}`;
    if(!branch.root) {
      node.querySelector(".toggle-branch").addEventListener("click",()=>{
        branch.done=!branch.done;saveGoals();renderGoals();renderHome();
      });
      node.querySelector(".edit-branch").addEventListener("click",()=>{
        const title=prompt("項目名",branch.title); if(title===null)return;
        const detail=prompt("具体的にやること",branch.detail||""); if(detail===null)return;
        branch.title=title.trim()||branch.title;branch.detail=detail.trim();
        saveGoals();renderGoals();
      });
      node.querySelector(".delete-branch").addEventListener("click",()=>{
        if(!confirm(`「${branch.title}」と、その下の項目を削除しますか？`))return;
        const remove=new Set([branch.id]);
        let changed=true;
        while(changed){changed=false;goals.branches.forEach(b=>{if(remove.has(b.parentId)&&!remove.has(b.id)){remove.add(b.id);changed=true;}});}
        goals.branches=goals.branches.filter(b=>!remove.has(b.id));
        saveGoals();renderGoals();renderHome();
      });
    }
    return node;
  }
  $("#branch-form").addEventListener("submit",e=>{
    e.preventDefault();
    if(!goals.title){toast("先に最終目標を保存してください。");return;}
    const title=$("#branch-title").value.trim(); if(!title)return;
    goals.branches.push({id:id(),parentId:$("#branch-parent").value||"root",title,
      detail:$("#branch-detail").value.trim(),deadline:$("#branch-deadline").value,done:false});
    saveGoals();$("#branch-title").value="";$("#branch-detail").value="";
    $("#branch-deadline").value="";renderGoals();renderHome();toast("目標マップに枝を追加しました。");
  });

  // Study history
  function makeLogRow(s,allowDelete=true) {
    const row=document.createElement("div"); row.className="log-row";
    const info=document.createElement("div");
    info.innerHTML=`<strong><span style="color:${COLORS[s.subject]||COLORS["その他"]}">●</span> ${esc(s.subject)}${s.detail?` · ${esc(s.detail)}`:""}</strong><small>${esc(s.date)} · ${s.source==="timer"?"タイマー":"手動記録"}</small>`;
    const right=document.createElement("div");
    right.innerHTML=`<span class="log-time">${fmt(minutes(s.seconds))}</span>${allowDelete?'<br><button type="button">削除</button>':""}`;
    if(allowDelete) right.querySelector("button").addEventListener("click",()=>{
      if(!confirm("この学習記録を削除しますか？"))return;
      study.sessions=study.sessions.filter(x=>x.id!==s.id);saveStudy();renderAllStudy();toast("記録を削除しました。");
    });
    row.append(info,right); return row;
  }
  function renderHistory() {
    const box=$("#record-history"); box.replaceChildren();
    const filter=$("#record-date").value;
    const sessions=[...study.sessions].filter(s=>!filter||s.date===filter).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    if(!sessions.length) {box.innerHTML='<div class="empty-state">該当する学習記録はありません。</div>';return;}
    sessions.forEach(s=>box.append(makeLogRow(s)));
  }
  $("#record-date").addEventListener("change",renderHistory);
  $("#record-date-clear").addEventListener("click",()=>{$("#record-date").value="";renderHistory();});
  function renderStats() {
    const today=rateFor("day"),week=rateFor("week");
    $("#record-today").textContent=fmt(today.actual);
    $("#record-week").textContent=fmt(week.actual);
    $("#record-total").textContent=fmt(minutes(study.sessions.reduce((n,s)=>n+s.seconds,0)));
  }
  function renderAllStudy() {
    renderStats();renderHome();renderItems();
    if(!$("#analysis-view").hidden)renderAnalysis();
    if(!$("#record-view").hidden)renderHistory();
  }

  // Calendar and tasks
  function eventsOn(date){return calendar.events.filter(e=>e.date===date);}
  function tasksOn(date){return calendar.tasks.filter(t=>t.date===date&&!t.completed);}
  function displayDate(key) {
    if(!key)return "期限なし";
    const d=dateOf(key);
    return `${d.getMonth()+1}月${d.getDate()}日（"日月火水木金土"[d.getDay()]）`.replace(/（"/,"（").replace(/"[日月火水木金土]"/,"");
  }
  function renderCalendar() {
    $("#month-title").textContent=`${viewDate.getFullYear()}年${viewDate.getMonth()+1}月`;
    const grid=$("#calendar-grid");grid.replaceChildren();
    const first=new Date(viewDate.getFullYear(),viewDate.getMonth(),1);
    const start=new Date(viewDate.getFullYear(),viewDate.getMonth(),1-first.getDay());
    for(let i=0;i<42;i++){
      const d=addDays(start,i),key=keyOf(d);
      const b=document.createElement("button");b.type="button";b.className="day-cell";
      if(d.getMonth()!==viewDate.getMonth())b.classList.add("outside");
      if(key===selectedDate)b.classList.add("selected");
      if(key===todayKey())b.classList.add("today");
      b.innerHTML=`<span class="day-number">${d.getDate()}</span><span class="day-markers">${eventsOn(key).length?'<i class="dot"></i>':""}${tasksOn(key).length?'<i class="dot task-dot"></i>':""}</span>`;
      b.addEventListener("click",()=>{selectedDate=key;viewDate=d;renderCalendar();renderDayItems();});
      grid.append(b);
    }
    renderDayItems();renderTasks();
  }
  function renderDayItems() {
    $("#selected-date-title").textContent=selectedDate;
    const box=$("#day-items");box.replaceChildren();
    const list=eventsOn(selectedDate).sort((a,b)=>(a.start||"99:99").localeCompare(b.start||"99:99"));
    if(!list.length)box.innerHTML='<div class="empty-state">この日の予定はありません。</div>';
    list.forEach(event=>{
      const card=document.createElement("article");card.className="event-card";
      card.innerHTML=`<span class="event-stripe ${esc(event.color||"blue")}"></span><div><h3>${esc(event.title)}</h3><p>${esc(event.notes||"")}</p></div><span class="event-time">${esc(event.start||"時刻なし")}</span>`;
      card.addEventListener("click",()=>openEventDialog(event));box.append(card);
    });
  }
  function renderTasks() {
    const box=$("#task-list");box.replaceChildren();
    const tasks=[...calendar.tasks].sort((a,b)=>Number(a.completed)-Number(b.completed));
    if(!tasks.length)box.innerHTML='<div class="empty-state">タスクはまだありません。</div>';
    tasks.forEach(task=>{
      const row=document.createElement("div");row.className=`task-row${task.completed?" completed":""}`;
      row.innerHTML=`<input type="checkbox" ${task.completed?"checked":""} aria-label="完了"><div class="task-main"><strong>${esc(task.title)}</strong><small>${esc(task.date||"期限なし")}${task.notes?` · ${esc(task.notes)}`:""}</small></div><button class="task-edit" type="button">•••</button>`;
      row.querySelector("input").addEventListener("change",e=>{task.completed=e.target.checked;saveCalendar();renderCalendar();});
      row.querySelector(".task-main").addEventListener("click",()=>openTaskDialog(task));
      row.querySelector(".task-edit").addEventListener("click",()=>openTaskDialog(task));
      box.append(row);
    });
  }
  const eventDialog=$("#event-dialog"),taskDialog=$("#task-dialog");
  function openEventDialog(event=null) {
    $("#event-form").reset();$("#event-id").value=event?.id||"";
    $("#event-title").value=event?.title||"";$("#event-date").value=event?.date||selectedDate;
    $("#event-start").value=event?.start||"";$("#event-end").value=event?.end||"";
    $("#event-color").value=event?.color||"blue";$("#event-notes").value=event?.notes||"";
    $("#event-reminder").checked=Boolean(event?.reminder);
    $("#event-dialog-title").textContent=event?"予定を編集":"予定を追加";
    $("#delete-event").hidden=!event;eventDialog.showModal();
  }
  function openTaskDialog(task=null) {
    $("#task-form").reset();$("#task-id").value=task?.id||"";
    $("#task-title").value=task?.title||"";$("#task-date").value=task?.date||selectedDate;
    $("#task-notes").value=task?.notes||"";
    $("#task-dialog-title").textContent=task?"タスクを編集":"タスクを追加";
    $("#delete-task").hidden=!task;taskDialog.showModal();
  }
  $$(".close-dialog").forEach(b=>b.addEventListener("click",()=>b.closest("dialog").close()));
  $("#add-event-day").addEventListener("click",()=>openEventDialog());
  $("#add-task-button").addEventListener("click",()=>openTaskDialog());
  $("#event-form").addEventListener("submit",e=>{
    e.preventDefault();
    const idValue=$("#event-id").value,start=$("#event-start").value,end=$("#event-end").value;
    if(start&&end&&end<start){toast("終了時刻を確認してください。");return;}
    const event={id:idValue||id(),title:$("#event-title").value.trim(),date:$("#event-date").value,start,end,
      color:$("#event-color").value,notes:$("#event-notes").value.trim(),reminder:$("#event-reminder").checked};
    if(!event.title)return;
    const i=calendar.events.findIndex(x=>x.id===idValue);
    if(i>=0)calendar.events[i]=event;else calendar.events.push(event);
    selectedDate=event.date;saveCalendar();renderCalendar();eventDialog.close();toast("予定を保存しました。");
  });
  $("#delete-event").addEventListener("click",()=>{
    const idValue=$("#event-id").value;
    if(!confirm("この予定を削除しますか？"))return;
    calendar.events=calendar.events.filter(x=>x.id!==idValue);saveCalendar();renderCalendar();eventDialog.close();
  });
  $("#task-form").addEventListener("submit",e=>{
    e.preventDefault();const idValue=$("#task-id").value;
    const old=calendar.tasks.find(x=>x.id===idValue);
    const task={id:idValue||id(),title:$("#task-title").value.trim(),date:$("#task-date").value,
      notes:$("#task-notes").value.trim(),completed:old?.completed||false};
    if(!task.title)return;
    const i=calendar.tasks.findIndex(x=>x.id===idValue);
    if(i>=0)calendar.tasks[i]=task;else calendar.tasks.push(task);
    saveCalendar();renderCalendar();taskDialog.close();toast("タスクを保存しました。");
  });
  $("#delete-task").addEventListener("click",()=>{
    const idValue=$("#task-id").value;if(!confirm("このタスクを削除しますか？"))return;
    calendar.tasks=calendar.tasks.filter(x=>x.id!==idValue);saveCalendar();renderCalendar();taskDialog.close();
  });
  $("#quick-task-form").addEventListener("submit",e=>{
    e.preventDefault();const title=$("#quick-task-title").value.trim();if(!title)return;
    calendar.tasks.push({id:id(),title,date:selectedDate,notes:"",completed:false});
    $("#quick-task-title").value="";saveCalendar();renderCalendar();toast("タスクを追加しました。");
  });
  $("#prev-month").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);renderCalendar();});
  $("#next-month").addEventListener("click",()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);renderCalendar();});
  $("#today-button").addEventListener("click",()=>{viewDate=new Date();selectedDate=todayKey();renderCalendar();});
  $("#export-button").addEventListener("click",()=>{
    const data={calendar,study,goals,events:calendar.events,tasks:calendar.tasks};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download=`algol-backup-${todayKey()}.json`;a.click();URL.revokeObjectURL(url);
    toast("バックアップを書き出しました。");
  });
  $("#import-file").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const data=JSON.parse(await file.text());
      const c=data.calendar||data;
      if(!Array.isArray(c.events)||!Array.isArray(c.tasks))throw new Error("invalid");
      if(!confirm("現在のカレンダー・学習記録・目標を読み込んだデータに置き換えますか？"))return;
      calendar={events:c.events,tasks:c.tasks};
      if(data.study)study={items:Array.isArray(data.study.items)?data.study.items:[],sessions:Array.isArray(data.study.sessions)?data.study.sessions:[],active:data.study.active||null};
      if(data.goals)goals={...goals,...data.goals,branches:Array.isArray(data.goals.branches)?data.goals.branches:[]};
      saveCalendar();saveStudy();saveGoals();renderAllStudy();renderGoals();renderCalendar();toast("バックアップを読み込みました。");
    }catch{toast("バックアップを読み込めませんでした。");}
    finally{e.target.value="";}
  });

  function renderAllStudy(){renderStats();renderHome();renderItems();if(!$("#analysis-view").hidden)renderAnalysis();if(!$("#record-view").hidden)renderHistory();}
  load();
  renderItems();
  renderHome();
  renderStats();
  renderGoals();
  renderCalendar();
  renderAnalysis();
  showView("home-view");
})();
