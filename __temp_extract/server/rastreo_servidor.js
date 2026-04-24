const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:12345@localhost:5432/postgres" // Connect to main postgres DB
    });

    try {
        await client.connect();
        
        // Find all databases
        const res = await client.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
        const dbs = res.rows.map(r => r.datname);
        console.log('DATABASES_FOUND:', dbs.join(', '));

        // Let's also look for any relations/tables in the public schema of THE CURRENT DB
        // to see if we can find something that sounds like "backup" or "old"
        const tablesRes = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
        console.log('PUBLIC_TABLES:', tablesRes.rows.map(t => t.tablename).join(', '));

    } catch (e) {
        console.error('SEARCH_ERROR:', e.message);
    } finally {
        await client.end();
    }
}
main();
