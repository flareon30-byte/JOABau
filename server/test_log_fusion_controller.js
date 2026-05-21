const fs = require('fs');
const path = require('path');
const { logFusionWork } = require('./src/controllers/fusionController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    // Ensure we have a valid project and user
    const user = await prisma.user.findFirst();
    const project = await prisma.project.findFirst();

    if (!user || !project) {
        console.error("User or Project not found in DB.");
        await prisma.$disconnect();
        return;
    }

    console.log("Using User ID:", user.id);
    console.log("Using Project ID:", project.id);

    // Setup dummy photo
    const srcFile = path.join(__dirname, 'test-large.jpg');
    const destDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const destFileName = 'photos-' + Date.now() + '.jpg';
    const destFile = path.join(destDir, destFileName);

    if (fs.existsSync(srcFile)) {
        fs.copyFileSync(srcFile, destFile);
        console.log("Copied dummy photo to:", destFile);
    } else {
        console.error("test-large.jpg not found!");
        await prisma.$disconnect();
        return;
    }

    // Mock Express Request
    const req = {
        body: {
            projectId: project.id,
            type: 'MUFFA',
            address: 'GPS: 40.41678, -3.70379',
            hours: '2.5',
            fusionCount: '8',
            isTray: 'false',
            description: 'Test Muffa from controller test'
        },
        files: [
            {
                fieldname: 'photos',
                originalname: 'foto_0.jpg',
                encoding: '7bit',
                mimetype: 'image/jpeg',
                destination: 'uploads/',
                filename: destFileName,
                path: 'uploads/' + destFileName, // Relative path as multer does
                size: fs.statSync(destFile).size
            }
        ],
        userId: user.id
    };

    // Mock Express Response
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            console.log(`RESPONSE STATUS: ${this.statusCode}`);
            console.log("RESPONSE JSON:", JSON.stringify(data, null, 2));
        }
    };

    console.log("Invoking logFusionWork controller...");
    try {
        await logFusionWork(req, res);
    } catch (err) {
        console.error("Controller threw unhandled exception:", err);
    }

    // Clean up
    if (fs.existsSync(destFile)) {
        try {
            fs.unlinkSync(destFile);
            console.log("Cleaned up dummy photo.");
        } catch (e) {
            console.error("Cleanup error:", e);
        }
    }

    await prisma.$disconnect();
}

run();
