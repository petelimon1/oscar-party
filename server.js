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
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  _mongoDb = client.db('oscar_party');
  console.log('Connected to MongoDB');
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
    participantNames: ['Player 1','Player 2','Player 3','Player 4','Player 5','Player 6'],
    categories: [
      { id: 'best_picture',      name: 'Best Picture',                    nominees: [], winner: null },
      { id: 'best_director',     name: 'Best Director',                   nominees: [], winner: null },
      { id: 'best_actress',      name: 'Best Actress in a Leading Role',  nominees: [], winner: null },
      { id: 'best_actor',        name: 'Best Actor in a Leading Role',    nominees: [], winner: null },
      { id: 'best_supp_actress', name: 'Best Supporting Actress',         nominees: [], winner: null },
      { id: 'best_supp_actor',   name: 'Best Supporting Actor',           nominees: [], winner: null },
      { id: 'best_animated',     name: 'Best Animated Feature Film',      nominees: [], winner: null },
      { id: 'best_intl',         name: 'Best International Feature Film', nominees: [], winner: null },
      { id: 'best_documentary',  name: 'Best Documentary Feature Film',   nominees: [], winner: null },
      { id: 'best_doc_short',    name: 'Best Documentary Short Film',     nominees: [], winner: null },
      { id: 'best_live_short',   name: 'Best Live Action Short Film',     nominees: [], winner: null },
      { id: 'best_anim_short',   name: 'Best Animated Short Film',        nominees: [], winner: null },
      { id: 'best_orig_screen',  name: 'Best Original Screenplay',        nominees: [], winner: null },
      { id: 'best_adapt_screen', name: 'Best Adapted Screenplay',         nominees: [], winner: null },
      { id: 'best_cinematog',    name: 'Best Cinematography',             nominees: [], winner: null },
      { id: 'best_editing',      name: 'Best Film Editing',               nominees: [], winner: null },
      { id: 'best_score',        name: 'Best Original Score',             nominees: [], winner: null },
      { id: 'best_song',         name: 'Best Original Song',              nominees: [], winner: null },
      { id: 'best_prod_design',  name: 'Best Production Design',          nominees: [], winner: null },
      { id: 'best_costume',      name: 'Best Costume Design',             nominees: [], winner: null },
      { id: 'best_makeup',       name: 'Best Makeup and Hairstyling',     nominees: [], winner: null },
      { id: 'best_sound',        name: 'Best Sound',                      nominees: [], winner: null },
      { id: 'best_vfx',          name: 'Best Visual Effects',             nominees: [], winner: null },
    ],
    picks: {},
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

// ── Public API ───────────────────────────────────────────────────────────────

app.get('/api/data', wrap(async (req, res) => {
  res.json(await readData());
}));

app.post('/api/picks', wrap(async (req, res) => {
  const { name, picks } = req.body;
  if (!name || typeof picks !== 'object') return res.status(400).json({ error: 'Missing name or picks' });
  const trimmedName = name.trim();
  const data = await readData();
  if (!data.participantNames.includes(trimmedName)) return res.status(400).json({ error: 'Unknown participant name' });
  data.picks[trimmedName] = { ...(data.picks[trimmedName] || {}), ...picks };
  await writeData(data);
  res.json({ success: true });
}));

app.get('/api/leaderboard', wrap(async (req, res) => {
  const data = await readData();
  const { participantNames: participants, categories, picks } = data;

  const announced  = categories.filter(c => c.winner);
  const unresolved = categories.filter(c => !c.winner && c.nominees.length > 0);

  const scores = {};
  participants.forEach(p => (scores[p] = 0));
  announced.forEach(cat => {
    participants.forEach(p => { if (picks[p]?.[cat.id] === cat.winner) scores[p]++; });
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
          participants.forEach(p => { if (picks[p]?.[cat.id] === w) simScores[p]++; });
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
    categories: categories.map(c => ({ id: c.id, name: c.name, nominees: c.nominees, winner: c.winner })),
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
  cat.winner = winner || null;
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
  if (scope === 'picks'   || scope === 'all') data.picks = {};
  if (scope === 'results' || scope === 'all') data.categories.forEach(c => (c.winner = null));
  await writeData(data);
  res.json({ success: true });
}));

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
  const storage = process.env.MONGODB_URI ? 'MongoDB' : 'local file (data.json)';
  console.log(`\n🏆  Oscar Party 2026`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Storage: ${storage}`);
  console.log(`   Admin password: ${ADMIN_PASSWORD}\n`);
});
