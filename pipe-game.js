/* 水管工・單人版介面。依賴平台全域：app、$、go、topbar、bindBack、bank、mk、shuf、esc、addStat、addWrong、sname
 * 與 PipeEngine（pipe-engine.js）。每個操作（放置／旋轉／拆除）都要先答對題庫的題目。 */
var PP_ERR = {
  blocked: "這格不能放（水源、終點或障礙物）", occupied: "這格已經有水管了", no_stock: "這種水管用完了",
  not_owner: "只能動自己放的水管", locked: "水已經流過，不能再動了", no_pipe: "這格沒有水管", ended: "遊戲已經結束", out: "超出地圖"
};
var PP_FAIL = {
  empty: "水流到了沒有水管的空格，漏水了！", mismatch: "水管的接口對不上，漏水了！", loop: "水繞了一圈回到走過的地方！",
  wall: "水流到了地圖邊緣，漏水了！", blocked: "水撞到障礙物了！"
};

function pipeGame() {
  app.innerHTML = topbar("🔧 水管工") +
    '<p class="sub">每一步（放水管、轉水管、拆水管）都要先答對題庫的題目。水流不等人，答快一點！</p>' +
    '<div class="grid">' + PipeEngine.DIFFS.map(function (d, i) {
      return '<button class="game" data-d="' + i + '"><b>' + d.name + '</b><span>' + d.size + '×' + d.size + ' 地圖</span></button>';
    }).join("") + '</div>';
  bindBack();
  app.querySelectorAll("[data-d]").forEach(function (b) { b.onclick = function () { go(pipePlay, +b.dataset.d); }; });
}

function pipePlay(di) {
  if (bank.length < 4) { app.innerHTML = topbar("🔧 水管工") + '<p class="msg">題庫至少要 4 題才能玩。</p>'; bindBack(); return; }
  var PE = PipeEngine, DX = PE.DX, DY = PE.DY;
  if (!document.getElementById("ppcss")) {
    var st = document.createElement("style"); st.id = "ppcss";
    st.textContent =
      "#pp .hud{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}#pp .hud span{background:var(--card);border:2px solid var(--line);border-radius:12px;padding:6px 12px;font-weight:700;font-size:16px}" +
      "#pp .wrap{overflow:auto;border:3px solid var(--line);border-radius:14px;background:var(--card);max-width:100%;touch-action:manipulation;-webkit-user-select:none;user-select:none}#pp canvas{display:block;margin:0 auto}" +
      "#pp .modes,#pp .types{display:flex;gap:8px;margin:10px 0;flex-wrap:wrap}#pp .modes button{flex:1}" +
      "#pp .modes button{padding:8px 4px;font-size:16px;white-space:nowrap}#pp .modes button.on{outline:4px solid var(--ink)}#pp .modes button:not(.on){opacity:.65}" +
      "#pp .types button{flex:1;min-width:70px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px;background:var(--card);color:var(--ink);border:3px solid var(--line)}" +
      "#pp .types button.on{border-color:var(--pri);background:var(--c1)}#pp .types canvas{width:44px;height:44px}" +
      "#pp .mv{display:flex;gap:8px;align-items:center}#pp .mv .msg{flex:1;margin:0;text-align:left}" +
      "#pp_log{font-size:13px;color:var(--mute);max-height:110px;overflow:auto;border-top:1px solid var(--line);padding-top:8px;margin-top:10px}" +
      "#pp_ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:50;align-items:center;justify-content:center;padding:16px}" +
      "#pp_ov .box{background:var(--card);color:var(--ink);border-radius:16px;padding:18px;max-width:440px;width:100%;max-height:92vh;overflow:auto;text-align:center}" +
      "#pp_ov .q{font-size:40px;margin:10px 0}#pp_ov .opts button{font-size:30px;min-height:70px}";
    document.head.appendChild(st);
  }
  var diff = PE.DIFFS[di] || PE.DIFFS[0];
  var level = PE.makeLevel(di), S = PE.createGame(level), ME = "me";
  var mode = "place", ptype = "straight", prot = 0, pending = null, lastTick = performance.now(), raf = 0, ended = false, qlock = false, hit = null;
  var pop = "";
  var N = level.size;

  app.innerHTML = topbar("🔧 水管工・" + diff.name) +
    '<div id="pp"><div class="hud"><span id="pp_st" class="nz"></span><span id="pp_cnt" class="nz"></span></div>' +
    '<div class="wrap" id="pp_wrap"><canvas id="pp_c"></canvas></div>' +
    '<div class="modes"><button data-m="place">➕ 放水管</button><button data-m="rotate">🔄 轉一下</button><button data-m="remove">🗑️ 拆掉</button></div>'+
    '<div class="row"><button class="ghost nz" id="pp_skip" style="flex:1">⏭ 跳過這回合（不答題，水流前進一格）</button></div>' +
    '<div class="types" id="pp_types">' + PE.TYPES.map(function (t) { return '<button data-t="' + t + '"><canvas width="88" height="88"></canvas><span class="nz">' + PE.NAMES[t] + ' <b></b></span></button>'; }).join("") +
    '<button id="pp_rot" class="nz" style="flex-basis:100%;min-height:44px">↻ 轉換放置方向</button></div>' +
    '<div class="mv"><div class="msg nz" id="pp_msg">先選動作，再點格子，答對題目才會執行。每答一題水流一格；流到房子周圍（橘色虛線）會自動衝刺</div></div><div id="pp_log" class="nz"></div>' +
    '<div id="pp_ov"><div class="box" id="pp_box"></div></div></div>';
  bindBack();

  var cv = $("#pp_c"), ctx = cv.getContext("2d"), cs = 40, dpr = window.devicePixelRatio || 1;
  var lastTxt = {};
  function setTxt(id, v) { if (lastTxt[id] !== v) { lastTxt[id] = v; $("#" + id).textContent = v; } }
  function say(m) { setTxt("pp_msg", m); }
  function log(m) { var d = document.createElement("div"); d.textContent = m; var L = $("#pp_log"); L.insertBefore(d, L.firstChild); while (L.childNodes.length > 20) L.removeChild(L.lastChild); }

  function layout() {
    var w = $("#pp_wrap").clientWidth - 6;
    cs = Math.max(36, Math.floor(Math.min(w, 640) / N));
    cv.style.width = cs * N + "px"; cv.style.height = cs * N + "px";
    cv.width = cs * N * dpr; cv.height = cs * N * dpr;
  }
  window.addEventListener("resize", layout);
  cleanup = function () { cancelAnimationFrame(raf); window.removeEventListener("resize", layout); };

  /* ---------- 繪製 ---------- */
  function pt(cx, cy, d, f) { return [cx + DX[d] * cs * 0.5 * f, cy + DY[d] * cs * 0.5 * f]; }
  // 畫一根水管。fill[d] = 0..1 該開口的水量；entry[d]=true 表示水從邊緣往中心填
  function drawPipe(c, size, type, rot, fill, entry, alpha) {
    var ops = PE.openings(type, rot), cx = size / 2, cy = size / 2;
    function P(d, f) { return [cx + DX[d] * size * 0.5 * f, cy + DY[d] * size * 0.5 * f]; }
    c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.lineCap = "butt";
    function seg(w, col, a, b) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    function dot(r, col) { c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fill(); }
    ops.forEach(function (d) { seg(size * 0.44, "#4a5866", [cx, cy], P(d, 1)); }); dot(size * 0.22, "#4a5866");
    ops.forEach(function (d) { seg(size * 0.32, "#c9d3dc", [cx, cy], P(d, 1)); }); dot(size * 0.16, "#c9d3dc");
    if (fill) {
      var any = false;
      ops.forEach(function (d) {
        var f = fill[d] || 0; if (f <= 0) return; any = true;
        if (entry && entry[d]) seg(size * 0.22, "#2d8cff", P(d, 1), P(d, 1 - f)); else seg(size * 0.22, "#2d8cff", [cx, cy], P(d, f));
      });
      if (any) dot(size * 0.11, "#2d8cff");
    }
    c.restore();
  }
  function cellFill(x, y, p) {
    var k = x + "," + y, pipe = S.pipes[k]; if (!pipe) return null;
    var ops = PE.openings(pipe.type, pipe.rot), fill = {}, entry = {}, w = S.wet[k], front = null;
    if (!w) return null;
    S.fronts.forEach(function (f) { if (f.x === x && f.y === y) front = f; });
    if (front) {
      var e = PE.opp(front.d);
      ops.forEach(function (d) { if (d === e) { entry[d] = true; fill[d] = p; } else fill[d] = 0; });
    } else ops.forEach(function (d) { fill[d] = 1; entry[d] = w.ins.indexOf(d) >= 0; });
    return { fill: fill, entry: entry };
  }
  var cols = ["#ffd6c9", "#cfe8ff", "#d9f2c2", "#ffe9a8"];
  function draw(now) {
    var p = Math.min(1, (now - lastTick) / (S.rush ? level.rushMs : 600));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, cs * N, cs * N);
    var x, y, isDark = getComputedStyle(document.body).colorScheme === "dark";
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      ctx.fillStyle = ((x + y) % 2 ? "#eef3f7" : "#e3eaf0"); if (isDark) ctx.fillStyle = (x + y) % 2 ? "#3a3f46" : "#33383f";
      ctx.fillRect(x * cs, y * cs, cs, cs);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    level.obstacles.forEach(function (o) { ctx.font = Math.floor(cs * 0.7) + "px sans-serif"; ctx.fillText("🪨", o.x * cs + cs / 2, o.y * cs + cs / 2 + 2); });
    // 水源
    var sc = level.source; ctx.fillStyle = "#2d8cff"; ctx.fillRect(sc.x * cs + 3, sc.y * cs + 3, cs - 6, cs - 6);
    ctx.save(); ctx.translate(sc.x * cs, sc.y * cs); ctx.lineCap = "butt";
    var o = pt(cs / 2, cs / 2, sc.dir, 1); ctx.strokeStyle = "#4a5866"; ctx.lineWidth = cs * .44; ctx.beginPath(); ctx.moveTo(cs / 2, cs / 2); ctx.lineTo(o[0], o[1]); ctx.stroke();
    ctx.strokeStyle = "#2d8cff"; ctx.lineWidth = cs * .22; ctx.beginPath(); ctx.moveTo(cs / 2, cs / 2); ctx.lineTo(o[0], o[1]); ctx.stroke(); ctx.restore();
    ctx.font = Math.floor(cs * 0.5) + "px sans-serif"; ctx.fillText("💧", sc.x * cs + cs / 2 - cs * 0.12, sc.y * cs + cs / 2);
    // 終點
    var tg = level.target; ctx.fillStyle = S.status === "won" ? "#58c26b" : "#f0b84a"; ctx.fillRect(tg.x * cs + 3, tg.y * cs + 3, cs - 6, cs - 6);
    ctx.font = Math.floor(cs * 0.62) + "px sans-serif"; ctx.fillText("🏠", tg.x * cs + cs / 2, tg.y * cs + cs / 2 + 2);
    // 水管
    for (var k in S.pipes) {
      var pp = S.pipes[k], f = cellFill(pp.x, pp.y, p);
      ctx.save(); ctx.translate(pp.x * cs, pp.y * cs);
      drawPipe(ctx, cs, pp.type, pp.rot, f && f.fill, f && f.entry, 1); ctx.restore();
    }
    // 房子周圍一圈：水流到這裡會自動衝刺（每秒 2 格）
    if (!S.rush) {
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = "#f08a24"; ctx.lineWidth = 2;
      for (var hy = tg.y - 1; hy <= tg.y + 1; hy++) for (var hx = tg.x - 1; hx <= tg.x + 1; hx++) {
        if (hx < 0 || hy < 0 || hx >= N || hy >= N || (hx === tg.x && hy === tg.y) || S.obst[hx + "," + hy]) continue;
        ctx.strokeRect(hx * cs + 3, hy * cs + 3, cs - 6, cs - 6);
      } ctx.restore();
    }
    // 預覽（答題中）
    if (pending && pending.mode === "place") {
      ctx.save(); ctx.translate(pending.x * cs, pending.y * cs); drawPipe(ctx, cs, pending.type, pending.rot, null, null, 0.55); ctx.restore();
    }
    if (pending) { ctx.strokeStyle = "#f08a24"; ctx.lineWidth = 3; ctx.strokeRect(pending.x * cs + 2, pending.y * cs + 2, cs - 4, cs - 4); }
    if (S.failure) { ctx.font = Math.floor(cs * 0.8) + "px sans-serif"; ctx.fillText("💦", S.failure.x * cs + cs / 2, S.failure.y * cs + cs / 2); }
    if (hit) { ctx.strokeStyle = "#d9453d"; ctx.lineWidth = 3; ctx.strokeRect(hit.x * cs + 2, hit.y * cs + 2, cs - 4, cs - 4); if (now - hit.t > 600) hit = null; }
  }

  /* ---------- 介面更新 ---------- */
  function icons() {
    app.querySelectorAll("#pp_types button[data-t]").forEach(function (b) {
      var t = b.dataset.t, c = b.querySelector("canvas"), g = c.getContext("2d");
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 88, 88); drawPipe(g, 88, t, prot, null, null, 1);
      b.querySelector("b").textContent = "×" + S.inv[t]; b.classList.toggle("on", t === ptype && mode === "place"); b.disabled = false;
    });
    app.querySelectorAll(".modes button").forEach(function (b) { b.classList.toggle("on", b.dataset.m === mode); });
  }
  function hud() {
    if (S.status === "flow") {
      var rd = "第 " + (S.rounds + 1) + " 回合・";
      if (S.rush) setTxt("pp_st", "🌊 衝刺！每秒流 2 格");
      else if (S.wait > 0) setTxt("pp_st", rd + "⏳ 水流 " + S.wait + " 回合後出發");
      else setTxt("pp_st", rd + "💧 答完一題，水流前進一格");
    } else setTxt("pp_st", S.status === "won" ? "🎉 成功！" : "💥 失敗");
    setTxt("pp_cnt", "水管 " + PE.counts(S) + " 根");
  }

  /* ---------- 答題 → 執行 ---------- */
  var LABEL = { place: "放水管", rotate: "轉水管", remove: "拆水管" };
  function closeModal() { $("#pp_ov").style.display = "none"; pending = null; qlock = false; }
  function run(act) {
    var r;
    if (act.mode === "place") r = PE.place(S, ME, act.x, act.y, act.type, act.rot, "o" + Date.now() + Math.random());
    else if (act.mode === "rotate") r = PE.rotate(S, ME, act.x, act.y, "o" + Date.now() + Math.random());
    else r = PE.remove(S, ME, act.x, act.y, "o" + Date.now() + Math.random());
    if (r.ok) { log("✅ " + LABEL[act.mode] + "（" + (act.x + 1) + "," + (act.y + 1) + "）"); say("成功！" + LABEL[act.mode]);
    }
    else { say("這步沒成功：" + (PP_ERR[r.err] || r.err)); log("⚠️ " + (PP_ERR[r.err] || r.err)); hit = { x: act.x, y: act.y, t: performance.now() }; }
    icons(); return r.ok;
  }
  function ask(act) {
    if (pending || ended) return; pending = act;
    var q = mk(shuf(bank)[0]);
    $("#pp_box").innerHTML = '<b>' + LABEL[act.mode] + '：答對才會執行</b><div class="q">' + esc(q.q) + '</div><div class="opts">' +
      q.opts.map(function (o) { return '<button data-o="' + esc(o) + '">' + esc(o) + '</button>'; }).join("") + '</div>' +
      '<div class="row"><button class="ghost" id="pp_cancel">取消</button></div>';
    $("#pp_ov").style.display = "flex"; qlock = false;
    $("#pp_cancel").onclick = closeModal;
    $("#pp_box").querySelectorAll("[data-o]").forEach(function (b) {
      b.onclick = function () {
        if (qlock || ended) return; qlock = true;
        var ok = b.dataset.o === q.a; b.classList.add(ok ? "ok" : "bad");
        var did = false;
        if (ok) { var a = pending; did = run(a); }
        else {
          $("#pp_box").querySelectorAll("[data-o]").forEach(function (x) { if (x.dataset.o === q.a) x.classList.add("ok"); });
          addWrong(sname || "本機", q.q, q.a, b.dataset.o); say("答錯了，這步取消"); log("❌ 答錯，" + LABEL[act.mode] + "取消");
        }
        setTimeout(function () { if (ended) return; closeModal(); if (ok ? did : true) endRound(); }, ok ? 350 : 1100);
      };
    });
  }

  /* ---------- 操作 ---------- */
  app.querySelectorAll(".modes button").forEach(function (b) { b.onclick = function () { mode = b.dataset.m; icons(); say(mode === "place" ? "選水管種類，點空格放下去" : mode === "rotate" ? "點自己的水管，轉 90 度" : "點自己的水管，拆掉還給水管庫"); }; });
  app.querySelectorAll("#pp_types button[data-t]").forEach(function (b) { b.onclick = function () { ptype = b.dataset.t; mode = "place"; icons(); }; });
  $("#pp_rot").onclick = function () { prot = (prot + 1) % 4; icons(); };
  cv.addEventListener("pointerdown", function (e) {
    if (ended || pending || S.rush) return;
    var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / cs), y = Math.floor((e.clientY - r.top) / cs);
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    var k = x + "," + y, pipe = S.pipes[k], why = null;
    if (mode === "place") {
      if (pipe) why = "occupied"; else if (S.obst[k] || (x === level.source.x && y === level.source.y) || (x === level.target.x && y === level.target.y)) why = "blocked";
      else if (!(S.inv[ptype] > 0)) why = "no_stock";
    } else if (!pipe) why = "no_pipe"; else if (pipe.by !== ME) why = "not_owner"; else if (PE.isWet(S, x, y)) why = "locked";
    if (why) { say(PP_ERR[why]); hit = { x: x, y: y, t: performance.now() }; return; }
    ask({ mode: mode, x: x, y: y, type: ptype, rot: prot });
  });

  /* ---------- 迴圈與結算 ---------- */
  function finish() {
    ended = true; var won = S.status === "won";
    addStat("pipe", sname || "本機", won ? 1 : 0, PE.counts(S));
    var st = S.stats[ME] || { place: 0, rotate: 0, remove: 0 };
    $("#pp_box").innerHTML = '<h2 style="margin:0 0 8px">' + (won ? "🎉 水流到終點了！" : "💥 失敗了") + '</h2>' +
      '<p>' + (won ? "太棒了，管線接通！" : (PP_FAIL[S.failure && S.failure.reason] || "")) + '</p>' +
      '<p class="nz" style="color:var(--mute)">放 ' + st.place + ' 次・轉 ' + st.rotate + ' 次・拆 ' + st.remove + ' 次</p>' +
      '<div class="row"><button id="pp_again">再玩一次</button><button class="ghost" id="pp_home">主畫面</button></div>';
    $("#pp_ov").style.display = "flex"; pending = null;
    $("#pp_again").onclick = function () { go(pipePlay, di); }; $("#pp_home").onclick = function () { go(home); };
  }
  function endRound(auto) {
    if (ended || S.status !== "flow" || (S.rush && !auto)) return;
    lastTick = performance.now();
    var ev = PE.tick(S);
    {
      ev.forEach(function (e) {
        if (e.t === "move") log("💧 水流到 (" + (e.x + 1) + "," + (e.y + 1) + ")");
        if (e.t === "fail") log("💥 " + PP_FAIL[e.reason]);
        if (e.t === "win") log("🎉 抵達終點");
        if (e.t === "rush") { log("🌊 水流到房子周圍，開始衝刺！"); say("水開始自動衝刺，每秒 2 格！"); if (pending) closeModal(); }
      });
      if (S.status !== "flow") finish();
    }
    hud(); icons();
  }
  $("#pp_skip").onclick = function () { if (pending || ended || S.rush) return; log("⏭ 跳過回合"); endRound(); };
  var lastRush = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (S.rush && S.status === "flow" && !ended && now - lastRush >= level.rushMs) { lastRush = now; endRound(true); }
    hud(); draw(now);
  }
  layout(); icons(); hud();
  raf = requestAnimationFrame(loop);
}
