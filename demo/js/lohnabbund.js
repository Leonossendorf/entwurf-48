/* Lohnabbund: Datei-Upload mit Vorschau (Unternehmen), Bausatz-Planer und Aufmass-Anfrage (Privat), Anfrage als Mail. */
(function () {
  'use strict';
  var H = window.Holz, z = H.zahl;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function groesse(b) { return b > 1048576 ? z(b / 1048576, 1) + ' MB' : z(Math.max(1, b / 1024), 0) + ' KB'; }
  function meter(mm) { return z(mm / 1000, 2) + ' m'; }
  function qs(r) { return z(Math.min(r.B, r.H)) + ' × ' + z(Math.max(r.B, r.H)); }

  /* ---------- Schalter-Gruppen (Chips) ---------- */
  function chips(gruppe, beiWechsel) {
    gruppe.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !gruppe.contains(b)) return;
      if (gruppe.dataset.mehrfach) b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      else $$('button', gruppe).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      if (beiWechsel) beiWechsel(b);
    });
  }
  function chipWerte(form) {
    var o = {};
    $$('.la-chips[data-name]', form).forEach(function (g) {
      o[g.dataset.name] = $$('button[aria-pressed="true"]', g).map(function (b) { return b.dataset.wert; });
    });
    return o;
  }

  /* ---------- Tabellen ---------- */
  function bearbText(r) {
    var b = {}; (r.bearb || []).forEach(function (x) { var n = H.bearbeitungDe(x); b[n] = (b[n] || 0) + 1; });
    return Object.keys(b).map(function (k) { return (b[k] > 1 ? b[k] + '× ' : '') + k; }).join(', ');
  }
  function listeHtml(zeilen) {
    var h = '<table class="la-tabelle"><thead><tr><th>Pos.</th><th>Bauteil</th><th class="r">Stk.</th><th class="r">Querschnitt</th><th class="r">Länge</th><th>Holz</th><th>Bearbeitungen</th></tr></thead><tbody>';
    zeilen.forEach(function (r, i) {
      h += '<tr data-zeile="' + i + '" tabindex="0"><td>' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td class="r">' + r.anzahl + '</td><td class="r">' + qs(r) + '</td><td class="r">' + meter(r.L) + '</td><td>' + (esc([r.material, r.guete].filter(Boolean).join(' ')) || '<span class="la-fehlt">fehlt</span>') + '</td><td>' + (esc(bearbText(r)) || '–') + '</td></tr>';
    });
    return h + '</tbody></table>';
  }
  function listeText(zeilen, max) {
    var t = zeilen.slice(0, max).map(function (r, i) { return (i + 1) + '. ' + r.anzahl + ' × ' + r.name + ', ' + qs(r) + ' mm, ' + meter(r.L); }).join('\n');
    return t + (zeilen.length > max ? '\n… und ' + (zeilen.length - max) + ' weitere Positionen (vollständig im Anhang)' : '');
  }
  function kpiHtml(paare) {
    return paare.map(function (p) { return '<div><b>' + p[1] + '</b><span>' + p[0] + '</span>' + (p[2] ? '<small>' + p[2] + '</small>' : '') + '</div>'; }).join('');
  }
  function auswahlText(r) { return r.name + ' · ' + qs(r) + ' mm · ' + meter(r.L) + ' · ' + r.anzahl + ' Stück'; }
  function zeigeAuswahl(el, r, abwahl) {
    if (!el) return;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = '<span><b>Ausgewählt:</b> ' + esc(auswahlText(r)) + '</span><button type="button" aria-label="Auswahl aufheben">×</button>';
    el.querySelector('button').addEventListener('click', abwahl);
  }

  /* ---------- Anfrage als Mail ---------- */
  function alsText(html) { var d = document.createElement('div'); d.innerHTML = String(html).replace(/<br\s*\/?>/gi, ', '); return d.textContent.trim(); }
  function mailText(zeilen, zusatz) {
    var t = 'Guten Tag,\n\nhier ist meine Anfrage über die Website:\n\n' + zeilen.map(function (x) { return x[0] + ': ' + alsText(x[1]); }).join('\n');
    if (zusatz) t += '\n\n' + zusatz;
    return t + '\n';
  }
  function kopiere(text, knopf) {
    function ok() { var alt = knopf.textContent; knopf.textContent = 'Kopiert'; setTimeout(function () { knopf.textContent = alt; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, function () { ersatz(); }); } else ersatz();
    function ersatz() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) { } document.body.removeChild(ta); }
  }
  function danke(box, form, zeilen, bild, text, mail) {
    var body = mailText(zeilen, mail && mail.zusatz), betreff = (mail && mail.betreff) || 'Anfrage über die Website';
    box.innerHTML = '<h3>So kommt die Anfrage an</h3><p class="la-entwurf la-entwurf-gross">Entwurf: Es wurde nichts versendet. ' + text + '</p>' +
      '<div class="la-danke-innen">' + (bild ? '<img src="' + bild + '" alt="Vorschaubild des Modells">' : '') +
      '<dl class="la-dl">' + zeilen.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl></div>' +
      '<div class="la-mail"><a class="la-knopf la-mail-auf" href="mailto:?subject=' + encodeURIComponent(betreff) + '&body=' + encodeURIComponent(body.slice(0, 1700)) + '">Als E-Mail senden &gt;</a>' +
      '<button type="button" class="la-link-hell la-mail-kopie">Text der Anfrage kopieren</button>' +
      '<button type="button" class="la-link-hell la-zurueck-form">Anfrage bearbeiten</button></div>' +
      '<p class="la-klein la-mail-hinweis">Die Mail enthält alle Angaben von oben. In der fertigen Website geht sie automatisch an Schophuis, mit Datei und Bild im Anhang. In dieser Demo öffnet sich Ihr Mailprogramm ohne Empfänger.</p>';
    form.hidden = true; box.hidden = false; box.focus();
    box.querySelector('.la-zurueck-form').addEventListener('click', function () { box.hidden = true; form.hidden = false; });
    box.querySelector('.la-mail-kopie').addEventListener('click', function () { kopiere(body, this); });
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ================= Startbild ================= */
  function hero() {
    var c = $('#la-hero-3d'); if (!c || !window.Holz3D) return;
    try {
      var v = new Holz3D(c, {});
      v.controls.enableZoom = false; v.controls.enablePan = false;
      v.laden(c.dataset.modell === 'gartenhaus' ? H.gartenhaus({ breite: 3000, tiefe: 5000 }) : H.dachstuhl({ breite: 8000, laenge: 8800, neigung: 40 }), {});
      v.controls.addEventListener('end', function () { v.controls.autoRotate = !v.reduziert; });
    } catch (e) { c.style.display = 'none'; }
  }

  /* ================= Unternehmen: Upload ================= */
  var zustand = { dateien: [], modell: null, viewer: null, erg: null, modus: 'datei', wahl: -1 };

  function setModus(m, rollen) {
    zustand.modus = m = m === 'planung' ? 'planung' : 'datei';
    $$('.la-modus button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.modus === m ? 'true' : 'false'); });
    ['#la-wz-titel', '#la-wz-text', '#la-drop-titel', '#la-drop-arten'].forEach(function (s) { var e = $(s); if (e && e.dataset[m]) e.innerHTML = e.dataset[m]; });
    if ($('#la-oder')) $('#la-oder').hidden = m !== 'datei';
    if ($('#la-ohne')) $('#la-ohne').hidden = m !== 'planung';
    var g = $('.la-chips[data-name="umfang"]');
    if (g) $$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.modus === m ? 'true' : 'false'); });
    try { history.replaceState(null, '', location.pathname + location.search + '#' + (m === 'planung' ? 'planung' : 'datei')); } catch (e) { }
    if (rollen) $('#datei').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function chipsDateien() {
    $('#la-dateien').innerHTML = zustand.dateien.map(function (d) {
      var s = d.status === 'liest' ? 'wird gelesen …' : (d.status === 'fehler' ? 'nicht lesbar, wird mitgeschickt' : (d.r.art === 'modell' ? d.r.modell.teile.reduce(function (a, t) { return a + (t.anzahl || 1); }, 0) + ' Teile gelesen' : 'wird mitgeschickt'));
      return '<div class="la-datei la-datei-' + d.status + (d.r && d.r.art === 'modell' ? ' la-datei-modell' : '') + '"><strong>' + esc(d.name) + '</strong><span>' + esc(d.r ? d.r.format : '') + ' · ' + groesse(d.groesse) + '</span><em>' + s + '</em></div>';
    }).join('');
  }

  function zeigeErgebnis() {
    $('#la-start').hidden = true; $('#la-ergebnis').hidden = false;
    $('#la-form-betrieb').hidden = false; $('#la-danke-betrieb').hidden = true;
    setTimeout(function () { $('#la-ergebnis').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  }
  function nimm(files) {
    files = Array.prototype.slice.call(files || []); if (!files.length) return;
    zeigeErgebnis();
    files.forEach(function (f) {
      var d = { name: f.name, groesse: f.size, status: 'liest' };
      zustand.dateien.push(d); chipsDateien();
      H.lese(f).then(function (r) {
        d.r = r; d.status = 'ok'; chipsDateien();
        if (r.art === 'modell' && !zustand.modell) zeigeModell(r);
        else zeigeDokument(r);
        umfangVorschlag();
      }).catch(function () { d.status = 'fehler'; d.r = { format: 'Datei', art: 'unbekannt' }; chipsDateien(); });
    });
  }

  /* Ohne Maschinendatei ist die Planung der passende Weg: Auswahl vorbelegen, solange niemand selbst gewaehlt hat */
  function umfangVorschlag() {
    var g = $('.la-chips[data-name="umfang"]'); if (!g || g.dataset.beruehrt) return;
    var hatModell = zustand.dateien.some(function (d) { return d.r && d.r.art === 'modell'; });
    var m = hatModell && zustand.modus === 'datei' ? 'datei' : 'planung';
    $$('button', g).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.modus === m ? 'true' : 'false'); });
  }

  function zeigeModell(r) {
    var m = r.modell, k = H.kennzahlen(m.teile);
    zustand.modell = m; zustand.erg = r; zustand.k = k; zustand.wahl = -1;
    $('#la-modell').hidden = false;
    if (!zustand.viewer) {
      zustand.viewer = new Holz3D($('#la-buehne'), {
        onHover: function (zeile) { $$('#la-reiter-liste tr').forEach(function (tr) { tr.classList.toggle('la-hover', +tr.dataset.zeile === zeile); }); },
        onSelect: function (zeile) { waehle(zeile, true); }
      });
    }
    zustand.viewer.resize();
    zustand.viewer.laden(m, {});
    zeigeAuswahl($('#la-auswahl'), null);
    $('#la-explosion').value = 0;
    $$('#la-farbe button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.farbe === 'holz' ? 'true' : 'false'); });
    zustand.viewer.setFarbmodus('holz');

    $('#la-kpi').innerHTML = kpiHtml([
      ['Teile', z(k.teile)], ['Laufmeter', z(k.lfm, 1) + ' m'], ['Holz', z(k.m3, 2) + ' m³'],
      ['Gewicht, etwa', z(k.gewicht / 10, 0) + '0 kg', 'gerechnet mit 470 kg/m³'], ['Bearbeitungen', z(k.bearbSumme)], ['Längstes Teil', meter(k.maxL)]
    ]);

    var p = [], det = r.details || {};
    p.push(['ok', 'Datei gelesen: ' + esc(r.format) + (det.programm ? ', erzeugt mit ' + esc(det.programm) : '')]);
    if (r.experimentell) p.push(['offen', 'Dieses Format liest die Demo nach Näherung: Länge, Querschnitt und Stückzahl.']);
    else if (m.formText) p.push([m.formText.indexOf('Alle') === 0 ? 'ok' : 'warn', esc(m.formText)]);
    else p.push(['warn', 'Die Datei enthält keine fertige Form. Vorschau aus Länge und Querschnitt.']);
    if (det.sema) p.push(['warn', 'Die einzelnen Bearbeitungen stehen nicht in der SEMA-Datei. Die Maschinendatei (BVX) erzeugt Schophuis daraus.']);
    if (det.rohStk) p.push(['ok', 'Rohholz laut Datei: ' + z(det.rohStk) + ' Stangen, zusammen ' + z(det.rohLfm, 1) + ' m']);
    if (k.ohneMaterial === 0) p.push(['ok', 'Holz: ' + esc(Object.keys(k.material).join(', '))]);
    else if (Object.keys(k.material).length) p.push(['warn', 'Holz: ' + esc(Object.keys(k.material).join(', ')) + '. Bei ' + k.ohneMaterial + ' Teilen fehlt die Angabe.']);
    else p.push(['warn', 'Die Datei nennt keine Holzart. Bitte unten bei „Noch etwas?“ angeben.']);
    p.push(['offen', 'Passt auf die Anlage? Längstes Teil ' + meter(k.maxL) + ', größter Querschnitt ' + z(k.maxB) + ' × ' + z(k.maxH) + ' mm. <em class="demo-offen">Angabe folgt: Grenzwerte der Hundegger</em>']);
    (r.hinweise || []).forEach(function (h) { p.push(['warn', esc(h)]); });
    $('#la-pruefung').innerHTML = '<ul>' + p.map(function (x) { return '<li class="la-p-' + x[0] + '">' + x[1] + '</li>'; }).join('') + '</ul>';

    $('#la-reiter-liste').innerHTML = listeHtml(m.zeilen);
    var farben = {}, fi = 0; m.teile.forEach(function (t) { if (!(t.qkey in farben)) farben[t.qkey] = fi++; });
    $('#la-reiter-quer').innerHTML = '<table class="la-tabelle"><thead><tr><th>Querschnitt (mm)</th><th class="r">Stk.</th><th class="r">Laufmeter</th><th class="r">m³</th></tr></thead><tbody>' + k.querListe.map(function (q) {
      var c = '#' + ('000000' + Holz3D.PALETTE[farben[q.key] % Holz3D.PALETTE.length].toString(16)).slice(-6);
      return '<tr><td><i class="la-farbe" style="background:' + c + '"></i>' + q.key + '</td><td class="r">' + q.anzahl + '</td><td class="r">' + z(q.lfm, 1) + '</td><td class="r">' + z(q.m3, 2) + '</td></tr>';
    }).join('') + '</tbody></table>';
    var bl = Object.keys(k.bearb).sort(function (a, b) { return k.bearb[b] - k.bearb[a]; }), maxB = bl.length ? k.bearb[bl[0]] : 1;
    $('#la-reiter-bearb').innerHTML = bl.length ? '<ul class="la-balken">' + bl.map(function (b) {
      return '<li><span>' + esc(H.bearbeitungDe(b)) + '</span><i style="width:' + Math.max(4, Math.round(k.bearb[b] / maxB * 100)) + '%"></i><b>' + k.bearb[b] + '</b></li>';
    }).join('') + '</ul>' : '<p class="la-klein">Diese Datei nennt keine einzelnen Bearbeitungen.</p>';
    var rohKnopf = $('.la-reiter button[data-reiter="roh"]');
    rohKnopf.hidden = !(det.rohholz && det.rohholz.length);
    $('#la-reiter-roh').innerHTML = det.rohholz && det.rohholz.length ? '<table class="la-tabelle"><thead><tr><th class="r">Stk.</th><th class="r">Querschnitt</th><th class="r">Länge</th><th>Güte</th><th class="r">Laufmeter</th></tr></thead><tbody>' + det.rohholz.map(function (x) {
      return '<tr><td class="r">' + x.anzahl + '</td><td class="r">' + z(x.B) + ' × ' + z(x.H) + '</td><td class="r">' + meter(x.L) + '</td><td>' + (esc(x.guete) || '–') + '</td><td class="r">' + z(x.L * x.anzahl / 1000, 1) + '</td></tr>';
    }).join('') + '</tbody></table>' : '';
    var d = [['Datei', esc(r.datei.name)], ['Größe', groesse(r.datei.groesse)], ['Format', esc(r.format)]];
    if (m.name) d.push(['Projekt', esc(m.name)]);
    if (det.programm) d.push(['Erzeugt mit', esc(det.programm)]);
    if (det.rohteile) d.push(['Rohteile', det.rohteile]);
    if (det.cambium) d.push(['Zuletzt gespeichert mit', 'Hundegger Cambium ' + esc(det.cambium.split(' ')[0])]);
    if (det.positionen) d.push(['Positionen', z(det.positionen) + ' verschiedene Bauteile, ' + z(k.teile) + ' Stück']);
    if (det.zeichen) d.push(['Markierungen und Beschriftungen', z(det.zeichen)]);
    if (det.lautCambium) d.push(['Laut Cambium', z(det.lautCambium.stk) + ' Stück, ' + z(det.lautCambium.lfm, 1) + ' m, ' + z(det.lautCambium.m3, 2) + ' m³']);
    if (det.ohneAbbund) d.push(['Nicht im Abbund', z(det.ohneAbbund) + ' Fenster- und Türteile ausgeblendet']);
    if (det.wurzel) d.push(['Aufbau der Datei', esc(det.wurzel) + ': ' + esc((det.struktur || []).join(', '))]);
    if (det.archiv) d.push(['Inhalt des Archivs', esc(det.archiv.join(', '))]);
    d.push(['Gesamtmaß', (function () { var b = zustand.viewer.box.getSize(new THREE.Vector3()); return z(b.x, 2) + ' × ' + z(b.z, 2) + ' × ' + z(b.y, 2) + ' m'; })()]);
    $('#la-reiter-datei').innerHTML = '<dl class="la-dl">' + d.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl><p class="la-klein">Diese Angaben gehen zusammen mit der Datei an Schophuis.</p>';
  }

  /* Bauteil waehlen: im Bild Signalfarbe, Rest blass; in der Liste markiert. Nochmal antippen hebt die Auswahl auf. */
  function waehle(zeile, rollen) {
    if (!zustand.viewer || !zustand.modell) return;
    if (zeile === zustand.wahl) zeile = -1;
    zustand.wahl = zeile;
    zustand.viewer.controls.autoRotate = false;
    zustand.viewer.markiere(zeile >= 0 ? zeile : null);
    $$('#la-reiter-liste tr').forEach(function (tr) {
      var an = +tr.dataset.zeile === zeile; tr.classList.toggle('la-gewaehlt', an);
      if (an && rollen) { reiter('liste'); var box = $('#la-reiter-liste'); box.scrollTop = tr.offsetTop - box.clientHeight / 2; }
    });
    zeigeAuswahl($('#la-auswahl'), zeile >= 0 ? zustand.modell.zeilen[zeile] : null, function () { waehle(zustand.wahl, false); });
  }

  function farbe(modus) {
    $$('#la-farbe button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.farbe === modus ? 'true' : 'false'); });
    zustand.viewer.setFarbmodus(modus);
  }

  function reiter(name) {
    $$('.la-reiter button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.reiter === name ? 'true' : 'false'); });
    ['liste', 'quer', 'bearb', 'roh', 'datei'].forEach(function (n) { $('#la-reiter-' + n).hidden = n !== name; });
  }

  function zeigeDokument(r) {
    var box = document.createElement('div'); box.className = 'la-dok';
    var kopf = '<p class="la-dok-titel"><strong>' + esc(r.datei.name) + '</strong> ' + esc(r.format) + '</p>';
    var d = r.details || {};
    if (d.bild) box.innerHTML = kopf + '<img src="' + d.bild + '" alt="Vorschau ' + esc(r.datei.name) + '">';
    else if (d.pdf) box.innerHTML = kopf + '<object data="' + d.pdf + '#toolbar=0&view=FitH" type="application/pdf"><a href="' + d.pdf + '" target="_blank" rel="noopener">PDF öffnen</a></object>';
    else if (d.dxf && d.dxf.seg.length) { box.innerHTML = kopf + '<canvas width="900" height="560"></canvas><p class="la-klein">' + d.dxf.seg.length + ' Linien gelesen</p>'; zeichneDxf(box.querySelector('canvas'), d.dxf.seg); }
    else if (d.ifc) {
      var i = d.ifc, t = [['Balken', i.balken], ['Stäbe', i.staebe], ['Stützen', i.stuetzen], ['Platten', i.platten], ['Wände', i.waende], ['Decken', i.decken]].filter(function (x) { return x[1]; });
      box.innerHTML = kopf + '<p>' + (t.length ? t.map(function (x) { return '<b>' + x[1] + '</b> ' + x[0]; }).join(' · ') : 'Keine Bauteile gezählt.') + '</p>';
    } else box.innerHTML = kopf;
    (r.hinweise || []).forEach(function (h) { var p = document.createElement('p'); p.className = 'la-klein'; p.textContent = h; box.appendChild(p); });
    $('#la-dokumente').appendChild(box);
  }

  function zeichneDxf(cv, seg) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    seg.forEach(function (s) { x0 = Math.min(x0, s[0], s[2]); x1 = Math.max(x1, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]); y1 = Math.max(y1, s[1], s[3]); });
    var w = cv.width, h = cv.height, r = 20, f = Math.min((w - 2 * r) / Math.max(x1 - x0, 1e-9), (h - 2 * r) / Math.max(y1 - y0, 1e-9));
    var ox = (w - (x1 - x0) * f) / 2, oy = (h - (y1 - y0) * f) / 2, c = cv.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#1c2a12'; c.lineWidth = 1; c.beginPath();
    seg.forEach(function (s) { c.moveTo(ox + (s[0] - x0) * f, h - oy - (s[1] - y0) * f); c.lineTo(ox + (s[2] - x0) * f, h - oy - (s[3] - y0) * f); });
    c.stroke();
  }

  function zurueck() {
    zustand.dateien = []; zustand.modell = null; zustand.erg = null; zustand.wahl = -1;
    $('#la-dokumente').innerHTML = ''; $('#la-dateien').innerHTML = '';
    $('#la-modell').hidden = true; $('#la-ergebnis').hidden = true; $('#la-start').hidden = false;
    if (zustand.viewer) zustand.viewer.leeren();
    zeigeAuswahl($('#la-auswahl'), null);
    $('#la-datei').value = '';
    var g = $('.la-chips[data-name="umfang"]'); if (g) delete g.dataset.beruehrt;
    $('#datei').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  var beispielText = null;
  function beispiel() { if (!beispielText) beispielText = H.alsBTLx(H.dachstuhl({})); return beispielText; }

  function betriebe() {
    var drop = $('#la-drop'); if (!drop) return;
    // Am Handy gibt es kein Ziehen: Der Text sagt dort, was wirklich passiert.
    if (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) {
      var dt = $('#la-drop-titel');
      if (dt) { dt.dataset.datei = 'Datei hochladen'; dt.dataset.planung = 'Plan hochladen'; dt.textContent = dt.dataset[zustand.modus] || dt.dataset.datei; }
      var du = drop.querySelector('span');
      if (du && /klicken/.test(du.textContent)) du.textContent = 'antippen und Datei wählen';
    }
    $('#la-datei').addEventListener('change', function (e) { nimm(e.target.files); });
    ['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('la-drueber'); }); });
    ['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('la-drueber'); }); });
    var bereich = $('#datei');
    bereich.addEventListener('dragover', function (e) { e.preventDefault(); });
    bereich.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) nimm(e.dataTransfer.files); });
    $('#la-beispiel').addEventListener('click', function () { nimm([new File([beispiel()], 'Beispiel-Dachstuhl.btlx', { type: 'application/xml' })]); });
    $('#la-beispiel-datei').addEventListener('click', function () { this.href = URL.createObjectURL(new Blob([beispiel()], { type: 'application/xml' })); });
    $('#la-ohne-datei').addEventListener('click', zeigeErgebnis);
    $('#la-zurueck').addEventListener('click', zurueck);

    // Wege: per Link (#datei, #planung), per Knopf und per Reiter
    $$('[data-modus]').forEach(function (b) {
      if (b.closest('.la-chips')) return;
      b.addEventListener('click', function (e) { e.preventDefault(); setModus(b.dataset.modus, true); });
    });
    window.addEventListener('hashchange', function () { if (location.hash === '#planung' || location.hash === '#datei') setModus(location.hash.slice(1), true); });
    if (location.hash === '#planung') { setModus('planung', false); setTimeout(function () { $('#datei').scrollIntoView({ block: 'start' }); }, 250); }

    $('#la-farbe').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      farbe(b.dataset.farbe);
      if (b.dataset.farbe === 'querschnitt') reiter('quer'); else if (b.dataset.farbe === 'bearbeitung') reiter('bearb'); else reiter('liste');
    });
    $('#la-ansicht').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { zustand.viewer.controls.autoRotate = false; zustand.viewer.ansicht(b.dataset.ansicht); } });
    $('#la-explosion').addEventListener('input', function () { zustand.viewer.controls.autoRotate = false; zustand.viewer.setExplosion(this.value / 100); });
    // Reiter und Farbfilter gehoeren zusammen: Querschnitte und Bearbeitungen faerben das Modell passend ein, die Stueckliste zeigt wieder Holz.
    $('.la-reiter').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      reiter(b.dataset.reiter);
      var f = { liste: 'holz', quer: 'querschnitt', bearb: 'bearbeitung' }[b.dataset.reiter];
      if (f && zustand.viewer && zustand.modell) farbe(f);
    });
    var liste = $('#la-reiter-liste');
    liste.addEventListener('click', function (e) { var tr = e.target.closest('tr[data-zeile]'); if (tr) waehle(+tr.dataset.zeile, false); });
    liste.addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-zeile]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); waehle(+tr.dataset.zeile, false); } });
    liste.addEventListener('mouseover', function (e) { var tr = e.target.closest('tr[data-zeile]'); if (tr && zustand.viewer) { zustand.viewer.hover = +tr.dataset.zeile; zustand.viewer._emissiv(); } });
    liste.addEventListener('mouseleave', function () { if (zustand.viewer) { zustand.viewer.hover = -1; zustand.viewer._emissiv(); } });

    var form = $('#la-form-betrieb');
    $$('.la-chips', form).forEach(function (g) {
      chips(g, function (b) {
        g.dataset.beruehrt = '1';
        if (g.dataset.name === 'umfang' && b.dataset.modus) { zustand.modus = b.dataset.modus; $$('.la-modus button').forEach(function (x) { x.setAttribute('aria-selected', x.dataset.modus === b.dataset.modus ? 'true' : 'false'); }); }
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = form.kontakt.value.trim();
      $('#la-fehler-betrieb').hidden = !!kontakt;
      if (!kontakt) { form.kontakt.focus(); return; }
      var w = chipWerte(form), k = zustand.k, bild = '', m = zustand.modell;
      try { if (m && zustand.viewer) bild = zustand.viewer.bild(); } catch (err) { bild = ''; }
      var zeilen = [['Weg', esc((w.umfang || []).join(''))]];
      zeilen.push(['Dateien', zustand.dateien.length ? zustand.dateien.map(function (d) { return esc(d.name) + ' (' + esc(d.r ? d.r.format : 'Datei') + ', ' + groesse(d.groesse) + ')'; }).join('<br>') : 'keine, Unterlagen folgen']);
      if (m) zeilen.push(['Aus der Datei gelesen', z(k.teile) + ' Teile, ' + z(k.lfm, 1) + ' m, ' + z(k.m3, 2) + ' m³, ' + z(k.bearbSumme) + ' Bearbeitungen, längstes Teil ' + meter(k.maxL) + ', größter Querschnitt ' + z(k.maxB) + ' × ' + z(k.maxH) + ' mm']);
      if (m && zustand.wahl >= 0) zeilen.push(['Markiertes Bauteil', esc(auswahlText(m.zeilen[zustand.wahl]))]);
      zeilen.push(['Holz', esc((w.holz || []).join(''))], ['Übergabe', esc((w.uebergabe || []).join(''))]);
      if (form.termin.value) zeilen.push(['Wunschtermin', new Date(form.termin.value).toLocaleDateString('de-DE')]);
      if (form.betrieb.value) zeilen.push(['Betrieb', esc(form.betrieb.value)]);
      zeilen.push(['Rückmeldung an', esc(kontakt)]);
      if (form.nachricht.value) zeilen.push(['Nachricht', esc(form.nachricht.value)]);
      var zusatz = (m ? 'Stückliste:\n' + listeText(m.zeilen, 18) + '\n\n' : '') + (zustand.dateien.length ? 'Anhang: ' + zustand.dateien.map(function (d) { return d.name; }).join(', ') : '');
      danke($('#la-danke-betrieb'), form, zeilen, bild, 'Schophuis bekommt die Anfrage mit Datei, Stückliste und Vorschaubild per E-Mail. Ihr bekommt eine Bestätigung an die angegebene Adresse.',
        { betreff: 'Lohnabbund: ' + (form.betrieb.value || 'Anfrage') + (m ? ', ' + z(k.teile) + ' Teile' : ''), zusatz: zusatz });
    });
  }

  /* ================= Privat: Bausatz-Planer ================= */
  var TYPEN = {
    gartenhaus: { name: 'Gartenhaus', bau: H.gartenhaus, b: [2000, 5000], t: [2000, 8000], h: [2000, 2600], bn: 'Breite', hn: 'Wandhöhe', start: 2,
      pakete: [['3 × 3 m', 3000, 3000, 2200], ['3 × 4 m', 3000, 4000, 2200], ['3 × 6 m', 3000, 6000, 2200]] },
    carport: { name: 'Carport', bau: H.carport, b: [2700, 6500], t: [4500, 8000], h: [2000, 2800], bn: 'Einfahrtsbreite', hn: 'Durchfahrtshöhe', start: 1,
      pakete: [['Einzel 3 × 5,5 m', 3000, 5500, 2300], ['Einzel 3 × 6 m', 3000, 6000, 2300], ['Doppel 6 × 6 m', 6000, 6000, 2300]] },
    terrassendach: { name: 'Terrassendach', bau: H.terrassendach, b: [3000, 8000], t: [2000, 4500], h: [2100, 2700], bn: 'Breite an der Hauswand', hn: 'Durchgangshöhe vorn', start: 0,
      pakete: [['4 × 3 m', 4000, 3000, 2200], ['5 × 3 m', 5000, 3000, 2200], ['6 × 3,5 m', 6000, 3500, 2200]] }
  };
  var bs = { typ: 'gartenhaus', viewer: null, modell: null, erst: true, warte: 0, wahl: -1 };

  function bsWerte() { return { b: +$('#bs-breite').value, t: +$('#bs-tiefe').value, h: +$('#bs-hoehe').value }; }
  function bsLink() { var w = bsWerte(); return location.origin + location.pathname + '?typ=' + bs.typ + '&b=' + w.b + '&t=' + w.t + '&h=' + w.h + '#planer'; }
  function bsBau(animiert) {
    var w = bsWerte(), T = TYPEN[bs.typ];
    $('#bs-breite-wert').textContent = meter(w.b); $('#bs-tiefe-wert').textContent = meter(w.t); $('#bs-hoehe-wert').textContent = meter(w.h);
    var m = bs.modell = T.bau({ breite: w.b, tiefe: w.t, hoehe: w.h });
    var k = bs.k = H.kennzahlen(m.teile);
    bs.wahl = -1; zeigeAuswahl($('#bs-auswahl'), null);
    if (bs.viewer) bs.viewer.laden(m, { animiert: !!animiert, kamera: animiert || bs.erst, drehen: true });
    bs.erst = false;
    $('#bs-kpi').innerHTML = kpiHtml([['Grundfläche', z(w.b * w.t / 1e6, 1) + ' m²'], ['Holzteile', z(k.teile)], ['Laufmeter Holz', z(k.lfm, 0) + ' m'], ['Holz', z(k.m3, 2) + ' m³']]);
    $('#bs-liste').innerHTML = listeHtml(m.zeilen);
    $('#bs-uebersicht').textContent = T.name + ' ' + meter(w.b) + ' × ' + meter(w.t) + ', ' + T.hn + ' ' + meter(w.h) + ' · ' + z(k.teile) + ' Holzteile, ' + z(k.lfm, 0) + ' m Holz';
    $$('#bs-paket button').forEach(function (x) { x.setAttribute('aria-pressed', (+x.dataset.b === w.b && +x.dataset.t === w.t) ? 'true' : 'false'); });
    try { history.replaceState(null, '', location.pathname + '?typ=' + bs.typ + '&b=' + w.b + '&t=' + w.t + '&h=' + w.h + location.hash); } catch (e) { }
  }
  function bsTyp(typ, werte) {
    if (!TYPEN[typ]) typ = 'gartenhaus';
    bs.typ = typ; var T = TYPEN[typ];
    $$('#bs-typ button').forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.typ === typ ? 'true' : 'false'); });
    [['breite', T.b], ['tiefe', T.t], ['hoehe', T.h]].forEach(function (x) { var r = $('#bs-' + x[0]); r.min = x[1][0]; r.max = x[1][1]; });
    $('#bs-breite-name').textContent = T.bn; $('#bs-hoehe-name').textContent = T.hn;
    $('#bs-paket').innerHTML = T.pakete.map(function (p) { return '<button type="button" aria-pressed="false" data-b="' + p[1] + '" data-t="' + p[2] + '" data-h="' + p[3] + '">' + p[0] + '</button>'; }).join('');
    var p0 = T.pakete[T.start];
    function grenze(v, g, d) { v = +v; return isFinite(v) && v > 0 ? Math.min(g[1], Math.max(g[0], v)) : d; }
    $('#bs-breite').value = werte ? grenze(werte.b, T.b, p0[1]) : p0[1];
    $('#bs-tiefe').value = werte ? grenze(werte.t, T.t, p0[2]) : p0[2];
    $('#bs-hoehe').value = werte ? grenze(werte.h, T.h, p0[3]) : p0[3];
    bs.erst = true; bsBau(true);
  }
  function bsWaehle(zeile) {
    if (!bs.viewer || !bs.modell) return;
    if (zeile === bs.wahl) zeile = -1;
    bs.wahl = zeile; bs.viewer.controls.autoRotate = false;
    bs.viewer.markiere(zeile >= 0 ? zeile : null);
    zeigeAuswahl($('#bs-auswahl'), zeile >= 0 ? bs.modell.zeilen[zeile] : null, function () { bsWaehle(bs.wahl); });
  }
  function privat() {
    var buehne = $('#bs-buehne'); if (!buehne) return;
    var q = new URLSearchParams(location.search);
    function los() {
      if (bs.viewer) return;
      try { bs.viewer = new Holz3D(buehne, { onSelect: bsWaehle }); bs.viewer.controls.enableZoom = false; } catch (e) { buehne.textContent = 'Die 3D-Vorschau braucht einen aktuellen Browser.'; }
      bsTyp(q.get('typ') || 'gartenhaus', q.has('b') ? { b: q.get('b'), t: q.get('t'), h: q.get('h') } : null);
    }
    if ('IntersectionObserver' in window && !q.has('typ')) { var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); los(); } }, { rootMargin: '300px' }); io.observe(buehne); } else los();
    chips($('#bs-typ'), function (b) { bsTyp(b.dataset.typ); });
    $('#bs-paket').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $('#bs-breite').value = b.dataset.b; $('#bs-tiefe').value = b.dataset.t; $('#bs-hoehe').value = b.dataset.h; bs.erst = true; bsBau(true);
    });
    ['breite', 'tiefe', 'hoehe'].forEach(function (n) {
      $('#bs-' + n).addEventListener('input', function () { if (bs.warte) return; bs.warte = requestAnimationFrame(function () { bs.warte = 0; bsBau(false); }); });
    });
    $('#bs-liste').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-zeile]'); if (tr) bsWaehle(+tr.dataset.zeile); });
    $('#bs-link').addEventListener('click', function () { kopiere(bsLink(), this); });
    var form = $('#la-form-privat');
    $$('.la-chips', form).forEach(function (g) { chips(g); });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = form.kontakt.value.trim();
      $('#la-fehler-privat').hidden = !!kontakt;
      if (!kontakt) { form.kontakt.focus(); return; }
      var w = chipWerte(form), v = bsWerte(), T = TYPEN[bs.typ], bild = '';
      try { bild = bs.viewer.bild(); } catch (err) { bild = ''; }
      var zl = [['Weg', 'Online geplant'], ['Bausatz', esc(T.name)], [T.bn, meter(v.b)], ['Tiefe', meter(v.t)], [T.hn, meter(v.h)],
        ['Holzgerüst', z(bs.k.teile) + ' Teile, ' + z(bs.k.lfm, 0) + ' m Holz, ' + z(bs.k.m3, 2) + ' m³']];
      if (bs.wahl >= 0) zl.push(['Markiertes Bauteil', esc(auswahlText(bs.modell.zeilen[bs.wahl]))]);
      zl.push(['Aufbau', esc((w.aufbau || []).join(''))]);
      if (form.name.value) zl.push(['Name', esc(form.name.value)]);
      if (form.ort.value) zl.push(['Ort', esc(form.ort.value)]);
      zl.push(['Rückmeldung an', esc(kontakt)]);
      if (form.nachricht.value) zl.push(['Wünsche', esc(form.nachricht.value)]);
      zl.push(['Link zur Planung', '<a href="' + esc(bsLink()) + '">' + esc(bsLink()) + '</a>']);
      danke($('#la-danke-privat'), form, zl, bild, 'Schophuis bekommt Maße, Stückliste und Vorschaubild per E-Mail und meldet sich mit einem Angebot.',
        { betreff: 'Bausatz ' + T.name + ' ' + meter(v.b) + ' × ' + meter(v.t), zusatz: 'Stückliste:\n' + listeText(bs.modell.zeilen, 14) });
    });
  }

  /* ================= einfache Formulare (Aufmass, Frage) ================= */
  function einfach() {
    $$('form.la-einfach').forEach(function (form) {
      var box = form.nextElementSibling, fehler = $('.la-fehler', form);
      $$('.la-chips', form).forEach(function (g) { chips(g); });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var kontakt = form.kontakt.value.trim();
        fehler.hidden = !!kontakt;
        if (!kontakt) { form.kontakt.focus(); return; }
        var zl = [];
        if (form.id === 'la-form-aufmass') zl.push(['Weg', 'Aufmaß und Planung durch Schophuis (gegen Aufpreis)']);
        $$('.la-chips[data-titel]', form).forEach(function (g) { zl.push([g.dataset.titel, esc($$('button[aria-pressed="true"]', g).map(function (b) { return b.dataset.wert; }).join(', '))]); });
        $$('input[data-titel]', form).forEach(function (i) {
          if (i.type === 'file') { if (i.files && i.files.length) zl.push([i.dataset.titel, esc(Array.prototype.map.call(i.files, function (f) { return f.name; }).join(', '))]); }
          else if (i.value.trim()) zl.push([i.dataset.titel, esc(i.value.trim())]);
        });
        if (form.name && !form.name.dataset.titel && form.name.value) zl.push(['Name', esc(form.name.value)]);
        zl.push(['Rückmeldung an', esc(kontakt)]);
        if (form.nachricht.value) zl.push(['Nachricht', esc(form.nachricht.value)]);
        danke(box, form, zl, '', 'In der fertigen Website geht die Anfrage per E-Mail an Schophuis, und Sie bekommen eine Bestätigung.', { betreff: form.dataset.betreff || 'Anfrage' });
      });
    });
  }

  function start() { hero(); betriebe(); privat(); einfach(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
