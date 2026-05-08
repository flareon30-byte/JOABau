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
            
            // 2. Crear el SVG para el nombre del técnico (Estilo más elegante)
            const textSvg = `
                <svg width="500" height="120">
                    <style>
                        .name { fill: white; font-size: 24px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; letter-spacing: 1px; }
                        .date { fill: rgba(255,255,255,0.8); font-size: 16px; font-family: Arial, sans-serif; font-weight: 600; }
                        .shadow { filter: drop-shadow(3px 3px 3px rgba(0,0,0,0.9)); }
                    </style>
                    <g class="shadow">
                        <text x="490" y="35" class="name" text-anchor="end">${technicianName.toUpperCase()}</text>
                        <text x="490" y="65" class="date" text-anchor="end">${today}</text>
                    </g>
                </svg>
            `;
            const textBuffer = Buffer.from(textSvg);

            const isSignature = file.fieldname && (file.fieldname.includes('signature') || file.fieldname.includes('Signature'));
            
            let builder = sharp(filePath)
                .rotate()
                .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });

            if (!isSignature) {
                const compositeLayers = [];

                // Logo en la esquina superior derecha (Northeast)
                if (logoBuffer) {
                    compositeLayers.push({ 
                        input: logoBuffer, 
                        gravity: 'northeast',
                        top: 25,
                        left: undefined, // Usar gravity
                        right: 25 // Sharp usa offsets relativos a la gravedad si se pasan top/left
                    });
                }

                // Nombre y fecha ajustados a la derecha
                compositeLayers.push({ 
                    input: textBuffer, 
                    gravity: 'northeast',
                    top: 100,
                    right: 25
                });

                builder = builder.composite(compositeLayers);
            }

            const buffer = await builder
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();

            fs.writeFileSync(filePath, buffer);
            console.log(`[ImageProcessor] Branding aplicado (Superior Der): ${file.originalname}`);
        } catch (err) {
            console.error(`[ImageProcessor] Error procesando ${file.originalname}:`, err);
        }
    }
};

module.exports = { processImages };
