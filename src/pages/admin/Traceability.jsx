import React, { useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Traceability() {
  const [searchCode, setSearchCode] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchCode.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกโค้ดล็อตหรือสินค้า' });
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // ค้นหาใน lots collection
      const lotsQuery = query(
        collection(db, 'lots'),
        where('lotCode', '==', searchCode)
      );
      const lotsSnap = await getDocs(lotsQuery);

      // ค้นหาใน sales collection
      const salesQuery = query(
        collection(db, 'sales'),
        where('saleId', '==', searchCode)
      );
      const salesSnap = await getDocs(salesQuery);

      if (lotsSnap.empty && salesSnap.empty) {
        setMessage({ type: 'error', text: '❌ ไม่พบข้อมูล' });
        setResults(null);
      } else {
        const lotsData = lotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const salesData = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setResults({
          lots: lotsData,
          sales: salesData,
        });
        setMessage({ type: 'success', text: '✅ พบข้อมูล' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }

    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Title */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-blue-600 mb-2">🔍 ตรวจสอบย้อนหลัง</h2>
        <p className="text-gray-600">ค้นหาข้อมูลการไหลเวียนของข้าว</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl shadow-lg p-8 mb-8">
        <label className="text-base text-gray-800 font-bold block mb-3">
          📦 ค้นหาโค้ดล็อตหรือสินค้า
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
            placeholder="เช่น กก/ขข-001"
            className="flex-1 border-2 border-gray-300 rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-200 text-base"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? '⏳' : '🔍'}
          </button>
        </div>
      </form>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-xl mb-8 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-8">
          {/* Lots Results */}
          {results.lots.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-green-600 mb-6">🌾 ข้าวดิบที่รับเข้า</h3>
              {results.lots.map(lot => (
                <div key={lot.id} className="border-l-4 border-green-500 pl-6 py-4">
                  <p className="font-bold text-gray-800 mb-2">📦 {lot.lotCode}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">พันธุ์:</span> {lot.riceVariety}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">ชาวนา:</span> {lot.farmerName}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">ปริมาณ:</span> {lot.receivedTons} ตัน</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">วันที่รับเข้า:</span> {lot.receivedDate}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">สถานะ:</span> {lot.status}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sales Results */}
          {results.sales.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-orange-600 mb-6">📤 สินค้าที่ขายออก</h3>
              {results.sales.map(sale => (
                <div key={sale.id} className="border-l-4 border-orange-500 pl-6 py-4">
                  <p className="font-bold text-gray-800 mb-2">📊 {sale.saleId}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">พันธุ์:</span> {sale.riceVariety}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">จำนวน:</span> {sale.totalBags} กระสอบ</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">สถานะ:</span> {sale.status}</p>
                  <p className="text-sm text-gray-600"><span className="font-semibold">บันทึกโดย:</span> {sale.createdByName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!results && !message && (
        <div className="bg-blue-50 rounded-xl p-12 text-center border border-blue-200">
          <p className="text-gray-600 text-lg">📍 กรุณาค้นหาเพื่อดูข้อมูลการไหลเวียนของข้าว</p>
        </div>
      )}
    </div>
  );
}