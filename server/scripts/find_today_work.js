const { Client } = require('pg');
const dbs = ['foltech_local', 'fiber_optics_db'];

async function findLatest() {
    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        console.log(`Checking latest in ${db}...`);
        try {
            const tablesRes = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            for (const row of tablesRes.rows) {
                const table = row.table_name;
                try {
                    // Search for createdAt or similar
                    const latestRes = await client.query(`SELECT count(*) as count FROM "${table}" WHERE "createdAt" > '2026-04-20'`);
                    if (latestRes.rows[0].count > 0) {
                        console.log(`  - Table "${table}" has ${latestRes.rows[0].count} records from today!`);
                    }
                } catch (e) {
                    try {
                        // Try without quotes or with created_at
                         const latestRes2 = await client.query(`SELECT count(*) as count FROM ${table} WHERE created_at > '2026-04-20'`);
                         if (latestRes2.rows[0].count > 0) {
                             console.log(`  - Table "${table}" has ${latestRes2.rows[0].count} records from today (using created_at)!`);
                         }
                    } catch (e2) {}
                }
            }
        } catch (e) {}
        await client.end();
    }
}

findLatest();
