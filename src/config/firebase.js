import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDAsUC94T-I9ZisbdnvhPTAFUlDy1vEbfY",
  authDomain: "stockkhao.firebaseapp.com",
  projectId: "stockkhao",
  storageBucket: "stockkhao.firebasestorage.app",
  messagingSenderId: "490962792275",
  appId: "1:490962792275:web:354ae490d07b4ff53bfba6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("เปิดหลาย Tab Offline Mode อาจทำงานไม่สมบูรณ์");
  } else if (err.code === 'unimplemented') {
    console.warn("เบราว์เซอร์นี้ไม่รองรับ Offline Mode");
  }
});

export { db, auth };