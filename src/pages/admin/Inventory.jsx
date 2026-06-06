import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function AdminInventory() {
  const [inventoryByVariety, setInventoryByVariety] = useState([]);
  const [selectedVariety, setSelectedVariety] = useState(null);
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

        const lotsSnap = await getDocs(collection(db, 'lots'));
        const lots = lotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const varietyMap = {};

        processing.forEach(proc => {
          const variety = proc.newVariety || proc.originalVariety;
          if (!varietyMap[variety]) {
            varietyMap[variety] = { variety, totalTons: 0, totalBags: 0, soldBags: 0, lots: [] };
          }
          varietyMap[variety].totalTons += proc.inputTons || 0;
          varietyMap[variety].totalBags += proc.outputBags || 0;

          const sourceLot = lots.find(l => l.id === proc.lotId);
          varietyMap[variety].lots.push({
            tagCode: proc.tagCode,
            lotCode: proc.lotCode,
            farmerName: sourceLot?.farmerName || '-',
            location: sourceLot?.location || '-',
            inputTons: proc.inputTons,
            outputBags: proc.outputBags,
            sortingDate: proc.sortingDate,
            germinationTestDate: proc.germinationTestDate,
          });
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

        setInventoryByVariety(result);
      } catch (error) {
        console.error('Error:', error);
      }
      setLoading(false);
    };
    fetchInventory();
  }, []);

  const totalAll = {
    totalTons: inventoryByVariety.reduce((a, b) => a + b.totalTons, 0),
    sold: inventoryByVariety.reduce((a, b) => a + b.soldBags, 0),
    remaining: inventoryByVariety.reduce((a, b) => a + b.remainingBags, 0),
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">⏳ กำลังโหลด...</p>
    </div>
  );

  if (selectedVariety) {
    const pct = selectedVariety.totalBags > 0
      ? (selectedVariety.soldBags / selectedVariety.totalBags * 100).toFixed(1) : 0;

    return (
      <div>
        <button onClick={() => setSelectedVariety(null)}
          className="flex items-center gap-2 text-blue-600 font-bold mb-6 hover:underline">
          ← กลับรายการ
        </button>

        <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-2xl p-6 mb-6 text-white">
          <h2 className="text-2xl font-black mb-1">🌾 {selectedVariety.variety}</h2>
          <p className="text-green-100 text-sm mb-4">รายละเอียดสต็อกและแหล่งที่มา</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "รับเข้าทั้งหมด", value: selectedVariety.totalTons, unit: "ตัน" },
              { label: "ขายแล้ว", value: selectedVariety.soldBags, unit: "กระสอบ" },
              { label: "พร้อมขาย", value: selectedVariety.remainingBags, unit: "กระสอบ" },
            ].map((s, i) => (
              <div key={i} className="bg-white bg-opacity-20 rounded-xl p-3 text-center">
                <p className="text-green-100 text-xs">{s.label}</p>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-green-100 text-xs">{s.unit}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow">
          <div className="flex justify-between mb-2">
            <span className="font-bold text-gray-700 text-sm">ความคืบหน้าการขาย</span>
            <span className="font-black text-blue-600">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div className="bg-green-500 h-4 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-gray-400 text-right mt-1">
            ขาย {selectedVariety.soldBags} จาก {selectedVariety.totalBags} กระสอบ
          </p>
        </div>

        {/* Lots */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-black text-gray-800 text-lg mb-4">
            📋 มาจากล็อตไหนบ้าง ({selectedVariety.lots.length} ล็อต)
          </h3>
          {selectedVariety.lots.map((lot, i) => (
            <div key={i} className="border-l-4 border-green-500 pl-4 mb-6 pb-4 border-b last:border-b-0">
              <div className="flex justify-between gap-4">
                <div className="flex-1">
                  <p className="font-black text-blue-700 text-base mb-2">🏷️ {lot.tagCode}</p>
                  <p className="text-sm text-gray-600">📦 ล็อต: <span className="font-bold">{lot.lotCode}</span></p>
                  <p className="text-sm text-gray-600">👤 ชาวนา: <span className="font-bold">{lot.farmerName}</span></p>
                  <p className="text-sm text-gray-600">📍 สถานที่: <span className="font-bold">{lot.location}</span></p>
                  <p className="text-sm text-gray-600">⚖️ ตัดออก: <span className="font-bold text-blue-600">{lot.inputTons} ตัน</span></p>
                  <p className="text-sm text-gray-600">📅 วันคัด: <span className="font-bold">{lot.sortingDate || '-'}</span></p>
                  <p className="text-sm text-gray-600">🌱 ทดสอบงอก: <span className="font-bold">{lot.germinationTestDate || '-'}</span></p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center min-w-20">
                  <p className="text-2xl font-black text-green-600">{lot.outputBags}</p>
                  <p className="text-xs text-gray-500">กระสอบ</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-3xl font-black text-blue-600 mb-1">📦 สินค้าคงเหลือ</h2>
        <p className="text-gray-400 text-sm">แยกตามสายพันธุ์ — กดดูรายละเอียด</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "รับเข้าทั้งหมด", value: totalAll.totalTons, unit: "ตัน", color: "blue" },
          { label: "ขายแล้ว", value: totalAll.sold, unit: "กระสอบ", color: "red" },
          { label: "พร้อมขาย", value: totalAll.remaining, unit: "กระสอบ", color: "green" },
        ].map((s, i) => (
          <div key={i} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-4 text-center`}>
            <p className={`text-xs text-${s.color}-600 font-semibold`}>{s.label}</p>
            <p className={`text-2xl font-black text-${s.color}-700`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-500`}>{s.unit}</p>
          </div>
        ))}
      </div>

      {/* Cards */}
      <div className="space-y-4">
        {inventoryByVariety.map((item, i) => {
          const pct = item.totalBags > 0 ? (item.remainingBags / item.totalBags * 100) : 0;
          const status = item.remainingBags === 0 ? 'red'
            : item.remainingBags < 50 ? 'yellow' : 'green';

          return (
            <button key={i} onClick={() => setSelectedVariety(item)}
              className="w-full bg-white rounded-2xl shadow p-5 text-left hover:shadow-lg transition border-2 border-transparent hover:border-green-300">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-gray-800 text-lg">🌾 {item.variety}</h3>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold ${
                      status === 'green' ? 'bg-green-100 text-green-700' :
                      status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {status === 'green' ? '✅ พร้อมขาย' :
                       status === 'yellow' ? '⚠️ ใกล้หมด' : '❌ หมดสต็อก'}
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold">
                      📦 {item.lots.length} ล็อต
                    </span>
                    <span className="text-xs px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-bold">
                      ⚖️ {item.totalTons} ตัน
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-black ${
                    status === 'green' ? 'text-green-600' :
                    status === 'yellow' ? 'text-yellow-600' : 'text-red-600'
                  }`}>{item.remainingBags}</p>
                  <p className="text-xs text-gray-400">กระสอบพร้อมขาย</p>
                </div>
              </div>

              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className={`h-3 rounded-full ${
                  status === 'green' ? 'bg-green-500' :
                  status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                }`} style={{ width: `${pct}%` }} />
              </div>

              <div className="flex justify-between text-xs text-gray-500">
                <span>ได้กระสอบ: <b>{item.totalBags}</b></span>
                <span>ขายแล้ว: <b className="text-red-500">{item.soldBags}</b></span>
                <span className="text-blue-500 font-bold">ดูรายละเอียด →</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}