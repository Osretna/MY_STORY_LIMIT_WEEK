import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getFirestore, collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, 
    query, where, orderBy, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

const firebaseConfig = {
  // 🔴🔴🔴 ضع كود الـ Config الخاص بك هنا (ApiKey...) 🔴🔴🔴
  apiKey: "AIzaSyDJeY0Dv5nQwGaNa4bs4-6zXsOeLBJXUS8",
  authDomain: "my-store-limit-week.firebaseapp.com",
  databaseURL: "https://my-store-limit-week-default-rtdb.firebaseio.com",
  projectId: "my-store-limit-week",
  storageBucket: "my-store-limit-week.firebasestorage.app",
  messagingSenderId: "217657811314",
  appId: "1:217657811314:web:58e1c96f60ca14502bbdeb",
  measurementId: "G-250JKP3B5D"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { 
    app, db, auth, storage, googleProvider,
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc, getDoc, setDoc, query, where, orderBy, onSnapshot, serverTimestamp,
    signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, signInWithPopup,
    ref, uploadBytes, getDownloadURL 
};