/* Dachfenster-Planer fuer Schophuis: fuehrt Schritt fuer Schritt, eine Frage nach der anderen.
   Austausch: altes Fenster (Typenschild) -> Dach -> Oeffnen -> Dazu -> Bauzettel.
   Neu: Raum -> Dach -> Vorschlag mit Bild -> Oeffnen -> Dazu -> Bauzettel.
   Quellen der Zahlen:
   - Einbauhoehen: VELUX Dokument 7063 "Empfohlene Einbaumasse fuer Dachfenster", Stand 17.02.2026
     (Oberkante 200 cm; Unterkante ca. 90 cm bei Griff oben, ca. 120 cm bei Griff unten; Tabelle Dachneigung x Fensterlaenge).
   - Fensterflaeche: Paragraf 46 Abs. 2 BauO NRW 2018 (Rohbaumass der Fensteroeffnungen mindestens ein Achtel der Raumflaeche).
   - Alte Groessencodes 1991 bis 2000: VELUX Dokument 7099 (Stand 01.12.2020), Tabelle 102 = CK02 bis 810 = UK10, Rahmenaussenmasse identisch.
   - Fenster vor 1991 (VL, VK, VU, VKU, Codes 021 bis 107): Masse aus der FAKRO-Austauschtabelle (gueltig ab 01.09.2017);
     VELUX nennt dafuer Austauschfenster in Y-Groessen (im VELUX Austausch-Berater am 25.11.2026 geprueft: VL 045 -> Y45, VK 065 -> Y65).
   - Preise: VELUX UVP aus dem Konfigurator dachfensterkonfigurator.de, abgelesen am 25.11.2026. Einbau und Wechsel: Angabe Schophuis (Julius, 24.11.2026).
   - Wechsel: VELUX Dokument 7011 (Stand 01.02.2026): idealer Sparrenabstand = Fensterbreite + 4 bis 6 cm. */
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

  /* VELUX Listenpreise (UVP inkl. MwSt., Euro): Einzelfenster, Schwingfenster mit Griff oben, Holz weiss lackiert.
     T = Thermo (2-fach, Standard), E = Energie (3-fach). */
  var PREIS = {
    T: { CK02: 668, CK04: 720, CK06: 746, FK04: 746, FK06: 837, FK08: 876, MK04: 806, MK06: 876, MK08: 940, MK10: 1058, PK06: 985, PK08: 1065, PK10: 1153, SK06: 1085, SK08: 1158, SK10: 1266, UK04: 1085, UK08: 1259, UK10: 1451 },
    E: { CK02: 784, CK04: 865, CK06: 921, FK04: 921, FK06: 1046, FK08: 1124, MK04: 1009, MK06: 1124, MK08: 1233, MK10: 1393, PK06: 1284, PK08: 1420, PK10: 1558, SK06: 1445, SK08: 1585, SK10: 1755, UK04: 1437, UK08: 1762, UK10: 2026 }
  };
  /* Aufpreis gegenueber Griff oben: Klapp-Schwing-Fenster (Griff unten) 337 Euro, Elektro und Solar je 367 Euro (gleiche Quelle). */
  var AUFPREIS = { 'Griff oben': 0, 'Griff unten': 337, 'Elektrisch': 367, 'Solar': 367 };
  /* Angabe Schophuis: Einbau rund 400 Euro je Fenster; Wechsel 300 Euro, meist ab 70 bis 80 cm Fensterbreite.
     Eigene Festlegung: ab 78 cm, weil ein 78er Fenster 82 bis 84 cm lichten Sparrenabstand braucht (VELUX Dokument 7011). */
  var EINBAU = 400, WECHSEL = 300, WECHSEL_AB = 78, MWST = 1.19;

  /* Fenster vor 1991: Groessencode -> Rahmenaussenmass in cm */
  var ALT = { '021': [54, 83], '023': [54, 103], '033': [64, 103], '035': [64, 123], '043': [74, 103], '045': [74, 123], '047': [74, 143], '065': [94, 124], '067': [94, 144], '085': [114, 124], '087': [114, 144], '107': [134, 144] };
  /* Typ -> [Bauart, Material, 1 = Griff unten] */
  var TYPEN = { GGL: ['Schwingfenster', 'Holz', 0], GGU: ['Schwingfenster', 'Kunststoff', 0], GPL: ['Klapp-Schwing-Fenster', 'Holz', 1], GPU: ['Klapp-Schwing-Fenster', 'Kunststoff', 1],
    GHL: ['Klapp-Schwing-Fenster', 'Holz', 1], GHU: ['Klapp-Schwing-Fenster', 'Kunststoff', 1], VL: ['Schwingfenster', '', 0], VU: ['Schwingfenster', '', 0], VK: ['Klapp-Schwing-Fenster', '', 1], VKU: ['Klapp-Schwing-Fenster', '', 1] };

  var VORHABEN = { austausch: 'Altes Fenster austauschen', neu: 'Neues Fenster einbauen' };
  var NEIGUNGEN = [[30, 'Eher flach', 'um 30°'], [40, 'Mittel', 'um 40°'], [50, 'Steil', 'um 50°'], [0, 'Weiß ich nicht', 'Wir messen nach']];
  var WAENDE = [[0.3, 'Keine oder niedrig', 'bis etwa 50 cm'], [1.0, 'Etwa hüfthoch', 'um 1 m'], [1.4, 'Schulterhoch', 'um 1,40 m']];
  var FOLGE = { austausch: ['vorhaben', 'alt', 'dach', 'oeffnen', 'dazu', 'zettel'], neu: ['vorhaben', 'raum', 'dach', 'vorschlag', 'oeffnen', 'dazu', 'zettel'] };

  var s = { vorhaben: 'austausch', i: 0, groesse: 'MK06', groesseBekannt: false, codeErkannt: '', anzahl: 1, eigen: false,
    raum: 16, hat: false, neigung: 40, neigungUnklar: false, knie: 0.3, deckung: 'Dachpfannen',
    bedienung: 'Wie bisher', bedienungEigen: false, extras: ['Innenverkleidung'], glas: '2-fach', alt: null };

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
    else w.push(['tipp', 'Die Wand unter der Schräge ist hoch. Deshalb sitzt das Fenster etwas höher und endet oben bei ' + m(l.ho) + '.']);
    if (l.hu <= 1.05) w.push(['ok', 'Unten beginnt es bei ' + m(l.hu) + '. So sehen Sie auch im Sitzen hinaus.']);
    else w.push(['tipp', 'Unten beginnt das Fenster bei ' + m(l.hu) + '. Im Sitzen sehen Sie damit vor allem Himmel.' +
      (l.hu <= s.knie + 0.06 || g[2] >= 160 ? '' : ' Unser Tipp: Ein längeres Fenster beginnt tiefer.')]);
    if (s.hat) w.push(['tipp', 'Der Raum hat schon ein Fenster. Ob beide zusammen genug Licht bringen, sehen wir uns vor Ort an.']);
    else {
      var ziel = s.raum / 8, ok = l.flaeche >= ziel - 0.001;
      if (ok) w.push(['ok', (s.anzahl > 1 ? s.anzahl + ' Fenster bringen zusammen ' : 'Das Fenster bringt ') + z(l.flaeche, 1) + ' m² Licht. Das passt gut zu ' + s.raum + ' m² Raum.']);
      else w.push(['tipp', 'Unser Tipp: Für ' + s.raum + ' m² Raum empfehlen wir etwa ' + z(ziel, 1) + ' m² Fensterfläche. Gewählt sind ' + z(l.flaeche, 1) + ' m². Mit einem weiteren oder größeren Fenster wird der Raum heller.']);
    }
    if (l.hu > 1.35) w.push(['tipp', 'Unser Tipp: Wünschen Sie Ausblick im Sitzen, passt hier eine Gaube besser. Sprechen Sie uns gern an.']);
    if (g[1] >= WECHSEL_AB) w.push(['tipp', 'Ab ' + WECHSEL_AB + ' cm Breite wird meist ein Dachbalken versetzt. Das erledigen wir als Zimmerei gleich mit.']);
    if (s.neigungUnklar) w.push(['tipp', 'Die Dachneigung haben wir geschätzt. Wir messen sie bei Ihnen nach.']);
    return w;
  }
  function bedienText(l) {
    if (s.vorhaben === 'austausch') return 'Am einfachsten bleibt es wie bisher. Kommen Sie schlecht an das Fenster, lohnt sich elektrisch.';
    var r = bedienRat(l);
    if (r === 'Griff oben') return 'Ihr Fenster endet oben bei ' + m(l.ho) + '. Den Griff dort erreichen Sie bequem im Stehen. Wir empfehlen: Griff oben.';
    if (r === 'Griff unten') return 'Ihr Fenster beginnt unten erst bei ' + m(l.hu) + '. Dort liegt ein Griff gut in der Hand. Wir empfehlen: Griff unten.';
    return 'Ihr Fenster sitzt hoch: unten ' + m(l.hu) + ', oben ' + m(l.ho) + '. Von Hand kommt man schlecht dran. Wir empfehlen: elektrisch oder Solar.';
  }

  /* ---------- Preis: Listenpreis VELUX + Einbau + (bei neuen, breiten Fenstern) Wechsel; alles netto ---------- */
  function bauart() {
    if (s.bedienung !== 'Wie bisher') return s.bedienung;
    return s.alt && s.alt.klapp ? 'Griff unten' : 'Griff oben';
  }
  function preis() {
    var g = gr(), neu = s.vorhaben === 'neu';
    if (!neu && !s.groesseBekannt) return null;
    var fenster = (PREIS[s.glas === '3-fach' ? 'E' : 'T'][g[0]] + AUFPREIS[bauart()]) / MWST * s.anzahl;
    var zl = [[s.anzahl > 1 ? s.anzahl + ' Fenster' : 'Fenster', 'Listenpreis von Velux', fenster], ['Einbau', s.anzahl > 1 ? s.anzahl + ' × ' + EINBAU + ' €' : '', EINBAU * s.anzahl]];
    if (neu && g[1] >= WECHSEL_AB) zl.push(['Dachbalken versetzen', 'wahrscheinlich nötig', WECHSEL * s.anzahl]);
    var sum = 0; zl.forEach(function (x) { sum += x[2]; });
    sum = Math.round(sum / 10) * 10;
    return { zeilen: zl, netto: sum, brutto: Math.round(sum * MWST / 10) * 10 };
  }
  function preisHtml() {
    var p = preis();
    if (!p) return '<h4>Was kostet das ungefähr?</h4><p class="df-klein">Den Preis nennen wir im Angebot, sobald wir die Größe kennen.</p>';
    return '<h4>Was kostet das ungefähr?</h4><table>' + p.zeilen.map(function (x) {
      return '<tr><td>' + x[0] + (x[1] ? ' <small>' + x[1] + '</small>' : '') + '</td><td>' + z(Math.round(x[2])) + ' €</td></tr>';
    }).join('') + '<tr class="df-summe"><td>Zusammen etwa</td><td>' + z(p.netto) + ' €</td></tr></table>' +
      '<p class="df-klein">Netto, zzgl. 19 % MwSt. (mit MwSt. etwa ' + z(p.brutto) + ' €). Extras wie Rollladen oder Innenverkleidung kommen dazu. Den festen Preis nennt unser Angebot nach dem Aufmaß.</p>';
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
      if (s.alt && s.alt.ersatz) r.push(['Ersatz', s.alt.ersatz, 'alt']);
      r.push(['Dach', s.deckung === 'Weiß ich nicht' ? 'Eindeckung unbekannt' : s.deckung, 'dach']);
    }
    r.push(['Öffnen', s.bedienung, 'oeffnen']);
    r.push(['Glas', s.glas + '-Verglasung' + (s.glas === '2-fach' ? ' (Standard)' : ''), 'dazu']);
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
    $$('#df-glas button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.wert === s.glas ? 'true' : 'false'); });
    $('#df-preis').innerHTML = preisHtml();
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
  /* Vier Schilder-Generationen (so zeigt sie auch VELUX im Austausch-Berater):
     seit 2013 "GGL MK08 2050" | etwa 2001 bis 2013 "GGL M08 3059" | 1991 bis 2000 "GGL 308 3059" | 1972 bis 1991 "VK 065.100" */
  function leseSchild(t) {
    var u = String(t || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
    u = u.replace(/\b(G[A-Z]{2}|VKU|VL|VU|VK)(?=[0-9]|[CFMPSU]K?[0-9]{2}\b)/g, '$1 ').trim();
    var w = u ? u.split(/\s+/) : [], r = { typ: '', bau: null, code: '', alt: '', zeit: '', roh: '', fremd: '' }, i, m, j;
    for (i = 0; i < w.length; i++) if (TYPEN[w[i]]) { r.typ = w[i]; r.bau = TYPEN[w[i]]; break; }
    if (!r.typ) for (i = 0; i < w.length; i++) if (/^(G[A-Z]{2}|V[A-Z]{1,2})$/.test(w[i])) { r.typ = w[i]; break; }
    for (i = 0; i < w.length; i++) {
      var c = '';
      if ((m = /^([CFMPSU])K(\d\d)$/.exec(w[i]))) { c = m[1] + 'K' + m[2]; r.zeit = 'ab 2013'; }
      else if ((m = /^([CFMPSU])(\d\d)$/.exec(w[i]))) { c = m[1] + 'K' + m[2]; r.zeit = 'etwa 2001 bis 2013'; }
      else if ((m = /^([123468])(0[2468]|10)$/.exec(w[i]))) { c = { 1: 'C', 2: 'F', 3: 'M', 4: 'P', 6: 'S', 8: 'U' }[m[1]] + 'K' + m[2]; r.zeit = '1991 bis 2000'; }
      else if (ALT[w[i]]) { r.alt = w[i]; r.zeit = 'vor 1991'; r.roh = w[i]; break; }
      if (c) { for (j = 0; j < GROESSEN.length; j++) if (GROESSEN[j][0] === c) { r.code = c; r.roh = w[i]; } if (r.code) break; r.zeit = ''; r.fremd = w[i]; }
    }
    return r;
  }
  /* Was wir dem Kunden dazu sagen: erkannt, heutiger Name der Groesse, passender Ersatz */
  function schildText(r, roh) {
    var name = 'Velux ' + [r.typ, r.roh].filter(Boolean).join(' ');
    var bau = r.bau ? r.bau[0] + (r.bau[1] ? ' aus ' + r.bau[1] : '') : '';
    var klapp = !!(r.bau && r.bau[2]), holz = klapp ? 'GPL' : 'GGL', kunst = klapp ? 'GPU' : 'GGU', g, t;
    if (r.code) {
      g = gr(r.code);
      t = '<b>Erkannt: ' + esc(name) + ', gebaut ' + r.zeit + '.</b> ' + (bau ? bau + ', ' : '') + 'Rahmen ' + g[1] + ' × ' + g[2] + ' cm.';
      if (r.roh !== r.code) t += ' Diese Größe heißt heute <b>' + r.code + '</b>.';
      var welches = r.typ && !r.bau ? 'ein Velux-Fenster in Größe ' + r.code + '. Die Bauart klären wir vor Ort.' : 'Velux ' + holz + ' ' + r.code + ' (Holz) oder ' + kunst + ' ' + r.code + ' (Kunststoff).';
      t += '<span class="df-ersatz"><b>Passender Ersatz:</b> ' + welches + ' Gleiche Größe, passt in die vorhandene Öffnung.' +
        (r.zeit === '1991 bis 2000' ? ' Der neue Rahmen sitzt etwas tiefer im Dach, die Innenverkleidung passen wir dabei an.' : '') + '</span>';
      return { html: t, ersatz: (r.typ && !r.bau ? 'Velux-Fenster in Größe ' + r.code : 'Velux ' + holz + ' oder ' + kunst + ' ' + r.code) + ', gleiche Größe', klapp: klapp };
    }
    if (r.alt) {
      g = ALT[r.alt];
      t = '<b>Erkannt: ' + esc(name) + ', gebaut ' + r.zeit + '.</b> ' + (bau ? bau + ', ' : '') + 'Rahmen etwa ' + g[0] + ' × ' + g[1] + ' cm. Diese Größe gibt es im normalen Programm nicht mehr.' +
        '<span class="df-ersatz"><b>Passender Ersatz:</b> Velux baut dafür eigene Austauschfenster in der alten Größe' + (r.alt === '107' ? '' : ' (Y' + r.alt.slice(1) + ')') + '. Sie passen in die vorhandene Öffnung.</span>';
      return { html: t, ersatz: 'Velux-Austauschfenster in der alten Größe' + (r.alt === '107' ? '' : ' (Y' + r.alt.slice(1) + ')'), klapp: klapp };
    }
    if (r.fremd) return { html: '<b>Erkannt: ' + (bau ? bau + ', ' : '') + 'Größe ' + r.fremd + '.</b> Das ist eine seltene Größe. Welches Fenster heute dazu passt, schlagen wir für Sie nach.', ersatz: '', klapp: klapp };
    if (r.bau) return { html: '<b>Erkannt: ' + bau + ' (' + r.typ + ').</b> Die Größe steht direkt dahinter, zum Beispiel MK06, M06, 306 oder 045.', ersatz: '', klapp: klapp };
    return { html: roh.length > 3 ? 'Diesen Code schlagen wir selbst nach. Sie können einfach weitergehen.' : '', ersatz: '', klapp: false };
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
      var r = leseSchild(this.value), x = schildText(r, this.value.trim());
      s.codeErkannt = this.value.trim();
      s.alt = { klapp: x.klapp, ersatz: x.ersatz };
      if (r.code) { s.groesse = r.code; s.groesseBekannt = true; }
      else if (r.alt) s.groesseBekannt = false;
      $('#df-code-ok').innerHTML = x.html;
      zeige();
    });
    $$('[data-groessen]').forEach(function (box) {
      wahl(box, function (b) {
        s.groesse = b.dataset.code;
        if (s.vorhaben === 'neu') s.eigen = true; else { s.groesseBekannt = true; if (!leseSchild($('#df-code').value).code) $('#df-code-ok').textContent = ''; }
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
    $('#df-extras').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      s.extras = $$('#df-extras button[aria-pressed="true"]').map(function (x) { return x.dataset.wert; }); zeige();
    });
    wahl($('#df-glas'), function (b) { s.glas = b.dataset.wert; });
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
      var pr = preis(); if (pr) zl.push(['Preis etwa', z(pr.netto) + ' € netto, zzgl. MwSt. (Schätzung der Website)']);
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
