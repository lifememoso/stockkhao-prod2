import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateVarietySummary } from '../../utils/summary';

export default function Approvals() {
  const { user } = useAuthStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'sales'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleApprove = async (sale) => {
    try {
      const now = new Date();
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'approved',
        approvedBy: user.uid,
        approvedByName: user.name,
        approvedAt: now,
      });

      // ✅ อัพเดท summary: เพิ่ม soldBags แต่ละพันธุ์
      const items = sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }];
      for (const item of items) {
        await updateVarietySummary(item.riceVariety, { deltaSoldBags: item.bags });
      }

      // ✅ บันทึก Activity Log
      await addDoc(collection(db, 'activityLog'), {
        action: 'approve_sale',
        saleId: sale.id,
        saleCode: sale.saleId,
        buyerName: sale.buyerName,
        buyerPhone: sale.buyerPhone || '-',
        items: items,
        totalBags: sale.totalBags,
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({ type: 'success', text: `✅ อนุมัติ ${sale.saleId} สำเร็จ` });
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
  };

  const handleReject = async (sale) => {
    if (!window.confirm(`ต้องการปฏิเสธ ${sale.saleId} ใช่หรือไม่?`)) return;
    try {
      const now = new Date();
      await updateDoc(doc(db, 'sales', sale.id), {
        status: 'rejected',
        rejectedBy: user.uid,
        rejectedByName: user.name,
        rejectedAt: now,
      });

      // ✅ บันทึก Activity Log
      await addDoc(collection(db, 'activityLog'), {
        action: 'reject_sale',
        saleId: sale.id,
        saleCode: sale.saleId,
        buyerName: sale.buyerName,
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({ type: 'success', text: `❌ ปฏิเสธ ${sale.saleId} สำเร็จ` });
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-lg">⏳ กำลังโหลด...</p>
    </div>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-700 mb-4">
        ✅ อนุมัติรายการขาย
        {sales.length > 0 && (
          <span className="ml-2 bg-red-500 text-white text-sm px-3 py-1 rounded-full font-bold inline-block">
            {sales.length} รายการรอยืนยัน
          </span>
        )}
      </h2>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {sales.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-4xl mb-2">🎉</p>
          <p className="text-gray-400 text-lg font-semibold">ไม่มีรายการรอยืนยัน</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sales.map(sale => (
            <div key={sale.id} className="bg-white rounded-xl shadow p-5 border-l-4 border-orange-400">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-bold">
                      ⏳ รอยืนยัน
                    </span>
                    <span className="font-black text-gray-800 text-base">{sale.saleId}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800 mb-1">👤 {sale.buyerName}</p>
                  {sale.buyerPhone && sale.buyerPhone !== '-' && (
                    <p className="text-sm text-gray-600">📱 {sale.buyerPhone}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">บันทึกโดย: {sale.createdByName}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-orange-600">{sale.totalBags}</p>
                  <p className="text-xs text-gray-400">กระสอบ</p>
                </div>
              </div>

              {/* รายการพันธุ์ */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                <p className="text-xs text-gray-500 font-bold mb-2">🌾 รายการสินค้า:</p>
                {(sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }]).map((item, i) => (
                  <div key={i} className="flex justify-between items-center text-sm mb-1 last:mb-0">
                    <span className="text-gray-700">🌾 {item.riceVariety}</span>
                    <span className="font-bold text-gray-800">{item.bags} กระสอบ</span>
                  </div>
                ))}
              </div>

              {/* หมายเหตุ */}
              {sale.note && (
                <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <span className="font-bold">💬 หมายเหตุ:</span> {sale.note}
                  </p>
                </div>
              )}

              {/* ปุ่มอนุมัติ/ปฏิเสธ */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleApprove(sale)}
                  className="bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-bold hover:shadow-md transition text-sm"
                >
                  ✅ อนุมัติ
                </button>
                <button
                  onClick={() => handleReject(sale)}
                  className="bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-lg font-bold hover:shadow-md transition text-sm"
                >
                  ❌ ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}