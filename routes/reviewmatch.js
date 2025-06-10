const express = require('express');
const router = express.Router();
const { Product, ReviewRequest, CoverageVerification } = require('../models/reviewmatch');
const auth = require('../middleware/auth'); // Your existing auth middleware

// PRODUCT MANAGEMENT ROUTES

// Get all products (for marketplace browsing)
router.get('/products', auth, async (req, res) => {
  try {
    const {
      category,
      minValue,
      maxValue,
      productType,
      shippingRegion,
      page = 1,
      limit = 20,
      sortBy = 'created',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { status: 'active' };
    
    if (category) filter['productInfo.category'] = category;
    if (productType) filter['logistics.productType'] = productType;
    if (minValue || maxValue) {
      filter['productInfo.msrp'] = {};
      if (minValue) filter['productInfo.msrp'].$gte = parseInt(minValue) * 100;
      if (maxValue) filter['productInfo.msrp'].$lte = parseInt(maxValue) * 100;
    }

    // Enhanced filtering for journalists
    if (req.user.role === 'journalist') {
      // Only show products that match journalist's specializations
      const journalistProfile = await JournalistProfile.findOne({ userId: req.user._id });
      if (journalistProfile && journalistProfile.professional.specializations) {
        filter['targeting.journalistSpecializations'] = {
          $in: journalistProfile.professional.specializations
        };
      }
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const products = await Product.find(filter)
      .populate('companyId', 'name email')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Product.countDocuments(filter);

    // Increment view count for browsed products
    await Product.updateMany(
      { _id: { $in: products.map(p => p._id) } },
      { $inc: { 'analytics.views': 1 } }
    );

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

// Get single product details
router.get('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('companyId', 'name email profile')
      .exec();

    if (!product || product.status !== 'active') {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Increment detailed view count
    await Product.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.views': 1 }
    });

    // Check if user has already requested this product
    let hasRequested = false;
    if (req.user.role === 'journalist') {
      const existingRequest = await ReviewRequest.findOne({
        productId: req.params.id,
        journalistId: req.user._id
      });
      hasRequested = !!existingRequest;
    }

    res.json({
      product,
      hasRequested,
      canRequest: req.user.role === 'journalist' && !hasRequested
    });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

// Create new product (companies only)
router.post('/products', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can create products' });
    }

    const productData = {
      ...req.body,
      companyId: req.user._id,
      status: 'draft'
    };

    const product = new Product(productData);
    await product.save();

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
});

// Update product (company owners only)
router.put('/products/:id', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated: new Date() },
      { new: true }
    );

    res.json(updatedProduct);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
});

// REVIEW REQUEST ROUTES

// Create review request (journalists only)
router.post('/requests', auth, async (req, res) => {
  try {
    if (req.user.role !== 'journalist') {
      return res.status(403).json({ message: 'Only journalists can create review requests' });
    }

    const { productId, pitchMessage, proposedOutlet, estimatedReach, plannedAngle, estimatedPublishDate, audienceData } = req.body;

    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ message: 'Product not found or not available' });
    }

    // Check if journalist already has a request for this product
    const existingRequest = await ReviewRequest.findOne({
      productId,
      journalistId: req.user._id
    });

    if (existingRequest) {
      return res.status(400).json({ message: 'You have already requested this product' });
    }

    const reviewRequest = new ReviewRequest({
      productId,
      journalistId: req.user._id,
      companyId: product.companyId,
      requestInfo: {
        pitchMessage,
        proposedOutlet,
        estimatedReach,
        plannedAngle,
        estimatedPublishDate,
        audienceData
      }
    });

    await reviewRequest.save();

    // Update product analytics
    await Product.findByIdAndUpdate(productId, {
      $inc: { 'analytics.requests': 1 }
    });

    res.status(201).json(reviewRequest);
  } catch (error) {
    console.error('Create review request error:', error);
    res.status(500).json({ message: 'Failed to create review request' });
  }
});

// Get review requests (companies see requests for their products, journalists see their requests)
router.get('/requests', auth, async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'company') {
      filter.companyId = req.user._id;
    } else if (req.user.role === 'journalist') {
      filter.journalistId = req.user._id;
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { status, page = 1, limit = 20 } = req.query;
    if (status) {
      filter['companyReview.status'] = status;
    }

    const requests = await ReviewRequest.find(filter)
      .populate('productId', 'productInfo media campaign')
      .populate('journalistId', 'name email')
      .populate('companyId', 'name email')
      .sort({ created: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await ReviewRequest.countDocuments(filter);

    res.json({
      requests,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get review requests error:', error);
    res.status(500).json({ message: 'Failed to fetch review requests' });
  }
});

// Update request status (companies only)
router.put('/requests/:id/status', auth, async (req, res) => {
  try {
    const { status, reviewNotes, requestedChanges } = req.body;
    
    const request = await ReviewRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    request.companyReview.status = status;
    request.companyReview.reviewDate = new Date();
    request.companyReview.reviewNotes = reviewNotes;
    request.companyReview.requestedChanges = requestedChanges;
    request.companyReview.approvedBy = req.user._id;
    request.updated = new Date();

    await request.save();

    // Update product analytics
    if (status === 'approved') {
      await Product.findByIdAndUpdate(request.productId, {
        $inc: { 'analytics.approved': 1 }
      });
    }

    res.json(request);
  } catch (error) {
    console.error('Update request status error:', error);
    res.status(500).json({ message: 'Failed to update request status' });
  }
});

// Submit coverage (journalists only)
router.post('/requests/:id/coverage', auth, async (req, res) => {
  try {
    const { coverageUrl, wordCount, reviewScore, includesPhotos, includesVideo, sentiment } = req.body;
    
    const request = await ReviewRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.journalistId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    request.reviewCompletion = {
      status: 'submitted',
      submittedDate: new Date(),
      coverageUrl,
      wordCount,
      reviewScore,
      includesPhotos,
      includesVideo,
      sentiment
    };
    request.updated = new Date();

    await request.save();

    // Create coverage verification record
    const verification = new CoverageVerification({
      reviewRequestId: request._id,
      submittedCoverage: {
        url: coverageUrl,
        wordCount,
        // Additional fields can be populated by web scraping
      }
    });
    await verification.save();

    // Update product analytics
    await Product.findByIdAndUpdate(request.productId, {
      $inc: { 'analytics.completed': 1 }
    });

    res.json(request);
  } catch (error) {
    console.error('Submit coverage error:', error);
    res.status(500).json({ message: 'Failed to submit coverage' });
  }
});

// ANALYTICS AND REPORTING ROUTES

// Get campaign analytics (companies only)
router.get('/analytics/campaigns/:productId', auth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product || product.companyId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Product not found or access denied' });
    }

    const requests = await ReviewRequest.find({ productId: req.params.productId })
      .populate('journalistId', 'name email')
      .exec();

    const analytics = {
      overview: {
        totalRequests: requests.length,
        approvedRequests: requests.filter(r => r.companyReview.status === 'approved').length,
        completedReviews: requests.filter(r => r.reviewCompletion.status === 'submitted').length,
        totalInvestment: product.campaign.budget,
        averageReviewScore: 0,
        totalReach: 0
      },
      requests: requests,
      performance: product.analytics
    };

    // Calculate averages
    const completedReviews = requests.filter(r => r.reviewCompletion.reviewScore);
    if (completedReviews.length > 0) {
      analytics.overview.averageReviewScore = completedReviews.reduce((sum, r) => sum + r.reviewCompletion.reviewScore, 0) / completedReviews.length;
      analytics.overview.totalReach = requests.reduce((sum, r) => sum + (r.requestInfo.estimatedReach || 0), 0);
    }

    res.json(analytics);
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

// Get journalist performance analytics
router.get('/analytics/journalist/:journalistId', auth, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.journalistId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const requests = await ReviewRequest.find({ journalistId: req.params.journalistId })
      .populate('productId', 'productInfo campaign')
      .exec();

    const analytics = {
      overview: {
        totalRequests: requests.length,
        approvedRequests: requests.filter(r => r.companyReview.status === 'approved').length,
        completedReviews: requests.filter(r => r.reviewCompletion.status === 'submitted').length,
        averageRating: 0,
        totalProductValue: 0,
        completionRate: 0
      },
      recentActivity: requests.slice(0, 10),
      performance: {
        byCategory: {},
        byMonth: {}
      }
    };

    // Calculate performance metrics
    if (requests.length > 0) {
      const ratingsReceived = requests.filter(r => r.feedback.journalistRating?.rating);
      if (ratingsReceived.length > 0) {
        analytics.overview.averageRating = ratingsReceived.reduce((sum, r) => sum + r.feedback.journalistRating.rating, 0) / ratingsReceived.length;
      }
      
      analytics.overview.totalProductValue = requests.reduce((sum, r) => sum + (r.productId?.productInfo?.msrp || 0), 0);
      analytics.overview.completionRate = (analytics.overview.completedReviews / analytics.overview.approvedRequests) * 100;
    }

    res.json(analytics);
  } catch (error) {
    console.error('Get journalist analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics' });
  }
});

module.exports = router;