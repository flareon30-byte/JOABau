import { useState, useEffect } from 'react';
import api from '../api/axios';

const useBranding = () => {
    const [branding, setBranding] = useState({
        name: 'JOA Bau',
        logoUrl: '/logo.png'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const res = await api.get('/api/company/public');
                if (res.data) {
                    const cleanPath = res.data.logoPath || '/logo.png';
                    
                    // Asegurar que no terminemos con // si el baseURL ya tiene una barra o es '/'
                    let baseUrl = api.defaults.baseURL || '';
                    if (baseUrl === '/') baseUrl = '';
                    if (baseUrl.endsWith('/') && cleanPath.startsWith('/')) {
                        baseUrl = baseUrl.slice(0, -1);
                    }
                    
                    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${baseUrl}${cleanPath}`;
                    
                    setBranding({
                        name: res.data.name || 'JOA Bau',
                        logoUrl: `${fullUrl}${fullUrl.includes('?') ? '&' : '?'}v=${Date.now()}`
                    });
                }
            } catch (error) {
                console.error('Error fetching branding:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBranding();
    }, []);

    return { branding, loading };
};

export default useBranding;
