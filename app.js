
const KEY='ironlog-v1';
const defaultState={
  settings:{calories:2000,protein:150,carbs:200,fat:70},
  food:[], workouts:[], runs:[], weights:[]
};
let state=load();
let runImageData=null;

function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){return structuredClone(defaultState)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state)); renderAll()}
function today(){return new Date().toISOString().slice(0,10)}
function fmtDate(s){return new Date(s+'T12:00:00').toLocaleDateString('fi-FI')}
function num(v){return Number(v)||0}
function pct(a,b){return Math.min(100,b?Math.round(a/b*100):0)}
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random())}

document.querySelectorAll('[data-go]').forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===btn.dataset.go));
  document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active',b===btn));
  window.scrollTo({top:0,behavior:'smooth'});
});

document.getElementById('foodForm').addEventListener('submit',e=>{
  e.preventDefault();
  const grams=num(foodGrams.value), f=grams/100;
  state.food.push({
    id:uid(),date:today(),name:foodName.value.trim(),grams,
    kcal:num(foodKcal.value)*f,protein:num(foodProtein.value)*f,
    carbs:num(foodCarbs.value)*f,fat:num(foodFat.value)*f
  });
  e.target.reset(); save();
});
document.getElementById('clearFoodBtn').onclick=()=>{state.food=state.food.filter(x=>x.date!==today());save()};

document.getElementById('workoutForm').addEventListener('submit',e=>{
  e.preventDefault();
  state.workouts.push({id:uid(),date:today(),name:workoutName.value.trim(),sets:num(workoutSets.value),reps:num(workoutReps.value),kg:num(workoutKg.value)});
  e.target.reset();save();
});

document.getElementById('runScreenshot').addEventListener('change',async e=>{
  const file=e.target.files[0]; if(!file)return;

  const reader=new FileReader();
  reader.onload=async()=>{
    runImageData=reader.result;
    runPreview.src=runImageData;
    runPreview.classList.remove('hidden');
    await readRunScreenshot(file);
  };
  reader.readAsDataURL(file);
});

async function readRunScreenshot(file){
  const status=document.getElementById('ocrStatus');
  const wrap=document.getElementById('ocrProgressWrap');
  const bar=document.getElementById('ocrProgressBar');
  const details=document.getElementById('ocrDetails');
  const raw=document.getElementById('ocrRawText');

  status.classList.remove('hidden');
  wrap.classList.remove('hidden');
  status.textContent='LUETAAN KUVA...';
  bar.style.width='2%';
  details.classList.add('hidden');

  if(!window.Tesseract){
    status.textContent='KUVANLUKUA EI SAATU LADATTUA. TARKISTA INTERNET-YHTEYS.';
    wrap.classList.add('hidden');
    return;
  }

  try{
    const result=await Tesseract.recognize(file,'eng',{
      logger:m=>{
        if(m.status==='recognizing text'){
          const p=Math.max(2,Math.round((m.progress||0)*100));
          bar.style.width=p+'%';
          status.textContent=`LUETAAN KUVA... ${p}%`;
        }
      }
    });

    const text=(result.data.text||'').replace(/\r/g,'');
    raw.textContent=text || 'Tekstiä ei tunnistettu.';
    details.classList.remove('hidden');

    const parsed=parseWorkoutScreenshot(text);
    applyParsedRunData(parsed);

    const found=[
      parsed.km!=null?'matka':'',
      parsed.minutes!=null?'aika':'',
      parsed.pace?'vauhti':'',
      parsed.hr!=null?'syke':'',
      parsed.calories!=null?'kalorit':''
    ].filter(Boolean);

    if(found.length){
      status.textContent='TUNNISTETTU: '+found.join(', ').toUpperCase()+' — TARKISTA ARVOT';
    }else{
      status.textContent='TIETOJA EI SAATU VARMASTI TUNNISTETTUA — TÄYTÄ KÄSIN';
    }
    bar.style.width='100%';
    setTimeout(()=>wrap.classList.add('hidden'),700);
  }catch(err){
    console.error(err);
    status.textContent='KUVAN LUKU EPÄONNISTUI — VOIT TÄYTTÄÄ TIEDOT KÄSIN';
    wrap.classList.add('hidden');
  }
}

function parseWorkoutScreenshot(input){
  const text=String(input||'')
    .replace(/,/g,'.')
    .replace(/[–—]/g,'-')
    .replace(/[ \t]+/g,' ');

  const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
  const result={km:null,minutes:null,pace:null,hr:null,calories:null,type:null};

  const all=text.toLowerCase();

  // Activity type
  if(/\b(run|running|juoksu)\b/i.test(text)) result.type='Juoksu';
  else if(/\b(walk|walking|kävely|walking outdoor)\b/i.test(text)) result.type='Kävely';
  else if(/\b(cycl|cycling|bike|pyöräily)\b/i.test(text)) result.type='Pyöräily';

  // Distance: supports "5.42 km", "5,42 KM"
  const distMatches=[...text.matchAll(/(\d{1,3}(?:[.,]\d{1,3})?)\s*(?:km|kilometers?|kilometres?)/gi)];
  if(distMatches.length){
    const nums=distMatches.map(m=>Number(m[1].replace(',','.'))).filter(n=>n>0 && n<500);
    if(nums.length) result.km=nums[0];
  }

  // Calories: supports kcal/calories/active calories
  const kcalPatterns=[
    /(?:active\s+calories?|calories?|kalorit|energia)[^\d]{0,18}(\d{2,5})\s*(?:kcal|cal)?/i,
    /(\d{2,5})\s*kcal/i
  ];
  for(const p of kcalPatterns){
    const m=text.match(p);
    if(m){ const n=Number(m[1]); if(n>=10 && n<=10000){result.calories=n;break;} }
  }

  // Heart rate
  const hrPatterns=[
    /(?:avg(?:\.|erage)?\s*(?:heart\s*rate|hr)|average\s*heart\s*rate|keskisyke|avg\s*hr|heart\s*rate)[^\d]{0,20}(\d{2,3})\s*(?:bpm)?/i,
    /(\d{2,3})\s*bpm/i
  ];
  for(const p of hrPatterns){
    const m=text.match(p);
    if(m){ const n=Number(m[1]); if(n>=40 && n<=240){result.hr=n;break;} }
  }

  // Pace e.g. 6:20 /km, 6'20"/km
  const pacePatterns=[
    /(\d{1,2})\s*[:']\s*(\d{2})\s*(?:["”]?\s*)?(?:\/\s*km|min\/km|per\s*km)/i,
    /(?:avg(?:\.|erage)?\s*pace|keskivauhti|pace)[^\d]{0,20}(\d{1,2})\s*[:']\s*(\d{2})/i
  ];
  for(const p of pacePatterns){
    const m=text.match(p);
    if(m){
      const mm=Number(m[1]), ss=Number(m[2]);
      if(mm>=1 && mm<=30 && ss>=0 && ss<60){result.pace=`${mm}:${String(ss).padStart(2,'0')}`;break;}
    }
  }

  // Duration: prefer values near time/duration labels.
  const timePatterns=[
    /(?:duration|workout\s*time|elapsed\s*time|aika|kesto)[^\d]{0,18}(\d{1,2}):(\d{2}):(\d{2})/i,
    /(?:duration|workout\s*time|elapsed\s*time|aika|kesto)[^\d]{0,18}(\d{1,3}):(\d{2})/i
  ];
  for(const p of timePatterns){
    const m=text.match(p);
    if(m){
      if(m.length===4){
        const h=Number(m[1]), mi=Number(m[2]), s=Number(m[3]);
        result.minutes=+(h*60+mi+s/60).toFixed(1);
      }else{
        const mi=Number(m[1]), s=Number(m[2]);
        result.minutes=+(mi+s/60).toFixed(1);
      }
      break;
    }
  }

  // Fallback: find standalone duration-looking times, avoiding likely pace if possible
  if(result.minutes==null){
    const hms=[...text.matchAll(/\b(\d{1,2}):(\d{2}):(\d{2})\b/g)];
    if(hms.length){
      const m=hms[0]; result.minutes=+(Number(m[1])*60+Number(m[2])+Number(m[3])/60).toFixed(1);
    } else {
      const ms=[...text.matchAll(/\b(\d{1,3}):(\d{2})\b/g)]
        .map(m=>({raw:m[0],min:Number(m[1]),sec:Number(m[2])}))
        .filter(x=>x.sec<60 && !(result.pace && x.raw===result.pace));
      const likely=ms.find(x=>x.min>=10) || ms[0];
      if(likely) result.minutes=+(likely.min+likely.sec/60).toFixed(1);
    }
  }

  return result;
}

function applyParsedRunData(p){
  if(p.type) document.getElementById('runType').value=p.type;
  if(p.km!=null) document.getElementById('runKm').value=p.km;
  if(p.minutes!=null) document.getElementById('runMinutes').value=p.minutes;
  if(p.pace) document.getElementById('runPace').value=p.pace;
  if(p.hr!=null) document.getElementById('runHr').value=p.hr;
  if(p.calories!=null) document.getElementById('runCalories').value=p.calories;
}
document.getElementById('runForm').addEventListener('submit',e=>{
  e.preventDefault();
  state.runs.push({id:uid(),date:today(),type:runType.value,km:num(runKm.value),minutes:num(runMinutes.value),pace:runPace.value.trim(),hr:num(runHr.value),calories:num(runCalories.value),image:runImageData});
  runImageData=null;runPreview.classList.add('hidden');runPreview.removeAttribute('src');runScreenshot.value='';e.target.reset();save();
});

document.getElementById('weightForm').addEventListener('submit',e=>{
  e.preventDefault();
  const existing=state.weights.find(x=>x.date===today());
  const item={id:existing?.id||uid(),date:today(),kg:num(weightKg.value),waist:num(waistCm.value)};
  if(existing) Object.assign(existing,item); else state.weights.push(item);
  e.target.reset();save();
});

document.getElementById('settingsForm').addEventListener('submit',e=>{
  e.preventDefault();
  state.settings={calories:num(goalCalories.value),protein:num(goalProtein.value),carbs:num(goalCarbs.value),fat:num(goalFat.value)};
  save();
});

function del(kind,id){state[kind]=state[kind].filter(x=>x.id!==id);save()}
window.del=del;

function daysAgo(n){const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10)}
function recent(arr,n=7){const min=daysAgo(n-1);return arr.filter(x=>x.date>=min)}

function renderHome(){
  const food=state.food.filter(x=>x.date===today());
  const sum=k=>food.reduce((a,b)=>a+num(b[k]),0);
  const kcal=sum('kcal'), protein=sum('protein'), carbs=sum('carbs'), fat=sum('fat');
  const latest=[...state.weights].sort((a,b)=>b.date.localeCompare(a.date))[0];
  todayDate.textContent=new Date().toLocaleDateString('fi-FI',{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
  homeCalories.textContent=Math.round(kcal); homeProtein.textContent=Math.round(protein); homeWeight.textContent=latest?latest.kg.toFixed(1):'—';
  homeWorkouts.textContent=recent(state.workouts).length;
  calorieGoalText.textContent=state.settings.calories;
  remainingCalories.textContent=`${Math.max(0,Math.round(state.settings.calories-kcal))} kcal jäljellä`;
  proteinText.textContent=`${Math.round(protein)} / ${state.settings.protein} g`; carbText.textContent=`${Math.round(carbs)} / ${state.settings.carbs} g`; fatText.textContent=`${Math.round(fat)} / ${state.settings.fat} g`;
  proteinBar.style.width=pct(protein,state.settings.protein)+'%';carbBar.style.width=pct(carbs,state.settings.carbs)+'%';fatBar.style.width=pct(fat,state.settings.fat)+'%';
  const activeDates=new Set([...state.food,...state.workouts,...state.runs,...state.weights].map(x=>x.date));
  let streak=0; for(let i=0;i<365;i++){if(activeDates.has(daysAgo(i)))streak++;else if(i>0)break}
  streakDays.textContent=streak;
}

function renderFood(){
  const items=state.food.filter(x=>x.date===today()).slice().reverse();
  foodList.innerHTML=items.map(x=>`<div class="entry"><div><strong>${esc(x.name)} — ${Math.round(x.grams)} g</strong><small>${Math.round(x.kcal)} kcal · P ${Math.round(x.protein)} · H ${Math.round(x.carbs)} · R ${Math.round(x.fat)}</small></div><button onclick="del('food','${x.id}')">×</button></div>`).join('')||'<div class="mini-summary">Ei ruokia vielä tänään.</div>';
  const t=k=>items.reduce((a,b)=>a+num(b[k]),0);
  foodTotals.textContent=`Yhteensä ${Math.round(t('kcal'))} kcal · Proteiini ${Math.round(t('protein'))} g · Hiilarit ${Math.round(t('carbs'))} g · Rasva ${Math.round(t('fat'))} g`;
}
function renderWorkouts(){
  workoutList.innerHTML=state.workouts.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(x=>`<div class="entry"><div><strong>${esc(x.name)}</strong><small>${fmtDate(x.date)} · ${x.sets} × ${x.reps} @ ${x.kg||0} kg</small></div><button onclick="del('workouts','${x.id}')">×</button></div>`).join('')||'<div class="mini-summary">Ei treenejä vielä.</div>';
}
function renderRuns(){
  runList.innerHTML=state.runs.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map(x=>`<div class="entry"><div><strong>${esc(x.type)} — ${x.km.toFixed(2)} km</strong><small>${fmtDate(x.date)} · ${x.minutes} min${x.pace?` · ${x.pace}/km`:''} · syke ${x.hr||'—'} · ${x.calories||0} kcal ${x.image?'· 📸':''}</small></div><button onclick="del('runs','${x.id}')">×</button></div>`).join('')||'<div class="mini-summary">Ei lenkkejä vielä.</div>';
}
function renderWeights(){
  const sorted=state.weights.slice().sort((a,b)=>b.date.localeCompare(a.date));
  weightList.innerHTML=sorted.slice(0,30).map(x=>`<div class="entry"><div><strong>${x.kg.toFixed(1)} kg</strong><small>${fmtDate(x.date)}${x.waist?` · vyötärö ${x.waist.toFixed(1)} cm`:''}</small></div><button onclick="del('weights','${x.id}')">×</button></div>`).join('')||'<div class="mini-summary">Ei painomittauksia vielä.</div>';
  drawWeightChart();
}
function drawWeightChart(){
  const c=weightChart,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
  const data=state.weights.slice().sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
  if(!data.length){weightTrendText.textContent='Ei dataa';return}
  const vals=data.map(x=>x.kg),min=Math.min(...vals)-1,max=Math.max(...vals)+1,p=35;
  ctx.strokeStyle='#2d2d2d';ctx.lineWidth=1;
  for(let i=0;i<5;i++){let y=p+i*(c.height-2*p)/4;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(c.width-p,y);ctx.stroke()}
  ctx.strokeStyle='#ff1b16';ctx.lineWidth=4;ctx.beginPath();
  data.forEach((x,i)=>{const px=p+(i/(Math.max(1,data.length-1)))*(c.width-2*p);const py=c.height-p-((x.kg-min)/(max-min))*(c.height-2*p);if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py)});
  ctx.stroke();
  ctx.fillStyle='#f5f5f5';ctx.font='20px Arial';ctx.fillText(vals.at(-1).toFixed(1)+' kg',p,28);
  const change=vals.at(-1)-vals[0];weightTrendText.textContent=(change>0?'+':'')+change.toFixed(1)+' kg';
}
function renderProgress(){
  const rf=recent(state.food), rw=recent(state.workouts), rr=recent(state.runs);
  const byDay={};rf.forEach(x=>byDay[x.date]=(byDay[x.date]||0)+x.kcal);
  const dayVals=Object.values(byDay);avgCalories.textContent=dayVals.length?Math.round(dayVals.reduce((a,b)=>a+b,0)/7):0;
  sumKm.textContent=rr.reduce((a,b)=>a+b.km,0).toFixed(1);sumWorkouts.textContent=rw.length;
  const ws=state.weights.slice().sort((a,b)=>a.date.localeCompare(b.date));
  weightChange.textContent=ws.length>1?((ws.at(-1).kg-ws[0].kg)>0?'+':'')+(ws.at(-1).kg-ws[0].kg).toFixed(1):'—';
}
function renderSettings(){
  goalCalories.value=state.settings.calories;goalProtein.value=state.settings.protein;goalCarbs.value=state.settings.carbs;goalFat.value=state.settings.fat;
}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function renderAll(){renderHome();renderFood();renderWorkouts();renderRuns();renderWeights();renderProgress();renderSettings()}
renderAll();

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
