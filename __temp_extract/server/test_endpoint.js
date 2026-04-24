const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 'some-user-id', role: 'SUPER_ADMIN', isDemo: false }, 'supersecretkey');
console.log(token);
fetch('http://localhost:3000/api/material-orders', {
    headers: { 'Cookie': `token=${token}` }
}).then(r => r.text()).then(console.log).catch(console.error);
