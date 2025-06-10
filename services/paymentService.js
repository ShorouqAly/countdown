const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  async createCampaignPayment(campaignData) {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: campaignData.budget,
      currency: 'usd',
      metadata: {
        type: 'reviewmatch_campaign',
        productId: campaignData.productId
      }
    });
    return paymentIntent;
  }
}