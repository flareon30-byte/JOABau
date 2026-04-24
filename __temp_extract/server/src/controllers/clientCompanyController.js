const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllClients = async (req, res) => {
  try {
    const clients = await prisma.clientCompany.findMany({
      include: { priceItems: true },
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

// PRICE ITEMS
exports.getClientPriceItems = async (req, res) => {
  try {
    const { id } = req.params;
    const items = await prisma.clientPriceItem.findMany({
      where: { clientCompanyId: id },
      orderBy: { name: 'asc' }
    });
    res.json(items);
  } catch (err) {
    console.error('Error fetching price items:', err);
    res.status(500).json({ message: 'Error fetching price items' });
  }
};

exports.addPriceItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, department, priceToClient, bonusToTeam, saturdayPay } = req.body;
    
    const newItem = await prisma.clientPriceItem.create({
      data: {
        clientCompanyId: id,
        name,
        department,
        priceToClient: parseFloat(priceToClient || 0),
        bonusToTeam: parseFloat(bonusToTeam || 0),
        saturdayPay: parseFloat(saturdayPay || 0)
      }
    });
    res.status(201).json(newItem);
  } catch (err) {
    console.error('Error creating price item:', err);
    res.status(500).json({ message: 'Error creating price item' });
  }
};

exports.updatePriceItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, department, priceToClient, bonusToTeam, saturdayPay } = req.body;
    
    const updated = await prisma.clientPriceItem.update({
      where: { id: itemId },
      data: {
        name,
        department,
        priceToClient: parseFloat(priceToClient || 0),
        bonusToTeam: parseFloat(bonusToTeam || 0),
        saturdayPay: parseFloat(saturdayPay || 0)
      }
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating price item:', err);
    res.status(500).json({ message: 'Error updating price item' });
  }
};

exports.deletePriceItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    await prisma.clientPriceItem.delete({ where: { id: itemId } });
    res.json({ message: 'Price item deleted successfully' });
  } catch (err) {
    console.error('Error deleting price item:', err);
    res.status(500).json({ message: 'Error deleting price item' });
  }
};
