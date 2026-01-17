const prisma = require('../prisma');

exports.getSettings = async (req, res) => {
    try {
        let settings = await prisma.systemSettings.findFirst();
        if (!settings) {
            settings = await prisma.systemSettings.create({
                data: {
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
        financials
    } = req.body;

    try {
        let settings = await prisma.systemSettings.findFirst();

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
            financials: financials // Save the complex JSON config
        };

        if (!settings) {
            // Create if not exists
            const newSettings = await prisma.systemSettings.create({
                data
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
