/* 水管工・遊戲引擎（純邏輯，不碰 DOM）
 * 方向：0=上 1=右 2=下 3=左；旋轉 rot=0..3，每次順時針 90 度。
 * 瀏覽器：window.PipeEngine；Node：module.exports。
 * 多人版時，由「老師畫面（主機）」呼叫同一份引擎，學生端只送出操作請求。 */
(function (root) {
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  var BASE = { straight: [0, 2], elbow: [0, 1], tee: [0, 1, 3], cross: [0, 1, 2, 3] };
  var TYPES = ["straight", "elbow", "tee", "cross"];
  var NAMES = { straight: "直線管", elbow: "彎曲管", tee: "T型管", cross: "十字管" };
  var DIFFS = [
    { id: "easy", name: "初級", size: 8, tickMs: 6000, delay: 5, rock: 0.12, slack: 3, tee: 3, cross: 2 },
    { id: "mid", name: "中級", size: 10, tickMs: 5000, delay: 4, rock: 0.15, slack: 3, tee: 2, cross: 1 },
    { id: "hard", name: "高級", size: 12, tickMs: 4500, delay: 3, rock: 0.18, slack: 3, tee: 1, cross: 1 }
  ];

  function opp(d) { return (d + 2) % 4; }
  function key(x, y) { return x + "," + y; }
  function openings(type, rot) {
    var b = BASE[type]; if (!b) return [];
    return b.map(function (d) { return (d + rot) % 4; });
  }
  function hasOpen(p, d) { return openings(p.type, p.rot).indexOf(d) >= 0; }

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 關卡產生：保證至少有一條可通的路 ---------- */
  function makeLevel(diffIdx, seed) {
    var df = DIFFS[diffIdx] || DIFFS[0], N = df.size;
    if (seed == null) seed = (Math.random() * 4294967296) >>> 0;
    var R = rng(seed);
    var sy = 1 + Math.floor(R() * (N - 2)), ty = 1 + Math.floor(R() * (N - 2));
    var cost = [], x, y;
    for (y = 0; y < N; y++) { cost[y] = []; for (x = 0; x < N; x++) cost[y][x] = 1 + Math.floor(R() * 4); }
    // 隨機權重的最短路（會得到彎彎曲曲的參考路線）
    var dist = {}, prev = {}, done = {}, open = [{ x: 1, y: sy, d: 0 }];
    dist[key(1, sy)] = 0;
    while (open.length) {
      open.sort(function (a, b) { return a.d - b.d; });
      var c = open.shift(), ck = key(c.x, c.y);
      if (done[ck]) continue; done[ck] = 1;
      if (c.x === N - 2 && c.y === ty) break;
      for (var d = 0; d < 4; d++) {
        var nx = c.x + DX[d], ny = c.y + DY[d];
        if (nx < 1 || nx > N - 2 || ny < 0 || ny >= N) continue;
        var nk = key(nx, ny), nd = c.d + cost[ny][nx];
        if (dist[nk] === undefined || nd < dist[nk]) { dist[nk] = nd; prev[nk] = ck; open.push({ x: nx, y: ny, d: nd }); }
      }
    }
    var path = [], cur = key(N - 2, ty);
    while (cur) { var q = cur.split(","); path.unshift({ x: +q[0], y: +q[1] }); cur = prev[cur]; }
    var onPath = {}; path.forEach(function (p) { onPath[key(p.x, p.y)] = 1; });
    var source = { x: 0, y: sy, dir: 1 }, target = { x: N - 1, y: ty };
    var obstacles = [];
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      if (onPath[key(x, y)] || (x === 0 && y === sy) || (x === N - 1 && y === ty)) continue;
      if (R() < df.rock) obstacles.push({ x: x, y: y });
    }
    // 庫存 = 參考路線需要的直線／彎曲管數 + 備用 slack；T型、十字管當「萬用替代」少量給（可由關卡設定修改）
    var needS = 0, needE = 0;
    for (var i = 0; i < path.length; i++) {
      var a = i === 0 ? { x: 0, y: sy } : path[i - 1], b = i === path.length - 1 ? { x: N - 1, y: ty } : path[i + 1];
      var straight = (a.x === b.x) || (a.y === b.y);
      if (straight) needS++; else needE++;
    }
    return {
      seed: seed, diff: df.id, diffName: df.name, size: N, tickMs: df.tickMs, delay: df.delay,
      source: source, target: target, obstacles: obstacles, specials: [], path: path,
      inv: { straight: needS + df.slack, elbow: needE + df.slack, tee: df.tee, cross: df.cross }
    };
  }

  /* ---------- 遊戲狀態 ---------- */
  function createGame(level) {
    var s = {
      level: level, size: level.size, source: level.source, target: level.target,
      obst: {}, inv: {}, pipes: {}, nextId: 1, ops: {}, status: "flow", tick: 0, rounds: 0,
      // wait＝出發前先等的回合數（初級5／中級4／高級3）；之後每呼叫一次 tick＝水流前進一格。介面規定「每答一次題（對錯都算）或跳過」呼叫一次 tick
      wait: level.delay || 0, delay: level.delay || 0,
      fronts: [{ x: level.source.x, y: level.source.y, d: null, src: true }],
      visited: {}, wet: {}, failure: null, stats: {}, steps: 0
    };
    level.obstacles.forEach(function (o) { s.obst[key(o.x, o.y)] = 1; });
    TYPES.forEach(function (t) { s.inv[t] = (level.inv && level.inv[t]) || 0; });
    s.visited[key(level.source.x, level.source.y)] = 1;
    return s;
  }
  function pstat(s, pid) { return s.stats[pid] || (s.stats[pid] = { place: 0, rotate: 0, remove: 0 }); }
  function isWet(s, x, y) { return !!s.wet[key(x, y)]; }
  function finish(s, opId, r) { if (opId) s.ops[opId] = r; return r; }
  function inb(s, x, y) { return x >= 0 && y >= 0 && x < s.size && y < s.size; }

  function place(s, pid, x, y, type, rot, opId, now) {
    if (opId && s.ops[opId]) return { ok: s.ops[opId].ok, err: s.ops[opId].err, dup: true };
    if (s.status !== "flow") return finish(s, opId, { ok: false, err: "ended" });
    if (!BASE[type]) return finish(s, opId, { ok: false, err: "bad_type" });
    if (!inb(s, x, y)) return finish(s, opId, { ok: false, err: "out" });
    var k = key(x, y);
    if (s.obst[k] || (x === s.source.x && y === s.source.y) || (x === s.target.x && y === s.target.y)) return finish(s, opId, { ok: false, err: "blocked" });
    if (s.pipes[k]) return finish(s, opId, { ok: false, err: "occupied" });
    if (!(s.inv[type] > 0)) return finish(s, opId, { ok: false, err: "no_stock" });
    var p = { id: s.nextId++, type: type, x: x, y: y, rot: ((rot % 4) + 4) % 4, by: pid, t: now || Date.now() };
    s.pipes[k] = p; s.inv[type]--; pstat(s, pid).place++;
    return finish(s, opId, { ok: true, pipe: p });
  }
  function mine(s, pid, x, y) {
    var p = s.pipes[key(x, y)];
    if (!p) return { err: "no_pipe" };
    if (p.by !== pid) return { err: "not_owner" };
    if (isWet(s, x, y)) return { err: "locked" }; // 水已經流過，不能再動
    return { p: p };
  }
  function rotate(s, pid, x, y, opId) {
    if (opId && s.ops[opId]) return { ok: s.ops[opId].ok, err: s.ops[opId].err, dup: true };
    if (s.status !== "flow") return finish(s, opId, { ok: false, err: "ended" });
    var m = mine(s, pid, x, y); if (m.err) return finish(s, opId, { ok: false, err: m.err });
    m.p.rot = (m.p.rot + 1) % 4; pstat(s, pid).rotate++;
    return finish(s, opId, { ok: true, pipe: m.p });
  }
  function remove(s, pid, x, y, opId) {
    if (opId && s.ops[opId]) return { ok: s.ops[opId].ok, err: s.ops[opId].err, dup: true };
    if (s.status !== "flow") return finish(s, opId, { ok: false, err: "ended" });
    var m = mine(s, pid, x, y); if (m.err) return finish(s, opId, { ok: false, err: m.err });
    delete s.pipes[key(x, y)]; s.inv[m.p.type]++; pstat(s, pid).remove++;
    return finish(s, opId, { ok: true, pipe: m.p });
  }

  /* ---------- 水流 ---------- */
  function exitsOf(s, f) {
    if (f.src) return [s.source.dir];
    var p = s.pipes[key(f.x, f.y)]; if (!p) return [];
    return openings(p.type, p.rot).filter(function (d) { return d !== opp(f.d); });
  }
  function visitKey(p, x, y, e) { return p.type === "cross" ? key(x, y) + "|" + (e % 2) : key(x, y); }

  function checkNext(s, f, e) {
    var nx = f.x + DX[e], ny = f.y + DY[e];
    if (!inb(s, nx, ny)) return { fail: "wall", x: f.x, y: f.y };
    var k = key(nx, ny);
    if (nx === s.target.x && ny === s.target.y) return { win: true, x: nx, y: ny };
    if (s.obst[k]) return { fail: "blocked", x: nx, y: ny };
    if (nx === s.source.x && ny === s.source.y) return { fail: "loop", x: nx, y: ny };
    var p = s.pipes[k];
    if (!p) return { fail: "empty", x: nx, y: ny };
    if (!hasOpen(p, opp(e))) return { fail: "mismatch", x: nx, y: ny };
    if (s.visited[visitKey(p, nx, ny, e)]) return { fail: "loop", x: nx, y: ny };
    return { cont: { x: nx, y: ny, d: e } };
  }

  // 每呼叫一次前進一格。回傳事件：wait / move / win / fail
  function tick(s) {
    if (s.status !== "flow") return [];
    s.rounds++;
    if (s.wait > 0) { s.wait--; return [{ t: "wait", left: s.wait }]; }
    s.tick++;
    var next = [], ev = [], won = null, fail = null;
    s.fronts.forEach(function (f) {
      var exits = exitsOf(s, f), res = [];
      exits.forEach(function (e) { var r = checkNext(s, f, e); r.e = e; res.push(r); });
      var good = res.filter(function (r) { return r.win || r.cont; });
      var bad = res.filter(function (r) { return r.fail; });
      if (!exits.length) { fail = fail || { reason: "empty", x: f.x, y: f.y }; return; }
      if (exits.length > 1 && good.length) bad = []; // 分岔管：沒接上的出口不算漏水，只要還有路可走
      if (bad.length) { fail = fail || { reason: bad[0].fail, x: bad[0].x, y: bad[0].y }; }
      good.forEach(function (r) {
        if (r.win) { won = { x: r.x, y: r.y }; return; }
        var nk = key(r.cont.x, r.cont.y), np = s.pipes[nk];
        s.visited[visitKey(np, r.cont.x, r.cont.y, r.e)] = 1;
        var w = s.wet[nk] || (s.wet[nk] = { ins: [] }); w.ins.push(opp(r.e));
        next.push(r.cont);
        ev.push({ t: "move", x: r.cont.x, y: r.cont.y });
      });
      if (!f.src) { var wk = key(f.x, f.y); if (!s.wet[wk]) s.wet[wk] = { ins: [] }; }
    });
    if (won) { s.status = "won"; s.fronts = []; ev.push({ t: "win", x: won.x, y: won.y }); return ev; }
    if (fail) { s.status = "lost"; s.failure = fail; ev.push({ t: "fail", reason: fail.reason, x: fail.x, y: fail.y }); return ev; }
    s.fronts = next; s.steps++;
    return ev;
  }

  function counts(s) { var n = 0; for (var k in s.pipes) n++; return n; }
  function snapshot(s) { // 多人同步用（可直接 JSON 傳送）
    return { size: s.size, source: s.source, target: s.target, obstacles: s.level.obstacles, inv: s.inv,
      pipes: Object.keys(s.pipes).map(function (k) { return s.pipes[k]; }), tick: s.tick, rounds: s.rounds, wait: s.wait, delay: s.delay,
      status: s.status, fronts: s.fronts, wet: s.wet, failure: s.failure };
  }

  var API = { DX: DX, DY: DY, TYPES: TYPES, NAMES: NAMES, DIFFS: DIFFS, opp: opp, openings: openings, makeLevel: makeLevel,
    createGame: createGame, place: place, rotate: rotate, remove: remove, tick: tick, isWet: isWet, counts: counts, snapshot: snapshot };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.PipeEngine = API;
})(typeof window !== "undefined" ? window : this);
