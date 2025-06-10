const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models - adjust path to match your structure
const { AnnouncementPricing, SubscriptionPlan } = require('../models/pricing');
// OR if you have separate model files:
// const AnnouncementPricing = require('../models/AnnouncementPricing');
// const SubscriptionPlan = require('../models/SubscriptionPlan');

// Get pricing tiers
router.get('/announcements', async (req, res) => {
  try {
    console.log('📡 Pricing request received'); // Debug log
    
    const pricing = await AnnouncementPricing.find({ isActive: true }).sort({ price: 1 });
    
    console.log('💰 Found pricing tiers:', pricing.length); // Debug log
    
    if (pricing.length === 0) {
      console.log('⚠️ No pricing tiers found - need to initialize');
      return res.status(200).json([]); // Return empty array instead of error
    }
    
    res.json(pricing);
  } catch (error) {
    console.error('❌ Get pricing error:', error);
    res.status(500).json({ 
      message: 'Failed to get pricing',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get subscription plans
router.get('/subscriptions', async (req, res) => {
  try {
    console.log('📡 Subscription plans request received'); // Debug log
    
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    
    console.log('📋 Found subscription plans:', plans.length); // Debug log
    
    if (plans.length === 0) {
      console.log('⚠️ No subscription plans found - need to initialize');
      return res.status(200).json([]); // Return empty array instead of error
    }
    
    res.json(plans);
  } catch (error) {
    console.error('❌ Get subscription plans error:', error);
    res.status(500).json({ 
      message: 'Failed to get subscription plans',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint to check if routes are working
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Pricing routes are working!', 
    timestamp: new Date().toISOString(),
    endpoints: ['/announcements', '/subscriptions']
  });
});

module.exports = router;