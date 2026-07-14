import { APP_VERSION } from './constants.js?v=4.0.3';
import { loadGameData } from './data.js?v=4.0.3';
import { initializeGameUi } from './game.js?v=4.0.3';
import { cacheDom, dom, openModal, showScreen, toast } from './ui.js?v=4.0.3';

let installPrompt = null;
let initialized = false;

async function boot() {
  showScreen('loading-screen');
  dom['retry-load-btn'].style.display = 'none';
  dom['loading-spinner'].style.display = 'block';
  try {
    const result = await loadGameData(message => { dom['loading-text'].textContent = message; });
    if (!initialized) {
      initializeGameUi();
      initialized = true;
    }
    dom['offline-badge'].textContent = result.source === 'cache' ? 'Dati offline' : `Patch ${result.version}`;
    showScreen('menu-screen');
  } catch (error) {
    console.error(error);
    dom['loading-text'].textContent = 'Non riesco a caricare i dati di League of Legends e non esiste ancora una copia salvata. Collegati a Internet e riprova.';
    dom['loading-spinner'].style.display = 'none';
    dom['retry-load-btn'].style.display = 'inline-block';
  }
}

function showInstallHelp() {
  const wrap = document.createElement('div');
  const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (installPrompt) {
    wrap.innerHTML = '<p>Il browser può installare direttamente il gioco come applicazione.</p>';
    const button = document.createElement('button');
    button.className = 'primary-btn';
    button.textContent = 'Installa ora';
    button.addEventListener('click', async () => {
      installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      dom['install-btn'].textContent = 'App installabile';
    });
    wrap.appendChild(button);
  } else if (isiOS) {
    wrap.innerHTML = `
      <ol class="install-steps">
        <li>Apri questa pagina con <strong>Safari</strong>.</li>
        <li>Tocca il pulsante <strong>Condividi</strong>.</li>
        <li>Scegli <strong>Aggiungi alla schermata Home</strong>.</li>
        <li>Attiva <strong>Apri come app web</strong> e premi Aggiungi.</li>
      </ol>
      <p class="small-note">Apri il gioco almeno una volta con Internet: da quel momento l’app e le immagini già usate saranno disponibili anche offline.</p>`;
  } else {
    wrap.innerHTML = '<p>Apri il menu del browser e scegli “Installa app” oppure “Aggiungi alla schermata Home”.</p>';
  }
  openModal('Installa LoL Spell Guesser', wrap);
}

function registerPwa() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js?v=4.0.3', { updateViaCache: 'none' }).then(registration => {
    registration.update().catch(() => {});
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          dom['update-banner'].classList.add('visible');
        }
      });
    });
  }).catch(error => console.warn('Service worker non registrato:', error));

  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
}

function bindAppEvents() {
  dom['retry-load-btn'].addEventListener('click', boot);
  dom['install-btn'].addEventListener('click', showInstallHelp);
  dom['reload-update-btn'].addEventListener('click', () => {
    navigator.serviceWorker?.getRegistration().then(registration => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      if (!registration?.waiting) location.reload();
    });
  });

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    dom['install-btn'].classList.add('primary-btn');
    dom['install-btn'].textContent = 'Installa app';
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    toast('Applicazione installata.', 'correct');
  });
}

window.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  dom['app-version'].textContent = APP_VERSION;
  bindAppEvents();
  registerPwa();
  boot();
});
