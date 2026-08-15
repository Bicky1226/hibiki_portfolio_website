/* ==========================================================================
   川渡り — ページ側のスクリプト
     1. ヒーローの「はじめる」→ 盤面まで送ってゲーム開始
     2. Cookie 同意と GA4
   ========================================================================== */
'use strict';

(function () {
  var COOKIE_KEY = 'hibiki_cookie_accepted';
  var GA4_ID     = 'G-6T1D5MDSXL';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------------------
     ヒーローの開始ボタン
     盤面が画面に収まってからタイマーを走らせたいので、スクロール後に始める
     ---------------------------------------------------------------------- */
  var startBtn = document.getElementById('kw-start');
  var boardSection = document.getElementById('game');

  if (startBtn && boardSection) {
    startBtn.addEventListener('click', function () {
      boardSection.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start'
      });
      window.setTimeout(function () {
        if (window.RiverCrossing) window.RiverCrossing.start();
      }, reduceMotion ? 0 : 520);
    });
  }

  /* ----------------------------------------------------------------------
     Cookie 同意
     ---------------------------------------------------------------------- */
  function loadGA4() {
    if (document.querySelector('script[src*="googletagmanager.com/gtag"]')) return;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  function readConsent() {
    try { return window.localStorage.getItem(COOKIE_KEY); } catch (e) { return null; }
  }

  function writeConsent(v) {
    try { window.localStorage.setItem(COOKIE_KEY, v); } catch (e) { /* noop */ }
  }

  var banner = document.getElementById('kw-cookie');
  var consent = readConsent();

  if (consent === 'accepted') {
    loadGA4();
  } else if (consent !== 'rejected' && banner) {
    /* まだ答えていない人にだけ、少し遅らせて出す */
    window.setTimeout(function () { banner.hidden = false; }, 1200);

    var accept = banner.querySelector('#kw-cookie-accept');
    var reject = banner.querySelector('#kw-cookie-reject');

    if (accept) {
      accept.addEventListener('click', function () {
        writeConsent('accepted');
        loadGA4();
        banner.hidden = true;
      });
    }
    if (reject) {
      reject.addEventListener('click', function () {
        writeConsent('rejected');
        banner.hidden = true;
      });
    }
  }
})();
