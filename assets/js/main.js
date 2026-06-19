/* main.js — nav, language switch, cookie banner, smooth scroll, scroll animations */

'use strict';

/* config */
const LANG_KEY     = 'hibiki_lang';
const COOKIE_KEY   = 'hibiki_cookie_accepted';
const SUPPORTED    = ['ja', 'en'];
const URL_BASE     = { ja: '/ja/', en: '/en/' };

/* language detection & switching */
const LangController = {
  get current() {
    return localStorage.getItem(LANG_KEY) || this.detect();
  },

  detect() {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    const browser = navigator.language?.slice(0, 2).toLowerCase();
    return SUPPORTED.includes(browser) ? browser : 'ja';
  },

  set(lang) {
    if (!SUPPORTED.includes(lang)) return;
    localStorage.setItem(LANG_KEY, lang);
    this.updateUI(lang);
  },

  updateUI(lang) {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
  },

  /**
   * Navigate to the same page in the target language.
   * Replaces /ja/ or /en/ prefix in the path.
   */
  navigate(lang) {
    if (!SUPPORTED.includes(lang)) return;
    const path = window.location.pathname;
    let newPath = path;

    for (const l of SUPPORTED) {
      const prefix = `/${l}/`;
      if (path.startsWith(prefix)) {
        newPath = `/${lang}/` + path.slice(prefix.length);
        break;
      }
      if (path === `/${l}`) {
        newPath = `/${lang}`;
        break;
      }
    }

    // If no lang prefix found, add one
    if (newPath === path && !SUPPORTED.some(l => path.startsWith(`/${l}/`))) {
      newPath = `/${lang}${path}`;
    }

    this.set(lang);
    window.location.href = newPath;
  },

  init() {
    const lang = this.detect();
    this.updateUI(lang);

    // Bind flag buttons
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.lang;
        if (target !== this.current) {
          this.navigate(target);
        }
      });
    });
  }
};

/* cookie banner */
const GA4_ID = 'G-6T1D5MDSXL';

const CookieBanner = {
  init() {
    const banner = document.getElementById('cookie-banner');
    if (!banner) return;

    const consent = localStorage.getItem(COOKIE_KEY);

    // Already answered — apply choice and hide
    if (consent === 'accepted') {
      banner.classList.add('hidden');
      this.loadGA4();
      return;
    }
    if (consent === 'rejected') {
      banner.classList.add('hidden');
      return;
    }

    // Not yet answered — show banner
    setTimeout(() => banner.classList.add('visible'), 1200);

    const acceptBtn = banner.querySelector('#cookie-accept');
    const rejectBtn = banner.querySelector('#cookie-reject');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        localStorage.setItem(COOKIE_KEY, 'accepted');
        this.loadGA4();
        this.hideBanner(banner);
      });
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => {
        localStorage.setItem(COOKIE_KEY, 'rejected');
        this.hideBanner(banner);
      });
    }
  },

  hideBanner(banner) {
    banner.classList.remove('visible');
    setTimeout(() => banner.classList.add('hidden'), 600);
  },

  loadGA4() {
    if (document.querySelector('script[src*="googletagmanager.com/gtag"]')) return;
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }
};

/* navigation */
const NavController = {
  nav: null,
  lastScroll: 0,
  threshold: 80,

  init() {
    this.nav = document.getElementById('main-nav');
    if (!this.nav) return;

    // Initialize to current position so the first scroll event has no false delta
    this.lastScroll = window.scrollY;

    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.initHamburger();
  },

  onScroll() {
    const scrollY = window.scrollY;
    const delta   = scrollY - this.lastScroll;

    // Glass effect on scroll
    if (scrollY > 20) {
      this.nav.classList.add('nav-scrolled');
    } else {
      this.nav.classList.remove('nav-scrolled');
    }

    // Hide on scroll down, show on scroll up
    // Require delta > 8px to ignore micro-movements from Lenis
    if (scrollY > this.threshold && Math.abs(delta) > 8) {
      if (delta > 0) {
        this.nav.classList.add('nav-hidden');
      } else {
        this.nav.classList.remove('nav-hidden');
      }
    }

    this.lastScroll = scrollY;
  },

  initHamburger() {
    const hamburger = document.querySelector('.nav-hamburger');
    const navLinks  = document.querySelector('.nav-links');
    const nav       = document.getElementById('main-nav');
    if (!hamburger || !navLinks || !nav) return;

    // On mobile: move overlay to <body> so z-index: 9999 applies in the root
    // stacking context (not confined by #main-nav's stacking context).
    // On desktop: keep inside nav so flex layout works correctly.
    const mql = window.matchMedia('(max-width: 768px)');
    const applyPlacement = (isMobile) => {
      if (isMobile && navLinks.parentNode !== document.body) {
        document.body.appendChild(navLinks);
      } else if (!isMobile && navLinks.parentNode !== nav) {
        nav.appendChild(navLinks);
      }
    };
    applyPlacement(mql.matches);
    mql.addEventListener('change', e => applyPlacement(e.matches));

    const closeMenu = () => {
      navLinks.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    // Inject X close button into overlay (top-right) — mobile only
    const closeBtn = document.createElement('button');
    closeBtn.className = 'nav-close-btn';
    closeBtn.setAttribute('aria-label', 'Close menu');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', closeMenu);
    navLinks.appendChild(closeBtn);

    // Inject mobile language select into overlay
    const currentLang = document.documentElement.lang ||
                        (window.location.pathname.startsWith('/en/') ? 'en' : 'ja');
    const selectLi = document.createElement('li');
    selectLi.className = 'nav-lang-item';
    selectLi.style.listStyle = 'none';
    const select = document.createElement('select');
    select.className = 'lang-select-mobile';
    select.setAttribute('aria-label', 'Language');
    select.innerHTML = `
      <option value="ja" ${currentLang === 'ja' ? 'selected' : ''}>🇯🇵 日本語</option>
      <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇺🇸 English</option>`;
    select.addEventListener('change', e => LangController.navigate(e.target.value));
    selectLi.appendChild(select);
    navLinks.appendChild(selectLi);

    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', closeMenu);
    });
  }
};

/* smooth scroll (lenis) */
let lenis = null;

function initLenis() {
  if (typeof Lenis === 'undefined') return;

  lenis = new Lenis({
    duration: 1.2,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    smoothWheel: true,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }

  requestAnimationFrame(raf);

  // Connect with GSAP ScrollTrigger if available
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
}

/* gsap scroll animations */
function initGSAP() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.registerPlugin(ScrollTrigger);

  // Generic reveal: elements with .reveal class
  gsap.utils.toArray('.reveal').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // Staggered children: parent with data-stagger attribute
  gsap.utils.toArray('[data-stagger]').forEach(parent => {
    const children = parent.querySelectorAll('[data-stagger-item]');
    if (!children.length) return;

    gsap.fromTo(children,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: parent,
          start: 'top 80%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  // Horizontal reveals
  gsap.utils.toArray('.reveal-left').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, x: -40 },
      {
        opacity: 1, x: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      }
    );
  });

  gsap.utils.toArray('.reveal-right').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, x: 40 },
      {
        opacity: 1, x: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%' }
      }
    );
  });
}

/* mouse parallax (subtle cursor follower glow) */
function initMouseGlow() {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;

  let mouseX = 0, mouseY = 0;
  let glowX = 0, glowY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animate() {
    glowX += (mouseX - glowX) * 0.06;
    glowY += (mouseY - glowY) * 0.06;
    glow.style.transform = `translate(${glowX - 200}px, ${glowY - 200}px)`;
    requestAnimationFrame(animate);
  }
  animate();
}

/* active nav link */
function initActiveNav() {
  const path = window.location.pathname;
  const html = document.documentElement;

  // Suppress transitions on <a> AND ::after pseudo-elements via a CSS class
  html.classList.add('nav-no-transition');

  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    const isLangRoot = /^\/(en|ja)\/$/.test(href);
    const isActive   = href === path ||
                       (!isLangRoot && href !== '/' && path.startsWith(href));
    a.classList.toggle('active', isActive);
    if (isActive) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });

  // Remove suppression class after two frames so the browser has painted
  requestAnimationFrame(() => requestAnimationFrame(() => {
    html.classList.remove('nav-no-transition');
  }));
}

/* content protection */
function initContentProtection() {
  // Prevent right-click context menu on images (blocks "Save image as")
  document.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'IMG') e.preventDefault();
  });
}

/* initialize on dom ready */
document.addEventListener('DOMContentLoaded', () => {
  LangController.init();
  CookieBanner.init();
  NavController.init();
  initLenis();
  initGSAP();
  initMouseGlow();
  initActiveNav();
  initContentProtection();
});
