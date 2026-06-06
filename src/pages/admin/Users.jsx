import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Users() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleApprove = async (u) => {
    await updateDoc(doc(db, 'users', u.id), { status: 'active' });
  };

  const handleReject = async (u) => {
    if (!window.confirm(`ปฏิเสธบัญชี ${u.name}?`)) return;
    await updateDoc(doc(db, 'users', u.id), { status: 'rejected' });
  };

  const handleToggleStatus = async (u) => {
    if (u.id === currentUser.uid) return;
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'users', u.id), { status: newStatus });
  };

  const handleChangeRole = async (u, newRole) => {
    if (u.id === currentUser.uid) return;
    await updateDoc(doc(db, 'users', u.id), { role: newRole });
  };

  const handlePermanentBan = async (u) => {
    if (u.id === currentUser.uid) {
      alert('ไม่สามารถระงับถาวรตัวเองได้');
      return;
    }
    if (!window.confirm(`ระงับถาวรบัญชี "${u.name}"?\n\nผู้ใช้จะไม่สามารถเข้าระบบได้อีก\nประวัติ Log ยังคงอยู่ครับ`)) return;
    await updateDoc(doc(db, 'users', u.id), {
      status: 'banned',
      bannedAt: new Date(),
      bannedBy: currentUser.uid,
      bannedByName: currentUser.name,
    });
  };

  const handleEditSave = async () => {
    await updateDoc(doc(db, 'users', editing.id), {
      name: editForm.name,
      role: editForm.role,
      status: editForm.status,
    });
    setEditing(null);
  };

  const getRoleBadge = (role) => {
    if (role === 'superadmin') return 'bg-purple-100 text-purple-700';
    if (role === 'admin') return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getRoleLabel = (role) => {
    if (role === 'superadmin') return '👑 Super Admin';
    if (role === 'admin') return '🔑 Admin';
    return '👷 Staff';
  };

  const getStatusBadge = (status) => {
    if (status === 'active') return { color: 'bg-green-100 text-green-700', label: '🟢 ใช้งาน' };
    if (status === 'inactive') return { color: 'bg-red-100 text-red-600', label: '🔴 ระงับ' };
    if (status === 'banned') return { color: 'bg-gray-800 text-white', label: '⛔ ระงับถาวร' };
    return { color: 'bg-yellow-100 text-yellow-700', label: '⏳ รออนุมัติ' };
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status !== 'pending');

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">กำลังโหลด...</p>
    </div>
  );

  // หน้าแก้ไข
  if (editing) return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-700 mb-4">✏️ แก้ไขข้อมูลผู้ใช้</h2>
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <div>
          <label className="text-sm text-gray-500">ชื่อ-นามสกุล</label>
          <input value={editForm.name}
            onChange={e => setEditForm({...editForm, name: e.target.value})}
            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400"/>
        </div>
        <div>
          <label className="text-sm text-gray-500">Username (แก้ไขไม่ได้)</label>
          <input value={editForm.username} disabled
            className="w-full border rounded-lg p-3 mt-1 bg-gray-50 text-gray-400"/>
        </div>
        <div>
          <label className="text-sm text-gray-500">Role</label>
          <select value={editForm.role}
            onChange={e => setEditForm({...editForm, role: e.target.value})}
            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400">
            <option value="staff">👷 Staff</option>
            <option value="admin">🔑 Admin</option>
            <option value="superadmin">👑 Super Admin</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-500">สถานะ</label>
          <select value={editForm.status}
            onChange={e => setEditForm({...editForm, status: e.target.value})}
            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400">
            <option value="active">🟢 ใช้งาน</option>
            <option value="inactive">🔴 ระงับ</option>
            <option value="banned">⛔ ระงับถาวร</option>
          </select>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-700">
          ⚠️ Username แก้ไขไม่ได้ หากต้องการเปลี่ยนให้ระงับถาวรแล้วสมัครใหม่ด้วย Username ใหม่
        </div>
        <div className="flex gap-2">
          <button onClick={handleEditSave}
            className="flex-1 bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800">
            💾 บันทึก
          </button>
          <button onClick={() => setEditing(null)}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300">
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-700 mb-4">👥 จัดการผู้ใช้</h2>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('active')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium ${tab === 'active' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border'}`}>
          ผู้ใช้ทั้งหมด ({activeUsers.length})
        </button>
        {currentUser.role === 'superadmin' && (
          <button onClick={() => setTab('pending')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1 ${tab === 'pending' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border'}`}>
            รออนุมัติ
            {pendingUsers.length > 0 && (
              <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {pendingUsers.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Pending Tab */}
      {tab === 'pending' && currentUser.role === 'superadmin' && (
        <div className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-8 text-center">
              <p className="text-gray-400">🎉 ไม่มีรายการรออนุมัติ</p>
            </div>
          ) : (
            pendingUsers.map(u => (
              <div key={u.id} className="bg-white rounded-xl shadow p-4">
                <div className="mb-3">
                  <p className="font-bold text-gray-800">{u.name}</p>
                  <p className="text-sm text-gray-500">@{u.username}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(u)}
                    className="flex-1 bg-green-700 text-white py-2 rounded-lg font-bold text-sm">
                    ✅ อนุมัติ
                  </button>
                  <button onClick={() => handleReject(u)}
                    className="flex-1 bg-red-500 text-white py-2 rounded-lg font-bold text-sm">
                    ❌ ปฏิเสธ
                  </button>
                  <button onClick={() => handlePermanentBan(u)}
                    className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">
                    ⛔
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Active Tab */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeUsers.map(u => {
            const statusBadge = getStatusBadge(u.status);
            return (
              <div key={u.id} className="bg-white rounded-xl shadow p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-gray-800">{u.name}</p>
                    <p className="text-sm text-gray-500">@{u.username}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadge(u.role)}`}>
                      {getRoleLabel(u.role)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {/* superadmin เท่านั้น */}
                  {currentUser.role === 'superadmin' && u.id !== currentUser.uid && (
                    <>
                      <button onClick={() => { setEditing(u); setEditForm({...u}); }}
                        className="text-sm px-3 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
                        ✏️ แก้ไข
                      </button>
                      <select value={u.role}
                        onChange={e => handleChangeRole(u, e.target.value)}
                        className="text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-400">
                        <option value="staff">👷 Staff</option>
                        <option value="admin">🔑 Admin</option>
                        <option value="superadmin">👑 Super Admin</option>
                      </select>
                      {u.status !== 'banned' && (
                        <button onClick={() => handleToggleStatus(u)}
                          className={`text-sm px-3 py-1 rounded-lg font-medium ${u.status === 'active'
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {u.status === 'active' ? '🚫 ระงับ' : '✅ เปิดใช้'}
                        </button>
                      )}
                      {u.status !== 'banned' && (
                        <button onClick={() => handlePermanentBan(u)}
                          className="text-sm px-3 py-1 rounded-lg bg-gray-700 text-white hover:bg-gray-800 font-medium">
                          ⛔ ระงับถาวร
                        </button>
                      )}
                      {u.status === 'banned' && (
                        <button onClick={() => updateDoc(doc(db, 'users', u.id), { status: 'active' })}
                          className="text-sm px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 font-medium">
                          ✅ คืนสิทธิ์
                        </button>
                      )}
                    </>
                  )}

                  {u.id === currentUser.uid && (
                    <p className="text-xs text-gray-400 italic">— บัญชีของคุณ —</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}