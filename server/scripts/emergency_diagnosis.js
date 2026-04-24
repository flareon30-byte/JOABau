const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:12345@localhost:5432/foltech_local' });

async function explore() {
    await client.connect();
    console.log('--- Exploring foltech_local ---');
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables found:', tables.rows.map(r => r.table_name).join(', '));
    
    // Attempt counts for some tables if they exist
    for (const table of ['Address', 'User', 'ActivationInfo']) {
        if (tables.rows.some(r => r.table_name === table)) {
            const count = await client.query(`SELECT count(*) FROM "${table}"`);
            console.log(`Count in ${table}:`, count.rows[0].count);
        }
    }
}

explore().catch(console.error).finally(() => client.end());
