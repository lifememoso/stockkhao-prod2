import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const procSnap = await getDocs(collection(db, 'processing'));
        const processing = procSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const salesSnap = await getDocs(
          query(collection(db, 'sales'), where('status', '==', 'approved'))
        );
        const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const varietyMap = {};

        processing.forEach(proc => {
          const variety = proc.newVariety || proc.originalVariety;
          if (!varietyMap[variety]) {
            varietyMap[variety] = { variety, totalBags: 0, soldBags: 0 };
          }
          varietyMap[variety].totalBags += proc.outputBags || 0;
        });

        sales.forEach(sale => {
          if (varietyMap[sale.riceVariety]) {
            varietyMap[sale.riceVariety].soldBags += sale.totalBags || 0;
          }
        });

        const result = Object.values(varietyMap).map(v => ({
          ...v,
          remainingBags: v.totalBags - v.soldBags,
        }));

        setInventory(result);
      } catch (error) {
        console.error('Error:', error);
      }
      setLoading(false);
    };
    fetchInventory();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">⏳ กำลังโหลด...</p>
    </div>
  );

  const totalRemaining = inventory.reduce((a, b) => a + b.remainingBags, 0);

  return (
    <div className="pt-6 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-black text-blue-600 mb-1">📦 สินค้าคงเหลือ</h2>
        <p className="text-gray-400 text-sm">ยอดพร้อมขายแต่ละสายพันธุ์</p>
      </div>

      {/* ยอดรวม */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-5 mb-6 text-white text-center">
        <p className="text-blue-100 text-sm mb-1">พร้อมขายทั้งหมด</p>
        <p className="text-5xl font-black">{totalRemaining}</p>
        <p className="text-blue-100 text-sm">กระสอบ</p>
      </div>

      {/* รายการ */}
      {inventory.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow">
          <p className="text-gray-400">ยังไม่มีสินค้า</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inventory.map((item, i) => {
            const status = item.remainingBags === 0 ? 'red'
              : item.remainingBags < 50 ? 'yellow' : 'green';
            return (
              <div key={i} className="bg-white rounded-2xl shadow p-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-black text-gray-800 text-lg">🌾 {item.variety}</h3>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold mt-1 inline-block ${
                      status === 'green' ? 'bg-green-100 text-green-700' :
                      status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {status === 'green' ? '✅ พร้อมขาย' :
                       status === 'yellow' ? '⚠️ ใกล้หมด' : '❌ หมดสต็อก'}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-4xl font-black ${
                      status === 'green' ? 'text-green-600' :
                      status === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                    }`}>{item.remainingBags}</p>
                    <p className="text-xs text-gray-400">กระสอบ</p>
                  </div>
                </div>

                {/* Bar */}
                <div className="w-full bg-gray-100 rounded-full h-2 mt-3">
                  <div
                    className={`h-2 rounded-full ${
                      status === 'green' ? 'bg-green-500' :
                      status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${item.totalBags > 0 ? (item.remainingBags / item.totalBags * 100) : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}