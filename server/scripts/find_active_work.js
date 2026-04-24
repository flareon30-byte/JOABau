const { Client } = require('pg');
const dbs = ['foltech_local', 'fiber_optics_db', 'postgres'];

async function check() {
    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        console.log(`Checking ${db}...`);
        try {
            const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            for (const row of tablesRes.rows) {
                const table = row.table_name;
                try {
                    const res = await client.query(`SELECT count(*) FROM "${table}" WHERE "updatedAt" > NOW() - INTERVAL '2 hours'`);
                    if (parseInt(res.rows[0].count) > 0) {
                        console.log(`  [!] FOUND RECENT WORK in ${db}.${table}: ${res.rows[0].count} records`);
                    }
                } catch (e) {
                    try {
                        const res = await client.query(`SELECT count(*) FROM "${table}" WHERE "updated_at" > NOW() - INTERVAL '2 hours'`);
                         if (parseInt(res.rows[0].count) > 0) {
                            console.log(`  [!] FOUND RECENT WORK in ${db}.${table}: ${res.rows[0].count} records (updated_at)`);
                        }
                    } catch (e2) {}
                }
            }
        } catch (e) {}
        await client.end();
    }
}
check();
