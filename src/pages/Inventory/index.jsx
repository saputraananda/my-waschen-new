import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { useAppDialog } from '../../context/AppDialogContext.jsx';
import StockDashboard from './components/StockDashboard';
import InventoryLogs from './components/InventoryLogs';
import ServiceBomEditor from './components/ServiceBomEditor';
import { Package, ClipboardList, Link2 } from 'lucide-react';
import { isHqUser } from '../../utils/authSession.js';
import { toDateInputValue } from '../../utils/FilterDate.js';

export default function InventoryPage() {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const [userProfile, setUserProfile] = useState(null);
  const [activeOutletName, setActiveOutletName] = useState(
    localStorage.getItem('activeOutletName') || 'Waschen Laundry'
  );
  const [activeOutletId, setActiveOutletId] = useState(
    localStorage.getItem('activeOutletId') || ''
  );
  const [outlets, setOutlets] = useState([]);
  const [activeTab, setActiveTab] = useState('stock');
  const [stockRows, setStockRows] = useState([]);
  const [stockMeta, setStockMeta] = useState({ total: 0, lowStockCount: 0 });
  const [logs, setLogs] = useState([]);
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usageDate, setUsageDate] = useState(toDateInputValue());
  const isAdmin = isHqUser();

  useEffect(() => {
    document.title = 'Manajemen Inventory | Waschen Laundry';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }
    const isHq = localStorage.getItem('companyId') === '1';
    setUserProfile({
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Staff Kasir')
    });

    axios.get('/api/masters/outlets')
      .then((res) => {
        if (res.data?.success) setOutlets(res.data.data || []);
      })
      .catch(() => {});

    axios.get('/api/services')
      .then((res) => {
        if (res.data?.success) setServices(res.data.data || []);
      })
      .catch(() => {});
  }, [navigate]);

  const fetchStock = useCallback(async (outletId = activeOutletId, dateYmd = usageDate) => {
    if (!outletId || outletId === 'Semua') {
      setStockRows([]);
      setStockMeta({ total: 0, lowStockCount: 0 });
      return;
    }
    setLoading(true);
    try {
      await axios.post('/api/inventory/stock/ensure', { outletId: Number(outletId) }).catch(() => {});
      const res = await axios.get('/api/inventory/stock', {
        params: { outlet_id: outletId, usage_date: dateYmd }
      });
      if (res.data?.success) {
        setStockRows(res.data.data || []);
        setStockMeta(res.data.meta || { total: 0, lowStockCount: 0 });
      }
    } catch (err) {
      console.error(err);
      await showAlert({
        title: 'Gagal Muat Stok',
        message: err?.response?.data?.message || err.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [activeOutletId, usageDate, showAlert]);

  const fetchLogs = useCallback(async (outletId = activeOutletId) => {
    try {
      const res = await axios.get('/api/inventory/logs', {
        params: {
          outlet_id: outletId && outletId !== 'Semua' ? outletId : undefined,
          limit: 150
        }
      });
      if (res.data?.success) setLogs(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [activeOutletId]);

  const fetchItems = useCallback(async () => {
    try {
      const res = await axios.get('/api/inventory/items');
      if (res.data?.success) setItems(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!activeOutletId) return;
    fetchStock(activeOutletId, usageDate);
    fetchLogs(activeOutletId);
  }, [activeOutletId, usageDate, fetchStock, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'bom') fetchItems();
    if (activeTab === 'logs') fetchLogs(activeOutletId);
  }, [activeTab, fetchItems, fetchLogs, activeOutletId]);

  const tabs = [
    { id: 'stock', label: 'Stok Outlet', icon: Package },
    { id: 'logs', label: 'Riwayat Mutasi', icon: ClipboardList },
    { id: 'bom', label: 'BOM Layanan', icon: Link2 }
  ];

  return (
    <div className="min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans">
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
      />

      <main className="max-w-[1500px] w-full mx-auto p-4 sm:p-6 flex-grow flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white border border-[#e0e0e0] rounded-3xl p-5 shadow-xs">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#313030] tracking-tight flex items-center gap-2.5">
              <Package className="h-6 w-6 text-[#5f1340]" />
              <span>Manajemen Inventory</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Opname stok per outlet — stok awal, pemakaian seharusnya (BOM), aktual harian, sisa & selisih
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-[#f8f8f8] border border-[#e0e0e0] p-1.5 rounded-2xl w-full lg:w-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 lg:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#5f1340] text-white shadow-xs'
                      : 'text-slate-500 hover:text-[#313030]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'stock' && (
          <StockDashboard
            stockRows={stockRows}
            stockMeta={stockMeta}
            loading={loading}
            activeOutletId={activeOutletId}
            activeOutletName={activeOutletName}
            usageDate={usageDate}
            onUsageDateChange={setUsageDate}
            isAdmin={isAdmin}
            onRefresh={() => {
              fetchStock(activeOutletId, usageDate);
              fetchLogs(activeOutletId);
            }}
          />
        )}

        {activeTab === 'logs' && (
          <InventoryLogs logs={logs} onRefresh={() => fetchLogs(activeOutletId)} />
        )}

        {activeTab === 'bom' && (
          <ServiceBomEditor
            services={services}
            items={items}
          />
        )}
      </main>
    </div>
  );
}
