const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { AnnouncementPricing, SubscriptionPlan } = require('../models/pricing');


async function initializePricing() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exclusivewire');
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional)
    await AnnouncementPricing.deleteMany({});
    await SubscriptionPlan.deleteMany({});
    console.log('🗑️ Cleared existing pricing data');

    // Create pricing tiers
    const pricingTiers = [
      {
        name: 'Starter',
        price: 9900, // $99
        journalistPayout: 1980, // $19.80 (20%)
        payoutPercentage: 20,
        features: {
          maxJournalists: 5,
          priorityPlacement: false,
          aiMatching: false,
          analyticsIncluded: false,
          pressKitAccess: false,
          guaranteedPickup: false,
          whiteGloveService: false
        },
        description: 'Perfect for testing and small announcements',
        sortOrder: 1
      },
      {
        name: 'Professional',
        price: 24900, // $249
        journalistPayout: 6225, // $62.25 (25%)
        payoutPercentage: 25,
        features: {
          maxJournalists: 15,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: false,
          whiteGloveService: false,
          socialMediaBoost: true
        },
        description: 'Most popular - enhanced targeting and analytics',
        sortOrder: 2
      },
      {
        name: 'Enterprise',
        price: 49900, // $499
        journalistPayout: 12475, // $124.75 (25%)
        payoutPercentage: 25,
        features: {
          maxJournalists: 30,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: true,
          whiteGloveService: true,
          socialMediaBoost: true,
          exclusiveNetwork: true
        },
        description: 'For major announcements requiring wide coverage',
        sortOrder: 3
      },
      {
        name: 'Premium Elite',
        price: 99900, // $999
        journalistPayout: 29970, // $299.70 (30%)
        payoutPercentage: 30,
        features: {
          maxJournalists: 50,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: true,
          whiteGloveService: true,
          socialMediaBoost: true,
          exclusiveNetwork: true
        },
        description: 'Exclusive access to top-tier journalists and guaranteed premium coverage',
        sortOrder: 4
      }
    ];

    const createdPricing = await AnnouncementPricing.insertMany(pricingTiers);
    console.log(`💰 Created ${createdPricing.length} pricing tiers`);

    // Create subscription plans
    const subscriptionPlans = [
      {
        name: 'Analytics Pro',
        price: 9900, // $99/month
        description: 'Advanced analytics and performance tracking',
        features: [
          'Unlimited analytics queries',
          'Custom reporting dashboard',
          'Competitor tracking',
          'ROI measurement tools',
          'CSV export capabilities',
          '12-month data retention'
        ],
        limits: {
          profileViews: 10000,
          analyticsRetention: 365,
          pressKitAssets: 0,
          aiCredits: 0,
          announcementsPerMonth: 0,
          prioritySupport: false
        },
        sortOrder: 1
      },
      {
        name: 'Press Kit Manager',
        price: 4900, // $49/month
        description: 'Digital press kit management and distribution',
        features: [
          'Unlimited asset storage',
          'Brand guidelines management',
          'Auto-sharing with journalists',
          'Usage analytics',
          'Custom branding',
          'Media contact management'
        ],
        limits: {
          profileViews: 0,
          analyticsRetention: 0,
          pressKitAssets: -1, // unlimited
          aiCredits: 0,
          announcementsPerMonth: 0,
          prioritySupport: false
        },
        sortOrder: 2
      },
      {
        name: 'AI Assistant Pro',
        price: 19900, // $199/month
        description: 'AI-powered features and automation',
        features: [
          'Smart pitch personalization',
          'Optimal timing predictions',
          'Story performance scoring',
          'Auto-generated follow-ups',
          'Trend analysis',
          'Sentiment monitoring'
        ],
        limits: {
          profileViews: 0,
          analyticsRetention: 0,
          pressKitAssets: 0,
          aiCredits: 1000,
          announcementsPerMonth: 0,
          prioritySupport: true
        },
        sortOrder: 3
      },
      {
        name: 'Complete Enterprise',
        price: 29900, // $299/month
        description: 'All premium features included',
        features: [
          'Everything in Analytics Pro',
          'Everything in Press Kit Manager', 
          'Everything in AI Assistant Pro',
          'Unlimited announcements',
          'Priority support',
          'Custom integrations',
          'Dedicated account manager'
        ],
        limits: {
          profileViews: -1, // unlimited
          analyticsRetention: -1, // unlimited
          pressKitAssets: -1, // unlimited
          aiCredits: 2000,
          announcementsPerMonth: -1, // unlimited
          prioritySupport: true
        },
        sortOrder: 4
      }
    ];

    const createdPlans = await SubscriptionPlan.insertMany(subscriptionPlans);
    console.log(`📋 Created ${createdPlans.length} subscription plans`);

    console.log('🎉 Pricing initialization completed successfully!');
    
    // Display created data for verification
    console.log('\n📊 Created Pricing Tiers:');
    createdPricing.forEach(tier => {
      console.log(`  - ${tier.name}: $${tier.price/100} (${tier.payoutPercentage}% to journalists)`);
    });
    
    console.log('\n📋 Created Subscription Plans:');
    createdPlans.forEach(plan => {
      console.log(`  - ${plan.name}: $${plan.price/100}/${plan.interval}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializePricing();
}

module.exports = initializePricing;