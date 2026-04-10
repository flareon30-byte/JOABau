const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, 'logo.png');

/**
 * Procesa y comprime una lista de archivos de imagen usando Sharp.
 * Sobreescribe los archivos originales con versiones optimizadas y marca de agua.
 */
const processImages = async (files) => {
    if (!files || files.length === 0) return;

    const filesArray = Array.isArray(files) ? files : Object.values(files).flat();
    console.log(`[ImageProcessor] Iniciando compresión y branding de ${filesArray.length} fotos...`);

    // Pre-load and resize logo for footer placement
    let logoBuffer = null;
    if (fs.existsSync(LOGO_PATH)) {
        try {
            logoBuffer = await sharp(LOGO_PATH)
                .resize({ height: 60, fit: 'inside' })
                .toBuffer();
        } catch (e) {
            console.error("[ImageProcessor] Error loading logo:", e);
        }
    }

    const today = new Date().toLocaleDateString('de-DE');

    // Use sequential processing instead of Promise.all to save RAM on small droplets
    for (const file of filesArray) {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();

        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

        try {
            // 1. Get metadata of original image
            const metadata = await sharp(filePath).metadata();
            const width = metadata.width || 1200;
            
            // 2. Create the Footer Bar (White background)
            const footerHeight = 100;
            const footerSvg = `
                <svg width="${width}" height="${footerHeight}">
                    <rect width="100%" height="100%" fill="white" />
                    <text x="${width - 20}" y="60" font-family="Arial, sans-serif" font-weight="bold" font-size="24" fill="#0f172a" text-anchor="end">
                        JOA TECHNOLOGIEN - ${today}
                    </text>
                </svg>
            `;
            const footerBuffer = Buffer.from(footerSvg);

            // 3. Process image: compress + add footer (Skip footer for signatures)
            const isSignature = file.fieldname === 'signature' || file.fieldname === 'techSignature' || file.fieldname === 'clientSignature';
            
            let builder = sharp(filePath)
                .rotate()
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true });

            if (!isSignature) {
                // Add Footer and Logo
                const compositeLayers = [
                    { input: footerBuffer, gravity: 'south' }
                ];

                if (logoBuffer) {
                    compositeLayers.push({ input: logoBuffer, gravity: 'southwest', left: 20, top: undefined });
                }

                builder = builder
                    .composite(compositeLayers)
                    .extend({
                        bottom: footerHeight,
                        background: { r: 255, g: 255, b: 255, alpha: 1 }
                    });
            }

            const buffer = await builder
                .jpeg({ quality: 80, progressive: true })
                .toBuffer();

            fs.writeFileSync(filePath, buffer);
            console.log(`[ImageProcessor] Sello aplicado y comprimido: ${file.originalname}`);
        } catch (err) {
            console.error(`[ImageProcessor] Error procesando ${file.originalname}:`, err);
        }
    }
    console.log('[ImageProcessor] Procesamiento completado en serie (Ahorro de RAM).');
    console.log('[ImageProcessor] Finalizado con éxito.');
};

module.exports = { processImages };
