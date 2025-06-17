const mongoose = require('mongoose');

const amplificationCampaignSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  articleId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['active', 'paused', 'completed', 'failed'], 
    default: 'active',
    index: true 
  },
  
  // Campaign configuration
  articleData: {
    headline: String,
    url: String,
    summary: String,
    featuredImage: String
  },
  
  budget: {
    total: Number,
    daily: Number,
    platforms: {
      meta: Number,
      linkedin: Number,
      twitter: Number
    }
  },
  
  targeting: {
    meta: {
      countries: [String],
      ageMin: Number,
      ageMax: Number,
      interests: [{
        id: String,
        name: String
      }],
      behaviors: [mongoose.Schema.Types.Mixed],
      customAudiences: [mongoose.Schema.Types.Mixed]
    },
    linkedin: mongoose.Schema.Types.Mixed,
    twitter: mongoose.Schema.Types.Mixed
  },
  
  platforms: [String],
  
  // Platform-specific campaign results
  results: {
    meta: {
      success: Boolean,
      campaign: {
        id: String,
        adSetId: String,
        adId: String,
        creativeId: String,
        postId: String,
        estimatedReach: Number,
        estimatedImpressions: Number,
        estimatedClicks: Number
      },
      error: String
    },
    linkedin: mongoose.Schema.Types.Mixed,
    twitter: mongoose.Schema.Types.Mixed
  },
  
  // Performance data (updated via cron job)
  performance: {
    lastUpdated: Date,
    meta: {
      reach: Number,
      impressions: Number,
      clicks: Number,
      spend: Number,
      cpm: Number,
      cpc: Number,
      ctr: Number
    },
    linkedin: mongoose.Schema.Types.Mixed,
    twitter: mongoose.Schema.Types.Mixed,
    totals: {
      reach: Number,
      impressions: Number,
      clicks: Number,
      spend: Number
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AmplificationCampaign', amplificationCampaignSchema);