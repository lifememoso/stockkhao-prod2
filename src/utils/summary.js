import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const toSummaryId = (variety) =>
  variety.replace(/\//g, '-').replace(/\./g, '_').trim();

/**
 * Pure function: คำนวณค่า summary ใหม่จากค่าปัจจุบัน + delta
 * ไม่แตะ Firestore เลย — ใช้ซ้ำได้ทั้งใน updateVarietySummary (1 พันธุ์)
 * และใน transaction อื่นๆ ที่ต้อง rollback/update หลายพันธุ์พร้อมกัน (เช่น handleDeleteProc)
 */
export const computeSummaryUpdate = (variety, current, { deltaBags = 0, deltaSoldBags = 0, deltaTons = 0 }) => {
  const base = current || { variety, totalBags: 0, soldBags: 0, remainingBags: 0, totalTons: 0 };

  const totalBags = Math.max(0, (base.totalBags || 0) + deltaBags);
  const soldBagsRaw = Math.max(0, (base.soldBags || 0) + deltaSoldBags);
  const totalTons = Math.max(0, (base.totalTons || 0) + deltaTons);

  // ป้องกัน soldBags เกิน totalBags
  const safeSoldBags = Math.min(soldBagsRaw, totalBags);

  // ถ้าค่าที่คำนวณได้เกิน totalBags จริง แสดงว่ามีความผิดปกติเกิดขึ้นที่อื่น (ข้อมูลต้นทางไม่ตรงกัน)
  // log ไว้ให้เห็นทันทีใน console เพื่อตามรอยได้ว่าเกิดจาก action ไหน แทนที่จะตัดทอนแบบเงียบๆ
  if (soldBagsRaw > totalBags) {
    console.warn(
      `[summary] ⚠️ soldBags (${soldBagsRaw}) เกิน totalBags (${totalBags}) สำหรับพันธุ์ "${variety}" ` +
      `— ค่าที่บันทึกจริงถูกตัดเหลือ ${safeSoldBags} กรุณาตรวจสอบรายการขาย/คัดแยกล่าสุดของพันธุ์นี้`
    );
  }

  return {
    variety,
    totalBags,
    soldBags: safeSoldBags,
    remainingBags: Math.max(0, totalBags - safeSoldBags),
    totalTons,
    updatedAt: Timestamp.now(),
  };
};

export const updateVarietySummary = async (
  variety,
  { deltaBags = 0, deltaSoldBags = 0, deltaTons = 0 }
) => {
  if (!variety) return;
  const id = toSummaryId(variety);
  const ref = doc(db, 'summaryByVariety', id);

  // ใช้ transaction เพื่อให้ "อ่านค่าปัจจุบัน -> คำนวณ -> เขียนกลับ" เป็นขั้นตอนเดียวที่ไม่ถูกแทรกกลาง
  // ป้องกันปัญหา lost update เวลามีการเรียกฟังก์ชันนี้พร้อมกันหลายครั้ง (เช่น approve/ขาย/เคลมพร้อมกัน)
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    const current = snap.exists() ? snap.data() : null;
    const updated = computeSummaryUpdate(variety, current, { deltaBags, deltaSoldBags, deltaTons });
    transaction.set(ref, updated);
  });
};
