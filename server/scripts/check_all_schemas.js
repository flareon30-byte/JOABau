const { Client } = require('pg');

async function checkAll() {
    const client = new Client({ connectionString: 'postgresql://postgres:12345@localhost:5432/fiber_optics_db' });
    await client.connect();
    console.log(`Checking ALL SCHEMAS in fiber_optics_db...`);
    try {
        const schemasRes = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog')");
        for (const sRow of schemasRes.rows) {
            const schema = sRow.schema_name;
            console.log(`Schema: ${schema}`);
            const tablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}'`);
            for (const tRow of tablesRes.rows) {
                const table = tRow.table_name;
                try {
                    const countRes = await client.query(`SELECT count(*) FROM "${schema}"."${table}"`);
                    if (parseInt(countRes.rows[0].count) > 0) {
                        console.log(`  - ${table}: ${countRes.rows[0].count}`);
                    }
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error(e);
    }
    await client.end();
}
checkAll();
