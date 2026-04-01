const prisma = require('../prisma');
const XLSX = require('xlsx');

// --- READ / EXPORT LOGIC (Moved from exportController/activationRoutes ideally, or just kept here) ---
// I will keep the existing GET logic in exportController/activationController for now to avoid breaking changes 
// unless I migrate them. For simplicity, I will implement the DELETE logic here.

exports.deleteSoplado = async (req, res) => {
    const { id } = req.params; // SopladoInfo ID
    try {
        const info = await prisma.sopladoInfo.findUnique({
            where: { id },
            include: { address: true }
        });

        if (!info) return res.status(404).json({ message: 'Registro no encontrado' });

        await prisma.$transaction([
            // 1. Reset Address Status
            prisma.address.update({
                where: { id: info.addressId },
                data: { sopladoStatus: null }
            }),
            // 2. Delete Info
            prisma.sopladoInfo.delete({ where: { id } })
        ]);

        res.json({ message: 'Trabajo de soplado eliminado y estado revertido.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando soplado' });
    }
};

exports.deleteFusion = async (req, res) => {
    const { id } = req.params; // FusionWork ID
    try {
        await prisma.fusionWork.delete({ where: { id } });
        res.json({ message: 'Trabajo de fusión eliminado.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando fusión' });
    }
};

exports.deleteActivation = async (req, res) => {
    const { id } = req.params; // ActivationInfo ID
    try {
        const info = await prisma.activationInfo.findUnique({
            where: { id },
            include: { address: true }
        });

        if (!info) return res.status(404).json({ message: 'Registro no encontrado' });

        await prisma.$transaction([
            // 1. Reset Address Status
            prisma.address.update({
                where: { id: info.addressId },
                data: { orderStatus: 'geplant' } // Revert to default
            }),
            // 2. Reset Appointment Status
            prisma.appointment.update({
                where: { addressId: info.addressId },
                data: { status: 'CITADO' } // Assuming it goes back to scheduled
            }),
            // 3. Delete Info
            prisma.activationInfo.delete({ where: { id } })
        ]);

        res.json({ message: 'Activación eliminada y estado revertido.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando activación' });
    }
};

exports.deleteProtocol = async (req, res) => {
    const { id } = req.params; // Appointment ID (since protocol work IS the appointment)
    try {
        // We don't delete the appointment, we just reset its status
        await prisma.appointment.update({
            where: { id },
            data: { status: 'CITADO', reciteReason: null } // Revert to scheduled
        });

        res.json({ message: 'Protocolo revertido a estado pendiente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error revirtiendo protocolo' });
    }
};

exports.deleteRepair = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.simpleInstallation.delete({ where: { id } });
        res.json({ message: 'Reparación eliminada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando reparación' });
    }
};

exports.deleteSimpleInstallation = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.simpleInstallation.delete({ where: { id } });
        res.json({ message: 'Instalación G&K eliminada.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error eliminando instalación' });
    }
};
