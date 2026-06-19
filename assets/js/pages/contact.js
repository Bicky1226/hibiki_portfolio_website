/* contact.js — contact form ajax submission */

'use strict';

function initContactForm() {
  const form      = document.getElementById('contact-form');
  const statusEl  = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  if (!form) return;

  // Record the time the form was displayed (for bot timing check)
  const tField = document.getElementById('_t');
  if (tField) tField.value = Date.now();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous status
    statusEl.className = 'form-status';
    statusEl.textContent = '';

    // Basic client-side validation
    const name    = form.name.value.trim();
    const email   = form.email.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !subject || !message) {
      showStatus('error', '必須項目をすべて入力してください。 / Please fill in all required fields.');
      return;
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email)) {
      showStatus('error', '有効なメールアドレスを入力してください。 / Please enter a valid email address.');
      return;
    }

    // Loading state
    submitBtn.classList.add('btn-loading');
    submitBtn.textContent = '送信中... / Sending...';

    try {
      const data = new FormData(form);
      const res  = await fetch('/contact/send.php', {
        method: 'POST',
        body: data,
      });

      const json = await res.json();

      if (json.ok) {
        showStatus('success', json.message || 'お問い合わせを受け付けました。');
        form.reset();
      } else {
        showStatus('error', json.message || '送信に失敗しました。直接メールにてご連絡ください。');
      }
    } catch (err) {
      showStatus('error', 'ネットワークエラーが発生しました。直接メールにてご連絡ください。 / Network error. Please contact me directly by email.');
    } finally {
      submitBtn.classList.remove('btn-loading');
      submitBtn.innerHTML = '送信する <i class="ph ph-paper-plane-tilt" aria-hidden="true"></i>';
    }
  });

  function showStatus(type, msg) {
    statusEl.className = 'form-status ' + type;
    statusEl.textContent = msg;
    statusEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

document.addEventListener('DOMContentLoaded', initContactForm);
