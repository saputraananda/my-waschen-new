import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav.jsx';
import Toast from '../../components/Toast.jsx';
import { getSocket, joinOutletRoom } from '../../utils/socket.js';

// Layout Subcomponents
import Banner from './components/Banner.jsx';
import Menu from './components/Menu.jsx';
import StatCard from './components/StatCard.jsx';
import PettyCashCard from './components/PettyCashCard.jsx';
import CustomerChurn from './components/CustomerChurn.jsx';
import TrackingService from './components/TrackingService.jsx';
import ModalLacakNota from '../../components/ModalLacakNota.jsx';
import BadgeShift from './components/BadgeShift.jsx';
import { useShift } from '../../context/ShiftContext.jsx';
import { matchesWorkStatusTab, getWorkPercentage } from '../../utils/workStatusMeta.js';

export default function Dashboard() {
  const navigate = useNavigate();
  const { activeShift, openCloseModal, startOrderFlow, requestOpenShift } = useShift();
  const [userProfile, setUserProfile] = useState(null);
  const refreshTimerRef = useRef(null);

  // Modal Lacak Nota State
  const [isLacakNotaModalOpen, setIsLacakNotaModalOpen] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState({ isOpen: false, title: '', message: '', type: 'success' });

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
  const [outlets, setOutlets] = useState([]);
  const [monthlyTarget, setMonthlyTarget] = useState(50000000);

  // Live orders state from database
  const [orders, setOrders] = useState([]);

  // Live customers state from database
  const [customers, setCustomers] = useState([]);

  // Live cash logs & float from database
  const [cashLogs, setCashLogs] = useState([]);
  const [initialCashFloat, setInitialCashFloat] = useState(0);

  // Active Tab for Antrean Table Filtering
  const [activeFilterTab, setActiveFilterTab] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Churn Filter State
  const [churnFilter, setChurnFilter] = useState('Semua');

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

    fetchLiveDashboardData();
  }, [navigate]);

  const fetchLiveDashboardData = useCallback(async () => {
    try {
      const [trxRes, custRes, pettyRes] = await Promise.all([
        axios.get('/api/transactions'),
        axios.get('/api/customers'),
        axios.get('/api/petty-cash')
      ]);

      if (trxRes.data && trxRes.data.success) {
        const mappedOrders = (trxRes.data.data || []).map(o => ({
          id: o.order_no,
          dbId: o.id,
          customerId: o.customer_id,
          customerName: o.customer_name || 'Pelanggan',
          customerPhone: o.customer_phone || '-',
          customerType: o.customer_tier || 'Regular',
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
          isDelivery: o.is_delivery === 1,
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
            isCleanox: it.is_cleanox === 1
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
        setOrders(mappedOrders);
      }

      if (custRes.data && custRes.data.success) {
        const mappedCusts = (custRes.data.data || []).map(c => ({
          id: c.customer_code || `CUST-${String(c.id).padStart(3, '0')}`,
          dbId: c.id,
          name: c.name,
          phone: c.phone,
          tier: c.tier || 'Regular',
          memberBalance: parseFloat(c.deposit_balance) || 0
        }));
        setCustomers(mappedCusts);
      }

      if (pettyRes.data && pettyRes.data.success) {
        if (pettyRes.data.data) {
          const mappedLogs = pettyRes.data.data.map(p => ({
            id: p.id,
            type: p.type,
            category: p.category,
            amount: parseFloat(p.amount) || 0,
            desc: p.description || 'Pencatatan kas',
            time: new Date(p.transaction_date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          }));
          setCashLogs(mappedLogs);
        }
        if (typeof pettyRes.data.initialFloat === 'number') {
          setInitialCashFloat(pettyRes.data.initialFloat);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil live data dashboard:', err);
    }
  }, []);

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

  // Calculate Churn Status for each customer
  const customersWithChurn = customers.map(c => {
    const custOrders = orders.filter(o =>
      (o.dbId && c.dbId && Number(o.dbId) === Number(c.dbId)) ||
      (o.customerName && c.name && o.customerName.toLowerCase() === c.name.toLowerCase()) ||
      (o.customerPhone && c.phone && o.customerPhone === c.phone)
    );

    let lastOrderDate = null;
    let daysSinceLast = null;
    let churnStatus = 'Lost';

    if (custOrders.length > 0) {
      const sorted = [...custOrders].sort((a, b) => new Date(b.rawDate || b.createdAt) - new Date(a.rawDate || a.createdAt));
      lastOrderDate = new Date(sorted[0].rawDate || sorted[0].createdAt);
      const diffMs = new Date() - lastOrderDate;
      daysSinceLast = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (daysSinceLast < 21) {
        churnStatus = 'Active';
      } else if (daysSinceLast <= 45) {
        churnStatus = 'Warning';
      } else if (daysSinceLast <= 60) {
        churnStatus = 'Churn';
      } else if (daysSinceLast <= 90) {
        churnStatus = 'Dormant';
      } else {
        churnStatus = 'Lost';
      }
    } else {
      churnStatus = 'Lost';
    }

    return {
      ...c,
      lastOrderDate,
      daysSinceLast,
      churnStatus
    };
  });

  const churnCounts = {
    Semua: customersWithChurn.length,
    Active: customersWithChurn.filter(c => c.churnStatus === 'Active').length,
    Warning: customersWithChurn.filter(c => c.churnStatus === 'Warning').length,
    Churn: customersWithChurn.filter(c => c.churnStatus === 'Churn').length,
    Dormant: customersWithChurn.filter(c => c.churnStatus === 'Dormant').length,
    Lost: customersWithChurn.filter(c => c.churnStatus === 'Lost').length
  };

  const filteredChurnCustomers = customersWithChurn.filter(c => {
    if (churnFilter === 'Semua') return true;
    return c.churnStatus === churnFilter;
  });

  const renderChurnBadge = (status, days) => {
    const daysText = days !== null ? `${days} hari lalu` : 'Belum Transaksi';
    switch (status) {
      case 'Active':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black px-1.5 py-0.5 rounded shadow-2xs">Active &bull; {daysText}</span>;
      case 'Warning':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-black px-1.5 py-0.5 rounded shadow-2xs">Warning &bull; {daysText}</span>;
      case 'Churn':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black px-1.5 py-0.5 rounded shadow-2xs">Churn &bull; {daysText}</span>;
      case 'Dormant':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[8px] font-black px-1.5 py-0.5 rounded shadow-2xs">Dormant &bull; {daysText}</span>;
      case 'Lost':
      default:
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[8px] font-black px-1.5 py-0.5 rounded shadow-2xs">Lost &bull; {daysText}</span>;
    }
  };

  // Fetch monthly target from mst_target_waschen
  useEffect(() => {
    const fetchTargetRevenue = async () => {
      try {
        const outlet = activeOutletName || localStorage.getItem('activeOutletName') || '';
        const now = new Date();
        const res = await axios.get('/api/masters/target', {
          params: {
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
  }, [activeOutletName]);

  // Toast Helper
  const showToast = (title, message, type = 'success') => {
    setToast({ isOpen: true, title, message, type });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isOpen: false }));
  };

  // Print Thermal Slip Trigger
  const handlePrintNota = (order) => {
    showToast('Cetak Nota Thermal', `Mengirim perintah cetak nota ${order.id} ke printer bluetooth POS...`, 'info');
  };

  // Calculate Key Summary Metrics
  const todayRevenue = orders
    .filter(o => o.paymentStatus === 'Lunas')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const activeOrdersCount = orders.filter((o) => {
    const pct = getWorkPercentage(o.workStatus);
    return pct > 0 && pct < 100;
  }).length;
  const readyOrdersCount = orders.filter((o) => matchesWorkStatusTab(o.workStatus, 'Siap Diambil')).length;
  const unpaidOrdersCount = orders.filter(o => o.paymentStatus !== 'Lunas').length;

  // Cash log sum calculations
  const totalCashIn = cashLogs.filter(c => c.type === 'Masuk').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const totalCashOut = cashLogs.filter(c => c.type === 'Keluar').reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const netCashInDrawer = initialCashFloat + totalCashIn - totalCashOut;

  // Filter and search orders list
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.serviceType.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilterTab === 'Semua') return matchesSearch;
    return matchesSearch && matchesWorkStatusTab(order.workStatus, activeFilterTab);
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

      {/* Main Workspace Layout */}
      <main className="relative z-10 max-w-[1600px] w-full mx-auto p-3 sm:p-4 lg:p-6 flex-grow grid grid-cols-1 xl:grid-cols-4 gap-5 lg:gap-6">

        {/* Left / Middle Main Column */}
        <div className="xl:col-span-3 flex flex-col gap-5 lg:gap-6">
          <BadgeShift
            shift={activeShift}
            currentEmployeeId={localStorage.getItem('employeeId')}
            onOpenClose={openCloseModal}
            onOpenShift={() => requestOpenShift()}
          />

          <Banner
            userProfile={userProfile}
            orders={orders}
            showToast={showToast}
            navigate={navigate}
            onOpenLacakNotaModal={() => setIsLacakNotaModalOpen(true)}
            onOrderClick={startOrderFlow}
          />

          <Menu navigate={navigate} onOrderClick={startOrderFlow} />

          <StatCard
            todayRevenue={todayRevenue}
            monthlyTarget={monthlyTarget}
            activeOrdersCount={activeOrdersCount}
            readyOrdersCount={readyOrdersCount}
            unpaidOrdersCount={unpaidOrdersCount}
            orders={orders}
            setActiveFilterTab={setActiveFilterTab}
          />

          <TrackingService
            filteredOrders={filteredOrders}
            orders={orders}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilterTab={activeFilterTab}
            setActiveFilterTab={setActiveFilterTab}
            handlePrintNota={handlePrintNota}
            showToast={showToast}
            fetchLiveDashboardData={fetchLiveDashboardData}
          />
        </div>

        {/* Right Sidebar Column */}
        <div className="xl:col-span-1 flex flex-col gap-5 lg:gap-6">
          <PettyCashCard
            netCashInDrawer={netCashInDrawer}
            initialCashFloat={initialCashFloat}
            totalCashOut={totalCashOut}
            activeOutletId={activeOutletId}
            fetchLiveDashboardData={fetchLiveDashboardData}
            showToast={showToast}
            navigate={navigate}
          />

          <CustomerChurn
            navigate={navigate}
            churnFilter={churnFilter}
            setChurnFilter={setChurnFilter}
            churnCounts={churnCounts}
            filteredChurnCustomers={filteredChurnCustomers}
            renderChurnBadge={renderChurnBadge}
          />
        </div>

      </main>

      {/* Modal Lacak Nota Interaktif */}
      <ModalLacakNota
        isOpen={isLacakNotaModalOpen}
        onClose={() => setIsLacakNotaModalOpen(false)}
      />

      {/* Toast Notification */}
      <Toast
        isOpen={toast.isOpen}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onClose={closeToast}
      />

    </div>
  );
}
