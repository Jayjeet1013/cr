const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const RACE_LEN = 36000; // 3 km at 12 px per metre, matches index.html
const COLORS = ['#12b3a6', '#ff6a2b', '#2f6bff', '#e8445a'];
const rooms = new Map();
const streams = new Map();

const id = n => randomBytes(n).toString('hex').slice(0, n).toUpperCase();
const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
const read = req => new Promise(done => {
  let s = '';
  req.on('data', c => { s += c; if (s.length > 1e4) req.destroy(); });
  req.on('end', () => { try { done(JSON.parse(s || '{}')); } catch { done({}); } });
});

const view = r => ({
  code: r.code, status: r.status, seed: r.seed, startsIn: Math.max(0, r.startsAt - Date.now()),
  players: r.players.map(p => ({ id: p.id, name: p.name, dept: p.dept, color: p.color, slot: p.slot, ready: p.ready,
    x: p.x, y: p.y, a: p.a, steer: p.steer, prog: p.prog, finished: p.finished, time: p.time }))
});
function broadcast(r) {
  const data = `event: state\ndata: ${JSON.stringify({ room: view(r) })}\n\n`;
  for (const p of r.players) { const out = streams.get(p.id); if (out) out.write(data); }
}
function endRace(r) {
  if (r.status !== 'racing') return;
  r.status = 'finished'; clearTimeout(r.timer); clearTimeout(r.grace); broadcast(r);
}
function start(r) {
  r.status = 'countdown'; r.startsAt = Date.now() + 4000; r.seed = randomBytes(4).readUInt32BE(0);
  r.players.forEach((p, i) => Object.assign(p, { slot: i, prog: 0, finished: false, time: null, moved: false, x: 0, y: 0, a: 0, steer: 0 }));
  broadcast(r);
  setTimeout(() => { if (r.status === 'countdown') { r.status = 'racing'; broadcast(r); } }, 4000);
  clearTimeout(r.timer);
  r.timer = setTimeout(() => endRace(r), 6 * 60 * 1000);
}
function removePlayer(r, pid) {
  r.players = r.players.filter(p => p.id !== pid);
  if (!r.players.length) { clearTimeout(r.timer); clearTimeout(r.grace); rooms.delete(r.code); return; }
  if (r.status === 'lobby' && r.players.length >= 2 && r.players.every(p => p.ready)) start(r);
  if (r.status === 'racing' && r.players.every(p => p.finished)) endRace(r);
  broadcast(r);
}
const roomOf = pid => [...rooms.values()].find(r => r.players.some(p => p.id === pid));

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(path.join(__dirname, 'index.html')).pipe(res);
  }
  if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true, game: 'corporacer' });
  if (req.method === 'GET' && url.pathname === '/events') {
    const pid = url.searchParams.get('player');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': connected\n\n');
    streams.set(pid, res);
    const r = roomOf(pid);
    if (r) res.write(`event: state\ndata: ${JSON.stringify({ room: view(r) })}\n\n`);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      if (streams.get(pid) !== res) return;
      streams.delete(pid);
      // Drop players who close the tab while waiting in a lobby, so the rest can still start.
      setTimeout(() => { const room = roomOf(pid); if (!streams.has(pid) && room && room.status === 'lobby') removePlayer(room, pid); }, 10000);
    });
    return;
  }
  if (req.method !== 'POST') return json(res, 404, { error: 'Not found' });
  const data = await read(req);

  if (url.pathname === '/join') {
    let code = String(data.roomCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || id(6);
    let r = rooms.get(code);
    if (!r) { r = { code, status: 'lobby', startsAt: 0, players: [], timer: null, grace: null }; rooms.set(code, r); }
    let p = r.players.find(q => q.id === data.playerId);
    if (!p) {
      if (r.status !== 'lobby') return json(res, 409, { error: 'That race has already started. Wait for it to finish, then join again.' });
      if (r.players.length >= 4) return json(res, 409, { error: 'That race is full. Four drivers is the limit.' });
      const taken = new Set(r.players.map(q => q.color));
      const color = COLORS.includes(data.color) && !taken.has(data.color) ? data.color : COLORS.find(c => !taken.has(c));
      p = { id: id(14), color, ready: false, slot: r.players.length, x: 0, y: 0, a: 0, steer: 0, prog: 0, finished: false, time: null };
      r.players.push(p);
    }
    p.name = String(data.name || 'Racer').slice(0, 14) || 'Racer';
    p.dept = String(data.dept || 'Engineering').slice(0, 20);
    json(res, 200, { playerId: p.id, room: view(r) });
    return broadcast(r);
  }

  const r = rooms.get(String(data.roomCode || ''));
  const p = r && r.players.find(q => q.id === data.playerId);
  if (!r || !p) return json(res, 400, { error: 'This race room has closed. Create a new room or ask for a fresh code.' });

  if (url.pathname === '/ready') {
    if (r.status !== 'lobby') return json(res, 400, { error: 'The race has already started.' });
    p.ready = !p.ready;
    if (r.players.length >= 2 && r.players.every(q => q.ready)) start(r);
    json(res, 200, { ok: true });
    return broadcast(r);
  }
  if (url.pathname === '/move') {
    if (r.status !== 'racing' || p.finished) return json(res, 409, { error: 'Race not active.' });
    const { x, y, a, prog, steer, done } = data;
    if (![x, y, a, prog].every(Number.isFinite)) return json(res, 400, { error: 'Invalid move.' });
    if (p.moved && Math.hypot(x - p.x, y - p.y) > 180) return json(res, 400, { error: 'Invalid move.' });
    Object.assign(p, { x, y, a, prog, steer: Number.isFinite(steer) ? steer : 0, moved: true });
    if (done === true && y <= -RACE_LEN + 60 && !p.finished) {
      p.finished = true; p.time = (Date.now() - r.startsAt) / 1000;
      if (r.players.every(q => q.finished)) endRace(r);
      else if (!r.grace) r.grace = setTimeout(() => endRace(r), 60000);
    }
    json(res, 200, { ok: true });
    return broadcast(r);
  }
  if (url.pathname === '/rematch') {
    if (r.status === 'racing' || r.status === 'countdown') return json(res, 400, { error: 'The race is still running.' });
    r.status = 'lobby'; r.grace = null; r.players.forEach(q => { q.ready = false; });
    json(res, 200, { ok: true });
    return broadcast(r);
  }
  if (url.pathname === '/leave') { json(res, 200, { ok: true }); return removePlayer(r, p.id); }
  json(res, 404, { error: 'Not found' });
}).listen(process.env.PORT || 3000, () => console.log(`Corporacer running at http://localhost:${process.env.PORT || 3000}`));
