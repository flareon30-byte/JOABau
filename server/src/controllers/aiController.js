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
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Remove the data:image/jpeg;base64, prefix if present
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

        const prompt = "Eres un inspector técnico de telecomunicaciones estricto. Analiza esta foto. Determina si está lo suficientemente clara, nítida y bien iluminada como para poder distinguir detalles importantes (como cables, conexiones, etiquetas o luces de equipos). Si la foto está desenfocada, movida, muy borrosa, o excesivamente oscura impidiendo ver detalles técnicos, responde BORROSA. Si la foto es razonablemente nítida y se ven los detalles con claridad, responde CLARA. Responde única y exclusivamente con una palabra: CLARA o BORROSA.";

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
