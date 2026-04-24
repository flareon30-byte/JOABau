const path = require('path');
const dotenv = require('dotenv');

console.log('Current __dirname:', __dirname);
console.log('Attempting to load .env from:', path.join(__dirname, '.env'));

const result = dotenv.config({ path: path.join(__dirname, '.env') });

if (result.error) {
    console.error('Error loading .env:', result.error);
}

console.log('DATABASE_URL starts with:', (process.env.DATABASE_URL || '').substring(0, 15));

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing!');
} else {
    console.log('DATABASE_URL is present.');
}
