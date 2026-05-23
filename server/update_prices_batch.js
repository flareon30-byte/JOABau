const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePrices() {
    console.log('--- STARTING PRICE RECALCULATION (Post May 1st, Non-Invoiced) ---');

    try {
        // 1. Fetch System Settings for fallbacks
        const settings = await prisma.systemSettings.findFirst();
        let fin = {};
        if (settings && settings.financials) {
            fin = typeof settings.financials === 'string' ? JSON.parse(settings.financials) : settings.financials;
        }
        const defaultInstallers = fin.installers || {};

        // 2. Fetch Activations since May 1st that are NOT invoiced
        const activations = await prisma.activationInfo.findMany({
            where: {
                createdAt: { gte: new Date('2026-05-01T00:00:00Z') },
                invoiceId: null, // ONLY non-invoiced ones
                isDraft: false   // Only finished ones (drafts will get new prices on submission anyway)
            },
            include: {
                address: {
                    include: {
                        project: {
                            include: {
                                clientCompany: {
                                    include: { priceItems: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        console.log(`Found ${activations.length} eligible activations to update.`);
        let updatedCount = 0;

        for (const act of activations) {
            const client = act.address?.project?.clientCompany;
            if (!client) {
                console.warn(`Skipping activation ${act.id}: Client not found.`);
                continue;
            }

            const priceItems = client.priceItems || [];
            
            // --- Logic from activationController.js ---
            
            // A. Base Price
            let basePrice = parseFloat(defaultInstallers.pricePerUnit || 60);
            let saturdayPay = 0;
            const isSaturday = act.isSaturday;

            // Try to find exact specific prices in ClientPriceItems BY NAME first, then fallback to legacy mapping
            let matchingItem = priceItems.find(item => item.name === act.activationType || (act.customActivationName && item.name === act.customActivationName));

            if (!matchingItem) {
                matchingItem = priceItems.find(item => {
                    const searchName = (item.name || '').toLowerCase();
                    if (act.activationType === 'BP' || act.activationType === 'BP_2_FAM') {
                        return searchName.includes('caja') || searchName.includes('bp') || searchName.includes('unifamiliar');
                    }
                    if (act.activationType === 'SDU') return searchName.includes('sdu') || searchName.includes('ta');
                    if (act.activationType === 'MDU') return searchName.includes('mdu');
                    if (act.activationType === 'BR_MULTI') return searchName.includes('br') || searchName.includes('multi');
                    return false;
                });
            }

            if (matchingItem) {

                basePrice = matchingItem.priceToClient;
                if (isSaturday) saturdayPay += (matchingItem.saturdayPay || 0);
            }

            let spDynamicPrice = 0;
            const spItem = priceItems.find(item => {
                const name = (item.name || '').toLowerCase();
                return name === 'sp' || name.includes('sp');
            });
            if (spItem && spItem.priceToClient !== undefined) {
                spDynamicPrice = spItem.priceToClient;
            } else if (priceItems.length === 0) {
                spDynamicPrice = parseFloat(defaultInstallers.pricePerSP || 75);
            }
            const totalSpPrice = (act.spInstalled || 0) * spDynamicPrice;

            // C. TA Price
            let taPriceTotal = 0;
            let sduDynamicPrice = 0;
            const sduItem = priceItems.find(item => {
                const name = (item.name || '').toLowerCase();
                return name === 'sdu' || name === 'ta' || name.includes('ta') || name.includes('sdu');
            });
            if (sduItem && sduItem.priceToClient !== undefined) {
                sduDynamicPrice = sduItem.priceToClient;
            } else if (priceItems.length === 0) {
                sduDynamicPrice = parseFloat(defaultInstallers.pricePerTA || 25);
            }
            if (act.taCount > 0) {
                taPriceTotal = act.taCount * sduDynamicPrice;
                if (isSaturday && sduItem && sduItem.saturdayPay) {
                    saturdayPay += ((sduItem.saturdayPay || 0) * act.taCount);
                }
            }

            // D. MDU Price
            let mduPriceTotal = 0;
            let mduDynamicPrice = 0;
            const mduItem = priceItems.find(item => {
                const name = (item.name || '').toLowerCase();
                return name === 'mdu' || name.includes('mdu');
            });
            if (mduItem && mduItem.priceToClient !== undefined) {
                mduDynamicPrice = mduItem.priceToClient;
            } else if (priceItems.length === 0) {
                mduDynamicPrice = parseFloat(defaultInstallers.pricePerMDU || 50);
            }
            if (act.mduInstalled) {
                mduPriceTotal = mduDynamicPrice;
                if (isSaturday && mduItem && mduItem.saturdayPay) {
                    saturdayPay += (mduItem.saturdayPay || 0);
                }
            }

            // E. Repair Price
            let repairPriceTotal = 0;
            const priceRepair = parseFloat(settings?.repairPrice || 45);
            if (act.isRepair) repairPriceTotal = priceRepair;

            // F. Points (Just in case they also changed points config in settings)
            // Note: points are usually fixed in settings, but we'll stick to prices as requested.

            // --- Update ---
            await prisma.activationInfo.update({
                where: { id: act.id },
                data: {
                    basePrice,
                    spPrice: totalSpPrice,
                    taPrice: taPriceTotal,
                    mduPrice: mduPriceTotal,
                    repairPrice: repairPriceTotal,
                    saturdayPay // Also updating saturdayPay in case it changed
                }
            });

            updatedCount++;
        }

        console.log(`--- SUCCESS ---`);
        console.log(`Updated Activations: ${updatedCount}`);

    } catch (error) {
        console.error('Error during price update:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updatePrices();
