const prisma = require('../prisma');

exports.getAllVehicles = async (req, res) => {
    try {
        const vehicles = await prisma.vehicle.findMany({
            where: { isDemo: req.isDemo || false },
            include: { team: true, logs: { take: 5, orderBy: { createdAt: 'desc' } } }
        });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vehicles' });
    }
};

exports.createVehicle = async (req, res) => {
    const { make, model, plate, initialKms, annualKmLimit } = req.body;
    try {
        const vehicle = await prisma.vehicle.create({
            data: {
                make,
                model,
                plate,
                initialKms: parseFloat(initialKms) || 0,
                currentKms: parseFloat(initialKms) || 0,
                annualKmLimit: parseFloat(annualKmLimit) || 10000,
                isDemo: req.isDemo || false
            }
        });
        res.status(201).json(vehicle);
    } catch (error) {
        res.status(500).json({ message: 'Error creating vehicle' });
    }
};

exports.updateVehicle = async (req, res) => {
    const { id } = req.params;
    const { make, model, plate, initialKms, annualKmLimit, currentKms } = req.body;
    try {
        const vehicle = await prisma.vehicle.update({
            where: { id },
            data: {
                make,
                model,
                plate,
                initialKms: initialKms !== undefined ? parseFloat(initialKms) : undefined,
                currentKms: currentKms !== undefined ? parseFloat(currentKms) : undefined,
                annualKmLimit: annualKmLimit !== undefined ? parseFloat(annualKmLimit) : undefined
            }
        });
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ message: 'Error updating vehicle' });
    }
};

exports.deleteVehicle = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.vehicle.delete({ where: { id } });
        res.json({ message: 'Vehicle deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting vehicle' });
    }
};

// Logs for Technicians
exports.addVehicleLog = async (req, res) => {
    const { vehicleId, type, kms, amount, liters, photos } = req.body;
    const userId = req.userId;

    try {
        // Calculate fuel/km details
        const log = await prisma.vehicleLog.create({
            data: {
                vehicleId,
                type,
                kms: kms ? parseFloat(kms) : null,
                amount: amount ? parseFloat(amount) : null,
                liters: liters ? parseFloat(liters) : null,
                photos: photos || [],
                createdById: userId
            }
        });

        // Update Vehicle current mileage if provided
        if (kms) {
            await prisma.vehicle.update({
                where: { id: vehicleId },
                data: { currentKms: parseFloat(kms) }
            });
        }

        res.status(201).json({ message: 'Log registered', log });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error registering vehicle log' });
    }
};

exports.getVehicleStats = async (req, res) => {
    const { id } = req.params;
    try {
        const vehicle = await prisma.vehicle.findUnique({
            where: { id },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

        // Simple Analytics
        const totalFuelCost = vehicle.logs
            .filter(l => l.type === 'FUEL')
            .reduce((sum, l) => sum + (l.amount || 0), 0);

        const kmsDriven = vehicle.currentKms - vehicle.initialKms;
        const progressToLimit = (kmsDriven / (vehicle.annualKmLimit || 10000)) * 100;

        res.json({
            vehicle,
            stats: {
                totalFuelCost,
                kmsDriven,
                progressToLimit,
                isNearLimit: progressToLimit > 90
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.deleteVehicleLog = async (req, res) => {
    const { id } = req.params;
    try {
        const logToDelete = await prisma.vehicleLog.findUnique({ where: { id } });
        if (!logToDelete) return res.status(404).json({ message: 'Log not found' });

        const vehicleId = logToDelete.vehicleId;

        // 1. Delete the log
        await prisma.vehicleLog.delete({ where: { id } });

        // 2. Recalculate Vehicle currentKms (get the most recent remaining log with Kms)
        const lastValidLog = await prisma.vehicleLog.findFirst({
            where: { 
                vehicleId,
                kms: { not: null }
            },
            orderBy: { createdAt: 'desc' }
        });

        const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
        const newCurrentKms = lastValidLog ? lastValidLog.kms : vehicle.initialKms;

        await prisma.vehicle.update({
            where: { id: vehicleId },
            data: { currentKms: newCurrentKms }
        });

        res.json({ success: true, message: 'Log deleted and vehicle kms updated', newCurrentKms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting vehicle log' });
    }
};
