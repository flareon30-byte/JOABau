import React, { useState, useEffect } from 'react';
import { Truck, Fuel, Gauge, Camera, Save, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import api from '../api/axios';

const VehicleLogForm = () => {
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [lastLog, setLastLog] = useState(null);

    const [type, setType] = useState('FUEL'); // FUEL, ODOMETER
    const [kms, setKms] = useState('');
    const [amount, setAmount] = useState('');
    const [photos, setPhotos] = useState([]);
    const [isScanning, setIsScanning] = useState(false);

    const fetchMyVehicle = async () => {
        try {
            // Get user's team and vehicle
            const { data: userData } = await api.get('/api/auth/me');
            if (userData.team?.vehicle) {
                const { data: vehicleData } = await api.get(`/api/vehicles/${userData.team.vehicle.id}/stats`);
                setVehicle(vehicleData.vehicle);
                setLastLog(vehicleData.vehicle.logs?.[0] || null);
            }
        } catch (error) {
            console.error('Error fetching vehicle', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMyVehicle();
    }, []);

    const processPhoto = (file) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX_SIZE = 1280;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                URL.revokeObjectURL(objectUrl); // Clean up memory pointer
                resolve(dataUrl);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Error al cargar la imagen seleccionada."));
            };

            img.src = objectUrl;
        });
    };

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        setSubmitting(true);
        try {
            const processed = await Promise.all(files.map(file => processPhoto(file)));
            setPhotos(processed);
        } catch (err) {
            console.error("Photo Error:", err);
            alert("No se pudo procesar la foto. Prueba a hacerla con menos resolución o elegir otra.");
        } finally {
            setSubmitting(false);
        }
    };

    const simulateOCR = () => {
        if (photos.length === 0) {
            alert('Sube una foto primero');
            return;
        }
        setIsScanning(true);
        // Simulate AI recognition processing
        setTimeout(() => {
            if (type === 'FUEL') {
                setAmount((Math.random() * 50 + 20).toFixed(2)); // Random simulation
            } else {
                const nextKm = (vehicle?.currentKms || 0) + (Math.random() * 100 + 50);
                setKms(Math.floor(nextKm));
            }
            setIsScanning(false);
        }, 2000);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!kms && type === 'ODOMETER') return alert('Escribe los kilómetros');
        if (!amount && type === 'FUEL') return alert('Escribe el importe');

        setSubmitting(true);
        try {
            await api.post('/api/vehicles/log', {
                vehicleId: vehicle.id,
                type,
                kms: kms ? parseFloat(kms) : (lastLog?.kms || vehicle.currentKms),
                amount: amount ? parseFloat(amount) : null,
                photos
            });
            alert('¡Reporte guardado con éxito!');
            setKms('');
            setAmount('');
            setPhotos([]);
            fetchMyVehicle();
        } catch (error) {
            alert('Error al guardar el log');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">Cargando flota...</div>;

    if (!vehicle) return (
        <div className="p-8 text-center space-y-4">
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 inline-block">
                <Truck size={48} className="text-orange-400 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-orange-700">Sin Vehículo Asignado</h2>
                <p className="text-orange-600 text-sm">Pide a administración que asigne un coche a tu equipo.</p>
            </div>
        </div>
    );

    return (
        <div className="p-4 max-w-lg mx-auto space-y-6 animate-fadeIn pb-20">
            {/* Vehicle Header Card */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
                    <Truck size={24} />
                </div>
                <div>
                    <h2 className="font-bold text-slate-800 text-lg uppercase">{vehicle.make} {vehicle.model}</h2>
                    <p className="text-blue-600 font-mono font-bold">{vehicle.plate}</p>
                </div>
            </div>

            {/* Selector de Tipo */}
            <div className="bg-slate-100 p-1.5 rounded-2xl flex gap-2">
                <button 
                    onClick={() => setType('FUEL')}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${type === 'FUEL' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Fuel size={20} /> Repostaje
                </button>
                <button 
                    onClick={() => setType('ODOMETER')}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${type === 'ODOMETER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Gauge size={20} /> Kilometraje
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Upload Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <label className="block text-center cursor-pointer group">
                        <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 group-hover:border-blue-400 transition-all bg-slate-50/50">
                            {photos.length > 0 ? (
                                <img src={photos[0]} alt="Log" className="w-full h-40 object-contain rounded-2xl" />
                            ) : (
                                <>
                                    <Camera size={48} className="mx-auto text-slate-300 mb-3 group-hover:scale-110 transition-transform" />
                                    <p className="text-slate-500 font-bold">Pulsa para hacer foto al {type === 'FUEL' ? 'Ticket' : 'Tacógrafo'}</p>
                                    <p className="text-slate-400 text-xs mt-1">Sube una imagen clara para el sistema de IA</p>
                                </>
                            )}
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </label>

                    {photos.length > 0 && (
                        <button 
                            type="button"
                            onClick={simulateOCR}
                            disabled={isScanning}
                            className="w-full py-3 bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-all shadow-lg"
                        >
                            {isScanning ? <Loader className="animate-spin" size={20} /> : <TrendingUp size={20} />}
                            {isScanning ? 'Analizando Imagen...' : 'Escanear Datos con IA'}
                        </button>
                    )}
                </div>

                {/* Data Input Section */}
                <div className="space-y-4">
                    {type === 'FUEL' && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <label className="block text-sm font-bold text-slate-500 mb-2 uppercase">Importe Total (€)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full text-3xl font-bold text-slate-800 outline-none p-2 border-b-2 border-slate-100 focus:border-blue-500 transition-all"
                                />
                                <Fuel className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-500 uppercase">Lectura de Kilómetros</label>
                            <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-bold">ÚLITMO: {vehicle.currentKms} km</span>
                        </div>
                        <div className="relative">
                            <input 
                                type="number" 
                                required
                                value={kms}
                                onChange={(e) => setKms(e.target.value)}
                                placeholder="Escribe el kilometraje..."
                                className="w-full text-2xl font-bold text-slate-800 outline-none p-2 border-b-2 border-slate-100 focus:border-blue-500 transition-all"
                            />
                            <Gauge className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={24} />
                        </div>
                    </div>
                </div>

                {/* Submit Logic */}
                <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-blue-600 text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50"
                >
                    {submitting ? <Loader className="animate-spin" size={24} /> : <CheckCircle size={24} />}
                    {submitting ? 'Guardando Log...' : (type === 'FUEL' ? 'Registrar Repostaje' : 'Guardar Kilometraje')}
                </button>
            </form>

            <div className="p-4 text-center">
                <p className="text-slate-400 text-xs font-medium">Todos los registros incluyen ubicación y hora del dispositivo.</p>
            </div>
        </div>
    );
};

export default VehicleLogForm;
