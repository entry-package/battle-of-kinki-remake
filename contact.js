(() => {
  'use strict';
  const form = document.getElementById('bok-contact-form');
  if (!form) return;
  const fields = document.getElementById('contact-fields');
  const submit = document.getElementById('contact-submit');
  const status = document.getElementById('contact-status');
  const resultFrame = document.querySelector('iframe[name="bok-contact-result-frame"]');
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const requestId = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  document.getElementById('contact-request-id').value = requestId;
  document.getElementById('contact-ts').value = String(Date.now());
  document.getElementById('contact-origin').value = location.origin;
  let inFlight = false;
  let complete = false;
  let timer;
  let pendingData;
  let transport;
  function message(text, state) {
    status.hidden = false;
    status.dataset.state = state;
    status.textContent = text;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (inFlight || complete) return;
    const endpoint = form.dataset.endpoint;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
      message('現在フォームを準備しています。お急ぎの場合は下記のメールアドレスへお問い合わせください。', 'error');
      return;
    }
    if (!pendingData && !form.reportValidity()) return;
    if (!pendingData) {
      for (const input of form.querySelectorAll('input[type="text"], textarea')) input.value = input.value.trim();
      if (!form.reportValidity()) return;
      pendingData = [...new FormData(form).entries()];
    }
    inFlight = true;
    fields.disabled = true;
    submit.disabled = true;
    submit.textContent = '送信中…';
    form.setAttribute('aria-busy', 'true');
    message('送信しています。このページを閉じずにお待ちください。', 'sending');
    if (transport) transport.remove();
    transport = document.createElement('form');
    transport.method = 'post';
    transport.action = endpoint;
    transport.target = resultFrame.name;
    transport.hidden = true;
    for (const [name, value] of pendingData) {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value;
      transport.append(input);
    }
    document.body.append(transport);
    transport.submit();
    clearTimeout(timer);
    timer = setTimeout(() => {
      inFlight = false;
      submit.disabled = false;
      submit.textContent = '送信結果を再確認する';
      form.setAttribute('aria-busy', 'false');
      message('送信結果の確認に時間がかかっています。下のボタンで同じお問い合わせの結果を再確認できます。確認できない場合は、メールでお問い合わせください。', 'uncertain');
    }, 45000);
  });
  window.addEventListener('message', event => {
    const trustedOrigin = event.origin === 'https://script.google.com' || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(event.origin);
    const data = event.data;
    if (!trustedOrigin || !pendingData || complete || !data || data.type !== 'bok-contact-result' || data.requestId !== requestId) return;
    if (!['success', 'error', 'uncertain'].includes(data.status)) return;
    clearTimeout(timer);
    inFlight = false;
    form.setAttribute('aria-busy', 'false');
    if (transport) { transport.remove(); transport = null; }
    if (data.status === 'success') {
      complete = true;
      form.hidden = true;
      message('お問い合わせを受け付けました。担当が確認し、順次ご返信します。\n受付番号：' + data.receipt +
        (data.copySent ? '\n入力されたメールアドレスに受付の控えをお送りしました。' : '\n受付の控えを送信できませんでしたが、お問い合わせは受け付けています。'), 'success');
    } else if (data.status === 'uncertain') {
      complete = true;
      submit.hidden = true;
      message(data.message, 'uncertain');
    } else {
      pendingData = null;
      fields.disabled = false;
      submit.disabled = false;
      submit.textContent = '送信する';
      message(data.message || '送信できませんでした。入力内容を確認して、もう一度お試しください。', 'error');
    }
    status.focus();
  });
})();
