/* Leistungsseiten von Schophuis: Schichtenmodell in 3D (three.js r128), Auswahl-Helfer, Dach-Check, Anfrage.
   Die Daten je Seite stehen als JSON in <script type="application/json" data-ls-daten>. */
(function () {
  'use strict';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var RUHIG = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================================
     Schichtenmodell: ein Stück Dach, Wand oder Boden, Schicht für Schicht aufgeschnitten.
     Flaeche in Metern: u = quer, v = nach hinten/oben, w = Dicke. Jede Schicht beginnt eine Stufe weiter hinten,
     so bleibt die Schicht darunter vorn sichtbar.
     ===================================================================== */
  function Schichten(wurzel, daten) {
    var self = this;
    this.wurzel = wurzel; this.daten = daten; this.vi = 0; this.wahl = -1;
    wurzel.innerHTML =
      (daten.varianten.length > 1 ? '<div class="la-chips ls-varianten" role="group" aria-label="Ausführung">' + daten.varianten.map(function (v, i) {
        return '<button type="button" aria-pressed="' + (i ? 'false' : 'true') + '" data-v="' + i + '">' + esc(v.name) + '</button>'; }).join('') + '</div>' : '') +
      '<div class="ls-modell-raster"><div><div class="la-buehne ls-buehne"></div><p class="la-tipp">' + esc(daten.tipp || 'Ziehen dreht das Modell. Tippen Sie eine Schicht an.') + '</p></div>' +
      '<div><p class="ls-von">' + esc(daten.von || 'Von außen nach innen') + '</p><ol class="ls-schichten"></ol></div></div>';
    this.buehne = $('.ls-buehne', wurzel); this.liste = $('.ls-schichten', wurzel);
    $$('.ls-varianten button', wurzel).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.ls-varianten button', wurzel).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        self.vi = +b.dataset.v; self.wahl = -1; self.bau(true);
      });
    });
    this.liste.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      self.waehle(+b.dataset.k === self.wahl ? -1 : +b.dataset.k);
    });
    if (!window.THREE) { this.buehne.hidden = true; this.listeFuellen(); return; }
    this.drei();
    this.bau(false);
  }

  Schichten.prototype.listeFuellen = function () {
    var s = this.daten.varianten[this.vi].schichten, h = [], n = s.length;
    for (var k = n - 1; k >= 0; k--) {
      h.push('<li><button type="button" data-k="' + k + '" aria-expanded="false"><i style="background:' + esc(s[k].farbe || '#ccc') + '"></i><b>' + (n - k) + '</b><span>' + esc(s[k].n) + '</span></button><p hidden>' + esc(s[k].t) + '</p></li>');
    }
    this.liste.innerHTML = h.join('');
  };

  Schichten.prototype.drei = function () {
    var self = this, el = this.buehne;
    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(r.domElement);
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', '3D-Modell: der Aufbau in Schichten');
    r.domElement.style.touchAction = 'pan-y';
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7355, 0.8));
    var sonne = this.sonne = new THREE.DirectionalLight(0xfff1d6, 0.95);
    sonne.castShadow = true; sonne.shadow.mapSize.set(2048, 2048); sonne.shadow.bias = -0.0006;
    this.scene.add(sonne); this.scene.add(sonne.target);
    this.boden = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.28 }));
    this.boden.rotation.x = -Math.PI / 2; this.boden.receiveShadow = true; this.scene.add(this.boden);
    this.dreh = new THREE.Group(); this.scene.add(this.dreh);
    this.winkel = 0; this.zielWinkel = 0;
    // Drehen: waagerecht ziehen. Senkrecht wischen rollt weiter die Seite.
    var dom = r.domElement, unten = null, bewegt = false;
    dom.addEventListener('pointerdown', function (e) { unten = { x: e.clientX, y: e.clientY, w: self.zielWinkel }; bewegt = false; self.selbst = true; });
    window.addEventListener('pointermove', function (e) {
      if (!unten) return;
      var dx = e.clientX - unten.x;
      if (Math.abs(dx) + Math.abs(e.clientY - unten.y) > 6) bewegt = true;
      self.zielWinkel = Math.max(-1.15, Math.min(1.15, unten.w + dx / Math.max(dom.clientWidth, 1) * 2.4));
      self.los();
    });
    window.addEventListener('pointerup', function (e) {
      if (unten && !bewegt) self.tippe(e);
      unten = null;
    });
    window.addEventListener('pointercancel', function () { unten = null; });
    this.ray = new THREE.Raycaster(); this.maus = new THREE.Vector2();
    if (window.ResizeObserver) new ResizeObserver(function () { self.groesse(); }).observe(el);
    window.addEventListener('resize', function () { self.groesse(); });
    this.sichtbar = false;
    if (window.IntersectionObserver) new IntersectionObserver(function (es) {
      es.forEach(function (x) { self.sichtbar = x.isIntersecting; if (x.isIntersecting) { if (!self.gestartet) { self.gestartet = true; self.start = performance.now(); } self.los(); } });
    }, { threshold: 0.25 }).observe(el); else { this.sichtbar = true; this.gestartet = true; this.start = performance.now(); }
  };

  Schichten.prototype.groesse = function () {
    var w = this.buehne.clientWidth || 300, h = this.buehne.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.kamera(); this.los();
  };

  Schichten.prototype.kamera = function () {
    if (!this.box) return;
    var m = this.box.getCenter(new THREE.Vector3()), g = this.box.getSize(new THREE.Vector3());
    var fov = this.camera.fov * Math.PI / 180, rad = g.length() / 2;
    var eng = Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect));
    var dist = rad / Math.sin(eng / 2) * (this.nah || 0.84);
    var ri = this.blick || [-0.5, 0.52, 1];
    this.camera.position.copy(m).add(new THREE.Vector3(ri[0], ri[1], ri[2]).normalize().multiplyScalar(dist));
    this.camera.lookAt(m);
  };

  /* ---------- Bausteine ---------- */
  function stoff(farbe, opt) {
    opt = opt || {};
    return new THREE.MeshStandardMaterial({ color: new THREE.Color(farbe).convertSRGBToLinear(), roughness: opt.rau == null ? 0.86 : opt.rau, metalness: opt.metall || 0, transparent: true, opacity: 1, side: THREE.DoubleSide });
  }
  function quader(g, u1, u2, v1, v2, w1, w2, mat, kanten) {
    if (u2 - u1 < 0.004 || v2 - v1 < 0.004) return null;
    var geo = new THREE.BoxGeometry(u2 - u1, w2 - w1, v2 - v1);
    var me = new THREE.Mesh(geo, mat);
    me.position.set((u1 + u2) / 2, (w1 + w2) / 2, -(v1 + v2) / 2);
    me.castShadow = true; me.receiveShadow = true;
    if (kanten !== false) {
      var km = g.userData.kante || (g.userData.kante = new THREE.LineBasicMaterial({ color: 0x1c1a14, transparent: true, opacity: 0.4 }));
      me.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), km));
    }
    g.add(me); return me;
  }
  function zufall(seed) { var x = seed; return function () { x = (x * 16807 + 11) % 2147483647; return (x % 100000) / 100000; }; }

  /* Eine Schicht bauen; gibt ihre Dicke zurueck. Bedeckt u von u0 bis B und v von v0 bis L, ab Hoehe w. */
  function schicht(g, s, u0, B, v0, L, w) {
    var mat = stoff(s.farbe, { rau: s.rau, metall: s.metall }), mats = g.userData.mats = [mat], x, y, i, pos = [], rnd = zufall(7 + Math.round(w * 1000));
    function balkenlage(b, abstand) { var p = []; for (var q = b / 2 + 0.02; q <= B - b / 2 + 1e-6; q += abstand) p.push(q); return p; }
    if (s.typ === 'platte') { quader(g, u0, B, v0, L, w, w + s.d, mat); return s.d; }
    if (s.typ === 'sparren') {
      pos = balkenlage(s.b, s.abstand);
      pos.forEach(function (q) { if (q + s.b / 2 > u0 + 0.01) quader(g, Math.max(q - s.b / 2, u0), q + s.b / 2, v0, L, w, w + s.h, mat); });
      if (s.fuell) {
        var m2 = stoff(s.fuell, { rau: 1 }); mats.push(m2);
        for (i = 0; i < pos.length - 1; i++) {
          var a = pos[i] + s.b / 2, b = pos[i + 1] - s.b / 2;
          if (b > u0 + 0.05) quader(g, Math.max(a, u0 + (s.zurueckU || 0)), b, v0 + (s.zurueckV || 0), L, w, w + s.h * (s.fuellh || 0.94), m2, false);
        }
      }
      return s.h;
    }
    if (s.typ === 'latten') {
      if (s.r === 'v') balkenlage(s.b, s.abstand).forEach(function (q) { if (q + s.b / 2 > u0 + 0.01) quader(g, Math.max(q - s.b / 2, u0), q + s.b / 2, v0, L, w, w + s.h, mat); });
      else for (y = v0 + 0.06; y <= L - 0.03; y += s.abstand) quader(g, u0, B, y - s.b / 2, y + s.b / 2, w, w + s.h, mat);
      return s.h;
    }
    if (s.typ === 'dielen') {
      if (s.r === 'v') for (x = u0; x < B - 0.01; x += s.b + s.fuge) quader(g, x, Math.min(x + s.b, B), v0, L, w, w + s.d, mat);
      else for (y = v0; y < L - 0.01; y += s.b + s.fuge) quader(g, u0, B, y, Math.min(y + s.b, L), w, w + s.d, mat);
      return s.d;
    }
    if (s.typ === 'ziegel') {
      // Deckmass 34 cm, Ziegel 30 cm breit und 42 cm lang, jede Reihe liegt auf der Reihe darunter auf
      var dl = 0.34, zb = 0.3, lang = 0.42, dick = 0.024, al = Math.atan(dick * 1.25 / lang);
      for (y = v0; y < L - 0.02; y += dl) for (x = u0; x < B - 0.02; x += zb) {
        var br = Math.min(zb, B - x) - 0.006, geo = new THREE.BoxGeometry(br, dick, lang);
        var zm = mat.clone(); zm.color.offsetHSL(0, 0, (rnd() - 0.5) * 0.045); mats.push(zm);
        var me = new THREE.Mesh(geo, zm);
        me.position.set(x + br / 2 + 0.003, w + dick / 2 + lang / 2 * Math.sin(al), -(y + lang / 2 - 0.08));
        me.rotation.x = -al; me.castShadow = true; me.receiveShadow = true;
        me.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), g.userData.kante || (g.userData.kante = new THREE.LineBasicMaterial({ color: 0x1c1a14, transparent: true, opacity: 0.4 }))));
        g.add(me);
      }
      return dick * 2 + 0.012;
    }
    if (s.typ === 'kies' || s.typ === 'pflanzen') {
      // viele kleine Koerper auf einer duennen Lage
      var kies = s.typ === 'kies', grund = kies ? 0.012 : 0.004;
      quader(g, u0, B, v0, L, w, w + grund, mat, false);
      var fl = (B - u0) * (L - v0), zahl = Math.round(fl * (kies ? 260 : 150));
      var kg = kies ? new THREE.DodecahedronGeometry(1, 0) : new THREE.IcosahedronGeometry(1, 0);
      var km = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 1 }); mats.push(km);
      var im = new THREE.InstancedMesh(kg, km, zahl), mx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), fa = new THREE.Color(), farben = s.farben || [s.farbe];
      for (i = 0; i < zahl; i++) {
        var rad = kies ? 0.016 + rnd() * 0.014 : 0.03 + rnd() * 0.04;
        q4.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3));
        mx.compose(new THREE.Vector3(u0 + 0.03 + rnd() * (B - u0 - 0.06), w + grund + rad * (kies ? 0.7 : 0.55), -(v0 + 0.03 + rnd() * (L - v0 - 0.06))), q4, new THREE.Vector3(rad, rad * (kies ? 0.75 : 0.7), rad));
        im.setMatrixAt(i, mx);
        fa.set(farben[Math.floor(rnd() * farben.length)]); fa.offsetHSL(0, 0, (rnd() - 0.5) * 0.1); fa.convertSRGBToLinear(); im.setColorAt(i, fa);
      }
      im.castShadow = true; im.receiveShadow = true; g.add(im);
      return kies ? 0.05 : 0.07;
    }
    return 0;
  }

  Schichten.prototype.bau = function (neu) {
    this.listeFuellen();
    if (!this.renderer) return;
    var v = this.daten.varianten[this.vi], wand = v.lage === 'wand', flach = v.lage === 'flach', B = flach ? 1.6 : 2.4, L = wand ? 1.7 : (flach ? 2.1 : 3.7), n = v.schichten.length, self = this;
    var stufe = Math.min(0.5, (wand ? B : L) * 0.66 / Math.max(n - 1, 1));
    while (this.dreh.children.length) this.dreh.remove(this.dreh.children[0]);
    var kipp = new THREE.Group(), feld = new THREE.Group(), w = 0;
    this.lagen = [];
    v.schichten.forEach(function (s, k) {
      var g = new THREE.Group(); g.userData.k = k;
      w += schicht(g, s, wand ? k * stufe : 0, B, wand ? 0 : k * stufe, L, w);
      g.traverse(function (o) { o.userData.k = k; });
      feld.add(g); self.lagen.push(g);
    });
    feld.position.set(-B / 2, 0, L / 2);
    kipp.add(feld);
    kipp.rotation.x = (wand ? 90 : (v.neigung == null ? 35 : v.neigung)) * Math.PI / 180;
    this.dreh.add(kipp);
    this.nah = flach ? 0.6 : 0.84;
    this.blick = wand ? [-1.25, 0.42, 1] : (flach ? [-0.7, 0.95, 1] : [-0.6, 0.34, 1]);
    this.dreh.rotation.y = 0; this.dreh.updateMatrixWorld(true);
    this.box = new THREE.Box3().setFromObject(this.dreh);
    var m = this.box.getCenter(new THREE.Vector3()), d = this.box.getSize(new THREE.Vector3()).length();
    this.boden.position.set(m.x, this.box.min.y - 0.01, m.z);
    this.sonne.position.set(m.x - d * 0.5, this.box.max.y + d * 1.1, m.z + d * 0.9); this.sonne.target.position.copy(m);
    var sc = this.sonne.shadow.camera; sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 0.05; sc.far = d * 5; sc.updateProjectionMatrix();
    this.dicke = w;
    if (neu || this.gestartet) this.start = performance.now();
    this.winkel = this.zielWinkel = 0;
    this.groesse();
    this.waehle(-1);
  };

  Schichten.prototype.waehle = function (k) {
    this.wahl = k;
    $$('button', this.liste).forEach(function (b) {
      var an = +b.dataset.k === k; b.setAttribute('aria-expanded', an ? 'true' : 'false'); b.nextElementSibling.hidden = !an;
    });
    this.los();
  };
  Schichten.prototype.tippe = function (e) {
    var r = this.renderer.domElement.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    this.maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.maus, this.camera);
    var t = this.ray.intersectObjects(this.dreh.children, true).filter(function (x) { return x.object.isMesh; });
    if (t.length) { var k = t[0].object.userData.k; this.waehle(k === this.wahl ? -1 : k); }
  };

  Schichten.prototype.los = function () {
    var self = this;
    if (this.laeuft || !this.renderer) return;
    this.laeuft = true;
    (function schritt() {
      var weiter = self.bild();
      if (weiter && self.sichtbar) requestAnimationFrame(schritt); else self.laeuft = false;
    })();
  };
  Schichten.prototype.bild = function () {
    var jetzt = performance.now(), t = this.gestartet ? jetzt - this.start : 0, weiter = false, n = this.lagen.length, self = this;
    this.lagen.forEach(function (g, k) {
      // Aufbau: Schicht fuer Schicht faellt von oben ein
      var p = RUHIG || !self.gestartet ? 1 : Math.min(1, Math.max(0, (t - 250 - k * 330) / 620));
      if (p < 1) weiter = true;
      var e = 1 - Math.pow(1 - p, 3), ziel = (self.wahl < 0 || self.wahl === k ? 1 : 0.13) * e;
      g.position.y = (1 - e) * 0.7 + (self.wahl === k ? 0.02 : 0);
      g.userData.mats.forEach(function (m) {
        if (Math.abs(m.opacity - ziel) > 0.01) { m.opacity += (ziel - m.opacity) * 0.22; weiter = true; } else m.opacity = ziel;
        m.depthWrite = m.opacity > 0.5;
      });
      if (g.userData.kante) g.userData.kante.opacity = 0.4 * (g.userData.mats[0].opacity);
      g.traverse(function (o) { if (o.isMesh) o.castShadow = g.userData.mats[0].opacity > 0.5; });
      g.visible = e > 0.001;
    });
    if (Math.abs(this.zielWinkel - this.winkel) > 0.001) { this.winkel += (this.zielWinkel - this.winkel) * 0.2; weiter = true; }
    // ohne Zutun wiegt sich das Modell ganz leicht, damit man die Tiefe sieht
    var wiegen = RUHIG || this.selbst ? 0 : Math.sin(jetzt / 2600) * 0.12;
    if (wiegen) weiter = true;
    this.dreh.rotation.y = this.winkel + wiegen;
    this.renderer.render(this.scene, this.camera);
    return weiter;
  };

  /* =====================================================================
     Auswahl-Helfer: Knoepfe oben, Text und Liste darunter
     ===================================================================== */
  function wahl(wurzel, daten) {
    wurzel.innerHTML = '<div class="la-chips ls-wahl-chips" role="group">' + daten.punkte.map(function (p, i) {
      return '<button type="button" aria-pressed="' + (i ? 'false' : 'true') + '" data-i="' + i + '">' + esc(p.name) + '</button>'; }).join('') + '</div><div class="ls-wahl-feld" aria-live="polite"></div>';
    var feld = $('.ls-wahl-feld', wurzel);
    function zeige(i) {
      var p = daten.punkte[i];
      feld.innerHTML = (p.farben ? '<div class="ls-muster"><div style="background:' + p.farben[0] + '"><span>neu</span></div><div style="background:' + p.farben[1] + '"><span>' + esc(p.spaeter || 'nach Jahren') + '</span></div></div>' : '') +
        '<div class="ls-wahl-text"><p class="ls-wahl-kurz">' + esc(p.kurz) + '</p><p>' + esc(p.text) + '</p>' +
        (p.liste ? '<ul>' + p.liste.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        (p.link ? '<p><a class="la-knopf la-knopf-hell" href="' + esc(p.link[0]) + '">' + esc(p.link[1]) + ' &gt;</a></p>' : '') + '</div>';
      feld.classList.toggle('ls-mit-muster', !!p.farben);
    }
    wurzel.addEventListener('click', function (e) {
      var b = e.target.closest('.ls-wahl-chips button'); if (!b) return;
      $$('.ls-wahl-chips button', wurzel).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      zeige(+b.dataset.i);
    });
    zeige(0);
  }

  /* =====================================================================
     Dach-Check: Fragen mit Ja und Nein, das Ergebnis aendert sich sofort
     ===================================================================== */
  function check(wurzel, daten) {
    var antw = daten.fragen.map(function () { return null; });
    wurzel.innerHTML = '<ol class="ls-check-fragen">' + daten.fragen.map(function (f, i) {
      return '<li><span>' + esc(f.f) + '</span><div class="la-chips" role="group" aria-label="' + esc(f.f) + '"><button type="button" aria-pressed="false" data-i="' + i + '" data-a="1">Ja</button><button type="button" aria-pressed="false" data-i="' + i + '" data-a="0">Nein</button></div></li>'; }).join('') +
      '</ol><div class="ls-check-ergebnis" aria-live="polite"></div>';
    var erg = $('.ls-check-ergebnis', wurzel);
    function zeige() {
      var offen = antw.filter(function (a) { return a === null; }).length, punkte = 0, eilig = false;
      antw.forEach(function (a, i) { if (a) { punkte += daten.fragen[i].p || 1; if (daten.fragen[i].eilig) eilig = true; } });
      if (offen === antw.length) { erg.innerHTML = '<p class="ls-check-leer">' + esc(daten.leer) + '</p>'; return; }
      var e = eilig ? daten.ergebnis[2] : (punkte > 0 ? daten.ergebnis[1] : daten.ergebnis[0]);
      if (!punkte && offen) { erg.innerHTML = '<p class="ls-check-leer">Noch ' + offen + (offen === 1 ? ' Frage' : ' Fragen') + '.</p>'; return; }
      erg.innerHTML = '<p class="ls-check-wort">' + esc(e.wort) + '</p><p>' + esc(e.text) + '</p><p><a class="la-knopf la-knopf-hell" href="#anfrage" data-ls-anfrage="' + esc(e.anliegen) + '">' + esc(e.knopf) + ' &gt;</a></p>';
    }
    wurzel.addEventListener('click', function (e) {
      var b = e.target.closest('.ls-check-fragen button'); if (!b) return;
      antw[+b.dataset.i] = b.dataset.a === '1';
      $$('button', b.parentNode).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      zeige();
    });
    zeige();
  }

  /* =====================================================================
     Anfrage: der grosse Knopf am Ende klappt das Formular auf
     ===================================================================== */
  function anfrage() {
    var form = $('#ls-form'); if (!form) return;
    var box = $('#ls-danke'), huelle = $('#ls-form-huelle');
    function auf(anliegen) {
      huelle.hidden = false;
      if (anliegen) $$('.la-chips button', form).forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.wert === anliegen ? 'true' : 'false'); });
      setTimeout(function () { huelle.scrollIntoView({ behavior: RUHIG ? 'auto' : 'smooth', block: 'center' }); var f = form.elements.name; if (f) f.focus({ preventScroll: true }); }, 30);
    }
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href="#anfrage"]'); if (!a) return;
      e.preventDefault(); auf(a.dataset.lsAnfrage);
    });
    $$('.la-chips', form).forEach(function (g) {
      g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; $$('button', g).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var kontakt = form.kontakt.value.trim();
      $('#ls-fehler').hidden = !!kontakt;
      if (!kontakt) { form.kontakt.focus(); return; }
      var art = $$('.la-chips button[aria-pressed="true"]', form).map(function (b) { return b.dataset.wert; }).join('');
      var zl = [['Seite', esc(form.dataset.seite)], ['Anliegen', esc(art)]];
      if (form.name.value) zl.push(['Name', esc(form.name.value)]);
      if (form.ort.value) zl.push(['Ort', esc(form.ort.value)]);
      zl.push(['Rückmeldung an', esc(kontakt)]);
      if (form.nachricht.value) zl.push(['Nachricht', esc(form.nachricht.value)]);
      box.innerHTML = '<h3>So kommt die Anfrage an</h3><p class="la-entwurf la-entwurf-gross">Entwurf: Es wurde nichts versendet. In der fertigen Website geht die Anfrage per E-Mail an Schophuis, und Sie bekommen eine Bestätigung.</p><dl class="la-dl">' +
        zl.map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + x[1] + '</dd>'; }).join('') + '</dl><p><button type="button" class="la-link-hell">Anfrage bearbeiten</button></p>';
      form.hidden = true; box.hidden = false; box.focus();
      box.querySelector('button').addEventListener('click', function () { box.hidden = true; form.hidden = false; });
    });
  }

  function start() {
    var d = $('script[data-ls-daten]'), wurzel = $('[data-ls-modul]');
    if (d && wurzel) {
      var daten = JSON.parse(d.textContent);
      if (daten.typ === 'schichten') new Schichten(wurzel, daten);
      else if (daten.typ === 'wahl') wahl(wurzel, daten);
      else if (daten.typ === 'check') check(wurzel, daten);
    }
    anfrage();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
