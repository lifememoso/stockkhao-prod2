import React, { useState } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function Export() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  // สร้าง quick select 3 เดือนล่าสุด
  const getLastMonths = () => {
    const months = [];
    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      months.push({
        label: `${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`,
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      });
    }
    return months;
  };

  const buildCsv = async (start, end) => {
    const startTs = new Date(start);
    const endTs = new Date(end);
    endTs.setHours(23, 59, 59);

    const [lotsSnap, salesSnap, claimsSnap, procSnap] = await Promise.all([
      getDocs(collection(db, 'lots')),
      getDocs(query(collection(db, 'sales'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))),
      getDocs(query(collection(db, 'claims'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))),
      getDocs(collection(db, 'processing')),
    ]);

    const lots = lotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const claims = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const processing = procSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const csvLots = [
      ['รหัส Lot', 'วันที่รับเข้า', 'ชาวนา', 'เบอร์', 'สถานที่', 'พันธุ์', 'ตัน', 'เลขแท็ก', 'สถานะ'],
      ...lots.map(l => [l.lotCode, l.receivedDate, l.farmerName, l.phone, l.location, l.riceVariety, l.receivedTons, l.tagCode || '-', l.status])
    ].map(r => r.join(',')).join('\n');

    const csvProcessing = [
      ['รหัส Lot', 'รอบที่', 'เลขแท็ก', 'พันธุ์เดิม', 'พันธุ์หลังคัด', 'ตันที่ตัด', 'กระสอบที่ได้', 'วันคัด'],
      ...processing.map(p => [p.lotCode, p.round, p.tagCode, p.originalVariety, p.newVariety, p.inputTons, p.outputBags || '-', p.sortingDate || '-'])
    ].map(r => r.join(',')).join('\n');

    const csvSales = [
      ['วันที่', 'รหัสขาย', 'ผู้ซื้อ', 'เบอร์', 'พันธุ์', 'กระสอบ', 'สถานะ', 'หมายเหตุ'],
      ...sales.map(s => [
        s.createdAt?.toDate?.().toLocaleDateString('th-TH') || '-',
        s.saleId, s.buyerName, s.buyerPhone || '-', s.riceVariety,
        s.totalBags, s.status, s.note || '-'
      ])
    ].map(r => r.join(',')).join('\n');

    const csvClaims = [
      ['วันที่', 'พันธุ์', 'กระสอบที่ขาย', 'กระสอบที่เคลม', '%เคลม', 'สาเหตุ'],
      ...claims.map(c => [
        c.createdAt?.toDate?.().toLocaleDateString('th-TH') || '-',
        c.riceVariety, c.saleBags, c.claimBags, c.claimPercent, c.reason
      ])
    ].map(r => r.join(',')).join('\n');

    const totalSold = sales.reduce((a, b) => a + (b.totalBags || 0), 0);
    const totalClaim = claims.reduce((a, b) => a + (b.claimBags || 0), 0);

    const csvSummary = [
      ['รายการ', 'ค่า'],
      ['ช่วงเวลา', `${start} ถึง ${end}`],
      ['ล็อตทั้งหมด', lots.length],
      ['การคัดแยก', processing.length + ' รอบ'],
      ['ขายออก (กระสอบ)', totalSold],
      ['เคลม (กระสอบ)', totalClaim],
      ['%เคลม', totalSold > 0 ? ((totalClaim / totalSold) * 100).toFixed(1) + '%' : '0%'],
    ].map(r => r.join(',')).join('\n');

    const BOM = '\uFEFF';
    return BOM +
      'Sheet 1: Lot ทั้งหมด\n' + csvLots + '\n\n' +
      'Sheet 2: การคัดแยก\n' + csvProcessing + '\n\n' +
      'Sheet 3: การขาย\n' + csvSales + '\n\n' +
      'Sheet 4: การเคลม\n' + csvClaims + '\n\n' +
      'Sheet 5: สรุป\n' + csvSummary;
  };

  const handleExport = async () => {
    if (!startDate || !endDate) { alert('กรุณาเลือกช่วงวันที่'); return; }
    setLoading(true);
    try {
      const csv = await buildCsv(startDate, endDate);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stockkhao_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export ไม่สำเร็จ: ' + err.message);
    }
    setLoading(false);
  };

  const handleArchiveMonth = async (month) => {
    setArchiveLoading(true);
    try {
      const csv = await buildCsv(month.start, month.end);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `archive_${month.label.replace('.', '')}_stockkhao.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Archive ไม่สำเร็จ: ' + err.message);
    }
    setArchiveLoading(false);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold text-gray-700 mb-6">📤 Export ข้อมูล</h2>

      {/* Archive รายเดือน */}
      <div className="bg-blue-50 rounded-xl border border-blue-200 p-5 mb-6">
        <h3 className="font-black text-blue-700 mb-1">📦 Archive รายเดือน</h3>
        <p className="text-xs text-blue-500 mb-4">ดาวน์โหลดข้อมูลครบทุกรายการ เก็บไว้ใน Drive/คอมฯ</p>
        <div className="space-y-2">
          {getLastMonths().map((month, i) => (
            <button key={i}
              onClick={() => handleArchiveMonth(month)}
              disabled={archiveLoading}
              className="w-full flex justify-between items-center bg-white border border-blue-200 rounded-xl px-5 py-3 hover:bg-blue-50 transition font-bold text-gray-700 disabled:opacity-50"
            >
              <span>📅 {month.label}</span>
              <span className="text-blue-600 text-sm">{archiveLoading ? '⏳...' : '⬇️ ดาวน์โหลด'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Export ช่วงวันที่เอง */}
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <h3 className="font-black text-gray-700">📋 Export ช่วงวันที่กำหนดเอง</h3>

        <div>
          <label className="text-sm text-gray-600 font-medium">วันที่เริ่มต้น</label>
          <input type="date" value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>
        <div>
          <label className="text-sm text-gray-600 font-medium">วันที่สิ้นสุด</label>
          <input type="date" value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full border rounded-lg p-3 mt-1 focus:outline-none focus:ring-2 focus:ring-green-400" />
        </div>

        <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
          <p className="font-medium mb-1">ไฟล์ที่จะได้รับ:</p>
          <p>📋 Sheet 1 — Lot ทั้งหมด</p>
          <p>✂️ Sheet 2 — การคัดแยก</p>
          <p>📤 Sheet 3 — การขาย</p>
          <p>🔄 Sheet 4 — การเคลม</p>
          <p>📊 Sheet 5 — สรุป</p>
        </div>

        <button onClick={handleExport} disabled={loading}
          className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 disabled:opacity-50">
          {loading ? '⏳ กำลัง Export...' : '⬇️ Download CSV'}
        </button>
      </div>
    </div>
  );
}