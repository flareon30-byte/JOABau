const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Procesa y comprime una lista de archivos de imagen usando Sharp.
 * Sobreescribe los archivos originales con versiones optimizadas.
 */
const processImages = async (files, technicianName = 'Técnico JOA') => {
    if (!files || files.length === 0) return;

    const filesArray = Array.isArray(files) ? files : Object.values(files).flat();
    console.log(`[ImageProcessor] Optimizar y comprimir ${filesArray.length} fotos...`);

    for (const file of filesArray) {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();

        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;

        try {
            const fileBuffer = fs.readFileSync(filePath);
            
            let builder = sharp(fileBuffer)
                .rotate()
                .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true });

            const buffer = await builder
                .jpeg({ quality: 85, progressive: true })
                .toBuffer();

            fs.writeFileSync(filePath, buffer);
            console.log(`[ImageProcessor] Foto optimizada correctamente: ${file.originalname}`);
        } catch (err) {
            console.error(`[ImageProcessor] Error procesando ${file.originalname}:`, err);
        }
    }
};

module.exports = { processImages };
