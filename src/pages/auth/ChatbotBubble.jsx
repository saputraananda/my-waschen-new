import React, { useState } from 'react';
import { X, Sparkles, HelpCircle } from 'lucide-react';
import maskotLogo from '../../assets/images/maskot.png';

export default function ChatbotBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      
      {/* Information Chat Box */}
      {isOpen && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-[#e0e0e0] overflow-hidden flex flex-col animate-fade-in text-[#313030]">
          
          {/* Header */}
          <div className="bg-[#5f1340] text-white px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-300 animate-pulse" />
              <span className="font-extrabold text-xs">My Waschen Assistant</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="p-4 flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-[#5f1340]/10 flex items-center justify-center flex-shrink-0 text-[#5f1340]">
                <HelpCircle className="h-5 w-5" />
              </div>
              <div className="flex-grow text-xs leading-relaxed text-slate-600 font-semibold">
                Selamat datang! <strong>My Waschen</strong> adalah aplikasi <strong>Point of Sale (POS)</strong> Laundry yang dirancang khusus untuk mempermudah operasional outlet:
                <ul className="list-disc pl-4 mt-2 flex flex-col gap-1 text-slate-500 font-bold">
                  <li>Pencatatan transaksi Kiloan & Satuan.</li>
                  <li>Manajemen database pelanggan (Member).</li>
                  <li>Pengelolaan kas laci (Petty Cash masuk & keluar).</li>
                  <li>Pelacakan progres cuci & setrika order.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer branding */}
          <div className="bg-slate-50 px-4 py-2.5 border-t border-[#e0e0e0] text-[10px] text-slate-400 text-center font-bold">
            &copy; {new Date().getFullYear()} PT Waschen Alora Indonesia
          </div>
        </div>
      )}

      {/* Mascot Trigger Button */}
      <div 
        className="flex items-center gap-3.5 cursor-pointer group" 
        onClick={() => setIsOpen(!isOpen)}
      >
        {/* Speech Invite Bubble (shown if chat is closed) */}
        {!isOpen && (
          <div className="bg-white text-[#5f1340] border border-[#e0e0e0] px-4 py-2 rounded-full text-xs font-black shadow-lg animate-bounce-short select-none group-hover:scale-105 transition-transform duration-200">
            Hi, Welcome To My Waschen!
          </div>
        )}

        {/* Enlarged Mascot Image */}
        <img
          src={maskotLogo}
          alt="Mascot Helper"
          className="h-28 w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition-transform duration-250 group-hover:scale-110 active:scale-95"
        />
      </div>

    </div>
  );
}
