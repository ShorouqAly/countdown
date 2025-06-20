const auth = require('../middleware/auth');

router.get('/revenue', auth, async (req, res) => {
  try {
    const payments = await EnhancedPayment.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          platformRevenue: { $sum: '$platformFee' },
          journalistPayouts: { $sum: '$journalistPayout' },
          transactionCount: { $sum: 1 }
        }
      }
    ]);
    
    res.json(payments[0] || {});
  } catch (error) {
    res.status(500).json({ message: 'Failed to get revenue analytics' });
  }
});