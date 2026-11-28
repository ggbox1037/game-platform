/* 數字積木建築師・平台版。使用平台全域：app、$、go、topbar、bindBack、shuf、ls、sname、addStat、addWrong
 * 原作：使用者的 Artifact「數字積木建築師」。changes：所有函式包在 numBlocks() 內、不污染全域；
 * 姓名用平台登入的 sname；答錯寫進平台錯題紀錄、通關寫進平台成績；進度依學生姓名存在本機。 */
function numBlocks() {
  var NAMES = ["", "認識積木", "數字變積木", "積木變數字", "誰比較大？", "數字偵探"];
  var EMO = ["", "🧱", "🏠", "🏗️", "⚖️", "🕵️"];
  var DESC = ["", "點一點兩種積木，再回答問題", "用＋和－蓋出卡片上的數字，再按「確認答案」", "看積木，選出正確的數字", "看積木與數字，點選比較大的數字", "讀線索，找出神祕數字"];
  var L1 = [
    { q: "一條十位積木代表多少？", vis: [1, 0], opts: [1, 10, 100], ans: 10, hint: "長條是十位積木，想想它是由幾個小方塊連在一起！" },
    { q: "一個個位積木代表多少？", vis: [0, 1], opts: [1, 10, 2], ans: 1, hint: "小方塊只有一個，代表 1。" },
    { q: "10個個位積木等於幾條十位積木？", vis: [0, 10], opts: [1, 10, 2], ans: 1, hint: "10個一可以換成1條十。" },
    { q: "2條十位積木代表多少？", vis: [2, 0], opts: [2, 12, 20, 200], ans: 20, hint: "一條是10，兩條就是 10＋10。" }];
  var L3 = [[2, 3, [23, 32, 5, 13]], [4, 6, [46, 64, 10, 36]], [5, 1, [51, 15, 6, 41]], [7, 0, [70, 7, 17, 60]], [8, 9, [89, 98, 17, 79]]]
    .map(function (a) { return { q: a[0] + "個十＋" + a[1] + "個一", vis: [a[0], a[1]], opts: a[2], ans: a[0] * 10 + a[1], hint: "先數有幾條十（一條是10），再加上個位的小方塊。" }; });
  var L5 = [
    { q: "我有3個十和5個一，我是誰？", opts: [35, 53, 8, 30], ans: 35, hint: "3個十是30，再加5個一。" },
    { q: "我有6個十，沒有個位積木，我是誰？", opts: [6, 60, 66, 16], ans: 60, hint: "6個十是60，個位是0。" },
    { q: "我比40大，比50小，我的個位是7，我是誰？", opts: [47, 57, 37, 40], ans: 47, hint: "數字要在40和50之間，十位是4。" },
    { q: "我有8個十和2個一，我比81大嗎？", opts: ["是，82比81大", "不是，82比81小"], ans: "是，82比81大", hint: "8個十和2個一是82，十位相同，再比個位。" },
    { q: "我有4個十和9個一，請找出比我小的數字。", opts: [52, 38, 49, 61], ans: 38, hint: "我是49，要找比49小的數字。" }];
  var PAIRS = [[18, 81], [35, 42], [56, 59], [73, 37], [80, 79]];

  if (!document.getElementById("nbcss")) {
    var st = document.createElement("style"); st.id = "nbcss";
    st.textContent =
      "#nb{--ten:#ff7a2f;--one:#2f9bff;--pri2:#7b4dff;max-width:760px;margin:0 auto}" +
      "#nb .nb-bar{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;font-weight:700;font-size:15px;margin-bottom:8px}" +
      "#nb .nb-card{background:var(--card);border:2px solid var(--line);border-radius:20px;padding:14px;margin:10px 0;text-align:center}" +
      "#nb h2,#nb h3,#nb p{margin:6px 0}#nb h2{font-size:1.4rem}" +
      "#nb .nb-b{font-size:1.2rem;font-weight:800;padding:12px 20px;min-height:50px;border:0;border-radius:16px;background:var(--pri2);color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.25);cursor:pointer;margin:4px;touch-action:manipulation}" +
      "#nb .nb-b:active{transform:translateY(3px);box-shadow:none}#nb .nb-b:disabled{opacity:.4}#nb .nb-b.g{background:var(--ok)}#nb .nb-b.o{background:var(--ten)}" +
      "#nb .nb-opts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}" +
      "#nb .nb-opt{font-size:1.6rem;min-height:64px;border-radius:16px;border:3px solid var(--one);background:var(--card);color:var(--ink);font-weight:800;cursor:pointer}" +
      "#nb .nb-opt.x{background:#ffd6d8;border-color:var(--bad);color:#7a1b1f}#nb .nb-opt.g{background:#c9f5d9;border-color:var(--ok);color:#0d4d28}" +
      "#nb .bl{display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end;justify-content:center;min-height:40px;padding:6px}" +
      "#nb .ten{display:inline-block;width:20px;height:100px;border-radius:5px;background:repeating-linear-gradient(to bottom,transparent 0 8px,rgba(0,0,0,.28) 8px 10px),linear-gradient(90deg,#ffa066,var(--ten));box-shadow:inset -3px 0 0 rgba(0,0,0,.2),2px 3px 0 rgba(0,0,0,.25)}" +
      "#nb .og{display:flex;flex-wrap:wrap;gap:3px;width:115px;align-content:flex-end;margin-left:6px}" +
      "#nb .one{display:inline-block;width:20px;height:20px;border-radius:4px;background:linear-gradient(135deg,#7cc4ff,var(--one));box-shadow:inset -2px -2px 0 rgba(0,0,0,.2),1px 2px 0 rgba(0,0,0,.25)}" +
      "#nb .nb-big{font-size:3rem;font-weight:900;color:var(--pri2)}" +
      "#nb .nb-fb{padding:10px;border-radius:14px;font-weight:700;margin-top:10px}#nb .nb-fb.ok{background:#c9f5d9;color:#0d4d28;animation:nbpop .5s}#nb .nb-fb.no{background:#fff0c2;color:#6b4a00;animation:nbsh .4s}" +
      "@keyframes nbpop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}@keyframes nbsh{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}" +
      "#nb .nb-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
      "#nb .nb-zone{border-radius:16px;padding:8px;border:3px dashed var(--ten)}#nb .nb-zone.u{border-color:var(--one)}" +
      "#nb .nb-side{border:4px solid var(--pri2);border-radius:18px;background:var(--card);color:var(--ink);padding:8px;cursor:pointer}" +
      "#nb .nb-side.x{border-color:var(--bad);background:#ffd6d8;color:#7a1b1f}#nb .nb-side.g{border-color:var(--ok);background:#c9f5d9;color:#0d4d28}" +
      "#nb .nb-lc{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font-size:1.1rem;font-weight:700;padding:12px;margin:6px 0;border-radius:16px;border:2px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}" +
      "#nb .nb-lc:disabled{opacity:.45}#nb .nb-lc em{font-size:2rem;font-style:normal}#nb .nb-lc small{color:var(--mute);font-weight:400}" +
      "#nb .nb-badge{font-size:4rem;animation:nbpop .6s}";
    document.head.appendChild(st);
  }

  var KEY = "nbb_" + (sname || "guest");
  function fresh() { return { unlock: 1, done: [], ok: 0 }; }
  function load() { try { var s = JSON.parse(ls(KEY)); return s && s.done ? s : fresh(); } catch (e) { return fresh(); } }
  function save() { ls(KEY, JSON.stringify(S)); }
  var S = load(), V = { scr: "hub" };
  var who = function () { return sname || "本機"; };

  function B(t, o) { var h = '<div class="bl">'; for (var i = 0; i < t; i++) h += '<i class="ten"></i>'; if (o) { h += '<span class="og">'; for (var j = 0; j < o; j++) h += '<i class="one"></i>'; h += "</span>"; } return h + "</div>"; }
  function BN(n) { return B(Math.floor(n / 10), n % 10); }
  function btn(act, k, cls, txt, extra) { return '<button class="' + cls + '" data-a="' + act + '"' + (k !== undefined ? ' data-k="' + k + '"' : "") + (extra || "") + ">" + txt + "</button>"; }

  /* ---------- 紀錄（寫進平台）---------- */
  function rec(l, qtext, right, ansText, chosenText) {
    V.a++; if (right) { V.c++; S.ok++; }
    else addWrong(who(), "數字積木・第" + l + "關：" + qtext, String(ansText), String(chosenText));
    save();
  }

  /* ---------- 流程 ---------- */
  function start(l) {
    V = { scr: "lv", l: l, i: l == 1 ? -1 : 0, fb: null, tried: {}, seen: {}, t: 0, o: 0, a: 0, c: 0 };
    if (l == 1) V.q = L1.map(function (x) { return Object.assign({}, x, { opts: shuf(x.opts) }); });
    if (l == 2) V.q = shuf([12, 25, 38, 46, 70, 93]);
    if (l == 3) V.q = shuf(L3).map(function (x) { return Object.assign({}, x, { opts: shuf(x.opts) }); });
    if (l == 4) V.q = shuf(PAIRS).map(function (p) { return Math.random() < .5 ? p : [p[1], p[0]]; });
    if (l == 5) V.q = shuf(L5).map(function (x) { return Object.assign({}, x, { opts: x.opts.length > 2 ? shuf(x.opts) : x.opts }); });
    R();
  }
  function fin() {
    var l = V.l; if (S.done.indexOf(l) < 0) S.done.push(l); S.unlock = Math.max(S.unlock, Math.min(5, l + 1)); save();
    addStat("numblocks", who(), V.c, V.a); // 平台成績：第 l 關 答對 c／答了 a
    V.scr = S.done.length >= 5 ? "end" : "clear";
  }
  var ACT = {
    go: function (k) { start(+k); },
    hub: function () { V = { scr: "hub" }; R(); },
    ti: function () { V.seen.t = 1; R(); }, oi: function () { V.seen.o = 1; R(); },
    sq: function () { V.i = 0; R(); },
    nx: function () { V.i++; V.fb = null; V.tried = {}; if (V.i >= V.q.length) fin(); R(); },
    rt: function () { V.i = 0; V.fb = null; V.tried = {}; V.t = 0; V.o = 0; R(); },
    rs: function () { S = fresh(); save(); V = { scr: "hub" }; R(); },
    pk: function (k) {
      var q = V.q[V.i]; if (V.fb) return; k = +k;
      var r = String(q.opts[k]) == String(q.ans); rec(V.l, q.q, r, q.ans, q.opts[k]); V.tried[k] = 1;
      V.fb = r ? { ok: 1, m: "🎉 答對了！太棒了！" } : { ok: 0, m: "💡 提示：" + q.hint }; R();
    },
    ad: function (k) {
      if (V.fb) return; var p = k.split(","), f = p[0], d = +p[1];
      V[f] = Math.max(0, Math.min(f == "t" ? 9 : 19, V[f] + d)); R();
    },
    ck: function () {
      var q = V.q[V.i]; if (V.fb) return; var r = V.t * 10 + V.o == q;
      rec(2, "蓋出數字 " + q, r, q, V.t * 10 + V.o);
      if (r) V.fb = { ok: 1, m: "🎉 答對了！" + V.t + "條十＋" + V.o + "個一＝" + q };
      else {
        var tt = Math.floor(q / 10), oo = q % 10, m = "十位數字代表幾條十位積木，個位數字代表幾個個位積木。";
        if (V.t != tt) m += " 十位積木的數量再檢查一下喔！"; else if (V.o != oo) m += " 個位積木的數量再檢查一下喔！";
        if (V.o >= 10) m += " （10個一可以換成1條十）";
        V.fb = { ok: 0, m: "💡 提示：" + m };
      }
      R();
    },
    cp: function (x) {
      if (V.fb) return; x = +x; var p = V.q[V.i], big = Math.max(p[0], p[1]), sm = Math.min(p[0], p[1]), r = x == big;
      rec(4, "誰比較大 " + Math.min(p[0], p[1]) + " 和 " + Math.max(p[0], p[1]), r, big, x); V.tried[x] = 1;
      var tb = Math.floor(big / 10), ts = Math.floor(sm / 10);
      if (r) V.fb = { ok: 1, m: "🎉 答對了！" + big + " 比較大，因為" + (tb != ts ? "十位 " + tb + " 比 " + ts + " 大。" : "十位相同，個位 " + (big % 10) + " 比 " + (sm % 10) + " 大。") };
      else V.fb = { ok: 0, m: "💡 提示：先比較十位！左邊有 " + Math.floor(p[0] / 10) + " 條十，右邊有 " + Math.floor(p[1] / 10) + " 條十。" + (tb == ts ? "十位一樣多，再比個位。" : "再想想哪邊比較大？") };
      R();
    }
  };

  /* ---------- 畫面 ---------- */
  function fbH() {
    if (!V.fb) return "";
    return '<div class="nb-fb ' + (V.fb.ok ? "ok" : "no") + '">' + V.fb.m + "</div>" +
      (V.fb.ok ? btn("nx", undefined, "nb-b g", V.i + 1 >= V.q.length ? "完成本關 🏅" : "下一題 ➜") : btn("rt", undefined, "nb-b o", "↩ 回到本關第一題"));
  }
  function hub() {
    var h = '<div class="nb-card"><div style="font-size:3rem">🧱🏠🏗️</div><h2>數字積木建築師</h2><p>動手蓋積木，成為數字建築師！</p></div><div class="nb-card"><h3>五關進度</h3>';
    for (var l = 1; l <= 5; l++) h += btn("go", l, "nb-lc", "<em>" + (l > S.unlock ? "🔒" : S.done.indexOf(l) >= 0 ? EMO[l] : "⭐") + "</em><span>第" + l + "關・" + NAMES[l] + "<br><small>" + DESC[l] + "</small></span>", l > S.unlock ? " disabled" : "");
    return h + "</div>";
  }
  function intro() {
    var s = V.seen;
    return '<div class="nb-card"><p>點一點下面的積木！</p><div class="nb-two">' +
      btn("ti", undefined, "nb-side", B(1, 0) + "<b>十位積木</b>") + btn("oi", undefined, "nb-side", B(0, 1) + "<b>個位積木</b>") + "</div>" +
      (s.t ? '<div class="nb-fb ok">一條十位積木 ＝ <b>10</b></div>' : "") + (s.o ? '<div class="nb-fb ok">一個個位積木 ＝ <b>1</b></div>' : "") +
      btn("sq", undefined, "nb-b g", "開始問答 ➜", s.t && s.o ? "" : " disabled") + "</div>";
  }
  function quiz() {
    var q = V.q[V.i], ok = V.fb && V.fb.ok;
    var h = '<div class="nb-card"><small>第 ' + (V.i + 1) + "／" + V.q.length + ' 題</small><h2>' + q.q + "</h2>" + (q.vis ? B(q.vis[0], q.vis[1]) : "") + '<div class="nb-opts">';
    q.opts.forEach(function (o, k) { h += btn("pk", k, "nb-opt " + (V.tried[k] && String(o) != String(q.ans) ? "x" : "") + (ok && String(o) == String(q.ans) ? " g" : ""), o); });
    return h + "</div>" + fbH() + "</div>";
  }
  function build() {
    var q = V.q[V.i], v = V.t * 10 + V.o;
    return '<div class="nb-card"><small>第 ' + (V.i + 1) + "／" + V.q.length + ' 題</small><h2>請蓋出數字</h2><div class="nb-big">' + q + "</div>" +
      '<div class="nb-two"><div class="nb-zone"><b>十位積木</b>' + B(V.t, 0) + "<div>" + btn("ad", "t,-1", "nb-b o", "－") + "<b style='font-size:1.4rem'> " + V.t + " 條 </b>" + btn("ad", "t,1", "nb-b o", "＋") + "</div></div>" +
      '<div class="nb-zone u"><b>個位積木</b>' + B(0, V.o) + "<div>" + btn("ad", "o,-1", "nb-b", "－") + "<b style='font-size:1.4rem'> " + V.o + " 個 </b>" + btn("ad", "o,1", "nb-b", "＋") + "</div></div></div>" +
      "<p><b>" + V.t + "條十＋" + V.o + "個一＝<span style='font-size:1.8rem;color:var(--pri2)'>" + v + "</span></b></p>" + btn("ck", undefined, "nb-b g", "確認答案") + fbH() + "</div>";
  }
  function cmp() {
    var p = V.q[V.i], ok = V.fb && V.fb.ok, big = Math.max(p[0], p[1]);
    var h = '<div class="nb-card"><small>第 ' + (V.i + 1) + "／" + V.q.length + ' 題</small><h2>誰比較大？</h2><p>💡 先比較十位，十位相同時再比較個位。</p><div class="nb-two">';
    p.forEach(function (x) { h += btn("cp", x, "nb-side " + (V.tried[x] && x != big ? "x" : "") + (ok && x == big ? " g" : ""), BN(x) + '<div class="nb-big">' + x + "</div>"); });
    return h + "</div>" + fbH() + "</div>";
  }
  function lv() {
    var l = V.l;
    return '<div class="nb-card"><b>第' + l + "關・" + NAMES[l] + " " + EMO[l] + "</b><p>" + DESC[l] + "</p></div>" +
      (l == 1 && V.i < 0 ? intro() : l == 2 ? build() : l == 4 ? cmp() : quiz());
  }
  function clear() {
    var l = V.l;
    return '<div class="nb-card"><div class="nb-badge">' + EMO[l] + "</div><h2>🎉 第" + l + "關完成！</h2><p>獲得「" + NAMES[l] + "」建築徽章！</p>" + btn("go", l + 1, "nb-b g", "下一關 ➜") + "</div>";
  }
  function end() {
    return '<div class="nb-card"><div class="nb-badge">🏆</div><h2>恭喜你！你已經成為數字積木建築師！</h2><p>學生姓名：<b>' + who() + "</b></p><p>完成關卡數：<b>" + S.done.length + "</b></p><p>答對題數：<b>" + S.ok + "</b></p><p>獲得徽章數：<b>" + S.done.length + "</b> " + S.done.map(function (l) { return EMO[l]; }).join("") + "</p>" + btn("rs", undefined, "nb-b o", "🔄 重新挑戰") + "</div>";
  }
  function R() {
    var screens = { hub: hub, lv: lv, clear: clear, end: end };
    app.innerHTML = topbar("🧱 數字積木建築師") + '<div id="nb"><div class="nb-bar nz"><span>🏁 ' + S.done.length + "/5</span><span>✅ " + S.ok + "</span><span>" + (S.done.length ? S.done.map(function (l) { return EMO[l]; }).join("") : "🏅 無") + "</span></div>" + screens[V.scr]() + "</div>";
    bindBack();
    $("#nb").onclick = function (e) {
      var t = e.target.closest("[data-a]"); if (!t || t.disabled) return;
      var f = ACT[t.dataset.a]; if (f) f(t.dataset.k);
    };
    window.scrollTo(0, 0);
  }
  R();
}
