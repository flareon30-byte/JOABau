const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken } = require('../middleware/authMiddleware');

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

router.post('/', verifyToken, upload.array('photos', 20), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No se han subido archivos' });
        }
        
        const urls = req.files.map(file => `/uploads/${file.filename}`);
        res.json({ urls });
    } catch (error) {
        console.error('Error in file upload:', error);
        res.status(500).json({ message: 'Error al subir archivos' });
    }
});

router.post('/extract-gps', verifyToken, upload.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se ha subido ningún archivo' });
        }
        
        const path = require('path');
        const fs = require('fs');
        const exifr = require('exifr');
        const { GoogleGenerativeAI } = require("@google/generative-ai");

        const fullPath = path.join(__dirname, '../../uploads/', req.file.filename);
        const relativeUrl = `/uploads/${req.file.filename}`;

        // 1. Try EXIF extraction
        const gps = await exifr.gps(fullPath).catch(() => null);
        const meta = await exifr.parse(fullPath, ['DateTimeOriginal']).catch(() => null);
        
        if (gps && gps.latitude && gps.longitude) {
            return res.json({
                status: 'ok',
                url: relativeUrl,
                gps: { lat: gps.latitude, lng: gps.longitude },
                timestamp: meta?.DateTimeOriginal || new Date()
            });
        }

        // 2. Try Gemini Visual Extraction
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(400).json({ message: 'La foto no contiene metadatos GPS y el servicio de IA no está configurado.' });
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
        
        let data;
        try {
            data = JSON.parse(cleanJsonText);
        } catch (jsonErr) {
            console.error('[GPS Extraction] JSON parse error:', jsonErr, responseText);
            return res.status(400).json({ message: 'No se pudieron extraer coordenadas válidas de la foto.' });
        }

        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
            return res.json({
                status: 'ok',
                url: relativeUrl,
                gps: { lat: data.latitude, lng: data.longitude },
                timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
            });
        }

        return res.status(400).json({ message: 'No se encontraron coordenadas GPS legibles en la imagen.' });
    } catch (error) {
        console.error('Error in extract-gps:', error);
        res.status(500).json({ message: 'Error interno al procesar los metadatos de la imagen.' });
    }
});

module.exports = router;
