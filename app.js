// =====================
// FIREBASE IMPORTS
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
let selectedMoodId  = null;
let activeHourSlot  = null;  // jam yang sedang dipilih untuk di-edit
let calYear, calMonth;
let statsYear, statsMonth;
let dayCache   = {};   // cache harian  { "YYYY-MM-DD": { HH: entry } }
let monthCache = {};   // cache bulanan { "YYYY-M": { day: avgColor } }

// =====================
// WAKTU HELPERS
// =====================
function now() {
  const d = new Date();
  return {
    year:  d.getFullYear(),
    month: d.getMonth(),
    day:   d.getDate(),
    hour:  d.getHours()
  };
}

function today() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function pad2(n) { return String(n).padStart(2, '0'); }

// Key dokumen Firestore: "YYYY-MM-DD_HH"
function docKey(year, month, day, hour) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}_${pad2(hour)}`;
}

// Prefix tanggal: "YYYY-MM-DD"
function datePrefix(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// =====================
// FIRESTORE DATA LAYER
// =====================

// Simpan/update satu entry jam
async function saveEntry(year, month, day, hour, moodId, note) {
  const id  = docKey(year, month, day, hour);
  const ref = doc(db, 'moods', id);
  await setDoc(ref, { moodId, note, date: datePrefix(year, month, day), hour, id });
  console.log('[Firestore] Saved:', id);

  // Update day cache
  const dk = datePrefix(year, month, day);
  if (!dayCache[dk]) dayCache[dk] = {};
  dayCache[dk][hour] = { moodId, note };

  // Invalidate month cache supaya pixel kalender ikut update
  delete monthCache[`${year}-${month}`];
}

// Ambil semua entry dalam satu hari → { 8: {moodId,note}, 9: {...}, ... }
async function getDayEntries(year, month, day) {
  const dk = datePrefix(year, month, day);
  if (dayCache[dk]) return dayCache[dk];

  const prefix = dk;
  const colRef = collection(db, 'moods');
  const q      = query(colRef,
    where('date', '==', prefix)
  );
  const snap   = await getDocs(q);
  const result = {};
  snap.forEach(d => {
    const data = d.data();
    result[data.hour] = { moodId: data.moodId, note: data.note };
  });
  dayCache[dk] = result;
  return result;
}

// Ambil semua entry dalam satu bulan
// Return: { day: { hour: entry } }
async function getMonthEntries(year, month) {
  const prefix = `${year}-${pad2(month + 1)}`;
  const colRef = collection(db, 'moods');
  const q      = query(colRef,
    where('date', '>=', prefix + '-01'),
    where('date', '<=', prefix + '-31')
  );
  const snap   = await getDocs(q);
  const result = {};
  snap.forEach(d => {
    const data = d.data();
    const day  = parseInt(data.date.split('-')[2]);
    if (!result[day]) result[day] = {};
    result[day][data.hour] = { moodId: data.moodId, note: data.note };
  });
  return result;
}

// =====================
// RATA-RATA WARNA MOOD
// Hitung warna pixel berdasarkan rata-rata index mood dalam sehari
// =====================
function avgMoodColor(hourEntries) {
  const hours = Object.values(hourEntries);
  if (hours.length === 0) return null;

  // Rata-rata index mood (posisi di array MOODS)
  const indices = hours.map(e => MOODS.findIndex(m => m.id === e.moodId)).filter(i => i >= 0);
  if (indices.length === 0) return null;

  const avgIndex = Math.round(indices.reduce((a, b) => a + b, 0) / indices.length);
  return MOODS[avgIndex].color;
}

// Mood dominan (terbanyak) dalam satu hari untuk label
function dominantMood(hourEntries) {
  const counts = {};
  Object.values(hourEntries).forEach(e => {
    counts[e.moodId] = (counts[e.moodId] || 0) + 1;
  });
  const topId = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  return topId ? getMood(topId[0]) : null;
}

// =====================
// HELPERS
// =====================
function getMood(id) { return MOODS.find(m => m.id === id); }

function formatDate(year, month, day) {
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const dow  = new Date(year, month, day).getDay();
  return `${days[dow]}, ${day} ${MONTHS_ID[month]} ${year}`;
}

function formatHour(hour) {
  return `${pad2(hour)}:00 – ${pad2(hour + 1)}:00`;
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
  document.getElementById('noteArea').style.display = 'block';
  document.getElementById('moodNote').value = '';
}
window.selectMood = selectMood;

async function saveMood() {
  if (!selectedMoodId || activeHourSlot === null) return;
  const btn = document.getElementById('saveBtn');
  btn.disabled    = true;
  btn.textContent = 'Menyimpan...';
  try {
    const { year, month, day } = today();
    const note = document.getElementById('moodNote').value.trim();
    await saveEntry(year, month, day, activeHourSlot, selectedMoodId, note);
    selectedMoodId = null;
    activeHourSlot = null;
    renderMoodGrid();
    document.getElementById('noteArea').style.display    = 'none';
    document.getElementById('hourPicker').style.display  = 'none';
    await renderTodayLog();
    showToast('Mood berhasil disimpan! ✨');
  } catch (e) {
    showToast('Gagal menyimpan: ' + e.message);
    console.error('[saveMood]', e);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Simpan\nMood';
  }
}
window.saveMood = saveMood;

// Render daftar mood hari ini per jam
async function renderTodayLog() {
  const { year, month, day, hour: currentHour } = now();
  const entries = await getDayEntries(year, month, day);
  const log     = document.getElementById('todayLog');

  if (Object.keys(entries).length === 0) {
    log.innerHTML = `<div class="log-empty">Belum ada mood hari ini. Pilih emoji di atas! 👆</div>`;
    return;
  }

  // Urutkan jam dari kecil ke besar
  const sorted = Object.entries(entries).sort((a, b) => a[0] - b[0]);
  log.innerHTML = sorted.map(([h, e]) => {
    const mood      = getMood(e.moodId);
    const hourInt   = parseInt(h);
    const isEditable = hourInt === currentHour;
    return `
      <div class="log-item" style="border-left: 3px solid ${mood.color}">
        <div class="log-time">${formatHour(hourInt)}</div>
        <div class="log-mood">
          <span class="log-emoji">${mood.emoji}</span>
          <div class="log-info">
            <span class="log-name">${mood.name}</span>
            ${e.note ? `<span class="log-note">"${e.note}"</span>` : ''}
          </div>
          ${isEditable ? `<button class="log-edit-btn" onclick="editHour(${hourInt})">Ubah</button>` : ''}
        </div>
      </div>`;
  }).join('');
}

// Pilih jam dari slot tersedia (jam sekarang & jam yang belum diisi sebelumnya)
async function initHome() {
  const { year, month, day, hour: currentHour } = now();
  const entries = await getDayEntries(year, month, day);

  // Render hour picker — tampilkan jam yang boleh diisi
  renderHourPicker(currentHour, entries);
  renderMoodGrid();
  document.getElementById('noteArea').style.display = 'none';
  await renderTodayLog();
}

function renderHourPicker(currentHour, entries) {
  const picker = document.getElementById('hourPicker');

  // Hanya tampilkan jam sekarang yang bisa dipilih (atau belum ada entry)
  const alreadyFilled = entries[currentHour];
  if (alreadyFilled) {
    // Jam ini sudah ada entry, sembunyikan picker & grid sampai user klik Ubah
    picker.style.display = 'none';
    document.getElementById('moodGrid').style.display = 'none';
    return;
  }

  picker.style.display = 'block';
  document.getElementById('moodGrid').style.display = 'grid';
  picker.innerHTML = `
    <div class="hour-slot active-slot" onclick="selectHour(${currentHour})">
      <span class="hour-slot-time">${formatHour(currentHour)}</span>
      <span class="hour-slot-label">Sekarang</span>
    </div>
  `;
  activeHourSlot = currentHour;
}

function selectHour(hour) {
  activeHourSlot = hour;
  document.getElementById('moodGrid').style.display = 'grid';
  document.getElementById('noteArea').style.display = 'none';
  selectedMoodId = null;
  renderMoodGrid();
}
window.selectHour = selectHour;

// Ubah mood di jam yang masih aktif (jam sekarang)
function editHour(hour) {
  const { hour: currentHour } = now();
  if (hour !== currentHour) {
    showToast('Tidak bisa mengubah mood jam yang sudah lewat.');
    return;
  }
  activeHourSlot = hour;
  selectedMoodId = null;
  document.getElementById('hourPicker').style.display  = 'block';
  document.getElementById('moodGrid').style.display    = 'grid';
  document.getElementById('noteArea').style.display    = 'none';
  renderMoodGrid();
  document.getElementById('moodGrid').scrollIntoView({ behavior: 'smooth' });
}
window.editHour = editHour;

// =====================
// TAB CALENDAR
// =====================
async function renderCalendar() {
  document.getElementById('calMonthLabel').textContent = `${MONTHS_ID[calMonth]} ${calYear}`;
  renderPixelLegend();
  document.getElementById('pixelGrid').innerHTML =
    Array(35).fill(`<div class="pixel-cell" style="opacity:.15"></div>`).join('');

  const monthData = await getMonthEntries(calYear, calMonth);
  renderPixelGrid(monthData);
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

function renderPixelGrid(monthData) {
  const t           = today();
  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  let html = '';

  for (let i = 0; i < firstDay; i++) html += `<div class="pixel-cell empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const hourEntries = monthData[d] || {};
    const color       = avgMoodColor(hourEntries);
    const isToday     = calYear === t.year && calMonth === t.month && d === t.day;
    const hasMood     = color !== null;
    html += `
      <div class="pixel-cell ${isToday ? 'today-ring' : ''} ${hasMood ? 'has-mood' : ''}"
           style="${hasMood ? `background:${color}` : ''}"
           onclick="showPixelDetail(${d})">
        ${!hasMood ? d : ''}
      </div>`;
  }
  document.getElementById('pixelGrid').innerHTML = html;
}

async function showPixelDetail(day) {
  const monthData   = await getMonthEntries(calYear, calMonth);
  const hourEntries = monthData[day] || {};
  const detail      = document.getElementById('pixelDetail');

  if (Object.keys(hourEntries).length === 0) {
    detail.style.display = 'none';
    return;
  }

  const dominant = dominantMood(hourEntries);
  const count    = Object.keys(hourEntries).length;

  document.getElementById('pdDate').textContent  = formatDate(calYear, calMonth, day);
  document.getElementById('pdEmoji').textContent = dominant ? dominant.emoji : '❓';
  document.getElementById('pdName').textContent  = dominant ? dominant.name : '-';
  document.getElementById('pdNote').textContent  = `${count} mood tercatat hari ini`;
  detail.style.display = 'flex';
  detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.showPixelDetail = showPixelDetail;

// =====================
// TAB STATS
// =====================
async function renderStats() {
  document.getElementById('statsMonthLabel').textContent = `${MONTHS_ID[statsMonth]} ${statsYear}`;

  const monthData   = await getMonthEntries(statsYear, statsMonth);
  const daysInMonth = new Date(statsYear, statsMonth + 1, 0).getDate();

  // Hitung total entry (per jam) dan hari aktif
  let totalEntries = 0;
  let activeDays   = 0;
  const counts     = {};
  MOODS.forEach(m => counts[m.id] = 0);

  Object.values(monthData).forEach(hourEntries => {
    const dayCount = Object.keys(hourEntries).length;
    if (dayCount > 0) activeDays++;
    totalEntries += dayCount;
    Object.values(hourEntries).forEach(e => {
      if (counts[e.moodId] !== undefined) counts[e.moodId]++;
    });
  });

  document.getElementById('statsSummary').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-val">${activeDays}</div>
      <div class="stat-card-lbl">Hari tercatat</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-val">${totalEntries}</div>
      <div class="stat-card-lbl">Total entry mood</div>
    </div>
  `;

  const max = Math.max(...Object.values(counts), 1);
  document.getElementById('statsBars').innerHTML = totalEntries === 0
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
    const dk      = datePrefix(d.getFullYear(), d.getMonth(), d.getDate());
    const entries = dayCache[dk] || null;
    // Cek Firestore langsung kalau tidak ada di cache
    const colRef  = collection(db, 'moods');
    const q       = query(colRef, where('date', '==', dk));
    const snap    = await getDocs(q);
    if (snap.empty) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// =====================
// START
// =====================
initApp();
