import {label,value,sections,roundLabel,relationships} from './format.js';
const $ = id => document.getElementById(id);
const el = (tag,text,cls) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; if(cls)n.className=cls; return n; };
let payload, selected=[], requestNumber=0, nextOffset=null;
async function api(path) {const r=await fetch(path,{cache:'no-store'});if(!r.ok)throw new Error(`API returned HTTP ${r.status}`);return r.json();}
function showError(e){$('relationships')?.replaceChildren();$('status').textContent=`Unable to load stats: ${e.message}. Try Refresh rounds.`;}
function card(title,data){const c=el('div',undefined,'card');c.append(el('h3',title));for(const [k,v] of Object.entries(data||{})){if(v===null||typeof v==='object')continue;const p=el('p');p.append(el('span',label(k)),el('strong',value(k,v)));c.append(p);}return c;}
function render(){
  $('sample').hidden=!payload.sampleData;
  const round = {...payload.round};
  delete round.completedAtUnix;
  delete round.scenarioId;
  delete round.worldResource;
  if (!round.matchName) round.matchName = round.map;
  $('overview').replaceChildren(card('Round',round),card('Totals',payload.roundSummary));
  for(const team of ['US','USSR'])if(payload.roundSummary?.[team])$('overview').append(card(team,payload.roundSummary[team]));
  $('leaders').replaceChildren();
  for(const [key,entries] of Object.entries(payload.leaderboards||{})){
    if(!Array.isArray(entries)||!entries.length)continue;
    const c=el('div',undefined,'card');c.append(el('h3',label(key)));const list=el('ol');
    entries.slice(0,3).forEach((entry,i)=>{const li=el('li',`${['Gold','Silver','Bronze'][i]} · ${entry.player}`);li.append(el('span',value(key,entry.value)));list.append(li);});c.append(list);$('leaders').append(c);
  }
  renderComparison();
}
function renderComparison(){
  const names=Object.keys(payload.players||{});$('players').replaceChildren();
  selected.forEach((name,i)=>{
    const wrap=el('div',undefined,`player c${i}`), lab=el('label',`Player ${i+1}`), select=el('select');select.id=`player-${i}`;lab.htmlFor=select.id;
    names.forEach(n=>{const o=el('option',n);o.value=n;o.disabled=selected.includes(n)&&n!==name;select.append(o);});select.value=name;
    select.onchange=()=>{selected[i]=select.value;renderComparison();};wrap.append(lab,select);
    if(selected.length>1){const remove=el('button','Remove');remove.onclick=()=>{selected.splice(i,1);renderComparison();};wrap.append(remove);}$('players').append(wrap);
  });
  $('add').disabled=selected.length>=3||selected.length>=names.length;
  const table=el('table'),head=el('thead'),tr=el('tr');tr.append(el('th','Statistic'));
  selected.forEach((name,i)=>tr.append(el('th',name,`c${i}`)));head.append(tr);table.append(head);const body=el('tbody');
  for(const [category,keys] of sections(selected.map(n=>payload.players[n]))){
    const section=el('tr',undefined,'category'),title=el('th',label(category));title.colSpan=selected.length+1;section.append(title);body.append(section);
    for(const key of keys){const row=el('tr');const title=el('th',label(key));title.scope='row';row.append(title);selected.forEach((n,i)=>row.append(el('td',value(key,payload.players[n]?.overall?.[category]?.[key]),`c${i}`)));body.append(row);}
  }
  table.append(body);$('comparison').replaceChildren(table);
  let rivals=$('relationships');
  if(!rivals){rivals=el('div',undefined,'overview');rivals.id='relationships';$('comparison').after(rivals);}
  rivals.replaceChildren();
  for(const [i,name] of selected.entries()){
    const player=payload.players[name];
    // Old rounds have no relationships; keep them readable without fake zero rivals.
    if(!Array.isArray(player?.dominated)&&!Array.isArray(player?.nemesis))continue;
    const c=el('div',undefined,`card c${i}`);c.append(el('h3',name));
    for(const key of ['dominated','nemesis']){
      const title=el('h4',key==='dominated'?'Killed':'Killed By');title.title=key==='dominated'?'Enemy players you killed most':'Enemy players who killed you most';c.append(title);
      const rows=relationships(player,key);
      if(!rows.length){c.append(el('p','—'));continue;}
      const list=el('ol');for(const entry of rows)list.append(el('li',`${entry.player} — ${entry.kills}`));c.append(list);
    }
    rivals.append(c);
  }
}
async function loadRound(){const serial=++requestNumber;$('status').textContent='Loading round…';$('add').disabled=true;try{const p=await api(`/api/rounds/${encodeURIComponent($('rounds').value)}`);if(serial!==requestNumber)return;payload=p;selected=Object.keys(p.players||{}).slice(0,1);render();$('status').textContent='';}catch(e){if(serial===requestNumber){payload=null;$('players').replaceChildren();$('comparison').replaceChildren();$('overview').replaceChildren();$('leaders').replaceChildren();showError(e);}}}
async function loadRounds(older=false){$('refresh').disabled=true;$('older').disabled=true;try{
  const data=await api(`/api/rounds${older?`?offset=${nextOffset}`:''}`);if(!older)$('rounds').replaceChildren();
  for(const r of data.rounds){const o=el('option',roundLabel(r));o.value=r.id;$('rounds').append(o);}
  nextOffset=data.nextOffset;$('older').hidden=nextOffset===null;$('rounds').disabled=!$('rounds').options.length;
  if(!older){if(data.rounds.length){$('rounds').selectedIndex=0;await loadRound();}else{++requestNumber;payload=null;$('add').disabled=true;for(const id of ['players','comparison','overview','leaders'])$(id).replaceChildren();$('sample').hidden=true;$('status').textContent='No completed rounds yet. Finish a valid test round, then refresh.';}}
}catch(e){showError(e);}finally{$('refresh').disabled=false;$('older').disabled=false;}}
$('rounds').onchange=loadRound;$('refresh').onclick=()=>loadRounds();$('older').onclick=()=>loadRounds(true);
$('add').onclick=()=>{if(!payload||selected.length>=3)return;const name=Object.keys(payload.players).find(n=>!selected.includes(n));if(name){selected.push(name);renderComparison();}};
loadRounds();
