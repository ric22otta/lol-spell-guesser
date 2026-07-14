LOL SPELL GUESSER 4.0 — INSTALLAZIONE E UTILIZZO
=================================================

CONTENUTO DEL PACCHETTO
-----------------------
- index.html: pagina principale
- css/: grafica
- js/: logica del gioco, profilo, cache e statistiche
- icons/: icone per iPhone e PWA
- manifest.webmanifest: configurazione dell'app installabile
- service-worker.js: cache e funzionamento offline dopo il primo avvio

Non sono presenti account, classifiche o invii di dati personali.
Progressi, record, obiettivi, errori e storico giornaliero restano nel browser del dispositivo.

PROVA SUL PC CON XAMPP
----------------------
1. Estrai la cartella "lol-spell-guesser-pwa".
2. Copiala dentro:
   C:\xampp\htdocs\
3. Avvia XAMPP e premi Start accanto ad Apache.
4. Apri Chrome e visita:
   http://localhost/lol-spell-guesser-pwa/

Non aprire index.html con un semplice doppio clic: la versione PWA usa moduli JavaScript e deve essere aperta da un server web.

PUBBLICAZIONE PERSONALE CON GITHUB PAGES
----------------------------------------
1. Crea un repository pubblico su GitHub, per esempio "lol-spell-guesser".
2. Carica TUTTO il contenuto di questa cartella, mantenendo le cartelle css, js e icons.
3. Apri Settings > Pages.
4. Scegli "Deploy from a branch".
5. Seleziona il branch main e la cartella /root.
6. Apri l'indirizzo fornito da GitHub Pages.

INSTALLAZIONE SU IPHONE
-----------------------
1. Apri il link pubblicato usando Safari.
2. Tocca Condividi.
3. Tocca "Aggiungi alla schermata Home".
4. Attiva "Apri come app web", se presente.
5. Tocca Aggiungi.

Al primo avvio serve Internet per scaricare i dati aggiornati di League of Legends.
Dopo il primo caricamento, l'app e le immagini già utilizzate vengono conservate nella cache.

TRASFERIMENTO DEI PROGRESSI DAL PC ALL'IPHONE
---------------------------------------------
1. Sul PC apri il gioco e premi "Esporta dati".
2. Invia il file JSON all'iPhone tramite iCloud Drive, AirDrop, email o un altro metodo.
3. Apri il gioco sull'iPhone.
4. Premi "Importa dati" e seleziona il file JSON.

Il file trasferisce:
- livello ed esperienza;
- obiettivi;
- record;
- errori da ripassare;
- storico e serie giornaliera;
- impostazioni.

FUNZIONI PRINCIPALI DELLA VERSIONE 4.0
--------------------------------------
- profilo locale con livelli ed esperienza;
- obiettivi e medaglie;
- modalità Ripassa errori con priorità alle spell più sbagliate;
- sfida giornaliera deterministica con griglia condivisibile;
- storico delle giornaliere;
- indizi progressivi;
- nuovi modificatori: sfocatura, tasselli, zoom, immagine per un secondo, colori alterati;
- modalità senza suggerimenti e con una sola risposta;
- prevenzione delle ripetizioni ravvicinate;
- precaricamento delle prossime immagini;
- cache offline e aggiornamenti automatici;
- esportazione e importazione dei dati personali.

NOTE
----
- La rotazione casuale comprende volutamente anche 0°.
- Le abbreviazioni continuano volutamente a selezionare il primo campione compatibile nell'elenco.
- La sfida giornaliera salva un solo tentativo ufficiale al giorno; le ripetizioni successive sono indicate come non ufficiali.

TASTIERA AUTOMATICA SU IPHONE
-----------------------------
Dalla versione 4.0.1, durante la fase di riconoscimento del campione il campo viene attivato automaticamente e l'interfaccia si compatta quando la tastiera è aperta. La tastiera si chiude dopo aver indovinato il campione, per lasciare spazio alla scelta P/Q/W/E/R, e si riapre per la spell successiva.


AGGIORNAMENTO 4.0.2 – TASTIERA IPHONE
Su iPhone Safari non permette di aprire la tastiera da un timer. Per questo, quando tocchi P/Q/W/E/R, il turno successivo viene caricato immediatamente nello stesso tocco e il campo riceve subito il focus. Se sbagli lo slot, tocca Avanti: anche quel tocco apre direttamente la tastiera del turno successivo.
