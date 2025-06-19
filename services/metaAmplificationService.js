const axios = require('axios');

class MetaAmplificationService {
  constructor() {
    this.apiVersion = 'v20.0';
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
    this.accessToken = process.env.META_ACCESS_TOKEN;
    this.appId = process.env.META_APP_ID;
    this.appSecret = process.env.META_APP_SECRET;
    this.adAccountId = process.env.META_AD_ACCOUNT_ID;
    this.pageId = process.env.META_PAGE_ID;
  }

  // Helper method for API requests
  async makeRequest(method, endpoint, data = {}, params = {}) {
    try {
      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        params: {
          access_token: this.accessToken,
          ...params
        }
      };

      if (method !== 'GET') {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Meta API Error:', error.response?.data || error.message);
      throw this.formatError(error);
    }
  }

  // Format error messages
  formatError(error) {
    if (error.response?.data?.error) {
      const fbError = error.response.data.error;
      return new Error(`Meta API Error: ${fbError.message} (Code: ${fbError.code})`);
    }
    return error;
  }

  // Create a Facebook post for the article
  async createPost(articleData) {
    try {
      const postData = {
        message: articleData.summary || articleData.headline,
        link: articleData.url,
        published: false // Keep as draft initially
      };

      const response = await this.makeRequest('POST', `/${this.pageId}/feed`, postData);
      return response.id;
    } catch (error) {
      console.error('Failed to create post:', error);
      throw error;
    }
  }

  // Search for targeting interests
  async searchInterests(query) {
    try {
      const response = await this.makeRequest('GET', '/search', {}, {
        type: 'adinterest',
        q: query,
        limit: 20
      });

      return response.data.map(interest => ({
        id: interest.id,
        name: interest.name,
        audience_size_lower_bound: interest.audience_size_lower_bound,
        audience_size_upper_bound: interest.audience_size_upper_bound,
        path: interest.path
      }));
    } catch (error) {
      console.error('Failed to search interests:', error);
      throw error;
    }
  }

  // Estimate audience reach
  async estimateReach(targeting, budget) {
    try {
      const deliveryEstimate = {
        targeting_spec: this.formatTargeting(targeting),
        optimization_goal: 'REACH',
        currency: 'USD',
        daily_budget: Math.round(budget.daily * 100) // Convert to cents
      };

      const response = await this.makeRequest(
        'GET',
        `/${this.adAccountId}/delivery_estimate`,
        {},
        { delivery_estimate: JSON.stringify(deliveryEstimate) }
      );

      return {
        daily_outcomes_curve: response.data[0]?.daily_outcomes_curve || [],
        estimate_dau: response.data[0]?.estimate_dau || 0,
        estimate_mau_lower: response.data[0]?.estimate_mau_lower || 0,
        estimate_mau_upper: response.data[0]?.estimate_mau_upper || 0,
        estimate_ready: response.data[0]?.estimate_ready || false
      };
    } catch (error) {
      console.error('Failed to estimate reach:', error);
      throw error;
    }
  }

  // Create complete campaign
  async createCampaign(campaignData) {
    try {
      // Step 1: Create campaign
      const campaign = await this.createCampaignObject(campaignData);
      
      // Step 2: Create ad set
      const adSet = await this.createAdSet(campaign.id, campaignData);
      
      // Step 3: Create ad creative
      const creative = await this.createAdCreative(campaignData);
      
      // Step 4: Create ad
      const ad = await this.createAd(adSet.id, creative.id, campaignData);

      return {
        success: true,
        campaign: {
          id: campaign.id,
          adSetId: adSet.id,
          adId: ad.id,
          creativeId: creative.id,
          postId: campaignData.postId,
          estimatedReach: campaignData.estimatedReach || 0,
          estimatedImpressions: campaignData.estimatedImpressions || 0,
          estimatedClicks: campaignData.estimatedClicks || 0
        }
      };
    } catch (error) {
      console.error('Campaign creation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create campaign object
  async createCampaignObject(campaignData) {
    const data = {
      name: campaignData.name,
      objective: 'OUTCOME_TRAFFIC', // or 'OUTCOME_AWARENESS' for reach
      status: 'PAUSED', // Start paused for safety
      special_ad_categories: [] // Add if needed
    };

    return await this.makeRequest('POST', `/${this.adAccountId}/campaigns`, data);
  }

  // Create ad set
  async createAdSet(campaignId, campaignData) {
    const startTime = new Date();
    const endTime = new Date();
    endTime.setDate(endTime.getDate() + (campaignData.duration || 7));

    const data = {
      name: `${campaignData.name} - Ad Set`,
      campaign_id: campaignId,
      daily_budget: Math.round(campaignData.budget.daily * 100), // Convert to cents
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LINK_CLICKS',
      targeting: this.formatTargeting(campaignData.targeting.meta),
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'PAUSED'
    };

    // Add Instagram placement if requested
    if (campaignData.platforms.includes('instagram')) {
      data.promoted_object = {
        page_id: this.pageId
      };
    }

    return await this.makeRequest('POST', `/${this.adAccountId}/adsets`, data);
  }

  // Format targeting for Meta API
  formatTargeting(targeting) {
    const formattedTargeting = {
      geo_locations: {
        countries: targeting.countries || ['US']
      },
      age_min: targeting.ageMin || 18,
      age_max: targeting.ageMax || 65
    };

    // Add interests if provided
    if (targeting.interests && targeting.interests.length > 0) {
      formattedTargeting.flexible_spec = [{
        interests: targeting.interests.map(i => ({ id: i.id, name: i.name }))
      }];
    }

    // Add behaviors if provided
    if (targeting.behaviors && targeting.behaviors.length > 0) {
      formattedTargeting.behaviors = targeting.behaviors;
    }

    // Add custom audiences if provided
    if (targeting.customAudiences && targeting.customAudiences.length > 0) {
      formattedTargeting.custom_audiences = targeting.customAudiences;
    }

    // Add gender if specified
    if (targeting.genders) {
      formattedTargeting.genders = targeting.genders;
    }

    // Add device platforms if specified
    if (targeting.device_platforms) {
      formattedTargeting.device_platforms = targeting.device_platforms;
    }

    // Add publisher platforms (facebook, instagram, audience_network, messenger)
    formattedTargeting.publisher_platforms = ['facebook'];
    if (targeting.includeInstagram !== false) {
      formattedTargeting.publisher_platforms.push('instagram');
    }

    // Add Facebook positions
    formattedTargeting.facebook_positions = ['feed', 'right_hand_column'];
    
    // Add Instagram positions if included
    if (targeting.includeInstagram !== false) {
      formattedTargeting.instagram_positions = ['stream', 'story'];
    }

    return formattedTargeting;
  }

  // Create ad creative
  async createAdCreative(campaignData) {
    const creativeData = {
      name: `${campaignData.name} - Creative`,
      object_story_spec: {
        page_id: this.pageId,
        link_data: {
          link: campaignData.articleData.url,
          message: campaignData.articleData.summary || campaignData.articleData.headline,
          name: campaignData.articleData.headline,
          description: campaignData.articleData.summary,
          image_hash: campaignData.imageHash // You'll need to upload image first
        }
      }
    };

    // If you have a post ID, use it instead
    if (campaignData.postId) {
      creativeData.object_story_id = `${this.pageId}_${campaignData.postId}`;
      delete creativeData.object_story_spec.link_data;
    }

    return await this.makeRequest('POST', `/${this.adAccountId}/adcreatives`, creativeData);
  }

  // Create ad
  async createAd(adSetId, creativeId, campaignData) {
    const data = {
      name: `${campaignData.name} - Ad`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED'
    };

    return await this.makeRequest('POST', `/${this.adAccountId}/ads`, data);
  }

  // Upload image for ad
  async uploadImage(imageUrl) {
    try {
      const data = {
        url: imageUrl
      };

      const response = await this.makeRequest('POST', `/${this.adAccountId}/adimages`, data);
      
      // Return the image hash
      const images = response.images || response;
      return Object.values(images)[0]?.hash;
    } catch (error) {
      console.error('Failed to upload image:', error);
      throw error;
    }
  }

  // Get campaign performance
  async getCampaignPerformance(campaignId, datePreset = 'lifetime') {
    try {
      const fields = [
        'reach',
        'impressions',
        'clicks',
        'spend',
        'cpm',
        'cpc',
        'ctr',
        'unique_clicks',
        'unique_ctr',
        'frequency'
      ].join(',');

      const response = await this.makeRequest('GET', `/${campaignId}/insights`, {}, {
        fields,
        date_preset: datePreset,
        level: 'campaign'
      });

      if (response.data && response.data.length > 0) {
        const data = response.data[0];
        return {
          reach: parseInt(data.reach || 0),
          impressions: parseInt(data.impressions || 0),
          clicks: parseInt(data.clicks || 0),
          spend: parseFloat(data.spend || 0),
          cpm: parseFloat(data.cpm || 0),
          cpc: parseFloat(data.cpc || 0),
          ctr: parseFloat(data.ctr || 0),
          uniqueClicks: parseInt(data.unique_clicks || 0),
          uniqueCtr: parseFloat(data.unique_ctr || 0),
          frequency: parseFloat(data.frequency || 0)
        };
      }

      return null;
    } catch (error) {
      console.error('Failed to get campaign performance:', error);
      throw error;
    }
  }

  // Pause campaign
  async pauseCampaign(campaignId) {
    return await this.updateCampaignStatus(campaignId, 'PAUSED');
  }

  // Resume campaign
  async resumeCampaign(campaignId) {
    return await this.updateCampaignStatus(campaignId, 'ACTIVE');
  }

  // Update campaign status
  async updateCampaignStatus(campaignId, status) {
    try {
      const response = await this.makeRequest('POST', `/${campaignId}`, {
        status
      });

      return {
        success: true,
        status
      };
    } catch (error) {
      console.error('Failed to update campaign status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get ad account details
  async getAdAccountDetails() {
    try {
      const fields = [
        'name',
        'account_status',
        'currency',
        'timezone_name',
        'spend_cap',
        'amount_spent',
        'balance'
      ].join(',');

      return await this.makeRequest('GET', `/${this.adAccountId}`, {}, { fields });
    } catch (error) {
      console.error('Failed to get ad account details:', error);
      throw error;
    }
  }

  // Validate configuration
  async validateConfiguration() {
    try {
      // Check ad account
      const account = await this.getAdAccountDetails();
      
      // Check page access
      const page = await this.makeRequest('GET', `/${this.pageId}`, {}, {
        fields: 'name,access_token'
      });

      return {
        valid: true,
        account: {
          id: this.adAccountId,
          name: account.name,
          status: account.account_status,
          currency: account.currency
        },
        page: {
          id: this.pageId,
          name: page.name
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

module.exports = MetaAmplificationService;