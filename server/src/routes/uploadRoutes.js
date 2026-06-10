const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr');
const piexifjs = require('piexifjs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { verifyToken } = require('../middleware/authMiddleware');

// ─── Storage ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = file.originalname.split('.').pop();
        cb(null, file.fieldname + '-' + uniqueSuffix + '.' + ext);
    }
});

const upload = multer({ storage: storage });

// ─── GPS Helpers ───────────────────────────────────────────────────────────────

/**
 * Stage 1: Read GPS from EXIF metadata
 */
async function readGpsFromExif(fullPath) {
    try {
        const gps = await exifr.gps(fullPath).catch(() => null);
        const meta = await exifr.parse(fullPath, ['DateTimeOriginal']).catch(() => null);
        if (gps && gps.latitude && gps.longitude) {
            console.log(`[GPS EXIF] ✓ ${path.basename(fullPath)}: ${gps.latitude}, ${gps.longitude}`);
            return {
                lat: gps.latitude,
                lng: gps.longitude,
                timestamp: meta?.DateTimeOriginal || new Date(),
                source: 'exif'
            };
        }
    } catch (err) {
        console.warn(`[GPS EXIF] Parse error: ${err.message}`);
    }
    return null;
}

/**
 * Stage 2: Use Gemini Vision to read GPS from visible watermark on the photo
 */
async function readGpsFromWatermark(fullPath) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    try {
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Data = imageBuffer.toString('base64');
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Analiza la marca de agua o texto superpuesto en esta foto (habitualmente en la esquina inferior izquierda o inferior derecha, creada por aplicaciones como Timemark Camera, GPS Camera Stamp, etc.).
Tu tarea es extraer:
1. La latitud y longitud geográfica (en formato decimal, ej: "49.835978" y "8.009682"). Si aparecen en DMS (grados, minutos, segundos) conviértelos a decimal.
2. La fecha y hora indicadas.

Responde ESTRICTAMENTE con JSON plano (sin bloques markdown, sin texto extra) en una sola línea:
{"latitude": número_decimal_o_null, "longitude": número_decimal_o_null, "timestamp": "YYYY-MM-DDTHH:mm:ss" o null}

Si la fecha está en español (ej: "Vie, 05 de jun 2026 09:07"), conviértela a formato ISO.
Si no encuentras coordenadas: {"latitude": null, "longitude": null, "timestamp": null}`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType } }
        ]);

        const responseText = result.response.text().trim()
            .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

        const data = JSON.parse(responseText);

        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number'
            && !isNaN(data.latitude) && !isNaN(data.longitude)
            && data.latitude !== 0 && data.longitude !== 0) {
            console.log(`[GPS Watermark] ✓ ${path.basename(fullPath)}: ${data.latitude}, ${data.longitude}`);
            return {
                lat: data.latitude,
                lng: data.longitude,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
                source: 'watermark'
            };
        }
    } catch (err) {
        console.warn(`[GPS Watermark] Gemini extraction failed: ${err.message}`);
    }
    return null;
}

/**
 * Stage 3: Write GPS coordinates back into the JPEG EXIF metadata using piexifjs.
 * This embeds the coordinates physically in the file so future reads get them from EXIF.
 * Only works for JPEG files.
 */
function writeGpsToExif(fullPath, lat, lng) {
    const ext = path.extname(fullPath).toLowerCase();
    if (ext !== '.jpg' && ext !== '.jpeg') {
        console.log(`[GPS Write] Skipping non-JPEG: ${path.basename(fullPath)}`);
        return;
    }

    try {
        const imageData = fs.readFileSync(fullPath);
        const imageBase64 = 'data:image/jpeg;base64,' + imageData.toString('base64');

        // Load existing EXIF or create empty structure
        let exifObj;
        try {
            exifObj = piexifjs.load(imageBase64);
        } catch {
            exifObj = { '0th': {}, 'Exif': {}, 'GPS': {}, '1st': {} };
        }

        // Convert decimal degrees to DMS (degrees, minutes, seconds)
        function toDMS(decimal) {
            const absVal = Math.abs(decimal);
            const deg = Math.floor(absVal);
            const minFloat = (absVal - deg) * 60;
            const min = Math.floor(minFloat);
            const sec = Math.round((minFloat - min) * 60 * 100); // x100 for rational
            return [[deg, 1], [min, 1], [sec, 100]];
        }

        exifObj['GPS'][piexifjs.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
        exifObj['GPS'][piexifjs.GPSIFD.GPSLatitude] = toDMS(lat);
        exifObj['GPS'][piexifjs.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
        exifObj['GPS'][piexifjs.GPSIFD.GPSLongitude] = toDMS(lng);

        const exifBytes = piexifjs.dump(exifObj);
        const newImage = piexifjs.insert(exifBytes, imageBase64);
        const newImageBuffer = Buffer.from(newImage.replace('data:image/jpeg;base64,', ''), 'base64');

        fs.writeFileSync(fullPath, newImageBuffer);
        console.log(`[GPS Write] ✓ Embedded GPS into ${path.basename(fullPath)}: ${lat}, ${lng}`);
    } catch (err) {
        console.error(`[GPS Write] Failed for ${path.basename(fullPath)}:`, err.message);
    }
}

/**
 * Full GPS extraction pipeline for a single uploaded file:
 * 1. Try EXIF metadata
 * 2. If not found, try Gemini OCR on visible watermark
 * 3. If found via watermark, write coords back into EXIF for future reads
 */
async function extractAndEmbedGps(fullPath) {
    // Stage 1: EXIF
    const exifGps = await readGpsFromExif(fullPath);
    if (exifGps) return exifGps;

    // Stage 2: Gemini watermark OCR
    console.log(`[GPS] No EXIF in ${path.basename(fullPath)}, trying Gemini watermark OCR...`);
    const watermarkGps = await readGpsFromWatermark(fullPath);
    if (watermarkGps) {
        // Stage 3: Write GPS back into EXIF so future processes can use it
        writeGpsToExif(fullPath, watermarkGps.lat, watermarkGps.lng);
        return watermarkGps;
    }

    console.log(`[GPS] No GPS found in ${path.basename(fullPath)}`);
    return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/uploads
 * Uploads one or more photos, extracts GPS from each (EXIF → Gemini OCR → EXIF write-back),
 * and returns { urls, gpsData } where gpsData[i] corresponds to urls[i].
 */
router.post('/', verifyToken, upload.array('photos', 20), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se han subido archivos' });
        }

        // Process GPS in parallel for all uploaded files
        const results = await Promise.allSettled(
            req.files.map(async (file) => {
                const fullPath = path.join(__dirname, '../../uploads/', file.filename);
                const relativeUrl = `/uploads/${file.filename}`;
                const gpsData = await extractAndEmbedGps(fullPath);
                return { url: relativeUrl, gps: gpsData };
            })
        );

        const urls = [];
        const gpsData = [];

        results.forEach(r => {
            if (r.status === 'fulfilled') {
                urls.push(r.value.url);
                gpsData.push(r.value.gps); // null if no GPS found
            }
        });

        res.json({ urls, gpsData });
    } catch (error) {
        console.error('Error in file upload:', error);
        res.status(500).json({ message: 'Error al subir archivos' });
    }
});

/**
 * POST /api/uploads/extract-gps
 * Upload a single photo and return its GPS coordinates (for direct queries).
 */
router.post('/extract-gps', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha subido ningún archivo' });
        }

        const fullPath = path.join(__dirname, '../../uploads/', req.file.filename);
        const relativeUrl = `/uploads/${req.file.filename}`;

        const gpsData = await extractAndEmbedGps(fullPath);

        if (gpsData) {
            return res.json({
                status: 'ok',
                url: relativeUrl,
                gps: { lat: gpsData.lat, lng: gpsData.lng },
                source: gpsData.source,
                timestamp: gpsData.timestamp
            });
        }

        return res.status(400).json({
            status: 'no_gps',
            url: relativeUrl,
            message: 'No se encontraron coordenadas GPS en la imagen (ni en metadatos EXIF ni en la marca de agua visible).'
        });
    } catch (error) {
        console.error('Error in extract-gps:', error);
        res.status(500).json({ message: 'Error interno al procesar los metadatos de la imagen.' });
    }
});

module.exports = router;
