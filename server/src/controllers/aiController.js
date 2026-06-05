const { GoogleGenerativeAI } = require("@google/generative-ai");
const exifr = require('exifr');
const path = require('path');
const fs = require('fs');

// Fallback: extract GPS visually from image text overlay (like Timemark Camera)
async function extractGpsVisually(fullPath) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.warn("[GPS Fallback] GEMINI_API_KEY is missing, skipping visual check.");
            return null;
        }

        if (!fs.existsSync(fullPath)) {
            console.warn(`[GPS Fallback] File not found: ${fullPath}`);
            return null;
        }

        const imageBuffer = fs.readFileSync(fullPath);
        const base64Data = imageBuffer.toString('base64');
        const ext = path.extname(fullPath).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

        const prompt = `Analiza la marca de agua o texto superpuesto en esta foto (habitualmente en la esquina inferior izquierda, creada por aplicaciones de cámara como Timemark Camera, GPS Camera, etc.).
Tu tarea es extraer:
1. La latitud y longitud geográfica que aparecen escritas (en formato decimal, ej: "49.835978" y "8.009682").
2. La fecha y hora indicadas (ej: "Vie, 05 de jun 2026 09:07").

Responde ESTRICTAMENTE con un objeto JSON (sin bloques de formato de markdown \`\`\`json ni texto adicional, solo el JSON plano en una sola línea) con las siguientes propiedades:
{
  "latitude": decimal o null,
  "longitude": decimal o null,
  "timestamp": "YYYY-MM-DDTHH:mm:ss" o null
}
Si no se encuentran las coordenadas o la fecha, responde con null en esas propiedades. Si la fecha está en español, conviértela a formato ISO de fecha/hora (YYYY-MM-DDTHH:mm:ss).`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: mimeType,
                },
            },
        ]);

        const responseText = result.response.text().trim();
        const cleanJsonText = responseText.replace(/^```json/i, '').replace(/```$/, '').trim();
        
        const data = JSON.parse(cleanJsonText);
        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            return {
                lat: data.latitude,
                lng: data.longitude,
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
            };
        }
    } catch (err) {
        console.error(`[GPS Fallback] Error in visual extraction for ${fullPath}:`, err);
    }
    return null;
}

// Helper to extract GPS metadata from uploaded photo
async function extractGpsFromImage(relativeUrl) {
    try {
        if (!relativeUrl) return null;
        const cleanPath = relativeUrl.split('?')[0].replace(/^\//, '');
        const fullPath = path.join(__dirname, '../../', cleanPath);
        
        if (!fs.existsSync(fullPath)) {
            console.warn(`[EXIF Parser] File not found: ${fullPath}`);
            return null;
        }

        const gps = await exifr.gps(fullPath).catch(() => null);
        const meta = await exifr.parse(fullPath, ['DateTimeOriginal']).catch(() => null);
        
        if (gps && gps.latitude && gps.longitude) {
            return {
                lat: gps.latitude,
                lng: gps.longitude,
                timestamp: meta?.DateTimeOriginal || new Date()
            };
        }

        // Fallback to visual extraction if EXIF metadata is missing
        const visualGps = await extractGpsVisually(fullPath);
        if (visualGps) {
            return visualGps;
        }
    } catch (error) {
        console.error(`[EXIF Parser] Error parsing image EXIF:`, error);
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

    if (!photos || !Array.isArray(photos) || photos.length < 2) {
        return res.status(400).json({ message: 'Se requieren al menos 2 fotos del trayecto del ducto para calcular el recorrido.' });
    }

    try {
        // 1. Extract GPS coords from photos
        const coordinates = [];
        for (const url of photos) {
            const gps = await extractGpsFromImage(url);
            if (gps) {
                coordinates.push(gps);
            }
        }

        if (coordinates.length < 2) {
            return res.status(400).json({ 
                message: 'No se encontraron suficientes metadatos GPS en las imágenes subidas. Por favor, asegúrate de que la cámara del móvil tiene activa la geolocalización / GPS y vuelve a tomar las fotos.' 
            });
        }

        // 2. Sort points chronologically
        coordinates.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 3. Compute distance programmatically (Haversine)
        const distance = getHaversineDistance(coordinates);

        // 4. Ask Gemini to analyze the route data and produce a structured summary
        const apiKey = process.env.GEMINI_API_KEY;
        let aiSummary = "Trazado de ducto en calle calculado a partir de metadatos GPS.";
        let startPoint = { lat: coordinates[0].lat, lng: coordinates[0].lng };
        let endPoint = { lat: coordinates[coordinates.length - 1].lat, lng: coordinates[coordinates.length - 1].lng };

        if (apiKey) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

                const pointsText = coordinates.map((c, i) => `Punto ${i + 1}: Lat: ${c.lat}, Lng: ${c.lng}, Hora: ${c.timestamp}`).join('\n');
                const prompt = `Analiza los siguientes puntos de geolocalización GPS capturados cronológicamente durante la instalación de un ducto de obra civil en la calle.
                
Comentarios del operario: "${comments || 'Ninguno'}"
Distancia calculada por algoritmo: ${distance.toFixed(1)} metros.

Puntos GPS:
${pointsText}

Genera un resumen en español de la trayectoria (ej: 'Instalación de ducto a lo largo de la calle X, desde la esquina Y hasta el portal Z'). Confirma si el trazado parece lógico y describe el punto de inicio y el punto final de forma amigable.
Responde de forma concisa y directa.`;

                const result = await model.generateContent(prompt);
                aiSummary = result.response.text().trim();
            } catch (aiErr) {
                console.error('[Gemini Duct AI Error]', aiErr.message);
            }
        }

        res.json({
            status: 'ok',
            coordinates,
            startPoint,
            endPoint,
            distance: parseFloat(distance.toFixed(1)),
            summary: aiSummary
        });

    } catch (error) {
        console.error('Error processing duct route:', error);
        res.status(500).json({ message: 'Error interno al procesar el trazado del ducto.' });
    }
};
