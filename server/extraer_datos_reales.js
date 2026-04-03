const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: "postgresql://postgres:12345@localhost:5432/foltech_local"
    });

    try {
        await client.connect();
        
        // Search in "users" (lowercase/plural)
        const usersRes = await client.query("SELECT * FROM users;");
        console.log('--- FOUND USERS IN FOLTECH (users table) ---');
        usersRes.rows.forEach(u => {
            console.log(`User: ${u.username || u.name}, Role: ${u.role}, Phone: ${u.phone || 'N/A'}, Salary: ${u.base_salary || u.salary || 'N/A'}`);
        });
        console.log('--- END LIST ---');

    } catch (e) {
        console.error('USERS_EXTRACTION_ERROR:', e.message);
    } finally {
        await client.end();
    }
}
main();
