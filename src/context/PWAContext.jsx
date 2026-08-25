import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppDialog } from './AppDialogContext.jsx';
import waschenLogo from '../assets/images/waschen.webp';

const PWAContext = createContext(null);

export function PWAProvider({ children }) {
  const { showAlert } = useAppDialog();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showInstructionModal, setShowInstructionModal] = useState(false);

  useEffect(() => {
    // 1. Check if running in standalone mode (already installed)
    const checkInstalled = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(!!isStandalone);
    };

    checkInstalled();
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e) => setIsInstalled(e.matches);

    try {
      mediaQuery.addEventListener('change', handleDisplayModeChange);
    } catch {
      mediaQuery.addListener?.(handleDisplayModeChange);
    }

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      showAlert({
        title: 'Aplikasi Berhasil Diinstall!',
        message: 'Waschen Laundry telah terpasang di perangkat Anda.',
        type: 'success',
        confirmLabel: 'Mengerti'
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      try {
        mediaQuery.removeEventListener('change', handleDisplayModeChange);
      } catch {
        mediaQuery.removeListener?.(handleDisplayModeChange);
      }
    };
  }, [showAlert]);

  const promptInstall = async () => {
    if (isInstalled) {
      showAlert({
        title: 'Aplikasi Sudah Terinstall',
        message: 'Anda sedang membuka Waschen Laundry dalam mode Aplikasi PWA.',
        type: 'info',
        confirmLabel: 'Mengerti'
      });
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the PWA install prompt');
      } else {
        console.log('User dismissed the PWA install prompt');
      }
      setDeferredPrompt(null);
    } else {
      // Show custom instruction modal for iOS or browsers without native prompt
      setShowInstructionModal(true);
    }
  };

  return (
    <PWAContext.Provider
      value={{
        deferredPrompt,
        isInstallable: !!deferredPrompt || isIOS,
        isInstalled,
        isIOS,
        promptInstall,
        openInstructionModal: () => setShowInstructionModal(true),
        closeInstructionModal: () => setShowInstructionModal(false)
      }}
    >
      {children}

      {/* Custom PWA Installation Guide Modal */}
      {showInstructionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img src={waschenLogo} alt="Waschen Logo" className="h-8 w-auto object-contain" />
                <span className="font-extrabold text-slate-800 text-sm">Install Aplikasi Waschen</span>
              </div>
              <button
                onClick={() => setShowInstructionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="py-5 space-y-4">
              {isIOS ? (
                <div className="space-y-3 text-xs text-slate-600 font-medium">
                  <p className="font-bold text-slate-800">
                    Cara Install di iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-2 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                    <li>
                      Ketuk tombol <span className="font-black text-[#5f1340]">Bagikan (Share)</span> di bagian bawah browser Safari (ikon kotak dengan panah ke atas).
                    </li>
                    <li>
                      Geser ke bawah lalu pilih <span className="font-black text-[#5f1340]">"Tambah ke Layar Utama" (Add to Home Screen)</span>.
                    </li>
                    <li>
                      Ketuk <span className="font-black text-[#5f1340]">"Tambah"</span> di kanan atas.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-600 font-medium">
                  <p className="font-bold text-slate-800">
                    Cara Install di Android / Chrome / Edge:
                  </p>
                  <ol className="list-decimal list-inside space-y-2 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60">
                    <li>
                      Klik menu <span className="font-black text-[#5f1340]">titik tiga (⋮)</span> di pojok kanan atas browser.
                    </li>
                    <li>
                      Pilih <span className="font-black text-[#5f1340]">"Install Waschen Laundry"</span> atau <span className="font-black text-[#5f1340]">"Tambahkan ke Layar Utama"</span>.
                    </li>
                    <li>
                      Konfirmasi instalasi untuk memasang aplikasi di layar perangkat Anda.
                    </li>
                  </ol>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowInstructionModal(false)}
                className="w-full py-2.5 bg-[#5f1340] text-white font-black text-xs rounded-xl hover:bg-[#4a0f32] transition-colors cursor-pointer shadow-md shadow-[#5f1340]/20"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) {
    // Return fallback if used outside provider
    return {
      deferredPrompt: null,
      isInstallable: false,
      isInstalled: false,
      isIOS: false,
      promptInstall: () => {},
      openInstructionModal: () => {},
      closeInstructionModal: () => {}
    };
  }
  return context;
}
