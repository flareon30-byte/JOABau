import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
    FileText, Search, Calendar, CheckCircle2, Download, 
    Filter, AlertCircle, FilePlus, Loader, ChevronRight,
    Euro, Trash2, CheckCircle, Clock, Pencil, Building2, RefreshCw
} from 'lucide-react';

const InvoicingPage = () => {
    const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'invoices', 'clients'
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState('');
    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [pendingWork, setPendingWork] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    
    // Client Edit State
    const [editingClient, setEditingClient] = useState(null);
    const [clientForm, setClientForm] = useState({
        name: '', legalName: '', taxId: '', address: '', city: '', postalCode: '', country: 'ES', billingEmail: '', defaultVat: 21
    });

    // UI State
    const [selectedItems, setSelectedItems] = useState({
        activations: [],
        soplados: [],
        fusions: [],
        installations: []
    });

    const fetchData = async () => {
        try {
            console.log('Solicitando datos de facturación...');
            const [clientsRes, invoicesRes] = await Promise.all([
                api.get('/api/clients').catch(e => { console.error('Error clientes:', e); return { data: [] }; }),
                api.get('/api/invoices').catch(e => { console.error('Error facturas:', e); return { data: [] }; })
            ]);
            console.log('Clientes recibidos:', clientsRes.data);
            setClients(clientsRes.data);
            setInvoices(clientsRes.data.invoices || invoicesRes.data || []);
        } catch (error) {
            console.error('Error cargando datos', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchPendingWork = async () => {
        if (!selectedClient) return;
        setLoading(true);
        try {
            console.log('Buscando producción pendiente...');
            const { data } = await api.get(`/api/invoices/pending?clientId=${selectedClient}&startDate=${dateRange.start}&endDate=${dateRange.end}`);
            
            // Filtro de exclusión de valor 0
            const filteredData = {
                activations: (data.activations || []).filter(act => (act.basePrice || 250) > 0),
                soplados: (data.soplados || []).filter(s => (s.meters * 0.4) > 0),
                fusions: (data.fusions || []).filter(f => (f.priceToClient || 0) > 0),
                installations: (data.installations || []).filter(i => (i.priceToClient || 0) > 0)
            };

            setPendingWork(filteredData);
            setSelectedItems({
                activations: filteredData.activations.map(i => i.id),
                soplados: filteredData.soplados.map(i => i.id),
                fusions: filteredData.fusions.map(i => i.id),
                installations: filteredData.installations.map(i => i.id)
            });
        } catch (error) {
            console.error('Error factura:', error);
            alert('Error cargando producción pendiente');
        } finally {
            setLoading(false);
        }
    };

    const handleEditClient = (client) => {
        setEditingClient(client);
        setClientForm({
            name: client.name,
            legalName: client.legalName || '',
            taxId: client.taxId || '',
            address: client.address || '',
            city: client.city || '',
            postalCode: client.postalCode || '',
            country: client.country || 'ES',
            billingEmail: client.billingEmail || '',
            defaultVat: client.defaultVat || 21
        });
        setActiveTab('clients');
    };

    const saveClient = async () => {
        try {
            await api.put(`/api/clients/${editingClient.id}`, clientForm);
            alert('Cliente actualizado con éxito');
            setEditingClient(null);
            fetchData();
        } catch (error) {
            alert('Error actualizando cliente');
        }
    };

    const toggleItem = (type, id) => {
        setSelectedItems(prev => ({
            ...prev,
            [type]: prev[type].includes(id) 
                ? prev[type].filter(i => i !== id) 
                : [...prev[type], id]
        }));
    };

    const handleGenerateInvoice = async () => {
        if (!selectedClient) return;
        setGenerating(true);
        try {
            await api.post('/api/invoices', {
                clientId: selectedClient,
                date: new Date().toISOString(),
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), 
                itemIds: selectedItems
            });
            alert('¡Factura generada con éxito!');
            setPendingWork(null);
            setActiveTab('invoices');
            fetchData();
        } catch (error) {
            alert('Error generando factura');
        } finally {
            setGenerating(false);
        }
    };

    const updateInvoiceStatus = async (id, status) => {
        try {
            await api.patch(`/api/invoices/${id}/status`, { status });
            fetchData();
        } catch (error) {
            alert('Error actualizando estado');
        }
    };

    const handleRegeneratePdf = async (id) => {
        try {
            const { data } = await api.post(`/api/invoices/${id}/regenerate`);
            if (data.success) {
                alert('¡PDF regenerado con éxito con el nuevo diseño!');
                fetchData();
            }
        } catch (error) {
            alert('Error regenerando PDF');
        }
    };

    const money = (val) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <FileText className="text-blue-600" size={32} />
                        Gestión Económica
                    </h2>
                    <p className="text-slate-500">Facturación, Cobros y Clientes</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                {[
                    { id: 'pending', label: 'Producción Pendiente', icon: FilePlus },
                    { id: 'invoices', label: 'Historial Facturas', icon: Clock },
                    { id: 'clients', label: 'Fichas Clientes', icon: Building2 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                            activeTab === tab.id ? 'bg-white text-blue-600 shadow-md' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'pending' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-300">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <FilePlus className="text-blue-500" size={24} />
                                Generar Nueva Factura
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Cliente</label>
                                    <select 
                                        className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none outline-none"
                                        value={selectedClient}
                                        onChange={(e) => setSelectedClient(e.target.value)}
                                    >
                                        <option value="">Seleccionar Cliente...</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Desde</label>
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none outline-none text-sm"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Hasta</label>
                                    <input 
                                        type="date"
                                        className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none outline-none text-sm"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={fetchPendingWork}
                                disabled={!selectedClient || loading}
                                className="w-full py-4 bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-3 shadow-lg"
                            >
                                {loading ? <Loader className="animate-spin" /> : <Search size={20} />}
                                Buscar Producción Pendiente
                            </button>
                        </div>

                        {pendingWork && (
                            <div className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-blue-100 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h4 className="text-xl font-black text-slate-800">Trabajos Detectados</h4>
                                        <p className="text-sm text-slate-500">Selecciona elementos para la factura</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase">Total Seleccionado</p>
                                        <p className="text-2xl font-black text-blue-600">
                                            {money(
                                                (pendingWork.activations.filter(i => selectedItems.activations.includes(i.id)).reduce((acc, a) => {
                                                    return acc + (a.basePrice || 0) + (a.taPrice || 0) + (a.spPrice || 0) + (a.mduPrice || 0) + (a.repairPrice || 0);
                                                }, 0)) +
                                                (pendingWork.soplados.filter(i => selectedItems.soplados.includes(i.id)).reduce((acc, s) => acc + (s.meters * 0.4), 0))
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                                    {pendingWork.activations
                                        .filter(act => ((act.basePrice || 0) + (act.taPrice || 0) + (act.spPrice || 0)) > 0)
                                        .map(act => (
                                        <div key={act.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-white border border-transparent hover:border-blue-100 transition-all">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedItems.activations.includes(act.id)}
                                                onChange={() => toggleItem('activations', act.id)}
                                                className="w-5 h-5 rounded border-slate-300"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800 text-sm">{act.address.street} {act.address.number}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-black">{act.activationType}</p>
                                                <div className="flex gap-2 text-[|9px] font-black uppercase">
                                                    {((act.taCount > 0) || (act.taInstalled || (act.taPrice > 0) || act.activationType === 'SDU')) && (
                                                        <span className="text-blue-600">TA:{(act.taCount > 0) ? act.taCount : 1}</span>
                                                    )}
                                                    {(act.spInstalled > 0 || (act.spPrice > 0)) && (
                                                        <span className="text-purple-600">SP:{act.spInstalled || 1}</span>
                                                    )}
                                                    {(act.mduInstalled || (act.mduPrice > 0)) && (
                                                        <span className="text-orange-600">MDU</span>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="font-black text-blue-600 text-sm">
                                                {money((act.basePrice || 0) + (act.taPrice || 0) + (act.spPrice || 0) + (act.mduPrice || 0) + (act.repairPrice || 0))}
                                            </span>
                                        </div>
                                    ))}
                                    {pendingWork.soplados
                                        .filter(s => (s.meters * 0.4) > 0)
                                        .map(s => (
                                        <div key={s.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-white border border-transparent hover:border-blue-100 transition-all">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedItems.soplados.includes(s.id)}
                                                onChange={() => toggleItem('soplados', s.id)}
                                                className="w-5 h-5 rounded border-slate-300"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-slate-800 text-sm">{s.address.street} ({s.meters}m)</p>
                                                <p className="text-[10px] text-slate-400 uppercase">Soplado de Fibra</p>
                                            </div>
                                            <span className="font-black text-orange-600 text-sm">{money(s.meters * 0.4)}</span>
                                        </div>
                                    ))}
                                </div>

                                <button 
                                    onClick={handleGenerateInvoice}
                                    disabled={generating || (selectedItems.activations.length === 0 && selectedItems.soplados.length === 0)}
                                    className="w-full mt-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-blue-700 shadow-xl"
                                >
                                    {generating ? <Loader className="animate-spin" /> : <FilePlus size={20} className="inline mr-2" />}
                                    Generar Factura Oficial
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'invoices' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
                    {invoices.length === 0 ? (
                        <div className="col-span-full bg-white rounded-3xl p-20 text-center border-2 border-dashed border-slate-200">
                            <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No hay facturas emitidas</p>
                        </div>
                    ) : (
                        invoices.map(invoice => (
                            <div key={invoice.id} className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 hover:shadow-2xl transition-all">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">{invoice.number}</p>
                                        <h4 className="font-bold text-slate-800">{invoice.client.name}</h4>
                                    </div>
                                    <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${
                                        invoice.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                    }`}>
                                        {invoice.status === 'PAID' ? 'Cobrada' : 'Pendiente'}
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl flex justify-between items-center mb-6">
                                    <div className="text-lg font-black text-slate-800">{money(invoice.total)}</div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleRegeneratePdf(invoice.id)}
                                            title="Regenerar PDF con nuevo diseño"
                                            className="p-3 bg-white text-orange-600 rounded-xl shadow-md hover:bg-orange-600 hover:text-white transition-all"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                        <a href={invoice.pdfPath} target="_blank" rel="noreferrer" className="p-3 bg-white text-blue-600 rounded-xl shadow-md hover:bg-blue-600 hover:text-white transition-all">
                                            <Download size={18} />
                                        </a>
                                        <button 
                                            onClick={async () => {
                                                if (window.confirm(`¿Seguro que quieres borrar la factura ${invoice.number}? Los trabajos incluidos se liberarán para poder facturarlos de nuevo.`)) {
                                                    try {
                                                        await api.delete(`/api/invoices/${invoice.id}`);
                                                        fetchData();
                                                    } catch (e) { alert('Error al borrar factura'); }
                                                }
                                            }}
                                            className="p-3 bg-white text-red-600 rounded-xl shadow-md hover:bg-red-600 hover:text-white transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                {invoice.status !== 'PAID' && (
                                    <button onClick={() => updateInvoiceStatus(invoice.id, 'PAID')} className="w-full py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Marcar como Pagada</button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'clients' && (
                <div className="animate-in fade-in slide-in-from-bottom-4">
                    {editingClient ? (
                        <div className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-blue-100 max-w-2xl mx-auto">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-slate-800">Ficha: {editingClient.name}</h3>
                                <button onClick={() => setEditingClient(null)} className="text-slate-400 font-bold">Cancelar</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                                <div className="space-y-1">
                                    <label className="uppercase text-[9px] text-slate-400">Nombre Descriptivo</label>
                                    <input className="w-full bg-slate-50 p-3 rounded-xl border-none outline-none" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="uppercase text-[9px] text-slate-400">Razón Social (Para facturas)</label>
                                    <input className="w-full bg-slate-50 p-3 rounded-xl border-none outline-none" placeholder="EJ: Glasfaser Plus GMBH" value={clientForm.legalName} onChange={e => setClientForm({...clientForm, legalName: e.target.value})} />
                                </div>
                                <div className="md:col-span-2 space-y-1">
                                    <label className="uppercase text-[9px] text-slate-400">Dirección Fiscal</label>
                                    <textarea className="w-full bg-slate-50 p-3 rounded-xl border-none outline-none" rows="2" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="uppercase text-[9px] text-slate-400">CIF / VAT</label>
                                    <input className="w-full bg-slate-50 p-3 rounded-xl border-none outline-none" value={clientForm.taxId} onChange={e => setClientForm({...clientForm, taxId: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <label className="uppercase text-[9px] text-slate-400">IVA (%)</label>
                                    <input type="number" className="w-full bg-slate-50 p-3 rounded-xl border-none outline-none" value={clientForm.defaultVat} onChange={e => setClientForm({...clientForm, defaultVat: e.target.value})} />
                                </div>
                                <button onClick={saveClient} className="md:col-span-2 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase mt-4">Guardar Cambios</button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="p-4 text-slate-800">Nombre</th>
                                        <th className="p-4">CIF</th>
                                        <th className="p-4">País</th>
                                        <th className="p-4 text-center">Config. Fiscal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.map(c => (
                                        <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                                            <td className="p-4 font-bold">{c.name}</td>
                                            <td className="p-4 font-bold text-slate-500">{c.taxId || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black ${c.country === 'DE' ? 'bg-black text-white' : 'bg-red-100 text-red-600'}`}>{c.country || 'ES'}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleEditClient(c)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Pencil size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InvoicingPage;
