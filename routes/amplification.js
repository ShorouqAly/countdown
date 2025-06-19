// Database helper functions for MongoDB/Mongoose
// You can adapt this for MySQL, PostgreSQL, or other databases

const AmplificationCampaign = require('../models/AmplificationCampaign'); // The model from your guide

// Save campaign to database
async function saveCampaignToDatabase(campaign) {
  try {
    const newCampaign = new AmplificationCampaign(campaign);
    await newCampaign.save();
    console.log('Campaign saved successfully:', campaign.id);
    return newCampaign;
  } catch (error) {
    console.error('Failed to save campaign:', error);
    throw error;
  }
}

// Get campaign from database
async function getCampaignFromDatabase(campaignId) {
  try {
    const campaign = await AmplificationCampaign.findById(campaignId);
    return campaign;
  } catch (error) {
    console.error('Failed to get campaign:', error);
    throw error;
  }
}

// Update campaign status
async function updateCampaignStatus(campaignId, status) {
  try {
    const result = await AmplificationCampaign.findByIdAndUpdate(
      campaignId,
      { 
        status,
        updatedAt: new Date()
      },
      { new: true }
    );
    console.log('Campaign status updated:', campaignId, status);
    return result;
  } catch (error) {
    console.error('Failed to update campaign status:', error);
    throw error;
  }
}

// Get user's campaigns with filters
async function getUserCampaigns(filters) {
  try {
    const query = { userId: filters.userId };
    
    if (filters.status) {
      query.status = filters.status;
    }
    
    if (filters.articleId) {
      query.articleId = filters.articleId;
    }
    
    const campaigns = await AmplificationCampaign
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit)
      .skip(filters.offset);
    
    return campaigns;
  } catch (error) {
    console.error('Failed to get user campaigns:', error);
    throw error;
  }
}

// Update campaign performance data
async function updateCampaignPerformance(campaignId, platform, performanceData) {
  try {
    const updatePath = `performance.${platform}`;
    const update = {
      [`${updatePath}`]: performanceData,
      'performance.lastUpdated': new Date()
    };

    // Update totals
    if (platform === 'meta') {
      update['performance.totals.reach'] = performanceData.reach || 0;
      update['performance.totals.impressions'] = performanceData.impressions || 0;
      update['performance.totals.clicks'] = performanceData.clicks || 0;
      update['performance.totals.spend'] = performanceData.spend || 0;
    }

    const result = await AmplificationCampaign.findByIdAndUpdate(
      campaignId,
      { $set: update },
      { new: true }
    );

    console.log('Campaign performance updated:', campaignId);
    return result;
  } catch (error) {
    console.error('Failed to update campaign performance:', error);
    throw error;
  }
}

// Get all active campaigns (for performance updates)
async function getActiveCampaigns() {
  try {
    const campaigns = await AmplificationCampaign.find({
      status: 'active',
      'results.meta.success': true
    }).select('id results status userId');
    
    return campaigns;
  } catch (error) {
    console.error('Failed to get active campaigns:', error);
    throw error;
  }
}

// Get campaign statistics for a user
async function getUserCampaignStats(userId) {
  try {
    const stats = await AmplificationCampaign.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          activeCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          totalSpend: { $sum: '$performance.totals.spend' },
          totalReach: { $sum: '$performance.totals.reach' },
          totalClicks: { $sum: '$performance.totals.clicks' }
        }
      }
    ]);

    return stats[0] || {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalSpend: 0,
      totalReach: 0,
      totalClicks: 0
    };
  } catch (error) {
    console.error('Failed to get user campaign stats:', error);
    throw error;
  }
}

// Export all functions
module.exports = {
  saveCampaignToDatabase,
  getCampaignFromDatabase,
  updateCampaignStatus,
  getUserCampaigns,
  updateCampaignPerformance,
  getActiveCampaigns,
  getUserCampaignStats
};