const axios = require('axios');

async function testLogin() {
    try {
        const res = await axios.post('http://localhost:3000/api/auth/login', {
            username: 'jane.orden.hidalgo@gmail.com',
            password: 'your_password_here' // I don't know the password, but the server should handle invalid creds with 400, not 500
        });
        console.log('Login Status:', res.status);
    } catch (e) {
        if (e.response) {
            console.log('Login Response:', e.response.status, e.response.data);
        } else {
            console.error('Login Network Error:', e.message);
        }
    }
}

testLogin();
