# تحويل التطبيق إلى APK مع إشعارات فورية

## كيف يعمل
- ملف APK يُبنى تلقائياً على GitHub Actions من نفس مستودع الموقع (لا تحتاج Android Studio).
- الإشعارات تمر عبر Firebase Cloud Messaging. سكربت صغير (Apps Script) داخل الشيت يراقب التغييرات ويرسل الإشعارات، فلا تحتاج خادماً.
- الإشعارات: مريض جديد، تغيّر موعد عملية، تغيّر حالة العملية (لا يصل لمن أجرى التغيير)، وتذكير 5 مساءً بعمليات الغد و7 صباحاً بعمليات اليوم.
- التغييرات تصل خلال 5 دقائق تقريباً.

## الخطوات (مرة واحدة)

### 1. Firebase
1. console.firebase.google.com ثم Add project (يمكن استخدام نفس مشروع Google Cloud الذي أنشأت فيه Client ID).
2. Project settings ثم Add app ثم Android. اسم الحزمة بالضبط: `jo.zarqa.burnpatients`
3. حمّل google-services.json.
4. Project settings ثم Service accounts ثم Generate new private key (ملف JSON).
5. في Google Cloud للمشروع نفسه تأكد أن Firebase Cloud Messaging API (V1) مفعّلة.

### 2. GitHub
1. ارفع كل محتويات هذا المجلد إلى مستودع الموقع (index.html و oauth.html و package.json و capacitor.config.json ومجلدات .github و keys).
2. Settings ثم Secrets and variables ثم Actions ثم New repository secret:
   الاسم `GOOGLE_SERVICES_JSON` والقيمة محتوى google-services.json كاملاً.
3. Actions ثم Build Android APK ثم Run workflow. بعد دقائق قليلة حمّل burn-patients-apk من أسفل صفحة التشغيل، وفيه app-debug.apk.
4. في سجل التشغيل سطر `Redirect URI: ...` انسخ الرابط.

### 3. Google Cloud (OAuth)
في Credentials ثم OAuth client (نفس الذي أنشأته) أضف الرابط المنسوخ في Authorized redirect URIs (مثل `https://USER.github.io/REPO/oauth.html`). يجب أن يكون oauth.html منشوراً مع الموقع على GitHub Pages.

### 4. الشيت (Apps Script)
1. افتح شيت "قاعدة بيانات المرضى" بحساب الدائرة ثم Extensions ثم Apps Script.
2. الصق Code.gs، وفعّل إظهار appsscript.json من Project Settings والصق محتواه.
3. Project Settings ثم Script properties ثم أضف `SERVICE_ACCOUNT` والقيمة محتوى ملف المفتاح كاملاً.
4. شغّل الدالة setup مرة واحدة ووافق على الصلاحيات.
5. بعد تسجيل الدخول من الهاتف شغّل sendTest للتجربة.

### 5. على الهاتف
ثبّت app-debug.apk (اسمح بالتثبيت من مصدر غير معروف)، سجّل حسابك المحلي ثم تسجيل الدخول بحساب جوجل، ووافق على الإشعارات.

## ملاحظات
- تسجيل الدخول بجوجل يفتح المتصفح ثم يعود للتطبيق. قد تحتاج بعد نحو ساعة لمسة تسجيل دخول جديدة.
- الأجهزة المسجلة تظهر في تبويب "الأجهزة" في الشيت، وتُحذف تلقائياً الرموز الميتة.
- محتوى الإشعار يظهر على شاشة القفل ويتضمن اسم المريض. قد يلزم تقييده حسب سياسة المستشفى.
- لم يُختبر البناء النهائي على GitHub ولا الإرسال الفعلي من هنا (لا وصول لـ Google/Firebase). منطق التطبيق اختُبر ببدائل محاكاة.
