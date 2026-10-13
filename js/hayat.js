/* ==========================================================================
   Nusa Politik — js/hayat.js   (v5.0)
   Sistem umur pemain, risiko kesihatan dan penamat kerjaya (meninggal / bersara paksa).

   - Umur semasa = umur pendaftaran + bilangan tahun permainan berlalu (bertambah 1 setiap tahun).
     Tiada medan umur baharu disimpan, jadi simpanan lama turut berfungsi.
   - Setiap kali kalendar melengkapkan 12 bulan, satu semakan kesihatan dijalankan (prosesTahunBaharu).
   - Risiko tahunan meningkat beransur-ansur: bermula 45 tahun, kira-kira 1.3% pada 60 tahun,
     8% pada 80 tahun dan 20% pada 90 tahun. Pada 100 tahun kerjaya tamat pasti.
   - Jika tamat, profil.tamat disimpan (Legacy Summary) dan permainan tidak boleh diteruskan.

   Nombor di sini ialah angka permainan, bukan statistik perubatan sebenar.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(root); }
  else { root.MyPolitikHayat = factory(root); }
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';

  var CONFIG = {
    TAHUN_MULA: 2026,            // tahun permainan bermula (umur pendaftaran = umur pada tahun ini)
    UMUR_MIN: 18,
    UMUR_DAFTAR_MAKS: 60,        // umur maksimum semasa pendaftaran
    UMUR_MAKS: 100,              // had umur: kerjaya tamat pasti
    UMUR_RISIKO_MULA: 45,        // risiko bermula
    ASAS: 0.0008,                // kebarangkalian tahunan pada umur 30 (garis dasar), digandakan mengikut GANDA
    SETIAP: 7.5,                 // risiko berganda setiap 7.5 tahun (kenaikan beransur-ansur)
    NISBAH_MENINGGAL: 0.35,      // selebihnya = bersara paksa atas sebab kesihatan
    AMBANG: { sederhana: 0.03, tinggi: 0.10 }
  };

  function S() { return root.MyPolitikSave || (typeof require === 'function' ? require('./save.js') : null); }
  function J() { return root.MyPolitikJawatan || (typeof require === 'function' ? tryReq('./jawatan.js') : null); }
  function W() { return root.MyPolitikWatak || (typeof require === 'function' ? tryReq('./watak.js') : null); }
  function Dt() { return root.MyPolitikData || (typeof require === 'function' ? tryReq('./data.js') : null); }
  function Et() { return root.MyPolitikEtika || (typeof require === 'function' ? tryReq('./etika.js') : null); }
  function tryReq(f) { try { return require(f); } catch (e) { return null; } }

  /* ------------------------------------------------------------------------
     1. UMUR DAN RISIKO
     ------------------------------------------------------------------------ */
  function umurSemasa(p) {
    if (!p || !p.demografik) { return null; }
    var u = parseInt(p.demografik.umur, 10), t = parseInt(p.tahun, 10);
    if (!isFinite(u)) { return null; }
    return u + Math.max(0, (isFinite(t) ? t : CONFIG.TAHUN_MULA) - CONFIG.TAHUN_MULA);
  }

  /** Kebarangkalian (0 hingga 1) tamat kerjaya dalam setahun pada umur tertentu. */
  function risikoTahunan(umur) {
    umur = Number(umur);
    if (!isFinite(umur) || umur < CONFIG.UMUR_RISIKO_MULA) { return 0; }
    if (umur >= CONFIG.UMUR_MAKS) { return 1; }
    return Math.min(0.95, CONFIG.ASAS * Math.pow(2, (umur - 30) / CONFIG.SETIAP));
  }

  function labelRisiko(r) { return r >= CONFIG.AMBANG.tinggi ? 'Tinggi' : r >= CONFIG.AMBANG.sederhana ? 'Sederhana' : 'Rendah'; }

  /** Ringkasan untuk UI: { umur, risiko (0-1), peratus, label, tamat }. */
  function ringkasan(p) {
    var u = umurSemasa(p), r = risikoTahunan(u);
    return { umur: u, risiko: r, peratus: Math.round(r * 1000) / 10, label: labelRisiko(r), nampakRisiko: u !== null && u >= CONFIG.UMUR_RISIKO_MULA, tamat: (p && p.tamat) || null };
  }

  function sudahTamat(p) { return !!(p && p.tamat); }

  /* ------------------------------------------------------------------------
     2. REKOD JAWATAN TERTINGGI (untuk Legacy Summary)
     ------------------------------------------------------------------------ */
  function jawatanTertinggiSemasa(p) {
    var j = J(), t = null;
    if (!j || !j.getJawatan) { return null; }
    j.getJawatan(p).forEach(function (x) { if (!t || (x.pangkat || 0) > (t.pangkat || 0)) { t = x; } });
    return t ? { jawatan: t.jawatan, pangkat: t.pangkat || 0, peringkat: t.peringkat } : null;
  }

  /** Kemas kini p.jawatanTertinggi jika jawatan semasa lebih tinggi. Idempotent; pulang true jika berubah. */
  function kemaskiniJawatanTertinggi() {
    var s = S(), p = s && s.loadPlayer();
    if (!p || p.tamat) { return false; }
    var k = jawatanTertinggiSemasa(p), lama = p.jawatanTertinggi;
    if (!k || (lama && (lama.pangkat || 0) >= k.pangkat)) { return false; }
    var r = s.applyEffects({}, { kiraTindakan: false, patch: { jawatanTertinggi: { jawatan: k.jawatan, pangkat: k.pangkat, peringkat: k.peringkat, tahun: p.tahun } } });
    return !!(r && r.ok);
  }

  /* ------------------------------------------------------------------------
     3. LEGACY SUMMARY
     ------------------------------------------------------------------------ */
  function gelaranPangkat(pangkat) {
    return pangkat >= 10 ? 'Tokoh Pusat' : pangkat >= 7 ? 'Pemimpin Bahagian' : pangkat >= 3 ? 'Pemimpin Cawangan' : pangkat >= 1 ? 'Pegawai Cawangan' : 'Ahli Akar Umbi';
  }

  var TAJUK_SEBAB = { meninggal: 'Tamat Hayat', bersara_kesihatan: 'Bersara Paksa (Kesihatan)', had_umur: 'Mencapai Usia 100 Tahun' };

  function mesejSebab(sebab, umur) {
    if (sebab === 'meninggal') { return 'Anda telah meninggal dunia pada usia ' + umur + ' tahun. Al-Fatihah. Perjalanan politik anda berakhir di sini.'; }
    if (sebab === 'bersara_kesihatan') { return 'Atas nasihat doktor, anda bersara sepenuhnya daripada politik pada usia ' + umur + ' tahun kerana masalah kesihatan.'; }
    return 'Anda mencapai usia ' + umur + ' tahun, had umur permainan ini. Perjalanan politik anda ditutup dengan penuh kehormatan.';
  }

  function bina(p, sebab) {
    var umur = umurSemasa(p), top = p.jawatanTertinggi || jawatanTertinggiSemasa(p) || { jawatan: 'Ahli Biasa', pangkat: 0 };
    var semasa = jawatanTertinggiSemasa(p);
    if (semasa && semasa.pangkat > (top.pangkat || 0)) { top = semasa; }
    var w = null, et = null, ET = Et(), WK = W();
    try { w = WK && WK.tentukan ? WK.tentukan(p) : null; } catch (e) { w = null; }
    try { et = ET && ET.ringkasan ? ET.ringkasan(p) : null; } catch (e) { et = null; }
    return {
      sebab: sebab, tajuk: TAJUK_SEBAB[sebab] || 'Penamat Kerjaya', mesej: mesejSebab(sebab, umur),
      umur: umur, tahun: p.tahun, bulan: p.bulan, tahunMula: CONFIG.TAHUN_MULA,
      tahunBerkhidmat: Math.max(0, p.tahun - CONFIG.TAHUN_MULA),
      umurMula: p.demografik ? p.demografik.umur : null,
      jawatanAkhir: p.jawatan, jawatanTertinggi: top.jawatan, pangkatTertinggi: top.pangkat || 0, gelaran: gelaranPangkat(top.pangkat || 0),
      gaya: w ? w.nama : null, gayaHuraian: w ? w.huraian : null,
      ip: p.ip, myr: p.myr, reputasi: p.reputasi, bilTindakan: p.bilTindakan || 0,
      modalSosial: et ? et.modal : null, hukumanDisiplin: et ? et.salah : 0
    };
  }

  /* ------------------------------------------------------------------------
     4. SEMAKAN TAHUN BAHARU
     Dipanggil oleh Calendar.majuBulan() selepas tahun bertambah.
     opts.rng untuk ujian. Pulang { peristiwa:[{jenis,mesej}], tamat: object|null, umur, risiko }.
     ------------------------------------------------------------------------ */
  function prosesTahunBaharu(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), peristiwa = [];
    if (!p || p.tamat) { return { peristiwa: peristiwa, tamat: (p && p.tamat) || null }; }
    kemaskiniJawatanTertinggi(); p = s.loadPlayer();
    var umur = umurSemasa(p);
    if (umur === null) { return { peristiwa: peristiwa, tamat: null }; }
    var q = risikoTahunan(umur), rng = opts.rng || s.rngBerbenih(p.id + '|' + p.tahun + '|hayat'), sebab = null;

    if (umur >= CONFIG.UMUR_MAKS) { sebab = 'had_umur'; }
    else if (q > 0) {
      var x = rng();
      if (x < q * CONFIG.NISBAH_MENINGGAL) { sebab = 'meninggal'; }
      else if (x < q) { sebab = 'bersara_kesihatan'; }
    }

    if (sebab) {
      var legasi = bina(p, sebab);
      var r = s.applyEffects({}, { kiraTindakan: false, patch: { tamat: legasi }, log: { tindakan: 'hayat', nama: legasi.tajuk + ' pada usia ' + umur, peringkat: 'hayat' } });
      peristiwa.push({ jenis: 'hayat', mesej: legasi.mesej });
      return { peristiwa: peristiwa, tamat: legasi, umur: umur, risiko: q, ralat: r && r.ok ? null : (r && r.ralat) };
    }

    if (umur >= 60) {
      peristiwa.push({ jenis: 'hayat', mesej: 'Pemeriksaan kesihatan tahunan (usia ' + umur + '): risiko kesihatan tahun depan ' + labelRisiko(q).toLowerCase() + ' (' + (Math.round(q * 1000) / 10) + '%).' });
    }
    return { peristiwa: peristiwa, tamat: null, umur: umur, risiko: q };
  }

  /* ------------------------------------------------------------------------
     5. PERALIHAN KATEGORI MENGIKUT UMUR (v5.1, dipinda)
     Dilaksanakan pada tahun baharu, sebaik umur bertambah (dipanggil oleh Calendar.majuBulan).
     Pemuda -> Biasa -> Veteran (lelaki); Puteri -> Wanita -> Veteran (perempuan).
     Hanya KATEGORI (dan avatar) berubah. Jawatan yang dipegang TIDAK gugur: ia dipegang
     sehingga pemilihan seterusnya, tetapi pemain tidak lagi layak bertanding jawatan sayap
     kategori lama (dan tidak layak mempertahankannya apabila pemilihan tiba).
     Avatar hanya mengikut jika avatar semasa masih sama dengan kategori lama
     (pilihan avatar yang sengaja ditukar semasa pendaftaran dihormati).
     ------------------------------------------------------------------------ */
  var NAMA_KATEGORI = { pemuda: 'Pemuda', puteri: 'Puteri', wanita: 'Wanita', biasa: 'Biasa', veteran: 'Veteran' };

  function kategoriSepatutnya(p) {
    var D = Dt(), u = umurSemasa(p);
    if (!D || !D.kategoriMengikutUmur || u === null || !p.demografik) { return null; }
    return D.kategoriMengikutUmur(String(p.demografik.jantina || '').charAt(0), u);
  }

  /** Semak dan laksanakan peralihan. Pulang { berubah, daripada, kepada, peristiwa:[] }. */
  function prosesPeralihanKategori() {
    var s = S(), p = s && s.loadPlayer(), kosong = { berubah: false, peristiwa: [] };
    if (!p || p.tamat || !p.demografik) { return kosong; }
    var lama = p.demografik.kategoriKod, baru = kategoriSepatutnya(p);
    if (!baru || baru === lama) { return kosong; }

    var patch = { demografik: Object.assign({}, p.demografik, { kategoriKod: baru, kategori: NAMA_KATEGORI[baru] }) };
    var ikutAvatar = !p.avatar || p.avatar === lama;
    var mesej = 'Memasuki tahun ' + p.tahun + ', umur anda ' + umurSemasa(p) + ' tahun, jadi kategori keahlian anda bertukar daripada ' + NAMA_KATEGORI[lama] + ' kepada ' + NAMA_KATEGORI[baru] + '.';
    var extra = '';
    if (ikutAvatar) {
      patch.avatar = baru;
      var punyaSayap = (Array.isArray(p.jawatanList) ? p.jawatanList : []).some(function (j) { return j.kumpulan === 'sayap'; });
      if (punyaSayap) { extra += ' Jawatan sayap yang anda pegang kekal sehingga pemilihan seterusnya, tetapi anda tidak lagi layak mempertahankannya.'; }
      if (p.pemilihan && p.pemilihan.daftar) {
        var pm = JSON.parse(JSON.stringify(p.pemilihan)), batal = 0;
        Object.keys(pm.daftar).forEach(function (k) {
          if (/^sayap_/.test(k) && !(pm.keputusan && pm.keputusan[k])) { delete pm.daftar[k]; batal++; }
        });
        if (batal) { patch.pemilihan = pm; extra += ' Pendaftaran pertandingan sayap yang belum selesai dibatalkan.'; }
      }
      extra += (baru === 'biasa' || baru === 'veteran') ? ' Kategori ini tiada jawatan sayap.' : ' Anda kini layak bertanding jawatan sayap ' + NAMA_KATEGORI[baru] + '.';
    } else {
      extra = ' Avatar pilihan anda dikekalkan.';
    }
    var r = s.applyEffects({}, { kiraTindakan: false, patch: patch, log: { tindakan: 'kategori', nama: 'Kategori ' + NAMA_KATEGORI[lama] + ' → ' + NAMA_KATEGORI[baru], peringkat: 'hayat' } });
    if (!r || !r.ok) { return kosong; }
    return { berubah: true, daripada: lama, kepada: baru, peristiwa: [{ jenis: 'kategori_bertukar', mesej: mesej + extra }] };
  }

  /** Padam profil dan mulakan semula tidak dibuat di sini; UI memanggil Save.clearPlayer(). */
  return {
    CONFIG: CONFIG, umurSemasa: umurSemasa, risikoTahunan: risikoTahunan, labelRisiko: labelRisiko, ringkasan: ringkasan,
    sudahTamat: sudahTamat, prosesTahunBaharu: prosesTahunBaharu, kemaskiniJawatanTertinggi: kemaskiniJawatanTertinggi,
    jawatanTertinggiSemasa: jawatanTertinggiSemasa, gelaranPangkat: gelaranPangkat,
    kategoriSepatutnya: kategoriSepatutnya, prosesPeralihanKategori: prosesPeralihanKategori
  };
});
