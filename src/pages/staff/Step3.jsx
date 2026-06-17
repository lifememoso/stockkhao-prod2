import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  Timestamp, query, where, runTransaction
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateVarietySummary, toSummaryId, computeSummaryUpdate } from '../../utils/summary';

export default function Step3() {
  const { user } = useAuthStore();
  const [tags, setTags] = useState([]); // รายการใบแท็กพร้อมขาย (จาก processing)
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [showSales, setShowSales] = useState(true);

  const [buyerInfo, setBuyerInfo] = useState({
    buyerName: '', buyerPhone: '', note: '',
    saleDate: new Date().toISOString().slice(0, 10),
  });
  // item ตอนนี้ผูกกับใบแท็ก: { tagCode, variety, bags }
  const [items, setItems] = useState([{ tagCode: '', variety: '', bags: '' }]);

  useEffect(() => {
    fetchTagsWithRemaining();
    fetchSales();
  }, []);

  // ดึงรายการคัดแยกทั้งหมด (processing) + รวมจำนวนที่ถูก "จอง" ไว้แล้วจาก sales (pending+approved)
  // เพื่อคำนวณว่าแต่ละใบแท็กเหลือขายได้กี่กระสอบ
  const fetchTagsWithRemaining = async () => {
    try {
      const procSnap = await getDocs(collection(db, 'processing'));
      const processingList = procSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const salesSnap = await getDocs(collection(db, 'sales'));
      const allSales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // รวมจำนวนกระสอบที่ "จองไว้แล้ว" ต่อ tagCode (นับ pending + approved เท่านั้น)
      const reservedByTag = {};
      for (const sale of allSales) {
        if (sale.status === 'rejected') continue;
        const saleItems = sale.items || [];
        for (const it of saleItems) {
          if (!it.tagCode) continue;
          reservedByTag[it.tagCode] = (reservedByTag[it.tagCode] || 0) + (it.bags || 0);
        }
      }

      const tagsWithRemaining = processingList.map(p => {
        const reserved = reservedByTag[p.tagCode] || 0;
        const remaining = (p.outputBags || 0) - reserved;
        return {
          tagCode: p.tagCode,
          variety: p.newVariety,
          outputBags: p.outputBags || 0,
          remaining,
          lotCode: p.lotCode,
        };
      }).filter(t => t.tagCode); // ต้องมีเลขใบแท็ก

      setTags(tagsWithRemaining);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSales = async () => {
    const snap = await getDocs(collection(db, 'sales'));
    setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
  };

  const resetForm = () => {
    setBuyerInfo({ buyerName: '', buyerPhone: '', note: '', saleDate: new Date().toISOString().slice(0, 10) });
    setItems([{ tagCode: '', variety: '', bags: '' }]);
    setEditingSale(null);
    setShowForm(false);
  };

  const addItem = () => setItems([...items, { tagCode: '', variety: '', bags: '' }]);
  const removeItem = (i) => { if (items.length > 1) setItems(items.filter((_, idx) => idx !== i)); };

  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i][field] = value;
    // ถ้าเปลี่ยนใบแท็ก ให้ auto-fill พันธุ์ข้าวตามแท็กนั้น
    if (field === 'tagCode') {
      const tag = tags.find(t => t.tagCode === value);
      updated[i].variety = tag ? tag.variety : '';
    }
    setItems(updated);
  };

  // เหลือขายได้กี่กระสอบสำหรับแท็กนี้ (กันการนับจำนวนเดิมของ sale ที่กำลังแก้ไขซ้ำ)
  const getRemainingForTag = (tagCode, currentIndex) => {
    const tag = tags.find(t => t.tagCode === tagCode);
    if (!tag) return 0;
    let remaining = tag.remaining;
    // ถ้ากำลังแก้ไข sale เดิม ต้องคืนจำนวนเดิมของ sale นี้กลับเข้าไปก่อน (เพราะถูกหักไปแล้วตอนคำนวณ reservedByTag)
    if (editingSale) {
      const oldItem = (editingSale.items || []).find(i => i.tagCode === tagCode);
      if (oldItem) remaining += (oldItem.bags || 0);
    }
    // ไม่หักจำนวนที่ผู้ใช้กำลังกรอกอยู่ในรายการอื่นที่ใช้แท็กเดียวกันในฟอร์มเดียวกันนี้
    items.forEach((it, idx) => {
      if (idx !== currentIndex && it.tagCode === tagCode) {
        remaining -= (parseInt(it.bags) || 0);
      }
    });
    return remaining;
  };

  const totalBags = items.reduce((sum, item) => sum + (parseInt(item.bags) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!buyerInfo.buyerName) { setMessage({ type: 'error', text: 'กรุณากรอกชื่อผู้ซื้อ' }); return; }
    if (items.some(i => !i.tagCode || !i.variety || !i.bags || parseInt(i.bags) <= 0)) {
      setMessage({ type: 'error', text: 'กรุณาเลือกใบแท็กและกรอกจำนวนกระสอบให้ครบ' }); return;
    }
    // ตรวจไม่ให้ขายเกินจำนวนคงเหลือของแต่ละใบแท็ก
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const remaining = getRemainingForTag(item.tagCode, idx);
      const requestedBags = parseInt(item.bags) || 0;
      if (requestedBags > remaining) {
        setMessage({ type: 'error', text: `ใบแท็ก ${item.tagCode} เหลือขายได้แค่ ${remaining} กระสอบ (กรอกเกิน)` });
        return;
      }
    }

    setLoading(true);
    try {
      const now = Timestamp.now();
      const newItemsData = items.map(i => ({ tagCode: i.tagCode, riceVariety: i.variety, bags: parseInt(i.bags) }));

      if (editingSale) {
        const saleRef = doc(db, 'sales', editingSale.id);

        if (editingSale.status === 'approved') {
          /**
           * แก้ไข sale ที่ approved แล้ว — ต้อง rollback ของเก่า + เพิ่มของใหม่
           * รวมเป็น transaction เดียว โดยคำนวณ "net delta" ต่อพันธุ์ในหน่วยความจำก่อน
           * (ถ้าพันธุ์เดิมกับพันธุ์ใหม่ซ้ำกัน จะหักลบกันเองในตัวแปรนี้ ไม่ใช่อ่าน-เขียน summary doc ซ้ำสองรอบ)
           */
          const oldItems = editingSale.items || [{ riceVariety: editingSale.riceVariety, bags: editingSale.totalBags }];

          const deltasByVariety = {}; // summaryId -> { variety, deltaSoldBags }
          const ensureDelta = (variety) => {
            const id = toSummaryId(variety);
            if (!deltasByVariety[id]) deltasByVariety[id] = { variety, deltaSoldBags: 0 };
            return deltasByVariety[id];
          };

          for (const item of oldItems) {
            if (!item.riceVariety) continue;
            ensureDelta(item.riceVariety).deltaSoldBags -= (item.bags || 0);
          }
          for (const item of newItemsData) {
            if (!item.riceVariety) continue;
            ensureDelta(item.riceVariety).deltaSoldBags += (item.bags || 0);
          }

          const summaryRefs = Object.entries(deltasByVariety).map(([id, v]) => ({
            id, variety: v.variety, deltaSoldBags: v.deltaSoldBags, ref: doc(db, 'summaryByVariety', id),
          }));

          await runTransaction(db, async (transaction) => {
            // อ่านทั้งหมดก่อน
            const summarySnaps = {};
            for (const s of summaryRefs) {
              const snap = await transaction.get(s.ref);
              summarySnaps[s.id] = snap.exists() ? snap.data() : null;
            }

            // เขียนทั้งหมดทีหลัง
            for (const s of summaryRefs) {
              const updated = computeSummaryUpdate(s.variety, summarySnaps[s.id], { deltaSoldBags: s.deltaSoldBags });
              transaction.set(s.ref, updated);
            }

            transaction.update(saleRef, {
              saleDate: buyerInfo.saleDate,
              buyerName: buyerInfo.buyerName,
              buyerPhone: buyerInfo.buyerPhone || '-',
              note: buyerInfo.note || '',
              items: newItemsData,
              riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
              totalBags,
              updatedBy: user.name,
              updatedAt: now,
            });
          });
        } else {
          // ยังไม่ approved — ไม่ต้องแตะ summary เลย แก้แค่ document ตรงๆ
          await updateDoc(saleRef, {
            saleDate: buyerInfo.saleDate,
            buyerName: buyerInfo.buyerName,
            buyerPhone: buyerInfo.buyerPhone || '-',
            note: buyerInfo.note || '',
            items: newItemsData,
            riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
            totalBags,
            updatedBy: user.name,
            updatedAt: now,
          });
        }
        setMessage({ type: 'success', text: '✅ แก้ไขสำเร็จ!' });
      } else {
        // สร้างใหม่ — ยังไม่กระทบ summary (รอ Admin approve ก่อนค่อยมีผล) ไม่ต้องใช้ transaction
        const saleId = `SALE-${Date.now().toString().slice(-6)}`;
        await addDoc(collection(db, 'sales'), {
          saleId, saleDate: buyerInfo.saleDate,
          buyerName: buyerInfo.buyerName, buyerPhone: buyerInfo.buyerPhone || '-',
          note: buyerInfo.note || '',
          items: newItemsData,
          riceVariety: items.length === 1 ? items[0].variety : 'หลายพันธุ์',
          totalBags, status: 'pending',
          createdBy: user.uid, createdByName: user.name, createdAt: now,
        });
        await addDoc(collection(db, 'activityLog'), {
          action: 'sale', saleId, saleDate: buyerInfo.saleDate,
          buyerName: buyerInfo.buyerName,
          items: newItemsData,
          totalBags, by: user.uid, byName: user.name, at: now,
        });
        setMessage({ type: 'success', text: `✅ บันทึกสำเร็จ! รวม ${totalBags} กระสอบ (รอ Admin ยืนยัน)` });
      }
      resetForm();
      fetchSales();
      fetchTagsWithRemaining();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleEdit = (sale) => {
    setEditingSale(sale);
    setBuyerInfo({
      buyerName: sale.buyerName,
      buyerPhone: sale.buyerPhone || '',
      note: sale.note || '',
      saleDate: sale.saleDate,
    });
    setItems(sale.items
      ? sale.items.map(i => ({ tagCode: i.tagCode || '', variety: i.riceVariety, bags: i.bags.toString() }))
      : [{ tagCode: '', variety: sale.riceVariety, bags: sale.totalBags.toString() }]
    );
    setShowForm(true);
    window.scrollTo(0, 0);
  };

  /**
   * ลบ sale — รวมเป็น transaction เดียว:
   * - ถ้า approved แล้ว ให้ rollback soldBags ของทุกพันธุ์ใน items
   * - ลบ claims ที่ผูกกับ sale นี้
   * - ลบ sale เอง
   * ถ้าพังกลางทาง จะไม่มีอะไรถูกลบ/แก้เลย (all-or-nothing)
   */
  const handleDelete = async (sale) => {
    setLoading(true);
    try {
      // query หา claims ก่อน (นอก transaction เพราะมี where)
      const claimsQ = query(collection(db, 'claims'), where('saleId', '==', sale.id));
      const claimsSnap = await getDocs(claimsQ);
      const claimRefs = claimsSnap.docs.map(d => d.ref);

      const saleItems = sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }];
      const saleRef = doc(db, 'sales', sale.id);

      if (sale.status === 'approved') {
        // รวม delta ต่อพันธุ์ (เผื่อ items มีพันธุ์ซ้ำกัน)
        const deltasByVariety = {};
        const ensureDelta = (variety) => {
          const id = toSummaryId(variety);
          if (!deltasByVariety[id]) deltasByVariety[id] = { variety, deltaSoldBags: 0 };
          return deltasByVariety[id];
        };
        for (const item of saleItems) {
          if (!item.riceVariety) continue;
          ensureDelta(item.riceVariety).deltaSoldBags -= (item.bags || 0);
        }
        const summaryRefs = Object.entries(deltasByVariety).map(([id, v]) => ({
          id, variety: v.variety, deltaSoldBags: v.deltaSoldBags, ref: doc(db, 'summaryByVariety', id),
        }));

        await runTransaction(db, async (transaction) => {
          // อ่านทั้งหมดก่อน
          const summarySnaps = {};
          for (const s of summaryRefs) {
            const snap = await transaction.get(s.ref);
            summarySnaps[s.id] = snap.exists() ? snap.data() : null;
          }

          // เขียนทั้งหมดทีหลัง
          for (const s of summaryRefs) {
            const updated = computeSummaryUpdate(s.variety, summarySnaps[s.id], { deltaSoldBags: s.deltaSoldBags });
            transaction.set(s.ref, updated);
          }
          for (const ref of claimRefs) {
            transaction.delete(ref);
          }
          transaction.delete(saleRef);
        });
      } else {
        // ยังไม่ approved — ไม่ต้องแตะ summary เลย ลบ claims + sale ใน transaction เดียวพอ
        await runTransaction(db, async (transaction) => {
          for (const ref of claimRefs) {
            transaction.delete(ref);
          }
          transaction.delete(saleRef);
        });
      }

      setMessage({ type: 'success', text: '✅ ลบสำเร็จ!' });
      fetchSales();
      fetchTagsWithRemaining();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  const statusBadge = (s) => {
    if (s === 'approved') return <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">✅ อนุมัติแล้ว</span>;
    if (s === 'rejected') return <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">❌ ปฏิเสธ</span>;
    return <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-bold">⏳ รอ Admin</span>;
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

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-xl font-black text-red-600 mb-2">⚠️ ยืนยันการลบ</p>
            <p className="text-gray-600 text-sm mb-3">ลบ <b>{confirmDelete.saleId}</b> — {confirmDelete.buyerName}</p>
            {confirmDelete.status === 'approved' && (
              <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded-lg mb-3">⚠️ Sale นี้ approved แล้ว จะ rollback soldBags อัตโนมัติ (ธุรกรรมเดียว)</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => handleDelete(confirmDelete)} disabled={loading}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '🗑️ ลบเลย'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* ปุ่มเพิ่มรายการใหม่ */}
      {!showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full mb-6 bg-green-600 text-white py-3 rounded-xl font-black text-base hover:bg-green-700 transition">
          ➕ บันทึกการขายใหม่
        </button>
      )}

      {/* FORM */}
      {showForm && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-gray-800">
              {editingSale ? `✏️ แก้ไข ${editingSale.saleId}` : '➕ บันทึกการขายใหม่'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 text-2xl">✕</button>
          </div>

          {editingSale?.status === 'approved' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-xs text-yellow-700">
              ⚠️ Sale นี้ approved แล้ว การแก้ไขจะ rollback และคำนวณ summary ใหม่อัตโนมัติ (ธุรกรรมเดียว)
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="font-black text-gray-800 text-base mb-4">🌾 รายการสินค้า</h3>
              <div className="space-y-4">
                {items.map((item, index) => {
                  const remaining = item.tagCode ? getRemainingForTag(item.tagCode, index) : null;
                  return (
                    <div key={index} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-gray-600 text-sm">รายการที่ {index + 1}</span>
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(index)}
                            className="text-red-400 hover:text-red-600 font-bold text-sm">✕ ลบ</button>
                        )}
                      </div>
                      <div className="mb-3">
                        <label className="text-sm text-gray-700 font-bold block mb-1">🏷️ เลขใบแท็ก *</label>
                        <select value={item.tagCode} onChange={e => updateItem(index, 'tagCode', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500">
                          <option value="">-- เลือกใบแท็ก --</option>
                          {tags.map(t => (
                            <option key={t.tagCode} value={t.tagCode} disabled={t.remaining <= 0 && t.tagCode !== item.tagCode}>
                              {t.tagCode} — {t.variety} (เหลือ {t.remaining} กระสอบ)
                            </option>
                          ))}
                        </select>
                      </div>
                      {item.variety && (
                        <p className="text-xs text-green-700 font-bold mb-3">🌾 พันธุ์: {item.variety}</p>
                      )}
                      <div>
                        <label className="text-sm text-gray-700 font-bold block mb-1">
                          📦 จำนวนกระสอบ *
                          {remaining !== null && (
                            <span className="text-xs text-blue-500 font-normal ml-1">(เหลือขายได้ {remaining} กระสอบ)</span>
                          )}
                        </label>
                        <input type="number" value={item.bags} onChange={e => updateItem(index, 'bags', e.target.value)}
                          placeholder="เช่น 50" max={remaining ?? undefined}
                          className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
                        {remaining !== null && parseInt(item.bags) > remaining && (
                          <p className="text-xs text-red-500 font-bold mt-1">⚠️ เกินจำนวนคงเหลือของใบแท็กนี้</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={addItem}
                className="mt-4 w-full border-2 border-dashed border-green-400 text-green-600 py-3 rounded-xl font-bold hover:bg-green-50 transition">
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
                <label className="text-base text-gray-800 font-bold block mb-2">👤 ชื่อผู้ซื้อ/ร้านค้า *</label>
                <input type="text" value={buyerInfo.buyerName}
                  onChange={e => setBuyerInfo({...buyerInfo, buyerName: e.target.value})}
                  placeholder="เช่น วีระพล พันธุ์ข้าว"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📱 เบอร์โทร</label>
                <input type="tel" value={buyerInfo.buyerPhone}
                  onChange={e => setBuyerInfo({...buyerInfo, buyerPhone: e.target.value})}
                  placeholder="เบอร์โทรผู้ซื้อ"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📅 วันที่ขาย *</label>
                <input type="date" value={buyerInfo.saleDate}
                  onChange={e => setBuyerInfo({...buyerInfo, saleDate: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-base text-gray-800 font-bold block mb-2">📝 หมายเหตุ</label>
                <textarea value={buyerInfo.note}
                  onChange={e => setBuyerInfo({...buyerInfo, note: e.target.value})}
                  placeholder="บันทึกเพิ่มเติม..." rows="3"
                  className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500" />
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50 transition shadow-lg">
              {loading ? '⏳ กำลังบันทึก...' : editingSale ? '✅ บันทึกการแก้ไข' : '✅ ยืนยันการขาย'}
            </button>

            {!editingSale && (
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
                <p className="text-yellow-700 font-semibold text-sm">⚠️ แจ้งเตือน</p>
                <p className="text-yellow-600 text-sm mt-1">การขายของ Staff จะต้องรอ Admin ยืนยันก่อน</p>
              </div>
            )}
          </form>
        </div>
      )}

      {/* รายการที่บันทึกแล้ว */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <button onClick={() => setShowSales(!showSales)}
          className="w-full flex justify-between items-center p-4 hover:bg-gray-50 transition">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-800">📋 รายการขายที่บันทึกแล้ว</h3>
            <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{sales.length}</span>
          </div>
          <span className="text-gray-400 text-xl">{showSales ? '▲' : '▼'}</span>
        </button>

        {showSales && (
          <div className="px-4 pb-4 space-y-3">
            {sales.length === 0 ? (
              <p className="text-center text-gray-400 py-8">ยังไม่มีรายการขาย</p>
            ) : (
              sales.map(sale => (
                <div key={sale.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {statusBadge(sale.status)}
                        <span className="font-bold text-gray-700 text-sm">{sale.saleId}</span>
                      </div>
                      <p className="text-sm font-bold text-gray-700">👤 {sale.buyerName}</p>
                      {(sale.items || []).map((item, i) => (
                        <p key={i} className="text-sm text-gray-600">
                          🌾 {item.riceVariety} — {item.bags} กระสอบ
                          {item.tagCode && <span className="text-blue-600 font-bold ml-1">🏷️ {item.tagCode}</span>}
                        </p>
                      ))}
                      {!sale.items && <p className="text-sm text-gray-600">🌾 {sale.riceVariety} — {sale.totalBags} กระสอบ</p>}
                      <p className="text-xs text-gray-400 mt-1">📅 {sale.saleDate} | บันทึกโดย: {sale.createdByName}</p>
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <button onClick={() => handleEdit(sale)}
                        className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-yellow-200">
                        ✏️ แก้ไข
                      </button>
                      <button onClick={() => setConfirmDelete(sale)}
                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200">
                        🗑️ ลบ
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
