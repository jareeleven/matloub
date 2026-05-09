// MATLOUB — Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDtupIeXNO1hl6FnbMOorFozhX6L4yWDNk",
  authDomain:        "matloub-7914f.firebaseapp.com",
  projectId:         "matloub-7914f",
  storageBucket:     "matloub-7914f.firebasestorage.app",
  messagingSenderId: "760240149650",
  appId:             "1:760240149650:web:23bae0fcfc5d1c84d0c24b"
});

const messaging = firebase.messaging();

// Recevoir notifications en arrière-plan
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'MATLOUB', {
    body: body || '',
    icon: icon || '/matloub/icon-192.png',
    badge: '/matloub/icon-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {}
  });
});

// Clic sur notification → ouvrir le site
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://jareeleven.github.io/matloub/')
  );
});
