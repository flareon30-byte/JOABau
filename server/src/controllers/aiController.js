const { GoogleGenerativeAI } = require("@google/generative-ai");

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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // Remove the data:image/jpeg;base64, prefix if present
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
        // If AI fails for some reason, accept the photo so we don't block the technician
        res.json({ status: 'error', isBlurry: false, message: error.message });
    }
};
