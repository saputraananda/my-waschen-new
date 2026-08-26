import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import HeaderNav from '../../components/HeaderNav';
import { formatName, formatEmployeeName } from '../../utils/FormatName.js';
import { getBankAccountForOutlet, OUTLET_BANK_ACCOUNTS } from '../../utils/bankAccounts.js';
import { resolvePaymentMethodString } from '../../components/CascadingPaymentSelector.jsx';
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
import FillAddressModal from './components/FillAddressModal.jsx';
import SelectServices from './components/SelectServices.jsx';
import Cart from './components/Cart.jsx';
import Payment from './components/Payment.jsx';
import PinVerifyModal from '../Shift/PinVerifyModal.jsx';
import { formatRupiah, parseRupiah } from '../../utils/FormatRupiah.js';
import { hasCustomerAddress } from '../../utils/NormalizePhone.js';
import { useAppDialog } from '../../context/AppDialogContext.jsx';
import { useShift } from '../../context/ShiftContext.jsx';

// Promo List (mst_promo)
const PROMO_FALLBACK = [
  { code: 'NONE', name: 'Tanpa Promo', type: 'none', value: 0, desc: 'Harga reguler normal' }
];

const mapPromoFromApi = (p) => ({
  id: p.code,
  code: p.code,
  name: p.name,
  type: p.discount_type === 'none' ? 'nominal' : p.discount_type,
  value: Number(p.discount_value) || 0,
  desc: p.description || ''
});

export default function TransactionPage() {
  const navigate = useNavigate();
  const { showAlert } = useAppDialog();
  const { shiftChecked, ensureShiftForOrder, isShiftReady } = useShift();
  const [shiftGateOk, setShiftGateOk] = useState(false);
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
  const [parfumes, setParfumes] = useState([]);
  const [promoList, setPromoList] = useState(PROMO_FALLBACK);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [customerTiers, setCustomerTiers] = useState([]);

  // STEP WIZARD STATE: 1: Customer -> 2: Layanan -> 3: Keranjang -> 4: Pembayaran
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Customer State (Pure live from database)
  const [customers, setCustomers] = useState([]);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [addressModalCustomer, setAddressModalCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedTierFilter, setSelectedTierFilter] = useState('Semua');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('Semua');
  const [custCurrentPage, setCustCurrentPage] = useState(1);
  const custItemsPerPage = 9;

  const loadCustomers = () => {
    axios.get('/api/customers')
      .then(res => {
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
          const mapped = res.data.data.map(c => ({
            id: c.customer_code || `CUST-${String(c.id).padStart(3, '0')}`,
            dbId: c.id,
            name: c.name || '',
            phone: c.phone || '',
            address: c.full_address || c.address || '-',
            fullAddress: c.full_address || '',
            block: c.block || '',
            houseNumber: c.house_number || '',
            notes: c.notes || '',
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
  };

  // Re-fetch customers whenever returning to Step 1 (Select Customer)
  useEffect(() => {
    if (currentStep === 1) {
      loadCustomers();
    }
  }, [currentStep]);

  // Step 2: Layanan State (Pure live from database)
  const [servicesList, setServicesList] = useState([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState('Semua');
  const [serviceCurrentPage, setServiceCurrentPage] = useState(1);
  const serviceItemsPerPage = 6;

  // Step 3: Keranjang State
  const [cartItems, setCartItems] = useState([]);
  const [selectedPerfume, setSelectedPerfume] = useState('');
  const [selectedPerfumeId, setSelectedPerfumeId] = useState(null);
  const [isExpress, setIsExpress] = useState(false);
  const [selectedPromoCode, setSelectedPromoCode] = useState('NONE');
  const [isDelivery, setIsDelivery] = useState(false);
  const [generalOrderNotes, setGeneralOrderNotes] = useState('');

  // Step 4: Pembayaran State
  const [paymentStatus, setPaymentStatus] = useState('Lunas');
  const [isOutstandingDropOff, setIsOutstandingDropOff] = useState(false);
  const [mainCategory, setMainCategory] = useState('Tunai');
  const [edcCardType, setEdcCardType] = useState('Debit Card');
  const [isCrossTransfer, setIsCrossTransfer] = useState(false);
  const [crossBankOutletId, setCrossBankOutletId] = useState(1);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [overpaymentAction, setOverpaymentAction] = useState('change');
  const [paymentProofFile, setPaymentProofFile] = useState(null);

  // Item Config Modal
  const [configuringItem, setConfiguringItem] = useState(null);
  const [itemSpecs, setItemSpecs] = useState({
    qty: 1,
    weight: 4,
    brand: '',
    color: '',
    material: '',
    size: '',
    note: '',
    isCleanox: false
  });

  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingOrderPayload, setPendingOrderPayload] = useState(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

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
    } else {
      setActiveOutletName('Waschen Laundry Citra Gran');
      localStorage.setItem('activeOutletName', 'Waschen Laundry Citra Gran');
      localStorage.setItem('activeOutletId', '2');
    }
    // Default branch filter in POS to 'Semua' so all customers are immediately visible
    setSelectedBranchFilter('Semua');

    const autoId = localStorage.getItem('autoSelectCustId');
    if (autoId) {
      setSelectedCustId(autoId);
      setCurrentStep(2); // Auto proceed to Step 2
      localStorage.removeItem('autoSelectCustId');
    }

    axios.get('/api/masters/outlets')
      .then(res => {
        if (res.data && res.data.success && res.data.data.length > 0) {
          setOutlets(res.data.data);
        }
      })
      .catch(err => console.error('Gagal mengambil data outlet:', err));

    axios.get('/api/services/parfumes')
      .then(res => {
        if (res.data?.success && res.data.data?.length > 0) {
          setParfumes(res.data.data);
          const first = res.data.data[0];
          setSelectedPerfume(first.name);
          setSelectedPerfumeId(first.id);
        }
      })
      .catch(err => console.error('Gagal mengambil data parfum:', err));

    axios.get('/api/masters')
      .then(res => {
        if (!res.data?.success || !res.data.data) return;
        const { promos, paymentMethods: methods, customerTiers: tiers } = res.data.data;
        if (promos?.length) {
          const mapped = promos.map(mapPromoFromApi);
          setPromoList(mapped);
          setSelectedPromoCode(mapped[0]?.code || 'NONE');
        }
        if (methods?.length) {
          setPaymentMethods(methods);
        }
        if (tiers?.length) setCustomerTiers(tiers);
      })
      .catch(err => console.error('Gagal mengambil data master:', err));

    // Initial customer load
    loadCustomers();

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
            duration: s.regular_duration_days ? `${s.regular_duration_days} Hari` : '2 Hari (48 Jam)',
            description: s.description || 'Layanan laundry higienis Waschen',
            minWeight: parseFloat(s.min_order_qty) || 4,
            minPrice: (parseFloat(s.min_order_qty) || 4) * (parseFloat(s.price) || 0),
            isCleanox: s.is_cleanox === 1 || s.is_cleanox === true
          }));
          setServicesList(mapped);
        }
      })
      .catch(err => console.error('Gagal mengambil layanan dari API:', err));
  }, [navigate]);

  // Guard: Order Baru wajib punya shift aktif di sesi ini
  useEffect(() => {
    if (!shiftChecked) return;
    const ok = ensureShiftForOrder();
    setShiftGateOk(ok);
  }, [shiftChecked, ensureShiftForOrder, isShiftReady]);

  // Auto scroll to top when moving between step wizard steps
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustId);
  }, [customers, selectedCustId]);

  const handlePickCustomer = (customer) => {
    setSelectedCustId(customer.id);
    if (!hasCustomerAddress(customer)) {
      setAddressModalCustomer(customer);
      return;
    }
    setCurrentStep(2);
  };

  // Filtered and Tier-Prioritized Customer List
  const tierRank = { 'VIP': 1, 'Gold': 2, 'Reguler': 3, 'One-Time': 4 };
  const filteredCustomers = useMemo(() => {
    if (!customers || !Array.isArray(customers)) return [];
    const searchLower = (customerSearch || '').toLowerCase().trim();

    return customers
      .filter(c => {
        const cName = (c.name || '').toLowerCase();
        const cPhone = String(c.phone || '');
        const cAddress = (c.address || '').toLowerCase();
        const matchesSearch = !searchLower ||
          cName.includes(searchLower) ||
          cPhone.includes(searchLower) ||
          cAddress.includes(searchLower);

        const matchesTier = !selectedTierFilter || selectedTierFilter === 'Semua' || c.tier === selectedTierFilter;
        
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

  // Customer Pagination calculation & Auto Page Clamp
  const totalCustPages = Math.ceil(filteredCustomers.length / custItemsPerPage) || 1;

  useEffect(() => {
    if (custCurrentPage > totalCustPages) {
      setCustCurrentPage(1);
    }
  }, [custCurrentPage, totalCustPages]);

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
        note: '',
        isCleanox: service.isCleanox === true
      });
    } else {
      setItemSpecs({
        qty: 1,
        weight: 1,
        brand: '',
        color: '',
        material: '',
        size: '',
        note: '',
        isCleanox: service.isCleanox === true
      });
    }
  };

  // Edit existing cart item — buka modal rincian sama seperti Pilih Layanan
  const handleEditCartItem = (cartItem) => {
    setConfiguringItem({
      id: cartItem.serviceId,
      dbId: cartItem.serviceDbId,
      name: cartItem.name,
      category: cartItem.category,
      unit: cartItem.unit,
      price: cartItem.unitPrice,
      duration: cartItem.duration,
      isCleanox: cartItem.serviceIsCleanox === true,
      editingCartId: cartItem.cartId
    });
    setItemSpecs({
      qty: cartItem.qty || 1,
      weight: cartItem.weight || (cartItem.category === 'Kiloan' ? 4 : 1),
      brand: cartItem.brand === '-' ? '' : (cartItem.brand || ''),
      color: cartItem.color === '-' ? '' : (cartItem.color || ''),
      material: cartItem.material === '-' ? '' : (cartItem.material || ''),
      size: cartItem.size === '-' ? '' : (cartItem.size || ''),
      note: cartItem.note === '-' ? '' : (cartItem.note || ''),
      isCleanox: cartItem.isCleanox === true
    });
  };

  // Add configured item to Cart (atau update jika sedang edit)
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

    const editingCartId = configuringItem.editingCartId;

    if (editingCartId) {
      setCartItems((prev) => prev.map((item) => (
        item.cartId === editingCartId
          ? {
              ...item,
              isCleanox: itemSpecs.isCleanox === true,
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
            }
          : item
      )));
      setConfiguringItem(null);
      return;
    }

    const newCartItem = {
      cartId: `ITEM-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      serviceId: configuringItem.id,
      serviceDbId: configuringItem.dbId,
      serviceIsCleanox: configuringItem.isCleanox === true,
      isCleanox: itemSpecs.isCleanox === true,
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

  const handleToggleItemCleanox = (cartId) => {
    setCartItems(cartItems.map(item => (
      item.cartId === cartId ? { ...item, isCleanox: !item.isCleanox } : item
    )));
  };

  // Selected promo details
  const activePromo = promoList.find(p => p.code === selectedPromoCode) || promoList[0] || PROMO_FALLBACK[0];

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

  const isMemberBalanceMethod = mainCategory === 'Potong Saldo Member';

  useEffect(() => {
    if (paymentStatus === 'Lunas' && !isMemberBalanceMethod && !isOutstandingDropOff) {
      setPaidAmountInput(formatRupiah(calculations.grandTotal));
      setOverpaymentAction('change');
    } else if (paymentStatus === 'DP' && !paidAmountInput) {
      setPaidAmountInput(formatRupiah(Math.max(50000, Math.floor(calculations.grandTotal / 2))));
    }
  }, [paymentStatus, calculations.grandTotal, isMemberBalanceMethod, isOutstandingDropOff]);

  // Check if delivery can be enabled (requires non-empty customer address)
  const hasValidAddress = Boolean(selectedCustomer && hasCustomerAddress(selectedCustomer));

  // Handle Order Submit & Receipt Generation via Backend API
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      showAlert({
        title: 'Pelanggan Belum Dipilih',
        message: 'Silakan pilih pelanggan terlebih dahulu sebelum melanjutkan ke pembayaran.',
        type: 'warning'
      });
      return;
    }
    if (!selectedCustomer.dbId) {
      showAlert({
        title: 'Data Pelanggan Tidak Lengkap',
        message: 'ID pelanggan tidak valid. Kembali ke langkah 1 lalu pilih ulang pelanggan.',
        type: 'error'
      });
      return;
    }
    if (cartItems.length === 0) {
      showAlert({
        title: 'Keranjang Kosong',
        message: 'Keranjang belanja masih kosong. Silakan pilih minimal 1 layanan.',
        type: 'warning'
      });
      return;
    }

    const paidAmountNum = parseRupiah(paidAmountInput);
    const isOutstanding = paymentStatus === 'Outstanding';

    if (paymentStatus === 'Lunas' && !isMemberBalanceMethod) {
      if (paidAmountNum <= 0) {
        showAlert({
          title: 'Nominal Bayar Kosong',
          message: 'Nominal bayar wajib diisi untuk transaksi lunas.',
          type: 'warning'
        });
        return;
      }
      if (paidAmountNum < calculations.grandTotal) {
        showAlert({
          title: 'Nominal Bayar Kurang',
          message: `Nominal bayar kurang Rp ${(calculations.grandTotal - paidAmountNum).toLocaleString('id-ID')} dari total tagihan.`,
          type: 'error'
        });
        return;
      }
    }

    if (paymentStatus === 'DP') {
      if (paidAmountNum <= 0 || paidAmountNum >= calculations.grandTotal) {
        showAlert({
          title: 'Nominal DP Tidak Valid',
          message: 'Nominal DP harus lebih dari 0 dan kurang dari total tagihan.',
          type: 'warning'
        });
        return;
      }
    }

    const excessAmount = paymentStatus === 'Lunas' && !isMemberBalanceMethod
      ? Math.max(0, paidAmountNum - calculations.grandTotal)
      : 0;
    const overpaymentToDeposit = excessAmount > 0 && overpaymentAction === 'deposit';
    const changeAmount = excessAmount > 0 && !overpaymentToDeposit ? excessAmount : 0;

    const resolvedStatus = isOutstanding ? 'Outstanding' : paymentStatus;
    const resolvedPaidAmount = isOutstanding
      ? 0
      : paymentStatus === 'Lunas'
        ? (isMemberBalanceMethod ? calculations.grandTotal : paidAmountNum)
        : paidAmountNum;

    const hasKiloan = cartItems.some(i => i.category === 'Kiloan' || i.unit === 'Kg');
    const hasSatuan = cartItems.some(i => i.category === 'Satuan' || i.unit !== 'Kg');
    const orderCategory = hasKiloan && hasSatuan ? 'Campuran' : (hasKiloan ? 'Kiloan' : 'Satuan');

    const totalWeightKg = cartItems
      .filter(i => i.category === 'Kiloan' || i.unit === 'Kg')
      .reduce((sum, i) => sum + (parseFloat(i.qty) || 0), 0);

    const totalPcs = cartItems
      .filter(i => i.category !== 'Kiloan' && i.unit !== 'Kg')
      .reduce((sum, i) => sum + (parseInt(i.qty) || 1), 0);

    const resolvedPaymentMethod = resolvePaymentMethodString({
      mainCategory,
      edcCardType,
      isCrossTransfer,
      crossBankOutletId,
      activeOutletId,
      activeOutletName,
      outlets
    });

    const payload = {
      customerId: selectedCustomer.dbId,
      outletId: parseInt(activeOutletId) || 2,
      shiftId: localStorage.getItem('activeShiftId')
        ? parseInt(localStorage.getItem('activeShiftId'))
        : null,
      orderCategory,
      totalWeightKg,
      totalPcs,
      speedId: isExpress ? 2 : 1,
      speedName: isExpress ? 'Express (1x24 Jam)' : 'Reguler (2 Hari)',
      parfumeId: selectedPerfumeId || parfumes.find(p => p.name === selectedPerfume)?.id || null,
      parfumeName: selectedPerfume,
      subtotal: calculations.rawSubtotal,
      speedSurcharge: calculations.expressSurcharge,
      discountAmount: calculations.discountAmount,
      discountNotes: activePromo.name !== 'NONE' ? activePromo.name : null,
      grandTotal: calculations.grandTotal,
      paymentStatus: resolvedStatus,
      paymentMethod: isOutstanding ? '-' : resolvedPaymentMethod,
      paidAmount: resolvedPaidAmount,
      changeAmount: paymentStatus === 'Lunas' ? changeAmount : 0,
      overpaymentToDeposit: paymentStatus === 'Lunas' ? overpaymentToDeposit : false,
      isDelivery,
      deliveryAddress: isDelivery ? (selectedCustomer.address || '-') : null,
      deliveryNotes: isDelivery ? generalOrderNotes : null,
      specialNotes: generalOrderNotes,
      items: cartItems.map(item => ({
        serviceId: item.serviceDbId || 1,
        serviceName: item.name,
        qty: item.category === 'Kiloan' ? item.weight : item.qty,
        unit: item.unit,
        unitPrice: item.unitPrice,
        subtotal: item.effectiveSubtotal,
        isCleanox: item.isCleanox === true,
        brand: item.brand,
        color: item.color,
        material: item.material,
        size: item.size,
        conditionNotes: item.note
      }))
    };

    setPendingOrderPayload(payload);
    setShowPinModal(true);
  };

  const submitOrderWithCashier = async (cashierEmployeeId, cashierFullName) => {
    if (!pendingOrderPayload) return;
    setShowPinModal(false);
    setIsSavingOrder(true);
    const proofFile = paymentProofFile;

    try {
      const res = await axios.post('/api/transactions', {
        ...pendingOrderPayload,
        cashierEmployeeId
      });

      const orderResult = res.data?.data;
      const txnDbId = orderResult?.id;
      const orderId = orderResult?.order_no || `WS-${Date.now().toString().slice(-6)}`;

      if (proofFile && txnDbId) {
        const fd = new FormData();
        fd.append('proof', proofFile);
        await axios.post(`/api/history/transactions/${txnDbId}/payment-proof`, fd);
      }

      const depositDelta = orderResult?.deposit_delta ?? 0;
      const payloadPaid = pendingOrderPayload.paidAmount || 0;
      const payloadChange = pendingOrderPayload.changeAmount || 0;
      const payloadDepositAdded = pendingOrderPayload.overpaymentToDeposit
        ? Math.max(0, payloadPaid - calculations.grandTotal)
        : 0;
      const newMemberBalance = Math.max(0, (selectedCustomer.memberBalance || 0) + depositDelta);

      if (depositDelta !== 0) {
        setCustomers((prev) => prev.map((c) => (
          c.id === selectedCustId
            ? { ...c, memberBalance: newMemberBalance }
            : c
        )));
      }

      const receiptData = {
        id: orderId,
        customerId: orderResult?.customer_id || selectedCustomer.dbId,
        customerCode: orderResult?.customer_code || selectedCustomer.id,
        customerName: orderResult?.customer_name || selectedCustomer.name,
        customerPhone: orderResult?.customer_phone || selectedCustomer.phone,
        customerAddress: orderResult?.customer_address || selectedCustomer.fullAddress || selectedCustomer.address || '-',
        customerTier: orderResult?.customer_tier || selectedCustomer.tier,
        customerBalance: newMemberBalance,
        branch: orderResult?.outlet_name || activeOutletName,
        cashierName: formatEmployeeName(cashierFullName || userProfile?.fullName, 'Staff Kasir'),
        cashierFullName: cashierFullName || userProfile?.fullName || 'Staff Kasir',
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
        paymentStatus: orderResult?.payment_status || pendingOrderPayload.paymentStatus,
        paymentMethod: orderResult?.payment_method || pendingOrderPayload.paymentMethod,
        paidAmount: parseFloat(orderResult?.paid_amount) || payloadPaid,
        changeAmount: parseFloat(orderResult?.change_amount) || payloadChange,
        depositAdded: payloadDepositAdded,
        createdAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        estimatedCompletion: isExpress ? '1x24 Jam (Besok Selesai)' : '2-3 Hari Kerja'
      };

      setPendingOrderPayload(null);
      setPaymentProofFile(null);
      setIsOutstandingDropOff(false);
      setPaymentStatus('Lunas');

      navigate('/transaction/complete', { state: { receipt: receiptData }, replace: true });
    } catch (err) {
      console.error('Gagal menyimpan transaksi ke database:', err);
      showAlert({
        title: 'Transaksi Gagal',
        message: err.response?.data?.message || err.message || 'Gagal memproses transaksi ke database.',
        type: 'error'
      });
    } finally {
      setIsSavingOrder(false);
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
    { num: 4, title: 'Pembayaran', desc: 'Bayar & Simpan', icon: IconCreditCard }
  ];

  if (!shiftGateOk) {
    return (
      <div className="min-h-screen bg-[#f8f8f8] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-black text-[#5f1340]">Menyiapkan sesi kas...</p>
          <p className="text-xs text-slate-400 font-medium">Buka / lanjutkan shift untuk membuat order baru</p>
        </div>
      </div>
    );
  }

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
            customerTiers={customerTiers}
            selectedTierFilter={selectedTierFilter}
            setSelectedTierFilter={setSelectedTierFilter}
            paginatedCustomers={paginatedCustomers}
            activeOutletName={activeOutletName}
            setSelectedCustId={setSelectedCustId}
            onPickCustomer={handlePickCustomer}
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
            handleEditCartItem={handleEditCartItem}
            handleToggleItemCleanox={handleToggleItemCleanox}
            configuringItem={configuringItem}
            setConfiguringItem={setConfiguringItem}
            itemSpecs={itemSpecs}
            setItemSpecs={setItemSpecs}
            handleAddToCart={handleAddToCart}
            selectedCustomer={selectedCustomer}
            renderTierBadge={renderTierBadge}
            formatName={formatName}
            isExpress={isExpress}
            setIsExpress={setIsExpress}
            selectedPromoCode={selectedPromoCode}
            setSelectedPromoCode={setSelectedPromoCode}
            PROMO_LIST={promoList}
            hasValidAddress={hasValidAddress}
            isDelivery={isDelivery}
            setIsDelivery={setIsDelivery}
            selectedPerfume={selectedPerfume}
            setSelectedPerfume={(name) => {
              setSelectedPerfume(name);
              const match = parfumes.find(p => p.name === name);
              setSelectedPerfumeId(match?.id || null);
            }}
            parfumes={parfumes}
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
            activeOutletId={activeOutletId}
            outlets={outlets}
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
            mainCategory={mainCategory}
            setMainCategory={setMainCategory}
            edcCardType={edcCardType}
            setEdcCardType={setEdcCardType}
            paymentMethods={paymentMethods}
            paidAmountInput={paidAmountInput}
            setPaidAmountInput={setPaidAmountInput}
            overpaymentAction={overpaymentAction}
            setOverpaymentAction={setOverpaymentAction}
            isOutstandingDropOff={isOutstandingDropOff}
            setIsOutstandingDropOff={setIsOutstandingDropOff}
            paymentProofFile={paymentProofFile}
            setPaymentProofFile={setPaymentProofFile}
            handleCreateOrder={handleCreateOrder}
            isSaving={isSavingOrder}
            isCrossTransfer={isCrossTransfer}
            setIsCrossTransfer={setIsCrossTransfer}
            crossBankOutletId={crossBankOutletId}
            setCrossBankOutletId={setCrossBankOutletId}
          />
        )}

      </main>

      {addressModalCustomer && (
        <FillAddressModal
          customer={addressModalCustomer}
          onClose={() => setAddressModalCustomer(null)}
          showToast={(title, message) => showAlert({ title, message, type: 'warning' })}
          onSaved={(updated) => {
            const nextAddress = updated.full_address || updated.address || '-';
            setCustomers((prev) => prev.map((c) => (
              c.dbId === updated.id
                ? {
                  ...c,
                  address: nextAddress,
                  fullAddress: updated.full_address || '',
                  block: updated.block || '',
                  houseNumber: updated.house_number || '',
                  notes: updated.notes || ''
                }
                : c
            )));
            setAddressModalCustomer(null);
            setCurrentStep(2);
          }}
        />
      )}

      {showPinModal && (
        <PinVerifyModal
          outletId={activeOutletId}
          defaultEmployeeId={localStorage.getItem('employeeId')}
          onCancel={() => {
            setShowPinModal(false);
            setPendingOrderPayload(null);
          }}
          onVerified={({ employeeId, fullName }) => submitOrderWithCashier(employeeId, fullName)}
        />
      )}

    </div>
  );
}
