const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { EnhancedPayment, AnnouncementPricing, Announcement } = require('../app');
const auth = require('../middleware/auth');

// Create payment intent for announcement
router.post('/announcement/create-intent', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can create payment intents' });
    }
    
    const { announcementId, pricingTierId } = req.body;
    
    const announcement = await Announcement.findById(announcementId);
    if (!announcement || announcement.companyId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    const pricingTier = await AnnouncementPricing.findById(pricingTierId);
    if (!pricingTier) {
      return res.status(404).json({ message: 'Pricing tier not found' });
    }
    
    // Calculate fees
    const stripeFee = Math.round(pricingTier.price * 0.029 + 30); // 2.9% + 30¢
    const platformFee = pricingTier.price - pricingTier.journalistPayout - stripeFee;
    
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pricingTier.price,
      currency: 'usd',
      metadata: {
        announcementId: announcementId,
        pricingTierId: pricingTierId,
        companyId: req.user._id.toString()
      }
    });
    
    // Create payment record
    const payment = new EnhancedPayment({
      announcementId,
      companyId: req.user._id,
      pricingTierId,
      totalAmount: pricingTier.price,
      platformFee,
      journalistPayout: pricingTier.journalistPayout,
      processingFee: stripeFee,
      stripePaymentIntentId: paymentIntent.id,
      escrowAmount: pricingTier.journalistPayout,
      revenueSplit: {
        journalist: pricingTier.journalistPayout,
        platform: platformFee,
        processing: stripeFee
      }
    });
    
    await payment.save();
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: payment._id,
      pricing: pricingTier
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Failed to create payment intent' });
  }
});

// Confirm payment and update announcement
router.post('/announcement/confirm', auth, async (req, res) => {
  try {
    const { paymentId, paymentIntentId } = req.body;
    
    const payment = await EnhancedPayment.findById(paymentId)
      .populate('pricingTierId')
      .populate('announcementId');
    
    if (!payment || payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      payment.escrowStatus = 'funds_held';
      await payment.save();
      
      // Update announcement with pricing tier features
      const announcement = payment.announcementId;
      announcement.plan = payment.pricingTierId.name;
      announcement.fee = payment.totalAmount / 100;
      announcement.pricingTierId = payment.pricingTierId._id;
      announcement.status = 'awaiting_claim'; // or your equivalent status
      
      // Apply premium features
      announcement.priorityPlacement = payment.pricingTierId.features.priorityPlacement;
      announcement.useAiMatching = payment.pricingTierId.features.aiMatching;
      announcement.guaranteedPickup = payment.pricingTierId.features.guaranteedPickup;
      
      await announcement.save();
      
      res.json({ 
        success: true, 
        message: 'Payment confirmed and announcement is now live',
        announcement: announcement
      });
    } else {
      res.status(400).json({ message: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({ message: 'Failed to confirm payment' });
  }
});

module.exports = router;