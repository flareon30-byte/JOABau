const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.clientCompany.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ message: 'Error fetching clients' });
  }
};

exports.createClient = async (req, res) => {
  try {
    const { name, isActive, settings } = req.body;
    const newClient = await prisma.clientCompany.create({
      data: {
        name,
        isActive: isActive !== undefined ? isActive : true,
        settings: settings || {}
      }
    });
    res.status(201).json(newClient);
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ message: 'Error creating client' });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive, settings } = req.body;
    
    const updatedClient = await prisma.clientCompany.update({
      where: { id },
      data: {
        name,
        isActive,
        settings
      }
    });
    res.json(updatedClient);
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ message: 'Error updating client' });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.clientCompany.delete({ where: { id } });
    res.json({ message: 'Client company deleted successfully' });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ message: 'Error deleting client' });
  }
};
