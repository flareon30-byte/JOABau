import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

const addressCache = {};

export default function ReverseGeocodeLabel({ lat, lng }) {
    const [address, setAddress] = useState('Buscando calle...');

    useEffect(() => {
        if (!lat || !lng) {
            setAddress('Coordenadas no válidas');
            return;
        }

        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (addressCache[cacheKey]) {
            setAddress(addressCache[cacheKey]);
            return;
        }

        const fetchAddress = async () => {
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
                const data = await res.json();
                if (data && data.address) {
                    const street = data.address.road || data.address.pedestrian || data.address.path || data.address.suburb || 'Calle desconocida';
                    const city = data.address.city || data.address.town || data.address.village || '';
                    const label = `${street}${city ? `, ${city}` : ''}`;
                    addressCache[cacheKey] = label;
                    setAddress(label);
                } else {
                    setAddress('Dirección no encontrada');
                }
            } catch (error) {
                setAddress('Error al buscar dirección');
            }
        };

        fetchAddress();
    }, [lat, lng]);

    return (
        <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
            <MapPin className="w-3 h-3" />
            {address}
        </span>
    );
}
