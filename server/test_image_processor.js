const fs = require('fs');
const path = require('path');
const { processImages } = require('./src/utils/imageProcessor');

async function run() {
    const srcFile = path.join(__dirname, 'test-large.jpg');
    const destFile = path.join(__dirname, 'test-copy.jpg');
    
    try {
        if (!fs.existsSync(srcFile)) {
            console.error("Source file test-large.jpg does not exist. Creating a dummy file.");
            // We can't easily create a real JPG dummy, but let's check.
            return;
        }
        
        fs.copyFileSync(srcFile, destFile);
        console.log("Copied test-large.jpg to test-copy.jpg");
        
        const files = [
            {
                fieldname: 'photos',
                originalname: 'test-large.jpg',
                path: destFile
            }
        ];
        
        console.log("Running processImages...");
        await processImages(files, "Test Technician");
        console.log("processImages completed successfully!");
        
        // Clean up
        if (fs.existsSync(destFile)) {
            fs.unlinkSync(destFile);
            console.log("Cleaned up test-copy.jpg");
        }
    } catch (e) {
        console.error("Error in test:", e);
    }
}

run();
