/* ONE FOR ALL — COSMOS / js/app.js */
"use strict";
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const KEYS = { study:"oneforall-study-v1", timer:"oneforall-timer-v1", goals:"oneforall-goals-v1", calendar:"personal-calendar-v1" };
  const COLORS = ["#8eafff","#c0a1ff","#69dfc4","#f4c77b","#ff9dc5","#86d99b","#ff987d","#6ed7ee"];
  const subjectColor = name => { const index=state.subjects.findIndex(s=>s.name===name); return COLORS[(index<0?Math.abs(String(name).split("").reduce((a,c)=>a+c.charCodeAt(0),0)):index)%COLORS.length]; };
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

  // 既存の学習データを読み込み、削除せずに引き継ぐ
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
  function showView(name){ $$(".view").forEach(v=>{const on=v.id===`view-${name}`;v.hidden=!on;v.classList.toggle("active",on);}); $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===name)); if(name==="records")renderRecords(); if(name==="subjects")renderSubjects(); if(name==="goals")renderGoals(); if(name==="home"){renderHome();renderCountdownHome();} if(name==="calendar")renderCalendarAll(); window.scrollTo({top:0,behavior:"smooth"}); }
  $$('[data-view]').forEach(b=>b.addEventListener("click",e=>{e.preventDefault();showView(b.dataset.view);}));
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
  $("#today-chip").textContent=new Date().toLocaleDateString("ja-JP",{month:"short",day:"numeric",weekday:"short"});

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
  function recordHTML(r){return `<article class="record"><i style="background:${subjectColor(r.subject)}"></i><div><b>${esc(r.item)}</b><small>${esc(r.subject)} · ${esc(r.date)}</small></div><strong>${duration(r.seconds)}</strong></article>`;}
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
    $("#subject-breakdown").innerHTML=entries.length?entries.map(([name,val])=>`<div class="break-row"><div><span class="legend-dot" style="background:${subjectColor(name)}"></span><b>${esc(name)}</b><strong>${duration(val)}</strong></div><div class="progress-track"><span style="width:${secs?val/secs*100:0}%;background:${subjectColor(name)}"></span></div></div>`).join(""):empty("この期間の学習記録はありません。");
    $("#period-records").innerHTML=recs.length?[...recs].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(recordHTML).join(""):empty("この期間の記録はまだありません。");
  }
  $$(".segmented button").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period;renderRecords();}));
  function drawBars(range,recs){
    const c=$("#bar-chart"),ctx=c.getContext("2d"),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    const w=Math.max(280,rect.width),h=220;c.width=w*dpr;c.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const subjects=[...new Set([...state.subjects.map(s=>s.name),...recs.map(r=>r.subject)])];
    const series=subjects.map(name=>({name,color:subjectColor(name),values:range.dates.map(date=>total(recs.filter(r=>r.date===date&&r.subject===name)))}));
    const sums=range.dates.map((_,i)=>series.reduce((a,s)=>a+s.values[i],0));const max=Math.max(60,...sums);const pad={l:8,r:8,t:18,b:30},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
    ctx.font="10px system-ui";ctx.textAlign="center";
    for(let i=0;i<4;i++){const y=pad.t+plotH*i/3;ctx.strokeStyle="rgba(160,180,230,.12)";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}
    const step=plotW/range.dates.length,bw=Math.max(3,Math.min(25,step*.58));
    range.dates.forEach((date,i)=>{let y=pad.t+plotH;series.forEach(s=>{const val=s.values[i];if(!val)return;const bh=val/max*plotH;y-=bh;ctx.fillStyle=s.color;ctx.beginPath();ctx.roundRect(pad.l+i*step+(step-bw)/2,y,bw,Math.max(1,bh),3);ctx.fill();});if(range.dates.length<=7||i%5===0||i===range.dates.length-1){ctx.fillStyle="#8998b9";ctx.fillText(range.labels[i],pad.l+i*step+step/2,h-9);}});
    const active=series.filter(s=>s.values.some(v=>v>0));$("#bar-legend").innerHTML=active.length?active.map(s=>`<span class="chart-legend-item"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join(""):`<span class="muted">学習記録を追加すると、科目ごとに色分けして表示します。</span>`;
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

  // タイマーを使わずに学習時間を手入力する
  function fillManualSubjects(){const select=$("#manual-subject"),keep=select.value||selectedSubject;select.innerHTML=state.subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");if(state.subjects.some(s=>s.id===keep))select.value=keep;fillManualItems();}
  function fillManualItems(){const sid=$("#manual-subject").value;const select=$("#manual-item"),items=state.items.filter(i=>i.subjectId===sid);select.innerHTML=items.map(i=>`<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");if(!items.length)select.innerHTML='<option value="">先に学習項目を作成してください</option>';}
  function openManualDialog(){if(!state.subjects.length)return toast("先に科目を作成してください。");if(!state.items.length)return toast("先に科目を選び、学習項目を作成してください。");fillManualSubjects();$("#manual-date").value=todayKey();$("#manual-hours").value="0";$("#manual-minutes").value="30";$("#manual-dialog").showModal();}
  $("#add-manual-record").addEventListener("click",openManualDialog);$("#manual-subject").addEventListener("change",fillManualItems);
  $("#manual-form").addEventListener("submit",e=>{e.preventDefault();const s=state.subjects.find(x=>x.id===$("#manual-subject").value),i=state.items.find(x=>x.id===$("#manual-item").value),date=$("#manual-date").value,h=Number($("#manual-hours").value),m=Number($("#manual-minutes").value),seconds=(h*60+m)*60;if(!s||!i||!date)return toast("科目と学習項目を選んでください。");if(!Number.isFinite(seconds)||seconds<=0||h<0||m<0||m>59)return toast("1分以上の時間を入力してください。");state.records.push({id:uid(),subject:s.name,item:i.name,date,seconds,createdAt:Date.now()});persistStudy();$("#manual-dialog").close();renderHome();renderSubjects();renderRecords();toast(`${duration(seconds)}を手入力で記録しました。`);});

  // 月を目指すスキルツリー型の目標マップ
  function renderGoals(){
    const svg=$("#goal-world");svg.replaceChildren();
    const root=goals.find(g=>g.final)||goals[0];if(!root)return;
    const children=id=>goals.filter(g=>g.parentId===id);
    const positions=new Map();positions.set(root.id,{x:500,y:100});
    const place=(parent,depth)=>{const kids=children(parent.id);kids.forEach((g,i)=>{const fraction=(i-(kids.length-1)/2);const x=Math.max(120,Math.min(880,(positions.get(parent.id)?.x||500)+fraction*(depth===1?270:180)));const y=100+depth*165;positions.set(g.id,{x,y});place(g,depth+1);});};
    place(root,1);
    goals.filter(g=>g.id!==root.id&&!positions.has(g.id)).forEach((g,i)=>positions.set(g.id,{x:150+(i%4)*230,y:430+Math.floor(i/4)*130}));
    goals.forEach(g=>{if(g.parentId&&positions.has(g.id)&&positions.has(g.parentId)){const a=positions.get(g.parentId),b=positions.get(g.id);const line=document.createElementNS("http://www.w3.org/2000/svg","path");line.setAttribute("d",`M ${a.x} ${a.y+42} C ${a.x} ${a.y+85}, ${b.x} ${b.y-60}, ${b.x} ${b.y-42}`);line.setAttribute("class","goal-branch");svg.append(line);}});
    goals.forEach(g=>{const p=positions.get(g.id),group=document.createElementNS("http://www.w3.org/2000/svg","g");group.setAttribute("transform",`translate(${p.x-105},${p.y-38})`);group.setAttribute("class",`goal-node ${g.id===selectedGoalId?"chosen":""} ${g.final?"final":""} ${g.completed?"completed":""}`);group.dataset.goalId=g.id;group.style.cursor="pointer";
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");rect.setAttribute("width",210);rect.setAttribute("height",76);rect.setAttribute("rx",g.final?15:12);group.append(rect);
      const text=document.createElementNS("http://www.w3.org/2000/svg","text");text.setAttribute("x",105);text.setAttribute("y",g.final?31:33);text.textContent=g.final?"☾  "+(g.name.length>11?g.name.slice(0,10)+"…":g.name):(g.name.length>15?g.name.slice(0,14)+"…":g.name);group.append(text);
      const sub=document.createElementNS("http://www.w3.org/2000/svg","text");sub.setAttribute("x",105);sub.setAttribute("y",55);sub.setAttribute("class","goal-node-sub");sub.textContent=g.completed?"✓ 達成済み":(g.final?"☾ 月を目指す最終目標":"✧ スキル目標");group.append(sub);
      group.addEventListener("click",()=>selectGoal(g.id));svg.append(group);
    });
    $("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
    const g=goals.find(x=>x.id===selectedGoalId)||root;selectGoal(g.id,false);
  }
  function selectGoal(id,rerender=true){selectedGoalId=id;const g=goals.find(x=>x.id===id);if(!g)return;$("#selected-goal-title").textContent=g.name;$("#selected-goal-desc").textContent=(g.completed?"✓ 達成済み · ":"未達成 · ")+(g.note||"メモはありません。");$("#toggle-goal-complete").textContent=g.completed?"↻ 未達成に戻す":"✓ この目標を達成！";if(rerender)renderGoals();else $$(".goal-node").forEach(n=>n.classList.toggle("chosen",n.dataset.goalId===id));}
  function openGoalDialog(goal=null,parentId=null){editingGoalId=goal?.id||null;$("#goal-dialog-title").textContent=goal?"目標を編集":"目標を追加";$("#goal-name").value=goal?.name||"";$("#goal-note").value=goal?.note||"";$("#goal-final").checked=Boolean(goal?.final);$("#goal-parent").innerHTML=`<option value="">最終目標の下に配置</option>`+goals.filter(g=>g.id!==goal?.id).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("");$("#goal-parent").value=parentId||goal?.parentId||"";$("#goal-dialog").showModal();}
  $("#add-goal").addEventListener("click",()=>openGoalDialog(null,selectedGoalId||goals.find(g=>g.final)?.id));$("#add-child-goal").addEventListener("click",()=>openGoalDialog(null,selectedGoalId));$("#edit-goal").addEventListener("click",()=>{const g=goals.find(x=>x.id===selectedGoalId);if(g)openGoalDialog(g);});
  $("#goal-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#goal-name").value.trim();if(!name)return;let parentId=$("#goal-parent").value||null;const final=$("#goal-final").checked;if(editingGoalId&&parentId===editingGoalId)return toast("自分自身を親目標にはできません。");if(final){parentId=null;goals.forEach(g=>g.final=false);}
    if(editingGoalId){const g=goals.find(x=>x.id===editingGoalId);Object.assign(g,{name,note:$("#goal-note").value.trim(),parentId,final});}
    else{const g={id:uid(),name,note:$("#goal-note").value.trim(),parentId,final,x:500,y:300};goals.push(g);selectedGoalId=g.id;}
    if(!goals.some(g=>g.final))goals[0].final=true;persistGoals();$("#goal-dialog").close();renderGoals();toast("目標を保存しました。");});
  $("#toggle-goal-complete").addEventListener("click",()=>{const g=goals.find(x=>x.id===selectedGoalId);if(!g)return;g.completed=!g.completed;persistGoals();renderGoals();toast(g.completed?"目標達成！":"未達成に戻しました。");});
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
    // タイマーの状態を復元する
  if(running){if(tick)clearInterval(tick);tick=setInterval(()=>{updateTimerUI();persistTimer();},500);}
  else if(elapsedBase>0)paused=true;
  if(timer.subjectId)selectedSubject=timer.subjectId;if(timer.itemId)selectedItem=timer.itemId;
  persistStudy();renderHome();renderSubjects();renderRecords();renderGoals();

  // カレンダー・タスク・カウントダウンのデータ
  let calendar=read(KEYS.calendar,{events:[],tasks:[],countdowns:[]});
  if(!Array.isArray(calendar.events))calendar.events=[];
  if(!Array.isArray(calendar.tasks))calendar.tasks=[];
  if(!Array.isArray(calendar.countdowns))calendar.countdowns=[];
  let calDate=new Date(),selectedDate=todayKey();
  const dateText=k=>{const d=localDate(k);return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}（${"日月火水木金土"[d.getDay()]}）`;};
  const saveCalendar=()=>save(KEYS.calendar,calendar);
  const dayEvents=k=>calendar.events.filter(x=>x.date===k);

  // イベントまでの残り日数
  function daysUntil(date){const a=localDate(todayKey()),b=localDate(date);return Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);}
  function renderCountdownHome(){
    const box=$("#countdown-home");if(!box)return;
    const list=(calendar.countdowns||[]).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
    if(!list.length){box.innerHTML=empty("受験・テスト・大切な日を登録すると、ここに残り日数が表示されます。");return;}
    box.innerHTML=list.map(x=>{
      const n=daysUntil(x.date),label=n<0?`${Math.abs(n)}日経過`:n===0?"今日！":`あと${n}日`;
      return `<article class="countdown-card"><div><b>${esc(x.name)}</b><small>${esc(x.date)}${x.note?" · "+esc(x.note):""}</small><div class="countdown-actions"><button type="button" data-count-edit="${esc(x.id)}">編集</button><button type="button" data-count-delete="${esc(x.id)}">削除</button></div></div><strong class="countdown-number">${label}<small>COUNTDOWN</small></strong></article>`;
    }).join("");
    box.querySelectorAll("[data-count-edit]").forEach(b=>b.addEventListener("click",()=>openCountdown(calendar.countdowns.find(x=>x.id===b.dataset.countEdit))));
    box.querySelectorAll("[data-count-delete]").forEach(b=>b.addEventListener("click",()=>deleteCountdown(b.dataset.countDelete)));
  }
  function openCountdown(item=null){
    $("#countdown-form").reset();
    $("#countdown-id").value=item?.id||"";
    $("#countdown-name").value=item?.name||"";
    $("#countdown-date").value=item?.date||todayKey();
    $("#countdown-note").value=item?.note||"";
    $("#countdown-dialog-title").textContent=item?"イベントを編集":"イベントを登録";
    $("#delete-countdown").hidden=!item;
    $("#countdown-dialog").showModal();
  }
  function deleteCountdown(id){
    if(!confirm("このカウントダウンを削除しますか？"))return;
    if($("#countdown-dialog").open&&$("#countdown-id").value===id)$("#countdown-dialog").close();
    calendar.countdowns=calendar.countdowns.filter(x=>x.id!==id);
    saveCalendar();renderCountdownHome();
  }
  $("#add-countdown-home").addEventListener("click",()=>openCountdown());
  $("#countdown-form").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("#countdown-id").value||uid(),item={id,name:$("#countdown-name").value.trim(),date:$("#countdown-date").value,note:$("#countdown-note").value.trim()};
    if(!item.name||!item.date)return;
    const idx=calendar.countdowns.findIndex(x=>x.id===id);
    if(idx<0)calendar.countdowns.push(item);else calendar.countdowns[idx]=item;
    saveCalendar();$("#countdown-dialog").close();renderCountdownHome();toast("カウントダウンを保存しました。");
  });
  $("#delete-countdown").addEventListener("click",()=>deleteCountdown($("#countdown-id").value));

  // カレンダー表示
  function renderCalendar(){
    const grid=$("#calendar-grid");if(!grid)return;
    $("#month-title").textContent=`${calDate.getFullYear()}年${calDate.getMonth()+1}月`;
    grid.replaceChildren();
    ["日","月","火","水","木","金","土"].forEach(n=>{const h=document.createElement("div");h.className="muted center small";h.textContent=n;grid.append(h);});
    const first=new Date(calDate.getFullYear(),calDate.getMonth(),1);
    const start=new Date(first);start.setDate(1-first.getDay());
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);
      const k=todayKey(d),b=document.createElement("button");
      b.type="button";
      b.className="day-cell"+(d.getMonth()!==calDate.getMonth()?" outside":"")+(k===todayKey()?" today":"")+(k===selectedDate?" selected":"");
      const events=dayEvents(k).length,tasks=calendar.tasks.filter(t=>t.date===k&&!t.completed).length;
      b.innerHTML=`<span class="day-number">${d.getDate()}</span><span class="day-markers">${events?'<i></i>':''}${tasks?'<i class="task-dot"></i>':''}</span>`;
      b.addEventListener("click",()=>{selectedDate=k;calDate=new Date(d.getFullYear(),d.getMonth(),1);renderCalendarAll();});
      grid.append(b);
    }
  }
  function renderDayItems(){
    const box=$("#day-items");if(!box)return;
    $("#selected-date-title").textContent=dateText(selectedDate)+" の予定";
    box.replaceChildren();
    const ev=dayEvents(selectedDate).sort((a,b)=>(a.start||"").localeCompare(b.start||""));
    if(!ev.length)box.innerHTML=empty("この日の予定はありません。＋予定から追加できます。");
    ev.forEach(x=>{
      const row=document.createElement("article");row.className="event-card";
      row.innerHTML=`<i class="event-stripe"></i><div><h3>${esc(x.title)}</h3><p>${esc(x.notes||"")}</p><small>${esc(x.start||"")}${x.end?"〜"+esc(x.end):""}</small></div><button class="secondary-button" type="button">編集</button>`;
      row.querySelector("button").addEventListener("click",()=>openEvent(x));box.append(row);
    });
  }
  function renderTasks(){
    const box=$("#task-list");if(!box)return;
    box.replaceChildren();
    if(!calendar.tasks.length){box.innerHTML=empty("タスクはまだありません。");return;}
    calendar.tasks.forEach(t=>{
      const row=document.createElement("div");row.className="task-row"+(t.completed?" done":"");
      row.innerHTML=`<input type="checkbox" ${t.completed?"checked":""} aria-label="完了"><div class="task-main"><strong>${esc(t.title)}</strong><small>${t.date?"期限："+dateText(t.date):"期限なし"}</small></div><button class="secondary-button" type="button">編集</button>`;
      row.querySelector("input").addEventListener("change",e=>{t.completed=e.target.checked;saveCalendar();renderTasks();renderCalendar();});
      row.querySelector("button").addEventListener("click",()=>openTask(t));box.append(row);
    });
  }
  function renderCalendarAll(){renderCalendar();renderDayItems();renderTasks();}
  function openEvent(ev=null){
    const f=$("#event-form");f.reset();
    $("#event-id").value=ev?.id||"";$("#event-title").value=ev?.title||"";$("#event-date").value=ev?.date||selectedDate;
    $("#event-start").value=ev?.start||"";$("#event-end").value=ev?.end||"";$("#event-notes").value=ev?.notes||"";
    $("#event-dialog-title").textContent=ev?"予定を編集":"予定を追加";$("#delete-event").hidden=!ev;$("#event-dialog").showModal();
  }
  function openTask(t=null){
    $("#task-form").reset();$("#task-id").value=t?.id||"";$("#task-title").value=t?.title||"";$("#task-date").value=t?.date||selectedDate;$("#task-notes").value=t?.notes||"";
    $("#task-dialog-title").textContent=t?"タスクを編集":"タスクを追加";$("#delete-task").hidden=!t;$("#task-dialog").showModal();
  }
  $("#add-event-day")?.addEventListener("click",()=>openEvent());
  $("#add-task-button")?.addEventListener("click",()=>openTask());
  $("#event-form")?.addEventListener("submit",e=>{
    e.preventDefault();
    const ev={id:$("#event-id").value||uid(),title:$("#event-title").value.trim(),date:$("#event-date").value,start:$("#event-start").value,end:$("#event-end").value,notes:$("#event-notes").value.trim()};
    if(!ev.title||!ev.date)return;
    const i=calendar.events.findIndex(x=>x.id===ev.id);
    if(i<0)calendar.events.push(ev);else calendar.events[i]=ev;
    selectedDate=ev.date;const d=localDate(ev.date);calDate=new Date(d.getFullYear(),d.getMonth(),1);
    saveCalendar();$("#event-dialog").close();renderCalendarAll();toast("予定を保存しました。");
  });
  $("#delete-event")?.addEventListener("click",()=>{
    const id=$("#event-id").value;if(!id)return;
    if(!confirm("この予定を削除しますか？"))return;
    calendar.events=calendar.events.filter(x=>x.id!==id);saveCalendar();$("#event-dialog").close();renderCalendarAll();
  });
  $("#task-form")?.addEventListener("submit",e=>{
    e.preventDefault();
    const tid=$("#task-id").value,old=calendar.tasks.find(x=>x.id===tid),t={id:tid||uid(),title:$("#task-title").value.trim(),date:$("#task-date").value,notes:$("#task-notes").value.trim(),completed:old?.completed||false};
    if(!t.title)return;
    const i=calendar.tasks.findIndex(x=>x.id===t.id);
    if(i<0)calendar.tasks.push(t);else calendar.tasks[i]=t;
    saveCalendar();$("#task-dialog").close();renderCalendarAll();toast("タスクを保存しました。");
  });
  $("#delete-task")?.addEventListener("click",()=>{
    const id=$("#task-id").value;if(!id)return;
    if(!confirm("このタスクを削除しますか？"))return;
    calendar.tasks=calendar.tasks.filter(x=>x.id!==id);saveCalendar();$("#task-dialog").close();renderCalendarAll();
  });
  $("#quick-task-form")?.addEventListener("submit",e=>{
    e.preventDefault();const title=$("#quick-task-title").value.trim();if(!title)return;
    calendar.tasks.push({id:uid(),title,date:selectedDate,notes:"",completed:false});
    e.target.reset();saveCalendar();renderCalendarAll();toast("タスクを追加しました。");
  });
  $("#prev-month")?.addEventListener("click",()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()-1,1);renderCalendar();});
  $("#next-month")?.addEventListener("click",()=>{calDate=new Date(calDate.getFullYear(),calDate.getMonth()+1,1);renderCalendar();});
  $("#today-button")?.addEventListener("click",()=>{selectedDate=todayKey();const d=new Date();calDate=new Date(d.getFullYear(),d.getMonth(),1);renderCalendarAll();});

  // 初期表示
  renderCalendarAll();
  renderCountdownHome();

})();