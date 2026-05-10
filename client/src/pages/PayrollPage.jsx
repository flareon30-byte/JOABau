import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Euro, Users, Download, Filter, Search, Wallet, CheckCircle, X, Truck, Navigation, Trash2 } from 'lucide-react';

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
    const [showDietaEditor, setShowDietaEditor] = useState(false);
    const [selectedUserForDieta, setSelectedUserForDieta] = useState(null);

    const handleAdminDietaLog = async (userId, date, type) => {
        try {
            await api.post('/api/dietas/admin/log', { userId, date, type });
            fetchPayrollData(); // Refresh summary after override
        } catch (error) {
            console.error('Error in admin dieta log:', error);
            alert('Error al gestionar dieta');
        }
    };


    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/payroll/history');
            setHistory(res.data);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleArchiveCycle = async () => {
        if (!window.confirm('¿Deseas realizar la FOTO FINISH del ciclo actual? Esto guardará los datos de todos los trabajadores (puntos, dietas, bonus) y sellará el periodo del 21 al 20.')) return;
        
        setIsArchiving(true);
        try {
            const res = await api.post('/api/payroll/archive');
            alert(res.data.message);
            fetchPayrollData();
            fetchHistory();
        } catch (error) {
            console.error('Error archiving cycle:', error);
            alert('Error al cerrar el ciclo');
        } finally {
            setIsArchiving(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchHistory();
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

    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    const handleExportCSV = () => {
        if (summary.length === 0) return;
        const headers = ["Trabajador", "Rol", "Equipo", "Sueldo Base", "Bonus Produccion", "Extras Sabados", "Dietas", "Total Neto"];
        const rows = summary.map(u => [
            `"${u.username}"`,
            u.role,
            `"${u.production?.teamName || 'Sin Equipo'}"`,
            u.baseSalary.toFixed(2).replace('.', ','),
            u.bonus.toFixed(2).replace('.', ','),
            u.saturday.toFixed(2).replace('.', ','),
            u.dietaPay.toFixed(2).replace('.', ','),
            u.total.toFixed(2).replace('.', ',')
        ]);
        const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Nominas_JOA_${filters.startDate}_al_${filters.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {showHistory && (
                <PayrollHistoryModal 
                    history={history} 
                    onClose={() => setShowHistory(false)} 
                />
            )}
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Wallet className="text-joa-blue" /> Nóminas y Bonus
                    </h2>
                    <p className="text-slate-500 text-sm">Cálculo preciso para gestoría (Ciclo 21 - 20)</p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowHistory(true)}
                        className="flex items-center gap-2 bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                    >
                        <Calendar size={16} /> Ver Historial
                    </button>
                    <button 
                        onClick={handleArchiveCycle}
                        disabled={isArchiving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${isArchiving ? 'bg-slate-400' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}
                    >
                        {isArchiving ? 'Cerrando...' : <><CheckCircle size={16} /> Cerrar Ciclo (20) </>}
                    </button>
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors"
                    >
                        <Download size={16} /> Exportar CSV
                    </button>
                </div>
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
                                <div className="flex justify-between items-center text-sm">
                                    <div className="flex flex-col">
                                        <span className="text-slate-500">Dietas Acumuladas</span>
                                        <span className="text-[10px] text-slate-400">{item.dietasCount} días registrados</span>
                                    </div>
                                    <span className={`font-bold ${item.dietaPay > 0 ? 'text-joa-blue' : 'text-slate-400'}`}>
                                        +{money(item.dietaPay)}
                                    </span>
                                </div>

                                <div className="pt-4 border-t border-slate-100 mt-2">
                                    <div className="flex justify-between items-center bg-slate-800 text-white p-3 rounded-xl shadow-lg shadow-slate-200">
                                        <span className="text-xs font-bold uppercase">Total a Pagar</span>
                                        <span className="text-lg font-bold">{money(item.total)}</span>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        setSelectedUserForDieta(item);
                                        setShowDietaEditor(true);
                                    }}
                                    className="w-full mt-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-joa-blue hover:text-white transition-all transform active:scale-95"
                                >
                                    Corregir / Añadir Dietas
                                </button>
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
                                        <div className="grid grid-cols-6 gap-1 text-center">
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.bp || 0}</div>
                                                <div className="text-[8px] uppercase">UNI</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.bif || 0}</div>
                                                <div className="text-[8px] uppercase">BIF</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.ta || 0}</div>
                                                <div className="text-[8px] uppercase">TA</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.mul || 0}</div>
                                                <div className="text-[8px] uppercase">MUL</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.mdu || 0}</div>
                                                <div className="text-[8px] uppercase">MDU</div>
                                            </div>
                                            <div className="bg-white p-1 rounded border border-slate-200">
                                                <div className="font-bold text-slate-700 text-xs">{item.production?.counts?.repair || 0}</div>
                                                <div className="text-[8px] uppercase">AVE</div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showDietaEditor && selectedUserForDieta && (
                <DietaCalendarModal 
                    user={selectedUserForDieta} 
                    onClose={() => setShowDietaEditor(false)} 
                    onSave={handleAdminDietaLog}
                />
            )}
        </div>
    );
};

const DietaCalendarModal = ({ user, onClose, onSave }) => {
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [dietas, setDietas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingDate, setSavingDate] = useState(null);

    const fetchUserDietas = async () => {
        setLoading(true);
        try {
            const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString();
            const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
            const res = await api.get(`/api/dietas/user?userId=${user.id}&startDate=${start}&endDate=${end.toISOString()}`);
            setDietas(res.data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserDietas();
    }, [currentMonth, user.id]);

    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

    const renderCalendar = () => {
        const month = currentMonth.getMonth();
        const year = currentMonth.getFullYear();
        const totalDays = daysInMonth(month, year);
        const startDay = (firstDayOfMonth(month, year) + 6) % 7; // Adjust for Monday start
        
        const days = [];
        // Empty slots for padding
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`empty-${i}`} className="p-4 border border-slate-50 opacity-20"></div>);
        }

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dieta = dietas.find(log => {
                const logDate = new Date(log.date);
                return logDate.getDate() === d && logDate.getMonth() === month;
            });

            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            days.push(
                <div 
                    key={d} 
                    onClick={() => setSavingDate(dateStr)}
                    className={`relative p-3 h-20 border border-slate-100 transition-all cursor-pointer hover:bg-joa-blue/5 flex flex-col items-center justify-between
                        ${isToday ? 'bg-blue-50/50' : ''}
                        ${dieta?.type === 'HOTEL' ? 'bg-blue-600/10' : ''}
                        ${dieta?.type === 'CASA' ? 'bg-slate-100' : ''}
                    `}
                >
                    <span className={`text-xs font-bold ${isToday ? 'text-joa-blue underline decoration-2' : 'text-slate-400'}`}>{d}</span>
                    {dieta && (
                        <div className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm text-center w-full truncate
                            ${dieta.isSaturday ? 'bg-orange-500 text-white animate-pulse' : (dieta.type === 'HOTEL' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white')}
                        `}>
                            {dieta.isSaturday ? `✨ SÁBADO (${money(dieta.amount)})` : (dieta.type === 'HOTEL' ? `🏨 HOTEL (${money(dieta.amount)})` : `🏠 CASA (${money(dieta.amount)})`)}
                        </div>
                    )}
                    {!dieta && <div className="h-4"></div>}
                </div>
            );
        }
        return days;
    };

    const handleAction = async (type) => {
        await onSave(user.id, savingDate, type);
        setSavingDate(null);
        fetchUserDietas(); // Refresh inner calendar
    };

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative border-4 border-joa-blue animate-in zoom-in-95 duration-200">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 z-50">
                    <X size={24} />
                </button>

                <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-joa-blue p-2 rounded-xl text-white">
                            <Calendar size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">Calendario de Dietas</h3>
                            <p className="text-xs text-slate-500">Repasando: <b className="text-slate-700">{user.username}</b></p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded-lg"
                        >
                            &larr;
                        </button>
                        <span className="text-sm font-black text-slate-700 uppercase">
                            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button 
                            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
                            className="p-1 hover:bg-slate-200 rounded-lg"
                        >
                            &rarr;
                        </button>
                    </div>
                </div>

                <div className="p-1 bg-slate-100">
                    <div className="grid grid-cols-7 text-center py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 bg-white">
                        {loading ? (
                            <div className="col-span-7 h-64 flex items-center justify-center text-slate-400 text-sm italic">
                                Sincronizando historial...
                            </div>
                        ) : renderCalendar()}
                    </div>
                </div>

                <div className="p-4 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-600 rounded"></div> Hotel (28€)</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-slate-400 rounded"></div> Casa (14€)</div>
                    </div>
                    <span>Pulsa en un día para editar o borrar</span>
                </div>

                {savingDate && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
                        <div className="bg-white rounded-2xl w-full max-w-xs p-6 shadow-2xl scale-in-center">
                            <h4 className="text-center font-bold text-slate-800 mb-4">
                                GESTIÓN: {new Date(savingDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                            </h4>
                            <div className="space-y-3">
                                <button onClick={() => handleAction('HOTEL')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2">
                                    <Truck size={18} /> Asignar Hotel (28€)
                                </button>
                                <button onClick={() => handleAction('CASA')} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 flex items-center justify-center gap-2">
                                    <Navigation size={18} /> Asignar Casa (14€)
                                </button>
                                <button onClick={() => handleAction('DELETE')} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 flex items-center justify-center gap-2">
                                    <Trash2 size={18} /> Eliminar Registro
                                </button>
                                <button onClick={() => setSavingDate(null)} className="w-full py-2 text-slate-400 text-sm font-bold mt-2">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const PayrollHistoryModal = ({ history, onClose }) => {
    const money = (val) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val || 0);

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[80vh] overflow-hidden shadow-2xl relative flex flex-col border-4 border-slate-100">
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 z-50">
                    <X size={28} />
                </button>

                <div className="p-8 bg-slate-50 border-b border-slate-100">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <Calendar className="text-joa-blue" size={28} /> Archivo de Nóminas Cerradas
                    </h3>
                    <p className="text-slate-500 text-sm font-medium">Historial de Foto Finish (Ciclos 21-20)</p>
                </div>

                <div className="flex-grow overflow-y-auto p-4 md:p-8">
                    {history.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 italic">No hay ciclos cerrados todavía.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {history.map(log => (
                                <div key={log.id} className="bg-white border-2 border-slate-100 rounded-2xl p-5 hover:border-joa-blue/30 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="text-[10px] font-black text-joa-blue uppercase tracking-widest">{log.user?.username || 'Usuario'}</div>
                                            <div className="text-lg font-black text-slate-800 uppercase">
                                                {new Date(log.year, log.month - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div className="bg-slate-100 px-3 py-1 rounded-full text-[10px] font-black text-slate-500">
                                            {log.cycleStart ? log.cycleStart.split('T')[0].split('-').reverse().join('/') : '---'} - {log.cycleEnd ? log.cycleEnd.split('T')[0].split('-').reverse().join('/') : '---'}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">Puntos</div>
                                            <div className="text-sm font-black text-slate-700">{log.points} pts</div>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="text-[9px] text-slate-400 font-bold uppercase">Dietas ({log.dietasCount})</div>
                                            <div className="text-sm font-black text-slate-700">{money(log.dietasAmount)}</div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center bg-slate-900 text-white p-3 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase">Neto Foto Finish</span>
                                        <span className="text-lg font-black">{money(log.totalEuros)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button onClick={onClose} className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-900 transition-all">
                        Cerrar Visor
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PayrollPage;

