
const KEY='ironlog-v1';
const BUILTIN_FOODS=[
  {id:'b_oats',name:'Kaurahiutale',kcal:370,protein:13,carbs:60,fat:7,favorite:false,builtin:true},
  {id:'b_banana',name:'Banaani',kcal:89,protein:1.1,carbs:20.2,fat:0.3,favorite:false,builtin:true},
  {id:'b_rice',name:'Riisi, keitetty',kcal:130,protein:2.7,carbs:28,fat:0.3,favorite:false,builtin:true},
  {id:'b_chicken',name:'Broilerin filee, kypsä',kcal:165,protein:31,carbs:0,fat:3.6,favorite:false,builtin:true},
  {id:'b_beef10',name:'Jauheliha 10 %, kypsä',kcal:210,protein:26,carbs:0,fat:11,favorite:false,builtin:true},
  {id:'b_egg',name:'Kananmuna',kcal:143,protein:12.6,carbs:0.7,fat:9.5,favorite:false,builtin:true},
  {id:'b_quark',name:'Maitorahka, rasvaton',kcal:67,protein:12,carbs:4,fat:0.3,favorite:false,builtin:true},
  {id:'b_pasta',name:'Makaroni, keitetty',kcal:150,protein:5,carbs:30,fat:1,favorite:false,builtin:true},
  {id:'b_rye',name:'Ruisleipä',kcal:230,protein:8,carbs:42,fat:2.5,favorite:false,builtin:true},
  {id:'b_cucumber',name:'Kurkku',kcal:12,protein:0.7,carbs:1.4,fat:0.1,favorite:false,builtin:true}
];
const defaultState={
  settings:{calories:2000,protein:150,carbs:200,fat:70},
  food:[], customFoods:[], savedMeals:[], workouts:[], runs:[], weights:[]
};
let state=load();
state.customFoods=state.customFoods||[];
state.savedMeals=state.savedMeals||[];
let runImageData=null;
let barcodeScanner=null;
let currentBarcodeProduct=null;

function load(){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
    return {
      ...structuredClone(defaultState),
      ...saved,
      settings:{...defaultState.settings,...(saved.settings||{})},
      food:saved.food||[],customFoods:saved.customFoods||[],savedMeals:saved.savedMeals||[],
      workouts:saved.workouts||[],runs:saved.runs||[],weights:saved.weights||[]
    };
  }catch(e){return structuredClone(defaultState)}
}
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

document.getElementById('clearFoodBtn').onclick=()=>{if(confirm('Tyhjennetäänkö tämän päivän ruoat?')){state.food=state.food.filter(x=>x.date!==today());save()}};

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

function allFoodProducts(){
  const custom=state.customFoods.map(x=>({...x,builtin:false}));
  const builtin=BUILTIN_FOODS.map(x=>{
    const override=state.customFoods.find(c=>c.id===x.id && c.overrideBuiltin);
    return override?{...x,...override}:{...x};
  });
  return [...builtin,...custom.filter(x=>!x.overrideBuiltin)];
}
function getFoodProduct(id){return allFoodProducts().find(x=>x.id===id)}
function isFavoriteFood(id){
  const c=state.customFoods.find(x=>x.id===id);
  if(c) return !!c.favorite;
  return !!state.settings?.favoriteBuiltins?.includes(id);
}
function setFavoriteFood(id,value){
  const c=state.customFoods.find(x=>x.id===id);
  if(c){c.favorite=value}
  else{
    state.settings.favoriteBuiltins=state.settings.favoriteBuiltins||[];
    if(value && !state.settings.favoriteBuiltins.includes(id)) state.settings.favoriteBuiltins.push(id);
    if(!value) state.settings.favoriteBuiltins=state.settings.favoriteBuiltins.filter(x=>x!==id);
  }
  save();
}
function foodCard(p){
  const fav=isFavoriteFood(p.id);
  return `<div class="food-result">
    <button class="fav-btn ${fav?'on':''}" onclick="toggleFoodFavorite('${p.id}')">${fav?'★':'☆'}</button>
    <button class="food-main" onclick="openAddFood('${p.id}')">
      <strong>${esc(p.name)}</strong>
      <small>${Math.round(p.kcal)} kcal · P ${round1(p.protein)} · H ${round1(p.carbs)} · R ${round1(p.fat)} / 100 g</small>
    </button>
    <button class="food-plus" onclick="openAddFood('${p.id}')">＋</button>
  </div>`;
}
window.toggleFoodFavorite=(id)=>setFavoriteFood(id,!isFavoriteFood(id));
window.openAddFood=(id)=>{
  const p=getFoodProduct(id); if(!p)return;
  dialogFoodId.value=id; dialogFoodName.textContent=p.name; dialogFoodGrams.value=100;
  updateDialogMacros();
  addFoodDialog.showModal();
};
function updateDialogMacros(){
  const p=getFoodProduct(dialogFoodId.value); if(!p)return;
  const f=num(dialogFoodGrams.value)/100;
  dialogFoodMacros.innerHTML=`<b>${Math.round(p.kcal*f)} kcal</b><span>P ${round1(p.protein*f)} g</span><span>H ${round1(p.carbs*f)} g</span><span>R ${round1(p.fat*f)} g</span>`;
}
function round1(n){return Math.round(num(n)*10)/10}
function yesterdayDate(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10)}

function renderFood(){
  const query=(document.getElementById('foodSearch')?.value||'').trim().toLowerCase();
  let products=allFoodProducts();
  const matches=(query?products.filter(p=>p.name.toLowerCase().includes(query)):products).slice(0,20);
  foodSearchResults.innerHTML=matches.map(foodCard).join('')||'<div class="empty-note">Ei hakutuloksia.</div>';

  const favorites=products.filter(p=>isFavoriteFood(p.id));
  favoriteFoods.innerHTML=favorites.map(foodCard).join('')||'<div class="empty-note">Ei suosikkeja vielä. Paina tähteä tuotteen vierestä.</div>';

  savedMeals.innerHTML=state.savedMeals.map(m=>{
    const kcal=m.items.reduce((s,x)=>s+num(x.kcal),0);
    return `<div class="food-result saved-meal">
      <button class="food-main" onclick="addSavedMeal('${m.id}')">
        <strong>${esc(m.name)}</strong>
        <small>${m.mealType} · ${m.items.length} tuotetta · ${Math.round(kcal)} kcal</small>
      </button>
      <button class="food-plus" onclick="addSavedMeal('${m.id}')">＋</button>
      <button class="delete-small" onclick="deleteSavedMeal('${m.id}')">×</button>
    </div>`;
  }).join('')||'<div class="empty-note">Ei tallennettuja aterioita vielä.</div>';

  const todayItems=state.food.filter(x=>x.date===today());
  const total=k=>todayItems.reduce((a,b)=>a+num(b[k]),0);
  const kcal=total('kcal'), protein=total('protein'), carbs=total('carbs'), fat=total('fat');
  const goal=state.settings.calories||2000;
  const percent=Math.min(100,Math.round(kcal/goal*100));
  foodBigCalories.textContent=`${Math.round(kcal)} / ${goal} kcal`;
  foodRemaining.textContent=`${Math.max(0,Math.round(goal-kcal))} kcal jäljellä`;
  foodPct.textContent=percent+'%';
  foodRing.style.background=`conic-gradient(var(--red) ${percent*3.6}deg,#242424 0deg)`;
  foodTotals.textContent=`Proteiini ${Math.round(protein)} / ${state.settings.protein} g · Hiilarit ${Math.round(carbs)} / ${state.settings.carbs} g · Rasva ${Math.round(fat)} / ${state.settings.fat} g`;

  const mealTypes=['Aamupala','Lounas','Välipala','Päivällinen','Iltapala'];
  foodMealGroups.innerHTML=mealTypes.map(type=>{
    const items=todayItems.filter(x=>(x.mealType||'Lounas')===type);
    const mkcal=items.reduce((s,x)=>s+num(x.kcal),0);
    return `<section class="meal-group">
      <div class="meal-group-head"><div><span>${type.toUpperCase()}</span><b>${Math.round(mkcal)} kcal</b></div><button onclick="setMealAndSearch('${type}')">＋</button></div>
      ${items.length?items.map(x=>`<div class="entry"><div><strong>${esc(x.name)} — ${Math.round(x.grams)} g</strong><small>${Math.round(x.kcal)} kcal · P ${Math.round(x.protein)} · H ${Math.round(x.carbs)} · R ${Math.round(x.fat)}</small></div><button onclick="del('food','${x.id}')">×</button></div>`).join(''):'<div class="meal-empty">Ei ruokia.</div>'}
    </section>`;
  }).join('');
}
window.setMealAndSearch=(type)=>{
  dialogMealType.value=type;
  document.querySelector('[data-food-tab="search"]').click();
  foodSearch.focus();
};
window.addSavedMeal=(id)=>{
  const m=state.savedMeals.find(x=>x.id===id); if(!m)return;
  m.items.forEach(i=>state.food.push({...i,id:uid(),date:today(),mealType:m.mealType}));
  save();
};
window.deleteSavedMeal=(id)=>{state.savedMeals=state.savedMeals.filter(x=>x.id!==id);save()};
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

// FOOD V3 interactions
document.querySelectorAll('[data-food-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('[data-food-tab]').forEach(b=>b.classList.toggle('active',b===btn));
  document.querySelectorAll('[data-food-panel]').forEach(p=>p.classList.toggle('active',p.dataset.foodPanel===btn.dataset.foodTab));
}));
document.getElementById('foodSearch').addEventListener('input',renderFood);
document.getElementById('dialogFoodGrams').addEventListener('input',updateDialogMacros);

document.getElementById('addFoodDialogForm').addEventListener('submit',e=>{
  e.preventDefault();
  const p=getFoodProduct(dialogFoodId.value); if(!p)return;
  const grams=num(dialogFoodGrams.value), f=grams/100;
  state.food.push({
    id:uid(),date:today(),mealType:dialogMealType.value,productId:p.id,name:p.name,grams,
    kcal:p.kcal*f,protein:p.protein*f,carbs:p.carbs*f,fat:p.fat*f
  });
  addFoodDialog.close(); save();
});

document.getElementById('customFoodForm').addEventListener('submit',e=>{
  e.preventDefault();
  state.customFoods.push({
    id:'c_'+uid(),name:customFoodName.value.trim(),kcal:num(customFoodKcal.value),
    protein:num(customFoodProtein.value),carbs:num(customFoodCarbs.value),fat:num(customFoodFat.value),
    favorite:customFoodFavorite.checked
  });
  e.target.reset();
  document.querySelector('[data-food-tab="search"]').click();
  save();
});

document.getElementById('mealForm').addEventListener('submit',e=>{
  e.preventDefault();
  const type=mealTypeCreate.value;
  const items=state.food.filter(x=>x.date===today() && (x.mealType||'Lounas')===type);
  if(!items.length){alert('Tässä ateriatyypissä ei ole vielä ruokia tänään.');return}
  state.savedMeals.push({
    id:'m_'+uid(),name:mealName.value.trim(),mealType:type,
    items:items.map(x=>({productId:x.productId,name:x.name,grams:x.grams,kcal:x.kcal,protein:x.protein,carbs:x.carbs,fat:x.fat}))
  });
  e.target.reset();save();
});

document.getElementById('copyYesterdayAll').addEventListener('click',()=>{
  const y=yesterdayDate(), items=state.food.filter(x=>x.date===y);
  if(!items.length){alert('Eiliseltä ei löytynyt ruokia.');return}
  items.forEach(x=>state.food.push({...x,id:uid(),date:today()}));save();
});
document.getElementById('copyYesterdayMeal').addEventListener('click',()=>{
  const y=yesterdayDate(), type=copyMealType.value;
  const items=state.food.filter(x=>x.date===y && (x.mealType||'Lounas')===type);
  if(!items.length){alert(`Eiliseltä ei löytynyt ateriaa: ${type}`);return}
  items.forEach(x=>state.food.push({...x,id:uid(),date:today()}));save();
});


// BARCODE SCANNER V4
async function startBarcodeScanner(){
  const dlg=document.getElementById('barcodeDialog');
  const status=document.getElementById('barcodeStatus');

  if(!window.Html5Qrcode){
    status.textContent='Viivakoodinlukijaa ei saatu ladattua. Tarkista internet-yhteys.';
    return;
  }

  dlg.showModal();
  status.textContent='Kamera käynnistyy...';

  try{
    barcodeScanner = new Html5Qrcode("barcodeReader");
    const config={
      fps:10,
      qrbox:{width:280,height:150},
      aspectRatio:1.7778,
      formatsToSupport:[
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128
      ]
    };

    await barcodeScanner.start(
      {facingMode:"environment"},
      config,
      async decodedText=>{
        status.textContent='Viivakoodi löytyi: '+decodedText;
        await stopBarcodeScanner();
        dlg.close();
        await lookupBarcode(decodedText);
      },
      ()=>{}
    );
  }catch(err){
    console.error(err);
    status.textContent='Kameraa ei saatu käyttöön. Salli kameran käyttö Safarissa tai syötä viivakoodi käsin.';
    try{dlg.close()}catch(e){}
  }
}

async function stopBarcodeScanner(){
  if(barcodeScanner){
    try{
      const state=barcodeScanner.getState?.();
      if(state===Html5QrcodeScannerState.SCANNING || state===Html5QrcodeScannerState.PAUSED){
        await barcodeScanner.stop();
      }
      await barcodeScanner.clear();
    }catch(e){}
    barcodeScanner=null;
  }
}

async function lookupBarcode(code){
  const status=document.getElementById('barcodeStatus');
  const clean=String(code||'').replace(/\D/g,'').trim();
  if(!clean){
    status.textContent='Anna kelvollinen viivakoodi.';
    return;
  }

  status.textContent='Haetaan tuotetta: '+clean+' ...';

  try{
    const fields=[
      'code','product_name','product_name_fi','brands',
      'nutriments','serving_size','image_front_small_url'
    ].join(',');
    const url=`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(clean)}.json?fields=${encodeURIComponent(fields)}`;
    const res=await fetch(url,{headers:{'Accept':'application/json'}});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const data=await res.json();

    if(!data || data.status!==1 || !data.product){
      currentBarcodeProduct=null;
      status.textContent='Tuotetta ei löytynyt tietokannasta. Voit lisätä sen OMA TUOTE -kohdasta.';
      alert('Tuotetta ei löytynyt tietokannasta. Voit lisätä sen itse OMA TUOTE -kohdasta.');
      return;
    }

    const p=data.product;
    const n=p.nutriments||{};
    const name=(p.product_name_fi||p.product_name||'Tuntematon tuote').trim();
    const kcal=pickNumber(n['energy-kcal_100g'], n.energy_kcal_100g, n['energy-kcal']);
    const protein=pickNumber(n.proteins_100g,n.proteins);
    const carbs=pickNumber(n.carbohydrates_100g,n.carbohydrates);
    const fat=pickNumber(n.fat_100g,n.fat);

    if(kcal==null){
      status.textContent='Tuote löytyi, mutta kaloritietoa ei ollut saatavilla.';
      alert('Tuote löytyi, mutta ravintoarvot olivat puutteelliset. Lisää tuote itse OMA TUOTE -kohdasta.');
      return;
    }

    currentBarcodeProduct={
      id:'barcode_'+clean,
      barcode:clean,
      name,
      brand:p.brands||'',
      kcal:num(kcal),
      protein:num(protein),
      carbs:num(carbs),
      fat:num(fat),
      image:p.image_front_small_url||''
    };

    showBarcodeProduct();
    status.textContent='Tuote löytyi: '+name;
  }catch(err){
    console.error(err);
    status.textContent='Tuotehaussa tapahtui virhe. Tarkista internet-yhteys.';
    alert('Tuotehaussa tapahtui virhe. Yritä uudelleen tai syötä tuote käsin.');
  }
}

function pickNumber(...vals){
  for(const v of vals){
    const n=Number(v);
    if(Number.isFinite(n)) return n;
  }
  return null;
}

function showBarcodeProduct(){
  const p=currentBarcodeProduct;
  if(!p)return;
  barcodeProductName.textContent=p.name;
  barcodeProductMeta.innerHTML=`
    ${p.image?`<img src="${p.image}" alt="">`:''}
    <div>
      <strong>${esc(p.brand||'')}</strong>
      <small>Viivakoodi ${esc(p.barcode)}</small>
      <small>${Math.round(p.kcal)} kcal / 100 g</small>
    </div>`;
  barcodeGrams.value=100;
  updateBarcodePreview();
  barcodeProductDialog.showModal();
}

function updateBarcodePreview(){
  const p=currentBarcodeProduct;if(!p)return;
  const f=num(barcodeGrams.value)/100;
  barcodeMacrosPreview.innerHTML=`
    <b>${Math.round(p.kcal*f)} kcal</b>
    <span>P ${round1(p.protein*f)} g</span>
    <span>H ${round1(p.carbs*f)} g</span>
    <span>R ${round1(p.fat*f)} g</span>`;
}

document.getElementById('openBarcodeScanner').addEventListener('click',startBarcodeScanner);

document.getElementById('closeBarcodeScanner').addEventListener('click',async()=>{
  await stopBarcodeScanner();
  barcodeDialog.close();
});

document.getElementById('barcodeDialog').addEventListener('close',async()=>{
  await stopBarcodeScanner();
});

document.getElementById('lookupManualBarcode').addEventListener('click',()=>{
  lookupBarcode(manualBarcode.value);
});
document.getElementById('manualBarcode').addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();lookupBarcode(manualBarcode.value)}
});

document.getElementById('barcodeGrams').addEventListener('input',updateBarcodePreview);
document.getElementById('closeBarcodeProduct').addEventListener('click',()=>barcodeProductDialog.close());

document.getElementById('barcodeProductForm').addEventListener('submit',e=>{
  e.preventDefault();
  const p=currentBarcodeProduct;if(!p)return;
  const grams=num(barcodeGrams.value), f=grams/100;
  state.food.push({
    id:uid(),date:today(),mealType:barcodeMealType.value,
    productId:p.id,name:p.name,grams,
    kcal:p.kcal*f,protein:p.protein*f,carbs:p.carbs*f,fat:p.fat*f,
    barcode:p.barcode
  });
  barcodeProductDialog.close();
  save();
});

document.getElementById('saveBarcodeFavorite').addEventListener('click',()=>{
  const p=currentBarcodeProduct;if(!p)return;
  const existing=state.customFoods.find(x=>x.barcode===p.barcode || x.id===p.id);
  if(existing){
    existing.favorite=true;
  }else{
    state.customFoods.push({
      id:p.id,barcode:p.barcode,name:p.name,kcal:p.kcal,
      protein:p.protein,carbs:p.carbs,fat:p.fat,favorite:true
    });
  }
  barcodeStatus.textContent='Tallennettu omiin ruokiin: '+p.name;
  save();
});

function renderAll(){renderHome();renderFood();renderWorkouts();renderRuns();renderWeights();renderProgress();renderSettings()}
renderAll();

if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
