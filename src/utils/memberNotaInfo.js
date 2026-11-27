import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

/**
 * Info member untuk nota (Tipe Member, Saldo Sebelum, Saldo Terakhir, Masa Aktif).
 * null = bukan member / gagal ambil → nota tetap dicetak tanpa blok member.
 */
export async function fetchMemberNotaInfo(orderNo) {
  if (!orderNo) return null;
  try {
    const res = await axios.get(`/api/transactions/${encodeURIComponent(orderNo)}/member-info`, { timeout: 10000 });
    return res.data?.success ? res.data.data || null : null;
  } catch {
    return null;
  }
}

/** Lengkapi receipt dengan memberInfo (dipakai sebelum kirim nota digital). */
export async function withMemberNotaInfo(receipt) {
  if (!receipt?.id || receipt.memberInfo !== undefined) return receipt;
  return { ...receipt, memberInfo: await fetchMemberNotaInfo(receipt.id) };
}

/** Hook: receipt + memberInfo (receipt asli langsung tampil, blok member menyusul). */
export function useMemberNotaReceipt(receipt) {
  const orderNo = receipt?.id || null;
  const preset = receipt?.memberInfo;
  const [info, setInfo] = useState({ orderNo: null, data: null });

  useEffect(() => {
    if (!orderNo || preset !== undefined) return undefined;
    let alive = true;
    fetchMemberNotaInfo(orderNo).then((data) => {
      if (alive) setInfo({ orderNo, data });
    });
    return () => { alive = false; };
  }, [orderNo, preset]);

  return useMemo(() => {
    if (!receipt || preset !== undefined) return receipt;
    if (info.orderNo !== orderNo || !info.data) return receipt;
    return { ...receipt, memberInfo: info.data };
  }, [receipt, preset, info, orderNo]);
}
