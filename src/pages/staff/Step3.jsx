import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, Timestamp, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Step3() {
  const { user } = useAuthStore();
  const [varieties, setVarieties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [buyerInfo, setBuyerInfo] = useState({
    buyerName: '',
    buyerPhone: '',
    note: '',
    saleDate: new Date().toISOString().slice(0, 10),
  });

  const [items, setItems] = useState([
    { variety: '', bags: '' }
  ]);

  useEffect(() => {
    fetchVarieties();
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

  const addItem = () => {
    setItems([...items, { variety: '', bags: '' }]);
  };

  const removeItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const totalBags = items.reduce((sum, item) => sum + (parseInt(item.bags) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!buyerInfo.buyerName) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อผู้ซื้อ' });
      return;
    }

    const invalidItems = items.filter(item => !item.variety || !item.bags || parseInt(item.bags) <= 0);
    if (invalidItems.length > 0) {
      setMessage({ type: 'error', text: 'กรุณากรอกพันธุ์ข้าวและจำนวนกระสอบให้ครบ' });
      return;
    }

    setLoading(true);

    try {
      const now = Timestamp.now();
      const saleId = `SALE-${Date.now().toString().slice(-6)}`;

      await addDoc(collection(db, 'sales'), {
        saleId,
        saleDate: buyerInfo.saleDate,
        buyerName: buyerInfo.buyerName,
        buyerPhone: buyerInfo.buyerPhone || '-',
        note: buyerInfo.note || '',
        items: items.map(item => ({
          riceVariety: item.variety,
          bags: parseInt(item.bags),
        })),
        riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
        totalBags,
        status: 'pending',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: now,
      });

      await addDoc(collection(db, 'activityLog'), {
        action: 'sale',
        saleId,
        saleDate: buyerInfo.saleDate,
        buyerName: buyerInfo.buyerName,
        buyerPhone: buyerInfo.buyerPhone || '-',
        items: items.map(item => ({
          riceVariety: item.variety,
          bags: parseInt(item.bags),
        })),
        totalBags,
        note: buyerInfo.note || '-',
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({
        type: 'success',
        text: `✅ บันทึกสำเร็จ! รหัส: ${saleId} รวม ${totalBags} กระสอบ (รอ Admin ยืนยัน)`
      });

      setBuyerInfo({ buyerName: '', buyerPhone: '', note: '', saleDate: new Date().toISOString().slice(0, 10) });
      setItems([{ variety: '', bags: '' }]);

    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }

    setLoading(false);
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

      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl mx-auto">

        <div className="bg-white rounded-2xl shadow-xl p-6">
          <h3 className="font-black text-gray-800 text-base mb-4">🌾 รายการสินค้า</h3>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-gray-600 text-sm">รายการที่ {index + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600 font-bold text-sm"
                    >
                      ✕ ลบ
                    </button>
                  )}
                </div>

                <div className="mb-3">
                  <label className="text-sm text-gray-700 font-bold block mb-1">
                    🌾 พันธุ์ข้าว <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={item.variety}
                    onChange={e => updateItem(index, 'variety', e.target.value)}
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
                  >
                    <option value="">-- เลือกพันธุ์ข้าว --</option>
                    {varieties.map(v => <option key={v}>{v}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-700 font-bold block mb-1">
                    📦 จำนวนกระสอบ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={item.bags}
                    onChange={e => updateItem(index, 'bags', e.target.value)}
                    placeholder="เช่น 50"
                    className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="mt-4 w-full border-2 border-dashed border-green-400 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition"
          >
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
            <label className="text-base text-gray-800 font-bold block mb-2">
              👤 ชื่อผู้ซื้อ/ร้านค้า <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={buyerInfo.buyerName}
              onChange={e => setBuyerInfo({...buyerInfo, buyerName: e.target.value})}
              placeholder="เช่น วีระพล พันธุ์ข้าว"
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="text-base text-gray-800 font-bold block mb-2">📱 เบอร์โทร</label>
            <input
              type="tel"
              value={buyerInfo.buyerPhone}
              onChange={e => setBuyerInfo({...buyerInfo, buyerPhone: e.target.value})}
              placeholder="เบอร์โทรผู้ซื้อ"
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="text-base text-gray-800 font-bold block mb-2">
              📅 วันที่ขาย <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={buyerInfo.saleDate}
              onChange={e => setBuyerInfo({...buyerInfo, saleDate: e.target.value})}
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="text-base text-gray-800 font-bold block mb-2">📝 หมายเหตุ</label>
            <textarea
              value={buyerInfo.note}
              onChange={e => setBuyerInfo({...buyerInfo, note: e.target.value})}
              placeholder="บันทึกเพิ่มเติม..."
              rows="3"
              className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
            />
          </div>
        </div>

        {totalBags > 0 && buyerInfo.buyerName && (
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="font-bold text-blue-700 mb-2">📋 สรุปรายการ</p>
            {items.filter(i => i.variety && i.bags).map((item, i) => (
              <div key={i} className="flex justify-between text-sm text-gray-700 mb-1">
                <span>🌾 {item.variety}</span>
                <span className="font-bold">{item.bags} กระสอบ</span>
              </div>
            ))}
            <div className="border-t border-blue-200 mt-2 pt-2 flex justify-between">
              <span className="font-bold text-blue-700">👤 {buyerInfo.buyerName}</span>
              <span className="font-black text-blue-700">รวม {totalBags} กระสอบ</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50 transition shadow-lg"
        >
          {loading ? '⏳ กำลังบันทึก...' : '✅ ยืนยันการขาย'}
        </button>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <p className="text-yellow-700 font-semibold text-sm">⚠️ แจ้งเตือน</p>
          <p className="text-yellow-600 text-sm mt-1">การขายของ Staff จะต้องรอ Admin ยืนยันก่อน</p>
        </div>
      </form>
    </div>
  );
}