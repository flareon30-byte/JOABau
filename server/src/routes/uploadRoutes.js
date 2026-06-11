const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const exifr = require('exifr');
const piexifjs = require('piexifjs');
// Google SDK removed in favor of direct REST v1 API to support AQ. key format
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
    if (process.env.GEMINI_API_KEY === '' || !process.env.GEMINI_API_KEY) {
        delete process.env.GEMINI_API_KEY;
    }
    // Explicitly load dotenv from root or server dir as fallback
    try {
        const pathsToTry = [
            path.join(__dirname, '../../.env'), // /app/.env
            path.join(__dirname, '../../../.env'), // /opt/JOABau/.env (if volume-mounted)
            path.join(process.cwd(), '.env'),
            path.join(process.cwd(), '../.env')
        ];
        for (const p of pathsToTry) {
            if (fs.existsSync(p)) {
                require('dotenv').config({ path: p });
                break;
            }
        }
    } catch (envErr) {
        console.warn('[GPS Watermark] Dotenv reload fallback error:', envErr.message);
    }

    const pathsToTry = [
        path.join(__dirname, '../../.env'), // /app/.env
        path.join(__dirname, '../../../.env'), // /opt/JOABau/.env (if volume-mounted)
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '../.env')
    ];
    const pathResults = pathsToTry.map(p => `${p} (${fs.existsSync(p) ? 'EXISTE' : 'NO EXISTE'})`).join(', ');

    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        try {
            const configPath = path.join(__dirname, '../../uploads/gemini_config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.GEMINI_API_KEY) {
                    apiKey = config.GEMINI_API_KEY;
                    process.env.GEMINI_API_KEY = apiKey;
                }
            }
        } catch (err) {
            console.warn('[GPS Watermark] Failed to load config fallback key:', err.message);
        }
    }

    if (!apiKey) {
        console.warn(`[GPS Watermark] GEMINI_API_KEY is missing/falsy in process.env and config file! Value: "${apiKey}", Type: ${typeof apiKey}, Length: ${apiKey ? apiKey.length : 0}`);
        global.lastGeminiResponse = `GEMINI_API_KEY es vacía (tanto en process.env como en uploads/gemini_config.json). Rutas probadas: ${pathResults}. Clave de process.env: "${apiKey}"`;
        return null;
    }

    try {
        const imageBuffer = fs.readFileSync(fullPath);
        const base64Data = imageBuffer.toString('base64');
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

        console.log(`[GPS Watermark] Sending image ${path.basename(fullPath)} to Gemini REST v1 API... API key starts with: ${apiKey.substring(0, 5)}...`);
        const axios = require('axios');
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const prompt = `Analiza la imagen minuciosamente buscando marcas de agua o texto superpuesto que muestren coordenadas geográficas y marcas de tiempo (normalmente en la esquina inferior izquierda o en la barra inferior, añadidas por apps como Timemark Camera, GPS Map Camera, etc.).
Ejemplos de formatos comunes:
- "49.836566°N, 8.014898°E"
- "Latitude: 49.835978, Longitude: 8.009682"

Tu tarea es:
1. Extraer la latitud y longitud. Si tiene símbolos como "°N", "°S", "°E", "°W" o es DMS, conviértela a un número decimal puro y limpio (si es Sur o Oeste, el valor debe ser negativo).
2. Extraer la fecha y hora y formatearla en ISO.

Responde ESTRICTAMENTE con un objeto JSON en este formato (sin formateo Markdown \`\`\`json, sin texto adicional, solo el JSON puro):
{"latitude": <número_decimal_o_null>, "longitude": <número_decimal_o_null>, "timestamp": "YYYY-MM-DDTHH:mm:ss" o null}`;

        const payload = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType,
                                data: base64Data
                            }
                        }
                    ]
                }
            ]
        };

        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        let responseText = response.data.candidates[0].content.parts[0].text.trim();
        console.log(`[GPS Watermark] Raw Gemini Response:`, responseText);
        global.lastGeminiResponse = responseText;
        
        // Clean markdown code blocks from response if present
        responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

        // If Gemini includes other conversational text, locate the JSON object boundaries
        const firstBracket = responseText.indexOf('{');
        const lastBracket = responseText.lastIndexOf('}');
        if (firstBracket !== -1 && lastBracket !== -1) {
            responseText = responseText.substring(firstBracket, lastBracket + 1);
        }

        const data = JSON.parse(responseText);
        console.log(`[GPS Watermark] Parsed JSON data:`, data);

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
        } else {
            console.log(`[GPS Watermark] Coords are invalid or empty in JSON response.`);
        }
    } catch (err) {
        console.error(`[GPS Watermark] Gemini extraction failed:`, err);
        global.lastGeminiResponse = `Error de API o red: ${err.message || String(err)}`;
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

// debug-env route removed in production

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

        // Let's check what Gemini actually returned (by doing it manually or storing the debug log)
        // To make it easy to see, let's run readGpsFromWatermark and if it fails, capture what it returned.
        // We will call readGpsFromWatermark but we want to capture the responseText if JSON parse or coords check failed.
        // Let's modify the return to pass details
        return res.status(400).json({
            status: 'no_gps',
            url: relativeUrl,
            message: 'No se encontraron coordenadas GPS en la imagen (ni en metadatos EXIF ni en la marca de agua visible).',
            details: global.lastGeminiResponse ? `Respuesta de Gemini: "${global.lastGeminiResponse}"` : 'Gemini no devolvió ninguna respuesta (o la clave de API falló).'
        });
    } catch (error) {
        console.error('Error in extract-gps:', error);
        res.status(500).json({ 
            message: 'Error interno al procesar los metadatos de la imagen.',
            details: error.message || String(error)
        });
    }
});

module.exports = router;
