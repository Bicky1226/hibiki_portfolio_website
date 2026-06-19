/* works.js — works list page filter + view toggle + animations */

'use strict';

function initWorksFilter() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  const cards      = document.querySelectorAll('#works-grid .work-card');

  if (!filterBtns.length || !cards.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;

      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      cards.forEach(card => {
        const cats = card.dataset.category || 'all';
        const show = filter === 'all' || cats.includes(filter);

        if (show) {
          card.style.display = '';
          if (typeof gsap !== 'undefined') {
            gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

function initViewToggle() {
  const viewBtns = document.querySelectorAll('.view-btn');
  const grid     = document.getElementById('works-grid');

  if (!viewBtns.length || !grid) return;

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;

      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (view === 'timeline') {
        grid.classList.add('view-timeline');
      } else {
        grid.classList.remove('view-timeline');
      }

      // Re-animate visible cards
      const visibleCards = grid.querySelectorAll('.work-card:not([style*="display: none"])');
      if (typeof gsap !== 'undefined') {
        visibleCards.forEach((card, i) => {
          gsap.fromTo(card, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.35, delay: i * 0.06, ease: 'power2.out' });
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initWorksFilter();
  initViewToggle();
});
