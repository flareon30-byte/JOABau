const path = require('path');
const fs = require('fs');

console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

const uploadsDirInServer = path.join(process.cwd(), 'uploads');
console.log('Uploads Dir (CWD):', uploadsDirInServer, 'Exists:', fs.existsSync(uploadsDirInServer));

const uploadsDirRelative = path.join(__dirname, '../../uploads');
console.log('Uploads Dir (Relative):', uploadsDirRelative, 'Exists:', fs.existsSync(uploadsDirRelative));
