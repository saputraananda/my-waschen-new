import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav.jsx';
import { getSocket, joinOutletRoom } from '../../utils/socket.js';
import { useAppDialog } from '../../context/AppDialogContext.jsx';

// Layout Subcomponents
import Banner from './components/Banner.jsx';
import Menu from './components/Menu.jsx';
import StatCard from './components/StatCard.jsx';
import PettyCashCard from './components/PettyCashCard.jsx';
import TrackingService from './components/TrackingService.jsx';
import ModalLacakNota from '../../components/ModalLacakNota.jsx';
import BadgeShift from './components/BadgeShift.jsx';
import { useShift } from '../../context/ShiftContext.jsx';
import { matchesNotaQueueTab } from '../../utils/notaQueueMeta.js';
import { getCutoffMonthKey } from '../../utils/dateCutoffFilter.js';
import ThermalNota from '../../components/ThermalNota.jsx';
import { mapDbTransactionToReceipt } from '../../utils/printerSettings.js';
import { toCustomerNotaReceipt } from '../../utils/customerNotaWhatsApp.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeShift, shiftChecked, openCloseModal, startOrderFlow, requestOpenShift, mustGateShift } = useShift();
  const { showAlert } = useAppDialog();
  const [userProfile, setUserProfile] = useState(null);
  const refreshTimerRef = useRef(null);
  const fetchSeqRef = useRef(0);

  // Modal Lacak Nota State
  const [isLacakNotaModalOpen, setIsLacakNotaModalOpen] = useState(false);
  const [printReceipt, setPrintReceipt] = useState(null);
  const [printingNotaId, setPrintingNotaId] = useState(null);

  // Filter tanggal bersama: Ringkasan Operasional + Antrean Cucian
  const [dateMode, setDateMode] = useState('cutoff');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [cutoffMonth, setCutoffMonth] = useState(getCutoffMonthKey());
  const dateFilter = { mode: dateMode, start: rangeStart, end: rangeEnd, cutoffMonth };

  // Active role & branch state
  const getInitialOutlet = () => {
    const saved = localStorage.getItem('activeOutletName');
    if (!saved || saved === 'Outlet Waschen') {
      localStorage.setItem('activeOutletName', 'Waschen Laundry Citra Gran');
      localStorage.setItem('activeOutletId', '2');
      return 'Waschen Laundry Citra Gran';
    }
    return saved;
  };

  const [activeOutletName, setActiveOutletName] = useState(getInitialOutlet);
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '2');
  const [outlets, setOutlets] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('outlets') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [monthlyTarget, setMonthlyTarget] = useState(50000000);

  // Live orders state from database
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Live cash logs & float from database (initial_petty_cash, bukan initial_cash)
  const [cashLogs, setCashLogs] = useState([]);
  const [initialPettyCashFloat, setInitialPettyCashFloat] = useState(0);

  // Active Tab for Antrean Table Filtering
  const [activeFilterTab, setActiveFilterTab] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');


  // Authenticate & Session Check
  useEffect(() => {
    document.title = 'Dashboard | Waschen Laundry';
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    const isHq = localStorage.getItem('companyId') === '1';

    setUserProfile({
      username: localStorage.getItem('username') || 'Frontliner',
      fullName: localStorage.getItem('fullName') || 'Kasir Waschen',
      role: isHq ? 'Management Alora' : (localStorage.getItem('activeRole') || 'Frontliner'),
      position: localStorage.getItem('position') || 'Staff Kasir',
      department: localStorage.getItem('department') || 'Operasional Outlet',
      profilePath: localStorage.getItem('profilePath') || ''
    });

    axios.get('/api/masters/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
          localStorage.setItem('outlets', JSON.stringify(res.data.data));
        }
      })
      .catch(err => console.error('Gagal mengambil outlet dari mst_outlet:', err));

  }, [navigate]);

  const fetchLiveDashboardData = useCallback(async () => {
    const getJson = async (url, config) => {
      const opts = { timeout: 20000, ...config };
      try {
        return await axios.get(url, opts);
      } catch (err) {
        // 4xx bukan masalah jaringan — jangan diulang.
        if (err.response && err.response.status < 500) throw err;
        return axios.get(url, opts);
      }
    };

    const mapOrders = (rows) => (rows || []).map(o => ({
          id: o.order_no,
          dbId: o.id,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Pelanggan',
          customerPhone: o.customer_phone || '-',
          customerType: o.customer_tier || 'Regular',
          memberBalance: parseFloat(o.member_balance ?? o.customer_deposit_balance ?? o.deposit_balance ?? 0) || 0,
          customerBalance: parseFloat(o.member_balance ?? o.customer_deposit_balance ?? o.deposit_balance ?? 0) || 0,
          outletId: o.outlet_id,
          branch: o.outlet_name || o.home_branch || activeOutletName,
          serviceType: o.speed_name ? `${o.order_category} - ${o.speed_name}` : o.order_category,
          category: o.order_category,
          qty: o.order_category === 'Kiloan' ? `${o.total_weight_kg} Kg` : `${o.total_pcs} Pcs`,
          perfume: o.parfume_name || 'Standar',
          speed: o.speed_name || 'Reguler',
          totalAmount: parseFloat(o.grand_total) || 0,
          paidAmount: parseFloat(o.paid_amount) || 0,
          paymentStatus: o.payment_status || 'Outstanding',
          paymentMethod: o.payment_method || '-',
          paymentProofUrl: o.payment_proof_url || null,
          workStatus: o.work_status ?? 10,
          pickedUpAt: o.picked_up_at || null,
          isDelivery: o.is_delivery === 1,
          deliveryAddress: o.delivery_address || '',
          deliveryNotes: o.delivery_notes || '',
          customerAddress: o.customer_address || '-',
          rawDate: o.order_date ? new Date(o.order_date) : new Date(),
          createdAt: o.order_date
            ? new Date(o.order_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            : '-',
          logs: o.logs || ['Cetak Nota Diterima'],
          items: o.items && o.items.length > 0 ? o.items.map(it => ({
            id: it.id,
            serviceName: it.service_name,
            qty: `${it.qty} ${it.unit || 'Pcs'}`,
            unitPrice: parseFloat(it.unit_price) || 0,
            subtotal: parseFloat(it.subtotal) || 0,
            status: it.item_work_status || 'Antrean',
            brand: it.brand,
            color: it.color,
            material: it.material,
            size: it.size,
            conditionNotes: it.condition_notes,
            isCleanox: it.is_cleanox === 1,
            fulfillmentType: it.fulfillment_type || (o.is_delivery === 1 ? 'Delivery_Kurir' : 'Ambil_Di_Outlet')
          })) : [
            {
              id: 1,
              serviceName: o.order_category === 'Kiloan' ? 'Cuci Kiloan Reguler' : 'Pakaian Satuan',
              qty: o.order_category === 'Kiloan' ? `${o.total_weight_kg} Kg` : `${o.total_pcs} Pcs`,
              subtotal: parseFloat(o.grand_total) || 0,
              status: 'Antrean'
            }
          ]
        }));

    const seq = ++fetchSeqRef.current;
    setOrdersLoading(true);
    const outletId = localStorage.getItem('activeOutletId') || undefined;
    const ordersTask = getJson('/api/transactions', {
      params: { outlet_id: outletId, _: Date.now() }
    })
      .then((trxRes) => {
        if (seq !== fetchSeqRef.current) return;
        if (trxRes.data && trxRes.data.success) setOrders(mapOrders(trxRes.data.data));
      })
      .catch((err) => {
        console.error('Gagal mengambil transaksi dashboard:', err);
      })
      .finally(() => {
        if (seq === fetchSeqRef.current) setOrdersLoading(false);
      });

    const pettyTask = getJson('/api/petty-cash', {
      params: { outlet_id: outletId }
    })
      .then((pettyRes) => {
        if (!pettyRes.data?.success) return;
        if (pettyRes.data.data) {
          const mappedLogs = pettyRes.data.data
            .filter((p) => (p.status || 'Disetujui') === 'Disetujui')
            .map(p => ({
              id: p.id,
              type: p.type,
              category: p.category,
              amount: parseFloat(p.amount) || 0,
              desc: p.description || 'Pencatatan kas',
              isPettyCash: Number(p.is_petty_cash ?? p.isPettyCash ?? 1) !== 0,
              time: new Date(p.transaction_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
            }));
          setCashLogs(mappedLogs);
        }
        if (typeof pettyRes.data.initialPettyCash === 'number' || typeof pettyRes.data.initialFloat === 'number') {
          setInitialPettyCashFloat(pettyRes.data.initialPettyCash ?? pettyRes.data.initialFloat);
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil petty cash dashboard:', err);
      });

    await Promise.allSettled([ordersTask, pettyTask]);
  }, []);

  useEffect(() => {
    setOrders([]);
    setCashLogs([]);
    setInitialPettyCashFloat(0);
    setMonthlyTarget(0);
    fetchLiveDashboardData();
  }, [activeOutletId, fetchLiveDashboardData]);

  // Realtime: refresh dashboard when backend emits changes
  useEffect(() => {
    const socket = getSocket();
    joinOutletRoom(activeOutletId);

    const scheduleRefresh = (payload = {}) => {
      if (payload.outletId != null && String(payload.outletId) !== String(activeOutletId)) {
        // Still refresh — multi-outlet HQ may want all data; outlet filter is client-side soft
      }
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        fetchLiveDashboardData();
      }, 250);
    };

    socket.on('dashboard:refresh', scheduleRefresh);
    socket.on('transaction:created', scheduleRefresh);
    socket.on('transaction:updated', scheduleRefresh);
    socket.on('transaction:paid', scheduleRefresh);
    socket.on('petty-cash:updated', scheduleRefresh);
    socket.on('customer:updated', scheduleRefresh);
    socket.on('shift:updated', scheduleRefresh);

    return () => {
      socket.off('dashboard:refresh', scheduleRefresh);
      socket.off('transaction:created', scheduleRefresh);
      socket.off('transaction:updated', scheduleRefresh);
      socket.off('transaction:paid', scheduleRefresh);
      socket.off('petty-cash:updated', scheduleRefresh);
      socket.off('customer:updated', scheduleRefresh);
      socket.off('shift:updated', scheduleRefresh);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [activeOutletId, fetchLiveDashboardData]);

  // Fetch monthly target from mst_target_waschen
  useEffect(() => {
    const fetchTargetRevenue = async () => {
      try {
        const outlet = activeOutletName || localStorage.getItem('activeOutletName') || '';
        const now = new Date();
        const res = await axios.get('/api/masters/target', {
          params: {
            outlet_id: activeOutletId || localStorage.getItem('activeOutletId') || undefined,
            outlet,
            tahun: now.getFullYear(),
            bulan: now.getMonth() + 1
          }
        });
        if (res.data && res.data.success && res.data.data.targetNominal) {
          setMonthlyTarget(res.data.data.targetNominal);
        }
      } catch (err) {
        console.warn('Gagal mengambil data target dari mst_target_waschen:', err);
      }
    };

    fetchTargetRevenue();
  }, [activeOutletId, activeOutletName]);

  // Alert helper (AppDialog / AlertModal)
  const showToast = (title, message, type = 'success') => {
    showAlert({ title, message, type });
  };

  // Print Thermal — langsung buka modal ThermalNota (preview + cetak)
  const handlePrintNota = useCallback(async (order) => {
    if (!order?.id) return;
    setPrintingNotaId(order.id);
    try {
      const res = await axios.get(`/api/transactions/${order.id}`);
      if (res.data?.success && res.data.data) {
        setPrintReceipt(mapDbTransactionToReceipt(res.data.data, order.branch || activeOutletName));
        return;
      }
      setPrintReceipt(toCustomerNotaReceipt(order));
    } catch (err) {
      console.warn('fetch receipt for thermal:', err);
      setPrintReceipt(toCustomerNotaReceipt(order));
    } finally {
      setPrintingNotaId(null);
    }
  }, [activeOutletName]);

  // Calculate Key Summary Metrics (petty cash; ringkasan di StatCard)
  // Cash log sum calculations
  const balanceLogs = cashLogs.filter((c) => c.isPettyCash !== false);
  const totalCashIn = balanceLogs.filter(c => c.type === 'Masuk').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalCashOut = balanceLogs.filter(c => c.type === 'Keluar').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const netCashInDrawer = initialPettyCashFloat + totalCashIn - totalCashOut;

  const outletOrders = orders.filter((order) => {
    if (order.outletId == null || order.outletId === '') return true;
    return String(order.outletId) === String(activeOutletId);
  });

  // Filter and search orders list
  const filteredOrders = outletOrders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.serviceType.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilterTab === 'Semua') return matchesSearch;
    return matchesSearch && matchesNotaQueueTab(order, activeFilterTab);
  });

  return (
    <div className="relative min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans antialiased overflow-x-hidden overflow-y-auto">

      {/* Subtle brand glow elements */}
      <div className="absolute top-[-250px] left-[-250px] w-[500px] h-[500px] rounded-full bg-[#5f1340]/4 filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-[#5f1340]/3 filter blur-[150px] pointer-events-none" />

      {/* Main Header / Top navbar */}
      <HeaderNav
        activeOutletName={activeOutletName}
        setActiveOutletName={setActiveOutletName}
        activeOutletId={activeOutletId}
        setActiveOutletId={setActiveOutletId}
        outlets={outlets}
        userProfile={userProfile}
        activeShift={activeShift}
        onRequestCloseShift={openCloseModal}
      />

      {/* Main Workspace Layout — baris atas 3:1, sisanya full width satu kolom. */}
      <main className="relative z-10 max-w-[1600px] w-full mx-auto p-3 sm:p-4 lg:p-6 flex-grow flex flex-col gap-5 lg:gap-6">

        <div className="flex flex-col gap-5 lg:gap-6">
          {mustGateShift && (
            <BadgeShift
              shift={activeShift}
              shiftChecked={shiftChecked}
              currentEmployeeId={localStorage.getItem('employeeId')}
              onOpenClose={openCloseModal}
              onOpenShift={() => requestOpenShift()}
            />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 lg:gap-6 items-stretch">
            <div className="xl:col-span-3 h-full">
              <Banner
                userProfile={userProfile}
                navigate={navigate}
                onOpenLacakNotaModal={() => setIsLacakNotaModalOpen(true)}
                onOrderClick={startOrderFlow}
              />
            </div>

            <div className="xl:col-span-1 h-full">
              <PettyCashCard
                netCashInDrawer={netCashInDrawer}
                initialPettyCashFloat={initialPettyCashFloat}
                totalCashOut={totalCashOut}
                navigate={navigate}
              />
            </div>
          </div>
        </div>

        <Menu navigate={navigate} onOrderClick={startOrderFlow} />

        <StatCard
          orders={outletOrders}
          monthlyTarget={monthlyTarget}
          activeOutletId={activeOutletId}
          activeOutletName={activeOutletName}
          dateFilter={dateFilter}
          setActiveFilterTab={setActiveFilterTab}
        />

        <TrackingService
          filteredOrders={filteredOrders}
          orders={outletOrders}
          ordersLoading={ordersLoading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeFilterTab={activeFilterTab}
          setActiveFilterTab={setActiveFilterTab}
          handlePrintNota={handlePrintNota}
          fetchLiveDashboardData={fetchLiveDashboardData}
          dateMode={dateMode}
          setDateMode={setDateMode}
          rangeStart={rangeStart}
          setRangeStart={setRangeStart}
          rangeEnd={rangeEnd}
          setRangeEnd={setRangeEnd}
          cutoffMonth={cutoffMonth}
          setCutoffMonth={setCutoffMonth}
        />

      </main>

      {/* Modal Lacak Nota Interaktif */}
      <ModalLacakNota
        isOpen={isLacakNotaModalOpen}
        onClose={() => setIsLacakNotaModalOpen(false)}
      />

      <ThermalNota
        createdOrderReceipt={printReceipt}
        onClose={() => setPrintReceipt(null)}
      />

    </div>
  );
}
