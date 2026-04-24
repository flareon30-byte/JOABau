const { Client } = require('pg');
const dbs = ['foltech_local', 'fiber_optics_db', 'postgres'];

async function discovery() {
    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        console.log(`\n--- DB: ${db} ---`);
        const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        for (const row of tablesRes.rows) {
            const table = row.table_name;
            const countRes = await client.query(`SELECT count(*) FROM "${table}"`);
            const count = countRes.rows[0].count;
            if (parseInt(count) > 0) {
                console.log(`${table}: ${count}`);
            }
        }
        await client.end();
    }
}
discovery().catch(console.error);
