/* admin.js — blog admin spa */
(function () {
  'use strict';

  const API = '/blog/api';
  let csrfToken = '';
  let currentPostId = null; // null = new post
  let allTags = [];

  // dom refs
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const views = { login: $('#login-view'), list: $('#list-view'), editor: $('#editor-view') };
  const toast = $('#toast');

  // utilities
  function showView(name) {
    Object.values(views).forEach(v => {
      v.classList.remove('active');
      v.style.display = 'none';
    });
    if (name === 'login') {
      views.login.style.display = 'flex';
    } else {
      views[name].style.display = 'block';
      views[name].classList.add('active');
    }
  }

  function showToast(msg, type = '') {
    toast.textContent = msg;
    toast.className = 'toast show ' + type;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.className = 'toast'; }, 3000);
  }

  async function api(endpoint, options = {}) {
    const defaults = { credentials: 'same-origin', headers: {} };
    if (options.json !== undefined) {
      defaults.headers['Content-Type'] = 'application/json';
      defaults.body = JSON.stringify(options.json);
      defaults.method = 'POST';
    }
    if (csrfToken && defaults.method === 'POST') {
      defaults.headers['X-CSRF-Token'] = csrfToken;
    }
    if (options.headers) Object.assign(defaults.headers, options.headers);
    const res = await fetch(API + endpoint, { ...defaults, ...options, headers: defaults.headers });
    return res.json();
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.getFullYear() + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0');
  }

  // auth
  async function checkAuth() {
    const res = await api('/auth.php?action=check', { method: 'GET' });
    if (res.authenticated) {
      csrfToken = res.csrf_token;
      return true;
    }
    return false;
  }

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('#login-password').value;
    const errEl = $('#login-error');
    errEl.className = 'login-error';
    errEl.textContent = '';

    const res = await api('/auth.php', { json: { action: 'login', password: pw } });
    if (res.ok) {
      csrfToken = res.csrf_token;
      loadPostList();
    } else {
      errEl.textContent = res.message || 'Login failed';
      errEl.className = 'login-error show';
    }
  });

  $('#btn-logout').addEventListener('click', async () => {
    await api('/auth.php', { json: { action: 'logout' } });
    csrfToken = '';
    showView('login');
  });

  // post list
  async function loadPostList() {
    showView('list');
    const res = await api('/posts.php?action=list', { method: 'GET' });
    const posts = res.posts || [];
    const tbody = $('#post-table-body');
    const empty = $('#empty-state');

    if (posts.length === 0) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    tbody.innerHTML = posts.map(p => `
      <tr>
        <td><span class="status-badge ${p.status}">${p.status}</span></td>
        <td class="post-title-cell">
          ${p.title_ja || '(untitled)'}
          <small>${p.title_en || ''}</small>
        </td>
        <td>${(p.tags || []).map(t => `<span class="tag-pill">${t}</span>`).join('')}</td>
        <td style="font-size:12px;color:var(--text-muted);white-space:nowrap">${formatDate(p.created_at)}</td>
        <td class="post-actions">
          ${p.status === 'published' ? `<button class="btn btn-warning btn-sm" data-suspend="${p.id}">Suspend</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}">Edit</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditor(btn.dataset.edit));
    });

    tbody.querySelectorAll('[data-suspend]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('This will unpublish the post. Continue?')) return;
        const res = await api('/posts.php', { json: { action: 'update', id: btn.dataset.suspend, status: 'draft' } });
        if (res.ok) {
          showToast('Post suspended (set to draft)', 'success');
          loadPostList();
        } else {
          showToast(res.message || 'Failed to suspend', 'error');
        }
      });
    });
  }

  $('#btn-new-post').addEventListener('click', () => openEditor(null));

  // tag input
  const tagWrap = $('#tag-input-wrap');
  const tagInput = $('#tag-input');
  const tagSuggestions = $('#tag-suggestions');
  let currentTags = [];

  function renderTags() {
    tagWrap.querySelectorAll('.tag-item').forEach(el => el.remove());
    currentTags.forEach((tag, i) => {
      const span = document.createElement('span');
      span.className = 'tag-item';
      span.innerHTML = `${tag} <span class="tag-remove" data-i="${i}">&times;</span>`;
      tagWrap.insertBefore(span, tagInput);
    });
  }

  tagWrap.addEventListener('click', (e) => {
    if (e.target.classList.contains('tag-remove')) {
      currentTags.splice(Number(e.target.dataset.i), 1);
      renderTags();
    } else {
      tagInput.focus();
    }
  });

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.value.trim();
      if (val && !currentTags.includes(val)) {
        currentTags.push(val);
        renderTags();
      }
      tagInput.value = '';
    }
    if (e.key === 'Backspace' && !tagInput.value && currentTags.length) {
      currentTags.pop();
      renderTags();
    }
  });

  async function loadTagSuggestions() {
    const res = await fetch(API + '/tags.php').then(r => r.json());
    allTags = res.tags || [];
    renderTagSuggestions();
  }

  function renderTagSuggestions() {
    const unused = allTags.filter(t => !currentTags.includes(t));
    tagSuggestions.innerHTML = unused.map(t =>
      `<button type="button" class="tag-suggest-btn">${t}</button>`
    ).join('');
    tagSuggestions.querySelectorAll('.tag-suggest-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!currentTags.includes(btn.textContent)) {
          currentTags.push(btn.textContent);
          renderTags();
          renderTagSuggestions();
        }
      });
    });
  }

  // thumbnail
  let currentThumb = '';

  $('#btn-thumb-upload').addEventListener('click', () => $('#thumb-file').click());
  $('#btn-thumb-clear').addEventListener('click', () => {
    currentThumb = '';
    updateThumbPreview();
  });

  $('#thumb-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch(API + '/upload.php', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': csrfToken },
    }).then(r => r.json());

    if (res.ok) {
      currentThumb = res.url;
      updateThumbPreview();
      showToast('Image uploaded', 'success');
    } else {
      showToast(res.message || 'Upload failed', 'error');
    }
    e.target.value = '';
  });

  function updateThumbPreview() {
    const el = $('#thumb-preview');
    const clearBtn = $('#btn-thumb-clear');
    if (currentThumb) {
      el.innerHTML = `<img src="${currentThumb}" alt="Thumbnail">`;
      clearBtn.style.display = '';
    } else {
      el.innerHTML = 'No image';
      clearBtn.style.display = 'none';
    }
  }

  // image insert (in-body)
  function setupImageInsert(btnId, textareaId) {
    $(btnId).addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('image', file);
        const res = await fetch(API + '/upload.php', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
          headers: { 'X-CSRF-Token': csrfToken },
        }).then(r => r.json());

        if (res.ok) {
          const ta = $(textareaId);
          const pos = ta.selectionStart;
          const md = `![](${res.url})`;
          ta.value = ta.value.slice(0, pos) + md + ta.value.slice(pos);
          ta.focus();
          ta.selectionStart = ta.selectionEnd = pos + md.length;
          showToast('Image inserted', 'success');
        } else {
          showToast(res.message || 'Upload failed', 'error');
        }
      });
      inp.click();
    });
  }

  setupImageInsert('#btn-upload-img-ja', '#edit-body-ja');
  setupImageInsert('#btn-upload-img-en', '#edit-body-en');

  // language tabs
  $$('.lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const lang = tab.dataset.lang;
      $$('.lang-tab').forEach(t => t.classList.toggle('active', t.dataset.lang === lang));
      $$('.lang-panel').forEach(p => p.classList.toggle('active', p.dataset.lang === lang));
    });
  });

  // toc toggle
  $('#edit-toc').addEventListener('change', () => {
    const on = $('#edit-toc').checked;
    $('#toc-section-ja').style.display = on ? '' : 'none';
    $('#toc-section-en').style.display = on ? '' : 'none';
  });

  // slug preview
  $('#edit-slug').addEventListener('input', () => {
    // Auto-normalize: lowercase, spaces/underscores to hyphens, strip invalid chars
    let v = $('#edit-slug').value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    $('#edit-slug').value = v;
    $('#slug-display').textContent = v || '...';
  });

  // preview
  function togglePreview(btnId, textareaId, previewId) {
    $(btnId).addEventListener('click', () => {
      const ta = $(textareaId);
      const pv = $(previewId);
      if (pv.classList.contains('active')) {
        pv.classList.remove('active');
        ta.style.display = '';
        $(btnId).textContent = 'Preview';
      } else {
        pv.innerHTML = typeof marked !== 'undefined' ? marked.parse(ta.value) : ta.value;
        pv.classList.add('active');
        ta.style.display = 'none';
        $(btnId).textContent = 'Edit';
      }
    });
  }

  togglePreview('#btn-preview-ja', '#edit-body-ja', '#preview-ja');
  togglePreview('#btn-preview-en', '#edit-body-en', '#preview-en');

  // editor: open
  async function openEditor(postId) {
    currentPostId = postId;
    await loadTagSuggestions();

    // Reset all fields
    $('#edit-slug').value = '';
    $('#slug-display').textContent = '...';
    $('#edit-title-ja').value = '';
    $('#edit-title-en').value = '';
    $('#edit-excerpt-ja').value = '';
    $('#edit-excerpt-en').value = '';
    $('#edit-body-ja').value = '';
    $('#edit-body-en').value = '';
    $('#edit-toc').checked = false;
    $('#toc-section-ja').style.display = 'none';
    $('#toc-section-en').style.display = 'none';
    $('#edit-toc-ja').value = '';
    $('#edit-toc-en').value = '';
    currentThumb = '';
    updateThumbPreview();
    currentTags = [];
    renderTags();

    // Reset preview panels
    $('#preview-ja').classList.remove('active');
    $('#preview-en').classList.remove('active');
    $('#edit-body-ja').style.display = '';
    $('#edit-body-en').style.display = '';
    $('#btn-preview-ja').textContent = 'Preview';
    $('#btn-preview-en').textContent = 'Preview';

    // Reset to JA tab
    $$('.lang-tab').forEach(t => t.classList.toggle('active', t.dataset.lang === 'ja'));
    $$('.lang-panel').forEach(p => p.classList.toggle('active', p.dataset.lang === 'ja'));

    if (postId) {
      // Edit existing
      const res = await api('/posts.php?action=get&id=' + postId, { method: 'GET' });
      if (!res.ok) {
        showToast('Failed to load post', 'error');
        return;
      }
      const p = res.post;
      $('#edit-slug').value = p.slug;
      $('#slug-display').textContent = p.slug;
      $('#edit-title-ja').value = p.title_ja;
      $('#edit-title-en').value = p.title_en;
      $('#edit-excerpt-ja').value = p.excerpt_ja;
      $('#edit-excerpt-en').value = p.excerpt_en;
      $('#edit-body-ja').value = p.body_md_ja;
      $('#edit-body-en').value = p.body_md_en;
      $('#edit-toc').checked = p.toc_enabled;
      $('#toc-section-ja').style.display = p.toc_enabled ? '' : 'none';
      $('#toc-section-en').style.display = p.toc_enabled ? '' : 'none';
      $('#edit-toc-ja').value = p.toc_custom_ja || '';
      $('#edit-toc-en').value = p.toc_custom_en || '';
      currentThumb = p.thumbnail || '';
      updateThumbPreview();
      currentTags = p.tags || [];
      renderTags();
      renderTagSuggestions();
      $('#editor-status-text').textContent = `Editing: ${p.title_ja || p.slug} (${p.status})`;
      $('#btn-delete').style.display = '';
      $('#btn-suspend').style.display = p.status === 'published' ? '' : 'none';
    } else {
      $('#editor-status-text').textContent = 'New Post';
      $('#btn-delete').style.display = 'none';
      $('#btn-suspend').style.display = 'none';
    }

    showView('editor');
  }

  // editor: save / publish / delete
  function gatherPostData(status) {
    return {
      action: currentPostId ? 'update' : 'create',
      id: currentPostId || undefined,
      slug: $('#edit-slug').value.trim(),
      status: status,
      title_ja: $('#edit-title-ja').value,
      title_en: $('#edit-title-en').value,
      excerpt_ja: $('#edit-excerpt-ja').value,
      excerpt_en: $('#edit-excerpt-en').value,
      body_md_ja: $('#edit-body-ja').value,
      body_md_en: $('#edit-body-en').value,
      thumbnail: currentThumb,
      tags: currentTags,
      toc_enabled: $('#edit-toc').checked,
      toc_custom_ja: $('#edit-toc-ja').value,
      toc_custom_en: $('#edit-toc-en').value,
    };
  }

  async function savePost(status) {
    const data = gatherPostData(status);

    if (!data.slug) {
      showToast('Slug is required', 'error');
      return;
    }

    const res = await api('/posts.php', { json: data });
    if (res.ok) {
      currentPostId = res.post.id;
      showToast(status === 'published' ? 'Published!' : 'Draft saved', 'success');
      $('#editor-status-text').textContent = `Editing: ${res.post.title_ja || res.post.slug} (${res.post.status})`;
      $('#btn-delete').style.display = '';
      $('#btn-suspend').style.display = res.post.status === 'published' ? '' : 'none';
    } else {
      showToast(res.message || 'Save failed', 'error');
    }
  }

  $('#btn-save-draft').addEventListener('click', () => savePost('draft'));
  $('#btn-publish').addEventListener('click', () => savePost('published'));

  $('#btn-suspend').addEventListener('click', async () => {
    if (!currentPostId) return;
    if (!confirm('Unpublish this post? It will be set to draft.')) return;
    await savePost('draft');
  });

  $('#btn-delete').addEventListener('click', async () => {
    if (!currentPostId) return;
    if (!confirm('Are you sure you want to delete this post?')) return;

    const res = await api('/posts.php', { json: { action: 'delete', id: currentPostId } });
    if (res.ok) {
      showToast('Post deleted', 'success');
      loadPostList();
    } else {
      showToast(res.message || 'Delete failed', 'error');
    }
  });

  $('#btn-back-to-list').addEventListener('click', () => loadPostList());

  // init
  (async function init() {
    if (await checkAuth()) {
      loadPostList();
    } else {
      showView('login');
    }
  })();

})();
