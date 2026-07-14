import {
  ACHIEVEMENTS,
  DAILY_ROUNDS,
  MAX_LIVES,
  MODIFIER_LABELS,
  POINTS,
  PRELOAD_COUNT,
  RECENT_CHAMP_LIMIT,
  RECENT_SPELL_LIMIT,
  ROLE_LABELS,
  TIMED_SECONDS
} from './constants.js';
import { filterSpells, getChampions, getDataVersion, getSpells, safeImage } from './data.js';
import {
  addReviewMistake,
  addXp,
  calculateDailyStreak,
  dateKey,
  exportPersonalData,
  getReviewEntries,
  importPersonalData,
  loadDailyHistory,
  loadProfile,
  loadRecords,
  loadReviewBank,
  loadSettings,
  markReviewCorrect,
  resetPersonalData,
  saveDailyHistory,
  saveProfile,
  saveRecords,
  saveReviewBank,
  saveSettings,
  unlockAchievement
} from './storage.js';
import {
  animateAbility,
  clearVisualReveal,
  closeModal,
  dom,
  formatTime,
  openModal,
  renderAchievements,
  renderDailyHistory,
  renderModifierSummary,
  renderProfile,
  renderTileOverlay,
  setFeedback,
  showScreen,
  showSolution,
  toast,
  updateMuteButton
} from './ui.js';

const state = {
  profile: loadProfile(),
  settings: loadSettings(),
  records: loadRecords(),
  reviewBank: loadReviewBank(),
  dailyHistory: loadDailyHistory(),
  config: null,
  lastConfig: null,
  queue: [],
  currentSpell: null,
  recentSpellKeys: [],
  recentChampIds: [],
  score: 0,
  lives: 3,
  streak: 0,
  nextLifeScoreMilestone: 2000,
  rewardedStreakMilestones: new Set(),
  roundNumber: 1,
  roundLimit: 25,
  timeLeft: TIMED_SECONDS,
  timerId: null,
  nextTimeoutId: null,
  flashTimeoutId: null,
  gameStartedAt: 0,
  pauseStartedAt: 0,
  totalPausedMs: 0,
  paused: false,
  slotResolved: false,
  roundResolved: false,
  canAdvance: false,
  pendingGameOver: false,
  audioEnabled: true,
  audioCtx: null,
  currentRound: null,
  stats: null,
  mistakes: [],
  dailyGrid: [],
  dailyOfficial: false,
  dailySeed: 0,
  visibleSuggestions: [],
  suggestionIndex: -1,
  unlockedThisGame: [],
  xpGained: 0,
  reviewCorrectedThisGame: 0
};

function emptyStats() {
  return {
    faced: 0,
    completed: 0,
    championAttempts: 0,
    championCorrect: 0,
    slotAttempts: 0,
    slotCorrect: 0,
    hints: 0,
    skips: 0,
    maxStreak: 0,
    livesEarned: 0
  };
}

function emptyRound() {
  return {
    championAttempts: 0,
    championCorrect: false,
    championFirstTry: false,
    slotCorrect: false,
    usedHint: false,
    hintLevel: 0,
    skipped: false,
    lifeLost: false,
    hadMistake: false,
    reviewCorrected: false,
    completed: false
  };
}

function cleanString(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

let mobileViewportBaseline = Math.max(window.innerHeight, window.visualViewport?.height || 0);

function isPhoneKeyboardLayout() {
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900;
}

function phaseOneIsVisible() {
  return dom['phase-1']?.style.display !== 'none';
}

function updateKeyboardViewport() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const offsetTop = viewport?.offsetTop || 0;
  const inputFocused = document.activeElement === dom['guess-input'];

  if (!inputFocused) {
    mobileViewportBaseline = Math.max(mobileViewportBaseline, window.innerHeight, height + offsetTop);
  }
  const keyboardHeight = Math.max(0, mobileViewportBaseline - height - offsetTop);
  const keyboardOpen = isPhoneKeyboardLayout() && inputFocused && keyboardHeight > 110;

  document.documentElement.style.setProperty('--visual-viewport-height', `${Math.round(height)}px`);
  document.documentElement.style.setProperty('--keyboard-height', `${Math.round(keyboardHeight)}px`);
  document.body.classList.toggle('keyboard-open', keyboardOpen);
}

function focusGuessInput({ retry = true, scroll = true } = {}) {
  const input = dom['guess-input'];
  if (!input || state.paused || !dom['game-screen'].classList.contains('active') || !phaseOneIsVisible()) return;

  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }

  const length = input.value.length;
  try { input.setSelectionRange(length, length); } catch { /* non necessario */ }
  updateKeyboardViewport();

  if (scroll && isPhoneKeyboardLayout()) {
    requestAnimationFrame(() => {
      dom['ability-stage']?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  if (retry && document.activeElement !== input) {
    setTimeout(() => focusGuessInput({ retry: false, scroll }), 120);
  }
}

function closePhoneKeyboard() {
  dom['phase-1']?.classList.remove('keyboard-prime');
  hideAutocomplete();
  dom['guess-input']?.blur();
  document.body.classList.remove('keyboard-open');
  updateKeyboardViewport();
}

function primeKeyboardForAutomaticNextRound() {
  if (!isPhoneKeyboardLayout()) return;
  const input = dom['guess-input'];
  const phase = dom['phase-1'];
  if (!input || !phase) return;

  phase.classList.add('keyboard-prime');
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
  updateKeyboardViewport();
}

function bindMobileKeyboardLayout() {
  updateKeyboardViewport();
  window.visualViewport?.addEventListener('resize', updateKeyboardViewport);
  window.visualViewport?.addEventListener('scroll', updateKeyboardViewport);
  window.addEventListener('orientationchange', () => setTimeout(() => {
    mobileViewportBaseline = Math.max(window.innerHeight, window.visualViewport?.height || 0);
    updateKeyboardViewport();
  }, 180));
  dom['guess-input'].addEventListener('focus', () => {
    updateKeyboardViewport();
    if (isPhoneKeyboardLayout()) {
      setTimeout(() => dom['ability-stage']?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80);
    }
  });
  dom['guess-input'].addEventListener('blur', () => setTimeout(updateKeyboardViewport, 80));
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  return function random() {
    let value = seed += 0x6D2B79F5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function spreadChampions(items) {
  const remaining = [...items];
  const result = [];
  let previousChamp = '';
  while (remaining.length) {
    let index = remaining.findIndex(item => item.champId !== previousChamp);
    if (index < 0) index = 0;
    const [chosen] = remaining.splice(index, 1);
    result.push(chosen);
    previousChamp = chosen.champId;
  }
  return result;
}

function enabledModifierCount(modifiers = state.config?.modifiers || {}) {
  return Object.values(modifiers).filter(Boolean).length;
}

function modifierBonus() {
  return Object.entries(state.config.modifiers).reduce((total, [key, active]) => {
    return total + (active ? (POINTS.modifierBonuses[key] || 0) : 0);
  }, 0);
}

function getRecordKey(config) {
  const mods = Object.entries(config.modifiers).filter(([, value]) => value).map(([key]) => key).sort().join(',') || 'none';
  return [config.mode, config.rounds, config.abilityFilter, config.roleFilter, config.championFilter, mods].join('|');
}

function buildConfig(mode, supplied = null) {
  if (supplied) return JSON.parse(JSON.stringify(supplied));
  const rounds = dom['round-select'].value;
  const modifiers = {};
  document.querySelectorAll('[data-modifier]').forEach(input => { modifiers[input.dataset.modifier] = input.checked; });
  const config = {
    mode,
    rounds,
    abilityFilter: dom['filter-select'].value,
    roleFilter: dom['role-filter'].value,
    championFilter: dom['champ-filter'].value,
    modifiers
  };

  if (mode === 'daily') {
    config.rounds = String(DAILY_ROUNDS);
    config.abilityFilter = 'all';
    config.roleFilter = 'all';
    config.championFilter = 'all';
    Object.keys(config.modifiers).forEach(key => { config.modifiers[key] = false; });
  }
  if (mode === 'review') {
    config.rounds = String(Math.min(25, Math.max(10, getReviewEntries(state.reviewBank).length * 2)));
    config.abilityFilter = 'all';
    config.roleFilter = 'all';
    config.championFilter = 'all';
  }
  return config;
}

function persistMenuSettings() {
  const modifiers = {};
  document.querySelectorAll('[data-modifier]').forEach(input => { modifiers[input.dataset.modifier] = input.checked; });
  state.settings = {
    audio: dom['audio-enabled'].checked,
    rounds: dom['round-select'].value,
    abilityFilter: dom['filter-select'].value,
    roleFilter: dom['role-filter'].value,
    championFilter: dom['champ-filter'].value,
    modifiers
  };
  saveSettings(state.settings);
  renderModifierSummary(modifiers);
  updateRecordPreview();
}

function restoreMenuSettings() {
  dom['audio-enabled'].checked = state.settings.audio !== false;
  setSelect(dom['round-select'], state.settings.rounds);
  setSelect(dom['filter-select'], state.settings.abilityFilter);
  setSelect(dom['role-filter'], state.settings.roleFilter);
  setSelect(dom['champ-filter'], state.settings.championFilter);
  document.querySelectorAll('[data-modifier]').forEach(input => {
    input.checked = Boolean(state.settings.modifiers[input.dataset.modifier]);
  });
  renderModifierSummary(state.settings.modifiers);
}

function setSelect(select, value) {
  if ([...select.options].some(option => option.value === value)) select.value = value;
}

function populateChampionSelect() {
  dom['champ-filter'].innerHTML = '<option value="all">Tutti i campioni</option>';
  getChampions().forEach(champion => {
    const option = document.createElement('option');
    option.value = champion.name;
    option.textContent = champion.name;
    dom['champ-filter'].appendChild(option);
  });
}

function updateProfileMenu() {
  const dailyStreak = calculateDailyStreak(state.dailyHistory);
  const reviewCount = getReviewEntries(state.reviewBank).length;
  renderProfile(state.profile, dailyStreak, reviewCount);
  const todayResult = state.dailyHistory[dateKey()];
  dom['daily-title'].textContent = todayResult ? 'Ripeti la giornaliera' : 'Sfida giornaliera';
  dom['daily-status'].textContent = todayResult
    ? `Non ufficiale · oggi ${todayResult.score} pt · ${todayResult.accuracy}%`
    : 'Il primo tentativo di oggi sarà quello ufficiale.';
}

function updateRecordPreview() {
  const previewConfig = buildConfig('hardcore');
  const record = state.records[getRecordKey(previewConfig)] || 0;
  dom['high-score-menu'].textContent = record;
}

function buildQueue() {
  if (state.config.mode === 'daily') {
    const random = mulberry32(hashString(`lol-daily-${dateKey()}-${getDataVersion().split('.')[0]}`));
    state.dailySeed = hashString(dateKey());
    state.queue = spreadChampions(shuffle(getSpells(), random)).slice(0, DAILY_ROUNDS);
    return;
  }

  if (state.config.mode === 'review') {
    const byKey = new Map(getSpells().map(spell => [spell.key, spell]));
    const weighted = [];
    getReviewEntries(state.reviewBank).forEach(entry => {
      const spell = byKey.get(entry.key);
      if (!spell) return;
      const copies = Math.max(1, Math.min(6, Math.ceil(entry.weight / 2)));
      for (let index = 0; index < copies; index += 1) weighted.push(spell);
    });
    state.queue = shuffle(weighted.length ? weighted : getSpells());
    return;
  }

  const filtered = filterSpells(state.config);
  state.queue = shuffle(filtered.length ? filtered : getSpells());
}

function refillQueueIfNeeded() {
  if (state.queue.length) return;
  if (state.config.mode === 'daily') return;
  buildQueue();
}

function takeNormalCandidate() {
  refillQueueIfNeeded();
  if (!state.queue.length) return null;

  const findIndex = predicate => state.queue.findIndex(predicate);
  let index = findIndex(item => !state.recentSpellKeys.includes(item.key) && !state.recentChampIds.includes(item.champId));
  if (index < 0) index = findIndex(item => !state.recentSpellKeys.includes(item.key));
  if (index < 0) index = 0;
  const [spell] = state.queue.splice(index, 1);
  return spell;
}

function drawSpell() {
  const spell = state.config.mode === 'daily' ? state.queue.shift() : takeNormalCandidate();
  if (!spell) return null;
  state.recentSpellKeys.push(spell.key);
  state.recentChampIds.push(spell.champId);
  if (state.recentSpellKeys.length > RECENT_SPELL_LIMIT) state.recentSpellKeys.shift();
  if (state.recentChampIds.length > RECENT_CHAMP_LIMIT) state.recentChampIds.shift();
  return spell;
}

function preloadUpcoming() {
  const upcoming = state.queue.slice(0, PRELOAD_COUNT);
  const task = () => {
    upcoming.forEach(spell => {
      const ability = new Image();
      ability.src = spell.img;
      const portrait = new Image();
      portrait.src = spell.champImg;
    });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(task, { timeout: 1000 });
  else setTimeout(task, 30);
}

function resetGameState(config) {
  clearTimeout(state.nextTimeoutId);
  clearTimeout(state.flashTimeoutId);
  clearInterval(state.timerId);
  state.config = config;
  state.lastConfig = JSON.parse(JSON.stringify(config));
  state.queue = [];
  state.currentSpell = null;
  state.recentSpellKeys = [];
  state.recentChampIds = [];
  state.score = 0;
  state.lives = 3;
  state.streak = 0;
  state.nextLifeScoreMilestone = 2000;
  state.rewardedStreakMilestones = new Set();
  state.roundNumber = 1;
  state.roundLimit = config.rounds === 'infinite' ? Infinity : Number(config.rounds);
  state.timeLeft = TIMED_SECONDS;
  state.gameStartedAt = performance.now();
  state.totalPausedMs = 0;
  state.paused = false;
  state.pendingGameOver = false;
  state.stats = emptyStats();
  state.mistakes = [];
  state.dailyGrid = [];
  state.unlockedThisGame = [];
  state.xpGained = 0;
  state.reviewCorrectedThisGame = 0;
  state.audioEnabled = dom['audio-enabled'].checked;
  state.dailyOfficial = config.mode === 'daily' && !state.dailyHistory[dateKey()];
  updateMuteButton(state.audioEnabled);
}

export function startGame(mode, suppliedConfig = null) {
  const config = buildConfig(mode, suppliedConfig);
  if (mode === 'review' && !getReviewEntries(state.reviewBank).length) {
    toast('Non ci sono errori salvati da ripassare.', 'neutral');
    return;
  }

  const available = mode === 'review' ? getReviewEntries(state.reviewBank).length : filterSpells(config).length;
  if (mode !== 'daily' && mode !== 'review' && available === 0) {
    toast('Nessuna abilità corrisponde ai filtri scelti.', 'wrong');
    return;
  }

  resetGameState(config);
  buildQueue();
  showScreen('game-screen');
  dom['mode-label'].textContent = modeLabel(mode);
  if (mode === 'timed') startTimer();
  loadRound();
}

function modeLabel(mode) {
  return ({ practice: 'Pratica', hardcore: 'Hardcore', timed: 'A tempo', daily: 'Giornaliera', review: 'Ripasso errori' })[mode] || mode;
}

function loadRound() {
  clearTimeout(state.nextTimeoutId);
  clearTimeout(state.flashTimeoutId);
  state.currentSpell = drawSpell();
  if (!state.currentSpell) {
    gameOver('Mazzo completato.');
    return;
  }

  state.stats.faced += 1;
  state.currentRound = emptyRound();
  state.slotResolved = false;
  state.roundResolved = false;
  state.canAdvance = false;
  state.pendingGameOver = false;

  dom['phase-1'].classList.remove('keyboard-prime');
  dom['phase-1'].style.display = 'block';
  dom['phase-2'].style.display = 'none';
  dom['ability-buttons'].style.display = 'none';
  dom['solution-card'].style.display = 'none';
  dom['next-spell-btn'].style.display = 'none';
  dom['phase-2-instruction'].style.display = 'block';
  dom['guess-input'].value = '';
  dom['hint-list'].replaceChildren();
  dom['hint-portrait-wrap'].style.display = 'none';
  hideAutocomplete();
  resetSlotButtons();
  applyVisualModifiers();
  updateHintButton();
  updateHud();
  setFeedback('Chi è questo campione?', 'neutral');
  focusGuessInput();
  setTimeout(() => focusGuessInput({ retry: false, scroll: false }), 90);
  preloadUpcoming();
}

function applyVisualModifiers() {
  clearVisualReveal();
  const mods = state.config.modifiers;
  const filters = [];
  if (mods.bw) filters.push('grayscale(1)');
  if (mods.blur) filters.push('blur(6px)');
  if (mods.colorShift) filters.push(`hue-rotate(${Math.floor(Math.random() * 300 + 30)}deg) saturate(1.8)`);
  dom['ability-img'].style.filter = filters.join(' ') || 'none';

  const rotations = [0, 90, 180, 270];
  const angle = mods.rotate ? rotations[Math.floor(Math.random() * rotations.length)] : 0;
  const scale = mods.zoom ? 1.9 : 1;
  dom['ability-img'].style.transform = `rotate(${angle}deg) scale(${scale})`;
  dom['ability-img'].style.transformOrigin = mods.zoom
    ? `${25 + Math.floor(Math.random() * 50)}% ${25 + Math.floor(Math.random() * 50)}%`
    : 'center';
  safeImage(dom['ability-img'], state.currentSpell.img);

  if (mods.tiles) {
    renderTileOverlay(Math.random());
    dom['tile-overlay'].classList.add('visible');
  }
  if (mods.flash) {
    state.flashTimeoutId = setTimeout(() => dom['hidden-image-overlay'].classList.add('visible'), 1050);
  }
}

function revealAbilityImage() {
  clearTimeout(state.flashTimeoutId);
  clearVisualReveal();
  dom['ability-img'].style.filter = 'none';
  dom['ability-img'].style.transform = 'rotate(0deg) scale(1)';
  dom['ability-img'].style.transformOrigin = 'center';
}

function resetSlotButtons() {
  document.querySelectorAll('.spell-btn').forEach(button => {
    button.disabled = false;
    button.classList.remove('correct', 'wrong');
  });
}

function disableSlotButtons() {
  document.querySelectorAll('.spell-btn').forEach(button => { button.disabled = true; });
}

function updateHud() {
  const attempts = state.stats.championAttempts + state.stats.slotAttempts;
  const correct = state.stats.championCorrect + state.stats.slotCorrect;
  const accuracy = attempts ? Math.round((correct / attempts) * 100) : 100;
  dom['score-display'].textContent = state.config.mode === 'practice' ? 'Pratica' : `Punti: ${state.score}`;
  dom['accuracy-display'].textContent = `Precisione: ${accuracy}%`;
  dom['streak-display'].textContent = `Combo: x${state.streak}`;
  dom['lives-display'].textContent = state.config.mode === 'hardcore' ? '❤️'.repeat(Math.max(0, state.lives)) : '∞';
  dom['timer-display'].textContent = state.config.mode === 'timed' ? `⏱ ${Math.ceil(state.timeLeft)}s` : '';
  dom['round-counter'].textContent = state.roundLimit === Infinity
    ? `Domanda ${state.roundNumber}`
    : `Domanda ${Math.min(state.roundNumber, state.roundLimit)} / ${state.roundLimit}`;
  dom['remaining-counter'].textContent = state.config.mode === 'daily'
    ? `Sfida ${dateKey()} · ${state.dailyOfficial ? 'tentativo ufficiale' : 'ripetizione non ufficiale'}`
    : `Nel mazzo: ${state.queue.length}`;
}

function playSound(type) {
  if (!state.audioEnabled) return;
  try {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    oscillator.connect(gain);
    gain.connect(state.audioCtx.destination);
    if (type === 'correct') {
      oscillator.frequency.setValueAtTime(587.33, state.audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(880, state.audioCtx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.1, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.25);
      oscillator.start(); oscillator.stop(state.audioCtx.currentTime + 0.25);
    } else if (type === 'wrong') {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(130.81, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.14, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.35);
      oscillator.start(); oscillator.stop(state.audioCtx.currentTime + 0.35);
    } else {
      oscillator.frequency.setValueAtTime(349.23, state.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.07, state.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, state.audioCtx.currentTime + 0.16);
      oscillator.start(); oscillator.stop(state.audioCtx.currentTime + 0.16);
    }
  } catch (error) {
    console.warn('Audio non disponibile:', error);
  }
}

function findChampionFromInput(value) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const champs = getChampions();
  return champs.find(champion => cleanString(champion.name) === cleaned)
    || champs.find(champion => cleanString(champion.name).startsWith(cleaned))
    || champs.find(champion => cleanString(champion.name).includes(cleaned))
    || null;
}

function processGuess() {
  if (state.roundResolved || dom['phase-1'].style.display === 'none') return;
  const value = dom['guess-input'].value.trim();
  if (!value) return;
  const matched = findChampionFromInput(value);
  if (matched) dom['guess-input'].value = matched.name;
  checkChampion();
}

function loseLifeOnce() {
  if (state.config.mode !== 'hardcore' || state.currentRound.lifeLost) return;
  state.currentRound.lifeLost = true;
  state.lives -= 1;
}

function registerMistake(reason, answer = '') {
  state.currentRound.hadMistake = true;
  const item = {
    key: state.currentSpell.key,
    champ: state.currentSpell.champ,
    spellName: state.currentSpell.spellName,
    slot: state.currentSpell.slot,
    reason,
    answer
  };
  state.mistakes.push(item);
  addReviewMistake(state.reviewBank, state.currentSpell, reason);
  saveReviewBank(state.reviewBank);
}

function checkChampion() {
  const guess = dom['guess-input'].value.trim();
  state.currentRound.championAttempts += 1;
  state.stats.championAttempts += 1;

  if (cleanString(guess) === cleanString(state.currentSpell.champ)) {
    state.currentRound.championCorrect = true;
    state.currentRound.championFirstTry = state.currentRound.championAttempts === 1;
    state.stats.championCorrect += 1;
    state.streak += 1;
    state.stats.maxStreak = Math.max(state.stats.maxStreak, state.streak);
    const gained = POINTS.base + state.streak * POINTS.streakChampion + modifierBonus();
    state.score += gained;
    playSound('correct');
    animateAbility('correct');
    checkLifeBonuses('champion');
    setFeedback(`Esatto! È ${state.currentSpell.champ} (+${gained} pt)`, 'correct');
    closePhoneKeyboard();
    dom['phase-1'].style.display = 'none';
    dom['phase-2'].style.display = 'block';
    dom['ability-buttons'].style.display = 'flex';
    updateHud();
    return;
  }

  state.streak = 0;
  state.currentRound.hadMistake = true;
  playSound('wrong');
  animateAbility('wrong');
  loseLifeOnce();
  registerMistake('Campione errato', guess || 'Nessuna risposta');
  dom['guess-input'].value = '';
  updateHud();

  if (state.lives <= 0) {
    revealRoundFailure(`Sconfitta! Era ${state.currentSpell.champ}.`, true);
    return;
  }
  if (state.config.modifiers.oneAnswer) {
    revealRoundFailure(`Una sola risposta: era ${state.currentSpell.champ}.`, false);
    return;
  }
  setFeedback(state.config.mode === 'hardcore'
    ? 'Sbagliato: hai perso una vita. Puoi continuare a provare senza perdere altre vite in questo turno.'
    : 'Sbagliato, riprova!', 'wrong');
  focusGuessInput({ retry: false, scroll: false });
}

function updateHintButton() {
  const level = state.currentRound?.hintLevel || 0;
  if (level >= POINTS.hintCosts.length) {
    dom['hint-btn'].disabled = true;
    dom['hint-btn'].textContent = 'Indizi esauriti';
    return;
  }
  const free = ['practice', 'review'].includes(state.config.mode);
  const cost = POINTS.hintCosts[level];
  dom['hint-btn'].disabled = false;
  dom['hint-btn'].textContent = free ? `Indizio ${level + 1} · gratis` : `Indizio ${level + 1} · -${cost} pt`;
}

function addHintLine(text) {
  const line = document.createElement('li');
  line.textContent = text;
  dom['hint-list'].appendChild(line);
}

function getHint() {
  if (state.roundResolved || state.currentRound.hintLevel >= POINTS.hintCosts.length) return;
  const level = state.currentRound.hintLevel;
  const cost = POINTS.hintCosts[level];
  const free = ['practice', 'review'].includes(state.config.mode);
  if (!free && state.score < cost) {
    setFeedback(`Servono ${cost} punti per questo indizio.`, 'wrong');
    playSound('wrong');
    return;
  }
  if (!free) state.score -= cost;
  state.currentRound.hintLevel += 1;
  state.currentRound.usedHint = true;
  state.stats.hints += 1;
  playSound('neutral');

  if (level === 0) {
    addHintLine(`Il nome inizia con “${state.currentSpell.champ.charAt(0).toUpperCase()}”.`);
  } else if (level === 1) {
    const roles = state.currentSpell.champTags.map(tag => ROLE_LABELS[tag] || tag).join(' / ') || 'Ruolo non disponibile';
    addHintLine(`Ruolo: ${roles}. Il nome contiene ${state.currentSpell.champ.replace(/[^A-Za-zÀ-ÿ]/g, '').length} lettere.`);
  } else if (level === 2) {
    safeImage(dom['hint-portrait'], state.currentSpell.champImg);
    dom['hint-portrait-wrap'].style.display = 'flex';
    addHintLine('È stato mostrato il ritratto molto sfocato del campione.');
  } else {
    const value = state.currentSpell.champDifficulty;
    const label = value <= 3 ? 'bassa' : value <= 6 ? 'media' : 'alta';
    addHintLine(`Difficoltà ufficiale del campione: ${label} (${value}/10).`);
  }
  updateHintButton();
  updateHud();
  focusGuessInput({ retry: false, scroll: false });
}

function skipChampion() {
  if (state.roundResolved) return;
  state.currentRound.skipped = true;
  state.currentRound.hadMistake = true;
  state.stats.skips += 1;
  state.streak = 0;
  loseLifeOnce();
  registerMistake('Abilità saltata');
  updateHud();
  revealRoundFailure(
    state.lives <= 0
      ? `Sconfitta al salto: era la ${state.currentSpell.slot} di ${state.currentSpell.champ}.`
      : `Saltata: era la ${state.currentSpell.slot} di ${state.currentSpell.champ}.`,
    state.lives <= 0
  );
}

function revealRoundFailure(message, pendingGameOver) {
  state.pendingGameOver = pendingGameOver;
  state.roundResolved = true;
  closePhoneKeyboard();
  state.canAdvance = true;
  revealAbilityImage();
  dom['phase-1'].style.display = 'none';
  dom['phase-2'].style.display = 'block';
  dom['phase-2-instruction'].style.display = 'none';
  dom['ability-buttons'].style.display = 'flex';
  colorCorrectSlot();
  disableSlotButtons();
  showSolution(state.currentSpell);
  dom['next-spell-btn'].style.display = 'inline-block';
  dom['next-spell-btn'].textContent = pendingGameOver ? 'Vedi risultati' : 'Avanti';
  setFeedback(message, pendingGameOver ? 'wrong' : 'warning');
  completeRound();
}

function checkAbilitySlot(slot) {
  if (state.slotResolved || state.roundResolved || state.pendingGameOver) return;
  state.slotResolved = true;
  state.stats.slotAttempts += 1;
  disableSlotButtons();
  revealAbilityImage();
  colorCorrectSlot();
  showSolution(state.currentSpell);
  dom['phase-2-instruction'].style.display = 'none';
  dom['next-spell-btn'].style.display = 'inline-block';
  state.canAdvance = true;

  if (slot === state.currentSpell.slot) {
    state.currentRound.slotCorrect = true;
    state.stats.slotCorrect += 1;
    const gained = POINTS.slot + state.streak * POINTS.streakSlot;
    state.score += gained;
    playSound('correct');
    animateAbility('correct');
    checkLifeBonuses('slot');
    setFeedback(`Perfetto! Era la ${slot} (+${gained} pt)`, 'correct');
    if (state.config.mode === 'review' && state.currentRound.championCorrect && !state.currentRound.hadMistake) {
      if (markReviewCorrect(state.reviewBank, state.currentSpell)) {
        state.currentRound.reviewCorrected = true;
        state.reviewCorrectedThisGame += 1;
        saveReviewBank(state.reviewBank);
      }
    }
    completeRound();
    const hasAnotherRound = !state.pendingGameOver
      && (state.roundLimit === Infinity || state.stats.completed < state.roundLimit)
      && !(state.config.mode === 'timed' && state.timeLeft <= 0);

    // Safari su iPhone apre la tastiera soltanto se focus() avviene nello stesso
    // gesto dell'utente. Sul telefono passiamo quindi subito al turno successivo
    // direttamente dal tocco sul pulsante P/Q/W/E/R, senza usare setTimeout.
    if (isPhoneKeyboardLayout()) {
      updateHud();
      if (hasAnotherRound) {
        toast(`Corretta: ${state.currentSpell.champ} · ${state.currentSpell.slot} · ${state.currentSpell.spellName}`, 'correct', 2200);
      }
      advanceRound();
      return;
    }

    if (hasAnotherRound) primeKeyboardForAutomaticNextRound();
    state.nextTimeoutId = setTimeout(advanceRound, 900);
  } else {
    document.querySelector(`[data-slot="${slot}"]`)?.classList.add('wrong');
    state.streak = 0;
    registerMistake('Slot errato', `Hai scelto ${slot}`);
    playSound('wrong');
    animateAbility('wrong');
    setFeedback(`Sbagliato: era la ${state.currentSpell.slot} di ${state.currentSpell.champ}.`, 'warning');
    completeRound();
  }
  updateHud();
}

function colorCorrectSlot() {
  document.querySelector(`[data-slot="${state.currentSpell.slot}"]`)?.classList.add('correct');
}

function checkLifeBonuses(source) {
  if (state.config.mode !== 'hardcore') return;
  const messages = [];
  if (source === 'champion' && state.streak > 0 && state.streak % 20 === 0 && !state.rewardedStreakMilestones.has(state.streak)) {
    state.rewardedStreakMilestones.add(state.streak);
    if (state.lives < MAX_LIVES) {
      state.lives += 1;
      state.stats.livesEarned += 1;
      messages.push('Combo x20: +1 vita');
    }
  }
  while (state.score >= state.nextLifeScoreMilestone) {
    if (state.lives < MAX_LIVES) {
      state.lives += 1;
      state.stats.livesEarned += 1;
      messages.push('Traguardo punti: +1 vita');
    }
    state.nextLifeScoreMilestone += 2000;
  }
  if (messages.length) toast(messages.join(' · '), 'correct');
}

function completeRound() {
  if (state.currentRound.completed) return;
  state.currentRound.completed = true;
  state.stats.completed += 1;
  if (state.config.mode === 'daily') {
    let symbol = '🟥';
    if (state.currentRound.championCorrect) {
      symbol = state.currentRound.championFirstTry && state.currentRound.slotCorrect && !state.currentRound.usedHint ? '🟩' : '🟨';
    }
    state.dailyGrid.push(symbol);
  }
}

function advanceRound() {
  if (!state.canAdvance) return;
  clearTimeout(state.nextTimeoutId);
  if (state.pendingGameOver) {
    gameOver('Hai esaurito le vite.');
    return;
  }
  if (state.config.mode === 'timed' && state.timeLeft <= 0) {
    gameOver('Tempo scaduto.');
    return;
  }
  if (state.roundLimit !== Infinity && state.stats.completed >= state.roundLimit) {
    gameOver('Partita completata.');
    return;
  }
  state.roundNumber += 1;
  loadRound();
}

function startTimer() {
  clearInterval(state.timerId);
  const started = performance.now();
  state.timerId = setInterval(() => {
    if (state.paused) return;
    const elapsed = (performance.now() - started - state.totalPausedMs) / 1000;
    state.timeLeft = Math.max(0, TIMED_SECONDS - elapsed);
    updateHud();
    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      state.timerId = null;
      gameOver('Tempo scaduto.');
    }
  }, 120);
}

function pauseGame() {
  if (state.paused || !dom['game-screen'].classList.contains('active')) return;
  closePhoneKeyboard();
  state.paused = true;
  state.pauseStartedAt = performance.now();
  dom['pause-overlay'].classList.add('active');
}

function resumeGame() {
  if (!state.paused) return;
  state.totalPausedMs += performance.now() - state.pauseStartedAt;
  state.paused = false;
  dom['pause-overlay'].classList.remove('active');
  setTimeout(() => focusGuessInput({ retry: false }), 60);
}

function toggleAudio() {
  state.audioEnabled = !state.audioEnabled;
  updateMuteButton(state.audioEnabled);
}

function elapsedSeconds() {
  const now = performance.now();
  const currentPause = state.paused ? now - state.pauseStartedAt : 0;
  return Math.max(0, Math.round((now - state.gameStartedAt - state.totalPausedMs - currentPause) / 1000));
}

function calculateAccuracy() {
  const attempts = state.stats.championAttempts + state.stats.slotAttempts;
  const correct = state.stats.championCorrect + state.stats.slotCorrect;
  return attempts ? Math.round((correct / attempts) * 100) : 0;
}

function calculateXp(reason) {
  const modeMultiplier = ({ practice: 0.45, hardcore: 1, timed: 1.1, daily: 1.2, review: 0.85 })[state.config.mode] || 1;
  const dailyMultiplier = state.config.mode === 'daily' && !state.dailyOfficial ? 0.3 : 1;
  const completionBonus = reason === 'Partita completata.' ? 80 : 0;
  const raw = state.stats.completed * 12
    + state.stats.championCorrect * 7
    + state.stats.slotCorrect * 6
    + state.stats.maxStreak * 3
    + Math.floor(state.score / 50)
    + completionBonus;
  return Math.max(5, Math.round(raw * modeMultiplier * dailyMultiplier));
}

function updateDailyResult() {
  if (state.config.mode !== 'daily' || !state.dailyOfficial) return;
  const today = dateKey();
  state.dailyHistory[today] = {
    completed: state.stats.completed >= DAILY_ROUNDS,
    score: state.score,
    accuracy: calculateAccuracy(),
    completedCount: state.stats.completed,
    maxStreak: state.stats.maxStreak,
    elapsed: elapsedSeconds(),
    grid: [...state.dailyGrid],
    savedAt: Date.now()
  };
  saveDailyHistory(state.dailyHistory);
}

function evaluateAchievements(reason) {
  const unlocked = [];
  const tryUnlock = id => {
    if (unlockAchievement(state.profile, id)) unlocked.push(id);
  };
  tryUnlock('first_game');
  if (state.stats.maxStreak >= 10) tryUnlock('streak_10');
  if (state.stats.maxStreak >= 25) tryUnlock('streak_25');
  if (state.stats.completed >= 10 && !state.mistakes.length && state.stats.hints === 0) tryUnlock('perfect_10');
  if (state.config.mode === 'hardcore' && reason === 'Partita completata.') tryUnlock('hardcore_clear');
  if (state.roundLimit !== Infinity && reason === 'Partita completata.' && state.stats.hints === 0) tryUnlock('no_hint_clear');
  const dailyStreak = calculateDailyStreak(state.dailyHistory);
  if (dailyStreak >= 3) tryUnlock('daily_3');
  if (dailyStreak >= 7) tryUnlock('daily_7');
  if (state.profile.reviewCorrections >= 10) tryUnlock('review_10');
  if (state.config.mode === 'timed' && state.stats.completed >= 20) tryUnlock('speed_20');
  if (enabledModifierCount() >= 5 && reason === 'Partita completata.') tryUnlock('five_mods');
  if (state.profile.level >= 10) tryUnlock('level_10');
  state.unlockedThisGame = unlocked;
}

function updateProfile(reason) {
  state.profile.totalGames += 1;
  state.profile.totalCompleted += state.stats.completed;
  state.profile.totalCorrectChampion += state.stats.championCorrect;
  state.profile.totalCorrectSlot += state.stats.slotCorrect;
  state.profile.bestStreak = Math.max(state.profile.bestStreak, state.stats.maxStreak);
  state.profile.reviewCorrections += state.reviewCorrectedThisGame;
  state.xpGained = calculateXp(reason);
  const levelResult = addXp(state.profile, state.xpGained);
  evaluateAchievements(reason);
  saveProfile(state.profile);
  if (levelResult.leveledUp) toast(`Livello ${levelResult.newLevel} raggiunto!`, 'correct', 3800);
}

function updateRecord() {
  if (state.config.mode === 'practice' || state.config.mode === 'daily' || state.config.mode === 'review') return false;
  const key = getRecordKey(state.config);
  const old = state.records[key] || 0;
  if (state.score <= old) return false;
  state.records[key] = state.score;
  saveRecords(state.records);
  return true;
}

function renderFinalStats(reason, newRecord) {
  const elapsed = elapsedSeconds();
  dom['game-over-title'].textContent = `Punteggio: ${state.score}`;
  dom['game-over-reason'].textContent = reason;
  dom['new-record-text'].style.display = newRecord ? 'block' : 'none';
  dom['stat-faced'].textContent = state.stats.faced;
  dom['stat-completed'].textContent = state.stats.completed;
  dom['stat-accuracy'].textContent = `${calculateAccuracy()}%`;
  dom['stat-champs'].textContent = `${state.stats.championCorrect}/${state.stats.championAttempts}`;
  dom['stat-slots'].textContent = `${state.stats.slotCorrect}/${state.stats.slotAttempts}`;
  dom['stat-max-streak'].textContent = state.stats.maxStreak;
  dom['stat-hints'].textContent = state.stats.hints;
  dom['stat-skips'].textContent = state.stats.skips;
  dom['stat-time'].textContent = formatTime(elapsed);
  dom['xp-result'].textContent = `+${state.xpGained} XP · Livello ${state.profile.level}`;

  dom['unlocked-list'].replaceChildren();
  if (state.unlockedThisGame.length) {
    dom['unlocked-panel'].style.display = 'block';
    state.unlockedThisGame.forEach(id => {
      const achievement = ACHIEVEMENTS.find(item => item.id === id);
      const item = document.createElement('div');
      item.className = 'unlocked-row';
      item.textContent = `${achievement.icon} ${achievement.title}`;
      dom['unlocked-list'].appendChild(item);
    });
  } else {
    dom['unlocked-panel'].style.display = 'none';
  }

  renderMistakes();
  renderDailyShare();
  dom['review-after-btn'].style.display = getReviewEntries(state.reviewBank).length ? 'inline-block' : 'none';
}

function renderMistakes() {
  dom['mistakes-list'].replaceChildren();
  if (!state.mistakes.length) {
    dom['mistakes-panel'].style.display = 'none';
    return;
  }
  const grouped = new Map();
  state.mistakes.forEach(item => {
    const key = `${item.key}|${item.reason}`;
    const existing = grouped.get(key) || { ...item, count: 0 };
    existing.count += 1;
    grouped.set(key, existing);
  });
  grouped.forEach(item => {
    const row = document.createElement('div');
    row.className = 'mistake-row';
    row.innerHTML = `<strong>${item.champ} · ${item.spellName} [${item.slot}]${item.count > 1 ? ` ×${item.count}` : ''}</strong><small>${item.reason}${item.answer ? ` · ${item.answer}` : ''}</small>`;
    dom['mistakes-list'].appendChild(row);
  });
  dom['mistakes-panel'].style.display = 'block';
}

function dailyShareText() {
  const result = {
    score: state.score,
    accuracy: calculateAccuracy(),
    grid: state.dailyGrid
  };
  const rows = [];
  for (let index = 0; index < result.grid.length; index += 5) rows.push(result.grid.slice(index, index + 5).join(''));
  return [
    `LoL Spell Guesser · Daily ${dateKey()}${state.dailyOfficial ? '' : ' · ripetizione'}`,
    `${result.score} pt · ${result.accuracy}%`,
    `🔥 Combo massima: ${state.stats.maxStreak}`,
    ...rows
  ].join('\n');
}

function renderDailyShare() {
  if (state.config.mode !== 'daily') {
    dom['daily-share-panel'].style.display = 'none';
    return;
  }
  dom['daily-share-panel'].style.display = 'block';
  dom['daily-grid-result'].textContent = state.dailyGrid.join('');
  dom['daily-official-label'].textContent = state.dailyOfficial
    ? 'Tentativo ufficiale salvato sul dispositivo.'
    : 'Ripetizione non ufficiale: il risultato di oggi non è stato sostituito.';
}

function gameOver(reason = 'Partita conclusa.') {
  if (!dom['game-screen'].classList.contains('active')) return;
  closePhoneKeyboard();
  clearTimeout(state.nextTimeoutId);
  clearTimeout(state.flashTimeoutId);
  clearInterval(state.timerId);
  state.timerId = null;
  if (state.paused) resumeGame();
  updateDailyResult();
  updateProfile(reason);
  const newRecord = updateRecord();
  renderFinalStats(reason, newRecord);
  updateProfileMenu();
  updateRecordPreview();
  showScreen('game-over-screen');
}

function quitToMenu() {
  closePhoneKeyboard();
  clearTimeout(state.nextTimeoutId);
  clearTimeout(state.flashTimeoutId);
  clearInterval(state.timerId);
  state.timerId = null;
  state.paused = false;
  dom['pause-overlay'].classList.remove('active');
  updateProfileMenu();
  updateRecordPreview();
  showScreen('menu-screen');
}

function replayLastGame() {
  if (!state.lastConfig) return quitToMenu();
  startGame(state.lastConfig.mode, state.lastConfig);
}

function updateAutocomplete() {
  if (state.config?.modifiers.noAutocomplete) return hideAutocomplete();
  const value = dom['guess-input'].value.trim();
  if (!value) return hideAutocomplete();
  const cleaned = cleanString(value);
  const champions = getChampions();
  const starts = champions.filter(champion => cleanString(champion.name).startsWith(cleaned));
  const includes = champions.filter(champion => !cleanString(champion.name).startsWith(cleaned) && cleanString(champion.name).includes(cleaned));
  state.visibleSuggestions = [...starts, ...includes].slice(0, 8);
  state.suggestionIndex = -1;
  dom['autocomplete-list'].replaceChildren();
  if (!state.visibleSuggestions.length) return hideAutocomplete();
  state.visibleSuggestions.forEach((champion, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'suggestion-item';
    item.textContent = champion.name;
    item.dataset.index = String(index);
    item.addEventListener('mousedown', event => {
      event.preventDefault();
      dom['guess-input'].value = champion.name;
      hideAutocomplete();
      dom['guess-input'].focus();
    });
    dom['autocomplete-list'].appendChild(item);
  });
  dom['autocomplete-list'].style.display = 'block';
}

function hideAutocomplete() {
  dom['autocomplete-list'].style.display = 'none';
  dom['autocomplete-list'].replaceChildren();
  state.visibleSuggestions = [];
  state.suggestionIndex = -1;
}

function moveSuggestion(direction) {
  if (!state.visibleSuggestions.length || dom['autocomplete-list'].style.display === 'none') return;
  state.suggestionIndex = (state.suggestionIndex + direction + state.visibleSuggestions.length) % state.visibleSuggestions.length;
  [...dom['autocomplete-list'].children].forEach((item, index) => item.classList.toggle('selected', index === state.suggestionIndex));
}

function chooseSuggestion() {
  const champion = state.visibleSuggestions[state.suggestionIndex];
  if (!champion) return false;
  dom['guess-input'].value = champion.name;
  hideAutocomplete();
  return true;
}

function showAchievementsModal() {
  openModal('Obiettivi', renderAchievements(state.profile));
}

function showHistoryModal() {
  openModal('Storico giornaliero', renderDailyHistory(state.dailyHistory));
}

function downloadData() {
  const blob = new Blob([JSON.stringify(exportPersonalData(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `lol-spell-guesser-dati-${dateKey()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importPersonalData(JSON.parse(String(reader.result)));
      state.profile = loadProfile();
      state.settings = loadSettings();
      state.records = loadRecords();
      state.reviewBank = loadReviewBank();
      state.dailyHistory = loadDailyHistory();
      restoreMenuSettings();
      updateProfileMenu();
      toast('Dati personali importati correttamente.', 'correct');
    } catch (error) {
      toast(error.message || 'Importazione non riuscita.', 'wrong');
    }
    dom['import-data-input'].value = '';
  };
  reader.readAsText(file);
}

function confirmReset() {
  const box = document.createElement('div');
  box.innerHTML = '<p>Verranno cancellati progressi, obiettivi, record, errori e storico giornaliero salvati su questo dispositivo.</p>';
  const button = document.createElement('button');
  button.className = 'danger-btn';
  button.textContent = 'Cancella definitivamente';
  button.addEventListener('click', () => {
    resetPersonalData();
    location.reload();
  });
  box.appendChild(button);
  openModal('Azzera dati personali', box);
}

async function copyDailyResult() {
  try {
    await navigator.clipboard.writeText(dailyShareText());
    toast('Risultato copiato.', 'correct');
  } catch {
    const area = document.createElement('textarea');
    area.value = dailyShareText();
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast('Risultato copiato.', 'correct');
  }
}

export function initializeGameUi() {
  populateChampionSelect();
  restoreMenuSettings();
  updateProfileMenu();
  updateRecordPreview();
  dom['data-version'].textContent = getDataVersion();
  bindMobileKeyboardLayout();

  ['round-select', 'filter-select', 'role-filter', 'champ-filter', 'audio-enabled'].forEach(id => {
    dom[id].addEventListener('change', persistMenuSettings);
  });
  document.querySelectorAll('[data-modifier]').forEach(input => input.addEventListener('change', persistMenuSettings));

  dom['practice-btn'].addEventListener('click', () => startGame('practice'));
  dom['hardcore-btn'].addEventListener('click', () => startGame('hardcore'));
  dom['timed-btn'].addEventListener('click', () => startGame('timed'));
  dom['daily-btn'].addEventListener('click', () => startGame('daily'));
  dom['review-btn'].addEventListener('click', () => startGame('review'));
  dom['confirm-btn'].addEventListener('click', processGuess);
  dom['hint-btn'].addEventListener('click', getHint);
  dom['skip-champ-btn'].addEventListener('click', skipChampion);
  dom['next-spell-btn'].addEventListener('click', advanceRound);
  dom['pause-btn'].addEventListener('click', pauseGame);
  dom['resume-btn'].addEventListener('click', resumeGame);
  dom['mute-btn'].addEventListener('click', toggleAudio);
  dom['quit-btn'].addEventListener('click', quitToMenu);
  dom['menu-btn'].addEventListener('click', quitToMenu);
  dom['replay-btn'].addEventListener('click', replayLastGame);
  dom['review-after-btn'].addEventListener('click', () => startGame('review'));
  dom['guess-input'].addEventListener('input', updateAutocomplete);
  dom['guess-input'].addEventListener('blur', () => setTimeout(hideAutocomplete, 120));
  dom['achievements-btn'].addEventListener('click', showAchievementsModal);
  dom['history-btn'].addEventListener('click', showHistoryModal);
  dom['export-data-btn'].addEventListener('click', downloadData);
  dom['import-data-btn'].addEventListener('click', () => dom['import-data-input'].click());
  dom['import-data-input'].addEventListener('change', event => handleImportFile(event.target.files?.[0]));
  dom['reset-data-btn'].addEventListener('click', confirmReset);
  dom['copy-daily-btn'].addEventListener('click', copyDailyResult);
  dom['modal-close-btn'].addEventListener('click', closeModal);
  dom['app-modal'].addEventListener('click', event => { if (event.target === dom['app-modal']) closeModal(); });

  document.querySelectorAll('.spell-btn').forEach(button => {
    button.addEventListener('click', () => checkAbilitySlot(button.dataset.slot));
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (dom['app-modal'].classList.contains('active')) return closeModal();
      if (dom['game-screen'].classList.contains('active')) return state.paused ? resumeGame() : pauseGame();
    }
    if (state.paused || !dom['game-screen'].classList.contains('active')) return;
    const phase1 = dom['phase-1'].style.display !== 'none';
    if (phase1) {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSuggestion(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveSuggestion(-1); }
      else if (event.key === 'Enter') { event.preventDefault(); if (!chooseSuggestion()) processGuess(); }
    } else if (state.canAdvance && event.key === 'Enter') {
      event.preventDefault(); advanceRound();
    } else if (!state.slotResolved) {
      const key = event.key.toUpperCase();
      if (['P', 'Q', 'W', 'E', 'R'].includes(key)) checkAbilitySlot(key);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && dom['game-screen'].classList.contains('active') && !state.paused) pauseGame();
  });
}
