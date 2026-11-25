importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js','https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
firebase.initializeApp({apiKey:'AIzaSyA8S50T0yWcD8yFbQpBNBMmCFOQ1eK1Y58',authDomain:'burn-patients.firebaseapp.com',projectId:'burn-patients',storageBucket:'burn-patients.firebasestorage.app',messagingSenderId:'704558469211',appId:'1:704558469211:web:b848f515a69038d65b6f7e'});
// Notification messages are displayed automatically by the Firebase SDK; a click opens the link set by the server.
firebase.messaging();
