const { Client } = require('pg');
const dbs = ['postgres', 'foltech_local', 'fiber_optics_db'];

async function search() {
    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        console.log(`Searching in ${db}...`);
        try {
            const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            for (const row of tablesRes.rows) {
                const table = row.table_name;
                try {
                    const searchRes = await client.query(`SELECT count(*) FROM "${table}"`);
                    console.log(`  - ${table}: ${searchRes.rows[0].count} records`);
                } catch (e) {}
            }
        } catch (e) {
            console.log(`  Error searching in ${db}`);
        }
        await client.end();
    }
}

search();
