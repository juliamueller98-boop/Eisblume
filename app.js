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
  if (label) label.textContent = currentUser === 'frost' ? 'Frost' : 'Blume';
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
  if (name === 'categories') updateCategoryCounts();
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

function updateCategoryCounts() {
  if (!currentUser) return;
  const votes = getVotes(currentUser);
  const categories = ['nestwaerme', 'hamburg', 'fluchten'];

  categories.forEach(cat => {
    const total = dates.filter(d => d.kategorie === cat).length;
    const open = dates.filter(d => d.kategorie === cat && !votes[d.id]).length;
    const el = document.querySelector(`[data-count="${cat}"]`);
    if (el) el.textContent = open + ' von ' + total;
  });

  const allTotal = dates.length;
  const allOpen = dates.filter(d => !votes[d.id]).length;
  const allEl = document.querySelector('[data-count="all"]');
  if (allEl) allEl.textContent = allOpen + ' von ' + allTotal;
}

// ============================================
// Swipe View
// ============================================

function getDeckForCategory(category) {
  const votes = getVotes(currentUser);
  const pool = category === 'all'
    ? dates
    : dates.filter(d => d.kategorie === category);
  return pool.filter(d => !votes[d.id]);
}

function startSwipeFor(category) {
  currentCategory = category;
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
    <div class="swipe-card__stamp swipe-card__stamp--nope">Nope</div>
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
  const empty = document.getElementById('matches-empty');
  const matches = getMatches();

  list.innerHTML = '';

  if (matches.length === 0) {
    empty.classList.remove('hidden');
    list.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.classList.remove('hidden');

  matches.forEach(date => {
    const done = isDone(date.id);
    const item = document.createElement('div');
    item.className = 'match-item';
    item.innerHTML = `
      <div class="match-item__emoji">${date.emoji}</div>
      <div class="match-item__body">
        <div class="match-item__title">${date.titel}</div>
        <div class="match-item__desc">${date.beschreibung}</div>
      </div>
      <button class="match-item__action ${done ? 'done' : ''}" data-id="${date.id}" title="Schon gemacht">
        ${done ? '✓' : '○'}
      </button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.match-item__action').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleDone(btn.dataset.id);
      renderMatches();
    });
  });
}

// ============================================
// Overview View
// ============================================

let overviewFilter = 'all';

function renderOverview() {
  const list = document.getElementById('overview-list');
  const blume = getVotes('blume');
  const frost = getVotes('frost');

  let filtered = dates.slice();

  if (overviewFilter === 'match') {
    filtered = filtered.filter(d => blume[d.id] === 'like' && frost[d.id] === 'like');
  } else if (overviewFilter === 'done') {
    const done = getDone();
    filtered = filtered.filter(d => done.includes(d.id));
  } else if (overviewFilter === 'open') {
    filtered = filtered.filter(d => !blume[d.id] || !frost[d.id]);
  }

  list.innerHTML = '';

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><p class="empty-state__emoji">🌷</p><p class="empty-state__text">Hier ist gerade nichts.</p></div>';
    return;
  }

  filtered.forEach(date => {
    const isMatch = blume[date.id] === 'like' && frost[date.id] === 'like';
    const done = isDone(date.id);
    const item = document.createElement('div');
    item.className = 'overview-item';

    const tags = [];
    tags.push(`<span class="overview-item__tag tag-cat-${date.kategorie}">${CATEGORY_LABELS[date.kategorie]}</span>`);
    if (isMatch) tags.push('<span class="overview-item__tag tag-status-match">Match</span>');
    if (done) tags.push('<span class="overview-item__tag tag-status-done">Gemacht</span>');

    item.innerHTML = `
      <div class="overview-item__emoji">${date.emoji}</div>
      <div class="overview-item__body">
        <div class="overview-item__title">${date.titel}</div>
        <div class="overview-item__meta">${tags.join('')}</div>
      </div>
      <button class="overview-item__toggle ${done ? 'done' : ''}" data-id="${date.id}" title="Schon gemacht?">
        ${done ? '✓' : '○'}
      </button>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.overview-item__toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      toggleDone(btn.dataset.id);
      renderOverview();
    });
  });
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

  document.getElementById('btn-like').addEventListener('click', () => triggerButtonVote('like'));
  document.getElementById('btn-nope').addEventListener('click', () => triggerButtonVote('skip'));

  document.getElementById('match-overlay-close').addEventListener('click', hideMatchOverlay);

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      overviewFilter = chip.dataset.filter;
      renderOverview();
    });
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Wirklich alles zurücksetzen? Alle Herzen und Matches gehen verloren.')) {
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
