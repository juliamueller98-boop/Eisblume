/* ============================================
   EISBLUME — App Logic
   ============================================ */

const STORAGE = {
  votesBlume: 'eisblume.votes.blume',
  votesFrost: 'eisblume.votes.frost',
  done: 'eisblume.done',
  user: 'eisblume.current-user'
};

const CATEGORY_LABELS = {
  nestwaerme: 'Nestwärme',
  hamburg: 'Hamburger Herzstücke',
  fluchten: 'Kleine Fluchten',
  all: 'Alle Ideen'
};

let dates = [];
let currentUser = null;
let currentCategory = null;
let currentCard = null;
let dragState = null;
let allCategoryOrder = null; // gemischte Reihenfolge für "Alle"
let showDoneMatches = false;

function shuffleArray(arr) {
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================
// Storage helpers
// ============================================

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getVotes(user) {
  const key = user === 'frost' ? STORAGE.votesFrost : STORAGE.votesBlume;
  return readJSON(key, {});
}

function saveVote(user, dateId, vote) {
  const votes = getVotes(user);
  votes[dateId] = vote;
  const key = user === 'frost' ? STORAGE.votesFrost : STORAGE.votesBlume;
  writeJSON(key, votes);
}

function deleteVote(user, dateId) {
  const votes = getVotes(user);
  delete votes[dateId];
  const key = user === 'frost' ? STORAGE.votesFrost : STORAGE.votesBlume;
  writeJSON(key, votes);
}

function getDone() {
  return readJSON(STORAGE.done, []);
}

function isDone(dateId) {
  return getDone().includes(dateId);
}

function toggleDone(dateId) {
  const done = getDone();
  const idx = done.indexOf(dateId);
  if (idx >= 0) done.splice(idx, 1);
  else done.push(dateId);
  writeJSON(STORAGE.done, done);
}

function getMatches() {
  const blume = getVotes('blume');
  const frost = getVotes('frost');
  return dates.filter(d => blume[d.id] === 'like' && frost[d.id] === 'like');
}

function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem(STORAGE.user, user);
  updateUserUI();
}

function updateUserUI() {
  const label = document.getElementById('current-user-label');
  if (label) label.textContent = currentUser === 'frost' ? 'Eis' : 'Blume';
  const greeting = document.getElementById('menu-greeting');
  if (greeting) {
    const name = currentUser === 'frost' ? 'Konsti' : 'Laura';
    greeting.textContent = `Hallo ${name}!`;
  }
}

// ============================================
// View switching
// ============================================

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + name);
  if (view) view.classList.add('active');
  window.scrollTo(0, 0);

  if (name === 'menu') updateMenuCounts();
  if (name === 'matches') renderMatches();
  if (name === 'overview') renderOverview();
}

// ============================================
// Menu
// ============================================

function updateMenuCounts() {
  const matches = getMatches().length;
  const badge = document.getElementById('matches-count');
  if (badge) {
    badge.textContent = matches;
    badge.dataset.empty = matches === 0 ? 'true' : 'false';
  }
}

// ============================================
// Swipe View
// ============================================

function getDeckForCategory(category) {
  const votes = getVotes(currentUser);
  if (category === 'all') {
    if (!allCategoryOrder) {
      allCategoryOrder = shuffleArray(dates).map(d => d.id);
    }
    return allCategoryOrder
      .map(id => dates.find(d => d.id === id))
      .filter(d => d && !votes[d.id]);
  }
  return dates.filter(d => d.kategorie === category && !votes[d.id]);
}

function startSwipeFor(category) {
  currentCategory = category;
  if (category === 'all') {
    // immer neu mischen wenn man "Alle" startet
    allCategoryOrder = shuffleArray(dates).map(d => d.id);
  } else {
    allCategoryOrder = null;
  }
  document.getElementById('swipe-title').textContent = CATEGORY_LABELS[category];
  showView('swipe');
  renderNextCard();
}

function renderNextCard() {
  const stage = document.getElementById('swipe-stage');
  const empty = document.getElementById('swipe-empty');
  const actions = document.getElementById('swipe-actions');

  stage.innerHTML = '';
  currentCard = null;

  const deck = getDeckForCategory(currentCategory);

  if (deck.length === 0) {
    stage.classList.add('hidden');
    empty.classList.remove('hidden');
    actions.classList.add('hidden');
    return;
  }

  stage.classList.remove('hidden');
  empty.classList.add('hidden');
  actions.classList.remove('hidden');

  // Render up to 2 cards stacked for visual depth
  const next = deck[1];
  if (next) {
    const bgCard = buildCard(next, true);
    bgCard.style.transform = 'scale(0.95) translateY(8px)';
    bgCard.style.opacity = '0.5';
    bgCard.style.pointerEvents = 'none';
    stage.appendChild(bgCard);
  }

  const topCard = buildCard(deck[0], false);
  stage.appendChild(topCard);
  currentCard = topCard;
  attachSwipe(topCard, deck[0]);
}

function buildCard(date, isBg) {
  const card = document.createElement('div');
  card.className = 'swipe-card swipe-card--' + date.kategorie;
  card.dataset.id = date.id;
  card.innerHTML = `
    <div class="swipe-card__stamp swipe-card__stamp--like">Herz</div>
    <div class="swipe-card__stamp swipe-card__stamp--nope">Später</div>
    <div class="swipe-card__category">${CATEGORY_LABELS[date.kategorie]}</div>
    <div class="swipe-card__emoji">${date.emoji}</div>
    <h2 class="swipe-card__title">${date.titel}</h2>
    <p class="swipe-card__desc">${date.beschreibung}</p>
  `;
  return card;
}

function attachSwipe(card, date) {
  card.addEventListener('pointerdown', e => onDragStart(e, card, date));
  card.addEventListener('pointermove', onDragMove);
  card.addEventListener('pointerup', e => onDragEnd(e, card, date));
  card.addEventListener('pointercancel', e => onDragEnd(e, card, date));
}

function onDragStart(e, card, date) {
  if (!card || dragState) return;
  card.setPointerCapture(e.pointerId);
  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    currentX: 0,
    pointerId: e.pointerId,
    card,
    date
  };
  card.classList.add('dragging');
}

function onDragMove(e) {
  if (!dragState || dragState.pointerId !== e.pointerId) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  dragState.currentX = dx;
  const rotation = dx / 20;
  dragState.card.style.transform = `translate(${dx}px, ${dy * 0.4}px) rotate(${rotation}deg)`;

  const likeStamp = dragState.card.querySelector('.swipe-card__stamp--like');
  const nopeStamp = dragState.card.querySelector('.swipe-card__stamp--nope');
  if (dx > 30) {
    likeStamp.style.opacity = Math.min(1, dx / 100);
    nopeStamp.style.opacity = 0;
  } else if (dx < -30) {
    nopeStamp.style.opacity = Math.min(1, -dx / 100);
    likeStamp.style.opacity = 0;
  } else {
    likeStamp.style.opacity = 0;
    nopeStamp.style.opacity = 0;
  }
}

function onDragEnd(e, card, date) {
  if (!dragState) return;
  const dx = dragState.currentX;
  const threshold = 80;
  dragState.card.classList.remove('dragging');

  if (dx > threshold) {
    flyAway(card, date, 'like');
  } else if (dx < -threshold) {
    flyAway(card, date, 'skip');
  } else {
    card.classList.add('snap-back');
    card.style.transform = '';
    card.querySelector('.swipe-card__stamp--like').style.opacity = 0;
    card.querySelector('.swipe-card__stamp--nope').style.opacity = 0;
    setTimeout(() => card.classList.remove('snap-back'), 300);
  }
  dragState = null;
}

function flyAway(card, date, action) {
  card.classList.add(action === 'like' ? 'fly-right' : 'fly-left');
  saveVote(currentUser, date.id, action);

  setTimeout(() => {
    if (action === 'like' && isMatchFor(date.id)) {
      showMatchOverlay(date);
    } else {
      renderNextCard();
    }
  }, 350);
}

function isMatchFor(dateId) {
  const blume = getVotes('blume');
  const frost = getVotes('frost');
  return blume[dateId] === 'like' && frost[dateId] === 'like';
}

function triggerButtonVote(action) {
  if (!currentCard || dragState) return;
  const dateId = currentCard.dataset.id;
  const date = dates.find(d => d.id === dateId);
  if (!date) return;
  flyAway(currentCard, date, action);
}

function reactivateSkipped() {
  // Remove all 'skip' votes for current user in current category
  const votes = getVotes(currentUser);
  let changed = false;
  for (const id in votes) {
    if (votes[id] === 'skip') {
      const date = dates.find(d => d.id === id);
      if (!date) continue;
      if (currentCategory === 'all' || date.kategorie === currentCategory) {
        delete votes[id];
        changed = true;
      }
    }
  }
  if (changed) {
    const key = currentUser === 'frost' ? STORAGE.votesFrost : STORAGE.votesBlume;
    writeJSON(key, votes);
  }
  renderNextCard();
}

// ============================================
// Match Overlay
// ============================================

function showMatchOverlay(date) {
  const overlay = document.getElementById('match-overlay');
  document.getElementById('match-overlay-title').textContent = date.titel;
  overlay.classList.remove('hidden');
}

function hideMatchOverlay() {
  document.getElementById('match-overlay').classList.add('hidden');
  renderNextCard();
}

// ============================================
// Matches View
// ============================================

function renderMatches() {
  const list = document.getElementById('match-list');
  const listDone = document.getElementById('match-list-done');
  const empty = document.getElementById('matches-empty');
  const toggle = document.getElementById('done-toggle');
  const toggleLabel = document.getElementById('done-toggle-label');

  const allMatches = getMatches();
  const open = allMatches.filter(d => !isDone(d.id));
  const done = allMatches.filter(d => isDone(d.id));

  list.innerHTML = '';
  listDone.innerHTML = '';

  // Komplett leer?
  if (allMatches.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    listDone.classList.add('hidden');
    toggle.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');

  // Offene Matches
  if (open.length === 0) {
    list.classList.add('hidden');
  } else {
    list.classList.remove('hidden');
    open.forEach(date => list.appendChild(buildMatchItem(date, false)));
  }

  // Done Toggle
  if (done.length === 0) {
    toggle.classList.add('hidden');
    listDone.classList.add('hidden');
  } else {
    toggle.classList.remove('hidden');
    toggleLabel.textContent = showDoneMatches
      ? `Bereits gemachte ausblenden (${done.length})`
      : `Bereits gemachte zeigen (${done.length})`;

    if (showDoneMatches) {
      toggle.classList.add('expanded');
      listDone.classList.remove('hidden');
      done.forEach(date => listDone.appendChild(buildMatchItem(date, true)));
    } else {
      toggle.classList.remove('expanded');
      listDone.classList.add('hidden');
    }
  }
}

function buildMatchItem(date, isDoneItem) {
  const item = document.createElement('div');
  item.className = 'match-item';
  item.innerHTML = `
    <div class="match-item__emoji">${date.emoji}</div>
    <div class="match-item__body">
      <div class="match-item__title">${date.titel}</div>
      <div class="match-item__desc">${date.beschreibung}</div>
    </div>
    <button class="match-item__action ${isDoneItem ? 'done' : ''}" data-id="${date.id}" title="${isDoneItem ? 'Wieder als offen markieren' : 'Schon gemacht'}">
      ${isDoneItem ? '✓' : '○'}
    </button>
  `;
  const btn = item.querySelector('.match-item__action');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    toggleDone(date.id);
    renderMatches();
  });
  // Karte selbst klickbar
  item.addEventListener('click', () => openDetailOverlay(date));
  return item;
}

// ============================================
// Overview View
// ============================================

let overviewFilter = 'open';

function renderOverview() {
  const list = document.getElementById('overview-list');
  const blume = getVotes('blume');
  const frost = getVotes('frost');
  const done = getDone();

  let filtered = dates.slice();

  if (overviewFilter === 'match') {
    filtered = filtered.filter(d => blume[d.id] === 'like' && frost[d.id] === 'like');
  } else if (overviewFilter === 'done') {
    filtered = filtered.filter(d => done.includes(d.id));
  } else if (overviewFilter === 'open') {
    // "Offen" = noch kein Match (= noch nicht beide ein Herz)
    filtered = filtered.filter(d => !(blume[d.id] === 'like' && frost[d.id] === 'like'));
  }

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p class="empty-state__emoji">🌷</p><p class="empty-state__text">Hier ist gerade nichts.</p></div>';
    return;
  }

  filtered.forEach(date => {
    const isMatch = blume[date.id] === 'like' && frost[date.id] === 'like';
    const isDoneItem = done.includes(date.id);
    const item = document.createElement('div');
    item.className = 'overview-item';

    const tags = [];
    tags.push(`<span class="overview-item__tag tag-cat-${date.kategorie}">${CATEGORY_LABELS[date.kategorie]}</span>`);
    if (isMatch) tags.push('<span class="overview-item__tag tag-status-match">Match</span>');
    if (isDoneItem) tags.push('<span class="overview-item__tag tag-status-done">Gemacht</span>');

    item.innerHTML = `
      <div class="overview-item__emoji">${date.emoji}</div>
      <div class="overview-item__body">
        <div class="overview-item__title">${date.titel}</div>
        <div class="overview-item__meta">${tags.join('')}</div>
      </div>
    `;
    item.addEventListener('click', () => openDetailOverlay(date));
    list.appendChild(item);
  });
}

// ============================================
// Detail Overlay
// ============================================

let currentDetailDate = null;

function openDetailOverlay(date) {
  currentDetailDate = date;
  const overlay = document.getElementById('detail-overlay');
  const category = document.getElementById('detail-category');
  const emoji = document.getElementById('detail-emoji');
  const title = document.getElementById('detail-title');
  const desc = document.getElementById('detail-desc');
  const tags = document.getElementById('detail-tags');
  const action = document.getElementById('detail-toggle-done');

  category.className = 'detail-overlay__category detail-overlay__category--' + date.kategorie;
  category.textContent = CATEGORY_LABELS[date.kategorie];
  emoji.textContent = date.emoji;
  title.textContent = date.titel;
  desc.textContent = date.beschreibung;

  const blume = getVotes('blume');
  const frost = getVotes('frost');
  const isMatch = blume[date.id] === 'like' && frost[date.id] === 'like';
  const isDoneItem = isDone(date.id);

  const tagsHtml = [];
  if (isMatch) tagsHtml.push('<span class="overview-item__tag tag-status-match">Match</span>');
  if (isDoneItem) tagsHtml.push('<span class="overview-item__tag tag-status-done">Gemacht</span>');
  tags.innerHTML = tagsHtml.join('');

  if (isMatch) {
    action.style.display = '';
    action.textContent = isDoneItem ? 'Doch noch nicht gemacht' : 'Schon gemacht';
    action.classList.toggle('is-done', isDoneItem);
  } else {
    action.style.display = 'none';
  }

  overlay.classList.remove('hidden');
}

function closeDetailOverlay() {
  document.getElementById('detail-overlay').classList.add('hidden');
  currentDetailDate = null;
}

function toggleDoneFromDetail() {
  if (!currentDetailDate) return;
  toggleDone(currentDetailDate.id);
  // Detail-Overlay aktualisieren
  openDetailOverlay(currentDetailDate);
  // Listen aktualisieren, damit beim Schließen alles stimmt
  if (document.getElementById('view-matches').classList.contains('active')) {
    renderMatches();
  } else if (document.getElementById('view-overview').classList.contains('active')) {
    renderOverview();
  }
}

// ============================================
// Wiring
// ============================================

function bindNavigation() {
  document.querySelectorAll('[data-go]').forEach(el => {
    el.addEventListener('click', () => showView(el.dataset.go));
  });

  document.querySelectorAll('[data-user]').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentUser(btn.dataset.user);
      showView('menu');
    });
  });

  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.addEventListener('click', () => startSwipeFor(btn.dataset.category));
  });

  document.getElementById('splash-start').addEventListener('click', () => {
    showView('user-select');
  });

  document.getElementById('topbar-user-btn').addEventListener('click', () => {
    showView('user-select');
  });

  document.getElementById('info-btn').addEventListener('click', () => {
    showView('info');
  });

  document.getElementById('btn-like').addEventListener('click', () => triggerButtonVote('like'));
  document.getElementById('btn-nope').addEventListener('click', () => triggerButtonVote('skip'));

  document.getElementById('match-overlay-close').addEventListener('click', hideMatchOverlay);

  document.getElementById('reactivate-skipped').addEventListener('click', reactivateSkipped);

  // Detail Overlay
  document.getElementById('detail-overlay-close').addEventListener('click', closeDetailOverlay);
  document.getElementById('detail-toggle-done').addEventListener('click', toggleDoneFromDetail);
  // Klick auf Backdrop schließt das Overlay
  document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'detail-overlay') closeDetailOverlay();
  });

  // Matches "Bereits gemachte" Toggle
  document.getElementById('done-toggle').addEventListener('click', () => {
    showDoneMatches = !showDoneMatches;
    renderMatches();
  });

  // Info Tabs
  document.querySelectorAll('.info-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.info-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.infoTab;
      document.getElementById('info-how').classList.toggle('hidden', target !== 'how');
      document.getElementById('info-legal').classList.toggle('hidden', target !== 'legal');
    });
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      overviewFilter = chip.dataset.filter;
      renderOverview();
    });
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Wirklich alles zurücksetzen? Alle Herzen, Skips und Matches gehen verloren.')) {
      localStorage.removeItem(STORAGE.votesBlume);
      localStorage.removeItem(STORAGE.votesFrost);
      localStorage.removeItem(STORAGE.done);
      updateMenuCounts();
      alert('Alles zurückgesetzt.');
    }
  });
}

// ============================================
// Init
// ============================================

async function init() {
  try {
    const res = await fetch('dates.json');
    dates = await res.json();
  } catch (e) {
    alert('Datei dates.json konnte nicht geladen werden. Stelle sicher, dass sie im gleichen Ordner liegt.');
    return;
  }

  bindNavigation();

  const savedUser = localStorage.getItem(STORAGE.user);
  if (savedUser) {
    currentUser = savedUser;
    updateUserUI();
  }
}

init();
