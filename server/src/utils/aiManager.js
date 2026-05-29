const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

exports.analyzePendingAppointments = async (addresses) => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("La API Key de Gemini no está configurada en .env.server (GEMINI_API_KEY)");
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                    call_back: {
                        type: SchemaType.ARRAY,
                        description: "Direcciones de clientes a los que hay que volver a llamar (ej: no contestaron, pidieron llamar más tarde, estaban ocupados, buzón de voz)",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "ID de la dirección" },
                                reason: { type: SchemaType.STRING, description: "Breve resumen en español de por qué hay que rellamar (ej: 'Buzón de voz tras 3 intentos' o 'Pide llamar a partir del día 15')" }
                            },
                            required: ["id", "reason"]
                        }
                    },
                    work_finished: {
                        type: SchemaType.ARRAY,
                        description: "Direcciones de clientes que ya han finalizado sus trabajos/obras pendientes y están listos para la instalación",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "ID de la dirección" },
                                reason: { type: SchemaType.STRING, description: "Breve resumen en español del comentario del cliente indicando que finalizó sus obras" }
                            },
                            required: ["id", "reason"]
                        }
                    },
                    needs_auskundung: {
                        type: SchemaType.ARRAY,
                        description: "Direcciones que explícitamente necesitan 'Auskundung', visita previa, o estudio",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "ID de la dirección" },
                                reason: { type: SchemaType.STRING, description: "Breve resumen en español de por qué requiere auskundung" }
                            },
                            required: ["id", "reason"]
                        }
                    },
                    others: {
                        type: SchemaType.ARRAY,
                        description: "Otras direcciones con comentarios que requieren atención manual por algún problema, queja, o caso especial",
                        items: {
                            type: SchemaType.OBJECT,
                            properties: {
                                id: { type: SchemaType.STRING, description: "ID de la dirección" },
                                reason: { type: SchemaType.STRING, description: "Breve resumen en español del problema o caso especial" }
                            },
                            required: ["id", "reason"]
                        }
                    }
                },
                required: ["call_back", "work_finished", "needs_auskundung", "others"]
            }
        }
    });

    // Construir el texto de entrada solo con los datos relevantes para ahorrar tokens
    const inputData = addresses.map(addr => {
        let commentsText = "";
        if (addr.appointment && addr.appointment.comments && addr.appointment.comments.length > 0) {
            commentsText = addr.appointment.comments.map(c => `[${new Date(c.createdAt).toLocaleDateString()} ${c.authorName}]: ${c.content}`).join(" | ");
        } else if (addr.appointment && addr.appointment.contactHistory && addr.appointment.contactHistory.length > 0) {
            commentsText = addr.appointment.contactHistory.join(" | ");
        } else {
            // Si no hay comentarios, no lo analizamos para ahorrar tokens, no aportará nada.
            return null;
        }

        return `ID: ${addr.id}\nComentarios: ${commentsText}\n`;
    }).filter(Boolean).join("\n---\n");

    if (!inputData) {
        return { call_back: [], work_finished: [], needs_auskundung: [], others: [] };
    }

    const prompt = `Eres un asistente experto en Back Office de telecomunicaciones.
Tu tarea es leer la siguiente lista de direcciones con sus historiales de contacto y comentarios, y clasificar ÚNICAMENTE LOS IDs de las direcciones en las categorías proporcionadas.

Si una dirección no encaja en ninguna categoría clara de acción o el comentario es irrelevante, simplemente omítela. No inventes IDs.

Aquí tienes los datos:
${inputData}
`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return JSON.parse(responseText);
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Error al analizar las citas con la IA. Asegúrate de que la API Key es válida.");
    }
};
