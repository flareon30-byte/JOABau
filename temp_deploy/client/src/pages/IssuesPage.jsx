import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api/axios';
import { Search, Plus, FileText, Image, History, AlertTriangle, CheckCircle, XCircle, Clock, MapPin, User, Calendar, Network, X, Grid, List, ChevronRight, Filter, Edit, Trash2 } from 'lucide-react';
import CalendarView from '../components/CalendarView';
import { useTranslation } from 'react-i18next';

const IssuesPage = () => {
    const { t } = useTranslation();
    const location = useLocation();
    // ... existing state
    const [activeTab, setActiveTab] = useState('search');

    // Parse query params to handle deep-linking from notifications
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tab = params.get('activeTab');
        const status = params.get('status');
        const q = params.get('query');
        
        if (tab) {
            setActiveTab(tab);
        }
        if (status) {
            setRepairsFilter(status.toUpperCase());
        }
        if (q) {
            setSearchParams(prev => ({ ...prev, query: q }));
        }
    }, [location.search]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');

    // Search State
    const [searchParams, setSearchParams] = useState({ city: '', street: '', number: '' });
    const [searchResult, setSearchResult] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    // Create Manual Issue State
    const [manualIssue, setManualIssue] = useState({
        city: '',
        street: '',
        number: '',
        clientName: '',
        teamId: '',
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        description: ''
    });

    // New Claim Modal State
    const [claimModalOpen, setClaimModalOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [claimData, setClaimData] = useState({
        clientName: '',
        teamId: '',
        date: new Date().toISOString().split('T')[0], // Default today
        time: '09:00', // Default time
        description: ''
    });

    const [teams, setTeams] = useState([]);
    const [scheduledAppointments, setScheduledAppointments] = useState([]);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    // Repairs Management State
    const [repairsList, setRepairsList] = useState([]);
    const [repairsFilter, setRepairsFilter] = useState('PENDING'); // PENDING | COMPLETED | ALL
    const [selectedRepair, setSelectedRepair] = useState(null); // For viewing details
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);

    // ... existing useEffect and handlers ...
    useEffect(() => {
        if (activeTab === 'manage') {
            fetchRepairs();
        }
    }, [activeTab, repairsFilter]);

    const fetchRepairs = async () => {
        setLoading(true);
        try {
            console.log("Fetching repairs with status:", repairsFilter);
            const res = await api.get('/api/issues/repairs', {
                params: { status: repairsFilter }
            });
            setRepairsList(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Live Search Effect
    useEffect(() => {
        const query = searchParams.query;

        // Optimización: Si hay query pero es muy corta, no buscar aún
        if (query && query.length < 3) {
            // No limpiar resultados si estamos escribiendo, solo no buscar nuevo
            return;
        }

        setLoading(true);
        setError(null);

        const fetchData = async () => {
            try {
                // If query is empty, the backend now returns "Latest Completed Activations"
                const res = await api.get('/api/issues/search', {
                    params: { query }
                });
                setSearchResult(res.data);
                setHasSearched(true);
            } catch (err) {
                console.error("Search error", err);
                if (err.response && err.response.status === 404) {
                    setSearchResult([]);
                    setHasSearched(true);
                } else {
                    setError(t('issues.error_load') + " " + (err.response?.data?.message || "Error de conexión"));
                }
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchData, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [searchParams.query]);
    useEffect(() => {
        // Fetch teams for assignment
        const fetchTeams = async () => {
            try {
                const res = await api.get('/api/teams');
                setTeams(res.data);
            } catch (err) {
                console.error("Error fetching teams", err);
            }
        };
        fetchTeams();
    }, []);

    const handleSearchChange = (e) => {
        setSearchParams({ ...searchParams, [e.target.name]: e.target.value });
    };

    const handleManualChange = (e) => {
        setManualIssue({ ...manualIssue, [e.target.name]: e.target.value });
    };

    const handleSearch = async (e) => {
        // ... existing handleSearch logic ...
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSearchResult(null); // Clear previous results immediately
        setHasSearched(false);

        try {
            const { city, street, number } = searchParams;
            if (!street) {
                setError(t('issues.error_search')); // Simplificado
                setLoading(false);
                return;
            }

            const res = await api.get('/api/issues/search', {
                params: { city, street, number }
            });

            setSearchResult(res.data);
            setHasSearched(true);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 404) {
                setHasSearched(true);
                setSearchResult(null);
            } else {
                setError(t('issues.error_search'));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateManual = async (e) => {
        // ... existing handleCreateManual logic ...
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage('');

        try {
            const combinedDateTime = manualIssue.time
                ? `${manualIssue.date}T${manualIssue.time}`
                : manualIssue.date;

            const payload = {
                ...manualIssue,
                date: combinedDateTime
            };

            await api.post('/api/issues/create', payload);
            setSuccessMessage(t('issues.success_create_manual'));
            setManualIssue({ ...manualIssue, city: '', street: '', number: '', clientName: '', description: '' });
            setActiveTab('search');
        } catch (err) {
            console.error(err);
            setError(t('issues.error_create_manual'));
        } finally {
            setLoading(false);
        }
    };

    const prefillManualFromSearch = () => {
        const query = searchParams.query || '';
        // Try to parse basic "Street Number"
        const match = query.match(/^(.+?)\s+(\d+[a-zA-Z]*)$/);

        setManualIssue({
            ...manualIssue,
            city: 'Berlin', // Default or leave empty
            street: match ? match[1].trim() : query,
            number: match ? match[2].trim() : ''
        });
        setActiveTab('create');
    };

    // --- NEW CLAIM LOGIC ---
    const openClaimModal = (address) => {
        setSelectedAddress(address);
        setClaimData({
            clientName: address.clientName || '',
            teamId: '',
            date: new Date().toISOString().split('T')[0],
            time: '09:00',
            description: ''
        });
        setClaimModalOpen(true);
    };

    const handleClaimDataChange = (e) => {
        setClaimData({ ...claimData, [e.target.name]: e.target.value });
    };

    const handleCreateClaim = async (e) => {
        e.preventDefault();
        if (!claimData.teamId || !claimData.date || !claimData.time) {
            alert(t('issues.error_create_manual')); // Reused generic error
            return;
        }

        setLoading(true);
        try {
            const combinedDateTime = `${claimData.date}T${claimData.time}`;
            await api.post('/api/issues/create-existing', {
                addressId: selectedAddress.id,
                clientName: claimData.clientName,
                teamId: claimData.teamId,
                date: combinedDateTime,
                description: claimData.description
            });
            setSuccessMessage(t('issues.success_claim'));
            setClaimModalOpen(false);
            handleSearch(e); // Re-run search to update view
        } catch (err) {
            console.error(err);
            alert(t('issues.error_create') + " " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const openCalendar = async () => {
        setIsCalendarOpen(true);
        try {
            const res = await api.get('/api/appointments/scheduled');
            setScheduledAppointments(res.data);
        } catch (error) {
            console.error("Error fetching scheduled appointments", error);
        }
    };

    const handleDateSelect = (day, hour) => {
        const selectedDate = new Date(day);
        const offset = selectedDate.getTimezoneOffset();
        const adjustedDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));

        const formattedTime = hour !== undefined && hour !== null
            ? `${String(hour).padStart(2, '0')}:00`
            : claimData.time || '09:00';

        setClaimData({
            ...claimData,
            date: adjustedDate.toISOString().split('T')[0],
            time: formattedTime
        });
        setIsCalendarOpen(false);
    };

    const StatusBadge = ({ status }) => {
        if (!status) return <span className="text-gray-400">-</span>;
        if (status === 'OK' || status === 'COMPLETED' || status === 'Active') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> {status}</span>;
        if (status === 'Pending' || status === 'PENDING') return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12} /> {status}</span>;
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><XCircle size={12} /> {status}</span>;
    };

    // Edit/Delete State
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingRepair, setEditingRepair] = useState(null);

    const handleDeleteRepair = async (id) => {
        if (!window.confirm(t('issues.confirm_delete'))) return;

        setLoading(true);
        try {
            await api.delete(`/api/issues/repair/${id}`);
            setSuccessMessage(t('issues.success_delete'));
            fetchRepairs();
        } catch (err) {
            console.error(err);
            alert(t('issues.error_delete') + " " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (item) => {
        let defaultTime = '09:00';
        if (item.assignedDate) {
            const parts = item.assignedDate.split('T');
            if (parts.length > 1) {
                defaultTime = parts[1].substring(0, 5);
            }
        }
        setEditingRepair({
            id: item.id,
            teamId: item.assignedTeamId || '',
            date: item.assignedDate ? item.assignedDate.split('T')[0] : '',
            time: defaultTime,
            description: item.comments && item.comments.length > 0 ? item.comments[0].content.replace('RECLAMACIÓN/AVERÍA: ', '').replace('ACTUALIZACIÓN AVERÍA: ', '') : ''
        });
        setEditModalOpen(true);
    };

    const handleUpdateRepair = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const combinedDateTime = editingRepair.time
                ? `${editingRepair.date}T${editingRepair.time}`
                : editingRepair.date;

            await api.put(`/api/issues/repair/${editingRepair.id}`, {
                teamId: editingRepair.teamId,
                date: combinedDateTime,
                description: editingRepair.description
            });
            setSuccessMessage(t('issues.success_update'));
            setEditModalOpen(false);
            fetchRepairs();
        } catch (err) {
            console.error(err);
            alert(t('issues.error_update') + " " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="text-joa-blue" />
                        {t('issues.title_main')}
                    </h1>
                    <p className="text-slate-500">{t('issues.subtitle')}</p>
                </div>

                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-joa-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Search size={16} /> {t('issues.search_address')}
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-joa-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={16} /> {t('issues.new_manual')}
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'manage' ? 'bg-joa-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <List size={16} /> {t('issues.manage_issues')}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 text-red-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertTriangle size={20} />
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-50 border-l-4 border-green-500 p-4 text-green-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle size={20} />
                    {successMessage}
                </div>
            )}

            {activeTab === 'search' && (
                <div className="space-y-6">
                    {/* Search Bar Filter */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex-1 w-full relative">
                            <input
                                type="text"
                                placeholder={t('issues.filter_placeholder')}
                                value={searchParams.query || ''}
                                onChange={(e) => {
                                    setSearchParams({ ...searchParams, query: e.target.value });
                                }}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-joa-blue/50 transition-all shadow-sm"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                        <div className="text-sm text-slate-500 font-medium whitespace-nowrap">
                            {loading ? (
                                <span className="flex items-center gap-2 text-joa-blue"><div className="animate-spin h-4 w-4 border-2 border-joa-blue border-t-transparent rounded-full"></div> {t('issues.searching')}</span>
                            ) : (
                                <span>{searchResult?.length || 0} {t('issues.results')}</span>
                            )}
                        </div>
                    </div>

                    {/* Results List */}
                    <div className="space-y-4 animate-in fade-in">
                        {(!searchResult || searchResult.length === 0) && !loading && (
                            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-300 mb-4">
                                    <Search size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-700">{t('issues.no_results_title')}</h3>
                                <p className="text-slate-500 max-w-md mx-auto">
                                    {t('issues.no_results_desc')}
                                </p>
                                <button
                                    onClick={prefillManualFromSearch}
                                    className="mt-4 bg-joa-blue text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-all shadow-md inline-flex items-center gap-2"
                                >
                                    <Plus size={16} /> {t('issues.register_manual')}
                                </button>
                            </div>
                        )}

                        {searchResult && searchResult.map((result) => (
                            <div key={result.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                    {/* Info Principal */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                {result.project?.name || t('issues.unknown_project')}
                                            </span>
                                            {result.nvt && (
                                                <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                    NVT: {result.nvt}
                                                </span>
                                            )}
                                        </div>
                                        <h2 className="text-xl font-bold text-slate-800 flex items-baseline gap-2">
                                            {result.street} {result.number}
                                            <span className="text-base font-normal text-slate-500">, {result.city}</span>
                                        </h2>

                                        {/* Status Indicators */}
                                        <div className="flex flex-wrap gap-4 mt-3">
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <Network className={result.sopladoStatus === 'OK' ? "text-green-500" : "text-slate-400"} size={16} />
                                                {t('issues.blown')}: <span className="font-medium">{result.sopladoStatus || t('issues.pending')}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                                <CheckCircle className={result.activationInfo && result.appointment?.status !== 'RECITAR' ? "text-green-500" : (result.activationInfo ? "text-red-500" : "text-slate-400")} size={16} />
                                                {t('issues.activation')}: <span className="font-medium">{result.activationInfo && result.appointment?.status !== 'RECITAR' ? t('issues.completed') : (result.activationInfo ? 'Fallida' : t('issues.pending'))}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 min-w-[180px]">
                                        <button
                                            onClick={() => openClaimModal(result)}
                                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium border border-red-100 w-full"
                                        >
                                            <AlertTriangle size={16} />
                                            {t('issues.create_claim')}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded History (Optional or Inline) */}
                                {(result.repairs?.length > 0 || result.appointment || result.activationInfo) && (
                                    <div className="mt-6 pt-4 border-t border-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {result.activationInfo && result.appointment?.status !== 'RECITAR' && (
                                            <div className="bg-green-50/50 p-3 rounded-lg border border-green-100 text-sm">
                                                <div className="font-bold text-green-800 flex items-center gap-2 mb-1">
                                                    <CheckCircle size={14} /> {t('issues.activation_success')}
                                                </div>
                                                <p className="text-green-700">
                                                    {t('issues.date')}: {new Date(result.activationInfo.createdAt).toLocaleDateString('es-ES')}
                                                </p>
                                                <p className="text-green-600 text-xs text-ellipsis overflow-hidden">
                                                    Técnico: {result.activationInfo.assignedTeam?.name || 'Técnico'}
                                                </p>
                                            </div>
                                        )}

                                        {result.activationInfo && result.appointment?.status === 'RECITAR' && (
                                            <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-sm">
                                                <div className="font-bold text-red-800 flex items-center gap-2 mb-1">
                                                    <AlertTriangle size={14} /> Pendiente de activar (Requiere recitar)
                                                </div>
                                                <p className="text-red-700">
                                                    {t('issues.date')}: {new Date(result.activationInfo.createdAt).toLocaleDateString('es-ES')}
                                                </p>
                                                <p className="text-red-600 text-xs text-ellipsis overflow-hidden">
                                                    Técnico: {result.activationInfo.assignedTeam?.name || 'Técnico'}
                                                </p>
                                            </div>
                                        )}

                                        {result.repairs?.map(repair => (
                                            <div key={repair.id} className="bg-purple-50/50 p-3 rounded-lg border border-purple-100 text-sm">
                                                <div className="font-bold text-purple-800 flex items-center gap-2 mb-1">
                                                    <AlertTriangle size={14} /> {t('issues.repair_done')}
                                                </div>
                                                <p className="text-purple-700">
                                                    {new Date(repair.createdAt).toLocaleDateString('es-ES')}
                                                </p>
                                                <p className="italic text-purple-600 text-xs truncate">{repair.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'create' && (
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Plus className="text-joa-blue" />
                        {t('issues.register_manual_title')}
                    </h2>
                    <form onSubmit={handleCreateManual} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.city')}</label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={manualIssue.city}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.street')}</label>
                                    <input
                                        type="text"
                                        name="street"
                                        value={manualIssue.street}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.number')}</label>
                                    <input
                                        type="text"
                                        name="number"
                                        value={manualIssue.number}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.client_name')}</label>
                                    <input
                                        type="text"
                                        name="clientName"
                                        value={manualIssue.clientName}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder={t('issues.optional')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.assign_team')}</label>
                                    <select
                                        name="teamId"
                                        value={manualIssue.teamId}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                    >
                                        <option value="">{t('issues.unassigned')}</option>
                                        {teams.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.appointment_date')}</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            name="date"
                                            value={manualIssue.date}
                                            onChange={handleManualChange}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                            required
                                        />
                                        <input
                                            type="time"
                                            name="time"
                                            value={manualIssue.time}
                                            onChange={handleManualChange}
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.problem_desc')}</label>
                            <textarea
                                name="description"
                                value={manualIssue.description}
                                onChange={handleManualChange}
                                rows="3"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                placeholder={t('issues.problem_placeholder')}
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setActiveTab('search')}
                                className="px-6 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                {t('issues.cancel')}
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 rounded-lg bg-joa-blue text-white hover:bg-blue-600 transition-colors shadow-lg shadow-joa-blue/30 font-medium"
                            >
                                {loading ? t('issues.processing') : t('issues.create_issue_btn')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* MANAGE TAB */}
            {activeTab === 'manage' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Filter size={16} /> {t('issues.status')}
                            </span>
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setRepairsFilter('PENDING')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${repairsFilter === 'PENDING' ? 'bg-white text-yellow-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('issues.status_pending_tab')}
                                </button>
                                <button
                                    onClick={() => setRepairsFilter('COMPLETED')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${repairsFilter === 'COMPLETED' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('issues.status_completed_tab')}
                                </button>
                                <button
                                    onClick={() => setRepairsFilter('ALL')}
                                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${repairsFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    {t('issues.status_all_tab')}
                                </button>
                            </div>
                        </div>
                        <button onClick={fetchRepairs} className="text-slate-400 hover:text-joa-blue transition-colors">
                            <History size={20} />
                        </button>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {loading && repairsList.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">{t('issues.loading_claims')}</div>
                        ) : repairsList.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">{t('issues.no_claims')}</div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="p-4">{t('issues.col_date')}</th>
                                        <th className="p-4">{t('issues.col_address')}</th>
                                        <th className="p-4">{t('issues.col_problem')}</th>
                                        <th className="p-4">{t('issues.col_team')}</th>
                                        <th className="p-4">{t('issues.col_status')}</th>
                                        <th className="p-4">{t('issues.col_actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                                    {repairsList.map((item) => {
                                        const isRepairObj = item.addressId && item.technicianId;
                                        const address = item.address;
                                        const date = isRepairObj ? item.updatedAt : item.assignedDate;
                                        const status = isRepairObj ? 'COMPLETADO' : item.status;
                                        const problemDesc = !isRepairObj
                                            ? (item.comments && item.comments.length > 0 ? item.comments[0].content : t('issues.no_desc'))
                                            : t('issues.view_detail');

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-700">
                                                        {new Date(date).toLocaleDateString('es-ES')}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{address.street} {address.number}</div>
                                                    <div className="text-xs text-slate-500">{address.city}</div>
                                                    <div className="text-[10px] text-slate-400 mt-1 uppercase bg-slate-100 inline-block px-1 rounded">{address.project?.name}</div>
                                                </td>
                                                <td className="p-4 max-w-xs truncate" title={problemDesc}>
                                                    {isRepairObj ? (
                                                        <span className="text-green-600 font-medium italic">{t('issues.resolved')}</span>
                                                    ) : (
                                                        <span className="text-red-500">{problemDesc}</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    {!isRepairObj ? (
                                                        item.assignedTeam ? <span className="flex items-center gap-1"><User size={14} /> {item.assignedTeam.name}</span> : <span className="text-red-300">{t('issues.unassigned')}</span>
                                                    ) : (
                                                        address.appointment?.assignedTeam?.name || 'Técnico'
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <StatusBadge status={status} />
                                                </td>
                                                <td className="p-4">
                                                    {isRepairObj && (
                                                        <button
                                                            onClick={() => { setSelectedRepair(item); setDetailsModalOpen(true); }}
                                                            className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center gap-1 border border-blue-200 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors"
                                                        >
                                                            <FileText size={14} /> {t('issues.view_report')}
                                                        </button>
                                                    )}
                                                    {!isRepairObj && repairsFilter !== 'COMPLETED' && (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => openEditModal(item)}
                                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title={t('issues.modify_appt')}
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteRepair(item.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                title={t('issues.delete_issue')}
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* REPAIR DETAILS MODAL */}
            {detailsModalOpen && selectedRepair && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <CheckCircle className="text-green-500" />
                                    {t('issues.report_title')}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {selectedRepair.address.street} {selectedRepair.address.number}, {selectedRepair.address.city}
                                </p>
                            </div>
                            <button onClick={() => setDetailsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Solution Description */}
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                                <h4 className="font-bold text-green-800 mb-2 border-b border-green-200 pb-1">{t('issues.tech_solution')}</h4>
                                <p className="text-slate-700 whitespace-pre-wrap">{selectedRepair.description}</p>
                            </div>

                            {/* Date Info */}
                            <div className="flex gap-4 text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} /> {t('issues.date')}: {new Date(selectedRepair.createdAt).toLocaleDateString('es-ES')}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock size={16} /> {t('issues.time')} {new Date(selectedRepair.createdAt).toLocaleTimeString()}
                                </div>
                            </div>

                            {/* Photos */}
                            <div>
                                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Image size={18} className="text-blue-500" /> {t('issues.photo_evidence')}
                                </h4>
                                {selectedRepair.photos && selectedRepair.photos.length > 0 ? (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {selectedRepair.photos.map((photo, i) => (
                                            <a
                                                key={i}
                                                href={`http://localhost:3000/${photo}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block aspect-square rounded-lg overflow-hidden border border-slate-200 hover:border-blue-500 transition-colors relative group"
                                            >
                                                <img
                                                    src={`http://localhost:3000/${photo}`}
                                                    alt={`Evidencia ${i + 1}`}
                                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-400 italic text-sm">{t('issues.no_photos')}</p>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 text-right">
                            <button
                                onClick={() => setDetailsModalOpen(false)}
                                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors text-sm font-bold"
                            >
                                {t('issues.close_report')}
                            </button>
                            <button
                                onClick={() => window.print()}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold ml-3"
                            >
                                {t('issues.print_pdf')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CREATE CLAIM MODAL */}
            {claimModalOpen && selectedAddress && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="text-red-500" />
                                {t('issues.create_claim_title')}
                            </h3>
                            <button onClick={() => setClaimModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateClaim}>
                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm mb-4">
                                    <p className="font-bold text-slate-700">{selectedAddress.street} {selectedAddress.number}</p>
                                    <p className="text-slate-500">{selectedAddress.city} - NVT: {selectedAddress.nvt}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.client_name')}</label>
                                    <input
                                        type="text"
                                        name="clientName"
                                        value={claimData.clientName}
                                        onChange={handleClaimDataChange}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder={t('issues.client_name')}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">{t('issues.leave_empty')}</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.assign_team')} *</label>
                                        <select
                                            name="teamId"
                                            value={claimData.teamId}
                                            onChange={handleClaimDataChange}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm"
                                            required
                                        >
                                            <option value="">{t('issues.select')}</option>
                                            {teams.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.appointment_date')} *</label>
                                        <div className="flex gap-1.5">
                                            <input
                                                type="date"
                                                name="date"
                                                value={claimData.date}
                                                onChange={handleClaimDataChange}
                                                className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm min-w-0"
                                                required
                                            />
                                            <button
                                                type="button"
                                                onClick={openCalendar}
                                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-3 rounded-lg border border-blue-200 transition-colors flex-shrink-0"
                                                title="Ver disponibilidad"
                                            >
                                                <Calendar size={18} />
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Hora de la cita *</label>
                                        <input
                                            type="time"
                                            name="time"
                                            value={claimData.time}
                                            onChange={handleClaimDataChange}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.reason_desc')}</label>
                                    <textarea
                                        name="description"
                                        value={claimData.description}
                                        onChange={handleClaimDataChange}
                                        rows="3"
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder={t('issues.reason_placeholder')}
                                        required
                                    ></textarea>
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setClaimModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors bg-white border border-slate-200 shadow-sm"
                                >
                                    {t('issues.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 font-medium"
                                >
                                    {loading ? t('issues.processing') : t('issues.create_claim_btn')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Calendar Availability Modal */}
            {isCalendarOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[80vh] shadow-2xl flex flex-col">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{t('issues.calendar_title')}</h3>
                                <p className="text-sm text-slate-500">{t('issues.calendar_desc')}</p>
                            </div>
                            <button onClick={() => setIsCalendarOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden p-4 bg-slate-50">
                            <div className="mb-4 bg-blue-50 p-3 rounded-lg text-blue-700 text-sm flex items-center gap-2">
                                <CheckCircle size={16} />
                                {t('issues.calendar_hint')}
                            </div>
                            <CalendarView
                                appointments={scheduledAppointments}
                                onSlotClick={handleDateSelect}
                            />
                        </div>
                    </div>
                </div>
            )}
            {/* EDIT REPAIR MODAL */}
            {editModalOpen && editingRepair && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Edit className="text-blue-500" />
                                {t('issues.edit_issue_title')}
                            </h3>
                            <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm hover:shadow transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateRepair} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.appointment_date')} *</label>
                                    <input
                                        type="date"
                                        value={editingRepair.date || ''}
                                        onChange={(e) => setEditingRepair({ ...editingRepair, date: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora de la cita *</label>
                                    <input
                                        type="time"
                                        value={editingRepair.time || '09:00'}
                                        onChange={(e) => setEditingRepair({ ...editingRepair, time: e.target.value })}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.assign_team')} *</label>
                                <select
                                    value={editingRepair.teamId || ''}
                                    onChange={(e) => setEditingRepair({ ...editingRepair, teamId: e.target.value })}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue text-sm"
                                    required
                                >
                                    <option value="">{t('issues.unassigned')}</option>
                                    {teams.map(team => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('issues.notes_reason')}</label>
                                <textarea
                                    value={editingRepair.description || ''}
                                    onChange={(e) => setEditingRepair({ ...editingRepair, description: e.target.value })}
                                    rows="3"
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                    placeholder={t('issues.notes_placeholder')}
                                    required
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEditModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                                >
                                    {t('issues.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30 font-bold"
                                >
                                    {t('issues.save_changes')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IssuesPage;
