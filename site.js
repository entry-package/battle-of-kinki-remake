// Self-contained page behavior. No Strikingly runtime, tracking, or account APIs.
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sectionForHash = (hash) => {
    if (/^#_?\d+$/.test(hash)) return $(`[data-section-number="${hash.replace(/^#_?/, '')}"]`);
    if (!hash || hash === '#') return null;
    try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return null; }
  };

  const mobileMenu = $('#bok-mobile-menu');
  const menuToggle = $('.bok-menu-toggle');
  function closeMobileMenu(returnFocus = false) {
    mobileMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'メニューを開く');
    if (returnFocus) menuToggle.focus();
  }
  menuToggle.addEventListener('click', () => {
    const open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  });
  document.addEventListener('click', (event) => {
    if (!mobileMenu.hidden && !mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) closeMobileMenu();
  });

  const nav = $('.s-navbar-desktop-normal');
  const navList = $('.s-uncollapsed-nav', nav);
  const more = $('.s-nav-ellipsis', navList);
  const navItems = [...navList.children].filter((item) => item !== more);
  const collapsed = $('.s-collapsed-nav', more);
  const moreToggle = $('.s-nav-dropdown-text', more);
  moreToggle.setAttribute('role', 'button');
  moreToggle.setAttribute('tabindex', '0');
  moreToggle.setAttribute('aria-label', 'その他のメニュー');
  moreToggle.setAttribute('aria-expanded', 'false');
  const setMore = (open) => {
    more.classList.toggle('bok-expanded', open);
    moreToggle.setAttribute('aria-expanded', String(open));
  };
  const toggleMore = () => setMore(!more.classList.contains('bok-expanded'));
  moreToggle.addEventListener('click', toggleMore);
  moreToggle.addEventListener('keydown', (event) => {
    if (['Enter', ' '].includes(event.key)) { event.preventDefault(); toggleMore(); }
  });
  document.addEventListener('click', (event) => { if (!more.contains(event.target)) setMore(false); });

  function fitNavigation() {
    if (getComputedStyle(nav).display === 'none') return;
    const wrap = $('.s-nav-inner-wrap', nav);
    const logo = $('.s-logo', wrap);
    const title = $('.s-logo-title', wrap);
    const available = Math.max(0, wrap.clientWidth - logo.getBoundingClientRect().width - title.getBoundingClientRect().width - 80);
    navItems.forEach((item) => { item.hidden = false; item.style.display = ''; });
    more.classList.remove('hidden');
    more.hidden = false;
    const widths = navItems.map((item) => item.getBoundingClientRect().width);
    const total = widths.reduce((sum, width) => sum + width, 0);
    const reserve = total > available ? Math.max(more.getBoundingClientRect().width, 42) : 0;
    let used = 0;
    let reachedLimit = false;
    navItems.forEach((item, index) => {
      reachedLimit ||= used + widths[index] > available - reserve;
      item.hidden = reachedLimit;
      if (!reachedLimit) used += widths[index];
      if (collapsed.children[index]) collapsed.children[index].hidden = !reachedLimit;
    });
    more.hidden = !reachedLimit;
    if (!reachedLimit) setMore(false);
  }
  addEventListener('resize', () => {
    fitNavigation();
    if (innerWidth > 767) closeMobileMenu();
  });
  if (document.fonts) document.fonts.ready.then(fitNavigation);
  fitNavigation();

  const sectionLinks = $$('a[href^="#"]');
  function scrollToSection(section, behavior) {
    if (section.dataset.sectionNumber === '1') scrollTo({top: 0, behavior});
    else section.scrollIntoView({behavior, block: 'start'});
  }
  sectionLinks.forEach((link) => link.addEventListener('click', (event) => {
    const hash = link.getAttribute('href');
    const section = sectionForHash(hash);
    if (!section) return;
    event.preventDefault();
    closeMobileMenu();
    setMore(false);
    history.pushState(null, '', hash);
    scrollToSection(section, reducedMotion() ? 'instant' : 'smooth');
  }));
  function restoreHash() {
    const section = sectionForHash(location.hash);
    if (section) scrollToSection(section, 'instant');
  }
  addEventListener('hashchange', restoreHash);
  addEventListener('popstate', restoreHash);
  addEventListener('load', restoreHash);
  const current = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    const number = visible[0].target.dataset.sectionNumber;
    sectionLinks.forEach((link) => {
      const selected = link.getAttribute('href') === `#_${number}`;
      link.classList.toggle('selected', selected);
      if (selected) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }, {rootMargin: '-15% 0px -65% 0px'});
  $$('[data-section-number]').forEach((section) => current.observe(section));

  const gallery = $('#bok-gallery');
  const galleryLinks = $$('a[data-gallery-index]');
  const photo = $('figure img', gallery);
  let galleryIndex = 0;
  let lastGalleryLink = null;
  function showImage(index) {
    galleryIndex = (index + galleryLinks.length) % galleryLinks.length;
    photo.src = galleryLinks[galleryIndex].href;
    photo.alt = `順位表 ${galleryIndex + 1}`;
    $('figcaption', gallery).textContent = `${galleryIndex + 1} / ${galleryLinks.length}`;
  }
  galleryLinks.forEach((link, index) => link.addEventListener('click', (event) => {
    if (typeof gallery.showModal !== 'function') return; // Normal local image link remains usable.
    event.preventDefault();
    lastGalleryLink = link;
    showImage(index);
    gallery.showModal();
    document.body.classList.add('bok-gallery-open');
    $('.bok-gallery-close', gallery).focus();
  }));
  $('.bok-gallery-close', gallery).addEventListener('click', () => gallery.close());
  $('.bok-gallery-prev', gallery).addEventListener('click', () => showImage(galleryIndex - 1));
  $('.bok-gallery-next', gallery).addEventListener('click', () => showImage(galleryIndex + 1));
  gallery.addEventListener('click', (event) => { if (event.target === gallery) gallery.close(); });
  gallery.addEventListener('close', () => {
    document.body.classList.remove('bok-gallery-open');
    if (lastGalleryLink) lastGalleryLink.focus();
  });
  let touchStart = null;
  gallery.addEventListener('touchstart', (event) => { touchStart = event.touches[0].clientX; }, {passive: true});
  gallery.addEventListener('touchend', (event) => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 60) showImage(galleryIndex + (delta < 0 ? 1 : -1));
    touchStart = null;
  }, {passive: true});
  document.addEventListener('keydown', (event) => {
    if (gallery.open) {
      if (event.key === 'ArrowLeft') showImage(galleryIndex - 1);
      if (event.key === 'ArrowRight') showImage(galleryIndex + 1);
      return;
    }
    if (event.key === 'Escape') { closeMobileMenu(true); setMore(false); }
  });

})();
