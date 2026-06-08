import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, query, where, addDoc, updateDoc,
  deleteDoc, doc, Timestamp, getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { updateVarietySummary } from '../../utils/summary';

export default function Step2() {
  const { user } = useAuthStore();
  const [lots, setLots] = useState([]);
  const [varieties, setVarieties] = useState([]);
  const [selectedLot, setSelectedLot] = useState(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [formData, setFormData] = useState({
    tagCode: '', germinationTestDate: '', sortingDate: '',
    tagIssueDate: '', newVariety: '', inputTons: '', outputBags: '', notes: '',
  });
  const [showAddVariety, setShowAddVariety] = useState(false);
  const [newVarietyName, setNewVarietyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [processingList, setProcessingList] = useState([]);
  const [editingProc, setEditingProc] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showHistory, setShowHistory] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchLots();
    fetchVarieties();
    fetchProcessing();
  }, []);

  const fetchLots = async () => {
    const q = query(collection(db, 'lots'), where('status', '==', 'open'));
    const snap = await getDocs(q);
    setLots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchVarieties = async () => {
    const q = query(collection(db, 'settings'), where('type', '==', 'variety'), where('active', '==', true));
    const snap = await getDocs(q);
    setVarieties(snap.docs.map(d => d.data().name));
  };

  const fetchProcessing = async () => {
    const snap = await getDocs(collection(db, 'processing'));
    setProcessingList(snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
  };

  const handleAddVariety = async () => {
    if (!newVarietyName.trim()) return;
    try {
      await addDoc(collection(db, 'settings'), {
        type: 'variety', name: newVarietyName.trim(), active: true, createdAt: Timestamp.now(),
      });
      setVarieties([...varieties, newVarietyName.trim()]);
      setFormData({ ...formData, newVariety: newVarietyName.trim() });
      setNewVarietyName('');
      setShowAddVariety(false);
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
  };

  const handleSelectLot = async (lot) => {
    const procQ = query(collection(db, 'processing'), where('lotId', '==', lot.id));
    const procSnap = await getDocs(procQ);
    const round = procSnap.size + 1;
    setRoundNumber(round);
    const baseTag = lot.tagCode || lot.lotCode;
    const autoTag = round === 1 ? baseTag : `${baseTag}/${round}`;
    setSelectedLot(lot);
    setFormData({
      tagCode: autoTag, germinationTestDate: '', sortingDate: '',
      tagIssueDate: '', newVariety: lot.riceVariety, inputTons: '', outputBags: '', notes: '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLot || !formData.inputTons || !formData.tagCode || !formData.newVariety || !formData.outputBags) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    const inputTons = parseFloat(formData.inputTons);
    if (inputTons > selectedLot.receivedTons) {
      setMessage({ type: 'error', text: `ตัดออกไม่เกิน ${selectedLot.receivedTons} ตัน` }); return;
    }
    setLoading(true);
    try {
      const now = Timestamp.now();
      const remainingTons = parseFloat((selectedLot.receivedTons - inputTons).toFixed(2));
      const outputBags = parseInt(formData.outputBags);
      const varietyChanged = selectedLot.riceVariety !== formData.newVariety;

      await addDoc(collection(db, 'processing'), {
        lotId: selectedLot.id, lotCode: selectedLot.lotCode,
        lotTagCode: selectedLot.tagCode || '', tagCode: formData.tagCode,
        round: roundNumber, originalVariety: selectedLot.riceVariety,
        newVariety: formData.newVariety, germinationTestDate: formData.germinationTestDate,
        sortingDate: formData.sortingDate, tagIssueDate: formData.tagIssueDate,
        inputTons, outputBags, notes: formData.notes, status: 'processed',
        createdBy: user.uid, createdByName: user.name, createdAt: now,
        tagHistory: [{ tagCode: formData.tagCode, variety: formData.newVariety, changedBy: user.name, changedAt: now, note: `คัดรอบที่ ${roundNumber}` }],
        varietyHistory: varietyChanged ? [{ from: selectedLot.riceVariety, to: formData.newVariety, changedBy: user.name, changedAt: now }] : [],
      });

      await updateDoc(doc(db, 'lots', selectedLot.id), {
        receivedTons: remainingTons,
        status: remainingTons === 0 ? 'completed' : 'open',
      });

      await updateVarietySummary(formData.newVariety, { deltaBags: outputBags, deltaTons: inputTons });

      await addDoc(collection(db, 'activityLog'), {
        action: 'sort', lotCode: selectedLot.lotCode, tagCode: formData.tagCode,
        round: roundNumber, originalVariety: selectedLot.riceVariety,
        newVariety: formData.newVariety, varietyChanged, inputTons, outputBags,
        sortingDate: formData.sortingDate || '-', remainingTons,
        by: user.uid, byName: user.name, at: now,
      });

      setMessage({
        type: 'success',
        text: remainingTons === 0
          ? `✅ คัดแยกสำเร็จ! ใบแท็ก: ${formData.tagCode} (ล็อตแล้วเสร็จ)`
          : `✅ คัดแยกสำเร็จ! ใบแท็ก: ${formData.tagCode} (เหลือ ${remainingTons} ตัน)`
      });
      setSelectedLot(null);
      fetchLots();
      fetchProcessing();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleEditProc = async () => {
    if (!editingProc) return;
    setLoading(true);
    try {
      const now = Timestamp.now();
      const tagHistory = [...(editingProc.tagHistory || [])];
      const varietyHistory = [...(editingProc.varietyHistory || [])];
      const changes = {};

      if (editForm.tagCode !== editingProc.tagCode) {
        changes.tagCode = { from: editingProc.tagCode, to: editForm.tagCode };
        tagHistory.push({ tagCode: editForm.tagCode, oldTagCode: editingProc.tagCode, changedBy: user.name, changedAt: now, note: editForm.editNote || 'แก้ไขใบแท็ก' });
      }

      if (editForm.newVariety !== editingProc.newVariety) {
        changes.variety = { from: editingProc.newVariety, to: editForm.newVariety };
        varietyHistory.push({ from: editingProc.newVariety, to: editForm.newVariety, changedBy: user.name, changedAt: now });
        const bags = editingProc.outputBags || 0;
        await updateVarietySummary(editingProc.newVariety, { deltaBags: -bags, deltaTons: -(editingProc.inputTons || 0) });
        await updateVarietySummary(editForm.newVariety, { deltaBags: bags, deltaTons: editingProc.inputTons || 0 });
      }

      if (parseInt(editForm.outputBags) !== editingProc.outputBags) {
        changes.outputBags = { from: editingProc.outputBags, to: parseInt(editForm.outputBags) };
      }

      await updateDoc(doc(db, 'processing', editingProc.id), {
        tagCode: editForm.tagCode, newVariety: editForm.newVariety,
        germinationTestDate: editForm.germinationTestDate, sortingDate: editForm.sortingDate,
        tagIssueDate: editForm.tagIssueDate,
        outputBags: parseInt(editForm.outputBags) || editingProc.outputBags,
        notes: editForm.notes, tagHistory, varietyHistory,
        updatedBy: user.name, updatedAt: now,
      });

      await addDoc(collection(db, 'activityLog'), {
        action: 'edit_processing', lotCode: editingProc.lotCode, round: editingProc.round,
        changes, note: editForm.editNote || '-', by: user.uid, byName: user.name, at: now,
      });

      setMessage({ type: 'success', text: '✅ แก้ไขสำเร็จ!' });
      setEditingProc(null);
      fetchProcessing();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleDeleteProc = async (proc) => {
    setLoading(true);
    try {
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
      // ลบ sales ที่เกี่ยวกับ lot นี้ (ถ้ามี lotId)
      const salesQ = query(collection(db, 'sales'), where('lotId', '==', proc.lotId));
      const salesSnap = await getDocs(salesQ);
      for (const s of salesSnap.docs) {
        const sale = { id: s.id, ...s.data() };
        if (sale.status === 'approved') {
          const items = sale.items || [{ riceVariety: sale.riceVariety, bags: sale.totalBags }];
          for (const item of items) {
            await updateVarietySummary(item.riceVariety, { deltaSoldBags: -(item.bags || 0) });
          }
        }
        const claimsQ = query(collection(db, 'claims'), where('saleId', '==', s.id));
        const claimsSnap = await getDocs(claimsQ);
        for (const c of claimsSnap.docs) await deleteDoc(doc(db, 'claims', c.id));
        await deleteDoc(doc(db, 'sales', s.id));
      }
      await deleteDoc(doc(db, 'processing', proc.id));
      await addDoc(collection(db, 'activityLog'), {
        action: 'delete_processing', lotCode: proc.lotCode, tagCode: proc.tagCode,
        note: 'ลบโดย Admin (cascade)', by: user.uid, byName: user.name, at: new Date(),
      });
      setMessage({ type: 'success', text: `✅ ลบการคัดแยก ${proc.tagCode} สำเร็จ` });
      fetchLots();
      fetchProcessing();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  return (
    <div className="pt-6 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 mb-1">✂️ คัดแยกและ QC</h2>
        <p className="text-gray-500 text-sm">คัดได้หลายรอบ ใบแท็กและพันธุ์แก้ไขได้ตลอด</p>
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
            <p className="text-sm text-gray-600 mb-2">ลบการคัดแยก: <b>{confirmDelete.tagCode}</b></p>
            <div className="bg-red-50 rounded-lg p-3 mb-4 text-xs text-red-700 space-y-1">
              <p>→ rollback totalBags/totalTons ใน summary</p>
              <p>→ คืน tons กลับ Lot</p>
              <p>→ ลบ sales + claims ที่เกี่ยวข้อง</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteProc(confirmDelete)} disabled={loading}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '🗑️ ลบเลย'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* เลือกล็อต */}
      {!selectedLot && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">📦 เลือกล็อตที่จะคัดแยก</h3>
          {lots.length === 0 ? (
            <p className="text-gray-400 text-center py-4">ไม่มีล็อตที่รอคัดแยก</p>
          ) : (
            <div className="space-y-3">
              {lots.map(lot => (
                <button key={lot.id} onClick={() => handleSelectLot(lot)}
                  className="w-full bg-blue-50 border border-blue-300 rounded-xl p-4 text-left hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{lot.riceVariety}</p>
                      <p className="text-sm text-gray-600">โค้ดล็อต: {lot.lotCode}</p>
                      <p className="text-sm text-gray-600">🏷️ <span className={`font-bold ${lot.tagCode ? 'text-blue-700' : 'text-red-400'}`}>{lot.tagCode || 'ยังไม่ได้ใส่ใบแท็ก'}</span></p>
                      <p className="text-sm text-gray-600">👤 {lot.farmerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{lot.receivedTons}</p>
                      <p className="text-xs text-gray-400">ตัน</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form คัดแยก */}
      {selectedLot && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">✂️ คัดแยกรอบที่ {roundNumber}</h3>
            <button onClick={() => setSelectedLot(null)} className="text-gray-400 text-2xl">✕</button>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border-l-4 border-blue-400">
            <p className="text-sm"><span className="font-bold">ล็อต:</span> {selectedLot.lotCode}</p>
            <p className="text-sm"><span className="font-bold">ใบแท็กเดิม:</span> {selectedLot.tagCode || '-'}</p>
            <p className="text-sm"><span className="font-bold">พันธุ์:</span> {selectedLot.riceVariety}</p>
            <p className="text-sm font-bold text-blue-600">คงเหลือ: {selectedLot.receivedTons} ตัน</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">🏷️ เลขใบแท็ก *</label>
              <input type="text" value={formData.tagCode} onChange={e => setFormData({...formData, tagCode: e.target.value})}
                className="w-full border-2 border-yellow-300 rounded-xl p-3 focus:outline-none font-bold text-blue-700" />
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">🌾 พันธุ์ข้าว (หลังคัด) *</label>
              <div className="flex gap-2">
                <select value={formData.newVariety} onChange={e => setFormData({...formData, newVariety: e.target.value})}
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3">
                  <option value="">-- เลือกพันธุ์ --</option>
                  {varieties.map(v => <option key={v}>{v}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddVariety(!showAddVariety)}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold">➕</button>
              </div>
              {showAddVariety && (
                <div className="mt-3 flex gap-2 bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
                  <input type="text" value={newVarietyName} onChange={e => setNewVarietyName(e.target.value)}
                    placeholder="ชื่อพันธุ์ข้าวใหม่" className="flex-1 border-2 border-blue-300 rounded-lg p-2 text-sm" />
                  <button type="button" onClick={handleAddVariety} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">✅</button>
                  <button type="button" onClick={() => setShowAddVariety(false)} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold">✕</button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">⚖️ จำนวนตันที่ตัดออก (คงเหลือ: {selectedLot.receivedTons} ตัน) *</label>
              <input type="number" step="0.1" max={selectedLot.receivedTons} value={formData.inputTons}
                onChange={e => setFormData({...formData, inputTons: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3" />
              {formData.inputTons && (
                <p className="text-xs text-gray-400 mt-1">จะเหลือ: {(selectedLot.receivedTons - parseFloat(formData.inputTons || 0)).toFixed(2)} ตัน</p>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📦 จำนวนกระสอบที่ได้ *</label>
              <input type="number" value={formData.outputBags} onChange={e => setFormData({...formData, outputBags: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-700 font-bold block mb-1">📅 วันทดสอบงอก</label>
                <input type="date" value={formData.germinationTestDate} onChange={e => setFormData({...formData, germinationTestDate: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3" />
              </div>
              <div>
                <label className="text-sm text-gray-700 font-bold block mb-1">📅 วันที่คัดข้าว</label>
                <input type="date" value={formData.sortingDate} onChange={e => setFormData({...formData, sortingDate: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-xl p-3" />
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📅 วันที่ออกแท็ก</label>
              <input type="date" value={formData.tagIssueDate} onChange={e => setFormData({...formData, tagIssueDate: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3" />
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📝 หมายเหตุ</label>
              <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                rows="2" className="w-full border-2 border-gray-200 rounded-xl p-3" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-700 text-white py-3 rounded-xl font-bold disabled:opacity-50">
              {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกการคัดแยก'}
            </button>
          </form>
        </div>
      )}

      {/* รายการที่คัดแล้ว */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <button onClick={() => setShowHistory(!showHistory)}
          className="w-full flex justify-between items-center p-4 hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-800">📋 รายการที่คัดแล้ว</h3>
            <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{processingList.length}</span>
          </div>
          <span className="text-gray-400 text-xl">{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          <div className="px-4 pb-4 space-y-3">
            {processingList.length === 0 ? (
              <p className="text-gray-400 text-center py-8">ยังไม่มีรายการ</p>
            ) : processingList.map(proc => (
              <div key={proc.id} className="border border-gray-200 rounded-xl p-4">
                {editingProc?.id === proc.id ? (
                  <div className="space-y-3">
                    <p className="font-bold text-sm text-gray-700">✏️ แก้ไข: {proc.lotCode} รอบที่ {proc.round}</p>
                    <div>
                      <label className="text-xs text-gray-500 font-bold">🏷️ เลขใบแท็ก</label>
                      <input type="text" value={editForm.tagCode} onChange={e => setEditForm({...editForm, tagCode: e.target.value})}
                        className="w-full border-2 border-yellow-300 rounded-lg p-2 mt-1 font-bold text-blue-700" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold">🌾 พันธุ์ข้าว</label>
                      <select value={editForm.newVariety} onChange={e => setEditForm({...editForm, newVariety: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1">
                        {varieties.map(v => <option key={v}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold">📦 จำนวนกระสอบ</label>
                      <input type="number" value={editForm.outputBags} onChange={e => setEditForm({...editForm, outputBags: e.target.value})}
                        className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 font-bold">📅 วันทดสอบงอก</label>
                        <input type="date" value={editForm.germinationTestDate} onChange={e => setEditForm({...editForm, germinationTestDate: e.target.value})}
                          className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-bold">📅 วันคัดข้าว</label>
                        <input type="date" value={editForm.sortingDate} onChange={e => setEditForm({...editForm, sortingDate: e.target.value})}
                          className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold">📝 หมายเหตุการแก้ไข</label>
                      <input type="text" value={editForm.editNote || ''} onChange={e => setEditForm({...editForm, editNote: e.target.value})}
                        placeholder="เหตุผลที่แก้ไข" className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleEditProc} disabled={loading}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold text-sm">✅ บันทึก</button>
                      <button onClick={() => setEditingProc(null)}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-bold text-sm">ยกเลิก</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">รอบ {proc.round}</span>
                        <span className="font-bold text-gray-700 text-sm">{proc.lotCode}</span>
                      </div>
                      <p className="text-sm font-bold text-blue-700">🏷️ {proc.tagCode || '-'}</p>
                      <p className="text-sm text-gray-600">🌾 {proc.newVariety}
                        {proc.newVariety !== proc.originalVariety && <span className="text-xs text-orange-500 ml-1">(จาก {proc.originalVariety})</span>}
                      </p>
                      <p className="text-sm text-gray-500">⚖️ {proc.inputTons} ตัน → 📦 {proc.outputBags} กระสอบ | 📅 {proc.sortingDate || '-'}</p>
                    </div>
                    <div className="flex flex-col gap-2 ml-2">
                      <button onClick={() => {
                        setEditingProc(proc);
                        setEditForm({ tagCode: proc.tagCode||'', newVariety: proc.newVariety||'', germinationTestDate: proc.germinationTestDate||'', sortingDate: proc.sortingDate||'', tagIssueDate: proc.tagIssueDate||'', outputBags: proc.outputBags||'', notes: proc.notes||'', editNote: '' });
                      }} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-yellow-200">✏️ แก้ไข</button>
                      <button onClick={() => setConfirmDelete(proc)}
                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200">🗑️ ลบ</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}