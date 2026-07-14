import { STORAGE_KEYS } from './constants.js?v=4.0.3';

const PLACEHOLDER_IMG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="#091420"/>
  <path d="M90 35 142 65v58l-52 30-52-30V65z" fill="none" stroke="#c8aa6e" stroke-width="6"/>
  <text x="90" y="103" text-anchor="middle" font-family="sans-serif" font-size="34" fill="#c8aa6e">?</text>
</svg>`)}`;

let spellDB = [];
let champions = [];
let dataVersion = '';

function safeParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function stripHtml(value) {
  const temp = document.createElement('div');
  temp.innerHTML = String(value || '').replace(/<br\s*\/?>/gi, ' ');
  return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

function processChampionData(rawChampions, version) {
  const nextSpells = [];
  const nextChampions = [];

  Object.values(rawChampions).forEach(champ => {
    const champImg = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.image.full}`;
    const champInfo = {
      id: champ.id,
      name: champ.name,
      tags: Array.isArray(champ.tags) ? champ.tags : [],
      difficulty: Number(champ.info?.difficulty || 5),
      img: champImg
    };
    nextChampions.push(champInfo);

    if (champ.passive?.image?.full) {
      nextSpells.push({
        key: `${champ.id}:P`,
        champ: champ.name,
        champId: champ.id,
        champTags: champInfo.tags,
        champDifficulty: champInfo.difficulty,
        champImg,
        slot: 'P',
        spellName: champ.passive.name || 'Passiva',
        description: stripHtml(champ.passive.description),
        img: `https://ddragon.leagueoflegends.com/cdn/${version}/img/passive/${champ.passive.image.full}`
      });
    }

    const slots = ['Q', 'W', 'E', 'R'];
    (champ.spells || []).forEach((spell, index) => {
      const slot = slots[index];
      if (!slot || !spell.image?.full) return;
      nextSpells.push({
        key: `${champ.id}:${slot}`,
        champ: champ.name,
        champId: champ.id,
        champTags: champInfo.tags,
        champDifficulty: champInfo.difficulty,
        champImg,
        slot,
        spellName: spell.name || `Abilità ${slot}`,
        description: stripHtml(spell.description || spell.tooltip),
        img: `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.image.full}`
      });
    });
  });

  spellDB = nextSpells;
  champions = nextChampions.sort((a, b) => a.name.localeCompare(b.name, 'it'));
  dataVersion = version;
}

function saveCache() {
  try {
    localStorage.setItem(STORAGE_KEYS.dataCache, JSON.stringify({
      version: dataVersion,
      spells: spellDB,
      champions,
      savedAt: Date.now()
    }));
  } catch (error) {
    console.warn('Cache Data Dragon non salvata:', error);
  }
}

function loadCache() {
  try {
    const cached = safeParse(localStorage.getItem(STORAGE_KEYS.dataCache));
    if (!cached?.spells?.length || !cached?.champions?.length) return null;
    spellDB = cached.spells;
    champions = cached.champions;
    dataVersion = cached.version || 'cache';
    return cached;
  } catch {
    return null;
  }
}

export async function loadGameData(onProgress = () => {}) {
  onProgress('Ricerca dell’ultima patch disponibile…');
  try {
    const versions = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    const version = versions[0];
    onProgress(`Patch ${version}: caricamento dei dati in italiano…`);

    let fullData;
    try {
      fullData = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/it_IT/championFull.json`);
    } catch (italianError) {
      console.warn('Dati italiani non disponibili, uso inglese.', italianError);
      fullData = await fetchJson(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/championFull.json`);
    }

    processChampionData(fullData.data, version);
    saveCache();
    return { source: 'network', version, spells: spellDB, champions };
  } catch (error) {
    console.error('Caricamento online fallito:', error);
    const cached = loadCache();
    if (!cached) throw error;
    onProgress(`Connessione assente: uso i dati salvati della patch ${dataVersion}.`);
    return { source: 'cache', version: dataVersion, spells: spellDB, champions };
  }
}

export function getSpells() {
  return spellDB;
}

export function getChampions() {
  return champions;
}

export function getDataVersion() {
  return dataVersion;
}

export function getPlaceholderImage() {
  return PLACEHOLDER_IMG;
}

export function safeImage(element, src) {
  const parent = element.parentElement;
  parent?.classList.add('image-loading');
  element.onload = () => parent?.classList.remove('image-loading');
  element.onerror = () => {
    element.onerror = null;
    parent?.classList.remove('image-loading');
    element.src = PLACEHOLDER_IMG;
  };
  element.src = src || PLACEHOLDER_IMG;
}

export function filterSpells(config) {
  return spellDB.filter(spell => {
    const abilityOk = config.abilityFilter === 'all'
      || (config.abilityFilter === 'active' && spell.slot !== 'P')
      || spell.slot === config.abilityFilter;
    const roleOk = config.roleFilter === 'all' || spell.champTags.includes(config.roleFilter);
    const champOk = config.championFilter === 'all' || spell.champ === config.championFilter;
    return abilityOk && roleOk && champOk;
  });
}
