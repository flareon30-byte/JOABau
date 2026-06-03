const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');
const fs = require('fs');

const prisma = new PrismaClient();

exports.getAllProjects = async (req, res) => {
    try {
        const isDemo = req.isDemo || false;
        const projects = await prisma.project.findMany({
            where: { isDemo },
            include: {
                clientCompany: true, // Include client to show in cards
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
    const { name, clientCompanyId, pricePerAcometida, pricePerMeter } = req.body;
    try {
        const project = await prisma.project.create({
            data: {
                name,
                clientCompanyId: clientCompanyId || null,
                pricePerAcometida: pricePerAcometida ? parseFloat(pricePerAcometida) : 0.0,
                pricePerMeter: pricePerMeter ? parseFloat(pricePerMeter) : 0.0,
                isDemo: req.isDemo || false
            }
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

    const { projectName, importType, clientCompanyId } = req.body; // importType: 'standard' | 'protocol'
    const filePath = req.file.path;

    try {
        // 1. Create Project
        let project;
        try {
            project = await prisma.project.create({
                data: { 
                    name: projectName,
                    clientCompanyId: clientCompanyId || null
                 }
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

        let addressesToProcess = data.map(row => {
            const nvt = findCol(row, ['NVT', 'nvt', 'KVz', 'kvz', 'Verteiler', 'verteiler', 'Caja', 'caja']);
            const street = findCol(row, ['CALLE', 'calle', 'Street', 'street', 'DIRECCION', 'direccion', 'STRASSE', 'strasse', 'Address', 'address', 'Anschrift', 'anschrift', 'Str.', 'str.', 'Straße', 'straße', 'Lage', 'lage', 'Weg', 'weg']) || 'Sin calle';
            let number = findCol(row, ['NUMERO', 'numero', 'Number', 'number', 'Hausnummer', 'hausnummer', 'No', 'no', 'Nr', 'nr', 'Nr.', 'nr.']);
            const numberSuffix = findCol(row, ['Hausnummer Zusatz', 'Zusatz', 'hausnummer zusatz', 'zusatz', 'Suffix', 'suffix']);

            if (number && numberSuffix) {
                number = `${number} ${numberSuffix}`;
            }

            const clientName = findCol(row, ['NOMBRE', 'nombre', 'Name', 'name', 'Cliente', 'cliente', 'Client', 'client', 'Kunde', 'kunde']);
            const city = findCol(row, ['CIUDAD', 'ciudad', 'City', 'city', 'Ort', 'ort', 'Stadt', 'stadt', 'Town', 'town', 'Poblacion', 'poblacion']);
            const klsId = findCol(row, ['KLS', 'kls', 'KLS-ID', 'kls-id', 'KLS ID', 'kvz id', 'KLS-Id', 'Kls-Id', 'P']);
            const bauauftragId = findCol(row, ['Bauauftrag-ID', 'bauauftrag-id', 'Bauauftrag', 'bauauftrag', 'Bauauftrag ID', 'Bauauftrag Id']);
            const status = findCol(row, ['Status', 'status', 'Estado', 'estado']); // Column C logic
            const customerCol = findCol(row, ['Customer', 'customer']);
            let apartmentCount = null;
            if (customerCol) {
                const parsed = parseInt(customerCol);
                if (!isNaN(parsed)) {
                    apartmentCount = parsed;
                }
            }

            return {
                projectId: project.id,
                nvt: nvt ? String(nvt).trim() : null,
                street: street ? String(street).trim() : null,
                number: number ? String(number).trim() : null,
                clientName: clientName ? String(clientName).trim() : null,
                city: city ? String(city).trim() : null,
                klsId: klsId ? String(klsId).trim() : null,
                bauauftragId: bauauftragId ? String(bauauftragId).trim() : null,
                status: status ? String(status).trim() : 'geplant',
                apartmentCount: apartmentCount
            };
        }).filter(addr => {
            if (!addr.street || addr.street === 'Sin calle') return false;
            
            const s = (addr.status || '').toLowerCase();
            // Importamos pendientes y también instaladas (Installiert / instalada)
            return s.includes('installation') || s.includes('geplant') || s.includes('installiert') || s.includes('instalad');
        });

        // Group / Collate duplicate addresses by physical portal for Civil Works
        const seenAddresses = new Set();
        addressesToProcess = addressesToProcess.filter(addr => {
            const key = `${addr.street.trim().toLowerCase()}|${(addr.number || '').trim().toLowerCase()}|${(addr.city || '').trim().toLowerCase()}`;
            if (seenAddresses.has(key)) {
                return false;
            }
            seenAddresses.add(key);
            return true;
        });

        const excelRowCount = addressesToProcess.length;
        const isProtocol = importType === 'protocol';
        let createdCount = 0;
        let updatedCount = 0;

        // Auto-calculate apartment counts based on unique Bauauftrag IDs per building
        const buildingCounts = {};
        for (const addr of addressesToProcess) {
            if (addr.street && addr.number && addr.bauauftragId) {
                const key = `${addr.street.trim().toLowerCase()}|${addr.number.trim().toLowerCase()}`;
                if (!buildingCounts[key]) buildingCounts[key] = new Set();
                buildingCounts[key].add(addr.bauauftragId.trim().toLowerCase());
            }
        }

        // Apply calculated counts if no numeric value was supplied in the 'Customer' column
        for (let i = 0; i < addressesToProcess.length; i++) {
            const addr = addressesToProcess[i];
            if (addr.street && addr.number && !addr.apartmentCount) {
                const key = `${addr.street.trim().toLowerCase()}|${addr.number.trim().toLowerCase()}`;
                const count = buildingCounts[key] ? buildingCounts[key].size : 0;
                if (count > 0) { // If there are valid unique IDs, use that size as apartment count
                    addr.apartmentCount = count;
                }
            }
        }

        for (const addrData of addressesToProcess) {
            // Find existing prioritising Bauauftrag ID (which is the new stable unique key)
            let existing = null;
            if (addrData.bauauftragId) {
                existing = await prisma.address.findFirst({
                    where: {
                        projectId: project.id,
                        bauauftragId: { equals: addrData.bauauftragId, mode: 'insensitive' }
                    }
                });
            }

            // Fallback backward compat to KLS only if the existing record doesn't belong to a different Bauauftrag
            if (!existing && addrData.klsId) {
                existing = await prisma.address.findFirst({
                    where: {
                        projectId: project.id,
                        klsId: { equals: addrData.klsId, mode: 'insensitive' },
                        bauauftragId: null
                    }
                });
            }

            // Fallback to address matching ONLY IF the DB record doesn't belong to another specific client
            if (!existing) {
                // Try to match by Name + Address first (very strong signal for multiple clients at same building)
                if (addrData.clientName) {
                    existing = await prisma.address.findFirst({
                        where: {
                            projectId: project.id,
                            street: { equals: addrData.street, mode: 'insensitive' },
                            number: { equals: (addrData.number || ''), mode: 'insensitive' },
                            clientName: { equals: addrData.clientName, mode: 'insensitive' }
                        }
                    });
                }

                // If not found by name, try to find a legacy record at this address that has NO IDs yet
                // (This allows us to attach the new Bauauftrag-ID to an old generic record safely)
                if (!existing) {
                    existing = await prisma.address.findFirst({
                        where: {
                            projectId: project.id,
                            street: { equals: addrData.street, mode: 'insensitive' },
                            number: { equals: (addrData.number || ''), mode: 'insensitive' },
                            bauauftragId: null,
                            klsId: null
                        }
                    });
                }
            }

            if (existing) {
                const statusFromExcel = addrData.status || 'geplant';
                const isInstalliert = (statusFromExcel || '').toLowerCase().includes('installiert') || (statusFromExcel || '').toLowerCase().includes('instalad');
                
                // CRITICAL PROTECTION: Do NOT revert addresses that are already in "Archivo" (DERIVADA, CERRADA, etc.)
                // Only update status if the current DB status is 'geplant' or 'RECITAR' (pending states)
                const isAlreadyArchived = ['DERIVADA', 'CERRADA'].includes(existing.orderStatus);
                
                const updateData = {
                    city: addrData.city || existing.city,
                    nvt: addrData.nvt || existing.nvt,
                    // Only update clientName if it's null in DB, to avoid overwriting user edits
                    clientName: existing.clientName || addrData.clientName,
                    apartmentCount: existing.apartmentCount || addrData.apartmentCount, // Keep existing if set, else update from excel
                    bauauftragId: addrData.bauauftragId || existing.bauauftragId
                };

                // Update status ONLY if not archived. We respect the girl's work in Back Office.
                if (!isAlreadyArchived) {
                    updateData.orderStatus = statusFromExcel;
                }

                // If importing protocol list, we enforce protocol flag
                if (isProtocol) {
                    updateData.requiresProtocol = true;
                }

                // If status is "Installiert", automatically mark civilWorkStatus as "HECHO"
                if (isInstalliert) {
                    updateData.civilWorkStatus = 'HECHO';
                }

                await prisma.address.update({
                    where: { id: existing.id },
                    data: updateData
                });
                updatedCount++;
            } else {
                const isInstalliert = (addrData.status || '').toLowerCase().includes('installiert') || (addrData.status || '').toLowerCase().includes('instalad');
                await prisma.address.create({
                    data: {
                        projectId: project.id,
                        street: addrData.street,
                        number: addrData.number,
                        city: addrData.city,
                        clientName: addrData.clientName,
                        klsId: addrData.klsId,
                        bauauftragId: addrData.bauauftragId,
                        nvt: addrData.nvt,
                        orderStatus: addrData.status, // Load status from excel
                        requiresProtocol: isProtocol, // Set flag if this is a protocol import
                        apartmentCount: addrData.apartmentCount,
                        civilWorkStatus: isInstalliert ? 'HECHO' : 'SIN_TUBO'
                    }
                });
                createdCount++;
            }
        }

        // --- NEW LOGIC: Delete addresses no longer in the Excel unless we worked on them ---
        const existingAddresses = await prisma.address.findMany({
            where: { projectId: project.id },
            include: {
                activationInfo: true,
                sopladoInfo: true,
                fusionInfo: true
            }
        });

        let deletedCount = 0;
        let keptWithWorkCount = 0;
        let missingInExcelCount = 0;

        for (const dbAddr of existingAddresses) {
            // Robust matching using Bauauftrag prioritisation then KLS
            const isInNewFile = addressesToProcess.some(newData => {
                if (newData.bauauftragId && dbAddr.bauauftragId) {
                    return newData.bauauftragId.trim().toLowerCase() === dbAddr.bauauftragId.trim().toLowerCase();
                }
                if (newData.klsId && dbAddr.klsId) {
                    return newData.klsId.trim().toLowerCase() === dbAddr.klsId.trim().toLowerCase();
                }
                return newData.street.trim().toLowerCase() === dbAddr.street.trim().toLowerCase() &&
                       (newData.number || '').trim().toLowerCase() === (dbAddr.number || '').trim().toLowerCase();
            });

            if (!isInNewFile) {
                missingInExcelCount++;
                // Did we do any work on it? (Activation, Soplado, or if it is ARCHIVED manually)
                const isArchivedManually = ['DERIVADA', 'CERRADA'].includes(dbAddr.orderStatus);
                const hasWork = dbAddr.activationInfo || dbAddr.sopladoInfo || dbAddr.fusionInfo || isArchivedManually;
                
                if (hasWork) {
                    // It has work or was deliberately archived; keep it to preserve billing/history
                    keptWithWorkCount++;
                } else {
                    // No work was done by us, it's just a pending entry that disappeared from the Excel. Delete it.
                    const appointments = await prisma.appointment.findMany({
                        where: { addressId: dbAddr.id },
                        select: { id: true }
                    });
                    const appointmentIds = appointments.map(a => a.id);

                    if (appointmentIds.length > 0) {
                        await prisma.comment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
                        await prisma.appointment.deleteMany({ where: { id: { in: appointmentIds } } });
                    }
                    
                    await prisma.address.delete({ where: { id: dbAddr.id } });
                    deletedCount++;
                }
            }
        }

        // --- POST-PROCESSING: Propagate Soplado Status to Sibling Addresses ---
        // 1. Fetch all addresses with a completed/failed soplado status in the project
        const blownAddresses = await prisma.address.findMany({
            where: {
                projectId: project.id,
                sopladoStatus: { in: ['OK', 'FALLIDO'] }
            },
            include: {
                sopladoInfo: true
            }
        });

        // 2. Group them by building key (street + number)
        const buildingSopladoMap = new Map();
        for (const addr of blownAddresses) {
            if (!addr.street) continue;
            const key = `${addr.street.trim().toLowerCase()}|${(addr.number || '').trim().toLowerCase()}`;
            const existingMatch = buildingSopladoMap.get(key);
            // We prefer OK over FALLIDO, and we need sopladoInfo to copy from
            if (addr.sopladoInfo) {
                if (!existingMatch || (existingMatch.sopladoStatus === 'FALLIDO' && addr.sopladoStatus === 'OK')) {
                    buildingSopladoMap.set(key, {
                        sopladoStatus: addr.sopladoStatus,
                        sopladoInfo: addr.sopladoInfo
                    });
                }
            }
        }

        // 3. Fetch all addresses in the project to check for propagation
        const allAddresses = await prisma.address.findMany({
            where: { projectId: project.id },
            include: { sopladoInfo: true }
        });

        // 4. Update sibling addresses that don't match the building's soplado status/info
        for (const addr of allAddresses) {
            if (!addr.street) continue;
            const key = `${addr.street.trim().toLowerCase()}|${(addr.number || '').trim().toLowerCase()}`;
            const info = buildingSopladoMap.get(key);
            
            if (info) {
                // If status doesn't match, or if it doesn't have sopladoInfo, we propagate
                const statusMismatch = addr.sopladoStatus !== info.sopladoStatus;
                const infoMissing = !addr.sopladoInfo;
                
                if (statusMismatch || infoMissing) {
                    // Update address status
                    await prisma.address.update({
                        where: { id: addr.id },
                        data: { sopladoStatus: info.sopladoStatus }
                    });

                    // Prepare SopladoInfo details to copy
                    const sopladoInfoData = {
                        meters: info.sopladoInfo.meters,
                        tk: info.sopladoInfo.tk,
                        tubeColor: info.sopladoInfo.tubeColor,
                        teamId: info.sopladoInfo.teamId,
                        isSaturday: info.sopladoInfo.isSaturday,
                        failureReason: info.sopladoInfo.failureReason,
                        photos: info.sopladoInfo.photos,
                        saturdayPay: info.sopladoInfo.saturdayPay,
                        performerIds: info.sopladoInfo.performerIds
                    };

                    // Upsert SopladoInfo for this address
                    await prisma.sopladoInfo.upsert({
                        where: { addressId: addr.id },
                        update: sopladoInfoData,
                        create: {
                            addressId: addr.id,
                            ...sopladoInfoData
                        }
                    });
                }
            }
        }

        res.json({ 
            message: `Importación finalizada (${isProtocol ? 'Protocolo' : 'Estándar'}).\n` +
                     `- Filas válidas detectadas en Excel: ${excelRowCount}\n` +
                     `- Creadas nuevas: ${createdCount}\n` +
                     `- Actualizadas: ${updatedCount}\n` +
                     `- Eliminadas (sin trabajo): ${deletedCount}\n` +
                     `- Conservadas (con nuestro trabajo): ${keptWithWorkCount}\n` +
                     `- Direcciones de la App que NO estaban en el Excel: ${missingInExcelCount}`
        });

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

exports.updateProject = async (req, res) => {
    const { id } = req.params;
    const { name, clientCompanyId, pricePerAcometida, pricePerMeter } = req.body;
    try {
        const updated = await prisma.project.update({
            where: { id },
            data: {
                name,
                clientCompanyId: clientCompanyId || null,
                pricePerAcometida: pricePerAcometida !== undefined ? parseFloat(pricePerAcometida) : undefined,
                pricePerMeter: pricePerMeter !== undefined ? parseFloat(pricePerMeter) : undefined
            }
        });
        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating project' });
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

exports.getProjectMapData = async (req, res) => {
    const { id } = req.params;
    try {
        const addresses = await prisma.address.findMany({
            where: { projectId: id },
            include: {
                sopladoInfo: true,
                appointment: true,
                activationInfo: true,
                simpleInstallation: true
            }
        });
        res.json(addresses);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching map data' });
    }
};

