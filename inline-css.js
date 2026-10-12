#!/usr/bin/env node
/* Menyuntik css/style.css + css/responsive.css ke dalam index.html (antara penanda
   INLINE-CSS) supaya halaman pendaftaran tetap bergaya walaupun folder css/ tiada
   atau gagal dimuat (cth. fail dimuat naik rata ke GitHub).
   Guna: node tools/inline-css.js            (jalankan semula selepas ubah CSS) */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const S = '<!-- INLINE-CSS:START -->', E = '<!-- INLINE-CSS:END -->';
const a = html.indexOf(S), b = html.indexOf(E);
if (a < 0 || b < 0) { console.error('Penanda INLINE-CSS tiada dalam index.html'); process.exit(1); }
const css = (read('css/style.css') + '\n' + read('css/responsive.css')).replace(/<\/style/gi, '<\\/style');
fs.writeFileSync(path.join(root, 'index.html'),
  html.slice(0, a + S.length) + '\n<style id="inline-css">\n' + css + '\n</style>\n' + html.slice(b));
console.log('Selesai: ' + css.length + ' bait CSS disuntik.');
