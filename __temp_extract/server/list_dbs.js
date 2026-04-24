const { Client } = require('pg');
const client = new Client({
    connectionString: 'postgresql://postgres:12345@localhost:5432/postgres'
});

async function run() {
    try {
        await client.connect();
        const res = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        console.log('Databases:', res.rows.map(r => r.datname));

        // Check tables in fiber_optics_db
        const client2 = new Client({ connectionString: 'postgresql://postgres:12345@localhost:5432/fiber_optics_db' });
        await client2.connect();
        const tables = await client2.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public';`);
        console.log('Tables in fiber_optics_db:', tables.rows.map(r => r.table_name));
        await client2.end();

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
