/* Holz: gemeinsame Helfer, Kennzahlen, parametrische Modelle (Dachstuhl, Carport, Gartenhaus) und BTLx-Ausgabe.
   Einheiten: mm, Z nach oben. Lokales Bauteil-System wie in BTLx: x = Laenge, y = Hoehe, z = Breite. */
(function () {
  'use strict';
  var V3 = THREE.Vector3;
  var Holz = window.Holz = window.Holz || {};

  Holz.DICHTE = 470; // kg/m3, Fichte/Tanne lufttrocken, nur fuer die Schaetzung des Gewichts

  Holz.BEARBEITUNG = {
    JackRafterCut: 'Schrägschnitt', DoubleCut: 'Doppelschnitt', RidgeValleyCut: 'Grat-/Kehlschnitt', LongitudinalCut: 'Längsschnitt',
    Lap: 'Blatt', BirdsMouth: 'Kerve', Drilling: 'Bohrung', Pocket: 'Tasche', Tenon: 'Zapfen', Mortise: 'Zapfenloch',
    DovetailTenon: 'Schwalbenschwanzzapfen', DovetailMortise: 'Schwalbenschwanznut', Dovetail: 'Schwalbenschwanz', TyroleanDovetail: 'Tiroler Schloss',
    House: 'Einlassung', HouseMortise: 'Einlassung (Nut)', StepJoint: 'Versatz', StepJointNotch: 'Versatzkerbe', Slot: 'Schlitz', Chamfer: 'Fase',
    FrenchRidgeLap: 'Firstblatt', LogHouseHalfLap: 'Blockhaus-Überblattung', LogHouseJoint: 'Blockhaus-Verbindung', LogHouseFront: 'Blockhaus-Stirn',
    SimpleScarf: 'Gerades Blatt', ScarfJoint: 'Hakenblatt', Planing: 'Hobeln', FreeContour: 'Freie Kontur', Aperture: 'Ausschnitt', Marking: 'Markierung',
    Text: 'Beschriftung', NailContour: 'Nagelreihe', Sphere: 'Kugel', TriangleCut: 'Dreieckschnitt', ProfileFront: 'Profil (Stirn)', ProfileHead: 'Profil (Kopf)',
    SawCut: 'Sägeschnitt', Step: 'Absatz', BlindStep: 'Absatz, begrenzt', Contour: 'Kontur', StrutSingleStepJoint: 'Stirnversatz', HipRafterBirdsMouth: 'Gratsparrenkerve',
    DoubleSawCut: 'Doppelschnitt', RidgeLap: 'Firstblatt', Bore: 'Bohrung', Groove: 'Nut', Rabbet: 'Falz',
    ProfileCambered: 'Profil (Bogen)', RoundArch: 'Rundbogen', Penetration: 'Durchdringung', PrintedMarking: 'Druckmarkierung', Lengthcut: 'Kappschnitt'
  };
  Holz.bearbeitungDe = function (n) { return Holz.BEARBEITUNG[n] || n; };

  /* ---------- Geometrie eines Balkens ---------- */
  function wuerfelDreiecke(P) {
    // P: 8 Punkte [x,y,z], Reihenfolge: (x0|x1) x (y0|y1) x (z0|z1) -> index = xi*4 + yi*2 + zi
    var f = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
    var o = [];
    for (var i = 0; i < f.length; i++) {
      var q = f[i], t = [q[0], q[1], q[2], q[0], q[2], q[3]];
      for (var k = 0; k < 6; k++) o.push(P[t[k]][0], P[t[k]][1], P[t[k]][2]);
    }
    return new Float32Array(o);
  }
  Holz.quader = function (L, H, W) {
    var P = [];
    for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++) P.push([xi * L, yi * H, zi * W]);
    return wuerfelDreiecke(P);
  };

  /* Balken von a nach b (Achse = Mittellinie). b_ = Breite, h_ = Hoehe des Querschnitts.
     opt.hoch: bevorzugte Richtung der Querschnittshoehe (Standard Z, bei senkrechten Balken X)
     opt.lot: [anfang, ende] Lotschnitt (senkrechte Stirnflaeche) bei geneigten Balken */
  Holz.balken = function (name, a, b, b_, h_, opt) {
    opt = opt || {};
    var u = new V3().subVectors(b, a), La = u.length(); u.normalize();
    var hoch = opt.hoch ? opt.hoch.clone() : (Math.abs(u.z) > 0.95 ? new V3(1, 0, 0) : new V3(0, 0, 1));
    var w = new V3().crossVectors(u, hoch).normalize();      // Breitenrichtung (lokal z)
    var v = new V3().crossVectors(w, u).normalize();          // Hoehenrichtung (lokal y)
    var k = 0, uh = new V3(u.x, u.y, 0);
    if (uh.length() > 1e-6 && Math.abs(u.z) > 1e-6) { var nh = uh.clone().normalize(); k = -(v.dot(nh)) / (u.dot(nh)); }
    var lot = opt.lot || [false, false];
    var P = [], minx = Infinity, maxx = -Infinity;
    for (var xi = 0; xi < 2; xi++) for (var yi = 0; yi < 2; yi++) for (var zi = 0; zi < 2; zi++) {
      var y = yi * h_, x = xi * La + (lot[xi] ? (y - h_ / 2) * k : 0);
      P.push([x, y, zi * b_]); minx = Math.min(minx, x); maxx = Math.max(maxx, x);
    }
    for (var i = 0; i < 8; i++) P[i][0] -= minx;
    var ref = a.clone().addScaledVector(v, -h_ / 2).addScaledVector(w, -b_ / 2).addScaledVector(u, minx);
    var m = new THREE.Matrix4().makeBasis(u, v, w).setPosition(ref);
    return {
      name: name, material: opt.material || 'Fichte/Tanne', guete: opt.guete || 'C24', gruppe: opt.gruppe || '',
      L: maxx - minx, B: b_, H: h_, bearb: (opt.bearb || []).slice(), tri: wuerfelDreiecke(P), m: m.toArray(),
      ref: ref, xv: u, yv: v, form: true
    };
  };

  /* ---------- Stueckliste und Kennzahlen ---------- */
  function r(x, n) { var f = Math.pow(10, n || 0); return Math.round(x * f) / f; }
  Holz.qkey = function (t) { var a = Math.min(t.B, t.H), b = Math.max(t.B, t.H); return r(a) + '×' + r(b); };

  Holz.gruppieren = function (teile) {
    var zeilen = [], idx = {};
    teile.forEach(function (t) {
      t.qkey = Holz.qkey(t);
      t.nb = (t.bearb || []).length;
      var key = [t.name, t.material, t.guete, r(t.B), r(t.H), r(t.L), (t.bearb || []).slice().sort().join(',')].join('|');
      if (!(key in idx)) {
        idx[key] = zeilen.length;
        zeilen.push({ name: t.name || 'Bauteil', material: t.material || '', guete: t.guete || '', B: t.B, H: t.H, L: t.L, anzahl: 0, bearb: t.bearb || [], nummern: [] });
      }
      var z = zeilen[idx[key]];
      z.anzahl += (t.anzahl || 1);
      if (t.nr != null && t.nr !== '') z.nummern.push(t.nr);
      t.zeile = idx[key];
    });
    return zeilen;
  };

  Holz.kennzahlen = function (teile) {
    var k = { teile: 0, lfm: 0, m3: 0, maxL: 0, maxB: 0, maxH: 0, bearb: {}, bearbSumme: 0, quer: {}, material: {}, ohneMaterial: 0, mitForm: 0 };
    teile.forEach(function (t) {
      var n = t.anzahl || 1;
      var v = t.vol > 0 ? t.vol * n : t.L * t.B * t.H * n / 1e9;
      k.teile += n; k.lfm += t.L * n / 1000; k.m3 += v;
      k.maxL = Math.max(k.maxL, t.L);
      var a = Math.min(t.B, t.H), b = Math.max(t.B, t.H);
      if (a * b > k.maxB * k.maxH) { k.maxB = a; k.maxH = b; }
      (t.bearb || []).forEach(function (x) { k.bearb[x] = (k.bearb[x] || 0) + n; k.bearbSumme += n; });
      var q = Holz.qkey(t);
      if (!k.quer[q]) k.quer[q] = { key: q, anzahl: 0, lfm: 0, m3: 0 };
      k.quer[q].anzahl += n; k.quer[q].lfm += t.L * n / 1000; k.quer[q].m3 += v;
      var mat = [t.material, t.guete].filter(Boolean).join(' ');
      if (mat) k.material[mat] = (k.material[mat] || 0) + n; else k.ohneMaterial += n;
      if (t.form) k.mitForm += 1;
    });
    k.gewicht = k.m3 * Holz.DICHTE;
    k.querListe = Object.keys(k.quer).map(function (q) { return k.quer[q]; }).sort(function (x, y) { return y.lfm - x.lfm; });
    return k;
  };

  /* Unverbindliche Preisschaetzung, netto ab Werk. Faustwerte aus zwei Angeboten von Schophuis (Nov. 2026):
     Arbeitsvorbereitung pauschal + Holz je m3 (mit Verschnitt, bei grossen Mengen guenstiger) + Abbund je Laufmeter
     (je mehr Teile pro Meter, desto aufwendiger: 2,96 bis 5,49 EUR). opt.abbundSatz ueberschreibt den Satz. */
  Holz.preis = function (k, opt) {
    opt = opt || {};
    var m3 = k.m3 * 1.08;
    var eurM3 = Math.round(Math.max(520, Math.min(600, 600 - (m3 - 1.6) / 9.24 * 78)));
    var dichte = k.teile / Math.max(k.lfm, 1);
    var eurLfm = opt.abbundSatz || Math.max(2.96, Math.min(5.49, 2.96 + (dichte - 0.24) / 0.15 * 2.53));
    var av = opt.av == null ? 850 : opt.av, holz = m3 * eurM3, abbund = k.lfm * eurLfm, summe = av + holz + abbund;
    return { av: av, m3: m3, eurM3: eurM3, holz: holz, lfm: k.lfm, eurLfm: eurLfm, abbund: abbund, summe: summe,
      von: Math.floor(summe * 0.88 / 50) * 50, bis: Math.ceil(summe * 1.12 / 50) * 50 };
  };

  Holz.zahl = function (x, n) {
    return (Math.round(x * Math.pow(10, n || 0)) / Math.pow(10, n || 0)).toLocaleString('de-DE', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  };

  /* ---------- Modelle ---------- */
  function rad(g) { return g * Math.PI / 180; }

  /* Faustregel fuer Querschnitte, nur fuer Vorschau und Schaetzung (ersetzt keine Statik):
     groessere Spannweite oder groesserer Abstand -> hoeherer Querschnitt, gerundet auf uebliche KVH-Masse. */
  var HOEHEN = [100, 120, 140, 160, 180, 200, 220, 240, 260, 280];
  function stufe(x, liste) { for (var i = 0; i < liste.length; i++) if (liste[i] >= x - 1) return liste[i]; return liste[liste.length - 1]; }
  Holz.faustregel = {
    // Sparren und Balken: Hoehe etwa Spannweite / 21, waechst mit der Wurzel aus dem Abstand (Bezug 80 cm)
    sparren: function (spann, abstand, min) {
      var h = stufe(Math.max(min || 120, spann / 21 * Math.sqrt((abstand || 800) / 800)), HOEHEN);
      return { b: h <= 160 ? 60 : (h <= 220 ? 80 : 100), h: h };
    },
    // Pfetten und Wechsel: Hoehe etwa Spannweite / 16, waechst mit der Wurzel aus der Lastbreite (Bezug 2,5 m)
    pfette: function (spann, lastbreite, min) {
      var h = stufe(Math.max(min || 160, spann / 16 * Math.sqrt((lastbreite || 2500) / 2500)), HOEHEN);
      return { b: stufe(h * 0.5, [100, 120, 140, 160]), h: h };
    },
    pfosten: function (hoehe, flaeche) { return hoehe > 2600 || flaeche > 12e6 ? 140 : 120; }
  };

  /* Dachstuhl. typ: 'pfetten' (Pfettendach mit Mittelpfetten), 'kehl' (Kehlbalkendach), 'pult' (Pultdach) */
  Holz.dachstuhl = function (o) {
    o = o || {};
    var typ = o.typ || 'pfetten', Bz = o.breite || 9000, Ly = o.laenge || 11000, al = rad(o.neigung || 38), e = o.abstand || 800;
    var T = [], cos = Math.cos(al), tan = Math.tan(al), ue = o.ueberstand == null ? 500 : o.ueberstand;
    var sb = o.sparrenB || 80, sh = o.sparrenH || 200;
    var n = Math.max(2, Math.round((Ly - sb) / e) + 1), dy = (Ly - sb) / (n - 1);
    function sparrenY(i) { return sb / 2 + i * dy; }

    if (typ === 'pult') {
      var hTief = 0, fp = 140;
      var zA = function (x) { return fp + (sh / 2) / cos + (x + Bz / 2) * tan; }; // Sparrenachse, tiefe Seite bei x=-B/2
      T.push(Holz.balken('Fußpfette', new V3(-Bz / 2, 0, fp / 2), new V3(-Bz / 2, Ly, fp / 2), 140, fp, { bearb: ['Drilling', 'Drilling', 'Drilling'] }));
      var zOben = zA(Bz / 2) - (sh / 2) / cos; // Unterkante Sparren an der hohen Seite
      var ph = 220;
      T.push(Holz.balken('Firstpfette', new V3(Bz / 2, 0, zOben - ph / 2), new V3(Bz / 2, Ly, zOben - ph / 2), 140, ph, { bearb: ['Mortise', 'Mortise', 'Mortise'] }));
      var np = Math.max(2, Math.ceil(Ly / 4000) + 1);
      for (var p = 0; p < np; p++) {
        var py = 70 + p * (Ly - 140) / (np - 1);
        T.push(Holz.balken('Pfosten', new V3(Bz / 2, py, 0), new V3(Bz / 2, py, zOben - ph), 140, 140, { bearb: ['Tenon', 'Tenon'] }));
        [-1, 1].forEach(function (s) {
          var y2 = py + s * 900;
          if (y2 < 0 || y2 > Ly) return;
          T.push(Holz.balken('Kopfband', new V3(Bz / 2, py, zOben - ph - 900), new V3(Bz / 2, y2, zOben - ph), 100, 120, { lot: [false, false], bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
        });
      }
      for (var i = 0; i < n; i++) {
        var y = sparrenY(i), x0 = -Bz / 2 - ue, x1 = Bz / 2 + ue * 0.6;
        T.push(Holz.balken('Sparren', new V3(x0, y, zA(x0)), new V3(x1, y, zA(x1)), sb, sh, { lot: [true, true], bearb: ['JackRafterCut', 'JackRafterCut', 'BirdsMouth', 'BirdsMouth'] }));
      }
      return fertig(T, 'Pultdach ' + Holz.zahl(Bz / 1000, 2) + ' × ' + Holz.zahl(Ly / 1000, 2) + ' m, ' + (o.neigung || 38) + '°');
    }

    var fpH = 120;
    var zAchse = function (x) { return fpH + (sh / 2) / cos + (Bz / 2 - Math.abs(x)) * tan; }; // Hoehe der Sparrenachse
    [-1, 1].forEach(function (s) {
      T.push(Holz.balken('Fußpfette', new V3(s * Bz / 2, 0, fpH / 2), new V3(s * Bz / 2, Ly, fpH / 2), 120, fpH, { bearb: ['Drilling', 'Drilling', 'Drilling', 'Drilling'] }));
    });
    // Sparren
    for (var j = 0; j < n; j++) {
      [-1, 1].forEach(function (s) {
        var xa = s * (Bz / 2 + ue), ya = sparrenY(j);
        var proc = typ === 'pfetten' ? ['JackRafterCut', 'JackRafterCut', 'BirdsMouth', 'BirdsMouth'] : ['JackRafterCut', 'JackRafterCut', 'BirdsMouth'];
        T.push(Holz.balken('Sparren', new V3(xa, ya, zAchse(xa)), new V3(0, ya, zAchse(0)), sb, sh, { lot: [true, true], bearb: proc }));
      });
    }
    if (typ === 'kehl') {
      var zk = fpH + (Bz / 2) * tan * 0.6, kh = 160;
      var xk = Bz / 2 - (zk - fpH - (sh / 2) / cos) / tan;
      for (var c = 0; c < n; c++) {
        var yc = sparrenY(c) + sb / 2 + 30;
        T.push(Holz.balken('Kehlbalken', new V3(-xk, yc, zk), new V3(xk, yc, zk), 60, kh, { bearb: ['JackRafterCut', 'JackRafterCut', 'Drilling', 'Drilling'] }));
      }
      return fertig(T, 'Kehlbalkendach ' + Holz.zahl(Bz / 1000, 2) + ' × ' + Holz.zahl(Ly / 1000, 2) + ' m, ' + (o.neigung || 38) + '°');
    }
    // Pfettendach: Mittelpfetten auf Pfosten mit Kopfbaendern, Zangen je Gebinde
    var xm = Bz / 4, mpH = 240, mpB = 140, schw = 140;
    var zMpOben = zAchse(xm) - (sh / 2) / cos, npf = Math.max(2, Math.ceil(Ly / 4000) + 1);
    [-1, 1].forEach(function (s) {
      var bohr = []; for (var q = 0; q < npf; q++) bohr.push('Mortise');
      T.push(Holz.balken('Mittelpfette', new V3(s * xm, 0, zMpOben - mpH / 2), new V3(s * xm, Ly, zMpOben - mpH / 2), mpB, mpH, { bearb: bohr.concat(bohr) }));
      T.push(Holz.balken('Schwelle', new V3(s * xm, 0, schw / 2), new V3(s * xm, Ly, schw / 2), 140, schw, { bearb: bohr }));
      for (var p2 = 0; p2 < npf; p2++) {
        var yp = 70 + p2 * (Ly - 140) / (npf - 1);
        T.push(Holz.balken('Pfosten', new V3(s * xm, yp, schw), new V3(s * xm, yp, zMpOben - mpH), 140, 140, { bearb: ['Tenon', 'Tenon'] }));
        [-1, 1].forEach(function (d) {
          var y3 = yp + d * 1000;
          if (y3 < 0 || y3 > Ly) return;
          T.push(Holz.balken('Kopfband', new V3(s * xm, yp, zMpOben - mpH - 1000), new V3(s * xm, y3, zMpOben - mpH), 100, 120, { bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
        });
      }
    });
    var zz = zMpOben - mpH - 60, xz = Bz / 2 - (zz - fpH - (sh / 2) / cos) / tan + 150;
    for (var g = 0; g < npf; g++) {
      var yg = 70 + g * (Ly - 140) / (npf - 1);
      [-1, 1].forEach(function (d) {
        T.push(Holz.balken('Zange', new V3(-xz, yg + d * 100, zz), new V3(xz, yg + d * 100, zz), 60, 180, { bearb: ['Lap', 'Lap', 'Drilling', 'Drilling', 'Drilling', 'Drilling'] }));
      });
    }
    return fertig(T, 'Pfettendach ' + Holz.zahl(Bz / 1000, 2) + ' × ' + Holz.zahl(Ly / 1000, 2) + ' m, ' + (o.neigung || 38) + '°');
  };

  /* Carport: Pfosten, zwei Pfetten, Sparren, Kopfbaender. breite = Einfahrtsbreite (X), tiefe (Y), hoehe = lichte Hoehe */
  Holz.carport = function (o) {
    o = o || {};
    var Bx = o.breite || 3000, Ty = o.tiefe || 6000, Hh = o.hoehe || 2300, F = Holz.faustregel;
    var np = Ty > 4500 ? 3 : 2, pf = F.pfosten(Hh, Bx * Ty);
    var pq = F.pfette((Ty - pf) / (np - 1), Bx / 2 + 200, 180), pB = pq.b, pH = pq.h;
    var sq = F.sparren(Bx + pf, 750, 140), sB = sq.b, sH = sq.h;
    var gef = Bx * 0.03, T = [];
    [-1, 1].forEach(function (s) {
      var zU = Hh + (s < 0 ? gef : 0);              // Unterkante Pfette (linke Seite hoeher fuer das Gefaelle)
      var x = s * (Bx / 2 + pf / 2);
      var z = []; for (var q = 0; q < np; q++) z.push('Mortise');
      T.push(Holz.balken('Pfette', new V3(x, -250, zU + pH / 2), new V3(x, Ty + 250, zU + pH / 2), pB, pH, { bearb: z }));
      for (var p = 0; p < np; p++) {
        var y = pf / 2 + p * (Ty - pf) / (np - 1);
        T.push(Holz.balken('Pfosten', new V3(x, y, 0), new V3(x, y, zU), pf, pf, { bearb: ['Tenon', 'Drilling'] }));
        [-1, 1].forEach(function (d) {
          var y2 = y + d * 700;
          if (y2 < 0 || y2 > Ty) return;
          T.push(Holz.balken('Kopfband', new V3(x, y, zU - 700), new V3(x, y2, zU), 80, 80, { bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
        });
      }
    });
    var n = Math.max(3, Math.round((Ty + 500 - sB) / 750) + 1), xa = Bx / 2 + pf + 200;
    for (var i = 0; i < n; i++) {
      var ys = -250 + sB / 2 + i * (Ty + 500 - sB) / (n - 1);
      var zl = Hh + gef + pH + sH / 2 + (xa - Bx / 2 - pf / 2) * (gef / (Bx + pf)), zr = Hh + pH + sH / 2 - (xa - Bx / 2 - pf / 2) * (gef / (Bx + pf));
      T.push(Holz.balken('Sparren', new V3(-xa, ys, zl), new V3(xa, ys, zr), sB, sH, { bearb: ['BirdsMouth', 'BirdsMouth'] }));
    }
    return fertig(T, 'Carport ' + Holz.zahl(Bx / 1000, 2) + ' × ' + Holz.zahl(Ty / 1000, 2) + ' m');
  };

  /* Gartenhaus in Staenderbauweise mit Satteldach. breite = Giebelseite (X), tiefe (Y), hoehe = Wandhoehe */
  Holz.gartenhaus = function (o) {
    o = o || {};
    var Bx = o.breite || 3000, Ty = o.tiefe || 6000, Hw = o.hoehe || 2200, al = rad(o.neigung || 25), q = 100, T = [];
    var cos = Math.cos(al), tan = Math.tan(al), ue = 300, tuer = 1000, tuerH = 2000;
    var sq = Holz.faustregel.sparren((Bx / 2) / cos, 750, 120), sB = sq.b, sH = sq.h;
    var fq = Holz.faustregel.pfette(Ty, Bx / 2, 160);
    var x0 = -Bx / 2 + q / 2, x1 = Bx / 2 - q / 2;
    // Schwellen und Raehm
    [[0, 'Schwelle', q / 2], [1, 'Rähm', Hw - q / 2]].forEach(function (e) {
      [x0, x1].forEach(function (x) { T.push(Holz.balken(e[1], new V3(x, 0, e[2]), new V3(x, Ty, e[2]), q, q, { bearb: ['Lap', 'Lap', 'Mortise', 'Mortise', 'Mortise'] })); });
      [q / 2, Ty - q / 2].forEach(function (y, yi) {
        if (e[0] === 0 && yi === 0) { // Schwelle vorn: Tueroeffnung frei lassen
          T.push(Holz.balken(e[1], new V3(-Bx / 2 + q, y, e[2]), new V3(-tuer / 2, y, e[2]), q, q, { bearb: ['Lap', 'Tenon'] }));
          T.push(Holz.balken(e[1], new V3(tuer / 2, y, e[2]), new V3(Bx / 2 - q, y, e[2]), q, q, { bearb: ['Lap', 'Tenon'] }));
        } else T.push(Holz.balken(e[1], new V3(-Bx / 2 + q, y, e[2]), new V3(Bx / 2 - q, y, e[2]), q, q, { bearb: ['Lap', 'Lap', 'Mortise'] }));
      });
    });
    // Staender Laengswaende
    var nl = Math.max(2, Math.round((Ty - q) / 1000) + 1);
    [x0, x1].forEach(function (x) {
      for (var i = 0; i < nl; i++) {
        var y = q / 2 + i * (Ty - q) / (nl - 1);
        T.push(Holz.balken(i === 0 || i === nl - 1 ? 'Eckständer' : 'Ständer', new V3(x, y, q), new V3(x, y, Hw - q), q, q, { bearb: ['Tenon', 'Tenon'] }));
      }
      // Streben an den Ecken (in der Wandebene)
      [[q / 2, 1], [Ty - q / 2, -1]].forEach(function (e) {
        T.push(Holz.balken('Strebe', new V3(x, e[0] + e[1] * 80, q), new V3(x, e[0] + e[1] * ((Ty - q) / (nl - 1) - 80), Hw - q), 60, q, { hoch: new V3(1, 0, 0), bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
      });
    });
    // Giebelwaende: Tuerstaender, Sturz, Mittelstaender
    var zF = Hw + (Bx / 2) * tan, fpH = fq.h;           // Firsthoehe (Unterkante Sparren am First ~ zF)
    var zFp = zF - (sH / 2) / cos * 0 - fpH / 2 - 20;   // Mitte Firstpfette
    T.push(Holz.balken('Türständer', new V3(-tuer / 2 - q / 2, q / 2, q), new V3(-tuer / 2 - q / 2, q / 2, Hw - q), q, q, { bearb: ['Tenon', 'Tenon', 'Mortise'] }));
    T.push(Holz.balken('Türständer', new V3(tuer / 2 + q / 2, q / 2, q), new V3(tuer / 2 + q / 2, q / 2, Hw - q), q, q, { bearb: ['Tenon', 'Tenon', 'Mortise'] }));
    T.push(Holz.balken('Türsturz', new V3(-tuer / 2, q / 2, tuerH + q / 2), new V3(tuer / 2, q / 2, tuerH + q / 2), q, q, { bearb: ['Tenon', 'Tenon'] }));
    T.push(Holz.balken('Giebelständer', new V3(0, q / 2, Hw), new V3(0, q / 2, zFp - fpH / 2), q, q, { bearb: ['Tenon', 'Tenon'] }));
    T.push(Holz.balken('Giebelständer', new V3(0, Ty - q / 2, q), new V3(0, Ty - q / 2, Hw - q), q, q, { bearb: ['Tenon', 'Tenon'] }));
    T.push(Holz.balken('Giebelständer', new V3(0, Ty - q / 2, Hw), new V3(0, Ty - q / 2, zFp - fpH / 2), q, q, { bearb: ['Tenon', 'Tenon'] }));
    T.push(Holz.balken('Firstpfette', new V3(0, -ue, zFp), new V3(0, Ty + ue, zFp), fq.b, fpH, { bearb: ['Mortise', 'Mortise'] }));
    // Sparren
    var zAchse = function (x) { return Hw + (sH / 2) / cos + (Bx / 2 - Math.abs(x)) * tan; };
    var ns = Math.max(3, Math.round((Ty + 2 * ue - sB) / 750) + 1);
    for (var j = 0; j < ns; j++) {
      var ys = -ue + sB / 2 + j * (Ty + 2 * ue - sB) / (ns - 1);
      [-1, 1].forEach(function (s) {
        var xa = s * (Bx / 2 + ue);
        T.push(Holz.balken('Sparren', new V3(xa, ys, zAchse(xa)), new V3(0, ys, zAchse(0)), sB, sH, { lot: [true, true], bearb: ['JackRafterCut', 'JackRafterCut', 'BirdsMouth'] }));
      });
    }
    return fertig(T, 'Gartenhaus ' + Holz.zahl(Bx / 1000, 2) + ' × ' + Holz.zahl(Ty / 1000, 2) + ' m');
  };

  /* Pergola, freistehend: vier Pfosten, zwei Pfetten, Auflagehoelzer, Kopfbaender. breite (X), tiefe (Y), hoehe = Durchgangshoehe */
  Holz.pergola = function (o) {
    o = o || {};
    var Bx = o.breite || 3500, Ty = o.tiefe || 3500, Hh = o.hoehe || 2300, pf = 120, pB = 120, pH = 160, sB = 80, sH = 120, ue = 300, T = [];
    [-1, 1].forEach(function (s) {
      var x = s * (Bx / 2 - pf / 2);
      T.push(Holz.balken('Pfette', new V3(x, -ue, Hh + pH / 2), new V3(x, Ty + ue, Hh + pH / 2), pB, pH, { bearb: ['Mortise', 'Mortise', 'Lap', 'Lap'] }));
      [pf / 2, Ty - pf / 2].forEach(function (y, yi) {
        T.push(Holz.balken('Pfosten', new V3(x, y, 0), new V3(x, y, Hh), pf, pf, { bearb: ['Tenon', 'Drilling'] }));
        var d = yi === 0 ? 1 : -1;
        T.push(Holz.balken('Kopfband', new V3(x, y, Hh - 650), new V3(x, y + d * 650, Hh), 80, 100, { bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
        T.push(Holz.balken('Kopfband', new V3(x, y, Hh - 650), new V3(x - s * 650, y, Hh + pH), 80, 100, { hoch: new V3(0, 1, 0), bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
      });
    });
    var n = Math.max(3, Math.round((Ty - pf) / 600) + 1);
    for (var i = 0; i < n; i++) {
      var ys = pf / 2 + i * (Ty - pf) / (n - 1);
      T.push(Holz.balken('Auflageholz', new V3(-Bx / 2 - ue, ys, Hh + pH + sH / 2), new V3(Bx / 2 + ue, ys, Hh + pH + sH / 2), sB, sH, { bearb: ['Lap', 'Lap'] }));
    }
    return fertig(T, 'Pergola ' + Holz.zahl(Bx / 1000, 2) + ' × ' + Holz.zahl(Ty / 1000, 2) + ' m');
  };

  /* Terrassendach an der Hauswand: Wandpfette, vordere Pfette auf Pfosten, geneigte Sparren. breite = an der Wand (X), tiefe (Y), hoehe = Durchgang vorn */
  Holz.terrassendach = function (o) {
    o = o || {};
    var Bx = o.breite || 4000, Ty = o.tiefe || 3000, Hh = o.hoehe || 2200, al = rad(8), tan = Math.tan(al), cos = Math.cos(al);
    var F = Holz.faustregel, np = Bx > 7000 ? 4 : (Bx > 4500 ? 3 : 2), pf = F.pfosten(Hh, Bx * Ty);
    var vq = F.pfette((Bx - pf) / (np - 1), Ty / 2 + 300, 180), vB = vq.b, vH = vq.h;
    var sq = F.sparren(Ty, 700, 140), sB = sq.b, sH = sq.h, wB = 80, wH = 160, ue = 300, T = [];
    var zV = Hh + vH;                                   // Oberkante vordere Pfette
    var zAchse = function (y) { return zV + (sH / 2) / cos + (Ty - pf / 2 - y) * tan; };   // Sparrenachse, faellt nach vorn
    var zW = zAchse(wB / 2) - (sH / 2) / cos;            // Oberkante Wandpfette
    T.push(Holz.balken('Wandpfette', new V3(-Bx / 2, wB / 2, zW - wH / 2), new V3(Bx / 2, wB / 2, zW - wH / 2), wB, wH, { bearb: ['Drilling', 'Drilling', 'Drilling', 'Drilling'] }));
    T.push(Holz.balken('Pfette', new V3(-Bx / 2 - 150, Ty - pf / 2, Hh + vH / 2), new V3(Bx / 2 + 150, Ty - pf / 2, Hh + vH / 2), vB, vH, { bearb: ['Mortise', 'Mortise'] }));
    for (var p2 = 0; p2 < np; p2++) {
      var x = -Bx / 2 + pf / 2 + p2 * (Bx - pf) / (np - 1);
      T.push(Holz.balken('Pfosten', new V3(x, Ty - pf / 2, 0), new V3(x, Ty - pf / 2, Hh), pf, pf, { bearb: ['Tenon', 'Drilling'] }));
      [-1, 1].forEach(function (d) {
        var x2 = x + d * 650;
        if (x2 < -Bx / 2 - 10 || x2 > Bx / 2 + 10) return;
        T.push(Holz.balken('Kopfband', new V3(x, Ty - pf / 2, Hh - 650), new V3(x2, Ty - pf / 2, Hh), 80, 100, { bearb: ['JackRafterCut', 'JackRafterCut', 'Tenon', 'Tenon'] }));
      });
    }
    var n = Math.max(3, Math.round((Bx - sB) / 700) + 1);
    for (var i = 0; i < n; i++) {
      var xs = -Bx / 2 + sB / 2 + i * (Bx - sB) / (n - 1), y1 = Ty + ue;
      T.push(Holz.balken('Sparren', new V3(xs, 0, zAchse(0)), new V3(xs, y1, zAchse(y1)), sB, sH, { lot: [true, true], bearb: ['JackRafterCut', 'JackRafterCut', 'BirdsMouth', 'BirdsMouth'] }));
    }
    return fertig(T, 'Terrassendach ' + Holz.zahl(Bx / 1000, 2) + ' × ' + Holz.zahl(Ty / 1000, 2) + ' m');
  };

  /* Dachgaube auf einem bestehenden Dach. art: 'schlepp' (Schleppgaube) oder 'flach' (Flachdachgaube).
     breite (X) = Gaubenbreite, neigung = Neigung des bestehenden Dachs, hoehe = Hoehe der Gaubenfront.
     Traufe bei y = 0, das Dach steigt nach +y. Das Bestandsdach (grau) liegt in modell.kontext und zaehlt nicht mit. */
  Holz.dachgaube = function (o) {
    o = o || {};
    var art = o.art === 'flach' ? 'flach' : 'schlepp', F = Holz.faustregel;
    var Bx = o.breite || 3000, Hf = o.hoehe || 1400, ag = o.neigung || 45, al = rad(ag), tA = Math.tan(al), cA = Math.cos(al);
    var bg = art === 'flach' ? 3 : Math.max(12, Math.min(25, ag - 18)), tB = Math.tan(rad(bg)), cB = Math.cos(rad(bg));
    var T = [], K = [], q = 100, ue = 350, ueS = 150, sbB = 80, sbH = 180, dz = sbH / cA;
    var yF = 1300, zF = yF * tA, zT = zF + Hf;            // Gaubenfront: Fusspunkt auf der Dachoberkante, Oberkante Raehm
    var yO = (zT - yF * tB) / (tA - tB);                   // hier trifft die Gaube oben auf das Bestandsdach
    var yR = yO + 900, W = Bx / 2 + 1000;
    function dachZ(y) { return y * tA; }                   // Oberkante Bestandssparren
    function gaubeZ(y) { return zT + (y - yF) * tB; }      // Unterkante Gaubensparren
    function alt(t, flaeche) { t.bestand = true; if (flaeche) t.flaeche = true; K.push(t); }
    var hoch = new V3(0, -Math.sin(al), Math.cos(al));     // Querschnittshoehe senkrecht zur Dachflaeche
    function bestandsSparren(x, y0, y1) {
      alt(Holz.balken('Sparren (Bestand)', new V3(x, y0, dachZ(y0) - dz / 2), new V3(x, y1, dachZ(y1) - dz / 2), sbB, sbH, { hoch: hoch, lot: [true, true] }));
    }
    // Bestandssparren: im Bereich der Gaube unten und oben gekuerzt, daneben die Wechselsparren
    var xs = [], xr = Bx / 2 + sbB / 2 + 20;
    for (var x = xr; x <= W; x += 800) { xs.push(x); xs.push(-x); }
    var ni = Math.max(1, Math.round((2 * xr) / 800) - 1);
    for (var i = 1; i <= ni; i++) xs.push(-xr + i * (2 * xr) / (ni + 1));
    xs.forEach(function (x) {
      if (Math.abs(x) < xr - 1) { bestandsSparren(x, -300, yF - 60); bestandsSparren(x, yO + 60, yR); }
      else bestandsSparren(x, -300, yR);
    });
    // Dachflaeche (nur angedeutet, durchscheinend), mit Oeffnung fuer die Gaube
    var Wd = W + 300;
    function flaeche(x0, x1, y0, y1) {
      if (x1 - x0 < 10 || y1 - y0 < 10) return;
      var xm = (x0 + x1) / 2, d = 45 / 2 / cA;
      alt(Holz.balken('Dachfläche (Bestand)', new V3(xm, y0, dachZ(y0) + d), new V3(xm, y1, dachZ(y1) + d), x1 - x0, 45, { hoch: hoch, lot: [true, true] }), true);
    }
    flaeche(-Wd, -Bx / 2, -300, yR); flaeche(Bx / 2, Wd, -300, yR);
    flaeche(-Bx / 2, Bx / 2, -300, yF); flaeche(-Bx / 2, Bx / 2, yO, yR);

    // Neu: Wechsel zwischen den Wechselsparren, unten unter der Front und oben am Anschluss
    var wq = F.pfette(2 * xr, 1500, 160);
    [[yF, 'Wechsel unten'], [yO, 'Wechsel oben']].forEach(function (e) {
      T.push(Holz.balken(e[1], new V3(-xr + sbB / 2, e[0], dachZ(e[0]) - dz / 2), new V3(xr - sbB / 2, e[0], dachZ(e[0]) - dz / 2), wq.b, Math.min(wq.h, sbH), { bearb: ['House', 'House', 'Drilling', 'Drilling'] }));
    });
    // Gaubenfront: Schwelle, Raehm, Staender (Oeffnungen fuer Fenster bleiben frei)
    var yW = yF + q / 2;
    T.push(Holz.balken('Schwelle', new V3(-Bx / 2, yW, zF + q / 2), new V3(Bx / 2, yW, zF + q / 2), q, q, { bearb: ['Lap', 'Lap', 'Mortise', 'Mortise', 'Drilling', 'Drilling'] }));
    T.push(Holz.balken('Rähm', new V3(-Bx / 2, yW, zT - q / 2), new V3(Bx / 2, yW, zT - q / 2), q, q, { bearb: ['Lap', 'Lap', 'Mortise', 'Mortise'] }));
    var nf = Math.max(2, Math.ceil((Bx - q) / 1300) + 1);
    for (var f = 0; f < nf; f++) {
      var xf = -Bx / 2 + q / 2 + f * (Bx - q) / (nf - 1);
      T.push(Holz.balken(f === 0 || f === nf - 1 ? 'Eckständer' : 'Fensterständer', new V3(xf, yW, zF + q), new V3(xf, yW, zT - q), q, q, { bearb: ['Tenon', 'Tenon'] }));
    }
    // Gaubenwangen: Schwelle auf dem Dach, Raehm unter den Gaubensparren, Staender dazwischen
    var yA = yF + q, yE = yO - 80;
    [-1, 1].forEach(function (s) {
      var xw = s * (Bx / 2 - q / 2);
      T.push(Holz.balken('Wangenschwelle', new V3(xw, yA, dachZ(yA) + q / 2 / cA), new V3(xw, yE, dachZ(yE) + q / 2 / cA), q, q, { hoch: hoch, lot: [true, true], bearb: ['JackRafterCut', 'JackRafterCut', 'Mortise', 'Mortise'] }));
      T.push(Holz.balken('Wangenrähm', new V3(xw, yA, gaubeZ(yA) - q / 2 / cB), new V3(xw, yE, gaubeZ(yE) - q / 2 / cB), q, q, { lot: [true, true], bearb: ['JackRafterCut', 'JackRafterCut', 'Mortise', 'Mortise'] }));
      for (var y = yA + 550; y < yE - 150; y += 625) {
        var z0 = dachZ(y) + q / cA, z1 = gaubeZ(y) - q / cB;
        if (z1 - z0 > 120) T.push(Holz.balken('Wangenständer', new V3(xw, y, z0), new V3(xw, y, z1), q, 60, { hoch: new V3(0, 1, 0), bearb: ['JackRafterCut', 'JackRafterCut'] }));
      }
    });
    // Gaubensparren (Schleppgaube) bzw. Gaubenbalken (Flachdachgaube)
    var sq = F.sparren((yO - yF + ue) / cB, 650, 140), n = Math.max(3, Math.round((Bx + 2 * ueS - sq.b) / 650) + 1);
    for (var j = 0; j < n; j++) {
      var xg = -Bx / 2 - ueS + sq.b / 2 + j * (Bx + 2 * ueS - sq.b) / (n - 1), y0 = yF - ue, y1 = yO;
      var off = sq.h / 2 / cB;
      T.push(Holz.balken(art === 'flach' ? 'Gaubenbalken' : 'Gaubensparren', new V3(xg, y0, gaubeZ(y0) + off), new V3(xg, y1, gaubeZ(y1) + off), sq.b, sq.h, { lot: [true, false], bearb: ['JackRafterCut', 'JackRafterCut', 'BirdsMouth', 'BirdsMouth'] }));
    }
    var m = fertig(T, (art === 'flach' ? 'Flachdachgaube ' : 'Schleppgaube ') + Holz.zahl(Bx / 1000, 2) + ' m breit, Dach ' + ag + '°');
    m.kontext = K;
    m.gaube = { art: art, neigungGaube: bg, tiefe: yO - yF, frontHoehe: Hf };
    return m;
  };

  function fertig(T, name) {
    T.forEach(function (t, i) { t.nr = i + 1; });
    return { quelle: 'generator', format: 'Beispielmodell', name: name, teile: T, zeilen: Holz.gruppieren(T), hinweise: [] };
  }

  /* ---------- BTLx schreiben (nur fuer die Beispieldatei der Demo) ---------- */
  function f3(x) { return (Math.round(x * 1000) / 1000).toFixed(3); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  Holz.alsBTLx = function (modell) {
    var z = [];
    z.push('<?xml version="1.0" encoding="UTF-8"?>');
    z.push('<!-- Beispieldatei fuer die Demo der Anfrage-Seite. Nicht fuer die Maschine: Bearbeitungen sind nur benannt, nicht bemasst. -->');
    z.push('<BTLx xmlns="https://www.design2machine.com" Version="2.1.0" Language="de">');
    z.push('  <FileHistory><InitialExportProgram CompanyName="Demo" ProgramName="Beispiel-Generator" ProgramVersion="1.0" ComputerName="" UserName="" FileName="' + esc(modell.name) + '.btlx" Date="' + new Date().toISOString().slice(0, 10) + '" Time="12:00:00" Comment="Demo"/></FileHistory>');
    z.push('  <Project Name="' + esc(modell.name) + '">');
    z.push('    <Parts>');
    modell.teile.forEach(function (t, i) {
      z.push('      <Part SingleMemberNumber="' + (i + 1) + '" AssemblyNumber="" OrderNumber="' + (i + 1) + '" Designation="' + esc(t.name) + '" Annotation="" Storey="" Group="' + esc(t.gruppe || '') + '" Package="" Material="' + esc(t.material) + '" TimberGrade="' + esc(t.guete) + '" QualityGrade="" Count="1" Length="' + f3(t.L) + '" Height="' + f3(t.H) + '" Width="' + f3(t.B) + '" Weight="' + f3(t.L * t.B * t.H / 1e9 * Holz.DICHTE) + '" ProcessingQuality="automatic" StoreyType="" ElementNumber="00" Layer="0" ModuleNumber="">');
      z.push('        <Transformations><Transformation GUID="{' + guid(i) + '}"><Position>');
      z.push('          <ReferencePoint X="' + f3(t.ref.x) + '" Y="' + f3(t.ref.y) + '" Z="' + f3(t.ref.z) + '"/>');
      z.push('          <XVector X="' + f3(t.xv.x) + '" Y="' + f3(t.xv.y) + '" Z="' + f3(t.xv.z) + '"/>');
      z.push('          <YVector X="' + f3(t.yv.x) + '" Y="' + f3(t.yv.y) + '" Z="' + f3(t.yv.z) + '"/>');
      z.push('        </Position></Transformation></Transformations>');
      z.push('        <GrainDirection X="1" Y="0" Z="0" Align="no"/><ReferenceSide Side="1" Align="no"/>');
      z.push('        <Processings>');
      (t.bearb || []).forEach(function (b, bi) {
        z.push('          <' + b + ' Name="' + esc(Holz.bearbeitungDe(b)) + '" Process="yes" Priority="0" ProcessID="' + (bi + 1) + '" ReferencePlaneID="1"/>');
      });
      z.push('        </Processings>');
      var idx = [], pts = [];
      for (var k = 0; k < t.tri.length; k += 9) { idx.push(k / 3, k / 3 + 1, k / 3 + 2, -1); }
      for (var p = 0; p < t.tri.length; p++) pts.push(f3(t.tri[p]));
      z.push('        <Shape><IndexedFaceSet convex="true" coordIndex="' + idx.join(' ') + '"><Coordinate point="' + pts.join(' ') + '"/></IndexedFaceSet></Shape>');
      z.push('      </Part>');
    });
    z.push('    </Parts>');
    z.push('  </Project>');
    z.push('</BTLx>');
    return z.join('\n');
  };
  function guid(i) { var h = ('00000000' + (i + 1).toString(16)).slice(-8); return h + '-0000-4000-8000-' + ('000000000000' + (i * 7919 + 13).toString(16)).slice(-12); }
})();
