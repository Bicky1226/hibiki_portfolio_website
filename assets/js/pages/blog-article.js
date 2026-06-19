/* blog-article.js — blog article page interactions */
(function () {
  'use strict';

  // copy code buttons on all <pre> blocks
  document.querySelectorAll('.prose pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'code-copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code');
      const text = code ? code.textContent : pre.textContent;
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    });
    pre.style.position = 'relative';
    pre.appendChild(btn);
  });

  // share: copy url
  const copyBtn = document.querySelector('.share-copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const url = copyBtn.dataset.url;
      const label = copyBtn.dataset.label;
      const copied = copyBtn.dataset.copied;
      navigator.clipboard.writeText(url).then(() => {
        copyBtn.querySelector('span').textContent = copied;
        setTimeout(() => {
          copyBtn.querySelector('span').textContent = label;
        }, 2000);
      });
    });
  }

  // toc scroll spy
  const tocLinks = document.querySelectorAll('.article-toc a');
  if (tocLinks.length > 0) {
    const headings = [];
    tocLinks.forEach(link => {
      const id = link.getAttribute('href')?.replace('#', '');
      if (id) {
        const el = document.getElementById(id);
        if (el) headings.push({ el, link });
      }
    });

    function updateActiveToc() {
      const scrollY = window.scrollY + 120;
      let current = null;
      for (const h of headings) {
        if (h.el.offsetTop <= scrollY) {
          current = h;
        }
      }
      tocLinks.forEach(l => l.classList.remove('active'));
      if (current) {
        current.link.classList.add('active');
      }
    }

    window.addEventListener('scroll', updateActiveToc, { passive: true });
    updateActiveToc();
  }

  // smooth scroll for toc links
  document.querySelectorAll('.article-toc a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('href').replace('#', '');
      const target = document.getElementById(id);
      if (target) {
        const offset = 80;
        const y = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

})();
