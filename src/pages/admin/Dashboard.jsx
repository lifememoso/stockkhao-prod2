import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Dashboard() {
  const [waitingLots, setWaitingLots] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ส่วนที่ 1: lots รอคัด — real-time
    const lotsQ = query(collection(db, 'lots'), where('status', '==', 'open'));
    const unsubLots = onSnapshot(lotsQ, (snap) => {
      setWaitingLots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // ส่วนที่ 2: summaryByVariety — เล็กมาก โหลดเร็ว
    const fetchSummary = async () => {
      try {
        const snap = await getDocs(collection(db, 'summaryByVariety'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.remainingBags - a.remainingBags);
        setSummaries(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    fetchSummary();

    // refresh summary ทุก 30 วินาที
    const interval = setInterval(fetchSummary, 30000);

    return () => {
      unsubLots();
      clearInterval(interval);
    };
  }, []);

  const [selectedVariety, setSelectedVariety] = useState(null);

  const totalWaitingTons = waitingLots.reduce((a, b) => a + (b.receivedTons || 0), 0);
  const totalReadyBags = summaries.reduce((a, b) => a + (b.remainingBags || 0), 0);
  const totalSoldBags = summaries.reduce((a, b) => a + (b.soldBags || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-lg">⏳ กำลังโหลด...</p>
    </div>
  );

  // หน้ารายละเอียดสายพันธุ์
  if (selectedVariety) {
    const pct = selectedVariety.totalBags > 0
      ? (selectedVariety.soldBags / selectedVariety.totalBags * 100).toFixed(1) : 0;

    return (
      <div>
        <button onClick={() => setSelectedVariety(null)}
          className="flex items-center gap-2 text-blue-600 font-bold mb-6 hover:underline text-sm">
          ← กลับ Dashboard
        </button>

        <div className="bg-gradient-to-r from-green-700 to-green-500 rounded-2xl p-6 mb-6 text-white">
          <h2 className="text-2xl font-black mb-1">🌾 {selectedVariety.variety}</h2>
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'รับเข้าทั้งหมด', value: selectedVariety.totalTons?.toFixed(1) || 0, unit: 'ตัน' },
              { label: 'ขายแล้ว', value: selectedVariety.soldBags, unit: 'กระสอบ' },
              { label: 'พร้อมขาย', value: selectedVariety.remainingBags, unit: 'กระสอบ' },
            ].map((s, i) => (
              <div key={i} className="bg-white bg-opacity-20 rounded-xl p-3 text-center">
                <p className="text-green-100 text-xs">{s.label}</p>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-green-100 text-xs">{s.unit}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 shadow">
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
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* SUMMARY */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-orange-600 font-bold">⏳ รอคัด</p>
          <p className="text-3xl font-black text-orange-600 mt-1">{totalWaitingTons.toFixed(1)}</p>
          <p className="text-xs text-orange-400">ตัน</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-600 font-bold">✅ พร้อมขาย</p>
          <p className="text-3xl font-black text-green-600 mt-1">{totalReadyBags.toLocaleString()}</p>
          <p className="text-xs text-green-400">กระสอบ</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-blue-600 font-bold">📤 ขายแล้ว</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{totalSoldBags.toLocaleString()}</p>
          <p className="text-xs text-blue-400">กระสอบ</p>
        </div>
      </div>

      {/* ข้าวรอคัด */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
          <h2 className="text-xl font-black text-gray-800">🌾 ข้าวรอคัดแยก</h2>
          {waitingLots.length > 0 && (
            <span className="bg-orange-500 text-white text-sm px-3 py-0.5 rounded-full font-bold">
              {waitingLots.length} ล็อต
            </span>
          )}
        </div>

        {waitingLots.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-gray-400 font-semibold">ไม่มีข้าวรอคัดแยก</p>
          </div>
        ) : (
          <div className="space-y-3">
            {waitingLots.map(lot => (
              <div key={lot.id} className="bg-white rounded-2xl shadow p-5 border-l-4 border-orange-400">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full font-bold">⏳ รอคัด</span>
                      <span className="font-black text-gray-800">{lot.lotCode}</span>
                    </div>
                    <p className="text-base font-bold text-green-700 mb-1">🌾 {lot.riceVariety}</p>
                    <p className="text-sm text-blue-700 font-bold mb-1">
                      🏷️ {lot.tagCode || <span className="text-red-400 font-normal">ยังไม่มีใบแท็ก</span>}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <p className="text-sm text-gray-600">👤 <span className="font-semibold">{lot.farmerName || '-'}</span></p>
                      <p className="text-sm text-gray-600">📅 <span className="font-semibold">{lot.receivedDate || '-'}</span></p>
                      <p className="text-sm text-gray-600">📍 <span className="font-semibold">{lot.location || '-'}</span></p>
                      <p className="text-sm text-gray-600">📱 <span className="font-semibold">{lot.phone || '-'}</span></p>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-3xl font-black text-orange-600">{lot.receivedTons}</p>
                    <p className="text-xs text-gray-400">ตัน</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* พร้อมขายแยกสายพันธุ์ */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1 h-6 bg-green-600 rounded-full"></div>
          <h2 className="text-xl font-black text-gray-800">📦 พร้อมขายแยกสายพันธุ์</h2>
          <p className="text-sm text-gray-400">กดดูรายละเอียด</p>
        </div>

        {summaries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-gray-400 font-semibold">ยังไม่มีสินค้าพร้อมขาย</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summaries.map((item, i) => {
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
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          status === 'green' ? 'bg-green-100 text-green-700' :
                          status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {status === 'green' ? '✅ พร้อมขาย' :
                           status === 'yellow' ? '⚠️ ใกล้หมด' : '❌ หมดสต็อก'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold">
                          ⚖️ {item.totalTons?.toFixed(1) || 0} ตัน
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-3xl font-black ${
                        status === 'green' ? 'text-green-600' :
                        status === 'yellow' ? 'text-yellow-600' : 'text-red-500'
                      }`}>{item.remainingBags?.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">กระสอบ</p>
                    </div>
                  </div>

                  <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                    <div className={`h-3 rounded-full ${
                      status === 'green' ? 'bg-green-500' :
                      status === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} style={{ width: `${pct}%` }} />
                  </div>

                  <div className="flex justify-between text-xs text-gray-500">
                    <span>ทั้งหมด: <b>{item.totalBags?.toLocaleString()}</b> กระสอบ</span>
                    <span>ขายแล้ว: <b className="text-red-500">{item.soldBags?.toLocaleString()}</b></span>
                    <span className="text-blue-500 font-bold">ดูรายละเอียด →</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}