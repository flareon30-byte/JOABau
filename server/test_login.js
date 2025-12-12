

async function testLogin() {
    try {
        console.log('Testing login for Super Admin...');
        const res = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'jane.orden.hidalgo@gmail.com',
                password: '2122000'
            })
        });

        if (res.ok) {
            console.log('Login SUCCESS!');
            const data = await res.json();
            console.log('User:', data.user.username);
        } else {
            console.log('Login FAILED:', res.status, res.statusText);
            const err = await res.text();
            console.log('Error:', err);
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testLogin();
