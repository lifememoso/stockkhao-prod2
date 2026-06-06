import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const TYPES = [
  { key: 'variety', label: '🌾 พันธุ์ข้าว' },
  { key: 'claimReason', label: '🔄 สาเหตุเคลม' },
];

export default function Settings() {
  const [activeType, setActiveType] = useState('variety');
  const [items, setItems] = useState([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'settings'),
      where('type', '==', activeType)
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeType]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const exists = items.find(i => i.name === newName.trim());
    if (exists) {
      alert('มีชื่อนี้อยู่แล้ว');
      return;
    }
    setLoading(true);
    await addDoc(collection(db, 'settings'), {
      type: activeType,
      name: newName.trim(),
      active: true,
      createdAt: new Date(),
    });
    setNewName('');
    setLoading(false);
  };

  const handleToggle = async (item) => {
    await updateDoc(doc(db, 'settings', item.id), {
      active: !item.active,
    });
  };

  const activeItems = items.filter(i => i.active);
  const inactiveItems = items.filter(i => !i.active);

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-700 mb-4">⚙️ ตั้งค่า Dropdown</h2>

      {/* Type Tabs */}
      <div className="flex gap-2 mb-4">
        {TYPES.map(t => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${activeType === t.key ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Add New */}
      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <p className="text-sm font-medium text-gray-600 mb-2">เพิ่มรายการใหม่</p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={activeType === 'variety' ? 'เช่น กข.85, พันธุ์ 20' : 'เช่น กระสอบชำรุด'}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="flex-1 border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button onClick={handleAdd} disabled={loading || !newName.trim()}
            className="bg-green-700 text-white px-4 rounded-lg font-bold hover:bg-green-800 disabled:opacity-50">
            + เพิ่ม
          </button>
        </div>
      </div>

      {/* Active Items */}
      <div className="bg-white rounded-xl shadow p-4 mb-3">
        <p className="text-sm font-medium text-gray-600 mb-3">
          🟢 ใช้งานอยู่ ({activeItems.length})
        </p>
        {activeItems.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-2">ยังไม่มีรายการ</p>
        ) : (
          <div className="space-y-2">
            {activeItems.map(item => (
              <div key={item.id}
                className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                <span className="text-gray-800 font-medium">{item.name}</span>
                <button onClick={() => handleToggle(item)}
                  className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full hover:bg-red-200">
                  ปิดใช้งาน
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inactive Items */}
      {inactiveItems.length > 0 && (
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-sm font-medium text-gray-400 mb-3">
            ⚫ ปิดใช้งาน ({inactiveItems.length})
          </p>
          <div className="space-y-2">
            {inactiveItems.map(item => (
              <div key={item.id}
                className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                <span className="text-gray-400 line-through">{item.name}</span>
                <button onClick={() => handleToggle(item)}
                  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200">
                  เปิดใช้งาน
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}