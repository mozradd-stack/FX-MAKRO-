import { initializeApp } from 'firebase/app';
import { isSupported, getAnalytics } from 'firebase/analytics';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyB1OYKqfLpiU8dI5ooO864tuJKp4KkE8hs',
  authDomain: 'fx-makro-app.firebaseapp.com',
  projectId: 'fx-makro-app',
  storageBucket: 'fx-makro-app.firebasestorage.app',
  messagingSenderId: '197063437359',
  appId: '1:197063437359:web:d306aeea518d40b6cc6ada',
  measurementId: 'G-LW6G5V85VF',
};

export const firebaseApp = initializeApp(firebaseConfig);

// Only initialize Analytics in production and when the browser actually
// supports it (e.g. not blocked by an ad-blocker, not SSR) — avoids
// polluting real analytics data with local dev traffic.
if (import.meta.env.PROD) {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(firebaseApp);
    })
    .catch(() => {
      // Analytics is best-effort; ignore failures.
    });
}
