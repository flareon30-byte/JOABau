const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

exports.getAllProjects = async (req, res) => {
    try {
        const projects = await prisma.project.findMany({
            include: {
                _count: {
                    select: { addresses: true }
                }
            }
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching projects' });
    }
};

exports.createProject = async (req, res) => {
    const { name } = req.body;
    try {
        const project = await prisma.project.create({
            data: { name }
        });
        res.status(201).json(project);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Project name already exists' });
        }
        res.status(500).json({ message: 'Error creating project' });
    }
};

exports.importProject = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { projectName } = req.body;
    const filePath = req.file.path;

    try {
        // 1. Create Project
        let project;
        try {
            project = await prisma.project.create({
                data: { name: projectName }
            });
        } catch (e) {
            if (e.code === 'P2002') {
                // If project exists, find it
                project = await prisma.project.findUnique({ where: { name: projectName } });
            } else {
                throw e;
            }
        }

        // 2. Parse Excel/CSV
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        // 3. Create Addresses
        if (data.length > 0) {
            console.log('Columns found in Excel:', Object.keys(data[0]));
        }

        // Helper to find column case-insensitive and trimmed
        const findCol = (row, possibleNames) => {
            const keys = Object.keys(row);
            for (const name of possibleNames) {
                // Try exact match first
                let foundKey = keys.find(k => k.trim().toLowerCase() === name.toLowerCase());
                if (foundKey) return row[foundKey];

                // Try partial match (e.g. "Calle (Principal)" matches "calle")
                foundKey = keys.find(k => k.trim().toLowerCase().includes(name.toLowerCase()));
                if (foundKey) return row[foundKey];
            }
            return null;
        };

        const addressesToCreate = data.map(row => {
            const nvt = findCol(row, ['NVT', 'nvt', 'KVz', 'kvz', 'Verteiler', 'verteiler', 'Caja', 'caja']);
            const street = findCol(row, ['CALLE', 'calle', 'Street', 'street', 'DIRECCION', 'direccion', 'STRASSE', 'strasse', 'Address', 'address', 'Anschrift', 'anschrift', 'Str.', 'str.', 'Straße', 'straße', 'Lage', 'lage', 'Weg', 'weg']) || 'Sin calle';
            const number = findCol(row, ['NUMERO', 'numero', 'Number', 'number', 'Hausnummer', 'hausnummer', 'No', 'no', 'Nr', 'nr', 'Nr.', 'nr.']);
            const clientName = findCol(row, ['NOMBRE', 'nombre', 'Name', 'name', 'Cliente', 'cliente', 'Client', 'client', 'Kunde', 'kunde']);
            const city = findCol(row, ['CIUDAD', 'ciudad', 'City', 'city', 'Ort', 'ort', 'Stadt', 'stadt', 'Town', 'town', 'Poblacion', 'poblacion']);
            const klsId = findCol(row, ['KLS', 'kls', 'KLS-ID', 'kls-id', 'KLS ID', 'kls id', 'KLS-Id', 'Kls-Id', 'P']); // Added 'P' just in case of simple column mapping, mostly implies header 'P' which is unlikely but safe.

            return {
                projectId: project.id,
                nvt: nvt ? String(nvt).trim() : null,
                street: String(street).trim(),
                number: number ? String(number).trim() : null,
                clientName: clientName ? String(clientName).trim() : null,
                city: city ? String(city).trim() : null,
                klsId: klsId ? String(klsId).trim() : null
            };
        });

        // 3. Create or Update Addresses
        let createdCount = 0;
        let updatedCount = 0;

        for (const addrData of addressesToCreate) {
            const whereClause = {
                projectId: project.id,
                street: addrData.street,
                number: addrData.number
            };

            const existing = await prisma.address.findFirst({
                where: whereClause
            });

            if (existing) {
                await prisma.address.update({
                    where: { id: existing.id },
                    data: {
                        klsId: addrData.klsId || existing.klsId,
                        city: addrData.city || existing.city,
                        clientName: addrData.clientName || existing.clientName,
                        nvt: addrData.nvt || existing.nvt
                    }
                });
                updatedCount++;
            } else {
                await prisma.address.create({ data: addrData });
                createdCount++;
            }
        }

        res.json({ message: `Import successful. Created: ${createdCount}, Updated: ${updatedCount} addresses.` });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error processing import' });
    } finally {
        // Cleanup file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
};

exports.deleteProject = async (req, res) => {
    const { id } = req.params;
    try {
        // Delete addresses first (cascade usually handles this but good to be explicit or rely on schema)
        // Prisma schema didn't specify onDelete: Cascade, so we might need to delete manually or update schema.
        // For now, let's assume we delete addresses first.
        // Find all addresses for this project
        const addresses = await prisma.address.findMany({
            where: { projectId: id },
            select: { id: true }
        });
        const addressIds = addresses.map(a => a.id);

        if (addressIds.length > 0) {
            // Delete related records
            await prisma.activationInfo.deleteMany({ where: { addressId: { in: addressIds } } });
            await prisma.sopladoInfo.deleteMany({ where: { addressId: { in: addressIds } } });
            await prisma.fusionInfo.deleteMany({ where: { addressId: { in: addressIds } } });

            // For appointments, we might need to delete comments first if they exist
            // But let's assume simple deletion for now or that comments cascade if configured. 
            // Actually, Appointment has Comments. Let's check schema.
            // Schema: Appointment has `comments Comment[]`. Prisma usually requires manual deletion if not cascade.
            // Let's find appointments to get their IDs for comment deletion.
            const appointments = await prisma.appointment.findMany({
                where: { addressId: { in: addressIds } },
                select: { id: true }
            });
            const appointmentIds = appointments.map(a => a.id);

            if (appointmentIds.length > 0) {
                await prisma.comment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
                await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
            }

            // Finally delete addresses
            await prisma.address.deleteMany({ where: { projectId: id } });
        }
        await prisma.project.delete({ where: { id } });
        res.json({ message: 'Project deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting project' });
    }
};
