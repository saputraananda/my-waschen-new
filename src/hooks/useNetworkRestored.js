import { useEffect, useRef } from 'react';

/** Muat ulang data yang gagal saat sinyal hilang, begitu koneksi kembali. */
export function useNetworkRestored(reload) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    const onRestored = () => reloadRef.current?.();
    window.addEventListener('waschen:network-restored', onRestored);
    return () => window.removeEventListener('waschen:network-restored', onRestored);
  }, []);
}
