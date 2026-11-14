/**
 * إرسال إشعارات فورية لهواتف الأطباء عند تغيّر شيت "قاعدة بيانات المرضى".
 * يعمل داخل الشيت نفسه (Extensions > Apps Script) وبحساب الدائرة.
 * الإعداد: الصق مفتاح حساب الخدمة (JSON) في خاصية SERVICE_ACCOUNT ثم شغّل setup() مرة واحدة.
 */
var T_PATIENTS = 'المرضى';
var T_DEVICES = 'الأجهزة';
var T_SNAP = '_لقطة';
// أعمدة شيت المرضى (تبدأ من 0)
var C = {name: 0, dx: 5, op: 6, type: 8, date: 9, status: 10, id: 17, by: 20, editBy: 21};

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkChanges').timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger('remindTomorrow').timeBased().atHour(17).everyDays(1).create();
  ScriptApp.newTrigger('remindToday').timeBased().atHour(7).everyDays(1).create();
  checkChanges(); // يأخذ لقطة أولى بدون إرسال
  Logger.log('تم الإعداد. جرّب sendTest() بعد تسجيل الدخول من التطبيق على الهاتف.');
}

function sendTest() {
  var n = pushAll('اختبار الإشعارات', 'إذا ظهر هذا الإشعار فالإعداد صحيح.', '');
  Logger.log('أُرسل إلى ' + n + ' جهاز');
}

/* ---------- كشف التغييرات ---------- */
function checkChanges() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(T_PATIENTS);
    if (!sh) return;
    var last = sh.getLastRow();
    var rows = last > 1 ? sh.getRange(2, 1, last - 1, 23).getValues() : [];
    var snapSh = ss.getSheetByName(T_SNAP) || ss.insertSheet(T_SNAP);
    snapSh.hideSheet();
    var init = PropertiesService.getScriptProperties().getProperty('SNAP_INIT') === '1';
    var prev = {};
    var sl = snapSh.getLastRow();
    if (sl > 0) snapSh.getRange(1, 1, sl, 2).getValues().forEach(function (r) { prev[r[0]] = r[1]; });
    var out = [];
    rows.forEach(function (r) {
      var id = String(r[C.id] || '');
      if (!id) return;
      var date = dstr(r[C.date]);
      var sig = [r[C.name], r[C.op], date, r[C.status]].join('|');
      out.push([id, sig]);
      if (!init) return;
      var what = r[C.op] || r[C.dx] || '';
      if (!(id in prev)) {
        pushAll('مريض جديد: ' + r[C.name], (what ? what + ' · ' : '') + (date ? 'العملية ' + date : 'بدون موعد') + (r[C.by] ? ' · ' + r[C.by] : ''), String(r[C.by] || ''));
      } else if (prev[id] !== sig) {
        var old = String(prev[id]).split('|');
        var who = String(r[C.editBy] || r[C.by] || '');
        if (old[2] !== date) pushAll('تغيّر موعد: ' + r[C.name], (what ? what + ' · ' : '') + (date ? 'الموعد الجديد ' + date : 'أُلغي الموعد') + (who ? ' · ' + who : ''), who);
        else if (old[3] !== String(r[C.status])) pushAll('حالة العملية: ' + r[C.name], (r[C.status] || 'بدون حالة') + (who ? ' · ' + who : ''), who);
      }
    });
    snapSh.clear();
    if (out.length) snapSh.getRange(1, 1, out.length, 2).setNumberFormat('@').setValues(out);
    PropertiesService.getScriptProperties().setProperty('SNAP_INIT', '1');
  } finally { lock.releaseLock(); }
}

/* ---------- تذكيرات يومية ---------- */
function remindTomorrow() { remind(1, 'عمليات الغد'); }
function remindToday() { remind(0, 'عمليات اليوم'); }
function remind(offset, title) {
  var d = new Date(); d.setDate(d.getDate() + offset);
  var target = Utilities.formatDate(d, 'Asia/Amman', 'yyyy-MM-dd');
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(T_PATIENTS);
  if (!sh || sh.getLastRow() < 2) return;
  var items = sh.getRange(2, 1, sh.getLastRow() - 1, 23).getValues().filter(function (r) {
    return dstr(r[C.date]) === target && r[C.status] !== 'ملغاة' && r[C.status] !== 'تمت';
  }).map(function (r) { return r[C.name] + (r[C.op] ? ' (' + r[C.op] + ')' : ''); });
  if (!items.length) return;
  pushAll(title + ' (' + items.length + ')', items.join('، '), '');
}

/* ---------- إرسال FCM ---------- */
function pushAll(title, body, exceptUser) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(T_DEVICES);
  if (!sh || sh.getLastRow() < 2) return 0;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  var seen = {}, dead = [], sent = 0;
  rows.forEach(function (r, i) {
    var tok = String(r[0] || '');
    if (!tok || seen[tok]) return;
    seen[tok] = 1;
    if (exceptUser && String(r[1]) === exceptUser) return;
    var res = sendOne(tok, title, body);
    if (res === 'dead') dead.push(i + 2); else if (res === 'ok') sent++;
  });
  dead.sort(function (a, b) { return b - a; }).forEach(function (n) { sh.deleteRow(n); });
  return sent;
}

function sendOne(token, title, body) {
  var sa = JSON.parse(PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT'));
  var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: {Authorization: 'Bearer ' + accessToken(sa)},
    payload: JSON.stringify({message: {token: token, notification: {title: title, body: body},
      android: {priority: 'HIGH', notification: {channel_id: 'ops'}}}})
  });
  var code = r.getResponseCode();
  if (code === 200) return 'ok';
  var t = r.getContentText();
  if (code === 404 || t.indexOf('UNREGISTERED') >= 0) return 'dead';
  Logger.log('FCM ' + code + ' ' + t);
  return 'err';
}

function accessToken(sa) {
  var cache = CacheService.getScriptCache();
  var c = cache.get('fcm_at');
  if (c) return c;
  var now = Math.floor(Date.now() / 1000);
  var b64 = function (s) { return Utilities.base64EncodeWebSafe(s).replace(/=+$/, ''); };
  var head = b64(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
  var claim = b64(JSON.stringify({iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600}));
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(head + '.' + claim, sa.private_key)).replace(/=+$/, '');
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {method: 'post', muteHttpExceptions: true,
    payload: {grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig}});
  var j = JSON.parse(r.getContentText());
  if (!j.access_token) throw new Error('فشل الحصول على رمز الوصول: ' + r.getContentText());
  cache.put('fcm_at', j.access_token, 3000);
  return j.access_token;
}

function dstr(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Amman', 'yyyy-MM-dd');
  return String(v || '');
}
