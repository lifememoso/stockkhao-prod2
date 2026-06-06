import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { db, auth } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Profile() {
  const { user, login, sessionId } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleUpdateName = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateDoc(doc(db, 'users', user.uid), { name });
      login({ ...user, name }, sessionId);
      setSuccess('✅ อัปเดตชื่อสำเร็จ!');
    } catch (err) {
      setError('เกิดข้อผิดพลาด: ' + err.message);
    }
    setLoading(false);
  };

  const handleUpdatePassword = async () => {
    setError('');
    setSuccess('');
    if (!currentPassword) { setError('กรุณากรอกรหัสผ่านปัจจุบัน'); return; }
    if (newPassword.length < 6) { setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว'); return; }
    if (newPassword !== confirmPassword) { setError('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setSuccess('✅ เปลี่ยนรหัสผ่านสำเร็จ!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-700 mb-4">👤 ข้อมูลส่วนตัว</h2>

      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg mb-4 text-sm font-medium">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* ข้อมูลทั่วไป */}
      <div className="bg-white rounded-xl shadow p-5 mb-4">
        <h3 className="font-bold text-gray-700 mb-3">📝 ข้อมูลทั่วไป</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">ชื่อ-นามสกุล</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400"/>
          </div>
          <div>
            <label className="text-sm text-gray-500">Username</label>
            <input value={user?.username || ''} disabled
              className="w-full border rounded-lg p-3 mt-1 bg-gray-50 text-gray-400"/>
          </div>
          <div>
            <label className="text-sm text-gray-500">อีเมล</label>
            <input value={user?.email || ''} disabled
              className="w-full border rounded-lg p-3 mt-1 bg-gray-50 text-gray-400"/>
          </div>

          {/* แสดง Role เฉพาะ superadmin */}
          {user?.role === 'superadmin' && (
            <div>
              <label className="text-sm text-gray-500">Role</label>
              <input value="👑 Super Admin" disabled
                className="w-full border rounded-lg p-3 mt-1 bg-gray-50 text-gray-400"/>
            </div>
          )}

          <button onClick={handleUpdateName} disabled={loading}
            className="w-full bg-green-700 text-white py-2.5 rounded-lg font-bold hover:bg-green-800 disabled:opacity-50">
            💾 บันทึกชื่อ
          </button>
        </div>
      </div>

      {/* เปลี่ยนรหัสผ่าน */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-bold text-gray-700 mb-3">🔐 เปลี่ยนรหัสผ่าน</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-500">รหัสผ่านปัจจุบัน</label>
            <input type="password" placeholder="รหัสผ่านปัจจุบัน" value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400"/>
          </div>
          <div>
            <label className="text-sm text-gray-500">รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</label>
            <input type="password" placeholder="รหัสผ่านใหม่" value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400"/>
          </div>
          <div>
            <label className="text-sm text-gray-500">ยืนยันรหัสผ่านใหม่</label>
            <input type="password" placeholder="ยืนยันรหัสผ่านใหม่" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400"/>
          </div>
          <button onClick={handleUpdatePassword} disabled={loading}
            className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-bold hover:bg-orange-600 disabled:opacity-50">
            🔐 เปลี่ยนรหัสผ่าน
          </button>
        </div>
      </div>
    </div>
  );
}