import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const snapshot = await getDocs(q);
      if (snapshot.empty) throw new Error('ไม่พบผู้ใช้');
      const userData = snapshot.docs[0].data();
      const uid = snapshot.docs[0].id;
      if (userData.status === 'inactive') throw new Error('บัญชีถูกระงับ');
      if (userData.status !== 'active') throw new Error('รอ Admin อนุมัติก่อนใช้งาน');
      await signInWithEmailAndPassword(auth, userData.email, password);
      const sessionId = crypto.randomUUID();
      await updateDoc(doc(db, 'users', uid), { currentSession: sessionId });
      login({ uid, ...userData }, sessionId);
      navigate(userData.role === 'staff' ? '/staff/step1' : '/admin');
    } catch (err) {
      if (err.message === 'บัญชีถูกระงับ') {
        setError('บัญชีของคุณถูกระงับ กรุณาติดต่อ Admin');
      } else if (err.message === 'รอ Admin อนุมัติก่อนใช้งาน') {
        setError('บัญชียังรอการอนุมัติจาก Admin กรุณารอสักครู่');
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green-800 text-center mb-2">🌾 เจ๊นก พันธุ์ข้าว</h1>
        <p className="text-center text-gray-500 mb-6">ระบบจัดการสต็อกข้าว</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <input
          type="text"
          placeholder="ผู้ใช้งาน"
          value={username}
          onChange={e => setUsername(e.target.value)}
          className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="รหัสผ่าน"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 disabled:opacity-50"
        >
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>

        <div className="border-t mt-6 pt-4 text-center">
          <p className="text-sm text-gray-500">
            ยังไม่มีบัญชี?{' '}
            <a href="/register" className="text-green-700 font-medium hover:underline">
              สมัครใช้งาน
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            * ต้องรอ Admin อนุมัติก่อนใช้งาน
          </p>
        </div>
      </div>
    </div>
  );
}