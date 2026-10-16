/* Jana js/kabinet-data.js daripada data/kabinet-persekutuan.csv (lajur: Portfolio,IP).
   Guna:  node tools/build-kabinet.js */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const baris = fs.readFileSync(path.join(ROOT, 'data/kabinet-persekutuan.csv'), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
function lajur(b) { const o = []; let s = '', q = false; for (const c of b) { if (c === '"') { q = !q; } else if (c === ',' && !q) { o.push(s); s = ''; } else { s += c; } } o.push(s); return o; }
const out = { menteri: [], pm: null, tpm: null };
baris.slice(1).forEach(b => {
  const [nama, ip] = lajur(b).map(x => x.trim()); const n = parseInt(ip, 10);
  if (!nama || !(n > 0)) { console.warn('Dilangkau:', b); return; }
  if (nama === 'Perdana Menteri') { out.pm = n; } else if (nama === 'Timbalan Perdana Menteri') { out.tpm = n; } else { out.menteri.push({ nama, ip: n }); }
});
const kod = '/* Dijana oleh tools/build-kabinet.js daripada data/kabinet-persekutuan.csv. JANGAN ubah manual. */\n(function (root) { root.MyPolitikKabinetData = ' + JSON.stringify(out) + '; if (typeof module === \'object\' && module.exports) { module.exports = root.MyPolitikKabinetData; } })(typeof globalThis !== \'undefined\' ? globalThis : this);\n';
fs.writeFileSync(path.join(ROOT, 'js/kabinet-data.js'), kod);
console.log('Menteri:', out.menteri.length, '· PM', out.pm, '· TPM', out.tpm);
