/* ==========================================================================
   Nusa Politik — js/misi.js   (v6.7)
   Penyatuan Mod Kerjaya Berbilang Sayap:
     1. Misi Bulanan mengikut sayap (Pemuda / Wanita / Puteri), dengan rentetan (streak).
     2. Undi Tidak Percaya: amaran bila sokongan akar umbi merudum; undi dijalankan jika berterusan.
     3. Acara transisi umur rasmi (amaran tahunan; pelucutan jawatan sayap dibuat oleh hayat.js).

   Andaian (laras dalam CONFIG):
     - Misi bulanan: satu misi setiap bulan, bertukar mengikut bulan; sekali sebulan; kos 3 AP.
       Rentetan 3 bulan berturut-turut memberi bonus, kemudian ditetapkan semula. Bulan terlepas
       hanya memutuskan rentetan (tiada denda).
     - Undi Tidak Percaya terpakai kepada pemegang mana-mana jawatan sayap. "Sokongan sayap"
       ialah Kesetiaan Akar Umbi (diwakili oleh data permainan sedia ada).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikMisi = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function (root) {
  'use strict';

  function modul(nama, fail) {
    if (root[nama]) { return root[nama]; }
    try { if (typeof require === 'function') { return require('./' + fail); } } catch (e) { /* tidak dimuatkan */ }
    return null;
  }
  function S() { return modul('MyPolitikSave', 'save.js'); }
  function SY() { return modul('MyPolitikSayap', 'sayap.js'); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function salin(o) { return JSON.parse(JSON.stringify(o)); }
  function indeks(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }

  var CONFIG = {
    MISI_KOS_AP: 3,
    RENTETAN_BONUS: 3,
    RENTETAN_GANJARAN: { ip: 15, reputasi: 2, kesetiaan: { akarUmbi: 5 } },
    AMBANG_AMARAN: 45,                   // akar umbi di bawah ini: amaran awal
    AMBANG_UNDI: 35,                     // akar umbi di bawah ini: bulan rendah dikira
    BULAN_UNTUK_UNDI: 2,                 // bilangan bulan berturut-turut rendah sebelum undi dijalankan
    KEBAL_BULAN: 6,                      // selepas menang undi, kebal daripada undi baharu
    KALAH: { ip: -8, reputasi: -4 },
    MENANG: { reputasi: 1 },
    NOISE: 20                            // kebolehubahan peratus sokongan (+/- separuh nilai ini)
  };

  /* ------------------------------------------------------------------------
     1. MISI BULANAN
     ------------------------------------------------------------------------ */
  var MISI = {
    pemuda: [
      { id: 'himpunan_belia', nama: 'Himpunan Belia', ikon: '🔥',
        penerangan: 'Anjurkan himpunan belia di Bahagian. Gema besar dan IP tinggi, tetapi keletihan dan risiko kejadian tidak diingini.',
        kesan: { ap: -3, myr: -500, ip: 30, reputasi: 1, kesetiaan: { akarUmbi: 4 } }, stres: { stress: 10 },
        risiko: { peluang: 0.30, kesan: { reputasi: -3 }, stres: { stress: 6 }, mesej: 'Himpunan menjadi tegang dan disorot media. Reputasi -3, Stress +6.' } },
      { id: 'gerak_gempur_media', nama: 'Gerak Gempur Media', ikon: '📱',
        penerangan: 'Kempen serangan media sosial pasukan siber Pemuda. IP tinggi, tetapi menguji saraf.',
        kesan: { ap: -3, myr: -200, ip: 26, kesetiaan: { akarUmbi: 2 } }, stres: { stress: 8 },
        risiko: { peluang: 0.25, kesan: { reputasi: -2 }, stres: { stress: 5 }, mesej: 'Kempen tular atas sebab salah dan dikritik netizen. Reputasi -2, Stress +5.' } }
    ],
    wanita: [
      { id: 'ziarah_kasih_wanita', nama: 'Ziarah Kasih', ikon: '🤝',
        penerangan: 'Ziarah keluarga warga emas dan ibu tunggal di Cawangan. Menguatkan kesetiaan dan menenangkan fikiran.',
        kesan: { ap: -3, myr: -350, ip: 8, kesetiaan: { akarUmbi: 14, ajk: 4 } }, stres: { stress: -12, kesihatan: 2 } },
      { id: 'bakul_makanan', nama: 'Agihan Bakul Makanan', ikon: '🧺',
        penerangan: 'Agihkan bakul makanan kepada keluarga B40 bersama AJK Wanita. Kesetiaan akar umbi dan perwakilan naik.',
        kesan: { ap: -3, myr: -450, ip: 6, kesetiaan: { akarUmbi: 12, perwakilan: 4 } }, stres: { stress: -8 } }
    ],
    puteri: [
      { id: 'outreach_genz', nama: 'Outreach Gen-Z', ikon: '🎯',
        penerangan: 'Hubungi pengundi Gen-Z melalui kafe, kampus dan kandungan pendek. Keahlian baharu dan kuota perwakilan.',
        kesan: { ap: -3, myr: -300, ip: 10, kesetiaan: { perwakilan: 6, akarUmbi: 3 } }, khas: { ahli: { puteri: 4, pemuda: 2 }, kuota: 1 } },
      { id: 'sukarelawan_komuniti', nama: 'Sukarelawan Komuniti', ikon: '🙌',
        penerangan: 'Kerahkan sukarelawan Puteri untuk gotong-royong komuniti. Menarik ahli baharu dan menambah kuota.',
        kesan: { ap: -3, myr: -250, ip: 8, kesetiaan: { akarUmbi: 6, perwakilan: 4 } }, khas: { ahli: { puteri: 5, pemuda: 1 }, kuota: 1 } }
    ]
  };

  function misiBulanIni(p) {
    var k = SY() && SY().kod(p), pool = MISI[k];
    return pool ? pool[indeks(p) % pool.length] : null;
  }

  function keadaanMisi(p) {
    var m = p && p.misi ? salin(p.misi) : {};
    if (typeof m.rentetan !== 'number') { m.rentetan = 0; }
    if (m.terakhir && m.terakhir < indeks(p) - 1) { m.rentetan = 0; }          // rentetan terputus jika bulan lepas terlepas
    return m;
  }

  function semakMisi(d, p) {
    var Et = modul('MyPolitikEtika', 'etika.js');
    if (Et) { var hak = Et.semakHak(p, 'tindakan'); if (!hak.boleh) { return { boleh: false, sebab: hak.sebab }; } }
    var m = p.misi;
    if (m && m.terakhir === indeks(p)) { return { boleh: false, sebab: 'Misi bulan ini sudah dilaksanakan. Misi baharu bulan depan.' }; }
    if (p.ap + (d.kesan.ap || 0) < 0) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + Math.abs(d.kesan.ap) + ').' }; }
    if (p.myr + (d.kesan.myr || 0) < 0) { return { boleh: false, sebab: 'Wang tidak mencukupi (perlu ' + Math.abs(d.kesan.myr) + ').' }; }
    return { boleh: true, sebab: '' };
  }

  /** Misi bulan ini untuk UI. Pulang null bagi laluan Utama. */
  function getMisi(profil) {
    var s = S(), p = profil || (s && s.loadPlayer()), d = p ? misiBulanIni(p) : null;
    if (!d) { return null; }
    var st = semakMisi(d, p), m = keadaanMisi(p);
    return {
      id: d.id, nama: d.nama, ikon: d.ikon, penerangan: d.penerangan, sayap: SY().kod(p),
      ringkas: s.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, reputasi: d.kesan.reputasi || 0, kesetiaan: d.kesan.kesetiaan || {} }) +
        (d.stres ? ', Stress ' + (d.stres.stress > 0 ? '+' : '') + d.stres.stress : '') + (d.khas ? ', ahli baharu dan +1 kerusi perwakilan' : '') + (d.risiko ? ' (risiko ' + Math.round(d.risiko.peluang * 100) + '%)' : ''),
      selesai: !!(p.misi && p.misi.terakhir === indeks(p)), rentetan: m.rentetan, sasaranRentetan: CONFIG.RENTETAN_BONUS,
      boleh: st.boleh, sebab: st.sebab
    };
  }

  /** Laksanakan misi bulan ini. opts.rng untuk ujian. Pulang { ok, mesej, ... }. */
  function jalankanMisi(id, opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain.' }; }
    var d = misiBulanIni(p);
    if (!d || d.id !== id) { return { ok: false, kod: 'bukan_misi_bulan_ini', ralat: 'Ini bukan misi bulan ini untuk sayap anda.' }; }
    var st = semakMisi(d, p);
    if (!st.boleh) { return { ok: false, kod: 'tidak_boleh', ralat: st.sebab }; }

    var rng = opts.rng || Math.random, K = modul('MyPolitikCalendar', 'calendar.js'), kesan = salin(d.kesan), nota = '';
    if (K && K.skalaKesan) { kesan = K.skalaKesan(p, kesan); }
    var stres = d.stres ? salin(d.stres) : null, patch = {};

    if (d.risiko && rng() < d.risiko.peluang) {                       // kejadian tidak diingini
      Object.keys(d.risiko.kesan).forEach(function (k) { kesan[k] = (kesan[k] || 0) + d.risiko.kesan[k]; });
      if (d.risiko.stres) { stres = stres || { stress: 0 }; stres.stress += d.risiko.stres.stress; }
      nota += ' ' + d.risiko.mesej;
    }
    if (d.khas) {                                                       // keahlian dan kuota (Puteri)
      var info = salin(p.cawanganInfo || {}), tc = SY().TS_CONFIG || { MAKS_AHLI_CAWANGAN: 500, MAKS_BONUS_KUOTA: 2 };
      var tambah = d.khas.ahli.puteri + d.khas.ahli.pemuda, jumlah = Math.min(tc.MAKS_AHLI_CAWANGAN, (Number(info.jumlahAhli) || 0) + tambah), sebenar = jumlah - (Number(info.jumlahAhli) || 0);
      if (sebenar > 0) {
        info.jumlahAhli = jumlah;
        if (info.kumpulan) { var pu = Math.min(sebenar, d.khas.ahli.puteri); info.kumpulan.puteri = (info.kumpulan.puteri || 0) + pu; info.kumpulan.pemuda = (info.kumpulan.pemuda || 0) + (sebenar - pu); }
        patch.cawanganInfo = info; nota += ' ' + sebenar + ' ahli baharu direkrut.';
      }
      var bk = p.bonusKuota && p.bonusKuota.tahun === p.tahun ? p.bonusKuota.kerusi : 0;
      if (bk < tc.MAKS_BONUS_KUOTA) { patch.bonusKuota = { tahun: p.tahun, kerusi: bk + 1 }; nota += ' +1 kerusi perwakilan tahun ' + p.tahun + '.'; }
      else { nota += ' Bonus kerusi perwakilan tahun ini sudah mencapai had.'; }
    }

    var m = keadaanMisi(p), idx = indeks(p);
    m.rentetan += 1; m.terakhir = idx; m.id = d.id; m.tahun = p.tahun; m.bulan = p.bulan; m.jumlah = (m.jumlah || 0) + 1;
    var bonus = null;
    if (m.rentetan >= CONFIG.RENTETAN_BONUS) {
      bonus = CONFIG.RENTETAN_GANJARAN;
      kesan.ip = (kesan.ip || 0) + bonus.ip; kesan.reputasi = (kesan.reputasi || 0) + bonus.reputasi;
      kesan.kesetiaan = kesan.kesetiaan || {};
      Object.keys(bonus.kesetiaan).forEach(function (k) { kesan.kesetiaan[k] = (kesan.kesetiaan[k] || 0) + bonus.kesetiaan[k]; });
      nota += ' Rentetan ' + CONFIG.RENTETAN_BONUS + ' bulan: bonus ' + s.ringkasPerubahan({ ip: bonus.ip, reputasi: bonus.reputasi, kesetiaan: bonus.kesetiaan }) + '.';
      m.rentetan = 0;
    }
    patch.misi = m;

    var r = s.applyEffects(kesan, { kiraTindakan: false, patch: patch, log: { tindakan: 'misi_' + d.id, nama: 'Misi bulanan: ' + d.nama, peringkat: 'sayap' } });
    if (!r.ok) { return r; }
    var ST = modul('MyPolitikStres', 'stress.js');
    if (stres && ST && ST.laras) { ST.laras(stres); }
    var mesej = d.nama + ': ' + s.ringkasPerubahan(r.perubahan) + '.' + (stres ? ' Stress ' + (stres.stress > 0 ? '+' : '') + stres.stress + '.' : '') + nota;
    return { ok: true, mesej: mesej, bonusRentetan: !!bonus, rentetan: m.rentetan, perubahan: r.perubahan, profil: r.profil };
  }

  /* ------------------------------------------------------------------------
     2. UNDI TIDAK PERCAYA
     ------------------------------------------------------------------------ */
  /** Jawatan sayap tertinggi yang dipegang, atau null. */
  function jawatanSayapTertinggi(p) {
    var t = null;
    (Array.isArray(p && p.jawatanList) ? p.jawatanList : []).forEach(function (j) { if (j.kumpulan === 'sayap' && (!t || (j.pangkat || 0) > (t.pangkat || 0))) { t = j; } });
    return t;
  }

  function keadaanUndi(p) {
    var u = p && p.undiTP ? salin(p.undiTP) : {};
    if (typeof u.bulanRendah !== 'number') { u.bulanRendah = 0; }
    return u;
  }

  /** Amaran semasa untuk UI: { tahap: 'amaran'|'kritikal', akarUmbi, bulanRendah, mesej } atau null. */
  function amaranUndi(profil) {
    var s = S(), p = profil || (s && s.loadPlayer());
    if (!p || p.tamat || !jawatanSayapTertinggi(p)) { return null; }
    var au = p.kesetiaan ? Number(p.kesetiaan.akarUmbi) || 0 : 0, u = keadaanUndi(p), j = jawatanSayapTertinggi(p);
    if (u.kebalSehingga && u.kebalSehingga >= indeks(p)) { return null; }
    if (au < CONFIG.AMBANG_UNDI) {
      return { tahap: 'kritikal', akarUmbi: au, bulanRendah: u.bulanRendah, jawatan: j.jawatan,
        mesej: 'Sokongan akar umbi sayap anda hanya ' + au + '%. Ahli sayap sedang mengumpul tandatangan Undi Tidak Percaya terhadap ' + j.jawatan + '. ' +
          (u.bulanRendah >= 1 ? 'Jika kekal rendah bulan depan, undi akan diadakan.' : 'Naikkan sokongan sebelum pertukaran bulan.') };
    }
    if (au < CONFIG.AMBANG_AMARAN) {
      return { tahap: 'amaran', akarUmbi: au, bulanRendah: 0, jawatan: j.jawatan, mesej: 'Sokongan akar umbi sayap merudum (' + au + '%). Di bawah ' + CONFIG.AMBANG_UNDI + '%, Undi Tidak Percaya boleh dibawa terhadap ' + j.jawatan + '.' };
    }
    return null;
  }

  /** Pecahan sokongan undi (0-100) bagi simulasi. */
  function sokonganUndi(p, rng) {
    var k = p.kesetiaan || {}, asas = (k.akarUmbi || 0) * 0.6 + (k.ajk || 0) * 0.2 + (Number(p.reputasi) || 0) * 0.2;
    return clamp(Math.round(asas + (rng() - 0.5) * CONFIG.NOISE), 0, 100);
  }

  /** Proses bulanan (dipanggil oleh Calendar.majuBulan). Pulang { peristiwa: [] }. opts.rng untuk ujian. */
  function prosesBulan(opts) {
    opts = opts || {};
    var s = S(), p = s && s.loadPlayer(), out = { peristiwa: [] };
    if (!p || p.tamat) { return out; }
    var j = jawatanSayapTertinggi(p), u = keadaanUndi(p), idx = indeks(p);
    if (!j) { if (u.bulanRendah) { u.bulanRendah = 0; s.applyEffects({}, { kiraTindakan: false, patch: { undiTP: u } }); } return out; }
    var au = p.kesetiaan ? Number(p.kesetiaan.akarUmbi) || 0 : 0, rng = opts.rng || Math.random;
    if (u.kebalSehingga && u.kebalSehingga >= idx) { return out; }

    if (au >= CONFIG.AMBANG_UNDI) { if (u.bulanRendah) { u.bulanRendah = 0; s.applyEffects({}, { kiraTindakan: false, patch: { undiTP: u } }); } return out; }
    u.bulanRendah += 1;
    if (u.bulanRendah < CONFIG.BULAN_UNTUK_UNDI) {
      s.applyEffects({}, { kiraTindakan: false, patch: { undiTP: u } });
      out.peristiwa.push({ jenis: 'undi_tp_amaran', mesej: 'Amaran Undi Tidak Percaya: sokongan akar umbi sayap tinggal ' + au + '%. Usul tidak percaya terhadap ' + j.jawatan + ' akan dibawa bulan depan jika sokongan masih rendah.' });
      return out;
    }

    var peratus = sokonganUndi(p, rng), kalah = peratus < 50, hasil = { jenis: kalah ? 'undi_tp_kalah' : 'undi_tp_menang' };
    u.bulanRendah = 0;
    if (kalah) {
      s.applyEffects({ ip: CONFIG.KALAH.ip, reputasi: CONFIG.KALAH.reputasi }, { kiraTindakan: false, patch: { undiTP: u }, log: { tindakan: 'undi_tidak_percaya', nama: 'Kalah Undi Tidak Percaya: ' + j.jawatan, peringkat: 'sayap' } });
      var ST = modul('MyPolitikStres', 'stress.js'), lp = ST && ST.lucutJawatan ? ST.lucutJawatan(j.kod) : null;
      hasil.mesej = 'Undi Tidak Percaya: ' + peratus + '% ahli sayap menyokong anda (perlu 50%). Anda hilang jawatan ' + j.jawatan + ' (IP ' + CONFIG.KALAH.ip + ', Reputasi ' + CONFIG.KALAH.reputasi + '). Bertanding semula pada pemilihan seterusnya.' + (lp && lp.ok ? '' : '');
    } else {
      u.kebalSehingga = idx + CONFIG.KEBAL_BULAN;
      s.applyEffects({ reputasi: CONFIG.MENANG.reputasi }, { kiraTindakan: false, patch: { undiTP: u }, log: { tindakan: 'undi_tidak_percaya', nama: 'Selamat Undi Tidak Percaya: ' + j.jawatan, peringkat: 'sayap' } });
      hasil.mesej = 'Undi Tidak Percaya: ' + peratus + '% ahli sayap menyokong anda. Anda selamat mempertahankan ' + j.jawatan + ' dan kebal ' + CONFIG.KEBAL_BULAN + ' bulan. Pulihkan sokongan akar umbi segera.';
    }
    out.peristiwa.push(hasil);
    return out;
  }

  /* ------------------------------------------------------------------------
     3. ACARA TRANSISI UMUR RASMI (amaran tahunan)
     ------------------------------------------------------------------------ */
  /** Dipanggil pada pertukaran tahun. Peringatan rasmi bagi Pemuda/Puteri yang menghampiri had umur. */
  function prosesTahunBaharu() {
    var s = S(), p = s && s.loadPlayer(), out = { peristiwa: [] }, sy = SY();
    if (!p || p.tamat || !sy || !sy.notisTransisi) { return out; }
    var n = sy.notisTransisi(p);
    if (!n || n.baki <= 0) { return out; }
    out.peristiwa.push({ jenis: 'transisi_amaran', mesej: 'Notis Rasmi Majlis Sayap ' + sy.INFO[n.sayap].nama + ': ' + n.tajuk + '. Anda berumur ' + n.umur + ' tahun; had umur sayap ialah ' + n.had + '. ' +
      'Dalam ' + n.baki + ' tahun, anda wajib bertransisi dan bertanding di Dewan Induk. Jawatan sayap anda akan dilepaskan pada upacara graduasi. Pupuk IP dan akar umbi sekarang untuk Legacy Loyalty (anggaran +' + n.anggaran + ').' });
    return out;
  }

  return {
    CONFIG: CONFIG, MISI: MISI, getMisi: getMisi, jalankanMisi: jalankanMisi,
    amaranUndi: amaranUndi, prosesBulan: prosesBulan, prosesTahunBaharu: prosesTahunBaharu,
    jawatanSayapTertinggi: jawatanSayapTertinggi
  };
});
