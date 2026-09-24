const API_URL = 'https://adl2000-api.nicolasmintjens.workers.dev';
const STORAGE_KEY = 'adl2000Player';

const screens = {
  welcome: document.getElementById('welcomeScreen'),
  select: document.getElementById('playerSelectScreen'),
  home: document.getElementById('homeScreen'),
  stand: document.getElementById('standScreen'),
  calendar: document.getElementById('calendarScreen'),
  series: document.getElementById('seriesScreen'),
  more: document.getElementById('moreScreen')
};

const bottomNav = document.getElementById('bottomNav');

let spelers = [];
let currentPlayer = loadSavedPlayer();
let overviewCache = {};
let calendarCache = {};
let calendarMode = 'team';

init();


function init() {
  buildSeriesButtons();
  bindNavigation();
  bindPlayerSearch();
  bindMoreMenu();
  bindCalendarMode();
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
    !['home', 'stand', 'calendar', 'series', 'more'].includes(name);
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
    await loadOverview(true);
  }

  if (name === 'calendar') {
    await loadCalendar();
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
    .addEventListener('click', openPlayerSelect);

  document
    .getElementById('backButton')
    .addEventListener('click', () => {
      if (currentPlayer) {
        showMainScreen('more');
      } else {
        showOnly('welcome');
      }
    });
}


async function openPlayerSelect() {
  showOnly('select');

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
        () => selectPlayer(player)
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
    'stand-table';

  table.innerHTML = `
    <div class="stand-row stand-header">
      <span>#</span>
      <span>Ploeg</span>
      <span>GSP</span>
      <span>Ptn</span>
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

      <span class="stand-points">
        ${esc(row.punten)}
      </span>
    `;

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
      : calendar;

  rows = [...rows].sort(
    (a, b) =>
      String(a.datum).localeCompare(
        String(b.datum)
      )
  );

  const weeks =
    [...new Set(
      rows.map(match => match.speelweek)
    )];

  const results = {};

  const finishedWeeks =
    weeks.filter(week => {
      const match =
        rows.find(
          item => item.speelweek === week
        );

      if (!match?.datum) {
        return false;
      }

      return (
        new Date(
          match.datum + 'T23:59:59'
        ) <= new Date()
      );
    });

  await Promise.all(
    finishedWeeks.map(async week => {
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

  calendarContent.innerHTML = '';

  if (!rows.length) {
    calendarContent.innerHTML = `
      <div class="empty-state">
        <strong>Geen wedstrijden gevonden</strong>
      </div>
    `;

    return;
  }

  let lastWeek = null;

  rows.forEach(match => {
    if (match.speelweek !== lastWeek) {
      const heading =
        document.createElement('div');

      heading.className =
        'week-heading';

      heading.textContent =
        `Speelweek ${match.speelweek}`;

      calendarContent.appendChild(
        heading
      );

      lastWeek =
        match.speelweek;
    }

    const result =
      results[
        String(match.ontmoetingId)
      ];

    const card =
      document.createElement('article');

    card.className =
      'calendar-match';

    if (
      normalize(match.thuisploeg) === normalize(currentPlayer.team) ||
      normalize(match.uitploeg) === normalize(currentPlayer.team)
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
  const grid =
    document.getElementById('seriesGrid');

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
        () => {
          alert(
            `Afdeling ${division}: bekijken zonder je speler te wijzigen voegen we in de volgende stap toe.`
          );
        }
      );

      grid.appendChild(button);
    });
}


function bindMoreMenu() {
  searchOtherPlayer.addEventListener(
    'click',
    openPlayerSelect
  );

  changePlayer.addEventListener(
    'click',
    () => {
      localStorage.removeItem(
        STORAGE_KEY
      );

      currentPlayer = null;

      headerSubtitle.textContent =
        'Competitieoverzicht';

      openPlayerSelect();
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
