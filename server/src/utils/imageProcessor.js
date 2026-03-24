const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Procesa y comprime una lista de archivos de imagen usando Sharp.
 * Sobreescribe los archivos originales con versiones optimizadas.
 * @param {Array} files - Archivos recibidos por Multer (req.files)
 */
const processImages = async (files) => {
    if (!files || files.length === 0) return;

    // Convertir a array si es un objeto de Multer (photos:[...])
    const filesArray = Array.isArray(files) 
        ? files 
        : Object.values(files).flat();

    console.log(`[ImageProcessor] Iniciando compresión de ${filesArray.length} fotos...`);

    const promises = filesArray.map(async (file) => {
        const filePath = file.path;
        const ext = path.extname(filePath).toLowerCase();

        // Solo procesar formatos comunes
        if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            console.log(`[ImageProcessor] Saltando archivo no imagen: ${file.originalname}`);
            return;
        }

        try {
            // Procesar con Sharp
            const buffer = await sharp(filePath)
                .rotate() // Respeta la orientación del EXIF (muy importante en móviles)
                .resize(1200, 1200, {
                    fit: 'inside',
                    withoutEnlargement: true // No ampliar si es pequeña
                })
                .jpeg({ quality: 80, progressive: true }) // Calidad 80% y carga progresiva
                .toBuffer();

            // Sobreescribir el archivo original con la versión comprimida
            fs.writeFileSync(filePath, buffer);
            
            const stats = fs.statSync(filePath);
            console.log(`[ImageProcessor] Éxito: ${file.originalname} -> ${Math.round(stats.size / 1024)} KB`);
        } catch (err) {
            console.error(`[ImageProcessor] Error procesando ${file.originalname}:`, err);
        }
    });

    await Promise.all(promises);
    console.log('[ImageProcessor] Finalizado.');
};

module.exports = { processImages };
