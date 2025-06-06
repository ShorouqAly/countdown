const mongoose = require('mongoose');
const { SubscriptionPlan, AnnouncementPricing } = require('../app'); // Adjust path
require('dotenv').config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/exclusivewire';

async function initializeMonetization() {
  try {
    await mongoose.connect(mongoURI);
    console.log('Connected to MongoDB');
    
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
          analyticsIncluded: false
        },
        description: 'Perfect for small announcements'
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
          analyticsIncluded: true
        },
        description: 'Most popular - enhanced features'
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
          guaranteedPickup: true
        },
        description: 'For major announcements'
      }
    ];
    
    await AnnouncementPricing.insertMany(pricingTiers);
    console.log('✅ Pricing tiers created');
    
    // Create subscription plans
    const subscriptionPlans = [
      {
        name: 'Analytics Pro',
        price: 9900, // $99/month
        description: 'Advanced analytics and reporting',
        features: ['Unlimited analytics', 'Custom reports', 'Export data'],
        limits: { analyticsRetention: 365, prioritySupport: false }
      },
      {
        name: 'Complete Suite',
        price: 24900, // $249/month
        description: 'All premium features included',
        features: ['Everything included', 'Priority support', 'Custom integrations'],
        limits: { analyticsRetention: -1, prioritySupport: true }
      }
    ];
    
    await SubscriptionPlan.insertMany(subscriptionPlans);
    console.log('✅ Subscription plans created');
    
    console.log('🎉 Monetization features initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

initializeMonetization();