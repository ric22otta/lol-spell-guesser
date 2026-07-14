import { ACHIEVEMENTS, DEFAULT_SETTINGS, STORAGE_KEYS } from './constants.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParse(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeGet(key, fallback) {
  try {
    return safeParse(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Impossibile salvare ${key}`, error);
    return false;
  }
}

export function getDefaultProfile() {
  return {
    xp: 0,
    level: 1,
    totalGames: 0,
    totalCompleted: 0,
    totalCorrectChampion: 0,
    totalCorrectSlot: 0,
    bestStreak: 0,
    reviewCorrections: 0,
    achievements: {},
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function loadProfile() {
  const stored = safeGet(STORAGE_KEYS.profile, {});
  return {
    ...getDefaultProfile(),
    ...stored,
    achievements: { ...(stored.achievements || {}) }
  };
}

export function saveProfile(profile) {
  profile.updatedAt = Date.now();
  return safeSet(STORAGE_KEYS.profile, profile);
}

export function xpForLevel(level) {
  const safeLevel = Math.max(1, Number(level) || 1);
  return Math.round(350 * Math.pow(safeLevel - 1, 1.45));
}

export function levelFromXp(xp) {
  let level = 1;
  const safeXp = Math.max(0, Number(xp) || 0);
  while (xpForLevel(level + 1) <= safeXp && level < 100) level += 1;
  return level;
}

export function addXp(profile, amount) {
  const oldLevel = levelFromXp(profile.xp);
  profile.xp = Math.max(0, profile.xp + Math.max(0, Math.round(amount)));
  profile.level = levelFromXp(profile.xp);
  return { oldLevel, newLevel: profile.level, leveledUp: profile.level > oldLevel };
}

export function loadSettings() {
  const stored = safeGet(STORAGE_KEYS.settings, {});
  return {
    ...clone(DEFAULT_SETTINGS),
    ...stored,
    modifiers: {
      ...clone(DEFAULT_SETTINGS.modifiers),
      ...(stored.modifiers || {})
    }
  };
}

export function saveSettings(settings) {
  return safeSet(STORAGE_KEYS.settings, settings);
}

export function loadRecords() {
  return safeGet(STORAGE_KEYS.records, {});
}

export function saveRecords(records) {
  return safeSet(STORAGE_KEYS.records, records);
}

export function loadReviewBank() {
  return safeGet(STORAGE_KEYS.reviewBank, {});
}

export function saveReviewBank(bank) {
  return safeSet(STORAGE_KEYS.reviewBank, bank);
}

export function addReviewMistake(bank, spell, reason = 'Errore') {
  const key = spell.key;
  const current = bank[key] || {
    key,
    champ: spell.champ,
    champId: spell.champId,
    slot: spell.slot,
    spellName: spell.spellName,
    img: spell.img,
    weight: 0,
    mistakes: 0,
    corrections: 0,
    lastWrongAt: 0,
    lastCorrectAt: 0,
    reasons: {}
  };
  current.weight = Math.min(12, (current.weight || 0) + 2);
  current.mistakes = (current.mistakes || 0) + 1;
  current.lastWrongAt = Date.now();
  current.reasons[reason] = (current.reasons[reason] || 0) + 1;
  bank[key] = current;
}

export function markReviewCorrect(bank, spell) {
  const current = bank[spell.key];
  if (!current) return false;
  current.weight = Math.max(0, (current.weight || 0) - 1);
  current.corrections = (current.corrections || 0) + 1;
  current.lastCorrectAt = Date.now();
  if (current.weight <= 0 && current.corrections >= 2) delete bank[spell.key];
  return true;
}

export function getReviewEntries(bank) {
  return Object.values(bank)
    .filter(item => (item.weight || 0) > 0)
    .sort((a, b) => (b.weight - a.weight) || (b.lastWrongAt - a.lastWrongAt));
}

export function loadDailyHistory() {
  return safeGet(STORAGE_KEYS.dailyHistory, {});
}

export function saveDailyHistory(history) {
  return safeSet(STORAGE_KEYS.dailyHistory, history);
}

export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDailyStreak(history) {
  let streak = 0;
  const cursor = new Date();
  const todayKey = dateKey(cursor);
  if (!history[todayKey]?.completed) cursor.setDate(cursor.getDate() - 1);

  for (;;) {
    const key = dateKey(cursor);
    if (!history[key]?.completed) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function unlockAchievement(profile, achievementId) {
  if (profile.achievements[achievementId]) return false;
  const exists = ACHIEVEMENTS.some(item => item.id === achievementId);
  if (!exists) return false;
  profile.achievements[achievementId] = Date.now();
  return true;
}

export function exportPersonalData() {
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    profile: loadProfile(),
    settings: loadSettings(),
    records: loadRecords(),
    reviewBank: loadReviewBank(),
    dailyHistory: loadDailyHistory()
  };
}

export function importPersonalData(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('File dati non valido.');
  if (payload.profile) safeSet(STORAGE_KEYS.profile, payload.profile);
  if (payload.settings) safeSet(STORAGE_KEYS.settings, payload.settings);
  if (payload.records) safeSet(STORAGE_KEYS.records, payload.records);
  if (payload.reviewBank) safeSet(STORAGE_KEYS.reviewBank, payload.reviewBank);
  if (payload.dailyHistory) safeSet(STORAGE_KEYS.dailyHistory, payload.dailyHistory);
}

export function resetPersonalData() {
  Object.values(STORAGE_KEYS).forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });
}
