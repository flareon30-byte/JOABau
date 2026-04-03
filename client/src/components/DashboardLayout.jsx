import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { LayoutDashboard, Users, Network, Calendar, CheckCircle, LogOut, Menu, X, Folder, Zap, ChevronRight, Settings, Lock, ClipboardList, Bell, DollarSign, Wallet, AlertTriangle, Umbrella, Sun, Package, Calculator } from 'lucide-react';
import ChangePasswordModal from './ChangePasswordModal';

// Notification Sound URL (Short subtle beep)
const BEEP_URL = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const Toast = ({ message, onClose }) => (
    <div className="fixed top-24 right-4 z-[100] bg-white border-l-4 border-joa-blue shadow-2xl p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-right w-80">
        <div className="bg-blue-100 p-2 rounded-full text-blue-600">
            <Bell size={20} />
        </div>
        <div className="flex-1">
            <h4 className="font-bold text-slate-800 text-sm">Nueva Notificación</h4>
            <p className="text-xs text-slate-600 mt-1 line-clamp-3">{message}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
        </button>
    </div>
);

const DashboardLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

    // Notifications State
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [toast, setToast] = useState(null);
    const prevUnreadCountRef = React.useRef(0);

    const location = useLocation();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

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

    const markAsRead = async (id) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error(e);
        }
    };

    const handleNotificationClick = (n) => {
        markAsRead(n.id);
        setShowNotifications(false);
        if (n.type === 'RECITE_REQUEST' || n.type === 'REPAIR_ASSIGNED') {
            if (n.address && n.address.street) {
                navigate(`/dashboard/appointments?search=${encodeURIComponent(n.address.street)}`);
            } else {
                navigate('/dashboard/appointments');
            }
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    const navItems = [
        { icon: LayoutDashboard, label: 'Resumen', path: '/dashboard' },
        { icon: Users, label: 'Usuarios', path: '/dashboard/users', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Users, label: 'Equipos', path: '/dashboard/teams', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Folder, label: 'Proyectos', path: '/dashboard/projects', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Network, label: 'Soplado', path: '/dashboard/blowing', roles: ['BLOWER', 'SUPER_ADMIN', 'ADMIN'] },
        { icon: Zap, label: 'Fusión', path: '/dashboard/fusion', roles: ['BLOWER', 'SUPER_ADMIN', 'ADMIN'] },
        { icon: Calendar, label: 'Citas (Back Office)', path: '/dashboard/appointments', roles: ['BACK_OFFICE', 'SUPER_ADMIN', 'ADMIN'] },
        { icon: AlertTriangle, label: 'Averías / Incidencias', path: '/dashboard/issues', roles: ['BACK_OFFICE', 'SUPER_ADMIN', 'ADMIN'] },
        { icon: CheckCircle, label: 'Activaciones', path: '/dashboard/activations', roles: ['ACTIVATOR', 'SUPER_ADMIN', 'ADMIN'] },
        { icon: ClipboardList, label: 'Protocolos', path: '/dashboard/protocols', roles: ['PROTOCOL_MANAGER', 'SUPER_ADMIN', 'ADMIN'] }, // New Section
        { icon: DollarSign, label: 'Facturación Clientes', path: '/dashboard/billing', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Wallet, label: 'Nóminas (Admin)', path: '/dashboard/payroll', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Sun, label: 'Vacaciones Personal', path: '/dashboard/vacations-admin', roles: ['SUPER_ADMIN', 'ADMIN'] },
        { icon: Wallet, label: 'Mis Ganancias', path: '/dashboard/my-earnings', roles: ['ACTIVATOR', 'BLOWER', 'SUPER_ADMIN'] },
        { icon: Package, label: 'Pedidos de Material', path: '/dashboard/material-orders' },
        { icon: Umbrella, label: 'Mis Vacaciones', path: '/dashboard/vacations' },
        { icon: Calculator, label: 'Sist. de Rentabilidad', path: '/dashboard/settings', roles: ['SUPER_ADMIN'] },
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
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`bg-white border-r border-slate-200 transition-all duration-300 ease-in-out 
                    fixed md:relative z-30 h-full flex flex-col shadow-xl shadow-slate-200/50
                    ${isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0 md:w-20'}
                `}
            >
                <div className="p-6 flex items-center justify-between h-24">
                    {isSidebarOpen ? (
                        <img src="/logo.png" alt="JOA" className="h-24 object-contain transition-all" />
                    ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-joa-blue to-joa-cyan rounded-xl flex items-center justify-center text-white font-bold text-2xl mx-auto">
                            J
                        </div>
                    )}
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors md:block hidden"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    {/* Mobile Close Button */}
                    <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors md:hidden block"
                    >
                        <X size={24} />
                    </button>
                </div>

                <div className="px-4 mb-6">
                    <button
                        onClick={() => setIsPasswordModalOpen(true)}
                        className={`w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3 hover:bg-blue-50 hover:border-blue-100 transition-all group text-left ${!isSidebarOpen && 'md:justify-center p-2'}`}
                        title="Clic para cambiar contraseña"
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-joa-blue to-joa-cyan flex items-center justify-center text-white font-bold shadow-md shadow-joa-blue/20 shrink-0 relative">
                            {user.username?.charAt(0).toUpperCase()}
                            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                <Settings size={12} className="text-slate-600" />
                            </div>
                        </div>
                        {isSidebarOpen && (
                            <div className="overflow-hidden flex-1">
                                <p className="font-bold text-slate-800 truncate text-sm">{user.username}</p>
                                <p className="text-xs text-slate-500 truncate capitalize">{user.role?.replace('_', ' ').toLowerCase()}</p>
                            </div>
                        )}
                    </button>
                </div>

                <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        if (item.roles && !item.roles.includes(user.role)) return null;

                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                                className={`flex items-center p-3.5 rounded-xl transition-all group ${isActive
                                    ? 'bg-joa-blue text-white shadow-lg shadow-joa-blue/30'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <item.icon size={22} className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-joa-blue'} transition-colors ${isSidebarOpen ? 'mr-3' : 'mx-auto'}`} />
                                {isSidebarOpen && (
                                    <>
                                        <span className="font-medium flex-1">{item.label}</span>
                                        {isActive && <ChevronRight size={16} className="text-white/50" />}
                                    </>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-100 space-y-2">
                    {/* Settings Link for everyone */}
                    {isSidebarOpen && (
                        <button
                            onClick={() => setIsPasswordModalOpen(true)}
                            className="flex items-center w-full p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-joa-blue transition-colors text-sm"
                        >
                            <Lock size={16} className="mr-2" />
                            Cambiar Contraseña
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className={`flex items-center w-full p-3.5 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors ${!isSidebarOpen && 'md:justify-center'
                            }`}
                    >
                        <LogOut size={22} className={isSidebarOpen ? 'mr-3' : ''} />
                        {isSidebarOpen && <span className="font-medium">Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-h-screen bg-slate-50 relative overflow-y-auto w-full">

                {/* Centered Diffused Logo (Watermark) */}
                <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
                    <img src="/logo.png" alt="" className="w-[80%] max-w-[600px] object-contain grayscale" />
                </div>

                {/* Header */}
                <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 md:px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 -ml-2 hover:bg-slate-100 rounded-lg text-slate-600 md:hidden"
                        >
                            <Menu size={24} />
                        </button>

                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                                {navItems.find(i => i.path === location.pathname)?.label || 'Dashboard'}
                            </h1>
                            <p className="text-xs md:text-sm text-slate-500 hidden md:block">Gestión integral de fibra óptica</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">

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
                                        <h3 className="font-bold text-slate-700 text-sm">Notificaciones</h3>
                                        <span className="text-xs text-slate-400">{unreadCount} nuevas</span>
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                No tienes notificaciones.
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

                        <div className="text-right">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:block">Fecha</p>
                            <p className="text-xs md:text-sm font-medium text-slate-700">{new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </header>

                <div className="p-4 md:p-8 relative z-10">
                    <Outlet />
                </div>
            </main>

            <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />

            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
};

export default DashboardLayout;
