import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Euro, Users, Download, Filter, Search, Wallet, CheckCircle } from 'lucide-react';

const PayrollPage = () => {
    // 1. Calculate Default Date Range (21st Prev - 20th Current)
    const calculateDefaultDates = () => {
        const now = new Date();
        const currentDay = now.getDate();
        let start, end;

        if (currentDay <= 20) {
            // Previous cycle: Prev Month 21 - Current Month 20
            start = new Date(now.getFullYear(), now.getMonth() - 1, 21);
            end = new Date(now.getFullYear(), now.getMonth(), 20);
        } else {
            // Current cycle: Current Month 21 - Next Month 20
            start = new Date(now.getFullYear(), now.getMonth(), 21);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 20);
        }
        // Fix JS Date offset issues by using local string components or specific UTC handling if needed
        // Simple YYYY-MM-DD generation:
        const toDateInput = (date) => {
            const offset = date.getTimezoneOffset();
            date = new Date(date.getTime() - (offset * 60 * 1000));
            return date.toISOString().split('T')[0];
        };

        return {
            start: toDateInput(start),
            end: toDateInput(end)
        };
    };

    const defaults = calculateDefaultDates();

    const [filters, setFilters] = useState({
        startDate: defaults.start,
        endDate: defaults.end,
        userId: 'all'
    });

    const [summary, setSummary] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchPayrollData();
    }, [filters]);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/api/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchPayrollData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.userId) params.append('userId', filters.userId);

            const res = await api.get(`/api/payroll/summary?${params.toString()}`);
            setSummary(res.data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    // Helper formatter
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-joa-blue" /> Nóminas y Bonus
                    </h2>
                    <p className="text-slate-500 text-sm">Cálculo preciso para gestoría (Ciclo 21 - 20)</p>
                </div>

                <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                    <Download size={16} /> Exportar CSV
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Técnico</label>
                    <div className="relative">
                        <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-joa-blue bg-slate-50 appearance-none"
                            value={filters.userId}
                            onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                        >
                            <option value="all">Todos los Técnicos</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.username} ({u.role})</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Desde (Inicio Ciclo)</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-joa-blue bg-slate-50"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Hasta (Cierre Ciclo)</label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="date"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-joa-blue bg-slate-50"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="text-center py-12 text-slate-500">Calculando nóminas...</div>
            ) : summary.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
                    No hay datos en este rango de fechas.
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
                    {summary.map(item => (
                        <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all flex flex-col">
                            {/* Card Header */}
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800">{item.username}</h3>
                                        <p className="text-xs text-slate-500 uppercase font-bold">{item.role}</p>
                                    </div>
                                    <div className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase">
                                        {item.production?.teamName || 'Sin Equipo'}
                                    </div>
                                </div>
                            </div>

                            {/* Financial Summary */}
                            <div className="p-6 space-y-3 flex-grow">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Sueldo Base</span>
                                    <span className="font-bold text-slate-700">{money(item.baseSalary)}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Bonus Producción</span>
                                    <span className={`font-bold ${item.bonus > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                                        +{money(item.bonus)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">Extras Sábados</span>
                                    <span className={`font-bold ${item.saturday > 0 ? 'text-blue-600' : 'text-slate-400'}`}>
                                        +{money(item.saturday)}
                                    </span>
                                </div>

                                <div className="pt-4 border-t border-slate-100 mt-2">
                                    <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-lg shadow-slate-200">
                                        <span className="text-xs font-bold uppercase">Total a Pagar</span>
                                        <span className="text-lg font-bold">{money(item.total)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Production Detail (Team Contribution) */}
                            {/* Production Detail (Team Contribution or Personal) */}
                            <div className="bg-slate-50 p-4 border-t border-slate-100 text-xs text-slate-500">
                                {item.role === 'BACK_OFFICE' ? (
                                    <>
                                        <p className="font-bold mb-2 uppercase text-[10px] tracking-wider text-slate-400">Rendimiento Individual</p>
                                        <div className="flex justify-between items-center mb-1">
                                            <span>Citas Agendadas (Periodo):</span>
                                            <span className="font-bold text-slate-700 text-sm">{item.production?.appointmentsDone || 0}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span>Ingresos Generados:</span>
                                            <span className="font-bold text-green-600 text-sm">{money(item.production?.totalRevenue)}</span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-bold mb-2 uppercase text-[10px] tracking-wider text-slate-400">Producción del Equipo</p>
                                        <div className="grid grid-cols-4 gap-2 text-center">
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700">{item.production?.counts?.bp || 0}</div>
                                                <div className="text-[9px] uppercase">BP</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700">{item.production?.counts?.ta || 0}</div>
                                                <div className="text-[9px] uppercase">TA</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700">{item.production?.counts?.multi || 0}</div>
                                                <div className="text-[9px] uppercase">MUL</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700">{item.production?.counts?.mdu || 0}</div>
                                                <div className="text-[9px] uppercase">MDU</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PayrollPage;
