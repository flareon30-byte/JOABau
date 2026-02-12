const { Client } = require('pg');

async function checkPort(port, dbname, user, pass) {
    const connStr = `postgresql://${user}:${pass}@localhost:${port}/${dbname}`;
    console.log(`Checking ${connStr}...`);
    const client = new Client({ connectionString: connStr });
    try {
        await client.connect();
        const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public';`);
        console.log(`Tables in ${dbname} on port ${port}:`, res.rows.map(r => r.table_name));

        if (res.rows.find(t => t.table_name.toLowerCase() === 'address')) {
            const count = await client.query(`SELECT count(*) FROM "${res.rows.find(t => t.table_name.toLowerCase() === 'address').table_name}"`);
            console.log(`Count in Address: ${count.rows[0].count}`);
        }
    } catch (e) {
        console.log(`Failed ${dbname} on ${port}: ${e.message}`);
    } finally {
        await client.end();
    }
}

async function run() {
    // Check main local
    await checkPort(5432, 'fiber_optics_db', 'postgres', '12345');
    await checkPort(5432, 'foltech_local', 'postgres', '12345');

    // Check docker port
    await checkPort(5434, 'fiberoptics', 'admin', 'securepassword');
}
run();
