/* Holz.lese(file): liest hochgeladene Dateien im Browser. Nichts verlaesst den Rechner.
   Formate: Hundegger BVX (XML), SEMA-Projekt (ZIP-Archiv mit Textdateien), BTLx, dazu DXF, IFC, PDF und Fotos als Beilage.
   Ergebnis: { art: 'modell' | 'dokument' | 'unbekannt', format, datei:{name,groesse}, modell?, hinweise:[], details:{} } */
(function () {
  'use strict';
  var Holz = window.Holz = window.Holz || {};
  var V3 = THREE.Vector3;

  function endung(name) { var m = /[.]([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }
  function alsText(buf) {
    var u8 = new Uint8Array(buf);
    if (u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    if (u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8);
    var t = new TextDecoder('utf-8').decode(u8);
    if (t.indexOf('�') >= 0 && t.slice(0, 200).indexOf('encoding="UTF-8"') < 0) t = new TextDecoder('windows-1252').decode(u8);
    return t.charCodeAt(0) === 0xFEFF ? t.slice(1) : t;
  }
  function num(x) { if (x == null) return NaN; var v = parseFloat(String(x).replace(',', '.')); return isFinite(v) ? v : NaN; }

  /* ---------- ZIP: Inhaltsverzeichnis lesen, einzelne Dateien bei Bedarf entpacken ---------- */
  function zipLesen(buf) {
    var dv = new DataView(buf), u8 = new Uint8Array(buf), i = buf.byteLength - 22;
    while (i >= 0 && dv.getUint32(i, true) !== 0x06054b50) i--;
    if (i < 0) throw new Error('Kein gültiges ZIP-Archiv');
    var n = dv.getUint16(i + 10, true), p = dv.getUint32(i + 16, true), eintraege = [];
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var meth = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true), us = dv.getUint32(p + 24, true), nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
      var name = new TextDecoder('utf-8').decode(u8.subarray(p + 46, p + 46 + nl));
      eintraege.push({ name: name.replace(/\\/g, '/'), meth: meth, cs: cs, us: us, off: off });
      p += 46 + nl + el + cl;
    }
    function lies(e) {
      var lo = e.off, nl2 = dv.getUint16(lo + 26, true), el2 = dv.getUint16(lo + 28, true), start = lo + 30 + nl2 + el2;
      var roh = u8.subarray(start, start + e.cs);
      if (e.meth === 0) return Promise.resolve(roh.slice().buffer);
      if (e.meth !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('Dieses Archiv kann der Browser nicht entpacken'));
      return new Response(new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
    }
    return { eintraege: eintraege, lies: lies };
  }

  /* ---------- kleine XML-Helfer ---------- */
  function kinder(el, name) { var o = []; for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) o.push(c); return o; }
  function kind(el, name) { for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; }
  function nach(el, name) { var a = el.getElementsByTagName('*'), o = []; for (var i = 0; i < a.length; i++) if (a[i].localName === name) o.push(a[i]); return o; }

  /* ---------- Flaechen -> Dreiecke ---------- */
  /* Vieleck (auch nicht konvex, mit Loechern) in seiner Ebene in Dreiecke zerlegen. punkte, loecher: Arrays von THREE.Vector3 */
  function vieleckDreiecke(punkte, loecher, out) {
    if (punkte.length < 3) return;
    if (punkte.length === 3 && !(loecher && loecher.length)) { punkte.forEach(function (p) { out.push(p.x, p.y, p.z); }); return; }
    var nrm = new V3();
    for (var a = 0; a < punkte.length; a++) { var c = punkte[a], d = punkte[(a + 1) % punkte.length]; nrm.x += (c.y - d.y) * (c.z + d.z); nrm.y += (c.z - d.z) * (c.x + d.x); nrm.z += (c.x - d.x) * (c.y + d.y); }
    if (nrm.lengthSq() < 1e-18) return;
    nrm.normalize();
    var ex = Math.abs(nrm.x) < 0.9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
    ex.addScaledVector(nrm, -ex.dot(nrm)).normalize();
    var ey = new V3().crossVectors(nrm, ex);
    function flach(q) { return new THREE.Vector2(q.dot(ex), q.dot(ey)); }
    var gut = (loecher || []).filter(function (l) { return l.length >= 3; });
    var k2 = punkte.map(flach), l2 = gut.map(function (l) { return l.map(flach); });
    var alle = punkte.slice(); gut.forEach(function (l) { alle = alle.concat(l); });
    var tri;
    try { tri = THREE.ShapeUtils.triangulateShape(k2, l2); } catch (e) { return; }
    for (var t = 0; t < tri.length; t++) for (var e2 = 0; e2 < 3; e2++) { var q = alle[tri[t][e2]]; out.push(q.x, q.y, q.z); }
  }

  /* ================= BTLx ================= */
  function flaechenDreiecke(ifs) {
    var co = kind(ifs, 'Coordinate'); if (!co) return null;
    var pts = (co.getAttribute('point') || '').trim().split(/[\s,]+/).map(Number);
    var idx = (ifs.getAttribute('coordIndex') || '').trim().split(/[\s,]+/).map(Number);
    var out = [], poly = [];
    function P(i) { return new V3(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2]); }
    for (var j = 0; j <= idx.length; j++) {
      if (j === idx.length || idx[j] === -1) { vieleckDreiecke(poly.map(P), null, out); poly = []; }
      else if (!isNaN(idx[j])) poly.push(idx[j]);
    }
    return out.length ? new Float32Array(out) : null;
  }
  function vek(el, name) { var e = el && kind(el, name); return e ? new V3(num(e.getAttribute('X')) || 0, num(e.getAttribute('Y')) || 0, num(e.getAttribute('Z')) || 0) : null; }
  function guete(p) {
    var g = p.getAttribute('TimberGrade') || p.getAttribute('QualityGrade') || '', m = p.getAttribute('Material') || '';
    return g && m.indexOf(g) >= 0 ? '' : g;
  }

  function leseBTLx(doc) {
    var root = doc.documentElement, teile = [], hinweise = [];
    var proj = nach(root, 'Project')[0], parts = [];
    nach(root, 'Parts').forEach(function (ps) { kinder(ps, 'Part').forEach(function (p) { parts.push(p); }); });
    var roh = 0; nach(root, 'Rawparts').forEach(function (rs) { roh += kinder(rs, 'Rawpart').length; });
    var ohneLage = 0;
    parts.forEach(function (p, i) {
      var L = num(p.getAttribute('Length')) || 0, H = num(p.getAttribute('Height')) || 0, W = num(p.getAttribute('Width')) || 0;
      var anzahl = parseInt(p.getAttribute('Count'), 10) || 1;
      var bearb = [], pr = kind(p, 'Processings');
      if (pr) for (var c = pr.firstElementChild; c; c = c.nextElementSibling) if (c.getAttribute('Process') !== 'no') bearb.push(c.localName);
      var tri = null, sh = kind(p, 'Shape'), ifs = sh && nach(sh, 'IndexedFaceSet')[0];
      if (ifs) { try { tri = flaechenDreiecke(ifs); } catch (e) { tri = null; } }
      var form = !!tri;
      if (!tri) tri = Holz.quader(L, H, W);
      var trs = [], tw = kind(p, 'Transformations');
      if (tw) kinder(tw, 'Transformation').forEach(function (t) {
        var pos = kind(t, 'Position'), o = vek(pos, 'ReferencePoint'), x = vek(pos, 'XVector'), y = vek(pos, 'YVector');
        if (o && x && y && x.lengthSq() > 0 && y.lengthSq() > 0) {
          x.normalize(); y.normalize();
          var z = new V3().crossVectors(x, y).normalize(); y = new V3().crossVectors(z, x);
          trs.push(new THREE.Matrix4().makeBasis(x, y, z).setPosition(o).toArray());
        }
      });
      if (!trs.length) { trs.push(null); ohneLage++; }
      var basis = {
        nr: p.getAttribute('SingleMemberNumber') || String(i + 1), name: p.getAttribute('Designation') || p.getAttribute('Annotation') || 'Bauteil',
        material: p.getAttribute('Material') || '', guete: guete(p), gruppe: p.getAttribute('Group') || p.getAttribute('Storey') || '',
        L: L, B: W, H: H, bearb: bearb, form: form
      };
      trs.forEach(function (m, ti) { teile.push(Object.assign({}, basis, { tri: tri, m: m, anzahl: ti === 0 ? Math.max(1, anzahl - (trs.length - 1)) : 1 })); });
    });
    if (ohneLage) { teile = vervielfache(teile); legeAus(teile.filter(function (t) { return !t.m; })); }
    if (ohneLage && ohneLage < parts.length) hinweise.push(ohneLage + ' Teile ohne Lage im Bauwerk, sie liegen neben dem Modell.');
    if (ohneLage === parts.length && parts.length) hinweise.push('Die Datei enthält keine Lage der Teile im Bauwerk. Die Teile werden nebeneinander gezeigt.');
    var e = nach(root, 'InitialExportProgram')[0];
    var mitForm = teile.filter(function (t) { return t.form; }).length;
    return {
      quelle: 'btlx', format: 'BTLx ' + (root.getAttribute('Version') || ''), name: (proj && proj.getAttribute('Name')) || '', teile: teile, zeilen: Holz.gruppieren(teile), hinweise: hinweise,
      formText: mitForm === teile.length ? 'Alle ' + teile.length + ' Teile mit genauer Form und Lage im Bauwerk' : (mitForm ? mitForm + ' von ' + teile.length + ' Teilen mit genauer Form, der Rest als Balken aus Länge und Querschnitt' : ''),
      details: { rohteile: roh, programm: e ? [e.getAttribute('CompanyName'), e.getAttribute('ProgramName'), e.getAttribute('ProgramVersion')].filter(Boolean).join(' ') : '' }
    };
  }

  /* Stueckzahl > 1 ohne eigene Lage: jedes Stueck einzeln auslegen (hoechstens 600 Stueck in der Vorschau) */
  function vervielfache(alle) {
    var neu = [], gesamt = alle.length;
    alle.forEach(function (t) {
      neu.push(t);
      if (t.m || !(t.anzahl > 1)) return;
      var n = Math.min(t.anzahl - 1, Math.max(0, 600 - gesamt));
      t.anzahl -= n; gesamt += n;
      for (var i = 0; i < n; i++) neu.push(Object.assign({}, t, { anzahl: 1 }));
    });
    return neu;
  }
  /* Teile ohne Lage nebeneinander auslegen (nach Querschnitt sortiert, wie ein Holzstapel auf dem Hof) */
  function legeAus(teile) {
    var s = teile.slice().sort(function (a, b) { return (b.B * b.H) - (a.B * a.H) || b.L - a.L; });
    var y = 0, zeileH = 0, x = 0, maxL = 0;
    s.forEach(function (t) { maxL = Math.max(maxL, t.L); });
    var breite = Math.max(maxL * 1.1, 4000);
    s.forEach(function (t) {
      if (x > 0 && x + t.L > breite) { x = 0; y += zeileH + 120; zeileH = 0; }
      t.m = new THREE.Matrix4().makeBasis(new V3(1, 0, 0), new V3(0, 0, 1), new V3(0, -1, 0)).setPosition(new V3(x, y + t.B, 0)).toArray();
      x += t.L + 200; zeileH = Math.max(zeileH, t.B);
    });
  }
  Holz.legeAus = legeAus;

  /* ================= Hundegger BVX =================
     Aufbau an drei echten Dateien aus SEMA und Cambium ermittelt (BVX 2.1):
     Job > Parts > RectangularPart (DimensionX = Laenge, DimensionY, DimensionZ, ReqQuantity, Grade)
       > CADPositionList > CADPosition: Lage im Bauwerk (P0 = Ursprung, V1 = Laengsachse, V2 = Y-Achse des Teils)
       > Operations: SawCut, Step, Mortise, Tenon, BirdsMouth ... jeweils bezogen auf eine der vier Laengsseiten (FrameId 1 bis 4)
     Job > Nestings: Rohholz mit den darin liegenden Teilen. */
  function quaderFlaechen(L, Y, Z) {
    var P = [], f = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++) P.push(new V3(xi * L, yi * Y, zi * Z));
    return f.map(function (q) { return q.map(function (i) { return P[i]; }); });
  }
  /* konvexen Koerper an einer Ebene abschneiden: behalten wird n.(p - p0) >= 0 */
  function schneide(flaechen, p0, n) {
    var eps = 1e-6, neu = [], schnitt = [], d0 = n.dot(p0);
    flaechen.forEach(function (poly) {
      var d = poly.map(function (p) { return n.dot(p) - d0; }), out = [], m = poly.length;
      for (var i = 0; i < m; i++) {
        var a = poly[i], b = poly[(i + 1) % m], da = d[i], db = d[(i + 1) % m];
        if (da >= -eps) out.push(a);
        if ((da > eps && db < -eps) || (da < -eps && db > eps)) { var s = a.clone().lerp(b, da / (da - db)); out.push(s); schnitt.push(s); }
        else if (Math.abs(da) <= eps) schnitt.push(a);
      }
      if (out.length >= 3) neu.push(out);
    });
    if (schnitt.length >= 3) {
      var c = new V3(); schnitt.forEach(function (s) { c.add(s); }); c.multiplyScalar(1 / schnitt.length);
      var u = null;
      for (var k = 0; k < schnitt.length && !u; k++) { var v = schnitt[k].clone().sub(c); if (v.length() > 1e-4) u = v.normalize(); }
      if (u) {
        var w = new V3().crossVectors(n, u);
        var winkel = function (a) { var q = a.clone().sub(c); return Math.atan2(q.dot(w), q.dot(u)); };
        var pts = schnitt.slice().sort(function (a, b) { return winkel(a) - winkel(b); });
        var ein = [pts[0]];
        for (var j = 1; j < pts.length; j++) if (pts[j].distanceTo(ein[ein.length - 1]) > 1e-4) ein.push(pts[j]);
        if (ein.length >= 3 && ein[0].distanceTo(ein[ein.length - 1]) < 1e-4) ein.pop();
        if (ein.length >= 3) neu.push(ein);
      }
    }
    return neu;
  }
  /* Punkt oder Richtung aus dem Bezugssystem einer Laengsseite (FrameId) ins Teil umrechnen */
  function ausRahmen(k, Y, Z, x, y, z, richtung) {
    if (k === 2) return richtung ? new V3(x, -z, y) : new V3(x, Y - z, y);
    if (k === 3) return richtung ? new V3(x, -y, -z) : new V3(x, Y - y, Z - z);
    if (k === 4) return richtung ? new V3(x, z, -y) : new V3(x, z, Z - y);
    return new V3(x, y, z);
  }
  var BVX_ZEICHEN = { Marking: 1, TextOutput: 1 };
  var BVX_KEINE_OP = { CADPositionList: 1, FrameBox: 1, Frames: 1, MetaInfoList: 1 };

  function leseBVX(doc) {
    var job = doc.documentElement, teile = [], hinweise = [], zeichen = 0, ohneLage = 0, anzTypen = 0;
    var parts = kind(job, 'Parts');
    kinder(parts || job).forEach(function (p, pi) {
      var L = num(p.getAttribute('DimensionX')), Y = num(p.getAttribute('DimensionY')), Z = num(p.getAttribute('DimensionZ'));
      if (!(L > 0 && Y > 0 && Z > 0)) return;
      anzTypen++;
      var menge = parseInt(p.getAttribute('ReqQuantity'), 10) || 1, bearb = [], fl = quaderFlaechen(L, Y, Z);
      var ops = kind(p, 'Operations');
      kinder(ops || p).forEach(function (op) {
        var name = op.localName;
        if (BVX_KEINE_OP[name]) return;
        if (BVX_ZEICHEN[name] || (name === 'Contour' && /MRK/.test(op.getAttribute('Tool') || ''))) { zeichen++; return; }
        bearb.push(name);
        if (name === 'SawCut') {
          var k = parseInt(op.getAttribute('FrameId'), 10) || 1;
          var by = (num(op.getAttribute('RotationY')) || 0) * Math.PI / 180, gz = -(num(op.getAttribute('RotationZ')) || 0) * Math.PI / 180;
          var n = ausRahmen(k, Y, Z, Math.sin(by) * Math.cos(gz), Math.sin(by) * Math.sin(gz), Math.cos(by), true);
          var p0 = ausRahmen(k, Y, Z, num(op.getAttribute('X')) || 0, num(op.getAttribute('Y')) || 0, num(op.getAttribute('Z')) || 0, false);
          var neu = schneide(fl, p0, n);
          if (neu.length >= 4) fl = neu;
        }
      });
      var out = [];
      fl.forEach(function (poly) { for (var i = 1; i + 1 < poly.length; i++) out.push(poly[0].x, poly[0].y, poly[0].z, poly[i].x, poly[i].y, poly[i].z, poly[i + 1].x, poly[i + 1].y, poly[i + 1].z); });
      var tri = new Float32Array(out), lagen = [], cl = kind(p, 'CADPositionList');
      if (cl) kinder(cl, 'CADPosition').forEach(function (c) {
        var v1 = new V3(num(c.getAttribute('V1x')), num(c.getAttribute('V1y')), num(c.getAttribute('V1z'))), v2 = new V3(num(c.getAttribute('V2x')), num(c.getAttribute('V2y')), num(c.getAttribute('V2z')));
        var o = new V3(num(c.getAttribute('P0x')) || 0, num(c.getAttribute('P0y')) || 0, num(c.getAttribute('P0z')) || 0);
        if (isFinite(v1.lengthSq()) && isFinite(v2.lengthSq()) && v1.lengthSq() > 0 && v2.lengthSq() > 0) lagen.push(new THREE.Matrix4().makeBasis(v1, v2, new V3().crossVectors(v1, v2)).setPosition(o).toArray());
      });
      if (!lagen.length) { lagen.push(null); ohneLage++; }
      var basis = {
        nr: p.getAttribute('PartNo') || String(pi + 1), name: p.getAttribute('Name') || 'Bauteil', material: p.getAttribute('Material') || '', guete: p.getAttribute('Grade') || '',
        gruppe: '', L: L, B: Z, H: Y, bearb: bearb, form: true, tri: tri
      };
      lagen.forEach(function (m, li) { teile.push(Object.assign({}, basis, { m: m, anzahl: li === 0 ? Math.max(1, menge - (lagen.length - 1)) : 1 })); });
    });
    if (ohneLage) { teile = vervielfache(teile); legeAus(teile.filter(function (t) { return !t.m; })); hinweise.push('Einige Teile haben keine Lage im Bauwerk. Sie liegen neben dem Modell.'); }
    // Rohholz aus den Nestings
    var roh = {}, rohStk = 0, rohLfm = 0;
    // Nur Dateien aus Cambium enthalten die echte Einteilung auf Stangen. Im Export aus dem CAD steht je Bauteil nur ein Platzhalter.
    (job.getAttribute('ProgVersion') ? nach(job, 'RawRectangularPart') : []).forEach(function (r) {
      var L = num(r.getAttribute('DimensionX')), Y = num(r.getAttribute('DimensionY')), Z = num(r.getAttribute('DimensionZ')), n = 1;
      if (!(L > 0)) return;
      var g = r.getAttribute('Grade') || '', key = Math.min(Y, Z) + '|' + Math.max(Y, Z) + '|' + Math.round(L) + '|' + g;
      if (!roh[key]) roh[key] = { B: Math.min(Y, Z), H: Math.max(Y, Z), L: L, guete: g, anzahl: 0 };
      roh[key].anzahl += n; rohStk += n; rohLfm += L * n / 1000;
    });
    var rohListe = Object.keys(roh).map(function (k) { return roh[k]; }).sort(function (a, b) { return (b.B * b.H) - (a.B * a.H) || b.L - a.L; });
    var cad = [job.getAttribute('CADVendor'), job.getAttribute('CADVersion')].filter(Boolean).join(' ');
    return {
      quelle: 'bvx', format: 'Hundegger BVX ' + (job.getAttribute('BvxVersion') || ''), name: '', teile: teile, zeilen: Holz.gruppieren(teile), hinweise: hinweise,
      formText: 'Alle ' + teile.length + ' Stücke mit Lage im Bauwerk. Die Form folgt den Sägeschnitten. Kerven, Zapfen und Blätter sind gezählt, aber nicht ausgeschnitten.',
      details: {
        programm: cad, cambium: job.getAttribute('ProgVersion') || '', positionen: anzTypen, zeichen: zeichen, rohholz: rohListe, rohStk: rohStk, rohLfm: rohLfm,
        lautCambium: job.getAttribute('CubicMeter') ? { m3: num(job.getAttribute('CubicMeter')), lfm: num(job.getAttribute('ReqLinMeter')), stk: parseInt(job.getAttribute('ReqQuantity'), 10) } : null
      }
    };
  }

  /* ================= SEMA-Projekt =================
     Ein SEMA-Projekt ist ein ZIP-Archiv mit Textdateien (SEM_HEAD.INI, DATA_00_00/...). Holzbauteile stehen als Block "HLZBTL"
     mit einem Koerper "CSGBTL": Volumen, Achsen (CSGVEC) und alle Flaechen als Vielecke in Metern, Loecher eingeschlossen. */
  var PKT = /\(\s*(-?[\d.]+(?:[eE][-+]?\d+)?)\s*,\s*(-?[\d.]+(?:[eE][-+]?\d+)?)\s*,\s*(-?[\d.]+(?:[eE][-+]?\d+)?)\s*\)/g;
  function punkte(s) { var o = [], m; PKT.lastIndex = 0; while ((m = PKT.exec(s))) o.push(new V3(+m[1] * 1000, +m[2] * 1000, +m[3] * 1000)); return o; }
  var SEMA_TYP = { 2: 'Sparren', 5: 'Gratsparren', 20: 'Pfette', 21: 'Pfette', 25: 'Zange', 32: 'Pfosten' };
  var SEMA_DATEI = { SPR: 'Sparren', PFT: 'Pfette', PST: 'Pfosten', ZNG: 'Zange', BLG: 'Balken', AFH: 'Wandholz', H3D: 'Holz' };

  function semaTeile(text, datei, teile) {
    var z = text.split(/\r?\n/), n = z.length, akt = null, csg = null, fl = null, modus = null, ziel = 'pts';
    for (var i = 0; i < n; i++) {
      var s = z[i].trim();
      if (s === 'HLZBTL') { akt = { datei: datei, csg: [], mula: {}, f: {} }; teile.push(akt); csg = null; continue; }
      if (!akt) continue;
      if (s === 'CSGBTL') { csg = { flaechen: [], vol: 0, vec: null }; akt.csg.push(csg); modus = null; fl = null; continue; }
      if (s === 'CSGEND') { csg = null; continue; }
      if (csg) {
        if (s.lastIndexOf('VOLUME', 0) === 0) csg.vol = parseFloat(s.split(/\s+/)[1]) || 0;
        else if (s.lastIndexOf('CSGVEC', 0) === 0) csg.vec = punkte(s + ' ' + (z[i + 1] || '') + ' ' + (z[i + 2] || ''));
        else if (s.lastIndexOf('CSGAFLEND', 0) === 0) modus = null;
        else if (s.lastIndexOf('CSGAFL', 0) === 0) modus = 'afl';
        else if (s.lastIndexOf('CSGAMK', 0) === 0) modus = 'amk';
        else if (modus === 'afl' && s.lastIndexOf('CSGN', 0) === 0) { fl = { pts: null, loecher: [] }; csg.flaechen.push(fl); ziel = 'pts'; }
        else if (modus === 'afl' && s.lastIndexOf('LOECHER', 0) === 0) ziel = 'loch';
        else if (modus === 'afl' && fl && s.lastIndexOf('PKTANZ', 0) === 0) {
          var roh = '';
          for (i++; i < n && z[i].trim() !== 'PKTEND'; i++) roh += ' ' + z[i];
          var pts = punkte(roh);
          if (ziel === 'pts' && !fl.pts) fl.pts = pts; else fl.loecher.push(pts);
        }
        continue;
      }
      var m = /^"([^"=]+)=([^"]*)"$/.exec(s);
      if (m) { if (!(m[1] in akt.mula)) akt.mula[m[1]] = m[2]; continue; }
      m = /^(TYP|ETYP)\s*=\s*(\S+)/.exec(s);
      if (m) { if (!(m[1] in akt.f)) akt.f[m[1]] = m[2]; continue; }
      m = /^GUID\s+"(\{[^"]+\})"/.exec(s);
      if (m && !akt.guid) akt.guid = m[1];
    }
  }

  function semaModell(roh, kopf) {
    var teile = [], weg = 0;
    roh.forEach(function (r) {
      var c = r.csg.filter(function (x) { return x.flaechen.length >= 4; })[0];
      if (!c) return;
      var gruppe = r.mula['sGN_1#7'] || '';
      if (r.f.ETYP === '60' || /^(Fenster|Tür)/.test(gruppe)) { weg++; return; }   // Fenster und Tueren gehoeren nicht zum Abbund
      var out = [], alle = [];
      c.flaechen.forEach(function (f) { if (f.pts) { vieleckDreiecke(f.pts, f.loecher, out); alle = alle.concat(f.pts); } });
      if (!out.length) return;
      // Masse aus der Form: Ausdehnung entlang der Bauteilachsen
      var v1 = c.vec && c.vec[1] ? c.vec[1].clone().normalize() : new V3(1, 0, 0), v2 = c.vec && c.vec[2] ? c.vec[2].clone().normalize() : new V3(0, 1, 0);
      var v3 = new V3().crossVectors(v1, v2).normalize();
      function spanne(v) { var a = Infinity, b = -Infinity; alle.forEach(function (p) { var d = p.dot(v); if (d < a) a = d; if (d > b) b = d; }); return b - a; }
      var L = spanne(v1), q1 = spanne(v2), q2 = spanne(v3);
      teile.push({
        nr: '', name: r.mula['5050#7'] || SEMA_TYP[r.f.TYP] || SEMA_DATEI[r.datei.slice(0, 3).toUpperCase()] || 'Holz', material: '', guete: r.mula['5100#7'] || '', gruppe: gruppe,
        L: Math.round(L), B: Math.round(Math.min(q1, q2)), H: Math.round(Math.max(q1, q2)), bearb: [], form: true, vol: c.vol,
        tri: new Float32Array(out), m: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], anzahl: 1
      });
    });
    var name = (/^2_INHALT=(.*)$/m.exec(kopf || '') || [])[1] || '', version = (/^L_VERSION=(.*)$/m.exec(kopf || '') || [])[1] || '';
    return {
      quelle: 'sema', format: 'SEMA-Projekt', name: name.trim(), teile: teile, zeilen: Holz.gruppieren(teile), hinweise: [],
      formText: 'Alle ' + teile.length + ' Holzteile mit genauer Form und Lage im Bauwerk, mit Zapfen, Kerven und Blättern',
      details: { programm: version ? 'SEMA ' + version.trim() : 'SEMA', ohneAbbund: weg, sema: true }
    };
  }

  function leseArchiv(buf, datei) {
    var zip = zipLesen(buf), e = zip.eintraege, namen = e.map(function (x) { return x.name; });
    var kopf = e.filter(function (x) { return /(^|\/)SEM_HEAD\.INI$/i.test(x.name); })[0];
    if (kopf) {
      var wurzel = kopf.name.replace(/SEM_HEAD\.INI$/i, '');
      var kandidaten = e.filter(function (x) {
        var rest = x.name.slice(wurzel.length);
        return x.name.lastIndexOf(wurzel, 0) === 0 && /^DATA_[^/]+\/[^/]+$/i.test(rest) && !/\.(bak|fdb|med|db|rtf|ini|dat|inf)$/i.test(rest) && x.us > 300 && x.us < 30e6;
      });
      var roh = [];
      return zip.lies(kopf).then(function (kb) {
        var kopfText = alsText(kb);
        return kandidaten.reduce(function (kette, x) {
          return kette.then(function () { return zip.lies(x); }).then(function (b) {
            var t = alsText(b);
            if (t.indexOf('HLZBTL') >= 0) semaTeile(t, x.name.split('/').pop(), roh);
          });
        }, Promise.resolve()).then(function () {
          var m = semaModell(roh, kopfText);
          if (!m.teile.length) return { art: 'unbekannt', format: 'SEMA-Projekt', datei: datei, details: { programm: m.details.programm }, hinweise: ['SEMA-Projekt erkannt, aber ohne Holzbauteile mit Form. Die Datei wird mitgeschickt.'] };
          return { art: 'modell', format: m.format, datei: datei, modell: m, hinweise: m.hinweise, details: m.details };
        });
      });
    }
    var einzel = e.filter(function (x) { return /\.(btlx|bvx2?|xml|btl)$/i.test(x.name); })[0];
    if (einzel) return zip.lies(einzel).then(function (b) { var r = Holz.leseText(alsText(b), einzel.name); r.datei = datei; r.details = r.details || {}; r.details.archiv = namen.slice(0, 12); return r; });
    // Projektdatei in einem weiteren ZIP verpackt?
    var innen = e.filter(function (x) { return /\.(sem|zip)$/i.test(x.name); })[0];
    if (innen && e.length <= 3) return zip.lies(innen).then(function (b) { return leseArchiv(b, datei); });
    return Promise.resolve({ art: 'unbekannt', format: 'Gepackte Datei', datei: datei, details: { archiv: namen.slice(0, 12) }, hinweise: ['Archiv mit ' + namen.length + ' Dateien. Für diesen Inhalt ist noch keine Vorschau eingerichtet, die Datei wird mitgeschickt.'] });
  }

  /* ================= andere XML-Dateien: Bauteile nach Namen der Felder suchen ================= */
  var RE = {
    L: /^(length|laenge|länge|len|partlength|dimensionx|l)$/i, B: /^(width|breite|b|w|thickness|dicke|staerke|stärke|dimensionz)$/i, H: /^(height|hoehe|höhe|h|dimensiony)$/i,
    N: /^(count|quantity|qty|reqquantity|anzahl|stueck|stück|stueckzahl|stückzahl|pieces|amount)$/i,
    NAME: /^(name|designation|bezeichnung|description|beschreibung|label|title|partname|bauteil)$/i,
    MAT: /^(material|holzart|wood|species|quality|grade|timbergrade|qualitygrade|festigkeit|guete|güte)$/i,
    NR: /^(nr|no|number|nummer|id|pos|position|singlemembernumber|partnumber|partno|index)$/i,
    PROC: /(process|operation|bearbeit|machining|cut|drill|bohr|schnitt|zapf|tenon|mortis|lap|blatt|kerve|slot|pocket|mill|fraes|fräs|saw|saeg|säg)/i
  };
  function felder(el) {
    var f = {}, i;
    for (i = 0; i < el.attributes.length; i++) f[el.attributes[i].localName] = el.attributes[i].value;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!c.firstElementChild && c.textContent.trim().length && c.textContent.length < 80 && !(c.localName in f)) f[c.localName] = c.textContent.trim();
    return f;
  }
  function finde(f, re) { for (var k in f) if (re.test(k) && String(f[k]).trim() !== '') return f[k]; return null; }

  function leseXmlHeuristisch(doc, format) {
    var root = doc.documentElement, alle = root.getElementsByTagName('*'), kandidaten = [], zaehler = {}, i;
    for (i = 0; i < alle.length; i++) {
      var el = alle[i]; zaehler[el.localName] = (zaehler[el.localName] || 0) + 1;
      var f = felder(el), L = num(finde(f, RE.L)), B = num(finde(f, RE.B)), H = num(finde(f, RE.H));
      if (L > 0 && (B > 0 || H > 0)) kandidaten.push({ el: el, f: f, L: L, B: B > 0 ? B : H, H: H > 0 ? H : B });
    }
    var arten = {};
    kandidaten.forEach(function (k) { arten[k.el.localName] = (arten[k.el.localName] || 0) + 1; });
    var art = Object.keys(arten).sort(function (a, b) { return arten[b] - arten[a]; })[0];
    var teile = [];
    kandidaten.filter(function (k) { return k.el.localName === art; }).forEach(function (k, n) {
      var bearb = [], unter = k.el.getElementsByTagName('*');
      for (var j = 0; j < unter.length; j++) {
        var u = unter[j], eltern = u.parentNode;
        var inListe = eltern !== k.el && eltern.parentNode === k.el && RE.PROC.test(eltern.localName);
        var selbst = eltern === k.el && RE.PROC.test(u.localName) && !u.firstElementChild;
        if (inListe || selbst) bearb.push(u.getAttribute('Name') || u.getAttribute('Type') || u.getAttribute('name') || u.getAttribute('type') || u.localName);
      }
      teile.push({
        nr: finde(k.f, RE.NR) || String(n + 1), name: finde(k.f, RE.NAME) || art, material: finde(k.f, RE.MAT) || '', guete: '', gruppe: '',
        L: k.L, B: Math.min(k.B, k.H), H: Math.max(k.B, k.H), anzahl: parseInt(finde(k.f, RE.N), 10) || 1, bearb: bearb, form: false
      });
    });
    var hinweise = [];
    if (teile.length) {
      var maxL = Math.max.apply(null, teile.map(function (t) { return t.L; }));
      var faktor = maxL < 60 ? 1000 : (maxL > 200000 ? 0.01 : (maxL > 30000 ? 0.1 : 1));
      if (faktor !== 1) { teile.forEach(function (t) { t.L *= faktor; t.B *= faktor; t.H *= faktor; }); hinweise.push('Maße wurden als ' + (faktor === 1000 ? 'Meter' : (faktor === 0.1 ? 'Zehntelmillimeter' : 'Hundertstelmillimeter')) + ' gedeutet und in Millimeter umgerechnet.'); }
      teile.forEach(function (t) { t.tri = Holz.quader(t.L, t.H, t.B); t.m = null; });
      teile = vervielfache(teile);
      legeAus(teile);
    }
    var struktur = Object.keys(zaehler).sort(function (a, b) { return zaehler[b] - zaehler[a]; }).slice(0, 14).map(function (k) { return k + ' ×' + zaehler[k]; });
    return {
      quelle: 'xml', format: format, name: root.getAttribute('Name') || root.getAttribute('name') || '', teile: teile, zeilen: Holz.gruppieren(teile), hinweise: hinweise,
      formText: '', details: { wurzel: root.localName, struktur: struktur, bauteilElement: art || '' }
    };
  }

  /* ================= Beilagen: IFC zaehlen, DXF als Linien ================= */
  function ifcInfo(text) {
    function z(re) { var m = text.match(re); return m ? m.length : 0; }
    var schema = /FILE_SCHEMA\s*\(\s*\(\s*'([^']+)'/.exec(text);
    return {
      schema: schema ? schema[1] : 'IFC', balken: z(/=\s*IFCBEAM\s*\(/gi), staebe: z(/=\s*IFCMEMBER\s*\(/gi), stuetzen: z(/=\s*IFCCOLUMN\s*\(/gi),
      platten: z(/=\s*IFCPLATE\s*\(/gi), waende: z(/=\s*IFCWALL(STANDARDCASE)?\s*\(/gi), decken: z(/=\s*IFCSLAB\s*\(/gi), daecher: z(/=\s*IFCROOF\s*\(/gi)
    };
  }
  function dxfLinien(text) {
    var z = text.split(/\r?\n/), i = 0, n = z.length, paare = [];
    for (; i + 1 < n; i += 2) paare.push([parseInt(z[i], 10), z[i + 1].trim()]);
    var start = -1;
    for (i = 0; i < paare.length - 1; i++) if (paare[i][0] === 0 && paare[i][1] === 'SECTION' && paare[i + 1][1] === 'ENTITIES') { start = i + 2; break; }
    if (start < 0) return null;
    var seg = [], zaehl = {}, e = null;
    function fertig() {
      if (!e) return;
      zaehl[e.t] = (zaehl[e.t] || 0) + 1;
      if (e.t === 'LINE' && e[10] != null && e[11] != null) seg.push([e[10], e[20], e[11], e[21]]);
      else if (e.t === 'LWPOLYLINE' && e.px) { for (var k = 0; k + 1 < e.px.length; k++) seg.push([e.px[k], e.py[k], e.px[k + 1], e.py[k + 1]]); if ((e[70] & 1) && e.px.length > 2) seg.push([e.px[e.px.length - 1], e.py[e.py.length - 1], e.px[0], e.py[0]]); }
      else if ((e.t === 'CIRCLE' || e.t === 'ARC') && e[40]) {
        var a0 = e.t === 'ARC' ? e[50] * Math.PI / 180 : 0, a1 = e.t === 'ARC' ? e[51] * Math.PI / 180 : Math.PI * 2; if (a1 <= a0) a1 += Math.PI * 2;
        var st = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 18)));
        for (var s = 0; s < st; s++) { var w0 = a0 + (a1 - a0) * s / st, w1 = a0 + (a1 - a0) * (s + 1) / st; seg.push([e[10] + e[40] * Math.cos(w0), e[20] + e[40] * Math.sin(w0), e[10] + e[40] * Math.cos(w1), e[20] + e[40] * Math.sin(w1)]); }
      }
    }
    for (i = start; i < paare.length; i++) {
      var c = paare[i][0], v = paare[i][1];
      if (c === 0) { fertig(); if (v === 'ENDSEC') { e = null; break; } e = { t: v }; continue; }
      if (!e) continue;
      var f = parseFloat(v);
      if (e.t === 'LWPOLYLINE' && c === 10) { (e.px = e.px || []).push(f); }
      else if (e.t === 'LWPOLYLINE' && c === 20) { (e.py = e.py || []).push(f); }
      else if (c === 10 || c === 20 || c === 11 || c === 21 || c === 40 || c === 50 || c === 51 || c === 70) e[c] = f;
    }
    fertig();
    return { seg: seg, zaehl: zaehl };
  }

  /* ================= Einstieg ================= */
  Holz.leseText = function (text, name) {
    var kopf = text.slice(0, 1500).trim(), ext = endung(name);
    var info = { datei: { name: name }, hinweise: [], details: {} };
    if (kopf.charAt(0) === '<') {
      var doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.getElementsByTagName('parsererror').length) return Object.assign(info, { art: 'unbekannt', format: 'XML (fehlerhaft)', hinweise: ['Die Datei ist kein gültiges XML und konnte nicht gelesen werden.'] });
      var root = doc.documentElement, wurzel = root.localName, m;
      if (/^btlx$/i.test(wurzel)) { m = leseBTLx(doc); return Object.assign(info, { art: 'modell', format: m.format, modell: m, hinweise: m.hinweise, details: m.details }); }
      if (wurzel === 'Job' && (root.getAttribute('BvxVersion') || nach(root, 'RectangularPart').length)) {
        m = leseBVX(doc);
        if (m.teile.length) return Object.assign(info, { art: 'modell', format: m.format, modell: m, hinweise: m.hinweise, details: m.details });
      }
      m = leseXmlHeuristisch(doc, ext === 'bvx' || ext === 'bvx2' ? 'Hundegger BVX (unbekannte Fassung)' : 'XML-Datei');
      if (m.teile.length) return Object.assign(info, { art: 'modell', format: m.format, modell: m, hinweise: m.hinweise, details: m.details, experimentell: true });
      return Object.assign(info, { art: 'unbekannt', format: m.format, details: m.details, hinweise: ['In der Datei wurden keine Bauteile mit Länge und Querschnitt gefunden. Die Datei wird trotzdem mitgeschickt.'] });
    }
    if (/ISO-10303-21/.test(kopf)) { var ii = ifcInfo(text); return Object.assign(info, { art: 'dokument', format: 'IFC-Modell (' + ii.schema + ')', details: { ifc: ii }, hinweise: ['IFC erkannt. Die Stückliste liest die Seite in dieser Demo noch nicht aus.'] }); }
    if (ext === 'dxf' || /^0\s+SECTION/.test(kopf)) { var d = dxfLinien(text); return Object.assign(info, { art: 'dokument', format: 'DXF-Zeichnung', details: { dxf: d } }); }
    if (ext === 'btl' || /\[GENERAL\]|\[PART\]/i.test(kopf)) return Object.assign(info, { art: 'unbekannt', format: 'BTL (älteres Textformat)', hinweise: ['BTL erkannt. Die Vorschau für das ältere BTL-Format ist in der Demo noch nicht eingebaut.'] });
    if (ext === 'bvn') return Object.assign(info, { art: 'unbekannt', format: 'Hundegger BVN', hinweise: ['BVN erkannt. Die Vorschau für das ältere BVN-Format ist in der Demo noch nicht eingebaut.'] });
    return Object.assign(info, { art: 'unbekannt', format: ext ? ext.toUpperCase() + '-Datei' : 'Datei' });
  };

  Holz.lese = function (file) {
    var ext = endung(file.name), datei = { name: file.name, groesse: file.size };
    if (/^(png|jpe?g|webp|gif|heic)$/.test(ext) || /^image\//.test(file.type)) return Promise.resolve({ art: 'dokument', format: 'Foto', datei: datei, hinweise: [], details: { bild: URL.createObjectURL(file) } });
    if (ext === 'pdf' || file.type === 'application/pdf') return Promise.resolve({ art: 'dokument', format: 'PDF-Plan', datei: datei, hinweise: [], details: { pdf: URL.createObjectURL(new Blob([file], { type: 'application/pdf' })) } });
    return file.arrayBuffer().then(function (buf) {
      var u8 = new Uint8Array(buf);
      if (u8[0] === 0x50 && u8[1] === 0x4B) {
        return Promise.resolve().then(function () { return leseArchiv(buf, datei); })
          .catch(function (e) { return { art: 'unbekannt', format: 'Gepackte Datei', datei: datei, hinweise: [(e && e.message ? e.message : 'Das Archiv konnte nicht gelesen werden') + '. Die Datei wird trotzdem mitgeschickt.'], details: {} }; });
      }
      var nullen = 0; for (var i = 0; i < Math.min(u8.length, 2000); i++) if (u8[i] === 0) nullen++;
      if (nullen > 40 && !(u8[0] === 0xFF && u8[1] === 0xFE)) {
        return { art: 'unbekannt', format: (ext ? ext.toUpperCase() : 'Binär') + '-Datei', datei: datei, details: {}, hinweise: ['Für dieses Dateiformat ist noch keine Vorschau eingerichtet. Die Datei wird mit der Anfrage mitgeschickt.'] };
      }
      var r = Holz.leseText(alsText(buf), file.name);
      r.datei = datei;
      return r;
    });
  };
})();
