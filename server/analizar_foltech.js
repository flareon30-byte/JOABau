const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:12345@localhost:5432/foltech_local"
    });

    try {
        await client.connect();
        
        // Let's see if it has a User table
        const tablesRes = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public';");
        console.log('TABLES_IN_FOLTECH:', tablesRes.rows.map(t => t.tablename).join(', '));

        if (tablesRes.rows.some(t => t.tablename.toLowerCase() === 'user')) {
             const usersRes = await client.query("SELECT * FROM \"User\";");
             console.log('--- FOUND USERS IN FOLTECH ---');
             usersRes.rows.forEach(u => {
                 console.log(`User: ${u.username}, Role: ${u.role}, Phone: ${u.phone || 'N/A'}, Salary: ${u.baseSalary || 'N/A'}`);
             });
             console.log('--- END LIST ---');
        } else {
            console.log('User table NOT FOUND in foltech_local');
        }

    } catch (e) {
        console.error('FOLTECH_ANALYSIS_ERROR:', e.message);
    } finally {
        await client.end();
    }
}
main();
