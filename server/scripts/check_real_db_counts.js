const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:12345@localhost:5432/foltech_local' });
async function main() {
    await client.connect();
    const res = await client.query('SELECT count(*) FROM "Address"');
    console.log('REAL Production Addresses (local):', res.rows[0].count);
}
main().catch(console.error).finally(() => client.end());
