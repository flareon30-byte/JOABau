const { GoogleGenerativeAI } = require("@google/generative-ai");
const exifr = require('exifr');
const path = require('path');
const fs = require('fs');


// Download image from URL and return buffer + mimeType
async function fetchImageBuffer(url) {
    try {
        // If it's a relative path on disk, read directly
        if (!url.startsWith('http')) {
            const cleanPath = url.split('?')[0].replace(/^\//, '');
            const fullPath = path.join(__dirname, '../../', cleanPath);
            if (fs.existsSync(fullPath)) {
                const buffer = fs.readFileSync(fullPath);
                const ext = path.extname(fullPath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                return { buffer, mimeType, fullPath };
            }
            return null;
        }

        // Remote URL: download with axios
        const axios = require('axios');
        const response = await axios.get(url, { 
            responseType: 'arraybuffer', 
            timeout: 12000,
            headers: { 'User-Agent': 'JOABau-Server/1.0' }
        });
        const buffer = Buffer.from(response.data);
        const contentType = response.headers['content-type'] || '';
        const mimeType = contentType.includes('png') ? 'image/png' 
                       : contentType.includes('webp') ? 'image/webp' 
                       : 'image/jpeg';
        return { buffer, mimeType, fullPath: null };
    } catch (err) {
        console.error(`[fetchImageBuffer] Failed for ${url}:`, err.message);
        return null;
    }
}

// Use Gemini Vision to read GPS coordinates from watermark text visible in the photo
async function extractGpsVisuallyFromBuffer(buffer, mimeType) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return null;

        const base64Data = buffer.toString('base64');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `Analiza esta imagen. Puede tener una marca de agua o texto superpuesto con coordenadas GPS (normalmente en las esquinas, creado por apps como GPS Camera, Timemark Camera, etc.).

Extrae la latitud y longitud en formato decimal (ej: "49.835978" y "8.009682") y la fecha/hora si aparece.

Responde SOLO con JSON plano (sin bloques markdown), en una sola línea:
{"latitude": número_decimal_o_null, "longitude": número_decimal_o_null, "timestamp": "YYYY-MM-DDTHH:mm:ss_o_null"}

Si los números tienen coma como separador decimal, conviértelos a punto. Si no encuentras coordenadas, responde: {"latitude": null, "longitude": null, "timestamp": null}`;

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
            console.log(`[GPS Visual] Extracted: ${data.latitude}, ${data.longitude}`);
            return {
                lat: data.latitude,
                lng: data.longitude,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
            };
        }
    } catch (err) {
        console.error('[GPS Visual] Gemini extraction failed:', err.message);
    }
    return null;
}

// Helper to extract GPS from uploaded photo URL (EXIF first, then Gemini visual watermark)
async function extractGpsFromImage(photoUrl) {
    try {
        if (!photoUrl) return null;

        const imageData = await fetchImageBuffer(photoUrl);
        if (!imageData) {
            console.warn(`[GPS] Could not fetch image: ${photoUrl}`);
            return null;
        }

        const { buffer, mimeType, fullPath } = imageData;

        // Stage 1: Try EXIF from buffer
        try {
            const gps = await exifr.gps(buffer).catch(() => null);
            const meta = await exifr.parse(buffer, ['DateTimeOriginal']).catch(() => null);
            if (gps && gps.latitude && gps.longitude) {
                console.log(`[GPS EXIF] Found for ${photoUrl}: ${gps.latitude}, ${gps.longitude}`);
                return {
                    lat: gps.latitude,
                    lng: gps.longitude,
                    timestamp: meta?.DateTimeOriginal || new Date()
                };
            }
        } catch (exifErr) {
            console.warn(`[GPS EXIF] Parse error for ${photoUrl}:`, exifErr.message);
        }

        // Stage 2: Gemini visual watermark reading
        console.log(`[GPS] No EXIF for ${photoUrl}, trying Gemini visual extraction...`);
        const visualGps = await extractGpsVisuallyFromBuffer(buffer, mimeType);
        if (visualGps) return visualGps;

    } catch (error) {
        console.error(`[GPS] extractGpsFromImage error:`, error.message);
    }
    return null;
}


// Helper to calculate Haversine distance in meters
function getHaversineDistance(coords) {
    let total = 0;
    const R = 6371e3; // Earth radius in meters
    for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const lat1 = p1.lat * Math.PI / 180;
        const lat2 = p2.lat * Math.PI / 180;
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLng = (p2.lng - p1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        total += R * c;
    }
    return total;
}

exports.checkPhotoQuality = async (req, res) => {
    try {
        const { imageBase64 } = req.body;
        
        if (!imageBase64) {
            return res.status(400).json({ error: "Missing imageBase64" });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("GEMINI_API_KEY is missing, skipping AI check.");
            return res.json({ status: 'ok', isBlurry: false }); // Fallback
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const prompt = "Eres un sistema de control de calidad automático y extremadamente estricto. Tu única función es detectar si una foto de una instalación técnica está fuera de foco (desenfocada) o movida. Analiza la imagen: busca texto, cables, o bordes de objetos. Si los bordes no están perfectamente definidos, si el texto o los detalles pequeños no se pueden leer con total claridad, o si la imagen en general se ve borrosa, desenfocada o con efecto de cámara movida, DEBES rechazarla obligatoriamente. Responde ÚNICAMENTE con la palabra 'BORROSA' si hay la más mínima falta de nitidez. Responde 'CLARA' solo y exclusivamente si la imagen tiene un enfoque perfecto, cristalino y todos los detalles son totalmente legibles.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/jpeg",
                },
            },
        ]);

        const responseText = result.response.text().trim().toUpperCase();
        console.log(`[AI Photo Check] Result: ${responseText}`);

        const isBlurry = responseText.includes("BORROSA");

        res.json({ status: 'ok', isBlurry });
    } catch (error) {
        console.error("AI Photo Check Error:", error);
        res.json({ status: 'error', isBlurry: false, message: error.message });
    }
};

exports.processDuctRoute = async (req, res) => {
    const { photos, comments } = req.body;

    if (!photos || !Array.isArray(photos) || photos.length < 1) {
        return res.status(400).json({ message: 'Se requiere al menos 1 foto del trayecto del ducto.' });
    }

    try {
        console.log(`[processDuctRoute] Processing ${photos.length} photos...`);

        // 1. Extract GPS from all photos IN PARALLEL (EXIF first, then Gemini visual watermark)
        const GPS_TIMEOUT = 25000; // 25s per photo max
        const gpsResults = await Promise.allSettled(
            photos.map(url =>
                Promise.race([
                    extractGpsFromImage(url),
                    new Promise(resolve => setTimeout(() => resolve(null), GPS_TIMEOUT))
                ])
            )
        );

        const coordinates = gpsResults
            .map(r => r.status === 'fulfilled' ? r.value : null)
            .filter(Boolean);

        console.log(`[processDuctRoute] GPS extracted: ${coordinates.length}/${photos.length} photos`);

        if (coordinates.length < 1) {
            return res.status(400).json({
                message: 'No se encontraron coordenadas GPS en ninguna foto. La IA intentó leer tanto los metadatos EXIF como las marcas de agua visibles, pero no encontró coordenadas. Asegúrate de que las fotos tienen la ubicación activada (GPS) o que la marca de agua con coordenadas es legible.'
            });
        }

        // 2. Sort chronologically
        coordinates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 3. Compute Haversine distance
        const distance = coordinates.length >= 2 ? getHaversineDistance(coordinates) : 0;

        let startPoint = { lat: coordinates[0].lat, lng: coordinates[0].lng };
        let endPoint = { lat: coordinates[coordinates.length - 1].lat, lng: coordinates[coordinates.length - 1].lng };

        // 4. Ask Gemini for a route summary (optional, don't block if fails)
        let aiSummary = `Trazado calculado a partir de ${coordinates.length} punto(s) GPS.`;
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && coordinates.length >= 2) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
                const pointsText = coordinates.map((c, i) => `Punto ${i + 1}: Lat ${c.lat.toFixed(6)}, Lng ${c.lng.toFixed(6)}, Hora: ${c.timestamp}`).join('\n');
                const prompt = `Analiza los siguientes puntos GPS de instalación de ducto de obra civil.
Comentarios del operario: "${comments || 'Ninguno'}"
Distancia calculada: ${distance.toFixed(1)} metros.
Puntos GPS:\n${pointsText}\n
Genera un resumen breve en español (1-2 frases) de la trayectoria del ducto.`;
                const result = await model.generateContent(prompt);
                aiSummary = result.response.text().trim();
            } catch (aiErr) {
                console.warn('[Gemini Summary]', aiErr.message);
            }
        }

        res.json({
            status: 'ok',
            coordinates,
            startPoint,
            endPoint,
            distance: parseFloat(distance.toFixed(1)),
            photosProcessed: photos.length,
            photosWithGps: coordinates.length,
            summary: aiSummary
        });

    } catch (error) {
        console.error('Error processing duct route:', error);
        res.status(500).json({ message: 'Error interno al procesar el trazado del ducto.' });
    }
};
