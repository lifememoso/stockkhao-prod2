import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, getDocs, doc, deleteDoc, updateDoc,
  query, where, Timestamp
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Step4() {
  const { user } = useAuthStore();
  const [approvedSales, setApprovedSales] = useState([]);
  const [claimReasons, setClaimReasons] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [formData, setFormData] = useState({ claimBags: '', reason: '', note: '', claimDate: new Date().toISOString().slice(0, 10) });
  const [showAddReason, setShowAddReason] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [claimsList, setClaimsList] = useState([]);
  const [showClaims, setShowClaims] = useState(true);
  const [editingClaim, setEditingClaim] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchApprovedSales();
    fetchClaimReasons();
    fetchClaims();
  }, []);

  const fetchApprovedSales = async () => {
    const q = query(collection(db, 'sales'), where('status', '==', 'approved'));
    const snap = await getDocs(q);
    setApprovedSales(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
  };

  const fetchClaimReasons = async () => {
    const q = query(collection(db, 'settings'), where('type', '==', 'claimReason'), where('active', '==', true));
    const snap = await getDocs(q);
    setClaimReasons(snap.docs.map(d => d.data().name));
  };

  const fetchClaims = async () => {
    const snap = await getDocs(collection(db, 'claims'));
    setClaimsList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
  };

  const handleAddReason = async () => {
    if (!newReason.trim()) return;
    try {
      await addDoc(collection(db, 'settings'), { type: 'claimReason', name: newReason.trim(), active: true, createdAt: Timestamp.now() });
      setClaimReasons([...claimReasons, newReason.trim()]);
      setFormData({ ...formData, reason: newReason.trim() });
      setNewReason(''); setShowAddReason(false);
      setMessage({ type: 'success', text: '✅ เพิ่มสาเหตุสำเร็จ' });
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
  };

  const calculateClaimPercent = (bags, totalBags) => {
    if (!bags || !totalBags) return 0;
    return ((parseInt(bags) / totalBags) * 100).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSale || !formData.claimBags || !formData.reason) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    const claimBags = parseInt(formData.claimBags);
    if (claimBags <= 0 || claimBags > selectedSale.totalBags) {
      setMessage({ type: 'error', text: `จำนวนเคลมต้องมากกว่า 0 และไม่เกิน ${selectedSale.totalBags} กระสอบ` }); return;
    }
    setLoading(true);
    try {
      const now = Timestamp.now();
      const claimPercent = calculateClaimPercent(claimBags, selectedSale.totalBags);
      const saleVariety = selectedSale.items?.length === 1 ? selectedSale.items[0].riceVariety : selectedSale.riceVariety;
      await addDoc(collection(db, 'claims'), {
        saleId: selectedSale.id, saleCode: selectedSale.saleId,
        riceVariety: saleVariety, buyerName: selectedSale.buyerName,
        saleBags: selectedSale.totalBags, claimBags,
        claimPercent: parseFloat(claimPercent), reason: formData.reason,
        claimDate: formData.claimDate, note: formData.note || '',
        status: 'recorded', createdBy: user.uid, createdByName: user.name, createdAt: now,
      });
      setMessage({ type: 'success', text: `✅ บันทึกเคลมสำเร็จ! ${claimBags} กระสอบ (${claimPercent}%)` });
      setSelectedSale(null);
      setFormData({ claimBags: '', reason: '', note: '', claimDate: new Date().toISOString().slice(0, 10) });
      fetchClaims();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleEditClaim = async () => {
    if (!editingClaim) return;
    setLoading(true);
    try {
      const claimPercent = calculateClaimPercent(editForm.claimBags, editingClaim.saleBags);
      await updateDoc(doc(db, 'claims', editingClaim.id), {
        claimBags: parseInt(editForm.claimBags),
        claimPercent: parseFloat(claimPercent),
        reason: editForm.reason,
        claimDate: editForm.claimDate,
        note: editForm.note || '',
        updatedBy: user.name,
        updatedAt: Timestamp.now(),
      });
      setMessage({ type: 'success', text: '✅ แก้ไขเคลมสำเร็จ!' });
      setEditingClaim(null);
      fetchClaims();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
  };

  const handleDeleteClaim = async (claim) => {
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'claims', claim.id));
      setMessage({ type: 'success', text: '✅ ลบการเคลมสำเร็จ' });
      fetchClaims();
    } catch (err) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + err.message });
    }
    setLoading(false);
    setConfirmDelete(null);
  };

  return (
    <div className="pt-6 pb-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-orange-500 mb-1">🔄 บันทึกเคลม</h2>
        <p className="text-gray-500 text-sm">บันทึกการเคลมจากการขายที่อนุมัติแล้ว</p>
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
            <p className="text-sm text-gray-600 mb-4">ลบการเคลม <b>{confirmDelete.saleCode}</b> — {confirmDelete.claimBags} กระสอบ</p>
            <div className="flex gap-3">
              <button onClick={() => handleDeleteClaim(confirmDelete)} disabled={loading}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '🗑️ ลบเลย'}
              </button>
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Claim Dialog */}
      {editingClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <p className="text-lg font-black text-gray-800 mb-4">✏️ แก้ไขเคลม {editingClaim.saleCode}</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500">📦 จำนวนกระสอบที่เคลม (สูงสุด {editingClaim.saleBags})</label>
                <input type="number" value={editForm.claimBags} min="1" max={editingClaim.saleBags}
                  onChange={e => setEditForm({...editForm, claimBags: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">📋 สาเหตุเคลม</label>
                <select value={editForm.reason} onChange={e => setEditForm({...editForm, reason: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1">
                  {claimReasons.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">📅 วันที่เคลม</label>
                <input type="date" value={editForm.claimDate} onChange={e => setEditForm({...editForm, claimDate: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">📝 หมายเหตุ</label>
                <input type="text" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})}
                  className="w-full border-2 border-gray-200 rounded-lg p-2 mt-1" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleEditClaim} disabled={loading}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold disabled:opacity-50">
                {loading ? '⏳...' : '✅ บันทึก'}
              </button>
              <button onClick={() => setEditingClaim(null)}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold">ยกเลิก</button>
            </div>
          </div>
        </div>
      )}

      {/* เลือกการขาย */}
      {!selectedSale && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">🛒 เลือกการขายที่ต้องการเคลม</h3>
          {approvedSales.length === 0 ? (
            <p className="text-gray-400 text-center py-4">ไม่มีการขายที่อนุมัติแล้ว</p>
          ) : (
            <div className="space-y-3">
              {approvedSales.map(sale => (
                <button key={sale.id} onClick={() => { setSelectedSale(sale); setFormData({ claimBags: '', reason: '', note: '', claimDate: new Date().toISOString().slice(0, 10) }); }}
                  className="w-full bg-purple-50 border border-purple-300 rounded-xl p-4 text-left hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-gray-800">{sale.saleId}</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ อนุมัติแล้ว</span>
                      </div>
                      <p className="text-sm font-bold text-gray-700">👤 {sale.buyerName}</p>
                      {sale.items ? sale.items.map((item, i) => <p key={i} className="text-sm text-gray-600">🌾 {item.riceVariety} — {item.bags} กระสอบ</p>)
                        : <p className="text-sm text-gray-600">🌾 {sale.riceVariety}</p>}
                      {sale.saleDate && <p className="text-sm text-gray-500 mt-1">📅 {sale.saleDate}</p>}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-2xl font-black text-purple-600">{sale.totalBags}</p>
                      <p className="text-xs text-gray-400">กระสอบ</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form เคลม */}
      {selectedSale && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">🔄 บันทึกเคลม</h3>
            <button onClick={() => setSelectedSale(null)} className="text-gray-400 text-2xl">✕</button>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 mb-4 border-l-4 border-purple-400">
            <p className="text-sm"><span className="font-bold">รหัสขาย:</span> {selectedSale.saleId}</p>
            <p className="text-sm"><span className="font-bold">ผู้ซื้อ:</span> {selectedSale.buyerName}</p>
            <p className="text-sm font-bold text-purple-600 mt-2">รวม: {selectedSale.totalBags} กระสอบ</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📦 จำนวนกระสอบที่เคลม *</label>
              <input type="number" value={formData.claimBags} min="1" max={selectedSale.totalBags}
                onChange={e => setFormData({...formData, claimBags: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3" />
              {formData.claimBags && (
                <div className="mt-2 bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">ร้อยละเคลม:</span>
                    <span className="text-lg font-bold text-blue-600">{calculateClaimPercent(formData.claimBags, selectedSale.totalBags)}%</span>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📋 สาเหตุเคลม *</label>
              <div className="flex gap-2">
                <select value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3">
                  <option value="">-- เลือกสาเหตุเคลม --</option>
                  {claimReasons.map(r => <option key={r}>{r}</option>)}
                </select>
                <button type="button" onClick={() => setShowAddReason(!showAddReason)}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold">➕</button>
              </div>
              {showAddReason && (
                <div className="mt-3 flex gap-2 bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
                  <input type="text" value={newReason} onChange={e => setNewReason(e.target.value)}
                    placeholder="สาเหตุเคลมใหม่" className="flex-1 border-2 border-blue-300 rounded-lg p-2 text-sm" />
                  <button type="button" onClick={handleAddReason} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold">✅</button>
                  <button type="button" onClick={() => setShowAddReason(false)} className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold">✕</button>
                </div>
              )}
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📅 วันที่เคลม *</label>
              <input type="date" value={formData.claimDate} onChange={e => setFormData({...formData, claimDate: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3" />
            </div>
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📝 หมายเหตุ</label>
              <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})}
                rows="2" className="w-full border-2 border-gray-200 rounded-xl p-3" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50">
              {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกการเคลม'}
            </button>
          </form>
        </div>
      )}

      {/* รายการเคลม */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <button onClick={() => setShowClaims(!showClaims)}
          className="w-full flex justify-between items-center p-4 hover:bg-gray-50">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-gray-800">📋 รายการเคลมที่บันทึก</h3>
            <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">{claimsList.length}</span>
          </div>
          <span className="text-gray-400 text-xl">{showClaims ? '▲' : '▼'}</span>
        </button>
        {showClaims && (
          <div className="px-4 pb-4 space-y-3">
            {claimsList.length === 0 ? (
              <p className="text-gray-400 text-center py-8">ยังไม่มีการเคลมใดๆ</p>
            ) : claimsList.map(claim => (
              <div key={claim.id} className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">🔄 เคลม</span>
                      <span className="font-bold text-gray-700 text-sm">{claim.saleCode}</span>
                    </div>
                    <p className="text-sm text-gray-600">👤 {claim.buyerName}</p>
                    <p className="text-sm text-gray-600">🌾 {claim.riceVariety} | 📦 {claim.claimBags} กระสอบ ({claim.claimPercent}%)</p>
                    <p className="text-sm text-gray-600">📋 {claim.reason} | 📅 {claim.claimDate}</p>
                    {claim.note && <p className="text-sm text-gray-500">💬 {claim.note}</p>}
                    <p className="text-xs text-gray-400 mt-1">บันทึกโดย: {claim.createdByName}</p>
                  </div>
                  <div className="flex flex-col gap-2 ml-2">
                    <button onClick={() => {
                      setEditingClaim(claim);
                      setEditForm({ claimBags: claim.claimBags, reason: claim.reason, claimDate: claim.claimDate, note: claim.note || '' });
                    }} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-yellow-200">✏️ แก้ไข</button>
                    <button onClick={() => setConfirmDelete(claim)}
                      className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs hover:bg-red-200">🗑️ ลบ</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}