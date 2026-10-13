/* ==========================================================================
   Nusa Politik — js/etika.js   (v3.6)
   Tempoh keahlian, Tataetika Ahli dan Disiplin (Perlembagaan UMNO 2025).

   RUJUKAN PERLEMBAGAAN / TATAETIKA
     Fasal 9.5   Calon MKT mesti pernah memegang jawatan MKT atau AJK Bahagian selama satu (1) penggal.
     Fasal 15.5  Calon AJK Bahagian mesti telah menjadi ahli sekurang-kurangnya tiga (3) tahun.
                 (Syarat 3 tahun yang sama untuk calon Sayap: Wanita 5.6/12.7, Pemuda, Puteri.)
     Fasal 20.5  Aduan dilaporkan kepada Jawatankuasa Disiplin dahulu sebelum dibawa ke Lembaga Disiplin.
     Fasal 20.7  Membawa perkara parti ke mahkamah sebelum mematuhi peraturan parti: keahlian gugur.
     Fasal 20.10 Hukuman: (a) amaran, (b) gantung hak, (c) dilarang bertanding, (d) dipecat (disahkan MKT).
     Fasal 20.12 Rayuan: gantung selepas 2 tahun, pecat selepas 3 tahun.
     Fasal 20.13 Larangan menyalahguna kuasa dan wang untuk mendapat undi.
     Tataetika Perkara 5.1 (rasuah/sogokan), 5.2 (ugutan), 5.3 (fitnah di media), 5.6 (kenduri berkempen),
                 Perkara 6 (derma).

   ANDAIAN PERMAINAN (boleh diubah dalam CONFIG)
     - Tempoh gantung 12 bulan dan larangan bertanding 36 bulan ialah angka permainan; Perlembagaan
       menyerahkan tempoh kepada Majlis Kerja Tertinggi.
     - Pemecatan memerlukan pengesahan MKT; permainan menunjukkannya sebagai langkah dalam mesej,
       bukan peringkat berasingan.
     - "Penggal" = 3 tahun (satu kitaran pemilihan).

   DATA PADA PROFIL
     profil.keahlian  = { sejakTahun, sejakBulan }
     profil.penggalSelesai = true  (pernah memegang jawatan Bahagian/Pusat satu penggal, walaupun sudah kalah)
     profil.etika = { modal, risiko, salah, amaran, status, hukuman, siasatan, rekod }
        modal    0-100 Modal Sosial (kempen bersih). Menambah kekuatan undi dan mengurangkan risiko dilapor.
        risiko   0-100 pendedahan salah laku yang belum dilapor. Susut 15% sebulan.
        status   'baik' | 'digantung' | 'dilarang' | 'dipecat'
        siasatan { perkara, fasal, berat 1-3, tahun, bulan, fasa:'aduan'|'pendengaran', pembelaan }
        hukuman  { jenis, tahun, bulan, tamatTahun, tamatBulan, perkara, fasal }
   ========================================================================== */
(function (root, factory) {
  var S = root.MyPolitikSave || (typeof module === 'object' && typeof require === 'function' ? require('./save.js') : null);
  if (!S) { throw new Error('etika.js memerlukan js/save.js dimuatkan dahulu.'); }
  var api = factory(S);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikEtika = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (S) {
  'use strict';

  var CONFIG = {
    BULAN_KEAHLIAN: 36,          // Fasal 15.5 (3 tahun)
    BULAN_PENGGAL: 36,           // satu penggal
    BULAN_GANTUNG: 12,
    BULAN_LARANGAN: 36,
    BULAN_RAYUAN_PECAT: 36,      // Fasal 20.12.2
    PENYUSUTAN_RISIKO: 0.85,
    BERAT_MODAL_UNDI: 0.08,      // bonus kekuatan undi = modal x 0.08 (maks +8)
    BERAT_MODAL_RISIKO: 0.35,    // modal mengurangkan peluang dilapor
    BERAT_RISIKO_LAPOR: 0.5,     // risiko terkumpul menambah peluang dilapor
    KEMASAN_MODAL_MAKS: 100
  };

  var HUKUMAN_NAMA = { amaran: 'Amaran', digantung: 'Gantung hak keahlian', dilarang: 'Dilarang bertanding', dipecat: 'Dipecat daripada parti' };

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function mutlak(tahun, bulan) { return tahun * 12 + (bulan - 1); }

  function getEtika(p) {
    var e = p && p.etika ? salin(p.etika) : null;
    return e || { modal: 10, risiko: 0, salah: 0, amaran: 0, status: 'baik', hukuman: null, siasatan: null, rekod: [] };
  }

  /* ------------------------------------------------------------------------
     TEMPOH KEAHLIAN (Fasal 15.5) DAN PENGGAL (Fasal 9.5)
     ------------------------------------------------------------------------ */
  function bulanKeahlian(p) {
    if (!p || !p.keahlian) { return 9999; }
    return Math.max(0, mutlak(p.tahun, p.bulan) - mutlak(p.keahlian.sejakTahun, p.keahlian.sejakBulan));
  }

  /** { sah, bulan, perlu, baki, tahunLayak, sebab } */
  function semakKeahlian(p, perlu, fasal) {
    perlu = perlu || CONFIG.BULAN_KEAHLIAN;
    var bulan = bulanKeahlian(p), sah = bulan >= perlu, baki = Math.max(0, perlu - bulan);
    return {
      sah: sah, bulan: bulan, perlu: perlu, baki: baki,
      sebab: sah ? '' : 'Perlu menjadi ahli sekurang-kurangnya ' + Math.round(perlu / 12) + ' tahun (' + (fasal || 'Fasal 15.5') + '). Anda ahli ' + bulan + ' bulan; ' + baki + ' bulan lagi.'
    };
  }

  /** Fasal 9.5: pernah memegang jawatan Bahagian/Pusat selama satu penggal. J = jawatan.js */
  function semakPenggal(p, J) {
    if (p && p.penggalSelesai) { return { sah: true, sebab: '' }; }
    var senarai = J ? J.getJawatan(p) : [];
    var ok = senarai.some(function (j) {
      return (j.peringkat === 'bahagian' || j.peringkat === 'pusat') && j.tahun && (p.tahun - j.tahun) >= CONFIG.BULAN_PENGGAL / 12;
    });
    return {
      sah: ok,
      sebab: ok ? '' : 'Fasal 9.5: calon MKT mesti pernah memegang jawatan MKT atau AJK Bahagian selama satu (1) penggal (3 tahun).'
    };
  }

  /* ------------------------------------------------------------------------
     HAK AHLI
     jenis: 'jawatan' | 'perwakilan' | 'kempen' | 'mesyuarat' | 'tindakan'
     ------------------------------------------------------------------------ */
  function semakHak(p, jenis) {
    var e = getEtika(p), h = e.hukuman;
    if (e.status === 'dipecat') {
      return { boleh: false, sebab: 'Keahlian anda telah dipecat (Fasal 20.10d). Rayuan boleh dibuat selepas 3 tahun (Fasal 20.12.2).' };
    }
    if (e.status === 'digantung' && jenis !== 'tindakan') {
      if (jenis === 'tugas_jawatan') {
        return { boleh: false, sebab: 'Keahlian anda digantung sehingga ' + tarikhTamat(h) + '. Anda dilucutkan daripada semua jawatan dan tidak boleh menggunakan AP untuk tugas rasmi jawatan (Fasal 20.10b).' };
      }
      return { boleh: false, sebab: 'Hak keahlian anda digantung sehingga ' + tarikhTamat(h) + ' (Fasal 20.10b). Anda tidak boleh mencalon, mengundi atau bertanding.' };
    }
    if (e.status === 'dilarang' && jenis === 'jawatan') {
      return { boleh: false, sebab: 'Anda dilarang bertanding jawatan sehingga ' + tarikhTamat(h) + ' (Fasal 20.10c).' };
    }
    return { boleh: true, sebab: '' };
  }

  /**
   * v4.6: untuk simpanan lama / sebarang laluan yang terlepas. Jika status 'digantung' tetapi pemain masih
   * memegang jawatan, lucutkan sekarang. Idempotent; pulang true jika ada perubahan.
   */
  function kuatkuasaGantung() {
    var p = S.loadPlayer();
    if (!p || getEtika(p).status !== 'digantung') { return false; }
    var ada = (p.jawatan && p.jawatan !== 'Ahli Biasa') || (p.jawatanList && p.jawatanList.length) || (p.perwakilan && (p.perwakilan.cawangan || p.perwakilan.bahagian));
    if (!ada) { return false; }
    var e = getEtika(p); if (e.hukuman) { e.hukuman.jawatanDilucut = p.jawatan || ''; }
    var r = S.applyEffects({}, { kiraTindakan: false, patch: { etika: e, jawatanList: [], jawatan: 'Ahli Biasa', cabaran: null, amaranAktif: false, perwakilan: { cawangan: 0, bahagian: 0 } },
      log: { tindakan: 'disiplin', nama: 'Jawatan dilucutkan (digantung)', peringkat: 'disiplin' } });
    return !!(r && r.ok);
  }

  function tarikhTamat(h) { return h && h.tamatTahun ? 'bulan ' + h.tamatBulan + '/' + h.tamatTahun : 'tempoh ditetapkan MKT'; }

  /* ------------------------------------------------------------------------
     KEMPEN BERSIH DAN KOTOR
     def.etika = { tahap:'bersih'|'kelabu'|'kotor', modal, risiko, tambahRisiko, berat, perkara, fasal }
       modal        perubahan Modal Sosial (+ untuk bersih, - untuk kotor)
       risiko       peluang asas dilapor (%)
       tambahRisiko tambahan kepada risiko terkumpul
       berat        1 ringan, 2 sederhana, 3 berat (politik wang / ugutan)
     ------------------------------------------------------------------------ */
  function peluangLapor(e, def) {
    if (!def || !def.risiko) { return 0; }
    return clamp(def.risiko + e.risiko * CONFIG.BERAT_RISIKO_LAPOR - e.modal * CONFIG.BERAT_MODAL_RISIKO, 2, 92);
  }

  function catat(e, p, jenis, mesej) {
    e.rekod.unshift({ tahun: p.tahun, bulan: p.bulan, jenis: jenis, mesej: mesej });
    e.rekod = e.rekod.slice(0, 20);
  }

  /**
   * Hitung kesan etika bagi satu aktiviti. TIDAK menyimpan; pulang { etika, dilapor, mesej } supaya
   * pemanggil menggabungkannya dalam satu applyEffects() (patch: { etika }).
   * opts.rng untuk ujian.
   */
  function selepasAktiviti(p, def, opts) {
    opts = opts || {};
    var e = getEtika(p), rng = opts.rng || Math.random, mesej = '', dilapor = false;
    if (!def) { return { etika: e, dilapor: false, mesej: '' }; }

    var peluang = peluangLapor(e, def);
    e.modal = clamp(e.modal + (def.modal || 0), 0, CONFIG.KEMASAN_MODAL_MAKS);
    e.risiko = clamp(e.risiko + (def.tambahRisiko || 0), 0, 100);

    if (def.tahap === 'bersih' && def.modal) { mesej = 'Modal Sosial +' + def.modal + '.'; }
    if ((def.tahap === 'kotor' || def.tahap === 'kelabu') && def.risiko) {
      if (e.status === 'dipecat') { /* tiada siasatan baharu */ }
      else if (!e.siasatan && rng() * 100 < peluang) {
        e.siasatan = { perkara: def.perkara, fasal: def.fasal || 'Fasal 20.13', berat: def.berat || 1, tahun: p.tahun, bulan: p.bulan, fasa: 'aduan', pembelaan: 0 };
        dilapor = true;
        mesej = 'ADUAN DIBUAT! Perbuatan anda dilaporkan kepada Jawatankuasa Disiplin Negeri (Fasal 20.5): ' + def.perkara + '. Keputusan akan dibuat dalam beberapa bulan.';
        catat(e, p, 'aduan', def.perkara);
      } else {
        mesej = 'Perbuatan ini belum didedahkan, tetapi risiko disiplin anda meningkat (kini ' + e.risiko + '%).';
      }
    }
    return { etika: e, dilapor: dilapor, mesej: mesej, peluang: Math.round(peluang) };
  }

  /** Tambah/kurang Modal Sosial untuk tindakan bersih (akar umbi). Pulang objek etika baharu. */
  function selepasTindakanBersih(p, kesan) {
    var e = getEtika(p);
    if (!kesan) { return e; }
    e.modal = clamp(e.modal + (kesan.modal || 0), 0, CONFIG.KEMASAN_MODAL_MAKS);
    e.risiko = clamp(e.risiko + (kesan.risiko || 0), 0, 100);
    return e;
  }

  /** Kesan etika bagi pilihan acara rawak: { modal, risiko, lapor:{ peluang, berat, perkara, fasal } } */
  function selepasAcara(p, k, opts) {
    opts = opts || {};
    var e = getEtika(p), rng = opts.rng || Math.random, mesej = '';
    if (!k) { return { etika: e, mesej: '' }; }
    e.modal = clamp(e.modal + (k.modal || 0), 0, CONFIG.KEMASAN_MODAL_MAKS);
    e.risiko = clamp(e.risiko + (k.risiko || 0), 0, 100);
    if (k.lapor && e.status !== 'dipecat' && !e.siasatan) {
      var peluang = clamp(k.lapor.peluang + e.risiko * CONFIG.BERAT_RISIKO_LAPOR - e.modal * CONFIG.BERAT_MODAL_RISIKO, 2, 92);
      if (rng() * 100 < peluang) {
        e.siasatan = { perkara: k.lapor.perkara, fasal: k.lapor.fasal || 'Fasal 20.13', berat: k.lapor.berat || 1, tahun: p.tahun, bulan: p.bulan, fasa: 'aduan', pembelaan: 0 };
        mesej = ' Aduan dibuat kepada Jawatankuasa Disiplin (Fasal 20.5).';
        catat(e, p, 'aduan', k.lapor.perkara);
      }
    }
    return { etika: e, mesej: mesej };
  }

  /* ------------------------------------------------------------------------
     PROSES BULANAN: siasatan -> pendengaran -> keputusan; hukuman tamat; risiko susut
     ------------------------------------------------------------------------ */
  function keputusan(p, e, rng) {
    var s = e.siasatan;
    var skor = s.berat + 0.8 * e.salah + (rng() - 0.5) * 1.6 - e.modal / 50 - (s.pembelaan || 0);
    if (skor < 1.4) { return 'amaran'; }
    if (skor < 2.4) { return 'digantung'; }
    if (skor < 3.4) { return 'dilarang'; }
    return 'dipecat';
  }

  function tambahBulan(tahun, bulan, n) {
    var m = mutlak(tahun, bulan) + n;
    return { tahun: Math.floor(m / 12), bulan: (m % 12) + 1 };
  }

  /** Kenakan hukuman. Pulang patch profil (tidak menyimpan). */
  function kenakan(p, e, jenis, perkara, fasal) {
    var patch = {}, kesan = { reputasi: 0, kesetiaan: {}, ip: 0 };
    var h = { jenis: jenis, tahun: p.tahun, bulan: p.bulan, perkara: perkara, fasal: fasal };
    e.salah += 1;
    if (jenis === 'amaran') {
      e.amaran += 1; e.modal = clamp(e.modal - 5, 0, 100);
      kesan.reputasi = -5; h.tamatTahun = 0;
    } else if (jenis === 'digantung') {
      var t = tambahBulan(p.tahun, p.bulan, CONFIG.BULAN_GANTUNG); h.tamatTahun = t.tahun; h.tamatBulan = t.bulan;
      e.status = 'digantung'; e.modal = clamp(e.modal - 10, 0, 100);
      kesan.reputasi = -12; kesan.kesetiaan = { akarUmbi: -10 };
      // v4.6: lucut SEMUA jawatan serta-merta (status UI: "Ahli (Digantung)"). Jawatan tidak dipulangkan selepas tempoh tamat.
      h.jawatanDilucut = (p.jawatan && p.jawatan !== 'Ahli Biasa') ? p.jawatan : '';
      patch.jawatanList = []; patch.jawatan = 'Ahli Biasa'; patch.cabaran = null; patch.amaranAktif = false;
      patch.perwakilan = { cawangan: 0, bahagian: 0 };
    } else if (jenis === 'dilarang') {
      var t2 = tambahBulan(p.tahun, p.bulan, CONFIG.BULAN_LARANGAN); h.tamatTahun = t2.tahun; h.tamatBulan = t2.bulan;
      e.status = 'dilarang'; e.modal = clamp(e.modal - 12, 0, 100);
      kesan.reputasi = -15; kesan.kesetiaan = { akarUmbi: -8, ajk: -8 };
    } else {
      e.status = 'dipecat'; e.modal = 0;
      var t3 = tambahBulan(p.tahun, p.bulan, CONFIG.BULAN_RAYUAN_PECAT); h.tamatTahun = t3.tahun; h.tamatBulan = t3.bulan;   // tarikh layak merayu
      kesan.reputasi = -30; kesan.ip = -Math.round(p.ip * 0.75);
      patch.jawatanList = []; patch.jawatan = 'Ahli Biasa'; patch.cabaran = null; patch.amaranAktif = false;
      patch.perwakilan = { cawangan: 0, bahagian: 0 };
    }
    e.hukuman = h; e.siasatan = null;
    // Batalkan pendaftaran bertanding yang belum selesai bila hak dicabut
    if (jenis !== 'amaran' && p.pemilihan && p.pemilihan.daftar) {
      var st = salin(p.pemilihan);
      Object.keys(st.daftar).forEach(function (k) {
        if (st.keputusan && st.keputusan[k]) { return; }
        if (jenis === 'dilarang' && st.daftar[k].jenis === 'perwakilan') { return; }
        delete st.daftar[k];
      });
      patch.pemilihan = st;
    }
    catat(e, p, 'hukuman', HUKUMAN_NAMA[jenis] + ': ' + perkara);
    patch.etika = e;
    return { patch: patch, kesan: kesan };
  }

  function mesejHukuman(jenis, perkara, fasal, h) {
    var t = {
      amaran: 'Lembaga Disiplin memberi AMARAN kepada anda (Fasal 20.10a) atas: ' + perkara + '. Rekod disiplin anda dicatat; kesalahan seterusnya lebih berat.',
      digantung: 'Lembaga Disiplin MENGGANTUNG hak keahlian anda selama ' + CONFIG.BULAN_GANTUNG + ' bulan (Fasal 20.10b) atas: ' + perkara + '. Semua jawatan anda dilucutkan serta-merta. Anda tidak boleh mencalon, mengundi, bertanding atau berkempen, dan tidak boleh menggunakan AP untuk tugas rasmi jawatan sehingga ' + tarikhTamat(h) + '.',
      dilarang: 'Anda DILARANG BERTANDING mana-mana jawatan selama ' + (CONFIG.BULAN_LARANGAN / 12) + ' tahun (Fasal 20.10c) atas: ' + perkara + '. Anda masih boleh berkhidmat dan menjadi perwakilan.',
      dipecat: 'Lembaga Disiplin mengesyorkan PEMECATAN dan MKT telah MENGESAHKANNYA (Fasal 20.10d) atas: ' + perkara + '. Semua jawatan anda hilang. Rayuan boleh dibuat selepas 3 tahun (Fasal 20.12.2).'
    };
    return t[jenis];
  }

  /**
   * Dipanggil selepas bulan bertukar. Pulang { peristiwa:[{jenis,mesej}], berubah }.
   * opts.rng untuk ujian.
   */
  function prosesBulan(opts) {
    opts = opts || {};
    var p = S.loadPlayer();
    if (!p) { return { peristiwa: [], berubah: false }; }
    var e = getEtika(p), peristiwa = [], berubah = false, patch = null, kesan = {};
    var rng = opts.rng || S.rngBerbenih(p.id + '|' + p.tahun + '|' + p.bulan + '|disiplin');

    // 1. Hukuman tamat
    if ((e.status === 'digantung' || e.status === 'dilarang') && e.hukuman && e.hukuman.tamatTahun &&
        mutlak(p.tahun, p.bulan) >= mutlak(e.hukuman.tamatTahun, e.hukuman.tamatBulan)) {
      peristiwa.push({ jenis: 'disiplin', mesej: 'Tempoh ' + (e.status === 'digantung' ? 'penggantungan' : 'larangan bertanding') + ' anda telah tamat. Hak keahlian dipulihkan. Rekod disiplin kekal.' });
      e.status = 'baik'; e.hukuman = null; berubah = true;
    }

    // 2. Siasatan: aduan -> pendengaran -> keputusan
    if (e.siasatan && e.status !== 'dipecat') {
      var s = e.siasatan;
      if (s.fasa === 'aduan' && mutlak(p.tahun, p.bulan) > mutlak(s.tahun, s.bulan)) {
        s.fasa = 'pendengaran'; berubah = true;
        peristiwa.push({ jenis: 'disiplin', mesej: 'Jawatankuasa Disiplin memanggil anda untuk pendengaran berhubung: ' + s.perkara + '. Kemukakan pembelaan anda (Fasal 20.5).' });
      } else if (s.fasa === 'pendengaran' && mutlak(p.tahun, p.bulan) > mutlak(s.tahun, s.bulan) + 1) {
        var jenis = s.gugur ? 'dipecat' : keputusan(p, e, rng);
        var k = kenakan(p, e, jenis, s.perkara, s.gugur ? 'Fasal 20.7' : s.fasal);
        patch = k.patch; kesan = k.kesan; berubah = true;
        peristiwa.push({ jenis: 'hukuman', mesej: mesejHukuman(jenis, s.perkara, s.fasal, e.hukuman), hukuman: jenis });
      }
    }

    // 3. Pendedahan tidak langsung (risiko terkumpul)
    if (!patch && !e.siasatan && e.status === 'baik' && e.risiko >= 25) {
      var peluang = clamp((e.risiko - e.modal * 0.3) * 0.5, 0, 40);
      if (rng() * 100 < peluang) {
        e.siasatan = { perkara: 'Dakwaan salah laku pemilihan (Fasal 20.13)', fasal: 'Fasal 20.13', berat: e.risiko >= 60 ? 3 : 2, tahun: p.tahun, bulan: p.bulan, fasa: 'aduan', pembelaan: 0 };
        catat(e, p, 'aduan', e.siasatan.perkara);
        peristiwa.push({ jenis: 'disiplin', mesej: 'Seseorang membuat aduan tentang kegiatan anda kepada Jawatankuasa Disiplin Negeri (Fasal 20.5). Siasatan dimulakan.' });
        berubah = true;
      }
    }

    // 4. Risiko susut dan, jika bersih, modal naik sedikit
    if (e.risiko > 0) { e.risiko = Math.floor(e.risiko * CONFIG.PENYUSUTAN_RISIKO); berubah = true; }

    if (berubah || (patch && patch.etika)) {
      var r = S.applyEffects(kesan, { kiraTindakan: false, patch: patch || { etika: e }, log: peristiwa.length ? { tindakan: 'disiplin', nama: peristiwa[0].mesej.slice(0, 80), peringkat: 'disiplin' } : undefined });
      if (!r.ok) { return { peristiwa: peristiwa, berubah: false, ralat: r.ralat }; }
    }
    return { peristiwa: peristiwa, berubah: berubah };
  }

  /** Respons pendengaran (dipanggil daripada acara rawak). jenis: 'pembelaan' | 'akur' | 'mahkamah' */
  function responsPendengaran(jenis) {
    var p = S.loadPlayer(), e = getEtika(p);
    if (!e.siasatan) { return { ok: false, ralat: 'Tiada siasatan.' }; }
    e.siasatan.dijawab = true;
    if (jenis === 'pembelaan') { e.siasatan.pembelaan = 0.7; }
    else if (jenis === 'akur') { e.siasatan.pembelaan = 0.4; e.modal = clamp(e.modal + 2, 0, 100); }
    else if (jenis === 'mahkamah') { e.siasatan.gugur = true; }
    var r = S.applyEffects({}, { kiraTindakan: false, patch: { etika: e } });
    return r.ok ? { ok: true, etika: e } : r;
  }

  /** Rayuan pemecatan (Fasal 20.12.2): selepas 3 tahun. Keahlian dipulihkan sebagai ahli baharu. */
  function bolehRayu(p) {
    var e = getEtika(p), h = e.hukuman;
    if (e.status !== 'dipecat' || !h) { return { boleh: false, sebab: 'Tiada pemecatan untuk dirayu.' }; }
    var ok = mutlak(p.tahun, p.bulan) >= mutlak(h.tamatTahun, h.tamatBulan);
    return { boleh: ok, sebab: ok ? '' : 'Rayuan boleh dibuat pada bulan ' + h.tamatBulan + '/' + h.tamatTahun + ' (3 tahun selepas pemecatan, Fasal 20.12.2).' };
  }

  function rayuPemecatan() {
    var p = S.loadPlayer();
    if (!p) { return { ok: false, ralat: 'Tiada profil.' }; }
    var b = bolehRayu(p);
    if (!b.boleh) { return { ok: false, ralat: b.sebab }; }
    var e = getEtika(p);
    e.status = 'baik'; e.hukuman = null; e.modal = 10; e.risiko = 0;
    catat(e, p, 'rayuan', 'Rayuan pemecatan diterima; keahlian dipulihkan.');
    var r = S.applyEffects({ reputasi: 10 }, {
      kiraTindakan: false,
      patch: { etika: e, keahlian: { sejakTahun: p.tahun, sejakBulan: p.bulan } },
      log: { tindakan: 'rayuan', nama: 'Rayuan pemecatan diterima', peringkat: 'disiplin' }
    });
    return r.ok ? { ok: true, mesej: 'Rayuan anda diterima. Keahlian dipulihkan sebagai ahli baharu; tempoh keahlian dikira semula (Fasal 15.5).', profil: r.profil } : r;
  }

  /* ------------------------------------------------------------------------
     RINGKASAN UNTUK UI
     ------------------------------------------------------------------------ */
  function labelRisiko(n) { return n < 20 ? 'Rendah' : n < 45 ? 'Sederhana' : 'Tinggi'; }

  function ringkasan(p) {
    var e = getEtika(p), k = bulanKeahlian(p);
    return {
      modal: e.modal, risiko: e.risiko, labelRisiko: labelRisiko(e.risiko), status: e.status, hukuman: e.hukuman,
      siasatan: e.siasatan, amaran: e.amaran, salah: e.salah, rekod: e.rekod,
      bulanKeahlian: k, tahunKeahlian: Math.floor(k / 12), cukup3Tahun: k >= CONFIG.BULAN_KEAHLIAN,
      rayuan: e.status === 'dipecat' ? bolehRayu(p) : null,
      bonusUndi: Math.round(e.modal * CONFIG.BERAT_MODAL_UNDI * 10) / 10
    };
  }

  function bonusUndi(p) { return getEtika(p).modal * CONFIG.BERAT_MODAL_UNDI; }

  return {
    CONFIG: CONFIG, HUKUMAN_NAMA: HUKUMAN_NAMA,
    getEtika: getEtika, bulanKeahlian: bulanKeahlian, semakKeahlian: semakKeahlian, semakPenggal: semakPenggal,
    semakHak: semakHak, kuatkuasaGantung: kuatkuasaGantung, peluangLapor: peluangLapor, selepasAktiviti: selepasAktiviti,
    selepasTindakanBersih: selepasTindakanBersih, selepasAcara: selepasAcara,
    prosesBulan: prosesBulan, responsPendengaran: responsPendengaran,
    bolehRayu: bolehRayu, rayuPemecatan: rayuPemecatan, ringkasan: ringkasan, bonusUndi: bonusUndi, labelRisiko: labelRisiko
  };
});
