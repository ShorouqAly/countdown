const axios = require('axios');

class MediaValueEstimatorService {
  constructor() {
    // Enhanced engagement rates for different content placements
    this.engagementRates = {
      // Percentage of monthly visitors who see specific content types
      placement: {
        'homepage_featured': 0.15,     // 15% see homepage featured
        'category_featured': 0.08,     // 8% see category featured  
        'standard_article': 0.03,      // 3% see standard articles
        'newsletter_feature': 0.25,    // 25% of subscribers
        'social_exclusive': 0.05,      // 5% through social only
        'buried_mention': 0.01         // 1% see buried content
      },
      
      // Content type engagement multipliers
      contentType: {
        'breaking_news': 1.8,          // Breaking news gets 80% more views
        'product_review': 1.4,         // Reviews get 40% more views
        'feature_article': 1.2,        // Features get 20% more views
        'interview': 1.1,              // Interviews get 10% more views
        'press_release': 0.8,          // Press releases get 20% fewer
        'guest_post': 0.9,             // Guest posts get 10% fewer
        'award_announcement': 1.3,     // Awards get 30% more views
        'standard_article': 1.0        // Baseline
      }
    };

    // Social sharing rates by publication tier
    this.socialSharingRates = {
      'tier-1': 0.12,    // 12% of readers share tier-1 content
      'tier-2': 0.08,    // 8% share tier-2 content
      'tier-3': 0.05,    // 5% share tier-3 content  
      'tier-4': 0.03     // 3% share tier-4 content
    };

    // Industry benchmarks (existing code)
    this.benchmarks = {
      cpm: {
        'tier-1': { print: 15, digital: 8, tv: 25, radio: 12, podcast: 18 },
        'tier-2': { print: 10, digital: 5, tv: 18, radio: 8, podcast: 12 },
        'tier-3': { print: 6, digital: 3, tv: 12, radio: 5, podcast: 8 },
        'tier-4': { print: 3, digital: 1.5, tv: 6, radio: 3, podcast: 4 }
      },
      cpc: {
        technology: { average: 2.50, high: 8.00 },
        finance: { average: 3.75, high: 12.00 },
        healthcare: { average: 2.25, high: 7.50 },
        retail: { average: 1.50, high: 5.00 },
        default: { average: 2.00, high: 6.00 }
      },
      contentCreation: {
        article: { basic: 200, standard: 500, premium: 1200 },
        video: { basic: 800, standard: 2500, premium: 8000 },
        podcast: { basic: 300, standard: 800, premium: 2000 },
        infographic: { basic: 400, standard: 1000, premium: 2500 }
      },
      multipliers: {
        sentiment: { positive: 1.2, neutral: 1.0, negative: 0.3 },
        timing: { breaking: 1.8, trending: 1.4, evergreen: 1.0, outdated: 0.6 },
        placement: { headline: 2.0, featured: 1.5, standard: 1.0, buried: 0.5 },
        format: { video: 1.6, audio: 1.3, image: 1.2, text: 1.0 },
        exclusivity: { exclusive: 2.5, firstToReport: 2.0, embargo: 1.5, standard: 1.0 }
      }
    };
  }

  // NEW: Main calculation method with UVM integration
  async calculateMediaValue(params) {
    const {
      publicationDomain,
      useUVMData = true,    // NEW: Flag to use UVM integration
      estimatedReach = null, // Will be calculated from UVM if not provided
      actualImpressions = null,
      // ... all other existing parameters
    } = params;

    try {
      let enhancedParams = { ...params };
      let uvmData = null;
      let calculationMethod = 'manual_estimates';

      // NEW: Try to get UVM data and calculate reach automatically
      if (publicationDomain && useUVMData) {
        try {
          uvmData = await this.getUVMData(publicationDomain);
          
          if (uvmData && uvmData.monthlyVisitors) {
            // Calculate estimated reach using UVM data + engagement rates
            const calculatedReach = this.calculateReachFromUVM(uvmData, params);
            
            enhancedParams = {
              ...params,
              estimatedReach: actualImpressions || calculatedReach.primaryImpressions,
              socialReach: calculatedReach.socialImpressions,
              uvmData: uvmData,
              reachCalculation: calculatedReach
            };
            
            calculationMethod = 'uvm_integrated';
            
            console.log(`UVM Integration: ${publicationDomain} - ${calculatedReach.primaryImpressions} estimated impressions`);
          }
        } catch (uvmError) {
          console.log(`UVM integration failed for ${publicationDomain}, using manual estimates:`, uvmError.message);
          // Continue with manual estimates if UVM fails
        }
      }

      // Use enhanced parameters for calculation
      const result = await this.performCalculation(enhancedParams);
      
      // Add UVM-specific insights if available
      if (uvmData) {
        result.uvmInsights = this.generateUVMInsights(uvmData, enhancedParams.reachCalculation);
        result.calculationMethod = calculationMethod;
        result.dataConfidence = this.calculateEnhancedConfidence(uvmData);
      }

      return result;

    } catch (error) {
      console.error('Media value calculation error:', error);
      throw error;
    }
  }

  // NEW: Get UVM data from our analytics service  
  async getUVMData(domain) {
    try {
      // Try quick lookup first (cached data)
      const response = await axios.get(`http://localhost:3000/api/analytics/quick-lookup/${domain}`, {
        timeout: 5000
      });

      if (response.data && response.data.cached) {
        return {
          domain: domain,
          monthlyVisitors: response.data.estimatedMonthlyVisitors,
          domainAuthority: response.data.domainAuthority,
          globalRank: response.data.globalRank,
          tier: response.data.tier,
          confidence: response.data.confidence,
          source: 'uvm_cached'
        };
      } else {
        // If no cached data, try full analysis
        const fullResponse = await axios.get(`http://localhost:3000/api/analytics/uvm/${domain}`, {
          timeout: 10000
        });

        if (fullResponse.data && fullResponse.data.combined) {
          return {
            domain: domain,
            monthlyVisitors: fullResponse.data.combined.estimatedMonthlyVisitors,
            domainAuthority: fullResponse.data.combined.domainAuthority,
            globalRank: fullResponse.data.combined.globalRank,
            tier: fullResponse.data.combined.tier,
            confidence: fullResponse.data.combined.confidence,
            source: 'uvm_live'
          };
        }
      }

      return null;

    } catch (error) {
      console.error(`Failed to get UVM data for ${domain}:`, error.message);
      return null;
    }
  }

  // NEW: Calculate reach from UVM data using engagement rates
  calculateReachFromUVM(uvmData, params) {
    const {
      contentType = 'standard_article',
      placement = 'standard_article', 
      timing = 'evergreen',
      mediaType = 'digital'
    } = params;

    let monthlyVisitors = uvmData.monthlyVisitors;

    // Fallback to tier-based estimates if no visitor data
    if (!monthlyVisitors) {
      const tierDefaults = {
        'tier-1': 1500000,   // 1.5M monthly visitors
        'tier-2': 400000,    // 400K monthly visitors
        'tier-3': 100000,    // 100K monthly visitors
        'tier-4': 30000      // 30K monthly visitors
      };
      monthlyVisitors = tierDefaults[uvmData.tier] || 100000;
    }

    // Get base engagement rate for placement
    const baseEngagement = this.engagementRates.placement[placement] || 0.03;
    
    // Apply content type multiplier
    const contentMultiplier = this.engagementRates.contentType[contentType] || 1.0;
    
    // Apply timing multiplier
    const timingMultiplier = timing === 'breaking' ? 1.8 : 
                           timing === 'trending' ? 1.4 : 1.0;

    // Calculate primary impressions (people who see the content)
    const primaryImpressions = Math.round(
      monthlyVisitors * baseEngagement * contentMultiplier * timingMultiplier
    );

    // Calculate social amplification
    const sharingRate = this.socialSharingRates[uvmData.tier] || 0.05;
    const avgReachPerShare = 150; // Average social media reach per share
    const socialShares = Math.round(primaryImpressions * sharingRate);
    const socialImpressions = socialShares * avgReachPerShare;

    return {
      primaryImpressions: primaryImpressions,
      socialImpressions: socialImpressions,
      totalImpressions: primaryImpressions + socialImpressions,
      methodology: {
        baseMonthlyVisitors: monthlyVisitors,
        engagementRate: baseEngagement * contentMultiplier * timingMultiplier,
        socialSharingRate: sharingRate,
        calculationSource: 'uvm_engagement_modeling'
      }
    };
  }

  // Existing calculation method (updated to handle UVM data)
  async performCalculation(params) {
    const {
      publicationTier = 'tier-3',
      mediaType = 'digital',
      contentType = 'article',
      wordCount = 500,
      estimatedReach = null,
      actualImpressions = null,
      placement = 'standard',
      sentiment = 'neutral',
      timing = 'evergreen',
      exclusivity = 'standard',
      domainAuthority = null,
      backlink = true,
      estimatedReferralTraffic = null,
      industry = 'default',
      targetAudience = 'general',
      customCPM = null,
      customCPC = null,
      customContentCost = null,
      socialAmplification = true,
      brandMention = true,
      executiveQuotes = false,
      productMention = false,
      campaignCost = null,
      uvmData = null,
      socialReach = null
    } = params;

    try {
      // Use UVM data if available, otherwise fallback to manual estimates
      const impressions = actualImpressions || estimatedReach || 10000;
      const effectiveDomainAuthority = uvmData?.domainAuthority || domainAuthority;
      const effectiveTier = uvmData?.tier || publicationTier;

      // 1. Calculate Advertising Value Equivalency (AVE)
      const aveValue = this.calculateAVE({
        publicationTier: effectiveTier,
        mediaType,
        estimatedReach: impressions,
        actualImpressions,
        customCPM,
        placement,
        timing,
        exclusivity,
        uvmData // Pass UVM data for enhanced CPM calculations
      });

      // 2. Calculate SEO Value (enhanced with UVM data)
      const seoValue = this.calculateSEOValue({
        domainAuthority: effectiveDomainAuthority,
        backlink,
        estimatedReferralTraffic,
        industry,
        customCPC,
        publicationTier: effectiveTier,
        uvmData
      });

      // 3. Calculate Content Creation & Licensing Value
      const contentValue = this.calculateContentValue({
        contentType,
        wordCount,
        publicationTier: effectiveTier,
        customContentCost,
        executiveQuotes,
        productMention
      });

      // 4. Calculate Social Media Amplification Value (enhanced)
      const socialValue = this.calculateSocialValue({
        estimatedReach: impressions,
        publicationTier: effectiveTier,
        socialAmplification,
        contentType,
        socialReach // Use calculated social reach if available
      });

      // 5. Calculate Brand Authority Value
      const brandValue = this.calculateBrandValue({
        publicationTier: effectiveTier,
        placement,
        brandMention,
        sentiment,
        exclusivity,
        uvmData
      });

      // 6. Apply sentiment and other multipliers
      const baseValue = aveValue + seoValue + contentValue + socialValue + brandValue;
      const sentimentMultiplier = this.benchmarks.multipliers.sentiment[sentiment];
      
      const totalValue = Math.round(baseValue * sentimentMultiplier);

      // 7. Generate detailed breakdown and insights
      const breakdown = {
        advertisingValueEquivalency: Math.round(aveValue),
        seoValue: Math.round(seoValue),
        contentCreationValue: Math.round(contentValue),
        socialAmplificationValue: Math.round(socialValue),
        brandAuthorityValue: Math.round(brandValue),
        sentimentMultiplier,
        totalEstimatedValue: totalValue
      };

      const insights = this.generateInsights(breakdown, params);
      const benchmarkComparison = this.generateBenchmarkComparison(totalValue, params);
      const actionableRecommendations = this.generateRecommendations(breakdown, params);

      return {
        success: true,
        totalValue,
        breakdown,
        insights,
        benchmarkComparison,
        actionableRecommendations,
        calculationDetails: {
          methodology: uvmData ? 'UVM-Enhanced Media Value Analysis' : 'Standard Media Value Analysis',
          factors: Object.keys(breakdown).length,
          confidence: uvmData ? this.calculateEnhancedConfidence(uvmData) : this.calculateConfidenceLevel(params),
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('Media value calculation error:', error);
      return {
        success: false,
        error: error.message,
        totalValue: 0
      };
    }
  }

  // Enhanced AVE calculation with UVM context
  calculateAVE({ publicationTier, mediaType, estimatedReach, actualImpressions, customCPM, placement, timing, exclusivity, uvmData }) {
    const impressions = actualImpressions || estimatedReach || 10000;
    let baseCPM = customCPM || this.benchmarks.cpm[publicationTier][mediaType] || 5;
    
    // NEW: Adjust CPM based on UVM data (larger publications = higher CPM)
    if (uvmData && uvmData.monthlyVisitors) {
      if (uvmData.monthlyVisitors > 5000000) baseCPM *= 1.3;      // 5M+ monthly = premium CPM
      else if (uvmData.monthlyVisitors > 1000000) baseCPM *= 1.1; // 1M+ monthly = elevated CPM
      else if (uvmData.monthlyVisitors < 50000) baseCPM *= 0.8;   // <50K monthly = reduced CPM
    }
    
    // Apply existing multipliers
    const placementMultiplier = this.benchmarks.multipliers.placement[placement];
    const timingMultiplier = this.benchmarks.multipliers.timing[timing];
    const exclusivityMultiplier = this.benchmarks.multipliers.exclusivity[exclusivity];
    
    const adjustedCPM = baseCPM * placementMultiplier * timingMultiplier * exclusivityMultiplier;
    
    return (adjustedCPM * impressions) / 1000;
  }

  // Enhanced SEO calculation with UVM data
  calculateSEOValue({ domainAuthority, backlink, estimatedReferralTraffic, industry, customCPC, publicationTier, uvmData }) {
    if (!backlink) return 0;
    
    const industryBenchmark = this.benchmarks.cpc[industry] || this.benchmarks.cpc.default;
    const cpc = customCPC || industryBenchmark.average;
    
    // Enhanced traffic estimation using UVM data
    let traffic = estimatedReferralTraffic;
    if (!traffic && domainAuthority) {
      const baseTraffic = Math.round((domainAuthority / 10) * 50);
      
      // NEW: Adjust based on UVM global rank data
      let rankMultiplier = 1.0;
      if (uvmData && uvmData.globalRank) {
        if (uvmData.globalRank <= 10000) rankMultiplier = 2.0;
        else if (uvmData.globalRank <= 50000) rankMultiplier = 1.5;
        else if (uvmData.globalRank <= 100000) rankMultiplier = 1.2;
      }
      
      traffic = Math.round(baseTraffic * rankMultiplier);
    } else if (!traffic) {
      const tierTraffic = { 'tier-1': 200, 'tier-2': 100, 'tier-3': 50, 'tier-4': 25 };
      traffic = tierTraffic[publicationTier] || 25;
    }
    
    const paidTrafficValue = traffic * cpc;
    
    // Enhanced link authority value
    const linkAuthorityValue = domainAuthority ? (domainAuthority * 8) : 100; // Higher multiplier
    
    return paidTrafficValue + linkAuthorityValue;
  }

  // Enhanced social value calculation
  calculateSocialValue({ estimatedReach, publicationTier, socialAmplification, contentType, socialReach }) {
    if (!socialAmplification) return 0;
    
    // Use calculated social reach if available, otherwise estimate
    let socialImpressions;
    if (socialReach) {
      socialImpressions = socialReach;
    } else {
      const baseSocialReach = estimatedReach ? estimatedReach * 0.1 : 
                             { 'tier-1': 5000, 'tier-2': 2000, 'tier-3': 800, 'tier-4': 300 }[publicationTier];
      socialImpressions = baseSocialReach;
    }
    
    const socialCPM = 7;
    const formatMultiplier = this.benchmarks.multipliers.format[contentType === 'video' ? 'video' : 'text'];
    
    return (socialCPM * socialImpressions * formatMultiplier) / 1000;
  }

  // Enhanced brand value with UVM context
  calculateBrandValue({ publicationTier, placement, brandMention, sentiment, exclusivity, uvmData }) {
    if (!brandMention) return 0;
    
    let baseBrandValue = { 'tier-1': 2000, 'tier-2': 1000, 'tier-3': 500, 'tier-4': 250 }[publicationTier];
    
    // NEW: Adjust brand value based on publication authority
    if (uvmData && uvmData.domainAuthority) {
      const authorityMultiplier = 1 + (uvmData.domainAuthority / 200); // DA 100 = 1.5x multiplier
      baseBrandValue *= authorityMultiplier;
    }
    
    const placementMultiplier = this.benchmarks.multipliers.placement[placement];
    const exclusivityMultiplier = this.benchmarks.multipliers.exclusivity[exclusivity];
    
    return baseBrandValue * placementMultiplier * exclusivityMultiplier;
  }

  // NEW: Generate UVM-specific insights
  generateUVMInsights(uvmData, reachCalculation) {
    const insights = [];
    
    if (reachCalculation && uvmData.monthlyVisitors) {
      const penetrationRate = (reachCalculation.primaryImpressions / uvmData.monthlyVisitors) * 100;
      insights.push({
        type: 'audience_penetration',
        title: 'Audience Reach Analysis',
        message: `This content will reach ${penetrationRate.toFixed(1)}% of ${uvmData.domain}'s monthly audience (${reachCalculation.primaryImpressions.toLocaleString()} people)`,
        data: {
          penetrationRate,
          monthlyAudience: uvmData.monthlyVisitors,
          estimatedViews: reachCalculation.primaryImpressions
        }
      });
    }
    
    if (uvmData.globalRank) {
      const authorityLevel = uvmData.globalRank <= 10000 ? 'elite' : 
                           uvmData.globalRank <= 50000 ? 'premium' : 
                           uvmData.globalRank <= 100000 ? 'established' : 'growing';
      
      insights.push({
        type: 'publication_authority',
        title: 'Publication Authority',
        message: `${uvmData.domain} is an ${authorityLevel} publication (global rank #${uvmData.globalRank.toLocaleString()})`,
        data: {
          globalRank: uvmData.globalRank,
          domainAuthority: uvmData.domainAuthority,
          tier: uvmData.tier
        }
      });
    }
    
    return insights;
  }

  // Enhanced confidence calculation
  calculateEnhancedConfidence(uvmData) {
    let confidence = 0.7; // Higher base confidence with UVM data
    
    if (uvmData.monthlyVisitors) confidence += 0.15;
    if (uvmData.domainAuthority) confidence += 0.1;
    if (uvmData.globalRank) confidence += 0.05;
    if (uvmData.confidence === 'high') confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  // ... (keep all existing helper methods: generateInsights, generateBenchmarkComparison, etc.)
  generateInsights(breakdown, params) {
    // Existing implementation
    const { totalEstimatedValue } = breakdown;
    const insights = [];
    
    const topComponent = Object.entries(breakdown)
      .filter(([key]) => key !== 'totalEstimatedValue' && key !== 'sentimentMultiplier')
      .sort(([,a], [,b]) => b - a)[0];
    
    insights.push({
      type: 'value_composition',
      title: 'Primary Value Driver',
      message: `${this.formatComponentName(topComponent[0])} contributed ${((topComponent[1] / totalEstimatedValue) * 100).toFixed(1)}% of total value`,
      value: topComponent[1]
    });
    
    if (params.campaignCost) {
      const roi = ((totalEstimatedValue - params.campaignCost) / params.campaignCost) * 100;
      insights.push({
        type: 'roi',
        title: 'Campaign ROI',
        message: `${roi > 0 ? 'Positive' : 'Negative'} ROI of ${roi.toFixed(1)}%`,
        value: roi,
        recommendation: roi > 200 ? 'Excellent return' : roi > 100 ? 'Good return' : 'Consider optimization'
      });
    }
    
    return insights;
  }

  generateBenchmarkComparison(totalValue, params) {
    // Existing implementation
    const industry = params.industry || 'default';
    const tier = params.publicationTier;
    
    const industryAverages = {
      'tier-1': { technology: 8500, finance: 12000, healthcare: 7000, retail: 5500, default: 7500 },
      'tier-2': { technology: 4500, finance: 6500, healthcare: 3800, retail: 3000, default: 4000 },
      'tier-3': { technology: 2200, finance: 3200, healthcare: 1900, retail: 1500, default: 2000 },
      'tier-4': { technology: 800, finance: 1200, healthcare: 700, retail: 500, default: 750 }
    };
    
    const benchmark = industryAverages[tier][industry] || industryAverages[tier].default;
    const percentile = totalValue > benchmark ? 
      Math.min(90, 50 + ((totalValue - benchmark) / benchmark) * 30) : 
      Math.max(10, 50 - ((benchmark - totalValue) / benchmark) * 30);
    
    return {
      industryAverage: benchmark,
      yourValue: totalValue,
      percentile: Math.round(percentile),
      comparison: totalValue > benchmark ? 'above' : 'below',
      difference: Math.abs(totalValue - benchmark),
      message: `Your media value is ${Math.round(percentile)}th percentile for ${tier} ${industry} coverage`
    };
  }

  generateRecommendations(breakdown, params) {
    // Existing implementation
    const recommendations = [];
    
    recommendations.push({
      category: 'repurposing',
      title: 'Content Repurposing',
      suggestions: [
        'Include this coverage in your sales deck and pitch materials',
        'Share in email signatures and LinkedIn profiles',
        'Create social media quote cards from key excerpts',
        'Add to website testimonials and press page'
      ]
    });
    
    return recommendations;
  }

  calculateConfidenceLevel(params) {
    // Existing implementation
    let confidence = 0.5;
    if (params.actualImpressions) confidence += 0.2;
    if (params.domainAuthority) confidence += 0.1;
    return Math.min(0.95, confidence);
  }

  formatComponentName(key) {
    // Existing implementation
    const names = {
      advertisingValueEquivalency: 'Advertising Value Equivalency',
      seoValue: 'SEO Value',
      contentCreationValue: 'Content Creation Value',
      socialAmplificationValue: 'Social Amplification',
      brandAuthorityValue: 'Brand Authority Value'
    };
    return names[key] || key;
  }

  validateParams(params) {
    // Existing implementation
    const errors = [];
    if (params.estimatedReach && params.estimatedReach < 0) {
      errors.push('Estimated reach must be positive');
    }
    return errors;
  }

  getIndustryBenchmarks() {
    // Existing implementation
    return this.benchmarks;
  }
}

module.exports = MediaValueEstimatorService;