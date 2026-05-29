import React, { useState, useEffect } from 'react';
import { Truck, Fuel, Gauge, Camera, Save, CheckCircle, AlertTriangle, Loader, TrendingUp, Search, Image as ImageIcon, Trash2, Calendar, ScanLine } from 'lucide-react';
import api from '../api/axios';
import { useTranslation } from 'react-i18next';
import Tesseract from 'tesseract.js';

const VehicleLogForm = () => {
    const { t } = useTranslation();
    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [lastLog, setLastLog] = useState(null);

    const [type, setType] = useState('FUEL'); // FUEL, ODOMETER
    const [kms, setKms] = useState('');
    const [amount, setAmount] = useState('');
    const [photos, setPhotos] = useState([]);
    const [liters, setLiters] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchMyVehicle = async () => {
        try {
            // Get user's team and vehicle
            const { data: userData } = await api.get('/api/auth/me');
            if (userData.vehicle) {
                const { data: vehicleData } = await api.get(`/api/vehicles/${userData.vehicle.id}/stats`);
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
                reject(new Error(t('vehicles.alert_error_image')));
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

            if (type === 'FUEL' && processed.length > 0) {
                setIsOcrLoading(true);
                try {
                    const result = await Tesseract.recognize(processed[0], 'spa', {
                        logger: m => console.log(m)
                    });
                    const text = result.data.text;
                    console.log("OCR Extracted Text:", text);

                    // Busca patrones como TOTAL, IMPORTE, SUMA, EUR, € seguido de número
                    const regex = /(?:TOTAL|IMPORTE|SUMA|PAGADO|TARJETA|EFECTIVO|EUR|€)[\s:.-]*([0-9]+[.,][0-9]{2})/gi;
                    let match;
                    let bestAmount = null;
                    while ((match = regex.exec(text)) !== null) {
                        let val = parseFloat(match[1].replace(',', '.'));
                        if (val > (bestAmount || 0)) bestAmount = val;
                    }

                    if (!bestAmount) {
                        // Si no encuentra clave, busca el número más grande con 2 decimales (razonable para gasolina)
                        const fallbackRegex = /([0-9]+[.,][0-9]{2})/g;
                        let largest = 0;
                        while ((match = fallbackRegex.exec(text)) !== null) {
                            let val = parseFloat(match[1].replace(',', '.'));
                            if (val > largest && val < 400) largest = val; 
                        }
                        if (largest > 0) bestAmount = largest;
                    }

                    // Buscar fechas en formato DD/MM/YYYY, DD-MM-YYYY, etc.
                    const dateRegex = /\b([0-3]?[0-9])[\/\-.]([0-1]?[0-9])[\/\-.](20[0-9]{2})\b/g;
                    let dateMatch;
                    let bestDate = null;
                    while ((dateMatch = dateRegex.exec(text)) !== null) {
                        const day = dateMatch[1].padStart(2, '0');
                        const month = dateMatch[2].padStart(2, '0');
                        const year = dateMatch[3];
                        bestDate = `${year}-${month}-${day}`;
                    }

                    if (bestDate) {
                        setDate(bestDate);
                    }

                    let alertMsg = "OCR: ";
                    if (bestAmount) {
                        setAmount(bestAmount.toString());
                        alertMsg += `Se ha detectado un importe de ${bestAmount} €.`;
                    } else {
                        alertMsg += `No se pudo detectar el importe automáticamente.`;
                    }

                    if (bestDate) {
                        alertMsg += `\nTambién se detectó la fecha: ${bestDate}.`;
                    }

                    alertMsg += "\nPor favor, verifica que los datos sean correctos.";
                    alert(alertMsg);
                } catch (ocrErr) {
                    console.error("OCR Error:", ocrErr);
                    alert("Error al procesar el ticket. Introdúcelo manualmente.");
                } finally {
                    setIsOcrLoading(false);
                }
            }
        } catch (err) {
            console.error("Photo Error:", err);
            alert(t('vehicles.alert_photo_process_failed'));
        } finally {
            setSubmitting(false);
        }
    };


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!kms && type === 'ODOMETER') return alert(t('vehicles.alert_enter_kms'));
        if (!amount && type === 'FUEL') return alert(t('vehicles.alert_enter_amount'));

        setSubmitting(true);
        try {
            await api.post('/api/vehicles/log', {
                vehicleId: vehicle.id,
                type,
                kms: kms ? parseFloat(kms) : (lastLog?.kms || vehicle.currentKms),
                amount: amount ? parseFloat(amount) : null,
                liters: liters ? parseFloat(liters) : null,
                photos,
                date: new Date(date).toISOString()
            });
            alert(t('vehicles.alert_save_success'));
            setKms('');
            setAmount('');
            setLiters('');
            setPhotos([]);
            fetchMyVehicle();
        } catch (error) {
            alert(t('vehicles.alert_save_failed'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500 font-bold animate-pulse">{t('vehicles.loading_fleet')}</div>;

    if (!vehicle) return (
        <div className="p-8 text-center space-y-4">
            <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 inline-block">
                <Truck size={48} className="text-orange-400 mx-auto mb-2" />
                <h2 className="text-xl font-bold text-orange-700">{t('vehicles.no_vehicle_assigned')}</h2>
                <p className="text-orange-600 text-sm">{t('vehicles.no_vehicle_assigned_desc')}</p>
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
                    <Fuel size={20} /> {t('vehicles.refueling_tab')}
                </button>
                <button 
                    onClick={() => setType('ODOMETER')}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${type === 'ODOMETER' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                >
                    <Gauge size={20} /> {t('vehicles.mileage_tab')}
                </button>
            </div>

            {/* Fecha del Reporte */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <label className="block text-sm font-bold text-slate-500 mb-2 uppercase">{t('vehicles.report_date')}</label>
                <div className="relative">
                    <input 
                        type="date" 
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full text-xl font-bold text-slate-800 outline-none p-2 border-b-2 border-slate-100 focus:border-blue-500 transition-all bg-transparent"
                    />
                    <Calendar className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={20} />
                </div>
                <p className="text-[10px] text-slate-400 font-bold mt-2 italic uppercase">{t('vehicles.report_date_hint')}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Upload Section */}
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    {photos.length > 0 ? (
                        <div className="relative group">
                            <img src={photos[0]} alt="Log" className="w-full h-56 object-contain rounded-2xl bg-slate-900 border border-slate-700 shadow-xl" />
                            <button 
                                type="button"
                                onClick={() => setPhotos([])}
                                className="absolute top-3 right-3 bg-red-600 text-white p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 size={18} />
                            </button>
                            <p className="text-center text-[10px] font-black text-slate-400 mt-2 uppercase">{t('vehicles.preview_report')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {/* Camera Option */}
                            <label className="border-2 border-dashed border-blue-400 bg-blue-50/50 rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-100 transition-all group scale-100 active:scale-95">
                                <Camera size={36} className="text-blue-600 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="text-[10px] font-black text-blue-700 uppercase text-center leading-tight">
                                    {t('vehicles.take_photo').split(' ')[0]}
                                    <br />
                                    {t('vehicles.take_photo').split(' ')[1] || ''}
                                </div>
                                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                            </label>

                            {/* Gallery Option */}
                            <label className="border-2 border-dashed border-slate-200 bg-white rounded-3xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all group scale-100 active:scale-95">
                                <ImageIcon size={36} className="text-slate-400 mb-3 group-hover:scale-110 transition-transform" />
                                <div className="text-[10px] font-black text-slate-500 uppercase text-center leading-tight">
                                    {t('vehicles.open_gallery').split(' ')[0]}
                                    <br />
                                    {t('vehicles.open_gallery').split(' ')[1] || ''}
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                    )}

                </div>

                {/* Data Input Section */}
                <div className="space-y-4">
                    {type === 'FUEL' && (
                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                            <div>
                                <label className="flex items-center gap-2 text-sm font-bold text-slate-500 mb-2 uppercase">
                                    {t('vehicles.total_amount')}
                                    {isOcrLoading && <span className="text-xs text-blue-500 flex items-center gap-1 animate-pulse normal-case"><ScanLine size={14}/> Analizando ticket...</span>}
                                </label>
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
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2 uppercase">{t('vehicles.liters_optional')}</label>
                                <div className="relative">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={liters}
                                        onChange={(e) => setLiters(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full text-2xl font-bold text-slate-800 outline-none p-2 border-b-2 border-slate-100 focus:border-blue-500 transition-all"
                                    />
                                    <Truck className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-bold text-slate-500 uppercase">{t('vehicles.mileage_reading')}</label>
                            <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-lg text-slate-500 font-bold">{t('vehicles.last_mileage', { kms: vehicle.currentKms })}</span>
                        </div>
                        <div className="relative">
                            <input 
                                type="number" 
                                required
                                value={kms}
                                onChange={(e) => setKms(e.target.value)}
                                placeholder={t('vehicles.placeholder_kms')}
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
                    {submitting ? t('vehicles.saving_log') : (type === 'FUEL' ? t('vehicles.register_refueling') : t('vehicles.save_mileage'))}
                </button>
            </form>

            <div className="p-4 text-center">
                <p className="text-slate-400 text-xs font-medium">{t('vehicles.device_info_hint')}</p>
            </div>
        </div>
    );
};

export default VehicleLogForm;
