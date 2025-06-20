const express = require('express');
const router = express.Router();

// Import the detailed routes from the component directory
const amplificationComponentRoutes = require('../components/amplification/ArticleAmplifier/routes/amplification/amplification');

// Mount all the amplification routes
router.use('/', amplificationComponentRoutes);

// You can add any additional middleware or routes here if needed
// For example, logging middleware specific to amplification routes:
router.use((req, res, next) => {
  console.log(`[Amplification] ${req.method} ${req.originalUrl}`);
  next();
});

module.exports = router;