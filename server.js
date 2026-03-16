const express = require('express');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'oscar2026';
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Storage (MongoDB in prod, JSON file locally) ─────────────────────────────

let _mongoDb = null;

async function getDb() {
  if (!process.env.MONGODB_URI) return null;
  if (_mongoDb) return _mongoDb;
  try {
    const client = new MongoClient(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    _mongoDb = client.db('oscar_party');
    console.log('Connected to MongoDB');
  } catch (e) {
    console.error('MongoDB connection failed, falling back to file storage:', e.message);
  }
  return _mongoDb;
}

async function readData() {
  const db = await getDb();
  if (db) {
    const doc = await db.collection('state').findOne({ _id: 'main' });
    if (doc) { const { _id, ...data } = doc; return data; }
    // First run: seed from local data.json if it exists
    const seed = fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
      : defaultData();
    await db.collection('state').insertOne({ _id: 'main', ...seed });
    return seed;
  }
  return fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    : defaultData();
}

async function writeData(data) {
  const db = await getDb();
  if (db) {
    await db.collection('state').replaceOne({ _id: 'main' }, { _id: 'main', ...data }, { upsert: true });
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function defaultData() {
  return {
    participantNames: [],
    categories: [
      { id: 'best_picture',      name: 'Best Picture',                    points: 3, nominees: ['Bugonia','F1','Frankenstein','Hamnet','Marty Supreme','One Battle After Another','The Secret Agent','Sentimental Value','Sinners','Train Dreams'], winner: null },
      { id: 'best_director',     name: 'Best Director',                   points: 3, nominees: ['Chloé Zhao (Hamnet)','Josh Safdie (Marty Supreme)','Paul Thomas Anderson (One Battle After Another)','Joachim Trier (Sentimental Value)','Ryan Coogler (Sinners)'], winner: null },
      { id: 'best_actress',      name: 'Best Actress in a Leading Role',  points: 3, nominees: ['Jessie Buckley (Hamnet)',"Rose Byrne (If I Had Legs I'd Kick You)",'Kate Hudson (Song Sung Blue)','Renate Reinsve (Sentimental Value)','Emma Stone (Bugonia)'], winner: null },
      { id: 'best_actor',        name: 'Best Actor in a Leading Role',    points: 3, nominees: ['Timothée Chalamet (Marty Supreme)','Leonardo DiCaprio (One Battle After Another)','Ethan Hawke (Blue Moon)','Michael B. Jordan (Sinners)','Wagner Moura (The Secret Agent)'], winner: null },
      { id: 'best_supp_actress', name: 'Best Supporting Actress',         points: 2, nominees: ['Elle Fanning (Sentimental Value)','Inga Ibsdotter Lilleaas (Sentimental Value)','Amy Madigan (Weapons)','Wunmi Mosaku (Sinners)','Teyana Taylor (One Battle After Another)'], winner: null },
      { id: 'best_supp_actor',   name: 'Best Supporting Actor',           points: 2, nominees: ['Benicio Del Toro (One Battle After Another)','Jacob Elordi (Frankenstein)','Delroy Lindo (Sinners)','Sean Penn (One Battle After Another)','Stellan Skarsgård (Sentimental Value)'], winner: null },
      { id: 'best_casting',      name: 'Best Casting',                    points: 1, nominees: ['Hamnet','Marty Supreme','One Battle After Another','The Secret Agent','Sinners'], winner: null },
      { id: 'best_animated',     name: 'Best Animated Feature Film',      points: 2, nominees: ['Arco','Elio','KPop Demon Hunters','Little Amélie or the Character of Rain','Zootopia 2'], winner: null },
      { id: 'best_intl',         name: 'Best International Feature Film', points: 2, nominees: ['It Was Just an Accident','The Secret Agent','Sentimental Value','Sirât','The Voice of Hind Rajab'], winner: null },
      { id: 'best_documentary',  name: 'Best Documentary Feature Film',   points: 1, nominees: ['The Alabama Solution','Come See Me in the Good Light','Cutting Through Rocks','Mr. Nobody Against Putin','The Perfect Neighbor'], winner: null },
      { id: 'best_doc_short',    name: 'Best Documentary Short Film',     points: 1, nominees: ['All the Empty Rooms','Armed Only With a Camera: The Life and Death of Brent Renaud','Children No More: "Were and Are Gone"','The Devil Is Busy','Perfectly a Strangeness'], winner: null },
      { id: 'best_live_short',   name: 'Best Live Action Short Film',     points: 1, nominees: ["Butcher's Stain",'A Friend of Dorothy',"Jane Austen's Period Drama",'The Singers','Two People Exchanging Saliva'], winner: null },
      { id: 'best_anim_short',   name: 'Best Animated Short Film',        points: 1, nominees: ['Butterfly','Forevergreen','The Girl Who Cried Pearls','Retirement Plan','The Three Sisters'], winner: null },
      { id: 'best_orig_screen',  name: 'Best Original Screenplay',        points: 1, nominees: ['Blue Moon','It Was Just an Accident','Marty Supreme','Sentimental Value','Sinners'], winner: null },
      { id: 'best_adapt_screen', name: 'Best Adapted Screenplay',         points: 1, nominees: ['Bugonia','Frankenstein','Hamnet','One Battle After Another','Train Dreams'], winner: null },
      { id: 'best_cinematog',    name: 'Best Cinematography',             points: 1, nominees: ['Frankenstein','Marty Supreme','One Battle After Another','Sentimental Value','Sinners'], winner: null },
      { id: 'best_editing',      name: 'Best Film Editing',               points: 1, nominees: ['F1','Marty Supreme','One Battle After Another','Sentimental Value','Sinners'], winner: null },
      { id: 'best_score',        name: 'Best Original Score',             points: 1, nominees: ['Bugonia','Frankenstein','Hamnet','One Battle After Another','Sinners'], winner: null },
      { id: 'best_song',         name: 'Best Original Song',              points: 1, nominees: ['"Dear Me" (Diane Warren: Relentless)','"Golden" (KPop Demon Hunters)','"Highest 2 Lowest" (Highest 2 Lowest)','"I Lied To You" (Sinners)','"Sweet Dreams of Joy" (Viva Verdi!)','"Train Dreams" (Train Dreams)'], winner: null },
      { id: 'best_prod_design',  name: 'Best Production Design',          points: 1, nominees: ['Frankenstein','Hamnet','Marty Supreme','One Battle After Another','Sinners'], winner: null },
      { id: 'best_costume',      name: 'Best Costume Design',             points: 1, nominees: ['Avatar: Fire and Ash','Frankenstein','Hamnet','Marty Supreme','Sinners'], winner: null },
      { id: 'best_makeup',       name: 'Best Makeup and Hairstyling',     points: 1, nominees: ['Frankenstein','Kokuho','Sinners','The Smashing Machine','The Ugly Stepsister'], winner: null },
      { id: 'best_sound',        name: 'Best Sound',                      points: 1, nominees: ['F1','Frankenstein','One Battle After Another','Sinners','Sirât'], winner: null },
      { id: 'best_vfx',          name: 'Best Visual Effects',             points: 1, nominees: ['Avatar: Fire and Ash','F1','Jurassic World Rebirth','The Lost Bus','Sinners'], winner: null },
    ],
    picks: {},
    lockedParticipants: [],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function adminAuth(req, res, next) {
  const pw = req.body?.password || req.headers['x-admin-password'];
  if (pw !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  next();
}

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
  };
}

function winnersOf(cat) {
  if (!cat.winner) return [];
  return Array.isArray(cat.winner) ? cat.winner : [cat.winner];
}

// ── Public API ───────────────────────────────────────────────────────────────

app.get('/api/data', wrap(async (req, res) => {
  res.json(await readData());
}));

app.post('/api/picks', wrap(async (req, res) => {
  const { name, picks } = req.body;
  if (!name || typeof picks !== 'object') return res.status(400).json({ error: 'Missing name or picks' });
  const trimmedName = name.trim();
  if (!trimmedName) return res.status(400).json({ error: 'Name cannot be empty' });
  const data = await readData();
  if (!data.lockedParticipants) data.lockedParticipants = [];
  if (data.lockedParticipants.includes(trimmedName)) {
    return res.status(403).json({ error: 'Your ballot is locked. Ask the admin to unlock it.' });
  }
  if (!data.participantNames.includes(trimmedName)) {
    if (data.participantNames.length >= 50) return res.status(400).json({ error: 'Max 50 participants reached' });
    data.participantNames.push(trimmedName);
  }
  data.picks[trimmedName] = { ...(data.picks[trimmedName] || {}), ...picks };
  // Auto-lock when all categories with nominees are picked
  const pickableIds = new Set(data.categories.filter(c => c.nominees.length > 0).map(c => c.id));
  const pickedIds = Object.keys(data.picks[trimmedName]).filter(id => pickableIds.has(id));
  let locked = false;
  if (pickedIds.length >= pickableIds.size) {
    data.lockedParticipants.push(trimmedName);
    locked = true;
  }
  await writeData(data);
  res.json({ success: true, locked });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const data = await readData();
  const { participantNames: participants, categories, picks } = data;

  const announced  = categories.filter(c => c.winner);
  const unresolved = categories.filter(c => !c.winner && c.nominees.length > 0);

  // Weighted scoring: use category points (default 1)
  const pts = cat => cat.points || 1;
  const maxPossible = categories.filter(c => c.nominees.length > 0).reduce((s, c) => s + pts(c), 0);

  const scores = {};
  participants.forEach(p => (scores[p] = 0));
  announced.forEach(cat => {
    const wSet = new Set(winnersOf(cat));
    participants.forEach(p => { if (wSet.has(picks[p]?.[cat.id])) scores[p] += pts(cat); });
  });

  const NUM_SIMS = 10000;
  const winCount = {};
  participants.forEach(p => (winCount[p] = 0));

  if (participants.length > 0) {
    if (unresolved.length === 0) {
      const maxScore = Math.max(...participants.map(p => scores[p]));
      participants.filter(p => scores[p] === maxScore).forEach(w => (winCount[w] = NUM_SIMS));
    } else {
      for (let sim = 0; sim < NUM_SIMS; sim++) {
        const simScores = { ...scores };
        unresolved.forEach(cat => {
          const w = cat.nominees[Math.floor(Math.random() * cat.nominees.length)];
          participants.forEach(p => { if (picks[p]?.[cat.id] === w) simScores[p] += pts(cat); });
        });
        const maxScore = Math.max(...participants.map(p => simScores[p]));
        participants.filter(p => simScores[p] === maxScore).forEach(w => (winCount[w] += 1 / participants.filter(p => simScores[p] === maxScore).length));
      }
    }
  }

  const rankings = participants
    .map(p => ({
      name: p,
      score: scores[p],
      maxPossible,
      announced: announced.length,
      total: categories.length,
      pickCount: Object.keys(picks[p] || {}).length,
      winProbability: parseFloat(((winCount[p] / NUM_SIMS) * 100).toFixed(1)),
    }))
    .sort((a, b) => b.winProbability - a.winProbability || b.score - a.score);

  res.json({
    progress: { announced: announced.length, total: categories.length },
    rankings,
    announced: announced.map(c => ({ id: c.id, name: c.name, winner: c.winner })),
    categories: categories.map(c => ({ id: c.id, name: c.name, points: pts(c), nominees: c.nominees, winner: c.winner })),
  });
}));

// ── Admin API ────────────────────────────────────────────────────────────────

app.post('/api/admin/verify', (req, res) => {
  if (req.body.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  res.json({ success: true });
});

app.post('/api/admin/nominees', adminAuth, wrap(async (req, res) => {
  const { categoryId, nominees } = req.body;
  const data = await readData();
  const cat = data.categories.find(c => c.id === categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  cat.nominees = nominees.map(n => n.trim()).filter(Boolean);
  await writeData(data);
  res.json({ success: true });
}));

app.post('/api/admin/result', adminAuth, wrap(async (req, res) => {
  const { categoryId, winner } = req.body;
  const data = await readData();
  const cat = data.categories.find(c => c.id === categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  cat.winner = (Array.isArray(winner) && winner.length === 0) ? null : (winner || null);
  await writeData(data);
  res.json({ success: true });
}));

app.post('/api/admin/participants', adminAuth, wrap(async (req, res) => {
  const { names } = req.body;
  const data = await readData();
  data.participantNames = names.map(n => n.trim()).filter(Boolean);
  await writeData(data);
  res.json({ success: true });
}));

app.post('/api/admin/reset', adminAuth, wrap(async (req, res) => {
  const { scope } = req.body;
  const data = await readData();
  if (scope === 'picks'   || scope === 'all') { data.picks = {}; data.lockedParticipants = []; }
  if (scope === 'results' || scope === 'all') data.categories.forEach(c => (c.winner = null));
  await writeData(data);
  res.json({ success: true });
}));

app.post('/api/admin/unlock', adminAuth, wrap(async (req, res) => {
  const { name } = req.body;
  const data = await readData();
  if (!data.lockedParticipants) data.lockedParticipants = [];
  data.lockedParticipants = data.lockedParticipants.filter(n => n !== name);
  await writeData(data);
  res.json({ success: true });
}));

// Re-import nominees from built-in defaults (preserves winners and picks)
app.post('/api/admin/load-nominees', adminAuth, wrap(async (req, res) => {
  const defaults = defaultData();
  const data = await readData();
  // Merge: add any missing categories, update nominees for all default categories
  defaults.categories.forEach(defCat => {
    const existing = data.categories.find(c => c.id === defCat.id);
    if (existing) {
      existing.nominees = defCat.nominees;
      existing.name = defCat.name;
      existing.points = defCat.points || 1;
    } else {
      data.categories.push(defCat);
    }
  });
  await writeData(data);
  res.json({ success: true, categoriesUpdated: defaults.categories.length });
}));

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const storage = process.env.MONGODB_URI ? 'MongoDB' : 'local file (data.json)';
  console.log(`\n🏆  Oscar Party 2026`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Storage: ${storage}`);
  console.log(`   Admin password: ${ADMIN_PASSWORD}\n`);
});
