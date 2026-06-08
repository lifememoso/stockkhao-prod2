import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  Timestamp, query, where
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateVarietySummary } from '../../utils/summary';

export default function Step3() {
  const { user } = useAuthStore();
  const [varieties, setVarieties] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSales, setShowSales] = useState(true);

  const [buyerInfo, setBuyerInfo] = useState({
    buyerName: '', buyerPhone: '', note: '',
    saleDate: new Date().toISOString().slice(0, 10),
  });
  const [items, setItems] = useState([{ variety: '', bags: '' }]);

  useEffect(() => {
    fetchVarieties();
    fetchSales();
  }, []);

  const fetchVarieties = async () => {
    const q = query(collection(db, 'settings'), where('type', '==', 'variety'), where('active', '==', true));
    const snap = await getDocs(q);
    setVarieties(snap.docs.map(d => d.data().name));
  };

  const fetchSales = async () => {
    const snap = await getDocs(collection(db, 'sales'));
    setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
  };

  const resetForm = () => {
    setBuyerInfo({ buyerName: '', buyerPhone: '', note: '', saleDate: new Date().toISOString().slice(0, 10) });
    setItems([{ variety: '', bags: '' }]);
    setEditingSale(null);
    setShowForm(false);
  };

  const addItem = () => setItems([...items, { variety: '', bags: '' }]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };
  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i][field] = value;
    setItems(updated);
  };
  const totalBags = items.reduce((sum, item) => sum + (parseInt(item.bags) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!buyerInfo.buyerName) { setMessage({ type: 'error', text: 'กรุณากรอกชื่อผู้ซื้อ' }); return; }
    if (items.some(i => !i.variety || !i.bags || parseInt(i.bags) <= 0)) {
      setMessage({ type: 'error', text: 'กรุณากรอกพันธุ์ข้าวและจำนวนกระสอบให้ครบ' }); return;
    }
    setLoading(true);
    try {
      const now = Timestamp.now();

      if (editingSale) {
        // แก้ไข — ถ้า approved ต้อง rollback ก่อน แล้วคำนวณใหม่
        if (editingSale.status === 'approved') {
          const oldItems = editingSale.items || [{ riceVariety: editingSale.riceVariety, bags: editingSale.totalBags }];
          for (const item of oldItems) {
            await updateVarietySummary(item.riceVariety, { deltaSoldBags: -(item.bags || 0) });
          }
          for (const item of items) {
            await updateVarietySummary(item.variety, { deltaSoldBags: parseInt(item.bags) });
          }
        }
        await updateDoc(doc(db, 'sales', editingSale.id), {
          saleDate: buyerInfo.saleDate,
          buyerName: buyerInfo.buyerName,
          buyerPhone: buyerInfo.buyerPhone || '-',
          note: buyerInfo.note || '',
          items: items.map(i => ({ riceVariety: i.variety, bags: parseInt(i.bags) })),
          riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
          totalBags,
          updatedBy: user.name,
          updatedAt: now,
        });
        setMessage({ type: 'success', text: '✅ แก้ไขสำเร็จ!' });
      } else {
        // สร้างใหม่
        const saleId = `SALE-${Date.now().toString().slice(-6)}`;
        await addDoc(collection(db, 'sales'), {
          saleId, saleDate: buyerInfo.saleDate,
          buyerName: buyerInfo.buyerName, buyerPhone: buyerInfo.buyerPhone || '-',
          note: buyerInfo.note || '',
          items: items.map(i => ({ riceVariety: i.variety, bags: parseInt(i.bags) })),
          riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
          totalBags, status: 'pending',
          createdBy: user.uid, createdByName: user.name, createdAt: now,
        });
        await addDoc(collection(db, 'activityLog'), {
          action: 'sale', saleId, saleDate: buyerInfo.saleDate,
          buyerName: buyerInfo.buyerName,
          items: items.map(i => ({ riceVariety: i.variety, bags: parseInt(i.bags) })),
          totalBags, by: user.uid, byName: user.name, at: now,
        });
        setMessage({ type: 'success', text: `✅ บันทึกสำเร็จ! รวม ${totalBags} กระสอบ (รอ Admin ยืนยัน)` });
      }
      resetForm();
      fetchSales();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setBuyerInfo({
      buyerName: sale.buyerName,
      buyerPhone: sale.buyerPhone || '',
      note: sale.note || '',
      saleDate: sale.saleDate,
    });
    setItems(sale.items
      ? sale.items.map(i => ({ variety: i.riceVariety, bags: i.bags.toString() }))
      : [{ variety: sale.riceVariety, bags: sale.totalBags.toString() }]
    );
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  const handleDelete = async (sale) => {
    setLoading(true);
    try {
      if (sale.status === 'approved') {
        const items = sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }];
        for (const item of items) {
          await updateVarietySummary(item.riceVariety, { deltaSoldBags: -(item.bags || 0) });
        }
      }
      // ลบ claims ที่เกี่ยวข้อง
      const claimsQ = query(collection(db, 'claims'), where('saleId', '==', sale.id));
      const claimsSnap = await getDocs(claimsQ);
      for (const c of claimsSnap.docs) await deleteDoc(doc(db, 'claims', c.id));
      await deleteDoc(doc(db, 'sales', sale.id));
      setMessage({ type: 'success', text: '✅ ลบสำเร็จ!' });
      fetchSales();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">✅ อนุมัติแล้ว</span>;
    if (s === 'rejected') return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">❌ ปฏิเสธ</span>;
    return <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">⏳ รอ Admin</span>;
  };

  return (
    <div className="pt-6 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 mb-1">📤 ขายออก</h2>
        <p className="text-gray-500 text-sm">รองรับหลายพันธุ์ในครั้งเดียว</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-xl font-black text-red-600 mb-2">⚠️ ยืนยันการลบ</p>
            <p className="text-gray-600 text-sm mb-3">ลบ <b>{confirmDelete.saleId}</b> — {confirmDelete.buyerName}</p>
            {confirmDelete.status === 'approved' && (
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg mb-3">⚠️ Sale นี้ approved แล้ว จะ rollback soldBags อัตโนมัติ</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} disabled={loading}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '🗑️ ลบเลย'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ปุ่มเพิ่มรายการใหม่ */}
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full mb-6 bg-green-600 text-white py-3 rounded-xl font-black text-base hover:bg-green-700 transition">
          ➕ บันทึกการขายใหม่
        </button>
      )}

      {/* FORM */}
      {showForm && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-gray-800">
              {editingSale ? `✏️ แก้ไข ${editingSale.saleId}` : '➕ บันทึกการขายใหม่'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 text-2xl">✕</button>
          </div>

          {editingSale?.status === 'approved' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-xs text-yellow-700">
              ⚠️ Sale นี้ approved แล้ว การแก้ไขจะ rollback และคำนวณ summary ใหม่อัตโนมัติ
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="font-black text-gray-800 text-base mb-4">🌾 รายการสินค้า</h3>
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="font-bold text-gray-600 text-sm">รายการที่ {index + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(index)}
                          className="text-red-400 hover:text-red-600 font-bold text-sm">✕ ลบ</button>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="text-sm text-gray-700 font-bold block mb-1">🌾 พันธุ์ข้าว *</label>
                      <select value={item.variety} onChange={e => updateItem(index, 'variety', e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500">
                        <option value="">-- เลือกพันธุ์ข้าว --</option>
                        {varieties.map(v => <option key={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-700 font-bold block mb-1">📦 จำนวนกระสอบ *</label>
                      <input type="number" value={item.bags} onChange={e => updateItem(index, 'bags', e.target.value)}
                        placeholder="เช่น 50"
                        className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addItem}
                className="mt-4 w-full border-2 border-dashed border-green-400 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition">
                ➕ เพิ่มรายการที่ {items.length + 1}
              </button>
              {items.length > 1 && (
                <div className="mt-4 bg-green-50 rounded-xl p-4 border border-green-200 flex justify-between items-center">
                  <span className="font-bold text-gray-700">รวมทั้งหมด</span>
                  <span className="text-2xl font-black text-green-700">{totalBags} กระสอบ</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4">
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">👤 ชื่อผู้ซื้อ/ร้านค้า *</label>
                <input type="text" value={buyerInfo.buyerName}
                  onChange={e => setBuyerInfo({...buyerInfo, buyerName: e.target.value})}
                  placeholder="เช่น วีระพล พันธุ์ข้าว"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📱 เบอร์โทร</label>
                <input type="tel" value={buyerInfo.buyerPhone}
                  onChange={e => setBuyerInfo({...buyerInfo, buyerPhone: e.target.value})}
                  placeholder="เบอร์โทรผู้ซื้อ"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📅 วันที่ขาย *</label>
                <input type="date" value={buyerInfo.saleDate}
                  onChange={e => setBuyerInfo({...buyerInfo, saleDate: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📝 หมายเหตุ</label>
                <textarea value={buyerInfo.note}
                  onChange={e => setBuyerInfo({...buyerInfo, note: e.target.value})}
                  placeholder="บันทึกเพิ่มเติม..." rows="3"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50 transition shadow-lg">
              {loading ? '⏳ กำลังบันทึก...' : editingSale ? '✅ บันทึกการแก้ไข' : '✅ ยืนยันการขาย'}
            </button>

            {!editingSale && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <p className="text-yellow-700 font-semibold text-sm">⚠️ แจ้งเตือน</p>
                <p className="text-yellow-600 text-sm mt-1">การขายของ Staff จะต้องรอ Admin ยืนยันก่อน</p>
              </div>
            )}
          </form>
        </div>
      )}

      {/* รายการที่บันทึกแล้ว */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <button onClick={() => setShowSales(!showSales)}
          className="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-800">📋 รายการขายที่บันทึกแล้ว</h3>
            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{sales.length}</span>
          </div>
          <span className="text-gray-400 text-xl">{showSales ? '▲' : '▼'}</span>
        </button>

        {showSales && (
          <div className="px-4 pb-4 space-y-3">
            {sales.length === 0 ? (
              <p className="text-center text-gray-400 py-8">ยังไม่มีรายการขาย</p>
            ) : (
              sales.map(sale => (
                <div key={sale.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {statusBadge(sale.status)}
                        <span className="font-bold text-gray-700 text-sm">{sale.saleId}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-700">👤 {sale.buyerName}</p>
                      {(sale.items || []).map((item, i) => (
                        <p key={i} className="text-sm text-gray-600">🌾 {item.riceVariety} — {item.bags} กระสอบ</p>
                      ))}
                      {!sale.items && <p className="text-sm text-gray-600">🌾 {sale.riceVariety} — {sale.totalBags} กระสอบ</p>}
                      <p className="text-xs text-gray-400 mt-1">📅 {sale.saleDate} | บันทึกโดย: {sale.createdByName}</p>
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <button onClick={() => handleEdit(sale)}
                        className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-yellow-200">
                        ✏️ แก้ไข
                      </button>
                      <button onClick={() => setConfirmDelete(sale)}
                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200">
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}