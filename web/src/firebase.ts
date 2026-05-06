import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC7ZSvNmxhIYPBq0J0ZWd0hpl8QalGCSnU',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'eanrunner.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'eanrunner',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'eanrunner.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '116110575719',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:116110575719:web:41defc0fe2680f6b95acc2',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
