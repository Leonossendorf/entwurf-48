/* Dachfenster-Planer fuer Schophuis: fuehrt Schritt fuer Schritt, eine Frage nach der anderen.
   Austausch: altes Fenster (Typenschild) -> Dach -> Oeffnen -> Dazu -> Bauzettel.
   Neu: Raum -> Dach -> Vorschlag mit Bild -> Oeffnen -> Dazu -> Bauzettel.
   Quellen der Zahlen:
   - Einbauhoehen: VELUX Dokument 7063 "Empfohlene Einbaumasse fuer Dachfenster", Stand 17.02.2026
     (Oberkante 200 cm; Unterkante ca. 90 cm bei Griff oben, ca. 120 cm bei Griff unten; Tabelle Dachneigung x Fensterlaenge).
   - Fensterflaeche: Paragraf 46 Abs. 2 BauO NRW 2018 (Rohbaumass der Fensteroeffnungen mindestens ein Achtel der Raumflaeche). */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function z(x, n) { return x.toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 }); }
  function m(x) { return z(x, 2) + ' m'; }

  /* Uebliche Dachfenstergroessen (Aussenmass Rahmen, cm) mit der Kennung vom Typenschild. */
  var GROESSEN = [
    ['CK02', 55, 78], ['CK04', 55, 98], ['CK06', 55, 118], ['FK04', 66, 98], ['FK06', 66, 118], ['FK08', 66, 140],
    ['MK04', 78, 98], ['MK06', 78, 118], ['MK08', 78, 140], ['MK10', 78, 160], ['PK06', 94, 118], ['PK08', 94, 140], ['PK10', 94, 160],
    ['SK06', 114, 118], ['SK08', 114, 140], ['SK10', 114, 160], ['UK04', 134, 98], ['UK08', 134, 140], ['UK10', 134, 160]
  ];
  /* VELUX Dokument 7063: Fensterunterkante in cm bei Oberkante 200 cm, mit Eindeckrahmen.
     Zeile = Dachneigung in Grad, Spalten = Fensterlaenge 78, 98, 118, 140, 160 cm. */
  var LAENGEN = [78, 98, 118, 140, 160];
  var UNTERKANTE = { 30: [151, 141, 131, 120, 110], 40: [141, 128, 115, 101, 88], 50: [133, 117, 102, 85, 70] };
  var OBEN = 2.0, UNTEN_GRIFF_OBEN = 0.9, UNTEN_GRIFF_UNTEN = 1.2;   // VELUX-Empfehlung in Metern

  var VORHABEN = { austausch: 'Altes Fenster austauschen', neu: 'Neues Fenster einbauen' };
  var NEIGUNGEN = [[30, 'Eher flach', 'um 30°'], [40, 'Mittel', 'um 40°'], [50, 'Steil', 'um 50°'], [0, 'Weiß ich nicht', 'Wir messen nach']];
  var WAENDE = [[0.3, 'Keine oder niedrig', 'bis etwa 50 cm'], [1.0, 'Etwa hüfthoch', 'um 1 m'], [1.4, 'Schulterhoch', 'um 1,40 m']];
  var FOLGE = { austausch: ['vorhaben', 'alt', 'dach', 'oeffnen', 'dazu', 'zettel'], neu: ['vorhaben', 'raum', 'dach', 'vorschlag', 'oeffnen', 'dazu', 'zettel'] };

  var s = { vorhaben: 'austausch', i: 0, groesse: 'MK06', groesseBekannt: false, codeErkannt: '', anzahl: 1, eigen: false,
    raum: 16, hat: false, neigung: 40, neigungUnklar: false, knie: 0.3, deckung: 'Dachpfannen',
    bedienung: 'Wie bisher', bedienungEigen: false, extras: ['Innenverkleidung'] };

  function gr(code) { code = code || s.groesse; for (var i = 0; i < GROESSEN.length; i++) if (GROESSEN[i][0] === code) return GROESSEN[i]; return GROESSEN[7]; }
  function finde(b, h) { for (var i = 0; i < GROESSEN.length; i++) if (GROESSEN[i][1] === b && GROESSEN[i][2] === h) return GROESSEN[i]; return null; }

  /* ---------- Wo sitzt das Fenster? (nach VELUX-Tabelle) ---------- */
  function lage(code) {
    var g = gr(code), al = s.neigung * Math.PI / 180;
    var uk = UNTERKANTE[s.neigung][LAENGEN.indexOf(g[2])] / 100;      // Unterkante, wenn die Oberkante bei 2,00 m liegt
    var hu = Math.max(uk, s.knie + 0.05);                              // tiefer als die Wand geht nicht
    return { al: al, sin: Math.sin(al), cos: Math.cos(al), k: s.knie, hu: hu, ho: OBEN + (hu - uk), flaeche: s.anzahl * g[1] * g[2] / 1e4 };
  }
  function bedienRat(l) { return l.hu <= 1.05 && l.ho <= 2.1 ? 'Griff oben' : (l.hu <= 1.35 ? 'Griff unten' : 'Elektrisch'); }

  /* ---------- Vorschlag: erst die Hoehe (aus dem Dach), dann Breite und Anzahl (aus dem Raum) ---------- */
  function vorschlag() {
    var best = null;
    [98, 118, 140, 160].forEach(function (L) {
      var g = finde(78, L), l = lage(g[0]), note = Math.abs(l.hu - UNTEN_GRIFF_OBEN) + 2 * (l.ho - OBEN);
      if (!best || note < best.note - 1e-9) best = { L: L, note: note };
    });
    var L = best.L, wahl = null;
    if (s.hat) return { g: finde(78, L), n: 1 };
    var ziel = s.raum / 8;
    [1, 2, 3, 4].forEach(function (n) {
      [78, 94, 114, 134].forEach(function (b) {
        var g = finde(b, L); if (!g) return;
        var f = n * b * L / 1e4, reicht = f >= ziel - 0.001;
        var note = reicht ? (n - 1) * 0.5 + (f - ziel) + (b >= 134 ? 0.9 : (b >= 114 ? 0.35 : (b >= 94 ? 0.2 : 0))) : 10 + (ziel - f);
        if (!wahl || note < wahl.note) wahl = { g: g, n: n, note: note };
      });
    });
    return wahl;
  }
  function uebernehmeVorschlag() {
    if (s.vorhaben !== 'neu' || s.eigen) return;
    var v = vorschlag(); s.groesse = v.g[0]; s.anzahl = v.n;
  }

  /* ---------- Bild: der Raum von der Seite ---------- */
  function person(x, y, h) {
    var k = h / 178;
    return '<g class="df-person" transform="translate(' + x + ',' + y + ') scale(' + k + ')">' +
      '<circle cx="0" cy="-164" r="13"/><path d="M-19 -146 Q0 -153 19 -146 L22 -84 L13 -84 L11 0 L2 0 L0 -78 L-2 0 L-11 0 L-13 -84 L-22 -84 Z"/></g>';
  }
  function schnitt() {
    var l = lage(), W = 560, H = 392, sc = 100, x0 = 58, y0 = 352;
    function P(x, h) { return [x0 + x * sc, y0 - h * sc]; }
    function pt(p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }
    function dach(d) { return P(d * l.cos, l.k + d * l.sin); }
    var t = 0.2, nx = -l.sin * t, nh = l.cos * t;
    function aussen(d) { var p = dach(d); return [p[0] + nx * sc, p[1] - nh * sc]; }
    var dEnd = Math.min((3.25 - l.k) / l.sin, (W - x0 - 14) / sc / l.cos);
    var d0 = (l.hu - l.k) / l.sin, d1 = (l.ho - l.k) / l.sin, a = dach(d0), b = dach(d1);
    var o = ['<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" class="df-svg" role="img" aria-label="Der Raum von der Seite: Dachschräge mit Fenster, daneben ein Mensch zum Größenvergleich">'];
    // Licht, das durchs Fenster auf den Boden faellt
    var so = 55 * Math.PI / 180;
    function strahl(p) { var f = (y0 - p[1]) / Math.sin(so); return [p[0] + Math.cos(so) * f * 0.55, y0]; }
    o.push('<polygon class="df-licht" points="' + [a, b, strahl(b), strahl(a)].map(pt).join(' ') + '"/>');
    // Hoehenlinien zu den beiden Kanten des Fensters
    [[l.ho, 'oben ' + m(l.ho), b], [l.hu, 'unten ' + m(l.hu), a]].forEach(function (e) {
      var y = y0 - e[0] * sc;
      o.push('<line class="df-linie" x1="' + e[2][0] + '" y1="' + y + '" x2="' + (W - 6) + '" y2="' + y + '"/>');
      o.push('<text class="df-mass" x="' + (W - 8) + '" y="' + (y - 7) + '" text-anchor="end">' + e[1] + '</text>');
    });
    // Boden, Wand, Dach
    o.push('<line class="df-boden" x1="14" y1="' + y0 + '" x2="' + W + '" y2="' + y0 + '"/>');
    if (l.k > 0.05) o.push('<rect class="df-wand" x="' + (x0 - 20) + '" y="' + (y0 - l.k * sc) + '" width="20" height="' + (l.k * sc) + '"/>');
    o.push('<polygon class="df-dach" points="' + [dach(-0.3), dach(d0), aussen(d0), aussen(-0.3)].map(pt).join(' ') + '"/>');
    o.push('<polygon class="df-dach" points="' + [dach(d1), dach(dEnd), aussen(dEnd), aussen(d1)].map(pt).join(' ') + '"/>');
    // Fenster
    o.push('<polygon class="df-fenster" points="' + [a, b, aussen(d1), aussen(d0)].map(pt).join(' ') + '"/>');
    o.push('<circle class="df-punkt" cx="' + a[0] + '" cy="' + a[1] + '" r="5"/><circle class="df-punkt" cx="' + b[0] + '" cy="' + b[1] + '" r="5"/>');
    // Mensch, dort wo man aufrecht stehen kann
    var xp = Math.min((1.95 - l.k) / Math.tan(l.al) + 0.45, (W - 150 - x0) / sc);
    var fp = P(Math.max(xp, 0.6), 0);
    o.push(person(fp[0], fp[1], 1.78 * sc));
    o.push('</svg>');
    return o.join('');
  }
  function bildNeigung(grad) {
    if (!grad) return '<svg viewBox="0 0 64 44" aria-hidden="true"><text x="32" y="34" text-anchor="middle" class="df-frz">?</text></svg>';
    var a = grad * Math.PI / 180, x2 = 8 + 46 * Math.cos(a) * 1.05, y2 = 40 - 46 * Math.sin(a) * 1.05;
    return '<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M4 40 H60"/><path class="df-ico-akzent" d="M8 40 L' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '"/></svg>';
  }
  function bildWand(k) {
    var y = 40 - k * 20;
    return '<svg viewBox="0 0 64 44" aria-hidden="true"><path d="M4 40 H60"/><path class="df-ico-akzent" d="M12 40 V' + y + ' L' + (12 + (y - 2) * 0.95) + ' 2"/>' + person(46, 40, 35.6).replace('class="df-person"', 'class="df-person df-person-klein"') + '</svg>';
  }

  /* ---------- Texte zum Vorschlag ---------- */
  function fensterText() { var g = gr(); return (s.anzahl > 1 ? s.anzahl + ' Fenster, je ' : '1 Fenster, ') + g[1] + ' × ' + g[2] + ' cm'; }
  function warum(l) {
    var w = [], g = gr();
    if (l.ho <= 2.1) w.push(['ok', 'Oben endet das Fenster bei ' + m(l.ho) + '. So sehen Sie im Stehen hinaus.']);
    else w.push(['info', 'Die Wand unter der Schräge ist hoch. Deshalb sitzt das Fenster höher als üblich und endet oben erst bei ' + m(l.ho) + '. Üblich sind 2,00 m.']);
    if (l.hu <= 1.05) w.push(['ok', 'Unten beginnt es bei ' + m(l.hu) + '. So sehen Sie auch im Sitzen hinaus.']);
    else w.push(['info', 'Unten beginnt das Fenster erst bei ' + m(l.hu) + '. Das ist höher als die Augen im Sitzen: Vom Sofa aus sehen Sie Himmel, aber nicht nach draußen in den Garten.' +
      (l.hu <= s.knie + 0.06 ? ' Tiefer geht es nicht, weil dort die Wand steht.' : (g[2] >= 160 ? ' Tiefer kommt bei diesem Dach auch das längste Fenster nicht.' : ' Ein längeres Fenster beginnt tiefer.'))]);
    if (s.hat) w.push(['info', 'Der Raum hat schon ein Fenster. Ob beide zusammen genug Licht bringen, rechnen wir vor Ort nach.']);
    else {
      var ziel = s.raum / 8, ok = l.flaeche >= ziel - 0.001;
      w.push([ok ? 'ok' : 'warn', (s.anzahl > 1 ? s.anzahl + ' Fenster ergeben ' : 'Das Fenster hat ') + z(l.flaeche, 1) + ' m². Für ' + s.raum + ' m² Raum sollten es mindestens ' + z(ziel, 1) + ' m² sein' + (ok ? '.' : ': Das ist zu wenig.')]);
    }
    if (l.hu > 1.35) w.push(['info', 'Wünschen Sie Ausblick im Sitzen, ist hier eine Gaube die bessere Wahl. Sprechen Sie uns gern an.']);
    if (g[1] >= 94) w.push(['info', 'Dieses Fenster ist breiter als der übliche Abstand zwischen den Dachbalken. Dann wird ein Balken durchtrennt und neu abgefangen. Das erledigen wir als Zimmerei selbst.']);
    if (s.neigungUnklar) w.push(['info', 'Die Dachneigung haben wir geschätzt. Wir messen sie bei Ihnen nach.']);
    return w;
  }
  function bedienText(l) {
    if (s.vorhaben === 'austausch') return 'Am einfachsten bleibt es wie bisher. Kommen Sie schlecht an das Fenster, lohnt sich elektrisch.';
    var r = bedienRat(l);
    if (r === 'Griff oben') return 'Ihr Fenster endet oben bei ' + m(l.ho) + '. Den Griff dort erreichen Sie bequem im Stehen. Wir empfehlen: Griff oben.';
    if (r === 'Griff unten') return 'Ihr Fenster beginnt unten erst bei ' + m(l.hu) + '. Dort liegt ein Griff gut in der Hand. Wir empfehlen: Griff unten.';
    return 'Ihr Fenster sitzt hoch: unten ' + m(l.hu) + ', oben ' + m(l.ho) + '. Von Hand kommt man schlecht dran. Wir empfehlen: elektrisch oder Solar.';
  }

  /* ---------- Bauzettel ---------- */
  function zettel() {
    var g = gr(), r = [['Vorhaben', VORHABEN[s.vorhaben], 'vorhaben']];
    if (s.vorhaben === 'neu') {
      var l = lage();
      r.push(['Raum', s.raum + ' m², ' + (s.hat ? 'hat schon ein Fenster' : 'noch kein Fenster'), 'raum']);
      r.push(['Dach', (s.neigungUnklar ? 'Neigung unbekannt' : 'um ' + s.neigung + '° Neigung') + ', Wand ' + WAENDE.filter(function (x) { return x[0] === s.knie; })[0][2] + ', ' + (s.deckung === 'Weiß ich nicht' ? 'Eindeckung unbekannt' : s.deckung), 'dach']);
      r.push(['Fenster', fensterText() + ' (' + g[0] + ')' + (s.eigen ? '' : ', unser Vorschlag'), 'vorschlag']);
      r.push(['Im Raum', 'unten ' + m(l.hu) + ', oben ' + m(l.ho), 'vorschlag']);
    } else {
      r.push(['Fenster', s.groesseBekannt ? fensterText() + ' (' + g[0] + ')' : s.anzahl + ' Fenster, Größe messen wir vor Ort', 'alt']);
      if (s.codeErkannt) r.push(['Typenschild', s.codeErkannt, 'alt']);
      r.push(['Dach', s.deckung === 'Weiß ich nicht' ? 'Eindeckung unbekannt' : s.deckung, 'dach']);
    }
    r.push(['Öffnen', s.bedienung, 'oeffnen']);
    r.push(['Dazu', s.extras.length ? s.extras.join(', ') : 'nichts', 'dazu']);
    return r;
  }

  /* ---------- Anzeige ---------- */
  function folge() { return FOLGE[s.vorhaben]; }
  function kacheln() {
    var h = GROESSEN.map(function (g) {
      var w = g[1] / 134 * 34, hh = g[2] / 160 * 42;
      return '<button type="button" aria-pressed="false" data-code="' + g[0] + '"><svg viewBox="0 0 40 46" aria-hidden="true"><rect x="' + (20 - w / 2) + '" y="' + (44 - hh) + '" width="' + w + '" height="' + hh + '"/></svg><strong>' + g[1] + ' × ' + g[2] + '</strong></button>';
    }).join('');
    $$('[data-groessen]').forEach(function (b) { b.innerHTML = h; });
  }
  function zeige() {
    uebernehmeVorschlag();
    var neu = s.vorhaben === 'neu', l = neu ? lage() : null, name = folge()[s.i], n = folge().length;
    $$('.df-schritt').forEach(function (x) { x.hidden = x.dataset.schritt !== name; });
    $$('#df-karton [data-nur]').forEach(function (x) { x.hidden = x.dataset.nur !== s.vorhaben; });
    $('#df-balken').style.width = (s.i / (n - 1) * 100) + '%';
    $('#df-wo').textContent = s.i === 0 ? '' : 'Schritt ' + (s.i + 1) + ' von ' + n;
    $('#df-zurueck').hidden = s.i === 0;
    var w = $('#df-weiter'); w.hidden = name === 'vorhaben' || name === 'zettel';
    w.innerHTML = name === 'vorschlag' ? (s.eigen ? 'Weiter mit meiner Wahl &gt;' : 'Weiter mit Vorschlag &gt;') : (name === 'dazu' ? 'Zum Bauzettel &gt;' : 'Weiter &gt;');
    $('#df-nav').hidden = name === 'vorhaben';
    // Werte
    $$('[data-anzahl]').forEach(function (x) { x.textContent = s.anzahl; });
    $$('[data-groessen] button').forEach(function (b) { b.setAttribute('aria-pressed', ((neu || s.groesseBekannt) && b.dataset.code === s.groesse) ? 'true' : 'false'); });
    $('#df-raum-wert').textContent = s.raum + ' m²';
    $$('#df-neigung button').forEach(function (b) { b.setAttribute('aria-pressed', (s.neigungUnklar ? b.dataset.wert === '0' : +b.dataset.wert === s.neigung) ? 'true' : 'false'); });
    $$('#df-knie button').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.wert === s.knie ? 'true' : 'false'); });
    if (neu) {
      $('#df-zeichnung').innerHTML = schnitt();
      $('#df-empfehlung').innerHTML = '<small>' + (s.eigen ? 'Ihre Wahl' : 'Das passt zu Ihrem Dach') + '</small>' + esc(fensterText());
      $('#df-warum').innerHTML = warum(l).map(function (x) { return '<li class="df-h-' + x[0] + '">' + esc(x[1]) + '</li>'; }).join('');
    }
    var rat = neu ? bedienRat(l) : '';
    if (!s.bedienungEigen) s.bedienung = neu ? rat : 'Wie bisher';
    if (neu && s.bedienung === 'Wie bisher') s.bedienung = rat;
    $$('#df-bedienung .df-karte').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.wert === s.bedienung ? 'true' : 'false');
      var e = $('.df-empf', b); if (e) e.hidden = !(neu && (b.dataset.wert === rat || (rat === 'Elektrisch' && b.dataset.wert === 'Solar')));
    });
    $('#df-bed-text').textContent = bedienText(l);
    $('#df-zettel').innerHTML = zettel().map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + esc(x[1]) + ' <button type="button" class="df-aendern" data-zu="' + x[2] + '">ändern</button></dd></div>'; }).join('');
    $('#df-foto-tipp').textContent = neu ? 'Hilfreich: der Raum mit der Schräge und das Dach von außen' : 'Hilfreich: das Fenster innen, das Dach außen, das Typenschild';
  }
  function gehe(i, ohneRollen) {
    s.i = Math.max(0, Math.min(folge().length - 1, i)); zeige();
    if (ohneRollen) return;
    var k = $('#df-karton'); k.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var t = $('.df-schritt:not([hidden]) .df-titel'); if (t) t.focus({ preventScroll: true });
  }
  function geheZu(name) { var i = folge().indexOf(name); if (i >= 0) gehe(i); }

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

  /* ---------- Schalter ---------- */
  function wahl(gruppe, fn) {
    gruppe.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || !gruppe.contains(b)) return; fn(b); zeige(); });
  }
  function setzeVorhaben(v) {
    s.vorhaben = v; s.eigen = false; s.bedienungEigen = false; s.anzahl = 1;
    $$('#df-vorhaben button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.wert === v ? 'true' : 'false'); });
    $('#df-gaube').hidden = true;
  }

  function start() {
    if (!$('#df-karton')) return;
    $('#df-neigung').innerHTML = NEIGUNGEN.map(function (n) { return '<button type="button" class="df-karte" data-wert="' + n[0] + '">' + bildNeigung(n[0]) + '<strong>' + n[1] + '</strong><span>' + n[2] + '</span></button>'; }).join('');
    $('#df-knie').innerHTML = WAENDE.map(function (n) { return '<button type="button" class="df-karte" data-wert="' + n[0] + '">' + bildWand(n[0]) + '<strong>' + n[1] + '</strong><span>' + n[2] + '</span></button>'; }).join('');
    kacheln();

    $('#df-vorhaben').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.wert === 'platz') { $$('#df-vorhaben button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); $('#df-gaube').hidden = false; return; }
      setzeVorhaben(b.dataset.wert); gehe(1);
    });
    $('#df-gaube-weiter').addEventListener('click', function () { setzeVorhaben('neu'); gehe(1); });
    $('#df-weiter').addEventListener('click', function () { gehe(s.i + 1); });
    $('#df-zurueck').addEventListener('click', function () { gehe(s.i - 1); });
    $('#df-zettel').addEventListener('click', function (e) { var b = e.target.closest('[data-zu]'); if (b) geheZu(b.dataset.zu); });

    $('#df-code').addEventListener('input', function () {
      var c = leseCode(this.value), g, ok = $('#df-code-ok');
      s.codeErkannt = this.value.trim();
      if (c) { s.groesse = c; s.groesseBekannt = true; g = gr(); ok.innerHTML = '<b>Erkannt: ' + g[1] + ' × ' + g[2] + ' cm.</b> Mehr brauchen wir zur Größe nicht.'; }
      else ok.textContent = this.value.trim().length > 3 ? 'Diesen Code schlagen wir selbst nach. Sie können einfach weitergehen.' : '';
      zeige();
    });
    $$('[data-groessen]').forEach(function (box) {
      wahl(box, function (b) {
        s.groesse = b.dataset.code;
        if (s.vorhaben === 'neu') s.eigen = true; else { s.groesseBekannt = true; if (!leseCode($('#df-code').value)) $('#df-code-ok').textContent = ''; }
      });
    });
    $$('[data-zahl]').forEach(function (b) {
      b.addEventListener('click', function () { s.anzahl = Math.max(1, Math.min(4, s.anzahl + (+b.dataset.zahl))); if (s.vorhaben === 'neu') s.eigen = true; zeige(); });
    });
    $('#df-zurueck-vorschlag').addEventListener('click', function () { s.eigen = false; $('#df-eigen').open = false; zeige(); });
    $('#df-raum').addEventListener('input', function () { s.raum = +this.value; zeige(); });
    wahl($('#df-hat'), function (b) { s.hat = b.dataset.wert === 'ja'; $$('#df-hat button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
    wahl($('#df-neigung'), function (b) { s.neigungUnklar = b.dataset.wert === '0'; s.neigung = +b.dataset.wert || 40; });
    wahl($('#df-knie'), function (b) { s.knie = +b.dataset.wert; });
    wahl($('#df-deckung'), function (b) { s.deckung = b.dataset.wert; $$('#df-deckung button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
    wahl($('#df-bedienung'), function (b) { s.bedienung = b.dataset.wert; s.bedienungEigen = true; });
    [$('#df-extras'), $('#df-extras2')].forEach(function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        s.extras = $$('.df-extras button[aria-pressed="true"]').map(function (x) { return x.dataset.wert; }); zeige();
      });
    });
    form();
    var q = new URLSearchParams(location.search).get('vorhaben');
    if (VORHABEN[q]) { setzeVorhaben(q); gehe(1, true); } else zeige();
  }

  /* ---------- Anfrage ---------- */
  function form() {
    var f = $('#df-form'), box = $('#df-danke'), karton = $('#df-karton');
    // Fotos: ziehen oder antippen, mehrere nacheinander, jedes wieder entfernbar
    var fotos = [], drop = $('#df-drop'), liste = $('#df-foto-liste'), feld = $('#df-fotos-feld');
    function zeigeFotos() {
      liste.innerHTML = fotos.map(function (x, i) {
        return '<li><img src="' + x.url + '" alt=""><span>' + esc(x.datei.name) + '</span><button type="button" data-weg="' + i + '" aria-label="' + esc(x.datei.name) + ' entfernen">×</button></li>';
      }).join('');
      drop.classList.toggle('df-drop-voll', fotos.length > 0);
      $('strong', drop).textContent = fotos.length ? 'Noch ein Foto dazulegen' : 'Fotos dazulegen';
    }
    function nimm(dateien) {
      Array.prototype.forEach.call(dateien, function (d) {
        if (!/^image\//.test(d.type) || fotos.length >= 8) return;
        if (fotos.some(function (x) { return x.datei.name === d.name && x.datei.size === d.size; })) return;
        fotos.push({ datei: d, url: URL.createObjectURL(d) });
      });
      zeigeFotos();
    }
    feld.addEventListener('change', function () { nimm(feld.files); feld.value = ''; });
    ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('df-drueber'); }); });
    ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('df-drueber'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) nimm(e.dataTransfer.files); });
    liste.addEventListener('click', function (e) {
      var b = e.target.closest('[data-weg]'); if (!b) return;
      var x = fotos.splice(+b.dataset.weg, 1)[0]; if (x) URL.revokeObjectURL(x.url);
      zeigeFotos();
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = f.kontakt.value.trim();
      $('#df-fehler').hidden = !!kontakt;
      if (!kontakt) { f.kontakt.focus(); return; }
      var zl = zettel().map(function (x) { return [x[0], esc(x[1])]; });
      if (f.name.value) zl.push(['Name', esc(f.name.value)]);
      if (f.ort.value) zl.push(['Ort', esc(f.ort.value)]);
      zl.push(['Rückmeldung an', esc(kontakt)]);
      if (fotos.length) zl.push(['Fotos', esc(fotos.map(function (x) { return x.datei.name; }).join(', '))]);
      if (f.nachricht.value) zl.push(['Nachricht', esc(f.nachricht.value)]);
      var bild = s.vorhaben === 'neu' ? '<img src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(schnitt()) + '" alt="Zeichnung: Dachfenster im Raum">' : '';
      var text = 'Guten Tag,\n\nhier ist meine Anfrage zum Dachfenster:\n\n' + zl.map(function (x) { var d = document.createElement('div'); d.innerHTML = x[1]; return x[0] + ': ' + d.textContent; }).join('\n') + '\n';
      box.innerHTML = '<h3>So kommt die Anfrage an</h3><p class="la-entwurf la-entwurf-gross">Entwurf: Es wurde nichts versendet. Schophuis bekommt alle Angaben' + (bild ? ' mit Zeichnung' : '') + ' und Fotos per E-Mail und meldet sich für einen Termin.</p>' +
        '<div class="la-danke-innen">' + bild + '<dl class="la-dl">' + zl.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl></div>' +
        '<div class="la-mail"><a class="la-knopf la-mail-auf" href="mailto:?subject=' + encodeURIComponent('Dachfenster: ' + VORHABEN[s.vorhaben]) + '&body=' + encodeURIComponent(text.slice(0, 1700)) + '">Als E-Mail senden &gt;</a>' +
        '<button type="button" class="la-link-hell df-bearbeiten">Anfrage bearbeiten</button></div>';
      karton.hidden = true; box.hidden = false; box.focus();
      $('.df-bearbeiten', box).addEventListener('click', function () { box.hidden = true; karton.hidden = false; });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
