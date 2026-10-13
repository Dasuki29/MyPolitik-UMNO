# Nusa Politik

Permainan simulasi politik berasaskan struktur parti UMNO. Pemain bermula sebagai **Ahli Biasa** di sebuah Cawangan dan cuba naik ke jawatan Cawangan, Bahagian dan Pusat melalui kitaran pemilihan 3 tahun.

> **Penafian:** Ini permainan simulasi, bukan laman rasmi parti. Nombor, kebarangkalian dan nama pesaing ialah rekaan permainan. Kad "Laluan Karier Sebenar" ialah ringkasan fakta awam bersumber dan tidak menilai mana-mana tokoh.

## Cara main

1. Buka `index.html`, isi nama, jantina, umur, tahun menjadi ahli, pilih Cawangan dan watak.
2. Di dashboard, guna **Mata Tindakan (AP)** setiap bulan untuk ziarah, gotong-royong, khidmat masyarakat dan kerja kepimpinan. Ini menambah **Pengaruh (IP)** dan **Kesetiaan**.
3. Ikut takwim:

| Bulan | Apa berlaku |
|---|---|
| 1-3 | Kerja akar umbi (bonus +25% IP dan kesetiaan) |
| 4-6 | Mesyuarat dan pemilihan Cawangan serta sayap |
| 7 | Mesyuarat dan pemilihan Bahagian |
| 8 | PAU dan pemilihan Pusat (WTC KL, Menara Dato' Onn) |
| 9-12 | Pasca-PAU, bina semula sokongan |

4. Pemilihan jawatan hanya pada **tahun pemilihan** (2026, 2029, 2032...). Tahun lain ialah tahun pentadbiran, tetapi mandat perwakilan perlu dimenangi semula setiap tahun.
5. Jaga **Tataetika**. Kempen bersih membina Modal Sosial. Politik wang dan fitnah memberi kelebihan pantas tetapi boleh membawa amaran, gantung, larangan bertanding atau pemecatan.

Kesetiaan susut setiap bulan jika tidak dijaga, dan jawatan makin tinggi makin sukar dimenangi.

## Fail dalam repo

| Fail / folder | Fungsi |
|---|---|
| `index.html` | Halaman pendaftaran pemain |
| `dashboard.html` | Papan permainan |
| `js/` | Logik permainan (lihat di bawah) |
| `css/` | Gaya paparan. `index.html` memuatkan salinan CSS di dalamnya |
| `data/` | Data peta dan demografi (JSON) |
| `assets/images/` | Logo |
| `apps-script/Code.gs` | Pilihan: Google Apps Script untuk membaca data Cawangan |
| `tools/` | Alat bantuan untuk pembangun |

Modul utama dalam `js/`:

| Fail | Tugas |
|---|---|
| `save.js` | Simpan dan baca profil pemain (localStorage), pintu tunggal untuk ubah nilai |
| `calendar.js` | Takwim bulanan, AP dan elaun, susutan kesetiaan |
| `jawatan.js` | Senarai jawatan dan syarat kelayakan |
| `election.js` | Pemilihan, kempen, kuota perwakilan |
| `meeting.js` | Mesyuarat Cawangan dan Bahagian |
| `etika.js` | Tataetika, siasatan dan hukuman disiplin |
| `events.js` | Peristiwa rawak |
| `watak.js` | Gaya Kepimpinan dan kad Laluan Karier Sebenar |
| `map.js`, `geo.js` | Peta SVG negeri, parlimen dan DUN |
| `menu.js` | Menu utama pada `index.html` (Sambung, Permainan Baharu, Cara Bermain) |
| `perlembagaan.js` | Modal rujukan Perlembagaan Parti (fasal boleh lipat) |
| `hayat.js` | Umur pemain, risiko kesihatan, Legacy Summary (kerjaya tamat) dan peralihan kategori mengikut umur pada AGM |
| `app.js` | Menggabungkan semua modul ke dalam dashboard |

Data permainan disimpan dalam pelayar (localStorage). Tiada pelayan atau akaun diperlukan.

## Latar belakang menu

Menu utama menggunakan ilustrasi asal `assets/images/menara-dato-onn.svg`. Untuk guna foto sebenar, simpan foto anda sebagai `assets/images/menara-dato-onn.jpg` (disyorkan menegak, lebar sekitar 1200 px atau lebih). Foto itu akan dipaparkan menggantikan ilustrasi secara automatik. Pastikan anda berhak menggunakan foto tersebut.

## Jalankan di komputer

Buka `index.html` terus dalam pelayar, atau jalankan pelayan ringkas supaya peta dimuat dengan betul:

```
python3 -m http.server 8000
```

Kemudian buka `http://localhost:8000`.

## Kemas kini kod

- Jika anda ubah fail dalam `css/`, jalankan `node tools/inline-css.js` supaya `index.html` dikemas kini.
- Untuk melaras kesukaran, ubah nilai ini:
  - `election.js`: `GANDA_KESUKARAN`, `ARAS_PESAING`, `IP_SKALA`
  - `jawatan.js`: `ipMin`, `pangkatMin` dan `kesukaran` pada setiap jawatan
  - `calendar.js`: `SUSUT_BULANAN`, `AP_BULANAN`, `DANA_ASAS`
  - `save.js`: `REDAMAN_IP`

## Rujukan

Peraturan pemilihan dirujuk kepada Perlembagaan UMNO (contoh Fasal 8.4.3 kuota perwakilan PAU, Fasal 14.4.4 kuota Cawangan, Fasal 15.5 tempoh keahlian, Fasal 20 disiplin) dan Tataetika Ahli. Teks dibaca daripada salinan imbasan dan mungkin mengandungi kesilapan kecil. Beberapa nilai seperti tempoh gantung 12 bulan dan larangan 36 bulan ialah andaian permainan.
