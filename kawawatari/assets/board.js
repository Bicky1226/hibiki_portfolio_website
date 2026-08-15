/* ==========================================================================
   川渡りパズル — ゲーム盤
   /kawawatari/ と /kawawatari/en/ で共有
   ページ側は <div id="rc-game"></div> を置くだけ。UIはすべてここで生成する。

   ページ側との連携:
     window.RiverCrossing.start()    計測を開始する
     window.RiverCrossing.isReady()  開始前かどうか
     window.RiverCrossing.solve()    現在の盤面から最短の次の一手を返す
     [data-rc-best-moves] [data-rc-best-time]  自己ベストの差し込み先
   ========================================================================== */
'use strict';

(function () {
  var root = document.getElementById('rc-game');
  if (!root) return;

  /* ----------------------------------------------------------------------
     登場人物
     ---------------------------------------------------------------------- */
  var CAST = [
    { id: 'father',  pilot: true,  symbol: 'rc-father'   },
    { id: 'mother',  pilot: true,  symbol: 'rc-mother'   },
    { id: 'sonA',    pilot: false, symbol: 'rc-son'      },
    { id: 'sonB',    pilot: false, symbol: 'rc-son'      },
    { id: 'dauA',    pilot: false, symbol: 'rc-daughter' },
    { id: 'dauB',    pilot: false, symbol: 'rc-daughter' },
    { id: 'servant', pilot: true,  symbol: 'rc-servant'  },
    { id: 'dog',     pilot: false, symbol: 'rc-dog'      }
  ];

  var PILOTS = {};
  CAST.forEach(function (c) { if (c.pilot) PILOTS[c.id] = true; });

  var FAMILY    = ['father', 'mother', 'sonA', 'sonB', 'dauA', 'dauB'];
  var SONS      = ['sonA', 'sonB'];
  var DAUGHTERS = ['dauA', 'dauB'];
  var OPTIMAL   = 17;

  var BEST_KEY      = 'hibiki_rc_best';
  var BEST_TIME_KEY = 'hibiki_rc_best_ms';

  /* ----------------------------------------------------------------------
     文言
     ---------------------------------------------------------------------- */
  var I18N = {
    ja: {
      names: {
        father: '父', mother: '母', sonA: '息子A', sonB: '息子B',
        dauA: '娘A', dauB: '娘B', servant: '召使い', dog: '犬'
      },
      bankL: '手前の岸', bankR: '向こう岸',
      moves: '手数', time: 'タイム', target: '最短', unit: '手',
      cross: '渡る', undo: '1手戻す', reset: '最初から',
      boatLabel: '舟（定員2名）',
      needPilot: '舟を出すには、父・母・召使いのいずれかが乗っている必要がある。',
      moved: function (who, dir, n) {
        return who + 'が' + (dir === 'R' ? '向こう岸' : '手前の岸') + 'へ渡った。（' + n + '手目）';
      },
      play: '人物をタップして舟に乗せ、「渡る」を押す。',
      readyHint: '「はじめる」を押すと計測が始まります。',
      stampReady: '用意', stampFail: '事件', stampClear: '成功',
      readyTitle: '八人を、対岸へ',
      readyBody: '押した瞬間からタイムの計測が始まります。',
      startBtn: 'はじめる',
      failTitle: {
        father: '父が娘に手をかけた',
        mother: '母が息子に手をかけた',
        dog:    '犬が家族に襲いかかった'
      },
      failBody: {
        father: '母のいない岸に、父と娘を残してしまった。',
        mother: '父のいない岸に、母と息子を残してしまった。',
        dog:    '召使いのいない岸に、犬と家族を残してしまった。'
      },
      clearTitle: '全員、無事に渡り切った',
      clearBody: function (n) {
        if (n === OPTIMAL) return 'これが最短手数です。';
        return '最短は' + OPTIMAL + '手。まだ縮められます。';
      },
      newBestMoves: '最少手数を更新', newBestTime: '最速タイムを更新',
      againClear: 'もう一度遊ぶ',
      undone: function (n) { return '1手戻した。（現在' + n + '手目）'; },
      none: '—'
    },
    en: {
      names: {
        father: 'Father', mother: 'Mother', sonA: 'Son A', sonB: 'Son B',
        dauA: 'Daughter A', dauB: 'Daughter B', servant: 'Servant', dog: 'Dog'
      },
      bankL: 'Near bank', bankR: 'Far bank',
      moves: 'Moves', time: 'Time', target: 'Best possible', unit: '',
      cross: 'Cross', undo: 'Undo', reset: 'Restart',
      boatLabel: 'Boat (seats 2)',
      needPilot: 'The boat needs the Father, the Mother or the Servant aboard to move.',
      moved: function (who, dir, n) {
        return who + ' crossed to the ' + (dir === 'R' ? 'far bank' : 'near bank') + '. (move ' + n + ')';
      },
      play: 'Tap a character to put them in the boat, then press Cross.',
      readyHint: 'The timer starts when you press Start.',
      stampReady: 'READY', stampFail: 'FAIL', stampClear: 'SOLVED',
      readyTitle: 'Eight to the far bank',
      readyBody: 'The clock starts the moment you press it.',
      startBtn: 'Start',
      failTitle: {
        father: 'The father turned on his daughter',
        mother: 'The mother turned on her son',
        dog:    'The dog attacked the family'
      },
      failBody: {
        father: 'A daughter was left on a bank with the father and no mother.',
        mother: 'A son was left on a bank with the mother and no father.',
        dog:    'The family was left on a bank with the dog and no servant.'
      },
      clearTitle: 'Everyone made it across safely',
      clearBody: function (n) {
        if (n === OPTIMAL) return 'That is the shortest solution possible.';
        return 'The shortest possible is ' + OPTIMAL + ' — there is room to improve.';
      },
      newBestMoves: 'Fewest moves — new best', newBestTime: 'Fastest time — new best',
      againClear: 'Play again',
      undone: function (n) { return 'Move undone. (now at move ' + n + ')'; },
      none: '—'
    }
  };

  var T = I18N[document.documentElement.lang === 'en' ? 'en' : 'ja'];

  /* ----------------------------------------------------------------------
     ルール判定 — ゲーム本体とソルバの唯一の正
     occupants: 岸にいる人物 id の Set
     ---------------------------------------------------------------------- */
  function violationsOn(occupants) {
    var out = [];
    var i, victims;

    if (occupants.has('father') && !occupants.has('mother')) {
      victims = [];
      for (i = 0; i < DAUGHTERS.length; i++) {
        if (occupants.has(DAUGHTERS[i])) victims.push(DAUGHTERS[i]);
      }
      if (victims.length) out.push({ rule: 'father', victims: victims });
    }

    if (occupants.has('mother') && !occupants.has('father')) {
      victims = [];
      for (i = 0; i < SONS.length; i++) {
        if (occupants.has(SONS[i])) victims.push(SONS[i]);
      }
      if (victims.length) out.push({ rule: 'mother', victims: victims });
    }

    if (occupants.has('dog') && !occupants.has('servant')) {
      victims = [];
      for (i = 0; i < FAMILY.length; i++) {
        if (occupants.has(FAMILY[i])) victims.push(FAMILY[i]);
      }
      if (victims.length) out.push({ rule: 'dog', victims: victims });
    }

    return out;
  }

  /* ----------------------------------------------------------------------
     ソルバ — 現在の盤面から最短手順を幅優先探索し、次の1手を返す
     状態 = 「向こう岸にいる人物のビットマスク」×2 + 舟の side
     ---------------------------------------------------------------------- */
  var ALL_MASK = (1 << CAST.length) - 1;

  function maskToSet(mask) {
    var s = new Set();
    for (var i = 0; i < CAST.length; i++) {
      if ((mask >> i) & 1) s.add(CAST[i].id);
    }
    return s;
  }

  var safeCache = {};
  function maskSafe(mask) {
    if (!(mask in safeCache)) safeCache[mask] = violationsOn(maskToSet(mask)).length === 0;
    return safeCache[mask];
  }

  function nextBestMove(pos, boatSide) {
    // 舟に乗っている人物は、舟のいる岸にいるものとして解き直す
    var rightMask = 0;
    for (var i = 0; i < CAST.length; i++) {
      var where = pos[CAST[i].id];
      if (where === 'R' || (where === 'boat' && boatSide === 'R')) rightMask |= (1 << i);
    }

    var start = rightMask * 2 + (boatSide === 'R' ? 1 : 0);
    var goal  = ALL_MASK * 2 + 1;
    if (start === goal) return null;

    var prev = new Map();
    prev.set(start, null);
    var frontier = [start];

    while (frontier.length && !prev.has(goal)) {
      var next = [];
      for (var f = 0; f < frontier.length; f++) {
        var st = frontier[f];
        var rm = st >> 1;
        var sd = st & 1;
        var srcMask = sd === 1 ? rm : (ALL_MASK & ~rm);

        var here = [];
        for (var k = 0; k < CAST.length; k++) if ((srcMask >> k) & 1) here.push(k);

        var combos = [];
        for (var a = 0; a < here.length; a++) {
          combos.push([here[a]]);
          for (var b = a + 1; b < here.length; b++) combos.push([here[a], here[b]]);
        }

        for (var c = 0; c < combos.length; c++) {
          var combo = combos[c];
          var hasPilot = false;
          for (var p = 0; p < combo.length; p++) if (CAST[combo[p]].pilot) hasPilot = true;
          if (!hasPilot) continue;

          var nrm = rm;
          for (var q = 0; q < combo.length; q++) {
            nrm = sd === 1 ? (nrm & ~(1 << combo[q])) : (nrm | (1 << combo[q]));
          }
          if (!maskSafe(nrm) || !maskSafe(ALL_MASK & ~nrm)) continue;

          var ns = nrm * 2 + (1 - sd);
          if (prev.has(ns)) continue;
          prev.set(ns, [st, combo]);
          next.push(ns);
        }
      }
      frontier = next;
    }

    if (!prev.has(goal)) return null;

    var cur = goal;
    var first = null;
    while (prev.get(cur)) {
      var step = prev.get(cur);
      first = step[1];
      cur = step[0];
    }
    return first.map(function (i) { return CAST[i].id; });
  }

  /* ----------------------------------------------------------------------
     SVG スプライト
     ---------------------------------------------------------------------- */
  var SPRITE =
    '<svg class="rc-sprite" aria-hidden="true" focusable="false">' +
      /* 大人の男 — 肩幅のある直線的な胴と、はっきり分かれた2本の脚 */
      '<symbol id="rc-father" viewBox="0 0 40 56">' +
        '<circle cx="20" cy="10.6" r="6.4"/>' +
        '<path d="M13 19.4h14c1.7 0 3 1.4 3 3v14.4H10V22.4c0-1.6 1.3-3 3-3z"/>' +
        '<rect x="11.8" y="35" width="7" height="19" rx="1.2"/>' +
        '<rect x="21.2" y="35" width="7" height="19" rx="1.2"/>' +
      '</symbol>' +
      /* 大人の女 — 長い髪とロングスカート */
      '<symbol id="rc-mother" viewBox="0 0 40 56">' +
        '<path d="M20 19.4c-5.4 0-9.4 2.8-10 7.1L7 54h26l-3-27.5c-.6-4.3-4.6-7.1-10-7.1z"/>' +
        '<path d="M20 4.2c-4.1 0-7.5 3.4-7.5 7.6 0 3.7.6 6.9 1.5 9.4h12c.9-2.5 1.5-5.7 1.5-9.4 0-4.2-3.4-7.6-7.5-7.6z"/>' +
      '</symbol>' +
      /* 子（男） — 大人より頭身が低く、胴も短い */
      '<symbol id="rc-son" viewBox="0 0 40 56">' +
        '<circle cx="20" cy="21.2" r="5.4"/>' +
        '<path d="M15 28h10c1.4 0 2.5 1.1 2.5 2.5v11.8h-15V30.5c0-1.4 1.1-2.5 2.5-2.5z"/>' +
        '<rect x="14" y="41" width="5.6" height="13" rx="1"/>' +
        '<rect x="20.4" y="41" width="5.6" height="13" rx="1"/>' +
      '</symbol>' +
      /* 子（女） — 髪とスカート */
      '<symbol id="rc-daughter" viewBox="0 0 40 56">' +
        '<path d="M20 27.4c-4.4 0-7.6 2.2-8.2 5.6L10 54h20l-1.8-21c-.6-3.4-3.8-5.6-8.2-5.6z"/>' +
        '<path d="M20 15.4c-3.4 0-6.2 2.9-6.2 6.4 0 3 .5 5.5 1.2 7.4h10c.7-1.9 1.2-4.4 1.2-7.4 0-3.5-2.8-6.4-6.2-6.4z"/>' +
      '</symbol>' +
      /* 召使い — 白いエプロンと蝶ネクタイで見分ける */
      '<symbol id="rc-servant" viewBox="0 0 40 56">' +
        '<circle cx="20" cy="10.6" r="6.4"/>' +
        '<path d="M13 19.4h14c1.7 0 3 1.4 3 3v14.4H10V22.4c0-1.6 1.3-3 3-3z"/>' +
        '<rect x="11.8" y="35" width="7" height="19" rx="1.2"/>' +
        '<rect x="21.2" y="35" width="7" height="19" rx="1.2"/>' +
        /* <use> のシャドウツリー内は CSS セレクタが届かないので、
           継承されるカスタムプロパティで紙色に塗る */
        '<path style="fill:var(--rc-cut)" d="M15.4 25.5h9.2v9c0 2-1.6 3.2-4.6 3.2s-4.6-1.2-4.6-3.2z"/>' +
        '<path style="fill:var(--rc-cut)" d="M20 21.6l-4 -2.2v4.6zM20 21.6l4 -2.2v4.6z"/>' +
      '</symbol>' +
      '<symbol id="rc-dog" viewBox="0 0 40 56">' +
        '<path d="M8.5 32.5c-3.2-1-5.4-4.3-4.8-8l3.1.6c-.4 2.2.9 4.2 2.9 5z"/>' +
        '<rect x="7" y="30" width="21" height="11.5" rx="5.2"/>' +
        '<circle cx="29" cy="29" r="6.2"/>' +
        '<rect x="31.5" y="28.6" width="6.8" height="4.8" rx="2.2"/>' +
        '<path d="M25.4 23.8l-1.6-6.4 5.9 4.2z"/>' +
        '<rect x="9.6" y="40" width="3.7" height="11.5" rx="1.5"/>' +
        '<rect x="15.4" y="40" width="3.7" height="11.5" rx="1.5"/>' +
        '<rect x="22" y="40" width="3.7" height="11.5" rx="1.5"/>' +
      '</symbol>' +
    '</svg>';

  /* ----------------------------------------------------------------------
     UI 構築
     ---------------------------------------------------------------------- */
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function tileMarkup(c) {
    return '<button type="button" class="rc-tile' + (c.pilot ? ' rc-tile--pilot' : '') + '"' +
             ' data-id="' + c.id + '" data-order="' + CAST.indexOf(c) + '"' +
             ' aria-pressed="false">' +
             '<span class="rc-tile-fig"><svg aria-hidden="true" focusable="false">' +
               '<use href="#' + c.symbol + '"></use></svg></span>' +
             '<span class="rc-tile-name">' + esc(T.names[c.id]) + '</span>' +
           '</button>';
  }

  root.innerHTML =
    SPRITE +
    '<div class="rc-hud">' +
      '<p class="rc-hud-item"><span class="rc-hud-label">' + esc(T.moves) + '</span>' +
        '<span class="rc-hud-value font-en" id="rc-moves">0</span></p>' +
      '<p class="rc-hud-item"><span class="rc-hud-label">' + esc(T.time) + '</span>' +
        '<span class="rc-hud-value font-en" id="rc-time">0:00.0</span></p>' +
      '<p class="rc-hud-item rc-hud-item--target"><span class="rc-hud-label">' + esc(T.target) + '</span>' +
        '<span class="rc-hud-value font-en">' + OPTIMAL + esc(T.unit) + '</span></p>' +
    '</div>' +

    '<div class="rc-stage">' +
      '<section class="rc-bank" aria-label="' + esc(T.bankL) + '">' +
        '<h3 class="rc-bank-name">' + esc(T.bankL) + '</h3>' +
        '<div class="rc-slots" id="rc-bank-L"></div>' +
      '</section>' +

      '<div class="rc-river">' +
        '<div class="rc-water" aria-hidden="true"></div>' +
        '<div class="rc-boat" id="rc-boat" data-side="L" aria-label="' + esc(T.boatLabel) + '">' +
          '<div class="rc-boat-slots" id="rc-boat-slots"></div>' +
          '<svg class="rc-hull" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">' +
            '<path d="M2 1h116l-11 20c-1 2-3 3-5 3H18c-2 0-4-1-5-3z"/>' +
          '</svg>' +
        '</div>' +
      '</div>' +

      '<section class="rc-bank" aria-label="' + esc(T.bankR) + '">' +
        '<h3 class="rc-bank-name">' + esc(T.bankR) + '</h3>' +
        '<div class="rc-slots" id="rc-bank-R"></div>' +
      '</section>' +

      '<div class="rc-overlay" id="rc-overlay" hidden>' +
        '<div class="rc-card" role="alertdialog" aria-labelledby="rc-card-title">' +
          '<p class="rc-stamp" id="rc-stamp" aria-hidden="true"></p>' +
          '<h3 class="rc-card-title" id="rc-card-title"></h3>' +
          '<p class="rc-card-body" id="rc-card-body"></p>' +
          '<div class="rc-card-stats" id="rc-card-stats" hidden>' +
            '<p class="rc-stat"><span class="rc-stat-label">' + esc(T.moves) + '</span>' +
              '<span class="rc-stat-value font-en" id="rc-stat-moves"></span></p>' +
            '<p class="rc-stat"><span class="rc-stat-label">' + esc(T.time) + '</span>' +
              '<span class="rc-stat-value font-en" id="rc-stat-time"></span></p>' +
          '</div>' +
          '<p class="rc-card-flag" id="rc-card-flag" hidden></p>' +
          '<div class="rc-card-actions" id="rc-card-actions"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="rc-controls">' +
      '<button type="button" class="rc-btn rc-btn--go" id="rc-go">' +
        '<span class="rc-go-label">' + esc(T.cross) + '</span>' +
        '<span class="rc-go-arrow" id="rc-go-arrow" aria-hidden="true">→</span></button>' +
      '<button type="button" class="rc-btn" id="rc-undo">' + esc(T.undo) + '</button>' +
      '<button type="button" class="rc-btn" id="rc-reset">' + esc(T.reset) + '</button>' +
    '</div>' +

    '<p class="rc-status" id="rc-status" role="status" aria-live="polite">' + esc(T.readyHint) + '</p>';

  var el = {
    bankL:      root.querySelector('#rc-bank-L'),
    bankR:      root.querySelector('#rc-bank-R'),
    boat:       root.querySelector('#rc-boat'),
    boatSlots:  root.querySelector('#rc-boat-slots'),
    river:      root.querySelector('.rc-river'),
    moves:      root.querySelector('#rc-moves'),
    time:       root.querySelector('#rc-time'),
    go:         root.querySelector('#rc-go'),
    goArrow:    root.querySelector('#rc-go-arrow'),
    undo:       root.querySelector('#rc-undo'),
    reset:      root.querySelector('#rc-reset'),
    status:     root.querySelector('#rc-status'),
    overlay:    root.querySelector('#rc-overlay'),
    stamp:      root.querySelector('#rc-stamp'),
    cardTitle:  root.querySelector('#rc-card-title'),
    cardBody:   root.querySelector('#rc-card-body'),
    cardStats:  root.querySelector('#rc-card-stats'),
    statMoves:  root.querySelector('#rc-stat-moves'),
    statTime:   root.querySelector('#rc-stat-time'),
    cardFlag:   root.querySelector('#rc-card-flag'),
    cardActs:   root.querySelector('#rc-card-actions')
  };

  var tiles = {};
  CAST.forEach(function (c) {
    var wrap = document.createElement('div');
    wrap.innerHTML = tileMarkup(c);
    tiles[c.id] = wrap.firstChild;
  });

  /* ----------------------------------------------------------------------
     状態
     ---------------------------------------------------------------------- */
  var state, history, busy;

  function freshState() {
    var pos = {};
    CAST.forEach(function (c) { pos[c.id] = 'L'; });
    return { pos: pos, boatSide: 'L', moves: 0, status: 'ready' };
  }

  /* 履歴に積む断面。乗船中の人物は出発側の岸に戻した形で保存する
     — こうしておくと「1手戻す」で舟が必ず空の状態に復元される */
  function snapshot() {
    var pos = {};
    CAST.forEach(function (c) {
      var where = state.pos[c.id];
      pos[c.id] = where === 'boat' ? state.boatSide : where;
    });
    return { pos: pos, boatSide: state.boatSide, moves: state.moves, status: 'playing' };
  }

  function occupantsOf(side) {
    var s = new Set();
    CAST.forEach(function (c) { if (state.pos[c.id] === side) s.add(c.id); });
    return s;
  }

  function boatRiders() {
    return CAST.filter(function (c) { return state.pos[c.id] === 'boat'; })
               .map(function (c) { return c.id; });
  }

  /* ----------------------------------------------------------------------
     ストップウォッチ
     ---------------------------------------------------------------------- */
  var timer = { base: 0, elapsed: 0, raf: 0, shown: -1, running: false };

  function fmtTime(ms) {
    var t = Math.max(0, ms);
    var m = Math.floor(t / 60000);
    var s = Math.floor((t % 60000) / 1000);
    var d = Math.floor((t % 1000) / 100);
    return m + ':' + (s < 10 ? '0' : '') + s + '.' + d;
  }

  /* rAF で回すが、DOM の書き換えは 1/10 秒の桁が変わったときだけ */
  function timerTick() {
    if (!timer.running) return;
    timer.elapsed = performance.now() - timer.base;
    var tenths = Math.floor(timer.elapsed / 100);
    if (tenths !== timer.shown) {
      timer.shown = tenths;
      el.time.textContent = fmtTime(timer.elapsed);
    }
    timer.raf = window.requestAnimationFrame(timerTick);
  }

  function startTimer() {
    timer.base = performance.now();
    timer.elapsed = 0;
    timer.shown = -1;
    timer.running = true;
    timerTick();
  }

  function stopTimer() {
    if (timer.running) timer.elapsed = performance.now() - timer.base;
    timer.running = false;
    if (timer.raf) window.cancelAnimationFrame(timer.raf);
    timer.raf = 0;
    el.time.textContent = fmtTime(timer.elapsed);
  }

  function resetTimer() {
    timer.running = false;
    if (timer.raf) window.cancelAnimationFrame(timer.raf);
    timer.raf = 0;
    timer.elapsed = 0;
    timer.shown = -1;
    el.time.textContent = fmtTime(0);
  }

  /* ----------------------------------------------------------------------
     DOM 配置 + FLIP アニメーション
     ---------------------------------------------------------------------- */
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function noAnim() { return reduceMotion.matches; }

  function containerFor(where) {
    if (where === 'boat') return el.boatSlots;
    return where === 'R' ? el.bankR : el.bankL;
  }

  function place(id) {
    var tile = tiles[id];
    var box = containerFor(state.pos[id]);
    var order = Number(tile.dataset.order);
    var ref = null;
    for (var i = 0; i < box.children.length; i++) {
      if (box.children[i] === tile) continue;
      if (Number(box.children[i].dataset.order) > order) { ref = box.children[i]; break; }
    }
    box.insertBefore(tile, ref);
  }

  function placeAll() {
    CAST.forEach(function (c) { place(c.id); });
  }

  function flip(mutate) {
    var list = CAST.map(function (c) { return tiles[c.id]; });
    var before = list.map(function (t) { return t.getBoundingClientRect(); });
    mutate();
    if (noAnim()) return;
    list.forEach(function (t, i) {
      var a = before[i];
      var b = t.getBoundingClientRect();
      var dx = a.left - b.left;
      var dy = a.top - b.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      t.animate(
        [{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'translate(0,0)' }],
        { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)' }
      );
    });
  }

  /* 舟の移動距離（川の幅 − 舟の幅）を CSS 変数に流し込む */
  function syncTravel() {
    var d = Math.max(0, el.river.clientWidth - el.boat.offsetWidth);
    root.style.setProperty('--rc-travel', d + 'px');
  }
  if (window.ResizeObserver) {
    new ResizeObserver(syncTravel).observe(el.river);
  } else {
    window.addEventListener('resize', syncTravel);
  }

  /* ----------------------------------------------------------------------
     記録
     ---------------------------------------------------------------------- */
  function readNum(key) {
    try {
      var v = parseInt(window.localStorage.getItem(key), 10);
      return isNaN(v) ? null : v;
    } catch (e) { return null; }
  }

  function writeNum(key, n) {
    try { window.localStorage.setItem(key, String(n)); } catch (e) { /* noop */ }
  }

  /* 自己ベストはページ側の任意の要素に差し込む */
  function fill(selector, text) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text;
  }

  function renderBests() {
    var m = readNum(BEST_KEY);
    var t = readNum(BEST_TIME_KEY);
    fill('[data-rc-best-moves]', m === null ? T.none : m + T.unit);
    fill('[data-rc-best-time]', t === null ? T.none : fmtTime(t));
  }

  /* ----------------------------------------------------------------------
     描画
     ---------------------------------------------------------------------- */
  function render() {
    var riders = boatRiders();
    var playable = state.status === 'playing' && !busy;

    CAST.forEach(function (c) {
      var tile = tiles[c.id];
      var where = state.pos[c.id];
      var aboard = where === 'boat';
      var reachable = aboard || where === state.boatSide;
      tile.setAttribute('aria-pressed', aboard ? 'true' : 'false');
      tile.classList.toggle('is-aboard', aboard);
      tile.disabled = !playable || !reachable || (!aboard && riders.length >= 2);
    });

    el.boat.dataset.side = state.boatSide;
    el.boat.classList.toggle('is-crossing', busy);
    el.moves.textContent = String(state.moves);
    el.goArrow.textContent = state.boatSide === 'L' ? '→' : '←';

    var hasPilot = riders.some(function (id) { return PILOTS[id] === true; });
    el.go.disabled = !playable || riders.length === 0 || !hasPilot;
    el.undo.disabled = busy || state.status === 'ready' ||
                       (history.length === 0 && riders.length === 0);
    el.reset.disabled = busy || state.status === 'ready';
  }

  function say(msg) { el.status.textContent = msg; }

  /* ----------------------------------------------------------------------
     操作
     ---------------------------------------------------------------------- */
  function startGame() {
    if (state.status !== 'ready') return;
    hideOverlay();
    state.status = 'playing';
    startTimer();
    render();
    say(T.play);
  }

  function toggleBoard(id) {
    if (busy || state.status !== 'playing') return;
    var where = state.pos[id];

    if (where === 'boat') {
      flip(function () { state.pos[id] = state.boatSide; place(id); });
    } else {
      if (where !== state.boatSide) return;
      if (boatRiders().length >= 2) return;
      flip(function () { state.pos[id] = 'boat'; place(id); });
    }

    render();

    var riders = boatRiders();
    if (riders.length && el.go.disabled && state.status === 'playing') say(T.needPilot);
  }

  function nameList(ids) {
    return ids.map(function (id) { return T.names[id]; })
              .join(document.documentElement.lang === 'en' ? ' and ' : 'と');
  }

  function cross() {
    if (el.go.disabled) return;

    var riders = boatRiders();
    var from = state.boatSide;
    var to = from === 'L' ? 'R' : 'L';

    history.push(snapshot());
    busy = true;
    state.boatSide = to;
    state.moves += 1;
    render();

    var wait = noAnim() ? 0 : 900;
    window.setTimeout(function () {
      flip(function () {
        riders.forEach(function (id) { state.pos[id] = to; });
        placeAll();
      });
      busy = false;

      var bad = violationsOn(occupantsOf('L')).concat(violationsOn(occupantsOf('R')));
      if (bad.length) {
        /* 事件が起きてもタイマーは止めない — 失敗して戻した時間もタイムのうち */
        state.status = 'failed';
        showFail(bad[0]);
      } else if (occupantsOf('R').size === CAST.length) {
        state.status = 'cleared';
        showClear();
      } else {
        say(T.moved(nameList(riders), to, state.moves));
      }
      render();
    }, wait);
  }

  function undo() {
    if (el.undo.disabled) return;
    hideOverlay();

    if (history.length === 0) {
      flip(function () {
        boatRiders().forEach(function (id) { state.pos[id] = state.boatSide; });
        placeAll();
      });
      state.status = 'playing';
      render();
      say(T.play);
      return;
    }

    var prev = history.pop();
    flip(function () {
      state = prev;
      placeAll();
    });
    render();
    say(state.moves === 0 ? T.play : T.undone(state.moves));
  }

  /* 「最初から」は ready まで戻す — もう一度「はじめる」を押して計測し直す */
  function reset() {
    if (busy) return;
    hideOverlay();
    resetTimer();
    flip(function () {
      state = freshState();
      history = [];
      placeAll();
    });
    render();
    showReady(true);
  }

  /* ----------------------------------------------------------------------
     オーバーレイ
     ---------------------------------------------------------------------- */
  function actionButton(label, fn, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'rc-btn' + (primary ? ' rc-btn--go' : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }

  /* o: { kind, stamp, title, body, flag, stats, actions, focus } */
  function showOverlay(o) {
    el.overlay.dataset.kind = o.kind;
    el.stamp.textContent = o.stamp;
    el.cardTitle.textContent = o.title;
    el.cardBody.textContent = o.body;

    if (o.stats) {
      el.cardStats.hidden = false;
      el.statMoves.textContent = o.stats.moves;
      el.statTime.textContent = o.stats.time;
    } else {
      el.cardStats.hidden = true;
    }

    if (o.flag) { el.cardFlag.hidden = false; el.cardFlag.textContent = o.flag; }
    else { el.cardFlag.hidden = true; el.cardFlag.textContent = ''; }

    el.cardActs.innerHTML = '';
    o.actions.forEach(function (a) { el.cardActs.appendChild(a); });
    el.overlay.hidden = false;
    say(o.status || (o.title + ' ' + o.body));

    /* 初回表示でフォーカスを当てるとページが盤面までスクロールしてしまうので、
       明示的に focus:true のときだけ当てる */
    if (o.focus) {
      window.setTimeout(function () {
        var first = el.cardActs.querySelector('button');
        if (first) first.focus();
      }, 30);
    }
  }

  function hideOverlay() {
    el.overlay.hidden = true;
    el.cardActs.innerHTML = '';
  }

  function showReady(focus) {
    showOverlay({
      kind: 'ready', stamp: T.stampReady,
      title: T.readyTitle, body: T.readyBody,
      status: T.readyHint,
      actions: [actionButton(T.startBtn, startGame, true)],
      focus: !!focus
    });
  }

  function showFail(v) {
    showOverlay({
      kind: 'fail', stamp: T.stampFail,
      title: T.failTitle[v.rule], body: T.failBody[v.rule],
      actions: [actionButton(T.undo, undo, true), actionButton(T.reset, reset, false)],
      focus: true
    });
  }

  function showClear() {
    stopTimer();
    var ms = Math.round(timer.elapsed);

    var prevMoves = readNum(BEST_KEY);
    var prevTime  = readNum(BEST_TIME_KEY);
    var newMoves  = prevMoves === null || state.moves < prevMoves;
    var newTime   = prevTime === null || ms < prevTime;

    if (newMoves) writeNum(BEST_KEY, state.moves);
    if (newTime)  writeNum(BEST_TIME_KEY, ms);
    renderBests();

    /* 初回クリアは「更新」ではないのでバッジを出さない */
    var flags = [];
    if (newMoves && prevMoves !== null) flags.push(T.newBestMoves);
    if (newTime && prevTime !== null) flags.push(T.newBestTime);

    showOverlay({
      kind: 'clear', stamp: T.stampClear,
      title: T.clearTitle, body: T.clearBody(state.moves),
      stats: { moves: state.moves + T.unit, time: fmtTime(ms) },
      flag: flags.join('　／　') || null,
      actions: [actionButton(T.againClear, reset, true)],
      focus: true
    });
  }

  /* ----------------------------------------------------------------------
     起動
     ---------------------------------------------------------------------- */
  CAST.forEach(function (c) {
    tiles[c.id].addEventListener('click', function () { toggleBoard(c.id); });
  });
  el.go.addEventListener('click', cross);
  el.undo.addEventListener('click', undo);
  el.reset.addEventListener('click', reset);

  state = freshState();
  history = [];
  busy = false;
  placeAll();
  renderBests();
  render();
  syncTravel();
  showReady(false);

  window.RiverCrossing = {
    start: startGame,
    isReady: function () { return state.status === 'ready'; },
    solve: function () { return nextBestMove(state.pos, state.boatSide); }
  };
})();
