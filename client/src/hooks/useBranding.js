import { useState, useEffect } from 'react';
import api from '../api/axios';

const useBranding = () => {
    const [branding, setBranding] = useState({
        name: 'JOA Technologien',
        logoUrl: '/logo.png'
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBranding = async () => {
            try {
                const res = await api.get('/api/company/public');
                if (res.data) {
                    const cleanPath = res.data.logoPath || '/logo.png';
                    const fullUrl = cleanPath.startsWith('http') ? cleanPath : `${api.defaults.baseURL || ''}${cleanPath}`;
                    setBranding({
                        name: res.data.name || 'JOA Technologien',
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
