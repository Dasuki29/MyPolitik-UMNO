/* ==========================================================================
   Nusa Politik — js/geo.js
   Penyesuai (adapter) data peta sempadan dan demografi.

   Modul ini HANYA pembekal data visual dan statistik. Ia tidak menyentuh
   mesyuarat, hierarki jawatan, AP, dana atau pemilihan. Tiada modul lain
   perlu diubah; sambungkan apabila anda mahu.

   Fail data (dijana oleh tools/build-geo.js): data/
     negeri.json, parlimen.json, dun.json, demografi.json, meta.json

   1. LOADER        await MyPolitikGeo.muat(['negeri','parlimen','dun'])
                    await MyPolitikGeo.muatDM('10')        // Daerah Mengundi (= Lokaliti/Cawangan), pemilih SEBENAR; Selangor = '10'
   2. DEMOGRAFI     MyPolitikGeo.getDemografi('parlimen', 'P.097')   // objek bernama permainan
                    MyPolitikGeo.kunciDariCawangan(profil | cawangan) // { negeri, parlimen, dun }
                    MyPolitikGeo.perkaya(data)                        // lampirkan .geo (tak boleh dikira/disimpan)
   3. PAPARAN SVG   MyPolitikGeo.mount(elemen, { peringkat, warna, fokus, onPilih })
   4. PHASER/Canvas MyPolitikGeo.toPolygons(fitur, { skala }) -> [[{x,y},...]]   (untuk Graphics.fillPoints)

   Nama medan permainan (boleh diubah melalui CONFIG.ALIAS atau opts.alias):
     NAMA_KAWASAN, KOD_KAWASAN, JUMLAH_PEMILIH (ANGGARAN), JUMLAH_PENDUDUK,
     LUAS_KM2, PERATUS_BUMI, PERATUS_CINA, PERATUS_INDIA, PERATUS_LAIN,
     PENDAPATAN_MEDIAN, KADAR_KEMISKINAN, TAHAP_KESUKARAN (1-5, heuristik)
   Peringkat 'dm' (hanya negeri yang fail dm-<kod>.json ada, kini Selangor) memberi NAMA_DM dan
   JUMLAH_PEMILIH sebenar (ANGGARAN=false). Peringkat lain: JUMLAH_PEMILIH ialah anggaran (ANGGARAN=true).
   Kunci DM sepadan dengan ID Sheet: '097/013/001' -> '097/13/01'.

   Kredit data (wajib dipaparkan, lihat Open Data License DOSM): KREDIT.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikGeo = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var CONFIG = {
    BASE: 'data/',
    ALIAS: {}                                   // cth { JUMLAH_PEMILIH: 'JUMLAH_PEMILIH_ANGGARAN' }
  };
  var KREDIT = 'Data sempadan dan banci 2020: Jabatan Perangkaan Malaysia (DOSM), Open Data License. Bukan produk rasmi; jumlah pemilih peringkat negeri/parlimen/DUN ialah anggaran.';
  var PERINGKAT = ['negeri', 'parlimen', 'dun'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------------------------------
     1. LOADER
     ------------------------------------------------------------------------ */
  var cache = {};                               // nama -> Promise
  function ambil(nama) {
    if (!cache[nama]) {
      // Sengaja tanpa pengepala khas (cth. cache:'no-store') supaya tiada preflight CORS.
      cache[nama] = root.fetch(CONFIG.BASE + nama + '.json').then(function (r) {
        if (!r.ok) { throw new Error('Gagal memuat ' + nama + '.json (' + r.status + ')'); }
        return r.json();
      }).catch(function (e) { delete cache[nama]; throw e; });
    }
    return cache[nama];
  }
  var data = { meta: null, demografi: null, fitur: {}, indeks: {}, dmNegeri: {} };

  /** Muat peringkat yang diminta (dan meta + demografi). Pulang Promise. */
  function muat(peringkat) {
    var senarai = peringkat == null ? PERINGKAT : (Array.isArray(peringkat) ? peringkat : [peringkat]);
    senarai.forEach(function (p) { if (PERINGKAT.indexOf(p) < 0) { throw new Error('Peringkat tidak sah: ' + p); } });
    var tugas = [ambil('meta'), ambil('demografi')].concat(senarai.map(ambil));
    return Promise.all(tugas).then(function (h) {
      var dmLama = data.demografi && data.demografi.dm;
      data.meta = h[0]; data.demografi = h[1]; if (dmLama) { data.demografi.dm = dmLama; }
      senarai.forEach(function (p, i) {
        var j = h[2 + i]; data.fitur[p] = j.fitur;
        var ix = {}; j.fitur.forEach(function (f) { ix[f.id] = f; }); data.indeks[p] = ix;
      });
      return api;
    });
  }
  /** Untuk ujian Node / pemuat tersuai: suntik data yang sudah dibaca. */
  function suntik(o) {
    data.meta = o.meta; data.demografi = o.demografi; if (o.dm) { suntikDM(o.dm); }
    PERINGKAT.forEach(function (p) {
      if (o[p]) { data.fitur[p] = o[p].fitur; var ix = {}; o[p].fitur.forEach(function (f) { ix[f.id] = f; }); data.indeks[p] = ix; }
    });
    return api;
  }
  /** Muat Daerah Mengundi satu negeri (cth. '10' = Selangor). Perlu muat() dahulu atau serentak. */
  function muatDM(kodNegeri) {
    kodNegeri = String(kodNegeri);
    return Promise.all([ambil('meta'), ambil('demografi'), ambil('dm-' + kodNegeri)]).then(function (h) {
      data.meta = h[0]; data.demografi = data.demografi || h[1]; suntikDM(h[2]); return api;
    });
  }
  function suntikDM(j) {
    data.fitur.dm = (data.fitur.dm || []).filter(function (f) { return f.negeri !== j.negeri; }).concat(j.fitur);
    data.indeks.dm = {}; data.fitur.dm.forEach(function (f) { data.indeks.dm[f.id] = f; });
    data.demografi = data.demografi || {}; data.demografi.dm = Object.assign(data.demografi.dm || {}, j.demografi);
    data.dmNegeri[j.negeri] = true;
    return api;
  }
  function getFitur(p) { return data.fitur[p] || []; }
  function getMeta() { return data.meta; }

  /* ------------------------------------------------------------------------
     2. DEMOGRAFI -> OBJEK PERMAINAN
     ------------------------------------------------------------------------ */
  var PETA_MEDAN = {
    NAMA_KAWASAN: 'nama', KOD_KAWASAN: 'kod', JUMLAH_PEMILIH: 'pemilih', JUMLAH_PENDUDUK: 'penduduk', LUAS_KM2: 'luas',
    PERATUS_BUMI: 'bumi', PERATUS_CINA: 'cina', PERATUS_INDIA: 'india', PERATUS_LAIN: 'lain',
    PENDAPATAN_MEDIAN: 'pendapatanMedian', KADAR_KEMISKINAN: 'kemiskinan', TAHAP_KESUKARAN: 'kesukaran'
  };
  var SALIN = {};
  function gunaAlias(o, alias) {
    var peta = Object.assign({}, CONFIG.ALIAS, alias || {}), hasil = Object.assign({}, o);
    Object.keys(peta).forEach(function (baru) {
      var lama = peta[baru];
      if (Object.prototype.hasOwnProperty.call(o, lama)) { hasil[baru] = o[lama]; }
    });
    return hasil;
  }
  /** Entri demografi mentah -> objek dengan nama medan permainan (+ alias). Pulang null jika tiada. */
  function getDemografi(peringkat, kod, alias) {
    var d = data.demografi && data.demografi[peringkat] && data.demografi[peringkat][kod];
    if (!d) { return null; }
    var o = { PERINGKAT: peringkat };
    Object.keys(PETA_MEDAN).forEach(function (k) { o[k] = d[PETA_MEDAN[k]] == null ? null : d[PETA_MEDAN[k]]; });
    o.ANGGARAN = true;                                  // JUMLAH_PEMILIH ialah anggaran, bukan daftar pemilih sebenar
    if (peringkat === 'dm') {                           // Daerah Mengundi: data sebenar
      o.ANGGARAN = false; o.NAMA_DM = d.nama; o.NAMA_DUN = d.namaDun; o.NAMA_PARLIMEN = d.namaParlimen;
      o.KOD_DUN = d.dun; o.KOD_PARLIMEN = d.parlimen;
    }
    return gunaAlias(o, alias);
  }

  function dua(n) { n = parseInt(n, 10); return (n < 10 ? '0' : '') + n; }
  function tiga(n) { n = parseInt(n, 10); return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
  /**
   * Padankan cawangan/profil permainan dengan kunci geo.
   * Menerima profil pemain (profil.kod.parlimen/.dun), objek cawangan (id '097/013/001')
   * atau teks ID ('009/097/013/001' atau '097/013/001').
   * Pulang { negeri:'10', parlimen:'P.097', dun:'10_N.13', dm:'097/13/01' } (medan null jika tidak ditemui; dm hanya jika dimuatDM).
   */
  function kunciDariCawangan(x) {
    var par = null, dn = null;
    if (x && x.kod && x.kod.parlimen) { par = x.kod.parlimen; dn = x.kod.dun; }
    else {
      var id = typeof x === 'string' ? x : (x && (x.idSheet || x.id)) || '', b = String(id).split('/');
      if (b.length >= 3) { par = b[b.length - 3]; dn = b[b.length - 2]; }
    }
    var lok = null;
    if (par != null && x && x.kod && x.kod.lokaliti != null) { lok = x.kod.lokaliti; }
    else if (par != null && typeof x !== 'object') { var bb = String(x).split('/'); lok = bb[bb.length - 1]; }
    else if (par != null && x && (x.idSheet || x.id)) { var b2 = String(x.idSheet || x.id).split('/'); lok = b2[b2.length - 1]; }
    if (par == null) { return { negeri: null, parlimen: null, dun: null, dm: null }; }
    var kodP = 'P.' + tiga(par), dP = data.demografi && data.demografi.parlimen[kodP];
    var neg = dP ? dP.negeri : (data.meta && data.meta.negeriDariParlimen ? data.meta.negeriDariParlimen[kodP] : null);
    var kodD = neg && dn != null ? neg + '_N.' + dua(dn) : null;
    if (kodD && data.demografi && !data.demografi.dun[kodD]) { kodD = null; }      // cth. Wilayah Persekutuan tiada DUN
    var kodM = lok != null ? tiga(par) + '/' + dua(dn) + '/' + dua(lok) : null;
    if (kodM && !(data.demografi && data.demografi.dm && data.demografi.dm[kodM])) { kodM = null; }   // null jika DM negeri itu belum dimuat
    return { negeri: neg || null, parlimen: dP ? kodP : null, dun: kodD, dm: kodM };
  }

  /**
   * Lampirkan data geo pada data parti (hasil MyPolitikData.loadPartyData) TANPA mengubah
   * medan sedia ada: sifat `geo` ditambah sebagai bukan-enumerable, jadi JSON.stringify,
   * Object.keys dan penyimpanan tidak terkesan. Pulang data yang sama.
   *   negeri.geo, bahagian.geo (parlimen), dun.geo, cawangan.geo (DM, jika dimuatDM)
   */
  function perkaya(partyData, alias) {
    if (!partyData || !data.demografi) { return partyData; }
    function lekat(o, nilai) { if (o && nilai) { Object.defineProperty(o, 'geo', { value: nilai, enumerable: false, configurable: true, writable: true }); } }
    (partyData.bahagian || []).forEach(function (b) {
      var kodP = 'P.' + tiga(b.kod || b.id), dP = data.demografi.parlimen[kodP];
      lekat(b, getDemografi('parlimen', kodP, alias));
      (b.dun || []).forEach(function (d) {
        var kodD = dP ? dP.negeri + '_N.' + dua(d.kod) : null;
        lekat(d, kodD ? getDemografi('dun', kodD, alias) : null);
        (d.cawangan || []).forEach(function (c) {          // Cawangan = Daerah Mengundi (jika dimuatDM)
          var km = tiga(b.kod || b.id) + '/' + dua(d.kod) + '/' + dua(c.kod);
          lekat(c, data.demografi.dm && data.demografi.dm[km] ? getDemografi('dm', km, alias) : null);
        });
      });
    });
    (partyData.negeri || []).forEach(function (n) {
      var b0 = (n.bahagian || [])[0], dP = b0 ? data.demografi.parlimen['P.' + tiga(b0.kod || b0.id)] : null;
      lekat(n, dP ? getDemografi('negeri', dP.negeri, alias) : null);
    });
    return partyData;
  }

  /* ------------------------------------------------------------------------
     3. LALUAN SVG -> POLIGON (Phaser / Canvas)
     ------------------------------------------------------------------------ */
  /** Huraikan "M x y l dx dy ... z" kepada gelang [[{x,y}...], ...]. skala/ofset pilihan. */
  function toPolygons(fitur, o) {
    o = o || {}; var sk = o.skala == null ? 1 : o.skala, ox = o.ofsetX || 0, oy = o.ofsetY || 0, d = typeof fitur === 'string' ? fitur : fitur.d;
    var hasil = [], gel = null, x = 0, y = 0, re = /([Mlz])([^Mlz]*)/g, m;
    while ((m = re.exec(d))) {
      if (m[1] === 'M') { var a = m[2].trim().split(/\s+/); x = +a[0]; y = +a[1]; gel = [{ x: x * sk + ox, y: y * sk + oy }]; hasil.push(gel); }
      else if (m[1] === 'l') {
        var n = m[2].trim().split(/\s+/);
        for (var i = 0; i + 1 < n.length; i += 2) { x += +n[i]; y += +n[i + 1]; gel.push({ x: x * sk + ox, y: y * sk + oy }); }
      }
    }
    return hasil;
  }
  /** Titik tengah (bbox) dalam koordinat peta. */
  function pusat(f) { return { x: (f.bbox[0] + f.bbox[2]) / 2, y: (f.bbox[1] + f.bbox[3]) / 2 }; }

  /* ------------------------------------------------------------------------
     4. PAPARAN SVG INTERAKTIF
     opts: {
       peringkat: 'negeri'|'parlimen'|'dun'  (lalai 'negeri')
       negeri:    kod negeri untuk ditapis/dizum (cth. '10'); lalai semua
       warna:     'pemilih' | 'kesukaran' | 'bumi' | 'kepadatan' | 'tiada' | fungsi(fitur, demografi) -> warna CSS
       fokus:     profil / cawangan / {negeri,parlimen,dun} untuk disorot kawasan pemain
       latar:     true -> mod latar belakang (malap, tidak interaktif, aria-hidden)
       onPilih(fitur, demografi), onHover(fitur, demografi|null)
       alias:     alias medan untuk callback
       kredit:    false untuk sembunyi kredit (TIDAK disyorkan)
     }
     Pulang { setPeringkat, setWarna, zumKe(negeri), pilih(kod), destroy, svg }
     ------------------------------------------------------------------------ */
  var CSS = '.geo{position:relative;width:100%;font:inherit;color:var(--text,#F4F5F7)}' +
    '.geo svg{display:block;width:100%;height:auto;max-height:70vh;background:transparent}' +
    '.geo path{stroke:var(--bg,#0E0F13);stroke-width:.6;vector-effect:non-scaling-stroke;fill-rule:evenodd;transition:fill .15s}' +
    '.geo--aktif path{cursor:pointer}.geo--aktif path:hover,.geo--aktif path:focus-visible{stroke:var(--gold-light,#FFD84D);stroke-width:1.6;outline:none}' +
    '.geo path.is-fokus{stroke:var(--gold,#F2B705);stroke-width:2.2}.geo path.is-pilih{stroke:#fff;stroke-width:2.2}' +
    '.geo--latar{position:absolute;inset:0;opacity:.18;pointer-events:none}.geo--latar svg{height:100%;max-height:none}' +
    '.geo__tip{position:absolute;z-index:5;pointer-events:none;background:var(--bg-elev-3,#262A34);border:1px solid var(--border,#2E333F);border-radius:8px;padding:6px 10px;font-size:.78rem;line-height:1.4;max-width:240px;display:none}' +
    '.geo__bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;font-size:.8rem}' +
    '.geo__leg{display:flex;gap:4px;align-items:center;font-size:.72rem;opacity:.85;margin-top:6px;flex-wrap:wrap}.geo__leg i{display:inline-block;width:14px;height:10px;border-radius:2px}' +
    '.geo__kredit{margin:6px 0 0;font-size:.68rem;opacity:.65}';
  function suntikCSS(d) { if (d.getElementById('geo-css')) { return; } var s = d.createElement('style'); s.id = 'geo-css'; s.textContent = CSS; d.head.appendChild(s); }

  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function campur(t) {                                         // gelap -> emas
    t = Math.max(0, Math.min(1, t)); var a = [38, 42, 52], b = [242, 183, 5];
    return 'rgb(' + lerp(a[0], b[0], t) + ',' + lerp(a[1], b[1], t) + ',' + lerp(a[2], b[2], t) + ')';
  }
  var KESUKARAN_WARNA = { 1: '#2F9E6B', 2: '#7BB661', 3: '#E0B93A', 4: '#E07B39', 5: '#C8453F' };

  function bina(peringkat, nilaiFn) {                           // fungsi skala warna ikut persentil
    var nilai = getFitur(peringkat).map(function (f) { var d = data.demografi[peringkat][f.id]; return d ? nilaiFn(d) : null; }).filter(function (v) { return v != null; }).sort(function (a, b) { return a - b; });
    return function (v) {
      if (v == null || !nilai.length) { return '#2A2D36'; }
      var lo = 0, hi = nilai.length; while (lo < hi) { var mid = (lo + hi) >> 1; if (nilai[mid] <= v) { lo = mid + 1; } else { hi = mid; } }
      return campur(0.1 + 0.9 * (lo / nilai.length));
    };
  }

  function mount(host, opts) {
    opts = opts || {};
    var d = host.ownerDocument || root.document;
    if (!data.meta || !data.demografi) { throw new Error('Panggil await MyPolitikGeo.muat() dahulu.'); }
    suntikCSS(d);
    var st = { peringkat: opts.peringkat || 'negeri', negeri: opts.negeri || null, warna: opts.warna || 'pemilih', pilih: null };
    if (!data.fitur[st.peringkat]) { throw new Error('Peringkat belum dimuat: ' + st.peringkat); }
    var fokus = opts.fokus ? (opts.fokus.parlimen !== undefined && opts.fokus.dun !== undefined && !opts.fokus.kod ? opts.fokus : kunciDariCawangan(opts.fokus)) : null;

    host.classList.add('geo'); if (opts.latar) { host.classList.add('geo--latar'); } else { host.classList.add('geo--aktif'); }
    host.innerHTML = '';
    var bar = d.createElement('div'); bar.className = 'geo__bar';
    var svg = d.createElementNS(SVGNS, 'svg'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    if (opts.latar) { svg.setAttribute('aria-hidden', 'true'); } else { svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Peta sempadan Malaysia'); }
    var tip = d.createElement('div'); tip.className = 'geo__tip'; tip.setAttribute('role', 'tooltip');
    var leg = d.createElement('div'); leg.className = 'geo__leg';
    if (!opts.latar) { host.appendChild(bar); }
    host.appendChild(svg); host.appendChild(tip); if (!opts.latar) { host.appendChild(leg); }
    if (opts.kredit !== false && !opts.latar) { var kr = d.createElement('p'); kr.className = 'geo__kredit'; kr.textContent = KREDIT; host.appendChild(kr); }

    function warnaFn() {
      var p = st.peringkat;
      if (typeof st.warna === 'function') { return function (f, dm) { return st.warna(f, dm); }; }
      if (st.warna === 'kesukaran') { return function (f, dm) { return dm ? KESUKARAN_WARNA[dm.kesukaran] : '#2A2D36'; }; }
      if (st.warna === 'tiada') { return function () { return '#2A2D36'; }; }
      var kunci = { pemilih: 'pemilih', bumi: 'bumi', kepadatan: null }[st.warna] || 'pemilih';
      var sk = bina(p, kunci ? function (x) { return x[kunci]; } : function (x) { return x.luas ? x.penduduk / x.luas : null; });
      return function (f, dm) { return sk(dm ? (kunci ? dm[kunci] : (dm.luas ? dm.penduduk / dm.luas : null)) : null); };
    }
    function legenda() {
      if (opts.latar) { return; }
      if (st.peringkat === 'dm' && st.warna === 'pemilih') { leg.innerHTML = 'Rendah <i style="background:' + campur(.1) + '"></i><i style="background:' + campur(.4) + '"></i><i style="background:' + campur(.7) + '"></i><i style="background:' + campur(1) + '"></i> Tinggi (pemilih sebenar)'; return; }
      if (st.warna === 'kesukaran') { leg.innerHTML = 'Tahap kesukaran: ' + [1, 2, 3, 4, 5].map(function (n) { return '<i style="background:' + KESUKARAN_WARNA[n] + '"></i>' + n; }).join(' '); }
      else if (typeof st.warna === 'function' || st.warna === 'tiada') { leg.innerHTML = ''; }
      else { leg.innerHTML = 'Rendah <i style="background:' + campur(.1) + '"></i><i style="background:' + campur(.4) + '"></i><i style="background:' + campur(.7) + '"></i><i style="background:' + campur(1) + '"></i> Tinggi (' + ({ pemilih: 'anggaran pemilih', bumi: '% Bumiputera', kepadatan: 'kepadatan penduduk' }[st.warna] || st.warna) + ')'; }
    }
    function bboxGabung(fs) {
      var b = [Infinity, Infinity, Infinity * -1, Infinity * -1];
      fs.forEach(function (f) { b[0] = Math.min(b[0], f.bbox[0]); b[1] = Math.min(b[1], f.bbox[1]); b[2] = Math.max(b[2], f.bbox[2]); b[3] = Math.max(b[3], f.bbox[3]); });
      return b;
    }
    function tunjukTip(f, dm, ev) {
      if (!dm) { tip.textContent = f.nama; }
      else {
        tip.innerHTML = '';
        var t = d.createElement('b'); t.textContent = f.nama; tip.appendChild(t);
        [[dm.ANGGARAN === false ? 'Pemilih' : 'Pemilih (anggaran)', dm.JUMLAH_PEMILIH], ['DUN', dm.NAMA_DUN], ['Penduduk', dm.JUMLAH_PENDUDUK], ['Bumiputera', dm.PERATUS_BUMI == null ? null : dm.PERATUS_BUMI + '%'], ['Kesukaran', dm.TAHAP_KESUKARAN == null ? null : dm.TAHAP_KESUKARAN + '/5']].forEach(function (r) {
          if (r[1] == null) { return; } var ln = d.createElement('div'); ln.textContent = r[0] + ': ' + (typeof r[1] === 'number' ? r[1].toLocaleString('ms-MY') : r[1]); tip.appendChild(ln);
        });
      }
      tip.style.display = 'block';
      var hb = host.getBoundingClientRect(), x = (ev && ev.clientX != null ? ev.clientX - hb.left : 20) + 12, y = (ev && ev.clientY != null ? ev.clientY - hb.top : 20) + 12;
      tip.style.left = Math.min(x, hb.width - 180) + 'px'; tip.style.top = y + 'px';
    }

    function lukis() {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      var p = st.peringkat, fs = getFitur(p).filter(function (f) { return !st.negeri || f.negeri === String(st.negeri); });
      var b = fs.length ? bboxGabung(fs) : [0, 0, data.meta.viewBox[2], data.meta.viewBox[3]], pad = Math.max(20, (b[2] - b[0]) * 0.03);
      svg.setAttribute('viewBox', [b[0] - pad, b[1] - pad, b[2] - b[0] + pad * 2, b[3] - b[1] + pad * 2].join(' '));
      var wf = warnaFn();
      fs.forEach(function (f) {
        var dm = getDemografi(p, f.id, opts.alias), el = d.createElementNS(SVGNS, 'path');
        el.setAttribute('d', f.d); el.setAttribute('fill', wf(f, data.demografi[p][f.id] || null)); el.setAttribute('data-kod', f.id);
        if (fokus && ((p === 'negeri' && f.id === fokus.negeri) || (p === 'parlimen' && f.id === fokus.parlimen) || (p === 'dun' && f.id === fokus.dun) || (p === 'dm' && f.id === fokus.dm))) { el.setAttribute('class', 'is-fokus'); }
        if (st.pilih === f.id) { el.setAttribute('class', (el.getAttribute('class') || '') + ' is-pilih'); }
        if (!opts.latar) {
          el.setAttribute('tabindex', fs.length <= 120 ? '0' : '-1'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', f.nama);
          el.addEventListener('mousemove', function (ev) { tunjukTip(f, dm, ev); if (opts.onHover) { opts.onHover(f, dm); } });
          el.addEventListener('mouseleave', function () { tip.style.display = 'none'; if (opts.onHover) { opts.onHover(null, null); } });
          el.addEventListener('focus', function () { tunjukTip(f, dm, null); });
          el.addEventListener('blur', function () { tip.style.display = 'none'; });
          var pilih = function () { st.pilih = f.id; Array.prototype.forEach.call(svg.querySelectorAll('.is-pilih'), function (n) { n.classList.remove('is-pilih'); }); el.classList.add('is-pilih'); if (opts.onPilih) { opts.onPilih(f, dm); } };
          el.addEventListener('click', pilih);
          el.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pilih(); } });
        }
        svg.appendChild(el);
      });
      legenda();
    }

    function bukaBar() {
      if (opts.latar) { return; }
      bar.innerHTML = '';
      function pilihan(label, nilai, semasa, fn) {
        var s = d.createElement('select'); s.setAttribute('aria-label', label);
        nilai.forEach(function (n) { var o = d.createElement('option'); o.value = n[0]; o.textContent = n[1]; if (n[0] === semasa) { o.selected = true; } s.appendChild(o); });
        s.addEventListener('change', function () { fn(s.value); }); bar.appendChild(s);
      }
      pilihan('Peringkat', [['negeri', 'Negeri'], ['parlimen', 'Parlimen / Bahagian'], ['dun', 'DUN'], ['dm', 'Daerah Mengundi / Cawangan']].filter(function (x) { return data.fitur[x[0]]; }), st.peringkat, function (v) { api2.setPeringkat(v); });
      pilihan('Negeri', [['', 'Semua negeri']].concat((data.fitur.negeri || []).map(function (f) { return [f.id, f.nama]; })), st.negeri || '', function (v) { api2.zumKe(v || null); });
      pilihan('Warna', (st.peringkat === 'dm' ? [['pemilih', 'Pemilih'], ['kesukaran', 'Tahap kesukaran']] : [['pemilih', 'Anggaran pemilih'], ['kesukaran', 'Tahap kesukaran'], ['bumi', '% Bumiputera'], ['kepadatan', 'Kepadatan penduduk']]), typeof st.warna === 'string' ? st.warna : 'pemilih', function (v) { api2.setWarna(v); });
    }

    var api2 = {
      svg: svg,
      setPeringkat: function (p) {
        if (!data.fitur[p]) { return false; }
        st.peringkat = p; if ((p === 'dun' || p === 'dm') && !st.negeri && fokus) { st.negeri = fokus.negeri; }
        if (p === 'dm' && (!st.negeri || !data.dmNegeri[st.negeri])) { st.negeri = Object.keys(data.dmNegeri)[0] || null; }
        if (p === 'dm' && st.warna !== 'kesukaran' && typeof st.warna === 'string') { st.warna = 'pemilih'; }
        st.pilih = null; lukis(); bukaBar(); return true; },
      setWarna: function (w) { st.warna = w; lukis(); },
      zumKe: function (negeri) { st.negeri = negeri; if (!negeri && st.peringkat === 'dun') { st.peringkat = 'parlimen'; } lukis(); bukaBar(); },
      pilih: function (kod) { st.pilih = kod; lukis(); },
      state: st,
      destroy: function () { host.innerHTML = ''; host.classList.remove('geo', 'geo--aktif', 'geo--latar'); }
    };
    if (fokus && fokus.negeri && !st.negeri && st.peringkat !== 'negeri') { st.negeri = fokus.negeri; }
    lukis(); bukaBar();
    return api2;
  }

  /* ------------------------------------------------------------------------
     GEOJSON TULEN -> fitur dalaman (v3.1)
     Membolehkan peta membaca fail GeoJSON asal (lon/lat) yang diletakkan dalam data/,
     cth. data/electoral_0_parlimen.geojson, tanpa melalui tools/build-geo.js.
     Medan dikenali (DOSM / kempen-222): code_state, state, code_parlimen, parlimen,
     code_dun, dun, code_state_dun. Gunakan opts.id / opts.nama / opts.negeri untuk fail lain.
     ------------------------------------------------------------------------ */
  var KOS_LAT = Math.cos(4 * Math.PI / 180);
  function unjurLL(lon, lat) { return [(lon - 99.5) * 1000 * KOS_LAT, (7.5 - lat) * 1000]; }
  function buangKod(teks) { return String(teks == null ? '' : teks).replace(/^[PN]\.\d+\s*/, ''); }
  function gelangKeLaluan(r, toleransi, bb) {
    var pts = [], i, p, l;
    for (i = 0; i < r.length; i++) {
      p = unjurLL(r[i][0], r[i][1]); p = [Math.round(p[0]), Math.round(p[1])]; l = pts[pts.length - 1];
      if (!l || Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) >= toleransi) { pts.push(p); }
    }
    if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) { pts.pop(); }
    if (pts.length < 3) { return ''; }
    var d = 'M' + pts[0][0] + ' ' + pts[0][1] + 'l', rel = [];
    for (i = 0; i < pts.length; i++) {
      bb[0] = Math.min(bb[0], pts[i][0]); bb[1] = Math.min(bb[1], pts[i][1]); bb[2] = Math.max(bb[2], pts[i][0]); bb[3] = Math.max(bb[3], pts[i][1]);
      if (i) { rel.push((pts[i][0] - pts[i - 1][0]) + ' ' + (pts[i][1] - pts[i - 1][1])); }
    }
    return d + rel.join(' ') + 'z';
  }
  /** FeatureCollection -> { peringkat, bil, fitur:[{id,nama,negeri,parlimen?,noDun?,bbox,d}] } */
  function daripadaGeoJSON(fc, peringkat, opts) {
    opts = opts || {};
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) { throw new Error('Bukan FeatureCollection GeoJSON yang sah.'); }
    var tol = opts.toleransi == null ? { negeri: 3, parlimen: 2, dun: 1.5, dm: 1 }[peringkat] || 2 : opts.toleransi;
    var fitur = [];
    fc.features.forEach(function (f, n) {
      var g = f.geometry, pr = f.properties || {};
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) { return; }
      var polis = g.type === 'Polygon' ? [g.coordinates] : g.coordinates, bb = [Infinity, Infinity, -Infinity, -Infinity], d = '';
      polis.forEach(function (p) { p.forEach(function (r) { d += gelangKeLaluan(r, tol, bb); }); });
      if (!d) { return; }
      var id, nama, neg = pr.code_state != null ? String(pr.code_state) : '', o;
      if (peringkat === 'negeri') { id = pr.code_state != null ? String(pr.code_state) : String(n); nama = pr.state; }
      else if (peringkat === 'parlimen') { id = pr.code_parlimen; nama = buangKod(pr.parlimen); }
      else { id = pr.code_state_dun || (neg + '_' + pr.code_dun); nama = buangKod(pr.dun); }
      if (opts.id) { id = opts.id(pr, f); } if (opts.nama) { nama = opts.nama(pr, f); } if (opts.negeri) { neg = String(opts.negeri(pr, f)); }
      o = { id: String(id), nama: nama || String(id), negeri: neg, bbox: bb, d: d };
      if (peringkat !== 'negeri' && pr.code_parlimen) { o.parlimen = pr.code_parlimen; }
      if (peringkat === 'dun' && pr.code_dun) { o.noDun = pr.code_dun; }
      fitur.push(o);
    });
    return { peringkat: peringkat, bil: fitur.length, fitur: fitur };
  }
  /** Muat fail GeoJSON tulen dan gantikan lapisan peringkat itu. Pulang Promise<api>. */
  function muatGeoJSON(peringkat, url, opts) {
    if (PERINGKAT.indexOf(peringkat) < 0) { return Promise.reject(new Error('Peringkat tidak sah: ' + peringkat)); }
    return root.fetch(url).then(function (r) {
      if (!r.ok) { throw new Error('Gagal memuat ' + url + ' (' + r.status + ')'); }
      return r.json();
    }).then(function (fc) {
      var j = daripadaGeoJSON(fc, peringkat, opts);
      data.fitur[peringkat] = j.fitur; data.indeks[peringkat] = {}; j.fitur.forEach(function (f) { data.indeks[peringkat][f.id] = f; });
      return api;
    });
  }

  var api = {
    CONFIG: CONFIG, KREDIT: KREDIT, PERINGKAT: PERINGKAT,
    muat: muat, muatDM: muatDM, suntik: suntik, suntikDM: suntikDM, getFitur: getFitur, getMeta: getMeta,
    getDemografi: getDemografi, kunciDariCawangan: kunciDariCawangan, perkaya: perkaya,
    toPolygons: toPolygons, pusat: pusat, mount: mount,
    daripadaGeoJSON: daripadaGeoJSON, muatGeoJSON: muatGeoJSON
  };
  return api;
});
