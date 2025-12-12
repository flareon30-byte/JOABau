const axios = require('axios');

async function testDelete() {
    try {
        // 1. Login as Super Admin
        const loginRes = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'jane.orden.hidalgo@gmail.com',
            password: 'supersecretpassword' // Wait, I need to know the password from the seed
        });

        // The seed uses a hashed password. I don't know the plain text if it was changed.
        // But the seed_test_data.js I just ran uses '123456' for activator1.
        // The super admin password in seed.js was '2122000'.

        // Let's try to login with the super admin credentials from seed.js
    } catch (e) {
        console.log('Error in test setup');
    }
}
