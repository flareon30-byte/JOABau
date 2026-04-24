const { Client } = require('pg');

async function run() {
    const client = new Client({ connectionString: 'postgresql://postgres:12345@localhost:5432/fiber_optics_db' });
    try {
        await client.connect();
        const addr = await client.query('SELECT count(*) FROM "Address"');
        console.log('Address count:', addr.rows[0].count);

        const act = await client.query('SELECT count(*) FROM "ActivationInfo"');
        console.log('ActivationInfo count:', act.rows[0].count);

        const repairs = await client.query('SELECT count(*) FROM "Repair"');
        console.log('Repair count:', repairs.rows[0].count);

    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
