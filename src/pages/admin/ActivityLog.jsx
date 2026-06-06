import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, startAfter, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';

const ACTION_LABELS = {
  receive:          { label: 'รับข้าวเข้า',      icon: '📥', color: 'bg-green-100 text-green-700' },
  edit_lot:         { label: 'แก้ไขล็อต',         icon: '✏️', color: 'bg-yellow-100 text-yellow-700' },
  sort:             { label: 'คัดแยกข้าว',        icon: '✂️', color: 'bg-blue-100 text-blue-700' },
  edit_processing:  { label: 'แก้ไขการคัด',       icon: '✏️', color: 'bg-yellow-100 text-yellow-700' },
  sale:             { label: 'ขายออก',            icon: '📤', color: 'bg-orange-100 text-orange-700' },
  approve_sale:     { label: 'อนุมัติขาย',        icon: '✅', color: 'bg-green-100 text-green-700' },
  reject_sale:      { label: 'ปฏิเสธขาย',        icon: '❌', color: 'bg-red-100 text-red-700' },
  claim:            { label: 'บันทึกเคลม',        icon: '🔄', color: 'bg-purple-100 text-purple-700' },
};

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const PAGE_SIZE = 20;

  const get3MonthsAgo = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return Timestamp.fromDate(d);
  };

  useEffect(() => {
    const q = query(
      collection(db, 'activityLog'),
      where('at', '>=', get3MonthsAgo()),
      orderBy('at', 'desc'),
      limit(PAGE_SIZE)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const loadMore = async () => {
    if (!lastDoc) return;
    const q = query(
      collection(db, 'activityLog'),
      where('at', '>=', get3MonthsAgo()),
      orderBy('at', 'desc'),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );
    const snap = await getDocs(q);
    setLogs(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
    setLastDoc(snap.docs[snap.docs.length - 1]);
    setHasMore(snap.docs.length === PAGE_SIZE);
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('th-TH', {
      day: '2-digit', month: 'short', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const renderDetail = (log) => {
    switch (log.action) {
      case 'receive':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>🌾 {log.riceVariety} | ⚖️ {log.receivedTons} ตัน</p>
            <p>🏷️ แท็ก: {log.tagCode || '-'} | 👤 {log.farmerName || '-'}</p>
            <p>📦 ล็อต: {log.lotCode}</p>
          </div>
        );
      case 'edit_lot':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>📦 ล็อต: {log.lotCode}</p>
            {log.changes?.tagCode && <p>🏷️ แท็ก: {log.changes.tagCode.from} → <b className="text-blue-600">{log.changes.tagCode.to}</b></p>}
            {log.changes?.riceVariety && <p>🌾 พันธุ์: {log.changes.riceVariety.from} → <b className="text-green-600">{log.changes.riceVariety.to}</b></p>}
            {log.changes?.receivedTons && <p>⚖️ ตัน: {log.changes.receivedTons.from} → <b>{log.changes.receivedTons.to}</b></p>}
            {log.note && log.note !== '-' && <p>💬 {log.note}</p>}
          </div>
        );
      case 'sort':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>📦 ล็อต: {log.lotCode} รอบที่ {log.round}</p>
            <p>🏷️ แท็ก: {log.tagCode}</p>
            <p>🌾 {log.originalVariety}
              {log.varietyChanged && <span className="text-orange-500"> → {log.newVariety}</span>}
            </p>
            <p>⚖️ {log.inputTons} ตัน → 📦 {log.outputBags} กระสอบ</p>
          </div>
        );
      case 'edit_processing':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>📦 ล็อต: {log.lotCode} รอบที่ {log.round}</p>
            {log.changes?.tagCode && <p>🏷️ แท็ก: {log.changes.tagCode.from} → <b className="text-blue-600">{log.changes.tagCode.to}</b></p>}
            {log.changes?.variety && <p>🌾 พันธุ์: {log.changes.variety.from} → <b className="text-green-600">{log.changes.variety.to}</b></p>}
            {log.changes?.outputBags && <p>📦 กระสอบ: {log.changes.outputBags.from} → <b>{log.changes.outputBags.to}</b></p>}
            {log.note && log.note !== '-' && <p>💬 {log.note}</p>}
          </div>
        );
      case 'sale':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>🆔 {log.saleId} | 👤 {log.buyerName}</p>
            {log.items?.map((item, i) => (
              <p key={i}>🌾 {item.riceVariety} — {item.bags} กระสอบ</p>
            ))}
            <p>📦 รวม {log.totalBags} กระสอบ</p>
            {log.note && log.note !== '-' && <p>💬 {log.note}</p>}
          </div>
        );
      case 'approve_sale':
      case 'reject_sale':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>🆔 {log.saleId}</p>
            {log.buyerName && <p>👤 {log.buyerName}</p>}
            {log.riceVariety && <p>🌾 {log.riceVariety}</p>}
            {log.bags && <p>📦 {log.bags} กระสอบ</p>}
          </div>
        );
      case 'claim':
        return (
          <div className="text-xs text-gray-500 space-y-0.5 mt-1">
            <p>🆔 อ้างอิง: {log.saleId}</p>
            <p>🌾 {log.riceVariety}</p>
            <p>📦 เคลม {log.claimBags} จาก {log.saleBags} กระสอบ ({log.claimPercent}%)</p>
            <p>📋 สาเหตุ: {log.reason}</p>
            {log.note && log.note !== '-' && <p>💬 {log.note}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  const filteredLogs = filterAction === 'all'
    ? logs
    : logs.filter(l => l.action === filterAction);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400">กำลังโหลด...</p>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-700">📋 Activity Log</h2>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          ย้อนหลัง 3 เดือน
        </span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { key: 'all', label: 'ทั้งหมด' },
          { key: 'receive', label: '📥 รับเข้า' },
          { key: 'sort', label: '✂️ คัดแยก' },
          { key: 'sale', label: '📤 ขาย' },
          { key: 'approve_sale', label: '✅ อนุมัติ' },
          { key: 'claim', label: '🔄 เคลม' },
          { key: 'edit_lot', label: '✏️ แก้ไข' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterAction(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              filterAction === f.key ? 'bg-green-700 text-white' : 'bg-white text-gray-600 border'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {filteredLogs.length === 0 ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-gray-400">ไม่มีกิจกรรม</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {filteredLogs.map(log => {
              const action = ACTION_LABELS[log.action] || {
                label: log.action, icon: '📋', color: 'bg-gray-100 text-gray-600'
              };
              return (
                <div key={log.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ${action.color}`}>
                      {action.icon} {action.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 font-bold">{log.byName}</p>
                      {renderDetail(log)}
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                      {formatDate(log.at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button onClick={loadMore}
              className="w-full mt-4 py-3 bg-white border rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
              โหลดเพิ่มเติม...
            </button>
          )}
        </>
      )}
    </div>
  );
}