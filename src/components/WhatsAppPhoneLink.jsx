import React from 'react';

/** Nomor HP → link chat WhatsApp (08xx / 8xx / +62xx → 62xx). */
export function waChatUrl(rawPhone) {
  let digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith('8')) digits = `62${digits}`;
  return digits.length >= 9 ? `https://wa.me/${digits}` : null;
}

/**
 * Nomor customer yang bisa dipencet → buka chat WhatsApp di tab baru.
 * stopPropagation supaya klik tidak ikut membuka detail baris/kartu.
 */
export default function WhatsAppPhoneLink({ phone, className = '' }) {
  const url = waChatUrl(phone);
  if (!url) return <span className={className}>{phone}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Chat WhatsApp"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className={`underline-offset-2 hover:underline hover:text-emerald-600 cursor-pointer ${className}`}
    >
      {phone}
    </a>
  );
}
