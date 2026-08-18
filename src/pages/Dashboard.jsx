import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  LogOut,
  Clock,
  Calendar,
  Plus,
  Search,
  ChevronRight,
  TrendingUp,
  Package,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  Users,
  Settings,
  DollarSign,
  Printer,
  Sparkles,
  Info,
  ChevronDown,
  ShoppingBag,
  ListOrdered,
  PlusCircle,
  X,
  CreditCard,
  Percent,
  Check,
  MapPin,
  Phone
} from 'lucide-react';
import Toast from '../components/Toast.jsx';
import waschenLogo from '../assets/images/waschen.png';

// Mock Services list for pricing reference
const SERVICES_LIST = {
  kiloan: [
    { id: 'k1', name: 'Cuci + Setrika (Wash & Iron)', price: 10000, unit: 'Kg' },
    { id: 'k2', name: 'Cuci Saja (Wash Only)', price: 7000, unit: 'Kg' },
    { id: 'k3', name: 'Setrika Saja (Iron Only)', price: 6000, unit: 'Kg' },
  ],
  satuan: [
    { id: 's1', name: 'Bed Cover (Single)', price: 25000, unit: 'Pcs' },
    { id: 's2', name: 'Bed Cover (Double)', price: 35000, unit: 'Pcs' },
    { id: 's3', name: 'Selimut / Blanket', price: 20000, unit: 'Pcs' },
    { id: 's4', name: 'Jas / Suit Blazer', price: 45000, unit: 'Pcs' },
    { id: 's5', name: 'Jaket Tebal / Coat', price: 30000, unit: 'Pcs' },
    { id: 's6', name: 'Sepatu Premium / Shoes', price: 40000, unit: 'Pcs' },
  ]
};

// Map work status to numeric step and progress percentage
const STATUS_STEPS = {
  'Antrean': { step: 1, percent: 20, color: 'bg-slate-300', text: 'text-slate-500' },
  'Pencucian': { step: 2, percent: 45, color: 'bg-[#5f1340]', text: 'text-[#5f1340]' },
  'Penyetrikaan': { step: 3, percent: 70, color: 'bg-indigo-500', text: 'text-indigo-600' },
  'Siap Diambil': { step: 4, percent: 90, color: 'bg-amber-500', text: 'text-amber-600' },
  'Selesai': { step: 5, percent: 100, color: 'bg-emerald-500', text: 'text-emerald-600' }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast notifications state
  const [toast, setToast] = useState({ isOpen: false, title: '', message: '', type: 'success' });

  // Active role & branch state
  const [activeOutletName, setActiveOutletName] = useState(localStorage.getItem('activeOutletName') || 'Tebet Raya (POS 1)');
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem('activeOutletId') || '');
  const [outlets, setOutlets] = useState([]);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Mock initial orders state
  const [orders, setOrders] = useState([
    {
      id: 'WS-0824001',
      customerName: 'Budi Santoso',
      customerPhone: '08123456789',
      customerType: 'VIP',
      serviceType: 'Cuci + Setrika (Wash & Iron)',
      category: 'Kiloan',
      qty: '4.5 Kg',
      perfume: 'Sakura Premium',
      speed: 'Reguler (2 Hari)',
      totalAmount: 45000,
      paymentStatus: 'Lunas',
      paymentMethod: 'Tunai',
      workStatus: 'Selesai',
      createdAt: 'Hari ini, 10:30',
      logs: ['Order Dibuat', 'Pencucian Selesai', 'Penyetrikaan Selesai', 'Siap Diambil', 'Sudah Diambil']
    },
    {
      id: 'WS-0824002',
      customerName: 'Siti Rahma',
      customerPhone: '08198765432',
      customerType: 'Regular',
      serviceType: 'Bed Cover (Double) + Selimut',
      category: 'Satuan',
      qty: '2 Pcs',
      perfume: 'Lavender Calm',
      speed: 'Kilat (24 Jam)',
      totalAmount: 55000,
      paymentStatus: 'Belum Lunas',
      paymentMethod: '-',
      workStatus: 'Pencucian',
      createdAt: 'Hari ini, 11:15',
      logs: ['Order Dibuat', 'Sedang Dicuci']
    },
    {
      id: 'WS-0824003',
      customerName: 'Andi Wijaya',
      customerPhone: '08567890123',
      customerType: 'VIP',
      serviceType: 'Cuci Saja (Wash Only)',
      category: 'Kiloan',
      qty: '3.0 Kg',
      perfume: 'Lily Sweet',
      speed: 'Express (6 Jam)',
      totalAmount: 42000,
      paymentStatus: 'Lunas',
      paymentMethod: 'QRIS Gopay',
      workStatus: 'Antrean',
      createdAt: 'Hari ini, 13:00',
      logs: ['Order Dibuat']
    },
    {
      id: 'WS-0824004',
      customerName: 'Dewi Lestari',
      customerPhone: '08234567890',
      customerType: 'Regular',
      serviceType: 'Jas / Suit Blazer',
      category: 'Satuan',
      qty: '1 Pcs',
      perfume: 'Tanpa Parfum',
      speed: 'Reguler (2 Hari)',
      totalAmount: 45000,
      paymentStatus: 'Lunas',
      paymentMethod: 'Transfer BCA',
      workStatus: 'Penyetrikaan',
      createdAt: 'Kemarin, 16:45',
      logs: ['Order Dibuat', 'Pencucian Selesai', 'Sedang Disetrika']
    },
    {
      id: 'WS-0824005',
      customerName: 'Eko Prasetyo',
      customerPhone: '08789012345',
      customerType: 'Regular',
      serviceType: 'Cuci + Setrika (Wash & Iron)',
      category: 'Kiloan',
      qty: '5.2 Kg',
      perfume: 'Lavender Calm',
      speed: 'Reguler (2 Hari)',
      totalAmount: 52000,
      paymentStatus: 'Belum Lunas',
      paymentMethod: '-',
      workStatus: 'Siap Diambil',
      createdAt: 'Kemarin, 14:20',
      logs: ['Order Dibuat', 'Pencucian Selesai', 'Penyetrikaan Selesai', 'Siap Diambil']
    }
  ]);

  // Mock initial customers state
  const [customers, setCustomers] = useState([
    { id: 'CUST-001', name: 'Budi Santoso', phone: '08123456789', type: 'VIP', address: 'Jl. Tebet Barat No. 12, Jakarta Selatan' },
    { id: 'CUST-002', name: 'Siti Rahma', phone: '08198765432', type: 'Regular', address: 'Jl. Tebet Timur IV / 5, Jakarta Selatan' },
    { id: 'CUST-003', name: 'Andi Wijaya', phone: '08567890123', type: 'VIP', address: 'Apt. Casablanca Tower B No. 15B' },
    { id: 'CUST-004', name: 'Dewi Lestari', phone: '08234567890', type: 'Regular', address: 'Jl. Pancoran Raya No. 88, Jakarta Selatan' },
    { id: 'CUST-005', name: 'Eko Prasetyo', phone: '08789012345', type: 'Regular', address: 'Jl. Prof. Dr. Saharjo No. 101, Jakarta Selatan' }
  ]);

  // Mock Cash Logs (Kas Kecil)
  const [cashLogs, setCashLogs] = useState([
    { id: 1, type: 'Keluar', category: 'Operasional', amount: 15000, desc: 'Beli Sabun Colek & Sikat Gigi Cucian', time: '10:15' },
    { id: 2, type: 'Keluar', category: 'Listrik / Utilitas', amount: 50000, desc: 'Token Listrik Laundry Tambahan', time: '09:00' },
    { id: 3, type: 'Masuk', category: 'Modal Awal', amount: 200000, desc: 'Uang Modal Awal Kasir Shift Pagi', time: '07:00' }
  ]);

  // Active Tab for Antrean Table Filtering
  const [activeFilterTab, setActiveFilterTab] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isCashLogModalOpen, setIsCashLogModalOpen] = useState(false);
  const [isLayananModalOpen, setIsLayananModalOpen] = useState(false);
  const [isLacakNotaModalOpen, setIsLacakNotaModalOpen] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // New Order Form State (Kalkulator POS)
  const [orderCategory, setOrderCategory] = useState('Kiloan'); // Kiloan | Satuan
  const [selectedCustId, setSelectedCustId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [kiloWeight, setKiloWeight] = useState(1);
  const [satuanItems, setSatuanItems] = useState([
    { id: 's1', name: 'Bed Cover (Single)', price: 25000, qty: 0 },
    { id: 's2', name: 'Bed Cover (Double)', price: 35000, qty: 0 },
    { id: 's3', name: 'Selimut / Blanket', price: 20000, qty: 0 },
    { id: 's4', name: 'Jas / Suit Blazer', price: 45000, qty: 0 },
    { id: 's5', name: 'Jaket Tebal / Coat', price: 30000, qty: 0 },
    { id: 's6', name: 'Sepatu Premium / Shoes', price: 40000, qty: 0 },
  ]);
  const [selectedPerfume, setSelectedPerfume] = useState('Sakura Premium');
  const [orderSpeed, setOrderSpeed] = useState('Reguler'); // Reguler | Kilat | Express
  const [discountCode, setDiscountCode] = useState('');
  const [isDiscountApplied, setIsDiscountApplied] = useState(false);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState('Belum Lunas'); // Lunas | Belum Lunas
  const [paymentMethod, setPaymentMethod] = useState('Tunai');

  // New Customer Form State
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustType, setNewCustType] = useState('Regular');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Cash Log Form State
  const [cashLogType, setCashLogType] = useState('Keluar'); // Masuk | Keluar
  const [cashLogCat, setCashLogCat] = useState('Operasional');
  const [cashLogAmount, setCashLogAmount] = useState('');
  const [cashLogDesc, setCashLogDesc] = useState('');

  // Lacak Nota Form State
  const [lacakNotaInput, setLacakNotaInput] = useState('');
  const [trackedOrder, setTrackedOrder] = useState(null);

  // Authenticate & Session Check
  useEffect(() => {
    document.title = 'POS Laundry | Waschen';
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

    if (isHq) {
      let storedOutlets = [];
      try {
        storedOutlets = JSON.parse(localStorage.getItem('outlets') || '[]');
      } catch (e) {
        storedOutlets = [];
      }
      if (storedOutlets.length > 0) {
        setOutlets(storedOutlets);
      } else {
        axios.get('/api/info/outlets')
          .then(res => {
            if (res.data && res.data.outlets) {
              setOutlets(res.data.outlets);
              localStorage.setItem('outlets', JSON.stringify(res.data.outlets));
            }
          })
          .catch(err => console.error('Gagal mengambil cabang:', err));
      }
    }

    // Start Live Clock
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  // Toast Trigger Helper
  const showToast = (title, message, type = 'success') => {
    setToast({ isOpen: true, title, message, type });
  };

  // Pricing calculation helper
  const calculateTotal = () => {
    let subtotal = 0;

    if (orderCategory === 'Kiloan') {
      const service = SERVICES_LIST.kiloan.find(s => s.id === selectedServiceId);
      if (service) {
        subtotal = service.price * kiloWeight;
      }
    } else {
      satuanItems.forEach(item => {
        subtotal += item.price * item.qty;
      });
    }

    // Speed surcharge
    let speedSurcharge = 0;
    if (orderSpeed === 'Kilat') {
      speedSurcharge = subtotal * 0.5; // +50%
    } else if (orderSpeed === 'Express') {
      speedSurcharge = subtotal * 1.0; // +100%
    }

    const beforeDiscount = subtotal + speedSurcharge;
    const finalDiscount = isDiscountApplied ? beforeDiscount * 0.1 : 0; // 10% discount
    const tax = (beforeDiscount - finalDiscount) * 0.11; // 11% PPN
    const grandTotal = beforeDiscount - finalDiscount + tax;

    return {
      subtotal,
      speedSurcharge,
      discount: finalDiscount,
      tax,
      grandTotal: Math.round(grandTotal)
    };
  };

  const currentCalc = calculateTotal();

  // Reset New Order Form
  const resetOrderForm = () => {
    setOrderCategory('Kiloan');
    setSelectedCustId(customers[0]?.id || '');
    setSelectedServiceId(SERVICES_LIST.kiloan[0]?.id || '');
    setKiloWeight(1);
    setSatuanItems(satuanItems.map(item => ({ ...item, qty: 0 })));
    setSelectedPerfume('Sakura Premium');
    setOrderSpeed('Reguler');
    setDiscountCode('');
    setIsDiscountApplied(false);
    setDiscountAmount(0);
    setPaymentStatus('Belum Lunas');
    setPaymentMethod('Tunai');
  };

  // Handle New Order Submission
  const handleCreateOrder = (e) => {
    e.preventDefault();

    if (!selectedCustId) {
      showToast('Gagal Membuat Order', 'Harap pilih pelanggan terlebih dahulu', 'error');
      return;
    }

    const customer = customers.find(c => c.id === selectedCustId);
    let serviceName = '';
    let qtyDesc = '';

    if (orderCategory === 'Kiloan') {
      const s = SERVICES_LIST.kiloan.find(item => item.id === selectedServiceId);
      serviceName = s ? s.name : 'Layanan Kiloan';
      qtyDesc = `${kiloWeight} Kg`;
    } else {
      const itemsChosen = satuanItems.filter(item => item.qty > 0);
      if (itemsChosen.length === 0) {
        showToast('Gagal Membuat Order', 'Harap tambahkan minimal 1 item satuan', 'error');
        return;
      }
      serviceName = itemsChosen.map(i => i.name).join(', ');
      const totalQty = itemsChosen.reduce((acc, curr) => acc + curr.qty, 0);
      qtyDesc = `${totalQty} Pcs`;
    }

    const nextIdNum = orders.length + 1;
    const newOrderId = `WS-08240${String(nextIdNum).padStart(2, '0')}`;

    const newOrder = {
      id: newOrderId,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerType: customer.type,
      serviceType: serviceName,
      category: orderCategory,
      qty: qtyDesc,
      perfume: selectedPerfume,
      speed: `${orderSpeed} (${orderSpeed === 'Reguler' ? '2 Hari' : orderSpeed === 'Kilat' ? '24 Jam' : '6 Jam'})`,
      totalAmount: currentCalc.grandTotal,
      paymentStatus: paymentStatus,
      paymentMethod: paymentStatus === 'Lunas' ? paymentMethod : '-',
      workStatus: 'Antrean',
      createdAt: 'Baru saja',
      logs: ['Order Dibuat']
    };

    setOrders([newOrder, ...orders]);
    setIsOrderModalOpen(false);
    resetOrderForm();
    showToast('Order Berhasil Dibuat', `Nota ${newOrderId} berhasil tersimpan di sistem!`, 'success');
  };

  // Handle New Customer Register
  const handleRegisterCustomer = (e) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) {
      showToast('Gagal Mendaftar', 'Nama dan Nomor Telepon wajib diisi', 'error');
      return;
    }

    const nextIdNum = customers.length + 1;
    const newCustId = `CUST-${String(nextIdNum).padStart(3, '0')}`;

    const newCust = {
      id: newCustId,
      name: newCustName,
      phone: newCustPhone,
      type: newCustType,
      address: newCustAddress || 'Alamat tidak diisi'
    };

    setCustomers([...customers, newCust]);
    setSelectedCustId(newCustId); // auto select in order dropdown if open
    setIsCustomerModalOpen(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustType('Regular');
    setNewCustAddress('');
    showToast('Registrasi Sukses', `Pelanggan ${newCust.name} berhasil terdaftar.`, 'success');
  };

  // Handle Cash Log input
  const handleSaveCashLog = (e) => {
    e.preventDefault();
    if (!cashLogAmount || !cashLogDesc) {
      showToast('Gagal Mencatat', 'Nominal dan Deskripsi wajib diisi', 'error');
      return;
    }

    const newLog = {
      id: cashLogs.length + 1,
      type: cashLogType,
      category: cashLogCat,
      amount: parseInt(cashLogAmount),
      desc: cashLogDesc,
      time: currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    };

    setCashLogs([newLog, ...cashLogs]);
    setIsCashLogModalOpen(false);
    setCashLogAmount('');
    setCashLogDesc('');
    showToast('Kas Berhasil Dicatat', `Transaksi kas keluar/masuk berhasil disimpan.`, 'success');
  };

  // Handle Lacak Nota Lookup
  const handleLacakNota = (e) => {
    e.preventDefault();
    const found = orders.find(o => o.id.toLowerCase() === lacakNotaInput.trim().toLowerCase() || o.customerName.toLowerCase().includes(lacakNotaInput.toLowerCase()));
    if (found) {
      setTrackedOrder(found);
    } else {
      setTrackedOrder(null);
      showToast('Nota Tidak Ditemukan', `Pencarian "${lacakNotaInput}" tidak menghasilkan kecocokan`, 'error');
    }
  };

  // Quick Action triggers
  const openNewOrderWithCategory = (cat) => {
    setOrderCategory(cat);
    setSelectedCustId(customers[0]?.id || '');
    if (cat === 'Kiloan') {
      setSelectedServiceId(SERVICES_LIST.kiloan[0]?.id || '');
    }
    setIsOrderModalOpen(true);
  };

  // Handle Quick Print Receipt
  const handlePrintNota = (order) => {
    showToast('Mencetak Nota', `Sedang mengirim dokumen cetak nota ${order.id} ke printer Bluetooth thermal...`, 'success');
  };

  // Handle Pay Order in-place
  const handlePayOrder = (orderId) => {
    setOrders(orders.map(o => {
      if (o.id === orderId) {
        return { ...o, paymentStatus: 'Lunas', paymentMethod: 'Tunai (Kasir)' };
      }
      return o;
    }));
    showToast('Pembayaran Diterima', `Nota ${orderId} telah lunas terbayar.`, 'success');
  };

  // Handle Status Update
  const handleUpdateStatus = (orderId, currentStatus) => {
    const statusCycle = ['Antrean', 'Pencucian', 'Penyetrikaan', 'Siap Diambil', 'Selesai'];
    const nextIdx = (statusCycle.indexOf(currentStatus) + 1) % statusCycle.length;
    const nextStatus = statusCycle[nextIdx];

    setOrders(orders.map(o => {
      if (o.id === orderId) {
        return {
          ...o,
          workStatus: nextStatus,
          logs: [...o.logs, `Status diubah ke ${nextStatus}`]
        };
      }
      return o;
    }));

    showToast('Status Diupdate', `Order ${orderId} berganti status ke: ${nextStatus}`, 'success');
  };

  // Quantity controls for Satuan Items
  const adjustSatuanQty = (id, delta) => {
    setSatuanItems(satuanItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  // Statistics calculation for POS summary
  const todayRevenue = orders
    .filter(o => o.paymentStatus === 'Lunas')
    .reduce((acc, curr) => acc + curr.totalAmount, 0);

  const activeOrdersCount = orders.filter(o => o.workStatus !== 'Selesai').length;
  const readyOrdersCount = orders.filter(o => o.workStatus === 'Siap Diambil').length;

  const kiloWeightSum = orders
    .filter(o => o.category === 'Kiloan')
    .reduce((acc, curr) => acc + parseFloat(curr.qty.replace(' Kg', '') || 0), 0);

  // Cash log sum calculations
  const totalCashIn = cashLogs.filter(c => c.type === 'Masuk').reduce((acc, curr) => acc + curr.amount, 0);
  const totalCashOut = cashLogs.filter(c => c.type === 'Keluar').reduce((acc, curr) => acc + curr.amount, 0);
  const netCashInDrawer = 350000 + todayRevenue + totalCashIn - totalCashOut; // 350rb base cash float

  // Filter and search orders list
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.serviceType.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeFilterTab === 'Semua') return matchesSearch;
    if (activeFilterTab === 'Antrean') return matchesSearch && order.workStatus === 'Antrean';
    if (activeFilterTab === 'Proses') return matchesSearch && ['Pencucian', 'Penyetrikaan'].includes(order.workStatus);
    if (activeFilterTab === 'Siap Diambil') return matchesSearch && order.workStatus === 'Siap Diambil';
    if (activeFilterTab === 'Selesai') return matchesSearch && order.workStatus === 'Selesai';
    return matchesSearch;
  });

  return (
    <div className="relative min-h-screen bg-[#f8f8f8] text-[#313030] flex flex-col font-sans antialiased">

      {/* Subtle brand glow elements - extremely light */}
      <div className="absolute top-[-250px] left-[-250px] w-[500px] h-[500px] rounded-full bg-[#5f1340]/4 filter blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-250px] right-[-250px] w-[500px] h-[500px] rounded-full bg-[#5f1340]/3 filter blur-[150px] pointer-events-none" />

      {/* Main Header / Top navbar */}
      <header className="relative z-30 bg-white border-b border-[#e0e0e0]/60 shadow-xs px-4 md:px-6 py-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <div className="flex items-center gap-2.5">
            <img src={waschenLogo} alt="Waschen Laundry Logo" className="h-9 md:h-10 w-auto object-contain transition-transform hover:scale-105" />
            <div className="h-5 w-[1px] bg-[#e0e0e0]" />
            
            {/* Branch selector / badge */}
            {localStorage.getItem('companyId') === '1' ? (
              <div className="relative">
                <select
                  value={activeOutletId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const outlet = outlets.find(o => String(o.id) === String(selectedId));
                    const outletName = outlet ? outlet.full_name || outlet.name : 'Outlet Waschen';
                    localStorage.setItem('activeOutletId', selectedId);
                    localStorage.setItem('activeOutletName', outletName);
                    setActiveOutletId(selectedId);
                    setActiveOutletName(outletName);
                    showToast('Cabang Dialihkan', `Sekarang bekerja di ${outletName}`, 'success');
                  }}
                  className="bg-[#5f1340]/5 hover:bg-[#5f1340]/10 border border-[#5f1340]/25 rounded-full pl-3 pr-7 py-1 text-[10px] md:text-xs font-black text-[#5f1340] outline-hidden cursor-pointer appearance-none min-w-[140px] transition-colors"
                >
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#5f1340]">
                  <ChevronDown className="h-2.5 w-2.5" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-[#5f1340]/5 border border-[#5f1340]/10 rounded-full px-2.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5f1340] animate-pulse" />
                <span className="text-[10px] font-bold text-[#5f1340] uppercase tracking-wider">
                  Outlet: {activeOutletName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Date Time & Shift Info widgets */}
        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 text-xs font-bold text-slate-600">
          
          {/* Shift Details */}
          <div className="text-left leading-tight hidden md:block border-r border-[#e0e0e0] pr-4">
            <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Shift Aktif</span>
            <span className="text-[11px] font-bold text-[#313030] mt-0.5 block">Shift Pagi (07.00 - 15.00)</span>
          </div>

          {/* Clock widget */}
          <div className="flex items-center gap-2 bg-[#f8f8f8] rounded-xl px-3 py-1.5 border border-[#e0e0e0] shadow-xs">
            <Clock className="h-3.5 w-3.5 text-[#5f1340]" />
            <span className="text-[11px] font-mono font-bold text-[#313030]">
              {currentTime.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' })} &bull; {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* User profile dropdown trigger */}
          {userProfile && (
            <div className="relative pl-3 border-l border-[#e0e0e0]">
              <button
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="flex items-center gap-2 text-left focus:outline-none cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#5f1340]/10 to-[#5f1340]/30 border border-[#5f1340]/20 flex items-center justify-center text-[#5f1340] text-xs font-bold overflow-hidden shadow-xs group-hover:scale-105 transition-all duration-200">
                    <img
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userProfile.fullName)}&background=5f1340&color=fff`}
                      alt={userProfile.fullName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                </div>
                <div className="hidden md:block leading-tight">
                  <span className="text-[11px] font-extrabold text-[#313030] block">{userProfile.fullName}</span>
                  <span className="text-[9px] text-[#5f1340] font-black uppercase tracking-wider block mt-0.5">{userProfile.role}</span>
                </div>
                <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {isProfileDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-20 cursor-default" onClick={() => setIsProfileDropdownOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-[#e0e0e0] rounded-2xl shadow-xl py-2 z-30 animate-fade-in text-xs font-semibold text-slate-655">
                    <div className="px-4 py-2 border-b border-slate-100 md:hidden">
                      <span className="block font-black text-slate-700">{userProfile.fullName}</span>
                      <span className="block text-[9px] text-[#5f1340] font-black uppercase tracking-wider mt-0.5">{userProfile.role}</span>
                    </div>
                    <div className="px-4 py-1.5 text-[9px] text-slate-400 uppercase font-black tracking-wider">
                      Opsi Akun
                    </div>
                    <button
                      onClick={() => {
                        localStorage.clear();
                        navigate('/login', { replace: true });
                      }}
                      className="w-full text-left px-4 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer font-bold"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Log Out (Keluar)</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="relative z-10 max-w-[1600px] w-full mx-auto p-3 sm:p-4 lg:p-6 flex-grow grid grid-cols-1 xl:grid-cols-4 gap-5 lg:gap-6">

        {/* Left / Middle Main Column */}
        <div className="xl:col-span-3 flex flex-col gap-5 lg:gap-6">

          {/* Banner: Lighter welcome card overlayed with plum dots, dark text (Clean & Bright) */}
          <div
            className="bg-white border border-[#5f1340]/15 rounded-3xl p-6 sm:p-8 text-[#313030] shadow-xs relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5"
            style={{
              backgroundImage: `radial-gradient(#5f1340 0.5px, transparent 0.5px)`,
              backgroundSize: '16px 16px'
            }}
          >
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-[#5f1340]/5 rounded-full filter blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#5f1340]/10 border border-[#5f1340]/20 text-[#5f1340] text-[9px] font-extrabold uppercase tracking-widest mb-3 animate-pulse">
                <Sparkles className="h-3 w-3 text-[#5f1340]" />
                <span>Waschen Smart POS Active</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#5f1340] tracking-tight leading-none">
                Halo, {userProfile?.fullName.split(' ')[0] || 'Kasir'}!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-md leading-relaxed font-medium">
                Siap mencatat cucian hari ini? Gunakan tombol order cepat di sebelah kanan untuk langsung membuka kalkulator POS.
              </p>
            </div>

            {/* Quick POS buttons */}
            <div className="flex gap-3 w-full sm:w-auto relative z-10">
              <button
                onClick={() => openNewOrderWithCategory('Kiloan')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-black shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <Plus className="h-4.5 w-4.5 stroke-[3px]" />
                Order Kiloan
              </button>
              <button
                onClick={() => openNewOrderWithCategory('Satuan')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-[#f8f8f8] border border-[#5f1340]/40 text-[#5f1340] text-xs font-black shadow-xs hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
              >
                <ShoppingBag className="h-4.5 w-4.5 stroke-[2.5px]" />
                Order Satuan
              </button>
            </div>
          </div>

          {/* Section: Today's Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Metric 1: Revenue */}
            <div className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group">
              <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl flex-shrink-0">
                <DollarSign className="h-5 sm:h-6 w-5 sm:w-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Omset Kasir</span>
                <span className="text-base sm:text-lg font-black text-[#313030] block mt-0.5">Rp {todayRevenue.toLocaleString('id-ID')}</span>
                <div className="flex items-center gap-1 mt-1 text-[9px] text-[#5f1340] font-bold">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>+12.4% dari kemarin</span>
                </div>
              </div>
            </div>

            {/* Metric 2: Active queue */}
            <div className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group">
              <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl flex-shrink-0">
                <Package className="h-5 sm:h-6 w-5 sm:w-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Antrean Aktif</span>
                <span className="text-base sm:text-lg font-black text-[#313030] block mt-0.5">{activeOrdersCount} Nota</span>
                <div className="w-20 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                  <div className="bg-[#5f1340] h-full rounded-full w-2/3" />
                </div>
              </div>
            </div>

            {/* Metric 3: Ready to pick up */}
            <div className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group">
              <div className="p-3 bg-amber-50 text-amber-750 rounded-xl flex-shrink-0">
                <Clock className="h-5 sm:h-6 w-5 sm:w-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Siap Diambil</span>
                <span className="text-base sm:text-lg font-black text-[#313030] block mt-0.5">{readyOrdersCount} Nota</span>
                <span className="text-[9px] text-amber-600 font-bold block mt-1.5">Menunggu diambil</span>
              </div>
            </div>

            {/* Metric 4: Kiloan Weight */}
            <div className="bg-white border border-[#e0e0e0]/70 rounded-2xl p-4 sm:p-5 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-4 relative overflow-hidden group">
              <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-xl flex-shrink-0">
                <Layers className="h-5 sm:h-6 w-5 sm:w-6" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Berat Masuk</span>
                <span className="text-base sm:text-lg font-black text-[#313030] block mt-0.5">{kiloWeightSum.toFixed(1)} Kg</span>
                <div className="flex items-center gap-1.5 mt-2">
                  <svg className="w-10 h-3 text-[#5f1340]" viewBox="0 0 10 3" fill="none">
                    <path d="M0 2.5 L2 2 L4 1.5 L6 2.5 L8 0.5 L10 1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
                  </svg>
                  <span className="text-[8px] text-slate-400">Trend naik</span>
                </div>
              </div>
            </div>

          </div>

          {/* Section: Frontliner Menu POS Grid */}
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Menu Cepat POS Laundry</h3>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3.5">

              <button
                onClick={() => openNewOrderWithCategory('Kiloan')}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-[#5f1340]/5 text-[#5f1340] rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-[#5f1340]/10 transition-all duration-200">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-[#5f1340] transition-colors">Order Baru</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">POS Laundry</span>
              </button>

              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-teal-100/60 transition-all duration-200">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-teal-700 transition-colors">Pelanggan</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Data Member</span>
              </button>

              <button
                onClick={() => setIsCashLogModalOpen(true)}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-amber-100/60 transition-all duration-200">
                  <DollarSign className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-amber-700 transition-colors">Petty Cash</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Kas Outlet</span>
              </button>

              <button
                onClick={() => setIsLacakNotaModalOpen(true)}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-rose-50 text-rose-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-rose-100/60 transition-all duration-200">
                  <FileText className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-rose-700 transition-colors">Lacak Nota</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Cek Cucian</span>
              </button>

              <button
                onClick={() => setIsLayananModalOpen(true)}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-sky-50 text-sky-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-sky-100/60 transition-all duration-200">
                  <Info className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-sky-700 transition-colors">Daftar Tarif</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Kilo & Satuan</span>
              </button>

              <button
                onClick={() => {
                  setActiveFilterTab('Antrean');
                  showToast('Menyaring Antrean', 'Menampilkan order dengan status Antrean', 'success');
                }}
                className="bg-white border border-[#e0e0e0]/80 hover:border-[#5f1340]/60 hover:shadow-md p-4 rounded-2xl transition-all duration-300 flex flex-col items-center text-center group transform hover:-translate-y-1"
              >
                <div className="p-3 bg-purple-50 text-purple-700 rounded-2xl mb-2.5 group-hover:scale-110 group-hover:bg-purple-100/60 transition-all duration-200">
                  <ListOrdered className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-[#313030] group-hover:text-purple-700 transition-colors">Kelola Antrean</span>
                <span className="text-[9px] text-slate-400 mt-1 hidden sm:inline">Antrean Workshop</span>
              </button>

            </div>
          </div>

          {/* Section: Queue / Current Orders Table */}
          <div className="bg-white border border-[#e0e0e0]/70 rounded-3xl shadow-xs flex flex-col overflow-hidden">

            {/* Table Header Controls */}
            <div className="p-5 border-b border-[#e0e0e0]/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#f8f8f8]/30">
              <div>
                <h3 className="text-base font-extrabold text-[#313030] tracking-tight">Antrean Cucian Hari Ini</h3>
                <p className="text-xs text-slate-400 font-medium">Total {filteredOrders.length} order dalam antrean kerja</p>
              </div>

              {/* Search bar */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari Nota, Pelanggan, atau Layanan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-[#e0e0e0] rounded-xl text-xs bg-[#f8f8f8]/60 focus:bg-white focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] outline-none transition-all duration-300 font-medium"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 border-b border-[#e0e0e0]/60 flex gap-2 overflow-x-auto py-2.5 bg-[#f8f8f8]/50">
              {['Semua', 'Antrean', 'Proses', 'Siap Diambil', 'Selesai'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilterTab(tab)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${activeFilterTab === tab
                      ? 'bg-[#5f1340] text-[#f8f8f8] shadow-md border border-transparent'
                      : 'text-slate-500 hover:bg-[#e0e0e0]/40 hover:text-[#313030] border border-[#e0e0e0]/30'
                    }`}
                >
                  {tab === 'Proses' ? 'Sedang Dicuci/Setrika' : tab}
                </button>
              ))}
            </div>

            {/* Responsive Table list with step progress indicators */}
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[850px] sm:min-w-0">
                <thead>
                  <tr className="bg-[#f8f8f8] text-[#313030]/60 text-[10px] uppercase font-black tracking-wider border-b border-[#e0e0e0]/70">
                    <th className="py-4 px-6">Nota & Pelanggan</th>
                    <th className="py-4 px-4">Layanan</th>
                    <th className="py-4 px-3 text-center">Jumlah</th>
                    <th className="py-4 px-4 text-right">Biaya</th>
                    <th className="py-4 px-4 text-center">Pembayaran</th>
                    <th className="py-4 px-5 text-center">Progres Kerja</th>
                    <th className="py-4 px-6 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e0e0e0]/50 text-xs">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-16 text-center text-slate-400 font-bold">
                        Belum ada order laundry di kategori status ini.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const progressInfo = STATUS_STEPS[order.workStatus] || { step: 1, percent: 10, color: 'bg-slate-400', text: 'text-slate-500' };

                      return (
                        <tr key={order.id} className="hover:bg-[#f8f8f8]/40 transition-colors duration-200">
                          {/* Nota & Pelanggan details */}
                          <td className="py-4 px-6">
                            <span className="font-mono font-black text-[#5f1340] text-xs block">{order.id}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-bold text-[#313030] text-sm leading-none">{order.customerName}</span>
                              {order.customerType === 'VIP' ? (
                                <span className="text-[8px] bg-amber-50 text-amber-700 font-extrabold px-2 py-0.5 rounded border border-amber-200">VIP</span>
                              ) : (
                                <span className="text-[8px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">Regular</span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block mt-1">{order.createdAt}</span>
                          </td>

                          {/* Services */}
                          <td className="py-4 px-4">
                            <span className="font-bold text-[#313030]/90 block leading-tight">{order.serviceType}</span>
                            <span className="text-[10px] text-slate-400 block mt-1">{order.perfume} &bull; Kecepatan: <strong className="text-slate-600">{order.speed}</strong></span>
                          </td>

                          {/* Qty weight */}
                          <td className="py-4 px-3 text-center font-extrabold text-slate-600">
                            {order.qty}
                          </td>

                          {/* Cost */}
                          <td className="py-4 px-4 font-black text-[#313030] text-right text-sm">
                            Rp {order.totalAmount.toLocaleString('id-ID')}
                          </td>

                          {/* Payment badge / Pay action */}
                          <td className="py-4 px-4 text-center">
                            <button
                              disabled={order.paymentStatus === 'Lunas'}
                              onClick={() => handlePayOrder(order.id)}
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black transition-all ${order.paymentStatus === 'Lunas'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50 cursor-default'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:shadow-xs active:scale-95 cursor-pointer'
                                }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${order.paymentStatus === 'Lunas' ? 'bg-emerald-500' : 'bg-rose-500 animate-ping'}`} />
                              {order.paymentStatus === 'Lunas' ? 'Lunas' : 'Tagih Pembayaran'}
                            </button>
                          </td>

                          {/* Work Status (Dynamic progressive visual bar) */}
                          <td className="py-4 px-5">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[10px] font-extrabold ${progressInfo.text}`}>
                                {order.workStatus} ({progressInfo.step}/5)
                              </span>
                              {/* Visual progress bar */}
                              <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-[#e0e0e0]/40">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${progressInfo.color}`}
                                  style={{ width: `${progressInfo.percent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Action columns */}
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedOrderDetails(order)}
                                className="px-3 py-1 rounded-lg border border-[#e0e0e0] hover:bg-[#f8f8f8] text-[#313030] font-bold text-[10px] hover:border-slate-300 transition-all shadow-xs"
                              >
                                Detail
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order.id, order.workStatus)}
                                className="px-3 py-1 rounded-lg bg-[#5f1340]/10 hover:bg-[#5f1340]/20 text-[#5f1340] border border-[#5f1340]/20 font-bold text-[10px] transition-all active:scale-95"
                                title="Update Status Pengerjaan (Langkah Selanjutnya)"
                              >
                                Lanjut
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePrintNota(order)}
                                className="p-2 rounded-lg border border-[#e0e0e0] hover:bg-[#f8f8f8] text-slate-400 hover:text-[#313030] transition-colors"
                                title="Cetak Nota Cetak Bluetooth"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            <div className="p-4 border-t border-[#e0e0e0]/70 bg-[#f8f8f8]/60 flex justify-between items-center text-[10px] text-slate-400 font-bold">
              <span>Menampilkan {filteredOrders.length} dari {orders.length} transaksi terdaftar</span>
              <span>Waschen Laundry POS Enterprise v2.0</span>
            </div>

          </div>

        </div>

        {/* Right Sidebar Column */}
        <div className="xl:col-span-1 flex flex-col gap-5 lg:gap-6">

          {/* Laci Kas / Petty Cash Widget - Light and Textured */}
          <div className="bg-white border border-[#e0e0e0]/70 rounded-3xl p-5 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0] mb-4">
              <div>
                <h4 className="text-sm font-extrabold text-[#313030] tracking-tight">Kasir & Laci Kas</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Shift Pagi</p>
              </div>
              <button
                onClick={() => setIsCashLogModalOpen(true)}
                className="p-1.5 text-[#5f1340] hover:bg-[#5f1340]/5 rounded-xl transition-all border border-transparent hover:border-[#5f1340]/15"
                title="Pencatatan kas baru"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Lighter cash drawer card widget */}
            <div
              className="bg-white border border-[#e0e0e0] text-[#313030] rounded-2xl p-5 mb-4 shadow-xs relative overflow-hidden"
              style={{
                backgroundImage: `radial-gradient(#e0e0e0 0.8px, transparent 0.8px)`,
                backgroundSize: '12px 12px'
              }}
            >
              <div className="absolute right-[-15px] bottom-[-15px] opacity-5 pointer-events-none">
                <DollarSign className="w-24 h-24 text-[#5f1340]" />
              </div>

              <div className="relative z-10">
                <span className="text-[9px] uppercase tracking-widest text-slate-400 block font-bold">Uang Tunai Di Laci</span>
                <span className="text-2xl font-black block mt-1 tracking-tight text-[#5f1340]">Rp {netCashInDrawer.toLocaleString('id-ID')}</span>

                <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-[#e0e0e0] text-[9px] text-slate-500 font-bold uppercase">
                  <div>
                    <span className="block text-slate-400 text-[8px] tracking-wider">Kas Awal:</span>
                    <span className="font-extrabold text-[#313030] mt-0.5 block">Rp 350.000</span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[8px] tracking-wider">Kas Keluar:</span>
                    <span className="font-extrabold text-rose-600 mt-0.5 block">Rp {totalCashOut.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Cash logs */}
            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-2.5">Arus Petty Cash Terbaru</span>
            <div className="flex flex-col gap-2.5 max-h-44 overflow-y-auto pr-1">
              {cashLogs.map(log => (
                <div key={log.id} className="p-2.5 rounded-xl bg-[#f8f8f8] border border-[#e0e0e0] flex items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {log.type === 'Keluar' ? (
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg flex-shrink-0 border border-rose-100">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg flex-shrink-0 border border-emerald-100">
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="font-bold text-[#313030] block truncate leading-tight text-[11px]">{log.desc}</span>
                      <span className="text-[8px] text-slate-400 block mt-0.5 font-bold uppercase tracking-wider">{log.time} &bull; {log.category}</span>
                    </div>
                  </div>
                  <span className={`font-bold text-[11px] whitespace-nowrap ${log.type === 'Keluar' ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {log.type === 'Keluar' ? '-' : '+'} Rp {log.amount.toLocaleString('id-ID')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick member list */}
          <div className="bg-white border border-[#e0e0e0]/70 rounded-3xl p-5 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-[#e0e0e0] mb-4">
              <div>
                <h4 className="text-sm font-extrabold text-[#313030] tracking-tight">Member Aktif</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Waschen Club</p>
              </div>
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-xl transition-all"
                title="Daftarkan Member Baru"
              >
                <Plus className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {customers.slice(0, 4).map(cust => (
                <div key={cust.id} className="flex items-center justify-between text-xs pb-2 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#5f1340]/5 text-[#5f1340] border border-[#5f1340]/10 flex items-center justify-center font-black text-xs flex-shrink-0">
                      {cust.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[#313030] block truncate leading-tight">{cust.name}</span>
                        {cust.type === 'VIP' && (
                          <span className="text-[7px] bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded font-black border border-amber-200">VIP</span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5 truncate">{cust.phone}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustId(cust.id);
                      openNewOrderWithCategory('Kiloan');
                    }}
                    className="text-[9px] bg-[#f8f8f8] hover:bg-[#5f1340] hover:text-white border border-[#e0e0e0] px-2.5 py-1 rounded-lg transition-all font-black"
                  >
                    POS
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="w-full py-2.5 border border-dashed border-[#e0e0e0] hover:border-[#5f1340]/30 rounded-2xl text-center text-[9px] font-bold text-slate-500 hover:text-[#5f1340] mt-4 transition-all duration-300"
            >
              Kelola Member &bull; Tambah Baru
            </button>
          </div>

          {/* SOP/Tips section */}
          <div className="bg-[#5f1340]/5 border border-[#5f1340]/10 rounded-3xl p-5 text-xs text-[#313030]/90 relative overflow-hidden">
            <div className="absolute right-[-10px] top-[-10px] w-12 h-12 bg-[#5f1340]/5 rounded-full" />
            <div className="flex items-center gap-2 font-bold text-[#5f1340] mb-2 relative z-10">
              <Info className="h-4 w-4 text-[#5f1340]" />
              <span>SOP Kasir Waschen</span>
            </div>
            <p className="leading-relaxed text-[11px] text-slate-600 relative z-10">
              Selalu konfirmasi ulang detail pakaian, jenis parfum, dan durasi pengerjaan sebelum mencetak struk kasir untuk menghindari keluhan pelanggan di kemudian hari.
            </p>
          </div>

        </div>

      </main>

      {/* ========================================================= */}
      {/* MODAL 1: ORDER BARU (POS CALCULATOR)                      */}
      {/* ========================================================= */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-in">

            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#5f1340]/5 rounded-xl">
                  <ShoppingBag className="h-5 w-5 text-[#5f1340]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#313030] tracking-tight">Kalkulator Order POS</h3>
                  <p className="text-[10px] sm:text-xs text-slate-400">Pencatatan kiloan atau satuan laundry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOrderModalOpen(false);
                  resetOrderForm();
                }}
                className="p-2 hover:bg-[#e0e0e0] rounded-xl text-slate-400 hover:text-[#313030] transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="flex-grow overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-5">

              {/* Category Tab Kiloan vs Satuan */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#f8f8f8] border border-[#e0e0e0]/80 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setOrderCategory('Kiloan')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${orderCategory === 'Kiloan' ? 'bg-white text-[#5f1340] border border-[#e0e0e0] shadow-sm' : 'text-slate-500 hover:text-[#313030]'
                    }`}
                >
                  Laundry Kiloan (Kg)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderCategory('Satuan')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${orderCategory === 'Satuan' ? 'bg-white text-[#5f1340] border border-[#e0e0e0] shadow-sm' : 'text-slate-500 hover:text-[#313030]'
                    }`}
                >
                  Laundry Satuan (Pcs)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                {/* Left Side fields */}
                <div className="flex flex-col gap-3.5 sm:gap-4">
                  {/* Select Customer */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pilih Pelanggan</label>
                    <div className="flex gap-2">
                      <select
                        value={selectedCustId}
                        onChange={(e) => setSelectedCustId(e.target.value)}
                        className="flex-grow px-3.5 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                        required
                      >
                        <option value="" disabled>-- Pilih Pelanggan --</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type} - {c.phone})</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="p-2 bg-[#5f1340]/5 hover:bg-[#5f1340]/10 border border-[#5f1340]/15 text-[#5f1340] rounded-xl transition-all"
                        title="Tambah Pelanggan Baru"
                      >
                        <Plus className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>

                  {/* KILOAN INPUTS */}
                  {orderCategory === 'Kiloan' ? (
                    <>
                      <div>
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Tipe Jasa Kiloan</label>
                        <select
                          value={selectedServiceId}
                          onChange={(e) => setSelectedServiceId(e.target.value)}
                          className="w-full px-3.5 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340]"
                          required
                        >
                          {SERVICES_LIST.kiloan.map(s => (
                            <option key={s.id} value={s.id}>{s.name} - Rp {s.price.toLocaleString('id-ID')}/Kg</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Berat Timbangan (Kg)</label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setKiloWeight(prev => Math.max(0.5, prev - 0.5))}
                            className="w-9 h-9 border border-[#e0e0e0] rounded-xl flex items-center justify-center font-bold text-[#313030] hover:bg-[#f8f8f8] active:bg-[#e0e0e0] text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={kiloWeight}
                            onChange={(e) => setKiloWeight(Math.max(0.1, parseFloat(e.target.value) || 0))}
                            className="flex-grow text-center py-1.5 border border-[#e0e0e0] rounded-xl text-sm font-black focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] outline-none"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setKiloWeight(prev => prev + 0.5)}
                            className="w-9 h-9 border border-[#e0e0e0] rounded-xl flex items-center justify-center font-bold text-[#313030] hover:bg-[#f8f8f8] active:bg-[#e0e0e0] text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* SATUAN INPUTS */
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pilih Item Satuan</label>
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-[#e0e0e0] rounded-2xl p-3 bg-[#f8f8f8]/60">
                        {satuanItems.map(item => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#e0e0e0] last:border-b-0">
                            <div className="min-w-0 pr-2">
                              <span className="font-bold text-[#313030] block truncate leading-tight">{item.name}</span>
                              <span className="text-[9px] text-slate-400">Rp {item.price.toLocaleString('id-ID')} / pcs</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => adjustSatuanQty(item.id, -1)}
                                className="w-6 h-6 rounded-md border border-[#e0e0e0] hover:bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-extrabold text-[#313030] text-xs">{item.qty}</span>
                              <button
                                type="button"
                                onClick={() => adjustSatuanQty(item.id, 1)}
                                className="w-6 h-6 rounded-md border border-[#e0e0e0] hover:bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Perfume choice */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Pilihan Parfum</label>
                    <select
                      value={selectedPerfume}
                      onChange={(e) => setSelectedPerfume(e.target.value)}
                      className="w-full px-3.5 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340]"
                    >
                      <option value="Sakura Premium">Sakura Premium (Wangi Segar)</option>
                      <option value="Lavender Calm">Lavender Calm (Soft Calm)</option>
                      <option value="Lily Sweet">Lily Sweet (Manis Madu)</option>
                      <option value="Pandan Fresh">Pandan Fresh</option>
                      <option value="Tanpa Parfum">Tanpa Parfum / Sensitive</option>
                    </select>
                  </div>
                </div>

                {/* Right Side calculations breakdown */}
                <div className="flex flex-col gap-3.5 sm:gap-4">
                  {/* Speed options */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Kecepatan Pengerjaan (Durasi)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { level: 'Reguler', label: 'Reguler', desc: '2 Hari' },
                        { level: 'Kilat', label: 'Kilat (+50%)', desc: '24 Jam' },
                        { level: 'Express', label: 'Express (+100%)', desc: '6 Jam' }
                      ].map(opt => (
                        <button
                          key={opt.level}
                          type="button"
                          onClick={() => setOrderSpeed(opt.level)}
                          className={`py-2 px-1.5 rounded-2xl border text-center transition-all ${orderSpeed === opt.level
                              ? 'bg-[#5f1340]/5 text-[#5f1340] border-[#5f1340] font-black shadow-xs'
                              : 'bg-white text-slate-600 border-[#e0e0e0] hover:bg-[#f8f8f8]'
                            }`}
                        >
                          <span className="text-[11px] block leading-none">{opt.label}</span>
                          <span className="text-[8px] text-slate-400 block mt-1">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kupon Diskon */}
                  <div>
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Voucher Diskon</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="KODE PROMO (e.g. MEMBER10)"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        className="flex-grow px-3.5 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none uppercase placeholder:normal-case focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (discountCode.trim().toUpperCase() === 'MEMBER10') {
                            setIsDiscountApplied(true);
                            showToast('Diskon Aktif', 'Potongan MEMBER10 (10%) berhasil digunakan', 'success');
                          } else {
                            showToast('Kode Salah', 'Kupon promo tidak valid', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-[#313030] text-white hover:bg-black rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm"
                      >
                        Gunakan
                      </button>
                    </div>
                  </div>

                  {/* Pricing breakdown card (Polished) */}
                  <div className="bg-[#f8f8f8] border border-[#e0e0e0] rounded-2xl p-4 text-[11px] flex flex-col gap-1.5 text-slate-600">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Rincian Nota POS</span>

                    <div className="flex justify-between">
                      <span>Harga Jasa Dasar:</span>
                      <span className="font-semibold text-[#313030]">Rp {currentCalc.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {currentCalc.speedSurcharge > 0 && (
                      <div className="flex justify-between">
                        <span>Biaya Durasi ({orderSpeed}):</span>
                        <span className="font-semibold text-[#5f1340]">+ Rp {currentCalc.speedSurcharge.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    {currentCalc.discount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>Diskon (10% Kupon):</span>
                        <span>- Rp {currentCalc.discount.toLocaleString('id-ID')}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>PPN Pemerintah (11%):</span>
                      <span className="font-semibold">Rp {currentCalc.tax.toLocaleString('id-ID')}</span>
                    </div>

                    <div className="h-[1px] bg-[#e0e0e0] my-1" />

                    <div className="flex justify-between text-[#313030] font-black text-xs sm:text-sm pt-0.5">
                      <span>Grand Total Tagihan:</span>
                      <span className="text-[#5f1340] text-sm sm:text-base">Rp {currentCalc.grandTotal.toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Payment dropdown controls */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Bayar</label>
                      <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                      >
                        <option value="Belum Lunas">Bayar Nanti (Tagihan)</option>
                        <option value="Lunas">Lunas (Bayar Langsung)</option>
                      </select>
                    </div>

                    {paymentStatus === 'Lunas' && (
                      <div>
                        <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Metode Bayar</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="w-full px-3 py-2 border border-[#e0e0e0] rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                        >
                          <option value="Tunai">Tunai / Cash</option>
                          <option value="QRIS Gopay">QRIS Gopay</option>
                          <option value="Transfer BCA">Transfer BCA</option>
                          <option value="Transfer Mandiri">Transfer Mandiri</option>
                        </select>
                      </div>
                    )}
                  </div>

                </div>

              </div>

              {/* Bottom modal actions */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-[#e0e0e0] mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsOrderModalOpen(false);
                    resetOrderForm();
                  }}
                  className="px-4 py-2 border border-[#e0e0e0] hover:bg-[#f8f8f8] text-[#313030] text-xs font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#5f1340]/10 hover:shadow-[#5f1340]/20 active:scale-95"
                >
                  Simpan & Cetak Struk
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DAFTARKAN PELANGGAN BARU                         */}
      {/* ========================================================= */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-[60] bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-teal-600" />
                <h3 className="text-sm font-bold text-[#313030]">Registrasi Pelanggan Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="p-1 hover:bg-[#e0e0e0] rounded-lg text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleRegisterCustomer} className="p-5 flex flex-col gap-3.5 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nomor WhatsApp (HP)</label>
                <input
                  type="tel"
                  placeholder="e.g. 08123456789"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tipe Member</label>
                <select
                  value={newCustType}
                  onChange={(e) => setNewCustType(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                >
                  <option value="Regular">Regular Member</option>
                  <option value="VIP">VIP Member (Potongan 5% default)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Alamat Domisili</label>
                <textarea
                  placeholder="Alamat lengkap pengantaran..."
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] resize-none font-medium"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e0e0e0]">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-1.5 border border-[#e0e0e0] hover:bg-[#f8f8f8] text-[#313030] font-bold rounded-lg"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold rounded-lg transition-all active:scale-95"
                >
                  Daftarkan Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PENCATATAN PETTY CASH (LACI KAS)                  */}
      {/* ========================================================= */}
      {isCashLogModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-bold text-[#313030]">Catat Kas Masuk & Keluar</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCashLogModalOpen(false)}
                className="p-1 hover:bg-[#e0e0e0] rounded-lg text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashLog} className="p-5 flex flex-col gap-4 text-xs">
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl">
                <button
                  type="button"
                  onClick={() => setCashLogType('Keluar')}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${cashLogType === 'Keluar' ? 'bg-white text-rose-700 shadow-xs border border-[#e0e0e0]' : 'text-slate-500'
                    }`}
                >
                  Kas Keluar
                </button>
                <button
                  type="button"
                  onClick={() => setCashLogType('Masuk')}
                  className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${cashLogType === 'Masuk' ? 'bg-white text-emerald-700 shadow-xs border border-[#e0e0e0]' : 'text-slate-500'
                    }`}
                >
                  Kas Masuk
                </button>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Kategori Kas</label>
                <select
                  value={cashLogCat}
                  onChange={(e) => setCashLogCat(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                >
                  <option value="Operasional">Operasional Outlet</option>
                  <option value="Belanja Bahan">Belanja Sabun / Detergen</option>
                  <option value="Listrik / Utilitas">Listrik & Gas Dryer</option>
                  <option value="Kembalian">Modal Kembalian Kasir</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nominal (Rupiah)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    placeholder="e.g. 25000"
                    value={cashLogAmount}
                    onChange={(e) => setCashLogAmount(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none font-bold text-[#313030] focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Keperluan / Keterangan</label>
                <input
                  type="text"
                  placeholder="e.g. Beli detergen cair Rinso 2L"
                  value={cashLogDesc}
                  onChange={(e) => setCashLogDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-[#e0e0e0] bg-white rounded-xl outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e0e0e0] mt-1">
                <button
                  type="button"
                  onClick={() => setIsCashLogModalOpen(false)}
                  className="px-4 py-1.5 border border-[#e0e0e0] hover:bg-[#f8f8f8] text-[#313030] font-bold rounded-lg"
                >
                  Batalkan
                </button>
                <button
                  type="submit"
                  className="px-4.5 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold rounded-lg transition-all active:scale-95"
                >
                  Simpan Transaksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DAFTAR TARIF / PRICING LIST                      */}
      {/* ========================================================= */}
      {isLayananModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-xl shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-sky-700" />
                <h3 className="text-sm font-bold text-[#313030]">Daftar Tarif & Jasa Layanan Waschen</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLayananModalOpen(false)}
                className="p-1 hover:bg-[#e0e0e0] rounded-lg text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-5 text-xs max-h-[70vh] overflow-y-auto bg-white">

              {/* Kiloan prices */}
              <div>
                <span className="text-[10px] font-bold text-[#5f1340] uppercase tracking-wider block mb-2">Jasa Kiloan (Cuci & Setrika)</span>
                <div className="grid grid-cols-1 gap-2">
                  {SERVICES_LIST.kiloan.map(s => (
                    <div key={s.id} className="p-3 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl flex justify-between items-center">
                      <span className="font-bold text-[#313030]">{s.name}</span>
                      <span className="font-extrabold text-[#5f1340]">Rp {s.price.toLocaleString('id-ID')} / {s.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Satuan prices */}
              <div>
                <span className="text-[10px] font-bold text-[#5f1340] uppercase tracking-wider block mb-2">Jasa Satuan Premium</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICES_LIST.satuan.map(s => (
                    <div key={s.id} className="p-2.5 bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl flex justify-between items-center">
                      <span className="font-bold text-[#313030] leading-tight truncate">{s.name}</span>
                      <span className="font-extrabold text-[#5f1340] whitespace-nowrap ml-2">Rp {s.price.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Surcharge rules */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl leading-relaxed">
                <span className="font-bold block mb-1">Ketentuan Biaya Kecepatan (Speed Charge):</span>
                <ul className="list-disc pl-4 space-y-1 text-[11px] font-medium text-slate-700">
                  <li><strong>Reguler (2 Hari):</strong> Tarif dasar normal.</li>
                  <li><strong>Kilat (24 Jam / 1 Hari):</strong> Tambahan biaya +50% dari harga dasar.</li>
                  <li><strong>Express (6 Jam / Hari Sama):</strong> Tambahan biaya +100% dari harga dasar.</li>
                </ul>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: LACAK NOTA / TIMELINE TRACKING                   */}
      {/* ========================================================= */}
      {isLacakNotaModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-rose-700" />
                <h3 className="text-sm font-bold text-[#313030]">Lacak Cucian Nota</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsLacakNotaModalOpen(false);
                  setLacakNotaInput('');
                  setTrackedOrder(null);
                }}
                className="p-1 hover:bg-[#e0e0e0] rounded-lg text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs bg-white">
              <form onSubmit={handleLacakNota} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Masukkan Nomor Nota (e.g. WS-0824001) atau Nama..."
                  value={lacakNotaInput}
                  onChange={(e) => setLacakNotaInput(e.target.value)}
                  className="flex-grow px-3.5 py-2 border border-[#e0e0e0] rounded-xl bg-white outline-none focus:ring-2 focus:ring-[#5f1340]/15 focus:border-[#5f1340] font-medium"
                  required
                />
                <button
                  type="submit"
                  className="px-4.5 py-2 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  Cari
                </button>
              </form>

              {/* Display Result timeline */}
              {trackedOrder ? (
                <div className="border border-[#e0e0e0] rounded-2xl p-4 flex flex-col gap-3.5 bg-[#f8f8f8]/60">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono font-black text-[#5f1340] block text-sm">{trackedOrder.id}</span>
                      <span className="font-bold text-[#313030] text-[13px] block mt-0.5">{trackedOrder.customerName}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{trackedOrder.customerPhone} &bull; {trackedOrder.customerType}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${trackedOrder.paymentStatus === 'Lunas' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                      {trackedOrder.paymentStatus}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-[#e0e0e0] text-[11px] text-slate-600 space-y-1">
                    <div><strong>Layanan:</strong> {trackedOrder.serviceType} ({trackedOrder.category})</div>
                    <div><strong>Kuantitas:</strong> {trackedOrder.qty}</div>
                    <div><strong>Aroma Parfum:</strong> {trackedOrder.perfume}</div>
                    <div><strong>Kecepatan:</strong> {trackedOrder.speed}</div>
                    <div><strong>Total Tagihan:</strong> Rp {trackedOrder.totalAmount.toLocaleString('id-ID')}</div>
                  </div>

                  {/* Step Timeline */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Progress Timeline</span>
                    <div className="flex flex-col gap-4 pl-4 relative border-l-2 border-slate-200 ml-1.5">
                      {['Order Dibuat', 'Pencucian', 'Penyetrikaan', 'Siap Diambil', 'Selesai'].map((step, idx) => {
                        const statusCycle = ['Antrean', 'Pencucian', 'Penyetrikaan', 'Siap Diambil', 'Selesai'];
                        const currentOrderIdx = statusCycle.indexOf(trackedOrder.workStatus);

                        const isDone = currentOrderIdx >= idx;
                        const isCurrent = currentOrderIdx === idx;

                        return (
                          <div key={step} className="relative flex items-center gap-3">
                            <div className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 ${isDone ? 'bg-[#5f1340] border-[#5f1340]' : 'bg-white border-slate-300'
                              } ${isCurrent ? 'ring-4 ring-[#5f1340]/25 animate-pulse' : ''}`} />

                            <div className="pl-1">
                              <span className={`text-[11px] font-bold block ${isDone ? 'text-[#313030]' : 'text-slate-400'}`}>
                                {step} {isCurrent && '(Proses Ini)'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                lacakNotaInput && (
                  <div className="py-8 text-center text-slate-400 font-bold">
                    Transaksi nota tidak ditemukan. Periksa kembali kode nota Anda.
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DETAILED DIALOG FOR AN ORDER VIEW                          */}
      {/* ========================================================= */}
      {selectedOrderDetails && (
        <div className="fixed inset-0 z-50 bg-[#313030]/60 backdrop-blur-md flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl border border-[#e0e0e0] w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-4 border-b border-[#e0e0e0] flex justify-between items-center bg-[#f8f8f8]">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#5f1340]" />
                <h3 className="text-sm font-bold text-[#313030]">Rincian & Log Order</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetails(null)}
                className="p-1 hover:bg-[#e0e0e0] rounded-lg text-slate-400 transition-colors"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-xs bg-white">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-black text-[#5f1340] text-sm block">{selectedOrderDetails.id}</span>
                  <span className="font-bold text-[#313030] text-[13px] block mt-0.5">{selectedOrderDetails.customerName}</span>
                  <span className="text-[9px] text-slate-400 block mt-0.5">{selectedOrderDetails.customerPhone} ({selectedOrderDetails.customerType})</span>
                </div>
                <div className="text-right">
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${selectedOrderDetails.paymentStatus === 'Lunas' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                    {selectedOrderDetails.paymentStatus}
                  </span>
                  <span className="text-[9px] text-slate-400 block mt-1">{selectedOrderDetails.paymentMethod}</span>
                </div>
              </div>

              <div className="bg-[#f8f8f8] p-3.5 rounded-xl border border-[#e0e0e0] text-[11px] text-[#313030]/80 space-y-1.5">
                <div><strong>Kategori:</strong> {selectedOrderDetails.category}</div>
                <div><strong>Layanan Spesifik:</strong> {selectedOrderDetails.serviceType}</div>
                <div><strong>Kuantitas / Berat:</strong> {selectedOrderDetails.qty}</div>
                <div><strong>Wewangian Parfum:</strong> {selectedOrderDetails.perfume}</div>
                <div><strong>Kecepatan Kerja:</strong> {selectedOrderDetails.speed}</div>
                <div><strong>Terdaftar Pada:</strong> {selectedOrderDetails.createdAt}</div>
                <div className="h-[1px] bg-[#e0e0e0] my-2" />
                <div className="flex justify-between text-[#313030] font-black text-[12px] pt-0.5">
                  <span>Grand Total Tagihan:</span>
                  <span className="text-[#5f1340]">Rp {selectedOrderDetails.totalAmount.toLocaleString('id-ID')}</span>
                </div>
              </div>

              {/* Status Update Logs */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Riwayat Log Order</span>
                <div className="flex flex-col gap-2 max-h-28 overflow-y-auto border border-[#e0e0e0] rounded-xl p-2.5 bg-[#f8f8f8]">
                  {selectedOrderDetails.logs.map((log, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="p-0.5 bg-[#5f1340]/10 text-[#5f1340] rounded-full mt-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                      <div>
                        <span className="font-bold text-[#313030]/90 block text-[9px]">{log}</span>
                        <span className="text-[8px] text-slate-400">Tercatat oleh Sistem Kasir</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#e0e0e0] mt-1">
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetails(null)}
                  className="px-4 py-1.5 border border-[#e0e0e0] hover:bg-[#f8f8f8] text-[#313030] font-bold rounded-lg"
                >
                  Tutup Detail
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handlePrintNota(selectedOrderDetails);
                    setSelectedOrderDetails(null);
                  }}
                  className="px-4 py-1.5 bg-[#5f1340] hover:bg-[#4d0f33] text-white font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-xs"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak Nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast popup */}
      <Toast
        isOpen={toast.isOpen}
        title={toast.title}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ ...toast, isOpen: false })}
      />
    </div>
  );
}
