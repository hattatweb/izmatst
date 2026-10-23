/* IZ Mannheim – Frontend-Logik
 * Die Seiten enthalten ihren Inhalt bereits als HTML (erzeugt von tools/build.py).
 * Dieses Skript aktualisiert Texte, Preise und Öffnungszeiten live aus data/site.json
 * und data/menu.json (damit Änderungen aus der Verwaltung sofort sichtbar sind) und
 * steuert Navigation, Speisekarte, Galerie, Einwilligung und Reichweitenmessung. */
(function () {
  'use strict';

  /* ---------- Helfer ---------- */
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); }
  function get(o, path) { return path.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function safeUrl(u) { u = String(u || '').trim(); return /^(https?:|tel:|mailto:|assets\/|\/|#)/i.test(u) ? u : ''; }
  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }
  function telHref(r) {
    var d = String(r.phoneHref || r.phone || '').replace(/[^\d+]/g, '');
    if (d.charAt(0) === '0') d = '+49' + d.slice(1);
    return 'tel:' + d;
  }

  /* ---------- Navigation ---------- */
  var burger = $('#hamburger'), nav = $('#nav-menu');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('active');
      burger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('active')) {
        nav.classList.remove('active'); burger.setAttribute('aria-expanded', 'false'); burger.focus();
      }
    });
  }

  /* ---------- Einwilligung ---------- */
  var KEY = 'cookieConsent';
  function consent() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function setConsent(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* gesperrt */ } }
  var onAccept = [];
  function whenAccepted(fn) { onAccept.push(fn); if (consent() === 'accepted') fn(); }
  var banner = $('#cookie-banner');
  function showBanner() { if (banner) banner.classList.add('show'); }
  if (banner) {
    $('#cookie-accept').addEventListener('click', function () {
      setConsent('accepted'); banner.classList.remove('show'); onAccept.forEach(function (f) { f(); });
    });
    $('#cookie-decline').addEventListener('click', function () { setConsent('declined'); banner.classList.remove('show'); });
  }
  $$('[data-open-consent]').forEach(function (b) { b.addEventListener('click', showBanner); });

  /* ---------- Externe Inhalte (Google Maps, Reservierung) – erst auf Klick oder nach Zustimmung ---------- */
  var EMBEDS = {
    maps: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2591.5880803953914!2d8.459334976663303!3d49.49228757142513!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4797cdbe6f7a79d3%3A0xfcc4ace0327786b0!2sIZ%20Uigurisches%20Restaurant%20Mannheim!5e0!3m2!1sde!2sde!',
    reservation: 'https://xld8vlypfencx7w9ma63.centralplanner.online/public/webforms/11439-Iz-Uigurisches-Restaurant-Mannheim'
  };
  function mountEmbed(box) {
    if (!box || box.classList.contains('loaded')) return;
    var src = EMBEDS[box.getAttribute('data-type')];
    if (!src) return;
    var f = document.createElement('iframe');
    f.src = src;
    f.title = box.getAttribute('data-title') || 'Externer Inhalt';
    f.loading = 'lazy';
    f.setAttribute('allowfullscreen', '');
    f.style.height = (box.getAttribute('data-height') || '450') + 'px';
    box.innerHTML = '';
    box.classList.add('loaded');
    box.appendChild(f);
    track('Externer Inhalt geladen: ' + box.getAttribute('data-type'));
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-load-embed]');
    if (b) mountEmbed(b.closest('.iframe-consent'));
  });
  whenAccepted(function () { $$('.iframe-consent[data-type]').forEach(mountEmbed); });

  /* ---------- Reichweitenmessung (GoatCounter, cookielos, nur nach Zustimmung) ---------- */
  var gcLoaded = false;
  function track(name) {
    try { if (gcLoaded && window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: name, title: name, event: true }); }
    catch (e) { /* niemals die Seite stören */ }
  }
  function initAnalytics(cfg) {
    if (!cfg || !cfg.code || !/^[a-z0-9-]{2,40}$/i.test(cfg.code)) return;
    function load() {
      if (gcLoaded) return;
      gcLoaded = true;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://gc.zgo.at/count.js';
      s.setAttribute('data-goatcounter', 'https://' + cfg.code + '.goatcounter.com/count');
      document.head.appendChild(s);
    }
    if (cfg.requireConsent === false) { load(); return; }
    whenAccepted(load);
    if (!consent()) showBanner();   // Hinweis nur, wenn wirklich gemessen werden soll
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('tel:') === 0) track('Klick: Telefon');
    else if (h.indexOf('reservierung') > -1) track('Klick: Reservieren');
    else if (/ubereats/i.test(h)) track('Klick: Uber Eats');
    else if (/lieferando/i.test(h)) track('Klick: Lieferando');
    else if (/\.pdf($|\?)/i.test(h)) track('Klick: PDF ' + h.split('/').pop());
    else if (/google\.com\/maps/i.test(h)) track('Klick: Route');
    else if (/instagram/i.test(h)) track('Klick: Instagram');
    else if (/tiktok/i.test(h)) track('Klick: TikTok');
  });

  /* ---------- Öffnungszeiten ---------- */
  var DOWS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SHORT = { Montag: 'Mo', Dienstag: 'Di', Mittwoch: 'Mi', Donnerstag: 'Do', Freitag: 'Fr', Samstag: 'Sa', Sonntag: 'So' };
  function hoursText(d) {
    if (d.closed || !d.slots || !d.slots.length) return 'geschlossen';
    return d.slots.map(function (s) { return s[0] + ' – ' + s[1]; }).join(' & ') + ' Uhr';
  }
  function berlinNow() {
    try {
      var p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var o = {}; p.forEach(function (x) { o[x.type] = x.value; });
      return { dow: o.weekday, min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) { return null; }
  }
  function toMin(t) { var a = String(t).split(':'); return parseInt(a[0], 10) * 60 + parseInt(a[1], 10); }
  function isOpenNow(hours, now) {
    var di = DOWS.indexOf(now.dow); if (di < 0) return null;
    var today = hours.filter(function (h) { return h.dow === now.dow; })[0];
    var yest = hours.filter(function (h) { return h.dow === DOWS[(di + 6) % 7]; })[0];
    function within(day, offset) {
      if (!day || day.closed) return false;
      return (day.slots || []).some(function (s) {
        var a = toMin(s[0]), b = toMin(s[1]); if (b <= a) b += 1440;
        var m = now.min + offset; return m >= a && m < b;
      });
    }
    return within(today, 0) || within(yest, 1440);
  }
  function renderHours(site) {
    var hours = site.hours; if (!hours) return;
    var now = berlinNow();
    var box = $('#opening-hours');
    if (box) {
      box.innerHTML = '<table class="hours-table"><caption class="sr-only">Öffnungszeiten</caption><tbody>' +
        hours.map(function (d) {
          var cls = [d.closed ? 'closed' : '', now && d.dow === now.dow ? 'today' : ''].join(' ').trim();
          return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><th scope="row">' + esc(d.day) + (now && d.dow === now.dow ? ' <span class="sr-only">(heute)</span>' : '') +
            '</th><td>' + esc(hoursText(d)) + '</td></tr>';
        }).join('') + '</tbody></table>' + (site.hoursNote ? '<p class="note">' + esc(site.hoursNote) + '</p>' : '');
    }
    var fh = $('#footer-hours');
    if (fh) {
      var groups = [];
      hours.forEach(function (d) {
        var t = hoursText(d), last = groups[groups.length - 1];
        if (last && last.t === t) last.b = d.day; else groups.push({ a: d.day, b: d.day, t: t });
      });
      fh.innerHTML = groups.map(function (gr) {
        var l = gr.a === gr.b ? SHORT[gr.a] : SHORT[gr.a] + '–' + SHORT[gr.b];
        return '<dt>' + esc(l) + '</dt><dd>' + esc(gr.t) + '</dd>';
      }).join('');
    }
    var th = $('#today-hours');
    if (th && now) {
      var d = hours.filter(function (h) { return h.dow === now.dow; })[0];
      var open = isOpenNow(hours, now);
      th.innerHTML = esc(d ? (d.closed ? 'Heute geschlossen' : hoursText(d)) : '') +
        (open === null ? '' : ' <span class="open-state ' + (open ? 'is-open' : 'is-closed') + '">' + (open ? 'jetzt geöffnet' : 'jetzt geschlossen') + '</span>');
    }
  }

  /* ---------- Texte & Kontaktdaten ---------- */
  function applyText(site) {
    $$('[data-text]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-text'));
      if (typeof v === 'string' && v) el.textContent = v;
    });
    $$('[data-rich]').forEach(function (el) {
      var v = get(site, el.getAttribute('data-rich'));
      if (typeof v === 'string' && v) el.innerHTML = rich(v);
    });
    var r = site.restaurant;
    if (r) {
      $$('[data-address]').forEach(function (el) {
        el.innerHTML = esc(r.name) + '<br>' + esc(r.street) + '<br>' + esc(r.zip) + ' ' + esc(r.city) +
          (el.getAttribute('data-address') === 'full' ? '<br>' + esc(r.country) : '');
      });
      $$('[data-street]').forEach(function (el) { el.textContent = r.street; });
      $$('[data-phone]').forEach(function (el) { el.textContent = r.phone; el.setAttribute('href', telHref(r)); });
      $$('[data-phone-only]').forEach(function (el) { el.setAttribute('href', telHref(r)); });
    }
    // Hinweis-Banner
    var n = site.notice, old = $('#site-notice');
    if (n && n.enabled === true && n.text) {
      if (!old) {
        old = document.createElement('div'); old.id = 'site-notice'; old.className = 'site-notice'; old.setAttribute('role', 'status');
        var h = $('.navbar'); if (h) h.parentNode.insertBefore(old, h.nextSibling);
      }
      old.textContent = n.text;
    } else if (old) old.remove();
    // Links
    var lunch = $('#lunch-link'); if (lunch && site.lunch && safeUrl(site.lunch.pdf)) lunch.href = safeUrl(site.lunch.pdf);
    if (site.menuPage) {
      var a = $('#menu-pdf-link'), b = $('#lunch-pdf-link');
      if (a) { a.hidden = !safeUrl(site.menuPage.pdf); if (!a.hidden) a.href = safeUrl(site.menuPage.pdf); }
      if (b) { b.hidden = !safeUrl(site.menuPage.lunchPdf); if (!b.hidden) b.href = safeUrl(site.menuPage.lunchPdf); }
    }
  }
  var ICON = {
    ubereats: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8zm4 0a3 3 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lieferando: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 17h6l-3-8h-3m6 8 2-6h2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5M14 3c.4 2.6 2.1 4.2 5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function renderLinks(site) {
    var box = $('#delivery-buttons');
    if (box && site.delivery && site.delivery.items) {
      box.innerHTML = site.delivery.items.filter(function (i) { return safeUrl(i.url); }).map(function (i) {
        return '<a class="delivery-btn ' + esc(i.type || '') + '" href="' + esc(safeUrl(i.url)) + '" target="_blank" rel="noopener noreferrer">' +
          (ICON[i.type] || '') + esc(i.label) + '</a>';
      }).join('');
    }
    var soc = $('#social-links');
    if (soc && site.social) {
      soc.innerHTML = [['instagram', 'Instagram'], ['tiktok', 'TikTok']].filter(function (x) { return safeUrl(site.social[x[0]]); }).map(function (x) {
        return '<a href="' + esc(safeUrl(site.social[x[0]])) + '" target="_blank" rel="noopener noreferrer">' + ICON[x[0]] + '<span>' + x[1] + '</span></a>';
      }).join('');
    }
  }
  function renderAbout(site) {
    var box = $('#about-dynamic'), a = site.about;
    if (!box || !a) return;
    var slot = $('#about-carousel-slot', box);
    function paras(arr) { return (arr || []).map(function (p) { return '<p>' + rich(p) + '</p>'; }).join(''); }
    var h = '<h1 class="section-title">' + esc(a.title) + '</h1>' + paras(a.intro) + '<div id="about-carousel-slot"></div>';
    (a.sections || []).forEach(function (s) { h += '<h2 class="section-title">' + esc(s.title) + '</h2>' + paras(s.paragraphs); });
    if (a.cta) h += '<div class="about-cta panel"><h2>' + esc(a.cta.title) + '</h2><a href="reservierung.html" class="btn-new-res">' + esc(a.cta.button) + '</a></div>';
    if (a.explainer) h += '<section class="about-explainer"><h2 class="section-title">' + esc(a.explainer.title) + '</h2>' + paras(a.explainer.paragraphs) + '</section>';
    box.innerHTML = h;
    if (slot) $('#about-carousel-slot', box).replaceWith(slot);
  }

  /* Ersetzt den Inhalt nur, wenn er sich wirklich unterscheidet (vermeidet doppelte Bild-Downloads). */
  function swap(box, html) {
    var t = document.createElement('template'); t.innerHTML = html;
    if (t.innerHTML === box.innerHTML) return false;
    box.innerHTML = html; return true;
  }

  /* ---------- Speisekarte (gleiches Markup wie tools/build.py) ---------- */
  function visibleCats(menu) {
    return (menu.categories || []).filter(function (c) {
      return c.visible !== false && (c.items || []).some(function (i) { return i.available !== false; });
    });
  }
  function card(i) {
    return '<div class="menu-item" role="button" tabindex="0" aria-pressed="false" aria-label="' + esc(i.name) + ', ' + esc(i.price) + '. Für Details aktivieren.">' +
      '<div class="menu-flip-inner"><div class="menu-flip-front">' + (i.recommended ? '<span class="badge">Unsere Empfehlung</span>' : '') +
      '<div class="menu-image-wrapper">' + (i.image ? '<img loading="lazy" decoding="async" src="' + esc(i.image) + '" alt="' + esc(i.name) + '" width="640" height="480">' : '') + '</div>' +
      '<h3>' + (i.nr ? esc(i.nr) + '. ' : '') + esc(i.name) + '</h3><p class="price">' + esc(i.price) + '</p><p class="hint">Tippen für Details</p></div>' +
      '<div class="menu-flip-back"><div class="menu-back-scroll"><h3>' + esc(i.name) + '</h3>' +
      (i.description ? '<p>' + esc(i.description) + '</p>' : '<p class="muted">Keine weitere Beschreibung.</p>') +
      (i.allergens ? '<p class="allergens"><strong>Enthält:</strong> ' + esc(i.allergens) + '</p>' : '') +
      '<p class="price">' + esc(i.price) + '</p></div></div></div></div>';
  }
  function renderMenu(menu, site) {
    var box = $('#menu'); if (!box) return;
    var open = $$('.accordion-toggle[aria-expanded="true"]', box).map(function (t) { return t.getAttribute('aria-controls'); });
    var cats = visibleCats(menu);
    var h = '<nav class="menu-chips" aria-label="Kategorien">' + cats.map(function (c) {
      return '<a href="#cat-' + esc(c.id) + '" data-cat="' + esc(c.id) + '">' + esc(c.title) + '</a>';
    }).join('') + '</nav>';
    cats.forEach(function (c) {
      var items = c.items.filter(function (i) { return i.available !== false; });
      h += '<section class="accordion-section" id="cat-' + esc(c.id) + '"><h2 class="accordion-heading"><button class="accordion-toggle" type="button" aria-expanded="false" aria-controls="panel-' + esc(c.id) + '">' +
        '<span>' + esc(c.title) + '</span><span class="count">' + items.length + '</span><span class="accordion-icon" aria-hidden="true">&#9660;</span></button></h2>' +
        '<div class="accordion-body" id="panel-' + esc(c.id) + '" role="region" aria-label="' + esc(c.title) + '"><div class="menu-grid">' +
        items.map(card).join('') + '</div></div></section>';
    });
    if (site && site.menuPage && site.menuPage.allergenNote) h += '<p class="note allergen-note">' + esc(site.menuPage.allergenNote) + '</p>';
    if (!swap(box, h)) return;
    open.forEach(function (id) { setAccordion($('[aria-controls="' + id + '"]', box), true); });
    openFromHash();
    setJsonLd('ld-menu', menuLd(cats));
  }
  function renderHighlights(menu) {
    var box = $('#dish-highlights'); if (!box) return;
    var out = [];
    visibleCats(menu).forEach(function (c) {
      c.items.forEach(function (i) { if (i.recommended && i.available !== false && out.length < 3) out.push([i, c.id]); });
    });
    if (!out.length) { var sec = box.closest('section'); if (sec) sec.hidden = true; return; }
    swap(box, out.map(function (x) {
      var i = x[0];
      return '<a class="dish-card" href="menu.html#cat-' + esc(x[1]) + '"><div class="ph"><span class="badge">Unsere Empfehlung</span>' +
        (i.image ? '<img loading="lazy" decoding="async" src="' + esc(i.image) + '" alt="' + esc(i.name) + '" width="640" height="480">' : '') +
        '</div><div class="body"><h3>' + esc(i.name) + '</h3><p>' + esc(i.description || '') + '</p><span class="price">' + esc(i.price) + '</span></div></a>';
    }).join(''));
  }
  function setAccordion(t, open) {
    if (!t) return;
    t.setAttribute('aria-expanded', String(open));
    t.classList.toggle('open', open);
    var body = document.getElementById(t.getAttribute('aria-controls'));
    if (body) body.classList.toggle('open', open);
    var chip = $('.menu-chips a[data-cat="' + t.getAttribute('aria-controls').replace('panel-', '') + '"]');
    if (chip) {
      chip.classList.toggle('current', open);
      if (open && chip.parentNode.scrollTo) chip.parentNode.scrollTo({ left: chip.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  function openFromHash() {
    if (location.hash.indexOf('#cat-') !== 0) return;
    var sec = document.getElementById(location.hash.slice(1));
    if (sec) { setAccordion($('.accordion-toggle', sec), true); sec.scrollIntoView({ block: 'start' }); }
  }
  document.addEventListener('click', function (e) {
    var chip = e.target.closest('.menu-chips a');
    if (chip) {
      e.preventDefault();
      var sec = document.getElementById('cat-' + chip.getAttribute('data-cat'));
      if (sec) {
        setAccordion($('.accordion-toggle', sec), true);
        sec.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        if (history.replaceState) history.replaceState(null, '', '#cat-' + chip.getAttribute('data-cat'));
      }
      return;
    }
    var t = e.target.closest('.accordion-toggle');
    if (t) {
      var willOpen = t.getAttribute('aria-expanded') !== 'true';
      setAccordion(t, willOpen);
      if (willOpen) track('Speisekarte: ' + ($('span', t) || t).textContent.trim());
      return;
    }
    var c = e.target.closest('.menu-item');
    $$('.menu-item.active').forEach(function (x) { if (x !== c) { x.classList.remove('active'); x.setAttribute('aria-pressed', 'false'); } });
    if (c) { var on = c.classList.toggle('active'); c.setAttribute('aria-pressed', String(on)); }
  });
  document.addEventListener('keydown', function (e) {
    var c = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && c.classList && c.classList.contains('menu-item')) { e.preventDefault(); c.click(); }
  });

  /* ---------- Strukturierte Daten ---------- */
  function setJsonLd(id, data) {
    var s = document.getElementById(id);
    if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = id; document.head.appendChild(s); }
    s.textContent = JSON.stringify(data);
  }
  function menuLd(cats) {
    return {
      '@context': 'https://schema.org', '@type': 'Menu', name: 'Speisekarte IZ Uigurisches Restaurant Mannheim', inLanguage: 'de',
      hasMenuSection: cats.map(function (c) {
        return {
          '@type': 'MenuSection', name: c.title,
          hasMenuItem: c.items.filter(function (i) { return i.available !== false; }).map(function (i) {
            var m = { '@type': 'MenuItem', name: i.name };
            if (i.description) m.description = i.description;
            var p = String(i.price || '').match(/^(\d+),(\d{2})\s*€$/);
            if (p) m.offers = { '@type': 'Offer', price: p[1] + '.' + p[2], priceCurrency: 'EUR' };
            return m;
          })
        };
      })
    };
  }

  /* ---------- Video: spielt nur, solange sichtbar ---------- */
  function initVideo() {
    var v = $('.video-wrapper video'); if (!v) return;
    function poster() { if (v.dataset.poster) { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); } }
    if (!('IntersectionObserver' in window)) { poster(); return; }
    new IntersectionObserver(function (en, o) {
      if (en[0].isIntersecting) { poster(); o.disconnect(); }
    }, { rootMargin: '600px 0px' }).observe(v);
    var saver = navigator.connection && navigator.connection.saveData;
    if (saver || reduceMotion) return;
    new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (x.isIntersecting) { v.preload = 'auto'; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else if (!v.paused) v.pause();
      });
    }, { threshold: 0.5 }).observe(v);
  }

  /* ---------- Dezente Einblendung ---------- */
  function initReveal() {
    var els = $$('.reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- Galerie-Lightbox ---------- */
  function initLightbox() {
    var imgs = $$('.gallery-grid img'); if (!imgs.length) return;
    var box = document.createElement('div');
    box.className = 'lightbox'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Bildansicht');
    box.innerHTML = '<img alt=""><figcaption></figcaption><button class="lb-prev" type="button" aria-label="Vorheriges Bild">&#8249;</button>' +
      '<button class="lb-next" type="button" aria-label="Nächstes Bild">&#8250;</button><button class="lb-close" type="button" aria-label="Schließen">&times;</button>';
    document.body.appendChild(box);
    var big = $('img', box), cap = $('figcaption', box), idx = 0, last = null;
    function show(i) {
      idx = (i + imgs.length) % imgs.length;
      var im = imgs[idx];
      big.src = im.getAttribute('data-full') || im.currentSrc || im.src; big.alt = im.alt; cap.textContent = im.alt + ' (' + (idx + 1) + '/' + imgs.length + ')';
    }
    function open(i) { last = document.activeElement; show(i); box.hidden = false; document.body.style.overflow = 'hidden'; $('.lb-close', box).focus(); }
    function close() { box.hidden = true; document.body.style.overflow = ''; if (last) last.focus(); }
    imgs.forEach(function (im, i) {
      im.tabIndex = 0; im.setAttribute('role', 'button');
      im.addEventListener('click', function () { open(i); });
      im.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lb-close')) close();
      else if (e.target.classList.contains('lb-prev')) show(idx - 1);
      else if (e.target.classList.contains('lb-next')) show(idx + 1);
    });
    var sx = null;
    box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'Tab') {
        var f = $$('button', box), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    });
  }

  /* ---------- Start ---------- */
  function start() {
    initVideo(); initReveal(); initLightbox(); openFromHash();
    var needMenu = !!($('#menu') || $('#dish-highlights'));
    Promise.all([
      fetchJson('data/site.json').catch(function () { return null; }),
      needMenu ? fetchJson('data/menu.json').catch(function () { return null; }) : null
    ]).then(function (res) {
      var site = res[0], menu = res[1];
      if (site) {
        applyText(site); renderLinks(site); renderHours(site); renderAbout(site);
        initAnalytics(site.analytics);
      }
      if (menu) { renderMenu(menu, site); renderHighlights(menu); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
