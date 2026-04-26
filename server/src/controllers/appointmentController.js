const prisma = require('../prisma');
const { processImages } = require('../utils/imageProcessor');
const { sendPushToTeam, sendPushToRole } = require('../utils/notificationUtils');

// Get addresses ready for appointment (Soplado OK, Appointment Pending/Null)
exports.getPendingAppointments = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                AND: [
                    { clientName: { not: { startsWith: '***' } } },
                    { sopladoStatus: 'OK' },
                    { project: { isDemo: req.isDemo || false } },
                    { orderStatus: { notIn: ['CERRADA', 'DERIVADA'] } },
                    {
                        OR: [
                            { appointment: { is: null } },
                            { appointment: { status: 'PENDIENTE' } },
                            { appointment: { status: 'RECITAR' } }
                        ]
                    }
                ]
            },
            include: {
                project: true,
                appointment: {
                    include: {
                        comments: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching pending appointments' });
    }
};

// Get escalated/derived/closed addresses
exports.getEscalatedAppointments = async (req, res) => {
    try {
        const addresses = await prisma.address.findMany({
            where: {
                AND: [
                    { project: { isDemo: req.isDemo || false } },
                    { orderStatus: { in: ['CERRADA', 'DERIVADA'] } }
                ]
            },
            include: {
                project: true,
                appointment: {
                    include: {
                        comments: true
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching escalated appointments' });
    }
};

// Get all clients living in the same building
exports.getBuildingClients = async (req, res) => {
    const { street, number, projectId } = req.query;
    try {
        const clients = await prisma.address.findMany({
            where: {
                projectId,
                street: { equals: street, mode: 'insensitive' },
                number: { equals: number || '', mode: 'insensitive' }
            },
            include: {
                appointment: true
            }
        });
        res.json(clients);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching building clients' });
    }
};

// Log a contact attempt
exports.logContactAttempt = async (req, res) => {
    const { addressId } = req.params;
    const { result, comment } = req.body; // result: "No contesta", "Equivocado", etc.
    const userId = req.userId; // From authMiddleware

    try {
        // Fetch user to get author name
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';
        const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Berlin' });
        const historyEntry = comment ? `${timestamp}: ${result} - ${comment}` : `${timestamp}: ${result}`;

        // Upsert appointment to ensure it exists
        const appointment = await prisma.appointment.upsert({
            where: { addressId },
            update: {
                contactAttempts: { increment: 1 },
                contactHistory: { push: historyEntry },
                comments: comment ? {
                    create: { content: comment, authorName }
                } : undefined
            },
            create: {
                addressId,
                contactAttempts: 1,
                contactHistory: [historyEntry],
                comments: comment ? {
                    create: { content: comment, authorName }
                } : undefined
            }
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging contact attempt' });
    }
};

// Schedule an appointment
exports.scheduleAppointment = async (req, res) => {
    const { addressId } = req.params;
    const { date, teamId, clientName, apartmentCount, type = 'ACTIVATION', orientationComment } = req.body;

    if (!clientName || !apartmentCount) {
        return res.status(400).json({ message: 'El nombre del cliente y el número de apartamentos son obligatorios.' });
    }

    try {
        // 1. Validation Logic
        const address = await prisma.address.findUnique({ where: { id: addressId } });

        if (!address) {
            return res.status(404).json({ message: 'Dirección no encontrada' });
        }

        // BLOCKING RULES
        if (type === 'ACTIVATION') {
            if (address.sopladoStatus !== 'OK') {
                return res.status(400).json({ message: 'Bloqueado: Esta dirección aún no tiene Soplado OK.' });
            }
            // Check protocol ONLY if required. "OK" or "COMPLETED" are valid success states (using "OK" for simplicity based on prompt)
            if (address.requiresProtocol && address.protocolStatus !== 'OK') {
                return res.status(400).json({ message: 'Bloqueado: Esta dirección require Protocolo OK antes de activar.' });
            }
        }

        // 2. Transaction to update Appointment and Address Status
        const userId = req.userId; // Who is scheduling this?

        const result = await prisma.$transaction(async (tx) => {
            const appointment = await tx.appointment.upsert({
                where: { addressId },
                update: {
                    assignedDate: new Date(date),
                    assignedTeamId: teamId,
                    status: 'CITADO',
                    clientName,
                    apartmentCount: parseInt(apartmentCount),
                    type,
                    orientationComment,
                    scheduledById: userId // Track who made the appointment
                },
                create: {
                    addressId,
                    assignedDate: new Date(date),
                    assignedTeamId: teamId,
                    status: 'CITADO',
                    clientName,
                    apartmentCount: parseInt(apartmentCount),
                    type,
                    orientationComment,
                    scheduledById: userId // Track who made the appointment
                }
            });

            // If scheduling a Protocol, update address status to imply it is in progress/scheduled
            if (type === 'PROTOCOL') {
                await tx.address.update({
                    where: { id: addressId },
                    data: { protocolStatus: 'SCHEDULED' }
                });
            }

            return appointment;
        });

        // --- PUSH NOTIFICATION ALERT ---
        if (teamId) {
            try {
                // Fetch full address for the message
                const addr = await prisma.address.findUnique({ where: { id: addressId } });
                sendPushToTeam(teamId, {
                    title: '📋 Nueva Orden de Trabajo',
                    body: `Asignado: ${addr.street} ${addr.number || ''} para ${new Date(date).toLocaleDateString()}.`,
                    data: { addressId: addr.id, type: 'ASSIGNMENT' }
                }).catch(e => console.error('Push signal error:', e.message));
            } catch (pError) {
                console.error('Failed to prepare push payload:', pError);
            }
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error scheduling appointment' });
    }
};

// Get scheduled appointments (Calendar view)
exports.getScheduledAppointments = async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        let where = {
            status: 'CITADO',
            address: { project: { isDemo: req.isDemo || false } }
        };

        if (startDate && endDate) {
            where.assignedDate = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                address: {
                    include: { project: true }
                },
                assignedTeam: true
            },
            orderBy: { assignedDate: 'asc' }
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching scheduled appointments' });
    }
};

const xlsx = require('xlsx');
exports.exportScheduledAppointments = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let where = {
            status: 'CITADO',
            address: { project: { isDemo: req.isDemo || false } }
        };

        if (startDate && endDate) {
            where.assignedDate = {
                gte: new Date(startDate),
                lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        const appointments = await prisma.appointment.findMany({
            where,
            include: {
                address: { include: { project: true } },
                assignedTeam: true
            },
            orderBy: { assignedDate: 'asc' }
        });

        // Map data for Excel
        const data = appointments.map(app => ({
            'Fecha': new Date(app.assignedDate).toLocaleDateString('es-ES'),
            'Hora': new Date(app.assignedDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            'Proyecto': app.address.project.name,
            'Calle': app.address.street,
            'Número': app.address.number,
            'Localidad': app.address.city || '',
            'NVT': app.address.nvt || '',
            'Cliente': app.clientName || app.address.clientName || '',
            'Aptos': app.apartmentCount || '',
            'Equipo': app.assignedTeam ? app.assignedTeam.name : 'Sin asignar',
            'Estado': app.status,
            'Bauauftrag ID': app.address.bauauftragId || '',
            'KLS ID': app.address.klsId || ''
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Citas Agendadas');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename=citas_agendadas.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al exportar citas' });
    }
};

exports.exportAllByProject = async (req, res) => {
    try {
        const { projectId } = req.query;
        if (!projectId) {
            return res.status(400).json({ message: 'Se requiere el ID del proyecto' });
        }

        const addresses = await prisma.address.findMany({
            where: {
                projectId: projectId
            },
            include: {
                project: true,
                appointment: {
                    include: {
                        comments: true,
                        assignedTeam: true
                    }
                }
            },
            orderBy: { street: 'asc' }
        });

        // Map data for Excel
        const data = addresses.map(addr => {
            const app = addr.appointment;
            
            // Format comments
            let commentsText = '';
            if (app && app.comments && app.comments.length > 0) {
                commentsText = app.comments.map(c => 
                    `[${new Date(c.createdAt).toLocaleDateString('es-ES')}] ${c.authorName}: ${c.content}`
                ).join(' | ');
            }

            // Format history
            let historyText = '';
            if (app && app.contactHistory && app.contactHistory.length > 0) {
                historyText = app.contactHistory.join(' | ');
            }

            return {
                'Proyecto': addr.project.name,
                'Bauauftrag ID': addr.bauauftragId || '',
                'KLS ID': addr.klsId || '',
                'Calle': addr.street,
                'Número': addr.number,
                'Localidad': addr.city || '',
                'NVT': addr.nvt || '',
                'Cliente': addr.clientName || '',
                'Aptos': addr.apartmentCount || '',
                'Soplado': addr.sopladoStatus,
                'Protocolo': addr.protocolStatus,
                'Estado Orden': addr.orderStatus,
                'Estado Cita': app ? app.status : 'SIN CITA',
                'Fecha Cita': (app && app.assignedDate) ? new Date(app.assignedDate).toLocaleDateString('es-ES') : '',
                'Equipo': (app && app.assignedTeam) ? app.assignedTeam.name : '',
                'Comentarios': commentsText,
                'Historial Contacto': historyText
            };
        });

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        
        // Auto-size columns slightly
        const wscols = [
            {wch: 15}, // Proyecto
            {wch: 15}, // Bauauftrag
            {wch: 15}, // KLS
            {wch: 25}, // Calle
            {wch: 10}, // Num
            {wch: 15}, // Loc
            {wch: 10}, // NVT
            {wch: 25}, // Cliente
            {wch: 8},  // Aptos
            {wch: 10}, // Soplado
            {wch: 10}, // Protocolo
            {wch: 15}, // Estado Orden
            {wch: 15}, // Estado Cita
            {wch: 15}, // Fecha
            {wch: 15}, // Equipo
            {wch: 50}, // Comentarios
            {wch: 50}  // Historial
        ];
        ws['!cols'] = wscols;

        xlsx.utils.book_append_sheet(wb, ws, 'Gestión de Citas');

        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', `attachment; filename=gestion_citas_${projectId}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al exportar gestión de citas' });
    }
};
// Update appointment status (e.g., Protocol Terminado)
exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status, comments, attendedBy } = req.body;
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';

        const updateData = {
            status,
        };

        if (comments || attendedBy) {
            const commentContent = [
                attendedBy ? `Atendido por: ${attendedBy}` : '',
                comments ? `Comentarios: ${comments}` : ''
            ].filter(Boolean).join('. ');

            if (commentContent) {
                updateData.comments = {
                    create: { content: commentContent, authorName }
                };
            }
        }

        const appointment = await prisma.appointment.update({
            where: { id },
            data: updateData
        });

        res.json(appointment);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating appointment status' });
    }
};

// Recite appointment (Request reschedule or escalate)
exports.reciteAppointment = async (req, res) => {
    const { id } = req.params; // Can be Appointment ID or Address ID
    const { reason } = req.body;
    const userId = req.userId;
    const photosRaw = req.files || [];
    
    // 🟢 IMAGE COMPRESSION
    if (photosRaw.length > 0) {
        try {
            await processImages(photosRaw);
        } catch (procErr) {
            console.error("[Recite] Image processing failed, continuing anyway:", procErr);
        }
    }

    const photos = photosRaw.map(f => `/uploads/${f.filename}`);

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Unknown';

        // 🟢 SMART RESOLUTION: Find if ID is Address or Appointment
        let appointment = await prisma.appointment.findFirst({
            where: {
                OR: [
                    { id: id },
                    { addressId: id }
                ]
            }
        });

        // 🟢 AUTO-CREATE: If no appointment record exists yet, create it!
        // This solves the crash when "reciting" a pending address directly
        if (!appointment) {
            console.log(`[Recite] Creating new appointment record for address ${id}`);
            appointment = await prisma.appointment.create({
                data: {
                    addressId: id, // Assuming ID was addressId
                    status: 'PENDIENTE'
                }
            });
        }

        // 🟢 UPDATE: Mark as RECITE and add comment with photos
        const updatedAppointment = await prisma.appointment.update({
            where: { id: appointment.id },
            data: {
                status: 'RECITAR',
                comments: {
                    create: {
                        content: `[RECITAR/DERIVAR] Solicitud: ${reason}`,
                        authorName,
                        photos
                    }
                }
            }
        });

        // Create Notifications for Back Office and Super Admin
        const msg = `Solicitud de recita: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`;
        
        await prisma.notification.create({
            data: {
                type: 'RECITE_REQUEST',
                message: msg,
                addressId: updatedAppointment.addressId,
                createdById: userId,
                targetRole: 'BACK_OFFICE'
            }
        });

        await prisma.notification.create({
            data: {
                type: 'RECITE_REQUEST',
                message: `🚩 ${authorName} solicita recita: ${reason.substring(0, 50)}...`,
                addressId: updatedAppointment.addressId,
                createdById: userId,
                targetRole: 'SUPER_ADMIN'
            }
        });

        res.json(updatedAppointment);
    } catch (error) {
        console.error("[Recite Error]", error);
        res.status(500).json({ 
            message: 'Error al solicitar recita',
            details: error.message 
        });
    }
};

// Manually update Protocol Status (Backoffice override)
exports.updateProtocolStatus = async (req, res) => {
    const { addressId } = req.params;
    const { status } = req.body; // 'OK', 'PENDING', 'NONE'

    try {
        const address = await prisma.address.update({
            where: { id: addressId },
            data: { protocolStatus: status }
        });
        res.json(address);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating protocol status' });
    }
};
// Cancel/Delete appointment
exports.deleteAppointment = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.appointment.delete({ where: { id } });
        res.json({ message: 'Cita eliminada y dirección devuelta a pendientes.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando cita' });
    }
};

// Update order status (for Derivar / Cerrar)
exports.updateOrderStatus = async (req, res) => {
    const { id } = req.params; // addressId
    const { status, reason } = req.body;
    const userId = req.userId;

    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { username: true }
        });
        const authorName = user ? user.username : 'Back Office';

        await prisma.$transaction(async (tx) => {
            // 1. Update address status
            await tx.address.update({
                where: { id },
                data: { orderStatus: status }
            });

            // 2. If there's a reason, log it!
            if (reason) {
                const timestamp = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Berlin' });
                const historyEntry = `${timestamp}: [${status}] Motivo: ${reason}`;

                // Upsert appointment to ensure we have a place for the comment/history
                await tx.appointment.upsert({
                    where: { addressId: id },
                    update: {
                        contactHistory: { push: historyEntry },
                        comments: {
                            create: {
                                content: `[CAMBIO ESTADO: ${status}] ${reason}`,
                                authorName
                            }
                        }
                    },
                    create: {
                        addressId: id,
                        status: 'PENDIENTE',
                        contactHistory: [historyEntry],
                        comments: {
                            create: {
                                content: `[CAMBIO ESTADO: ${status}] ${reason}`,
                                authorName
                            }
                        }
                    }
                });
            }
        });

        // --- NEW NOTIFICATION FOR SUPER ADMIN (WRAPPED IN TRY-CATCH) ---
        try {
            const address = await prisma.address.findUnique({ where: { id }, include: { project: true } });
            const notificationMsg = `📢 Orden ${status} en ${address.street} ${address.number} (${address.project.name}) - Por: ${authorName}${reason ? ' - Motivo: ' + reason : ''}`;
            
            await prisma.notification.create({
                data: {
                    type: 'ORDER_STATUS_CHANGED',
                    message: notificationMsg,
                    addressId: id,
                    createdById: userId,
                    targetRole: 'SUPER_ADMIN'
                }
            });

            sendPushToRole('SUPER_ADMIN', {
                title: `📋 Orden ${status}`,
                body: notificationMsg,
                data: { addressId: id }
            }).catch(e => console.error('Push error:', e.message));
        } catch (notifErr) {
            console.error('Non-critical status notification error:', notifErr.message);
        }

        res.json({ success: true, message: `Estado actualizado a ${status}` });
    } catch (error) {
        console.error("[UpdateOrderStatus Error]", error);
        res.status(500).json({ message: 'Error updating order status', details: error.message });
    }
};

// Update a specific comment (used for fixing recite info from backoffice)
exports.updateComment = async (req, res) => {
    const { commentId } = req.params;
    const { content, photosToRemove } = req.body;
    const newPhotosRaw = req.files || [];

    try {
        const comment = await prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) return res.status(404).json({ message: 'Comentario no encontrado' });

        let currentPhotos = [...(comment.photos || [])];

        // 1. Remove photos
        if (photosToRemove) {
            const toRemove = Array.isArray(photosToRemove) ? photosToRemove : [photosToRemove];
            currentPhotos = currentPhotos.filter(p => !toRemove.includes(p));
        }

        // 2. Add new photos
        if (newPhotosRaw.length > 0) {
            await processImages(newPhotosRaw);
            const newPhotoPaths = newPhotosRaw.map(f => `/uploads/${f.filename}`);
            currentPhotos = [...currentPhotos, ...newPhotoPaths];
        }

        const updatedComment = await prisma.comment.update({
            where: { id: commentId },
            data: {
                content,
                photos: currentPhotos
            }
        });

        res.json(updatedComment);
    } catch (error) {
        console.error("[Update Comment Error]", error);
        res.status(500).json({ message: 'Error al actualizar el comentario' });
    }
};

// Update address master data (Back Office usage)
exports.updateAddressDetails = async (req, res) => {
    const { addressId } = req.params;
    const { clientName, street, number, nvt, klsId, bauauftragId } = req.body;

    try {
        const address = await prisma.address.update({
            where: { id: addressId },
            data: {
                clientName,
                street,
                number,
                nvt,
                klsId,
                bauauftragId
            }
        });
        res.json(address);
    } catch (error) {
        console.error("[Update Master Data Error]", error);
        res.status(500).json({ message: 'Error al actualizar los datos de la ficha' });
    }
};
