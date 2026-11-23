/* Dachfenster-Planer fuer Schophuis: Vorhaben, Groesse (auch aus dem Typenschild), Dach, Bedienung, Extras.
   Zeichnet den Raum im Schnitt und die Dachansicht als SVG, gibt Hinweise und baut die Anfrage. */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function z(x, n) { return x.toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 }); }
  function m(x) { return z(x, 2) + ' m'; }

  /* Uebliche Dachfenstergroessen (Aussenmass Rahmen, cm). Kennung wie auf dem Typenschild gaengiger Hersteller. */
  var GROESSEN = [
    ['CK02', 55, 78], ['CK04', 55, 98], ['CK06', 55, 118], ['FK04', 66, 98], ['FK06', 66, 118], ['FK08', 66, 140],
    ['MK04', 78, 98], ['MK06', 78, 118], ['MK08', 78, 140], ['MK10', 78, 160], ['PK06', 94, 118], ['PK08', 94, 140], ['PK10', 94, 160],
    ['SK06', 114, 118], ['SK08', 114, 140], ['SK10', 114, 160], ['UK04', 134, 98], ['UK08', 134, 140], ['UK10', 134, 160]
  ];
  var VORHABEN = { austausch: 'Altes Fenster austauschen', neu: 'Neues Fenster einbauen', platz: 'Mehr Platz und Licht' };
  var s = { vorhaben: 'austausch', groesse: 'MK06', anzahl: 1, anordnung: 'nebeneinander', neigung: 40, knie: 0.8, deckung: 'Dachpfannen', bedienung: 'Griff oben', extras: ['Innenfutter'], raum: 16, ansicht: 'schnitt', codeErkannt: '' };

  function gr() { for (var i = 0; i < GROESSEN.length; i++) if (GROESSEN[i][0] === s.groesse) return GROESSEN[i]; return GROESSEN[7]; }

  /* ---------- Geometrie im Schnitt ---------- */
  function lage() {
    var g = gr(), al = s.neigung * Math.PI / 180, sin = Math.sin(al), k = s.knie;
    var L = g[2] / 100, n = s.anordnung === 'übereinander' ? s.anzahl : 1, Lges = n * L + (n - 1) * 0.1;
    var hu = Math.max(k + 0.08, 1.0);                       // Unterkante: etwa einen Meter ueber dem Boden, sonst knapp ueber der Wand
    var d0 = (hu - k) / sin;
    return { al: al, sin: sin, cos: Math.cos(al), k: k, L: L, n: n, Lges: Lges, d0: d0, hu: hu,
      hoErst: k + (d0 + L) * sin, ho: k + (d0 + Lges) * sin, flaeche: s.anzahl * g[1] * g[2] / 1e4 };
  }

  /* ---------- Zeichnung: Raum im Schnitt ---------- */
  function schnitt() {
    var l = lage(), W = 640, H = 420, sc = 105, x0 = 70, y0 = 370;
    function P(x, h) { return [x0 + x * sc, y0 - h * sc]; }
    function pt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
    var hMax = 3.3, dMax = (hMax - l.k) / l.sin, xr = Math.min(dMax * l.cos, (W - x0 - 20) / sc), dEnd = xr / l.cos;
    function dach(d) { return P(d * l.cos, l.k + d * l.sin); }
    var t = 0.26, nx = -l.sin * t, nh = l.cos * t;          // Dachdicke senkrecht zur Flaeche
    function aussen(d) { var p = dach(d); return [p[0] + nx * sc, p[1] - nh * sc]; }
    var o = [];
    o.push('<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="df-svg" role="img" aria-label="Schnitt durch den Raum mit Dachfenster">');
    o.push('<defs><pattern id="df-schraff" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#002e18" stroke-width="1.2" opacity=".35"/></pattern>' +
      '<linearGradient id="df-glas" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#e9f3f7"/><stop offset="1" stop-color="#bcd6e0"/></linearGradient></defs>');
    // Licht durch das Fenster
    var sonne = 52 * Math.PI / 180, dxs = -Math.cos(sonne), dys = Math.sin(sonne);
    function strahl(d) { var p = dach(d), f = (y0 - p[1]) / (dys * sc); return [p[0] + dxs * f * sc, y0]; }
    var a = dach(l.d0), b = dach(l.d0 + l.Lges);
    o.push('<polygon class="df-licht" points="' + [a, b, strahl(l.d0 + l.Lges), strahl(l.d0)].map(pt).join(' ') + '"/>');
    // Boden, Wand, Dach
    o.push('<line class="df-boden" x1="' + (x0 - 40) + '" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '"/>');
    o.push('<rect x="' + (x0 - 22) + '" y="' + (y0 - l.k * sc) + '" width="22" height="' + (l.k * sc) + '" fill="url(#df-schraff)" stroke="#002e18" stroke-width="2"/>');
    o.push('<polygon class="df-dach" points="' + [dach(-0.35), dach(l.d0), aussen(l.d0), aussen(-0.35)].map(pt).join(' ') + '"/>');
    o.push('<polygon class="df-dach" points="' + [dach(l.d0 + l.Lges), dach(dEnd), aussen(dEnd), aussen(l.d0 + l.Lges)].map(pt).join(' ') + '"/>');
    // Fenster(e) in der Dachflaeche
    for (var i = 0; i < l.n; i++) {
      var d1 = l.d0 + i * (l.L + 0.1), d2 = d1 + l.L, p1 = dach(d1), p2 = dach(d2), q2 = aussen(d2), q1 = aussen(d1);
      o.push('<polygon class="df-rahmen" points="' + [p1, p2, q2, q1].map(pt).join(' ') + '"/>');
      var m1 = [(p1[0] * 0.25 + q1[0] * 0.75), (p1[1] * 0.25 + q1[1] * 0.75)], m2 = [(p2[0] * 0.25 + q2[0] * 0.75), (p2[1] * 0.25 + q2[1] * 0.75)];
      o.push('<line class="df-glas" x1="' + m1[0] + '" y1="' + m1[1] + '" x2="' + m2[0] + '" y2="' + m2[1] + '"/>');
      if (i > 0) { var pz = dach(d1 - 0.1); o.push('<polygon class="df-dach" points="' + [pz, p1, q1, aussen(d1 - 0.1)].map(pt).join(' ') + '"/>'); }
    }
    // Person (1,78 m) dort, wo man stehen kann
    var xp = Math.max(0.55, (Math.max(0, 1.95 - l.k)) / Math.tan(l.al) + 0.5);
    if (xp * sc + x0 > W - 40) xp = (W - 40 - x0) / sc;
    var fp = P(xp, 0), kh = 1.78 * sc;
    o.push('<g class="df-person" transform="translate(' + fp[0] + ',' + fp[1] + ')">' +
      '<circle cx="0" cy="' + (-kh + 12) + '" r="11"/>' +
      '<path d="M-15 ' + (-kh + 28) + ' Q0 ' + (-kh + 22) + ' 15 ' + (-kh + 28) + ' L18 ' + (-kh * 0.52) + ' L11 ' + (-kh * 0.52) + ' L9 0 L2 0 L0 ' + (-kh * 0.47) + ' L-2 0 L-9 0 L-11 ' + (-kh * 0.52) + ' L-18 ' + (-kh * 0.52) + ' Z"/></g>');
    // Blicklinie von den Augen (1,65 m)
    var auge = P(xp + 0.08, 1.65), mitte = dach(l.d0 + l.Lges / 2), sieht = 1.65 > l.hu && 1.65 < l.ho + 0.25;
    o.push('<line class="df-blick' + (sieht ? '' : ' df-blick-nein') + '" x1="' + auge[0] + '" y1="' + auge[1] + '" x2="' + mitte[0] + '" y2="' + mitte[1] + '"/>');
    // Masse: Unterkante, Oberkante, Wandhoehe
    function mass(h, text, cls) {
      var y = y0 - h * sc;
      o.push('<line class="df-mass-linie" x1="' + (x0 - 22) + '" y1="' + y + '" x2="' + (W - 8) + '" y2="' + y + '"/>');
      o.push('<text class="df-mass ' + (cls || '') + '" x="' + (W - 10) + '" y="' + (y - 6) + '" text-anchor="end">' + text + '</text>');
    }
    mass(l.hu, 'Unterkante ' + m(l.hu));
    mass(l.ho, 'Oberkante ' + m(l.ho), 'df-mass-stark');
    if (l.k > 0.05) o.push('<text class="df-mass" x="' + (x0 - 34) + '" y="' + (y0 - l.k * sc / 2) + '" text-anchor="middle" transform="rotate(-90 ' + (x0 - 34) + ' ' + (y0 - l.k * sc / 2) + ')">' + m(l.k) + '</text>');
    var wn = dach(Math.min(dEnd - 0.4, l.d0 + l.Lges + 0.7));
    o.push('<text class="df-mass" x="' + (wn[0] + 8) + '" y="' + (wn[1] + 22) + '">' + s.neigung + '°</text>');
    o.push('<text class="df-mass df-mass-klein" x="' + (fp[0]) + '" y="' + (y0 + 20) + '" text-anchor="middle">1,78 m</text>');
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- Zeichnung: Dachansicht mit Eindeckung ---------- */
  function dachansicht() {
    var g = gr(), W = 640, H = 420, n = s.anzahl, neben = s.anordnung === 'nebeneinander' || n === 1;
    var bw = g[1] / 100, bh = g[2] / 100, spalt = 0.1;
    var gesB = neben ? n * bw + (n - 1) * spalt : bw, gesH = neben ? bh : n * bh + (n - 1) * spalt;
    var sc = Math.min(260 / gesB, 230 / gesH, 150), ox = (W - gesB * sc) / 2, oy = 60 + (300 - gesH * sc) / 2 + 20;
    var muster = {
      'Dachpfannen': '<pattern id="df-deck" width="' + (0.3 * sc) + '" height="' + (0.34 * sc) + '" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="#d9d6cc"/><path d="M0 ' + (0.34 * sc - 2) + ' q' + (0.075 * sc) + ' -' + (0.07 * sc) + ' ' + (0.15 * sc) + ' 0 t' + (0.15 * sc) + ' 0" fill="none" stroke="#8d8a80" stroke-width="2"/></pattern>',
      'Biberschwanz': '<pattern id="df-deck" width="' + (0.18 * sc) + '" height="' + (0.3 * sc) + '" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="#d9d6cc"/><path d="M0 0 v' + (0.15 * sc) + ' a' + (0.09 * sc) + ' ' + (0.09 * sc) + ' 0 0 0 ' + (0.18 * sc) + ' 0 v-' + (0.15 * sc) + '" fill="none" stroke="#8d8a80" stroke-width="1.6"/><path d="M' + (0.09 * sc) + ' ' + (0.15 * sc) + ' v' + (0.15 * sc) + '" stroke="#8d8a80" stroke-width="1.6"/></pattern>',
      'Schiefer': '<pattern id="df-deck" width="' + (0.4 * sc) + '" height="' + (0.4 * sc) + '" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="#bfc2c0"/><path d="M0 ' + (0.2 * sc) + ' h' + (0.4 * sc) + ' M0 ' + (0.4 * sc) + ' h' + (0.4 * sc) + ' M' + (0.1 * sc) + ' 0 v' + (0.2 * sc) + ' M' + (0.3 * sc) + ' ' + (0.2 * sc) + ' v' + (0.2 * sc) + '" stroke="#6f7472" stroke-width="1.4"/></pattern>',
      'Blech': '<pattern id="df-deck" width="' + (0.5 * sc) + '" height="40" patternUnits="userSpaceOnUse"><rect width="100%" height="100%" fill="#cfd3d1"/><path d="M1 0 v40" stroke="#7d8482" stroke-width="2.4"/></pattern>'
    };
    var p = muster[s.deckung] || muster['Dachpfannen'];
    var o = ['<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="df-svg" role="img" aria-label="Ansicht von außen auf die Dachfläche">'];
    o.push('<defs>' + p + '<linearGradient id="df-glas2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#eef5f8"/><stop offset=".55" stop-color="#b7cfd9"/><stop offset="1" stop-color="#8fb0be"/></linearGradient></defs>');
    o.push('<rect x="10" y="40" width="' + (W - 20) + '" height="' + (H - 60) + '" fill="url(#df-deck)" stroke="#002e18" stroke-width="2"/>');
    o.push('<text class="df-mass" x="20" y="30">' + esc(s.deckung === 'Weiß ich nicht' ? 'Eindeckung: klären wir vor Ort' : s.deckung) + '</text>');
    for (var i = 0; i < n; i++) {
      var x = ox + (neben ? i * (bw + spalt) * sc : 0), y = oy + (neben ? 0 : i * (bh + spalt) * sc), w = bw * sc, h = bh * sc, r = Math.max(6, 0.07 * sc);
      o.push('<rect class="df-eindeck" x="' + (x - 7) + '" y="' + (y - 7) + '" width="' + (w + 14) + '" height="' + (h + 14) + '"/>');
      o.push('<rect class="df-rahmen2" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"/>');
      o.push('<rect x="' + (x + r) + '" y="' + (y + r) + '" width="' + (w - 2 * r) + '" height="' + (h - 2 * r) + '" fill="url(#df-glas2)"/>');
      o.push('<path d="M' + (x + r + 6) + ' ' + (y + h - r - 6) + ' L' + (x + w * 0.55) + ' ' + (y + r + 6) + '" stroke="#fff" stroke-width="3" opacity=".55"/>');
    }
    // Masslinien
    var yb = oy - 26;
    o.push('<line class="df-masspfeil" x1="' + ox + '" y1="' + yb + '" x2="' + (ox + gesB * sc) + '" y2="' + yb + '"/><text class="df-mass df-mass-stark" x="' + (ox + gesB * sc / 2) + '" y="' + (yb - 7) + '" text-anchor="middle">' + z(gesB * 100) + ' cm</text>');
    var xb = ox + gesB * sc + 26;
    o.push('<line class="df-masspfeil" x1="' + xb + '" y1="' + oy + '" x2="' + xb + '" y2="' + (oy + gesH * sc) + '"/><text class="df-mass df-mass-stark" x="' + (xb + 8) + '" y="' + (oy + gesH * sc / 2 + 5) + '">' + z(gesH * 100) + ' cm</text>');
    o.push('<text class="df-mass df-mass-klein" x="' + (W / 2) + '" y="' + (H - 6) + '" text-anchor="middle">Grün: Eindeckrahmen, der Anschluss an Ihr Dach</text>');
    o.push('</svg>');
    return o.join('');
  }

  /* ---------- Empfehlungen und Hinweise ---------- */
  function bedienEmpfehlung(l) {
    var ok = {};
    if (l.hoErst <= 2.05) ok['Griff oben'] = 1;
    if (l.hu <= 1.35) ok['Griff unten'] = 1;
    if (l.hoErst > 2.05 || l.hu > 1.35) { ok['Elektrisch'] = 1; ok['Solar'] = 1; }
    return ok;
  }
  function hinweise(l) {
    var h = [];
    if (s.neigung < 15) h.push(['warn', 'Unter 15° Neigung passt ein normales Dachfenster nicht. Für flache Dächer gibt es eigene Fenster, wir beraten Sie gern.']);
    if (l.ho < 1.85) h.push(['warn', 'Oben endet das Fenster bei ' + m(l.ho) + '. Im Stehen sehen Sie nicht hinaus. Ein höheres Fenster oder zwei übereinander helfen.']);
    else h.push(['ok', 'Oben endet das Fenster bei ' + m(l.ho) + ': Sie können im Stehen hinaussehen.']);
    if (l.hu > 1.3) h.push(['info', 'Die Unterkante liegt bei ' + m(l.hu) + ', weil die Wand hoch ist. Im Sitzen sehen Sie vor allem Himmel.']);
    if (s.vorhaben === 'neu') {
      var ziel = s.raum * 0.1;
      h.push([l.flaeche >= ziel * 0.85 ? 'ok' : 'info', 'Fensterfläche ' + z(l.flaeche, 2) + ' m² für ' + s.raum + ' m² Raum. Faustregel: etwa ein Zehntel der Raumfläche' + (l.flaeche >= ziel * 0.85 ? ', das passt.' : ', also rund ' + z(ziel, 1) + ' m².')]);
      if (gr()[1] > 70) h.push(['info', 'Breiter als der Abstand Ihrer Sparren? Kein Problem: Als Zimmerei setzen wir den Wechsel gleich mit ein.']);
    }
    if (s.vorhaben === 'austausch') h.push(['info', 'Beim Austausch entsorgen wir das alte Fenster und schließen das neue wieder dicht an Ihr Dach an.']);
    return h;
  }

  /* ---------- Groessen-Kacheln ---------- */
  function vorschlag() {
    var ziel = s.raum * 0.1, best = null;
    [1, 2, 3].forEach(function (n) {
      GROESSEN.forEach(function (g) {
        if (g[2] < 98) return;
        var f = n * g[1] * g[2] / 1e4, d = Math.abs(f - ziel) + (n - 1) * 0.12;
        if (!best || d < best.d) best = { n: n, g: g, d: d };
      });
    });
    return best;
  }
  function kacheln() {
    var v = s.vorhaben === 'neu' ? vorschlag() : null;
    $('#df-groessen').innerHTML = GROESSEN.map(function (g) {
      var w = g[1] / 134 * 34, h = g[2] / 160 * 42;
      return '<button type="button" aria-pressed="' + (g[0] === s.groesse) + '" data-code="' + g[0] + '">' +
        '<svg viewBox="0 0 40 46" aria-hidden="true"><rect x="' + (20 - w / 2) + '" y="' + (44 - h) + '" width="' + w + '" height="' + h + '"/></svg>' +
        '<strong>' + g[1] + ' × ' + g[2] + '</strong><small>' + g[0] + '</small>' + (v && v.g[0] === g[0] ? '<em>Vorschlag</em>' : '') + '</button>';
    }).join('');
    if (v) $('#df-raum-text').textContent = 'Faustregel: Fensterfläche etwa ein Zehntel der Raumfläche. Für ' + s.raum + ' m² passt zum Beispiel ' + (v.n > 1 ? v.n + ' × ' : '') + v.g[1] + ' × ' + v.g[2] + ' cm.';
  }

  /* ---------- Typenschild lesen ---------- */
  function leseCode(t) {
    t = String(t || '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ');
    var w = t.split(/\s+/);
    for (var i = 0; i < w.length; i++) {
      var r = /^([CFMPSU])K?0?(\d{1,2})$/.exec(w[i]);
      if (r) { var c = r[1] + 'K' + ('0' + r[2]).slice(-2); for (var j = 0; j < GROESSEN.length; j++) if (GROESSEN[j][0] === c) return c; }
    }
    return '';
  }

  /* ---------- Alles neu zeichnen ---------- */
  function zeige() {
    var l = lage(), g = gr();
    $('#df-zeichnung').innerHTML = s.ansicht === 'dach' ? dachansicht() : schnitt();
    $('#df-hinweise').innerHTML = hinweise(l).map(function (x) { return '<li class="df-h-' + x[0] + '">' + esc(x[1]) + '</li>'; }).join('');
    $('#df-neigung-wert').textContent = s.neigung + '°';
    $('#df-knie-wert').textContent = m(s.knie);
    $('#df-raum-wert').textContent = s.raum + ' m²';
    $('#df-anzahl').textContent = s.anzahl;
    $('#df-anordnung-box').hidden = s.anzahl < 2;
    $$('#df-groessen button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.code === s.groesse ? 'true' : 'false'); });
    var ok = bedienEmpfehlung(l);
    $$('#df-bedienung .df-karte').forEach(function (b) { $('.df-empf', b).hidden = !ok[b.dataset.wert]; });
    $('#df-bed-text').textContent = l.hoErst > 2.05 ? 'Ein Griff oben säße bei ' + m(l.hoErst) + '. Bequemer: Griff unten bei ' + m(l.hu) + (l.hu > 1.35 ? ' (auch das ist hoch)' : '') + ' oder elektrisch.' : 'Der Griff oben sitzt bei ' + m(l.hoErst) + ' und ist gut erreichbar.';
    var zl = zettel();
    $('#df-zettel').innerHTML = zl.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + (x[2] ? ' <a href="#' + x[2] + '" class="df-aendern">ändern</a>' : '') + '</dd></div>'; }).join('');
    $('#df-uebersicht').textContent = zl.slice(0, 4).map(function (x) { return x[1]; }).join(' · ');
  }
  function zettel() {
    var g = gr(), l = lage();
    var z1 = [['Vorhaben', VORHABEN[s.vorhaben], 'df-s1'],
      ['Fenster', (s.anzahl > 1 ? s.anzahl + ' × ' : '') + g[1] + ' × ' + g[2] + ' cm (' + g[0] + ')' + (s.anzahl > 1 ? ', ' + s.anordnung : ''), 'df-s2'],
      ['Dach', s.neigung + '° Neigung, ' + s.deckung + ', Wand innen ' + m(s.knie), 'df-s3'],
      ['Öffnen', s.bedienung, 'df-s4'],
      ['Dazu', s.extras.length ? s.extras.join(', ') : 'nichts', 'df-s5']];
    if (zettel.mitRaum) z1.push(['Im Raum', 'Unterkante ' + m(l.hu) + ', Oberkante ' + m(l.ho), '']);
    if (s.codeErkannt) z1.splice(2, 0, ['Typenschild', s.codeErkannt, 'df-s2']);
    if (s.vorhaben === 'neu') z1.splice(2, 0, ['Raum', s.raum + ' m²', 'df-s2']);
    return z1;
  }

  /* ---------- Schalter ---------- */
  function wahl(gruppe, attr, fn) {
    gruppe.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !gruppe.contains(b)) return;
      $$('button', gruppe).forEach(function (x) { x.setAttribute(attr, x === b ? 'true' : 'false'); });
      fn(b);
    });
  }
  function vorhaben(v) {
    s.vorhaben = v;
    $('#df-gaube').hidden = v !== 'platz';
    $('#df-code-box').hidden = v !== 'austausch';
    $('#df-raum-box').hidden = v !== 'neu';
    $('#df-s2-titel').textContent = v === 'austausch' ? 'Das alte Fenster' : 'Das neue Fenster';
    kacheln(); zeige();
  }

  function start() {
    if (!$('#df-zeichnung')) return;
    var q = new URLSearchParams(location.search);
    if (VORHABEN[q.get('vorhaben')]) { s.vorhaben = q.get('vorhaben'); $$('#df-vorhaben button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.wert === s.vorhaben ? 'true' : 'false'); }); }
    wahl($('#df-vorhaben'), 'aria-pressed', function (b) { vorhaben(b.dataset.wert); });
    $('#df-gaube-weiter').addEventListener('click', function () { $('#df-vorhaben [data-wert="neu"]').click(); $('#df-s2').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    $('#df-groessen').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; s.groesse = b.dataset.code; s.codeErkannt = ''; $('#df-code-ok').textContent = ''; zeige(); });
    $('#df-code').addEventListener('input', function () {
      var c = leseCode(this.value), g;
      if (c) { s.groesse = c; g = gr(); s.codeErkannt = this.value.trim(); $('#df-code-ok').innerHTML = '<b>Erkannt: ' + g[1] + ' × ' + g[2] + ' cm.</b>'; }
      else { s.codeErkannt = this.value.trim(); $('#df-code-ok').textContent = this.value.trim().length > 3 ? 'Diesen Code prüfen wir selbst. Wählen Sie unten die ungefähre Größe.' : ''; }
      zeige();
    });
    $('#df-raum').addEventListener('input', function () { s.raum = +this.value; kacheln(); zeige(); });
    $('#df-minus').addEventListener('click', function () { s.anzahl = Math.max(1, s.anzahl - 1); zeige(); });
    $('#df-plus').addEventListener('click', function () { s.anzahl = Math.min(4, s.anzahl + 1); zeige(); });
    wahl($('#df-anordnung'), 'aria-pressed', function (b) { s.anordnung = b.dataset.wert; zeige(); });
    $('#df-neigung').addEventListener('input', function () { s.neigung = +this.value; zeige(); });
    $('#df-knie').addEventListener('input', function () { s.knie = this.value / 100; zeige(); });
    wahl($('#df-deckung'), 'aria-pressed', function (b) { s.deckung = b.dataset.wert; if (s.ansicht !== 'dach') ansicht('dach'); else zeige(); });
    wahl($('#df-bedienung'), 'aria-pressed', function (b) { s.bedienung = b.dataset.wert; zeige(); });
    $('#df-extras').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      s.extras = $$('#df-extras button[aria-pressed="true"]').map(function (x) { return x.dataset.wert; }); zeige();
    });
    function ansicht(a) { s.ansicht = a; $$('.df-ansicht button').forEach(function (x) { x.setAttribute('aria-selected', x.dataset.ansicht === a ? 'true' : 'false'); }); zeige(); }
    $$('.df-ansicht button').forEach(function (b) { b.addEventListener('click', function () { ansicht(b.dataset.ansicht); }); });
    form();
    vorhaben(s.vorhaben);
  }

  /* ---------- Anfrage ---------- */
  function form() {
    var f = $('#df-form'), box = $('#df-danke');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = f.kontakt.value.trim();
      $('#df-fehler').hidden = !!kontakt;
      if (!kontakt) { f.kontakt.focus(); return; }
      zettel.mitRaum = true; var zl = zettel().map(function (x) { return [x[0], esc(x[1])]; });
      zettel.mitRaum = false;
      if (f.name.value) zl.push(['Name', esc(f.name.value)]);
      if (f.ort.value) zl.push(['Ort', esc(f.ort.value)]);
      zl.push(['Rückmeldung an', esc(kontakt)]);
      if (f.fotos.files && f.fotos.files.length) zl.push(['Fotos', esc(Array.prototype.map.call(f.fotos.files, function (x) { return x.name; }).join(', '))]);
      if (f.nachricht.value) zl.push(['Nachricht', esc(f.nachricht.value)]);
      var alt = s.ansicht; s.ansicht = 'schnitt'; var bild = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(schnitt()); s.ansicht = alt;
      var text = 'Guten Tag,\n\nhier ist meine Anfrage zum Dachfenster:\n\n' + zl.map(function (x) { var d = document.createElement('div'); d.innerHTML = x[1]; return x[0] + ': ' + d.textContent; }).join('\n') + '\n';
      box.innerHTML = '<h3>So kommt die Anfrage an</h3><p class="la-entwurf la-entwurf-gross">Entwurf: Es wurde nichts versendet. Schophuis bekommt alle Angaben mit Zeichnung und Fotos per E-Mail und meldet sich für einen Termin.</p>' +
        '<div class="la-danke-innen"><img src="' + bild + '" alt="Zeichnung: Dachfenster im Raum"><dl class="la-dl">' + zl.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl></div>' +
        '<div class="la-mail"><a class="la-knopf la-mail-auf" href="mailto:?subject=' + encodeURIComponent('Dachfenster: ' + VORHABEN[s.vorhaben]) + '&body=' + encodeURIComponent(text.slice(0, 1700)) + '">Als E-Mail senden &gt;</a>' +
        '<button type="button" class="la-link-hell df-zurueck">Anfrage bearbeiten</button></div>';
      f.hidden = true; box.hidden = false; box.focus();
      $('.df-zurueck', box).addEventListener('click', function () { box.hidden = true; f.hidden = false; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
