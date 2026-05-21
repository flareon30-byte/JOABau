const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function run() {
    try {
        console.log("Generating a dummy 500x500 jpeg image...");
        const dummyJpg = path.join(__dirname, 'dummy.jpg');
        await sharp({
            create: {
                width: 1000,
                height: 1000,
                channels: 3,
                background: { r: 255, g: 0, b: 0 }
            }
        })
        .jpeg()
        .toFile(dummyJpg);
        console.log("Dummy image generated successfully.");

        console.log("Loading logo...");
        const DEFAULT_LOGO = path.join(__dirname, 'src', 'utils', 'logo.png');
        const logoBuffer = await sharp(DEFAULT_LOGO).resize({ width: 150 }).toBuffer();
        console.log("Logo loaded successfully.");

        const logoBase64 = logoBuffer.toString('base64');
        const today = '21/05/2026';
        const technicianName = "TECNICO JOA";

        console.log("Creating combined text + logo SVG...");
        const combinedSvg = `
            <svg width="500" height="250">
                <style>
                    .name { fill: white; font-size: 24px; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 900; letter-spacing: 1px; }
                    .date { fill: rgba(255,255,255,0.8); font-size: 16px; font-family: Arial, sans-serif; font-weight: 600; }
                    .shadow { filter: drop-shadow(3px 3px 3px rgba(0,0,0,0.9)); }
                </style>
                <g class="shadow">
                    <image href="data:image/png;base64,${logoBase64}" x="325" y="20" width="150" height="75" />
                    <text x="475" y="115" class="name" text-anchor="end">${technicianName.toUpperCase()}</text>
                    <text x="475" y="145" class="date" text-anchor="end">${today}</text>
                </g>
            </svg>
        `;
        const combinedBuffer = Buffer.from(combinedSvg);

        console.log("Running sharp composite...");
        const buffer = await sharp(dummyJpg)
            .rotate()
            .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
            .composite([{ 
                input: combinedBuffer, 
                gravity: 'northeast'
            }])
            .jpeg({ quality: 85, progressive: true })
            .toBuffer();

        console.log("Composite succeeded! Output buffer length:", buffer.length);
        
        fs.writeFileSync(path.join(__dirname, 'test-output.jpg'), buffer);
        console.log("Saved test-output.jpg for inspection.");

        fs.unlinkSync(dummyJpg);
        console.log("Cleaned up dummy.jpg");
    } catch (e) {
        console.error("Composite threw an error:", e);
    }
}
run();
