import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD5fs4zCLxpS1K0kZhbdEm7mHWkGNAAnUo",
  authDomain: "cloud-notes-223ce.firebaseapp.com",
  projectId: "cloud-notes-223ce",
  storageBucket: "cloud-notes-223ce.firebasestorage.app",
  messagingSenderId: "822348180305",
  appId: "1:822348180305:web:ac969b84737de8f9138170",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);

export { auth, db, storage };
