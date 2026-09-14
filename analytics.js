// GA4 loads only on the production host after an explicit visitor choice.
(() => {
  'use strict';
  const measurementId = 'G-N7XWTTCQ6T';
  const storageKey = 'bok-analytics-consent-v1';
  const lifetime = 180 * 24 * 60 * 60 * 1000;
  const production = ['www.bok-esports.jp', 'bok-esports.jp'].includes(location.hostname);
  const disableKey = 'ga-disable-' + measurementId;
  window[disableKey] = true;
  let started = false;
  let returnFocus = null;
  let choice = null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && typeof saved.allowed === 'boolean' && saved.expires > Date.now()) choice = saved.allowed;
  } catch { /* A blocked storage area leaves analytics off until a choice is made. */ }

  const banner = document.createElement('aside');
  banner.className = 'bok-consent';
  banner.setAttribute('aria-labelledby', 'bok-consent-title');
  banner.id = 'bok-consent';
  banner.innerHTML = '<h2 id="bok-consent-title">アクセス解析について</h2>' +
    '<p>サイト改善のため、許可いただいた場合にGoogleアナリティクス（Cookie）で利用状況を計測します。許可しなくてもサイトをご利用いただけます。<a href="/pages/cookie-policy/">詳しく見る</a></p>' +
    '<div class="bok-consent-actions"><button type="button" data-consent="accept">許可する</button><button type="button" data-consent="decline">許可しない</button></div>';
  document.body.append(banner);
  const settings = [...document.querySelectorAll('[data-analytics-settings]')];
  function show(open) {
    banner.hidden = !open;
    settings.forEach(button => button.setAttribute('aria-expanded', String(open)));
  }
  function clearAnalyticsCookies() {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) continue;
      const base = name + '=; Max-Age=0; Path=/; SameSite=Lax';
      document.cookie = base;
      document.cookie = base + '; Domain=' + location.hostname;
      if (production) document.cookie = base + '; Domain=bok-esports.jp';
    }
  }
  function startAnalytics() {
    if (!production) return;
    window[disableKey] = false;
    if (started) return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    let referrer = '';
    try { if (document.referrer) referrer = new URL(document.referrer).origin + '/'; } catch { /* No referrer. */ }
    gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname,
      page_referrer: referrer,
      cookie_expires: lifetime / 1000
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.append(script);
  }
  function choose(allowed) {
    choice = allowed;
    try { localStorage.setItem(storageKey, JSON.stringify({ allowed, expires: Date.now() + lifetime })); }
    catch {
      // Avoid restoring an older grant if a storage quota prevents overwriting it.
      try { localStorage.removeItem(storageKey); } catch { /* Current-page choice still applies. */ }
    }
    if (allowed) startAnalytics();
    else {
      window[disableKey] = true;
      clearAnalyticsCookies();
    }
    show(false);
    if (returnFocus) returnFocus.focus();
  }
  banner.querySelector('[data-consent="accept"]').addEventListener('click', () => choose(true));
  banner.querySelector('[data-consent="decline"]').addEventListener('click', () => choose(false));
  settings.forEach(button => {
    button.setAttribute('aria-controls', banner.id);
    button.addEventListener('click', () => {
      returnFocus = button;
      show(true);
      banner.querySelector('button').focus();
    });
  });
  show(choice === null);
  if (choice === true) startAnalytics();
  else clearAnalyticsCookies();
})();
