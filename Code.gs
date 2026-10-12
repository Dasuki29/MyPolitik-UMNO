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
 * Pilihan: tambah ?sheet=NamaTab pada URL untuk membaca tab lain (lalai: tab pertama).
 * Format respons: { ok:true, dikemaskini:"ISO", rows:[[tajuk...],[baris...]] }
 */
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
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
