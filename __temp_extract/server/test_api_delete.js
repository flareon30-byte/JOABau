const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Starting test...');

        // 1. Create a dummy team directly in DB
        const team = await prisma.team.create({
            data: {
                name: 'Test Delete Team',
                department: 'BLOWING'
            }
        });
        console.log('Created team:', team.id);

        // 2. Login to get token
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'jane.orden.hidalgo@gmail.com',
                password: '2122000'
            })
        });

        if (!loginRes.ok) {
            throw new Error('Login failed');
        }

        const cookie = loginRes.headers.get('set-cookie');
        console.log('Logged in, got cookie');

        // 3. Try to delete the team via API
        const deleteTeamRes = await fetch(`http://localhost:3000/api/teams/${team.id}`, {
            method: 'DELETE',
            headers: {
                'Cookie': cookie
            }
        });

        if (deleteTeamRes.ok) {
            console.log('Team deleted successfully via API');
        } else {
            const err = await deleteTeamRes.json();
            console.error('Failed to delete team via API:', err);
        }

        // 4. Create a dummy project with address and appointment
        const project = await prisma.project.create({
            data: { name: 'Test Delete Project' }
        });

        await prisma.address.create({
            data: {
                street: 'Test St',
                projectId: project.id,
                appointment: {
                    create: {
                        clientName: 'Test Client',
                        status: 'PENDIENTE'
                    }
                }
            }
        });
        console.log('Created project with data:', project.id);

        // 5. Try to delete project via API
        const deleteProjectRes = await fetch(`http://localhost:3000/api/projects/${project.id}`, {
            method: 'DELETE',
            headers: {
                'Cookie': cookie
            }
        });

        if (deleteProjectRes.ok) {
            console.log('Project deleted successfully via API');
        } else {
            const err = await deleteProjectRes.json();
            console.error('Failed to delete project via API:', err);
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
