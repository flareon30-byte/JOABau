const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 INICIANDO REINICIO TOTAL SEGURO...');
    
    // Lista de modelos a borrar en orden de dependencia (hijos primero)
    const models = [
        'simpleInstallationItem',
        'simpleInstallation',
        'activationInfo',
        'sopladoInfo',
        'fusionWork',
        'tool',
        'appointmentComment',
        'appointment',
        'address',
        'project',
        'clientPriceItem',
        'clientCompany',
        'notification'
    ];

    try {
        console.log('🗑️  Borrando registros de la base de datos...');
        
        for (const model of models) {
            if (prisma[model]) {
                console.log(`   - Borrando ${model}...`);
                await prisma[model].deleteMany({});
            } else {
                console.log(`   - Saltando ${model} (No existe en el cliente de Prisma actual)`);
            }
        }

        console.log('✅ Base de datos vaciada.');

        // 2. Limpieza de archivos físicos (uploads)
        const uploadsDir = path.join(__dirname, 'uploads');
        if (fs.existsSync(uploadsDir)) {
            console.log('🗑️  Borrando archivos físicos en /uploads...');
            
            const wipeDir = (dirPath) => {
                if (!fs.existsSync(dirPath)) return;
                const files = fs.readdirSync(dirPath);
                for (const file of files) {
                    const fullPath = path.join(dirPath, file);
                    if (fs.lstatSync(fullPath).isDirectory()) {
                        wipeDir(fullPath);
                        try {
                            fs.rmdirSync(fullPath);
                        } catch (e) {}
                    } else {
                        fs.unlinkSync(fullPath);
                    }
                }
            };

            wipeDir(uploadsDir);
            
            // Recrear estructura mínima necesaria
            ['pdfs', 'temp'].forEach(sd => {
                const p = path.join(uploadsDir, sd);
                if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
            });

            console.log('✅ Archivos físicos borrados.');
        }

        console.log('\n✨ REINICIO COMPLETADO CON ÉXITO.');
        
    } catch (error) {
        console.error('❌ ERROR DURANTE EL REINICIO:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
