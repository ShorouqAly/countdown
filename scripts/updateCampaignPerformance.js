const MetaAmplificationService = require('../services/metaAmplificationService');
const metaService = new MetaAmplificationService();

async function updateAllCampaignPerformance() {
  try {
    // Get all active campaigns from database
    const activeCampaigns = await getActiveCampaigns();
    
    for (const campaign of activeCampaigns) {
      if (campaign.results.meta?.success) {
        const performance = await metaService.getCampaignPerformance(
          campaign.results.meta.campaign.id
        );
        
        if (performance) {
          await updateCampaignPerformance(campaign.id, 'meta', performance);
        }
      }
    }
    
    console.log(`Updated performance for ${activeCampaigns.length} campaigns`);
  } catch (error) {
    console.error('Performance update failed:', error);
  }
}

// Run every 30 minutes
setInterval(updateAllCampaignPerformance, 30 * 60 * 1000);