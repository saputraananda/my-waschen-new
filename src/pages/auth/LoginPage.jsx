import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    User,
    Lock,
    ArrowRight,
    Eye,
    EyeOff,
} from 'lucide-react';
import { formatEmployeeName } from '../../utils/FormatName.js';

// Import local images from assets/images
import img1 from '../../assets/images/1.webp';
import img2 from '../../assets/images/2.webp';
import img3 from '../../assets/images/3.webp';
import img4 from '../../assets/images/4.webp';
import img5 from '../../assets/images/5.webp';
import img6 from '../../assets/images/6.webp';
import img7 from '../../assets/images/7.webp';
import img8 from '../../assets/images/8.webp';
import waschenLogo from '../../assets/images/waschen.webp';
import waschenLogoWhite from '../../assets/images/waschen_white.webp';
import maskotLogo from '../../assets/images/maskot.webp';
import maskotSadLogo from '../../assets/images/maskot_sad.webp';
import maskotHappyLogo from '../../assets/images/maskot_happy.webp';
import ChatbotBubble from './ChatbotBubble.jsx';

const SLIDES = [
    {
        img: img1,
        title: 'Welcome to Waschen Laundry',
        caption: 'Every guest is greeted with warmth and the Waschen standard of hospitality.',
        tag: 'Total Care For Happy Life'
    },
    {
        img: img2,
        title: 'Certified Hygiene Standards',
        caption: 'Using state-of-the-art equipment and environmentally friendly detergent formulas.',
        tag: 'Hygiene Operations'
    },
    {
        img: img3,
        title: 'Eco-friendly & Safe Solutions',
        caption: 'Using environmentally friendly chemicals and processes to protect your health.',
        tag: 'Eco-friendly & Safe Solutions'
    },
    {
        img: img4,
        title: 'Customer Satisfaction',
        caption: 'Ensuring maximum satisfaction through quality and service.',
        tag: 'Customer Satisfaction'
    },
    {
        img: img5,
        title: 'Quality & Technology',
        caption: 'Experience the perfect blend of quality and technology in every Wash.',
        tag: 'Quality & Technology'
    },
    {
        img: img6,
        title: 'VIP Laundry',
        caption: 'Dedicated service with fast response and a personal touch.',
        tag: 'VIP Laundry'
    },
    {
        img: img7,
        title: 'Ready to Wear',
        caption: 'Garments returned clean, pressed, and carefully packed for a premium finish.',
        tag: 'Finishing & Packing'
    },
    {
        img: img8,
        title: 'Professional Finishing',
        caption: 'Steam-pressed to perfection so every piece looks crisp and ready to wear.',
        tag: 'Garment Care'
    }
];

export default function LoginPage() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [welcomeName, setWelcomeName] = useState('');

    const navigate = useNavigate();

    // Set document title & Carousel timer
    useEffect(() => {
        document.title = 'Login | Waschen Laundry';
        const id = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        }, 4500);
        return () => clearInterval(id);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (!username.trim() || !password.trim()) {
            setErrorMsg('Username/Email and password cannot be empty');
            return;
        }

        setIsLoading(true);

        try {
            const response = await axios.post('/api/auth/login', { username, password });

            if (response.data && response.data.success) {
                const { token, user } = response.data;

                // Store in localStorage
                localStorage.setItem('token', token);
                localStorage.setItem('username', user.username);
                localStorage.setItem('userRole', user.role);
                localStorage.setItem('fullName', user.fullName);
                localStorage.setItem('employeeId', user.employeeId || '');
                localStorage.setItem('position', user.position || '');
                localStorage.setItem('department', user.department || '');
                localStorage.setItem('profilePath', user.profilePath || '');
                localStorage.setItem('companyId', user.companyId || '');
                const isHq = String(user.companyId) === '1';
                localStorage.setItem('activeRole', isHq ? 'Management' : (user.assignedRole || 'Frontliner'));

                const outlets = response.data.outlets || [];
                localStorage.setItem('outlets', JSON.stringify(outlets));

                if (isHq) {
                    if (outlets.length > 0) {
                        localStorage.setItem('activeOutletId', outlets[0].id);
                        localStorage.setItem('activeOutletName', outlets[0].full_name || outlets[0].name);
                    } else {
                        localStorage.setItem('activeOutletId', '2');
                        localStorage.setItem('activeOutletName', 'Waschen Laundry Citra Gran');
                    }
                } else {
                    localStorage.setItem('activeOutletId', user.assignedOutletId || '2');
                    localStorage.setItem('activeOutletName', user.assignedOutletName || 'Waschen Laundry Citra Gran');
                }

                setWelcomeName(formatEmployeeName(user.fullName || user.username));
                setIsSuccessModalOpen(true);

                // Sync ShiftContext / auth flags (localStorage tidak memicu re-render otomatis)
                window.dispatchEvent(new Event('waschen:auth-changed'));

                setTimeout(() => {
                    navigate('/', { replace: true });
                }, 2500);
            } else {
                throw new Error(response.data?.message || 'Login failed');
            }
        } catch (err) {
            console.error(err);
            const apiError = err.response?.data?.message || 'Server connection failed or incorrect password';
            setErrorMsg(apiError);
            setIsErrorModalOpen(true);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen bg-white flex overflow-hidden font-sans">
            {/* Error Modal with Sad Mascot */}
            {isErrorModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs sm:max-w-sm w-full border border-[#e0e0e0] flex flex-col items-center text-center animate-fade-in text-[#313030]">
                        <img
                            src={maskotSadLogo}
                            alt="Mascot Sad"
                            className="h-36 w-auto object-contain mb-4 drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] select-none"
                        />
                        <h3 className="text-base font-bold text-[#5f1340] mb-2 font-sans">Oops, Login Failed!</h3>
                        <p className="text-sm text-slate-650 mb-5 leading-relaxed font-semibold font-sans">
                            Your username or password is incorrect...
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsErrorModalOpen(false)}
                            className="w-full py-2.5 bg-[#5f1340] hover:bg-[#4a0d31] text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            )}

            {/* Success Modal with Happy Mascot */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs sm:max-w-sm w-full border border-[#e0e0e0] flex flex-col items-center text-center animate-fade-in text-[#313030]">
                        <img
                            src={maskotHappyLogo}
                            alt="Mascot Happy"
                            className="h-36 w-auto object-contain mb-4 drop-shadow-[0_8px_16px_rgba(0,0,0,0.2)] select-none animate-bounce-short"
                        />

                        <h3 className="text-base font-bold text-emerald-650 mb-2 font-sans">
                            Login Successful!
                        </h3>

                        <div className="text-sm text-slate-600 mb-5 font-sans text-center px-4 w-full">
                            <span className="text-slate-500 block text-xs">Welcome back,</span>
                            <span className="font-extrabold text-base text-[#5f1340] mt-1 block break-words leading-snug">
                                {welcomeName}!
                            </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold justify-center">
                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span>Opening portal...</span>
                        </div>
                    </div>
                </div>
            )}

            {/* LEFT PANEL: Hero Carousel (Desktop Only, 55% Visual Weight) */}
            <div className="hidden lg:flex lg:w-[55%] relative text-white flex-col justify-between pt-12 px-12 pb-6 overflow-hidden bg-[#3d0728]">
                {/* Background Images with transitions */}
                <div className="absolute inset-0 z-0 bg-[#3d0728]">
                    {SLIDES.map((slide, index) => (
                        <img
                            key={index}
                            src={slide.img}
                            alt={slide.title}
                            className={`absolute inset-0 w-full h-full object-cover transition-all duration-[1500ms] ease-in-out ${index === currentSlide ? 'opacity-90 scale-105' : 'opacity-0 scale-100'
                                }`}
                        />
                    ))}
                </div>

                {/* Dark Plum Overlay - Subtle & Translucent */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#3d0728]/95 via-[#5f1340]/40 to-[#5f1340]/30 z-5"></div>

                {/* Brand Header */}
                <div className="relative z-10">
                    <img src={waschenLogo} alt="Waschen Laundry Logo" className="h-16 w-auto object-contain" />
                </div>

                {/* Carousel Slide (Aligned to Bottom) */}
                <div className="relative z-10 mt-auto mb-0 pt-10">
                    {/* Tag / Accent */}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#f8f8f8]/80 block mb-3">
                        {SLIDES[currentSlide].tag}
                    </span>

                    <div className="overflow-hidden min-h-[90px]">
                        {SLIDES.map((slide, index) => (
                            <div
                                key={index}
                                className={`transition-all duration-700 ease-in-out ${index === currentSlide
                                    ? 'opacity-100 translate-y-0 relative block'
                                    : 'opacity-0 translate-y-2 absolute hidden'
                                    }`}
                            >
                                <h2 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
                                    {slide.title}
                                </h2>
                                <p className="text-xs text-[#f8f8f8]/80 mt-2 leading-relaxed max-w-md">
                                    {slide.caption}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Dots Indicator */}
                    <div className="flex gap-2.5 mt-6">
                        {SLIDES.map((_, index) => (
                            <button
                                key={index}
                                onClick={() => setCurrentSlide(index)}
                                className={`h-1 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/40'
                                    }`}
                            ></button>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: Form Login (Mobile & Desktop, 45% Visual Weight) */}
            <div className="w-full lg:w-[45%] flex flex-col lg:justify-center lg:px-14 xl:px-20 lg:py-12 relative bg-[#f8f8f8] overflow-y-auto">

                {/* Hero brand — mobile only, desktop sudah punya panel kiri */}
                <div className="lg:hidden relative h-56 shrink-0 overflow-hidden bg-[#3d0728]">
                    <img src={img1} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-45" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#3d0728]/70 via-[#5f1340]/75 to-[#f8f8f8]" />
                    <div className="relative h-full flex flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-10">
                        <img src={waschenLogoWhite} alt="Waschen Laundry" className="h-11 w-auto object-contain drop-shadow-lg" />
                    </div>
                </div>

                {/* Kartu form — mengambang di atas hero pada mobile */}
                <div className="relative z-10 -mt-8 lg:mt-0 grow lg:grow-0 flex flex-col px-4 sm:px-6 lg:px-0 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:pb-0">
                    <div className="w-full max-w-md mx-auto bg-white lg:bg-transparent rounded-3xl lg:rounded-none border border-[#e0e0e0] lg:border-0 shadow-xl lg:shadow-none p-6 sm:p-7 lg:p-0">

                        {/* Form Header (Aligned with input width) */}
                        <div className="mb-6 text-left">
                            <span className="inline-block text-[10px] font-black text-[#5f1340] bg-[#5f1340]/[0.08] border border-[#5f1340]/15 rounded-md px-2 py-0.5 uppercase tracking-wider mb-2.5">
                                Point of Sale
                            </span>
                            <h2 className="text-2xl lg:text-xl font-bold text-[#313030] tracking-tight">
                                Welcome To My Waschen
                            </h2>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Aplikasi Point of Sale Waschen Laundry — khusus untuk karyawan outlet.
                            </p>
                        </div>



                        {/* Form Container */}
                        <form onSubmit={handleLogin} className="space-y-5">
                    {/* Username Input */}
                    <div>
                        <label htmlFor="login-username" className="block text-[10px] font-bold text-[#313030] uppercase tracking-wider mb-1.5">
                            Username or Email
                        </label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#5f1340] transition-colors">
                                <User className="h-4.5 w-4.5" />
                            </div>
                            <input
                                id="login-username"
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                autoCapitalize="none"
                                autoCorrect="off"
                                spellCheck={false}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="w-full pl-11 pr-4 py-3 sm:py-2.5 bg-white border border-[#e0e0e0] rounded-lg text-[#313030] placeholder-slate-400 focus:outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] transition-all duration-200 text-base sm:text-sm shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label htmlFor="login-password" className="block text-[10px] font-bold text-[#313030] uppercase tracking-wider">
                                Password
                            </label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-[#5f1340] transition-colors">
                                <Lock className="h-4.5 w-4.5" />
                            </div>
                            <input
                                id="login-password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                required
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                className="w-full pl-11 pr-11 py-3 sm:py-2.5 bg-white border border-[#e0e0e0] rounded-lg text-[#313030] placeholder-slate-400 focus:outline-none focus:border-[#5f1340] focus:ring-1 focus:ring-[#5f1340] transition-all duration-200 text-base sm:text-sm shadow-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-650 transition-colors cursor-pointer"
                            >
                                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                            </button>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full relative py-3 sm:py-2.5 px-4 bg-[#5f1340] hover:bg-[#4a0d31] active:scale-[0.99] disabled:bg-slate-400 disabled:active:scale-100 text-white rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 group transition-all duration-200 overflow-hidden cursor-pointer"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>Log In to POS</span>
                                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                            </>
                        )}
                    </button>
                        </form>
                    </div>

                    {/* Footer info (Copyright) — beri ruang agar tak tertutup maskot di mobile */}
                    <div className="w-full max-w-md mx-auto text-center mt-8 pb-20 lg:pb-0">
                        <p className="text-[10px] text-slate-400">
                            &copy; {new Date().getFullYear()} PT Waschen Alora Indonesia. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>

            {/* Mascot Chatbot Widget */}
            <ChatbotBubble />
        </div>
    );
}
