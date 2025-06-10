const mongoose = require('mongoose');

// Product Schema for Review Marketplace
const ProductSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Basic Product Information
  productInfo: {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    category: { 
      type: String, 
      enum: ['electronics', 'beauty', 'home', 'food', 'fashion', 'software', 'services', 'health', 'automotive', 'other'],
      required: true 
    },
    subcategory: String,
    description: { type: String, required: true },
    features: [String],
    specifications: mongoose.Schema.Types.Mixed,
    msrp: { type: Number, required: true }, // Manufacturer's suggested retail price in cents
    productUrls: {
      website: String,
      purchase: String,
      support: String
    }
  },

  // Media Assets
  media: {
    images: [String], // URLs to product images
    videos: [String], // URLs to product videos
    pressKit: String, // URL to downloadable press kit
    additionalAssets: [String]
  },

  // Review Campaign Details
  campaign: {
    campaignTier: { 
      type: String, 
      enum: ['basic', 'premium', 'enterprise'], 
      default: 'basic' 
    },
    budget: { type: Number, required: true }, // Campaign budget in cents
    maxReviewers: { type: Number, default: 10 },
    startDate: { type: Date, default: Date.now },
    endDate: Date,
    isActive: { type: Boolean, default: true }
  },

  // Review Requirements
  reviewRequirements: {
    minWordCount: { type: Number, default: 500 },
    reviewType: {
      type: String,
      enum: ['individual', 'roundup', 'comparison', 'trend', 'gift-guide'],
      default: 'individual'
    },
    requiredElements: [String], // e.g., ['photos', 'video', 'pros-cons', 'rating']
    publicationTier: {
      type: String,
      enum: ['any', 'tier-2', 'tier-1', 'premium'],
      default: 'any'
    },
    coverageDeadline: { type: Number, default: 30 }, // Days from product receipt
    exclusiveWindow: { type: Number, default: 0 }, // Days of exclusivity
    usageRights: {
      canQuote: { type: Boolean, default: true },
      canShareSocial: { type: Boolean, default: true },
      canUseInMarketing: { type: Boolean, default: false }
    }
  },

  // Targeting Criteria
  targeting: {
    journalistSpecializations: [String],
    minFollowers: { type: Number, default: 0 },
    geographicRegions: [String],
    excludeCompetitors: { type: Boolean, default: true },
    languagePreferences: [String]
  },

  // Product Logistics
  logistics: {
    productType: { 
      type: String, 
      enum: ['physical', 'digital', 'subscription', 'service'], 
      required: true 
    },
    shippingRequired: { type: Boolean, default: false },
    availableQuantity: { type: Number, default: 1 },
    shippingRegions: [String],
    estimatedDeliveryDays: { type: Number, default: 7 },
    returnRequired: { type: Boolean, default: false },
    subscriptionLength: { type: Number }, // Days for subscription products
    accessInstructions: String // For digital products
  },

  // Performance Tracking
  analytics: {
    views: { type: Number, default: 0 },
    requests: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    completed: { type: Number, default: 0 },
    totalReach: { type: Number, default: 0 },
    totalEngagement: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    sentimentScore: { type: Number, default: 0 }
  },

  // Status and Lifecycle
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },
  
  featured: { type: Boolean, default: false },
  priority: { type: Number, default: 0 }, // For sorting/ranking
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// Review Request Schema
const ReviewRequestSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Request Details
  requestInfo: {
    pitchMessage: { type: String, required: true },
    proposedOutlet: { type: String, required: true },
    estimatedReach: { type: Number, required: true },
    plannedAngle: String,
    estimatedPublishDate: Date,
    sampleArticles: [String], // URLs to previous similar reviews
    audienceData: {
      demographics: String,
      interests: [String],
      monthlyPageviews: Number,
      socialFollowing: Number
    }
  },

  // Company Review of Request
  companyReview: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'needs_info'],
      default: 'pending'
    },
    reviewDate: Date,
    reviewNotes: String,
    requestedChanges: String,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },

  // Fulfillment Tracking
  fulfillment: {
    fulfillmentStatus: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'access_granted', 'failed'],
      default: 'pending'
    },
    shippingInfo: {
      carrier: String,
      trackingNumber: String,
      shippedDate: Date,
      estimatedDelivery: Date,
      actualDelivery: Date,
      shippingAddress: {
        name: String,
        address1: String,
        address2: String,
        city: String,
        state: String,
        zip: String,
        country: String
      }
    },
    digitalAccess: {
      accessUrl: String,
      credentials: String,
      accessGrantedDate: Date,
      accessExpiryDate: Date
    }
  },

  // Review Completion
  reviewCompletion: {
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'submitted', 'published', 'overdue'],
      default: 'not_started'
    },
    startedDate: Date,
    submittedDate: Date,
    publishedDate: Date,
    coverageUrl: String,
    wordCount: Number,
    reviewScore: { type: Number, min: 1, max: 10 },
    includesPhotos: { type: Boolean, default: false },
    includesVideo: { type: Boolean, default: false },
    sentiment: { 
      type: String, 
      enum: ['positive', 'neutral', 'negative', 'mixed'],
      default: 'neutral'
    }
  },

  // Performance Metrics
  performance: {
    pageviews: { type: Number, default: 0 },
    socialShares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    backlinks: { type: Number, default: 0 },
    estimatedValue: { type: Number, default: 0 }, // In cents
    engagementRate: { type: Number, default: 0 }
  },

  // Communications
  communications: [{
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: String,
    timestamp: { type: Date, default: Date.now },
    messageType: { 
      type: String, 
      enum: ['request', 'approval', 'question', 'update', 'completion'],
      default: 'request'
    }
  }],

  // Ratings and Feedback
  feedback: {
    journalistRating: { // Company rates journalist
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      wouldWorkAgain: { type: Boolean, default: true }
    },
    companyRating: { // Journalist rates company/product
      rating: { type: Number, min: 1, max: 5 },
      feedback: String,
      productQuality: { type: Number, min: 1, max: 5 },
      communicationQuality: { type: Number, min: 1, max: 5 }
    }
  },

  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// Coverage Verification Schema
const CoverageVerificationSchema = new mongoose.Schema({
  reviewRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReviewRequest', required: true },
  
  // Submitted Coverage
  submittedCoverage: {
    url: String,
    headline: String,
    publication: String,
    publishDate: Date,
    author: String,
    wordCount: Number,
    content: String, // Extracted article content
    images: [String],
    videoUrl: String
  },

  // Verification Process
  verification: {
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected', 'needs_review'],
      default: 'pending'
    },
    verifiedBy: { type: String, enum: ['automated', 'manual', 'journalist', 'company'] },
    verificationDate: Date,
    verificationNotes: String,
    
    // Automated Checks
    automatedChecks: {
      urlAccessible: { type: Boolean, default: false },
      contentMatches: { type: Boolean, default: false },
      wordCountValid: { type: Boolean, default: false },
      publishDateValid: { type: Boolean, default: false },
      authorMatches: { type: Boolean, default: false },
      productMentioned: { type: Boolean, default: false }
    }
  },

  // Performance Analytics
  analytics: {
    pageviews: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    socialShares: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    timeOnPage: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    backlinks: { type: Number, default: 0 },
    domainAuthority: { type: Number, default: 0 }
  },

  // Sentiment Analysis
  sentiment: {
    overallSentiment: {
      type: String,
      enum: ['very_positive', 'positive', 'neutral', 'negative', 'very_negative'],
      default: 'neutral'
    },
    sentimentScore: { type: Number, default: 0 }, // -1 to 1
    keyPhrases: [String],
    positivePoints: [String],
    negativePoints: [String],
    neutralPoints: [String]
  },

  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// Create Models
const Product = mongoose.model('Product', ProductSchema);
const ReviewRequest = mongoose.model('ReviewRequest', ReviewRequestSchema);
const CoverageVerification = mongoose.model('CoverageVerification', CoverageVerificationSchema);

module.exports = {
  Product,
  ReviewRequest,
  CoverageVerification,
  ProductSchema,
  ReviewRequestSchema,
  CoverageVerificationSchema
};