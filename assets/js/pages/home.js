/* home.js — hero entrance + scroll animations */

'use strict';

/* hero entrance animation */
function initHeroAnimation() {
  // GSAP が無い場合は CSS の初期非表示を解除して即表示
  if (typeof gsap === 'undefined') {
    document.querySelectorAll(
      '.hero-label, .hero-identity, .hero-cta, .headline-line'
    ).forEach(el => { el.style.opacity = '1'; });
    return;
  }

  const tl = gsap.timeline({
    delay: 0.25,
    // transform / clip-path が残るとスタッキングコンテキストが生まれ、
    // 墨流しの mix-blend-mode: difference 合成が遮断されるため除去する
    onComplete() {
      gsap.set('.headline-line, .hero-label, .hero-identity, .hero-hanko, .hero-cta', {
        clearProps: 'transform,clipPath'
      });
    }
  });

  // 縦書き見出し — 上から「刷り上がる」(clip 開放)
  tl.fromTo('.hero-headline .headline-line',
    { opacity: 0, clipPath: 'inset(0 0 100% 0)', y: -8 },
    {
      opacity: 1, clipPath: 'inset(0 0 0% 0)', y: 0,
      duration: 1.1,
      ease: 'power3.inOut',
      stagger: 0.22,
    }
  );

  // 枠罫と見当
  tl.fromTo('.hero-frame',
    { opacity: 0 },
    { opacity: 1, duration: 0.8, ease: 'power2.out' },
    '-=0.9'
  );

  // 肩書きラベル
  tl.fromTo('.hero-label',
    { opacity: 0, x: -16 },
    { opacity: 1, x: 0, duration: 0.6, ease: 'power3.out' },
    '-=0.5'
  );

  // 著者署名 — タイトルと同じく「上から」静かにフェードイン(題字の刷り上がりと重ねる)
  tl.fromTo('.hero-identity',
    { opacity: 0, y: -8 },
    { opacity: 1, y: 0, duration: 0.95, ease: 'power3.inOut' },
    '-=0.85'
  );
  // 印 — 署名に続けて、弾けず静かに収まる
  tl.fromTo('.hero-hanko',
    { opacity: 0, scale: 1.15, rotation: 3 },
    { opacity: 1, scale: 1, rotation: -2.5, duration: 0.5, ease: 'power2.out' },
    '-=0.55'
  );

  // CTA
  tl.fromTo('.hero-cta',
    { opacity: 0, y: 14 },
    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
    '-=0.1'
  );
}

/* skill bars animation */
function initSkillBars() {
  const bars = document.querySelectorAll('.skill-bar-fill');
  if (!bars.length) return;

  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    bars.forEach(bar => {
      const raw = bar.dataset.width || '0';
      const targetWidth = raw.endsWith('%') ? raw : raw + '%';

      gsap.fromTo(bar,
        { width: '0%' },
        {
          width: targetWidth,
          duration: 1.2,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: bar,
            start: 'top 88%',
            toggleActions: 'play none none none',
          }
        }
      );
    });
  } else {
    // Fallback: set widths immediately if GSAP unavailable
    bars.forEach(bar => {
      bar.style.width = bar.dataset.width || '0%';
    });
  }
}

/* works grid — card entrance stagger */
function initWorksAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const cards = document.querySelectorAll('.work-card');
  if (!cards.length) return;

  gsap.fromTo(cards,
    { opacity: 0, y: 60 },
    {
      opacity: 1, y: 0,
      duration: 0.7,
      ease: 'power3.out',
      stagger: 0.12,
      scrollTrigger: {
        trigger: '.works-grid',
        start: 'top 80%',
        toggleActions: 'play none none none',
      }
    }
  );
}

/* about section entrance */
function initAboutAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  gsap.fromTo('.about-photo-wrap',
    { opacity: 0, x: -50 },
    {
      opacity: 1, x: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '#about-snap',
        start: 'top 75%',
        toggleActions: 'play none none none',
      }
    }
  );

  gsap.fromTo('.about-text',
    { opacity: 0, x: 50 },
    {
      opacity: 1, x: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '#about-snap',
        start: 'top 75%',
        toggleActions: 'play none none none',
      }
    }
  );

  // Stats counter animation
  const statNums = document.querySelectorAll('.stat-num');
  statNums.forEach(el => {
    const text = el.textContent;
    const num  = parseFloat(text);
    if (isNaN(num)) return;

    const suffix = text.replace(/[\d.]/g, '');
    gsap.fromTo({ val: 0 },
      { val: 0 },
      {
        val: num,
        duration: 1.4,
        ease: 'power2.out',
        onUpdate: function () {
          el.textContent = (Number.isInteger(num)
            ? Math.round(this.targets()[0].val)
            : this.targets()[0].val.toFixed(1)) + suffix;
        },
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

/* what's new — stagger list items */
function initNewsAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  const items = document.querySelectorAll('.news-item');
  if (!items.length) return;

  gsap.fromTo(items,
    { opacity: 0, x: -30 },
    {
      opacity: 1, x: 0,
      duration: 0.6,
      ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: '#whats-new',
        start: 'top 82%',
        toggleActions: 'play none none none',
      }
    }
  );
}

/* initialize */
document.addEventListener('DOMContentLoaded', () => {
  initHeroAnimation();
  initWorksAnimation();
  initAboutAnimation();
  initSkillBars();
  initNewsAnimation();
});
