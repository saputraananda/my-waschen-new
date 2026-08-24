import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import AlertModal from '../components/dialog/AlertModal.jsx';
import ConfirmModal from '../components/dialog/ConfirmModal.jsx';
import PromptModal from '../components/dialog/PromptModal.jsx';

const AppDialogContext = createContext(null);

export function AppDialogProvider({ children }) {
  const [alertState, setAlertState] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [promptState, setPromptState] = useState(null);

  const showAlert = useCallback(({ title, message, desc, type = 'warning', confirmLabel = 'Mengerti' }) => {
    const text = message || desc || '';
    return new Promise((resolve) => {
      setAlertState({
        title: title || 'Perhatian',
        desc: text,
        type,
        confirmLabel,
        onClose: () => {
          setAlertState(null);
          resolve();
        }
      });
    });
  }, []);

  const showConfirm = useCallback(({
    title,
    message,
    desc,
    confirmLabel = 'Ya, Lanjutkan',
    cancelLabel = 'Batal',
    variant = 'danger',
    loading = false
  }) => {
    const text = message || desc || '';
    return new Promise((resolve) => {
      setConfirmState({
        title: title || 'Konfirmasi',
        desc: text,
        confirmLabel,
        cancelLabel,
        variant,
        loading,
        onClose: () => {
          setConfirmState(null);
          resolve(false);
        },
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        }
      });
    });
  }, []);

  const showPrompt = useCallback(({
    title,
    message,
    desc,
    defaultValue = '',
    placeholder = '',
    inputLabel = 'Input',
    submitLabel = 'Simpan',
    cancelLabel = 'Batal',
    inputMode = 'text'
  }) => {
    const text = message || desc || '';
    return new Promise((resolve) => {
      setPromptState({
        title: title || 'Masukkan Data',
        desc: text,
        defaultValue,
        placeholder,
        inputLabel,
        submitLabel,
        cancelLabel,
        inputMode,
        onClose: () => {
          setPromptState(null);
          resolve(null);
        },
        onSubmit: (value) => {
          setPromptState(null);
          resolve(value || null);
        }
      });
    });
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm, showPrompt }), [showAlert, showConfirm, showPrompt]);

  return (
    <AppDialogContext.Provider value={value}>
      {children}

      <AlertModal
        open={Boolean(alertState)}
        title={alertState?.title}
        desc={alertState?.desc}
        type={alertState?.type}
        confirmLabel={alertState?.confirmLabel}
        onClose={alertState?.onClose}
      />

      <ConfirmModal
        open={Boolean(confirmState)}
        title={confirmState?.title}
        desc={confirmState?.desc}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        variant={confirmState?.variant}
        loading={confirmState?.loading}
        onClose={confirmState?.onClose}
        onConfirm={confirmState?.onConfirm}
      />

      <PromptModal
        open={Boolean(promptState)}
        title={promptState?.title}
        desc={promptState?.desc}
        defaultValue={promptState?.defaultValue}
        placeholder={promptState?.placeholder}
        inputLabel={promptState?.inputLabel}
        submitLabel={promptState?.submitLabel}
        cancelLabel={promptState?.cancelLabel}
        inputMode={promptState?.inputMode}
        onClose={promptState?.onClose}
        onSubmit={promptState?.onSubmit}
      />
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider');
  }
  return ctx;
}
