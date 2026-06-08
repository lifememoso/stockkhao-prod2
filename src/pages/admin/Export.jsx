import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

export default function Export() {
  const [varieties, setVarieties] = useState([]);

  useEffect(() => {
    getDocs(query(collection(db, 'settings'), where('type', '==', 'variety'), where('active', '==', true)))
      .then(snap => setVarieties(snap.docs.map(d => d.data().name)))
      .catch(err => console.error(err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-700 mb-4">📤 Export ข้อมูล</h2>
      <p className="text-green-600">✅ หน้า Export โหลดสำเร็จ</p>
      <p className="text-gray-500 mt-2">พันธุ์ที่พบ: {varieties.join(', ') || 'กำลังโหลด...'}</p>
    </div>
  );
}