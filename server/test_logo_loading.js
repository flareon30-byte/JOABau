const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function run() {
    try {
        const DEFAULT_LOGO = path.join(__dirname, 'src', 'utils', 'logo.png');
        console.log("DEFAULT_LOGO Path:", DEFAULT_LOGO);
        console.log("Exists?:", fs.existsSync(DEFAULT_LOGO));
        if (fs.existsSync(DEFAULT_LOGO)) {
            const logoBuffer = await sharp(DEFAULT_LOGO).resize({ width: 150 }).toBuffer();
            console.log("Default logo loaded successfully! Buffer size:", logoBuffer.length);
        }
    } catch (e) {
        console.error("Error loading default logo:", e);
    }
}
run();
