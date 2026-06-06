import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export const toSummaryId = (variety) =>
  variety.replace(/\//g, '-').replace(/\./g, '_').trim();

export const updateVarietySummary = async (
  variety,
  { deltaBags = 0, deltaSoldBags = 0, deltaTons = 0 }
) => {
  if (!variety) return;
  const id = toSummaryId(variety);
  const ref = doc(db, 'summaryByVariety', id);
  const snap = await getDoc(ref);

  const current = snap.exists() ? snap.data() : {
    variety,
    totalBags: 0,
    soldBags: 0,
    remainingBags: 0,
    totalTons: 0,
  };

  const totalBags = Math.max(0, (current.totalBags || 0) + deltaBags);
  const soldBags = Math.max(0, (current.soldBags || 0) + deltaSoldBags);
  const totalTons = Math.max(0, (current.totalTons || 0) + deltaTons);

  await setDoc(ref, {
    variety,
    totalBags,
    soldBags,
    remainingBags: totalBags - soldBags,
    totalTons,
    updatedAt: Timestamp.now(),
  });
};