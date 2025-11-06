// Simple PWA food tracker using localStorage
const $ = (sel) => document.querySelector(sel);

const KEYS = {
  entries: 'pft-entries',
  goals: 'pft-goals',
};

const defaultGoals = { calories: 2200, protein: 170, carbs: 220, fat: 70 };

const state = {
  entries: load(KEYS.entries, []),
  goals: load(KEYS.goals, defaultGoals),
  date: new Date().toISOString().slice(0,10),
  editingId: null,
};

function load(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch{ return fallback; }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function uid(){ return Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(6); }
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function init(){
  $('#date').value = state.date;
  // events
  $('#date').addEventListener('change', (e)=>{ state.date = e.target.value; render(); });
  $('#btn-goals').addEventListener('click', editGoals);
  $('#save').addEventListener('click', saveEntry);
  $('#cancel').addEventListener('click', resetForm);
  $('#copy-prev').addEventListener('click', copyPreviousDay);
  $('#clear-day').addEventListener('click', clearDay);
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#import-json').addEventListener('change', importJSON);

  document.querySelectorAll('button[data-q]').forEach(b => {
    b.addEventListener('click', () => {
      const q = JSON.parse(b.getAttribute('data-q'));
      $('#name').value = q.name || '';
      $('#calories').value = q.calories || '';
      $('#protein').value = q.protein || '';
      $('#carbs').value = q.carbs || '';
      $('#fat').value = q.fat || '';
      $('#qty').value = q.qty || '';
    });
  });

  render();
}

function editGoals(){
  const g = state.goals;
  const calories = prompt('Daily calories', g.calories);
  if (calories === null) return;
  const protein = prompt('Daily protein (g)', g.protein);
  if (protein === null) return;
  const carbs = prompt('Daily carbs (g)', g.carbs);
  if (carbs === null) return;
  const fat = prompt('Daily fat (g)', g.fat);
  if (fat === null) return;
  state.goals = {
    calories: Number(calories || 0),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fat: Number(fat || 0),
  };
  save(KEYS.goals, state.goals);
  render();
}

function saveEntry(){
  const entry = {
    id: state.editingId || uid(),
    date: state.date,
    meal: $('#meal').value,
    name: $('#name').value.trim(),
    calories: Number($('#calories').value || 0),
    protein: Number($('#protein').value || 0),
    carbs: Number($('#carbs').value || 0),
    fat: Number($('#fat').value || 0),
    qty: $('#qty').value,
    notes: $('#notes').value,
  };
  if (!entry.name) { alert('Please enter a name'); return; }
  if (state.editingId){
    state.entries = state.entries.map(e => e.id === state.editingId ? entry : e);
  } else {
    state.entries.push(entry);
  }
  state.editingId = null;
  save(KEYS.entries, state.entries);
  resetForm();
  render();
}

function resetForm(){
  state.editingId = null;
  $('#meal').value = 'Breakfast';
  $('#name').value = '';
  $('#calories').value = '';
  $('#protein').value = '';
  $('#carbs').value = '';
  $('#fat').value = '';
  $('#qty').value = '';
  $('#notes').value = '';
}

function copyPreviousDay(){
  const d = new Date(state.date);
  d.setDate(d.getDate() - 1);
  const prev = d.toISOString().slice(0,10);
  const prevEntries = state.entries.filter(e => e.date === prev);
  if (!prevEntries.length) return alert('No entries from the previous day.');
  const clones = prevEntries.map(e => ({ ...e, id: uid(), date: state.date }));
  state.entries = state.entries.concat(clones);
  save(KEYS.entries, state.entries);
  render();
}

function clearDay(){
  if (!confirm('Delete all entries for this day?')) return;
  state.entries = state.entries.filter(e => e.date !== state.date);
  save(KEYS.entries, state.entries);
  render();
}

function sumDay(day){
  return day.reduce((acc,e)=>{
    acc.calories += e.calories;
    acc.protein += e.protein;
    acc.carbs += e.carbs;
    acc.fat += e.fat;
    return acc;
  }, {calories:0, protein:0, carbs:0, fat:0});
}

function ring(label, value, total){
  const p = !total ? 0 : Math.max(0, Math.min(100, (value/total)*100));
  const r = 40, c = 2*Math.PI*r, dash = (p/100)*c;
  return `
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center">
    <svg width="110" height="110" style="transform:rotate(-90deg)">
      <circle cx="55" cy="55" r="${r}" stroke-width="10" stroke="var(--ringbg)" fill="transparent"></circle>
      <circle cx="55" cy="55" r="${r}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${dash} ${c-dash}" stroke="var(--primary)" fill="transparent"></circle>
    </svg>
    <div style="margin-top:-64px; transform:rotate(90deg); text-align:center">
      <div style="font-weight:600;font-size:18px">${Math.round(p)}%</div>
      <div class="muted" style="font-size:12px">${label}</div>
      <div style="font-size:12px">${round2(value)} / ${total}</div>
    </div>
  </div>`;
}

function macroBar(label, value, total, unit){
  const p = !total ? 0 : Math.max(0, Math.min(100, (value/total)*100));
  return `
  <div>
    <div class="space">
      <span style="font-size:12px">${label}</span>
      <span class="muted" style="font-size:12px">${round2(value)} / ${total} ${unit}</span>
    </div>
    <div class="bar"><span style="width:${p}%;"></span></div>
  </div>`;
}

function render(){
  const day = state.entries.filter(e => e.date === state.date).sort((a,b)=>{
    const o = ['Breakfast','Lunch','Dinner','Snack'];
    return o.indexOf(a.meal) - o.indexOf(b.meal);
  });
  const totals = sumDay(day);
  const left = Math.max(0, (state.goals.calories - totals.calories));
  $('#cal-left').textContent = round2(left);
  // rings
  $('#rings').innerHTML = [
    ring('Calories', totals.calories, state.goals.calories),
    ring('Protein (g)', totals.protein, state.goals.protein),
    ring('Carbs (g)', totals.carbs, state.goals.carbs),
  ].join('');
  // macro bars
  $('#macro-bars').innerHTML = [
    macroBar('Protein', totals.protein, state.goals.protein, 'g'),
    macroBar('Carbs', totals.carbs, state.goals.carbs, 'g'),
    macroBar('Fat', totals.fat, state.goals.fat, 'g'),
  ].join('');

  // log
  $('#count').textContent = `${day.length} item${day.length!==1?'s':''}`;
  const log = day.map(e => {
    return `<div class="space" style="padding:8px 0">
      <div>
        <div><span class="badge">${e.meal}</span> <b>${e.name}</b></div>
        <div class="muted" style="font-size:12px">${e.qty?e.qty+' • ':''}${e.protein}P / ${e.carbs}C / ${e.fat}F • ${e.calories} kcal ${e.notes?(' • '+e.notes):''}</div>
      </div>
      <div class="row">
        <button class="btn" data-edit="${e.id}">Edit</button>
        <button class="btn danger" data-del="${e.id}">Delete</button>
      </div>
    </div>`;
  }).join('');
  $('#log').innerHTML = log || `<div class="muted" style="text-align:center;padding:16px">No entries yet. Add your first meal above.</div>`;
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = ()=>{
    const id = b.getAttribute('data-del');
    if (confirm('Delete this entry?')){
      state.entries = state.entries.filter(x => x.id !== id);
      save(KEYS.entries, state.entries); render();
    }
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = ()=>{
    const id = b.getAttribute('data-edit');
    const e = state.entries.find(x => x.id === id);
    if (!e) return;
    state.editingId = id;
    $('#meal').value = e.meal;
    $('#name').value = e.name;
    $('#calories').value = e.calories;
    $('#protein').value = e.protein;
    $('#carbs').value = e.carbs;
    $('#fat').value = e.fat;
    $('#qty').value = e.qty || '';
    $('#notes').value = e.notes || '';
    $('#date').value = e.date;
    state.date = e.date;
  });

  // totals footer
  $('#tcal').textContent = round2(totals.calories);
  $('#tpro').textContent = round2(totals.protein) + ' g';
  $('#tcarb').textContent = round2(totals.carbs) + ' g';
  $('#tfat').textContent = round2(totals.fat) + ' g';

  // history table
  const byDate = {};
  state.entries.forEach(e => { (byDate[e.date] ||= []).push(e); });
  const rows = Object.entries(byDate).sort((a,b)=> a[0] < b[0] ? 1 : -1).map(([d, list]) => {
    const t = sumDay(list);
    return `<tr data-goto="${d}"><td>${d}</td><td>${round2(t.calories)}</td><td>${round2(t.protein)} g</td><td>${round2(t.carbs)} g</td><td>${round2(t.fat)} g</td><td>${list.length}</td></tr>`;
  }).join('');
  $('#history').innerHTML = rows ? `<div style="overflow:auto"><table>
    <thead><tr class="muted"><th>Date</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th><th>Items</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : `<div class="muted">No history yet.</div>`;
  document.querySelectorAll('[data-goto]').forEach(tr => tr.onclick = () => {
    const d = tr.getAttribute('data-goto');
    state.date = d;
    $('#date').value = d;
    render();
  });
}

function exportCSV(){
  const header = ['id','date','meal','name','calories','protein','carbs','fat','qty','notes'].join(',');
  const rows = state.entries.map(e => {
    const safe = (v) => {
      v = String(v ?? '');
      const needsQuotes = /[",\n]/.test(v);
      const escaped = v.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    };
    return [e.id,e.date,e.meal,safe(e.name),e.calories,e.protein,e.carbs,e.fat,safe(e.qty),safe(e.notes)].join(',');
  }).join('\n');
  const csv = header + '\n' + rows;
  download('food-log.csv', csv, 'text/csv');
}

function exportJSON(){
  download('food-log.json', JSON.stringify(state.entries, null, 2), 'application/json');
}

function importJSON(ev){
  const file = ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data)) throw new Error('Invalid file');
      const cleaned = data.map(d => ({...d, id: d.id || uid()}));
      state.entries = cleaned;
      save(KEYS.entries, state.entries);
      render();
    } catch(e){
      alert('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

function download(filename, text, mime){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

init();