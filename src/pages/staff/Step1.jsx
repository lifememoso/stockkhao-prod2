import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Step1() {
  const { user } = useAuthStore();
  const [varieties, setVarieties] = useState([]);
  const [formData, setFormData] = useState({
    riceVariety: '',
    farmerName: '',
    location: '',
    phone: '',
    receivedTons: '',
    tagCode: '',
    receivedDate: new Date().toISOString().slice(0, 10),
  });
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVariety, setNewVariety] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lots, setLots] = useState([]);
  const [editingLot, setEditingLot] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showLots, setShowLots] = useState(false);

  useEffect(() => {
    fetchVarieties();
    fetchLots();
  }, []);

  const fetchVarieties = async () => {
    try {
      const q = query(
        collection(db, 'settings'),
        where('type', '==', 'variety'),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      setVarieties(snap.docs.map(d => d.data().name));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLots = async () => {
    try {
      const snap = await getDocs(collection(db, 'lots'));
      setLots(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddVariety = async () => {
    if (!newVariety.trim()) return;
    try {
      await addDoc(collection(db, 'settings'), {
        type: 'variety',
        name: newVariety.trim(),
        active: true,
        createdAt: Timestamp.now(),
      });
      setVarieties([...varieties, newVariety.trim()]);
      setFormData({ ...formData, riceVariety: newVariety.trim() });
      setNewVariety('');
      setShowAddVariety(false);
      setMessage({ type: 'success', text: '✅ เพิ่มพันธุ์ข้าวสำเร็จ' });
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }
  };

  const generateLotCode = () => {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `LOT-${month}${day}${random}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.riceVariety || !formData.receivedTons) {
      setMessage({ type: 'error', text: 'กรุณากรอกพันธุ์ข้าวและปริมาณ' });
      return;
    }
    setLoading(true);
    try {
      const lotCode = generateLotCode();
      const now = Timestamp.now();

      await addDoc(collection(db, 'lots'), {
        lotCode,
        tagCode: formData.tagCode || '',
        riceVariety: formData.riceVariety,
        farmerName: formData.farmerName || '-',
        phone: formData.phone || '-',
        location: formData.location || '-',
        receivedTons: parseFloat(formData.receivedTons),
        receivedDate: formData.receivedDate,
        status: 'open',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: now,
        tagHistory: formData.tagCode ? [{
          tagCode: formData.tagCode,
          changedBy: user.name,
          changedAt: now,
          note: 'สร้างใหม่'
        }] : [],
      });

      await addDoc(collection(db, 'activityLog'), {
        action: 'receive',
        lotCode,
        riceVariety: formData.riceVariety,
        tagCode: formData.tagCode || '-',
        farmerName: formData.farmerName || '-',
        phone: formData.phone || '-',
        location: formData.location || '-',
        receivedTons: parseFloat(formData.receivedTons),
        receivedDate: formData.receivedDate,
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({ type: 'success', text: `✅ บันทึกสำเร็จ! โค้ดล็อต: ${lotCode}` });
      setFormData({ riceVariety: '', farmerName: '', location: '', phone: '', receivedTons: '', tagCode: '', receivedDate: new Date().toISOString().slice(0, 10) });
      fetchLots();
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }
    setLoading(false);
  };

  const handleEditSave = async () => {
    if (!editingLot) return;
    setLoading(true);
    try {
      const now = Timestamp.now();
      const tagHistory = [...(editingLot.tagHistory || [])];

      const changes = {};
      if (editForm.tagCode !== editingLot.tagCode) {
        changes.tagCode = { from: editingLot.tagCode || '-', to: editForm.tagCode };
        tagHistory.push({
          tagCode: editForm.tagCode,
          oldTagCode: editingLot.tagCode,
          changedBy: user.name,
          changedAt: now,
          note: editForm.editNote || 'แก้ไขใบแท็ก'
        });
      }
      if (editForm.riceVariety !== editingLot.riceVariety) {
        changes.riceVariety = { from: editingLot.riceVariety, to: editForm.riceVariety };
      }
      if (parseFloat(editForm.receivedTons) !== editingLot.receivedTons) {
        changes.receivedTons = { from: editingLot.receivedTons, to: parseFloat(editForm.receivedTons) };
      }
      if (editForm.farmerName !== editingLot.farmerName) {
        changes.farmerName = { from: editingLot.farmerName, to: editForm.farmerName };
      }

      await updateDoc(doc(db, 'lots', editingLot.id), {
        tagCode: editForm.tagCode,
        riceVariety: editForm.riceVariety,
        farmerName: editForm.farmerName,
        phone: editForm.phone,
        location: editForm.location,
        receivedTons: parseFloat(editForm.receivedTons),
        receivedDate: editForm.receivedDate,
        tagHistory,
        updatedBy: user.name,
        updatedAt: now,
      });

      await addDoc(collection(db, 'activityLog'), {
        action: 'edit_lot',
        lotCode: editingLot.lotCode,
        changes,
        note: editForm.editNote || '-',
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({ type: 'success', text: '✅ แก้ไขสำเร็จ!' });
      setEditingLot(null);
      fetchLots();
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }
    setLoading(false);
  };

  return (
    <div className="pt-6 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 mb-1">📥 รับซื้อข้าวเข้า</h2>
        <p className="text-gray-500 text-sm">บันทึกข้อมูลการรับซื้อข้าวดิบ</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 space-y-5 mb-6">

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">
            🌾 พันธุ์ข้าว <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-2">
            <select
              value={formData.riceVariety}
              onChange={e => setFormData({...formData, riceVariety: e.target.value})}
              className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
            >
              <option value="">-- เลือกพันธุ์ข้าว --</option>
              {varieties.map(v => <option key={v}>{v}</option>)}
            </select>
            <button type="button" onClick={() => setShowAddVariety(!showAddVariety)}
              className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700">
              ➕
            </button>
          </div>
          {showAddVariety && (
            <div className="mt-3 flex gap-2 bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
              <input type="text" value={newVariety}
                onChange={e => setNewVariety(e.target.value)}
                placeholder="ชื่อพันธุ์ข้าวใหม่"
                className="flex-1 border-2 border-blue-300 rounded-lg p-2 focus:outline-none text-sm" />
              <button type="button" onClick={handleAddVariety}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">✅</button>
              <button type="button" onClick={() => setShowAddVariety(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold">✕</button>
            </div>
          )}
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">👤 ชื่อผู้ขาย</label>
          <input type="text" value={formData.farmerName}
            onChange={e => setFormData({...formData, farmerName: e.target.value})}
            placeholder="ชื่อชาวนา/ผู้ขาย"
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">📍 สถานที่/แปลงนา</label>
          <input type="text" value={formData.location}
            onChange={e => setFormData({...formData, location: e.target.value})}
            placeholder="สถานที่หรือแปลงนา"
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">📱 เบอร์โทรศัพท์</label>
          <input type="tel" value={formData.phone}
            onChange={e => setFormData({...formData, phone: e.target.value})}
            placeholder="เบอร์โทรศัพท์"
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">
            ⚖️ ปริมาณที่รับซื้อ (ตัน) <span className="text-red-500">*</span>
          </label>
          <input type="number" step="0.1" value={formData.receivedTons}
            onChange={e => setFormData({...formData, receivedTons: e.target.value})}
            placeholder="เช่น 100"
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">
            🏷️ เลขแท็ก
            <span className="text-gray-400 font-normal text-sm ml-2">(ใส่ภายหลังได้)</span>
          </label>
          <input type="text" value={formData.tagCode}
            onChange={e => setFormData({...formData, tagCode: e.target.value})}
            placeholder="เช่น กก/ขข-001"
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-yellow-400 font-bold text-blue-700" />
        </div>

        <div>
          <label className="text-base text-gray-800 font-bold block mb-2">
            📅 วันที่รับเข้า <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={formData.receivedDate}
            onChange={e => setFormData({...formData, receivedDate: e.target.value})}
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
          />
        </div>

        <button type="submit" disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50 transition shadow-lg">
          {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกการรับซื้อ'}
        </button>
      </form>

      <div className="bg-white rounded-2xl shadow p-5">
        <button onClick={() => setShowLots(!showLots)}
          className="w-full flex justify-between items-center font-black text-gray-700 text-base">
          <span>📋 รายการล็อตที่บันทึกแล้ว ({lots.length})</span>
          <span>{showLots ? '▲' : '▼'}</span>
        </button>

        {showLots && (
          <div className="mt-4 space-y-3">
            {lots.map(lot => (
              <div key={lot.id} className="border border-gray-200 rounded-xl p-4">
                {editingLot?.id === lot.id ? (
                  <div className="space-y-3">
                    <p className="font-bold text-gray-700 text-sm">✏️ แก้ไข: {lot.lotCode}</p>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">🌾 พันธุ์ข้าว</label>
                      <select value={editForm.riceVariety}
                        onChange={e => setEditForm({...editForm, riceVariety: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1">
                        {varieties.map(v => <option key={v}>{v}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">👤 ชื่อผู้ขาย</label>
                      <input type="text" value={editForm.farmerName}
                        onChange={e => setEditForm({...editForm, farmerName: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">📍 สถานที่</label>
                      <input type="text" value={editForm.location}
                        onChange={e => setEditForm({...editForm, location: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">📱 เบอร์โทร</label>
                      <input type="tel" value={editForm.phone}
                        onChange={e => setEditForm({...editForm, phone: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">⚖️ ปริมาณ (ตัน)</label>
                      <input type="number" step="0.1" value={editForm.receivedTons}
                        onChange={e => setEditForm({...editForm, receivedTons: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">📅 วันที่รับเข้า</label>
                      <input type="date" value={editForm.receivedDate}
                        onChange={e => setEditForm({...editForm, receivedDate: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">🏷️ เลขแท็ก</label>
                      <input type="text" value={editForm.tagCode}
                        onChange={e => setEditForm({...editForm, tagCode: e.target.value})}
                        className="w-full border-2 border-yellow-300 rounded-lg p-2 mt-1 font-bold text-blue-700" />
                    </div>

                    <div>
                      <label className="text-xs text-gray-500 font-bold">📝 หมายเหตุการแก้ไข</label>
                      <input type="text" value={editForm.editNote || ''}
                        onChange={e => setEditForm({...editForm, editNote: e.target.value})}
                        placeholder="เหตุผลที่แก้ไข"
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>

                    {lot.tagHistory?.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 font-bold mb-1">📜 ประวัติใบแท็ก</p>
                        {lot.tagHistory.map((h, i) => (
                          <p key={i} className="text-xs text-gray-500">
                            → {h.tagCode} ({h.changedBy} | {h.note})
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button onClick={handleEditSave} disabled={loading}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700">
                        ✅ บันทึก
                      </button>
                      <button onClick={() => setEditingLot(null)}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold text-sm">
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          lot.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {lot.status === 'open' ? '⏳ รอคัด' : '✅ คัดแล้ว'}
                        </span>
                        <span className="font-bold text-gray-700 text-sm">{lot.lotCode}</span>
                      </div>
                      <p className="text-sm font-bold text-green-700">🌾 {lot.riceVariety}</p>
                      <p className="text-sm text-gray-600">
                        🏷️ <span className={`font-bold ${lot.tagCode ? 'text-blue-700' : 'text-red-400'}`}>
                          {lot.tagCode || 'ยังไม่ได้ใส่เลขแท็ก'}
                        </span>
                      </p>
                      <p className="text-sm text-gray-500">👤 {lot.farmerName} | ⚖️ {lot.receivedTons} ตัน</p>
                      <p className="text-sm text-gray-500">📅 {lot.receivedDate}</p>
                    </div>
                    <button onClick={() => {
                      setEditingLot(lot);
                      setEditForm({
                        tagCode: lot.tagCode || '',
                        riceVariety: lot.riceVariety,
                        farmerName: lot.farmerName,
                        phone: lot.phone,
                        location: lot.location,
                        receivedTons: lot.receivedTons,
                        receivedDate: lot.receivedDate,
                        editNote: '',
                      });
                    }} className="bg-yellow-100 text-yellow-700 px-3 py-2 rounded-lg font-bold text-xs hover:bg-yellow-200">
                      ✏️ แก้ไข
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}