import './style.css';
import { dbApp } from './db.js';

// DOM Elements
const swipeContainer = document.getElementById('app-container');
const clockPage = document.getElementById('clock-page');
const diaryPage = document.getElementById('diary-page');
const backToClockBtn = document.getElementById('back-to-clock');

// Clock
const hourHand = document.getElementById('hour-hand');
const minuteHand = document.getElementById('minute-hand');
const secondHand = document.getElementById('second-hand');
const digitalClock = document.getElementById('digital-clock');
const clockGlass = document.querySelector('.clock-glass');

// Multiple Alarms
const alarmsList = document.getElementById('alarms-list');
const newAlarmTime = document.getElementById('new-alarm-time');
const addAlarmBtn = document.getElementById('add-alarm-btn');
const customSoundInput = document.getElementById('custom-sound-input');

// Stop Alarm Overlay
const stopAlarmOverlay = document.getElementById('stop-alarm-overlay');
const stopAlarmBtn = document.getElementById('stop-alarm-btn');
const alarmMessage = document.getElementById('alarm-message');
const alarmAudio = document.getElementById('alarm-audio');

// Diary
const diaryDateInput = document.getElementById('diary-date');
const dailyEntry = document.getElementById('daily-entry');
const eventsList = document.getElementById('events-list');

// Add Event Form
const addEventForm = document.getElementById('add-event-form');
const showAddEventBtn = document.getElementById('show-add-event-btn');
const cancelEventBtn = document.getElementById('cancel-event-btn');
const eventTitleInput = document.getElementById('event-title-input');
const eventTimeInput = document.getElementById('event-time-input');

// App State
let isAlarming = false;

function getLocalISODate() {
  const d = new Date();
  return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}
let currentDiaryDate = getLocalISODate();

const swipeHint = document.querySelector('.swipe-hint');

if ('Notification' in window) {
  Notification.requestPermission();
}

/**
 * Clock Initialization
 */
function createClockTicks() {
  const analogClock = document.getElementById('analog-clock');
  for (let i = 0; i < 60; i++) {
    const container = document.createElement('div');
    container.className = 'tick-container';
    container.style.transform = `rotate(${i * 6}deg)`;
    const tick = document.createElement('div');
    tick.className = `tick ${i % 5 === 0 ? 'hour-tick' : ''}`;
    container.appendChild(tick);
    analogClock.appendChild(container);
  }
}

/**
 * Clock Update & Alarm Check
 */
function updateClock() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  const hDeg = (hours % 12) * 30 + minutes * 0.5;
  const mDeg = minutes * 6;
  const sDeg = seconds * 6;

  hourHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;
  minuteHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
  secondHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');
  digitalClock.textContent = `${hStr}:${mStr}:${sStr}`;

  checkAlarms(hStr, mStr, sStr);
}

async function checkAlarms(hStr, mStr, sStr) {
  if (sStr !== '00') return; // Only trigger exactly at the 00 second mark
  const currentHM = `${hStr}:${mStr}`;

  // 1. Check Multiple Standalone Alarms
  const allAlarms = await dbApp.getAllAlarms();
  allAlarms.forEach(alarm => {
    if (alarm.enabled && alarm.time === currentHM && !isAlarming) {
      triggerAlarm(`Alarm - ${alarm.time}`);
    }
  });

  // 2. Check Event Alarms
  const events = await dbApp.getAllEvents();
  events.forEach(ev => {
    if (ev.alarmEnabled && ev.time === currentHM && !isAlarming) {
      triggerAlarm(`Event: ${ev.title}`);
    }
  });
}

function triggerAlarm(message) {
  isAlarming = true;
  clockGlass.classList.add('alarming');
  digitalClock.classList.add('alarming');
  
  alarmMessage.textContent = message;
  stopAlarmOverlay.classList.add('active');

  alarmAudio.play().catch(e => console.warn('Audio play blocked user interaction required'));

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Smartwatch Alarm!', { body: message, icon: '/icon-192.png' });
  }
}

stopAlarmBtn.addEventListener('click', () => {
  stopAlarm();
});

function stopAlarm() {
  isAlarming = false;
  clockGlass.classList.remove('alarming');
  digitalClock.classList.remove('alarming');
  stopAlarmOverlay.classList.remove('active');
  alarmAudio.pause();
  alarmAudio.currentTime = 0;
}

/**
 * App State Load
 */
async function loadState() {
  // Custom Audio Load
  try {
    const savedAudioBlob = await dbApp.getSetting('customSound');
    if (savedAudioBlob) {
      const url = URL.createObjectURL(savedAudioBlob);
      alarmAudio.src = url;
    }
  } catch (e) {}

  diaryDateInput.value = currentDiaryDate;
  diaryDateInput.max = currentDiaryDate; 
  
  await renderAlarms();
  await loadDiary();
  await renderEvents();
}

/**
 * Multiple Alarms Management
 */
async function renderAlarms() {
  alarmsList.innerHTML = '';
  try {
    const alarms = await dbApp.getAllAlarms();
    // Exclude the old dummy 'main' if it exists to clean up
    const validAlarms = alarms.filter(a => a.id !== 'main');
    validAlarms.sort((a,b) => a.time.localeCompare(b.time));

    validAlarms.forEach(alarm => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="event-info">
          <span class="event-title" style="font-size:1.1rem;">${alarm.time}</span>
        </div>
        <div>
          <button class="glass-btn ${alarm.enabled ? 'active' : ''}" style="padding: 5px 10px;" title="Toggle Alarm">🔔</button>
          <button class="glass-btn delete-alarm-btn" style="padding: 5px 10px;" title="Delete Alarm">❌</button>
        </div>
      `;
      
      const toggleBtn = li.querySelector('button[title="Toggle Alarm"]');
      toggleBtn.addEventListener('click', async () => {
        alarm.enabled = !alarm.enabled;
        if (!alarm.enabled && isAlarming) {
          stopAlarm();
        }
        await dbApp.saveAlarm(alarm.id, alarm);
        renderAlarms();
      });

      const delBtn = li.querySelector('.delete-alarm-btn');
      delBtn.addEventListener('click', async () => {
        await dbApp.deleteAlarm(alarm.id);
        renderAlarms();
      });

      alarmsList.appendChild(li);
    });
  } catch(e) { console.error('Error loading alarms', e); }
}

addAlarmBtn.addEventListener('click', async () => {
  const time = newAlarmTime.value;
  if (!time) { alert('Please select a time for the alarm'); return; }

  const newId = Date.now().toString();
  await dbApp.saveAlarm(newId, { time, enabled: true });
  newAlarmTime.value = '';
  renderAlarms();
});

// Custom Sound Upload
customSoundInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await dbApp.saveSetting('customSound', file);
    const url = URL.createObjectURL(file);
    alarmAudio.src = url;
    alert('Custom alarm sound applied!');
  }
});

/**
 * Diary Logic
 */
async function loadDiary() {
  try {
    const entry = await dbApp.getDiary(currentDiaryDate);
    dailyEntry.value = entry ? entry.text : '';
  } catch(e) { console.error(e); }
}

diaryDateInput.addEventListener('change', (e) => {
  currentDiaryDate = e.target.value;
  loadDiary();
});

let diaryTimeout;
dailyEntry.addEventListener('input', () => {
  clearTimeout(diaryTimeout);
  diaryTimeout = setTimeout(async () => {
    await dbApp.saveDiary(currentDiaryDate, dailyEntry.value);
  }, 1000); 
});

/**
 * Events Logic
 */
async function renderEvents() {
  eventsList.innerHTML = '';
  try {
    const events = await dbApp.getAllEvents();
    events.sort((a,b) => a.time.localeCompare(b.time));

    events.forEach(ev => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="event-info">
          <span class="event-title">${escapeHTML(ev.title)}</span>
          <span class="event-time">${ev.time}</span>
        </div>
        <div>
          <button class="glass-btn ${ev.alarmEnabled ? 'active' : ''}" style="padding: 5px 10px;" data-id="${ev.id}" title="Toggle Alarm">🔔</button>
          <button class="glass-btn delete-btn" style="padding: 5px 10px;" data-id="${ev.id}" title="Delete Event">❌</button>
        </div>
      `;
      
      const toggleBtn = li.querySelector('button[title="Toggle Alarm"]');
      toggleBtn.addEventListener('click', async () => {
        ev.alarmEnabled = !ev.alarmEnabled;
        if (!ev.alarmEnabled && isAlarming) {
          stopAlarm();
        }
        await dbApp.updateEvent(ev.id, ev);
        renderEvents();
      });

      const delBtn = li.querySelector('.delete-btn');
      delBtn.addEventListener('click', async () => {
        if (confirm('Delete this event?')) {
          await dbApp.deleteEvent(ev.id);
          renderEvents();
        }
      });

      eventsList.appendChild(li);
    });
  } catch(e) { console.error('Error loading events', e); }
}

showAddEventBtn.addEventListener('click', () => {
  addEventForm.classList.remove('hidden');
  showAddEventBtn.classList.add('hidden');
});

cancelEventBtn.addEventListener('click', () => {
  addEventForm.classList.add('hidden');
  showAddEventBtn.classList.remove('hidden');
  addEventForm.reset();
});

addEventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = eventTitleInput.value;
  const time = eventTimeInput.value;
  
  await dbApp.addEvent({ title, time, alarmEnabled: true });
  
  addEventForm.reset();
  addEventForm.classList.add('hidden');
  showAddEventBtn.classList.remove('hidden');
  renderEvents();
});

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

/**
 * Gestures and Hover Events
 */
let startX = 0;

clockPage.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive: true});
clockPage.addEventListener('touchend', e => {
  const endX = e.changedTouches[0].clientX;
  if (startX - endX > 50) swipeContainer.classList.add('show-diary');
});

diaryPage.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, {passive: true});
diaryPage.addEventListener('touchend', e => {
  const endX = e.changedTouches[0].clientX;
  if (endX - startX > 50) swipeContainer.classList.remove('show-diary');
});

if (swipeHint) {
  swipeHint.addEventListener('mouseenter', () => swipeContainer.classList.add('show-diary'));
  swipeHint.addEventListener('click', () => swipeContainer.classList.add('show-diary'));
}

backToClockBtn.addEventListener('click', () => swipeContainer.classList.remove('show-diary'));
backToClockBtn.addEventListener('mouseenter', () => swipeContainer.classList.remove('show-diary'));

// PWA Install Button Logic
const installBtn = document.getElementById('install-pwa-btn');
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.classList.remove('hidden');
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      installBtn.classList.add('hidden');
    }
    deferredPrompt = null;
  });
}

window.addEventListener('appinstalled', () => {
  if (installBtn) installBtn.classList.add('hidden');
  deferredPrompt = null;
});

// Register SW
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(e => console.log('SW reg failed', e));
  });
}

// Start
createClockTicks();
setInterval(updateClock, 1000);
updateClock();
loadState();
