import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Importar autenticación y proveedor de Google
import { getFirestore } from "firebase/firestore"; // Importar Firestore

const firebaseConfig = {

  apiKey: "AIzaSyBl3hSY_JN75LnLrEaNNyZP8Xud9PzwDc4",
  authDomain: "oops-out-septic-tank-5f92a.firebaseapp.com",
  databaseURL: "https://oops-out-septic-tank-5f92a-default-rtdb.firebaseio.com",
  projectId: "oops-out-septic-tank-5f92a",
  storageBucket: "oops-out-septic-tank-5f92a.firebasestorage.app",
  messagingSenderId: "113759038919",
  appId: "1:113759038919:web:bfd7c5c01439c8f3d3fde2",
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);

export { database, auth, provider, firestore };
