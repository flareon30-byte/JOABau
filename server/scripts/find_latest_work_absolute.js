const { Client } = require('pg');
const dbs = ['foltech_local', 'fiber_optics_db', 'postgres'];

async function findLatest() {
    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        try {
            const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            for (const row of tablesRes.rows) {
                const table = row.table_name;
                try {
                    const res = await client.query(`SELECT "createdAt" FROM "${table}" ORDER BY "createdAt" DESC LIMIT 1`);
                    if (res.rows[0]) {
                        console.log(`${db}.${table} latest createdAt: ${res.rows[0].createdAt}`);
                    }
                } catch (e) {
                    try {
                        const res = await client.query(`SELECT created_at FROM "${table}" ORDER BY created_at DESC LIMIT 1`);
                        if (res.rows[0]) {
                            console.log(`${db}.${table} latest created_at: ${res.rows[0].created_at}`);
                        }
                    } catch (e2) {}
                }
            }
        } catch (e) {}
        await client.end();
    }
}
findLatest();
