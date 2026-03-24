const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 INICIANDO REINICIO DE BASE DE DATOS...');
    
    try {
        // El orden es importante por las claves foráneas
        console.log('🗑️  Borrando items de instalación simple...');
        await prisma.simpleInstallationItem.deleteMany({});
        
        console.log('🗑️  Borrando fiches de instalación simple...');
        await prisma.simpleInstallation.deleteMany({});
        
        console.log('🗑️  Borrando información de activaciones...');
        await prisma.activationInfo.deleteMany({});
        
        console.log('🗑️  Borrando información de soplado...');
        await prisma.sopladoInfo.deleteMany({});
        
        console.log('🗑️  Borrando trabajos de fusión...');
        await prisma.fusionWork.deleteMany({});
        
        console.log('🗑️  Borrando comentarios de citas...');
        await prisma.appointmentComment.deleteMany({});
        
        console.log('🗑️  Borrando citas...');
        await prisma.appointment.deleteMany({});
        
        console.log('🗑️  Borrando direcciones...');
        await prisma.address.deleteMany({});
        
        console.log('🗑️  Borrando proyectos...');
        await prisma.project.deleteMany({});
        
        console.log('🗑️  Borrando catálogos de precios clientes...');
        await prisma.clientPriceItem.deleteMany({});
        
        console.log('🗑️  Borrando empresas clientes...');
        await prisma.clientCompany.deleteMany({});

        // Opcional: Limpiar pedidos de materiales si existen
        // await prisma.materialOrder.deleteMany({});

        console.log('✅ REINICIO COMPLETADO CON ÉXITO.');
        console.log('Ahora puedes empezar a configurar tus clientes reales.');
    } catch (error) {
        console.error('❌ ERROR DURANTE EL REINICIO:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
