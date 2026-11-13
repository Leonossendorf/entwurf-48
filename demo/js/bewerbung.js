/* Karriere: Bewerbungsformular in jeder Stelle. Entwurf: es wird nichts versendet, die Angaben lassen sich als Mail oeffnen. */
(function () {
  'use strict';
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function kopiere(text, knopf) {
    var alt = knopf.textContent;
    function fertig() { knopf.textContent = 'Kopiert'; setTimeout(function () { knopf.textContent = alt; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(fertig, function () { ersatz(); }); } else ersatz();
    function ersatz() {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); fertig(); } catch (e) { /* ohne Zwischenablage bleibt der Text sichtbar */ }
      document.body.removeChild(t);
    }
  }

  function formular(bw) {
    var form = bw.querySelector('form'), box = bw.querySelector('.bw-danke'), fehler = bw.querySelector('.bw-fehler');
    $$('.bw-chips', form).forEach(function (g) {
      g.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var an = b.getAttribute('aria-pressed') === 'true';
        $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', an ? 'false' : 'true');
      });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name.value.trim(), kontakt = form.elements.kontakt.value.trim();
      fehler.hidden = !!(name && kontakt);
      if (!name) { form.elements.name.focus(); return; }
      if (!kontakt) { form.elements.kontakt.focus(); return; }
      var zl = [['Stelle', form.dataset.stelle]];
      $$('.bw-chips', form).forEach(function (g) {
        var b = g.querySelector('button[aria-pressed="true"]');
        if (b) zl.push([g.dataset.titel, b.textContent.trim()]);
      });
      zl.push(['Name', name], ['Rückmeldung an', kontakt]);
      $$('input[data-titel]', form).forEach(function (i) {
        if (i.type === 'file') { if (i.files && i.files.length) zl.push([i.dataset.titel, Array.prototype.map.call(i.files, function (f) { return f.name; }).join(', ')]); }
        else if (i.value.trim()) zl.push([i.dataset.titel, i.value.trim()]);
      });
      var n = form.elements.nachricht.value.trim();
      if (n) zl.push(['Nachricht', n]);
      var text = 'Bewerbung über die Website\n\n' + zl.map(function (x) { return x[0] + ': ' + x[1]; }).join('\n') + '\n';
      box.innerHTML = '<p class="bw-danke-titel">So kommt deine Bewerbung an</p>' +
        '<p class="bw-entwurf-gross">Entwurf: Es wurde nichts versendet. In der fertigen Website geht die Bewerbung per E-Mail an Schophuis, und du bekommst eine Bestätigung.</p>' +
        '<dl>' + zl.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl>' +
        '<div class="bw-mail"><a class="bw-knopf" href="mailto:?subject=' + encodeURIComponent('Bewerbung: ' + form.dataset.stelle) + '&body=' + encodeURIComponent(text.slice(0, 1700)) + '">Als E-Mail senden &gt;</a>' +
        '<button type="button" class="bw-link bw-kopie">Text kopieren</button>' +
        '<button type="button" class="bw-link bw-zurueck">Bewerbung bearbeiten</button></div>' +
        '<p class="bw-klein">In dieser Demo öffnet sich dein Mailprogramm ohne Empfänger und ohne Anhang.</p>';
      form.hidden = true; box.hidden = false; box.focus({ preventScroll: true });
      box.querySelector('.bw-zurueck').addEventListener('click', function () { box.hidden = true; form.hidden = false; });
      box.querySelector('.bw-kopie').addEventListener('click', function () { kopiere(text, this); });
      bw.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Direktlink: /karriere/#bewerben-geselle klappt die Stelle auf und springt zum Formular
  function oeffne() {
    var id = location.hash.slice(1);
    if (id.indexOf('bewerben-') !== 0) return;
    var bw = document.getElementById(id); if (!bw) return;
    var teil = bw.closest('.advgb-accordion-item'), kopf = teil && teil.querySelector('.advgb-accordion-header');
    if (kopf && bw.offsetHeight === 0) kopf.click();
    setTimeout(function () { bw.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 450);
  }

  function start() {
    $$('.bw').forEach(formular);
    window.addEventListener('hashchange', oeffne);
    window.addEventListener('load', function () { setTimeout(oeffne, 300); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
