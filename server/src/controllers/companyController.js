const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

exports.getSettings = async (req, res) => {
    try {
        const settings = await prisma.companySettings.findFirst();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error cargando datos de empresa' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { logoPath, ...otherData } = req.body;
        let finalLogoPath = logoPath;

        // Si es un base64 (una subida nueva), lo guardamos como archivo físico
        if (logoPath && logoPath.startsWith('data:image')) {
            try {
                const base64Data = logoPath.replace(/^data:image\/\w+;base64,/, "");
                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                
                const filePath = path.join(uploadsDir, 'logo_factura.png');
                fs.writeFileSync(filePath, base64Data, 'base64');
                finalLogoPath = '/uploads/logo_factura.png'; // Ruta web
            } catch (fsError) {
                console.error('Error guardando archivo físico de logo:', fsError);
                // Si falla el disco, guardamos el base64 en la DB como fallback temporal o mantenemos la original
            }
        }

        const settings = await prisma.companySettings.findFirst();
        const updated = await prisma.companySettings.upsert({
            where: { id: settings?.id || 'default-joa-cfg' },
            update: { ...otherData, logoPath: finalLogoPath },
            create: { ...otherData, logoPath: finalLogoPath, id: 'default-joa-cfg' }
        });
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error actualizando datos de empresa' });
    }
};
