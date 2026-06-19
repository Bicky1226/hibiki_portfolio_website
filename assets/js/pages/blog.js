/* blog.js — blog list page: fetch, render, filter, paginate */
(function () {
  'use strict';

  const POSTS_PER_PAGE = 10;
  const lang = document.documentElement.lang || 'ja';

  let allPosts = [];
  let filteredPosts = [];
  let currentPage = 1;
  let activeTag = 'all';

  const listEl = document.getElementById('blog-post-list');
  const paginationEl = document.getElementById('blog-pagination');
  const filterWrap = document.querySelector('.blog-tags-filter');
  const comingSoon = document.querySelector('.blog-coming-soon');

  if (!listEl) return;

  // fetch posts
  async function fetchPosts() {
    try {
      const res = await fetch('/blog/api/posts.php?action=list&status=published');
      const data = await res.json();
      if (data.ok) {
        allPosts = data.posts || [];
      }
    } catch (e) {
      console.error('Failed to fetch blog posts:', e);
    }
  }

  // render filter buttons dynamically
  function renderFilters() {
    const tagSet = new Set();
    allPosts.forEach(p => (p.tags || []).forEach(t => tagSet.add(t)));

    if (tagSet.size === 0 && filterWrap) {
      filterWrap.style.display = 'none';
      return;
    }

    if (!filterWrap) return;

    filterWrap.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'tag-filter-btn active';
    allBtn.dataset.tag = 'all';
    allBtn.textContent = 'All';
    filterWrap.appendChild(allBtn);

    tagSet.forEach(tag => {
      const btn = document.createElement('button');
      btn.className = 'tag-filter-btn';
      btn.dataset.tag = tag;
      btn.textContent = tag;
      filterWrap.appendChild(btn);
    });

    filterWrap.addEventListener('click', (e) => {
      const btn = e.target.closest('.tag-filter-btn');
      if (!btn) return;
      activeTag = btn.dataset.tag;
      filterWrap.querySelectorAll('.tag-filter-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.tag === activeTag)
      );
      currentPage = 1;
      applyFilter();
    });
  }

  // filter + paginate
  function applyFilter() {
    if (activeTag === 'all') {
      filteredPosts = allPosts;
    } else {
      filteredPosts = allPosts.filter(p => (p.tags || []).includes(activeTag));
    }
    renderList();
    renderPagination();
  }

  // render post list
  function renderList() {
    const start = (currentPage - 1) * POSTS_PER_PAGE;
    const pageItems = filteredPosts.slice(start, start + POSTS_PER_PAGE);

    if (pageItems.length === 0) {
      listEl.innerHTML = '';
      if (comingSoon) comingSoon.style.display = '';
      return;
    }

    if (comingSoon) comingSoon.style.display = 'none';

    listEl.innerHTML = pageItems.map(p => {
      const title = p['title_' + lang] || p.title_ja || '(untitled)';
      const excerpt = p['excerpt_' + lang] || p.excerpt_ja || '';
      const date = formatDate(p.published_at || p.created_at);
      const dateIso = (p.published_at || p.created_at || '').split('T')[0];
      const tags = (p.tags || []).map(t =>
        `<span class="post-tag">${escHtml(t)}</span>`
      ).join('');

      return `
        <a href="/${lang}/blog/${escHtml(p.slug)}/" class="blog-post-item reveal">
          <time class="post-date" datetime="${escHtml(dateIso)}">${escHtml(date)}</time>
          <div class="post-body">
            <div class="post-tags">${tags}</div>
            <h2 class="post-title">${escHtml(title)}</h2>
            <p class="post-excerpt">${escHtml(excerpt)}</p>
          </div>
          <i class="ph ph-arrow-right post-arrow" aria-hidden="true"></i>
        </a>
      `;
    }).join('');

    // Trigger GSAP reveal if available
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
      listEl.querySelectorAll('.reveal').forEach(el => {
        gsap.fromTo(el,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
          }
        );
      });
    }
  }

  // pagination
  function renderPagination() {
    if (!paginationEl) return;

    const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
      html += `<button class="page-btn${i === currentPage ? ' active' : ''}" data-page="${i}">${i}</button>`;
    }
    paginationEl.innerHTML = html;

    paginationEl.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.dataset.page, 10);
        renderList();
        renderPagination();
        // Scroll to top of list
        const target = listEl.getBoundingClientRect().top + window.scrollY - 100;
        window.scrollTo({ top: target, behavior: 'smooth' });
      });
    });
  }

  // helpers
  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.getFullYear() + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0');
  }

  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // init
  async function init() {
    await fetchPosts();

    if (allPosts.length === 0) {
      // Keep coming-soon visible
      return;
    }

    renderFilters();
    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
