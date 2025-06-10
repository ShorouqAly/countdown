const mongoose = require('mongoose');

// Announcement Pricing Schema
const AnnouncementPricingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true }, // in cents
  journalistPayout: { type: Number, required: true }, // in cents
  payoutPercentage: { type: Number, required: true }, // 0-100
  
  features: {
    maxJournalists: { type: Number, default: 10 },
    priorityPlacement: { type: Boolean, default: false },
    aiMatching: { type: Boolean, default: false },
    analyticsIncluded: { type: Boolean, default: false },
    pressKitAccess: { type: Boolean, default: false },
    guaranteedPickup: { type: Boolean, default: false },
    whiteGloveService: { type: Boolean, default: false },
    socialMediaBoost: { type: Boolean, default: false },
    exclusiveNetwork: { type: Boolean, default: false }
  },
  
  description: String,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  created: { type: Date, default: Date.now }
});

// Subscription Plan Schema
const SubscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true }, // in cents
  interval: { type: String, enum: ['month', 'year'], default: 'month' },
  features: [String],
  limits: {
    profileViews: Number,
    analyticsRetention: Number, // days
    pressKitAssets: Number,
    aiCredits: Number,
    announcementsPerMonth: Number,
    prioritySupport: Boolean
  },
  stripePriceId: String,
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  created: { type: Date, default: Date.now }
});

// Create Models
const AnnouncementPricing = mongoose.model('AnnouncementPricing', AnnouncementPricingSchema);
const SubscriptionPlan = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);

module.exports = {
  AnnouncementPricing,
  SubscriptionPlan,
  AnnouncementPricingSchema,
  SubscriptionPlanSchema
};