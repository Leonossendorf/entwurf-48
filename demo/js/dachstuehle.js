/* Unterseite Dachstuehle: drei Bauarten als drehbares Modell und Anfrage-Formular. */
(function () {
  'use strict';
  var H = window.Holz, z = H.zahl;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var TEXT = {
    pfetten: ['Pfettendach', 'Die Sparren liegen auf Pfetten, die Pfetten auf Pfosten mit Kopfbändern. Zangen halten jedes Gebinde zusammen. Die häufigste Bauart, auch für große Häuser, Gauben und Anbauten.'],
    kehl: ['Kehlbalkendach', 'Je zwei Sparren und ein Kehlbalken bilden ein steifes Dreieck. Der Raum darunter bleibt frei von Stützen, der Kehlbalken wird zur Decke des ausgebauten Dachgeschosses.'],
    pult: ['Pultdach', 'Eine einzige geneigte Fläche. Die Sparren liegen auf einer niedrigen und einer hohen Pfette. Beliebt bei Anbauten, Hallen und modernen Häusern mit Photovoltaik.']
  };
  var d = { typ: 'pfetten', viewer: null, erst: true, warte: 0 };

  function bau(animiert) {
    var b = +$('#ds-breite').value, l = +$('#ds-laenge').value, n = +$('#ds-neigung').value;
    $('#ds-breite-wert').textContent = z(b / 1000, 2) + ' m'; $('#ds-laenge-wert').textContent = z(l / 1000, 2) + ' m'; $('#ds-neigung-wert').textContent = n + '°';
    var m = H.dachstuhl({ typ: d.typ, breite: b, laenge: l, neigung: n }), k = H.kennzahlen(m.teile);
    if (d.viewer) d.viewer.laden(m, { animiert: !!animiert, kamera: animiert || d.erst, drehen: true });
    d.erst = false;
    var first = d.viewer ? d.viewer.box.getSize(new THREE.Vector3()).y : 0;
    $('#ds-kpi').innerHTML = [['Holzteile', z(k.teile)], ['Laufmeter', z(k.lfm, 0) + ' m'], ['Holz', z(k.m3, 1) + ' m³'], ['Sparren', z(m.zeilen.filter(function (r) { return r.name === 'Sparren'; }).reduce(function (a, r) { return a + r.anzahl; }, 0))], ['Höhe Tragwerk', z(first, 2) + ' m'], ['Dachfläche, etwa', z(dachflaeche(b, l, n), 0) + ' m²']]
      .map(function (p) { return '<div><b>' + p[1] + '</b><span>' + p[0] + '</span></div>'; }).join('');
  }
  function dachflaeche(b, l, n) {
    var cos = Math.cos(n * Math.PI / 180), ue = 500;
    return d.typ === 'pult' ? ((b + ue * 1.6) / cos) * l / 1e6 : 2 * ((b / 2 + ue) / cos) * l / 1e6;
  }
  function typ(t) {
    d.typ = t;
    $('#ds-text').innerHTML = '<h3>' + TEXT[t][0] + '</h3><p>' + TEXT[t][1] + '</p>';
    var r = $('#ds-neigung');
    if (t === 'pult') { r.min = 5; r.max = 25; if (+r.value > 25) r.value = 12; } else { r.min = 25; r.max = 50; if (+r.value < 25) r.value = 38; }
    d.erst = true; bau(true);
  }

  function formen() {
    var buehne = $('#ds-buehne'); if (!buehne) return;
    function los() {
      if (d.viewer) return;
      try { d.viewer = new Holz3D(buehne, {}); d.viewer.controls.enableZoom = false; } catch (e) { buehne.textContent = 'Die 3D-Vorschau braucht einen aktuellen Browser.'; }
      typ('pfetten');
    }
    if ('IntersectionObserver' in window) { var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); los(); } }, { rootMargin: '300px' }); io.observe(buehne); } else los();
    $('#ds-typ').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $$('#ds-typ button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      typ(b.dataset.typ);
    });
    ['breite', 'laenge', 'neigung'].forEach(function (n) {
      $('#ds-' + n).addEventListener('input', function () { if (d.warte) return; d.warte = requestAnimationFrame(function () { d.warte = 0; bau(false); }); });
    });
  }

  function formular() {
    var form = $('#ds-form'); if (!form) return;
    $$('.la-chips', form).forEach(function (g) {
      g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = form.kontakt.value.trim();
      $('#ds-fehler').hidden = !!kontakt;
      if (!kontakt) { form.kontakt.focus(); return; }
      var art = $$('.la-chips button[aria-pressed="true"]', form).map(function (b) { return b.dataset.wert; }).join('');
      var zl = [['Anliegen', esc(art)]];
      if (form.name.value) zl.push(['Name', esc(form.name.value)]);
      if (form.ort.value) zl.push(['Ort', esc(form.ort.value)]);
      zl.push(['Rückmeldung an', esc(kontakt)]);
      if (form.nachricht.value) zl.push(['Nachricht', esc(form.nachricht.value)]);
      var box = $('#ds-danke');
      box.innerHTML = '<h3>So kommt die Anfrage an</h3><p class="la-entwurf la-entwurf-gross">Entwurf: Es wurde nichts versendet. In der fertigen Website geht die Anfrage per E-Mail an Schophuis, und Sie bekommen eine Bestätigung.</p><dl class="la-dl">' +
        zl.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl><p><button type="button" class="la-link-hell">Anfrage bearbeiten</button></p>';
      form.hidden = true; box.hidden = false; box.focus();
      box.querySelector('button').addEventListener('click', function () { box.hidden = true; form.hidden = false; });
    });
  }

  function start() { formen(); formular(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
