import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async () => {
    setError('');
    if (!form.name || !form.username || !form.password) {
      setError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (form.username.length < 3) {
      setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('รหัสผ่านไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      // เช็ค username ซ้ำ
      const q = query(collection(db, 'users'), where('username', '==', form.username));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setError('ชื่อผู้ใช้นี้ถูกใช้งานแล้ว');
        setLoading(false);
        return;
      }

      // สร้าง email อัตโนมัติ
      const autoEmail = `${form.username}@stockkhao.com`;

      const result = await createUserWithEmailAndPassword(auth, autoEmail, form.password);
      await setDoc(doc(db, 'users', result.user.uid), {
        name: form.name,
        username: form.username,
        email: autoEmail,
        role: 'staff',
        status: 'pending',
        currentSession: null,
        createdAt: new Date(),
      });
      setSuccess(true);
    } catch (err) {
      setError('สมัครไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">สมัครสำเร็จแล้ว!</h2>
          <p className="text-gray-500 text-sm mb-6">
            รอ Admin อนุมัติบัญชีของคุณก่อนจึงจะเข้าใช้งานได้
          </p>
          <button onClick={() => navigate('/')}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800">
            กลับหน้าเข้าสู่ระบบ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-green-800 text-center mb-2">สมัครใช้งาน</h1>
        <p className="text-center text-gray-500 text-sm mb-6">🌾 เจ๊นก พันธุ์ข้าว</p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>
        )}

        <input
          placeholder="ชื่อ-นามสกุล"
          value={form.name}
          onChange={e => setForm({...form, name: e.target.value})}
          className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          placeholder="ชื่อผู้ใช้งาน (username)"
          value={form.username}
          onChange={e => setForm({...form, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
          className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
          value={form.password}
          onChange={e => setForm({...form, password: e.target.value})}
          className="w-full border rounded-lg p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <input
          type="password"
          placeholder="ยืนยันรหัสผ่าน"
          value={form.confirmPassword}
          onChange={e => setForm({...form, confirmPassword: e.target.value})}
          className="w-full border rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-green-400"
        />

        <button onClick={handleRegister} disabled={loading}
          className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 disabled:opacity-50">
          {loading ? 'กำลังสมัคร...' : 'สมัครใช้งาน'}
        </button>

        <div className="border-t mt-6 pt-4 text-center">
          <p className="text-sm text-gray-500">
            มีบัญชีแล้ว?{' '}
            <a href="/" className="text-green-700 font-medium hover:underline">
              เข้าสู่ระบบ
            </a>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            * บัญชีใหม่ต้องรอ Admin อนุมัติก่อนใช้งาน
          </p>
        </div>
      </div>
    </div>
  );
}