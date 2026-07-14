import { ACHIEVEMENTS, MODIFIER_LABELS } from './constants.js?v=4.0.3';
import { safeImage } from './data.js?v=4.0.3';
import { xpForLevel } from './storage.js?v=4.0.3';

export const dom = {};

export function cacheDom() {
  document.querySelectorAll('[id]').forEach(element => { dom[element.id] = element; });
}

export function showScreen(screenId) {
  ['loading-screen', 'menu-screen', 'game-screen', 'game-over-screen'].forEach(id => {
    dom[id]?.classList.remove('active');
  });
  dom[screenId]?.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function setFeedback(message, tone = 'neutral') {
  dom.feedback.textContent = message;
  dom.feedback.dataset.tone = tone;
}

export function toast(message, tone = 'neutral', duration = 2600) {
  const item = document.createElement('div');
  item.className = `toast toast-${tone}`;
  item.textContent = message;
  dom['toast-stack'].appendChild(item);
  requestAnimationFrame(() => item.classList.add('show'));
  setTimeout(() => {
    item.classList.remove('show');
    setTimeout(() => item.remove(), 250);
  }, duration);
}

export function openModal(title, contentNode) {
  dom['modal-title'].textContent = title;
  dom['modal-content'].replaceChildren(contentNode);
  dom['app-modal'].classList.add('active');
  dom['app-modal'].setAttribute('aria-hidden', 'false');
}

export function closeModal() {
  dom['app-modal'].classList.remove('active');
  dom['app-modal'].setAttribute('aria-hidden', 'true');
}

export function renderProfile(profile, dailyStreak, reviewCount) {
  const currentLevelXp = xpForLevel(profile.level);
  const nextLevelXp = xpForLevel(profile.level + 1);
  const withinLevel = profile.xp - currentLevelXp;
  const needed = Math.max(1, nextLevelXp - currentLevelXp);
  const percent = Math.max(0, Math.min(100, Math.round((withinLevel / needed) * 100)));

  dom['profile-level'].textContent = profile.level;
  dom['profile-xp'].textContent = `${profile.xp} XP`;
  dom['profile-xp-next'].textContent = `${withinLevel}/${needed}`;
  dom['profile-xp-bar'].style.width = `${percent}%`;
  dom['profile-games'].textContent = profile.totalGames;
  dom['profile-best-streak'].textContent = profile.bestStreak;
  dom['profile-daily-streak'].textContent = dailyStreak;
  dom['profile-review-count'].textContent = reviewCount;
  dom['review-btn'].disabled = reviewCount === 0;
  dom['review-title'].textContent = reviewCount ? `Ripassa errori · ${reviewCount}` : 'Nessun errore da ripassare';
  dom['review-status'].textContent = reviewCount
    ? 'Le spell sbagliate tornano con priorità.'
    : 'Gli errori compariranno qui automaticamente.';
}

export function renderAchievements(profile) {
  const wrap = document.createElement('div');
  wrap.className = 'achievement-list';
  ACHIEVEMENTS.forEach(achievement => {
    const unlockedAt = profile.achievements[achievement.id];
    const card = document.createElement('article');
    card.className = `achievement-card ${unlockedAt ? 'unlocked' : 'locked'}`;
    card.innerHTML = `
      <div class="achievement-icon">${achievement.icon}</div>
      <div>
        <strong>${achievement.title}</strong>
        <p>${achievement.description}</p>
        <small>${unlockedAt ? `Sbloccato il ${new Date(unlockedAt).toLocaleDateString('it-IT')}` : 'Non ancora sbloccato'}</small>
      </div>`;
    wrap.appendChild(card);
  });
  return wrap;
}

export function renderDailyHistory(history) {
  const wrap = document.createElement('div');
  wrap.className = 'daily-history-list';
  const entries = Object.entries(history)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 14);

  if (!entries.length) {
    wrap.innerHTML = '<p class="empty-state">Non hai ancora completato una sfida giornaliera.</p>';
    return wrap;
  }

  entries.forEach(([date, result]) => {
    const row = document.createElement('article');
    row.className = 'daily-history-row';
    const pretty = new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
    row.innerHTML = `
      <div><strong>${pretty}</strong><small>${result.score} pt · ${result.accuracy}%</small></div>
      <div class="mini-grid" aria-label="Risultato giornaliero">${(result.grid || []).map(symbol => `<span>${symbol}</span>`).join('')}</div>`;
    wrap.appendChild(row);
  });
  return wrap;
}

export function renderModifierSummary(modifiers) {
  const enabled = Object.entries(modifiers)
    .filter(([, value]) => value)
    .map(([key]) => MODIFIER_LABELS[key]);
  dom['modifier-summary'].textContent = enabled.length ? enabled.join(' · ') : 'Nessun modificatore attivo';
}

export function showSolution(spell) {
  safeImage(dom['solution-champ-img'], spell.champImg);
  dom['solution-title'].textContent = `${spell.champ} · ${spell.spellName}`;
  dom['solution-meta'].textContent = `Slot ${spell.slot}`;
  dom['solution-description'].textContent = spell.description || 'Descrizione non disponibile.';
  dom['solution-card'].style.display = 'grid';
}

export function animateAbility(result) {
  const className = result === 'correct' ? 'flash-correct' : 'flash-wrong';
  dom['ability-stage'].classList.remove('flash-correct', 'flash-wrong');
  void dom['ability-stage'].offsetWidth;
  dom['ability-stage'].classList.add(className);
}

export function updateMuteButton(enabled) {
  dom['mute-btn'].textContent = enabled ? 'Audio: ON' : 'Audio: OFF';
}

export function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function renderTileOverlay(seed = Math.random()) {
  const overlay = dom['tile-overlay'];
  overlay.replaceChildren();
  let state = Math.floor(seed * 2147483647) || 1;
  const random = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  for (let i = 0; i < 16; i += 1) {
    const tile = document.createElement('span');
    tile.className = 'cover-tile';
    if (random() > 0.63) tile.classList.add('open');
    overlay.appendChild(tile);
  }
}

export function clearVisualReveal() {
  dom['hidden-image-overlay'].classList.remove('visible');
  dom['tile-overlay'].classList.remove('visible');
  dom['hint-portrait-wrap'].style.display = 'none';
}
