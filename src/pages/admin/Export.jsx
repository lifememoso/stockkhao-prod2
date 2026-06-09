import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Export() {
  const [varieties, setVarieties] = useState([]);
  const [selectedVarieties, setSelectedVarieties] = useState([]);
  const [periodType, setPeriodType] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportTypes, setExportTypes] = useState(['register']);
  const [loading, setLoading] = useState(false);
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    fetchVarieties();
    const now = new Date();
    setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    setSelectedQuarter(`${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`);
  }, []);

  const fetchVarieties = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'settings'), where('type', '==', 'variety'), where('active', '==', true)));
      const vars = snap.docs.map(d => d.data().name);
      setVarieties(vars);
      setSelectedVarieties(vars);
    } catch (err) {
      console.error('fetchVarieties error:', err);
    }
  };

  const getDateRange = () => {
    try {
      if (periodType === 'custom') return { start: startDate, end: endDate };
      if (periodType === 'month') {
        if (!selectedMonth) return { start: '', end: '' };
        const [y, m] = selectedMonth.split('-');
        if (!y || !m) return { start: '', end: '' };
        const start = `${y}-${m}-01`;
        const end = new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0, 10);
        return { start, end };
      }
      if (periodType === 'quarter') {
        if (!selectedQuarter) return { start: '', end: '' };
        const parts = selectedQuarter.split('-Q');
        if (parts.length < 2) return { start: '', end: '' };
        const y = parts[0];
        const qNum = parseInt(parts[1]);
        const startMonth = (qNum - 1) * 3 + 1;
        const endMonth = qNum * 3;
        const start = `${y}-${String(startMonth).padStart(2, '0')}-01`;
        const end = new Date(parseInt(y), endMonth, 0).toISOString().slice(0, 10);
        return { start, end };
      }
      if (periodType === 'year') {
        return { start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` };
      }
    } catch (err) {
      console.error('getDateRange error:', err);
    }
    return { start: '', end: '' };
  };

  const getYears = () => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  };

  const getQuarters = () => {
    const current = new Date().getFullYear();
    const quarters = [];
    for (let y = current; y >= current - 1; y--) {
      for (let q = 4; q >= 1; q--) {
        quarters.push({ label: `Q${q} ปี ${y + 543}`, value: `${y}-Q${q}` });
      }
    }
    return quarters;
  };

  const toggleVariety = (v) => {
    setSelectedVarieties(prev =>
      prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
    );
  };

  const toggleExportType = (t) => {
    setExportTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const fetchData = async (start, end) => {
    const startTs = new Date(start);
    const endTs = new Date(end);
    endTs.setHours(23, 59, 59);
    const p = [];
    if (exportTypes.includes('register') || exportTypes.includes('csv_lots'))
      p.push(getDocs(collection(db, 'lots')));
    else p.push(Promise.resolve({ docs: [] }));
    if (exportTypes.includes('register') || exportTypes.includes('csv_sales'))
      p.push(getDocs(query(collection(db, 'sales'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))));
    else p.push(Promise.resolve({ docs: [] }));
    if (exportTypes.includes('csv_claims'))
      p.push(getDocs(query(collection(db, 'claims'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))));
    else p.push(Promise.resolve({ docs: [] }));
    if (exportTypes.includes('register') || exportTypes.includes('csv_processing'))
      p.push(getDocs(collection(db, 'processing')));
    else p.push(Promise.resolve({ docs: [] }));
    const [lotsSnap, salesSnap, claimsSnap, procSnap] = await Promise.all(p);
    return {
      lots: lotsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      sales: salesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      claims: claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      processing: procSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  };

  // ===== Download CSV =====
  const handleDownloadCSV = async () => {
    const { start, end } = getDateRange();
    if (!start || !end) { alert('กรุณาเลือกช่วงเวลา'); return; }
    if (selectedVarieties.length === 0) { alert('กรุณาเลือกสายพันธุ์'); return; }
    setCsvLoading(true);
    try {
      const startTs = new Date(start);
      const endTs = new Date(end);
      endTs.setHours(23, 59, 59);

      const [lotsSnap, salesSnap, claimsSnap, procSnap] = await Promise.all([
        getDocs(collection(db, 'lots')),
        getDocs(query(collection(db, 'sales'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))),
        getDocs(query(collection(db, 'claims'), where('createdAt', '>=', Timestamp.fromDate(startTs)), where('createdAt', '<=', Timestamp.fromDate(endTs)))),
        getDocs(collection(db, 'processing')),
      ]);

      const lots = lotsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => selectedVarieties.includes(l.riceVariety));
      const sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => selectedVarieties.includes(s.riceVariety));
      const claims = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => selectedVarieties.includes(c.riceVariety));
      const processing = procSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => selectedVarieties.includes(p.newVariety || p.originalVariety));

      const BOM = '\uFEFF';
      let csv = BOM;

      csv += 'รับเข้า (Lots)\n';
      csv += 'รหัส Lot,วันที่รับเข้า,ชาวนา,เบอร์,สถานที่,พันธุ์,ตัน,เลขแท็ก,สถานะ\n';
      lots.forEach(l => {
        csv += `${l.lotCode},${l.receivedDate},${l.farmerName},${l.phone},${l.location},${l.riceVariety},${l.receivedTons},${l.tagCode||'-'},${l.status}\n`;
      });

      csv += '\nการคัดแยก\n';
      csv += 'รหัส Lot,รอบที่,เลขแท็ก,พันธุ์เดิม,พันธุ์หลังคัด,ตันที่ตัด,กระสอบที่ได้,วันคัด,ทดสอบงอก\n';
      processing.forEach(p => {
        csv += `${p.lotCode},${p.round},${p.tagCode},${p.originalVariety},${p.newVariety},${p.inputTons},${p.outputBags||'-'},${p.sortingDate||'-'},${p.germinationTestDate||'-'}\n`;
      });

      csv += '\nการขาย\n';
      csv += 'วันที่,รหัสขาย,ผู้ซื้อ,เบอร์,พันธุ์,กระสอบ,สถานะ,หมายเหตุ\n';
      sales.forEach(s => {
        csv += `${s.saleDate||'-'},${s.saleId},${s.buyerName},${s.buyerPhone||'-'},${s.riceVariety},${s.totalBags},${s.status},${s.note||'-'}\n`;
      });

      csv += '\nการเคลม\n';
      csv += 'วันที่เคลม,พันธุ์,รหัสขาย,ผู้ซื้อ,กระสอบที่ขาย,กระสอบที่เคลม,%เคลม,สาเหตุ\n';
      claims.forEach(c => {
        csv += `${c.claimDate||'-'},${c.riceVariety},${c.saleCode},${c.buyerName},${c.saleBags},${c.claimBags},${c.claimPercent},${c.reason}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ทะเบียนข้าว_${start}_${end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export CSV ไม่สำเร็จ: ' + err.message);
    }
    setCsvLoading(false);
  };

  // ===== Download Excel =====
  const handleExport = async () => {
    const { start, end } = getDateRange();
    if (!start || !end) { alert('กรุณาเลือกช่วงเวลา'); return; }
    if (selectedVarieties.length === 0) { alert('กรุณาเลือกสายพันธุ์'); return; }
    if (exportTypes.length === 0) { alert('กรุณาเลือกรูปแบบ'); return; }
    setLoading(true);
    try {
      const XLSX = await import(/* @vite-ignore */ 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const { lots, sales, claims, processing } = await fetchData(start, end);
      const wb = XLSX.utils.book_new();
      const periodLabel = `${start}_${end}`;

      if (exportTypes.includes('register')) {
        for (const variety of selectedVarieties) {
          const procV = processing.filter(p => (p.newVariety || p.originalVariety) === variety);
          const salesV = sales.filter(s => {
            if (s.status !== 'approved') return false;
            if (s.items) return s.items.some(i => i.riceVariety === variety);
            return s.riceVariety === variety;
          });
          if (procV.length === 0 && salesV.length === 0) continue;
          const ws = XLSX.utils.aoa_to_sheet([]);
          ws['A1'] = { v: 'บันทึกรายการรับซื้อ-จำหน่ายพันธุ์ข้าวปลูก', t: 's' };
          ws['A2'] = { v: 'บริษัท ธนภร 7896 จำกัด (สำนักงานใหญ่)', t: 's' };
          ws['A3'] = { v: `พันธุ์ข้าว....................${variety}....................`, t: 's' };
          ws['A4'] = { v: `ช่วงเวลา: ${start} ถึง ${end}`, t: 's' };
          const h1 = ['วันที่','ชื่อ','ที่อยู่','จำนวน','รับ','ขาย','คงเหลือ','รหัส','วันที่','วันที่','วันที่ทดสอบ','ส่งคืน','หมายเหตุ'];
          const h2 = ['(ข้าวเข้า)','','','(ตัน)','(กระสอบ)','(กระสอบ)','(กระสอบ)','(ใบแท็ก)','(ใบแท็ก)','(คัดข้าว)','(การงอก)','(กระสอบ)',''];
          h1.forEach((h, i) => { const c = String.fromCharCode(65+i); ws[`${c}5`]={v:h,t:'s'}; ws[`${c}6`]={v:h2[i],t:'s'}; });
          let row = 7, running = 0;
          const events = [];
          procV.forEach(proc => {
            const lot = lots.find(l => l.id === proc.lotId);
            events.push({ date: proc.sortingDate||'-', name: lot?.farmerName||'-', addr: lot?.location||'-', tons: proc.inputTons||0, recv: proc.outputBags||0, sale: 0, tag: proc.tagCode||'-', tagDate: proc.tagIssueDate||'-', sortDate: proc.sortingDate||'-', germ: proc.germinationTestDate||'-', ret: 0, note: '' });
          });
          salesV.forEach(s => {
            const bags = s.items ? (s.items.find(i => i.riceVariety === variety)?.bags||0) : s.totalBags;
            events.push({ date: s.saleDate||'-', name: s.buyerName||'-', addr: '-', tons: 0, recv: 0, sale: bags, tag: '-', tagDate: '-', sortDate: '-', germ: '-', ret: 0, note: s.note||'' });
          });
          events.sort((a,b) => new Date(a.date)-new Date(b.date));
          events.forEach(ev => {
            running += ev.recv - ev.sale - ev.ret;
            [ev.date,ev.name,ev.addr,ev.tons||'',ev.recv||'',ev.sale||'',running,ev.tag,ev.tagDate,ev.sortDate,ev.germ,ev.ret||'',ev.note].forEach((v,i) => {
              const c = String.fromCharCode(65+i);
              ws[`${c}${row}`] = { v: v===0?'':v, t: typeof v==='number'?'n':'s' };
            });
            row++;
          });
          row++;
          const tRecv = events.reduce((a,b)=>a+b.recv,0);
          const tSale = events.reduce((a,b)=>a+b.sale,0);
          ws[`E${row}`]={v:`รวมรับ: ${tRecv}`,t:'s'};
          ws[`F${row}`]={v:`รวมขาย: ${tSale}`,t:'s'};
          ws[`G${row}`]={v:`คงเหลือ: ${tRecv-tSale}`,t:'s'};
          ws['!cols']=[{wch:14},{wch:20},{wch:18},{wch:10},{wch:10},{wch:10},{wch:10},{wch:14},{wch:14},{wch:14},{wch:14},{wch:10},{wch:16}];
          ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:12}},{s:{r:1,c:0},e:{r:1,c:12}},{s:{r:2,c:0},e:{r:2,c:12}},{s:{r:3,c:0},e:{r:3,c:12}}];
          ws['!ref']=`A1:M${row}`;
          XLSX.utils.book_append_sheet(wb, ws, variety.substring(0,31));
        }
      }

      if (exportTypes.includes('csv_lots')) {
        const wsData = [['รหัส Lot','วันที่รับเข้า','ชาวนา','เบอร์','สถานที่','พันธุ์','ตัน','เลขแท็ก','สถานะ'],
          ...lots.filter(l=>selectedVarieties.includes(l.riceVariety)).map(l=>[l.lotCode,l.receivedDate,l.farmerName,l.phone,l.location,l.riceVariety,l.receivedTons,l.tagCode||'-',l.status])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Lot ทั้งหมด');
      }
      if (exportTypes.includes('csv_processing')) {
        const wsData = [['รหัส Lot','รอบที่','เลขแท็ก','พันธุ์เดิม','พันธุ์หลังคัด','ตันที่ตัด','กระสอบที่ได้','วันคัด','ทดสอบงอก'],
          ...processing.filter(p=>selectedVarieties.includes(p.newVariety||p.originalVariety)).map(p=>[p.lotCode,p.round,p.tagCode,p.originalVariety,p.newVariety,p.inputTons,p.outputBags||'-',p.sortingDate||'-',p.germinationTestDate||'-'])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'การคัดแยก');
      }
      if (exportTypes.includes('csv_sales')) {
        const wsData = [['วันที่','รหัสขาย','ผู้ซื้อ','เบอร์','พันธุ์','กระสอบ','สถานะ','หมายเหตุ'],
          ...sales.filter(s=>s.items?s.items.some(i=>selectedVarieties.includes(i.riceVariety)):selectedVarieties.includes(s.riceVariety)).map(s=>[s.saleDate||'-',s.saleId,s.buyerName,s.buyerPhone||'-',s.riceVariety,s.totalBags,s.status,s.note||'-'])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'การขาย');
      }
      if (exportTypes.includes('csv_claims')) {
        const wsData = [['วันที่เคลม','พันธุ์','รหัสขาย','ผู้ซื้อ','กระสอบที่ขาย','กระสอบที่เคลม','%เคลม','สาเหตุ','หมายเหตุ'],
          ...claims.filter(c=>selectedVarieties.includes(c.riceVariety)).map(c=>[c.claimDate||'-',c.riceVariety,c.saleCode,c.buyerName,c.saleBags,c.claimBags,c.claimPercent,c.reason,c.note||'-'])];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'การเคลม');
      }

      if (wb.SheetNames.length === 0) { alert('ไม่มีข้อมูลในช่วงเวลาที่เลือก'); setLoading(false); return; }
      XLSX.writeFile(wb, `ทะเบียนข้าว_${periodLabel}.xlsx`);
    } catch (err) {
      alert('Export Excel ไม่สำเร็จ: ' + err.message);
    }
    setLoading(false);
  };

  const { start = '', end = '' } = getDateRange() || {};

  return (
    <div className="max-w-2xl space-y-5">
      <h2 className="text-xl font-bold text-gray-700">📤 Export ข้อมูล</h2>

      {/* STEP 1 */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-black text-gray-700 mb-3">1️⃣ เลือกช่วงเวลา</h3>
        <div className="flex gap-2 flex-wrap mb-4">
          {[{key:'month',label:'รายเดือน'},{key:'quarter',label:'รายไตรมาส'},{key:'year',label:'รายปี'},{key:'custom',label:'กำหนดเอง'}].map(t => (
            <button key={t.key} onClick={() => setPeriodType(t.key)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition ${periodType===t.key?'bg-green-700 text-white':'bg-gray-100 text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {periodType==='month' && (
          <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
        )}
        {periodType==='quarter' && (
          <select value={selectedQuarter} onChange={e=>setSelectedQuarter(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-3">
            {getQuarters().map(q=><option key={q.value} value={q.value}>{q.label}</option>)}
          </select>
        )}
        {periodType==='year' && (
          <select value={selectedYear} onChange={e=>setSelectedYear(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl p-3">
            {getYears().map(y=><option key={y} value={y}>ปี {y+543} ({y})</option>)}
          </select>
        )}
        {periodType==='custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-bold">วันเริ่มต้น</label>
              <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 mt-1" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold">วันสิ้นสุด</label>
              <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 mt-1" />
            </div>
          </div>
        )}
        {start && end && (
          <div className="mt-3 bg-green-50 rounded-lg p-2 text-xs text-green-700 font-bold text-center">
            📅 {start} ถึง {end}
          </div>
        )}
      </div>

      {/* STEP 2 */}
      <div className="bg-white rounded-xl shadow p-5">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-black text-gray-700">2️⃣ เลือกสายพันธุ์</h3>
          <div className="flex gap-2">
            <button onClick={()=>setSelectedVarieties(varieties)} className="text-xs text-green-600 font-bold hover:underline">เลือกทั้งหมด</button>
            <span className="text-gray-300">|</span>
            <button onClick={()=>setSelectedVarieties([])} className="text-xs text-red-500 font-bold hover:underline">ล้าง</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {varieties.map(v => (
            <button key={v} onClick={()=>toggleVariety(v)}
              className={`px-3 py-2 rounded-full text-sm font-bold transition border-2 ${selectedVarieties.includes(v)?'bg-green-700 text-white border-green-700':'bg-white text-gray-500 border-gray-200'}`}>
              🌾 {v}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">เลือก {selectedVarieties.length}/{varieties.length} สายพันธุ์</p>
      </div>

      {/* STEP 3 — Excel เท่านั้น */}
      <div className="bg-white rounded-xl shadow p-5">
        <h3 className="font-black text-gray-700 mb-3">3️⃣ เลือกรูปแบบ Excel</h3>
        <div className="space-y-2">
          {[
            {key:'register',label:'📗 ทะเบียนรับซื้อ-จำหน่าย',desc:'แยก Sheet ตามสายพันธุ์ พร้อมคอลัมน์ครบ'},
            {key:'csv_lots',label:'📋 รายการ Lot รับเข้า',desc:'รหัส Lot, ชาวนา, ปริมาณ, แท็ก'},
            {key:'csv_processing',label:'✂️ รายการคัดแยก',desc:'รอบคัด, กระสอบที่ได้, วันคัด'},
            {key:'csv_sales',label:'💰 รายการขายออก',desc:'ผู้ซื้อ, จำนวน, สถานะ'},
            {key:'csv_claims',label:'🔄 รายการเคลม',desc:'สาเหตุ, จำนวน, %เคลม'},
          ].map(t => (
            <button key={t.key} onClick={()=>toggleExportType(t.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition text-left ${exportTypes.includes(t.key)?'border-green-500 bg-green-50':'border-gray-200 bg-white'}`}>
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${exportTypes.includes(t.key)?'bg-green-600':'bg-gray-200'}`}>
                {exportTypes.includes(t.key) && <span className="text-white text-xs">✓</span>}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">{t.label}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ปุ่ม Excel */}
      <button onClick={handleExport}
        disabled={loading||!start||!end||selectedVarieties.length===0||exportTypes.length===0}
        className="w-full bg-green-700 text-white py-4 rounded-xl font-black text-lg hover:bg-green-800 disabled:opacity-50 shadow-lg transition">
        {loading?'⏳ กำลัง Export...':`📗 Download Excel (${exportTypes.length} รูปแบบ, ${selectedVarieties.length} พันธุ์)`}
      </button>

      {/* ปุ่ม CSV */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="font-black text-blue-700 mb-1">📋 Download CSV</p>
        <p className="text-xs text-blue-500 mb-3">ข้อมูลทุก section รวมไฟล์เดียว เปิดได้ใน Excel ทันที ไม่มีปัญหาโหลด</p>
        <button onClick={handleDownloadCSV}
          disabled={csvLoading||!start||!end||selectedVarieties.length===0}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition">
          {csvLoading?'⏳ กำลัง Export...':'⬇️ Download CSV'}
        </button>
      </div>

      <p className="text-xs text-gray-400 text-center">ระบบดึงเฉพาะข้อมูลที่เลือก ประหยัด Firestore reads</p>
    </div>
  );
}