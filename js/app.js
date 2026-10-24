/* ONE FOR ALL — COSMOS / js/app.js */
"use strict";
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const KEYS = { study:"oneforall-study-v1", timer:"oneforall-timer-v1", goals:"oneforall-goals-v1", calendar:"personal-calendar-v1" };
  const COLORS = ["#8eafff","#c0a1ff","#69dfc4","#f4c77b","#ff9dc5","#86d99b"];
  const todayKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const read = (k,f) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):f; } catch { return f; } };
  const save = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); return true; } catch { toast("保存できませんでした。端末の空き容量を確認してください。"); return false; } };
  const toast = msg => { const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2400); };
  const duration = sec => { const m=Math.floor(Math.max(0,sec)/60),h=Math.floor(m/60); return h?`${h}時間${m%60}分`:`${m}分`; };
  const timerText = sec => [Math.floor(sec/3600),Math.floor(sec%3600/60),Math.floor(sec%60)].map(n=>String(n).padStart(2,"0")).join(":");
  const localDate = k => { const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); };
  const dayOffset = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };

  // 既存の学習記録・科目・項目を保持したまま読み込みます。
  const oldStudy = read(KEYS.study,{});
  const state = {
    subjects: Array.isArray(oldStudy.subjects) ? oldStudy.subjects : [],
    items: Array.isArray(oldStudy.items) ? oldStudy.items : [],
    records: (Array.isArray(oldStudy.records)?oldStudy.records:[]).map(r=>({
      id:String(r.id||uid()),
      subject:String(r.subject||r.category||"未分類"),
      item:String(r.item||r.title||"学習"),
      date:/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")?r.date:todayKey(),
      seconds:Math.max(0,Math.round(Number(r.durationSeconds ?? (Number(r.minutes)||0)*60)||0)),
      createdAt:Number(r.createdAt)||Date.now()
    })),
    targets: oldStudy.targets || {
      day:{kind:"time",value:120,unit:"minutes"},
      week:{kind:"time",value:600,unit:"minutes"},
      month:{kind:"time",value:2400,unit:"minutes"}
    }
  };

  // 古いカテゴリー形式も科目として引き継ぎます。
  (Array.isArray(oldStudy.categories)?oldStudy.categories:[]).forEach(name=>{
    if(name && !state.subjects.some(s=>s.name===name)) state.subjects.push({id:uid(),name});
  });
  state.records.forEach(r=>{
    if(!state.subjects.some(s=>s.name===r.subject)) state.subjects.push({id:uid(),name:r.subject});
  });
  if(!state.subjects.length) state.subjects=[
    {id:uid(),name:"数学"},
    {id:uid(),name:"英語"},
    {id:uid(),name:"理科"}
  ];
  state.items = state.items.map(i=>({
    id:String(i.id||uid()),
    subjectId:String(i.subjectId||state.subjects.find(s=>s.name===i.subject)?.id||state.subjects[0].id),
    name:String(i.name||i.title||"学習項目")
  }));
  // 既存記録にある学習項目も選択できるようにします。
  state.records.forEach(r=>{
    if(!state.items.some(i=>i.subjectId===state.subjects.find(s=>s.name===r.subject)?.id && i.name===r.item)){
      const s=state.subjects.find(s=>s.name===r.subject);
      if(s) state.items.push({id:uid(),subjectId:s.id,name:r.item});
    }
  });

  let selectedSubject = state.subjects[0]?.id || "";
  let selectedItem = "";
  let timer = read(KEYS.timer,{
    elapsedSeconds:0,running:false,paused:false,startedAt:null,subjectId:"",itemId:""
  });
  let tick = null;
  let elapsedBase=Math.max(0,Number(timer.elapsedSeconds)||0);
  let startedAt=timer.running&&timer.startedAt?Number(timer.startedAt):null;
  let running=Boolean(startedAt);
  let paused=Boolean(timer.paused);
  let period="day";
  let chartGrouping="subject";
  let selectedGoalId=null;
  let editingGoalId=null;
  let pan={x:0,y:0,scale:1};
  let dragging=null;
  let pinchStart=null;

  let goals = read(KEYS.goals, null);
  if(!Array.isArray(goals)||!goals.length) goals=[
    {id:uid(),name:"第一志望合格",note:"最終目標を設定しましょう",parentId:null,final:true,done:false,x:500,y:110},
    {id:uid(),name:"英語",note:"英語の学習目標",parentId:null,final:false,done:false,x:300,y:330},
    {id:uid(),name:"数学",note:"数学の学習目標",parentId:null,final:false,done:false,x:700,y:330}
  ];

  goals=goals.map(g=>({
    ...g,
    id:String(g.id||uid()),
    name:String(g.name||"目標"),
    note:String(g.note||""),
    parentId:g.parentId?String(g.parentId):null,
    final:Boolean(g.final),
    done:Boolean(g.done),
    dueDate:/^\d{4}-\d{2}-\d{2}$/.test(g.dueDate||"")?g.dueDate:""
  }));
  if(!goals.some(g=>g.final)) goals[0].final=true;

  // 最終目標をルートとして維持します。
  goals.filter(g=>g.final).forEach(g=>{g.parentId=null;g.type="final";});
  const firstRoot=goals.find(g=>g.final)||goals[0];
  goals.forEach(g=>{
    if(!g.final&&(!g.parentId||!goals.some(p=>p.id===g.parentId)||g.parentId===g.id)){
      g.parentId=firstRoot.id;
    }
  });

  function goalChildren(id){
    return goals.filter(g=>g.parentId===id);
  }

  function normalizeGoalTree(){
    if(!goals.length)return;
    if(!goals.some(g=>g.final))goals[0].final=true;
    const roots=goals.filter(g=>g.final);
    const fallbackRoot=roots[0];

    roots.forEach(root=>{
      root.type="final";
      root.parentId=null;
    });

    goals.forEach(g=>{
      if(g.final)return;

      if(!g.parentId||!goals.some(p=>p.id===g.parentId)||g.parentId===g.id){
        g.parentId=fallbackRoot.id;
      }

      const seen=new Set([g.id]);
      let parent=goals.find(p=>p.id===g.parentId);

      while(parent){
        if(seen.has(parent.id)){
          g.parentId=fallbackRoot.id;
          break;
        }
        seen.add(parent.id);
        parent=parent.parentId?goals.find(p=>p.id===parent.parentId):null;
      }
    });

    goals.forEach(g=>{
      if(!g.final){
        const parent=goals.find(p=>p.id===g.parentId);
        g.type=parent?.final?"intermediate":"small";
      }
    });
  }

  normalizeGoalTree();
  selectedGoalId=goals.find(g=>g.final)?.id;

  function persistStudy(){
    save(KEYS.study,{
      subjects:state.subjects,
      items:state.items,
      records:state.records.map(r=>({
        id:r.id,
        category:r.subject,
        item:r.item,
        date:r.date,
        durationSeconds:r.seconds,
        createdAt:r.createdAt
      })),
      categories:state.subjects.map(s=>s.name),
      dailyGoalMinutes:120,
      targets:state.targets
    });
  }

  function persistTimer(){
    save(KEYS.timer,{
      elapsedSeconds:Math.max(0,Math.floor(elapsedBase)),
      running,
      paused,
      startedAt,
      subjectId:timer.subjectId||selectedSubject,
      itemId:timer.itemId||selectedItem
    });
  }

  function persistGoals(){
    save(KEYS.goals,goals);
  }

  function showView(name){
    $$(".view").forEach(v=>{
      const on=v.id===`view-${name}`;
      v.hidden=!on;
      v.classList.toggle("active",on);
    });
    $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
    if(name==="records")renderRecords();
    if(name==="subjects")renderSubjects();
    if(name==="goals")renderGoals();
    if(name==="home")renderHome();
    if(name==="calendar")renderCalendarAll();
    window.scrollTo({top:0,behavior:"smooth"});
  }

  // ナビゲーションボタンを直接登録します。
  $$('[data-view]').forEach(b=>b.addEventListener("click",e=>{
    e.preventDefault();
    showView(b.dataset.view);
  }));

  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
  $("#today-chip").textContent=new Date().toLocaleDateString("ja-JP",{
    month:"short",day:"numeric",weekday:"short"
  });

  // 手動時間追加フォームとグラフの切り替えをJavaScript側で追加します。
  // そのため、通常はこのファイルだけの変更で利用できます。
  const uiStyle=document.createElement("style");
  uiStyle.textContent=`
    .manual-time-box{
      margin-top:20px;
      padding:16px;
      border:1px solid rgba(142,175,255,.2);
      border-radius:16px;
      background:rgba(13,22,48,.48)
    }
    .manual-time-box h3{margin:0 0 6px;font-size:1rem}
    .manual-time-form{display:grid;gap:12px;margin-top:12px}
    .manual-time-form label,.chart-grouping-label{
      display:grid;
      gap:6px;
      color:var(--muted,#9ba9c8);
      font-size:.85rem
    }
    .manual-time-form input,.manual-time-form select,.chart-grouping-label select{
      width:100%;
      min-width:0;
      border:1px solid rgba(150,170,220,.25);
      border-radius:10px;
      padding:10px 12px;
      background:#101a35;
      color:inherit;
      font:inherit
    }
    .chart-grouping-label{min-width:115px;max-width:180px}
  `;
  document.head.append(uiStyle);

  const manualBox=document.createElement("section");
  manualBox.className="manual-time-box";
  manualBox.innerHTML=`
    <h3>手動で学習時間を追加</h3>
    <p class="muted">自分で計測した時間も学習時間の累計に加算できます。</p>
    <form id="manual-time-form" class="manual-time-form">
      <label>学習項目
        <select id="manual-item" required></select>
      </label>
      <div class="form-row">
        <label>時間
          <input id="manual-hours" type="number" min="0" max="999" value="0" required>
        </label>
        <label>分
          <input id="manual-minutes" type="number" min="0" max="59" value="30" required>
        </label>
      </div>
      <label>学習した日
        <input id="manual-date" type="date" required>
      </label>
      <button class="primary-button" type="submit">＋ 学習時間を追加</button>
    </form>
  `;
  $("#subject-detail").append(manualBox);

  const breakdownPanel=$("#subject-breakdown").closest(".panel");
  const breakdownHead=breakdownPanel?.querySelector(".section-head");

  if(breakdownHead){
    const control=document.createElement("label");
    control.className="chart-grouping-label";
    control.innerHTML=`
      色分け
      <select id="chart-grouping">
        <option value="subject">科目ごと</option>
        <option value="item">学習項目ごと</option>
      </select>
    `;
    breakdownHead.append(control);
    const heading=breakdownHead.querySelector("h2");
    if(heading)heading.id="breakdown-title";
  }

  function subjectForRecord(r){
    return r.subject||"未分類";
  }

  function recordsForDates(start,end){
    return state.records.filter(r=>r.date>=start&&r.date<=end);
  }

  function total(records){
    return records.reduce((s,r)=>s+r.seconds,0);
  }

  function currentRange(){
    const today=localDate(todayKey());

    if(period==="day"){
      return {
        start:todayKey(),
        end:todayKey(),
        title:"今日",
        labels:["今日"],
        dates:[todayKey()]
      };
    }

    if(period==="week"){
      const monday=dayOffset(today,-((today.getDay()+6)%7));
      const dates=Array.from({length:7},(_,i)=>todayKey(dayOffset(monday,i)));
      return {
        start:dates[0],
        end:dates[6],
        title:"今週（月〜日）",
        labels:dates.map(k=>{
          const d=localDate(k);
          return `${d.getMonth()+1}/${d.getDate()}`;
        }),
        dates
      };
    }

    const start=new Date(today.getFullYear(),today.getMonth(),1);
    const end=new Date(today.getFullYear(),today.getMonth()+1,0);
    const dates=Array.from({length:end.getDate()},(_,i)=>todayKey(dayOffset(start,i)));

    return {
      start:dates[0],
      end:dates[dates.length-1],
      title:`${today.getFullYear()}年${today.getMonth()+1}月`,
      labels:dates.map(k=>String(localDate(k).getDate())),
      dates
    };
  }

  function secondsForPeriod(){
    const r=currentRange();
    return total(recordsForDates(r.start,r.end));
  }

  function renderHome(){
    const today=total(recordsForDates(todayKey(),todayKey()));
    const now=localDate(todayKey());
    const monday=dayOffset(now,-((now.getDay()+6)%7));
    const sunday=dayOffset(monday,6);
    const week=total(recordsForDates(todayKey(monday),todayKey(sunday)));
    const all=total(state.records);

    $("#home-today").textContent=duration(today);
    $("#stat-today").textContent=duration(today);
    $("#stat-week").textContent=duration(week);
    $("#stat-all").textContent=duration(all);

    const target=Number(state.targets.day?.value)||120;
    const unit=state.targets.day?.unit||"minutes";
    const targetSeconds=target*(unit==="hours"?3600:60);
    const pct=targetSeconds?Math.min(100,Math.round(today/targetSeconds*100)):0;

    $("#home-progress").style.width=pct+"%";
    $("#home-progress-label").textContent=`今日の目標 ${pct}%`;

    const recent=[...state.records]
      .sort((a,b)=>b.createdAt-a.createdAt)
      .slice(0,4);

    $("#home-records").innerHTML=recent.length
      ?recent.map(recordHTML).join("")
      :empty("学習記録はまだありません。科目からタイマーを使って記録しましょう。");
  }

  function empty(msg){
    return `<div class="empty"><span>✧</span><p>${esc(msg)}</p></div>`;
  }

  function recordHTML(r){
    return `
      <article class="record">
        <i style="background:${COLORS[Math.abs(r.subject.length)%COLORS.length]}"></i>
        <div>
          <b>${esc(r.item)}</b>
          <small>${esc(r.subject)} · ${esc(r.date)}</small>
        </div>
        <strong>${duration(r.seconds)}</strong>
      </article>
    `;
  }

  function renderSubjects(){
    $("#subject-list").innerHTML=state.subjects.map((s,i)=>`
      <button class="subject-card ${selectedSubject===s.id?"selected":""}" data-subject="${esc(s.id)}">
        <span class="subject-symbol" style="--subject-color:${COLORS[i%COLORS.length]}">✦</span>
        <span>
          <b>${esc(s.name)}</b>
          <small>${state.items.filter(x=>x.subjectId===s.id).length}項目 · 累計 ${duration(total(state.records.filter(r=>r.subject===s.name)))}</small>
        </span>
        <span>›</span>
      </button>
    `).join("") || empty("まず科目を作成してください。");

    $("#subject-list").querySelectorAll("[data-subject]").forEach(b=>{
      b.addEventListener("click",()=>{
        selectedSubject=b.dataset.subject;
        selectedItem="";
        renderSubjects();
        renderSubjectDetail();
      });
    });

    if(selectedSubject&&state.subjects.some(s=>s.id===selectedSubject)){
      renderSubjectDetail();
    }else{
      $("#subject-detail").hidden=true;
    }
  }

  function renderSubjectDetail(){
    const s=state.subjects.find(x=>x.id===selectedSubject);
    if(!s){
      $("#subject-detail").hidden=true;
      return;
    }

    $("#subject-detail").hidden=false;
    $("#detail-title").textContent=s.name;
    refreshManualItems();

    const items=state.items.filter(i=>i.subjectId===s.id);

    $("#item-list").innerHTML=items.map(i=>{
      const secs=total(state.records.filter(r=>r.subject===s.name&&r.item===i.name));
      return `
        <article class="item-card">
          <div>
            <b>${esc(i.name)}</b>
            <small>累計 ${duration(secs)}</small>
          </div>
          <button class="primary-button start-item" data-item="${esc(i.id)}">▶ 計測</button>
        </article>
      `;
    }).join("") || empty("この科目に学習項目はありません。「学習項目」から追加できます。");

    $$(".start-item").forEach(b=>{
      b.addEventListener("click",()=>startForItem(b.dataset.item));
    });

    const hasTimer=timer.subjectId===s.id && (elapsed()>0||running||paused);
    $("#timer-panel").hidden=!hasTimer;

    if(hasTimer){
      selectedItem=timer.itemId;
      const item=state.items.find(i=>i.id===selectedItem);
      $("#timer-label").textContent=`${s.name} · ${item?.name||"学習"}`;
      updateTimerUI();
    }
  }

  $("#add-subject").addEventListener("click",()=>{
    $("#subject-form").reset();
    $("#subject-dialog").showModal();
  });

  $("#subject-form").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("#subject-name").value.trim();
    if(!name)return;
    if(state.subjects.some(s=>s.name.toLowerCase()===name.toLowerCase())){
      return toast("同じ名前の科目があります。");
    }
    const s={id:uid(),name};
    state.subjects.push(s);
    selectedSubject=s.id;
    persistStudy();
    $("#subject-dialog").close();
    renderSubjects();
    renderHome();
    toast("科目を作成しました。");
  });

  $("#close-subject").addEventListener("click",()=>{
    $("#subject-detail").hidden=true;
  });

  $("#add-item").addEventListener("click",()=>{
    if(!selectedSubject)return toast("先に科目を選んでください。");
    $("#item-form").reset();
    $("#item-dialog").showModal();
  });

  $("#item-form").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("#item-name").value.trim();
    if(!name||!selectedSubject)return;
    const item={id:uid(),subjectId:selectedSubject,name};
    state.items.push(item);
    selectedItem=item.id;
    persistStudy();
    $("#item-dialog").close();
    renderSubjects();
    toast("学習項目を追加しました。");
  });

  // 手動時間追加フォームの選択肢を、現在選択している科目に合わせます。
  function refreshManualItems(){
    const select=$("#manual-item");
    if(!select)return;

    const items=state.items.filter(i=>i.subjectId===selectedSubject);
    select.innerHTML=items.map(i=>`
      <option value="${esc(i.id)}">${esc(i.name)}</option>
    `).join("");

    if(!items.length){
      select.innerHTML='<option value="">先に学習項目を作成してください</option>';
    }

    select.disabled=!items.length;
  }

  $("#manual-date").value=todayKey();

  $("#manual-time-form").addEventListener("submit",e=>{
    e.preventDefault();

    const item=state.items.find(i=>i.id===$("#manual-item").value);
    const hours=Number($("#manual-hours").value);
    const minutes=Number($("#manual-minutes").value);

    if(!item)return toast("先に学習項目を作成してください。");

    if(
      !Number.isInteger(hours)||
      hours<0||
      !Number.isInteger(minutes)||
      minutes<0||
      minutes>59||
      hours*60+minutes<1
    ){
      return toast("1分以上の時間を入力してください。");
    }

    const subject=state.subjects.find(s=>s.id===item.subjectId);

    state.records.push({
      id:uid(),
      subject:subject?.name||"未分類",
      item:item.name,
      date:$("#manual-date").value||todayKey(),
      seconds:(hours*60+minutes)*60,
      createdAt:Date.now()
    });

    persistStudy();
    renderSubjects();
    renderHome();
    renderRecords();

    $("#manual-hours").value="0";
    $("#manual-minutes").value="30";
    $("#manual-date").value=todayKey();

    toast(`手動で ${hours?hours+"時間":""}${minutes}分を追加しました。`);
  });

  function startForItem(id){
    const item=state.items.find(i=>i.id===id);
    if(!item)return;

    selectedSubject=item.subjectId;
    selectedItem=id;

    if(
      elapsed()>0 &&
      (timer.itemId!==id||timer.subjectId!==selectedSubject) &&
      !confirm("計測中の時間があります。今の計測を記録せずに切り替えますか？")
    )return;

    if(timer.itemId!==id||timer.subjectId!==selectedSubject){
      elapsedBase=0;
      running=false;
      paused=false;
      startedAt=null;
    }

    timer.subjectId=selectedSubject;
    timer.itemId=id;
    $("#timer-panel").hidden=false;

    const s=state.subjects.find(x=>x.id===selectedSubject);
    $("#timer-label").textContent=`${s?.name||""} · ${item.name}`;

    renderSubjects();
    startTimer();
    $("#timer-panel").scrollIntoView({behavior:"smooth",block:"center"});
  }

  function elapsed(){
    return elapsedBase+(running&&startedAt?Math.max(0,(Date.now()-startedAt)/1000):0);
  }

  function updateTimerUI(){
    $("#timer-display").textContent=timerText(elapsed());
    $("#timer-start").disabled=running;
    $("#timer-pause").disabled=!running;
    $("#timer-finish").disabled=elapsed()<1;
    $("#timer-state").textContent=running
      ?"計測中です。別画面に移動しても時間は進みます。"
      :paused
        ?"一時停止中です。"
        :"開始すると学習時間を計測します。";
    $("#timer-start").textContent=paused?"▶ 再開":"▶ 開始";
  }

  function startTimer(){
    if(running)return;
    if(!timer.itemId){
      toast("学習項目を選んでください。");
      return;
    }

    running=true;
    paused=false;
    startedAt=Date.now();
    persistTimer();

    if(tick)clearInterval(tick);
    tick=setInterval(()=>{
      updateTimerUI();
      persistTimer();
    },500);

    updateTimerUI();
  }

  function pauseTimer(){
    if(!running)return;

    elapsedBase=elapsed();
    running=false;
    paused=true;
    startedAt=null;

    if(tick)clearInterval(tick);
    tick=null;

    persistTimer();
    updateTimerUI();
  }

  function finishTimer(){
    const sec=Math.floor(elapsed());
    if(sec<1)return toast("記録できる時間がありません。");

    const s=state.subjects.find(x=>x.id===timer.subjectId);
    const i=state.items.find(x=>x.id===timer.itemId);

    state.records.push({
      id:uid(),
      subject:s?.name||"未分類",
      item:i?.name||"学習",
      date:todayKey(),
      seconds:sec,
      createdAt:Date.now()
    });

    elapsedBase=0;
    running=false;
    paused=false;
    startedAt=null;

    if(tick)clearInterval(tick);
    tick=null;

    persistStudy();
    persistTimer();
    updateTimerUI();
    renderSubjects();
    renderHome();
    renderRecords();

    toast(`${duration(sec)}を記録しました。`);
  }

  $("#timer-start").addEventListener("click",startTimer);
  $("#timer-pause").addEventListener("click",pauseTimer);
  $("#timer-finish").addEventListener("click",finishTimer);

  // 学習記録の表示・グラフ
  function renderRecords(){
    const range=currentRange();
    const recs=recordsForDates(range.start,range.end);
    const secs=total(recs);

    $("#period-title").textContent=range.title;
    $("#period-total").textContent=duration(secs);

    $$(".segmented button").forEach(b=>{
      b.classList.toggle("active",b.dataset.period===period);
    });

    drawBars(range,recs);
    drawDonut(range,recs);

    const grouped={};

    recs.forEach(r=>{
      const key=chartGrouping==="item"
        ?`${r.subject} / ${r.item}`
        :r.subject;
      grouped[key]=(grouped[key]||0)+r.seconds;
    });

    const entries=Object.entries(grouped).sort((a,b)=>b[1]-a[1]);

    $("#breakdown-title").textContent=chartGrouping==="item"
      ?"学習項目別の時間"
      :"科目別の時間";

    $("#subject-breakdown").innerHTML=entries.length
      ?entries.map(([name,val],i)=>`
        <div class="break-row">
          <div>
            <span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span>
            <b>${esc(name)}</b>
            <strong>${duration(val)}</strong>
          </div>
          <div class="progress-track">
            <span style="width:${secs?val/secs*100:0}%;background:${COLORS[i%COLORS.length]}"></span>
          </div>
        </div>
      `).join("")
      :empty("この期間の学習記録はありません。");

    $("#period-records").innerHTML=recs.length
      ?[...recs]
        .sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt)
        .map(recordHTML)
        .join("")
      :empty("この期間の記録はまだありません。");
  }

  $$(".segmented button").forEach(b=>{
    b.addEventListener("click",()=>{
      period=b.dataset.period;
      renderRecords();
    });
  });

  $("#chart-grouping").addEventListener("change",()=>{
    chartGrouping=$("#chart-grouping").value;
    renderRecords();
  });

  function drawBars(range,recs){
    const c=$("#bar-chart");
    const ctx=c.getContext("2d");
    const rect=c.getBoundingClientRect();
    const dpr=window.devicePixelRatio||1;

    c.width=Math.max(280,rect.width)*dpr;
    c.height=220*dpr;
    ctx.scale(dpr,dpr);

    const w=c.width/dpr;
    const h=220;

    ctx.clearRect(0,0,w,h);

    const getGroup=r=>chartGrouping==="item"
      ?`${r.subject} / ${r.item}`
      :r.subject;

    const keys=[...new Set(recs.map(getGroup))];

    const series=keys.map(key=>({
      key,
      values:range.dates.map(date=>total(
        recs.filter(r=>r.date===date&&getGroup(r)===key)
      ))
    }));

    const vals=range.dates.map((_,i)=>
      series.reduce((sum,s)=>sum+s.values[i],0)
    );

    const max=Math.max(60,...vals);
    const pad={l:8,r:8,t:18,b:30};
    const plotW=w-pad.l-pad.r;
    const plotH=h-pad.t-pad.b;

    ctx.font="10px system-ui";
    ctx.textAlign="center";

    for(let i=0;i<4;i++){
      const y=pad.t+plotH*i/3;
      ctx.strokeStyle="rgba(160,180,230,.12)";
      ctx.beginPath();
      ctx.moveTo(pad.l,y);
      ctx.lineTo(w-pad.r,y);
      ctx.stroke();
    }

    const step=plotW/vals.length;
    const bw=Math.max(3,Math.min(24,step*.55));

    vals.forEach((v,i)=>{
      const x=pad.l+i*step+(step-bw)/2;
      let y=pad.t+plotH;

      // 科目ごと・学習項目ごとの色分けで積み上げ棒を描画します。
      series.forEach((ser,j)=>{
        const bh=ser.values[i]/max*(plotH-5);
        if(bh<=0)return;

        y-=bh;
        ctx.fillStyle=COLORS[j%COLORS.length];
        ctx.beginPath();
        ctx.roundRect(x,y,bw,bh,Math.min(4,bw/2));
        ctx.fill();
      });

      if(vals.length<=7||i%5===0||i===vals.length-1){
        ctx.fillStyle="#8998b9";
        ctx.fillText(range.labels[i],x+bw/2,h-9);
      }
    });
  }

  function drawDonut(range,recs){
    const config=state.targets[period]||{
      kind:"time",
      value:period==="day"?120:period==="week"?600:2400,
      unit:"minutes"
    };

    $("#target-kind").value=config.kind;
    $("#target-value").value=config.value;
    $("#target-unit").value=config.unit||"minutes";
    $("#target-unit-label").style.display=config.kind==="time"?"grid":"none";

    const actual=config.kind==="time"
      ?total(recs)/(config.unit==="hours"?3600:60)
      :new Set(recs.map(r=>r.item)).size;

    const target=Math.max(1,Number(config.value)||1);
    const pct=Math.min(100,Math.round(actual/target*100));

    $("#donut").style.background=`conic-gradient(#91adff ${pct*3.6}deg, rgba(140,157,196,.16) 0deg)`;
    $("#donut-percent").textContent=pct+"%";

    $("#target-progress-text").textContent=
      `${config.kind==="time"?Math.round(actual*10)/10:actual} / ${target} ${
        config.kind==="time"
          ?(config.unit==="hours"?"時間":"分")
          :"項目"
      }`;

    $("#target-explain").textContent=pct>=100
      ?"目標達成！設定した目標をクリアしました。"
      :`あと ${Math.max(0,Math.ceil(target-actual))}${
        config.kind==="time"
          ?(config.unit==="hours"?"時間":"分")
          :"項目"
      }で目標達成です。`;
  }

  $("#target-kind").addEventListener("change",()=>{
    $("#target-unit-label").style.display=$("#target-kind").value==="time"?"grid":"none";
  });

  $("#save-target").addEventListener("click",()=>{
    const value=Number($("#target-value").value);

    if(!Number.isFinite(value)||value<1){
      return toast("目標値は1以上にしてください。");
    }

    state.targets[period]={
      kind:$("#target-kind").value,
      value,
      unit:$("#target-unit").value
    };

    persistStudy();
    renderRecords();
    renderHome();
    toast("この期間の目標を保存しました。");
  });

  window.addEventListener("resize",()=>{
    if(!$("#view-records").hidden)renderRecords();
  });

  // 目標の達成率は、子目標を前提条件として計算します。
  // 子目標がない場合だけ、その目標自身の done 状態を達成率に使います。
  // 子目標がすべて達成されても、親目標の done は自動変更しません。
  function goalProgress(goalOrId,seen=new Set()){
    const goal=typeof goalOrId==="string"
      ?goals.find(g=>g.id===goalOrId)
      :goalOrId;

    if(!goal)return 0;
    if(seen.has(goal.id))return 0;

    const nextSeen=new Set(seen);
    nextSeen.add(goal.id);

    const children=goalChildren(goal.id);

    if(!children.length){
      return goal.done?100:0;
    }

    return Math.round(
      children.reduce((sum,child)=>sum+goalProgress(child,nextSeen),0)/children.length
    );
  }

  function isGoalDescendant(candidateId,ancestorId){
    let current=goals.find(g=>g.id===candidateId);
    const seen=new Set();

    while(current&&current.parentId&&!seen.has(current.id)){
      if(current.parentId===ancestorId)return true;
      seen.add(current.id);
      current=goals.find(g=>g.id===current.parentId);
    }

    return false;
  }

  function renderGoalDetail(){
    const g=goals.find(x=>x.id===selectedGoalId);
    if(!g)return;

    const children=goalChildren(g.id);
    const pct=goalProgress(g);

    $("#selected-goal-title").textContent=g.name;
    $("#selected-goal-desc").textContent=g.note||"メモはありません。";
    $("#selected-goal-progress-label").textContent=`達成率 ${pct}%`;
    $("#selected-goal-progress-bar").style.width=`${pct}%`;

    $("#selected-goal-progress-note").textContent=children.length
      ?`前提条件である子目標 ${children.length}個の進捗から算出（達成済み ${children.filter(c=>c.done).length}/${children.length}個）。この目標自体の達成状態とは別です。`
      :(g.done
        ?"この目標自体は達成済みです。"
        :"子目標がないため、この目標自体の達成状態を表示しています。");

    $("#selected-goal-due").textContent=g.dueDate
      ?`期限：${g.dueDate}`
      :"期限未設定";

    const toggle=$("#toggle-goal-done");
    toggle.disabled=false;
    toggle.textContent=g.done
      ?"✓ 達成済み（未達成に戻す）"
      :"✓ この目標を達成にする";
    toggle.classList.toggle("is-complete",g.done);
  }

  function renderGoals(){
    const svg=$("#goal-world");
    svg.replaceChildren();

    if(!goals.length)return;

    const roots=goals.filter(g=>g.final);
    const positions=new Map();
    const visited=new Set();
    const rootSpacing=760/Math.max(1,roots.length);

    roots.forEach((root,i)=>{
      const x=roots.length===1?500:120+rootSpacing*(i+.5);
      positions.set(root.id,{x,y:100});
      visited.add(root.id);
    });

    const place=(parent,depth)=>{
      const kids=goalChildren(parent.id).filter(g=>!visited.has(g.id));

      kids.forEach((g,i)=>{
        visited.add(g.id);

        const fraction=i-(kids.length-1)/2;
        const parentPos=positions.get(parent.id)||{x:500,y:100};
        const spread=Math.min(
          g.type==="intermediate"?270:180,
          720/Math.max(1,kids.length)
        );

        const x=Math.max(110,Math.min(890,parentPos.x+fraction*spread));
        positions.set(g.id,{x,y:100+(depth+1)*165});
        place(g,depth+1);
      });
    };

    roots.forEach(root=>place(root,0));

    goals.filter(g=>!positions.has(g.id)).forEach((g,i)=>{
      positions.set(g.id,{
        x:150+(i%4)*230,
        y:430+Math.floor(i/4)*130
      });
    });

    // 枝の色は子目標の進捗を表します。
    goals.forEach(g=>{
      if(g.parentId&&positions.has(g.id)&&positions.has(g.parentId)){
        const a=positions.get(g.parentId);
        const b=positions.get(g.id);
        const line=document.createElementNS("http://www.w3.org/2000/svg","path");

        line.setAttribute(
          "d",
          `M ${a.x} ${a.y+43} C ${a.x} ${a.y+85}, ${b.x} ${b.y-65}, ${b.x} ${b.y-43}`
        );

        line.setAttribute(
          "class",
          `goal-branch ${goalProgress(g)===100?"branch-complete":""}`
        );

        svg.append(line);
      }
    });

    goals.forEach(g=>{
      const p=positions.get(g.id);
      const pct=goalProgress(g);
      const group=document.createElementNS("http://www.w3.org/2000/svg","g");

      // completed は進捗率ではなく、この目標自身の done 状態だけで決めます。
      group.setAttribute("transform",`translate(${p.x-105},${p.y-43})`);
      group.setAttribute(
        "class",
        `goal-node ${g.id===selectedGoalId?"chosen":""} ${g.final?"final":""} ${g.done?"completed":""} ${pct>0&&pct<100?"in-progress":""}`
      );

      group.setAttribute("data-goal-id",g.id);
      group.style.cursor="pointer";

      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("width",210);
      rect.setAttribute("height",86);
      rect.setAttribute("rx",g.final?16:13);
      group.append(rect);

      const text=document.createElementNS("http://www.w3.org/2000/svg","text");
      text.setAttribute("x",105);
      text.setAttribute("y",30);
      text.textContent=g.name.length>15?g.name.slice(0,14)+"…":g.name;
      group.append(text);

      const sub=document.createElementNS("http://www.w3.org/2000/svg","text");
      sub.setAttribute("x",105);
      sub.setAttribute("y",51);
      sub.setAttribute("class","goal-node-sub");
      sub.textContent=`${g.final?"最終目標":g.type==="intermediate"?"中間目標":"小目標"} · ${pct}%`;
      group.append(sub);

      const track=document.createElementNS("http://www.w3.org/2000/svg","rect");
      track.setAttribute("x",25);
      track.setAttribute("y",67);
      track.setAttribute("width",160);
      track.setAttribute("height",5);
      track.setAttribute("rx",3);
      track.setAttribute("class","goal-progress-track");
      group.append(track);

      const fill=document.createElementNS("http://www.w3.org/2000/svg","rect");
      fill.setAttribute("x",25);
      fill.setAttribute("y",67);
      fill.setAttribute("width",160*pct/100);
      fill.setAttribute("height",5);
      fill.setAttribute("rx",3);
      fill.setAttribute("class","goal-progress-fill");
      group.append(fill);

      group.addEventListener("click",()=>selectGoal(g.id));
      svg.append(group);
    });

    $("#goal-world").setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
    );

    if(!goals.some(g=>g.id===selectedGoalId)){
      selectedGoalId=roots[0]?.id||goals[0]?.id;
    }

    $$(".goal-node").forEach(n=>{
      n.classList.toggle("chosen",n.dataset.goalId===selectedGoalId);
    });

    renderGoalDetail();
  }

  function selectGoal(id,rerender=true){
    selectedGoalId=id;
    if(rerender)renderGoals();
    else renderGoalDetail();
  }

  function populateGoalParents(preferredId=""){
    const type=$("#goal-type").value;
    const root=goals.find(g=>g.final);

    const candidates=goals.filter(g=>
      g.id!==editingGoalId&&
      !isGoalDescendant(g.id,editingGoalId||"")
    );

    const allowed=type==="intermediate"
      ?candidates.filter(g=>g.final)
      :type==="small"
        ?candidates.filter(g=>!g.final)
        :[];

    const parentField=$("#goal-parent");
    const parentLabel=$("#goal-parent-field");

    parentField.innerHTML=
      `<option value="">${type==="final"?"親目標なし":"親目標を選択"}</option>`+
      allowed.map(g=>`
        <option value="${esc(g.id)}">
          ${esc(g.name)}（${g.final?"最終目標":g.type==="intermediate"?"中間目標":"小目標"}）
        </option>
      `).join("");

    parentLabel.hidden=type==="final";
    parentField.required=type!=="final";

    let wanted=preferredId;

    if(!allowed.some(g=>g.id===wanted)){
      if(type==="intermediate"){
        wanted=root?.id||"";
      }else if(type==="small"){
        wanted=selectedGoalId&&allowed.some(g=>g.id===selectedGoalId)
          ?selectedGoalId
          :allowed.find(g=>g.type==="intermediate")?.id||allowed[0]?.id||"";
      }else{
        wanted="";
      }
    }

    parentField.value=wanted;
  }

  function openGoalDialog(goal=null,parentId=null){
    editingGoalId=goal?.id||null;

    const root=goals.find(g=>g.final);
    const inferredType=goal
      ?(goal.final?"final":goal.type||"small")
      :parentId
        ?(parentId===root?.id?"intermediate":"small")
        :root
          ?"intermediate"
          :"final";

    $("#goal-dialog-title").textContent=goal?"目標を編集":"目標を追加";
    $("#goal-name").value=goal?.name||"";
    $("#goal-note").value=goal?.note||"";
    $("#goal-type").value=inferredType;
    $("#goal-due-date").value=goal?.dueDate||"";

    populateGoalParents(
      parentId||goal?.parentId||(inferredType==="intermediate"?root?.id:"")
    );

    $("#goal-dialog").showModal();
  }

  $("#goal-type").addEventListener("change",()=>{
    populateGoalParents($("#goal-parent").value);
  });

  $("#add-goal").addEventListener("click",()=>openGoalDialog());
  $("#add-child-goal").addEventListener("click",()=>openGoalDialog(null,selectedGoalId));

  $("#edit-goal").addEventListener("click",()=>{
    const g=goals.find(x=>x.id===selectedGoalId);
    if(g)openGoalDialog(g);
  });

  $("#goal-form").addEventListener("submit",e=>{
    e.preventDefault();

    const name=$("#goal-name").value.trim();
    const type=$("#goal-type").value;

    if(!name)return toast("目標名を入力してください。");

    let parentId=$("#goal-parent").value||null;
    const dueDate=$("#goal-due-date").value||"";

    if(type==="final"){
      parentId=null;
    }else{
      if(!parentId)return toast("親目標を選択してください。");

      const parent=goals.find(g=>g.id===parentId);
      if(!parent)return toast("選択した親目標が見つかりません。");

      if(type==="intermediate"&&!parent.final){
        return toast("中間目標の親には最終目標を選択してください。");
      }

      if(type==="small"&&parent.final){
        return toast("小目標の親には中間目標または小目標を選択してください。");
      }

      if(editingGoalId&&(parentId===editingGoalId||isGoalDescendant(parentId,editingGoalId))){
        return toast("自分自身や自分の子孫は親目標にできません。");
      }

      const editingCurrent=goals.find(g=>g.id===editingGoalId);

      if(editingCurrent?.final&&goals.filter(g=>g.final).length===1){
        return toast("最後の最終目標は種類を変更できません。先に別の最終目標を作成してください。");
      }
    }

    const current=goals.find(g=>g.id===editingGoalId);

    if(current){
      Object.assign(current,{
        name,
        note:$("#goal-note").value.trim(),
        parentId,
        final:type==="final",
        type,
        dueDate
      });
    }else{
      const g={
        id:uid(),
        name,
        note:$("#goal-note").value.trim(),
        parentId,
        final:type==="final",
        type,
        dueDate,
        done:false,
        x:500,
        y:300
      };
      goals.push(g);
      selectedGoalId=g.id;
    }

    normalizeGoalTree();
    persistGoals();
    $("#goal-dialog").close();
    renderGoals();
    toast("目標を保存しました。");
  });

  // 選択した目標自身の達成状態だけを切り替えます。
  // 子目標の進捗率とは連動して自動変更しません。
  $("#toggle-goal-done").addEventListener("click",()=>{
    const g=goals.find(x=>x.id===selectedGoalId);
    if(!g)return;

    g.done=!g.done;
    persistGoals();
    renderGoals();

    toast(g.done
      ?"この目標自体を達成済みにしました。"
      :"この目標自体を未達成に戻しました。");
  });

  $("#delete-goal").addEventListener("click",()=>{
    const g=goals.find(x=>x.id===selectedGoalId);
    if(!g)return;

    if(g.final&&goals.filter(x=>x.final).length===1){
      return toast("最後の最終目標は削除できません。先に別の最終目標を作成してください。");
    }

    if(goalChildren(g.id).length){
      return toast("先に子目標を別の親へ移動するか、削除してください。");
    }

    if(!confirm(`「${g.name}」を削除しますか？`))return;

    goals=goals.filter(x=>x.id!==g.id);
    selectedGoalId=goals.find(x=>x.final)?.id||goals[0]?.id;

    normalizeGoalTree();
    persistGoals();
    renderGoals();
  });

  function zoom(factor,cx=500,cy=350){
    const old=pan.scale;
    pan.scale=Math.max(.45,Math.min(2.2,pan.scale*factor));
    pan.x=cx-(cx-pan.x)*pan.scale/old;
    pan.y=cy-(cy-pan.y)*pan.scale/old;

    $("#goal-world").setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
    );
  }

  $("#zoom-in").addEventListener("click",()=>zoom(1.15));
  $("#zoom-out").addEventListener("click",()=>zoom(1/1.15));

  $("#reset-map").addEventListener("click",()=>{
    pan={x:0,y:0,scale:1};
    renderGoals();
  });

  const canvas=$("#goal-canvas");

  canvas.addEventListener("pointerdown",e=>{
    if(e.target.closest(".goal-node"))return;
    canvas.setPointerCapture(e.pointerId);
    dragging={
      x:e.clientX,
      y:e.clientY,
      px:pan.x,
      py:pan.y
    };
  });

  canvas.addEventListener("pointermove",e=>{
    if(!dragging)return;

    pan.x=dragging.px+(e.clientX-dragging.x);
    pan.y=dragging.py+(e.clientY-dragging.y);

    $("#goal-world").setAttribute(
      "transform",
      `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
    );
  });

  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>{
    canvas.addEventListener(ev,()=>dragging=null);
  });

  canvas.addEventListener("wheel",e=>{
    e.preventDefault();
    zoom(e.deltaY<0?1.08:1/1.08);
  },{passive:false});

  let pointers=new Map();

  canvas.addEventListener("pointerdown",e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

    if(pointers.size===2){
      const p=[...pointers.values()];
      pinchStart={
        distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),
        scale:pan.scale
      };
    }
  });

  canvas.addEventListener("pointermove",e=>{
    if(!pointers.has(e.pointerId))return;

    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});

    if(pointers.size===2&&pinchStart){
      const p=[...pointers.values()];
      const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);

      pan.scale=Math.max(.45,Math.min(2.2,pinchStart.scale*d/pinchStart.distance));

      $("#goal-world").setAttribute(
        "transform",
        `translate(${pan.x} ${pan.y}) scale(${pan.scale})`
      );
    }
  });

  ["pointerup","pointercancel"].forEach(ev=>{
    canvas.addEventListener(ev,e=>{
      pointers.delete(e.pointerId);
      if(pointers.size<2)pinchStart=null;
    });
  });

  // タイマー状態を復元します。
  if(running){
    if(tick)clearInterval(tick);
    tick=setInterval(()=>{
      updateTimerUI();
      persistTimer();
    },500);
  }else if(elapsedBase>0){
    paused=true;
  }

  if(timer.subjectId)selectedSubject=timer.subjectId;
  if(timer.itemId)selectedItem=timer.itemId;

  persistStudy();
  renderHome();
  renderSubjects();
  renderRecords();
  renderGoals();

  // カレンダー・タスクは既存の保存形式を維持します。
  let calendar=read(KEYS.calendar,{events:[],tasks:[]});
  if(!Array.isArray(calendar.events))calendar.events=[];
  if(!Array.isArray(calendar.tasks))calendar.tasks=[];

  let calDate=new Date();
  let selectedDate=todayKey();

  const dateText=k=>{
    const d=localDate(k);
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${"日月火水木金土"[d.getDay()]}）`;
  };

  const saveCalendar=()=>save(KEYS.calendar,calendar);
  const dayEvents=k=>calendar.events.filter(x=>x.date===k);

  function renderCalendar(){
    const grid=$("#calendar-grid");
    if(!grid)return;

    $("#month-title").textContent=`${calDate.getFullYear()}年${calDate.getMonth()+1}月`;
    grid.replaceChildren();

    ["日","月","火","水","木","金","土"].forEach(n=>{
      const h=document.createElement("div");
      h.className="muted center small";
      h.textContent=n;
      grid.append(h);
    });

    const first=new Date(calDate.getFullYear(),calDate.getMonth(),1);
    const start=new Date(first);
    start.setDate(1-first.getDay());

    for(let i=0;i<42;i++){
      const d=new Date(start);
      d.setDate(start.getDate()+i);

      const k=todayKey(d);
      const b=document.createElement("button");

      b.type="button";
      b.className="day-cell"+
        (d.getMonth()!==calDate.getMonth()?" outside":"")+
        (k===todayKey()?" today":"")+
        (k===selectedDate?" selected":"");

      const events=dayEvents(k).length;
      const tasks=calendar.tasks.filter(t=>t.date===k&&!t.completed).length;

      b.innerHTML=`
        <span class="day-number">${d.getDate()}</span>
        <span class="day-markers">
          ${events?'<i></i>':''}
          ${tasks?'<i class="task-dot"></i>':''}
        </span>
      `;

      b.addEventListener("click",()=>{
        selectedDate=k;
        calDate=new Date(d.getFullYear(),d.getMonth(),1);
        renderCalendarAll();
      });

      grid.append(b);
    }
  }

  function renderDayItems(){
    const box=$("#day-items");
    if(!box)return;

    $("#selected-date-title").textContent=dateText(selectedDate)+" の予定";
    box.replaceChildren();

    const ev=dayEvents(selectedDate).sort((a,b)=>(a.start||"").localeCompare(b.start||""));

    if(!ev.length){
      box.innerHTML=empty("この日の予定はありません。＋予定から追加できます。");
    }

    ev.forEach(x=>{
      const row=document.createElement("article");
      row.className="event-card";

      row.innerHTML=`
        <i class="event-stripe"></i>
        <div>
          <h3>${esc(x.title)}</h3>
          <p>${esc(x.notes||"")}</p>
          <small>${esc(x.start||"")}${x.end?"〜"+esc(x.end):""}</small>
        </div>
        <button class="secondary-button" type="button">編集</button>
      `;

      row.querySelector("button").addEventListener("click",()=>openEvent(x));
      box.append(row);
    });
  }

  function renderTasks(){
    const box=$("#task-list");
    if(!box)return;

    box.replaceChildren();

    if(!calendar.tasks.length){
      box.innerHTML=empty("タスクはまだありません。");
      return;
    }

    calendar.tasks.forEach(t=>{
      const row=document.createElement("div");
      row.className="task-row"+(t.completed?" done":"");

      row.innerHTML=`
        <input type="checkbox" ${t.completed?"checked":""} aria-label="完了">
        <div class="task-main">
          <strong>${esc(t.title)}</strong>
          <small>${t.date?"期限："+dateText(t.date):"期限なし"}</small>
        </div>
        <button class="secondary-button" type="button">編集</button>
      `;

      row.querySelector("input").addEventListener("change",e=>{
        t.completed=e.target.checked;
        saveCalendar();
        renderTasks();
        renderCalendar();
      });

      row.querySelector("button").addEventListener("click",()=>openTask(t));
      box.append(row);
    });
  }

  function renderCalendarAll(){
    renderCalendar();
    renderDayItems();
    renderTasks();
  }

  function openEvent(ev=null){
    const f=$("#event-form");
    f.reset();

    $("#event-id").value=ev?.id||"";
    $("#event-title").value=ev?.title||"";
    $("#event-date").value=ev?.date||selectedDate;
    $("#event-start").value=ev?.start||"";
    $("#event-end").value=ev?.end||"";
    $("#event-notes").value=ev?.notes||"";
    $("#event-dialog-title").textContent=ev?"予定を編集":"予定を追加";
    $("#delete-event").hidden=!ev;

    $("#event-dialog").showModal();
  }

  function openTask(t=null){
    $("#task-form").reset();

    $("#task-id").value=t?.id||"";
    $("#task-title").value=t?.title||"";
    $("#task-date").value=t?.date||selectedDate;
    $("#task-notes").value=t?.notes||"";
    $("#task-dialog-title").textContent=t?"タスクを編集":"タスクを追加";
    $("#delete-task").hidden=!t;

    $("#task-dialog").showModal();
  }

  $("#add-event-day")?.addEventListener("click",()=>openEvent());
  $("#add-task-button")?.addEventListener("click",()=>openTask());

  $("#event-form")?.addEventListener("submit",e=>{
    e.preventDefault();

    const ev={
      id:$("#event-id").value||uid(),
      title:$("#event-title").value.trim(),
      date:$("#event-date").value,
      start:$("#event-start").value,
      end:$("#event-end").value,
      notes:$("#event-notes").value.trim()
    };

    if(!ev.title||!ev.date)return;

    const i=calendar.events.findIndex(x=>x.id===ev.id);
    if(i<0)calendar.events.push(ev);
    else calendar.events[i]=ev;

    selectedDate=ev.date;

    const d=localDate(ev.date);
    calDate=new Date(d.getFullYear(),d.getMonth(),1);

    saveCalendar();
    $("#event-dialog").close();
    renderCalendarAll();
    toast("予定を保存しました。");
  });

  $("#delete-event")?.addEventListener("click",()=>{
    const id=$("#event-id").value;
    if(!id)return;
    if(!confirm("この予定を削除しますか？"))return;

    calendar.events=calendar.events.filter(x=>x.id!==id);
    saveCalendar();
    $("#event-dialog").close();
    renderCalendarAll();
  });

  $("#task-form")?.addEventListener("submit",e=>{
    e.preventDefault();

    const tid=$("#task-id").value;
    const old=calendar.tasks.find(x=>x.id===tid);

    const t={
      id:tid||uid(),
      title:$("#task-title").value.trim(),
      date:$("#task-date").value,
      notes:$("#task-notes").value.trim(),
      completed:old?.completed||false
    };

    if(!t.title)return;

    const i=calendar.tasks.findIndex(x=>x.id===t.id);
    if(i<0)calendar.tasks.push(t);
    else calendar.tasks[i]=t;

    saveCalendar();
    $("#task-dialog").close();
    renderCalendarAll();
    toast("タスクを保存しました。");
  });

  $("#delete-task")?.addEventListener("click",()=>{
    const id=$("#task-id").value;
    if(!id)return;
    if(!confirm("このタスクを削除しますか？"))return;

    calendar.tasks=calendar.tasks.filter(x=>x.id!==id);
    saveCalendar();
    $("#task-dialog").close();
    renderCalendarAll();
  });

  $("#quick-task-form")?.addEventListener("submit",e=>{
    e.preventDefault();

    const title=$("#quick-task-title").value.trim();
    if(!title)return;

    calendar.tasks.push({
      id:uid(),
      title,
      date:selectedDate,
      notes:"",
      completed:false
    });

    e.target.reset();
    saveCalendar();
    renderCalendarAll();
    toast("タスクを追加しました。");
  });

  $("#prev-month")?.addEventListener("click",()=>{
    calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);
    renderCalendar();
  });

  $("#next-month")?.addEventListener("click",()=>{
    calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);
    renderCalendar();
  });

  $("#today-button")?.addEventListener("click",()=>{
    selectedDate=todayKey();
    const d=new Date();
    calDate=new Date(d.getFullYear(),d.getMonth(),1);
    renderCalendarAll();
  });

  // カレンダーを初期表示します。
  renderCalendarAll();

})();