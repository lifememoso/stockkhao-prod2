import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';

export default function Step4() {
  const { user } = useAuthStore();
  const [approvedSales, setApprovedSales] = useState([]);
  const [claimReasons, setClaimReasons] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [formData, setFormData] = useState({
    claimBags: '',
    reason: '',
    note: '',
    claimDate: new Date().toISOString().slice(0, 10),
  });
  const [showAddReason, setShowAddReason] = useState(false);
  const [newReason, setNewReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [claimsList, setClaimsList] = useState([]);
  const [showClaims, setShowClaims] = useState(false);

  useEffect(() => {
    fetchApprovedSales();
    fetchClaimReasons();
    fetchClaims();
  }, []);

  const fetchApprovedSales = async () => {
    try {
      const q = query(
        collection(db, 'sales'),
        where('status', '==', 'approved')
      );
      const snap = await getDocs(q);
      setApprovedSales(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
    } catch (error) {
      console.error(error);
    }
  };

  const fetchClaimReasons = async () => {
    try {
      const q = query(
        collection(db, 'settings'),
        where('type', '==', 'claimReason'),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      setClaimReasons(snap.docs.map(d => d.data().name));
    } catch (error) {
      console.error(error);
    }
  };

  const fetchClaims = async () => {
    try {
      const snap = await getDocs(collection(db, 'claims'));
      setClaimsList(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddReason = async () => {
    if (!newReason.trim()) return;
    try {
      await addDoc(collection(db, 'settings'), {
        type: 'claimReason',
        name: newReason.trim(),
        active: true,
        createdAt: Timestamp.now(),
      });
      setClaimReasons([...claimReasons, newReason.trim()]);
      setFormData({ ...formData, reason: newReason.trim() });
      setNewReason('');
      setShowAddReason(false);
      setMessage({ type: 'success', text: '✅ เพิ่มสาเหตุสำเร็จ' });
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }
  };

  const handleSelectSale = (sale) => {
    setSelectedSale(sale);
    setFormData({
      claimBags: '',
      reason: '',
      note: '',
      claimDate: new Date().toISOString().slice(0, 10),
    });
  };

  const calculateClaimPercent = () => {
    if (!selectedSale || !formData.claimBags) return 0;
    return ((parseInt(formData.claimBags) / selectedSale.totalBags) * 100).toFixed(1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSale || !formData.claimBags || !formData.reason) {
      setMessage({ type: 'error', text: 'กรุณากรอกข้อมูลให้ครบ' });
      return;
    }

    const claimBags = parseInt(formData.claimBags);
    if (claimBags <= 0 || claimBags > selectedSale.totalBags) {
      setMessage({ type: 'error', text: `จำนวนเคลมต้องมากกว่า 0 และไม่เกิน ${selectedSale.totalBags} กระสอบ` });
      return;
    }

    setLoading(true);

    try {
      const now = Timestamp.now();
      const claimPercent = calculateClaimPercent();
      const saleVariety = selectedSale.items?.length === 1
        ? selectedSale.items[0].riceVariety
        : selectedSale.riceVariety;

      await addDoc(collection(db, 'claims'), {
        saleId: selectedSale.id,
        saleCode: selectedSale.saleId,
        riceVariety: saleVariety,
        buyerName: selectedSale.buyerName,
        saleBags: selectedSale.totalBags,
        claimBags,
        claimPercent: parseFloat(claimPercent),
        reason: formData.reason,
        claimDate: formData.claimDate,
        note: formData.note || '',
        status: 'recorded',
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: now,
      });

      await addDoc(collection(db, 'activityLog'), {
        action: 'claim',
        saleId: selectedSale.id,
        saleCode: selectedSale.saleId,
        riceVariety: saleVariety,
        buyerName: selectedSale.buyerName,
        saleBags: selectedSale.totalBags,
        claimBags,
        claimPercent: parseFloat(claimPercent),
        reason: formData.reason,
        claimDate: formData.claimDate,
        note: formData.note || '-',
        by: user.uid,
        byName: user.name,
        at: now,
      });

      setMessage({
        type: 'success',
        text: `✅ บันทึกเคลมสำเร็จ! ${claimBags} กระสอบ (${claimPercent}%)`
      });

      setSelectedSale(null);
      setFormData({ claimBags: '', reason: '', note: '', claimDate: new Date().toISOString().slice(0, 10) });
      fetchClaims();
    } catch (error) {
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาด: ' + error.message });
    }

    setLoading(false);
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

      {/* เลือกการขาย */}
      {!selectedSale && (
        <div className="bg-white rounded-xl shadow p-5 mb-6">
          <h3 className="font-bold text-gray-800 mb-4">🛒 เลือกการขายที่ต้องการเคลม</h3>
          {approvedSales.length === 0 ? (
            <p className="text-gray-400 text-center py-4">ไม่มีการขายที่อนุมัติแล้ว</p>
          ) : (
            <div className="space-y-3">
              {approvedSales.map(sale => (
                <button key={sale.id} onClick={() => handleSelectSale(sale)}
                  className="w-full bg-purple-50 border border-purple-300 rounded-xl p-4 text-left hover:shadow-md transition">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-black text-gray-800">{sale.saleId}</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">✅ อนุมัติแล้ว</span>
                      </div>
                      <p className="text-sm font-bold text-gray-700">👤 {sale.buyerName}</p>
                      {sale.items ? (
                        <div className="text-sm text-gray-600 mt-2 space-y-0.5">
                          {sale.items.map((item, i) => (
                            <p key={i}>🌾 {item.riceVariety} — {item.bags} กระสอบ</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">🌾 {sale.riceVariety}</p>
                      )}
                      {sale.buyerPhone && sale.buyerPhone !== '-' && (
                        <p className="text-sm text-gray-500 mt-1">📱 {sale.buyerPhone}</p>
                      )}
                      {sale.saleDate && (
                        <p className="text-sm text-gray-500 mt-1">📅 {sale.saleDate}</p>
                      )}
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
            {selectedSale.items ? (
              <div className="text-sm mt-2 space-y-0.5">
                {selectedSale.items.map((item, i) => (
                  <p key={i}>🌾 {item.riceVariety} — {item.bags} กระสอบ</p>
                ))}
              </div>
            ) : (
              <p className="text-sm"><span className="font-bold">พันธุ์:</span> {selectedSale.riceVariety}</p>
            )}
            {selectedSale.saleDate && (
              <p className="text-sm"><span className="font-bold">วันที่ขาย:</span> {selectedSale.saleDate}</p>
            )}
            <p className="text-sm font-bold text-purple-600 mt-2">รวม: {selectedSale.totalBags} กระสอบ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* จำนวนเคลม */}
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">
                📦 จำนวนกระสอบที่เคลม (สูงสุด: {selectedSale.totalBags} กระสอบ) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.claimBags}
                onChange={e => setFormData({...formData, claimBags: e.target.value})}
                placeholder="เช่น 5"
                min="1"
                max={selectedSale.totalBags}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
              />
              {formData.claimBags && (
                <div className="mt-2 bg-blue-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">ร้อยละเคลม:</span>
                    <span className="text-lg font-bold text-blue-600">{calculateClaimPercent()}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${calculateClaimPercent()}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* สาเหตุเคลม */}
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">
                📋 สาเหตุเคลม <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={formData.reason}
                  onChange={e => setFormData({...formData, reason: e.target.value})}
                  className="flex-1 border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
                >
                  <option value="">-- เลือกสาเหตุเคลม --</option>
                  {claimReasons.map(r => <option key={r}>{r}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddReason(!showAddReason)}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-blue-700"
                >
                  ➕
                </button>
              </div>
              {showAddReason && (
                <div className="mt-3 flex gap-2 bg-blue-50 p-3 rounded-xl border-2 border-blue-200">
                  <input
                    type="text"
                    value={newReason}
                    onChange={e => setNewReason(e.target.value)}
                    placeholder="สาเหตุเคลมใหม่"
                    className="flex-1 border-2 border-blue-300 rounded-lg p-2 focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddReason}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    ✅
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddReason(false)}
                    className="bg-gray-400 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* วันที่เคลม */}
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">
                📅 วันที่เคลม <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.claimDate}
                onChange={e => setFormData({...formData, claimDate: e.target.value})}
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* หมายเหตุเพิ่มเติม */}
            <div>
              <label className="text-sm text-gray-700 font-bold block mb-1">📝 หมายเหตุเพิ่มเติม</label>
              <textarea
                value={formData.note}
                onChange={e => setFormData({...formData, note: e.target.value})}
                placeholder="รายละเอียดเพิ่มเติมเกี่ยวกับเคลม..."
                rows="3"
                className="w-full border-2 border-gray-200 rounded-xl p-3 focus:outline-none focus:border-green-500"
              />
            </div>

            {/* Summary */}
            {formData.claimBags && formData.reason && (
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <p className="font-bold text-blue-700 mb-2">📋 สรุปการเคลม</p>
                <p className="text-sm text-gray-700">
                  🛒 <span className="font-bold">{selectedSale.saleId}</span> — {selectedSale.buyerName}
                </p>
                <p className="text-sm text-gray-700">
                  📦 เคลม <span className="font-bold text-red-600">{formData.claimBags}</span> จาก {selectedSale.totalBags} กระสอบ ({calculateClaimPercent()}%)
                </p>
                <p className="text-sm text-gray-700">
                  📋 สาเหตุ: <span className="font-bold">{formData.reason}</span>
                </p>
                <p className="text-sm text-gray-700">
                  📅 วันที่เคลม: <span className="font-bold">{formData.claimDate}</span>
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 text-white py-4 rounded-xl font-black text-lg disabled:opacity-50 transition shadow-lg"
            >
              {loading ? '⏳ กำลังบันทึก...' : '✅ บันทึกการเคลม'}
            </button>
          </form>
        </div>
      )}

      {/* รายการเคลมที่บันทึก */}
      <div className="bg-white rounded-2xl shadow p-5">
        <button
          onClick={() => setShowClaims(!showClaims)}
          className="w-full flex justify-between items-center font-black text-gray-700 text-base"
        >
          <span>📋 รายการเคลมที่บันทึก ({claimsList.length})</span>
          <span>{showClaims ? '▲' : '▼'}</span>
        </button>

        {showClaims && (
          <div className="mt-4 space-y-3">
            {claimsList.length === 0 ? (
              <p className="text-gray-400 text-center py-4">ยังไม่มีการเคลมใดๆ</p>
            ) : (
              claimsList.map(claim => (
                <div key={claim.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                          🔄 เคลม
                        </span>
                        <span className="font-bold text-gray-700">{claim.saleCode}</span>
                      </div>
                      <p className="text-sm text-gray-600">👤 {claim.buyerName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-red-600">{claim.claimBags}</p>
                      <p className="text-xs text-gray-400">กระสอบ ({claim.claimPercent}%)</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    <p className="text-sm text-gray-600">
                      🌾 <span className="font-bold">{claim.riceVariety}</span> | 📦 {claim.saleBags} กระสอบ
                    </p>
                    <p className="text-sm text-gray-600">
                      📋 <span className="font-bold">{claim.reason}</span>
                    </p>
                    {claim.claimDate && (
                      <p className="text-sm text-gray-600">
                        📅 {claim.claimDate}
                      </p>
                    )}
                    {claim.note && claim.note !== '-' && (
                      <p className="text-sm text-gray-600">💬 {claim.note}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      บันทึกโดย: {claim.createdByName}
                    </p>
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