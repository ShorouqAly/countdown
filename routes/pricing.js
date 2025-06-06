const express = require('express');
const router = express.Router();
const { AnnouncementPricing, SubscriptionPlan } = require('../app'); // Adjust path
const auth = require('../middleware/auth'); // Your existing auth middleware

// Get pricing tiers
router.get('/announcements', async (req, res) => {
  try {
    const pricing = await AnnouncementPricing.find({ isActive: true }).sort({ price: 1 });
    res.json(pricing);
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ message: 'Failed to get pricing' });
  }
});

// Get subscription plans
router.get('/subscriptions', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Failed to get subscription plans' });
  }
});

module.exports = router;