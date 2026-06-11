const prisma = require('../prisma');

exports.getSettings = async (req, res) => {
    try {
        const isDemo = req.isDemo || false;
        let settings = await prisma.systemSettings.findFirst({ where: { isDemo } });
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
                    isDemo,
                    extraPointPrice: 0,
                    saturdayPointPrice: 0,
                    monthlyTargetPoints: 100,
                    bpPoints: 10,
                    bp2FamPoints: 15,
                    brMultiPoints: 20,
                    sduPoints: 25,
                    mduPoints: 30,
                    spPoints: 5
                }
            });
        }
        res.json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

exports.updateSettings = async (req, res) => {
    console.log('Update Settings Body:', req.body);
    const {
        extraPointPrice,
        saturdayPointPrice,
        monthlyTargetPoints,
        bpPoints,
        bp2FamPoints,
        brMultiPoints,
        sduPoints,
        mduPoints,
        spPoints,
        taPoints,
        repairPrice, // Added repairPrice
        financials
    } = req.body;

    try {
        const isDemo = req.isDemo || false;
        let settings = await prisma.systemSettings.findFirst({ where: { isDemo } });

        // Helper to safely parse float
        const safeFloat = (val) => {
            if (typeof val === 'string') {
                val = val.replace(',', '.');
            }
            return parseFloat(val) || 0;
        };

        const data = {
            extraPointPrice: safeFloat(extraPointPrice),
            saturdayPointPrice: safeFloat(saturdayPointPrice),
            monthlyTargetPoints: parseInt(monthlyTargetPoints) || 0,
            bpPoints: safeFloat(bpPoints),
            bp2FamPoints: safeFloat(bp2FamPoints),
            brMultiPoints: safeFloat(brMultiPoints),
            sduPoints: safeFloat(sduPoints),
            mduPoints: safeFloat(mduPoints),
            spPoints: safeFloat(spPoints),
            taPoints: safeFloat(taPoints),
            repairPrice: safeFloat(repairPrice), // Save repairPrice
            financials: financials // Save the complex JSON config
        };

        if (!settings) {
            // Create if not exists
            const newSettings = await prisma.systemSettings.create({
                data: { ...data, isDemo }
            });
            return res.json(newSettings);
        }

        const updated = await prisma.systemSettings.update({
            where: { id: settings.id },
            data
        });

        res.json(updated);
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ message: 'Error updating settings', details: error.message });
    }
};

exports.getGeminiKey = async (req, res) => {
    try {
        let hasKey = false;
        let obfuscatedKey = '';
        
        let key = process.env.GEMINI_API_KEY;
        
        const configPath = path.join(__dirname, '../../uploads/gemini_config.json');
        if (!key && fs.existsSync(configPath)) {
            try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.GEMINI_API_KEY) {
                    key = config.GEMINI_API_KEY;
                }
            } catch (err) {
                console.warn('Error reading gemini_config.json:', err.message);
            }
        }
        
        if (key && key.trim().length > 0) {
            hasKey = true;
            const cleanKey = key.trim();
            obfuscatedKey = cleanKey.substring(0, 6) + '...' + cleanKey.substring(cleanKey.length - 4);
        }
        
        res.json({ hasKey, obfuscatedKey });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error checking Gemini Key status' });
    }
};

exports.saveGeminiKey = async (req, res) => {
    const { key } = req.body;
    try {
        if (!key || key.trim().length === 0) {
            return res.status(400).json({ message: 'La clave no puede estar vacía' });
        }
        
        const cleanKey = key.trim();
        const configDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const configPath = path.join(configDir, 'gemini_config.json');
        
        fs.writeFileSync(configPath, JSON.stringify({ GEMINI_API_KEY: cleanKey }, null, 2));
        
        process.env.GEMINI_API_KEY = cleanKey;
        
        res.json({ message: 'Clave de Gemini guardada correctamente y activa de inmediato' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ 
            message: 'Error guardando la clave de Gemini',
            details: error.message || String(error)
        });
    }
};
