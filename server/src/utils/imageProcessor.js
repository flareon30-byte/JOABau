const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

/**
 * Procesa y comprime una lista de archivos de imagen usando Sharp.
 * Sobreescribe los archivos originales con versiones optimizadas y marca de agua.
 */
const processImages = async (files, technicianName = 'Técnico JOA') => {
    if (!files || files.length === 0) return;

    const filesArray = Array.isArray(files) ? files : Object.values(files).flat();
    console.log(`[ImageProcessor] Iniciando branding (Esquina Superior Izquierda) para ${filesArray.length} fotos...`);

    // 1. Obtener el logo de la configuración de la empresa
    let logoBuffer = null;
    try {
        const settings = await prisma.companySettings.findFirst();
        if (settings && settings.logoPath) {
            const absoluteLogoPath = path.isAbsolute(settings.logoPath) 
                ? settings.logoPath 
                : path.join(__dirname, '../../', settings.logoPath);
            
            if (fs.existsSync(absoluteLogoPath)) {
                logoBuffer = await sharp(absoluteLogoPath)
                    .resize({ width: 150, fit: 'inside' }) // Logo más pequeño para la esquina
                    .toBuffer();
            }
        }
    } catch (e) {
        console.error("[ImageProcessor] Error loading company logo:", e);
    }

    // Fallback al logo por defecto si falla el de la BD
    if (!logoBuffer) {
        const DEFAULT_LOGO = path.join(__dirname, 'logo.png');
        if (fs.existsSync(DEFAULT_LOGO)) {
            logoBuffer = await sharp(DEFAULT_LOGO).resize({ width: 150 }).toBuffer();
        }
    }

    const today = new Date().toLocaleDateString('es-ES');

    for (const file of filesArray) {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();

        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

        try {
            const metadata = await sharp(filePath).metadata();
            const width = metadata.width || 1200;
            
            // 2. Crear el SVG para el nombre del técnico (justo debajo del logo)
            // Calculamos una posición aproximada: logo mide 150px de ancho, el texto irá debajo.
            const textSvg = `
                <svg width="400" height="100">
                    <style>
                        .name { fill: white; font-size: 22px; font-family: Arial, sans-serif; font-weight: bold; }
                        .date { fill: rgba(255,255,255,0.7); font-size: 16px; font-family: Arial, sans-serif; }
                        .shadow { filter: drop-shadow(2px 2px 2px rgba(0,0,0,0.8)); }
                    </style>
                    <g class="shadow">
                        <text x="10" y="30" class="name">${technicianName.toUpperCase()}</text>
                        <text x="10" y="55" class="date">${today}</text>
                    </g>
                </svg>
            `;
            const textBuffer = Buffer.from(textSvg);

            const isSignature = file.fieldname && (file.fieldname.includes('signature') || file.fieldname.includes('Signature'));
            
            let builder = sharp(filePath)
                .rotate()
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });

            if (!isSignature) {
                const compositeLayers = [];

                // Logo en la esquina superior izquierda
                if (logoBuffer) {
                    compositeLayers.push({ 
                        input: logoBuffer, 
                        gravity: 'northwest',
                        top: 20,
                        left: 20
                    });
                }

                // Nombre y fecha debajo del logo
                compositeLayers.push({ 
                    input: textBuffer, 
                    gravity: 'northwest',
                    top: 85, // Ajustado para que quede debajo del logo (que mide ~60-70px de alto tras el resize)
                    left: 20
                });

                builder = builder.composite(compositeLayers);
            }

            const buffer = await builder
                .jpeg({ quality: 80, progressive: true })
                .toBuffer();

            fs.writeFileSync(filePath, buffer);
            console.log(`[ImageProcessor] Branding aplicado (Superior Izq): ${file.originalname}`);
        } catch (err) {
            console.error(`[ImageProcessor] Error procesando ${file.originalname}:`, err);
        }
    }
};

module.exports = { processImages };

module.exports = { processImages };
