const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 INICIANDO REINICIO TOTAL DE BASE DE DATOS Y ARCHIVOS...');
    
    try {
        // 1. Borrado de base de datos (ordenado por dependencias)
        console.log('🗑️  Borrando registros de la base de datos...');
        await prisma.simpleInstallationItem.deleteMany({});
        await prisma.simpleInstallation.deleteMany({});
        await prisma.activationInfo.deleteMany({});
        await prisma.sopladoInfo.deleteMany({});
        await prisma.fusionWork.deleteMany({});
        await prisma.tool.deleteMany({}); // Añadido borrado de herramientas si hubiera
        await prisma.appointmentComment.deleteMany({});
        await prisma.appointment.deleteMany({});
        await prisma.address.deleteMany({});
        await prisma.project.deleteMany({});
        await prisma.clientPriceItem.deleteMany({});
        await prisma.clientCompany.deleteMany({});
        await prisma.notification.deleteMany({}); // Limpiar notificaciones

        console.log('✅ Base de datos vaciada.');

        // 2. Limpieza de archivos físicos (uploads)
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
            console.log('🗑️  Borrando archivos físicos en /uploads...');
            
            const wipeDir = (dirPath) => {
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    const fullPath = path.join(dirPath, file);
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        wipeDir(fullPath);
                        try {
                            // Intentar borrar carpeta si está vacía
                            fs.rmdirSync(fullPath);
                        } catch (e) {}
                    } else {
                        // NO borrar el .gitkeep si lo hubiera (opcional)
                        fs.unlinkSync(fullPath);
                    }
                }
            };

            wipeDir(uploadsDir);
            
            // Asegurar que las subcarpetas necesarias existan para que no de error multer
            const subdirs = ['pdfs', 'temp'];
            subdirs.forEach(sd => {
                const p = path.join(uploadsDir, sd);
                if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
            });

            console.log('✅ Archivos físicos borrados.');
        }

        console.log('\n✨ REINICIO COMPLETADO CON ÉXITO.');
        console.log('El entorno está ahora como nuevo y listo para datos reales.');
        
    } catch (error) {
        console.error('❌ ERROR DURANTE EL REINICIO:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
