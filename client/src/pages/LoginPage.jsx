import React, { useState } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, Loader2, Shield } from 'lucide-react';
import useBranding from '../hooks/useBranding';

const LoginPage = () => {
    const { branding } = useBranding();
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
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#0a0f1c] font-sans">
            
            {/* --- Fondo Dinámico Premium --- */}
            {/* Grid Pattern sutil */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik00MCAwaC0xdjQwaDFWMHptLTQwIDQwaDQwdi0xSDB2MXoiIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyIvPjwvZz48L3N2Zz4=')] pointer-events-none"></div>

            {/* Glowing Orbs animadoss */}
            <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-joa-cyan/15 blur-[150px] mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]"></div>
            <div className="absolute top-[30%] -right-[15%] w-[45vw] h-[45vw] rounded-full bg-joa-blue/20 blur-[150px] mix-blend-screen animate-[pulse_10s_ease-in-out_infinite_alternate]"></div>
            <div className="absolute -bottom-[20%] left-[20%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/10 blur-[130px] mix-blend-screen"></div>

            {/* --- Tarjeta Central Glassmorphism --- */}
            <div className="relative z-10 w-full max-w-[1000px] mx-auto p-4 flex flex-col md:flex-row items-stretch justify-center gap-6">
                
                <div className="bg-[#111827]/60 backdrop-blur-3xl border border-[#ffffff]/10 shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-[2.5rem] w-full flex flex-col md:flex-row overflow-hidden flex-1 relative">
                    
                    {/* Borde brillante superior */}
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-joa-cyan/50 to-transparent"></div>

                    {/* Columna Izquierda: Logo y Branding */}
                    <div className="w-full md:w-[45%] p-10 md:p-14 flex flex-col justify-center items-center text-center border-b md:border-b-0 md:border-r border-[#ffffff]/5 relative overflow-hidden bg-gradient-to-b from-joa-blue/5 to-transparent">
                        
                        {/* El Logotipo de la Empresa Recuperado */}
                        <img 
                            src={branding.logoUrl} 
                            alt={branding.name} 
                            className="w-48 object-contain drop-shadow-[0_0_25px_rgba(0,210,255,0.4)] mb-8 transform hover:scale-105 transition-transform duration-500 relative z-10"
                        />
                        
                        <div className="relative z-10">
                            <h2 className="text-3xl font-heading font-black text-white tracking-tight mb-4 text-center">
                                Gestión <span className="text-transparent bg-clip-text bg-gradient-to-r from-joa-cyan to-joa-blue drop-shadow-sm">Avanzada</span>
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed font-medium">
                                Bienvenido a la plataforma central de operaciones de fibra óptica de {branding.name}.
                            </p>
                        </div>
                    </div>

                    {/* Columna Derecha: Formulario */}
                    <div className="w-full md:w-[55%] p-10 md:p-14 flex flex-col justify-center relative">
                        {/* Elemento decorativo */}
                        <div className="absolute top-10 right-10 w-20 h-20 bg-gradient-to-br from-joa-cyan/10 to-joa-blue/10 rounded-full blur-2xl pointer-events-none"></div>

                        <div className="mb-10">
                            <h3 className="text-2xl font-bold text-white mb-2 font-heading">Iniciar Sesión</h3>
                            <p className="text-slate-400 text-sm">Entorno privado y seguro.</p>
                        </div>

                        {error && (
                            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl flex items-center gap-3 backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
                                <Shield size={18} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Usuario / ID</label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-joa-cyan to-joa-blue rounded-xl blur opacity-0 group-focus-within:opacity-30 transition-opacity duration-300"></div>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-joa-cyan transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-[#0a0f1c]/50 border border-slate-700/50 rounded-xl focus:border-joa-cyan outline-none transition-all text-white font-medium placeholder-slate-600 focus:bg-[#0a0f1c]/80 shadow-inner shadow-black/20"
                                            placeholder="nombre.apellido"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contraseña</label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-r from-joa-cyan to-joa-blue rounded-xl blur opacity-0 group-focus-within:opacity-30 transition-opacity duration-300"></div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-joa-cyan transition-colors" size={20} />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-[#0a0f1c]/50 border border-slate-700/50 rounded-xl focus:border-joa-cyan outline-none transition-all text-white font-medium placeholder-slate-600 focus:bg-[#0a0f1c]/80 shadow-inner shadow-black/20 tracking-widest"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-4 mt-6 relative group overflow-hidden rounded-xl bg-[#060b19] border border-joa-cyan/30 flex items-center justify-center transition-all duration-300 hover:border-joa-cyan hover:shadow-[0_0_30px_rgba(0,210,255,0.3)]"
                            >
                                {/* Brillo de fondo del botón */}
                                <div className="absolute inset-0 bg-gradient-to-r from-joa-blue/80 to-joa-cyan/80 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out z-0"></div>
                                
                                <span className="relative z-10 flex items-center gap-2 text-joa-cyan group-hover:text-white font-bold tracking-wide transition-colors duration-300">
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={20} />
                                    ) : (
                                        <>
                                            ACCEDER AL PORTAL
                                            <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform duration-300" />
                                        </>
                                    )}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>

            </div>

            {/* Créditos flotantes */}
            <div className="absolute bottom-6 w-full text-center text-slate-500 text-[10px] tracking-widest uppercase font-bold z-10 opacity-60">
                © {new Date().getFullYear()} JOA Technologien. Sistema Encriptado.
            </div>
        </div>
    );
};

export default LoginPage;
