import React, { useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, Loader2, Zap, Shield, CheckCircle } from 'lucide-react';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await api.post('/api/auth/login', { username, password });
            localStorage.setItem('user', JSON.stringify(res.data.user));
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-white font-sans font-sans">
            {/* Left Panel - Branding & Visuals */}
            <div className="hidden lg:flex w-1/2 bg-[#060b19] relative overflow-hidden flex-col justify-between p-12">
                {/* Abstract Background Shapes */}
                <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-joa-cyan/20 to-joa-blue/20 blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-joa-blue/20 blur-[100px] pointer-events-none"></div>
                
                {/* Subtle Grid overlay */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik02MCAwaC0xdjYwaDFWMHptLTYwIDYwaDYwdi0xSDB2MXoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvZz48L3N2Zz4=')] opacity-20 z-0 pointer-events-none"></div>

                <div className="relative z-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl shadow-joa-cyan/20 mb-8 border border-white/10">
                        <span className="text-joa-blue font-heading font-black text-3xl">J</span>
                    </div>
                </div>

                <div className="relative z-10 max-w-lg">
                    <h1 className="text-5xl font-heading font-bold text-white leading-[1.1] mb-6">
                        Gestión Inteligente para <span className="text-transparent bg-clip-text bg-gradient-to-r from-joa-cyan to-blue-400">Fibra Óptica</span>
                    </h1>
                    <p className="text-slate-400 text-lg leading-relaxed mb-10">
                        Plataforma integral para el control de producción, despliegue, facturación y gestión de equipos en terreno. Todo en un único lugar.
                    </p>
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-300 bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm w-fit">
                            <CheckCircle className="text-joa-cyan" size={20} />
                            <span className="font-medium">Control en tiempo real</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-300 bg-white/5 p-3 rounded-xl border border-white/10 backdrop-blur-sm w-fit">
                            <Zap className="text-joa-cyan" size={20} />
                            <span className="font-medium">Máxima eficiencia operativa</span>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex items-center gap-4 text-sm text-slate-500">
                    <span>© 2026 JOA Technologien</span>
                    <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                    <span>Plataforma Privada</span>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-[#f8fafc] relative">
                {/* Mobile Logo Background (Optional) */}
                <div className="lg:hidden absolute top-0 left-0 w-full p-6 text-center">
                    <img src="/logo.png" alt="JOA Technologien" className="h-16 mx-auto drop-shadow-md" />
                </div>

                <div className="w-full max-w-md">
                    <div className="text-left mb-10">
                        <h2 className="text-3xl font-heading font-bold text-slate-800 tracking-tight">Iniciar Sesión</h2>
                        <p className="text-slate-500 mt-2 font-medium">Introduce tus credenciales corporativas</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl flex items-center gap-3 shadow-lg shadow-red-500/5 animate-in fade-in slide-in-from-top-2">
                            <Shield className="text-red-500 shrink-0" size={18} />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Usuario</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joa-blue transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-joa-blue/10 focus:border-joa-blue outline-none transition-all text-slate-800 font-medium"
                                    placeholder="nombre.apellido o ID"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joa-blue transition-colors" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:ring-4 focus:ring-joa-blue/10 focus:border-joa-blue outline-none transition-all text-slate-800 font-medium"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 mt-4 bg-gradient-to-r from-joa-blue to-joa-cyan text-white font-bold rounded-2xl shadow-xl shadow-joa-blue/20 hover:shadow-joa-blue/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group overflow-hidden relative"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                            <span className="relative z-10 flex items-center gap-2">
                                {loading ? (
                                    <Loader2 className="animate-spin" size={20} />
                                ) : (
                                    <>
                                        Acceder a la plataforma
                                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
