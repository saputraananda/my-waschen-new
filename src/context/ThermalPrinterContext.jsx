import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  connectThermalPrinter,
  disconnectThermalPrinter,
  isPrinterConnected,
  isSerialSupported,
  writeToThermalPrinter,
  getConnectedPortInfo,
  formatSerialConnectError
} from '../utils/thermalPrinter.js';
import { buildEscPosDualNota, buildEscPosNota } from '../utils/escpos.js';

const ThermalPrinterContext = createContext(null);

export function ThermalPrinterProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [portInfo, setPortInfo] = useState(null);
  const [lastError, setLastError] = useState(null);
  const supported = isSerialSupported();

  const syncStatus = useCallback(() => {
    const ok = isPrinterConnected();
    setConnected(ok);
    setPortInfo(ok ? getConnectedPortInfo() : null);
  }, []);

  // Jangan auto-open port saat load — sering bentrok dengan Bluetooth Windows
  // dan menyebabkan "Failed to open serial port" saat user Hubungkan manual.
  useEffect(() => {
    const onDisconnect = () => {
      setConnected(false);
      setPortInfo(null);
    };
    navigator.serial?.addEventListener?.('disconnect', onDisconnect);
    return () => {
      navigator.serial?.removeEventListener?.('disconnect', onDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setLastError(null);
    try {
      const info = await connectThermalPrinter();
      setConnected(true);
      setPortInfo(info);
      return info;
    } catch (err) {
      const msg = formatSerialConnectError(err);
      setLastError(msg);
      setConnected(false);
      const friendly = new Error(msg);
      friendly.name = err?.name || 'SerialConnectError';
      throw friendly;
    } finally {
      setConnecting(false);
      syncStatus();
    }
  }, [syncStatus]);

  const disconnect = useCallback(async () => {
    setLastError(null);
    await disconnectThermalPrinter();
    setConnected(false);
    setPortInfo(null);
  }, []);

  /**
   * Cetak 1 nota sesuai variant (customer | internal).
   */
  const printNota = useCallback(async (receipt, settings, variant = 'customer') => {
    if (!isPrinterConnected()) {
      throw new Error('Printer belum terhubung. Buka Setting Printer → Hubungkan Printer.');
    }
    const bytes = await buildEscPosNota(receipt, settings, variant);
    await writeToThermalPrinter(bytes);
  }, []);

  /**
   * Cetak 2 nota (internal + customer) ke printer yang sudah connect.
   */
  const printDualNota = useCallback(async (receipt, customerSettings, internalSettings) => {
    if (!isPrinterConnected()) {
      throw new Error('Printer belum terhubung. Buka Setting Printer → Hubungkan Printer.');
    }
    const bytes = await buildEscPosDualNota(receipt, customerSettings, internalSettings);
    await writeToThermalPrinter(bytes);
  }, []);

  const value = {
    supported,
    connected,
    connecting,
    portInfo,
    lastError,
    connect,
    disconnect,
    printNota,
    printDualNota,
    syncStatus
  };

  return (
    <ThermalPrinterContext.Provider value={value}>
      {children}
    </ThermalPrinterContext.Provider>
  );
}

export function useThermalPrinter() {
  const ctx = useContext(ThermalPrinterContext);
  if (!ctx) {
    throw new Error('useThermalPrinter harus di dalam ThermalPrinterProvider');
  }
  return ctx;
}

export function useThermalPrinterOptional() {
  return useContext(ThermalPrinterContext);
}
