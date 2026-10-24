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

  // 既存の学習記録を保持
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
  state.records.forEach(r=>{
    if(!state.items.some(i=>i.subjectId===state.subjects.find(s=>s.name===r.subject)?.id && i.name===r.item)){
      const s=state.subjects.find(s=>s.name===r.subject);
      if(s) state.items.push({id:uid(),subjectId:s.id,name:r.item});
    }
  });

  let selectedSubject = state.subjects[0]?.id || "";
  let selectedItem = "";
  let timer = read(KEYS.timer,{elapsedSeconds:0,running:false,paused:false,startedAt:null,subjectId:"",itemId:""});
  let tick = null, elapsedBase=Math.max(0,Number(timer.elapsedSeconds)||0), startedAt=timer.running&&timer.startedAt?Number(timer.startedAt):null, running=Boolean(startedAt), paused=Boolean(timer.paused);
  let period="day", selectedGoalId=null, editingGoalId=null, pan={x:0,y:0,scale:1}, dragging=null, pinchStart=null;
  let goals = read(KEYS.goals, null);
  if(!Array.isArray(goals)||!goals.length) goals=[
    {id:uid(),name:"最終目標",note:"ここに叶えたい目標を書く",parentId:null,final:true,x:500,y:110},
    {id:uid(),name:"中間目標 1",note:"最初の大きな一歩",parentId:null,final:false,x:300,y:330},
    {id:uid(),name:"中間目標 2",note:"次に取り組むこと",parentId:null,final:false,x:700,y:330}
  ];
  if(!goals.some(g=>g.final)) goals[0].final=true;
  selectedGoalId=goals.find(g=>g.final)?.id;

  function persistStudy(){
    save(KEYS.study,{
      subjects:state.subjects,
      items:state.items,
      records:state.records.map(r=>({id:r.id,category:r.subject,item:r.item,date:r.date,durationSeconds:r.seconds,createdAt:r.createdAt})),
      categories:state.subjects.map(s=>s.name),
      dailyGoalMinutes:120,
      targets:state.targets
    });
  }
  function persistTimer(){
    save(KEYS.timer,{
      elapsedSeconds:Math.max(0,Math.floor(elapsedBase)),
      running,paused,startedAt,
      subjectId:timer.subjectId||selectedSubject,
      itemId:timer.itemId||selectedItem
    });
  }
  function persistGoals(){save(KEYS.goals,goals);}

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
  $$('[data-view]').forEach(b=>b.addEventListener("click",e=>{
    e.preventDefault();
    showView(b.dataset.view);
  }));
  $$("[data-close]").forEach(b=>b.addEventListener("click",()=>$("#"+b.dataset.close).close()));
  $("#today-chip").textContent=new Date().toLocaleDateString("ja-JP",{month:"short",day:"numeric",weekday:"short"});

  function recordsForDates(start,end){return state.records.filter(r=>r.date>=start&&r.date<=end);}
  function total(records){return records.reduce((s,r)=>s+r.seconds,0);}
  function currentRange(){
    const today=localDate(todayKey());
    if(period==="day")return {start:todayKey(),end:todayKey(),title:"今日",labels:["今日"],dates:[todayKey()]};
    if(period==="week"){
      const monday=dayOffset(today,-((today.getDay()+6)%7));
      const dates=Array.from({length:7},(_,i)=>todayKey(dayOffset(monday,i)));
      return {start:dates[0],end:dates[6],title:"今週（月〜日）",labels:dates.map(k=>{const d=localDate(k);return `${d.getMonth()+1}/${d.getDate()}`}),dates};
    }
    const start=new Date(today.getFullYear(),today.getMonth(),1),end=new Date(today.getFullYear(),today.getMonth()+1,0);
    const dates=Array.from({length:end.getDate()},(_,i)=>todayKey(dayOffset(start,i)));
    return {start:dates[0],end:dates[dates.length-1],title:`${today.getFullYear()}年${today.getMonth()+1}月`,labels:dates.map(k=>String(localDate(k).getDate())),dates};
  }
  function secondsForPeriod(){const r=currentRange();return total(recordsForDates(r.start,r.end));}

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
    const target=Number(state.targets.day?.value)||120, unit=state.targets.day?.unit||"minutes";
    const targetSeconds=target*(unit==="hours"?3600:60);
    const pct=targetSeconds?Math.min(100,Math.round(today/targetSeconds*100)):0;
    $("#home-progress").style.width=pct+"%";
    $("#home-progress-label").textContent=`今日の目標 ${pct}%`;
    const recent=[...state.records].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);
    $("#home-records").innerHTML=recent.length?recent.map(recordHTML).join(""):empty("学習記録はまだありません。科目からタイマーを使って記録しましょう。");
  }
  function empty(msg){return `<div class="empty"><span>✧</span><p>${esc(msg)}</p></div>`;}
  function recordHTML(r){
    return `<article class="record"><i style="background:${COLORS[Math.abs(r.subject.length)%COLORS.length]}"></i><div><b>${esc(r.item)}</b><small>${esc(r.subject)} · ${esc(r.date)}</small></div><strong>${duration(r.seconds)}</strong></article>`;
  }
    function renderSubjects(){
    $("#subject-list").innerHTML=state.subjects.map(s=>{
      const items=state.items.filter(i=>i.subjectId===s.id);
      const seconds=total(state.records.filter(r=>r.subject===s.name));
      return `<article class="subject-card"><button class="subject-open" data-subject="${esc(s.id)}"><span class="subject-icon">✦</span><span><b>${esc(s.name)}</b><small>${items.length}項目 · 累計 ${duration(seconds)}</small></span><span>›</span></button><div class="subject-items">${items.map(i=>{
        const recs=state.records.filter(r=>r.subject===s.name&&r.item===i.name);
        const sum=total(recs),weekStart=todayKey(dayOffset(localDate(todayKey()),-((localDate(todayKey()).getDay()+6)%7)));
        const week=total(recs.filter(r=>r.date>=weekStart&&r.date<=todayKey()));
        const day=total(recs.filter(r=>r.date===todayKey()));
        return `<button class="item-row" data-item="${esc(i.id)}"><span><b>${esc(i.name)}</b><small>累計 ${duration(sum)} · 今週 ${duration(week)} · 今日 ${duration(day)}</small></span><span class="item-total">${duration(sum)}</span></button>`;
      }).join("")||`<p class="muted">学習項目がありません。</p>`}</div></article>`;
    }).join("")||empty("科目を追加して学習を整理しましょう。");
    $$("[data-subject]").forEach(b=>b.addEventListener("click",()=>{selectedSubject=b.dataset.subject;renderSubjectDetail();}));
    $$("[data-item]").forEach(b=>b.addEventListener("click",()=>startForItem(b.dataset.item)));
  }
  function renderSubjectDetail(){
    const s=state.subjects.find(x=>x.id===selectedSubject);if(!s)return;
    const items=state.items.filter(i=>i.subjectId===s.id);
    $("#subject-detail-title").textContent=s.name;
    $("#subject-detail-list").innerHTML=items.map(i=>{
      const recs=state.records.filter(r=>r.subject===s.name&&r.item===i.name);
      const sum=total(recs),weekStart=todayKey(dayOffset(localDate(todayKey()),-((localDate(todayKey()).getDay()+6)%7)));
      const week=total(recs.filter(r=>r.date>=weekStart&&r.date<=todayKey()));
      const day=total(recs.filter(r=>r.date===todayKey()));
      return `<article class="detail-item"><div><b>${esc(i.name)}</b><p>累計 ${duration(sum)} / 今週 ${duration(week)} / 今日 ${duration(day)}</p></div><button class="primary" data-start="${esc(i.id)}">計測する</button></article>`;
    }).join("")||empty("「項目を追加」から学習項目を作成してください。");
    $("#subject-detail").hidden=false;
    $$("[data-start]").forEach(b=>b.addEventListener("click",()=>startForItem(b.dataset.start)));
  }
  $("#add-subject").addEventListener("click",()=>{$("#subject-form").reset();$("#subject-dialog").showModal();});
  $("#subject-form").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("#subject-name").value.trim();if(!name)return;
    if(state.subjects.some(s=>s.name.toLowerCase()===name.toLowerCase()))return toast("同じ名前の科目があります。");
    const s={id:uid(),name};state.subjects.push(s);selectedSubject=s.id;persistStudy();
    $("#subject-dialog").close();renderSubjects();renderHome();toast("科目を作成しました。");
  });
  $("#close-subject").addEventListener("click",()=>{$("#subject-detail").hidden=true;});
  $("#add-item").addEventListener("click",()=>{
    if(!selectedSubject)return toast("先に科目を選んでください。");
    $("#item-form").reset();$("#item-dialog").showModal();
  });
  $("#item-form").addEventListener("submit",e=>{
    e.preventDefault();
    const name=$("#item-name").value.trim();if(!name||!selectedSubject)return;
    const item={id:uid(),subjectId:selectedSubject,name};state.items.push(item);selectedItem=item.id;persistStudy();
    $("#item-dialog").close();renderSubjects();renderSubjectDetail();toast("学習項目を追加しました。");
  });

  function startForItem(id){
    const item=state.items.find(i=>i.id===id);if(!item)return;
    selectedSubject=item.subjectId;selectedItem=id;
    if(elapsed()>0&&(timer.itemId!==id||timer.subjectId!==selectedSubject)&&!confirm("計測中の時間があります。今の計測を記録せずに切り替えますか？"))return;
    if(timer.itemId!==id||timer.subjectId!==selectedSubject){elapsedBase=0;running=false;paused=false;startedAt=null;}
    timer.subjectId=selectedSubject;timer.itemId=id;
    $("#timer-panel").hidden=false;
    const s=state.subjects.find(x=>x.id===selectedSubject);
    $("#timer-label").textContent=`${s?.name||""} · ${item.name}`;
    renderSubjects();startTimer();
    $("#timer-panel").scrollIntoView({behavior:"smooth",block:"center"});
  }
  function elapsed(){return elapsedBase+(running&&startedAt?Math.max(0,(Date.now()-startedAt)/1000):0);}
  function updateTimerUI(){
    $("#timer-display").textContent=timerText(elapsed());
    $("#timer-start").disabled=running;
    $("#timer-pause").disabled=!running;
    $("#timer-finish").disabled=elapsed()<1;
    $("#timer-state").textContent=running?"計測中です。別画面に移動しても時間は進みます。":paused?"一時停止中です。":"開始すると学習時間を計測します。";
    $("#timer-start").textContent=paused?"▶ 再開":"▶ 開始";
  }
  function startTimer(){
    if(running)return;
    if(!timer.itemId){toast("学習項目を選んでください。");return;}
    running=true;paused=false;startedAt=Date.now();persistTimer();
    if(tick)clearInterval(tick);
    tick=setInterval(()=>{updateTimerUI();persistTimer();},500);
    updateTimerUI();
  }
  function pauseTimer(){
    if(!running)return;
    elapsedBase=elapsed();running=false;paused=true;startedAt=null;
    if(tick)clearInterval(tick);tick=null;persistTimer();updateTimerUI();
  }
  function finishTimer(){
    const sec=Math.floor(elapsed());if(sec<1)return toast("記録できる時間がありません。");
    const s=state.subjects.find(x=>x.id===timer.subjectId),i=state.items.find(x=>x.id===timer.itemId);
    state.records.push({id:uid(),subject:s?.name||"未分類",item:i?.name||"学習",date:todayKey(),seconds:sec,createdAt:Date.now()});
    elapsedBase=0;running=false;paused=false;startedAt=null;
    if(tick)clearInterval(tick);tick=null;
    persistStudy();persistTimer();updateTimerUI();renderSubjects();renderHome();renderRecords();
    toast(`${duration(sec)}を記録しました。`);
  }
  $("#timer-start").addEventListener("click",startTimer);
  $("#timer-pause").addEventListener("click",pauseTimer);
  $("#timer-finish").addEventListener("click",finishTimer);

  function renderRecords(){
    const range=currentRange(),recs=recordsForDates(range.start,range.end),secs=total(recs);
    $("#period-title").textContent=range.title;
    $("#period-total").textContent=duration(secs);
    $$(".segmented button").forEach(b=>b.classList.toggle("active",b.dataset.period===period));
    drawBars(range,recs);drawDonut(range,recs);
    const bySubject={};recs.forEach(r=>bySubject[r.subject]=(bySubject[r.subject]||0)+r.seconds);
    const entries=Object.entries(bySubject).sort((a,b)=>b[1]-a[1]);
    $("#subject-breakdown").innerHTML=entries.length?entries.map(([name,val],i)=>`<div class="break-row"><div><span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span><b>${esc(name)}</b><strong>${duration(val)}</strong></div><div class="progress-track"><span style="width:${secs?val/secs*100:0}%;background:${COLORS[i%COLORS.length]}"></span></div></div>`).join(""):empty("この期間の学習記録はありません。");
    $("#period-records").innerHTML=recs.length?[...recs].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).map(recordHTML).join(""):empty("この期間の記録はまだありません。");
  }
  $$(".segmented button").forEach(b=>b.addEventListener("click",()=>{period=b.dataset.period;renderRecords();}));

  function drawBars(range,recs){
    const c=$("#bar-chart"),ctx=c.getContext("2d"),rect=c.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
    c.width=Math.max(280,rect.width)*dpr;c.height=220*dpr;ctx.scale(dpr,dpr);
    const w=c.width/dpr,h=220;ctx.clearRect(0,0,w,h);
    const vals=range.dates.map(date=>total(recs.filter(r=>r.date===date)));
    const max=Math.max(60,...vals),pad={l:8,r:8,t:18,b:30},plotW=w-pad.l-pad.r,plotH=h-pad.t-pad.b;
    ctx.font="10px system-ui";ctx.textAlign="center";
    for(let i=0;i<4;i++){const y=pad.t+plotH*i/3;ctx.strokeStyle="rgba(160,180,230,.12)";ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();}
    const step=plotW/vals.length,bw=Math.max(3,Math.min(24,step*.55));
    vals.forEach((v,i)=>{
      const bh=v/max*(plotH-5),x=pad.l+i*step+(step-bw)/2,y=pad.t+plotH-bh;
      const g=ctx.createLinearGradient(0,y,0,pad.t+plotH);g.addColorStop(0,"#9cb8ff");g.addColorStop(1,"#7168ce");
      ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,bw,bh,5);ctx.fill();
      if(vals.length<=7||i%5===0||i===vals.length-1){ctx.fillStyle="#8998b9";ctx.fillText(range.labels[i],x+bw/2,h-9);}
    });
  }
  function drawDonut(range,recs){
    const config=state.targets[period]||{kind:"time",value:period==="day"?120:period==="week"?600:2400,unit:"minutes"};
    $("#target-kind").value=config.kind;$("#target-value").value=config.value;$("#target-unit").value=config.unit||"minutes";
    $("#target-unit-label").style.display=config.kind==="time"?"grid":"none";
    const actual=config.kind==="time"?total(recs)/(config.unit==="hours"?3600:60):new Set(recs.map(r=>r.item)).size;
    const target=Math.max(1,Number(config.value)||1),pct=Math.min(100,Math.round(actual/target*100));
    $("#donut").style.background=`conic-gradient(#91adff ${pct*3.6}deg, rgba(140,157,196,.16) 0deg)`;
    $("#donut-percent").textContent=pct+"%";
    $("#target-progress-text").textContent=`${config.kind==="time"?Math.round(actual*10)/10:actual} / ${target} ${config.kind==="time"?(config.unit==="hours"?"時間":"分"):"項目"}`;
    $("#target-explain").textContent=pct>=100?"目標達成！設定した目標をクリアしました。":`あと ${Math.max(0,Math.ceil(target-actual))}${config.kind==="time"?(config.unit==="hours"?"時間":"分"):"項目"}で目標達成です。`;
  }
  $("#target-kind").addEventListener("change",()=>{$("#target-unit-label").style.display=$("#target-kind").value==="time"?"grid":"none";});
  $("#save-target").addEventListener("click",()=>{
    const value=Number($("#target-value").value);
    if(!Number.isFinite(value)||value<1)return toast("目標値は1以上にしてください。");
    state.targets[period]={kind:$("#target-kind").value,value,unit:$("#target-unit").value};
    persistStudy();renderRecords();renderHome();toast("この期間の目標を保存しました。");
  });
  window.addEventListener("resize",()=>{if(!$("#view-records").hidden)renderRecords();});

  function renderGoals(){
    const svg=$("#goal-world");svg.replaceChildren();
    const root=goals.find(g=>g.final)||goals[0];if(!root)return;
    const children=id=>goals.filter(g=>g.parentId===id);
    const positions=new Map();positions.set(root.id,{x:500,y:100});
    const place=(parent,depth)=>{
      const kids=children(parent.id);
      kids.forEach((g,i)=>{
        const fraction=i-(kids.length-1)/2;
        const x=Math.max(120,Math.min(880,(positions.get(parent.id)?.x||500)+fraction*(depth===1?270:180)));
        positions.set(g.id,{x,y:100+depth*165});place(g,depth+1);
      });
    };
    place(root,1);
    goals.filter(g=>g.id!==root.id&&!positions.has(g.id)).forEach((g,i)=>positions.set(g.id,{x:150+(i%4)*230,y:430+Math.floor(i/4)*130}));
    goals.forEach(g=>{
      if(g.parentId&&positions.has(g.id)&&positions.has(g.parentId)){
        const a=positions.get(g.parentId),b=positions.get(g.id),line=document.createElementNS("http://www.w3.org/2000/svg","path");
        line.setAttribute("d",`M ${a.x} ${a.y+42} C ${a.x} ${a.y+85}, ${b.x} ${b.y-60}, ${b.x} ${b.y-42}`);
        line.setAttribute("class","goal-branch");svg.append(line);
      }
    });
    goals.forEach(g=>{
      const p=positions.get(g.id),group=document.createElementNS("http://www.w3.org/2000/svg","g");
      group.setAttribute("transform",`translate(${p.x-105},${p.y-38})`);
      group.setAttribute("class",`goal-node ${g.id===selectedGoalId?"chosen":""} ${g.final?"final":""}`);
      group.style.cursor="pointer";
      const rect=document.createElementNS("http://www.w3.org/2000/svg","rect");
      rect.setAttribute("width",210);rect.setAttribute("height",76);rect.setAttribute("rx",g.final?15:12);group.append(rect);
      const text=document.createElementNS("http://www.w3.org/2000/svg","text");
      text.setAttribute("x",105);text.setAttribute("y",g.final?31:33);
      text.textContent=g.name.length>15?g.name.slice(0,14)+"…":g.name;group.append(text);
      const sub=document.createElementNS("http://www.w3.org/2000/svg","text");
      sub.setAttribute("x",105);sub.setAttribute("y",55);sub.setAttribute("class","goal-node-sub");
      sub.textContent=g.final?"✦ 最終目標":"目標";group.append(sub);
      group.addEventListener("click",()=>selectGoal(g.id));svg.append(group);
    });
    const moon=document.createElementNS("http://www.w3.org/2000/svg","g");
    moon.setAttribute("class","goal-moon");
    const circle=document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute("cx","500");circle.setAttribute("cy","635");circle.setAttribute("r","28");
    circle.setAttribute("fill","#dce7ff");circle.setAttribute("stroke","#a9bfff");circle.setAttribute("stroke-width","2");moon.append(circle);
    [[-9,-7,5],[8,4,7],[-3,12,3]].forEach(([dx,dy,r])=>{
      const crater=document.createElementNS("http://www.w3.org/2000/svg","circle");
      crater.setAttribute("cx",String(500+dx));crater.setAttribute("cy",String(635+dy));
      crater.setAttribute("r",String(r));crater.setAttribute("fill","#aab9df");moon.append(crater);
    });
    const moonLabel=document.createElementNS("http://www.w3.org/2000/svg","text");
    moonLabel.setAttribute("x","500");moonLabel.setAttribute("y","680");moonLabel.setAttribute("text-anchor","middle");
    moonLabel.setAttribute("fill","#dce7ff");moonLabel.setAttribute("font-size","15");moonLabel.setAttribute("font-weight","700");
    moonLabel.textContent="☾ MOON · 目標達成";moon.append(moonLabel);svg.append(moon);
    svg.setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
    selectGoal(goals.find(g=>g.id===selectedGoalId)?.id||root.id,false);
  }
  function selectGoal(id,rerender=true){
    selectedGoalId=id;const g=goals.find(x=>x.id===id);if(!g)return;
    $("#selected-goal-title").textContent=g.name;$("#selected-goal-desc").textContent=g.note||"メモはありません。";
    if(rerender)renderGoals();
    else $$(".goal-node").forEach(n=>n.classList.toggle("chosen",n.querySelector("text")?.textContent===g.name));
  }
  function openGoalDialog(goal=null,parentId=null){
    editingGoalId=goal?.id||null;
    $("#goal-dialog-title").textContent=goal?"目標を編集":"目標を追加";
    $("#goal-name").value=goal?.name||"";$("#goal-note").value=goal?.note||"";
    $("#goal-final").checked=Boolean(goal?.final);
    $("#goal-parent").innerHTML=`<option value="">最終目標の下に配置</option>`+
      goals.filter(g=>g.id!==goal?.id).map(g=>`<option value="${esc(g.id)}">${esc(g.name)}</option>`).join("");
    $("#goal-parent").value=parentId||goal?.parentId||"";$("#goal-dialog").showModal();
  }
  $("#add-goal").addEventListener("click",()=>openGoalDialog());
  $("#add-child-goal").addEventListener("click",()=>openGoalDialog(null,selectedGoalId));
  $("#edit-goal").addEventListener("click",()=>{const g=goals.find(x=>x.id===selectedGoalId);if(g)openGoalDialog(g);});
  $("#goal-form").addEventListener("submit",e=>{
    e.preventDefault();const name=$("#goal-name").value.trim();if(!name)return;
    const parentId=$("#goal-parent").value||null,final=$("#goal-final").checked;
    if(editingGoalId&&parentId===editingGoalId)return toast("自分自身を親目標にはできません。");
    if(final)goals.forEach(g=>g.final=false);
    if(editingGoalId){
      const g=goals.find(x=>x.id===editingGoalId);
      Object.assign(g,{name,note:$("#goal-note").value.trim(),parentId,final});
    }else{
      const g={id:uid(),name,note:$("#goal-note").value.trim(),parentId,final,x:500,y:300};
      goals.push(g);selectedGoalId=g.id;
    }
    if(!goals.some(g=>g.final))goals[0].final=true;
    persistGoals();$("#goal-dialog").close();renderGoals();toast("目標を保存しました。");
  });
  $("#delete-goal").addEventListener("click",()=>{
    const g=goals.find(x=>x.id===selectedGoalId);if(!g)return;
    if(g.final&&goals.length>1)return toast("最終目標は、先に別の目標を最終目標にしてから削除してください。");
    if(!confirm(`「${g.name}」を削除しますか？子目標は親目標なしになります。`))return;
    goals=goals.filter(x=>x.id!==g.id);goals.forEach(x=>{if(x.parentId===g.id)x.parentId=null;});
    selectedGoalId=goals.find(x=>x.final)?.id||goals[0]?.id;persistGoals();renderGoals();
  });
  function zoom(factor,cx=500,cy=350){
    const old=pan.scale;pan.scale=Math.max(.45,Math.min(2.2,pan.scale*factor));
    pan.x=cx-(cx-pan.x)*pan.scale/old;pan.y=cy-(cy-pan.y)*pan.scale/old;
    $("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
  }
  $("#zoom-in").addEventListener("click",()=>zoom(1.15));
  $("#zoom-out").addEventListener("click",()=>zoom(1/1.15));
  $("#reset-map").addEventListener("click",()=>{pan={x:0,y:0,scale:1};renderGoals();});
  const canvas=$("#goal-canvas");
  canvas.addEventListener("pointerdown",e=>{
    if(e.target.closest(".goal-node"))return;
    canvas.setPointerCapture(e.pointerId);dragging={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};
  });
  canvas.addEventListener("pointermove",e=>{
    if(!dragging)return;
    pan.x=dragging.px+(e.clientX-dragging.x);pan.y=dragging.py+(e.clientY-dragging.y);
    $("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
  });
  ["pointerup","pointercancel","lostpointercapture"].forEach(ev=>canvas.addEventListener(ev,()=>dragging=null));
  canvas.addEventListener("wheel",e=>{e.preventDefault();zoom(e.deltaY<0?1.08:1/1.08);},{passive:false});
  let pointers=new Map();
  canvas.addEventListener("pointerdown",e=>{
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2){const p=[...pointers.values()];pinchStart={distance:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y),scale:pan.scale};}
  });
  canvas.addEventListener("pointermove",e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinchStart){
      const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
      pan.scale=Math.max(.45,Math.min(2.2,pinchStart.scale*d/pinchStart.distance));
      $("#goal-world").setAttribute("transform",`translate(${pan.x} ${pan.y}) scale(${pan.scale})`);
    }
  });
  ["pointerup","pointercancel"].forEach(ev=>canvas.addEventListener(ev,e=>{pointers.delete(e.pointerId);if(pointers.size<2)pinchStart=null;}));
    // 計測中のタイマーを復元
  if(running){
    if(tick)clearInterval(tick);
    tick=setInterval(()=>{updateTimerUI();persistTimer();},500);
  }
  updateTimerUI();

  // 手動で学習時間を追加
  function addManualRecord(){
    const subject=$("#manual-subject").value;
    const item=$("#manual-item").value.trim();
    const date=$("#manual-date").value||todayKey();
    const hours=Number($("#manual-hours").value)||0;
    const minutes=Number($("#manual-minutes").value)||0;
    const seconds=Math.round(hours*3600+minutes*60);

    if(!subject)return toast("科目を選択してください。");
    if(!item)return toast("学習内容を入力してください。");
    if(seconds<=0)return toast("追加する時間を入力してください。");

    const s=state.subjects.find(x=>x.id===subject);
    if(!s)return toast("選択した科目が見つかりません。");

    let i=state.items.find(x=>x.subjectId===subject&&x.name===item);
    if(!i){
      i={id:uid(),subjectId:subject,name:item};
      state.items.push(i);
    }

    state.records.push({
      id:uid(),
      subject:s.name,
      item:i.name,
      date,
      seconds,
      createdAt:Date.now()
    });

    persistStudy();
    $("#manual-form").reset();
    $("#manual-date").value=todayKey();
    renderSubjects();
    renderHome();
    renderRecords();
    toast(`${duration(seconds)}を学習記録に追加しました。`);
  }

  if($("#manual-form")){
    $("#manual-date").value=todayKey();
    $("#manual-subject").innerHTML=state.subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
    $("#manual-form").addEventListener("submit",e=>{
      e.preventDefault();
      addManualRecord();
    });
  }

  // 期限までのカウントダウン
  let countdowns=read(KEYS.countdowns,[]);
  if(!Array.isArray(countdowns))countdowns=[];
  function persistCountdowns(){save(KEYS.countdowns,countdowns);}
  function renderCountdowns(){
    const host=$("#countdown-list");
    if(!host)return;
    const today=localDate(todayKey());
    host.innerHTML=countdowns.length?[...countdowns].sort((a,b)=>a.date.localeCompare(b.date)).map(c=>{
      const target=localDate(c.date);
      const days=Math.round((target-today)/86400000);
      let message;
      if(days>0)message=`あと ${days} 日`;
      else if(days===0)message="本日です！";
      else message=`${Math.abs(days)} 日経過`;
      return `<article class="countdown-card"><div class="countdown-icon">✦</div><div class="countdown-info"><b>${esc(c.name)}</b><small>${esc(c.date)}</small><strong>${message}</strong></div><button class="countdown-delete" data-delete-countdown="${esc(c.id)}" aria-label="削除">×</button></article>`;
    }).join(""):empty("受験や試験など、目標の日付を追加しましょう。");
    $$("[data-delete-countdown]").forEach(b=>b.addEventListener("click",()=>{
      const c=countdowns.find(x=>x.id===b.dataset.deleteCountdown);
      if(!c||!confirm(`「${c.name}」を削除しますか？`))return;
      countdowns=countdowns.filter(x=>x.id!==c.id);
      persistCountdowns();
      renderCountdowns();
    }));
  }

  if($("#countdown-form")){
    $("#countdown-date").value=todayKey();
    $("#countdown-form").addEventListener("submit",e=>{
      e.preventDefault();
      const name=$("#countdown-name").value.trim();
      const date=$("#countdown-date").value;
      if(!name||!date)return toast("イベント名と日付を入力してください。");
      countdowns.push({id:uid(),name,date});
      persistCountdowns();
      $("#countdown-form").reset();
      $("#countdown-date").value=todayKey();
      renderCountdowns();
      toast("カウントダウンを追加しました。");
    });
  }

  // カレンダー
  let calendarDate=new Date();
  let selectedDate=todayKey();
  let calendarEvents=read(KEYS.calendar,[]);
  if(!Array.isArray(calendarEvents))calendarEvents=[];

  function persistCalendar(){save(KEYS.calendar,calendarEvents);}
  function renderCalendarAll(){
    renderCalendar();
    renderCalendarEvents();
    renderCountdowns();
  }
  function renderCalendar(){
    const grid=$("#calendar-grid");
    if(!grid)return;
    const year=calendarDate.getFullYear(),month=calendarDate.getMonth();
    $("#calendar-title").textContent=`${year}年 ${month+1}月`;
    const first=new Date(year,month,1);
    const start=dayOffset(first,-first.getDay());
    const cells=[];
    for(let i=0;i<42;i++){
      const d=dayOffset(start,i),key=todayKey(d);
      const events=calendarEvents.filter(e=>e.date===key);
      cells.push(`<button class="calendar-day ${d.getMonth()!==month?"outside":""} ${key===todayKey()?"today":""} ${key===selectedDate?"selected":""}" data-calendar-date="${key}"><span>${d.getDate()}</span>${events.length?`<i class="calendar-dot"></i>`:""}</button>`);
    }
    grid.innerHTML=cells.join("");
    $$("[data-calendar-date]").forEach(b=>b.addEventListener("click",()=>{
      selectedDate=b.dataset.calendarDate;
      renderCalendar();
      renderCalendarEvents();
    }));
  }
  function renderCalendarEvents(){
    const host=$("#calendar-events");
    if(!host)return;
    $("#calendar-selected-date").textContent=selectedDate;
    const events=calendarEvents.filter(e=>e.date===selectedDate);
    host.innerHTML=events.length?events.map(e=>`<article class="calendar-event"><div><b>${esc(e.title)}</b><small>${esc(e.time||"時間指定なし")}${e.note?" · "+esc(e.note):""}</small></div><button data-delete-event="${esc(e.id)}" aria-label="予定を削除">×</button></article>`).join(""):empty("この日の予定はありません。");
    $$("[data-delete-event]").forEach(b=>b.addEventListener("click",()=>{
      const e=calendarEvents.find(x=>x.id===b.dataset.deleteEvent);
      if(!e||!confirm(`「${e.title}」を削除しますか？`))return;
      calendarEvents=calendarEvents.filter(x=>x.id!==e.id);
      persistCalendar();
      renderCalendarAll();
    }));
  }
  $("#calendar-prev")?.addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()-1,1);renderCalendar();});
  $("#calendar-next")?.addEventListener("click",()=>{calendarDate=new Date(calendarDate.getFullYear(),calendarDate.getMonth()+1,1);renderCalendar();});
  $("#calendar-today")?.addEventListener("click",()=>{calendarDate=new Date();selectedDate=todayKey();renderCalendarAll();});
  if($("#calendar-form")){
    $("#calendar-form").addEventListener("submit",e=>{
      e.preventDefault();
      const title=$("#event-title").value.trim(),date=$("#event-date").value||selectedDate;
      if(!title)return toast("予定名を入力してください。");
      calendarEvents.push({
        id:uid(),title,date,
        time:$("#event-time").value,
        note:$("#event-note").value.trim()
      });
      selectedDate=date;
      calendarDate=localDate(date);
      persistCalendar();
      $("#calendar-form").reset();
      renderCalendarAll();
      toast("予定を保存しました。");
    });
  }

  // 起動時の描画
  persistStudy();
  renderHome();
  renderSubjects();
  renderRecords();
  renderGoals();
  renderCalendarAll();

  // 画面を閉じる・復帰する際もタイマー状態を保持
  document.addEventListener("visibilitychange",()=>{
    if(running)persistTimer();
    if(!document.hidden){
      updateTimerUI();
      renderHome();
    }
  });
  window.addEventListener("beforeunload",persistTimer);
})();