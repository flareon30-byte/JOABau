const { Client } = require('pg');

async function checkDB(name) {
    const client = new Client({
        connectionString: `postgresql://postgres:12345@localhost:5432/${name}`
    });
    try {
        await client.connect();
        const res = await client.query('SELECT count(*) FROM "Address";'); // Quotes case sensitive if needed, but usually Address is fine
        console.log(`Addresses in ${name}:`, res.rows[0].count);
    } catch (e) {
        console.error(`Error checking ${name}:`, e.message);
    } finally {
        await client.end();
    }
}

async function run() {
    await checkDB('fiber_optics_db');
    await checkDB('foltech_local');
    await checkDB('postgres');
}
run();
