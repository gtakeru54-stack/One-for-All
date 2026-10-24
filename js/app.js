
/* ONE FOR ALL — COSMOS / js/app.js */
"use strict";
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const KEYS = { study:"oneforall-study-v1", timer:"oneforall-timer-v1", goals:"oneforall-goals-v1", calendar:"personal-calendar-v1", countdowns:"oneforall-countdowns-v1" };
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

  // Existing oneforall-study-v1 records and categories are migrated in memory, not deleted.
  const oldStudy = read(KEYS.study,{});
  const state = {
    subjects: Array.isArray(oldStudy.subjects) ? oldStudy.subjects : [],
    items: Array.isArray(oldStudy.items) ? oldStudy.items : [],
    records: (Array.isArray(oldStudy.records)?oldStudy.records:[]).map(r=>({
      id:String(r.id||uid()), subject:String(r.subject||r.category||"未分類"),
      item:String(r.item||r.title||"学習"), date:/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")?r.date:todayKey(),
      seconds:Math.max(0,Math.round(Number(r.durationSeconds ?? (Number(r.minutes)||0)*60)||0)),
      createdAt:Number(r.createdAt)||Date.now()
    })),
    targets: oldStudy.targets || {day:{kind:"time",value:120,unit:"minutes"},week:{kind:"time",value:600,unit:"minutes"},month:{kind:"time",value:2400,unit:"minutes"}}
  };
  (Array.isArray(oldStudy.categories)?oldStudy.categories:[]).forEach(name=>{
    if(name && !state.subjects.some(s=>s.name===name)) state.subjects.push({id:uid(),name});
  });
  state.records.forEach(r=>{
    if(!state.subjects.some(s=>s.name===r.subject)) state.subjects.push({id:uid(),name:r.subject});
  });
  if(!state.subjects.length) state.subjects=[{id:uid(),name:"数学"},{id:uid(),name:"英語"},{id:uid(),name:"理科"}];
  state.items = state.items.map(i=>({id:String(i.id||uid()),subjectId:String(i.subjectId||state.subjects.find(s=>s.name===i.subject)?.id||state.subjects[0].id),name:String(i.name||i.title||"学習項目")}));
  state.records.forEach(r=>{ if(!state.items.some(i=>i.subjectId===state.subjects.find(s=>s.name===r.subject)?.id && i.name===r.item)){const s=state.subjects.find(s=>s.name===r.subject); if(s) state.items.push({id:uid(),subjectId:s.id,name:r.item});} });
  let selectedSubject = state.subjects[0]?.id || "";
  let selectedItem = "";
  let timer = read(KEYS.timer,{elapsedSeconds:0,running:false,paused:false,startedAt:null,subjectId:"",itemId:""});
  let tick = null, elapsedBase=Math.max(0,Number(timer.elapsedSeconds)||0), startedAt=timer.running&&timer.startedAt?Number(timer.startedAt):null, running=Boolean(startedAt), paused=Boolean(timer.paused);
  let period="day", selectedGoalId=null, editingGoalId=null, pan={x:0,y:0,scale:1}, dragging=null, pinchStart=null;
  let goals = read(KEYS.goals, null);
  if(!Array.isArray(goals)||!goals.length) goals=[{id:uid(),name:"最終目標",note:"ここに叶えたい目標を書く",parentId:null,final:true,x:500,y:110},{id:uid(),name:"中間目標 1",note:"最初の大きな一歩",parentId:null,final:false,x:300,y:330},{id:uid(),name:"中間目標 2",note:"次に取り組むこと",parentId:null,final:false,x:700,y:330}];
  if(!goals.some(g=>g.final)) goals[0].final=true;
  selectedGoalId=goals.find(g=>g.final)?.id;

  function persistStudy(){ save(KEYS.study,{subjects:state.subjects,items:state.items,records:state.records.map(r=>({id:r.id,category:r.subject,item:r.item,date:r.date,durationSeconds:r.seconds,createdAt:r.createdAt})),categories:state.subjects.map(s=>s.name),dailyGoalMinutes:120,targets:state.targets}); }
  function persistTimer(){ save(KEYS.timer,{elapsedSeconds:Math.max(0,Math.floor(elapsedBase)),running,paused,startedAt,subjectId:timer.subjectId||selectedSubject,itemId:timer.itemId||selectedItem}); }
  function persistGoals(){save(KEYS.goals,goals);}
  function showView(name){ $$(".view").forEach(v=>{const on=v.id===`view-${name}`;v.hidden=!on;v.classList.toggle("active",on);}); $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name)); if(name==="records")renderRecords(); if(name==="subjects")renderSubjects(); if(name==="goals")renderGoals(); if(name==="home")renderHome(); if(name==="calendar")renderCalendarAll(); window.scrollTo({top:0,behavior:"smooth"}); }
  $$('[data-view]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showView(b.dataset.view);}));
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
  $("#today-chip").textContent=new Date().toLocaleDateString("ja-JP",{month:"short",day:"numeric",weekday:"short"});

  function subjectForRecord(r){return r.subject||"未分類";}
  function recordsForDates(start,end){return state.records.filter(r=>r.date>=start&&r.date<=end);}
  function total(records){return records.reduce((s,r)=>s+r.seconds,0);}
  function currentRange(){
    const today=localDate(todayKey());
    if(period==="day")return {start:todayKey(),end:todayKey(),title:"今日",labels:["今日"],dates:[todayKey()]};
    if(period==="week"){const monday=dayOffset(today,-((today.getDay()+6)%7));const dates=Array.from({length:7},(_,i)=>todayKey(dayOffset(monday,i)));return {start:dates[0],end:dates[6],title:"今週（月〜日）",labels:dates.map(k=>{const d=localDate(k);return `${d.getMonth()+1}/${d.getDate()}`}),dates};}
    const start=new Date(today.getFullYear(),today.getMonth(),1),end=new Date(today.getFullYear(),today.getMonth()+1,0);
    const dates=Array.from({length:end.getDate()},(_,i)=>todayKey(dayOffset(start,i)));
    return {start:dates[0],end:dates[dates.length-1],title:`${today.getFullYear()}年${today.getMonth()+1}月`,labels:dates.map(k=>String(localDate(k).getDate())),dates};
  }
  function secondsForPeriod(){const r=currentRange();return total(recordsForDates(r.start,r.end));}
  function renderHome(){
    const today=total(recordsForDates(todayKey(),todayKey()));
    const now=localDate(todayKey());const monday=dayOffset(now,-((now.getDay()+6)%7));const sunday=dayOffset(monday,6);const week=total(recordsForDates(todayKey(monday),todayKey(sunday)));
    const all=total(state.records);
    $("#home-today").textContent=duration(today);$("#stat-today").textContent=duration(today);$("#stat-week").textContent=duration(week);$("#stat-all").textContent=duration(all);
    const target=Number(state.targets.day?.value)||120, unit=state.targets.day?.unit||"minutes";
    const targetSeconds=target*(unit==="hours"?3600:60), pct=targetSeconds?Math.min(100,Math.round(today/targetSeconds*100)):0;
    $("#home-progress").style.width=pct+"%";$("#home-progress-label").textContent=`今日の目標 ${pct}%`;
    const recent=[...state.records].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
    $("#home-records").innerHTML=recent.length?recent.map(recordHTML).join(""):empty("学習記録はまだありません。科目からタイマーを使って記録しましょう。");
  }
  function empty(msg){return `<div class="empty"><span>✧</span><p>${esc(msg)}</p></div>`;}
  function recordHTML(r){return `<article class="record"><i style="background:${COLORS[Math.abs(r.subject.length)%COLORS.length]}"></i><div><b>${esc(r.item)}</b><small>${esc(r.subject)} · ${esc(r.date)}</small></div><strong>${duration(r.seconds)}</strong></article>`;}
  function renderSubjects(){
    $("#subject-list").innerHTML=state.subjects.map((s,i)=>`<button class="subject-card ${selectedSubject===s.id?"selected":""}" data-subject="${esc(s.id)}"><span class="subject-symbol" style="--subject-color:${COLORS[i%COLORS.length]}">✦</span><span><b>${esc(s.name)}</b><small>${state.items.filter(x=>x.subjectId===s.id).length}項目 · 累計 ${duration(total(state.records.filter(r=>r.subject===s.name)))}</small></span><span>›</span></button>`).join("") || empty("まず科目を作成してください。");
    $("#subject-list").querySelectorAll("[data-subject]").forEach(b=>b.addEventListener("click",()=>{selectedSubject=b.dataset.subject;selectedItem="";renderSubjects();renderSubjectDetail();}));
    if(selectedSubject&&state.subjects.some(s=>s.id===selectedSubject))renderSubjectDetail();else $("#subject-detail").hidden=true;
  }
  function renderSubjectDetail(){
    const s=state.subjects.find(x=>x.id===selectedSubject);if(!s){$("#subject-detail").hidden=true;return;}
    $("#subject-detail").hidden=false;$("#detail-title").textContent=s.name;
    const items=state.items.filter(i=>i.subjectId===s.id);
    $("#item-list").innerHTML=items.map(i=>{const secs=total(state.records.filter(r=>r.subject===s.name&&r.item===i.name));return `<article class="item-card"><div><b>${esc(i.name)}</b><small>累計 ${duration(secs)}</small></div><button class="primary-button start-item" data-item="${esc(i.id)}">▶ 計測</button></article>`;}).join("")||empty("この科目に学習項目はありません。「学習項目」から追加できます。");
    $$(".start-item").forEach(b=>b.addEventListener("click",()=>startForItem(b.dataset.item)));
    const hasTimer=timer.subjectId===s.id && (elapsed()>0||running||paused);
    $("#timer-panel").hidden=!hasTimer;
    if(hasTimer){selectedItem=timer.itemId;const item=state.items.find(i=>i.id===selectedItem);$("#timer-label").textContent=`${s.name} · ${item?.name||"学習"}`;updateTimerUI();}
  }
  $("#add-subject").addEventListener("click",()=>{ $("#subject-form").reset();$("#subject-dialog").showModal(); });
  $("#subject-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#subject-name").value.trim();if(!name)return;if(state.subjects.some(s=>s.name.toLowerCase()===name.toLowerCase()))return toast("同じ名前の科目があります。");const s={id:uid(),name};state.subjects.push(s);selectedSubject=s.id;persistStudy();$("#subject-dialog").close();renderSubjects();renderHome();toast("科目を作成しました。");});
  $("#close-subject").addEventListener("click",()=>{$("#subject-detail").hidden=true;});
  $("#add-item").addEventListener("click",()=>{if(!selectedSubject)return toast("先に科目を選んでください。");$("#item-form").reset();$("#item-dialog").showModal();});
  $("#item-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#item-name").value.trim();if(!name||!selectedSubject)return;const item={id:uid(),subjectId:selectedSubject,name};state.items.push(item);selectedItem=item.id;persistStudy();$("#item-dialog").close();renderSubjects();toast("学習項目を追加しました。");});
  function startForItem(id){const item=state.items.find(i=>i.id===id);if(!item)return;selectedSubject=item.subjectId;selectedItem=id;
    if(elapsed()>0 && (timer.itemId!==id||timer.subjectId!==selectedSubject) && !confirm("計測中の時間があります。今の計測を記録せずに切り替えますか？"))return;
    if(timer.itemId!==id||timer.subjectId!==selectedSubject){elapsedBase=0;running=false;paused=false;startedAt=null;}
    timer.subjectId=selectedSubject;timer.itemId=id;$("#timer-panel").hidden=false;const s=state.subjects.find(x=>x.id===selectedSubject);$("#timer-label").textContent=`${s?.name||""} · ${item.name}`;renderSubjects();startTimer();$("#timer-panel").scrollIntoView({behavior:"smooth",block:"center"});
  }
  function elapsed(){return elapsedBase+(running&&startedAt?Math.max(0,(Date.now()-startedAt)/1000):0);}
  function updateTimerUI(){ $("#timer-display").textContent=timerText(elapsed());$("#timer-start").disabled=running;$("#timer-pause").disabled=!running;$("#timer-finish").disabled=elapsed()<1;$("#timer-state").textContent=running?"計測中です。別画面に移動しても時間は進みます。":paused?"一時停止中です。":"開始すると学習時間を計測します。";$("#timer-start").textContent=paused?"▶ 再開":"▶ 開始"; }
  function startTimer(){if(running)return;if(!timer.itemId){toast("学習項目を選んでください。");return;}running=true;paused=false;startedAt=Date.now();persistTimer();if(tick)clearInterval(tick);tick=setInterval(()=>{updateTimerUI();persistTimer();},500);updateTimerUI();}
  function pauseTimer(){if(!running)return;elapsedBase=elapsed();running=false;paused=true;startedAt=null;if(tick)clearInterval(tick);tick=null;persistTimer();updateTimerUI();}
  function finishTimer(){const sec=Math.floor(elapsed());if(sec<1)return toast("記録できる時間がありません。");const s=state.subjects.find(x=>x.id===timer.subjectId),i=state.items.find(x=>x.id===timer.itemId);state.records.push({id:uid(),subject:s?.name||"未分類",item:i?.name||"学習",date:todayKey(),seconds:sec,createdAt:Date.now()});elapsedBase=0;running=false;paused=false;startedAt=null;if(tick)clearInterval(tick);tick=null;persistStudy();persistTimer();updateTimerUI();renderSubjects();renderHome();renderRecords();toast(`${duration(sec)}を記録しました。`);}
  $("#timer-start").addEventListener("click",startTimer);$("#timer-pause").addEventListener("click",pauseTimer);$("#timer-finish").addEventListener("click",finishTimer);

  function renderRecords(){
    const range=currentRange(), recs=recordsForDates(range.start,range.end), secs=total(recs);
    $("#period-title").textContent=range.title;$("#period-total").textContent=duration(secs);
    $$(".segmented button").forEach(b=>b.classList.toggle("active",b.dataset.period===period));
    drawBars(range,recs);drawDonut(range,recs);
    const bySubject={};recs.forEach(r=>bySubject[r.subject]=(bySubject[r.subject]||0)+r.seconds);
    const entries=Object.entries(bySubject).sort((a,b)=>b[1]-a[1]);
    $("#subject-breakdown").innerHTML=entries.length?entries.map(([name,val])=>{const colorIndex=Math.max(0,state.subjects.findIndex(s=>s.name===name));const color=COLORS[colorIndex%COLORS.length];return `<div class="break-row"><div><span class="legend-dot" style="background:${color}"></span><b>${esc(name)}</b><strong>${duration(val)}</strong></div><div class="progress-track"><span style="width:${secs?val/secs*100:0}%;background:${color}"></span></div></div>`}).join(""):empty("この期間の学習記録はありません。");
    $("#period-records").innerHTML=recs.length?[...recs].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(recordHTML).join(""):empty("この期間の記録はまだありません。");
  }
  $$(".segmented button").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period;renderRecords();}));
  function drawBars(range,recs){
    const c=$("#bar-chart"),ctx=c.getContext("2d"),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    c.width=Math.max(280,rect.width)*dpr;c.height=220*dpr;ctx.scale(dpr,dpr);const w=c.width/dpr,h=220;ctx.clearRect(0,0,w,h);
    const subjects=state.subjects.map(s=>s.name).filter(name=>recs.some(r=>r.subject===name));const totals=range.dates.map(date=>total(recs.filter(r=>r.date===date)));const max=Math.max(60,...totals);const pad={l:8,r:8,t:18,b:30};const plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
    ctx.font="10px system-ui";ctx.textAlign="center";
    for(let i=0;i<4;i++){const y=pad.t+plotH*i/3;ctx.strokeStyle="rgba(160,180,230,.12)";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}
    const step=plotW/range.dates.length,bw=Math.max(3,Math.min(24,step*.58));
    range.dates.forEach((date,i)=>{let y=pad.t+plotH;subjects.forEach((subject,j)=>{const val=total(recs.filter(r=>r.date===date&&r.subject===subject));if(!val)return;const bh=val/max*(plotH-5);y-=bh;ctx.fillStyle=COLORS[j%COLORS.length];ctx.beginPath();if(ctx.roundRect)ctx.roundRect(pad.l+i*step+(step-bw)/2,y,bw,Math.max(1,bh),Math.min(4,bw/2));else ctx.rect(pad.l+i*step+(step-bw)/2,y,bw,Math.max(1,bh));ctx.fill();});if(range.dates.length<=7||i%5===0||i===range.dates.length-1){ctx.fillStyle="#8998b9";ctx.fillText(range.labels[i],pad.l+i*step+step/2,h-9);}});
  }
  function drawDonut(range,recs){
    const config=state.targets[period]||{kind:"time",value:period==="day"?120:period==="week"?600:2400,unit:"minutes"};
    $("#target-kind").value=config.kind;$("#target-value").value=config.value;$("#target-unit").value=config.unit||"minutes";$("#target-unit-label").style.display=config.kind==="time"?"grid":"none";
    const actual=config.kind==="time"?total(recs)/(config.unit==="hours"?3600:60):new Set(recs.map(r=>r.item)).size;
    const target=Math.max(1,Number(config.value)||1),pct=Math.min(100,Math.round(actual/target*100));
    $("#donut").style.background=`conic-gradient(#91adff ${pct*3.6}deg, rgba(140,157,196,.16) 0deg)`;
    $("#donut-percent").textContent=pct+"%";$("#target-progress-text").textContent=`${config.kind==="time"?Math.round(actual*10)/10:actual} / ${target} ${config.kind==="time"?(config.unit==="hours"?"時間":"分"):"項目"}`;
    $("#target-explain").textContent=pct>=100?"目標達成！設定した目標をクリアしました。":`あと ${Math.max(0,Math.ceil(target-actual))}${config.kind==="time"?(config.unit==="hours"?"時間":"分"):"項目"}で目標達成です。`;
  }
  $("#target-kind").addEventListener("change",()=>{$("#target-unit-label").style.display=$("#target-kind").value==="time"?"grid":"none";});
  $("#save-target").addEventListener("click",()=>{const value=Number($("#target-value").value);if(!Number.isFinite(value)||value<1)return toast("目標値は1以上にしてください。");state.targets[period]={kind:$("#target-kind").value,value,unit:$("#target-unit").value};persistStudy();renderRecords();renderHome();toast("この期間の目標を保存しました。");});
  window.addEventListener("resize",()=>{if(!$("#view-records").hidden)renderRecords();});

  function renderGoals(){
    const svg=$("#goal-world");svg.replaceChildren();const map=new Map(goals.map(g=>[g.id,g]));
    const root=goals.find(g=>g.final)||goals[0];if(!root)return;
    const children=id=>goals.filter(g=>g.parentId===id);
    const positions=new Map();positions.set(root.id,{x:500,y:100});
    const place=(parent,depth,slot,totalSlots)=>{const kids=children(parent.id);kids.forEach((g,i)=>{const fraction=(i-(kids.length-1)/2);const x=Math.max(120,Math.min(880,(positions.get(parent.id)?.x||500)+fraction*(depth===1?270:180)));const y=100+depth*165;positions.set(g.id,{x,y});place(g,depth+1,i,kids.length);});};
    place(root,1,0,1);
    goals.filter(g=>g.id!==root.id&&!positions.has(g.id)).forEach((g,i)=>positions.set(g.id,{x:150+(i%4)*230,y:430+Math.floor(i/4)*130}));
    goals.forEach(g=>{if(g.parentId&&positions.has(g.id)&&positions.has(g.parentId)){const a=positions.get(g.parentId),b=positions.get(g.id);const line=document.createElementNS("http://www.w3.org/2000/svg","path");line.setAttribute("d",`M ${a.x} ${a.y+42} C ${a.x} ${a.y+85}, ${b.x} ${b.y-60}, ${b.x} ${b.y-42}`);line.setAttribute("class","goal-branch");svg.append(line);}});
    goals.forEach(g=>{const p=positions.get(g.id),group=document.createElementNS("http://www.w3.org/2000/svg","g");group.setAttribute("transform",`translate(${p.x-105},${p.y-38})`);group.setAttribute("class",`goal-node ${g.id===selectedGoalId?"chosen":""} ${g.final?"final":""}`);group.style.cursor="pointer";
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("width",210);rect.setAttribute("height",76);rect.setAttribute("rx",g.final?15:12);group.append(rect);
      const text=document.createElementNS("http://www.w3.org/2000/svg","text");text.setAttribute("x",105);text.setAttribute("y",g.final?31:33);text.textContent=g.name.length>15?g.name.slice(0,14)+"…":g.name;group.append(text);
      const sub=document.createElementNS("http://www.w3.org/2000/svg","text");sub.setAttribute("x",105);sub.setAttribute("y",55);sub.setAttribute("class","goal-node-sub");sub.textContent=g.final?"✦ 最終目標":"目標";group.append(sub);
      group.addEventListener("click",()=>selectGoal(g.id));svg.append(group);
    });
    const moon=document.createElementNS("http://www.w3.org/2000/svg","g");moon.setAttribute("class","goal-moon");
    const moonCircle=document.createElementNS("http://www.w3.org/2000/svg","circle");moonCircle.setAttribute("cx","500");moonCircle.setAttribute("cy","635");moonCircle.setAttribute("r","28");moonCircle.setAttribute("fill","#dce7ff");moonCircle.setAttribute("stroke","#a9bfff");moonCircle.setAttribute("stroke-width","2");moon.append(moonCircle);
    [[-9,-7,5],[8,4,7],[-3,12,3]].forEach(([dx,dy,r])=>{const crater=document.createElementNS("http://www.w3.org/2000/svg","circle");crater.setAttribute("cx",String(500+dx));crater.setAttribute("cy",String(635+dy));crater.setAttribute("r",String(r));crater.setAttribute("fill","#aab9df");moon.append(crater);});
    const moonLabel=document.createElementNS("http://www.w3.org/2000/svg","text");moonLabel.setAttribute("x","500");moonLabel.setAttribute("y","680");moonLabel.setAttribute("text-anchor","middle");moonLabel.setAttribute("fill","#dce7ff");moonLabel.setAttribute("font-size","15");moonLabel.setAttribute("font-weight","700");moonLabel.textContent="☾ MOON · 目標達成";moon.append(moonLabel);svg.append(moon);
    const world=$("#goal-world");world.setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
    const g=goals.find(x=>x.id===selectedGoalId)||root;selectGoal(g.id,false);
  }
  function selectGoal(id,rerender=true){selectedGoalId=id;const g=goals.find(x=>x.id===id);if(!g)return;$("#selected-goal-title").textContent=g.name;$("#selected-goal-desc").textContent=g.note||"メモはありません。";if(rerender)renderGoals();else $$(".goal-node").forEach(n=>n.classList.toggle("chosen",n.querySelector("text")?.textContent===g.name));}
  function openGoalDialog(goal=null,parentId=null){editingGoalId=goal?.id||null;$("#goal-dialog-title").textContent=goal?"目標を編集":"目標を追加";$("#goal-name").value=goal?.name||"";$("#goal-note").value=goal?.note||"";$("#goal-final").checked=Boolean(goal?.final);$("#goal-parent").innerHTML=`<option value="">最終目標の下に配置</option>`+goals.filter(g=>g.id!==goal?.id).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("");$("#goal-parent").value=parentId||goal?.parentId||"";$("#goal-dialog").showModal();}
  $("#add-goal").addEventListener("click",()=>openGoalDialog());$("#add-child-goal").addEventListener("click",()=>openGoalDialog(null,selectedGoalId));$("#edit-goal").addEventListener("click",()=>{const g=goals.find(x=>x.id===selectedGoalId);if(g)openGoalDialog(g);});
  $("#goal-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#goal-name").value.trim();if(!name)return;const parentId=$("#goal-parent").value||null,final=$("#goal-final").checked;if(editingGoalId&&parentId===editingGoalId)return toast("自分自身を親目標にはできません。");if(final)goals.forEach(g=>g.final=false);
    if(editingGoalId){const g=goals.find(x=>x.id===editingGoalId);Object.assign(g,{name,note:$("#goal-note").value.trim(),parentId,final});}
    else{const g={id:uid(),name,note:$("#goal-note").value.trim(),parentId,final,x:500,y:300};goals.push(g);selectedGoalId=g.id;}
    if(!goals.some(g=>g.final))goals[0].final=true;persistGoals();$("#goal-dialog").close();renderGoals();toast("目標を保存しました。");});
  $("#delete-goal").addEventListener("click",()=>{const g=goals.find(x=>x.id===selectedGoalId);if(!g)return;if(g.final&&goals.length>1)return toast("最終目標は、先に別の目標を最終目標にしてから削除してください。");if(!confirm(`「${g.name}」を削除しますか？子目標は親目標なしになります。`))return;goals=goals.filter(x=>x.id!==g.id);goals.forEach(x=>{if(x.parentId===g.id)x.parentId=null;});selectedGoalId=goals.find(x=>x.final)?.id||goals[0]?.id;persistGoals();renderGoals();});
  function zoom(factor,cx=500,cy=350){const old=pan.scale;pan.scale=Math.max(.45,Math.min(2.2,pan.scale*factor));pan.x=cx-(cx-pan.x)*pan.scale/old;pan.y=cy-(cy-pan.y)*pan.scale/old;$("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);}
  $("#zoom-in").addEventListener("click",()=>zoom(1.15));$("#zoom-out").addEventListener("click",()=>zoom(1/1.15));$("#reset-map").addEventListener("click",()=>{pan={x:0,y:0,scale:1};renderGoals();});
  const canvas=$("#goal-canvas");
  canvas.addEventListener("pointerdown",e=>{if(e.target.closest(".goal-node"))return;canvas.setPointerCapture(e.pointerId);dragging={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};});
  canvas.addEventListener("pointermove",e=>{if(!dragging)return;pan.x=dragging.px+(e.clientX-dragging.x);pan.y=dragging.py+(e.clientY-dragging.y);$("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);});
  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>canvas.addEventListener(ev,()=>dragging=null));
  canvas.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);},{passive:false});
  let pointers=new Map();canvas.addEventListener("pointerdown",e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const p=[...pointers.values()];pinchStart={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),scale:pan.scale};}});
  canvas.addEventListener("pointermove",e=>{if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinchStart){const p=[...pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);pan.scale=Math.max(.45,Math.min(2.2,pinchStart.scale*d/pinchStart.distance));$("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);}});
  ["pointerup","pointercancel"].forEach(ev=>canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinchStart=null;}));

  // Initial timer restoration: running time continues across reloads.
  if(running){if(tick)clearInterval(tick);tick=setInterval(()=>{updateTimerUI();persistTimer();},500);}
  else if(elapsedBase>0)paused=true;
  if(timer.subjectId)selectedSubject=timer.subjectId;if(timer.itemId)selectedItem=timer.itemId;
  persistStudy();renderHome();renderSubjects();renderRecords();renderGoals();

  // Countdown styles are injected here to keep the replacement limited to js/app.js.
  if (!$("#countdown-style")) {
    const style=document.createElement("style");style.id="countdown-style";
    style.textContent=`.countdown-panel{margin:22px 0;padding:18px;border:1px solid rgba(145,173,255,.2);border-radius:20px;background:linear-gradient(145deg,rgba(28,42,75,.94),rgba(15,23,43,.96))}.countdown-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}.countdown-form label{display:grid;gap:5px;color:var(--muted,#929fbd);font-size:11px}.countdown-form input{width:100%;min-width:0;padding:10px;border:1px solid var(--line,rgba(164,184,235,.15));border-radius:11px;background:rgba(4,9,23,.55);color:var(--text,#f0f4ff)}.countdown-form button{grid-column:1/-1}.countdown-list{display:grid;gap:9px;margin-top:14px}.countdown-item{display:grid;grid-template-columns:minmax(0,1fr) auto 28px;gap:10px;align-items:center;padding:12px;border:1px solid var(--line,rgba(164,184,235,.15));border-radius:14px;background:rgba(5,11,26,.42)}.countdown-copy{min-width:0}.countdown-copy strong,.countdown-copy small{display:block;overflow-wrap:anywhere}.countdown-copy small{color:var(--muted,#929fbd);font-size:10px;margin-top:3px}.countdown-number{font-size:clamp(13px,3.7vw,19px);font-weight:800;color:#c0a1ff;white-space:nowrap}.countdown-delete{width:28px;height:28px;border:1px solid var(--line,rgba(164,184,235,.15));border-radius:50%;background:transparent;color:var(--muted,#929fbd);font-size:18px}@media(max-width:420px){.countdown-form{grid-template-columns:1fr}.countdown-form button{grid-column:auto}.countdown-item{grid-template-columns:minmax(0,1fr) auto 25px;gap:6px}}`;
    document.head.append(style);
  }

  // Custom event countdowns. Stored separately so existing study/calendar data is untouched.
  let countdowns = read(KEYS.countdowns, []);
  if (!Array.isArray(countdowns)) countdowns = [];
  function daysUntil(dateKey) {
    const [y,m,d] = dateKey.split("-").map(Number);
    const [ty,tm,td] = todayKey().split("-").map(Number);
    return Math.round((Date.UTC(y,m-1,d)-Date.UTC(ty,tm-1,td))/86400000);
  }
  function ensureCountdownPanel() {
    const home = $("#view-home");
    if (!home || $("#countdown-panel")) return;
    const panel = document.createElement("section");
    panel.className = "panel countdown-panel";
    panel.id = "countdown-panel";
    panel.innerHTML = `
      <div class="section-head"><div><p class="eyebrow">MISSION COUNTDOWN</p><h2>イベントまであと何日？</h2></div><span aria-hidden="true">🚀</span></div>
      <form id="countdown-form" class="countdown-form">
        <label>イベント名<input id="countdown-name" maxlength="60" placeholder="例：高校受験" required></label>
        <label>日付<input id="countdown-date" type="date" required></label>
        <button class="primary-button" type="submit">＋ 追加</button>
      </form>
      <div id="countdown-list" class="countdown-list"></div>`;
    const recent = home.querySelector("#home-records");
    const head = recent?.previousElementSibling;
    if (head) home.insertBefore(panel, head); else home.append(panel);
    const form = $("#countdown-form");
    form.addEventListener("submit", e => {
      e.preventDefault();
      const name = $("#countdown-name").value.trim();
      const date = $("#countdown-date").value;
      if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("イベント名と日付を入力してください。");
      countdowns.push({id:uid(), name, date});
      save(KEYS.countdowns, countdowns);
      form.reset();
      renderCountdowns();
      toast("カウントダウンを追加しました。");
    });
    renderCountdowns();
  }
  function renderCountdowns() {
    const list = $("#countdown-list");
    if (!list) return;
    list.replaceChildren();
    if (!countdowns.length) {
      list.innerHTML = '<p class="muted">受験・テスト・提出日などを登録できます。</p>';
      return;
    }
    countdowns.sort((a,b)=>a.date.localeCompare(b.date));
    countdowns.forEach(item => {
      const days = daysUntil(item.date);
      const row = document.createElement("article");
      row.className = "countdown-item";
      const countText = days > 0 ? `あと ${days} 日` : days === 0 ? "今日！" : `${Math.abs(days)} 日経過`;
      row.innerHTML = `<div class="countdown-copy"><strong>${esc(item.name)}</strong><small>${esc(item.date.replaceAll("-","/"))}</small></div><div class="countdown-number">${esc(countText)}</div><button type="button" class="countdown-delete" aria-label="${esc(item.name)}を削除">×</button>`;
      row.querySelector("button").addEventListener("click",()=>{
        if (!confirm(`「${item.name}」を削除しますか？`)) return;
        countdowns=countdowns.filter(x=>x.id!==item.id);
        save(KEYS.countdowns,countdowns);
        renderCountdowns();
      });
      list.append(row);
    });
  }
  ensureCountdownPanel();

  // Calendar and task management: stored separately to preserve the existing calendar data format.
  let calendar=read(KEYS.calendar,{events:[],tasks:[]});if(!Array.isArray(calendar.events))calendar.events=[];if(!Array.isArray(calendar.tasks))calendar.tasks=[];
  let calDate=new Date(),selectedDate=todayKey();
  const dateText=k=>{const d=localDate(k);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${"日月火水木金土"[d.getDay()]}）`;};
  const saveCalendar=()=>save(KEYS.calendar,calendar);
  const dayEvents=k=>calendar.events.filter(x=>x.date===k);
  function renderCalendar(){const grid=$("#calendar-grid");if(!grid)return;$("#month-title").textContent=`${calDate.getFullYear()}年${calDate.getMonth()+1}月`;grid.replaceChildren();["日","月","火","水","木","金","土"].forEach(n=>{const h=document.createElement("div");h.className="muted center small";h.textContent=n;grid.append(h);});const first=new Date(calDate.getFullYear(),calDate.getMonth(),1);const start=new Date(first);start.setDate(1-first.getDay());for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const k=todayKey(d),b=document.createElement("button");b.type="button";b.className="day-cell"+(d.getMonth()!==calDate.getMonth()?" outside":"")+(k===todayKey()?" today":"")+(k===selectedDate?" selected":"");const events=dayEvents(k).length,tasks=calendar.tasks.filter(t=>t.date===k&&!t.completed).length;b.innerHTML=`<span class="day-number">${d.getDate()}</span><span class="day-markers">${events?'<i></i>':''}${tasks?'<i class="task-dot"></i>':''}</span>`;b.addEventListener("click",()=>{selectedDate=k;calDate=new Date(d.getFullYear(),d.getMonth(),1);renderCalendarAll();});grid.append(b);}}
  function renderDayItems(){const box=$("#day-items");if(!box)return;$("#selected-date-title").textContent=dateText(selectedDate)+" の予定";box.replaceChildren();const ev=dayEvents(selectedDate).sort((a,b)=>(a.start||"").localeCompare(b.start||""));if(!ev.length)box.innerHTML=empty("この日の予定はありません。＋予定から追加できます。");ev.forEach(x=>{const row=document.createElement("article");row.className="event-card";row.innerHTML=`<i class="event-stripe"></i><div><h3>${esc(x.title)}</h3><p>${esc(x.notes||"")}</p><small>${esc(x.start||"")}${x.end?"〜"+esc(x.end):""}</small></div><button class="secondary-button" type="button">編集</button>`;row.querySelector("button").addEventListener("click",()=>openEvent(x));box.append(row);});}
  function renderTasks(){const box=$("#task-list");if(!box)return;box.replaceChildren();if(!calendar.tasks.length){box.innerHTML=empty("タスクはまだありません。");return;}calendar.tasks.forEach(t=>{const row=document.createElement("div");row.className="task-row"+(t.completed?" done":"");row.innerHTML=`<input type="checkbox" ${t.completed?"checked":""} aria-label="完了"><div class="task-main"><strong>${esc(t.title)}</strong><small>${t.date?"期限："+dateText(t.date):"期限なし"}</small></div><button class="secondary-button" type="button">編集</button>`;row.querySelector("input").addEventListener("change",e=>{t.completed=e.target.checked;saveCalendar();renderTasks();renderCalendar();});row.querySelector("button").addEventListener("click",()=>openTask(t));box.append(row);});}
  function renderCalendarAll(){renderCalendar();renderDayItems();renderTasks();}
  function openEvent(ev=null){const f=$("#event-form");f.reset();$("#event-id").value=ev?.id||"";$("#event-title").value=ev?.title||"";$("#event-date").value=ev?.date||selectedDate;$("#event-start").value=ev?.start||"";$("#event-end").value=ev?.end||"";$("#event-notes").value=ev?.notes||"";$("#event-dialog-title").textContent=ev?"予定を編集":"予定を追加";$("#delete-event").hidden=!ev;$("#event-dialog").showModal();}
  function openTask(t=null){$("#task-form").reset();$("#task-id").value=t?.id||"";$("#task-title").value=t?.title||"";$("#task-date").value=t?.date||selectedDate;$("#task-notes").value=t?.notes||"";$("#task-dialog-title").textContent=t?"タスクを編集":"タスクを追加";$("#delete-task").hidden=!t;$("#task-dialog").showModal();}
  $("#add-event-day")?.addEventListener("click",()=>openEvent());$("#add-task-button")?.addEventListener("click",()=>openTask());
  $("#event-form")?.addEventListener("submit",e=>{e.preventDefault();const ev={id:$("#event-id").value||uid(),title:$("#event-title").value.trim(),date:$("#event-date").value,start:$("#event-start").value,end:$("#event-end").value,notes:$("#event-notes").value.trim()};if(!ev.title||!ev.date)return;const i=calendar.events.findIndex(x=>x.id===ev.id);if(i<0)calendar.events.push(ev);else calendar.events[i]=ev;selectedDate=ev.date;const d=localDate(ev.date);calDate=new Date(d.getFullYear(),d.getMonth(),1);saveCalendar();$("#event-dialog").close();renderCalendarAll();toast("予定を保存しました。");});
  $("#delete-event")?.addEventListener("click",()=>{const id=$("#event-id").value;if(!id)return;if(!confirm("この予定を削除しますか？"))return;calendar.events=calendar.events.filter(x=>x.id!==id);saveCalendar();$("#event-dialog").close();renderCalendarAll();});
  $("#task-form")?.addEventListener("submit",e=>{e.preventDefault();const tid=$("#task-id").value,old=calendar.tasks.find(x=>x.id===tid),t={id:tid||uid(),title:$("#task-title").value.trim(),date:$("#task-date").value,notes:$("#task-notes").value.trim(),completed:old?.completed||false};if(!t.title)return;const i=calendar.tasks.findIndex(x=>x.id===t.id);if(i<0)calendar.tasks.push(t);else calendar.tasks[i]=t;saveCalendar();$("#task-dialog").close();renderCalendarAll();toast("タスクを保存しました。");});
  $("#delete-task")?.addEventListener("click",()=>{const id=$("#task-id").value;if(!id)return;if(!confirm("このタスクを削除しますか？"))return;calendar.tasks=calendar.tasks.filter(x=>x.id!==id);saveCalendar();$("#task-dialog").close();renderCalendarAll();});
  $("#quick-task-form")?.addEventListener("submit",e=>{e.preventDefault();const title=$("#quick-task-title").value.trim();if(!title)return;calendar.tasks.push({id:uid(),title,date:selectedDate,notes:"",completed:false});e.target.reset();saveCalendar();renderCalendarAll();toast("タスクを追加しました。");});
  $("#prev-month")?.addEventListener("click",()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar();});$("#next-month")?.addEventListener("click",()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar();});$("#today-button")?.addEventListener("click",()=>{selectedDate=todayKey();const d=new Date();calDate=new Date(d.getFullYear(),d.getMonth(),1);renderCalendarAll();});
  renderCalendarAll();

  /* COSMOS usability update: compact dashboard, floating timer, goal tasks, reminders */
  (function installUsabilityUpdate(){
    const style=document.createElement('style');
    style.id='cosmos-usability-style';
    style.textContent=`
      .quick-grid{display:none!important}
      .home-focus-row{display:grid;grid-template-columns:minmax(120px,.85fr) minmax(0,1.15fr);gap:14px;align-items:center;margin:18px 0 24px}
      .home-focus-card{min-width:0;padding:16px;border:1px solid rgba(145,173,255,.2);border-radius:20px;background:linear-gradient(145deg,rgba(22,34,64,.92),rgba(10,17,37,.94))}
      .home-focus-card h3{font-size:12px;margin:0 0 10px;color:var(--muted,#9ba9c7)}
      .home-focus-donut{width:min(34vw,142px);aspect-ratio:1;border-radius:50%;margin:auto;display:grid;place-items:center;background:conic-gradient(#70dcca 0deg,rgba(140,157,196,.16) 0deg);position:relative}
      .home-focus-donut:before{content:"";position:absolute;inset:13%;border-radius:50%;background:#0d152b;border:1px solid rgba(145,173,255,.15)}
      .home-focus-donut>div{position:relative;text-align:center;display:grid;gap:3px}.home-focus-donut strong{font-size:clamp(21px,5vw,32px);line-height:1}.home-focus-donut small{font-size:10px;color:#9ba9c7}
      .home-remaining{font-size:clamp(20px,5vw,30px);font-weight:850;line-height:1.15;overflow-wrap:anywhere;color:#eaf1ff}.home-remaining-label{font-size:11px;color:#9ba9c7;margin:6px 0 12px}.home-remaining-meta{font-size:11px;color:#70dcca}
      .timer-float{position:fixed;z-index:80;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));display:none;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(112,220,202,.45);border-radius:17px;background:rgba(8,16,36,.96);box-shadow:0 10px 35px #0006;backdrop-filter:blur(14px)}
      .timer-float.visible{display:flex}.timer-float-copy{min-width:0;flex:1}.timer-float-copy small,.timer-float-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.timer-float-copy small{font-size:10px;color:#91a1c3}.timer-float-copy strong{font-size:17px;font-variant-numeric:tabular-nums}.timer-float button{border:0;border-radius:10px;padding:9px 11px;background:#253453;color:#eaf1ff;font-weight:700;font-size:11px}.timer-float button.primary{background:#70dcca;color:#071b22}
      .goal-tabs{display:flex;gap:7px;padding:5px;border:1px solid rgba(145,173,255,.16);border-radius:14px;background:rgba(9,16,35,.72);margin:12px 0 16px}.goal-tab{flex:1;border:0;border-radius:10px;padding:10px 8px;background:transparent;color:#9ba9c7;font-weight:750}.goal-tab.active{background:#27375d;color:#f2f5ff}
      .goal-task-pane{display:none}.goal-task-pane.active{display:block}.goal-task-form{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.7fr) auto;gap:8px;margin:12px 0}.goal-task-form input{width:100%;min-width:0;box-sizing:border-box;border:1px solid rgba(145,173,255,.2);border-radius:11px;padding:11px;background:#0a1228;color:#f0f4ff}.goal-task-form button{white-space:nowrap}.goal-task-list{display:grid;gap:8px}.goal-task-row{display:grid;grid-template-columns:22px minmax(0,1fr) 30px;align-items:center;gap:10px;padding:12px;border:1px solid rgba(145,173,255,.15);border-radius:13px;background:rgba(5,11,26,.4)}.goal-task-copy{min-width:0}.goal-task-copy strong,.goal-task-copy small{display:block;overflow-wrap:anywhere}.goal-task-copy small{margin-top:4px;font-size:10px;color:#929fbd}.goal-task-row.done strong{text-decoration:line-through;opacity:.6}.goal-task-delete{border:0;background:transparent;color:#9ba9c7;font-size:20px}
      .reminder-settings{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.reminder-settings label{display:grid;gap:6px;font-size:11px;color:#9ba9c7}.reminder-settings select{width:100%;min-width:0;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid rgba(145,173,255,.2);background:#0a1228;color:#f0f4ff}
      .chart-legend-item{display:inline-flex;align-items:center;gap:6px;margin:4px 10px 4px 0;font-size:11px;color:#aab7d4}.chart-legend-item i{display:inline-block;width:9px;height:9px;border-radius:3px}
      input[type=date],input[type=time],input[type=datetime-local],select,textarea{max-width:100%;min-width:0;box-sizing:border-box}
      @media(max-width:520px){.home-focus-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.home-focus-card{padding:12px}.home-remaining-card{min-width:0;padding:12px}.timer-float{left:8px;right:8px;padding:8px}.timer-float button{padding:8px}.goal-task-form{grid-template-columns:minmax(0,1fr) minmax(0,.8fr)}.goal-task-form button{grid-column:1/-1}.reminder-settings{grid-template-columns:1fr}}
      @media(max-width:360px){.home-focus-row{grid-template-columns:1fr}.home-focus-donut{width:118px}}
    `;
    document.head.append(style);

    const home=$('#view-home');
    if(home&&!$('#home-focus-row')){
      const quick=home.querySelector('.quick-grid');
      const row=document.createElement('div');row.id='home-focus-row';row.className='home-focus-row';
      row.innerHTML=`<section class="home-focus-card"><p class="eyebrow">DAILY MISSION</p><h3>今日の学習目標</h3><div class="home-focus-donut" id="home-focus-donut"><div><strong id="home-focus-percent">0%</strong><small>達成率</small></div></div></section><section class="home-focus-card home-remaining-card"><p class="eyebrow">NEXT MILESTONE</p><h3>目標まで残り</h3><div class="home-remaining" id="home-remaining">2時間</div><p class="home-remaining-label">今日の目標時間まで</p><div class="home-remaining-meta" id="home-remaining-meta">0分 / 2時間</div></section>`;
      if(quick)quick.replaceWith(row);else home.prepend(row);
    }

    if(!$('#timer-float')){
      const bar=document.createElement('div');bar.id='timer-float';bar.className='timer-float';bar.innerHTML=`<div class="timer-float-copy"><small id="timer-float-label">学習タイマー</small><strong id="timer-float-clock">00:00:00</strong></div><button id="timer-float-open" type="button">開く</button><button id="timer-float-pause" type="button" class="primary">一時停止</button>`;document.body.append(bar);
      $('#timer-float-open').addEventListener('click',()=>{
        showView('subjects');
        setTimeout(()=>{
          if(timer.itemId && (running||paused||elapsed()>0)) $('#timer-panel')?.scrollIntoView({behavior:'smooth',block:'center'});
          else $('#subject-list')?.scrollIntoView({behavior:'smooth',block:'start'});
        },80);
      });
      $('#timer-float-pause').addEventListener('click',()=>{if(running)pauseTimer();else if(paused)startTimer();else {showView('subjects');setTimeout(()=>$('#subject-list')?.scrollIntoView({behavior:'smooth',block:'start'}),80);}syncFloat();});
    }
    function syncFloat(){const bar=$('#timer-float');if(!bar)return;const active=running||paused||elapsed()>0;bar.classList.add('visible');$('#timer-float-clock').textContent=timerText(elapsed());const s=state.subjects.find(x=>x.id===timer.subjectId),i=state.items.find(x=>x.id===timer.itemId);$('#timer-float-label').textContent=active?`${s?.name||'学習'} · ${i?.name||'タイマー'}`:'すぐに学習を記録';$('#timer-float-open').textContent=active?'タイマーを開く':'科目を選ぶ';$('#timer-float-pause').hidden=!active;$('#timer-float-pause').textContent=running?'一時停止':paused?'再開':'タイマー';}
    const oldUpdate=updateTimerUI;
    updateTimerUI=function(){oldUpdate();syncFloat();};
    syncFloat();

    const goalView=$('#view-goals');
    if(goalView&&!$('#goal-tabs')){
      const tabs=document.createElement('div');tabs.id='goal-tabs';tabs.className='goal-tabs';tabs.innerHTML='<button type="button" class="goal-tab active" data-goal-tab="map">☾ 目標マップ</button><button type="button" class="goal-tab" data-goal-tab="tasks">✓ タスク</button>';
      const toolbar=goalView.querySelector('.goal-toolbar');if(toolbar)toolbar.before(tabs);else goalView.prepend(tabs);
      const mapParts=[...goalView.children].filter(el=>el.classList.contains('goal-toolbar')||el.classList.contains('goal-canvas')||el.classList.contains('panel'));
      mapParts.forEach(el=>el.dataset.goalMapPart='1');
      const pane=document.createElement('section');pane.id='goal-task-pane';pane.className='goal-task-pane';pane.innerHTML=`<div class="panel"><div class="section-head"><div><p class="eyebrow">PERSONAL TASKS</p><h2>やることリスト</h2><p class="muted">目標マップとは別に、今日やることを管理できます。</p></div></div><form id="goal-task-form" class="goal-task-form"><input id="goal-task-title" maxlength="120" placeholder="例：英単語を30個復習" required><input id="goal-task-date" type="date" aria-label="タスク期限"><button class="primary-button" type="submit">＋ 追加</button></form><div id="goal-task-list" class="goal-task-list"></div></div>`;
      goalView.append(pane);
      let goalTasks=read('oneforall-goal-tasks-v1',[]);if(!Array.isArray(goalTasks))goalTasks=[];
      function renderGoalTasks(){const list=$('#goal-task-list');if(!list)return;list.replaceChildren();if(!goalTasks.length){list.innerHTML='<div class="empty"><span>✧</span><p>タスクはまだありません。上から追加できます。</p></div>';return;}goalTasks.sort((a,b)=>Number(a.done)-Number(b.done)||(a.date||'9999-99-99').localeCompare(b.date||'9999-99-99'));goalTasks.forEach(t=>{const row=document.createElement('div');row.className='goal-task-row'+(t.done?' done':'');const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!t.done;cb.setAttribute('aria-label','タスク完了');cb.addEventListener('change',()=>{t.done=cb.checked;save('oneforall-goal-tasks-v1',goalTasks);renderGoalTasks();});const copy=document.createElement('div');copy.className='goal-task-copy';copy.innerHTML=`<strong>${esc(t.title)}</strong><small>${t.date?'期限：'+esc(t.date.replaceAll('-','/')):'期限なし'}</small>`;const del=document.createElement('button');del.className='goal-task-delete';del.type='button';del.textContent='×';del.setAttribute('aria-label','タスク削除');del.addEventListener('click',()=>{if(!confirm(`「${t.title}」を削除しますか？`))return;goalTasks=goalTasks.filter(x=>x.id!==t.id);save('oneforall-goal-tasks-v1',goalTasks);renderGoalTasks();});row.append(cb,copy,del);list.append(row);});}
      $('#goal-task-form').addEventListener('submit',e=>{e.preventDefault();const title=$('#goal-task-title').value.trim();if(!title)return;goalTasks.push({id:uid(),title,date:$('#goal-task-date').value,done:false});save('oneforall-goal-tasks-v1',goalTasks);e.target.reset();renderGoalTasks();toast('タスクを追加しました。');});
      tabs.querySelectorAll('[data-goal-tab]').forEach(btn=>btn.addEventListener('click',()=>{const tasks=btn.dataset.goalTab==='tasks';tabs.querySelectorAll('.goal-tab').forEach(b=>b.classList.toggle('active',b===btn));goalView.querySelectorAll('[data-goal-map-part="1"]').forEach(el=>el.style.display=tasks?'none':'');pane.classList.toggle('active',tasks);renderGoalTasks();}));renderGoalTasks();
    }

    const eventForm=$('#event-form');
    if(eventForm&&!$('#event-reminder-minutes')){
      const wrap=document.createElement('div');wrap.className='reminder-settings';wrap.innerHTML=`<label><span>予定の通知</span><select id="event-reminder-enabled"><option value="off">通知しない</option><option value="on">通知する</option></select></label><label><span>何分前に通知？</span><select id="event-reminder-minutes"><option value="0">開始時刻</option><option value="5">5分前</option><option value="10">10分前</option><option value="15" selected>15分前</option><option value="30">30分前</option><option value="60">1時間前</option><option value="1440">1日前</option></select></label>`;
      const submit=eventForm.querySelector('[type="submit"]');if(submit)submit.before(wrap);else eventForm.append(wrap);
      const originalOpen=openEvent;
      openEvent=function(ev=null){originalOpen(ev);$('#event-reminder-enabled').value=ev?.reminderEnabled?'on':'off';$('#event-reminder-minutes').value=String(ev?.reminderMinutes??15);};
      eventForm.addEventListener('submit',()=>{const id=$('#event-id').value;const ev=calendar.events.find(x=>x.id===id);if(ev){ev.reminderEnabled=$('#event-reminder-enabled').value==='on';ev.reminderMinutes=Number($('#event-reminder-minutes').value)||0;saveCalendar();if(ev.reminderEnabled)askNotificationPermission();}});
    }
    let notificationAsked=false;
    function askNotificationPermission(){if(!('Notification'in window)){toast('この環境ではブラウザ通知を利用できません。');return;}if(Notification.permission==='granted')return;if(Notification.permission==='denied'){toast('iPhoneの設定で通知を許可してください。');return;}if(notificationAsked)return;notificationAsked=true;Notification.requestPermission().then(p=>toast(p==='granted'?'通知を許可しました。':'通知は許可されませんでした。')).catch(()=>toast('通知の許可を確認できませんでした。'));}
    const notified=new Set();
    function checkEventReminders(){if(!('Notification'in window)||Notification.permission!=='granted')return;const now=new Date();calendar.events.forEach(ev=>{if(!ev.reminderEnabled||!ev.date||!ev.start)return;const start=localDate(ev.date);const [h,m]=ev.start.split(':').map(Number);start.setHours(h||0,m||0,0,0);const lead=Math.max(0,Number(ev.reminderMinutes)||0);const diff=start.getTime()-now.getTime();const key=ev.id+':'+ev.date+':'+ev.start+':'+lead;const windowMs=lead===0?60000:20000;if(diff<=lead*60000&&diff>=lead*60000-windowMs&&!notified.has(key)){notified.add(key);try{new Notification('予定のお知らせ',{body:`${ev.title}（${lead?lead+'分前':'開始時刻'}）`});}catch{}}});}
    setInterval(checkEventReminders,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkEventReminders();});

    const oldRenderHome=renderHome;
    renderHome=function(){oldRenderHome();const donut=$('#home-focus-donut');if(!donut)return;const done=total(recordsForDates(todayKey(),todayKey()));const cfg=state.targets.day||{kind:'time',value:120,unit:'minutes'};const targetSeconds=Math.max(1,Number(cfg.value)||120)*(cfg.unit==='hours'?3600:60);const pct=Math.min(100,Math.round(done/targetSeconds*100));donut.style.background=`conic-gradient(#70dcca ${pct*3.6}deg,rgba(140,157,196,.16) 0deg)`;$('#home-focus-percent').textContent=pct+'%';const remaining=Math.max(0,targetSeconds-done);$('#home-remaining').textContent=remaining===0?'達成！':duration(remaining);$('#home-remaining-meta').textContent=`${duration(done)} / ${duration(targetSeconds)}`;};
    renderHome();

    const originalDrawBars=drawBars;
    drawBars=function(range,recs){
      originalDrawBars(range,recs);
      const legend=$('#bar-chart-legend');if(!legend)return;legend.replaceChildren();
      const names=state.subjects.map(s=>s.name).filter(name=>recs.some(r=>r.subject===name));
      if(!names.length){legend.textContent='科目を登録して学習を記録すると、色分けされます。';return;}
      names.forEach(name=>{const index=Math.max(0,state.subjects.findIndex(s=>s.name===name));const item=document.createElement('span');item.className='chart-legend-item';item.innerHTML=`<i style="background:${COLORS[index%COLORS.length]}"></i>${esc(name)}`;legend.append(item);});
    };
    renderRecords();
  })();

})();
