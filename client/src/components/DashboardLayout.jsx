import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { 
    LayoutDashboard, Users, Network, Calendar, CheckCircle, LogOut, Menu, X, 
    Folder, Zap, ChevronRight, ChevronDown, Settings, Lock, ClipboardList, 
    Bell, DollarSign, Wallet, AlertTriangle, Umbrella, Sun, Package, Calculator, TrendingUp, Briefcase, Truck, 
    FileText, Building2, Globe, Map, Home, HardHat
} from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';
import { usePushNotifications } from '../hooks/usePushNotifications';

import useBranding from '../hooks/useBranding';

const Toast = ({ message, onClose, onClick }) => {
    const { t } = useTranslation();
    return (
        <div 
            onClick={onClick}
            className="fixed top-24 right-4 z-[100] bg-white border-l-4 border-joa-blue shadow-2xl p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-right w-80 cursor-pointer hover:bg-slate-50 transition-colors"
        >
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0">
                <Bell size={20} />
            </div>
            <div className="flex-1">
                <h4 className="font-bold text-slate-800 text-sm">{t('dashboard.new_notification')}</h4>
                <p className="text-xs text-slate-600 mt-1 line-clamp-3">{message}</p>
            </div>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }} 
                className="text-slate-400 hover:text-slate-600 p-1 shrink-0"
            >
                <X size={16} />
            </button>
        </div>
    );
};

const DashboardLayout = () => {
    const { t, i18n } = useTranslation();
    const { branding } = useBranding();
    const [userProfile, setUserProfile] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
    const user = userProfile;
    usePushNotifications(user.id);

    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [gpsWarning, setGpsWarning] = useState(null);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [openGroups, setOpenGroups] = useState({
        production: true,
        economy: true,
        hr: false,
        services: false
    });

    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [toast, setToast] = useState(null);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const prevUnreadCountRef = React.useRef(0);

    const location = useLocation();
    const navigate = useNavigate();
    // user removed here, it's now at the top

    // Fetch Notifications
    const fetchNotifications = async () => {
        try {
            const res = await api.get('/api/notifications');
            const newNotifications = res.data;
            const newUnreadCount = newNotifications.filter(n => !n.isRead).length;

            // Detect new unread notifications
            if (newUnreadCount > prevUnreadCountRef.current) {
                // Play sound
                try {
                    const audio = new Audio(BEEP_URL);
                    audio.volume = 0.5;
                    audio.play().catch(e => console.warn("Audio play prevented", e));
                } catch (e) {
                    console.error("Audio error", e);
                }

                // Show toast for the latest one
                const latest = newNotifications[0];
                setToast({
                    id: Date.now(),
                    message: latest.message,
                    data: latest
                });

                // Auto hide after 5s
                setTimeout(() => setToast(null), 5000);
            }

            setNotifications(newNotifications);
            prevUnreadCountRef.current = newUnreadCount;

        } catch (error) {
            console.error('Error fetching notifications');
        }
    };

    // Sync User Profile with DB
    const refreshUserProfile = async () => {
        try {
            const res = await api.get('/api/auth/me');
            localStorage.setItem('user', JSON.stringify(res.data));
            setUserProfile(res.data);
            // Log for debug
            console.log('[AUTH] User profile synced:', res.data.activeClientCompany?.name);
        } catch (error) {
            if (error.response?.status === 401) {
                localStorage.removeItem('user');
                navigate('/login');
            }
        }
    };

    useEffect(() => {
        refreshUserProfile();
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    // Start live GPS location reporting for technicians
    useEffect(() => {
        const isTechnician = ['CIVIL_WORKER'].includes(user.role);
        if (!isTechnician) return;

        let watchId = null;
        let lastReported = 0;
        const REPORT_INTERVAL = 30000; // Report at most once every 30 seconds

        const reportLocation = async (coords) => {
            const now = Date.now();
            if (now - lastReported < REPORT_INTERVAL) return;
            lastReported = now;

            try {
                await api.post('/api/users/live-location', {
                    latitude: coords.latitude,
                    longitude: coords.longitude
                });
            } catch (err) {
                console.error("Error reporting live location:", err);
            }
        };

        if (navigator.geolocation) {
            // Using watchPosition to update location dynamically
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    setGpsWarning(null); // Clear any warning on success
                    reportLocation(position.coords);
                },
                (err) => {
                    console.warn("watchPosition failed or was denied:", err);
                    if (err.code === 1) { // PERMISSION_DENIED
                        setGpsWarning("Permiso de GPS denegado. Por favor, activa la ubicación en tu navegador para que puedas aparecer en el mapa.");
                    } else if (err.code === 2) { // POSITION_UNAVAILABLE
                        setGpsWarning("Ubicación GPS no disponible en este dispositivo.");
                    }
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
            );

            // Also check periodically in case watchPosition doesn't fire (background mode)
            const intervalId = setInterval(() => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        setGpsWarning(null); // Clear warning on success
                        reportLocation(position.coords);
                    },
                    (err) => {
                        console.warn("getCurrentPosition failed in background interval:", err);
                    },
                    { enableHighAccuracy: true, timeout: 15000 }
                );
            }, 60000);

            return () => {
                if (watchId !== null) navigator.geolocation.clearWatch(watchId);
                clearInterval(intervalId);
            };
        } else {
            setGpsWarning("Tu navegador no soporta geolocalización GPS.");
        }
    }, [user.role]);

    useEffect(() => {
        const handleServiceWorkerMessage = (event) => {
            if (event.data && event.data.type === 'NAVIGATE' && event.data.url) {
                console.log('[SW-MSG] Navigating to:', event.data.url);
                navigate(event.data.url);
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            }
        };
    }, [navigate]);

    const markAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error(e);
        }
    };

    const clearNotifications = async () => {
        if (!window.confirm('¿Deseas borrar todas tus notificaciones?')) return;
        try {
            await api.delete('/api/notifications');
            setNotifications([]);
            setShowNotifications(false);
        } catch (e) {
            console.error('Error clearing notifications', e);
        }
    };

    const handleNotificationClick = (n) => {
        markAsRead(n.id);
        setShowNotifications(false);
        if (n.type === 'RECITE_REQUEST' || n.type === 'REPAIR_ASSIGNED' || n.type === 'ORDER_STATUS_CHANGED') {
            if (n.address && n.address.street) {
                navigate(`/dashboard/appointments?search=${encodeURIComponent(n.address.street)}`);
            } else {
                navigate('/dashboard/appointments');
            }
        } else if (n.type === 'VEHICLE_LOG_ADDED') {
            const match = n.message.match(/vehículo\s+([a-zA-Z0-9\-]+)/i);
            if (match) {
                navigate(`/dashboard/vehicles?search=${encodeURIComponent(match[1])}`);
            } else {
                navigate('/dashboard/vehicles');
            }
        } else if (n.type === 'VACATION_REQUEST' || n.type === 'VACATION_APPROVED') {
            navigate('/dashboard/vacations-admin');
        } else if (n.type === 'VACATION_UPDATE') {
            navigate('/dashboard/vacations');
        } else if (n.type === 'DIETA_LOGGED') {
            navigate('/dashboard/payroll');
        } else if (n.type === 'RENTAL_RENEWAL') {
            navigate('/dashboard/accommodations');
        } else if (n.type === 'MATERIAL_ORDER_CREATED' || n.type === 'MATERIAL_ORDER_UPDATE') {
            navigate('/dashboard/material-orders');
        } else if (n.type === 'WORK_FAILED') {
            navigate('/dashboard/subcontractor-log');
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const toggleGroup = (group) => {
        setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const navGroups = [
        {
            id: 'main',
            roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER'],
            items: [
                { icon: LayoutDashboard, label: t('dashboard.summary'), path: '/dashboard' },
            ]
        },
        {
            id: 'civil',
            label: 'Obra Civil',
            icon: HardHat,
            roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR'],
            items: [
                { icon: Map, label: 'Mapa Obra Civil', path: '/dashboard/civil-works-map', roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER', 'SUBCONTRACTOR'] },
                { icon: ClipboardList, label: 'Reporte Diario', path: '/dashboard/subcontractor-log', roles: ['SUBCONTRACTOR', 'CIVIL_WORKER'] },
                { icon: Users, label: 'Gestión Subcontratas', path: '/dashboard/subcontractors', roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'] },
                { icon: FileText, label: 'Partes Diarios', path: '/dashboard/daily-reports', roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'] }
            ]
        },
        {
            id: 'production',
            label: t('dashboard.production_mgmt'),
            icon: Briefcase,
            roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'],
            items: [
                { icon: Folder, label: t('dashboard.projects'), path: '/dashboard/projects', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Calendar, label: t('dashboard.appointments'), path: '/dashboard/appointments', roles: ['BACK_OFFICE', 'SUPER_ADMIN', 'ADMIN'] },
                { icon: Zap, label: t('dashboard.prod_control'), path: '/dashboard/billing', roles: ['SUPER_ADMIN', 'ADMIN'] },
            ]
        },
        {
            id: 'economy',
            label: t('dashboard.economy_area'),
            icon: TrendingUp,
            roles: ['SUPER_ADMIN', 'ADMIN'],
            items: [
                { icon: FileText, label: t('dashboard.invoicing'), path: '/dashboard/invoicing', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Wallet, label: t('dashboard.payroll'), path: '/dashboard/payroll', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Truck, label: t('dashboard.fleet'), path: '/dashboard/vehicles', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Building2, label: t('dashboard.company'), path: '/dashboard/company-settings', roles: ['SUPER_ADMIN'] },
                { icon: Calculator, label: t('dashboard.profitability'), path: '/dashboard/settings', roles: ['SUPER_ADMIN'] },
            ]
        },
        {
            id: 'hr',
            label: t('dashboard.hr'),
            icon: Users,
            roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'],
            items: [
                { icon: Users, label: t('dashboard.users'), path: '/dashboard/users', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Users, label: t('dashboard.teams'), path: '/dashboard/teams', roles: ['SUPER_ADMIN', 'ADMIN'] },
                { icon: Sun, label: t('dashboard.vacations_admin'), path: '/dashboard/vacations-admin', roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'] },
                { icon: Home, label: t('dashboard.accommodation') || 'Alojamiento', path: '/dashboard/accommodations', roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE'] },
            ]
        },
        {
            id: 'services',
            label: t('dashboard.services_personnel'),
            icon: Package,
            roles: ['SUPER_ADMIN', 'ADMIN', 'BACK_OFFICE', 'CIVIL_WORKER'],
            items: [
                { icon: Package, label: t('dashboard.material_orders'), path: '/dashboard/material-orders' },
                { icon: Truck, label: t('dashboard.my_vehicle'), path: '/dashboard/my-vehicle', roles: ['CIVIL_WORKER', 'SUPER_ADMIN', 'ADMIN'], showIfVehicle: true },
                { icon: Umbrella, label: t('dashboard.my_vacations'), path: '/dashboard/my-vacations' },
            ]
        }
    ];

    // Close sidebar on route change on mobile
    React.useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        // Initial check
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-screen bg-[#f3f6fa] font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`bg-[#060b19] border-r border-[#1a233a] transition-all duration-300 ease-in-out 
                    fixed md:relative z-30 h-full flex flex-col shadow-2xl shadow-black/50
                    ${isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-20'}
                `}
            >
                <div className="p-6 flex items-center justify-between h-24 mt-2">
                    {isSidebarOpen ? (
                        <div className="flex items-center">
                            <img 
                                src={branding.logoUrl} 
                                alt={branding.name} 
                                className="h-10 object-contain drop-shadow-[0_0_15px_rgba(0,210,255,0.3)] transition-transform duration-300 hover:scale-105" 
                            />
                        </div>
                    ) : (
                        <img 
                            src={branding.logoUrl} 
                            alt={branding.name} 
                            className="h-8 object-contain mx-auto drop-shadow-[0_0_15px_rgba(0,210,255,0.3)] transition-transform duration-300 hover:scale-105" 
                        />
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-[#1a233a] rounded-lg text-slate-400 hover:text-white transition-colors md:block hidden"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-[#1a233a] rounded-lg text-slate-400 hover:text-white transition-colors md:hidden block"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="px-4 mb-6">
                    <button
                        onClick={() => setIsPasswordModalOpen(true)}
                        className={`w-full p-3 rounded-2xl bg-[#0f172a]/50 border border-[#1e293b] flex items-center gap-3 hover:bg-[#1e293b] hover:border-[#334155] transition-all group text-left ${!isSidebarOpen && 'md:justify-center p-2'}`}
                        title="Clic para cambiar contraseña"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-joa-blue to-joa-cyan flex items-center justify-center text-white font-bold shadow-md shadow-joa-blue/20 shrink-0 relative">
                            {user.username?.charAt(0).toUpperCase()}
                            <div className="absolute -bottom-1 -right-1 bg-[#060b19] rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <Settings size={12} className="text-slate-300" />
                            </div>
                        </div>
                        {isSidebarOpen && (
                            <div className="overflow-hidden flex-1">
                                <p className="font-bold text-slate-100 truncate text-sm">{user.username}</p>
                                <p className="text-xs text-joa-cyan truncate capitalize">{user.role?.replace('_', ' ').toLowerCase()}</p>
                            </div>
                        )}
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-4 overflow-y-auto custom-scrollbar-dark pb-10">
                    {navGroups.map((group) => {
                        // Check if group should be visible for this user
                        if (group.roles && !group.roles.includes(user.role)) return null;

                        const hasActiveChild = group.items.some(item => location.pathname === item.path);
                        const isOpen = openGroups[group.id] || hasActiveChild;

                        return (
                            <div key={group.id} className="space-y-1">
                                {group.label && isSidebarOpen && (
                                    <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-joa-cyan transition-colors group"
                                    >
                                        <div className="flex items-center gap-2">
                                            {group.icon && <group.icon size={12} />}
                                            {group.label}
                                        </div>
                                        {isOpen ? <ChevronDown size={12} className="transition-transform" /> : <ChevronRight size={12} />}
                                    </button>
                                )}

                                {(isOpen || !group.label || !isSidebarOpen) && (
                                    <div className="space-y-1">
                                        {group.items.map((item) => {
                                            // Allow access if user has the role OR if the item is vehicle-related and user has a vehicle
                                            const hasRole = !item.roles || item.roles.includes(user.role);
                                            const hasVehicle = item.showIfVehicle && (user.vehicleId || user.vehicle);
                                            
                                            if (!hasRole && !hasVehicle) return null;

                                            const isActive = location.pathname === item.path;
                                            return (
                                                <Link
                                                    key={item.path}
                                                    to={item.path}
                                                    onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                                                    className={`flex items-center p-3 rounded-xl transition-all group ${isActive
                                                        ? 'bg-gradient-to-r from-joa-blue to-joa-cyan text-white shadow-lg shadow-joa-blue/20'
                                                        : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
                                                        }`}
                                                >
                                                    <item.icon size={isSidebarOpen ? 20 : 22} className={`${isActive ? 'text-white' : 'text-slate-500 group-hover:text-joa-cyan'} transition-colors ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                                    {isSidebarOpen && (
                                                        <span className={`font-medium flex-1 ${isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'}`}>
                                                            {item.label}
                                                        </span>
                                                    )}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-[#1a233a] space-y-2">
                    {/* Settings Link for everyone */}
                    {isSidebarOpen && (
                        <button
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="flex items-center w-full p-2 rounded-lg text-slate-500 hover:bg-[#1e293b] hover:text-white transition-colors text-sm"
                        >
                            <Lock size={16} className="mr-2" />
                            {t('dashboard.change_password')}
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className={`flex items-center w-full p-3.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors ${!isSidebarOpen && 'md:justify-center'
                            }`}
                    >
                        <LogOut size={22} className={isSidebarOpen ? 'mr-3' : ''} />
                        {isSidebarOpen && <span className="font-medium">{t('dashboard.logout')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-h-screen relative overflow-y-auto w-full">
                
                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#e0e7ff]/30 to-transparent pointer-events-none -z-10"></div>
                <div className="absolute top-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-joa-cyan/5 blur-[120px] pointer-events-none -z-10"></div>
                <div className="absolute top-[20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-joa-blue/5 blur-[120px] pointer-events-none -z-10"></div>

                {/* Centered Diffused Logo (Watermark) */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.02]">
                    <img src={branding.logoUrl} alt="" className="w-[80%] max-w-[600px] object-contain grayscale" />
                </div>

                {/* Floating Header */}
                <div className="p-4 md:px-8 md:pt-6 pb-0 sticky top-0 z-20">
                    <header className="glass-panel rounded-2xl px-6 py-4 flex justify-between items-center transition-all duration-300">
                        <div className="flex items-center gap-4">
                            {/* Mobile Menu Button */}
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-2 -ml-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden"
                            >
                                <Menu size={24} />
                            </button>

                            <div>
                                <h1 className="text-xl md:text-2xl font-heading font-bold text-slate-800 tracking-tight">
                                    {navGroups.flatMap(g => g.items).find(i => i.path === location.pathname)?.label || 'Dashboard'}
                                </h1>
                                <p className="text-xs md:text-sm text-slate-500 hidden md:block mt-0.5">{t('dashboard.management')} {branding.name}</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 md:gap-6">
                            
                            {/* Language Switcher */}
                            <div className="relative group" onMouseLeave={() => setIsLangOpen(false)}>
                                <button 
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className="flex items-center gap-1.5 p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                                >
                                    <Globe size={18} />
                                    <span className="text-xs font-bold uppercase">{i18n.language}</span>
                                </button>
                                <div className={`absolute right-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 transition-all z-50 overflow-hidden ${isLangOpen ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                                    <button 
                                        onClick={() => {
                                            i18n.changeLanguage('es');
                                            setIsLangOpen(false);
                                        }} 
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${i18n.language === 'es' ? 'font-bold text-joa-blue bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        🇪🇸 Español
                                    </button>
                                    <button 
                                        onClick={() => {
                                            i18n.changeLanguage('de');
                                            setIsLangOpen(false);
                                        }} 
                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${i18n.language === 'de' ? 'font-bold text-joa-blue bg-blue-50/50' : 'text-slate-600'}`}
                                    >
                                        🇩🇪 Deutsch
                                    </button>
                                </div>
                            </div>

                            {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-600 relative transition-colors"
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                                     <div className="p-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-slate-700 text-sm">{t('dashboard.notifications')}</h3>
                                            {unreadCount > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-bold">{unreadCount}</span>}
                                        </div>
                                        {notifications.length > 0 && (
                                            <button 
                                                onClick={clearNotifications}
                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 uppercase tracking-wider bg-red-50 px-2 py-1 rounded-md transition-colors"
                                            >
                                                {t('dashboard.clear_all')}
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                {t('dashboard.no_notifications')}
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleNotificationClick(n)}
                                                    className={`p-4 border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.isRead ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                                        <div>
                                                            <p className="text-sm text-slate-800 line-clamp-2 leading-snug">{n.message}</p>
                                                            <p className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-right hidden sm:block">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('dashboard.date')}</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">{new Date().toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'es-ES')}</p>
                        </div>
                    </div>
                </header>
                </div>

                <div className="p-4 md:p-8">
                    {/* GPS permission warning banner */}
                    {gpsWarning && (
                        <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start gap-3 animate-in fade-in duration-300">
                            <div className="bg-amber-100 p-2.5 rounded-full text-amber-600 shrink-0">
                                <AlertTriangle size={20} />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-amber-800 text-sm">GPS Desactivado / Permiso Denegado</h4>
                                <p className="text-xs text-amber-600 mt-0.5 leading-relaxed">
                                    Para que puedas aparecer en el mapa de distribución de la empresa, es necesario que permitas el acceso a la ubicación en tu navegador. Por favor, comprueba los permisos del sitio y activa el GPS de tu dispositivo.
                                </p>
                            </div>
                            <button onClick={() => setGpsWarning(null)} className="text-amber-400 hover:text-amber-600 p-1 shrink-0">
                                <X size={16} />
                            </button>
                        </div>
                    )}
                    <Outlet />
                </div>
            </main>

            <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    onClose={() => setToast(null)}
                    onClick={() => {
                        handleNotificationClick(toast.data);
                        setToast(null);
                    }}
                />
            )}
        </div>
    );
};

export default DashboardLayout;
