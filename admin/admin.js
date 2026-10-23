/* IZ Verwaltung – speichert direkt per GitHub-API ins Repository (kein eigener Server).
 * Die Zugriffsrechte prüft GitHub: ohne gültigen Token mit Schreibrecht kann nichts veröffentlicht werden. */
(function () {
  'use strict';
  var API = 'https://api.github.com';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var S = { repo: '', token: '', branch: 'main', files: {}, pending: {}, cats: {} };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg, kind) { var t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || ''); clearTimeout(toast.t); toast.t = setTimeout(function () { t.className = 'toast'; }, 4200); }

  /* ---------- GitHub ---------- */
  function gh(path, opt) {
    opt = opt || {};
    return fetch(API + path, {
      method: opt.method || 'GET',
      headers: { Authorization: 'Bearer ' + S.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store'
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* kein JSON */ }
        if (!r.ok) { var err = new Error((j && j.message) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function b64utf8(str) { var b = new TextEncoder().encode(str), s = ''; b.forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s); }
  function utf8b64(b64) { var s = atob(b64.replace(/\n/g, '')), a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return new TextDecoder().decode(a); }
  function getFile(path) {
    return gh('/repos/' + S.repo + '/contents/' + path + '?ref=' + encodeURIComponent(S.branch)).then(function (f) {
      var text = utf8b64(f.content); return { path: path, sha: f.sha, orig: text, data: JSON.parse(text) };
    });
  }
  function putFile(path, contentB64, message, sha) {
    var body = { message: message, content: contentB64, branch: S.branch }; if (sha) body.sha = sha;
    return gh('/repos/' + S.repo + '/contents/' + path, { method: 'PUT', body: body });
  }

  /* ---------- Anmeldung ---------- */
  function store() { return $('#remember').checked ? localStorage : sessionStorage; }
  function saved(k) { return sessionStorage.getItem(k) || localStorage.getItem(k) || ''; }
  $('#repo').value = saved('iz_repo') || $('#repo').value;
  if (saved('iz_token')) { $('#token').value = saved('iz_token'); }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('#loginMsg'); msg.className = 'msg'; msg.textContent = 'Prüfe Zugang …';
    S.repo = $('#repo').value.trim(); S.token = $('#token').value.trim();
    if (!/^[\w.-]+\/[\w.-]+$/.test(S.repo)) { msg.textContent = 'Bitte Repository im Format Besitzer/Name angeben.'; return; }
    gh('/repos/' + S.repo).then(function (r) {
      S.branch = r.default_branch || 'main';
      if (r.permissions && r.permissions.push === false) throw new Error('Dein Token hat kein Schreibrecht (Contents: Read and write).');
      store().setItem('iz_repo', S.repo); store().setItem('iz_token', S.token);
      return Promise.all([getFile('data/menu.json'), getFile('data/site.json')]);
    }).then(function (f) {
      S.files.menu = f[0]; S.files.site = f[1];
      $('#login').hidden = true; $('#editor').hidden = false; $('#logout').hidden = false;
      $('#who').textContent = S.repo; msg.textContent = '';
      renderAll(); markDirty();
    }).catch(function (err) {
      msg.textContent = err.status === 401 ? 'Token ungültig oder abgelaufen.' : err.status === 404 ? 'Repository nicht gefunden oder Token ohne Zugriff.' : ('Fehler: ' + err.message);
    });
  });
  $('#logout').addEventListener('click', function () {
    if (isDirty() && !confirm('Es gibt ungespeicherte Änderungen. Wirklich abmelden?')) return;
    sessionStorage.removeItem('iz_token'); localStorage.removeItem('iz_token'); location.reload();
  });

  /* ---------- Änderungsstatus ---------- */
  function isDirty() {
    if (Object.keys(S.pending).length) return true;
    return ['menu', 'site'].some(function (k) { return S.files[k] && JSON.stringify(S.files[k].data, null, 2) !== S.files[k].orig; });
  }
  function markDirty() { $('#savebar').hidden = !isDirty(); }
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  $('#discard').addEventListener('click', function () {
    if (!confirm('Alle ungespeicherten Änderungen verwerfen?')) return;
    ['menu', 'site'].forEach(function (k) { S.files[k].data = JSON.parse(S.files[k].orig); });
    S.pending = {}; renderAll(); markDirty();
  });

  function validate() {
    var errs = [];
    S.files.menu.data.categories.forEach(function (c) {
      if (!String(c.title || '').trim()) errs.push('Eine Kategorie hat keinen Namen.');
      c.items.forEach(function (i) {
        if (!String(i.name || '').trim()) errs.push('In „' + c.title + '“ hat ein Gericht keinen Namen.');
        if (!String(i.price || '').trim() || i.price === '0,00 €') errs.push('„' + (i.name || '?') + '“ hat keinen Preis.');
      });
    });
    return errs;
  }
  $('#publish').addEventListener('click', function () {
    var errs = validate();
    if (errs.length) { toast(errs[0] + (errs.length > 1 ? ' (+' + (errs.length - 1) + ' weitere)' : ''), 'err'); return; }
    if (!confirm('Änderungen jetzt veröffentlichen? Sie sind nach ca. 1–2 Minuten auf der Website sichtbar.')) return;
    var btn = this; btn.disabled = true; btn.textContent = 'Veröffentliche …';
    var imgs = Object.keys(S.pending), chain = Promise.resolve();
    imgs.forEach(function (p) {
      chain = chain.then(function () {
        return putFile(p, S.pending[p].b64, 'Verwaltung: Bild hochgeladen (' + p.split('/').pop() + ')').then(function () { delete S.pending[p]; });
      });
    });
    ['menu', 'site'].forEach(function (k) {
      chain = chain.then(function () {
        var f = S.files[k], txt = JSON.stringify(f.data, null, 2);
        if (txt === f.orig) return;
        f.data.updated = new Date().toISOString().slice(0, 10); txt = JSON.stringify(f.data, null, 2);
        return putFile(f.path, b64utf8(txt), 'Verwaltung: ' + (k === 'menu' ? 'Speisekarte' : 'Texte & Infos') + ' aktualisiert', f.sha).then(function (r) { f.sha = r.content.sha; f.orig = txt; });
      });
    });
    chain.then(function () { toast('Veröffentlicht. Sichtbar in ca. 1–2 Minuten.', 'good'); })
      .catch(function (err) {
        toast(err.status === 409 || err.status === 422 ? 'Konflikt: Die Datei wurde zwischenzeitlich geändert. Bitte Seite neu laden.' : ('Fehler: ' + err.message), 'err');
      }).then(function () { btn.disabled = false; btn.textContent = 'Veröffentlichen'; markDirty(); });
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll('.tabs [role=tab]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabs [role=tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.tabpanel').forEach(function (p) { p.hidden = p.id !== 'tab-' + b.dataset.tab; });
      if (b.dataset.tab === 'history') renderHistory();
      if (b.dataset.tab === 'report') renderReport();
    });
  });

  function renderAll() { renderMenu(); renderTexts(); renderHours(); }

  /* ---------- Speisekarte ---------- */
  function normPrice(v) {
    v = v.trim();
    if (/^\d+([.,]\d{1,2})?$/.test(v)) { var n = parseFloat(v.replace(',', '.')); return n.toFixed(2).replace('.', ',') + ' €'; }
    return v;
  }
  function slug(s) { return s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gericht'; }

  function renderMenu() {
    var m = S.files.menu.data, root = $('#tab-menu');
    var openIds = {}; root.querySelectorAll('details[open]').forEach(function (d) { openIds[d.dataset.id] = true; });
    var h = '<p class="hint">Preise und Texte ändern, Gerichte ausblenden (z. B. ausverkauft), als „Unsere Empfehlung“ markieren oder neue hinzufügen. Zum Übernehmen unten auf „Veröffentlichen“ tippen. Hinweis: Die PDF-Speisekarten werden nicht automatisch angepasst.</p>';
    m.categories.forEach(function (c, ci) {
      h += '<details class="cat" data-id="' + esc(c.id) + '"' + (openIds[c.id] ? ' open' : '') + '><summary>' + esc(c.title) +
        (c.visible === false ? ' <em>(ausgeblendet)</em>' : '') + '<span class="count">' + c.items.length + ' Gerichte</span></summary><div class="cat-body">' +
        '<div class="row3"><label>Kategoriename<input data-c="' + ci + '" data-f="title" value="' + esc(c.title) + '"></label>' +
        '<label class="check"><input type="checkbox" data-c="' + ci + '" data-f="visible"' + (c.visible !== false ? ' checked' : '') + '>Kategorie auf Website anzeigen</label></div>';
      c.items.forEach(function (it, ii) {
        var img = S.pending[it.image] ? S.pending[it.image].url : '../' + it.image;
        h += '<div class="item' + (it.available === false ? ' off' : '') + '"><img class="thumb" alt="" src="' + esc(img) + '" onerror="this.style.visibility=\'hidden\'">' +
          '<div><div class="row"><label>Name<input data-c="' + ci + '" data-i="' + ii + '" data-f="name" value="' + esc(it.name) + '"></label>' +
          '<label>Preis<input data-c="' + ci + '" data-i="' + ii + '" data-f="price" inputmode="decimal" value="' + esc(it.price) + '"></label></div>' +
          '<label>Beschreibung<textarea data-c="' + ci + '" data-i="' + ii + '" data-f="description">' + esc(it.description) + '</textarea></label>' +
          '<label>Enthält (Allergene)<input data-c="' + ci + '" data-i="' + ii + '" data-f="allergens" placeholder="z. B. Gluten, Sesam" value="' + esc(it.allergens) + '"></label>' +
          '<div class="actions"><label class="check"><input type="checkbox" data-c="' + ci + '" data-i="' + ii + '" data-f="available"' + (it.available !== false ? ' checked' : '') + '>Verfügbar</label>' +
          '<label class="check"><input type="checkbox" data-c="' + ci + '" data-i="' + ii + '" data-f="recommended"' + (it.recommended ? ' checked' : '') + '>Unsere Empfehlung</label>' +
          '<button type="button" data-act="img" data-c="' + ci + '" data-i="' + ii + '">Bild ändern</button>' +
          '<button type="button" data-act="up" data-c="' + ci + '" data-i="' + ii + '" aria-label="Nach oben">↑</button>' +
          '<button type="button" data-act="down" data-c="' + ci + '" data-i="' + ii + '" aria-label="Nach unten">↓</button>' +
          '<button type="button" class="danger" data-act="del" data-c="' + ci + '" data-i="' + ii + '">Löschen</button></div></div></div>';
      });
      h += '<div class="actions"><button type="button" class="primary" data-act="add" data-c="' + ci + '">+ Gericht hinzufügen</button>' +
        '<button type="button" class="danger" data-act="delcat" data-c="' + ci + '">Kategorie löschen</button></div></div></details>';
    });
    h += '<button type="button" data-act="addcat">+ Neue Kategorie</button><input type="file" id="imgInput" accept="image/*" hidden>';
    root.innerHTML = h;
  }

  $('#tab-menu').addEventListener('input', function (e) {
    var t = e.target, f = t.dataset.f; if (!f) return;
    var m = S.files.menu.data, c = m.categories[+t.dataset.c], o = t.dataset.i !== undefined ? c.items[+t.dataset.i] : c;
    o[f] = t.type === 'checkbox' ? t.checked : t.value;
    if (f === 'available') t.closest('.item').classList.toggle('off', !t.checked);
    markDirty();
  });
  $('#tab-menu').addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.f === 'price') { t.value = normPrice(t.value); S.files.menu.data.categories[+t.dataset.c].items[+t.dataset.i].price = t.value; markDirty(); }
    if (t.dataset.f === 'visible' || t.dataset.f === 'title') renderMenu();
    if (t.id === 'imgInput' && t.files[0]) handleImage(t.files[0]);
  });
  var imgTarget = null;
  $('#tab-menu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var m = S.files.menu.data, ci = +b.dataset.c, ii = +b.dataset.i, c = m.categories[ci], act = b.dataset.act;
    if (act === 'img') { imgTarget = [ci, ii]; $('#imgInput').value = ''; $('#imgInput').click(); return; }
    if (act === 'up' && ii > 0) { var a = c.items; var x = a[ii]; a[ii] = a[ii - 1]; a[ii - 1] = x; }
    else if (act === 'down' && ii < c.items.length - 1) { var a2 = c.items; var y = a2[ii]; a2[ii] = a2[ii + 1]; a2[ii + 1] = y; }
    else if (act === 'del') { if (!confirm('„' + c.items[ii].name + '“ wirklich löschen? (Zum Ausblenden lieber „Verfügbar“ abwählen.)')) return; c.items.splice(ii, 1); }
    else if (act === 'add') { var nr = 0; m.categories.forEach(function (k) { k.items.forEach(function (i) { nr = Math.max(nr, +i.nr || 0); }); }); c.items.push({ nr: nr + 1, name: 'Neues Gericht', price: '0,00 €', description: '', allergens: '', image: '', available: true, recommended: false }); }
    else if (act === 'delcat') { if (!confirm('Kategorie „' + c.title + '“ mit allen ' + c.items.length + ' Gerichten löschen?')) return; m.categories.splice(ci, 1); }
    else if (act === 'addcat') { var nm = prompt('Name der neuen Kategorie:'); if (!nm) return; m.categories.push({ id: slug(nm), title: nm, visible: true, items: [] }); }
    else return;
    renderMenu(); markDirty();
  });

  function handleImage(file) {
    if (!imgTarget) return;
    var it = S.files.menu.data.categories[imgTarget[0]].items[imgTarget[1]];
    createImageBitmap(file).then(function (bmp) {
      var w = Math.min(640, bmp.width), h = Math.round(bmp.height * w / bmp.width);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0, w, h);
      return new Promise(function (res) { cv.toBlob(res, 'image/webp', 0.82); });
    }).then(function (blob) {
      if (!blob) throw new Error('Bild konnte nicht umgewandelt werden.');
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { res([blob, String(fr.result).split(',')[1]]); }; fr.readAsDataURL(blob); });
    }).then(function (r) {
      var path = 'assets/yemekler/' + slug(it.name) + '-' + Date.now().toString(36) + '.webp';
      S.pending[path] = { b64: r[1], url: URL.createObjectURL(r[0]) }; it.image = path;
      renderMenu(); markDirty(); toast('Bild vorbereitet – wird beim Veröffentlichen hochgeladen.');
    }).catch(function (err) { toast('Bild-Fehler: ' + err.message, 'err'); });
  }

  /* ---------- Texte & Infos ---------- */
  var FIELDS = [
    ['Hinweis-Banner (oben auf jeder Seite)', [['notice.enabled', 'Hinweis anzeigen', 'bool'], ['notice.text', 'Hinweistext', 'text']]],
    ['Startseite', [['hero.title', 'Überschrift'], ['hero.subtitle', 'Unterzeile'], ['hero.text', 'Kurztext'], ['hero.buttonMenu', 'Button Speisekarte'], ['hero.buttonReserve', 'Button Reservierung'], ['intro.title', 'Begrüßung – Titel'], ['intro.text', 'Begrüßung – Text', 'area'], ['highlights.title', 'Empfehlungen – Titel'], ['highlights.text', 'Empfehlungen – Text (die ersten 3 als „Unsere Empfehlung“ markierten Gerichte erscheinen auf der Startseite)', 'area'], ['delivery.title', 'Lieferdienst – Titel'], ['lunch.title', 'Mittagstisch – Titel'], ['lunch.button', 'Mittagstisch – Button'], ['video.title', 'Video – Titel'], ['social.title', 'Social Media – Titel']]],
    ['Links', [['delivery.items.0.url', 'Uber Eats – Link'], ['delivery.items.1.url', 'Lieferando – Link'], ['social.instagram', 'Instagram – Link'], ['social.tiktok', 'TikTok – Link']]],
    ['Speisekarte-Seite', [['menuPage.title', 'Titel'], ['menuPage.subtitle', 'Untertitel'], ['menuPage.text', 'Hinweistext', 'area'], ['menuPage.allergenNote', 'Allergen-Hinweis', 'area'], ['menuPage.extra', 'Zusatzzeile (z. B. Nachspeisen)']]],
    ['Kontakt & Adresse', [['restaurant.phone', 'Telefonnummer'], ['restaurant.street', 'Straße / Quadrat'], ['restaurant.zip', 'PLZ'], ['restaurant.city', 'Ort'], ['contact.title', 'Seitentitel'], ['contact.intro', 'Einleitung', 'area'], ['contact.reservationText', 'Text Reservierung', 'area'], ['contact.directionsText', 'Text Anfahrt', 'area'], ['hoursNote', 'Hinweis zu Öffnungszeiten', 'area']]],
    ['Reichweitenmessung', [['analytics.code', 'GoatCounter-Code (leer = aus)'], ['analytics.requireConsent', 'Erst nach Zustimmung laden', 'bool']]]
  ];
  function getP(o, p) { return p.split('.').reduce(function (x, k) { return x == null ? x : x[k]; }, o); }
  function setP(o, p, v) { var k = p.split('.'), l = k.pop(); var t = k.reduce(function (x, kk) { return x[kk]; }, o); t[l] = v; }

  function renderTexts() {
    var site = S.files.site.data, h = '<p class="hint">Hier änderst du Formulierungen. Leere Felder lassen den bisherigen Standardtext der Seite stehen.</p>';
    FIELDS.forEach(function (g) {
      h += '<div class="card"><h2>' + esc(g[0]) + '</h2>';
      g[1].forEach(function (f) {
        var v = getP(site, f[0]); if (v === undefined) v = '';
        if (f[2] === 'bool') h += '<label class="check"><input type="checkbox" data-p="' + f[0] + '"' + (v ? ' checked' : '') + '>' + esc(f[1]) + '</label>';
        else if (f[2] === 'area' || f[2] === 'text') h += '<label>' + esc(f[1]) + '<textarea data-p="' + f[0] + '">' + esc(v) + '</textarea></label>';
        else h += '<label>' + esc(f[1]) + '<input data-p="' + f[0] + '" value="' + esc(v) + '"></label>';
      });
      h += '</div>';
    });
    var a = site.about;
    h += '<div class="card"><h2>Über-uns-Seite</h2><label>Titel<input data-p="about.title" value="' + esc(a.title) + '"></label>' +
      '<label>Einleitung (Absätze mit Leerzeile trennen)<textarea data-ap="intro" rows="6">' + esc((a.intro || []).join('\n\n')) + '</textarea></label>';
    (a.sections || []).forEach(function (s, i) {
      h += '<h3>Abschnitt ' + (i + 1) + '</h3><label>Überschrift<input data-sec="' + i + '" data-sf="title" value="' + esc(s.title) + '"></label>' +
        '<label>Text<textarea data-sec="' + i + '" data-sf="paragraphs" rows="6">' + esc((s.paragraphs || []).join('\n\n')) + '</textarea></label>' +
        '<div class="actions"><button type="button" class="danger" data-delsec="' + i + '">Abschnitt löschen</button></div>';
    });
    h += '<div class="actions"><button type="button" data-addsec>+ Abschnitt hinzufügen</button></div>' +
      '<p class="hint">Mit **Doppelsternen** wird Text fett.</p></div>';
    $('#tab-texts').innerHTML = h;
  }
  $('#tab-texts').addEventListener('input', function (e) {
    var t = e.target, site = S.files.site.data;
    if (t.dataset.p) {
      var v = t.type === 'checkbox' ? t.checked : t.value; setP(site, t.dataset.p, v);
      if (t.dataset.p === 'restaurant.phone') { var d = v.replace(/[^\d+]/g, ''); site.restaurant.phoneHref = d.charAt(0) === '0' ? '+49' + d.slice(1) : d; }
    } else if (t.dataset.ap) { site.about[t.dataset.ap] = t.value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
    else if (t.dataset.sec !== undefined) {
      var s = site.about.sections[+t.dataset.sec];
      s[t.dataset.sf] = t.dataset.sf === 'paragraphs' ? t.value.split(/\n\s*\n/).map(function (x) { return x.trim(); }).filter(Boolean) : t.value;
    }
    markDirty();
  });
  $('#tab-texts').addEventListener('click', function (e) {
    var site = S.files.site.data;
    if (e.target.dataset.delsec !== undefined) { if (!confirm('Abschnitt löschen?')) return; site.about.sections.splice(+e.target.dataset.delsec, 1); renderTexts(); markDirty(); }
    if (e.target.hasAttribute('data-addsec')) { site.about.sections.push({ title: 'Neuer Abschnitt', paragraphs: ['Text …'] }); renderTexts(); markDirty(); }
  });

  /* ---------- Öffnungszeiten ---------- */
  function renderHours() {
    var site = S.files.site.data, h = '<div class="card"><h2>Öffnungszeiten</h2><p class="hint">Für Zeiten über Mitternacht „00:00“ als Ende eintragen. Zweites Zeitfenster z. B. für Mittag und Abend.</p>';
    site.hours.forEach(function (d, i) {
      var s1 = d.slots[0] || ['', ''], s2 = d.slots[1] || ['', ''];
      function rng(k, s, lbl) {
        return '<span class="range"><input type="time" aria-label="' + esc(d.day) + ' ' + lbl + ' von" data-h="' + i + '" data-hf="' + k + '" data-end="0" value="' + s[0] + '"> – ' +
          '<input type="time" aria-label="' + esc(d.day) + ' ' + lbl + ' bis" data-h="' + i + '" data-hf="' + k + '" data-end="1" value="' + s[1] + '"></span>';
      }
      h += '<div class="hours-row' + (d.closed ? ' is-closed' : '') + '"><strong>' + esc(d.day) + '</strong><div class="slots">' +
        '<label class="check"><input type="checkbox" data-h="' + i + '" data-hf="closed"' + (d.closed ? ' checked' : '') + '>geschlossen</label>' +
        rng(0, s1, 'Zeitfenster 1') + rng(1, s2, 'Zeitfenster 2') + '</div></div>';
    });
    $('#tab-hours').innerHTML = h + '</div>';
  }
  $('#tab-hours').addEventListener('input', function (e) {
    var t = e.target, d = S.files.site.data.hours[+t.dataset.h]; if (!d) return;
    var row = t.closest('.hours-row');
    if (t.dataset.hf === 'closed') {
      d.closed = t.checked;
      if (t.checked) d.slots = [];
      else {  // wieder geöffnet: eingetragene Zeiten übernehmen
        var r = row.querySelectorAll('[data-end]'), v = [];
        for (var k = 0; k < 4; k += 2) { if (r[k].value && r[k + 1].value) v.push([r[k].value, r[k + 1].value]); }
        d.slots = v;
      }
      row.classList.toggle('is-closed', t.checked);
      markDirty(); return;
    }
    else {
      var rows = $('#tab-hours').querySelectorAll('[data-h="' + t.dataset.h + '"][data-end]'), v = [];
      for (var k = 0; k < 4; k += 2) { if (rows[k].value && rows[k + 1].value) v.push([rows[k].value, rows[k + 1].value]); }
      d.slots = v;
    }
    markDirty();
  });

  /* ---------- Änderungen (Verlauf) ---------- */
  function renderHistory() {
    var root = $('#tab-history'); root.innerHTML = '<div class="card"><p>Lade …</p></div>';
    Promise.all(['data/menu.json', 'data/site.json'].map(function (p) { return gh('/repos/' + S.repo + '/commits?per_page=15&path=' + p + '&sha=' + encodeURIComponent(S.branch)); })).then(function (r) {
      var all = r[0].concat(r[1]).sort(function (a, b) { return a.commit.author.date < b.commit.author.date ? 1 : -1; });
      var seen = {}; all = all.filter(function (c) { return seen[c.sha] ? false : (seen[c.sha] = 1); }).slice(0, 20);
      root.innerHTML = '<div class="card"><h2>Letzte Änderungen</h2><table class="hist"><tr><th>Datum</th><th>Änderung</th><th>Von</th></tr>' +
        all.map(function (c) { return '<tr><td>' + esc(new Date(c.commit.author.date).toLocaleString('de-DE')) + '</td><td>' + esc(c.commit.message.split('\n')[0]) + '</td><td>' + esc(c.commit.author.name) + '</td></tr>'; }).join('') +
        '</table><p class="hint">Jede Änderung ist in GitHub gespeichert und kann dort bei Bedarf rückgängig gemacht werden.</p></div>';
    }).catch(function (err) { root.innerHTML = '<div class="card"><p class="msg">Verlauf nicht ladbar: ' + esc(err.message) + '</p></div>'; });
  }

  /* ---------- Report ---------- */
  function renderReport() {
    var root = $('#tab-report'); root.innerHTML = '<div class="card"><p>Lade …</p></div>';
    fetch('../data/analytics.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }).then(function (a) {
      var h = '<div class="card"><h2>Reichweite</h2>';
      if (a && a.status === 'ok') {
        h += '<p>Zeitraum: <strong>' + esc(a.from) + ' bis ' + esc(a.to) + '</strong> (Stand ' + esc(a.generated) + ')</p><p>Besuche gesamt: <strong>' + esc(a.total.visitors) + '</strong> · Seitenaufrufe: <strong>' + esc(a.total.pageviews) + '</strong></p>';
      } else {
        h += '<p><strong>Nicht verfügbar.</strong> ' + esc((a && a.reason) || 'Die Reichweitenmessung ist noch nicht eingerichtet.') + ' Anleitung: siehe ANLEITUNG.md, Abschnitt „Reichweite“.</p>';
      }
      h += '<p><a href="report.html" target="_blank" rel="noopener"><button type="button" class="primary">Kundenreport öffnen / als PDF speichern</button></a></p></div>';
      root.innerHTML = h;
    });
  }
})();
