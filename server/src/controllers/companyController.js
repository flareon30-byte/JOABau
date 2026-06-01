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

exports.getPublicSettings = async (req, res) => {
    try {
        const settings = await prisma.companySettings.findFirst({
            select: {
                name: true,
                logoPath: true
            }
        });
        res.json(settings || { name: 'JOA Bau', logoPath: '/logo.png' });
    } catch (error) {
        res.status(500).json({ message: 'Error cargando branding' });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        let { logoPath, ...otherData } = req.body;
        let finalLogoPath = logoPath;

        // Si es un base64 (una subida nueva), lo guardamos como archivo físico
        if (logoPath && logoPath.startsWith('data:image')) {
            try {
                const base64Data = logoPath.split(';base64,').pop();
                const uploadsDir = path.join(__dirname, '../../uploads');
                if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
                
                const filename = 'logo_empresa.png';
                const filePath = path.join(uploadsDir, filename);
                console.log(`[LogoUpload] Saving logo to: ${filePath}`);
                fs.writeFileSync(filePath, base64Data, 'base64');
                finalLogoPath = `/uploads/${filename}`; 
                console.log(`[LogoUpload] Logo saved successfully. Path stored: ${finalLogoPath}`);
            } catch (fsError) {
                console.error('[LogoUpload] Error guardando archivo físico de logo:', fsError);
            }
        } else if (logoPath && (logoPath.startsWith('http') || logoPath.includes('/uploads/'))) {
            // Si ya es una URL o ruta existente, nos aseguramos de guardar solo la parte relativa
            // Esto evita que se guarden URLs absolutas con localhost si cambias de entorno
            if (logoPath.includes('/uploads/')) {
                const parts = logoPath.split('/uploads/');
                finalLogoPath = '/uploads/' + parts[1].split('?')[0]; // Quitamos el query string tmb
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
