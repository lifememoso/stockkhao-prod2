import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, deleteDoc, updateDoc,
  addDoc, query, where, Timestamp, getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateVarietySummary, toSummaryId } from '../../utils/summary';

export default function DataManager() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('lots');
  const [lots, setLots] = useState([]);
  const [processing, setProcessing] = useState([]);
  const [sales, setSales] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [lotsSnap, procSnap, salesSnap, claimsSnap] = await Promise.all([
        getDocs(collection(db, 'lots')),
        getDocs(collection(db, 'processing')),
        getDocs(collection(db, 'sales')),
        getDocs(collection(db, 'claims')),
      ]);
      setLots(lotsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
      setProcessing(procSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
      setSales(salesSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
      setClaims(claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  // ===== ลบ Claims ของ Sale =====
  const deleteClaimsBySaleId = async (saleId) => {
    const q = query(collection(db, 'claims'), where('saleId', '==', saleId));
    const snap = await getDocs(q);
    for (const d of snap.docs) await deleteDoc(doc(db, 'claims', d.id));
  };

  // ===== ลบ Sale + rollback + ลบ claims =====
  const deleteSaleWithCascade = async (sale) => {
    // rollback soldBags ถ้า approved
    if (sale.status === 'approved') {
      const items = sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }];
      for (const item of items) {
        await updateVarietySummary(item.riceVariety, { deltaSoldBags: -(item.bags || 0) });
      }
    }
    // ลบ claims ของ sale นี้
    await deleteClaimsBySaleId(sale.id);
    // ลบ sale
    await deleteDoc(doc(db, 'sales', sale.id));
  };

  // ===== ลบ Processing + rollback + cascade =====
  const deleteProcessingWithCascade = async (proc) => {
    // rollback summary
    await updateVarietySummary(proc.newVariety || proc.originalVariety, {
      deltaBags: -(proc.outputBags || 0),
      deltaTons: -(proc.inputTons || 0),
    });
    // คืน tons กลับ lot
    const lotRef = doc(db, 'lots', proc.lotId);
    const lotSnap = await getDoc(lotRef);
    if (lotSnap.exists()) {
      const currentTons = lotSnap.data().receivedTons || 0;
      await updateDoc(lotRef, {
        receivedTons: parseFloat((currentTons + (proc.inputTons || 0)).toFixed(2)),
        status: 'open',
      });
    }
    // หา sales ที่เกี่ยวกับ lot นี้แล้วลบ cascade
    const salesQ = query(collection(db, 'sales'), where('lotId', '==', proc.lotId));
    const salesSnap = await getDocs(salesQ);
    // ถ้าไม่มี lotId ใน sale ให้ข้ามไป (sale อาจไม่ได้เก็บ lotId)
    for (const s of salesSnap.docs) {
      await deleteSaleWithCascade({ id: s.id, ...s.data() });
    }
    // ลบ processing
    await deleteDoc(doc(db, 'processing', proc.id));
  };

  // ===== ลบ Lot + cascade ทุกอย่าง =====
  const handleDeleteLot = async (lot) => {
    setLoading(true);
    try {
      const now = new Date();
      // หา processing ทั้งหมดของ lot นี้
      const procQ = query(collection(db, 'processing'), where('lotId', '==', lot.id));
      const procSnap = await getDocs(procQ);
      for (const p of procSnap.docs) {
        const proc = { id: p.id, ...p.data() };
        // rollback summary
        await updateVarietySummary(proc.newVariety || proc.originalVariety, {
          deltaBags: -(proc.outputBags || 0),
          deltaTons: -(proc.inputTons || 0),
        });
        await deleteDoc(doc(db, 'processing', p.id));
      }
      // หา sales ที่เกี่ยวกับ lot (ถ้ามี lotId field)
      const salesQ = query(collection(db, 'sales'), where('lotId', '==', lot.id));
      const salesSnap = await getDocs(salesQ);
      for (const s of salesSnap.docs) {
        await deleteSaleWithCascade({ id: s.id, ...s.data() });
      }
      // ลบ lot
      await deleteDoc(doc(db, 'lots', lot.id));
      await addDoc(collection(db, 'activityLog'), {
        action: 'delete_lot', lotCode: lot.lotCode,
        note: 'ลบโดย Admin (cascade)', by: user.uid, byName: user.name, at: now,
      });
      setMessage({ type: 'success', text: `✅ ลบ Lot ${lot.lotCode} และรายการที่เกี่ยวข้องสำเร็จ` });
      fetchAll();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  // ===== ลบ Processing =====
  const handleDeleteProcessing = async (proc) => {
    setLoading(true);
    try {
      const now = new Date();
      await deleteProcessingWithCascade(proc);
      await addDoc(collection(db, 'activityLog'), {
        action: 'delete_processing', lotCode: proc.lotCode, tagCode: proc.tagCode,
        note: 'ลบโดย Admin (cascade)', by: user.uid, byName: user.name, at: now,
      });
      setMessage({ type: 'success', text: `✅ ลบการคัดแยก ${proc.tagCode} และรายการที่เกี่ยวข้องสำเร็จ` });
      fetchAll();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  // ===== ลบ Sale =====
  const handleDeleteSale = async (sale) => {
    setLoading(true);
    try {
      const now = new Date();
      await deleteSaleWithCascade(sale);
      await addDoc(collection(db, 'activityLog'), {
        action: 'delete_sale', saleCode: sale.saleId, buyerName: sale.buyerName,
        note: 'ลบโดย Admin (cascade)', by: user.uid, byName: user.name, at: now,
      });
      setMessage({ type: 'success', text: `✅ ลบ Sale ${sale.saleId} และเคลมที่เกี่ยวข้องสำเร็จ` });
      fetchAll();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  // ===== ลบ Claim =====
  const handleDeleteClaim = async (claim) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'claims', claim.id));
      await addDoc(collection(db, 'activityLog'), {
        action: 'delete_claim', saleCode: claim.saleCode,
        note: 'ลบโดย Admin', by: user.uid, byName: user.name, at: new Date(),
      });
      setMessage({ type: 'success', text: `✅ ลบการเคลมสำเร็จ` });
      fetchAll();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  const confirmDeleteAction = () => {
    const { item, type } = confirmDelete;
    if (type === 'lot') handleDeleteLot(item);
    else if (type === 'processing') handleDeleteProcessing(item);
    else if (type === 'sale') handleDeleteSale(item);
    else if (type === 'claim') handleDeleteClaim(item);
  };

  const tabs = [
    { key: 'lots', label: '📥 รับเข้า', count: lots.length },
    { key: 'processing', label: '✂️ คัดแยก', count: processing.length },
    { key: 'sales', label: '💰 ขาย', count: sales.length },
    { key: 'claims', label: '📋 เคลม', count: claims.length },
  ];

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">✅ อนุมัติ</span>;
    if (s === 'pending') return <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">⏳ รอ</span>;
    if (s === 'rejected') return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">❌ ปฏิเสธ</span>;
    return null;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-black text-gray-800">🗂️ จัดการข้อมูล</h2>
        <p className="text-sm text-gray-400 mt-1">ลบรายการ — ระบบจะ cascade ลบและ rollback ค่าที่เกี่ยวข้องทั้งหมดอัตโนมัติ</p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-xl font-black text-red-600 mb-2">⚠️ ยืนยันการลบ</p>
            <p className="text-gray-600 text-sm mb-3">การลบจะ <strong>cascade ไปทุกจุดที่เกี่ยวข้อง</strong> และไม่สามารถย้อนกลับได้</p>
            <div className="bg-red-50 rounded-lg p-3 mb-4 text-sm text-red-700 space-y-1">
              {confirmDelete.type === 'lot' && <>
                <p>🗑️ ลบ Lot: <b>{confirmDelete.item.lotCode}</b></p>
                <p className="text-xs">→ ลบการคัดแยกทั้งหมด + rollback summary</p>
                <p className="text-xs">→ ลบการขายที่เกี่ยวข้อง + rollback soldBags</p>
                <p className="text-xs">→ ลบเคลมที่เกี่ยวข้องทั้งหมด</p>
              </>}
              {confirmDelete.type === 'processing' && <>
                <p>🗑️ ลบการคัดแยก: <b>{confirmDelete.item.tagCode}</b></p>
                <p className="text-xs">→ rollback totalBags/totalTons ใน summary</p>
                <p className="text-xs">→ คืน tons กลับไปที่ Lot</p>
                <p className="text-xs">→ ลบการขายที่เกี่ยวข้อง + rollback soldBags</p>
                <p className="text-xs">→ ลบเคลมที่เกี่ยวข้อง</p>
              </>}
              {confirmDelete.type === 'sale' && <>
                <p>🗑️ ลบ Sale: <b>{confirmDelete.item.saleId}</b></p>
                <p className="text-xs">→ rollback soldBags ใน summary (ถ้า approved)</p>
                <p className="text-xs">→ ลบเคลมที่เกี่ยวข้องทั้งหมด</p>
              </>}
              {confirmDelete.type === 'claim' && <>
                <p>🗑️ ลบการเคลม: <b>{confirmDelete.item.saleCode}</b></p>
              </>}
            </div>
            <div className="flex gap-3">
              <button onClick={confirmDeleteAction} disabled={loading}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '🗑️ ลบเลย'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition ${tab === t.key ? 'bg-green-700 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {t.label} <span className="opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-8">⏳ กำลังโหลด...</p>}

      {/* LOTS */}
      {tab === 'lots' && (
        <div className="space-y-3">
          {lots.map(lot => (
            <div key={lot.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-orange-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${lot.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                      {lot.status === 'open' ? '⏳ รอคัด' : '✅ คัดแล้ว'}
                    </span>
                    <span className="font-bold text-sm">{lot.lotCode}</span>
                  </div>
                  <p className="text-sm font-bold text-green-700">🌾 {lot.riceVariety}</p>
                  <p className="text-sm text-gray-500">🏷️ {lot.tagCode || '-'} | 👤 {lot.farmerName}</p>
                  <p className="text-sm text-gray-500">⚖️ {lot.receivedTons} ตัน | 📅 {lot.receivedDate}</p>
                </div>
                <button onClick={() => setConfirmDelete({ item: lot, type: 'lot' })}
                  className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-200 ml-2">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
          {lots.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีข้อมูล</p>}
        </div>
      )}

      {/* PROCESSING */}
      {tab === 'processing' && (
        <div className="space-y-3">
          {processing.map(proc => (
            <div key={proc.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">รอบ {proc.round}</span>
                    <span className="font-bold text-sm">{proc.lotCode}</span>
                  </div>
                  <p className="text-sm font-bold text-blue-700">🏷️ {proc.tagCode}</p>
                  <p className="text-sm text-gray-600">🌾 {proc.newVariety}</p>
                  <p className="text-sm text-gray-500">⚖️ {proc.inputTons} ตัน → 📦 {proc.outputBags} กระสอบ | 📅 {proc.sortingDate || '-'}</p>
                </div>
                <button onClick={() => setConfirmDelete({ item: proc, type: 'processing' })}
                  className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-200 ml-2">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
          {processing.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีข้อมูล</p>}
        </div>
      )}

      {/* SALES */}
      {tab === 'sales' && (
        <div className="space-y-3">
          {sales.map(sale => (
            <div key={sale.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-green-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {statusBadge(sale.status)}
                    <span className="font-bold text-sm">{sale.saleId}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-700">👤 {sale.buyerName}</p>
                  {(sale.items || []).map((item, i) => (
                    <p key={i} className="text-sm text-gray-600">🌾 {item.riceVariety} — {item.bags} กระสอบ</p>
                  ))}
                  {!sale.items && <p className="text-sm text-gray-600">🌾 {sale.riceVariety} — {sale.totalBags} กระสอบ</p>}
                  <p className="text-sm text-gray-500">📅 {sale.saleDate} | บันทึกโดย: {sale.createdByName}</p>
                </div>
                <button onClick={() => setConfirmDelete({ item: sale, type: 'sale' })}
                  className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-200 ml-2">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
          {sales.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีข้อมูล</p>}
        </div>
      )}

      {/* CLAIMS */}
      {tab === 'claims' && (
        <div className="space-y-3">
          {claims.map(claim => (
            <div key={claim.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-purple-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">🔄 เคลม</span>
                    <span className="font-bold text-sm">{claim.saleCode}</span>
                  </div>
                  <p className="text-sm text-gray-600">👤 {claim.buyerName}</p>
                  <p className="text-sm text-gray-600">🌾 {claim.riceVariety} | 📦 {claim.claimBags} กระสอบ ({claim.claimPercent}%)</p>
                  <p className="text-sm text-gray-600">📋 {claim.reason} | 📅 {claim.claimDate}</p>
                </div>
                <button onClick={() => setConfirmDelete({ item: claim, type: 'claim' })}
                  className="bg-red-100 text-red-600 px-3 py-2 rounded-lg font-bold text-xs hover:bg-red-200 ml-2">
                  🗑️ ลบ
                </button>
              </div>
            </div>
          ))}
          {claims.length === 0 && <p className="text-center text-gray-400 py-8">ไม่มีข้อมูล</p>}
        </div>
      )}
    </div>
  );
}