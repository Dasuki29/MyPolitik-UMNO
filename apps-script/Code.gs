/**
 * MyPolitik: UMNO — Google Apps Script Web App (pilihan, lebih dipercayai daripada CSV Published).
 *
 * Cara pasang:
 *  1. Buka Google Sheet anda > Extensions > Apps Script.
 *  2. Padam kod sedia ada, tampal fail ini, tekan Save.
 *  3. Deploy > New deployment > jenis "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *  4. Salin "Web app URL" (berakhir dengan /exec) ke index.html dan dashboard.html:
 *       window.MYPOLITIK_CONFIG = { ..., appsScriptUrl: 'https://script.google.com/macros/s/XXXX/exec' };
 *  5. Jika anda ubah kod ini kemudian, pilih Deploy > Manage deployments > Edit > Version: New version.
 *
 * v7.14 — Sheet berbilang tab (satu tab = satu negeri):
 *   ?senarai=1          -> { ok:true, tab:["Johor","Kedah",...] }  (urutan tab dalam Sheet; tab bermula dengan "_" diabaikan)
 *   ?sheet=NamaTab      -> baris tab itu. Nama tab dijadikan nama negeri jika lajur Negeri kosong.
 *   (tiada parameter)   -> tab pertama (serasi dengan versi lama)
 * Wilayah Persekutuan (Kuala Lumpur, Putrajaya, Labuan) tiada DUN: kosongkan lajur "Nama DUN"; ID kekal 3 bahagian
 * (cth. 114/000/001). Pastikan lajur dan susunan tajuk sama dalam setiap tab.
 * Format respons: { ok:true, dikemaskini:"ISO", rows:[[tajuk...],[baris...]] }
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (e && e.parameter && e.parameter.senarai) {
      var tab = ss.getSheets().map(function (sh) { return sh.getName(); }).filter(function (n) { return n.charAt(0) !== '_'; });
      return keluar({ ok: true, tab: tab });
    }
    var nama = e && e.parameter && e.parameter.sheet;
    var sheet = nama ? ss.getSheetByName(nama) : ss.getSheets()[0];
    if (!sheet) { return keluar({ ok: false, ralat: 'Tab tidak dijumpai: ' + nama }); }
    var nilai = sheet.getDataRange().getDisplayValues();   // teks seperti dipaparkan (kekalkan 097/013/001)
    return keluar({ ok: true, dikemaskini: new Date().toISOString(), rows: nilai });
  } catch (err) {
    return keluar({ ok: false, ralat: String(err) });
  }
}
function keluar(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
