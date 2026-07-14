export const APP_VERSION = '4.0.3';

export const STORAGE_KEYS = Object.freeze({
  profile: 'lol_guesser_profile_v4',
  settings: 'lol_guesser_settings_v4',
  dataCache: 'lol_guesser_data_cache_v4',
  records: 'lol_guesser_records_v4',
  reviewBank: 'lol_guesser_review_bank_v4',
  dailyHistory: 'lol_guesser_daily_history_v4'
});

export const MAX_LIVES = 5;
export const DAILY_ROUNDS = 20;
export const TIMED_SECONDS = 60;
export const RECENT_SPELL_LIMIT = 15;
export const RECENT_CHAMP_LIMIT = 5;
export const PRELOAD_COUNT = 8;

export const POINTS = Object.freeze({
  base: 100,
  slot: 50,
  streakChampion: 10,
  streakSlot: 5,
  modifierBonuses: Object.freeze({
    bw: 50,
    rotate: 50,
    blur: 75,
    tiles: 75,
    zoom: 75,
    flash: 100,
    colorShift: 50,
    noAutocomplete: 50,
    oneAnswer: 100
  }),
  hintCosts: Object.freeze([25, 40, 60, 75])
});

export const DEFAULT_SETTINGS = Object.freeze({
  audio: true,
  rounds: '25',
  abilityFilter: 'all',
  roleFilter: 'all',
  championFilter: 'all',
  modifiers: Object.freeze({
    bw: false,
    rotate: false,
    blur: false,
    tiles: false,
    zoom: false,
    flash: false,
    colorShift: false,
    noAutocomplete: false,
    oneAnswer: false
  })
});

export const ACHIEVEMENTS = Object.freeze([
  { id: 'first_game', title: 'Primo passo', description: 'Completa la tua prima partita.', icon: '🎮' },
  { id: 'streak_10', title: 'Inarrestabile', description: 'Raggiungi una combo di 10.', icon: '🔥' },
  { id: 'streak_25', title: 'Occhio del Challenger', description: 'Raggiungi una combo di 25.', icon: '👁️' },
  { id: 'perfect_10', title: 'Partita perfetta', description: 'Completa 10 abilità senza errori.', icon: '💎' },
  { id: 'hardcore_clear', title: 'Senza pietà', description: 'Completa una partita Hardcore finita.', icon: '⚔️' },
  { id: 'no_hint_clear', title: 'Nessun aiuto', description: 'Completa una partita finita senza usare indizi.', icon: '🧠' },
  { id: 'daily_3', title: 'Rituale della Landa', description: 'Completa la sfida giornaliera per 3 giorni consecutivi.', icon: '📅' },
  { id: 'daily_7', title: 'Settimana Hextech', description: 'Completa la sfida giornaliera per 7 giorni consecutivi.', icon: '🗓️' },
  { id: 'review_10', title: 'Studente modello', description: 'Correggi 10 errori in modalità Ripasso.', icon: '📚' },
  { id: 'speed_20', title: 'Fulmine', description: 'Completa almeno 20 abilità nella modalità a tempo.', icon: '⚡' },
  { id: 'five_mods', title: 'Incubo visivo', description: 'Completa una partita usando almeno 5 modificatori.', icon: '🌀' },
  { id: 'level_10', title: 'Veterano della Landa', description: 'Raggiungi il livello 10.', icon: '🏅' }
]);

export const ROLE_LABELS = Object.freeze({
  Assassin: 'Assassino',
  Fighter: 'Combattente',
  Mage: 'Mago',
  Marksman: 'Tiratore',
  Support: 'Supporto',
  Tank: 'Tank'
});

export const MODIFIER_LABELS = Object.freeze({
  bw: 'Bianco e nero',
  rotate: 'Rotazione casuale',
  blur: 'Sfocatura',
  tiles: 'Tasselli coprenti',
  zoom: 'Zoom parziale',
  flash: 'Immagine per 1 secondo',
  colorShift: 'Colori alterati',
  noAutocomplete: 'Senza suggerimenti',
  oneAnswer: 'Una sola risposta'
});
