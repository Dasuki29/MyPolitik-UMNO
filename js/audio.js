/* ==========================================================================
   Nusa Politik — js/audio.js
   Pemutar muzik latar belakang (pada semua halaman).

   Sumber muzik:
     1. Fail anda: letakkan MP3/OGG di assets/audio/ dan tetapkan
          window.MYPOLITIK_CONFIG.musicUrl = 'assets/audio/lagu-latar.mp3';
        (Gunakan fail yang anda berhak guna. Lagu rasmi/anthem parti ialah hak cipta
         pemiliknya, jadi tiada fail disertakan di sini.)
     2. Jika tiada fail atau gagal dimuat: gubahan mars ringkas asli dijana oleh
        pelayar (Web Audio) supaya butang tetap berfungsi.

   Pelayar menghalang main automatik. Muzik bermula apabila pemain menekan butang,
   dan pilihan (hidup/mati, kelantangan) diingat dalam localStorage.

   API: MyPolitikAudio.init() (automatik), .play(), .pause(), .toggle(), .setVolume(0..1), .isPlaying()
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.MyPolitikAudio = api;
  if (root.document) {
    var mula = function () { api.init(); };
    if (root.document.readyState === 'loading') { root.document.addEventListener('DOMContentLoaded', mula); } else { mula(); }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var KUNCI = 'myPolitik_muzik';
  var st = { on: false, vol: 0.5, mod: null, el: null, ui: null, ctx: null, master: null, timer: null, langkah: 0, seterusnya: 0, sudahInit: false, tunggu: false };

  function baca() { try { var o = JSON.parse(root.localStorage.getItem(KUNCI) || 'null'); if (o) { st.on = !!o.on; st.vol = typeof o.vol === 'number' ? Math.min(1, Math.max(0, o.vol)) : st.vol; } } catch (e) { /* abaikan */ } }
  function simpan() { try { root.localStorage.setItem(KUNCI, JSON.stringify({ on: st.on, vol: st.vol })); } catch (e) { /* abaikan */ } }

  /* ---------- Gubahan mars asli (C major, 4/4, 104 bpm) ---------- */
  var NOT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(nama) {                                   // 'C4', 'F#3'
    var m = /^([A-G])(#?)(\d)$/.exec(nama); if (!m) { return 0; }
    var semi = NOT[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  }
  var BPM = 104;
  /* Setiap elemen: [not, bilangan 1/2-ketuk]. 16 bar x 8 = 128 langkah separuh-ketuk */
  var MELODI = [
    ['C5', 2], ['E5', 2], ['G5', 2], ['E5', 2], ['C5', 2], ['G4', 2], ['E5', 2], ['C5', 2],
    ['D5', 2], ['F5', 2], ['A5', 2], ['F5', 2], ['D5', 2], ['A4', 2], ['F5', 2], ['D5', 2],
    ['E5', 2], ['G5', 2], ['C6', 2], ['G5', 2], ['E5', 2], ['G5', 4],
    ['D5', 2], ['G4', 2], ['B4', 2], ['D5', 2], ['C5', 6], [null, 2],
    ['A4', 2], ['C5', 2], ['E5', 2], ['C5', 2], ['A4', 2], ['E5', 2], ['A5', 2], ['E5', 2],
    ['F5', 2], ['A5', 2], ['C6', 2], ['A5', 2], ['F5', 2], ['C5', 2], ['F5', 2], ['A5', 2],
    ['G5', 2], ['E5', 2], ['D5', 2], ['B4', 2], ['C5', 2], ['E5', 2], ['G5', 2], ['B4', 2],
    ['C5', 4], ['E5', 4], ['C5', 8]
  ];
  var BAS = ['C3', 'G3', 'C3', 'G3', 'F3', 'C3', 'F3', 'C3', 'C3', 'G3', 'G3', 'D3', 'A3', 'E3', 'F3', 'G3'];   // satu not setiap ketuk

  function nadaSintesis(f, mula, tempoh, jenis, vol) {
    var o = st.ctx.createOscillator(), g = st.ctx.createGain();
    o.type = jenis; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, mula);
    g.gain.exponentialRampToValueAtTime(vol, mula + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, mula + tempoh);
    o.connect(g); g.connect(st.master); o.start(mula); o.stop(mula + tempoh + 0.05);
  }

  function jadual() {
    var half = 60 / BPM / 2, ambang = st.ctx.currentTime + 0.5;
    while (st.seterusnya < ambang) {
      var t = Math.max(st.seterusnya, st.ctx.currentTime + 0.02), i = st.langkah % MELODI.length, n = MELODI[i];
      if (n[0]) { nadaSintesis(freq(n[0]), t, half * n[1] * 0.92, 'triangle', 0.22); }
      if (st.langkah % 2 === 0) {                                              // bas pada setiap ketuk
        var kk = st.langkah / 2;
        nadaSintesis(freq(BAS[kk % BAS.length]), t, half * 1.6, 'square', 0.07);
      }
      st.seterusnya += half * 1;                                               // maju separuh-ketuk
      st.langkah++;
      if (n[1] > 1) { st.langkah += 0; }
    }
  }

  /* Elak panjang not menggeser jadual: kembangkan MELODI kepada langkah separuh-ketuk */
  (function kembang() {
    var ls = [];
    MELODI.forEach(function (n) { ls.push(n); for (var k = 1; k < n[1]; k++) { ls.push([null, 1, true]); } });
    ls = ls.map(function (n) { return n[2] ? [null, 1] : [n[0], n[1]]; });
    MELODI.length = 0; ls.forEach(function (n) { MELODI.push(n); });
  })();

  function mulaSintesis() {
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) { return false; }
    if (!st.ctx) { st.ctx = new AC(); st.master = st.ctx.createGain(); st.master.connect(st.ctx.destination); }
    st.master.gain.value = st.vol * 0.8;
    if (st.ctx.state === 'suspended') { st.ctx.resume(); }
    st.langkah = 0; st.seterusnya = st.ctx.currentTime + 0.1;
    jadual(); st.timer = root.setInterval(jadual, 150);
    return true;
  }
  function henti() {
    if (st.timer) { root.clearInterval(st.timer); st.timer = null; }
    if (st.ctx && st.ctx.state === 'running') { st.ctx.suspend(); }
  }

  /* ---------- Main / jeda ---------- */
  function sumberFail() { var c = root.MYPOLITIK_CONFIG || {}; return c.musicUrl || ''; }

  async function play() {
    if (st.mod === 'fail' && st.el) {
      try { st.el.volume = st.vol; await st.el.play(); st.on = true; simpan(); papar(); return true; }
      catch (e) { st.mod = 'sintesis'; }
    }
    var url = sumberFail();
    if (!st.mod && url) {
      try {
        st.el = new root.Audio(); st.el.loop = true; st.el.preload = 'auto'; st.el.src = url; st.el.volume = st.vol;
        st.el.addEventListener('error', function () { if (st.mod === 'fail') { st.mod = 'sintesis'; st.on = true; hentiFail(); mulaSintesis(); papar(); } });
        await st.el.play(); st.mod = 'fail'; st.on = true; simpan(); papar(); return true;
      } catch (e) { st.el = null; }
    }
    st.mod = 'sintesis';
    var ok = mulaSintesis();
    st.on = ok; simpan(); papar();
    return ok;
  }
  function hentiFail() { if (st.el) { try { st.el.pause(); } catch (e) { /* abaikan */ } } }
  function pause() {
    hentiFail(); henti(); st.on = false; simpan(); papar();
  }
  function isPlaying() { return !!st.on; }
  function toggle() { return st.on ? (pause(), false) : play(); }
  function setVolume(v) {
    st.vol = Math.min(1, Math.max(0, Number(v) || 0));
    if (st.el) { st.el.volume = st.vol; }
    if (st.master) { st.master.gain.value = st.vol * 0.8; }
    simpan();
  }

  /* ---------- UI ---------- */
  var CSS = '.mpa-bar{position:fixed;right:12px;bottom:calc(var(--bottom-nav-h,0px) + 12px + env(safe-area-inset-bottom,0px));z-index:90;display:flex;align-items:center;gap:6px;padding:6px;background:rgba(22,24,30,.92);border:1px solid var(--border,#2E333F);border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.45);backdrop-filter:blur(10px);font-family:var(--font-body,system-ui)}' +
    '.mpa-btn{width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;font-size:1.2rem;line-height:1;color:#fff;background:linear-gradient(135deg,#C8102E,#9B0C23);display:grid;place-items:center}' +
    '.mpa-btn[aria-pressed="true"]{background:linear-gradient(135deg,#FFD84D,#C99700);color:#2B2100;animation:mpa-p 2s ease-in-out infinite}' +
    '.mpa-btn:focus-visible,.mpa-vol:focus-visible{outline:2px solid #F2B705;outline-offset:2px}' +
    '.mpa-vol{width:84px;accent-color:#F2B705;display:none}.mpa-bar.is-open .mpa-vol{display:block}' +
    '.mpa-vbtn{width:32px;height:32px;border-radius:50%;border:1px solid var(--border,#2E333F);background:transparent;color:var(--text-muted,#A3A9B8);cursor:pointer;font-size:.9rem}' +
    '@keyframes mpa-p{0%,100%{box-shadow:0 0 0 0 rgba(242,183,5,.5)}50%{box-shadow:0 0 0 8px rgba(242,183,5,0)}}' +
    '@media (prefers-reduced-motion:reduce){.mpa-btn[aria-pressed="true"]{animation:none}}';

  function papar() {
    if (!st.ui) { return; }
    var b = st.ui.btn;
    b.setAttribute('aria-pressed', String(!!st.on));
    b.textContent = st.on ? '🔊' : '🔇';
    b.setAttribute('aria-label', st.on ? 'Jeda muzik latar' : 'Mainkan muzik latar');
    b.title = b.getAttribute('aria-label');
  }

  function bina() {
    var d = root.document;
    if (!d || d.getElementById('mpa-bar')) { return; }
    var sty = d.createElement('style'); sty.textContent = CSS; d.head.appendChild(sty);
    var bar = d.createElement('div'); bar.className = 'mpa-bar'; bar.id = 'mpa-bar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Muzik latar');
    var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'mpa-btn';
    var vb = d.createElement('button'); vb.type = 'button'; vb.className = 'mpa-vbtn'; vb.textContent = '⋯'; vb.setAttribute('aria-label', 'Laras kelantangan'); vb.setAttribute('aria-expanded', 'false');
    var vol = d.createElement('input'); vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.className = 'mpa-vol'; vol.value = String(Math.round(st.vol * 100)); vol.setAttribute('aria-label', 'Kelantangan muzik');
    btn.addEventListener('click', function () { toggle(); });
    vb.addEventListener('click', function () { var o = bar.classList.toggle('is-open'); vb.setAttribute('aria-expanded', String(o)); });
    vol.addEventListener('input', function () { setVolume(vol.value / 100); });
    bar.appendChild(vol); bar.appendChild(vb); bar.appendChild(btn); d.body.appendChild(bar);
    st.ui = { btn: btn, vol: vol };
    papar();
  }

  function init() {
    if (st.sudahInit) { return; }
    st.sudahInit = true;
    baca(); bina();
    if (st.on) {                                   // pemain mahu muzik: mula pada gerak isyarat pertama
      st.on = false; papar();
      var mulaAuto = function () {
        root.document.removeEventListener('pointerdown', mulaAuto); root.document.removeEventListener('keydown', mulaAuto);
        play();
      };
      root.document.addEventListener('pointerdown', mulaAuto, { once: true });
      root.document.addEventListener('keydown', mulaAuto, { once: true });
    }
  }

  return { init: init, play: play, pause: pause, toggle: toggle, setVolume: setVolume, isPlaying: isPlaying, _freq: freq };
});
