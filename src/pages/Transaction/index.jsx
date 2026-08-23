import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { formatName } from '../../utils/FormatName';
import {
  ShoppingBag as IconBag,
  Users as IconUsers,
  Plus as IconPlus,
  Search as IconSearch,
  CheckCircle2 as IconCheckCircle,
  Printer as IconPrinter,
  X as IconX,
  Sparkles as IconSparkles,
  ChevronRight as IconChevronRight,
  ChevronLeft as IconChevronLeft,
  MapPin as IconMapPin,
  Truck as IconTruck,
  Zap as IconZap,
  Tag as IconTag,
  Edit3 as IconEdit,
  Trash2 as IconTrash,
  Clock as IconClock,
  Check as IconCheck,
  ArrowRight as IconArrowRight,
  ArrowLeft as IconArrowLeft,
  CreditCard as IconCreditCard,
  Receipt as IconReceipt
} from 'lucide-react';

// Subcomponents
import SelectCustomer from './components/SelectCustomer.jsx';
import SelectServices from './components/SelectServices.jsx';
import Cart from './components/Cart.jsx';
import Payment from './components/Payment.jsx';
import ThermalNota from './components/ThermalNota.jsx';

// Promo List (mst_promo)
const PROMO_LIST = [
  { id: 'NONE', name: 'Tanpa Promo', code: 'NONE', type: 'nominal', value: 0, desc: 'Harga reguler normal' },
  { id: 'PRM-01', name: 'Promo Weekend Seru', code: 'WEEKEND10', type: 'percentage', value: 10, desc: 'Diskon 10% seluruh layanan' },
  { id: 'PRM-02', name: 'Loyalty VIP Member', code: 'VIP15', type: 'percentage', value: 15, desc: 'Diskon 15% khusus member' },
  { id: 'PRM-03', name: 'Potongan Waschen Hemat', code: 'HEMAT10K', type: 'nominal', value: 10000, desc: 'Potongan langsung Rp 10.000' }
];

export default function TransactionPage() {
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
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

  // STEP WIZARD STATE: 1: Customer -> 2: Layanan -> 3: Keranjang -> 4: Pembayaran
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Customer State (Pure live from database)
  const [customers, setCustomers] = useState([]);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('Semua');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('Semua');
  const [custCurrentPage, setCustCurrentPage] = useState(1);
  const custItemsPerPage = 9;

  // Step 2: Layanan State (Pure live from database)
  const [servicesList, setServicesList] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('Semua');
  const [serviceCurrentPage, setServiceCurrentPage] = useState(1);
  const serviceItemsPerPage = 6;

  // Step 3: Keranjang State
  const [cartItems, setCartItems] = useState([]);
  const [selectedPerfume, setSelectedPerfume] = useState('Standar');
  const [isExpress, setIsExpress] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState('NONE');
  const [isDelivery, setIsDelivery] = useState(false);
  const [generalOrderNotes, setGeneralOrderNotes] = useState('');

  // Step 4: Pembayaran State
  const [paymentStatus, setPaymentStatus] = useState('Belum Lunas');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');

  // Item Config Modal
  const [configuringItem, setConfiguringItem] = useState(null);
  const [itemSpecs, setItemSpecs] = useState({
    qty: 1,
    weight: 4,
    brand: '',
    color: '',
    material: '',
    size: '',
    note: ''
  });

  // Receipt Modal
  const [createdOrderReceipt, setCreatedOrderReceipt] = useState(null);

  // Authenticate session & sync branch
  useEffect(() => {
    document.title = 'Order Transaksi POS | Waschen Laundry';
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

    const savedOutlet = localStorage.getItem('activeOutletName');
    if (savedOutlet && savedOutlet !== 'Outlet Waschen') {
      setActiveOutletName(savedOutlet);
      setSelectedBranchFilter(savedOutlet);
    } else {
      setActiveOutletName('Waschen Laundry Citra Gran');
      setSelectedBranchFilter('Waschen Laundry Citra Gran');
      localStorage.setItem('activeOutletName', 'Waschen Laundry Citra Gran');
      localStorage.setItem('activeOutletId', '2');
    }

    const autoId = localStorage.getItem('autoSelectCustId');
    if (autoId) {
      setSelectedCustId(autoId);
      setCurrentStep(2); // Auto proceed to Step 2
      localStorage.removeItem('autoSelectCustId');
    }

    axios.get('/api/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));

    // Fetch live customers from myWaschen
    axios.get('/api/customers')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          const mapped = res.data.data.map(c => ({
            id: c.customer_code || `CUST-${String(c.id).padStart(3, '0')}`,
            dbId: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address || '-',
            city: c.city || 'Bekasi',
            landmark: c.landmark || '-',
            homeBranch: c.home_branch || 'Waschen Laundry Citra Gran',
            branch: c.home_branch || 'Waschen Laundry Citra Gran',
            tier: c.tier || 'Reguler',
            totalSpending: parseFloat(c.total_spent) || 0,
            totalTrx: parseInt(c.total_orders) || 0,
            memberBalance: parseFloat(c.deposit_balance) || 0,
            lastOrder: c.updated_at ? new Date(c.updated_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Hari ini',
            frequentServices: ['k1', 's1', 's2']
          }));
          setCustomers(mapped);
        }
      })
      .catch(err => console.error('Gagal mengambil data pelanggan dari API:', err));

    // Fetch live catalog services from myWaschen
    axios.get('/api/services')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          const mapped = res.data.data.map(s => ({
            id: s.code || `s-${s.id}`,
            dbId: s.id,
            name: s.name,
            category: s.category_code === 'KILOAN' || s.unit === 'Kg' ? 'Kiloan' : 'Satuan',
            price: parseFloat(s.price) || 0,
            unit: s.unit || 'Kg',
            duration: '2 Hari (48 Jam)',
            description: s.description || 'Layanan laundry higienis Waschen',
            minWeight: parseFloat(s.min_order_qty) || 4,
            minPrice: (parseFloat(s.min_order_qty) || 4) * (parseFloat(s.price) || 0)
          }));
          setServicesList(mapped);
        }
      })
      .catch(err => console.error('Gagal mengambil layanan dari API:', err));
  }, [navigate]);

  // Auto scroll to top when moving between step wizard steps
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustId);
  }, [customers, selectedCustId]);

  // Filtered and Tier-Prioritized Customer List
  const tierRank = { 'VIP': 1, 'Gold': 2, 'Reguler': 3, 'One-Time': 4 };
  const filteredCustomers = useMemo(() => {
    return customers
      .filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          c.phone.includes(customerSearch) ||
          c.address.toLowerCase().includes(customerSearch.toLowerCase());
        const matchesTier = selectedTierFilter === 'Semua' || c.tier === selectedTierFilter;
        
        let matchesBranch = true;
        if (selectedBranchFilter && selectedBranchFilter !== 'Semua') {
          const filterClean = selectedBranchFilter.toLowerCase().replace('waschen laundry ', '').replace('outlet ', '').trim();
          const custBranchClean = (c.homeBranch || c.branch || '').toLowerCase().replace('waschen laundry ', '').replace('outlet ', '').trim();
          matchesBranch = !c.homeBranch ||
            c.homeBranch === selectedBranchFilter ||
            (custBranchClean.length > 0 && filterClean.length > 0 && (
              custBranchClean.includes(filterClean) || filterClean.includes(custBranchClean)
            ));
        }

        return matchesSearch && matchesTier && matchesBranch;
      })
      .sort((a, b) => {
        const rankA = tierRank[a.tier] || 99;
        const rankB = tierRank[b.tier] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return (b.totalSpending || 0) - (a.totalSpending || 0);
      });
  }, [customers, customerSearch, selectedTierFilter, selectedBranchFilter]);

  // Customer Pagination calculation
  const totalCustPages = Math.ceil(filteredCustomers.length / custItemsPerPage) || 1;
  const paginatedCustomers = useMemo(() => {
    const start = (custCurrentPage - 1) * custItemsPerPage;
    return filteredCustomers.slice(start, start + custItemsPerPage);
  }, [filteredCustomers, custCurrentPage]);

  useEffect(() => {
    setCustCurrentPage(1);
  }, [customerSearch, selectedTierFilter, selectedBranchFilter]);

  // Top 5 Recommendations for Selected Customer
  const topRecommendedServices = useMemo(() => {
    if (!servicesList || servicesList.length === 0) return [];
    if (!selectedCustomer || !selectedCustomer.frequentServices || selectedCustomer.frequentServices.length === 0) {
      return servicesList.slice(0, 5);
    }
    const recs = selectedCustomer.frequentServices
      .map(id => servicesList.find(s => s.id === id))
      .filter(Boolean);
    return recs.length > 0 ? recs.slice(0, 5) : servicesList.slice(0, 5);
  }, [selectedCustomer, servicesList]);

  // Filtered Services List & Pagination
  const filteredServices = useMemo(() => {
    return servicesList.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(serviceSearch.toLowerCase());
      const matchesCat = serviceCategoryFilter === 'Semua' || s.category === serviceCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [servicesList, serviceSearch, serviceCategoryFilter]);

  const totalServicePages = Math.ceil(filteredServices.length / serviceItemsPerPage) || 1;
  const paginatedServices = useMemo(() => {
    const start = (serviceCurrentPage - 1) * serviceItemsPerPage;
    return filteredServices.slice(start, start + serviceItemsPerPage);
  }, [filteredServices, serviceCurrentPage]);

  useEffect(() => {
    setServiceCurrentPage(1);
  }, [serviceSearch, serviceCategoryFilter]);

  // Open item configuration modal before adding to cart
  const handleOpenItemConfig = (service) => {
    setConfiguringItem(service);
    if (service.category === 'Kiloan') {
      setItemSpecs({
        qty: 1,
        weight: 4, // Default bare minimum 4 Kg
        brand: '',
        color: '',
        material: '',
        size: '',
        note: ''
      });
    } else {
      setItemSpecs({
        qty: 1,
        weight: 1,
        brand: '',
        color: '',
        material: '',
        size: '',
        note: ''
      });
    }
  };

  // Add configured item to Cart
  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!configuringItem) return;

    let effectivePrice = 0;
    let qtyDisplay = '';

    if (configuringItem.category === 'Kiloan') {
      const weight = Math.max(0.5, parseFloat(itemSpecs.weight) || 4);
      if (weight < 4) {
        effectivePrice = 36000;
      } else {
        effectivePrice = weight * configuringItem.price;
      }
      qtyDisplay = `${weight.toFixed(1)} Kg`;
    } else {
      const q = Math.max(1, parseInt(itemSpecs.qty, 10) || 1);
      effectivePrice = q * configuringItem.price;
      qtyDisplay = `${q} ${configuringItem.unit}`;
    }

    const newCartItem = {
      cartId: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      serviceId: configuringItem.id,
      name: configuringItem.name,
      category: configuringItem.category,
      unit: configuringItem.unit,
      unitPrice: configuringItem.price,
      duration: configuringItem.duration,
      qty: itemSpecs.qty,
      weight: itemSpecs.weight,
      qtyDisplay,
      effectiveSubtotal: effectivePrice,
      brand: itemSpecs.brand || '-',
      color: itemSpecs.color || '-',
      material: itemSpecs.material || '-',
      size: itemSpecs.size || '-',
      note: itemSpecs.note || '-',
      isExpanded: false
    };

    setCartItems([...cartItems, newCartItem]);
    setConfiguringItem(null);
  };

  // Remove item from cart
  const handleRemoveFromCart = (cartId) => {
    setCartItems(cartItems.filter(item => item.cartId !== cartId));
  };

  // Toggle item detail expansion in cart
  const handleToggleItemExpand = (cartId) => {
    setCartItems(cartItems.map(item => {
      if (item.cartId === cartId) {
        return { ...item, isExpanded: !item.isExpanded };
      }
      return item;
    }));
  };

  // Selected promo details
  const activePromo = PROMO_LIST.find(p => p.code === selectedPromoCode) || PROMO_LIST[0];

  // Financial Calculations
  const calculations = useMemo(() => {
    const rawSubtotal = cartItems.reduce((sum, item) => sum + item.effectiveSubtotal, 0);
    const expressMultiplier = isExpress ? 2 : 1;
    const subtotalAfterExpress = rawSubtotal * expressMultiplier;

    let discountAmount = 0;
    if (activePromo.type === 'percentage') {
      discountAmount = Math.round((subtotalAfterExpress * activePromo.value) / 100);
    } else if (activePromo.type === 'nominal') {
      discountAmount = Math.min(subtotalAfterExpress, activePromo.value);
    }

    const grandTotal = Math.max(0, subtotalAfterExpress - discountAmount);

    return {
      rawSubtotal,
      subtotalAfterExpress,
      discountAmount,
      grandTotal
    };
  }, [cartItems, isExpress, activePromo]);

  // Check if delivery can be enabled (requires non-empty customer address)
  const hasValidAddress = Boolean(selectedCustomer && selectedCustomer.address && selectedCustomer.address.trim() !== '' && selectedCustomer.address !== '-');

  // Handle Order Submit & Receipt Generation via Backend API
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Silakan pilih pelanggan terlebih dahulu!');
      return;
    }
    if (cartItems.length === 0) {
      alert('Keranjang belanja masih kosong! Silakan pilih minimal 1 layanan.');
      return;
    }

    // Determine category
    const hasKiloan = cartItems.some(i => i.category === 'Kiloan' || i.unit === 'Kg');
    const hasSatuan = cartItems.some(i => i.category === 'Satuan' || i.unit !== 'Kg');
    const orderCategory = hasKiloan && hasSatuan ? 'Campuran' : (hasKiloan ? 'Kiloan' : 'Satuan');

    const totalWeightKg = cartItems
      .filter(i => i.category === 'Kiloan' || i.unit === 'Kg')
      .reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);

    const totalPcs = cartItems
      .filter(i => i.category !== 'Kiloan' && i.unit !== 'Kg')
      .reduce((sum, i) => sum + (parseInt(i.qty) || 1), 0);

    try {
      const res = await axios.post('/api/transactions', {
        customerId: selectedCustomer.dbId || 1,
        outletId: parseInt(activeOutletId) || 2,
        cashierEmployeeId: 167,
        orderCategory,
        totalWeightKg,
        totalPcs,
        speedId: isExpress ? 2 : 1,
        speedName: isExpress ? 'Express (1x24 Jam)' : 'Reguler (2 Hari)',
        parfumeName: selectedPerfume,
        subtotal: calculations.rawSubtotal,
        speedSurcharge: calculations.expressSurcharge,
        discountAmount: calculations.discountAmount,
        discountNotes: activePromo.name !== 'NONE' ? activePromo.name : null,
        grandTotal: calculations.grandTotal,
        paymentStatus,
        paymentMethod: paymentStatus === 'Lunas' ? paymentMethod : '-',
        isDelivery,
        deliveryAddress: isDelivery ? (selectedCustomer.address || '-') : null,
        deliveryNotes: isDelivery ? generalOrderNotes : null,
        specialNotes: generalOrderNotes,
        items: cartItems.map(item => ({
          serviceId: item.id?.startsWith('s-') ? 4 : 1,
          serviceName: item.name,
          qty: item.qty,
          unit: item.unit,
          unitPrice: item.price,
          subtotal: item.subtotal || (item.qty * item.price),
          brand: item.brand,
          color: item.color,
          material: item.material,
          size: item.size,
          conditionNotes: item.note
        }))
      });

      const orderResult = res.data?.data;
      const orderId = orderResult?.order_no || `WS-${Date.now().toString().slice(-6)}`;

      const receiptData = {
        id: orderId,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address || '-',
        customerTier: selectedCustomer.tier,
        customerBalance: selectedCustomer.memberBalance || 0,
        branch: activeOutletName,
        cashierName: userProfile?.fullName || 'Staff Kasir',
        items: cartItems,
        perfume: selectedPerfume,
        isExpress,
        promoName: activePromo.name,
        discountAmount: calculations.discountAmount,
        isDelivery,
        generalNotes: generalOrderNotes || '-',
        subtotal: calculations.rawSubtotal,
        subtotalAfterExpress: calculations.subtotalAfterExpress,
        grandTotal: calculations.grandTotal,
        paymentStatus,
        paymentMethod: paymentStatus === 'Lunas' ? paymentMethod : '-',
        createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        estimatedCompletion: isExpress ? '1x24 Jam (Besok Selesai)' : '2-3 Hari Kerja'
      };

      setCreatedOrderReceipt(receiptData);
    } catch (err) {
      console.error('Gagal menyimpan transaksi ke database:', err);
      alert('Gagal memproses transaksi ke database: ' + (err.response?.data?.message || err.message));
    }
  };

  // Helper for Tier Badge
  const renderTierBadge = (tier) => {
    switch (tier) {
      case 'VIP':
        return <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[9px] px-2.5 py-0.5 rounded-full border border-amber-300 shadow-xs uppercase tracking-wider inline-block">VIP</span>;
      case 'Gold':
        return <span className="bg-amber-50 text-amber-900 border border-amber-200 font-extrabold text-[9px] px-2.5 py-0.5 rounded-full inline-block">Gold</span>;
      case 'Reguler':
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[9px] px-2.5 py-0.5 rounded-full inline-block">Reguler</span>;
      default:
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 font-semibold text-[9px] px-2.5 py-0.5 rounded-full inline-block">One-Time</span>;
    }
  };

  // Wizard Steps Configuration
  const stepsConfig = [
    { num: 1, title: 'Customer', desc: 'Pilih Pelanggan', icon: IconUsers },
    { num: 2, title: 'Layanan', desc: 'Pilih Layanan', icon: IconBag },
    { num: 3, title: 'Keranjang', desc: `Rincian Item (${cartItems.length})`, icon: IconReceipt },
    { num: 4, title: 'Pembayaran', desc: 'Selesai & Struk', icon: IconCreditCard }
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

      {/* Main Workspace Layout */}
      <main className="max-w-[1600px] w-full mx-auto p-3 sm:p-5 lg:p-6 flex-grow flex flex-col gap-6">

        {/* STEP PROGRESS BAR HEADER */}
        <div className="bg-white border border-[#e0e0e0] rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar w-full sm:w-auto">
            {stepsConfig.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.num;
              const isPassed = currentStep > step.num;

              return (
                <React.Fragment key={step.num}>
                  <button
                    type="button"
                    onClick={() => {
                      if (step.num === 1) setCurrentStep(1);
                      else if (step.num === 2 && selectedCustomer) setCurrentStep(2);
                      else if (step.num === 3 && selectedCustomer && cartItems.length > 0) setCurrentStep(3);
                      else if (step.num === 4 && selectedCustomer && cartItems.length > 0) setCurrentStep(4);
                    }}
                    disabled={
                      (step.num === 2 && !selectedCustomer) ||
                      ((step.num === 3 || step.num === 4) && cartItems.length === 0)
                    }
                    className={`flex items-center gap-2.5 px-3.5 py-2 rounded-2xl transition-all cursor-pointer text-left shrink-0 ${
                      isActive
                        ? 'bg-[#5f1340] text-white shadow-sm'
                        : isPassed
                        ? 'bg-[#5f1340]/10 text-[#5f1340] hover:bg-[#5f1340]/20'
                        : 'bg-[#f8f8f8] text-slate-400 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                      isActive ? 'bg-white/20 text-white' : isPassed ? 'bg-[#5f1340] text-white' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {isPassed ? <IconCheck className="h-4 w-4 stroke-[3px]" /> : step.num}
                    </div>
                    <div className="min-w-0">
                      <span className="font-black text-xs block leading-tight">{step.title}</span>
                      <span className="text-[10px] opacity-80 block truncate">{step.desc}</span>
                    </div>
                  </button>

                  {idx < stepsConfig.length - 1 && (
                    <IconChevronRight className="h-4 w-4 text-slate-300 shrink-0 hidden sm:block" />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Quick Active Customer Info Indicator */}
          {selectedCustomer && (
            <div className="flex items-center gap-3 bg-[#f8f8f8] border border-[#e0e0e0] px-3.5 py-2 rounded-2xl self-stretch sm:self-auto justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-[#5f1340] text-white font-black text-xs flex items-center justify-center shrink-0">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="font-extrabold text-xs text-[#313030] block truncate">{formatName(selectedCustomer.name)}</span>
                  <span className="text-[10px] text-emerald-700 font-bold block">Saldo: Rp {(selectedCustomer.memberBalance || 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCustId('');
                  setCurrentStep(1);
                }}
                className="text-[10px] font-bold text-[#5f1340] hover:underline whitespace-nowrap pl-2 border-l border-slate-200"
              >
                Ganti
              </button>
            </div>
          )}
        </div>

        {/* STEP 1: CUSTOMER SELECTION */}
        {currentStep === 1 && (
          <SelectCustomer
            customerSearch={customerSearch}
            setCustomerSearch={setCustomerSearch}
            selectedBranchFilter={selectedBranchFilter}
            setSelectedBranchFilter={setSelectedBranchFilter}
            outlets={outlets}
            selectedTierFilter={selectedTierFilter}
            setSelectedTierFilter={setSelectedTierFilter}
            paginatedCustomers={paginatedCustomers}
            activeOutletName={activeOutletName}
            setSelectedCustId={setSelectedCustId}
            setCurrentStep={setCurrentStep}
            formatName={formatName}
            renderTierBadge={renderTierBadge}
            totalCustPages={totalCustPages}
            custCurrentPage={custCurrentPage}
            setCustCurrentPage={setCustCurrentPage}
            filteredCustomers={filteredCustomers}
            navigate={navigate}
          />
        )}

        {/* STEP 2: LAYANAN SELECTION */}
        {currentStep === 2 && (
          <SelectServices
            topRecommendedServices={topRecommendedServices}
            selectedCustomer={selectedCustomer}
            cartItems={cartItems}
            handleOpenItemConfig={handleOpenItemConfig}
            configuringItem={configuringItem}
            setConfiguringItem={setConfiguringItem}
            itemSpecs={itemSpecs}
            setItemSpecs={setItemSpecs}
            handleAddToCart={handleAddToCart}
            serviceCategoryFilter={serviceCategoryFilter}
            setServiceCategoryFilter={setServiceCategoryFilter}
            serviceSearch={serviceSearch}
            setServiceSearch={setServiceSearch}
            paginatedServices={paginatedServices}
            totalServicePages={totalServicePages}
            serviceCurrentPage={serviceCurrentPage}
            setServiceCurrentPage={setServiceCurrentPage}
            setCurrentStep={setCurrentStep}
            calculations={calculations}
          />
        )}

        {/* STEP 3: KERANJANG BELANJA & OPTIONS */}
        {currentStep === 3 && (
          <Cart
            cartItems={cartItems}
            setCurrentStep={setCurrentStep}
            handleRemoveFromCart={handleRemoveFromCart}
            handleToggleItemExpand={handleToggleItemExpand}
            selectedCustomer={selectedCustomer}
            renderTierBadge={renderTierBadge}
            formatName={formatName}
            isExpress={isExpress}
            setIsExpress={setIsExpress}
            selectedPromoCode={selectedPromoCode}
            setSelectedPromoCode={setSelectedPromoCode}
            PROMO_LIST={PROMO_LIST}
            hasValidAddress={hasValidAddress}
            isDelivery={isDelivery}
            setIsDelivery={setIsDelivery}
            selectedPerfume={selectedPerfume}
            setSelectedPerfume={setSelectedPerfume}
            generalOrderNotes={generalOrderNotes}
            setGeneralOrderNotes={setGeneralOrderNotes}
            calculations={calculations}
          />
        )}

        {/* STEP 4: PEMBAYARAN & STRUK NOTA */}
        {currentStep === 4 && (
          <Payment
            setCurrentStep={setCurrentStep}
            selectedCustomer={selectedCustomer}
            formatName={formatName}
            renderTierBadge={renderTierBadge}
            activeOutletName={activeOutletName}
            userProfile={userProfile}
            cartItems={cartItems}
            selectedPerfume={selectedPerfume}
            isExpress={isExpress}
            isDelivery={isDelivery}
            generalOrderNotes={generalOrderNotes}
            calculations={calculations}
            activePromo={activePromo}
            paymentStatus={paymentStatus}
            setPaymentStatus={setPaymentStatus}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            handleCreateOrder={handleCreateOrder}
            createdOrderReceipt={createdOrderReceipt}
            setCreatedOrderReceipt={setCreatedOrderReceipt}
            setSelectedCustId={setSelectedCustId}
            setCartItems={setCartItems}
          />
        )}

      </main>

    </div>
  );
}
