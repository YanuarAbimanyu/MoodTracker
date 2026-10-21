// =====================
// FIREBASE IMPORTS — tanpa Auth
// =====================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyB_TUkT3fittz4WZUb8yU5EIRgK322hbwM",
  authDomain:        "moodtracker-c4852.firebaseapp.com",
  projectId:         "moodtracker-c4852",
  storageBucket:     "moodtracker-c4852.firebasestorage.app",
  messagingSenderId: "470657808738",
  appId:             "1:470657808738:web:73f8ca65e3247596dc543b"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// =====================
// MOOD DATA
// =====================
const MOODS = [
  { id: 'great',   emoji: '🤩', name: 'Luar Biasa', color: '#fbbf24' },
  { id: 'happy',   emoji: '😊', name: 'Senang',      color: '#34d399' },
  { id: 'love',    emoji: '🥰', name: 'Penuh Cinta', color: '#f472b6' },
  { id: 'meh',     emoji: '😐', name: 'Biasa Saja',  color: '#94a3b8' },
  { id: 'sad',     emoji: '😢', name: 'Sedih',        color: '#60a5fa' },
  { id: 'anxious', emoji: '😰', name: 'Cemas',        color: '#a78bfa' },
  { id: 'angry',   emoji: '😠', name: 'Marah',        color: '#fb923c' },
  { id: 'rad',     emoji: '🤯', name: 'Overwhelmed',  color: '#f87171' },
];

const MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

// =====================
// STATE
// =====================
let selectedMoodId = null;
let calYear, calMonth;
let statsYear, statsMonth;
let monthCache = {};   // cache { "YYYY-M": { day: entry } }

// =====================
// FIRESTORE DATA LAYER
// Collection: moods/{YYYY-MM-DD}
// =====================
function docKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

async function saveEntry(year, month, day, moodId, note) {
  const id  = docKey(year, month, day);
  const ref = doc(db, 'moods', id);

  await setDoc(ref, { moodId, note, date: id });
  console.log('[Firestore] Saved:', id, moodId);

  // Update cache
  const cacheKey = `${year}-${month}`;
  if (!monthCache[cacheKey]) monthCache[cacheKey] = {};
  monthCache[cacheKey][day] = { moodId, note };
}

async function getEntry(year, month, day) {
  const cacheKey = `${year}-${month}`;
  if (monthCache[cacheKey]) return monthCache[cacheKey][day] || null;

  const ref  = doc(db, 'moods', docKey(year, month, day));
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function fetchMonthEntries(year, month) {
  const cacheKey = `${year}-${month}`;
  if (monthCache[cacheKey]) return monthCache[cacheKey];

  const prefix = `${year}-${String(month + 1).padStart(2,'0')}`;
  const colRef = collection(db, 'moods');
  const q      = query(colRef,
    where('date', '>=', prefix + '-01'),
    where('date', '<=', prefix + '-31')
  );
  const snap   = await getDocs(q);
  const result = {};
  snap.forEach(d => {
    const day = parseInt(d.data().date.split('-')[2]);
    result[day] = d.data();
  });
  monthCache[cacheKey] = result;
  return result;
}

// =====================
// HELPERS
// =====================
function getMood(id) { return MOODS.find(m => m.id === id); }

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function formatDate(year, month, day) {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const dow  = new Date(year, month, day).getDay();
  return `${days[dow]}, ${day} ${MONTHS_ID[month]} ${year}`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// =====================
// INIT APP
// =====================
function initApp() {
  const t = today();
  calYear   = t.year;  calMonth   = t.month;
  statsYear = t.year;  statsMonth = t.month;

  document.getElementById('splash').style.display    = 'none';
  document.getElementById('appHeader').style.display = 'flex';
  document.getElementById('appNav').style.display    = 'flex';
  document.getElementById('appMain').style.display   = 'block';

  renderHeaderDate();
  initHome();
}

function renderHeaderDate() {
  const { year, month, day } = today();
  document.getElementById('todayDate').textContent = `${day} ${MONTHS_ID[month]} ${year}`;
}

// =====================
// TAB SWITCHING
// =====================
function switchTab(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b  => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'calendar') renderCalendar();
  if (tab === 'stats')    renderStats();
}
window.switchTab = switchTab;

// =====================
// TAB HOME
// =====================
function renderMoodGrid() {
  document.getElementById('moodGrid').innerHTML = MOODS.map(m => `
    <div class="mood-item ${selectedMoodId === m.id ? 'selected' : ''}"
         onclick="selectMood('${m.id}')"
         style="${selectedMoodId === m.id
           ? `border-color:${m.color};box-shadow:0 0 0 2px ${m.color}` : ''}">
      <span class="mood-emoji">${m.emoji}</span>
      <span class="mood-name">${m.name}</span>
    </div>
  `).join('');
}

function selectMood(id) {
  selectedMoodId = id;
  renderMoodGrid();
  document.getElementById('noteArea').style.display      = 'block';
  document.getElementById('todayMoodCard').style.display = 'none';
  document.getElementById('moodNote').value = '';
}
window.selectMood = selectMood;

async function saveMood() {
  if (!selectedMoodId) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';
  try {
    const { year, month, day } = today();
    const note = document.getElementById('moodNote').value.trim();
    await saveEntry(year, month, day, selectedMoodId, note);
    selectedMoodId = null;
    renderMoodGrid();
    document.getElementById('noteArea').style.display = 'none';
    await showTodayMoodCard();
    showToast('Mood berhasil disimpan! ✨');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message);
    console.error('[saveMood]', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Simpan Mood';
  }
}
window.saveMood = saveMood;

async function showTodayMoodCard() {
  const { year, month, day } = today();
  const entry = await getEntry(year, month, day);
  const card  = document.getElementById('todayMoodCard');
  if (!entry) { card.style.display = 'none'; return; }
  const mood = getMood(entry.moodId);
  document.getElementById('tmcEmoji').textContent = mood.emoji;
  document.getElementById('tmcName').textContent  = mood.name;
  document.getElementById('tmcNote').textContent  = entry.note ? `"${entry.note}"` : '';
  card.style.borderLeft = `4px solid ${mood.color}`;
  card.style.display    = 'block';
}

function changeMood() {
  document.getElementById('todayMoodCard').style.display = 'none';
  document.getElementById('noteArea').style.display      = 'none';
  selectedMoodId = null;
  renderMoodGrid();
}
window.changeMood = changeMood;

async function initHome() {
  renderMoodGrid();
  await showTodayMoodCard();
}

// =====================
// TAB CALENDAR
// =====================
async function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${MONTHS_ID[calMonth]} ${calYear}`;
  renderPixelLegend();
  document.getElementById('pixelGrid').innerHTML =
    Array(35).fill(`<div class="pixel-cell" style="opacity:.15"></div>`).join('');
  const entries = await fetchMonthEntries(calYear, calMonth);
  renderPixelGrid(entries);
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  document.getElementById('pixelDetail').style.display = 'none';
  renderCalendar();
}
window.changeMonth = changeMonth;

function renderPixelLegend() {
  document.getElementById('pixelLegend').innerHTML = MOODS.map(m => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${m.color}"></div>
      <span>${m.name}</span>
    </div>
  `).join('');
}

function renderPixelGrid(entries) {
  const t           = today();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="pixel-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const entry   = entries[d];
    const mood    = entry ? getMood(entry.moodId) : null;
    const isToday = calYear === t.year && calMonth === t.month && d === t.day;
    html += `
      <div class="pixel-cell ${isToday ? 'today-ring' : ''} ${mood ? 'has-mood' : ''}"
           style="${mood ? `background:${mood.color}` : ''}"
           onclick="showPixelDetail(${d})">
        ${!mood ? d : ''}
      </div>`;
  }
  document.getElementById('pixelGrid').innerHTML = html;
}

async function showPixelDetail(day) {
  const entries = await fetchMonthEntries(calYear, calMonth);
  const entry   = entries[day];
  const detail  = document.getElementById('pixelDetail');
  if (!entry) { detail.style.display = 'none'; return; }
  const mood = getMood(entry.moodId);
  document.getElementById('pdDate').textContent  = formatDate(calYear, calMonth, day);
  document.getElementById('pdEmoji').textContent = mood.emoji;
  document.getElementById('pdName').textContent  = mood.name;
  document.getElementById('pdNote').textContent  = entry.note ? `"${entry.note}"` : '';
  detail.style.display = 'flex';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.showPixelDetail = showPixelDetail;

// =====================
// TAB STATS
// =====================
async function renderStats() {
  document.getElementById('statsMonthLabel').textContent = `${MONTHS_ID[statsMonth]} ${statsYear}`;

  const entries     = await fetchMonthEntries(statsYear, statsMonth);
  const days        = Object.keys(entries).length;
  const daysInMonth = new Date(statsYear, statsMonth + 1, 0).getDate();

  const counts = {};
  MOODS.forEach(m => counts[m.id] = 0);
  Object.values(entries).forEach(e => { if (counts[e.moodId] !== undefined) counts[e.moodId]++; });

  document.getElementById('statsSummary').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-val">${days}</div>
      <div class="stat-card-lbl">Hari tercatat</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-val">${daysInMonth - days}</div>
      <div class="stat-card-lbl">Hari terlewat</div>
    </div>
  `;

  const max = Math.max(...Object.values(counts), 1);
  document.getElementById('statsBars').innerHTML = days === 0
    ? `<div class="empty-state"><div class="empty-state-icon">📭</div>Belum ada data bulan ini</div>`
    : MOODS.filter(m => counts[m.id] > 0)
        .sort((a, b) => counts[b.id] - counts[a.id])
        .map(m => `
          <div class="bar-row">
            <span class="bar-emoji">${m.emoji}</span>
            <span class="bar-name">${m.name}</span>
            <div class="bar-track">
              <div class="bar-fill" style="width:${(counts[m.id]/max)*100}%;background:${m.color}"></div>
            </div>
            <span class="bar-count">${counts[m.id]}</span>
          </div>`).join('');

  const streak = await calcStreak();
  document.getElementById('statsStreak').innerHTML = `
    <div class="streak-val">🔥 ${streak}</div>
    <div class="streak-lbl">Hari streak mencatat mood</div>
  `;

  const topId   = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  const topMood = topId && topId[1] > 0 ? getMood(topId[0]) : null;
  document.getElementById('statsFrequent').innerHTML = topMood
    ? `<div class="frequent-emoji">${topMood.emoji}</div>
       <div class="tmc-name" style="margin-top:6px">${topMood.name}</div>
       <div class="frequent-lbl">Mood paling sering bulan ini</div>`
    : `<div class="empty-state"><div class="empty-state-icon">🤔</div>Belum ada data</div>`;
}

function changeStatsMonth(dir) {
  statsMonth += dir;
  if (statsMonth < 0)  { statsMonth = 11; statsYear--; }
  if (statsMonth > 11) { statsMonth = 0;  statsYear++; }
  renderStats();
}
window.changeStatsMonth = changeStatsMonth;

async function calcStreak() {
  let streak = 0;
  const d = new Date();
  while (streak < 365) {
    const entry = await getEntry(d.getFullYear(), d.getMonth(), d.getDate());
    if (!entry) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// =====================
// START — langsung init tanpa auth
// =====================
initApp();
