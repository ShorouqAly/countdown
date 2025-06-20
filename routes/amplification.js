const express = require('express');
const router = express.Router();

router.post('/campaigns/create', async (req, res) => {
  try {
    const campaign = req.body;

    // Save campaign to DB here
    console.log('Received campaign:', campaign);

    res.status(201).json({ message: 'Campaign created', campaign });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
