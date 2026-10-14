/* ==========================================================================
   Nusa Politik — js/pru-ui.js   (v7.3 / v7.4)
   UI Dashboard bagi Sistem PRU/PRN (js/pru.js) dan Kabinet & EXCO (js/kabinet.js):
     - kad status PRU, Dashboard Kempen 14 hari (Tindakan / Final Push / kejutan), kad Janji Manifesto,
       kad Pentadbiran (Tadbir Urus), lencana ADUN / MP / EXCO / Menteri;
     - modal: Pengisytiharan & Pencalonan, Rundingan Kerusi, Manifesto (3 janji) & Peruntukan, Kejutan, Keputusan,
       Lobi Portfolio, Acara Pentadbiran.
   Bergantung pada W.NusaUI (modal, toast, render, esc, fmt) yang didedahkan oleh js/app.js.
   ========================================================================== */
(function (W) {
  'use strict';
  var PRU = W.MyPolitikPRU, KB = W.MyPolitikKabinet, S = W.MyPolitikSave;
  if (!PRU || !S) { return; }
  var BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  var sibuk = false;

  function U() { return W.NusaUI; }
  function esc(s) { return U() ? U().esc(s) : String(s); }
  function fmt(n) { return Number(n || 0).toLocaleString('ms-MY'); }
  function modal(o) { return U().modal(o); }
  function toast(t, j) { if (U()) { U().toast(t, j); } }
  function segarkan() { if (U()) { U().render(); } }
  function tanda(n) { return (n > 0 ? '+' : '') + n; }

  var CSS = '' +
    '.pru-hari{display:flex;gap:3px;margin:6px 0 10px}.pru-hari i{flex:1;height:14px;border:2px solid var(--garis,var(--border));border-radius:2px;background:var(--bg-elev-1)}' +
    '.pru-hari i.d{background:var(--red)}.pru-hari i.n{background:var(--gold)}.pru-hari i.f{border-style:dashed}' +
    '.pru-pecah{display:flex;height:26px;border:2px solid var(--garis,var(--border));border-radius:4px;overflow:hidden;margin:6px 0}' +
    '.pru-pecah div{display:grid;place-items:center;color:#fff;font-size:.72rem;font-weight:800;min-width:0;white-space:nowrap;overflow:hidden}' +
    '.pru-pecah .anda{background:#14994F}.pru-pecah .lawan{background:#C8102E}.pru-pecah .rakan{background:#555}' +
    '.pru-log{margin:8px 0 0;padding:0;list-style:none;font-size:.8rem}.pru-log li{border-left:4px solid var(--garis,var(--border));padding-left:8px;margin:4px 0;color:var(--text-muted)}' +
    '.pru-final{background:var(--red);color:#fff;border:2px solid var(--garis,#111);padding:6px 10px;font-weight:900;font-size:.8rem;text-transform:uppercase;margin:10px 0 8px;text-align:center}' +
    '.pru-menang{background:#14994F;color:#fff;border:3px solid var(--garis,#111);padding:10px;text-align:center;font-weight:900;font-size:1.1rem;text-transform:uppercase;margin-bottom:8px}' +
    '.pru-kalah{background:#555}.pru-ok{color:#14994F;font-weight:800}.pru-ng{color:#D3162F;font-weight:800}' +
    '.pru-jns{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0}.pru-pilih{display:grid;gap:8px;margin:8px 0}' +
    '.pru-pilih label{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:2px solid var(--garis,var(--border));border-radius:6px;cursor:pointer;background:var(--bg-elev-2)}' +
    '.pru-pilih label small{display:block;color:var(--text-muted)}.pru-pilih input{margin-top:3px;accent-color:var(--red)}';
  (function () { var s = W.document.createElement('style'); s.textContent = CSS; W.document.head.appendChild(s); })();

  function bar(label, nilai, bahaya, teks) {
    nilai = Math.max(0, Math.min(100, Math.round(nilai)));
    return '<div class="loy__row"><div class="loy__label"><span>' + esc(label) + '</span><b>' + esc(teks || (nilai + '%')) + '</b></div>' +
      '<div class="progress progress--sm' + (bahaya ? ' progress--danger' : '') + '" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + nilai + '"><div class="progress__bar" style="width:' + nilai + '%"></div></div></div>';
  }
  function pecahHtml(pk) {
    return '<div class="pru-pecah">' + pk.map(function (x) { return '<div class="' + x.ke + '" style="width:' + Math.max(8, x.nilai) + '%" title="' + esc(x.nama) + '">' + esc(x.nama.replace(' (UMNO)', '')) + ' ' + Math.round(x.nilai) + '%</div>'; }).join('') + '</div>';
  }
  function fx(r) { return r ? '<span class="badge badge--gold">' + esc(r) + '</span>' : ''; }

  /* ---------------------------------------------------------------- KAD */
  function ringkasKesan(t) {
    var h = [];
    if (t.dana) { h.push('−RM ' + fmt(t.dana)); }
    if (t.jentera) { h.push('Jentera ' + (t.jentera > 0 ? '+' : '') + t.jentera + '%'); }
    if (t.gain && t.gain[1] > 0) { h.push('Sokongan +' + t.gain[0] + '–' + t.gain[1] + '%'); }
    if (t.hasil) { h.push('Dana +RM ' + fmt(t.hasil[0]) + '–' + fmt(t.hasil[1])); }
    if (t.stress) { h.push('Stress ' + tanda(t.stress)); }
    if (t.risiko) { h.push('Risiko ' + (t.jenisRisiko === 'sprm' ? 'siasatan SPRM' : 'fitnah') + ' ' + Math.round(t.risiko * 100) + '%'); }
    return h.join(' · ');
  }
  function kadKempen(p, ck) {
    var a = ck.aktif, h = '<section class="card pru-kempen"><h2 class="card__title" style="margin:0 0 4px">🗳️ Kempen · ' + esc(a.kerusi ? a.kerusi.nama : '') + ' (' + (a.candidateType === 'DUN' ? 'DUN' : 'Parlimen') + ') ' + ck.ikonProfil + ' ' + esc(ck.profilNama) + '</h2>';
    h += '<p class="note">Hari <b>' + ck.hariSemasa + '/14</b> · ' + (a.isThreeCorneredFight ? '<b class="pru-ng">⚠️ Pertandingan 3-penjuru</b>' : 'Pertandingan 1-lawan-1') + ' · Populariti parti ' + a.partiPopulariti + '%</p>';
    h += '<div class="pru-hari" aria-hidden="true">';
    for (var i = 0; i < 14; i++) { h += '<i class="' + (i < ck.hariSemasa ? 'd' : i === ck.hariSemasa ? 'n' : '') + (i >= 12 ? ' f' : '') + '"></i>'; }
    h += '</div>' + pecahHtml(ck.pecahan);
    h += bar('Sokongan pengundi', a.voterSupport, a.voterSupport < 30) + bar('Dana kempen', Math.min(100, a.campaignFunds / 100), a.campaignFunds < 1500, 'RM ' + fmt(a.campaignFunds)) + bar('Tenaga jentera', a.jentera, a.jentera < 40) + bar('Stress', p.stress || 0, (p.stress || 0) >= 60);
    h += '<p class="note" style="margin-top:6px">📜 ' + ck.janji.map(function (j) { return esc(j.ikon + ' ' + j.nama); }).join(' · ') + '</p>';
    if (ck.kejutan) { h += '<button type="button" class="btn btn--primary btn--block" data-pru="kejutan">⚡ Kejutan Kempen hari ke-' + ck.kejutan.hari + ': ' + esc(ck.kejutan.tajuk) + '</button>'; }
    else if (ck.hariBaki <= 0) { h += '<button type="button" class="btn btn--primary btn--block" data-pru="selesai">🗳️ Hari Mengundi: Lihat Keputusan</button>'; }
    else {
      if (ck.hariFinal) { h += '<div class="pru-final">🚨 War Room · Hari ' + (ck.hariSemasa + 1) + ' · Final Push dibuka (satu sehari, risiko berganda jika diulang)</div><div class="choice-list">' + ck.final.map(btnTindak).join('') + '</div><p class="note" style="margin:10px 0 4px">Tindakan biasa:</p>'; }
      h += '<div class="choice-list">' + ck.biasa.map(btnTindak).join('') + '</div>';
    }
    if (a.log && a.log.length) { h += '<ul class="pru-log">' + a.log.slice(0, 4).map(function (l) { return '<li><b>Hari ' + l.hari + ':</b> ' + esc(l.teks) + '</li>'; }).join('') + '</ul>'; }
    return h + '</section>';
  }
  function btnTindak(t) {
    return '<button type="button" class="choice" data-pru="tindak" data-id="' + esc(t.id) + '"' + (t.boleh ? '' : ' disabled') + '><span class="choice__title">' + t.ikon + ' ' + esc(t.nama) +
      (t.pengganda && t.pengganda !== 1 ? ' <span class="badge ' + (t.pengganda > 1 ? 'badge--gold' : 'badge--red') + '">×' + t.pengganda + '</span>' : '') + '</span><span class="choice__fx">' + fx(ringkasKesan(t)) + '</span>' +
      (t.boleh ? '' : '<span class="choice__desc" style="color:var(--danger)">' + esc(t.sebab) + '</span>') + '</button>';
  }
  function kadPRU(p) {
    var r = PRU.ringkasan(p), a = r.aktif, h = '';
    if (!a) {
      var bl = r.bulanKePRU;
      var tek = r.status ? '<b>' + (r.status.jenis === 'ADUN' ? 'ADUN' : 'Ahli Parlimen') + ' ' + esc(r.status.kerusi) + '</b> · ' : '';
      h = '<div class="banner' + (bl <= 12 && bl >= 0 ? ' banner--gold' : '') + '"><strong>🗳️ PRU/PRN: ' + BULAN[(r.bulanPRU || 1) - 1] + ' ' + r.tahunPRU + '</strong>' + tek +
        (bl > 0 ? bl + ' bulan lagi' : 'Bila-bila masa') + ' · kawasan ' + r.ikonProfil + ' ' + esc(r.profilNama) + '. Kelayakan: DUN ' + (r.kelayakan.DUN.boleh ? '✓' : '✗ (IP ' + r.kelayakan.DUN.ipMin + ' + jawatan)') + ', Parlimen ' + (r.kelayakan.PARLIMEN.boleh ? '✓' : '✗ (IP ' + r.kelayakan.PARLIMEN.ipMin + ' + Ketua Bahagian)') + '.</div>';
      return h;
    }
    if (a.fasa === 'kempen') { return kadKempen(p, PRU.keadaanKempen(p)); }
    if (a.fasa === 'keputusan') { return '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🗳️ Keputusan Pilihan Raya</h2><p class="note">Hari mengundi telah selesai.</p><button type="button" class="btn btn--primary btn--block" data-pru="keputusan">Lihat Keputusan</button></section>'; }
    return '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🗳️ Pilihan Raya Diisytiharkan</h2><p class="note">Fasa: <b>' + ({ isytihar: 'Pencalonan', calon: 'Pencalonan', runding: 'Rundingan kerusi', manifesto: 'Manifesto & peruntukan' }[a.fasa] || a.fasa) + '</b>. Bulan tidak boleh dimajukan sehingga pilihan raya selesai.</p>' +
      '<button type="button" class="btn btn--primary btn--block" data-pru="buka">Teruskan</button></section>';
  }
  function kadJanji(p) {
    var j = PRU.janjiStatus(p);
    if (!j) { return ''; }
    var h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">📜 Janji Manifesto' + (j.dinilai ? ' (telah dinilai)' : '') + '</h2>';
    if (j.dinilai) { return h + '<p class="note">' + esc(j.hasil && j.hasil.ringkas ? j.hasil.ringkas.join(' · ') : '') + '</p></section>'; }
    h += '<p class="note">Dinilai dalam <b>' + j.baki + ' bulan</b>. Belanjakan Dana untuk memajukan janji; pentadbir kerajaan juga menyumbang kemajuan bulanan. Kemajuan ≥ 60% dianggap ditunai.</p>';
    j.senarai.forEach(function (x) {
      h += bar(x.ikon + ' ' + x.nama, x.kemajuan, x.kemajuan < 30) + '<div style="margin:-2px 0 8px"><button type="button" class="btn btn--sm" data-pru="janji" data-id="' + esc(x.id) + '"' + (x.kemajuan >= 100 ? ' disabled' : '') + '>Majukan (−RM ' + fmt(x.kos * 2) + ', +34%)</button></div>';
    });
    return h + '</section>';
  }
  function kadKabinet(p) {
    if (!KB) { return ''; }
    var k = KB.ringkasan(p), h = '';
    if (k.lobi && !k.hasGovernmentRole) {
      return '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🏛️ Lobi Portfolio Kerajaan</h2><p class="note">Parti membentuk kerajaan. Anda boleh melobi satu portfolio (' + k.lobi.baki + ' percubaan tinggal).</p><button type="button" class="btn btn--primary btn--block" data-pru="lobi">Buka Lobi Portfolio</button></section>';
    }
    if (!k.hasGovernmentRole) { return ''; }
    h = '<section class="card"><h2 class="card__title" style="margin:0 0 4px">🏛️ ' + esc(k.portfolioName) + '</h2><p class="note">' + esc(k.tahapNama) + ' · ' + k.bulanBerjawatan + ' bulan berkhidmat · elaun +RM ' + fmt(k.elaun.myr) + ' &amp; +' + k.elaun.ip + ' IP sebulan.</p>';
    var arah = k.arah > 0 ? ' ▲ +' + k.arah : k.arah < 0 ? ' ▼ ' + k.arah : ' ▬';
    h += bar('KPI Portfolio · ' + k.kpiLabel + arah, k.governanceRating, k.governanceRating < 30) + bar('Tekanan politik', k.tekananPolitik, k.tekananPolitik >= 70) +
      bar('Populariti nasional', k.popularitiNasional, k.popularitiNasional < 30) + bar('Risiko rombakan kabinet', k.risikoRombak, k.risikoRombak >= 60);
    h += '<p class="note" style="margin:6px 0 4px"><b>🏗️ Peruntukan Projek (CDF)</b> · baki RM ' + fmt(k.cdfBaki) + ' · digunakan ' + k.cdfBulan + '/' + k.cdfHad + ' bulan ini. Salur ke kawasan sendiri untuk IP; jumlah besar menjejaskan KPI.</p><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' +
      k.cdfPilihan.map(function (x) { return '<button type="button" class="btn btn--sm" data-pru="cdf" data-jumlah="' + x.jumlah + '"' + (x.boleh ? '' : ' disabled title="' + esc(x.sebab) + '"') + '>RM ' + fmt(x.jumlah) + ' → +' + x.ip + ' IP</button>'; }).join('') + '</div>';
    if (k.ratingRendah > 0) { h += '<div class="banner banner--warn" role="alert"><strong>Amaran rombakan</strong>Penarafan di bawah 30% sudah ' + k.ratingRendah + ' bulan. Satu bulan lagi anda digugurkan.</div>'; }
    if (k.acara) { h += '<button type="button" class="btn btn--primary btn--block" data-pru="acara">⚠️ Isu kementerian menunggu: ' + esc(k.acara.tajuk) + '</button>'; }
    return h + '</section>';
  }
  function kad(p) {
    try { return kadPRU(p) + kadJanji(p) + kadKabinet(p); } catch (e) { return ''; }
  }
  function lencana(p) {
    var h = '', pru = PRU.getPRU(p), kb = KB ? KB.getKabinet(p) : null;
    if (pru.status) { h += '<span class="badge-office badge-office--menteri" title="Kerusi ' + esc(pru.status.kerusi) + '">' + (pru.status.jenis === 'ADUN' ? 'ADUN' : 'Ahli Parlimen') + '</span> '; }
    if (kb && kb.hasGovernmentRole) { h += '<span class="badge-office badge-office--menteri">' + esc(kb.portfolioName) + '</span>'; }
    return h;
  }

  /* ---------------------------------------------------------------- ALIRAN */
  function opsi(id, tajuk, kecil, boleh) {
    return '<li><button type="button" class="acara__opsi' + (boleh ? '' : ' is-off') + '" data-pilih="' + esc(id) + '"' + (boleh ? '' : ' disabled') + '><b>' + tajuk + '</b><small>' + kecil + '</small></button></li>';
  }
  async function modPencalonan(p) {
    var r = PRU.ringkasan(p), a = r.aktif, kl = r.kelayakan;
    var sebabLawan = a.sebab === 'krisis' ? 'Krisis Pembubaran Dewan' : 'Tamat penggal 5 tahun';
    function baris(jenis, nama) {
      var k = kl[jenis], ditolak = a.ditolak[jenis];
      return opsi(jenis, (jenis === 'DUN' ? '🏛️ ' : '🏢 ') + 'Kerusi ' + nama + ' <span class="badge">' + r.ikonProfil + ' ' + esc(r.profilNama) + '</span>',
        (jenis === 'DUN' ? esc(p.dun || 'DUN') : esc(p.bahagian || 'Parlimen')) + ' · syor IP ≥ ' + k.ipMin + ' · peruntukan minimum RM ' + fmt(k.minPeruntukan) + '<br>' + (ditolak ? 'Permohonan sudah ditolak.' : k.boleh ? 'Peluang diluluskan ± ' + k.peluang + '%' : esc(k.sebab.join('; '))), k.boleh && !ditolak);
    }
    return modal({
      tajuk: 'Pengisytiharan Pilihan Raya',
      isi: '<p class="acara__ikon" aria-hidden="true">🗳️</p><p><b>' + sebabLawan + '.</b> Hari mengundi dalam 14 hari. Populariti parti: <b>' + a.partiPopulariti + '%</b>. Mohon dicalonkan bertanding:</p>' +
        '<ul class="acara__pil">' + baris('DUN', 'DUN') + baris('PARLIMEN', 'Parlimen') + opsi('NONE', 'Tidak bertanding', 'Fokus jawatan parti. Tiada risiko kehilangan IP.', true) + '</ul>' +
        '<p style="font-size:.8rem">Keputusan pencalonan oleh Majlis Tertinggi bergantung IP, reputasi dan kedudukan parti.</p>',
      butang: []
    });
  }
  async function modRunding(p) {
    var a = PRU.getPRU(p).aktif, rk = PRU.KOS_RUNDING;
    return modal({
      tajuk: 'Rundingan Kerusi & Gabungan',
      isi: '<p class="acara__ikon" aria-hidden="true">🤝</p><p>Kerusi <b>' + esc(a.kerusi.nama) + '</b> turut dituntut oleh rakan gabungan. Jika rundingan gagal, undi terbahagi tiga (3-penjuru) dan kemenangan lebih sukar.</p><p style="font-size:.85rem">IP: <b>' + fmt(p.ip) + '</b> · Hubungan gabungan: <b>' + PRU.getPRU(p).hubunganGabungan + '</b>/100</p><ul class="acara__pil">' +
        opsi('berdepan', 'Runding berdepan', 'Kos IP ' + rk.berdepan.ip + ' · Berjaya ± ' + Math.round(rk.berdepan.jaya * 100) + '% → 1-lawan-1; gagal → 3-penjuru', p.ip >= rk.berdepan.ip) +
        (a.candidateType === 'PARLIMEN' ? opsi('ganti', 'Tawar kerusi DUN sebagai ganti', 'Kos IP ' + rk.ganti.ip + ' · Berjaya ± ' + Math.round(rk.ganti.jaya * 100) + '% · anda melepaskan kerusi Parlimen ini', p.ip >= rk.ganti.ip) : '') +
        opsi('abai', 'Bertanding juga (abaikan rakan)', 'Pasti 3-penjuru · hubungan gabungan −15 · Reputasi −3', true) + '</ul>',
      butang: []
    });
  }
  async function modManifesto(p) {
    var a = PRU.getPRU(p).aktif, pil = PRU.peruntukanPilihan(p, a), prof = a.constituencyType;
    var isi = '<p>Pilih <b>tepat 3 janji</b> manifesto. Janji yang sesuai dengan kawasan ' + PRU.IKON_PROFIL[prof] + ' <b>' + esc(PRU.PROFIL[prof]) + '</b> memberi bonus sokongan lebih besar. Janji dinilai 12 bulan selepas anda menang.</p><div class="pru-pilih" id="pru-janji">' +
      PRU.JANJI.map(function (j) { return '<label><input type="checkbox" name="janji" value="' + j.id + '"><span><b>' + j.ikon + ' ' + esc(j.nama) + '</b><small>Bonus kawasan ini +' + (j.sesuai[prof] || 0) + ' · kos pelaksanaan RM ' + fmt(j.kosBulan) + '/bulan · risiko dimungkiri ' + Math.round(j.ingkar * 100) + '%</small></span></label>'; }).join('') + '</div>' +
      '<p><b>Peruntukan kempen</b> (diambil daripada Dana anda RM ' + fmt(p.myr) + '; baki dipulangkan):</p><div class="pru-pilih" id="pru-dana">' +
      (pil.pilihan.length ? pil.pilihan.map(function (n, i) { return '<label><input type="radio" name="dana" value="' + n + '"' + (i === 0 ? ' checked' : '') + '><span><b>RM ' + fmt(n) + '</b></span></label>'; }).join('') : '<p class="pru-ng">Dana tidak mencukupi (minimum RM ' + fmt(pil.min) + ').</p>') + '</div>';
    var pr = modal({ tajuk: 'Manifesto & Peruntukan Kempen', isi: isi, butang: [{ label: 'Tunda', nilai: false }, { label: 'Mula Kempen 14 Hari', nilai: true, kelas: 'btn--gold', nonaktif: true }] });
    var kaki = W.document.getElementById('modal-kaki'), mula = kaki && kaki.querySelector('button:last-child'), isiEl = W.document.getElementById('modal-isi');
    function semak() { if (mula) { mula.disabled = !(isiEl.querySelectorAll('input[name=janji]:checked').length === 3 && pil.pilihan.length); } }
    isiEl.addEventListener('change', function (e) {
      var terpilih = isiEl.querySelectorAll('input[name=janji]:checked');
      if (e.target.name === 'janji' && terpilih.length > 3) { e.target.checked = false; toast('Hanya 3 janji boleh dipilih.', 'ralat'); }
      semak();
    });
    var ya = await pr;
    if (!ya) { return null; }
    var ids = [].map.call(isiEl.querySelectorAll('input[name=janji]:checked'), function (x) { return x.value; });
    var d = isiEl.querySelector('input[name=dana]:checked');
    return { ids: ids, dana: d ? Number(d.value) : 0 };
  }

  async function alir() {
    if (sibuk) { return; }
    sibuk = true;
    try {
      var guard = 0;
      while (guard++ < 12) {
        var p = S.loadPlayer(), a = PRU.getPRU(p).aktif;
        if (!a || a.fasa === 'kempen' || a.fasa === 'keputusan') { break; }
        if (a.fasa === 'isytihar' || a.fasa === 'calon') {
          var j = await modPencalonan(p);
          if (!j) { break; }
          if (j === 'NONE') {
            var tb = PRU.tidakBertanding(); toast(tb.mesej || tb.ralat, tb.ok ? 'ok' : 'ralat'); segarkan(); break;
          }
          var r = PRU.pilihKerusi(j);
          if (!r.ok) { toast(r.ralat, 'ralat'); continue; }
          toast(r.mesej, r.diluluskan ? 'ok' : 'ralat'); segarkan();
          if (!r.diluluskan) {
            var p2 = S.loadPlayer(), k2 = PRU.kelayakan(p2), a2 = PRU.getPRU(p2).aktif;
            var masihBoleh = ['DUN', 'PARLIMEN'].some(function (z) { return !a2.ditolak[z] && k2[z].boleh; });
            if (!masihBoleh) { var t2 = PRU.tidakBertanding(); toast('Tiada kerusi lain yang layak. ' + (t2.mesej || ''), 'ralat'); segarkan(); break; }
          }
        } else if (a.fasa === 'runding') {
          var o = await modRunding(p);
          if (!o) { break; }
          var rn = PRU.runding(o);
          if (!rn.ok) { toast(rn.ralat, 'ralat'); continue; }
          segarkan(); await modal({ tajuk: rn.penjuru3 ? '⚠️ Pertandingan 3-Penjuru' : 'Rundingan Berjaya', isi: '<p>' + esc(rn.mesej) + '</p>' });
        } else if (a.fasa === 'manifesto') {
          var m = await modManifesto(p);
          if (!m) { break; }
          var mk = PRU.mulaKempen(m.ids, m.dana);
          if (!mk.ok) { toast(mk.ralat, 'ralat'); continue; }
          segarkan(); toast('Kempen 14 hari bermula!', 'ok');
        } else { break; }
      }
    } finally { sibuk = false; segarkan(); }
  }

  async function kejutan() {
    var p = S.loadPlayer(), ck = PRU.keadaanKempen(p);
    if (!ck || !ck.kejutan) { return; }
    var k = ck.kejutan;
    function kesanTeks(c) {
      var x = c.kesan || null, t = [];
      if (c.rawak) { return 'Berjaya ' + Math.round(c.rawak.p * 100) + '%: ' + ringkasX(c.rawak.jaya) + ' · Gagal: ' + ringkasX(c.rawak.gagal); }
      return ringkasX(x);
    }
    function ringkasX(x) {
      if (!x) { return ''; }
      var t = [];
      if (x.dana) { t.push('Dana ' + (x.dana > 0 ? '+' : '−') + 'RM ' + fmt(Math.abs(x.dana))); }
      if (x.vs) { t.push('Sokongan ' + tanda(x.vs) + '%'); } if (x.vsMin) { t.push('Sokongan +' + x.vsMin + '–' + x.vsMaks + '%'); }
      if (x.jentera) { t.push('Jentera ' + tanda(x.jentera) + '%'); } if (x.stress) { t.push('Stress ' + tanda(x.stress)); } if (x.ip) { t.push('IP ' + tanda(x.ip)); }
      return t.join(' · ');
    }
    var id = await modal({
      tajuk: '⚡ Kejutan Kempen · Hari ' + k.hari,
      isi: '<p class="acara__ikon" aria-hidden="true">' + k.ikon + '</p><p><b>' + esc(k.tajuk) + '</b></p><p>' + esc(k.huraian) + '</p><p style="font-size:.82rem">Dana kempen: <b>RM ' + fmt(ck.aktif.campaignFunds) + '</b> · Jentera ' + Math.round(ck.aktif.jentera) + '%</p><ul class="acara__pil">' +
        k.pilihan.map(function (c) { return opsi(c.id, esc(c.label), esc(kesanTeks(c)) + (c.etika ? ' · berisiko Tataetika' : '') + (c.boleh ? '' : '<br>' + esc(c.sebab)), c.boleh); }).join('') + '</ul>',
      butang: []
    });
    if (!id) { toast('Kejutan masih menunggu keputusan anda.'); segarkan(); return; }
    var r = PRU.jawabKejutan(id);
    if (!r.ok) { toast(r.ralat, 'ralat'); segarkan(); return; }
    toast(r.mesej, r.vs < 0 ? 'ralat' : 'ok'); segarkan();
    if (r.tamat) { await selesai(); }
  }

  function htmlKeputusan(kp, a) {
    var menang = kp.menang && !kp.petisyen;
    var h = '<div class="pru-menang' + (menang ? '' : ' pru-kalah') + '">' + (menang ? '🎉 Anda Menang!' : kp.petisyen ? 'Kerusi Dibatalkan' : 'Anda Kalah') + '</div>';
    h += '<p style="text-align:center"><b>' + (menang ? (a.candidateType === 'DUN' ? 'ADUN ' : 'Ahli Parlimen ') : 'Kerusi ') + esc(a.kerusi ? a.kerusi.nama : '') + '</b>' + (kp.penjuru3 ? ' · pertandingan 3-penjuru' : '') + '</p>';
    h += pecahHtml(kp.pecah);
    h += '<div class="kv"><span>Majoriti</span><b>' + (kp.menang ? fmt(kp.majoriti) + ' undi' : 'kalah ' + fmt(kp.majoriti) + ' undi') + '</b></div><div class="kv"><span>Isu tempatan</span><b>' + esc(((PRU.JANJI.filter(function (j) { return j.id === kp.isuTempatan; })[0] || {}).nama) || '') + (kp.isuTepat ? ' (manifesto anda tepat)' : '') + '</b></div>';
    if (menang) {
      h += '<h3 style="margin:12px 0 4px">Ganjaran</h3><div class="kv"><span>Pengaruh (IP)</span><b class="pru-ok">+' + kp.bonusIp + '</b></div><div class="kv"><span>Reputasi</span><b class="pru-ok">+3</b></div>';
      h += '<p style="font-size:.85rem;margin-top:8px">' + (kp.kerajaan ? '🏛️ Parti anda membentuk kerajaan. <b>Lobi Portfolio</b> (' + (a.candidateType === 'DUN' ? 'EXCO Negeri' : 'Timbalan Menteri / Menteri') + ') kini dibuka.' : 'Parti anda tidak membentuk kerajaan. Jawatan kerajaan tidak dibuka penggal ini.') + '</p>';
    } else if (!kp.petisyen) {
      h += '<h3 style="margin:12px 0 4px">Kesan</h3><div class="kv"><span>Pengaruh (IP)</span><b class="pru-ng">−100</b></div><p style="font-size:.85rem;margin-top:8px">Anda kekal dengan jawatan dalam parti. Boleh bertanding semula pada pilihan raya akan datang.</p>';
    }
    if (kp.siasatMsg) { h += '<p class="' + (kp.petisyen ? 'pru-ng' : '') + '" style="font-size:.85rem;margin-top:8px">' + esc(kp.siasatMsg) + '</p>'; }
    return h;
  }
  async function keputusan() {
    var p = S.loadPlayer(), a = PRU.getPRU(p).aktif;
    if (!a || a.fasa !== 'keputusan' || !a.keputusan) { return; }
    await modal({ tajuk: 'Keputusan Pengundian', isi: htmlKeputusan(a.keputusan, a), butang: [{ label: 'Teruskan', nilai: true, kelas: 'btn--gold' }] });
    var buka = a.keputusan.kabinetBuka;
    PRU.tutupKeputusan(); segarkan();
    if (buka) { await lobi(); }
  }
  async function selesai() {
    var r = PRU.selesaikan();
    if (!r.ok) { toast(r.ralat, 'ralat'); segarkan(); return; }
    segarkan(); await keputusan();
  }

  async function tindak(id) {
    if (sibuk) { return; }
    var r = PRU.tindakanKempen(id);
    if (!r.ok) { toast(r.ralat, 'ralat'); segarkan(); return; }
    toast(r.mesej + (r.risiko ? (r.risiko === 'sprm' ? ' ⚠️ Pihak berkuasa mula memerhati.' : ' ⚠️ Dakwaan fitnah dibuat.') : ''), r.risiko ? 'ralat' : 'ok');
    segarkan();
    sibuk = true;
    try { if (r.kejutan) { await kejutan(); } else if (r.tamat) { await selesai(); } } finally { sibuk = false; segarkan(); }
  }

  /* ---- Kabinet ---- */
  async function lobi() {
    if (!KB) { return; }
    var guard = 0;
    while (guard++ < 5) {
      var p = S.loadPlayer(), k = KB.ringkasan(p);
      if (!k.lobi) { break; }
      var id = await modal({
        tajuk: '🏛️ Lobi Portfolio Kerajaan',
        isi: '<p>Parti membentuk kerajaan. Guna <b>IP</b> dan <b>Dana</b> untuk melobi satu portfolio. Lobi gagal = separuh kos hilang. Percubaan tinggal: <b>' + k.lobi.baki + '</b>.</p><p style="font-size:.85rem">IP: <b>' + fmt(p.ip) + '</b> · Dana: <b>RM ' + fmt(p.myr) + '</b></p><ul class="acara__pil">' +
          k.portfolio.map(function (x) { return opsi(x.id, esc(x.nama), esc(x.tahapNama) + ' · kos IP ' + x.ip + ' + RM ' + fmt(x.myr) + ' · peluang ± ' + x.peluang + '% · elaun +RM ' + fmt(x.elaun.myr) + ' &amp; +' + x.elaun.ip + ' IP/bulan' + (x.boleh ? '' : '<br>' + esc(x.sebab)), x.boleh); }).join('') +
          opsi('LEPAS', 'Tidak melobi', 'Lepaskan peluang penggal ini.', true) + '</ul>',
        butang: []
      });
      if (!id) { break; }
      if (id === 'LEPAS') { KB.lepaskanLobi(); break; }
      var r = KB.lobiPortfolio(id);
      if (!r.ok) { toast(r.ralat, 'ralat'); continue; }
      segarkan();
      await modal({ tajuk: r.dilantik ? '🏛️ Dilantik!' : 'Lobi Gagal', isi: '<p>' + esc(r.mesej) + '</p>' });
      if (r.dilantik || r.tutup) { break; }
    }
    segarkan();
  }
  async function acara() {
    if (!KB) { return; }
    var p = S.loadPlayer(), a = KB.acaraSemasa(p);
    if (!a) { return; }
    function teks(c) {
      function r(x) { var t = []; if (!x) { return ''; } if (x.rating) { t.push('Tadbir Urus ' + tanda(x.rating) + '%'); } if (x.tekanan) { t.push('Tekanan ' + tanda(x.tekanan)); } if (x.myr) { t.push('Dana ' + (x.myr > 0 ? '+' : '−') + 'RM ' + fmt(Math.abs(x.myr))); } if (x.ip) { t.push('IP ' + tanda(x.ip)); } if (x.stress) { t.push('Stress ' + tanda(x.stress)); } if (x.rep) { t.push('Reputasi ' + tanda(x.rep)); } if (x.pop) { t.push('Populariti ' + tanda(x.pop)); } if (x.rombak) { t.push('Risiko rombakan ' + tanda(x.rombak)); } return t.join(' · '); }
      return c.rawak ? 'Berjaya ' + Math.round(c.rawak.p * 100) + '%: ' + r(c.rawak.jaya) + ' · Gagal: ' + r(c.rawak.gagal) : r(c.kesan);
    }
    var id = await modal({
      tajuk: a.ikon + ' ' + a.tajuk,
      isi: '<p>' + esc(a.huraian) + '</p><p style="font-size:.82rem">Penarafan Tadbir Urus: <b>' + KB.getKabinet(p).governanceRating + '%</b></p><ul class="acara__pil">' + a.pilihan.map(function (c) { return opsi(c.id, esc(c.label), esc(teks(c)) + (c.boleh ? '' : '<br>' + esc(c.sebab)), c.boleh); }).join('') + '</ul>',
      butang: []
    });
    if (!id) { toast('Isu kementerian masih menunggu keputusan anda.'); return; }
    var r = KB.jawabAcara(id);
    if (!r.ok) { toast(r.ralat, 'ralat'); return; }
    toast(r.mesej + (r.rating ? ' Tadbir Urus ' + tanda(r.rating) + '%.' : ''), r.rating < 0 ? 'ralat' : 'ok'); segarkan();
  }
  async function salurCDF(jumlah) {
    var r = KB.salurCDF(jumlah);
    toast(r.ok ? r.mesej : r.ralat, r.ok ? 'ok' : 'ralat'); segarkan();
  }
  async function majuJanji(id) {
    var r = PRU.majukanJanji(id);
    toast(r.ok ? r.mesej : r.ralat, r.ok ? 'ok' : 'ralat'); segarkan();
  }

  async function selepasBulan(peristiwa) {
    var senarai = peristiwa || [];
    if (senarai.some(function (e) { return e.jenis === 'pru_isytihar'; })) { await alir(); return; }
    if (senarai.some(function (e) { return e.jenis === 'kabinet_acara'; })) { await acara(); }
  }

  W.document.addEventListener('click', function (ev) {
    var t = ev.target.closest ? ev.target.closest('[data-pru]') : null;
    if (!t || t.disabled) { return; }
    var a = t.getAttribute('data-pru');
    if (a === 'buka') { alir(); } else if (a === 'tindak') { tindak(t.getAttribute('data-id')); } else if (a === 'kejutan') { sibuk = true; kejutan().then(function () { sibuk = false; segarkan(); }, function () { sibuk = false; }); }
    else if (a === 'selesai') { selesai(); } else if (a === 'keputusan') { keputusan(); } else if (a === 'lobi') { lobi(); } else if (a === 'acara') { acara(); } else if (a === 'cdf') { salurCDF(t.getAttribute('data-jumlah')); } else if (a === 'janji') { majuJanji(t.getAttribute('data-id')); }
  });

  W.NusaPRU_UI = { kad: kad, lencana: lencana, selepasBulan: selepasBulan, alir: alir, kejutan: kejutan, keputusan: keputusan, lobi: lobi, acara: acara, selesai: selesai };
})(window);
