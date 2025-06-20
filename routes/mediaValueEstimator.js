const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const MediaValueEstimatorService = require('../services/mediaValueEstimatorService');

// Initialize the enhanced MVE service
const mveService = new MediaValueEstimatorService();

// Rate limiting for MVE API
const mveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 calculations per 15 minutes per IP
  message: {
    error: 'Too many value calculations. Please try again later.',
    retryAfter: '15 minutes'
  }
});

// Basic auth middleware (integrate with your existing auth)
const auth = require('../middleware/auth'); // Your existing auth middleware

// Check calculation limits for free users
const checkCalculationLimits = (req, res, next) => {
  const user = req.user;
  
  if (user.plan === 'free') {
    if (user.mveUsage.calculationsToday >= user.mveUsage.dailyLimit) {
      return res.status(429).json({
        error: 'Daily calculation limit reached',
        limit: user.mveUsage.dailyLimit,
        used: user.mveUsage.calculationsToday,
        plan: user.plan,
        upgradeRequired: true,
        message: 'Upgrade to Pro for unlimited media value calculations'
      });
    }
  }
  next();
};

// NEW: Auto-populate publication data from UVM
router.get('/publication-data/:domain',
  auth,
  async (req, res) => {
    try {
      const { domain } = req.params;
      
      console.log(`Getting publication data for: ${domain}`);
      
      // Get UVM data
      const uvmData = await mveService.getUVMData(domain);
      
      if (uvmData) {
        // Convert UVM data to MVE-friendly format
        const publicationData = {
          domain: domain,
          publicationTier: uvmData.tier,
          domainAuthority: uvmData.domainAuthority,
          globalRank: uvmData.globalRank,
          monthlyVisitors: uvmData.monthlyVisitors,
          confidence: uvmData.confidence,
          dataSource: uvmData.source,
          
          // Provide engagement estimates for different placements
          reachEstimates: {
            homepage_featured: uvmData.monthlyVisitors ? Math.round(uvmData.monthlyVisitors * 0.15) : null,
            category_featured: uvmData.monthlyVisitors ? Math.round(uvmData.monthlyVisitors * 0.08) : null,
            standard_article: uvmData.monthlyVisitors ? Math.round(uvmData.monthlyVisitors * 0.03) : null,
            newsletter_feature: uvmData.monthlyVisitors ? Math.round(uvmData.monthlyVisitors * 0.25) : null,
            buried_mention: uvmData.monthlyVisitors ? Math.round(uvmData.monthlyVisitors * 0.01) : null
          }
        };
        
        res.json({
          success: true,
          found: true,
          data: publicationData,
          message: 'Publication data loaded from UVM analytics'
        });
        
      } else {
        // No UVM data available - provide fallback estimates
        res.json({
          success: true,
          found: false,
          data: {
            domain: domain,
            publicationTier: 'tier-3', // Default
            domainAuthority: null,
            globalRank: null,
            monthlyVisitors: null,
            confidence: 'low',
            dataSource: 'fallback_estimates',
            reachEstimates: {
              homepage_featured: 15000,
              category_featured: 8000,
              standard_article: 3000,
              newsletter_feature: 5000,
              buried_mention: 1000
            }
          },
          message: 'No UVM data available. Using default estimates. Run UVM analysis for better accuracy.'
        });
      }
      
    } catch (error) {
      console.error('Publication data error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get publication data',
        message: error.message 
      });
    }
  }
);

// ENHANCED: Calculate media value with UVM integration
router.post('/calculate', 
  mveLimiter,
  auth,
  checkCalculationLimits,
  async (req, res) => {
    try {
      console.log(`MVE calculation request by user ${req.user._id}`);
      
      // Enhanced parameters with UVM integration flags
      const params = {
        // Basic publication info
        publicationDomain: req.body.publicationDomain,
        publicationTier: req.body.publicationTier || 'tier-3',
        mediaType: req.body.mediaType || 'digital',
        
        // NEW: UVM integration controls
        useUVMData: req.body.useUVMData !== false, // Default to true
        autoCalculateReach: req.body.autoCalculateReach !== false, // Default to true
        
        // Content details
        contentType: req.body.contentType || 'standard_article',
        wordCount: parseInt(req.body.wordCount) || 500,
        
        // Placement and timing (enhanced options)
        placement: req.body.placement || 'standard_article',
        timing: req.body.timing || 'evergreen',
        exclusivity: req.body.exclusivity || 'standard',
        
        // Reach data (manual override if provided)
        estimatedReach: req.body.estimatedReach ? parseInt(req.body.estimatedReach) : null,
        actualImpressions: req.body.actualImpressions ? parseInt(req.body.actualImpressions) : null,
        
        // SEO factors
        domainAuthority: req.body.domainAuthority ? parseInt(req.body.domainAuthority) : null,
        backlink: req.body.backlink !== false,
        estimatedReferralTraffic: req.body.estimatedReferralTraffic ? parseInt(req.body.estimatedReferralTraffic) : null,
        
        // Industry context
        industry: req.body.industry || 'default',
        targetAudience: req.body.targetAudience || 'general',
        
        // Sentiment and quality
        sentiment: req.body.sentiment || 'neutral',
        
        // Custom overrides
        customCPM: req.body.customCPM ? parseFloat(req.body.customCPM) : null,
        customCPC: req.body.customCPC ? parseFloat(req.body.customCPC) : null,
        customContentCost: req.body.customContentCost ? parseFloat(req.body.customContentCost) : null,
        
        // Additional factors
        socialAmplification: req.body.socialAmplification !== false,
        brandMention: req.body.brandMention !== false,
        executiveQuotes: req.body.executiveQuotes === true,
        productMention: req.body.productMention === true,
        
        // Campaign context
        campaignCost: req.body.campaignCost ? parseFloat(req.body.campaignCost) : null
      };
      
      // Perform the enhanced calculation
      const result = await mveService.calculateMediaValue(params);
      
      if (!result.success) {
        return res.status(500).json({
          error: 'Calculation failed',
          message: result.error
        });
      }
      
      // Track usage for free users
      if (req.user.plan === 'free') {
        req.user.mveUsage.calculationsToday++;
        console.log(`Free user calculation count: ${req.user.mveUsage.calculationsToday}/${req.user.mveUsage.dailyLimit}`);
      }
      
      // Enhanced response with UVM insights
      const response = {
        ...result,
        usage: {
          plan: req.user.plan,
          calculationsRemaining: req.user.plan === 'free' 
            ? req.user.mveUsage.dailyLimit - req.user.mveUsage.calculationsToday
            : 'unlimited'
        },
        // NEW: Include UVM integration status
        dataEnhancement: {
          uvmIntegrated: !!result.uvmInsights,
          calculationMethod: result.calculationMethod || 'standard',
          dataConfidence: result.dataConfidence || result.calculationDetails.confidence,
          enhancedFeatures: result.uvmInsights ? [
            'Real publication traffic data',
            'Engagement rate modeling', 
            'Authority-based adjustments',
            'Automated reach calculation'
          ] : ['Standard industry benchmarks']
        }
      };
      
      res.json(response);
      
    } catch (error) {
      console.error('MVE calculation error:', error);
      res.status(500).json({
        error: 'Media value calculation failed',
        message: error.message
      });
    }
  }
);

// NEW: Get reach estimates for different placements (helper endpoint)
router.post('/reach-estimates',
  auth,
  async (req, res) => {
    try {
      const { publicationDomain, contentType = 'standard_article' } = req.body;
      
      if (!publicationDomain) {
        return res.status(400).json({ error: 'Publication domain is required' });
      }
      
      // Get UVM data
      const uvmData = await mveService.getUVMData(publicationDomain);
      
      if (!uvmData || !uvmData.monthlyVisitors) {
        return res.json({
          success: false,
          message: 'UVM data not available for reach estimates',
          fallbackEstimates: {
            homepage_featured: 15000,
            category_featured: 8000,
            standard_article: 3000,
            newsletter_feature: 5000,
            buried_mention: 1000
          }
        });
      }
      
      // Calculate estimates for all placement types
      const placements = ['homepage_featured', 'category_featured', 'standard_article', 'newsletter_feature', 'buried_mention'];
      const estimates = {};
      
      for (const placement of placements) {
        const reachCalc = mveService.calculateReachFromUVM(uvmData, {
          contentType,
          placement,
          timing: 'evergreen'
        });
        
        estimates[placement] = {
          primaryImpressions: reachCalc.primaryImpressions,
          socialImpressions: reachCalc.socialImpressions,
          totalImpressions: reachCalc.totalImpressions,
          engagementRate: reachCalc.methodology.engagementRate
        };
      }
      
      res.json({
        success: true,
        domain: publicationDomain,
        monthlyVisitors: uvmData.monthlyVisitors,
        estimates,
        dataSource: 'uvm_analytics'
      });
      
    } catch (error) {
      console.error('Reach estimates error:', error);
      res.status(500).json({ error: 'Failed to calculate reach estimates' });
    }
  }
);

// NEW: Batch calculation with UVM integration
router.post('/batch',
  mveLimiter,
  auth,
  async (req, res) => {
    try {
      if (req.user.plan === 'free') {
        return res.status(403).json({
          error: 'Batch calculations require Pro subscription',
          upgradeRequired: true,
          feature: 'batch_calculations'
        });
      }
      
      const { calculations } = req.body;
      
      if (!Array.isArray(calculations) || calculations.length === 0) {
        return res.status(400).json({ error: 'Calculations array is required' });
      }
      
      if (calculations.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 calculations per batch' });
      }
      
      console.log(`Batch MVE calculation for ${calculations.length} items by user ${req.user._id}`);
      
      const results = [];
      let totalValue = 0;
      let uvmEnhancedCount = 0;
      
      for (const [index, params] of calculations.entries()) {
        try {
          // Enable UVM integration by default for batch calculations
          const enhancedParams = {
            ...params,
            useUVMData: params.useUVMData !== false
          };
          
          const result = await mveService.calculateMediaValue(enhancedParams);
          
          results.push({
            index,
            success: true,
            data: result,
            totalValue: result.totalValue,
            uvmEnhanced: !!result.uvmInsights
          });
          
          totalValue += result.totalValue;
          if (result.uvmInsights) uvmEnhancedCount++;
          
        } catch (error) {
          results.push({
            index,
            success: false,
            error: error.message,
            totalValue: 0,
            uvmEnhanced: false
          });
        }
      }
      
      res.json({
        results,
        summary: {
          totalCalculations: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          totalEstimatedValue: totalValue,
          averageValue: totalValue / results.filter(r => r.success).length || 0,
          uvmEnhanced: uvmEnhancedCount,
          uvmEnhancementRate: `${Math.round((uvmEnhancedCount / results.length) * 100)}%`
        }
      });
      
    } catch (error) {
      console.error('Batch MVE calculation error:', error);
      res.status(500).json({
        error: 'Batch calculation failed',
        message: error.message
      });
    }
  }
);

// ENHANCED: Get benchmarks with UVM context
router.get('/benchmarks', auth, (req, res) => {
  try {
    const benchmarks = mveService.getIndustryBenchmarks();
    
    res.json({
      benchmarks,
      industries: [
        { value: 'technology', label: 'Technology' },
        { value: 'finance', label: 'Finance & Banking' },
        { value: 'healthcare', label: 'Healthcare' },
        { value: 'retail', label: 'Retail & E-commerce' },
        { value: 'default', label: 'General/Other' }
      ],
      publicationTiers: [
        { value: 'tier-1', label: 'Premium (Tier 1)', description: 'Top-tier publications like TechCrunch, Forbes' },
        { value: 'tier-2', label: 'High-Quality (Tier 2)', description: 'Established industry publications' },
        { value: 'tier-3', label: 'Standard (Tier 3)', description: 'Local news, niche blogs' },
        { value: 'tier-4', label: 'Emerging (Tier 4)', description: 'New blogs, personal sites' }
      ],
      mediaTypes: [
        { value: 'digital', label: 'Digital/Online' },
        { value: 'print', label: 'Print Media' },
        { value: 'tv', label: 'Television' },
        { value: 'radio', label: 'Radio' },
        { value: 'podcast', label: 'Podcast' }
      ],
      contentTypes: [
        { value: 'standard_article', label: 'Standard Article' },
        { value: 'feature_article', label: 'Feature Article' },
        { value: 'breaking_news', label: 'Breaking News' },
        { value: 'product_review', label: 'Product Review' },
        { value: 'interview', label: 'Interview' },
        { value: 'press_release', label: 'Press Release' },
        { value: 'guest_post', label: 'Guest Post' },
        { value: 'award_announcement', label: 'Award Announcement' }
      ],
      // NEW: Placement options with engagement rates
      placementTypes: [
        { value: 'homepage_featured', label: 'Homepage Featured', engagementRate: '15%', description: 'Featured prominently on homepage' },
        { value: 'category_featured', label: 'Category Featured', engagementRate: '8%', description: 'Featured in relevant category' },
        { value: 'standard_article', label: 'Standard Article', engagementRate: '3%', description: 'Regular article placement' },
        { value: 'newsletter_feature', label: 'Newsletter Feature', engagementRate: '25%', description: 'Featured in newsletter' },
        { value: 'social_exclusive', label: 'Social Media Only', engagementRate: '5%', description: 'Social media exclusive' },
        { value: 'buried_mention', label: 'Buried Mention', engagementRate: '1%', description: 'Minor mention or buried content' }
      ],
      // NEW: UVM integration info
      uvmIntegration: {
        available: true,
        benefits: [
          'Automatic reach calculation based on real publication data',
          'Enhanced accuracy with actual traffic numbers',
          'Authority-based value adjustments',
          'Confidence scoring based on data quality'
        ],
        requirements: [
          'Publication must be in UVM database',
          'UVM analysis must be available for the domain'
        ]
      }
    });
  } catch (error) {
    console.error('Benchmarks error:', error);
    res.status(500).json({ error: 'Failed to get benchmarks' });
  }
});

// NEW: UVM integration status endpoint
router.get('/uvm-status/:domain', auth, async (req, res) => {
  try {
    const { domain } = req.params;
    
    const uvmData = await mveService.getUVMData(domain);
    
    res.json({
      domain,
      uvmAvailable: !!uvmData,
      data: uvmData,
      integrationBenefits: uvmData ? [
        'Automatic reach calculation',
        'Enhanced accuracy',
        'Authority-based adjustments'
      ] : [],
      recommendation: uvmData ? 
        'UVM data available - calculations will be enhanced' :
        'Run UVM analysis first for better accuracy'
    });
    
  } catch (error) {
    console.error('UVM status error:', error);
    res.status(500).json({ error: 'Failed to check UVM status' });
  }
});

// Keep existing endpoints: usage, quick-estimate, export, health
router.get('/usage', auth, (req, res) => {
  try {
    const userUsage = {
      plan: req.user.plan,
      calculationsToday: req.user.mveUsage?.calculationsToday || 0,
      dailyLimit: req.user.mveUsage?.dailyLimit || 10,
      calculationsRemaining: req.user.plan === 'free' 
        ? Math.max(0, (req.user.mveUsage?.dailyLimit || 10) - (req.user.mveUsage?.calculationsToday || 0))
        : 'unlimited'
    };
    
    res.json({ user: userUsage });
  } catch (error) {
    console.error('MVE usage stats error:', error);
    res.status(500).json({ error: 'Failed to get usage statistics' });
  }
});

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Enhanced Media Value Estimator API',
    uvmIntegration: 'enabled',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('Enhanced MVE API error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

module.exports = router;