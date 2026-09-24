const API_URL = 'https://adl2000-api.nicolasmintjens.workers.dev';
const STORAGE_KEY = 'adl2000Player';

const screens = {
  welcome: document.getElementById('welcomeScreen'),
  select: document.getElementById('playerSelectScreen'),
  home: document.getElementById('homeScreen'),
  stand: document.getElementById('standScreen'),
  calendar: document.getElementById('calendarScreen'),
  series: document.getElementById('seriesScreen'),
  more: document.getElementById('moreScreen'),
  records: document.getElementById('recordsScreen'),
  playerStats: document.getElementById('playerStatsScreen'),
  matchDetail: document.getElementById('matchDetailScreen'),
  teamDetail: document.getElementById('teamDetailScreen'),
  venues: document.getElementById('venuesScreen')
};

const bottomNav = document.getElementById('bottomNav');

let spelers = [];
let currentPlayer = loadSavedPlayer();
let overviewCache = {};
let calendarCache = {};
let calendarMode = 'team';
let calendarStatusFilter = 'all';
let selectedSeries = null;
let standMode = 'ploegen';
let seriesStandMode = 'ploegen';
let playerSelectMode = 'change';
let viewedPlayer = null;
let matchDetailReturn = 'home';
let selectedRecordType = 'kortste';
let selectedRecordCategory = '13-19';

init();


function init() {
  buildSeriesButtons();
  bindNavigation();
  bindPlayerSearch();
  bindMoreMenu();
  bindCalendarMode();
  bindStandMode();
  bindMatchDetail();
  registerServiceWorker();

  if (currentPlayer) {
    fillPlayerData();
    showMainScreen('home');
  } else {
    showOnly('welcome');
  }
}


function showOnly(name) {
  Object.entries(screens).forEach(([key, element]) => {
    element.hidden = key !== name;
  });

  bottomNav.hidden =
  ![
    'home',
    'stand',
    'calendar',
    'series',
    'more',
    'records',
    'playerStats',
    'matchDetail',
    'teamDetail'
  ].includes(name);
}


async function showMainScreen(name) {
  if (!currentPlayer) {
    showOnly('welcome');
    return;
  }

  fillPlayerData();
  showOnly(name);

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.nav === name
    );
  });

  if (name === 'home') {
    await loadOverview();
  }

  if (name === 'stand') {
    await loadStandScreen();
  }

  if (name === 'calendar') {
    await loadCalendar();
  }

  if (name === 'series') {
    renderSeriesSelector();
  }

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


function bindNavigation() {
  document.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', () => {
      showMainScreen(button.dataset.nav);
    });
  });

  document
    .getElementById('startButton')
    .addEventListener('click', () => openPlayerSelect('change'));

  document
    .getElementById('backButton')
    .addEventListener('click', () => {
      if (playerSelectMode === 'view' && currentPlayer) {
        showMainScreen('more');
      } else if (currentPlayer) {
        showMainScreen('more');
      } else {
        showOnly('welcome');
      }
    });
}


async function openPlayerSelect(mode = 'change') {
  playerSelectMode = mode;
  showOnly('select');

  const heading = document.querySelector(
    '#playerSelectScreen .section-heading h2'
  );
  const description = document.querySelector(
    '#playerSelectScreen .section-heading .muted'
  );

  if (heading) {
    heading.textContent =
      mode === 'view'
        ? 'Speler zoeken'
        : 'Kies je speler';
  }

  if (description) {
    description.textContent =
      mode === 'view'
        ? 'Zoek een speler om zijn volledige profiel te bekijken.'
        : 'Typ minstens twee letters van je naam.';
  }

  playerSearch.value = '';
  playerResults.innerHTML = '';
  playerSearch.focus();

  if (!spelers.length) {
    await loadPlayers();
  } else {
    playerSearchStatus.textContent =
      `${spelers.length} spelers beschikbaar`;
  }
}


async function loadPlayers() {
  playerSearchStatus.textContent = 'Spelers laden...';

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();

    spelers =
      Array.isArray(data.spelers)
        ? data.spelers
        : [];

    playerSearchStatus.textContent =
      `${spelers.length} spelers beschikbaar`;

  } catch (error) {
    console.error(error);

    playerSearchStatus.textContent =
      'Spelers konden niet geladen worden.';
  }
}


function bindPlayerSearch() {
  playerSearch.addEventListener('input', () => {
    const term =
      normalize(playerSearch.value.trim());

    playerResults.innerHTML = '';

    if (term.length < 2) {
      playerSearchStatus.textContent =
        term.length
          ? 'Typ minstens 2 letters.'
          : `${spelers.length} spelers beschikbaar`;

      return;
    }

    const results = spelers
      .filter(player =>
        normalize(player.naam).includes(term)
      )
      .slice(0, 30);

    playerSearchStatus.textContent =
      results.length
        ? `${results.length} resultaat${results.length === 1 ? '' : 'en'}`
        : 'Geen spelers gevonden.';

    results.forEach(player => {
      const button =
        document.createElement('button');

      button.className =
        'player-result';

      button.innerHTML = `
        <span class="player-result-name">
          ${esc(player.naam)}
        </span>

        <span class="player-result-info">
          ${esc(player.team)}
          · Afdeling ${esc(player.afdeling)}
          · TSP ${esc(player.tsp)}
        </span>
      `;

      button.addEventListener(
        'click',
        () => {
          if (playerSelectMode === 'view') {
            openOtherPlayerStats(player);
          } else {
            selectPlayer(player);
          }
        }
      );

      playerResults.appendChild(button);
    });
  });
}


function selectPlayer(player) {
  currentPlayer = player;

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(player)
  );

  overviewCache = {};
  calendarCache = {};
  standMode = 'ploegen';

  fillPlayerData();
  showMainScreen('home');
}


function loadSavedPlayer() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY);

    return raw
      ? JSON.parse(raw)
      : null;

  } catch {
    return null;
  }
}


function fillPlayerData() {
  if (!currentPlayer) {
    return;
  }

  const firstName =
    cleanPlayerName(currentPlayer.naam)
      .split(' ')[0] ||
    currentPlayer.naam;

  headerSubtitle.textContent =
    `${currentPlayer.team} · Afdeling ${currentPlayer.afdeling}`;

  homeGreeting.textContent =
    `Hallo, ${firstName}`;

  homePlayerName.textContent =
    currentPlayer.naam;

  homeTeam.textContent =
    `${currentPlayer.team} · Afdeling ${currentPlayer.afdeling}`;

  homeTsp.textContent =
    currentPlayer.tsp;

  homeDivision.textContent =
    `Afdeling ${currentPlayer.afdeling}`;

  standDescription.textContent =
    `${currentPlayer.team} · Afdeling ${currentPlayer.afdeling}`;

  calendarDescription.textContent =
    `${currentPlayer.team} · Afdeling ${currentPlayer.afdeling}`;
}


function cleanPlayerName(name) {
  return String(name)
    .replace(
      /\s+-\s+(K|N|N\/F|N\/OG)(\s+-\s+(K|N|N\/F|N\/OG))*\s*$/i,
      ''
    )
    .trim();
}


function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}


function esc(value) {
  return String(value ?? '')
    .replace(
      /[&<>"']/g,
      character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[character])
    );
}


async function getOverview(
  afdeling = currentPlayer.afdeling,
  team = currentPlayer.team
) {
  const key =
    `${afdeling}|${team}`;

  if (overviewCache[key]) {
    return overviewCache[key];
  }

  const response = await fetch(
    `${API_URL}/?type=overzicht` +
    `&afdeling=${encodeURIComponent(afdeling)}` +
    `&team=${encodeURIComponent(team)}`
  );

  if (!response.ok) {
    throw new Error(
      `Overzicht ${response.status}`
    );
  }

  const data =
    await response.json();

  overviewCache[key] = data;

  return data;
}


async function loadOverview(renderFull = false) {
  if (!currentPlayer) {
    return;
  }

  try {
    if (!renderFull) {
      standSnippet.innerHTML =
        '<span class="muted">Stand laden...</span>';

      previousMatch.innerHTML =
        '<span class="muted">Wedstrijd laden...</span>';

      nextMatch.innerHTML =
        '<span class="muted">Wedstrijd laden...</span>';
    }

    const data =
      await getOverview();

    renderHomeStand(
      data.standRondTeam || []
    );

    renderMatch(
      previousMatch,
      data.laatsteWedstrijd,
      true
    );

    renderMatch(
      nextMatch,
      data.volgendeWedstrijd,
      false
    );

    if (renderFull) {
      await loadFullStand(
        data.actueleSpeelweek
      );
    }

  } catch (error) {
    console.error(error);

    if (!renderFull) {
      standSnippet.innerHTML =
        '<span class="muted">Overzicht kon niet geladen worden.</span>';
    } else {
      fullStand.innerHTML = `
        <div class="empty-state">
          <strong>Stand kon niet geladen worden</strong>
          <p>Probeer het later opnieuw.</p>
        </div>
      `;
    }
  }
}


function renderHomeStand(rows) {
  standSnippet.className =
    'home-stand';

  standSnippet.innerHTML = '';

  rows.forEach(row => {
    const element =
      document.createElement('div');

    element.className =
      'home-stand-row';

    if (
      normalize(row.ploeg) ===
      normalize(currentPlayer.team)
    ) {
      element.classList.add('my-team');
    }

    element.innerHTML = `
      <span class="home-stand-position">
        ${esc(row.positie)}
      </span>

      <span class="home-stand-team">
        ${esc(row.ploeg)}
      </span>

      <strong class="home-stand-points">
        ${esc(row.punten)}
      </strong>
    `;

    standSnippet.appendChild(element);
  });
}


function renderMatch(
  container,
  match,
  withScore
) {
  if (!match) {
    container.innerHTML =
      '<span class="muted">Geen wedstrijd gevonden.</span>';

    return;
  }

  const score =
    withScore &&
    match.thuisPunten !== undefined
      ? `
        <div class="match-score">
          ${esc(match.thuisPunten)}
          <span>–</span>
          ${esc(match.uitPunten)}
        </div>
      `
      : '';

  container.onclick = null;
  container.removeAttribute('role');
  container.removeAttribute('tabindex');

  if (
    withScore &&
    match.ontmoetingId &&
    match.speelweek
  ) {
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');

    const openDetail = () =>
      openMatchDetail(
        currentPlayer.afdeling,
        match.speelweek,
        match.ontmoetingId,
        'home'
      );

    container.onclick = openDetail;
    container.onkeydown = event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail();
      }
    };
  } else {
    container.onkeydown = null;
  }

  container.innerHTML = `
    <div class="match-date">
      ${formatDate(match.datum)}
      ${match.speeldag ? ` · ${esc(match.speeldag)}` : ''}
    </div>

    <div class="match-teams">
      <strong>${esc(match.thuisploeg)}</strong>
      <span>tegen</span>
      <strong>${esc(match.uitploeg)}</strong>
    </div>

    ${score}

    ${
      match.lokaal
        ? `<div class="match-meta">${esc(match.lokaal)}</div>`
        : ''
    }
  `;
}


async function loadStandScreen() {
  const data = await getOverview();
  const week = data.actueleSpeelweek || 1;

  renderStandModeButtons();

  if (standMode === 'individueel') {
    await loadIndividualStand(week);
  } else {
    await loadFullStand(week);
  }
}


function renderStandModeButtons() {
  let controls =
    document.getElementById('standModeControls');

  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'standModeControls';
    controls.className = 'series-actions';

    fullStand.parentNode.insertBefore(
      controls,
      fullStand
    );
  }

  controls.innerHTML = `
    <button
      class="${standMode === 'ploegen' ? 'primary-button' : 'secondary-button'}"
      data-stand-mode="ploegen"
      type="button"
    >
      Ploegen
    </button>

    <button
      class="${standMode === 'individueel' ? 'primary-button' : 'secondary-button'}"
      data-stand-mode="individueel"
      type="button"
    >
      Individueel
    </button>
  `;
}


function bindStandMode() {
  document.addEventListener('click', event => {
    const button =
      event.target.closest('[data-stand-mode]');

    if (!button) {
      return;
    }

    standMode =
      button.dataset.standMode;

    loadStandScreen();
  });
}


async function loadIndividualStand(week) {
  fullStand.innerHTML = `
    <div class="empty-state">
      <strong>Individuele stand laden...</strong>
    </div>
  `;

  try {
    const response = await fetch(
      `${API_URL}/?type=individueel` +
      `&afdeling=${encodeURIComponent(currentPlayer.afdeling)}` +
      `&speelweek=${encodeURIComponent(week)}`
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data =
      await response.json();

    renderIndividualStand(
      data.stand || []
    );

  } catch (error) {
    console.error(error);

    fullStand.innerHTML = `
      <div class="empty-state">
        <strong>Individuele stand kon niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderIndividualStand(rows) {
  const table =
    document.createElement('div');

  table.className =
    'individual-stand-table';

  table.innerHTML = `
    <div class="individual-stand-row individual-stand-header">
      <span>#</span>
      <span>Speler</span>
      <span>Ploeg</span>
      <span>TSP</span>
      <span>PTN</span>
      <span>BNS</span>
      <span>Totaal</span>
    </div>
  `;

  rows.forEach(row => {
    const element =
      document.createElement('div');

    element.className =
      'individual-stand-row';

    if (
      String(row.spelerId) ===
      String(currentPlayer.id)
    ) {
      element.classList.add('my-team');
    }

    element.innerHTML = `
      <span>${esc(row.positie)}</span>
      <span><strong>${esc(row.naam)}</strong></span>
      <span>${esc(row.ploeg)}</span>
      <span>${esc(row.tsp)}</span>
      <span>${formatStandNumber(row.ptn)}</span>
      <span>${formatStandNumber(row.bonus)}</span>
      <span><strong>${formatStandNumber(row.totaal)}</strong></span>
    `;

    table.appendChild(element);
  });

  fullStand.innerHTML = '';
  fullStand.appendChild(table);
}


function formatStandNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return esc(value);
  }

  return esc(
    number.toLocaleString(
      'nl-BE',
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }
    )
  );
}


async function loadFullStand(week) {
  fullStand.innerHTML = `
    <div class="empty-state">
      <strong>Stand laden...</strong>
    </div>
  `;

  const response = await fetch(
    `${API_URL}/?type=stand` +
    `&afdeling=${encodeURIComponent(currentPlayer.afdeling)}` +
    `&speelweek=${encodeURIComponent(week)}`
  );

  if (!response.ok) {
    throw new Error(response.status);
  }

  const data =
    await response.json();

  renderStand(
    data.stand || []
  );
}


function renderStand(rows) {
  const table =
    document.createElement('div');

  table.className =
    'stand-table stand-table-full';

  table.innerHTML = `
    <div class="stand-row stand-header">
      <span>#</span>
      <span>Ploeg</span>
      <span>GSP</span>
      <span>W</span>
      <span>V</span>
      <span>G</span>
      <span>Punten</span>
    </div>
  `;

  rows.forEach(row => {
    const element =
      document.createElement('div');

    element.className =
      'stand-row';

    if (
      normalize(row.ploeg) ===
      normalize(currentPlayer.team)
    ) {
      element.classList.add('my-team');
    }

    const won =
      row.gewonnen ??
      row.winst ??
      row.w ??
      '–';

    const lost =
      row.verloren ??
      row.verlies ??
      row.v ??
      '–';

    const drawn =
      row.gelijk ??
      row.g ??
      '–';

    element.innerHTML = `
      <span class="stand-position">
        ${esc(row.positie)}
      </span>

      <button
  class="stand-team team-link"
  type="button"
  data-team-name="${esc(row.ploeg)}"
>
  ${esc(row.ploeg)}
</button>

      <span class="stand-gsp">
        ${esc(row.gsp)}
      </span>

      <span>${esc(won)}</span>
      <span>${esc(lost)}</span>
      <span>${esc(drawn)}</span>

      <span class="stand-points">
        ${esc(row.punten)}
      </span>
    `;

const teamButton =
  element.querySelector('[data-team-name]');

if (teamButton) {
  teamButton.addEventListener('click', () => {
    openTeamDetail(
      currentPlayer.afdeling,
      row.ploeg,
      'stand'
    );
  });
}

    table.appendChild(element);
  });

  fullStand.innerHTML = '';
  fullStand.appendChild(table);
}

async function loadCalendar() {
  calendarContent.innerHTML = `
    <div class="empty-state">
      <strong>Kalender laden...</strong>
    </div>
  `;

  try {
    const afdeling =
      currentPlayer.afdeling;

    let calendar =
      calendarCache[afdeling];

    if (!calendar) {
      const response = await fetch(
        `${API_URL}/?type=kalender` +
        `&afdeling=${encodeURIComponent(afdeling)}`
      );

      if (!response.ok) {
        throw new Error(response.status);
      }

      const data =
        await response.json();

      calendar =
        data.kalender || [];

      calendarCache[afdeling] =
        calendar;
    }

    await renderCalendar(calendar);

  } catch (error) {
    console.error(error);

    calendarContent.innerHTML = `
      <div class="empty-state">
        <strong>Kalender kon niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


async function renderCalendar(calendar) {
  let rows =
    calendarMode === 'team'
      ? calendar.filter(match =>
          normalize(match.thuisploeg) === normalize(currentPlayer.team) ||
          normalize(match.uitploeg) === normalize(currentPlayer.team)
        )
      : [...calendar];

  /*
   * Alleen bij "Mijn ploeg" voegen we de KVA-wedstrijden toe.
   * "Alle wedstrijden" blijft de gewone afdelingskalender.
   */
  if (calendarMode === 'team') {
    try {
      const koppelingResponse = await fetch(
        `${API_URL}/?type=kva` +
        `&team=${encodeURIComponent(currentPlayer.team)}`
      );

      if (koppelingResponse.ok) {
        const koppelingData =
          await koppelingResponse.json();

        const pouleNummer =
          koppelingData.gevonden &&
          koppelingData.koppeling
            ? koppelingData.koppeling.poule
            : null;

        if (pouleNummer) {
          const pouleResponse = await fetch(
            `${API_URL}/?type=kva` +
            `&poule=${encodeURIComponent(pouleNummer)}`
          );

          if (pouleResponse.ok) {
            const pouleData =
              await pouleResponse.json();

            const kvaWedstrijden =
              Array.isArray(pouleData.poule?.wedstrijden)
                ? pouleData.poule.wedstrijden
                    .filter(match =>
                      kvaTeamNaamKomtOvereen(
                        match.thuisploeg,
                        currentPlayer.team
                      ) ||
                      kvaTeamNaamKomtOvereen(
                        match.uitploeg,
                        currentPlayer.team
                      )
                    )
                    .map(match => ({
                      ...match,
                      isKva: true,
                      kvaPoule:
                        pouleData.poule.nummer
                    }))
                : [];

            rows.push(...kvaWedstrijden);
          }
        }

        /*
         * Voeg ook de KVA-knock-outwedstrijden van de eigen ploeg toe.
         * Lege toekomstige fases leveren gewoon geen wedstrijden op.
         */
        const kvaFaseSleutels = [
          'top16',
          'achtste',
          'kwart',
          'halve',
          'finale'
        ];

        const faseResultaten = await Promise.all(
          kvaFaseSleutels.map(async fase => {
            try {
              const response = await fetch(
                `${API_URL}/?type=kva` +
                `&fase=${encodeURIComponent(fase)}`
              );

              if (!response.ok) {
                return [];
              }

              const data = await response.json();
              const faseData = data.fase || null;

              if (!faseData || !Array.isArray(faseData.wedstrijden)) {
                return [];
              }

              return faseData.wedstrijden
                .filter(match =>
                  kvaTeamNaamKomtOvereen(
                    match.thuisploeg,
                    currentPlayer.team
                  ) ||
                  kvaTeamNaamKomtOvereen(
                    match.uitploeg,
                    currentPlayer.team
                  )
                )
                .map(match => ({
                  ...match,
                  isKva: true,
                  kvaFase: faseData.sleutel || fase,
                  kvaFaseNaam: faseData.naam || fase
                }));
            } catch (error) {
              console.error(
                `KVA-fase ${fase} kon niet aan de kalender toegevoegd worden:`,
                error
              );

              return [];
            }
          })
        );

        rows.push(...faseResultaten.flat());
      }
    } catch (error) {
      console.error(
        'KVA-kalender kon niet toegevoegd worden:',
        error
      );
      // De gewone kalender blijft werken als KVA tijdelijk faalt.
    }
  }

  const results = {};

  /*
   * Alleen de gewone competitiewedstrijden hebben hier een
   * ontmoetingId waarmee de bestaande uitslagenroute werkt.
   */
  const gewoneRows =
    rows.filter(match => !match.isKva);

  const weeks =
    [...new Set(
      gewoneRows.map(match => match.speelweek)
    )];

  await Promise.all(
    weeks.map(async week => {
      try {
        const response = await fetch(
          `${API_URL}/?type=uitslagen` +
          `&afdeling=${encodeURIComponent(currentPlayer.afdeling)}` +
          `&speelweek=${encodeURIComponent(week)}`
        );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        (data.uitslagen || [])
          .forEach(result => {
            results[
              String(result.ontmoetingId)
            ] = result;
          });

      } catch {
        // Een ontbrekende uitslag mag de kalender niet blokkeren.
      }
    })
  );

  /*
   * KVA: zolang de Worker geen gespeelde partijen/echte detaildata
   * teruggeeft, behandelen we 0,00 - 0,00 niet als een uitslag.
   */
  const kvaScoreGetal = value => {
    const getal =
      Number(
        String(value ?? '')
          .replace(',', '.')
      );

    return Number.isFinite(getal)
      ? getal
      : 0;
  };

  const kvaHeeftUitslag = match =>
    match.isKva &&
    (
      kvaScoreGetal(match.thuisPunten) !== 0 ||
      kvaScoreGetal(match.uitPunten) !== 0 ||
      (
        Array.isArray(match.partijen) &&
        match.partijen.length > 0
      )
    );

  const isPlayed = match =>
    match.isKva
      ? kvaHeeftUitslag(match)
      : Boolean(
          results[String(match.ontmoetingId)]
        );

  if (calendarStatusFilter === 'played') {
    rows = rows.filter(isPlayed);
  }

  if (calendarStatusFilter === 'upcoming') {
    rows = rows.filter(
      match => !isPlayed(match)
    );
  }

  /*
   * Gewone competitie gebruikt YYYY-MM-DD.
   * KVA gebruikt DD/MM. Beide worden naar een echte datum vertaald
   * zodat de wedstrijden chronologisch door elkaar staan.
   */
  const getCalendarDate = match => {
    if (!match.datum) {
      return new Date(8640000000000000);
    }

    if (match.isKva) {
      const value =
        String(match.datum).trim();

      const parts =
        value.match(
          /^(\d{1,2})\/(\d{1,2})$/
        );

      if (parts) {
        const day =
          Number(parts[1]);

        const month =
          Number(parts[2]);

        /*
         * Seizoen 2026-27:
         * juli-december = 2026
         * januari-juni = 2027.
         */
        const year =
          month >= 7
            ? 2026
            : 2027;

        return new Date(
          year,
          month - 1,
          day,
          12,
          0,
          0
        );
      }
    }

    return new Date(
      `${match.datum}T12:00:00`
    );
  };

  rows = [...rows].sort(
    (a, b) =>
      getCalendarDate(a) -
      getCalendarDate(b)
  );

  calendarContent.innerHTML = '';

  const filterControls =
    document.createElement('div');

  filterControls.className = 'series-actions';
  filterControls.innerHTML = `
    <button
      class="${calendarStatusFilter === 'all' ? 'primary-button' : 'secondary-button'}"
      data-calendar-status="all"
      type="button"
    >
      Alle
    </button>

    <button
      class="${calendarStatusFilter === 'played' ? 'primary-button' : 'secondary-button'}"
      data-calendar-status="played"
      type="button"
    >
      Gespeeld
    </button>

    <button
      class="${calendarStatusFilter === 'upcoming' ? 'primary-button' : 'secondary-button'}"
      data-calendar-status="upcoming"
      type="button"
    >
      Nog te spelen
    </button>
  `;

  calendarContent.appendChild(filterControls);

  if (!rows.length) {
    calendarContent.insertAdjacentHTML(
      'beforeend',
      `
        <div class="empty-state">
          <strong>Geen wedstrijden gevonden</strong>
        </div>
      `
    );

    return;
  }

  rows.forEach(match => {
    const result =
      match.isKva
        ? null
        : results[
            String(match.ontmoetingId)
          ];

    const card =
      document.createElement('article');

    card.className =
      'calendar-match';

    if (match.isKva) {
      card.classList.add('calendar-match-kva');
    }

    const isOwnMatch =
      match.isKva
        ? (
            kvaTeamNaamKomtOvereen(
              match.thuisploeg,
              currentPlayer.team
            ) ||
            kvaTeamNaamKomtOvereen(
              match.uitploeg,
              currentPlayer.team
            )
          )
        : (
            normalize(match.thuisploeg) ===
              normalize(currentPlayer.team) ||
            normalize(match.uitploeg) ===
              normalize(currentPlayer.team)
          );

    if (isOwnMatch) {
      card.classList.add('my-match');
    }

    const scoreHtml =
      match.isKva
        ? (
            kvaHeeftUitslag(match)
              ? `
                  <strong>
                    ${esc(match.thuisPunten)}
                    –
                    ${esc(match.uitPunten)}
                  </strong>
                `
              : '<strong>vs</strong>'
          )
        : (
            result
              ? `
                  <strong>
                    ${esc(result.thuisPunten)}
                    –
                    ${esc(result.uitPunten)}
                  </strong>
                `
              : '<strong>–</strong>'
          );

    const metaParts = [];

    if (match.lokaal) {
      metaParts.push(
        esc(match.lokaal)
      );
    }

    card.innerHTML = `
      <div class="calendar-date">
        ${
          match.isKva
            ? formatKvaDate(match.datum)
            : formatDate(match.datum)
        }
        ${
          match.isKva
            ? '<span class="calendar-kva-badge">KVA</span>'
            : ''
        }
      </div>

      <div class="calendar-teams">
        <span>${esc(match.thuisploeg)}</span>
        ${scoreHtml}
        <span>${esc(match.uitploeg)}</span>
      </div>

      ${
        metaParts.length
          ? `
              <div class="calendar-meta">
                ${metaParts.join(' · ')}
              </div>
            `
          : ''
      }
    `;

    if (
      !match.isKva &&
      result?.ontmoetingId
    ) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const openDetail = () =>
        openMatchDetail(
          currentPlayer.afdeling,
          match.speelweek,
          result.ontmoetingId,
          'calendar'
        );

      card.addEventListener(
        'click',
        openDetail
      );

      card.addEventListener(
        'keydown',
        event => {
          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault();
            openDetail();
          }
        }
      );
    }

    calendarContent.appendChild(card);
  });
}

function bindCalendarMode() {
  document
    .querySelectorAll('[data-calendar-mode]')
    .forEach(button => {
      button.addEventListener('click', () => {
        calendarMode =
          button.dataset.calendarMode;

        document
          .querySelectorAll('[data-calendar-mode]')
          .forEach(item => {
            item.classList.toggle(
              'active',
              item === button
            );
          });

        loadCalendar();
      });
    });

  document.addEventListener('click', event => {
    const button =
      event.target.closest('[data-calendar-status]');

    if (!button) {
      return;
    }

    calendarStatusFilter =
      button.dataset.calendarStatus;

    loadCalendar();
  });
}


function formatDate(value) {
  if (!value) {
    return 'Datum onbekend';
  }

  const date =
    new Date(`${value}T12:00:00`);

  return date.toLocaleDateString(
    'nl-BE',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );
}


function buildSeriesButtons() {
  renderSeriesSelector();
}


function renderSeriesSelector() {
  const grid =
    document.getElementById('seriesGrid');

  selectedSeries = null;

  grid.className = 'series-grid';
  grid.innerHTML = '';

  ['A', 'B', 'C', 'D', 'E']
    .forEach(division => {
      const button =
        document.createElement('button');

      button.className =
        `series-button series-${division.toLowerCase()}`;

      button.innerHTML = `
        <strong>${division}</strong>
        <span>Afdeling ${division}</span>
      `;

      button.addEventListener(
        'click',
        () => openSeries(division)
      );

      grid.appendChild(button);
    });

  const kvaButton =
    document.createElement('button');

  kvaButton.className =
    'series-button series-kva';

  kvaButton.innerHTML = `
    <strong>KVA</strong>
    <span>Knock-out & poules</span>
  `;

  kvaButton.addEventListener(
    'click',
    openKvaSelector
  );

  grid.appendChild(kvaButton);
}



async function openKvaSelector() {
  selectedSeries = 'KVA';

  const grid =
    document.getElementById('seriesGrid');

  grid.className = 'series-detail';
  grid.innerHTML = `
    <button
      class="text-button series-back-button"
      id="kvaBackButton"
      type="button"
    >
      ← Andere reeks kiezen
    </button>

    <div class="series-detail-heading">
      <span class="eyebrow">KVA</span>
      <h3>KVA</h3>
      <p class="muted">
        Bekijk de poules en de knock-outfases van de KVA.
      </p>
    </div>

    <div class="series-detail-heading">
      <span class="eyebrow">Voorronde</span>
      <h3>Poules</h3>
      <p class="muted">
        Kies een poule om de stand en wedstrijden te bekijken.
      </p>
    </div>

    <div id="kvaPouleGrid" class="series-grid">
      <div class="empty-state">
        <strong>KVA-poules laden...</strong>
      </div>
    </div>

    <div class="series-detail-heading kva-knockout-heading">
      <span class="eyebrow">Knock-out</span>
      <h3>Volgende rondes</h3>
    </div>

    <div id="kvaFaseGrid" class="kva-phase-grid">
      <div class="empty-state">
        <strong>KVA-fases laden...</strong>
      </div>
    </div>
  `;

  document
    .getElementById('kvaBackButton')
    .addEventListener(
      'click',
      renderSeriesSelector
    );

  try {
    const response =
      await fetch(
        `${API_URL}/?type=kva`
      );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data =
      await response.json();

    const poules =
      Array.isArray(data.poules)
        ? data.poules
        : [];

    const fases =
      Array.isArray(data.fases)
        ? data.fases.filter(
            fase => fase.sleutel !== 'poules'
          )
        : [];

    renderKvaPoules(poules);
    renderKvaFases(fases);

  } catch (error) {
    console.error(error);

    const faseContainer =
      document.getElementById('kvaFaseGrid');

    const pouleContainer =
      document.getElementById('kvaPouleGrid');

    if (faseContainer) {
      faseContainer.innerHTML = `
        <div class="empty-state">
          <strong>KVA-fases konden niet geladen worden</strong>
          <p>Probeer het later opnieuw.</p>
        </div>
      `;
    }

    if (pouleContainer) {
      pouleContainer.innerHTML = `
        <div class="empty-state">
          <strong>KVA-poules konden niet geladen worden</strong>
          <p>Probeer het later opnieuw.</p>
        </div>
      `;
    }
  }
}


function renderKvaFases(fases) {
  const container =
    document.getElementById('kvaFaseGrid');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!fases.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen KVA-fases gevonden</strong>
      </div>
    `;
    return;
  }

  fases.forEach(fase => {
    const button =
      document.createElement('button');

    button.className =
      'kva-phase-button';

    button.innerHTML = `
      <strong>${esc(fase.naam)}</strong>
    `;

    button.addEventListener(
      'click',
      () => openKvaFase(fase.sleutel, fase.naam)
    );

    container.appendChild(button);
  });
}


async function openKvaFase(faseSleutel, faseNaam) {
  selectedSeries = 'KVA';

  const grid =
    document.getElementById('seriesGrid');

  grid.className = 'series-detail';
  grid.innerHTML = `
    <button
      class="text-button series-back-button"
      id="kvaFaseBackButton"
      type="button"
    >
      ← KVA
    </button>

    <div class="series-detail-heading">
      <span class="eyebrow">KVA</span>
      <h3>${esc(faseNaam)}</h3>
      <p class="muted">
        Wedstrijden van deze KVA-fase.
      </p>
    </div>

    <div id="kvaFaseContent">
      <div class="empty-state">
        <strong>${esc(faseNaam)} laden...</strong>
      </div>
    </div>
  `;

  document
    .getElementById('kvaFaseBackButton')
    .addEventListener(
      'click',
      openKvaSelector
    );

  try {
    const response =
      await fetch(
        `${API_URL}/?type=kva` +
        `&fase=${encodeURIComponent(faseSleutel)}`
      );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data =
      await response.json();

    renderKvaFaseWedstrijden(
      data.fase || {
        sleutel: faseSleutel,
        naam: faseNaam,
        wedstrijden: []
      }
    );

  } catch (error) {
    console.error(error);

    const container =
      document.getElementById('kvaFaseContent');

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>${esc(faseNaam)} kon niet geladen worden</strong>
          <p>Probeer het later opnieuw.</p>
        </div>
      `;
    }
  }
}


function renderKvaFaseWedstrijden(fase) {
  const container =
    document.getElementById('kvaFaseContent');

  if (!container) {
    return;
  }

  const matches =
    Array.isArray(fase.wedstrijden)
      ? [...fase.wedstrijden]
      : [];

  container.innerHTML = '';

  if (!matches.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Nog geen wedstrijden ingevuld</strong>
        <p>
          Zodra ADL2000 de ${esc(fase.naam || 'KVA-fase')} invult,
          verschijnen de wedstrijden hier automatisch.
        </p>
      </div>
    `;
    return;
  }

  matches.sort(
    (a, b) =>
      kvaDatumNaarAppSorteerWaarde(a.datum) -
      kvaDatumNaarAppSorteerWaarde(b.datum)
  );

  matches.forEach(match => {
    const card =
      document.createElement('article');

    card.className =
      'calendar-match calendar-match-kva';

    if (
      kvaTeamNaamKomtOvereen(
        match.thuisploeg,
        currentPlayer.team
      ) ||
      kvaTeamNaamKomtOvereen(
        match.uitploeg,
        currentPlayer.team
      )
    ) {
      card.classList.add('my-match');
    }

    const thuis =
      Number(
        String(match.thuisPunten ?? '')
          .replace(',', '.')
      );

    const uit =
      Number(
        String(match.uitPunten ?? '')
          .replace(',', '.')
      );

    const heeftUitslag =
      (Number.isFinite(thuis) && thuis !== 0) ||
      (Number.isFinite(uit) && uit !== 0) ||
      (
        Array.isArray(match.partijen) &&
        match.partijen.length > 0
      );

    card.innerHTML = `
      <div class="calendar-date">
        ${formatKvaDate(match.datum)}
        <span class="calendar-kva-badge">KVA</span>
      </div>

      <div class="calendar-teams">
        <span>${esc(match.thuisploeg)}</span>

        <strong>
          ${
            heeftUitslag
              ? `${esc(match.thuisPunten)} – ${esc(match.uitPunten)}`
              : 'vs'
          }
        </strong>

        <span>${esc(match.uitploeg)}</span>
      </div>

      ${
        match.lokaal
          ? `
              <div class="calendar-meta">
                ${esc(match.lokaal)}
              </div>
            `
          : ''
      }
    `;

    container.appendChild(card);
  });
}


function kvaDatumNaarAppSorteerWaarde(value) {
  const text =
    String(value ?? '').trim();

  if (!text) {
    return Number.MAX_SAFE_INTEGER;
  }

  const kva =
    text.match(
      /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/
    );

  if (kva) {
    const day = Number(kva[1]);
    const month = Number(kva[2]);

    let year =
      kva[3]
        ? Number(kva[3])
        : (month >= 7 ? 2026 : 2027);

    if (year < 100) {
      year += 2000;
    }

    return new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    ).getTime();
  }

  const date =
    new Date(`${text}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? Number.MAX_SAFE_INTEGER
    : date.getTime();
}


async function renderKvaPoules(poules) {
  const container =
    document.getElementById('kvaPouleGrid');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!poules.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen KVA-poules gevonden</strong>
      </div>
    `;
    return;
  }

  let eigenPoule = null;

  try {
    if (currentPlayer?.team) {
      const response = await fetch(
        `${API_URL}/?type=kva` +
        `&team=${encodeURIComponent(currentPlayer.team)}`
      );

      if (response.ok) {
        const data =
          await response.json();

        if (
          data.gevonden &&
          data.koppeling
        ) {
          eigenPoule =
            Number(data.koppeling.poule);
        }
      }
    }
  } catch (error) {
    console.error(
      'Eigen KVA-poule kon niet bepaald worden:',
      error
    );
  }

  poules.forEach(poule => {
    const button =
      document.createElement('button');

    button.className =
      'series-button series-kva';

    if (
      eigenPoule !== null &&
      Number(poule.nummer) === eigenPoule
    ) {
      button.classList.add(
        'series-kva-own'
      );
    }

    button.innerHTML = `
      <strong>${esc(poule.nummer)}</strong>
      <span>${esc(poule.naam)}</span>
    `;

    button.addEventListener(
      'click',
      () => openKvaPoule(poule.nummer)
    );

    container.appendChild(button);
  });
}

async function openKvaPoule(pouleNummer) {
  selectedSeries = 'KVA';

  const grid =
    document.getElementById('seriesGrid');

  grid.className = 'series-detail';
  grid.innerHTML = `
    <button
      class="text-button series-back-button"
      id="kvaPouleBackButton"
      type="button"
    >
      ← KVA-poules
    </button>

    <div class="series-detail-heading">
      <span class="eyebrow">KVA</span>
      <h3>Poule ${esc(pouleNummer)}</h3>
      <p class="muted">
        Bekijk de stand of kalender van deze KVA-poule.
      </p>
    </div>

    <div class="series-actions">
      <button
        class="primary-button"
        id="kvaStandButton"
        type="button"
      >
        Stand
      </button>

      <button
        class="secondary-button"
        id="kvaCalendarButton"
        type="button"
      >
        Kalender & uitslagen
      </button>
    </div>

    <div id="kvaContent">
      <div class="empty-state">
        <strong>KVA-poule laden...</strong>
      </div>
    </div>
  `;

  document
    .getElementById('kvaPouleBackButton')
    .addEventListener(
      'click',
      openKvaSelector
    );

  try {
    const response =
      await fetch(
        `${API_URL}/?type=kva` +
        `&poule=${encodeURIComponent(pouleNummer)}`
      );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data =
      await response.json();

    const poule =
      data.poule || null;

    if (!poule) {
      throw new Error('KVA-poule niet gevonden');
    }

    const standButton =
      document.getElementById('kvaStandButton');

    const calendarButton =
      document.getElementById('kvaCalendarButton');

    standButton.addEventListener(
      'click',
      () => {
        standButton.className = 'primary-button';
        calendarButton.className = 'secondary-button';
        renderKvaStand(poule);
      }
    );

    calendarButton.addEventListener(
      'click',
      () => {
        standButton.className = 'secondary-button';
        calendarButton.className = 'primary-button';
        renderKvaCalendar(poule);
      }
    );

    renderKvaStand(poule);

  } catch (error) {
    console.error(error);

    const container =
      document.getElementById('kvaContent');

    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <strong>KVA-poule kon niet geladen worden</strong>
          <p>Probeer het later opnieuw.</p>
        </div>
      `;
    }
  }
}


function renderKvaStand(poule) {
  const container =
    document.getElementById('kvaContent');

  if (!container) {
    return;
  }

  const rows =
    Array.isArray(poule.stand)
      ? poule.stand
      : [];

  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen stand gevonden</strong>
      </div>
    `;
    return;
  }

  const table =
    document.createElement('div');

  table.className =
    'stand-table stand-table-full';

  table.innerHTML = `
    <div class="stand-row stand-header">
      <span>#</span>
      <span>Ploeg</span>
      <span>GSP</span>
      <span>W</span>
      <span>V</span>
      <span>G</span>
      <span>Punten</span>
    </div>
  `;

  rows.forEach(row => {
    const element =
      document.createElement('div');

    element.className =
      'stand-row';

    if (
      normalize(row.ploeg) ===
      normalize(currentPlayer.team)
    ) {
      element.classList.add('my-team');
    }

    element.innerHTML = `
      <span class="stand-position">
        ${esc(row.positie)}
      </span>

      <span class="stand-team">
        ${esc(row.ploeg)}
      </span>

      <span class="stand-gsp">
        ${esc(row.gsp)}
      </span>

      <span>${esc(row.winst ?? '–')}</span>
      <span>${esc(row.verlies ?? '–')}</span>
      <span>${esc(row.gelijk ?? '–')}</span>

      <span class="stand-points">
        ${esc(row.punten)}
      </span>
    `;

    table.appendChild(element);
  });

  container.innerHTML = '';
  container.appendChild(table);
}


function renderKvaCalendar(poule) {
  const container =
    document.getElementById('kvaContent');

  if (!container) {
    return;
  }

  const matches =
    Array.isArray(poule.wedstrijden)
      ? [...poule.wedstrijden]
      : [];

  matches.sort((a, b) => {
    const weekDifference =
      (Number(a.speelweek) || 0) -
      (Number(b.speelweek) || 0);

    if (weekDifference !== 0) {
      return weekDifference;
    }

    return String(a.datum || '')
      .localeCompare(
        String(b.datum || '')
      );
  });

  container.innerHTML = '';

  if (!matches.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen wedstrijden gevonden</strong>
      </div>
    `;
    return;
  }

  let lastWeek = null;

  matches.forEach(match => {
    if (match.speelweek !== lastWeek) {
      const heading =
        document.createElement('div');

      heading.className =
        'week-heading';

      heading.textContent =
        `Speelweek ${match.speelweek}`;

      container.appendChild(heading);

      lastWeek =
        match.speelweek;
    }

    const card =
      document.createElement('article');

    card.className =
      'calendar-match';

    if (
      kvaTeamNaamKomtOvereen(
        match.thuisploeg,
        currentPlayer.team
      ) ||
      kvaTeamNaamKomtOvereen(
        match.uitploeg,
        currentPlayer.team
      )
    ) {
      card.classList.add('my-match');
    }

    const kvaScoreGetal = value => {
      const getal =
        Number(
          String(value ?? '')
            .replace(',', '.')
        );

      return Number.isFinite(getal)
        ? getal
        : 0;
    };

    const heeftUitslag =
      kvaScoreGetal(match.thuisPunten) !== 0 ||
      kvaScoreGetal(match.uitPunten) !== 0 ||
      (
        Array.isArray(match.partijen) &&
        match.partijen.length > 0
      );

    card.innerHTML = `
      <div class="calendar-date">
        ${formatKvaDate(match.datum)}
      </div>

      <div class="calendar-teams">
        <span>${esc(match.thuisploeg)}</span>

        <strong>
          ${
            heeftUitslag
              ? `${esc(match.thuisPunten)} – ${esc(match.uitPunten)}`
              : 'vs'
          }
        </strong>

        <span>${esc(match.uitploeg)}</span>
      </div>

      ${
        match.lokaal
          ? `
              <div class="calendar-meta">
                ${esc(match.lokaal)}
              </div>
            `
          : ''
      }
    `;

    container.appendChild(card);
  });
}


function kvaTeamNaamKomtOvereen(a, b) {
  const kort = value =>
    normalize(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(
        /^(bc|kc|kb|kbc|bb|pc)\s+/,
        ''
      )
      .trim();

  return kort(a) === kort(b);
}


function formatKvaDate(value) {
  if (!value) {
    return 'Datum onbekend';
  }

  const text =
    String(value).trim();

  const match =
    text.match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    return formatDate(text);
  }

  const day =
    Number(match[1]);

  const month =
    Number(match[2]);

  const currentYear =
    new Date().getFullYear();

  const year =
    month >= 7
      ? currentYear
      : currentYear + 1;

  const date =
    new Date(
      year,
      month - 1,
      day,
      12,
      0,
      0
    );

  return date.toLocaleDateString(
    'nl-BE',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }
  );
}


function openSeries(division) {
  selectedSeries = division;
  seriesStandMode = 'ploegen';

  const grid =
    document.getElementById('seriesGrid');

  grid.className = 'series-detail';
  grid.innerHTML = `
    <button
      class="text-button series-back-button"
      id="seriesBackButton"
      type="button"
    >
      ← Andere afdeling kiezen
    </button>

    <div class="series-detail-heading">
      <span class="eyebrow">Competitie</span>
      <h3>Afdeling ${esc(division)}</h3>
      <p class="muted">
        Bekijk de volledige stand of kalender van deze afdeling.
      </p>
    </div>

    <div class="series-actions">
      <button
        class="primary-button"
        id="seriesStandButton"
        type="button"
      >
        Stand
      </button>

      <button
        class="secondary-button"
        id="seriesCalendarButton"
        type="button"
      >
        Kalender & uitslagen
      </button>
    </div>

    <div id="seriesContent"></div>
  `;

  document
    .getElementById('seriesBackButton')
    .addEventListener('click', renderSeriesSelector);

  document
    .getElementById('seriesStandButton')
    .addEventListener(
      'click',
      () => loadSeriesStand(division)
    );

  document
    .getElementById('seriesCalendarButton')
    .addEventListener(
      'click',
      () => loadSeriesCalendar(division)
    );
}


async function getSeriesCalendar(division) {
  let calendar = calendarCache[division];

  if (calendar) {
    return calendar;
  }

  const response = await fetch(
    `${API_URL}/?type=kalender` +
    `&afdeling=${encodeURIComponent(division)}`
  );

  if (!response.ok) {
    throw new Error(response.status);
  }

  const data = await response.json();

  calendar = data.kalender || [];
  calendarCache[division] = calendar;

  return calendar;
}


async function getCurrentSeriesWeek(division) {
  const calendar = await getSeriesCalendar(division);
  const now = new Date();

  const pastMatches = calendar.filter(match => {
    if (!match.datum) {
      return false;
    }

    return new Date(`${match.datum}T23:59:59`) <= now;
  });

  if (!pastMatches.length) {
    return 1;
  }

  return Math.max(
    ...pastMatches.map(
      match => Number(match.speelweek) || 1
    )
  );
}


async function loadSeriesStand(division, mode = seriesStandMode) {
  const container =
    document.getElementById('seriesContent');

  if (!container) {
    return;
  }

  seriesStandMode = mode;

  container.innerHTML = `
    <div class="series-stand-mode" id="seriesStandModeControls">
      <button
        class="${seriesStandMode === 'ploegen' ? 'primary-button' : 'secondary-button'}"
        data-series-stand-mode="ploegen"
        type="button"
      >
        Ploegen
      </button>

      <button
        class="${seriesStandMode === 'individueel' ? 'primary-button' : 'secondary-button'}"
        data-series-stand-mode="individueel"
        type="button"
      >
        Individueel
      </button>
    </div>

    <div class="empty-state">
      <strong>${seriesStandMode === 'individueel' ? 'Individuele stand' : 'Stand'} laden...</strong>
    </div>
  `;

  container
    .querySelectorAll('[data-series-stand-mode]')
    .forEach(button => {
      button.addEventListener('click', () => {
        loadSeriesStand(
          division,
          button.dataset.seriesStandMode
        );
      });
    });

  try {
    const week =
      await getCurrentSeriesWeek(division);

    const type =
      seriesStandMode === 'individueel'
        ? 'individueel'
        : 'stand';

    const response = await fetch(
      `${API_URL}/?type=${type}` +
      `&afdeling=${encodeURIComponent(division)}` +
      `&speelweek=${encodeURIComponent(week)}`
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();
    const rows = data.stand || [];

    const controls =
      container.querySelector('#seriesStandModeControls');

    const content = document.createElement('div');
    content.className = 'series-stand-content';

    if (seriesStandMode === 'individueel') {
      renderSeriesIndividualStand(content, rows);
    } else {
      renderSeriesStand(content, rows);
    }

    container.innerHTML = '';
    container.appendChild(controls);
    container.appendChild(content);

  } catch (error) {
    console.error(error);

    const loading =
      container.querySelector('.empty-state');

    if (loading) {
      loading.innerHTML = `
        <strong>Stand kon niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      `;
    }
  }
}


function renderSeriesStand(container, rows) {
  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen stand gevonden</strong>
      </div>
    `;
    return;
  }

  const table = document.createElement('div');
  table.className = 'stand-table stand-table-full';

  table.innerHTML = `
    <div class="stand-row stand-header">
      <span>#</span>
      <span>Ploeg</span>
      <span>GSP</span>
      <span>W</span>
      <span>V</span>
      <span>G</span>
      <span>Punten</span>
    </div>
  `;

  rows.forEach(row => {
    const element = document.createElement('div');
    element.className = 'stand-row';

    if (
      normalize(row.ploeg) ===
      normalize(currentPlayer.team)
    ) {
      element.classList.add('my-team');
    }

    const won = row.gewonnen ?? row.winst ?? row.w ?? '–';
    const lost = row.verloren ?? row.verlies ?? row.v ?? '–';
    const drawn = row.gelijk ?? row.g ?? '–';

    element.innerHTML = `
      <span class="stand-position">${esc(row.positie)}</span>
      <span class="stand-team">${esc(row.ploeg)}</span>
      <span class="stand-gsp">${esc(row.gsp)}</span>
      <span>${esc(won)}</span>
      <span>${esc(lost)}</span>
      <span>${esc(drawn)}</span>
      <span class="stand-points">${esc(row.punten)}</span>
    `;

    table.appendChild(element);
  });

  container.innerHTML = '';
  container.appendChild(table);
}


function renderSeriesIndividualStand(container, rows) {
  if (!rows.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen individuele stand gevonden</strong>
      </div>
    `;
    return;
  }

  const table = document.createElement('div');
  table.className = 'individual-stand-table';

  table.innerHTML = `
    <div class="individual-stand-row individual-stand-header">
      <span>#</span>
      <span>Speler</span>
      <span>Ploeg</span>
      <span>TSP</span>
      <span>PTN</span>
      <span>BNS</span>
      <span>Totaal</span>
    </div>
  `;

  rows.forEach(row => {
    const element = document.createElement('div');
    element.className = 'individual-stand-row';

    if (
      String(row.spelerId) ===
      String(currentPlayer.id)
    ) {
      element.classList.add('my-team');
    }

    element.innerHTML = `
      <span>${esc(row.positie)}</span>
      <span><strong>${esc(row.naam)}</strong></span>
      <span>${esc(row.ploeg)}</span>
      <span>${esc(row.tsp)}</span>
      <span>${formatStandNumber(row.ptn)}</span>
      <span>${formatStandNumber(row.bonus)}</span>
      <span><strong>${formatStandNumber(row.totaal)}</strong></span>
    `;

    table.appendChild(element);
  });

  container.innerHTML = '';
  container.appendChild(table);
}

async function loadSeriesCalendar(division) {
  const container =
    document.getElementById('seriesContent');

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="empty-state">
      <strong>Kalender laden...</strong>
    </div>
  `;

  try {
    const calendar =
      [...await getSeriesCalendar(division)]
        .sort(
          (a, b) =>
            String(a.datum).localeCompare(
              String(b.datum)
            )
        );

    const weeks =
      [...new Set(
        calendar.map(match => match.speelweek)
      )];

    const results = {};

    const finishedWeeks =
      weeks.filter(week => {
        const matches =
          calendar.filter(
            item => item.speelweek === week
          );

        return matches.some(match =>
          match.datum &&
          new Date(`${match.datum}T23:59:59`) <= new Date()
        );
      });

    await Promise.all(
      finishedWeeks.map(async week => {
        try {
          const response = await fetch(
            `${API_URL}/?type=uitslagen` +
            `&afdeling=${encodeURIComponent(division)}` +
            `&speelweek=${encodeURIComponent(week)}`
          );

          if (!response.ok) {
            return;
          }

          const data = await response.json();

          (data.uitslagen || []).forEach(result => {
            results[String(result.ontmoetingId)] = result;
          });
        } catch {
          // Ontbrekende uitslag blokkeert de kalender niet.
        }
      })
    );

    renderSeriesCalendar(
      container,
      calendar,
      results
    );

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        <strong>Kalender kon niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderSeriesCalendar(
  container,
  calendar,
  results
) {
  container.innerHTML = '';

  if (!calendar.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen wedstrijden gevonden</strong>
      </div>
    `;
    return;
  }

  let lastWeek = null;

  calendar.forEach(match => {
    if (match.speelweek !== lastWeek) {
      const heading =
        document.createElement('div');

      heading.className = 'week-heading';
      heading.textContent =
        `Speelweek ${match.speelweek}`;

      container.appendChild(heading);
      lastWeek = match.speelweek;
    }

    const result =
      results[String(match.ontmoetingId)];

    const card =
      document.createElement('article');

    card.className = 'calendar-match';

    if (
      normalize(match.thuisploeg) ===
        normalize(currentPlayer.team) ||
      normalize(match.uitploeg) ===
        normalize(currentPlayer.team)
    ) {
      card.classList.add('my-match');
    }

    card.innerHTML = `
      <div class="calendar-date">
        ${formatDate(match.datum)}
      </div>

      <div class="calendar-teams">
        <span>${esc(match.thuisploeg)}</span>

        ${
          result
            ? `
              <strong>
                ${esc(result.thuisPunten)}
                –
                ${esc(result.uitPunten)}
              </strong>
            `
            : '<strong>–</strong>'
        }

        <span>${esc(match.uitploeg)}</span>
      </div>

      ${
        match.lokaal
          ? `<div class="calendar-meta">${esc(match.lokaal)}</div>`
          : ''
      }
    `;

    if (result?.ontmoetingId) {
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const openDetail = () =>
        openMatchDetail(
          division,
          match.speelweek,
          result.ontmoetingId,
          'series'
        );

      card.addEventListener('click', openDetail);
      card.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDetail();
        }
      });
    }

    container.appendChild(card);
  });
}

function bindMatchDetail() {
  const backButton =
    document.getElementById('matchDetailBackButton');

  if (!backButton) {
    return;
  }

  backButton.addEventListener('click', () => {
    if (matchDetailReturn === 'calendar') {
      showMainScreen('calendar');
      return;
    }

    if (matchDetailReturn === 'series') {
      const returnSeries = selectedSeries;

      showMainScreen('series').then(() => {
        if (returnSeries) {
          openSeries(returnSeries);
          loadSeriesCalendar(returnSeries);
        }
      });
      return;
    }

    showMainScreen('home');
  });
}


async function openMatchDetail(
  afdeling,
  speelweek,
  ontmoetingId,
  returnTo = 'home'
) {
  if (!ontmoetingId) {
    return;
  }

  matchDetailReturn = returnTo;
  showOnly('matchDetail');

  const description =
    document.getElementById('matchDetailDescription');
  const container =
    document.getElementById('matchDetailContent');

  description.textContent =
    `Afdeling ${afdeling} · Speelweek ${speelweek}`;

  container.innerHTML = `
    <div class="empty-state">
      <strong>Wedstrijd laden...</strong>
    </div>
  `;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  try {
    const response = await fetch(
      `${API_URL}/?type=uitslagen` +
      `&afdeling=${encodeURIComponent(afdeling)}` +
      `&speelweek=${encodeURIComponent(speelweek)}`
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();
    const match = (data.uitslagen || []).find(
      item =>
        String(item.ontmoetingId) ===
        String(ontmoetingId)
    );

    if (!match) {
      throw new Error('Ontmoeting niet gevonden');
    }

    renderMatchDetail(container, match);

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        <strong>Wedstrijd kon niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderMatchDetail(container, match) {
  const partijen =
    Array.isArray(match.partijen)
      ? match.partijen
      : [];

  container.innerHTML = `
    <article class="match-detail-hero">
      <div class="match-detail-team">
        ${esc(match.thuisploeg)}
      </div>

      <div class="match-detail-score">
        ${esc(match.thuisPunten)}
        <span>–</span>
        ${esc(match.uitPunten)}
      </div>

      <div class="match-detail-team">
        ${esc(match.uitploeg)}
      </div>
    </article>

    <div class="section-heading match-detail-heading">
      <span class="eyebrow">Wedstrijd</span>
      <h3>Individuele partijen</h3>
    </div>

    <div id="matchDetailGames" class="match-detail-games"></div>
  `;

  const gamesContainer =
    document.getElementById('matchDetailGames');

  if (!partijen.length) {
    gamesContainer.innerHTML = `
      <div class="empty-state">
        <strong>Geen individuele partijen gevonden</strong>
      </div>
    `;
    return;
  }

  partijen.forEach((partij, index) => {
    const card = document.createElement('article');
    card.className = 'match-game-card';

    card.innerHTML = `
      <div class="match-game-top">
  <span class="card-label">Partij ${index + 1}</span>
</div>

      <div class="match-game-versus">
        ${renderMatchDetailPlayer('Thuis', partij.thuis, partij.brt)}
<div class="match-game-vs">VS</div>
${renderMatchDetailPlayer('Uit', partij.uit, partij.brt)}
      </div>
    `;

    gamesContainer.appendChild(card);
  });
}

function renderMatchDetailPlayer(label, player, brt) {
  return `
    <div class="match-game-player">
      <span class="match-game-side">${esc(label)}</span>
      <strong class="match-game-name">${esc(player?.naam || '–')}</strong>

      <div class="match-game-stats">
        <span><small>TSP</small><b>${esc(player?.tsp ?? '–')}</b></span>
        <span><small>GSP</small><b>${esc(player?.gsp ?? '–')}</b></span>
        <span><small>BRT</small><b>${esc(brt ?? '–')}</b></span>
        <span><small>MOY</small><b>${formatMoyenne(player?.moyenne)}</b></span>
        <span><small>HR</small><b>${esc(player?.hr ?? '–')}</b></span>
        <span class="match-game-ptn"><small>PTN</small><b>${formatStandNumber(player?.ptn)}</b></span>
      </div>
    </div>
  `;
}

function openRecords() {
  showOnly('records');

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.nav === 'more'
    );
  });

  renderRecordsSelector();

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


function renderRecordsSelector() {
  const container =
    document.getElementById('recordsContent');

  container.innerHTML = `
    <div class="records-type-tabs">
      <button
        class="records-tab ${selectedRecordType === 'kortste' ? 'active' : ''}"
        id="recordsKortsteButton"
        type="button"
      >
        Kortste wedstrijd
      </button>

      <button
        class="records-tab ${selectedRecordType === 'hoogste' ? 'active' : ''}"
        id="recordsHoogsteButton"
        type="button"
      >
        Hoogste reeks
      </button>
    </div>

    <div id="recordsResults"></div>
  `;

  document
    .getElementById('recordsKortsteButton')
    .addEventListener(
      'click',
      () => {
        selectedRecordType = 'kortste';
        loadRecords('kortste');
      }
    );

  document
    .getElementById('recordsHoogsteButton')
    .addEventListener(
      'click',
      () => {
        selectedRecordType = 'hoogste';
        loadRecords('hoogste');
      }
    );

  loadRecords(selectedRecordType);
}


async function loadRecords(record) {
  selectedRecordType = record;

  document
    .querySelectorAll('.records-tab')
    .forEach(button => {
      button.classList.toggle(
        'active',
        (
          record === 'kortste' &&
          button.id === 'recordsKortsteButton'
        ) ||
        (
          record === 'hoogste' &&
          button.id === 'recordsHoogsteButton'
        )
      );
    });

  const container =
    document.getElementById('recordsResults');

  container.innerHTML = `
    <div class="empty-state">
      <strong>Records laden...</strong>
    </div>
  `;

  try {
    const response = await fetch(
      `${API_URL}/?type=records` +
      `&record=${encodeURIComponent(record)}`
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();

    renderRecords(
      container,
      record,
      data.categorieen || {}
    );

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        <strong>Records konden niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderRecords(
  container,
  record,
  categories
) {
  container.innerHTML = '';

  const title =
    document.createElement('div');

  title.className = 'section-heading records-result-heading';
  title.innerHTML = `
    <span class="eyebrow">Records</span>
    <h3>
      ${
        record === 'kortste'
          ? 'Kortste wedstrijd'
          : 'Hoogste reeks'
      }
    </h3>
  `;

  container.appendChild(title);

  const categoryNames =
    ['13-19', '21-28', '32-100'];

  if (!categoryNames.includes(selectedRecordCategory)) {
    selectedRecordCategory = '13-19';
  }

  const categoryTabs =
    document.createElement('div');

  categoryTabs.className =
    'records-category-tabs';

  categoryTabs.innerHTML =
    categoryNames.map(category => `
      <button
        class="records-category-tab ${selectedRecordCategory === category ? 'active' : ''}"
        data-record-category="${esc(category)}"
        type="button"
      >
        ${esc(category)}
      </button>
    `).join('');

  container.appendChild(categoryTabs);

  const categoryContent =
    document.createElement('div');

  categoryContent.className =
    'records-category-content';

  container.appendChild(categoryContent);

  const renderCategory = category => {
    selectedRecordCategory = category;

    categoryTabs
      .querySelectorAll('[data-record-category]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.recordCategory === category
        );
      });

    categoryContent.innerHTML = '';

    const rows =
      Array.isArray(categories[category])
        ? categories[category]
        : [];

    const section =
      document.createElement('section');

    section.className =
      'dashboard-card records-category-card';

    const heading =
      document.createElement('div');

    heading.className = 'card-heading';
    heading.innerHTML = `
      <div>
        <span class="card-label">TSP-categorie</span>
        <h3>${esc(category)}</h3>
      </div>
    `;

    section.appendChild(heading);

    if (!rows.length) {
      section.insertAdjacentHTML(
        'beforeend',
        `
          <div class="empty-state compact">
            <strong>Geen records gevonden</strong>
          </div>
        `
      );

      categoryContent.appendChild(section);
      return;
    }

    const table =
      document.createElement('div');

    table.className = 'records-table';

    const header =
      document.createElement('div');

    header.className =
      'records-row records-header';

    if (record === 'kortste') {
      header.innerHTML = `
        <span>#</span>
        <span>Speler</span>
        <span>GSP</span>
        <span>BRT</span>
        <span>MOY</span>
      `;
    } else {
      header.innerHTML = `
        <span>#</span>
        <span>Speler</span>
        <span>PERC</span>
        <span>HR</span>
        <span>TSP</span>
      `;
    }

    table.appendChild(header);

    rows.forEach(row => {
      const element =
        document.createElement('div');

      element.className =
        'records-row';

      if (record === 'kortste') {
        element.innerHTML = `
          <span>${esc(row.positie)}</span>
          <span>
            <strong>${esc(row.naam)}</strong>
            <small>
              ${esc(row.datum)}
              · Afd. ${esc(row.afdeling)}
              · ${esc(row.ploeg)}
            </small>
          </span>
          <span>${esc(row.gsp)}</span>
          <span>${esc(row.brt)}</span>
          <span>${esc(row.moyenne)}</span>
        `;
      } else {
        element.innerHTML = `
          <span>${esc(row.positie)}</span>
          <span>
            <strong>${esc(row.naam)}</strong>
            <small>
              ${esc(row.datum)}
              · Afd. ${esc(row.afdeling)}
              · ${esc(row.ploeg)}
            </small>
          </span>
          <span>${esc(row.percentage)}%</span>
          <span>${esc(row.hr)}</span>
          <span>${esc(row.tsp)}</span>
        `;
      }

      table.appendChild(element);
    });

    section.appendChild(table);
    categoryContent.appendChild(section);
  };

  categoryTabs
    .querySelectorAll('[data-record-category]')
    .forEach(button => {
      button.addEventListener('click', () => {
        renderCategory(
          button.dataset.recordCategory
        );
      });
    });

  renderCategory(selectedRecordCategory);
}

function openPlayerStats(player = currentPlayer) {
  viewedPlayer = player || currentPlayer;
  showOnly('playerStats');

  document.querySelectorAll('.nav-item').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.nav === 'more'
    );
  });

  loadPlayerStats(viewedPlayer);

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}


function openOtherPlayerStats(player) {
  if (!player) {
    return;
  }

  openPlayerStats(player);
}


async function loadPlayerStats(profilePlayer = currentPlayer) {
  const container =
    document.getElementById('playerStatsContent');

  if (!container || !profilePlayer) {
    return;
  }

  container.innerHTML = `
    <div class="empty-state">
      <strong>Persoonlijke statistieken laden...</strong>
    </div>
  `;

  try {
    const response = await fetch(
      `${API_URL}/?type=speler` +
      `&spelerId=${encodeURIComponent(profilePlayer.id)}`
    );

    if (!response.ok) {
      throw new Error(response.status);
    }

    const data = await response.json();

    const historyResponse = await fetch(
      `${API_URL}/?type=speler-historiek` +
      `&spelerId=${encodeURIComponent(profilePlayer.id)}`
    );

    if (!historyResponse.ok) {
      throw new Error(historyResponse.status);
    }

    const historyData = await historyResponse.json();

    renderPlayerStats(container, data, historyData, profilePlayer);

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        <strong>Persoonlijke statistieken konden niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderPlayerStats(container, data, historyData, profilePlayer = currentPlayer) {
  const summary = data.samenvatting || {};
  const matches =
    Array.isArray(data.wedstrijden)
      ? data.wedstrijden
      : [];

  container.innerHTML = `
    <article class="dashboard-card">
      <div class="card-heading">
        <div>
          <span class="card-label">Huidig seizoen</span>
          <h3>${esc(data.naam || profilePlayer?.naam || '')}</h3>
        </div>
      </div>

      <div class="player-stats-summary">
        <div>
          <span>Wedstrijden</span>
          <strong>${esc(data.aantalWedstrijden ?? matches.length)}</strong>
        </div>
        <div>
          <span>Winst</span>
          <strong>${esc(summary.gewonnen ?? 0)}</strong>
        </div>
        <div>
          <span>Gelijk</span>
          <strong>${esc(summary.gelijk ?? 0)}</strong>
        </div>
        <div>
          <span>Verlies</span>
          <strong>${esc(summary.verloren ?? 0)}</strong>
        </div>
        <div>
          <span>Gem. moyenne</span>
          <strong>${formatMoyenne(summary.gemiddeldeMoyenne)}</strong>
        </div>
        <div>
          <span>Beste moyenne</span>
          <strong>${formatMoyenne(summary.hoogsteMoyenne)}</strong>
        </div>
        <div>
          <span>Hoogste reeks</span>
          <strong>${esc(summary.hoogsteReeks ?? '–')}</strong>
        </div>
        <div>
          <span>ADL-punten</span>
          <strong>${formatStandNumber(summary.totaalPtn)}</strong>
        </div>
      </div>
    </article>

    <div class="section-heading">
      <span class="eyebrow">Carrière</span>
      <h3>Persoonlijke records</h3>
    </div>

    <div id="playerStatsRecords"></div>

    <div class="section-heading">
      <span class="eyebrow">Carrière</span>
      <h3>TSP</h3>
    </div>

    <div id="playerStatsTsp"></div>

    <div class="section-heading">
      <span class="eyebrow">Carrière</span>
      <h3>Historiek per seizoen</h3>
    </div>

    <div id="playerStatsHistory"></div>

    <div class="section-heading">
      <span class="eyebrow">Carrière</span>
      <h3>TSP-wijzigingen</h3>
    </div>

    <div id="playerStatsTspChanges"></div>

    <div class="section-heading">
      <span class="eyebrow">Wedstrijden</span>
      <h3>Gespeelde partijen</h3>
    </div>

    <div id="playerStatsMatches"></div>
  `;

  renderPlayerStatsRecords(
    document.getElementById('playerStatsRecords'),
    historyData?.records || {}
  );

  renderPlayerStatsTsp(
    document.getElementById('playerStatsTsp'),
    historyData?.tsp || {}
  );

  renderPlayerStatsHistory(
    document.getElementById('playerStatsHistory'),
    historyData?.seizoenen || []
  );

  renderPlayerStatsTspChanges(
    document.getElementById('playerStatsTspChanges'),
    historyData?.tspWijzigingen || []
  );

  const matchesContainer =
    document.getElementById('playerStatsMatches');

  if (!matches.length) {
    matchesContainer.innerHTML = `
      <div class="empty-state">
        <strong>Nog geen gespeelde partijen gevonden</strong>
      </div>
    `;
    return;
  }

  matches.forEach(match => {
    const card = document.createElement('article');
    card.className = 'dashboard-card player-stats-match';

    const result =
      Number(match.bonus) === 1
        ? 'Winst'
        : Number(match.bonus) === 0.5
          ? 'Gelijk'
          : 'Verlies';

    card.innerHTML = `
      <div class="card-heading">
        <div>
          <span class="card-label">
            ${formatDate(match.datum)} · Speelweek ${esc(match.speelweek)}
          </span>
          <h3>${esc(match.tegenstander || 'Tegenstander onbekend')}</h3>
        </div>
        <strong>${result}</strong>
      </div>

      <p class="muted">
        ${match.thuis ? 'Thuis' : 'Uit'}
        · ${esc(match.thuisploeg)}
        tegen
        ${esc(match.uitploeg)}
      </p>

      <div class="player-stats-summary">
        <div>
          <span>TSP</span>
          <strong>${esc(match.tspWedstrijd)}</strong>
        </div>
        <div>
          <span>PTN</span>
          <strong>${formatStandNumber(match.ptn)}</strong>
        </div>
        <div>
          <span>GSP</span>
          <strong>${esc(match.gsp)}</strong>
        </div>
        <div>
          <span>BRT</span>
          <strong>${esc(match.brt || '–')}</strong>
        </div>
        <div>
          <span>MOY</span>
          <strong>${formatMoyenne(match.moyenne)}</strong>
        </div>
        <div>
          <span>HR</span>
          <strong>${esc(match.hr)}</strong>
        </div>
      </div>
    `;

    matchesContainer.appendChild(card);
  });
}


function renderPlayerStatsRecords(container, records) {
  if (!container) {
    return;
  }

  const hoogsteReeks = records?.hoogsteReeks;
  const kortste = records?.kortsteWedstrijd;
  const hoogsteMoyenne = records?.hoogsteMoyenne;

  container.innerHTML = `
    <article class="dashboard-card">
      <div class="player-stats-summary">
        <div>
          <span>Hoogste reeks</span>
          <strong>${esc(hoogsteReeks?.waarde ?? '–')}</strong>
          <small>
            ${hoogsteReeks?.datum ? formatDate(hoogsteReeks.datum) : ''}
          </small>
        </div>

        <div>
          <span>Kortste wedstrijd</span>
          <strong>
            ${kortste?.waarde !== undefined && kortste?.waarde !== null
              ? `${esc(kortste.waarde)} brt`
              : '–'}
          </strong>
          <small>
            ${kortste?.datum ? formatDate(kortste.datum) : ''}
          </small>
        </div>

        <div>
          <span>Hoogste moyenne</span>
          <strong>${formatMoyenne(hoogsteMoyenne?.waarde)}</strong>
          <small>
            ${hoogsteMoyenne?.datum ? formatDate(hoogsteMoyenne.datum) : ''}
          </small>
        </div>
      </div>
    </article>
  `;
}


function renderPlayerStatsTsp(container, tsp) {
  if (!container) {
    return;
  }

  container.innerHTML = `
    <article class="dashboard-card">
      <div class="player-stats-summary">
        ${renderTspStat('Huidig', tsp?.huidig)}
        ${renderTspStat('Hoogste', tsp?.hoogste)}
        ${renderTspStat('Laagste', tsp?.laagste)}
      </div>
    </article>
  `;
}


function renderTspStat(label, item) {
  return `
    <div>
      <span>${esc(label)}</span>
      <strong>${esc(item?.waarde ?? '–')}</strong>
      <small>
        ${item?.datum ? formatDate(item.datum) : ''}
      </small>
    </div>
  `;
}


function renderPlayerStatsTspChanges(container, changes) {
  if (!container) {
    return;
  }

  if (!Array.isArray(changes) || !changes.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen TSP-wijzigingen gevonden</strong>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  [...changes].reverse().forEach(change => {
    const card = document.createElement('article');
    card.className = 'dashboard-card';

    card.innerHTML = `
      <div class="card-heading">
        <div>
          <span class="card-label">
            ${change.datum ? formatDate(change.datum) : 'Datum onbekend'}
          </span>
          <h3>
            TSP ${esc(change.oud ?? '–')}
            →
            ${esc(change.nieuw ?? '–')}
          </h3>
        </div>
      </div>

      ${
        change.opmerking
          ? `<p class="muted">${esc(change.opmerking)}</p>`
          : ''
      }
    `;

    container.appendChild(card);
  });
}


function renderPlayerStatsHistory(container, seasons) {
  if (!container) {
    return;
  }

  if (!Array.isArray(seasons) || !seasons.length) {
    container.innerHTML = `
      <div class="empty-state">
        <strong>Geen carrièrehistoriek gevonden</strong>
      </div>
    `;
    return;
  }

  const table = document.createElement('div');
  table.className = 'player-history-table';

  table.innerHTML = `
    <div class="player-history-row player-history-header">
      <span>Seizoen</span>
      <span>TSP</span>
      <span>MOY</span>
      <span>Wed.</span>
      <span>W</span>
      <span>V</span>
      <span>G</span>
      <span>ADL</span>
    </div>
  `;

  [...seasons].reverse().forEach(season => {
    const row = document.createElement('div');
    row.className = 'player-history-row';

    row.innerHTML = `
      <span><strong>${esc(season.seizoen)}</strong></span>
      <span>${esc(season.tsp)}</span>
      <span>${formatHistoryMoyenne(season.moyenne)}</span>
      <span>${esc(season.wedstrijden)}</span>
      <span>${esc(season.gewonnen)}</span>
      <span>${esc(season.verloren)}</span>
      <span>${esc(season.gelijk)}</span>
      <span>${formatHistoryAdl(season.gemiddeldeAdlPunten)}</span>
    `;

    table.appendChild(row);
  });

  container.innerHTML = '';
  container.appendChild(table);
}


function formatHistoryMoyenne(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '–';
  }

  return number.toLocaleString(
    'nl-BE',
    {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }
  );
}


function formatHistoryAdl(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '–';
  }

  return number.toLocaleString(
    'nl-BE',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}


function formatMoyenne(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '–';
  }

  return number.toLocaleString(
    'nl-BE',
    {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }
  );
}



function bindMoreMenu() {
  searchOtherPlayer.addEventListener(
    'click',
    () => openPlayerSelect('view')
  );

  const recordsButton =
    document.getElementById('recordsButton');

  if (recordsButton) {
    recordsButton.addEventListener(
      'click',
      openRecords
    );
  }

  const recordsBackButton =
    document.getElementById('recordsBackButton');

  if (recordsBackButton) {
    recordsBackButton.addEventListener(
      'click',
      () => showMainScreen('more')
    );
  }

  const playerStatsButton =
    document.getElementById('playerStatsButton');

  if (playerStatsButton) {
    playerStatsButton.addEventListener(
      'click',
      () => openPlayerStats(currentPlayer)
    );
  }

  const playerStatsBackButton =
    document.getElementById('playerStatsBackButton');

  if (playerStatsBackButton) {
    playerStatsBackButton.addEventListener(
      'click',
      () => {
        viewedPlayer = null;
        showMainScreen('more');
      }
    );
  }

const venuesButton =
  document.getElementById('venuesButton');

if (venuesButton) {
  venuesButton.addEventListener(
    'click',
    openVenues
  );
}

const venuesBackButton =
  document.getElementById('venuesBackButton');

if (venuesBackButton) {
  venuesBackButton.addEventListener(
    'click',
    () => showMainScreen('more')
  );
}

  changePlayer.addEventListener(
    'click',
    () => {
      localStorage.removeItem(
        STORAGE_KEY
      );

      currentPlayer = null;

      headerSubtitle.textContent =
        'Competitieoverzicht';

      openPlayerSelect('change');
    }
  );

  document
    .querySelectorAll('[data-coming]')
    .forEach(button => {
      button.addEventListener(
        'click',
        () => {
          alert(
            `${button.dataset.coming} wordt later gekoppeld.`
          );
        }
      );
    });
}

async function openTeamDetail(afdeling, team, returnScreen = 'stand') {
  showOnly('teamDetail');

  teamDetailTitle.textContent = team;
  teamDetailDescription.textContent =
    `Afdeling ${afdeling}`;

  teamDetailContent.innerHTML = `
    <div class="loading-box">
      Ploeggegevens laden...
    </div>
  `;

  teamDetailBackButton.onclick = () => {
  if (returnScreen === 'venues') {
    openVenues();
    return;
  }

  showMainScreen(returnScreen);
};

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  try {
    const response = await fetch(
      `${API_URL}/?type=ploegen` +
      `&afdeling=${encodeURIComponent(afdeling)}`
    );

    if (!response.ok) {
      throw new Error(
        `Ploeggegevens ${response.status}`
      );
    }

    const data = await response.json();

    const ploeg = (data.ploegen || []).find(
      item =>
        normalize(item.team) ===
        normalize(team)
    );

    if (!ploeg) {
      throw new Error(
        `Ploeg niet gevonden: ${team}`
      );
    }

    renderTeamDetail(ploeg);

  } catch (error) {
    console.error(error);

    teamDetailContent.innerHTML = `
      <div class="empty-state">
        <strong>Ploeggegevens konden niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderTeamDetail(ploeg) {
  const kapitein = ploeg.kapitein || null;
  const lokaal = ploeg.lokaal || {};
  const spelers = Array.isArray(ploeg.spelers)
    ? ploeg.spelers
    : [];

  const adres = [
    lokaal.straat,
    [lokaal.postcode, lokaal.gemeente]
      .filter(Boolean)
      .join(' ')
  ]
    .filter(Boolean)
    .join(', ');

  const routeUrl = adres
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`
    : '';

  teamDetailContent.innerHTML = `
    <article class="dashboard-card team-detail-summary">
      <span class="card-label">Ploeg</span>
      <h3>${esc(ploeg.team)}</h3>

      <div class="team-detail-meta">
        <span>
          <small>Afdeling</small>
          <strong>${esc(ploeg.afdeling)}</strong>
        </span>

        <span>
          <small>Speeldag</small>
          <strong>${esc(ploeg.speeldag || '–')}</strong>
        </span>

        <span>
          <small>Uur</small>
          <strong>${esc(ploeg.uur || '–')}</strong>
        </span>
      </div>
    </article>

    <article class="dashboard-card">
      <span class="card-label">Speellokaal</span>
      <h3 class="team-detail-heading">
        ${esc(lokaal.naam || 'Onbekend')}
      </h3>

      ${
        adres
          ? `
            <p class="team-detail-address">
              ${esc(lokaal.straat || '')}<br>
              ${esc(
                [lokaal.postcode, lokaal.gemeente]
                  .filter(Boolean)
                  .join(' ')
              )}
            </p>
          `
          : ''
      }

      ${
        lokaal.telefoon
          ? `
            <a
              class="team-detail-contact"
              href="tel:${esc(
                String(lokaal.telefoon)
                  .replace(/[^\d+]/g, '')
              )}"
            >
              ☎ ${esc(lokaal.telefoon)}
            </a>
          `
          : ''
      }

      ${
        routeUrl
          ? `
            <a
              class="team-detail-route"
              href="${esc(routeUrl)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              Route bekijken
            </a>
          `
          : ''
      }
    </article>

    ${
      kapitein
        ? `
          <article class="dashboard-card">
            <span class="card-label">Kapitein</span>
            <h3 class="team-detail-heading">
              ${esc(kapitein.naam)}
            </h3>

            <div class="team-detail-contact-list">
              ${
                kapitein.gsm
                  ? `
                    <a
                      href="tel:${esc(
                        String(kapitein.gsm)
                          .replace(/[^\d+]/g, '')
                      )}"
                    >
                      ☎ ${esc(kapitein.gsm)}
                    </a>
                  `
                  : ''
              }

              ${
                kapitein.email
                  ? `
                    <a href="mailto:${esc(kapitein.email)}">
                      ✉ ${esc(kapitein.email)}
                    </a>
                  `
                  : ''
              }
            </div>
          </article>
        `
        : ''
    }

    <article class="dashboard-card">
      <div class="team-detail-player-heading">
        <div>
          <span class="card-label">Ploeg</span>
          <h3>Spelers</h3>
        </div>

        <strong>${spelers.length}</strong>
      </div>

      <div class="team-detail-players">
        ${spelers.map(speler => `
          <button
            class="team-detail-player"
            type="button"
            data-team-player-id="${esc(speler.id)}"
          >
            <span>
              <strong>${esc(speler.naam)}</strong>
              ${
                speler.kapitein
                  ? '<small>Kapitein</small>'
                  : ''
              }
            </span>

            <span class="team-player-tsp">
              <small>TSP</small>
              <strong>${esc(speler.tsp)}</strong>
            </span>
          </button>
        `).join('')}
      </div>
    </article>
  `;

  teamDetailContent
    .querySelectorAll('[data-team-player-id]')
    .forEach(button => {
      button.addEventListener('click', () => {
        const speler = spelers.find(
          item =>
            String(item.id) ===
            String(button.dataset.teamPlayerId)
        );

        if (!speler) {
          return;
        }

        openOtherPlayerStats({
          id: speler.id,
          naam: speler.naam,
          tsp: speler.tsp,
          team: ploeg.team,
          afdeling: ploeg.afdeling
        });
      });
    });
}

async function openVenues() {
  showOnly('venues');

  const container =
    document.getElementById('venuesContent');

  container.innerHTML = `
    <div class="loading-box">
      Speellokalen laden...
    </div>
  `;

  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });

  try {
    const afdelingen =
      ['A', 'B', 'C', 'D', 'E'];

    const resultaten =
      await Promise.all(
        afdelingen.map(async afdeling => {
          const response = await fetch(
            `${API_URL}/?type=ploegen` +
            `&afdeling=${encodeURIComponent(afdeling)}`
          );

          if (!response.ok) {
            throw new Error(
              `Afdeling ${afdeling}: ${response.status}`
            );
          }

          return response.json();
        })
      );

    const ploegen =
      resultaten.flatMap(data =>
        data.ploegen || []
      );

    renderVenues(
      container,
      ploegen
    );

  } catch (error) {
    console.error(error);

    container.innerHTML = `
      <div class="empty-state">
        <strong>Speellokalen konden niet geladen worden</strong>
        <p>Probeer het later opnieuw.</p>
      </div>
    `;
  }
}


function renderVenues(container, ploegen) {
  const afdelingen =
    ['A', 'B', 'C', 'D', 'E'];

  container.innerHTML = `
    <div class="segmented venues-segments">
      ${afdelingen.map((afdeling, index) => `
        <button
          class="segment ${index === 0 ? 'active' : ''}"
          type="button"
          data-venue-division="${afdeling}"
        >
          ${afdeling}
        </button>
      `).join('')}
    </div>

    <div id="venuesList"></div>
  `;

  const list =
    document.getElementById('venuesList');

  const showDivision = afdeling => {
    container
      .querySelectorAll('[data-venue-division]')
      .forEach(button => {
        button.classList.toggle(
          'active',
          button.dataset.venueDivision === afdeling
        );
      });

    const afdelingPloegen =
      ploegen.filter(
        ploeg =>
          String(ploeg.afdeling) === afdeling
      );

    list.innerHTML = '';

    afdelingPloegen.forEach(ploeg => {
      const lokaal =
        ploeg.lokaal || {};

      const adres =
        [
          lokaal.straat,
          [
            lokaal.postcode,
            lokaal.gemeente
          ]
            .filter(Boolean)
            .join(' ')
        ]
          .filter(Boolean)
          .join(', ');

      const card =
        document.createElement('article');

      card.className =
        'dashboard-card venue-card';

      card.innerHTML = `
        <button
          class="venue-team-button"
          type="button"
        >
          <span class="card-label">
            Afdeling ${esc(ploeg.afdeling)}
          </span>

          <strong>
            ${esc(ploeg.team)}
          </strong>

          <span class="venue-arrow">›</span>
        </button>

        <div class="venue-info">
          <h3>
            ${esc(lokaal.naam || 'Onbekend lokaal')}
          </h3>

          ${
            adres
              ? `
                <p>
                  ${esc(lokaal.straat || '')}<br>
                  ${esc(
                    [
                      lokaal.postcode,
                      lokaal.gemeente
                    ]
                      .filter(Boolean)
                      .join(' ')
                  )}
                </p>
              `
              : ''
          }

          <div class="venue-meta">
            <span>
              ${esc(ploeg.speeldag || '–')}
            </span>

            <span>
              ${esc(ploeg.uur || '–')}
            </span>
          </div>
        </div>

        <div class="venue-actions">
          ${
            lokaal.telefoon
              ? `
                <a
                  href="tel:${esc(
                    String(lokaal.telefoon)
                      .replace(/[^\d+]/g, '')
                  )}"
                >
                  Bellen
                </a>
              `
              : ''
          }

          ${
            adres
              ? `
                <a
                  href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Route
                </a>
              `
              : ''
          }
        </div>
      `;

      card
        .querySelector('.venue-team-button')
        .addEventListener('click', () => {
          openTeamDetail(
            ploeg.afdeling,
            ploeg.team,
            'venues'
          );
        });

      list.appendChild(card);
    });
  };

  container
    .querySelectorAll('[data-venue-division]')
    .forEach(button => {
      button.addEventListener('click', () => {
        showDivision(
          button.dataset.venueDivision
        );
      });
    });

  showDivision('A');
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener(
      'load',
      () => {
        navigator.serviceWorker
          .register('./sw.js')
          .catch(error => {
            console.error(
              'Service worker kon niet geregistreerd worden:',
              error
            );
          });
      }
    );
  }
}
    