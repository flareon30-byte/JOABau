const prisma = require('../prisma');

// Get Tools for a Team
exports.getTeamTools = async (req, res) => {
    const { teamId } = req.params;
    try {
        const tools = await prisma.tool.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tools);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching tools' });
    }
};

// Add Tool
exports.addTool = async (req, res) => {
    const { teamId } = req.params;
    const { name, serialNumber, status } = req.body;
    const files = req.files; // Photos

    try {
        // Validation?
        if (!name || !serialNumber) {
            return res.status(400).json({ message: 'Name and Serial Number are required' });
        }

        const photoPaths = files ? files.map(f => f.path) : [];

        const tool = await prisma.tool.create({
            data: {
                teamId,
                name,
                serialNumber,
                status: status || 'ACTIVE',
                photos: photoPaths
            }
        });

        res.status(201).json(tool);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error adding tool' });
    }
};

// Update Tool
exports.updateTool = async (req, res) => {
    const { id } = req.params;
    const { name, serialNumber, status } = req.body;

    try {
        const tool = await prisma.tool.update({
            where: { id },
            data: {
                name,
                serialNumber,
                status
            }
        });
        res.json(tool);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating tool' });
    }
};

// Delete Tool
exports.deleteTool = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.tool.delete({ where: { id } });
        res.json({ message: 'Tool deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error deleting tool' });
    }
};
