/* about.js — about page animations */

'use strict';

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
    bars.forEach(bar => {
      const raw = bar.dataset.width || '0';
      bar.style.width = raw.endsWith('%') ? raw : raw + '%';
    });
  }
}

function initTimelineAnimation() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

  document.querySelectorAll('.timeline-item').forEach((item, i) => {
    gsap.fromTo(item,
      { opacity: 0, x: -30 },
      {
        opacity: 1, x: 0,
        duration: 0.7,
        ease: 'power3.out',
        delay: i * 0.05,
        scrollTrigger: {
          trigger: item,
          start: 'top 85%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initSkillBars();
  initTimelineAnimation();
});
