const { Client } = require('pg');
const dbs = ['foltech_local', 'fiber_optics_db', 'postgres'];

async function monitor() {
    console.log('Monitoring PC databases for activity...');
    const states = {};

    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        const res = await client.query("SELECT sum(n_tup_ins + n_tup_upd) FROM pg_stat_user_tables");
        states[db] = parseInt(res.rows[0].sum || 0);
        await client.end();
    }

    console.log('Baseline captured. Waiting 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));

    for (const db of dbs) {
        const client = new Client({ connectionString: `postgresql://postgres:12345@localhost:5432/${db}` });
        await client.connect();
        const res = await client.query("SELECT sum(n_tup_ins + n_tup_upd) FROM pg_stat_user_tables");
        const current = parseInt(res.rows[0].sum || 0);
        const diff = current - states[db];
        if (diff > 0) {
            console.log(`[!] ACTIVITY DETECTED in ${db}: ${diff} inserts/updates`);
        } else {
            console.log(`No change in ${db}`);
        }
        await client.end();
    }
}
monitor();
