const fs = require('fs');
const content = 'DATABASE_URL=postgresql://postgres:12345@localhost:5432/fiber_optics_db?schema=public\n';
fs.writeFileSync('.env', content, { encoding: 'utf8' });
console.log('Fixed .env encoding to UTF-8 without BOM (hopefully)');
