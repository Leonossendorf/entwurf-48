/* Allgemeines fuer alle Seiten der Demo: Startbilder (frueher Slider-Plugin) und klickbare Kacheln. */
(function () {
  'use strict';
  var STUFEN = [1240, 1024, 778, 480];

  function px(v, s, bezug, ersatz) {
    if (v === null || v === undefined || v === 'auto') return ersatz;
    if (typeof v === 'number') return v * s;
    if (typeof v === 'string' && v.indexOf('%') > 0) return bezug * parseFloat(v) / 100;
    return ersatz;
  }

  // Wie im Original: das Startbild reicht immer ueber die ganze Seitenbreite, auch wenn es in einem schmaleren Kasten steckt.
  function volleBreite(hero) {
    var rahmen = document.querySelector('.wp-site-blocks') || document.documentElement;
    var r = rahmen.getBoundingClientRect();
    hero.style.setProperty('max-width', 'none', 'important');
    hero.style.setProperty('margin-left', '0px', 'important');
    hero.style.setProperty('margin-right', '0px', 'important');
    hero.style.width = rahmen.clientWidth + 'px';
    var links = hero.getBoundingClientRect().left;
    hero.style.setProperty('margin-left', (r.left - links) + 'px', 'important');
  }

  function heroLage(hero) {
    volleBreite(hero);
    var gw = JSON.parse(hero.dataset.gw), gh = JSON.parse(hero.dataset.gh);
    var ww = window.innerWidth, l = 3;
    for (var i = 0; i < STUFEN.length; i++) { if (ww >= STUFEN[i]) { l = i; break; } }
    var cw = hero.clientWidth, s = Math.min(1, cw / gw[l]), H = gh[l] * s, gl = (cw - gw[l] * s) / 2;
    hero.style.height = Math.round(H) + 'px';
    var ebenen = hero.querySelectorAll('.sh-ebene');
    for (var k = 0; k < ebenen.length; k++) {
      var el = ebenen[k];
      if (!el._d) el._d = JSON.parse(el.dataset.l);
      var d = el._d, e = d.e[l], slide = d.base === 'slide';
      var bw = slide ? cw : gw[l] * s, bx = slide ? 0 : gl;
      var ratio = d.iw > 0 && d.ih > 0 ? d.ih / d.iw : 0;
      var w = px(e.w, s, cw, null), h = px(e.h, s, H, null);
      if (w === null && h === null) { w = d.iw * s; h = d.ih * s; }
      else if (w === null) { w = ratio ? h / ratio : d.iw * s; }
      else if (h === null) { h = ratio ? w * ratio : d.ih * s; }
      var xo = (typeof e.xo === 'number' ? e.xo : 0) * s, yo = (typeof e.yo === 'number' ? e.yo : 0) * s;
      var x = e.ax === 'c' ? bx + (bw - w) / 2 + xo : (e.ax === 'r' ? bx + bw - w - xo : bx + xo);
      var y = e.ay === 'm' ? (H - h) / 2 + yo : (e.ay === 'b' ? H - h - yo : yo);
      x += (typeof e.fx === 'number' ? e.fx : 0) * s;
      y += (typeof e.fy === 'number' ? e.fy : 0) * s;
      el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px';
      el.style.width = w.toFixed(1) + 'px'; el.style.height = h.toFixed(1) + 'px';
      if (!el._zeit) {
        el._zeit = 1;
        el.style.transitionDelay = (parseInt(el.dataset.st, 10) || 0) + 'ms';
        el.style.transitionDuration = Math.max(500, parseInt(el.dataset.sp, 10) || 600) + 'ms';
      }
    }
  }

  function heros() {
    var alle = document.querySelectorAll('.sh-hero');
    if (!alle.length) return;
    function lage() { for (var i = 0; i < alle.length; i++) heroLage(alle[i]); }
    lage();
    window.addEventListener('resize', lage);
    window.addEventListener('load', lage);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (ein) {
        ein.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('sh-da'); io.unobserve(x.target); } });
      }, { threshold: 0.15 });
      for (var i = 0; i < alle.length; i++) io.observe(alle[i]);
    } else { for (var j = 0; j < alle.length; j++) alle[j].classList.add('sh-da'); }
  }

  // Die Einblend-Animation der alten Seite zeigt ein Element nur, wenn seine Oberkante beim Rollen durchs Bild laeuft.
  // Bei einem Sprung (Direktlink, Anker) bliebe es unsichtbar. Darum hier zusaetzlich: sichtbar, sobald es im Bild ist.
  function einblenden() {
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (ein) {
      ein.forEach(function (x) {
        if (!x.isIntersecting) return;
        var el = x.target; io.unobserve(el);
        if (!el.classList.contains('hidden-animated')) return;
        (el.animationClasses || []).forEach(function (c) { el.classList.add(c); });
        el.animationClasses = [];
        el.classList.remove('hidden-animated');
      });
    }, { rootMargin: '0px 0px -5% 0px' });
    function sammeln() { var a = document.querySelectorAll('.hidden-animated'); for (var i = 0; i < a.length; i++) io.observe(a[i]); }
    window.addEventListener('load', function () { setTimeout(sammeln, 80); setTimeout(sammeln, 1200); });
  }

  function kacheln() {
    var k = document.querySelectorAll('[data-href]');
    for (var i = 0; i < k.length; i++) {
      (function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.closest('a')) return;
          window.location.href = el.getAttribute('data-href');
        });
      })(k[i]);
    }
  }

  function menue() {
    var pfad = window.location.pathname.replace(/index[.]html$/, '');
    var links = document.querySelectorAll('.wp-block-navigation-item__content');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href') || '';
      if (h.length > 1 && pfad.indexOf(h.replace(/\/$/, '')) === 0) links[i].setAttribute('aria-current', 'page');
    }
  }

  function lade(liste, fertig) {
    if (!liste.length) return fertig();
    var s = document.createElement('script');
    s.src = liste[0]; s.onload = function () { lade(liste.slice(1), fertig); };
    document.head.appendChild(s);
  }
  function modellKacheln() {
    var k = document.querySelectorAll('.demo-kachel-3d');
    if (!k.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (ein) {
      ein.forEach(function (x) {
        if (!x.isIntersecting) return;
        io.unobserve(x.target);
        lade(['/demo/vendor/three.min.js', '/demo/vendor/OrbitControls.js', '/demo/js/holz3d.js', '/demo/js/generator.js'], function () {
          try {
            var v = new Holz3D(x.target, {});
            v.controls.enabled = false;
            v.laden(Holz.dachstuhl({ breite: 8000, laenge: 9000, neigung: 40 }), {});
          } catch (e) { x.target.style.display = 'none'; }
        });
      });
    }, { rootMargin: '200px' });
    for (var i = 0; i < k.length; i++) io.observe(k[i]);
  }

  function start() { heros(); kacheln(); menue(); modellKacheln(); einblenden(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
