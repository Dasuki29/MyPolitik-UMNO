/* ==========================================================================
   Nusa Politik — js/sayap.js   (v5.9)
   Mod Kerjaya Berbilang Sayap: laluan kerjaya dipilih semasa pendaftaran dan kelebihan (buff) setiap sayap.

   Laluan (profil.sayap): 'utama' (Induk) | 'pemuda' | 'puteri' | 'wanita'
     - Utama / Induk : tiada jawatan sayap; laluan jawatan utama sahaja. Kekal sepanjang kerjaya.
     - Pemuda  (lelaki 18-40), Puteri (perempuan 18-35), Wanita (perempuan 36-59): jawatan sayap dibuka.
   Apabila umur melepasi had kategori, laluan sayap bertukar mengikut kategori (hayat.js); laluan Utama tidak berubah.

   Kelebihan (angka ialah andaian permainan; laras dalam CONFIG):
     Utama  : +10% pada setiap kemasukan Dana (elaun dan sumbangan).
     Pemuda : +20% kenaikan IP (selepas redaman IP tinggi), tetapi beban Stress bulanan +10%.
     Puteri : +25% kenaikan Kesetiaan AJK dan Perwakilan, dan +25% kenaikan Reputasi Parti.
     Wanita : kerugian Kesetiaan Akar Umbi -30%, susutan akar umbi bulanan pemegang jawatan -1,
              beban Stress bulanan -20% dan pemulihan Stress +1 sebulan.
   Modul ini tiada kebergantungan; save.js, stress.js dan calendar.js memanggilnya.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikSayap = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  var SENARAI = ['utama', 'pemuda', 'puteri', 'wanita'];
  var SAYAP = ['pemuda', 'puteri', 'wanita'];

  var CONFIG = {
    utama:  { danaMult: 1.10 },
    pemuda: { ipMult: 1.20, bebanStresMult: 1.10 },
    puteri: { kesetiaanMult: { ajk: 1.25, perwakilan: 1.25 }, reputasiMult: 1.25 },
    wanita: { akarUmbiRugiMult: 0.70, susutAkarUmbiKurang: 1, bebanStresMult: 0.80, pemulihanStresTambah: 1 }
  };

  var INFO = {
    utama:  { kod: 'utama',  nama: 'Utama / Induk', ikon: '🏛️', ringkas: 'Laluan jawatan utama parti', kelebihan: ['+10% Dana masuk'], syarat: 'Terbuka kepada semua.' },
    pemuda: { kod: 'pemuda', nama: 'Pemuda',        ikon: '⚡', ringkas: 'Laju naik, tetapi lebih penat', kelebihan: ['+20% kenaikan IP', 'Beban Stress +10%'], syarat: 'Lelaki berumur 18 hingga 40 tahun.' },
    puteri: { kod: 'puteri', nama: 'Puteri',        ikon: '🌸', ringkas: 'Rangkaian dan nama baik', kelebihan: ['+25% kesetiaan AJK dan Perwakilan', '+25% Reputasi Parti'], syarat: 'Perempuan berumur 18 hingga 35 tahun.' },
    wanita: { kod: 'wanita', nama: 'Wanita',        ikon: '🛡️', ringkas: 'Stabil dan tenang', kelebihan: ['Kerugian akar umbi -30%', 'Susutan akar umbi pemegang jawatan -1', 'Beban Stress -20%, pulih +1'], syarat: 'Perempuan berumur 36 hingga 59 tahun.' }
  };

  /** Isu fokus golongan setiap sayap (v6.0). Digunakan pada Struktur Organisasi dan Mesyuarat Sayap (meeting.js). */
  var ISU = {
    pemuda: { golongan: 'lelaki muda', isu: ['Pekerjaan dan gaji permulaan', 'Rumah pertama', 'Kos sara hidup belia', 'Ekonomi gig dan digital'] },
    puteri: { golongan: 'perempuan muda', isu: ['Keselamatan dan gangguan', 'Gaji dan kerjaya setara', 'Usahawan muda', 'Kesihatan mental'] },
    wanita: { golongan: 'perempuan dewasa dan warga emas', isu: ['Penjagaan keluarga dan warga emas', 'Kos isi rumah', 'Kesihatan wanita', 'Ibu tunggal dan usahawan mikro'] }
  };

  function sah(k) { return SENARAI.indexOf(k) >= 0; }

  /** Kategori demografi (sama dengan Data.kategoriMengikutUmur): pemuda | puteri | wanita | biasa | veteran | null. */
  function kategori(jantina, umur) {
    var j = String(jantina || '').trim().toUpperCase().charAt(0); umur = parseInt(umur, 10);
    if ((j !== 'L' && j !== 'P') || !isFinite(umur) || umur < 18) { return null; }
    if (umur >= 60) { return 'veteran'; }
    if (j === 'L') { return umur <= 40 ? 'pemuda' : 'biasa'; }
    return umur <= 35 ? 'puteri' : 'wanita';
  }

  /** Laluan dicadangkan: sayap mengikut kategori, atau 'utama' (Biasa / Veteran). */
  function cadangan(jantina, umur) { var k = kategori(jantina, umur); return SAYAP.indexOf(k) >= 0 ? k : 'utama'; }

  /** Kelayakan semua laluan bagi jantina dan umur: { utama:{boleh,sebab}, pemuda:{...}, ... }. */
  function kelayakan(jantina, umur) {
    var k = kategori(jantina, umur), r = {};
    SENARAI.forEach(function (s) {
      r[s] = (s === 'utama' || k === s) ? { boleh: true, sebab: '' } : { boleh: false, sebab: k ? INFO[s].syarat : 'Isi jantina dan umur dahulu.' };
    });
    return r;
  }

  /** Laluan pemain. Profil lama (tiada medan sayap) mengikut avatar/kategori seperti sebelum ini. */
  function kod(p) {
    if (p && sah(p.sayap)) { return p.sayap; }
    var a = p && p.avatar ? p.avatar : (p && p.demografik ? p.demografik.kategoriKod : null);
    return SAYAP.indexOf(a) >= 0 ? a : 'utama';
  }
  /** Sayap jawatan: pemuda | puteri | wanita | null (Utama). */
  function sayapJawatan(p) { var k = kod(p); return k === 'utama' ? null : k; }
  function info(p) { return INFO[kod(p)]; }

  function bulat(asal, baharu) { return asal > 0 ? Math.max(1, Math.round(baharu)) : Math.round(baharu); }

  /**
   * Laraskan kesan sebelum dikenakan (dipanggil oleh Save.applyEffects).
   * k = { ip (selepas redaman), myr, reputasi, kesetiaan:{} }. Pulang salinan terlaras.
   */
  function sesuaikan(p, k) {
    var s = kod(p), o = { ip: k.ip || 0, myr: k.myr || 0, reputasi: k.reputasi || 0, kesetiaan: {} }, c = CONFIG[s] || {};
    Object.keys(k.kesetiaan || {}).forEach(function (n) { o.kesetiaan[n] = k.kesetiaan[n]; });
    if (c.danaMult && o.myr > 0) { o.myr = bulat(o.myr, o.myr * c.danaMult); }
    if (c.ipMult && o.ip > 0) { o.ip = bulat(o.ip, o.ip * c.ipMult); }
    if (c.reputasiMult && o.reputasi > 0) { o.reputasi = bulat(o.reputasi, o.reputasi * c.reputasiMult); }
    if (c.kesetiaanMult) { Object.keys(c.kesetiaanMult).forEach(function (n) { if (o.kesetiaan[n] > 0) { o.kesetiaan[n] = bulat(o.kesetiaan[n], o.kesetiaan[n] * c.kesetiaanMult[n]); } }); }
    if (c.akarUmbiRugiMult && o.kesetiaan.akarUmbi < 0) { o.kesetiaan.akarUmbi = Math.round(o.kesetiaan.akarUmbi * c.akarUmbiRugiMult); }
    return o;
  }

  /** Beban Stress bulanan terlaras mengikut sayap. */
  function bebanStres(p, beban) { var c = CONFIG[kod(p)] || {}; return c.bebanStresMult && beban > 0 ? Math.max(1, Math.round(beban * c.bebanStresMult)) : beban; }
  /** Tambahan pemulihan Stress sebulan. */
  function pemulihanStres(p) { return (CONFIG[kod(p)] || {}).pemulihanStresTambah || 0; }
  /** Pengurangan susutan akar umbi bulanan bagi pemegang jawatan. */
  function kurangSusutAkarUmbi(p) { return (CONFIG[kod(p)] || {}).susutAkarUmbiKurang || 0; }


  /* ========================================================================
     v6.5  TINDAKAN KHAS SAYAP dan FASA TRANSISI KE DEWAN INDUK
     ======================================================================== */
  function modul(nama, fail) {
    var g = typeof globalThis !== 'undefined' ? globalThis : null;
    if (g && g[nama]) { return g[nama]; }
    try { return typeof require === 'function' ? require('./' + fail) : null; } catch (e) { return null; }
  }
  function bulatan(n) { return Math.round(n); }
  function indeksBulan(p) { return (parseInt(p.tahun, 10) || 0) * 12 + (parseInt(p.bulan, 10) || 1); }

  /**
   * Tindakan khas setiap sayap (satu kali sebulan setiap pemain). Nilai ialah andaian permainan.
   *   kesan  : dihantar ke Save.applyEffects (kena buff sayap dan bonus bulan 1-3 akar umbi)
   *   stres  : laras Stress / Kesihatan
   *   khas   : kesan tambahan ('ahli_kuota' = tambah ahli Cawangan dan kuota perwakilan; 'perisai' = hentikan susutan sokongan)
   */
  var TINDAKAN_SAYAP = {
    pemuda: {
      id: 'kempen_saraf_digital', nama: 'Kempen Saraf Digital', ikon: '📲',
      penerangan: 'Kempen media sosial besar-besaran: video pendek, siaran langsung dan cabaran tular. IP naik tinggi, tetapi memenatkan.',
      kesan: { ap: -2, myr: -300, ip: 24, reputasi: 1, kesetiaan: { akarUmbi: 3 } }, stres: { stress: 9 }
    },
    wanita: {
      id: 'skuad_sayang', nama: 'Skuad Sayang / Ziarah Kasih', ikon: '🤝',
      penerangan: 'Skuad Wanita menziarahi ahli dan keluarga yang memerlukan. Sokongan Cawangan dikekalkan dua bulan (tiada susutan akar umbi dan AJK) dan Stress berkurang.',
      kesan: { ap: -2, ip: 6, kesetiaan: { akarUmbi: 10, ajk: 4 } }, stres: { stress: -10, kesihatan: 2 }, khas: 'perisai'
    },
    puteri: {
      id: 'kempen_outreach_belia', nama: 'Kempen Outreach Belia', ikon: '🌸',
      penerangan: 'Turun ke kampus dan kolej komuniti untuk mendaftar ahli baharu. Menambah ahli Cawangan dan +1 kerusi perwakilan tahun ini (maksimum +2 setahun).',
      kesan: { ap: -2, myr: -400, ip: 8, kesetiaan: { perwakilan: 8, akarUmbi: 4 } }, khas: 'ahli_kuota'
    }
  };
  var TS_CONFIG = {
    AHLI_BARU: { puteri: 5, pemuda: 3 },     // ahli Cawangan yang direkrut setiap Kempen Outreach Belia
    MAKS_AHLI_CAWANGAN: 500,
    MAKS_BONUS_KUOTA: 2,                      // maksimum tambahan kerusi perwakilan setahun
    PERISAI_BULAN: 2                          // bilangan pertukaran bulan sokongan dilindungi
  };

  function tindakanUntuk(p) { var k = kod(p); return TINDAKAN_SAYAP[k] || null; }

  /** Tindakan khas bagi sayap pemain, dengan keadaan butang. Pulang [] untuk laluan Utama. */
  function senaraiTindakanSayap(profil) {
    var S = modul('MyPolitikSave', 'save.js'), p = profil || (S && S.loadPlayer());
    var d = p ? tindakanUntuk(p) : null;
    if (!d) { return []; }
    var st = semakTindakanSayap(d, p);
    return [{
      id: d.id, nama: d.nama, ikon: d.ikon, penerangan: d.penerangan,
      kos: { ap: Math.abs(Math.min(0, d.kesan.ap || 0)), myr: Math.abs(Math.min(0, d.kesan.myr || 0)) },
      ringkas: (S ? S.ringkasPerubahan({ ip: d.kesan.ip || 0, myr: d.kesan.myr || 0, ap: d.kesan.ap || 0, reputasi: d.kesan.reputasi || 0, kesetiaan: d.kesan.kesetiaan || {} }) : '') +
        (d.stres ? ', Stress ' + (d.stres.stress > 0 ? '+' : '') + d.stres.stress : '') + (d.khas === 'ahli_kuota' ? ', ahli baharu dan +1 kerusi perwakilan' : d.khas === 'perisai' ? ', sokongan dilindungi 2 bulan' : ''),
      boleh: st.boleh, sebab: st.sebab
    }];
  }

  function semakTindakanSayap(d, p) {
    var Et = modul('MyPolitikEtika', 'etika.js');
    if (Et) { var hak = Et.semakHak(p, 'tindakan'); if (!hak.boleh) { return { boleh: false, sebab: hak.sebab }; } }
    var u = p.tindakanSayap;
    if (u && u.tahun === p.tahun && u.bulan === p.bulan) { return { boleh: false, sebab: 'Sudah digunakan bulan ini. Cuba lagi bulan depan.' }; }
    if (p.ap + (d.kesan.ap || 0) < 0) { return { boleh: false, sebab: 'AP tidak mencukupi (perlu ' + Math.abs(d.kesan.ap) + ').' }; }
    if (p.myr + (d.kesan.myr || 0) < 0) { return { boleh: false, sebab: 'Wang tidak mencukupi (perlu ' + Math.abs(d.kesan.myr) + ').' }; }
    return { boleh: true, sebab: '' };
  }

  /** Jalankan tindakan khas sayap. Pulang { ok, mesej, perubahan, profil } atau { ok:false, kod, ralat }. */
  function jalankanTindakanSayap(id) {
    var S = modul('MyPolitikSave', 'save.js'), p = S && S.loadPlayer();
    if (!p) { return { ok: false, kod: 'tiada_profil', ralat: 'Tiada profil pemain.' }; }
    var d = tindakanUntuk(p);
    if (!d || d.id !== id) { return { ok: false, kod: 'bukan_sayap_anda', ralat: 'Tindakan ini bukan untuk laluan sayap anda.' }; }
    var st = semakTindakanSayap(d, p);
    if (!st.boleh) { return { ok: false, kod: 'tidak_boleh', ralat: st.sebab }; }

    var K = modul('MyPolitikCalendar', 'calendar.js'), kesan = JSON.parse(JSON.stringify(d.kesan));
    if (K && K.skalaKesan) { kesan = K.skalaKesan(p, kesan); }                  // bonus musim akar umbi (bulan 1-3)
    var patch = { tindakanSayap: { tahun: p.tahun, bulan: p.bulan, id: d.id } }, nota = '';
    if (d.khas === 'perisai') { patch.perisaiSokongan = indeksBulan(p) + TS_CONFIG.PERISAI_BULAN - 1; }
    if (d.khas === 'ahli_kuota') {
      var info = JSON.parse(JSON.stringify(p.cawanganInfo || {})), tambah = TS_CONFIG.AHLI_BARU.puteri + TS_CONFIG.AHLI_BARU.pemuda;
      var jumlah = Math.min(TS_CONFIG.MAKS_AHLI_CAWANGAN, (Number(info.jumlahAhli) || 0) + tambah), sebenar = jumlah - (Number(info.jumlahAhli) || 0);
      if (sebenar > 0) {
        info.jumlahAhli = jumlah;
        if (info.kumpulan) { info.kumpulan.puteri = (info.kumpulan.puteri || 0) + Math.min(sebenar, TS_CONFIG.AHLI_BARU.puteri); info.kumpulan.pemuda = (info.kumpulan.pemuda || 0) + Math.max(0, sebenar - TS_CONFIG.AHLI_BARU.puteri); }
        patch.cawanganInfo = info; nota += ' ' + sebenar + ' ahli baharu direkrut.';
      }
      var bk = p.bonusKuota && p.bonusKuota.tahun === p.tahun ? p.bonusKuota.kerusi : 0;
      if (bk < TS_CONFIG.MAKS_BONUS_KUOTA) { patch.bonusKuota = { tahun: p.tahun, kerusi: bk + 1 }; nota += ' +1 kerusi perwakilan tahun ' + p.tahun + '.'; }
      else { nota += ' Bonus kerusi perwakilan tahun ini sudah mencapai had (+' + TS_CONFIG.MAKS_BONUS_KUOTA + ').'; }
    }
    var r = S.applyEffects(kesan, { patch: patch, log: { tindakan: d.id, nama: d.nama, peringkat: 'sayap' } });
    if (!r.ok) { return r; }
    if (d.stres) { var STr = modul('MyPolitikStres', 'stress.js'); if (STr && STr.laras) { STr.laras(d.stres); r.perubahan.stres = d.stres; } }
    if (d.khas === 'perisai') { nota += ' Susutan sokongan Cawangan dihentikan untuk ' + TS_CONFIG.PERISAI_BULAN + ' bulan.'; }
    var mesej = d.nama + ': ' + S.ringkasPerubahan(r.perubahan) + '.' + (d.stres ? ' Stress ' + (d.stres.stress > 0 ? '+' : '') + d.stres.stress + '.' : '') + nota;
    return { ok: true, mesej: mesej, perubahan: r.perubahan, profil: r.profil };
  }

  /** Tambahan kerusi perwakilan tahun ini daripada Kempen Outreach Belia (dipakai election.js). */
  function bonusKuota(p) { return p && p.bonusKuota && p.bonusKuota.tahun === p.tahun ? Math.min(TS_CONFIG.MAKS_BONUS_KUOTA, p.bonusKuota.kerusi || 0) : 0; }
  /** Adakah sokongan Cawangan masih dilindungi Skuad Sayang untuk pertukaran bulan semasa? (dipakai calendar.js) */
  function sokonganDilindungi(p) { return !!(p && Number(p.perisaiSokongan) >= indeksBulan(p)); }

  /* ---------- Fasa Transisi ke Dewan Induk ---------- */
  var TRANSISI = {
    pemuda: { had: 40, amaran: 38 },          // lelaki: sayap Pemuda sehingga 40 tahun
    puteri: { had: 35, amaran: 33 }           // andaian: had Puteri ialah 35 tahun dalam permainan; 'amaran' 2 tahun lebih awal
  };
  var WARISAN = { IP_SKALA: 250, BERAT_IP: 7, BERAT_AKAR: 7, MAKS: 14, TAHUN: 6 };

  function umurPemain(p) {
    var H = modul('MyPolitikHayat', 'hayat.js');
    if (H && H.umurSemasa) { return H.umurSemasa(p); }
    if (!p || !p.demografik) { return null; }
    return (parseInt(p.demografik.umur, 10) || 0) + Math.max(0, (parseInt(p.tahun, 10) || 2026) - 2026);
  }

  /** Bonus kekuatan (0 hingga MAKS) jika pemain bertransisi dengan IP dan kesetiaan akar umbi ini. */
  function kiraBonusWarisan(ip, akarUmbi) {
    var v = Math.min(1, (Number(ip) || 0) / WARISAN.IP_SKALA) * WARISAN.BERAT_IP + Math.min(1, (Number(akarUmbi) || 0) / 100) * WARISAN.BERAT_AKAR;
    return Math.max(0, Math.min(WARISAN.MAKS, bulatan(v)));
  }

  /** Notis amaran transisi, atau null. Pulang { sayap, umur, had, baki, tajuk, mesej, anggaran } bagi pemain Pemuda/Puteri berumur 'amaran' hingga 'had'. */
  function notisTransisi(profil) {
    var S = modul('MyPolitikSave', 'save.js'), p = profil || (S && S.loadPlayer());
    if (!p || p.tamat) { return null; }
    var k = kod(p), t = TRANSISI[k], umur = umurPemain(p);
    if (!t || umur === null || umur < t.amaran || umur > t.had) { return null; }
    var baki = t.had - umur, anggaran = kiraBonusWarisan(p.ip, p.kesetiaan ? p.kesetiaan.akarUmbi : 0);
    return {
      sayap: k, umur: umur, had: t.had, baki: baki, tajuk: 'Fasa Transisi Ke Dewan Induk', anggaran: anggaran,
      mesej: 'Anda berumur ' + umur + ' tahun. Had umur sayap ' + INFO[k].nama + ' ialah ' + t.had + ' tahun, ' + (baki > 0 ? 'jadi anda akan bertransisi dalam ' + baki + ' tahun.' : 'jadi anda akan bertransisi pada tahun depan.') +
        ' IP dan kesetiaan akar umbi yang anda pupuk sekarang dibawa ke Dewan Induk sebagai Legacy Loyalty (anggaran semasa: +' + anggaran + ' kekuatan undi dalam pertandingan Induk).'
    };
  }

  /** Warisan yang akan disimpan apabila pemain bertukar laluan keluar daripada sayap (dipanggil hayat.js). */
  function bentukWarisan(p, daripada) {
    var ip = Number(p.ip) || 0, au = p.kesetiaan ? Number(p.kesetiaan.akarUmbi) || 0 : 0;
    return { dari: daripada, tahun: p.tahun, tamatTahun: p.tahun + WARISAN.TAHUN, ip: ip, akarUmbi: au, bonus: kiraBonusWarisan(ip, au) };
  }

  /** Bonus Legacy Loyalty semasa (susut mendatar sehingga sifar dalam WARISAN.TAHUN tahun). */
  function bonusWarisan(p, pertandingan) {
    var w = p && p.warisan;
    if (!w || !w.bonus) { return 0; }
    if (pertandingan && (pertandingan.kumpulan === 'sayap' || pertandingan.sayap)) { return 0; }     // hanya pertandingan Induk (jawatan utama dan perwakilan)
    var umurW = (parseInt(p.tahun, 10) || 0) - (parseInt(w.tahun, 10) || 0);
    if (umurW < 0 || umurW >= WARISAN.TAHUN) { return 0; }
    return bulatan(w.bonus * (1 - umurW / WARISAN.TAHUN));
  }
  function ringkasWarisan(p) {
    var w = p && p.warisan, b = w ? bonusWarisan(p, null) : 0;
    return w && b > 0 ? { dari: w.dari, tahun: w.tahun, bonus: b, awal: w.bonus, tamatTahun: w.tamatTahun } : null;
  }

  return {
    SENARAI: SENARAI, SAYAP: SAYAP, CONFIG: CONFIG, INFO: INFO, ISU: ISU, sah: sah, kategori: kategori, cadangan: cadangan, kelayakan: kelayakan,
    kod: kod, sayapJawatan: sayapJawatan, info: info, sesuaikan: sesuaikan, bebanStres: bebanStres, pemulihanStres: pemulihanStres, kurangSusutAkarUmbi: kurangSusutAkarUmbi,
    TINDAKAN_SAYAP: TINDAKAN_SAYAP, TRANSISI: TRANSISI, WARISAN: WARISAN, senaraiTindakanSayap: senaraiTindakanSayap, jalankanTindakanSayap: jalankanTindakanSayap,
    bonusKuota: bonusKuota, sokonganDilindungi: sokonganDilindungi, notisTransisi: notisTransisi, bentukWarisan: bentukWarisan, bonusWarisan: bonusWarisan, ringkasWarisan: ringkasWarisan, kiraBonusWarisan: kiraBonusWarisan
  };
});
