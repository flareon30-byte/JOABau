const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const uploadsDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFileName = `uploads-backup-${timestamp}.zip`;
const outputPath = path.join(outputDir, outputFileName);

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log('--- Starting Uploads Compression ---');
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
});

output.on('close', function() {
    console.log(`--- Finished! ---`);
    console.log(`Total bytes: ${archive.pointer()}`);
    console.log(`Saved in: ${outputPath}`);
});

archive.on('error', function(err) {
    throw err;
});

archive.pipe(output);

// Append files from uploads directory
if (fs.existsSync(uploadsDir)) {
    archive.directory(uploadsDir, false);
} else {
    console.log('[Warning] Uploads directory not found. Zipping empty folder.');
}

archive.finalize();
