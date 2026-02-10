// ... imports
import { Search, Plus, FileText, Image, History, AlertTriangle, CheckCircle, XCircle, Clock, MapPin, User, Calendar, Network, X } from 'lucide-react';

const IssuesPage = () => {
    // ... existing state
    const [activeTab, setActiveTab] = useState('search');
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
        description: ''
    });

    // New Claim Modal State
    const [claimModalOpen, setClaimModalOpen] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [claimData, setClaimData] = useState({
        clientName: '',
        teamId: '',
        date: new Date().toISOString().split('T')[0], // Default today
        description: ''
    });

    const [teams, setTeams] = useState([]);

    // ... existing useEffect and handlers ...
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
                setError("La calle es obligatoria");
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
                setError("Error al buscar la dirección. Intente nuevamente.");
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
            await api.post('/api/issues/create', manualIssue);
            setSuccessMessage("Avería registrada exitosamente. Se ha creado una cita de reparación.");
            setManualIssue({ ...manualIssue, city: '', street: '', number: '', clientName: '', description: '' });
            setActiveTab('search');
        } catch (err) {
            console.error(err);
            setError("Error al crear la avería. Verifique los datos");
        } finally {
            setLoading(false);
        }
    };

    const prefillManualFromSearch = () => {
        setManualIssue({
            ...manualIssue,
            city: searchParams.city,
            street: searchParams.street,
            number: searchParams.number
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
            description: ''
        });
        setClaimModalOpen(true);
    };

    const handleClaimDataChange = (e) => {
        setClaimData({ ...claimData, [e.target.name]: e.target.value });
    };

    const handleCreateClaim = async (e) => {
        e.preventDefault();
        if (!claimData.teamId || !claimData.date) {
            alert("Por favor seleccione fecha y equipo.");
            return;
        }

        setLoading(true);
        try {
            await api.post('/api/issues/create-existing', {
                addressId: selectedAddress.id,
                ...claimData
            });
            setSuccessMessage("Reclamación creada y asignada correctamente.");
            setClaimModalOpen(false);
            // Refresh search results to show new appointment?
            // Simplified: just trigger search again if simple enough, or hack state
            handleSearch(e); // Re-run search to update view
        } catch (err) {
            console.error(err);
            alert("Error al crear reclamación: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    const StatusBadge = ({ status }) => {
        if (!status) return <span className="text-gray-400">-</span>;
        if (status === 'OK' || status === 'COMPLETED' || status === 'Active') return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><CheckCircle size={12} /> {status}</span>;
        if (status === 'Pending' || status === 'PENDING') return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><Clock size={12} /> {status}</span>;
        return <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"><XCircle size={12} /> {status}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="text-joa-blue" />
                        Gestión de Averías e Incidencias
                    </h1>
                    <p className="text-slate-500">Busca el historial de una dirección o registra nuevas incidencias externas.</p>
                </div>

                <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'search' ? 'bg-joa-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Search size={16} /> Buscar Dirección
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-joa-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Plus size={16} /> Nueva Avería Manual
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
                    {/* Search Form */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                            <div className="flex-1 w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={searchParams.city}
                                    onChange={handleSearchChange}
                                    placeholder="Ej. Berlin"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue focus:border-transparent"
                                />
                            </div>
                            <div className="flex-[2] w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Calle (Obligatorio)</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={searchParams.street}
                                    onChange={handleSearchChange}
                                    placeholder="Ej. Hauptstrasse"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue focus:border-transparent"
                                    required
                                />
                            </div>
                            <div className="w-full md:w-32">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                                <input
                                    type="text"
                                    name="number"
                                    value={searchParams.number}
                                    onChange={handleSearchChange}
                                    placeholder="123"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue focus:border-transparent"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-joa-blue hover:bg-blue-600 text-white p-2.5 rounded-lg transition-colors flex items-center gap-2 h-[46px] px-6"
                            >
                                {loading ? 'Buscando...' : <><Search size={18} /> Buscar</>}
                            </button>
                        </form>
                    </div>

                    {/* Results */}
                    {hasSearched && (!searchResult || searchResult.length === 0) && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                <Search size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Dirección no encontrada</h3>
                            <p className="text-slate-500 max-w-md mx-auto">
                                No tenemos registros de esta dirección en nuestra base de datos.
                                ¿Deseas registrar una incidencia para esta dirección externa?
                            </p>
                            <button
                                onClick={prefillManualFromSearch}
                                className="bg-joa-blue text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                            >
                                <Plus size={18} /> Crear Avería para esta Dirección
                            </button>
                        </div>
                    )}

                    {searchResult && searchResult.length > 0 && (
                        <div className="space-y-6 animate-in fade-in zoom-in-95">
                            {searchResult.map((result) => (
                                <div key={result.id} className="space-y-6 border-b border-slate-200 pb-8 last:border-0 last:pb-0">
                                    {/* Address Header */}
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                    {result.project?.name || 'Proyecto Desconocido'}
                                                </span>
                                                <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded">
                                                    NVT: {result.nvt || 'N/A'}
                                                </span>
                                            </div>
                                            <h2 className="text-2xl font-bold text-slate-800 flex items-baseline gap-2">
                                                {result.street} {result.number}
                                                <span className="text-lg font-normal text-slate-500">{result.city}</span>
                                            </h2>
                                        </div>
                                        {/* Create Claim Button */}
                                        <button
                                            onClick={() => openClaimModal(result)}
                                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-medium border border-red-100"
                                        >
                                            <AlertTriangle size={16} />
                                            Crear Reclamación
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Soplado Info */}
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                                                <Network className="text-purple-500" size={20} /> Estado de Soplado
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="flex justify-between">
                                                    <span className="text-slate-500 text-sm">Estado:</span>
                                                    <StatusBadge status={result.sopladoStatus || 'Pendiente'} />
                                                </div>
                                                {result.sopladoInfo ? (
                                                    <div className="bg-slate-50 p-3 rounded-lg text-sm space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Metros:</span>
                                                            <span className="font-medium">{result.sopladoInfo.meters}m</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">TK:</span>
                                                            <span className="font-medium">{result.sopladoInfo.tk}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Color Tubo:</span>
                                                            <span className="font-medium">{result.sopladoInfo.tubeColor}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-500">Fecha:</span>
                                                            <span className="font-medium">
                                                                {result.sopladoInfo.createdAt ? new Date(result.sopladoInfo.createdAt).toLocaleDateString() : '-'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic">Sin información de soplado.</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Appointment Info (Only 1 per address in schema) */}
                                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4 pb-2 border-b border-slate-50">
                                                <History className="text-orange-500" size={20} /> Cita / Protocolo
                                            </h3>
                                            <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                {result.appointment ? (
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-slate-50 rounded-lg text-sm gap-2">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                                {result.appointment.assignedDate ? new Date(result.appointment.assignedDate).getDate() : '?'}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-slate-800">
                                                                    {result.appointment.assignedDate ? new Date(result.appointment.assignedDate).toLocaleDateString() : 'Sin Fecha'}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {result.appointment.timeSlot || 'Todo el día'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="bg-white px-2 py-1 rounded border border-slate-200 text-xs font-mono text-slate-600">
                                                                {result.appointment.assignedTeam?.name || 'Sin Equipo'}
                                                            </span>
                                                            <StatusBadge status={result.appointment.status} />
                                                        </div>
                                                        {result.appointment.scheduledBy && (
                                                            <div className="text-xs text-slate-400 md:text-right">
                                                                Por: {result.appointment.scheduledBy.username}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-slate-400 italic">No hay citas registradas para esta dirección.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'create' && (
                <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Plus className="text-joa-blue" />
                        Registrar Incidencia / Avería Manual
                    </h2>
                    <form onSubmit={handleCreateManual} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Calle</label>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Cliente</label>
                                    <input
                                        type="text"
                                        name="clientName"
                                        value={manualIssue.clientName}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Asignar Equipo</label>
                                    <select
                                        name="teamId"
                                        value={manualIssue.teamId}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                    >
                                        <option value="">-- Sin asignar --</option>
                                        {teams.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Cita</label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={manualIssue.date}
                                        onChange={handleManualChange}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del Problema</label>
                            <textarea
                                name="description"
                                value={manualIssue.description}
                                onChange={handleManualChange}
                                rows="3"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                placeholder="Detalles de la avería..."
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setActiveTab('search')}
                                className="px-6 py-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 rounded-lg bg-joa-blue text-white hover:bg-blue-600 transition-colors shadow-lg shadow-joa-blue/30 font-medium"
                            >
                                {loading ? 'Procesando...' : 'Crear Avería y Cita'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* CREATE CLAIM MODAL */}
            {claimModalOpen && selectedAddress && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="text-red-500" />
                                Crear Reclamación / Avería
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Cliente</label>
                                    <input
                                        type="text"
                                        name="clientName"
                                        value={claimData.clientName}
                                        onChange={handleClaimDataChange}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder="Nombre del cliente"
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Si dejas este campo vacío, se mantendrá el actual.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Asignar Equipo *</label>
                                        <select
                                            name="teamId"
                                            value={claimData.teamId}
                                            onChange={handleClaimDataChange}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                            required
                                        >
                                            <option value="">-- Seleccionar --</option>
                                            {teams.map(team => (
                                                <option key={team.id} value={team.id}>{team.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha Cita *</label>
                                        <input
                                            type="date"
                                            name="date"
                                            value={claimData.date}
                                            onChange={handleClaimDataChange}
                                            className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / Descripción *</label>
                                    <textarea
                                        name="description"
                                        value={claimData.description}
                                        onChange={handleClaimDataChange}
                                        rows="3"
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-joa-blue"
                                        placeholder="Explica el problema o avería..."
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
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/30 font-medium"
                                >
                                    {loading ? 'Creando...' : 'Crear Reclamación'}
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
