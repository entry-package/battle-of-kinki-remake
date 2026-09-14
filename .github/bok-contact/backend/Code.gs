/** BATTLE OF KINKI contact receiver. Mail sending is the only OAuth scope. */
const BOK_CONTACT = Object.freeze({
  recipient: 'info@package-inc.com',
  origins: ['https://www.bok-esports.jp', 'https://bok-esports.jp'],
  categories: ['大会・参加について', '観戦・会場について', '協賛・協力について', '取材・メディア関係', 'その他'],
  version: '20260914-v1'
});

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ service: 'Bok contact', version: BOK_CONTACT.version }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const p = e && e.parameter || {};
  const requestId = String(p.requestId || '');
  const origin = BOK_CONTACT.origins.includes(p.pageOrigin) ? p.pageOrigin : BOK_CONTACT.origins[0];
  let result;
  try {
    result = receiveBokContact_(p, Number(e && e.contentLength || 0));
  } catch (error) {
    // Do not log submitted data or internal exception text.
    result = { status: 'error', message: '送信を確認できませんでした。時間をおいて再度お試しいただくか、メールでお問い合わせください。' };
  }
  const payload = JSON.stringify({ type: 'bok-contact-result', requestId, ...result }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>' +
    '<p>' + escapeBokHtml_(result.message || '') + '</p><script>window.top.postMessage(' + payload + ',' + JSON.stringify(origin) + ');</script></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('Bok お問い合わせ送信結果')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function receiveBokContact_(p, contentLength) {
  const error = message => ({ status: 'error', message });
  const requestId = String(p.requestId || '');
  if (!/^[a-f0-9]{32}$/.test(requestId) || !BOK_CONTACT.origins.includes(p.pageOrigin) || contentLength > 40000) {
    return error('送信情報を確認できません。ページを開き直してください。');
  }
  if (String(p.website || '') || !Number.isFinite(Number(p.ts)) || !p.ts || Date.now() - Number(p.ts) < 2500 || Date.now() - Number(p.ts) > 86400000) {
    return error('ページを開き直してから、フォームをご入力ください。');
  }
  const fields = { name: 100, organization: 200, email: 254, phone: 40, category: 50, message: 5000 };
  const data = {};
  for (const key of Object.keys(fields)) {
    data[key] = String(p[key] || '').trim();
    if (data[key].length > fields[key] || (key !== 'message' && /[\r\n\x00]/.test(data[key]))) return error('入力内容が長すぎるか、使えない文字が含まれています。');
  }
  if (!data.name || !data.message || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(data.email) || !BOK_CONTACT.categories.includes(data.category) || p.privacy !== 'yes') {
    return error('必須項目とメールアドレスをご確認ください。');
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return error('ただいま送信が混み合っています。少し待ってからお試しください。');
  try {
    const cache = CacheService.getScriptCache();
    const idKey = 'request:' + requestId;
    const previous = cache.get(idKey);
    if (previous) return JSON.parse(previous);
    const senderKey = 'sender:' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, data.email.toLowerCase())
      .map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
    if (cache.get(senderKey)) return error('続けての送信は少し時間をおいてお試しください。お急ぎの場合はメールでお問い合わせください。');
    const props = PropertiesService.getScriptProperties();
    const day = new Date().toISOString().slice(0, 10);
    const daily = JSON.parse(props.getProperty('daily-count') || '{}');
    const count = daily.day === day ? Number(daily.count || 0) : 0;
    if (count >= 100 || MailApp.getRemainingDailyQuota() < 2) return error('本日のフォーム受付上限に達しました。お手数ですが info@package-inc.com へメールでお問い合わせください。');
    const receipt = 'BOK-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd') + '-' + requestId.slice(0, 8).toUpperCase();
    const body = 'BATTLE OF KINKI お問い合わせ\n受付番号: ' + receipt + '\n\n' +
      'お名前: ' + data.name + '\nご所属: ' + (data.organization || '未入力') + '\nメール: ' + data.email +
      '\n電話番号: ' + (data.phone || '未入力') + '\n種類: ' + data.category + '\n\nお問い合わせ内容:\n' + data.message;
    // A pending result makes retries safe even if execution stops after sendEmail.
    const pending = { status: 'uncertain', receipt, message: '受付処理中、または送信結果を確認できない状態です。受付番号 ' + receipt + ' を添えて info@package-inc.com へご確認ください。' };
    cache.put(idKey, JSON.stringify(pending), 21600);
    cache.put(senderKey, '1', 60);
    props.setProperty('daily-count', JSON.stringify({ day, count: count + 1 }));
    try {
      MailApp.sendEmail({ to: BOK_CONTACT.recipient, subject: '【BOKお問い合わせ】' + data.category + ' / ' + receipt,
        body, name: 'BATTLE OF KINKI お問い合わせ', replyTo: data.email });
    } catch (error) {
      return pending;
    }
    // A failed receipt must not cause the administrator notification to be sent again.
    let result = { status: 'success', receipt, copySent: false, message: 'お問い合わせを受け付けました。担当が確認し、順次ご返信します。' };
    cache.put(idKey, JSON.stringify(result), 21600);
    try {
      MailApp.sendEmail({ to: data.email, subject: '【BATTLE OF KINKI】お問い合わせ受付のお知らせ / ' + receipt,
        body: 'BATTLE OF KINKIへのお問い合わせを受け付けました。\n担当が内容を確認し、順次ご返信します。\n\n' + body +
          '\n\nこのメールは自動送信です。お心当たりがない場合は、このメールへの返信でお知らせください。\nBATTLE OF KINKI / info@package-inc.com',
        name: 'BATTLE OF KINKI', replyTo: BOK_CONTACT.recipient });
      result.copySent = true;
      cache.put(idKey, JSON.stringify(result), 21600);
    } catch (error) { /* Administrator notification succeeded; report receipt failure separately. */ }
    return result;
  } finally { lock.releaseLock(); }
}

function escapeBokHtml_(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}
