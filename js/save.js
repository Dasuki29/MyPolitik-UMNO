/* ==========================================================================
   Nusa Politik — js/save.js
   Simpan dan muat profil pemain dalam localStorage (kunci 'myPolitik_player').
   Tiada kebergantungan lain. Semua akses storan dibalut try/catch kerana
   localStorage boleh dilarang (mod peribadi, tetapan pelayar).

   Setiap simpanan menyiarkan acara 'myPolitik:player-updated' pada window
   (dan 'storage' dari tab lain), supaya dashboard.html boleh segar semula
   secara langsung melalui MyPolitikSave.subscribe(fn).

   applyEffects() ialah laluan tunggal untuk mengubah IP, MYR, AP dan
   kesetiaan. Modul tindakan (ordinaryMember.js, incumbent.js) memanggilnya.
   ========================================================================== */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSave = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  var KEY = 'myPolitik_player';
  var KEY_BAK = 'myPolitik_player_bak';      // v7.25: sandaran simpanan sah sebelumnya (watak yang sama)
  var VERSI = 2;
  var NAMA_ACARA = 'myPolitik:player-updated';
  var MAKS_LOG = 50;
  var MAKS_ISU = 12;

  // Sokongan dalam peratus (0 hingga 100).
  var KESETIAAN_LALAI = Object.freeze({
    ketuaCawangan: 50,
    ajk: 50,
    akarUmbi: 50,
    perwakilan: 40,       // Perwakilan PAU
    penentang: 30         // Penentang / Atas Pagar
  });

  var KESETIAAN_LABEL = Object.freeze({
    ketuaCawangan: 'Ketua Cawangan',
    ajk: 'AJK',
    akarUmbi: 'Akar Umbi',
    perwakilan: 'Perwakilan PAU',
    penentang: 'Atas Pagar'
  });

  // Nilai permulaan setiap pemain baharu.
  var DEFAULTS = Object.freeze({ jawatan: 'Ahli Biasa', ip: 10, myr: 1000, ap: 5, tahun: 2026, bulan: 1, reputasi: 50 });

  // v3.8: Pengaruh (IP) makin sukar ditambah apabila makin tinggi. Gandaan = 1 - IP/k, tidak kurang daripada lantai.
  var REDAMAN_IP = Object.freeze({ k: 300, lantai: 0.10 });

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }

  function storan() {
    try {
      var s = typeof localStorage !== 'undefined' ? localStorage : null;
      if (!s) { return null; }
      var ujian = '__mp_ujian__';
      s.setItem(ujian, '1'); s.removeItem(ujian);
      return s;
    } catch (e) { return null; }
  }

  function boleh() { return !!storan(); }

  function sah(p) {
    return !!(p && typeof p === 'object' && typeof p.nama === 'string' && p.nama && typeof p.id === 'string' && p.id);
  }

  var SENARAI_AVATAR = ['pemuda', 'puteri', 'wanita', 'biasa', 'veteran'];
  var SY = root.MyPolitikSayap || (typeof module === 'object' && typeof require === 'function' ? (function () { try { return require('./sayap.js'); } catch (e) { return null; } })() : null);   // v5.9
  function avatarSah(k) { return SENARAI_AVATAR.indexOf(k) >= 0; }

  /** Lengkapkan medan yang tiada (profil lama daripada versi 1) dan hadkan nilai. */
  function normalisasi(p) {
    if (!sah(p)) { return p; }
    if (!avatarSah(p.avatar)) { p.avatar = avatarSah(p.demografik && p.demografik.kategoriKod) ? p.demografik.kategoriKod : 'pemuda'; }
    if (SY && !SY.sah(p.sayap)) { p.sayap = SY.kod(p); }          // v5.9: laluan sayap (simpanan lama mengikut avatar/kategori)
    p.versi = VERSI;
    if (!p.settings || typeof p.settings !== 'object') { p.settings = {}; }
    if (['EASY', 'NORMAL', 'HARDCORE'].indexOf(p.settings.difficultyLevel) < 0) { p.settings.difficultyLevel = 'NORMAL'; }   // v7.28: simpanan lama = Biasa
    var bln = parseInt(p.bulan, 10);                 // Bulan 1 hingga 12 (sistem masa bulanan)
    p.bulan = isFinite(bln) ? Math.max(1, Math.min(12, bln)) : DEFAULTS.bulan;
    p.stress = isFinite(Number(p.stress)) ? clamp(Math.round(Number(p.stress)), 0, 100) : 0;                 // v5.6
    p.kesihatan = isFinite(Number(p.kesihatan)) ? clamp(Math.round(Number(p.kesihatan)), 0, 100) : 100;
    p.ip = Math.max(0, Math.round(Number(p.ip) || 0));
    p.ap = Math.max(0, Math.round(Number(p.ap) || 0));
    p.myr = Math.max(0, Math.round(Number(p.myr) || 0));
    var rep = Number(p.reputasi);                    // Reputasi Parti, 0 hingga 100
    p.reputasi = isFinite(rep) ? clamp(Math.round(rep), 0, 100) : DEFAULTS.reputasi;
    if (!p.kesetiaan || typeof p.kesetiaan !== 'object') { p.kesetiaan = {}; }
    Object.keys(KESETIAAN_LALAI).forEach(function (k) {
      var v = Number(p.kesetiaan[k]);
      p.kesetiaan[k] = isFinite(v) ? clamp(Math.round(v), 0, 100) : KESETIAAN_LALAI[k];
    });
    if (!Array.isArray(p.isu)) { p.isu = []; }
    if (!Array.isArray(p.log)) { p.log = []; }
    if (p.cabaran === undefined) { p.cabaran = null; }
    if (p.calon === undefined) { p.calon = null; }
    // v3.0: jawatan berbilang peringkat dan mandat perwakilan tahunan
    if (!Array.isArray(p.jawatanList)) { p.jawatanList = []; }
    if (!p.perwakilan || typeof p.perwakilan !== 'object') { p.perwakilan = { cawangan: 0, bahagian: 0 }; }
    p.perwakilan.cawangan = parseInt(p.perwakilan.cawangan, 10) || 0;
    p.perwakilan.bahagian = parseInt(p.perwakilan.bahagian, 10) || 0;
    ['sayapCawangan', 'g10', 'g2'].forEach(function (k) { p.perwakilan[k] = parseInt(p.perwakilan[k], 10) || 0; });   // v6.2: wakil sayap (G10 ke Bahagian, G2 ke Pusat)
    p.bilTindakan = Math.max(0, parseInt(p.bilTindakan, 10) || 0);
    p.amaranAktif = !!p.amaranAktif;
    // v3.6: tempoh keahlian (Fasal 15.5 dsb.), rekod penggal (Fasal 9.5) dan tataetika/disiplin (Fasal 20)
    var tahunKini = parseInt(p.tahun, 10) || DEFAULTS.tahun;
    if (!p.keahlian || typeof p.keahlian !== 'object') {
      p.keahlian = { sejakTahun: tahunKini - 3, sejakBulan: 1, lama: true };   // profil lama: dianggap sudah matang
    }
    p.keahlian.sejakTahun = parseInt(p.keahlian.sejakTahun, 10) || tahunKini;
    p.keahlian.sejakBulan = clamp(parseInt(p.keahlian.sejakBulan, 10) || 1, 1, 12);
    p.penggalSelesai = !!p.penggalSelesai;
    var e = p.etika && typeof p.etika === 'object' ? p.etika : {};
    p.etika = {
      modal: clamp(Math.round(Number(e.modal)), 0, 100) || (isFinite(Number(e.modal)) ? 0 : 10),
      risiko: clamp(Math.round(Number(e.risiko)) || 0, 0, 100),
      salah: Math.max(0, parseInt(e.salah, 10) || 0),
      amaran: Math.max(0, parseInt(e.amaran, 10) || 0),
      status: ['baik', 'digantung', 'dilarang', 'dipecat'].indexOf(e.status) >= 0 ? e.status : 'baik',
      hukuman: e.hukuman || null,
      siasatan: e.siasatan || null,
      rekod: Array.isArray(e.rekod) ? e.rekod.slice(0, 20) : []
    };
    return p;
  }

  /**
   * Bina profil lengkap pemain.
   * input: {
   *   nama,
   *   demografik: { jantina:'Lelaki'|'Perempuan', umur, kod:'pemuda'|..., label },
   *   cawangan: objek cawangan daripada data.js (id, nama, dunNama, bahagianNama, negeri, jumlahAhli, ...)
   * }
   */
  /** Bilangan tahun sudah menjadi ahli (0 = ahli baharu). Dihadkan mengikut umur (ahli sekurang-kurangnya 18 tahun). */
  function tahunAhli(n, umur) {
    var t = Math.max(0, parseInt(n, 10) || 0), u = parseInt(umur, 10) || 0;
    return u ? Math.min(t, Math.max(0, u - 18)) : t;
  }

  function buildPlayerProfile(input) {
    var c = input.cawangan, d = input.demografik;
    var idPenuh = String(c.idSheet || c.id);      // ID seperti dalam Google Sheets
    var bhg = idPenuh.split('/'), n = bhg.length;
    return normalisasi({
      versi: VERSI,
      nama: String(input.nama || '').trim(),
      negeri: c.negeri,
      bahagian: c.bahagianNama,
      dun: c.dunNama,
      cawangan: c.nama,
      id: idPenuh,
      kod: { negeri: n === 4 ? bhg[0] : null, parlimen: bhg[n - 3], dun: bhg[n - 2], lokaliti: bhg[n - 1] },
      demografik: { jantina: d.jantina, umur: d.umur, kategori: d.label, kategoriKod: d.kod },
      cawanganInfo: {
        jumlahAhli: c.jumlahAhli, lelaki: c.lelaki, perempuan: c.perempuan,
        bawah40: c.bawah40, atas40: c.atas40,
        kumpulan: c.kumpulan ? { pemuda: c.kumpulan.pemuda, puteri: c.kumpulan.puteri, wanita: c.kumpulan.wanita, induk: c.kumpulan.induk, langsung: !!c.kumpulan.langsung } : null     // v6.3
      },
      settings: { difficultyLevel: input.difficultyLevel === 'EASY' || input.difficultyLevel === 'HARDCORE' ? input.difficultyLevel : 'NORMAL' },   // v7.28: dikunci selepas daftar
      avatar: avatarSah(input.avatar) ? input.avatar : (avatarSah(d.kod) ? d.kod : 'pemuda'),   // pilihan watak (kosmetik)
      sayap: SY && SY.sah(input.sayap) && (input.sayap === 'utama' || input.sayap === d.kod) ? input.sayap : (SY ? SY.cadangan(d.jantina, d.umur) : 'utama'),   // v5.9: laluan kerjaya (Utama / Pemuda / Puteri / Wanita)
      jawatan: DEFAULTS.jawatan,
      ip: DEFAULTS.ip,
      myr: DEFAULTS.myr,
      ap: DEFAULTS.ap,
      tahun: DEFAULTS.tahun,
      bulan: DEFAULTS.bulan,
      kesetiaan: salin(KESETIAAN_LALAI),
      keahlian: { sejakTahun: DEFAULTS.tahun - tahunAhli(input.tahunAhli, d.umur), sejakBulan: 1 },
      dicipta: new Date().toISOString()
    });
  }

  function siarkan(profil, meta) {
    try {
      if (root.window && typeof root.window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        root.window.dispatchEvent(new CustomEvent(NAMA_ACARA, { detail: { profil: profil, meta: meta || null } }));
      }
    } catch (e) { /* acara tidak kritikal */ }
  }

  /**
   * v7.25: JSON.stringify yang selamat daripada rujukan bulat (circular). Rujukan bulat dibuang (bukan dilontar) dan dikira.
   * Pulang { teks, dibuang }. Rujukan kongsi yang bukan bulat dikekalkan.
   */
  function selamatSerial(nilai) {
    var tindanan = [], dibuang = 0;
    var teks = JSON.stringify(nilai, function (k, v) {
      if (v && typeof v === 'object') {
        while (tindanan.length && tindanan[tindanan.length - 1] !== this) { tindanan.pop(); }
        if (tindanan.indexOf(v) >= 0) { dibuang++; return undefined; }
        tindanan.push(v);
      }
      return v;
    });
    return { teks: teks, dibuang: dibuang };
  }
  function sahTeks(t) { try { return sah(JSON.parse(t)); } catch (e) { return false; } }

  var masaSimpan = null, dipulihkan = false;

  /** Simpan profil. Pulang { ok:true } atau { ok:false, ralat:'...' }. Bacaan semula mengesahkan simpanan; kegagalan memulihkan nilai lama. */
  function savePlayer(profil, meta) {
    if (!sah(profil)) { return { ok: false, ralat: 'Profil pemain tidak lengkap.' }; }
    var s = storan();
    if (!s) { return { ok: false, ralat: 'Pelayar menyekat storan setempat. Matikan mod peribadi atau benarkan data tapak web, kemudian cuba lagi.' }; }
    var sebelum = null;
    try {
      normalisasi(profil);
      var sr = selamatSerial(profil);
      sebelum = s.getItem(KEY);
      s.setItem(KEY, sr.teks);
      var balik = JSON.parse(s.getItem(KEY));
      if (!sah(balik) || balik.id !== profil.id) { throw new Error('semakan gagal'); }
      var lama = null; try { lama = sebelum ? JSON.parse(sebelum) : null; } catch (x) { lama = null; }
      if (lama && sah(lama) && lama.id === profil.id && sebelum !== sr.teks) { s.setItem(KEY_BAK, sebelum); }   // sandaran = simpanan sah terakhir watak yang sama
      else if (!lama || !sah(lama) || lama.id !== profil.id) { s.removeItem(KEY_BAK); }                          // watak berbeza: jangan simpan sandaran watak lain
      masaSimpan = new Date();
    } catch (e) {
      try { if (sebelum === null) { s.removeItem(KEY); } else { s.setItem(KEY, sebelum); } } catch (x) { /* abaikan */ }   // pulihkan nilai lama
      return { ok: false, ralat: 'Profil tidak dapat disimpan (storan penuh atau disekat).' };
    }
    siarkan(profil, meta);
    return { ok: true };
  }

  /** Jika simpanan utama rosak, pulihkan daripada sandaran (hanya apabila kunci utama WUJUD tetapi tidak sah). */
  function pulihDariSandaran(s) {
    try {
      var mentah = s.getItem(KEY_BAK);
      if (!mentah || !sahTeks(mentah)) { return null; }
      s.setItem(KEY, mentah);
      dipulihkan = true;
      var b = normalisasi(JSON.parse(mentah));
      siarkan(b, { pulih: true });
      return b;
    } catch (e) { return null; }
  }

  /** v7.31: migrasi simpanan lama (isi medan baharu yang hilang) sebelum normalisasi. Selamat jika infra.js tiada. */
  function migrasi(p, sandar) {
    var M = root.MyPolitikMigrasi;
    if (!M || !sah(p)) { return p; }
    try { return M.migrasi(p, { versi: VERSI, sandar: sandar }).profil || p; } catch (e) { return p; }
  }

  /** Muat profil (sentiasa lengkap). Pulang objek atau null jika tiada. Data rosak dipulihkan daripada sandaran jika ada. */
  function loadPlayer() {
    var s = storan();
    if (!s) { return null; }
    var mentah;
    try { mentah = s.getItem(KEY); } catch (e) { return null; }
    if (mentah === null) { return null; }
    try { var p = JSON.parse(mentah); if (sah(p)) { return normalisasi(migrasi(p, function (lama) { try { s.setItem(KEY_BAK, JSON.stringify(lama)); } catch (x) { /* abaikan */ } })); } } catch (e) { /* rosak: cuba sandaran */ }
    return pulihDariSandaran(s);
  }

  /** v7.25: pulang true sekali sahaja jika simpanan dipulihkan daripada sandaran (untuk makluman kepada pemain). */
  function diPulihkan() { var d = dipulihkan; dipulihkan = false; return d; }
  /** v7.25: masa simpanan berjaya terakhir dalam sesi ini (Date) atau null. */
  function terakhirDisimpan() { return masaSimpan; }

  /* v7.25: nama pendek mengikut slot. noSlot kosong / slot aktif = simpanan utama; slot lain dibaca/ditulis terus pada kunci slotnya. */
  function modulSlot() { return root.MyPolitikSlot || (typeof module === 'object' && typeof require === 'function' ? (function () { try { return require('./slot.js'); } catch (e) { return null; } })() : null); }
  function slotLain(noSlot) {
    var SL = modulSlot();
    if (noSlot === undefined || noSlot === null || !SL || !SL.nombor) { return 0; }
    var n = SL.nombor(noSlot);
    return n && n !== SL.aktif() ? n : 0;
  }
  function loadGame(noSlot) {
    var n = slotLain(noSlot), s = storan();
    if (!n) { return loadPlayer(); }
    try { var p = JSON.parse(s.getItem(modulSlot().kunci(n, 'player'))); return sah(p) ? normalisasi(migrasi(p)) : null; } catch (e) { return null; }
  }
  function saveGame(profil, noSlot) {
    var n = slotLain(noSlot), s = storan();
    if (!n) { return savePlayer(profil || loadPlayer()); }
    if (!sah(profil)) { return { ok: false, ralat: 'Profil pemain tidak lengkap.' }; }
    if (!s) { return { ok: false, ralat: 'Pelayar menyekat storan setempat.' }; }
    try { normalisasi(profil); var k = modulSlot().kunci(n, 'player'), t = selamatSerial(profil).teks; s.setItem(k, t); if (!sahTeks(s.getItem(k))) { throw new Error('semakan gagal'); } return { ok: true }; }
    catch (e) { return { ok: false, ralat: 'Profil tidak dapat disimpan (storan penuh atau disekat).' }; }
  }

  function hasPlayer() { return loadPlayer() !== null; }

  /** Gabung perubahan ke dalam profil sedia ada. */
  function updatePlayer(perubahan) {
    var p = loadPlayer();
    if (!p) { return { ok: false, ralat: 'Tiada profil pemain.' }; }
    for (var k in perubahan) { p[k] = perubahan[k]; }
    var h = savePlayer(p);
    if (h.ok) { h.profil = p; }
    return h;
  }

  function clearPlayer() {
    var s = storan();
    if (!s) { return false; }
    try { s.removeItem(KEY); s.removeItem(KEY_BAK); return true; } catch (e) { return false; }
  }

  /**
   * Laluan tunggal untuk mengubah sumber pemain.
   * kesan: { ip, myr, ap, kesetiaan:{ketuaCawangan, ajk, akarUmbi, perwakilan, penentang}, isu:{...} }
   *        nilai ialah perubahan (boleh negatif). AP dan MYR tidak boleh jatuh bawah 0
   *        (tindakan ditolak). IP tidak jatuh bawah 0. Sokongan dihadkan 0 hingga 100.
   * opts:  { log:{ tindakan, nama, ... }, patch:{ medan profil untuk digabung }, kiraTindakan:false }
   * Pulangan: { ok, perubahan:{ip,myr,ap,kesetiaan}, sebelum, profil } atau { ok:false, kod, ralat }
   * Perubahan yang dipulangkan ialah nilai sebenar selepas had dikenakan.
   */
  function applyEffects(kesan, opts) {
    opts = opts || {}; kesan = kesan || {};
    var p = loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain. Daftar dahulu di halaman utama.' }; }

    var RV = root.MyPolitikRival || null;                                                      // v7.28: perbelanjaan mengikut tahap kesukaran (hanya perbelanjaan, bukan pendapatan)
    if (RV && kesan.myr < 0 && !opts.tanpaKesukaran) { kesan = salin(kesan); kesan.myr = -Math.round(-kesan.myr * RV.pengali(p, 'belanja')); }
    var sebelum = { ip: p.ip, myr: p.myr, ap: p.ap, reputasi: p.reputasi, kesetiaan: salin(p.kesetiaan) };
    var ap = p.ap + (kesan.ap || 0), myr = p.myr + (kesan.myr || 0);
    if (ap < 0) { return { ok: false, kod: 'ap', ralat: 'Mata Tindakan (AP) tidak mencukupi.' }; }
    if (myr < 0) { return { ok: false, kod: 'myr', ralat: 'Wang (MYR) tidak mencukupi.' }; }

    var kes = kesan.kesetiaan || {};
    for (var k in kes) {
      if (!Object.prototype.hasOwnProperty.call(KESETIAAN_LALAI, k)) {
        return { ok: false, kod: 'kesetiaan', ralat: 'Jenis sokongan tidak sah: ' + k };
      }
    }

    var tambahIp = kesan.ip || 0;
    if (tambahIp > 0) { tambahIp = Math.max(1, Math.round(tambahIp * clamp(1 - p.ip / REDAMAN_IP.k, REDAMAN_IP.lantai, 1))); }   // v3.8
    var tambahRep = kesan.reputasi || 0;
    if (SY) {                                                                       // v5.9: kelebihan sayap (Utama / Pemuda / Puteri / Wanita)
      var sy = SY.sesuaikan(p, { ip: tambahIp, myr: kesan.myr || 0, reputasi: tambahRep, kesetiaan: kes });
      tambahIp = sy.ip; tambahRep = sy.reputasi; kes = sy.kesetiaan; myr = p.myr + sy.myr;
    }
    p.ap = ap; p.myr = myr;
    p.ip = Math.max(0, p.ip + tambahIp);
    p.reputasi = clamp(p.reputasi + tambahRep, 0, 100);
    for (var j in kes) { p.kesetiaan[j] = clamp(p.kesetiaan[j] + kes[j], 0, 100); }
    if (kesan.isu) { p.isu.unshift(kesan.isu); p.isu = p.isu.slice(0, MAKS_ISU); }
    if (opts.kiraTindakan !== false) { p.bilTindakan += 1; }
    if (opts.patch) { for (var f in opts.patch) { p[f] = opts.patch[f]; } }

    var perubahan = { ip: p.ip - sebelum.ip, myr: p.myr - sebelum.myr, ap: p.ap - sebelum.ap, reputasi: p.reputasi - sebelum.reputasi, kesetiaan: {} };
    Object.keys(KESETIAAN_LALAI).forEach(function (n) {
      var d = p.kesetiaan[n] - sebelum.kesetiaan[n];
      if (d) { perubahan.kesetiaan[n] = d; }
    });

    if (opts.log) {
      var entri = { masa: new Date().toISOString(), tahun: p.tahun, bulan: p.bulan, perubahan: perubahan };
      for (var l in opts.log) { entri[l] = opts.log[l]; }
      p.log.unshift(entri);
      p.log = p.log.slice(0, MAKS_LOG);
    }

    var hasil = savePlayer(p, { perubahan: perubahan, tindakan: opts.log ? opts.log.tindakan : null });
    if (!hasil.ok) { return { ok: false, kod: 'simpan', ralat: hasil.ralat }; }
    return { ok: true, perubahan: perubahan, sebelum: sebelum, profil: p };
  }

  /** Format ringkas: "+10 IP, -1 AP, +15 Sokongan Ketua Cawangan". */
  function ringkasPerubahan(perubahan) {
    var bahagian = [];
    function tanda(n) { return (n > 0 ? '+' : '-') + Math.abs(n).toLocaleString('ms-MY'); }
    if (perubahan.ip) { bahagian.push(tanda(perubahan.ip) + ' IP'); }
    if (perubahan.myr) { bahagian.push((perubahan.myr > 0 ? '+' : '-') + 'MYR ' + Math.abs(perubahan.myr).toLocaleString('ms-MY')); }
    if (perubahan.ap) { bahagian.push(tanda(perubahan.ap) + ' AP'); }
    if (perubahan.reputasi) { bahagian.push(tanda(perubahan.reputasi) + ' Reputasi Parti'); }
    Object.keys(perubahan.kesetiaan || {}).forEach(function (k) {
      bahagian.push(tanda(perubahan.kesetiaan[k]) + ' Sokongan ' + KESETIAAN_LABEL[k]);
    });
    return bahagian.join(', ');
  }

  /**
   * Dengar perubahan profil (tab ini melalui acara tersuai, tab lain melalui 'storage').
   * fn(profil, meta). Pulang fungsi untuk berhenti mendengar.
   */
  function subscribe(fn) {
    var w = root.window;
    if (!w || typeof w.addEventListener !== 'function') { return function () {}; }
    function dalam(ev) { fn(ev.detail.profil, ev.detail.meta); }
    function luar(ev) {
      if (ev.key === KEY || ev.key === null) { fn(loadPlayer(), { dariTabLain: true }); }
    }
    w.addEventListener(NAMA_ACARA, dalam);
    w.addEventListener('storage', luar);
    return function () { w.removeEventListener(NAMA_ACARA, dalam); w.removeEventListener('storage', luar); };
  }

  /** Rawak berbenih: seed yang sama memberi turutan yang sama. Dikongsi oleh enjin pemilihan dan mesyuarat. */
  function rngBerbenih(seed) {
    var s = String(seed), h = 1779033703 ^ s.length, i;
    for (i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    var a = (h ^= h >>> 16) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    KEY: KEY,
    rngBerbenih: rngBerbenih,
    NAMA_ACARA: NAMA_ACARA,
    DEFAULTS: DEFAULTS,
    KESETIAAN_LALAI: KESETIAAN_LALAI,
    KESETIAAN_LABEL: KESETIAAN_LABEL,
    boleh: boleh,
    buildPlayerProfile: buildPlayerProfile,
    savePlayer: savePlayer,
    loadPlayer: loadPlayer,
    saveGame: saveGame,
    loadGame: loadGame,
    selamatSerial: selamatSerial,
    diPulihkan: diPulihkan,
    terakhirDisimpan: terakhirDisimpan,
    hasPlayer: hasPlayer,
    updatePlayer: updatePlayer,
    clearPlayer: clearPlayer,
    applyEffects: applyEffects,
    ringkasPerubahan: ringkasPerubahan,
    subscribe: subscribe
  };
});
