import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth"; // Importar autenticación y proveedor de Google
import { getFirestore } from "firebase/firestore"; // Importar Firestore

const firebaseConfig = {
  apiKey: "AIzaSyBpeEx7OQkYe6mmbLUnHcWIcH0gbN6lT2E",
  authDomain: "oops-out-septic-tank-test.firebaseapp.com",
  databaseURL: "https://oops-out-septic-tank-test-default-rtdb.firebaseio.com",
  projectId: "oops-out-septic-tank-test",
  storageBucket: "oops-out-septic-tank-test.firebasestorage.app",
  messagingSenderId: "400285742777",
  appId: "1:400285742777:web:63e06e5922a075dfd64d68",
};

const app = initializeApp(firebaseConfig);

const database = getDatabase(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const firestore = getFirestore(app);

export { database, auth, provider, firestore };
