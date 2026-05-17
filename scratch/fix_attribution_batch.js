const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAttribution() {
  console.log('--- STARTING ATTRIBUTION RESTORATION ---');
  
  try {
    // 1. Get all activations
    const activations = await prisma.activationInfo.findMany({
      include: {
        address: {
          include: {
            appointment: {
              include: {
                assignedTeam: {
                  include: { members: true }
                }
              }
            }
          }
        },
        createdBy: true
      }
    });

    console.log(`Checking ${activations.length} activations...`);
    let fixedActivations = 0;

    for (const act of activations) {
      // If the report was "closed by" an Admin/SuperAdmin
      if (act.createdBy && (act.createdBy.role === 'ADMIN' || act.createdBy.role === 'SUPER_ADMIN')) {
        // Find the assigned technician from the appointment
        const assignedTeamMembers = act.address?.appointment?.assignedTeam?.members || [];
        if (assignedTeamMembers.length > 0) {
          const originalTech = assignedTeamMembers[0];
          const techIds = assignedTeamMembers.map(m => m.id);

          console.log(`Fixing Activation: ${act.address.street} ${act.address.number}`);
          console.log(`  Current Closer: ${act.createdBy.username}`);
          console.log(`  Restoring to Tech: ${originalTech.username}`);

          await prisma.activationInfo.update({
            where: { id: act.id },
            data: {
              createdById: originalTech.id,
              performerIds: techIds
            }
          });
          fixedActivations++;
        }
      }
    }

    // 2. Get all Soplado
    const soplados = await prisma.sopladoInfo.findMany({
      include: {
        address: {
          include: {
            appointment: {
              include: {
                assignedTeam: {
                  include: { members: true }
                }
              }
            }
          }
        }
      }
    });

    console.log(`Checking ${soplados.length} soplado reports...`);
    let fixedSoplados = 0;

    for (const sop of soplados) {
        // Soplado doesn't have createdById, but has performerIds
        // Check if the performers are only admins
        const performerIds = sop.performerIds || [];
        if (performerIds.length > 0) {
            const performers = await prisma.user.findMany({ where: { id: { in: performerIds } } });
            const onlyAdmins = performers.every(p => p.role === 'ADMIN' || p.role === 'SUPER_ADMIN');

            if (onlyAdmins) {
                const assignedTeamMembers = sop.address?.appointment?.assignedTeam?.members || [];
                if (assignedTeamMembers.length > 0) {
                    const techIds = assignedTeamMembers.map(m => m.id);
                    console.log(`Fixing Soplado: ${sop.address.street} ${sop.address.number}`);
                    console.log(`  Restoring to Tech Team members`);
                    
                    await prisma.sopladoInfo.update({
                        where: { id: sop.id },
                        data: { performerIds: techIds }
                    });
                    fixedSoplados++;
                }
            }
        }
    }

    console.log(`--- SUCCESS ---`);
    console.log(`Fixed Activations: ${fixedActivations}`);
    console.log(`Fixed Soplado: ${fixedSoplados}`);

  } catch (error) {
    console.error('Error during restoration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAttribution();
