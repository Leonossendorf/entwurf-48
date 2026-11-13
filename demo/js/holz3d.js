/* Holz3D: 3D-Vorschau fuer Holzbauteile (three.js r128, global THREE).
   Modell: { teile: [ { tri: Float32Array (Dreiecke, lokal, mm), m: number[16] (lokal -> Welt, mm, Z oben), ...} ] } */
(function () {
  'use strict';

  var HOLZ = [0xd8a866, 0xcf9d5a, 0xe1b676, 0xc9944f, 0xd5a362, 0xdcae6e];
  var PALETTE = [0x779e00, 0xd08a2e, 0x2f7f9e, 0xb5483a, 0x6a5acd, 0x3f9b6b, 0xc2a400, 0x8c5a2b, 0x4f6d7a, 0xa23b72];

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function Holz3D(el, opt) {
    opt = opt || {};
    this.el = el;
    this.onHover = opt.onHover || function () {};
    this.onSelect = opt.onSelect || function () {};
    this.meshes = [];
    this.kanten = [];
    this.farbmodus = 'holz';
    this.explosion = 0;
    this.markiert = -1;
    this.hover = -1;
    this.start = 0;
    this.reduziert = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding;
    el.appendChild(r.domElement);
    r.domElement.setAttribute('role', 'img');
    r.domElement.setAttribute('aria-label', '3D-Vorschau der Bauteile');

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.01, 2000);
    this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotateSpeed = 0.9;
    var self = this;
    this.controls.addEventListener('start', function () { self.controls.autoRotate = false; });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7355, 0.85));
    var sonne = this.sonne = new THREE.DirectionalLight(0xfff3dc, 0.95);
    sonne.castShadow = true;
    sonne.shadow.mapSize.set(2048, 2048);
    sonne.shadow.bias = -0.0005;
    this.scene.add(sonne);
    this.scene.add(sonne.target);

    this.boden = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.22 }));
    this.boden.rotation.x = -Math.PI / 2;
    this.boden.receiveShadow = true;
    this.scene.add(this.boden);

    // Modell liegt in mm mit Z nach oben; Gruppe dreht es in die three.js-Welt (Y oben) und rechnet in Meter um
    this.gruppe = new THREE.Group();
    this.gruppe.rotation.x = -Math.PI / 2;
    this.gruppe.scale.setScalar(0.001);
    this.scene.add(this.gruppe);

    this.ray = new THREE.Raycaster();
    this.maus = new THREE.Vector2();
    var dom = r.domElement, bewegt = false, unten = null;
    var finger = null;
    dom.style.touchAction = 'pan-y';
    ['touchstart', 'touchmove', 'touchend'].forEach(function (n) {
      el.addEventListener(n, function (e) { e.stopPropagation(); }, { capture: true, passive: true });
    });
    dom.addEventListener('pointermove', function (e) {
      if (unten && (Math.abs(e.clientX - unten[0]) + Math.abs(e.clientY - unten[1]) > 6)) bewegt = true;
      if (finger && e.pointerId === finger.id) {
        var dx = e.clientX - finger.x; finger.x = e.clientX;
        if (self.drehbar !== false) self.dreheUm(-dx / Math.max(dom.clientWidth, 1) * Math.PI);
        return;
      }
      self._zeigeAuf(e);
    });
    dom.addEventListener('pointerdown', function (e) {
      unten = [e.clientX, e.clientY]; bewegt = false;
      if (e.pointerType === 'touch') { finger = { id: e.pointerId, x: e.clientX }; self.controls.autoRotate = false; }
    });
    dom.addEventListener('pointercancel', function () { finger = null; unten = null; });
    dom.addEventListener('pointerup', function (e) {
      if (!bewegt && unten) { self._zeigeAuf(e); self.onSelect(self.hover); }
      if (finger) { self._setHover(-1); }
      unten = null; finger = null;
    });
    dom.addEventListener('pointerleave', function () { self._setHover(-1); });

    if (window.ResizeObserver) { new ResizeObserver(function () { self.resize(); }).observe(el); }
    window.addEventListener('resize', function () { self.resize(); });
    this.resize();
    if (Holz3D.alle) Holz3D.alle.push(this);
    this._lauf = true;
    (function loop(zeit) {
      if (!self._lauf) return;
      requestAnimationFrame(loop);
      self._tick(zeit || 0);
    })();
  }

  Holz3D.prototype.resize = function () {
    var w = this.el.clientWidth || 300, h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  Holz3D.prototype.leeren = function () {
    var g = this.gruppe;
    while (g.children.length) {
      var c = g.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    this.meshes = []; this.kanten = []; this.markiert = -1; this.hover = -1;
  };

  /* teile[i].tri + teile[i].m ; opt.animiert, opt.drehen */
  Holz3D.prototype.laden = function (modell, opt) {
    opt = opt || {};
    this.leeren();
    var teile = modell.teile, mitKanten = teile.length <= 900, i;
    var keys = {};
    for (i = 0; i < teile.length; i++) {
      var t = teile[i];
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(t.tri, 3));
      geo.computeVertexNormals();
      geo.computeBoundingBox();
      var mat = new THREE.MeshStandardMaterial({ color: HOLZ[i % HOLZ.length], roughness: 0.78, metalness: 0, transparent: true, opacity: 1, side: THREE.DoubleSide });
      var mesh = new THREE.Mesh(geo, mat);
      var mx = new THREE.Matrix4().fromArray(t.m);
      mesh.applyMatrix4(mx);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.i = i;
      mesh.userData.zeile = t.zeile == null ? i : t.zeile;
      mesh.userData.ziel = mesh.position.clone();
      // Schwerpunkt in Modellkoordinaten fuer Aufbau-Reihenfolge und Explosion
      var c = geo.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mx);
      mesh.userData.mitte = c;
      var k = t.qkey || '';
      if (!(k in keys)) keys[k] = Object.keys(keys).length;
      mesh.userData.qi = keys[k];
      mesh.userData.nb = t.nb || 0;
      this.gruppe.add(mesh);
      this.meshes.push(mesh);
      if (mitKanten) {
        var ls = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 24), new THREE.LineBasicMaterial({ color: 0x4a3620, transparent: true, opacity: 0.55 }));
        mesh.add(ls);
        this.kanten.push(ls);
      }
    }
    // Rahmen
    this.gruppe.updateMatrixWorld(true);
    var box = this.box = new THREE.Box3().setFromObject(this.gruppe);
    if (box.isEmpty()) { box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)); }
    var groesse = box.getSize(new THREE.Vector3()), mitte = box.getCenter(new THREE.Vector3());
    var d = this.diag = Math.max(groesse.length(), 0.2);
    // Modellmitte (in mm, Modellraum) fuer Explosion
    var bm = new THREE.Box3();
    for (i = 0; i < this.meshes.length; i++) bm.expandByPoint(this.meshes[i].userData.mitte);
    this.modellMitte = bm.getCenter(new THREE.Vector3());
    this.zMin = bm.min.z; this.zSpanne = Math.max(bm.max.z - bm.min.z, 1);
    this.boden.scale.set(d * 6, d * 6, 1);
    this.boden.position.set(mitte.x, box.min.y - 0.002, mitte.z);
    this.sonne.position.set(mitte.x + d * 0.7, box.max.y + d * 1.1, mitte.z + d * 0.9);
    this.sonne.target.position.copy(mitte);
    var sc = this.sonne.shadow.camera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 0.01; sc.far = d * 5;
    sc.updateProjectionMatrix();
    this.controls.target.copy(mitte);
    this.camera.near = d / 200; this.camera.far = d * 40;
    if (opt.kamera !== false) {
      this.ansicht('iso', true);
      this.controls.autoRotate = opt.drehen !== false && !this.reduziert;
    }
    this.controls.minDistance = d * 0.15; this.controls.maxDistance = d * 6;
    this.setFarbmodus(this.farbmodus);
    this.setExplosion(0);
    this.animiert = opt.animiert !== false && !this.reduziert;
    this.start = performance.now();
    if (this.animiert) for (i = 0; i < this.meshes.length; i++) this.meshes[i].material.opacity = 0;
  };

  Holz3D.prototype.ansicht = function (name, sofort) {
    var b = this.box; if (!b) return;
    var m = b.getCenter(new THREE.Vector3()), g = b.getSize(new THREE.Vector3());
    var fov = this.camera.fov * Math.PI / 180;
    var r = g.length() / 2;
    var dist = r / Math.sin(Math.min(fov, 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect)) / 2) * 1.05;
    var ri = { iso: [0.72, 0.42, 0.62], vorn: [0, 0.05, 1], seite: [1, 0.05, 0], oben: [0.001, 1, 0.001] }[name] || [0.72, 0.42, 0.62];
    var v = new THREE.Vector3(ri[0], ri[1], ri[2]).normalize().multiplyScalar(dist);
    this.camera.position.copy(m).add(v);
    this.controls.target.copy(m);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  };

  Holz3D.prototype.setFarbmodus = function (modus) {
    this.farbmodus = modus;
    var maxNb = 1, i;
    for (i = 0; i < this.meshes.length; i++) maxNb = Math.max(maxNb, this.meshes[i].userData.nb);
    for (i = 0; i < this.meshes.length; i++) {
      var me = this.meshes[i], c;
      if (modus === 'querschnitt') c = new THREE.Color(PALETTE[me.userData.qi % PALETTE.length]);
      else if (modus === 'bearbeitung') {
        var f = me.userData.nb / maxNb;
        c = new THREE.Color().setHSL(0.24 - 0.24 * f, 0.62, 0.62 - 0.14 * f);
      } else c = new THREE.Color(HOLZ[i % HOLZ.length]);
      me.userData.farbe = c;
      me.material.color.copy(c);
    }
    this._emissiv();
  };

  Holz3D.prototype.setExplosion = function (f) {
    this.explosion = f;
    var mm = this.modellMitte; if (!mm) return;
    for (var i = 0; i < this.meshes.length; i++) {
      var me = this.meshes[i], v = me.userData.mitte.clone().sub(mm).multiplyScalar(f * 0.9);
      me.userData.versatz = v;
      if (!this.animiert || performance.now() - this.start > 2600) me.position.copy(me.userData.ziel).add(v);
    }
  };

  Holz3D.prototype.markiere = function (zeile) { this.markiert = zeile == null ? -1 : zeile; this._emissiv(); };
  Holz3D.prototype._setHover = function (zeile) {
    if (zeile === this.hover) return;
    this.hover = zeile; this._emissiv(); this.onHover(zeile);
    this.renderer.domElement.style.cursor = zeile >= 0 ? 'pointer' : 'grab';
  };
  Holz3D.prototype._emissiv = function () {
    var wahl = this.markiert >= 0;
    for (var i = 0; i < this.meshes.length; i++) {
      var me = this.meshes[i], z = me.userData.zeile, an = wahl && z === this.markiert, hv = z === this.hover;
      if (an) { me.material.color.setHex(0xff7a00); me.material.emissive.setHex(0x8a3200); }
      else { if (me.userData.farbe) me.material.color.copy(me.userData.farbe); me.material.emissive.setHex(hv ? 0x5a3c12 : 0x000000); }
      var blass = wahl && !an;
      if (!this.animiert) me.material.opacity = blass ? 0.14 : 1;
      me.material.depthWrite = !blass;
      me.castShadow = !blass;
      me.renderOrder = an ? 2 : (blass ? 1 : 0);
      var k = me.children[0];
      if (k) { if (!this.animiert) k.material.opacity = blass ? 0.1 : (an ? 1 : 0.55); k.material.color.setHex(an ? 0x2a0f00 : 0x4a3620); }
    }
  };
  /* Kamera waagerecht um das Modell drehen (Handy: Wischen) */
  Holz3D.prototype.dreheUm = function (winkel) {
    var ziel = this.controls.target, v = this.camera.position.clone().sub(ziel);
    v.applyAxisAngle(new THREE.Vector3(0, 1, 0), winkel);
    this.camera.position.copy(ziel).add(v);
  };
  Holz3D.prototype._zeigeAuf = function (e) {
    var r = this.renderer.domElement.getBoundingClientRect();
    this.maus.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.maus, this.camera);
    var treffer = this.ray.intersectObjects(this.meshes, false);
    this._setHover(treffer.length ? treffer[0].object.userData.zeile : -1);
  };

  Holz3D.prototype._tick = function (zeit) {
    if (this.animiert && this.meshes.length) {
      var t = performance.now() - this.start, dauer = 700, gesamt = 1500, fertig = true;
      var fall = (this.diag || 1) * 1000 * 0.35;
      for (var i = 0; i < this.meshes.length; i++) {
        var me = this.meshes[i];
        var rang = (me.userData.mitte.z - this.zMin) / this.zSpanne; // unten zuerst
        var p = Math.min(1, Math.max(0, (t - rang * gesamt) / dauer));
        if (p < 1) fertig = false;
        var k = easeOut(p);
        me.material.opacity = k;
        me.position.copy(me.userData.ziel);
        if (me.userData.versatz) me.position.add(me.userData.versatz);
        me.position.z += (1 - k) * fall;
        if (me.children[0]) me.children[0].material.opacity = 0.55 * k;
      }
      if (fertig) { this.animiert = false; this._emissiv(); }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  Holz3D.prototype.bild = function () {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  };

  Holz3D.prototype.stopp = function () { this._lauf = false; };
  Holz3D.PALETTE = PALETTE;
  Holz3D.alle = [];
  window.Holz3D = Holz3D;
})();
