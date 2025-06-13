// ExclusiveWire Backend - app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pricingRoutes = require('./routes/pricing');
const paymentRoutes = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'exclusivewire-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/api/pricing', require('./routes/pricing'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reviewmatch', require('./routes/reviewmatch'));
app.use('/api/mve', require('./routes/mediaValueEstimator'));

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/exclusivewire';

mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
});
// Mongoose Models
const UserSchema = new mongoose.Schema({
  
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['company', 'journalist'], required: true },
  beatTags: [String],
  stripeCustomerId: String,
  stripeConnectAccountId: String,
  companyName: String,
  publication: String,
  bio: String,
  created: { type: Date, default: Date.now },
  reviewMatchProfile: {
    journalistProfile: {
      specializations: [String],
      outlet: String,
      monthlyPageviews: Number,
      socialFollowing: Number,
      rating: { type: Number, default: 0 },
      completedReviews: { type: Number, default: 0 }
    },
    companyProfile: {
      industry: String,
      companySize: String,
      totalCampaigns: { type: Number, default: 0 },
      totalSpend: { type: Number, default: 0 }
    }
  }
});



const AnnouncementSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  fullContent: { type: String, required: true },
  attachments: [String],
  industryTags: [String],
  journalistBeatTags: [String],
  embargoDateTime: { type: Date, required: true },
  plan: { type: String, enum: ['Basic', 'Premium'], required: true },
  fee: { type: Number, required: true },
  targetOutlets: [String],
  status: { 
    type: String, 
    enum: ['awaiting_claim', 'claimed', 'published', 'archived'], 
    default: 'awaiting_claim' 
  },
  plan: String,
  fee: Number,
  pricingTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnnouncementPricing' },
  priorityPlacement: { type: Boolean, default: false },
  useAiMatching: { type: Boolean, default: false },
  guaranteedPickup: { type: Boolean, default: false },
  exclusiveClaimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  needsWritingSupport: { type: Boolean, default: false },
  writingSupportType: { 
    type: String, 
    enum: ['ai_generated', 'human_assisted', 'full_service', 'none'],
    default: 'none'
  },
  created: { type: Date, default: Date.now }
});

const ClaimSchema = new mongoose.Schema({
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  claimTimestamp: { type: Date, default: Date.now },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'published'], 
    default: 'pending' 
  }
});

const ChatSchema = new mongoose.Schema({
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }]
});

const PaymentSchema = new mongoose.Schema({
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Payment Details
  totalAmount: { type: Number, required: true }, // in cents
  platformFee: { type: Number, required: true },
  journalistPayout: { type: Number, required: true },
  tier: { type: String, enum: ['basic', 'professional', 'enterprise', 'premium'], required: true },
  
  // Payment Processing
  stripePaymentIntentId: String,
  stripeTransferId: String,
  escrowStatus: { 
    type: String, 
    enum: ['pending', 'held', 'released', 'refunded'], 
    default: 'pending' 
  },
  
  // Completion Tracking
  storyPublished: { type: Boolean, default: false },
  storyUrl: String,
  publicationDate: Date,
  verificationStatus: { 
    type: String, 
    enum: ['pending', 'verified', 'disputed'], 
    default: 'pending' 
  },
  
  // Timestamps
  paymentDate: { type: Date, default: Date.now },
  releaseDate: Date,
  refundDate: Date,
  
  // Metadata
  paymentMethod: String,
  currency: { type: String, default: 'USD' },
  fees: {
    stripeFee: Number,
    platformFee: Number,
    processingFee: Number
  },
  
  // Dispute Management
  disputeReason: String,
  disputeDate: Date,
  disputeResolution: String
});

// Journalist Earnings Schema
const JournalistEarningsSchema = new mongoose.Schema({
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Earnings Tracking
  totalEarnings: { type: Number, default: 0 },
  availableBalance: { type: Number, default: 0 },
  pendingBalance: { type: Number, default: 0 },
  
  // Payout Information
  stripeAccountId: String, // Stripe Connect account
  payoutMethod: { type: String, enum: ['bank', 'paypal', 'wire'], default: 'bank' },
  payoutSchedule: { type: String, enum: ['instant', 'weekly', 'monthly'], default: 'weekly' },
  minimumPayout: { type: Number, default: 5000 }, // $50 minimum
  
  // Tax Information
  taxId: String,
  taxCountry: String,
  w9Filed: { type: Boolean, default: false },
  
  // Performance Metrics
  storiesCompleted: { type: Number, default: 0 },
  averageEarningsPerStory: { type: Number, default: 0 },
  completionRate: { type: Number, default: 0 },
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// MONETIZATION SCHEMAS

const SubscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true }, // "Analytics Pro", "Press Kit Manager"
  description: String,
  price: { type: Number, required: true }, // in cents
  interval: { type: String, enum: ['month', 'year'], default: 'month' },
  features: [String],
  limits: {
    profileViews: Number,
    analyticsRetention: Number, // days
    pressKitAssets: Number,
    aiCredits: Number
  },
  stripePriceId: String,
  isActive: { type: Boolean, default: true },
  created: { type: Date, default: Date.now }
});

const UserSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionPlan', required: true },
  stripeSubscriptionId: String,
  stripeCustomerId: String,
  
  status: { 
    type: String, 
    enum: ['active', 'past_due', 'canceled', 'unpaid', 'trialing'], 
    default: 'active' 
  },
  
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: { type: Boolean, default: false },
  
  // Usage Tracking
  usage: {
    profileViews: { type: Number, default: 0 },
    analyticsQueries: { type: Number, default: 0 },
    pressKitDownloads: { type: Number, default: 0 },
    aiCreditsUsed: { type: Number, default: 0 }
  },
  
  // Reset monthly
  usageResetDate: Date,
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const AnnouncementPricingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true }, // in cents
  journalistPayout: { type: Number, required: true }, // in cents
  payoutPercentage: { type: Number, required: true }, // 0-100
  
  features: {
    maxJournalists: Number,
    priorityPlacement: { type: Boolean, default: false },
    aiMatching: { type: Boolean, default: false },
    analyticsIncluded: { type: Boolean, default: false },
    pressKitAccess: { type: Boolean, default: false },
    guaranteedPickup: { type: Boolean, default: false },
    whiteGloveService: { type: Boolean, default: false }
  },
  
  description: String,
  isActive: { type: Boolean, default: true },
  created: { type: Date, default: Date.now }
});

const EnhancedPaymentSchema = new mongoose.Schema({
  // Existing payment fields...
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Enhanced Payment Details
  pricingTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnnouncementPricing', required: true },
  totalAmount: { type: Number, required: true },
  platformFee: { type: Number, required: true },
  journalistPayout: { type: Number, required: true },
  processingFee: { type: Number, required: true },
  
  // Stripe Integration
  stripePaymentIntentId: String,
  stripeTransferId: String,
  stripeCustomerId: String,
  
  // Escrow Management
  escrowStatus: { 
    type: String, 
    enum: ['pending_payment', 'funds_held', 'released_to_journalist', 'refunded', 'disputed'], 
    default: 'pending_payment' 
  },
  
  escrowReleaseDate: Date,
  escrowAmount: { type: Number, required: true },
  
  // Story Completion Tracking
  storyRequirements: {
    minWordCount: Number,
    requiresInterview: { type: Boolean, default: false },
    requiredQuotes: Number,
    deadlineHours: { type: Number, default: 72 }
  },
  
  storyDelivery: {
    isCompleted: { type: Boolean, default: false },
    storyUrl: String,
    wordCount: Number,
    publishDate: Date,
    publicationName: String,
    verificationStatus: { 
      type: String, 
      enum: ['pending', 'verified', 'needs_revision', 'approved'], 
      default: 'pending' 
    },
    qualityScore: { type: Number, min: 1, max: 10 }
  },
  
  // Revenue Sharing
  revenueSplit: {
    journalist: { type: Number, required: true },
    platform: { type: Number, required: true },
    processing: { type: Number, required: true }
  },
  
  // Payment Timeline
  paymentInitiated: { type: Date, default: Date.now },
  fundsHeldDate: Date,
  storyDeadline: Date,
  payoutProcessedDate: Date,
  
  // Dispute Management
  dispute: {
    isDisputed: { type: Boolean, default: false },
    reason: String,
    initiatedBy: { type: String, enum: ['company', 'journalist', 'platform'] },
    status: { type: String, enum: ['open', 'investigating', 'resolved'] },
    resolution: String,
    resolutionDate: Date
  },
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const RevenueShareSchema = new mongoose.Schema({
  journalistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'EnhancedPayment', required: true },
  
  // Earnings Details
  grossEarning: { type: Number, required: true },
  platformFee: { type: Number, required: true },
  netEarning: { type: Number, required: true },
  
  // Payout Processing
  payoutMethod: { type: String, enum: ['stripe_connect', 'paypal', 'wire', 'check'], default: 'stripe_connect' },
  payoutStatus: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'held'], 
    default: 'pending' 
  },
  
  payoutDate: Date,
  payoutTransactionId: String,
  
  // Tax Information
  taxableAmount: { type: Number, required: true },
  taxYear: Number,
  form1099Sent: { type: Boolean, default: false },
  
  created: { type: Date, default: Date.now }
});

const FeatureUsageSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  feature: { type: String, required: true }, // "analytics_query", "ai_matching", "press_kit_download"
  usageDate: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed, // Store feature-specific data
  cost: { type: Number, default: 0 }, // Credits or cost consumed
  
  // Billing Period
  billingMonth: Number,
  billingYear: Number
});

// Create models
const SubscriptionPlan = mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
const UserSubscription = mongoose.models.UserSubscription || mongoose.model('UserSubscription', UserSubscriptionSchema);
const AnnouncementPricing = mongoose.models.AnnouncementPricing || mongoose.model('AnnouncementPricing', AnnouncementPricingSchema);
const EnhancedPayment = mongoose.models.EnhancedPayment || mongoose.model('EnhancedPayment', EnhancedPaymentSchema);
const RevenueShare = mongoose.models.RevenueShare || mongoose.model('RevenueShare', RevenueShareSchema);
const FeatureUsage = mongoose.models.FeatureUsage || mongoose.model('FeatureUsage', FeatureUsageSchema);

module.exports = {
  SubscriptionPlan,
  UserSubscription,
  AnnouncementPricing,
  EnhancedPayment
};


// Enhanced Profile Schemas
const JournalistProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  // Professional Information
  bio: { type: String, maxLength: 1000 },
  yearsExperience: { type: Number, min: 0, max: 50 },
  specializations: [String], // e.g., "Investigative Reporting", "Breaking News"
  
  // Beat Details (Enhanced from simple tags)
  beatDetails: [{
    category: { type: String, required: true }, // e.g., "Technology"
    subcategories: [String], // e.g., ["AI", "Startups", "Enterprise Software"]
    expertiseLevel: { type: String, enum: ['beginner', 'intermediate', 'expert'], default: 'intermediate' },
    yearsInBeat: { type: Number, min: 0 },
    description: String // Custom description of their coverage in this beat
  }],
  
  // Portfolio & Work History
  portfolio: [{
    title: { type: String, required: true },
    publication: { type: String, required: true },
    url: String,
    publishDate: Date,
    category: String,
    description: String,
    isExclusive: { type: Boolean, default: false },
    impact: String // Metrics or impact description
  }],
  
  // Publications & Affiliations
  publications: [{
    name: { type: String, required: true },
    role: String, // "Staff Writer", "Freelance", "Editor"
    startDate: Date,
    endDate: Date, // null if current
    isPrimary: { type: Boolean, default: false },
    contactInfo: {
      email: String,
      phone: String,
      editorName: String,
      editorEmail: String
    }
  }],
  
  // Coverage Preferences
  preferences: {
    storyTypes: [String], // "breaking", "analysis", "features", "interviews"
    responseTime: { type: String, enum: ['immediate', 'same-day', 'within-week'], default: 'same-day' },
    preferredLength: [String], // "brief", "standard", "long-form", "investigative"
    exclusiveInterest: { type: String, enum: ['high', 'medium', 'low'], default: 'high' },
    embargoComfort: { type: String, enum: ['comfortable', 'cautious', 'avoid'], default: 'comfortable' },
    followUpPreference: { type: String, enum: ['email', 'phone', 'slack', 'any'], default: 'email' }
  },
  
  // Geographic Coverage
  geographicCoverage: {
    primary: String, // "San Francisco Bay Area"
    secondary: [String], // ["California", "West Coast"]
    willTravel: { type: Boolean, default: false },
    remote: { type: Boolean, default: true }
  },
  
  // Social Media & Contact
  socialMedia: {
    twitter: String,
    linkedin: String,
    personal: String,
    other: [{
      platform: String,
      url: String
    }]
  },
  
  // Professional Details
  education: [{
    institution: String,
    degree: String,
    field: String,
    year: Number
  }],
  
  awards: [{
    name: String,
    organization: String,
    year: Number,
    description: String
  }],
  
  languages: [String],
  
  // Verification & Trust
  verification: {
    isVerified: { type: Boolean, default: false },
    verificationDate: Date,
    verificationMethod: String, // "email", "publication", "manual"
    verifiedBy: String,
    trustScore: { type: Number, min: 0, max: 100, default: 50 },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Profile Settings
  visibility: {
    profilePublic: { type: Boolean, default: true },
    contactInfoPublic: { type: Boolean, default: false },
    portfolioPublic: { type: Boolean, default: true },
    searchable: { type: Boolean, default: true }
  },
  
  // Analytics
  analytics: {
    profileViews: { type: Number, default: 0 },
    exclusivesClaimed: { type: Number, default: 0 },
    storiesPublished: { type: Number, default: 0 },
    responseRate: { type: Number, default: 0 },
    avgResponseTime: { type: Number, default: 0 } // in hours
  },
  
  // Timestamps
  lastActive: { type: Date, default: Date.now },
  profileCompleteness: { type: Number, default: 0 }, // 0-100%
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const CompanyProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Company Information
  companyName: { type: String, required: true },
  legalName: String,
  website: String,
  foundedYear: Number,
  employeeCount: String, // "1-10", "11-50", "51-200", etc.
  headquartersLocation: String,
  otherLocations: [String],
  
  // Business Details
  industry: { type: String, required: true },
  subIndustries: [String],
  businessModel: String, // "B2B", "B2C", "B2B2C", "Marketplace"
  stage: String, // "Startup", "Growth", "Enterprise", "Public"
  
  // Company Description
  elevator: String, // One-line description
  description: String, // Longer description
  mission: String,
  values: [String],
  
  // Funding & Financial
  fundingStage: String, // "Pre-Seed", "Seed", "Series A", etc.
  totalFunding: String,
  lastFundingDate: Date,
  investors: [String],
  isPublic: { type: Boolean, default: false },
  stockSymbol: String,
  
  // Leadership Team
  leadership: [{
    name: { type: String, required: true },
    title: { type: String, required: true },
    bio: String,
    linkedIn: String,
    email: String,
    isMediaContact: { type: Boolean, default: false },
    isExecutive: { type: Boolean, default: false }
  }],
  
  // Media & PR Information
  mediaInfo: {
    pressKitUrl: String,
    logoUrl: String,
    brandAssets: [String],
    mediaContactName: String,
    mediaContactEmail: String,
    mediaContactPhone: String,
    prAgency: String,
    prAgencyContact: String
  },
  
  // Announcement History
  announcementHistory: [{
    type: String,
    title: String,
    date: Date,
    coverage: [{
      publication: String,
      journalist: String,
      url: String,
      reach: Number
    }]
  }],
  
  // Preferred Story Types
  storyPreferences: {
    announcementTypes: [String], // "funding", "product", "partnership", etc.
    preferredTiming: String, // "immediate", "planned", "flexible"
    exclusiveWillingness: { type: String, enum: ['always', 'sometimes', 'rarely'], default: 'sometimes' },
    targetPublications: [String],
    avoidPublications: [String]
  },
  
  // Company Metrics
  metrics: {
    customers: String,
    revenue: String, // Range like "$1M-10M"
    growth: String,
    marketShare: String,
    keyMetrics: [{
      name: String,
      value: String,
      period: String
    }]
  },
  
  // Verification
  verification: {
    isVerified: { type: Boolean, default: false },
    verificationDate: Date,
    verificationMethod: String,
    businessRegistration: String,
    website: String
  },
  
  // Profile Analytics
  analytics: {
    profileViews: { type: Number, default: 0 },
    announcementsSent: { type: Number, default: 0 },
    pickupRate: { type: Number, default: 0 },
    avgTimeToPickup: { type: Number, default: 0 }
  },
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

const PublisherProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['newspaper', 'magazine', 'digital', 'broadcast', 'podcast', 'newsletter'], required: true },
  
  // Publication Details
  website: String,
  description: String,
  founded: Number,
  circulation: Number,
  monthlyReaders: Number,
  socialFollowing: {
    twitter: Number,
    facebook: Number,
    linkedin: Number,
    instagram: Number
  },
  
  // Editorial Information
  editorial: {
    editorInChief: String,
    newsroomSize: Number,
    editorialCalendar: String,
    submissionGuidelines: String,
    responseTime: String,
    preferredFormat: String
  },
  
  // Coverage Areas
  coverageAreas: [String],
  geography: String, // "Global", "US", "San Francisco", etc.
  languages: [String],
  
  // Business Model
  monetization: [String], // "subscription", "advertising", "events"
  audience: {
    primaryDemographic: String,
    industries: [String],
    jobTitles: [String]
  },
  
  // Journalist Management
  journalists: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String, // "Staff Writer", "Editor", "Freelance"
    startDate: Date,
    beats: [String],
    isActive: { type: Boolean, default: true }
  }],
  
  // Verification
  verification: {
    isVerified: { type: Boolean, default: false },
    verificationDate: Date,
    mediaListVerified: { type: Boolean, default: false }
  },
  
  created: { type: Date, default: Date.now },
  updated: { type: Date, default: Date.now }
});

// Create models
const JournalistProfile = mongoose.model('JournalistProfile', JournalistProfileSchema);
const CompanyProfile = mongoose.model('CompanyProfile', CompanyProfileSchema);
const PublisherProfile = mongoose.model('PublisherProfile', PublisherProfileSchema);

const User = mongoose.model('User', UserSchema);
const Announcement = mongoose.model('Announcement', AnnouncementSchema);
const Claim = mongoose.model('Claim', ClaimSchema);
const Chat = mongoose.model('Chat', ChatSchema);
const Payment = mongoose.model('Payment', PaymentSchema);

// Authentication Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization').replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      throw new Error();
    }
    
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).send({ error: 'Authentication required' });
  }
};

// Add these lines with your existing route usage
app.use('/api/pricing', pricingRoutes);
app.use('/api/payments', paymentRoutes);

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Rate limiting for API
const rateLimit = require('express-rate-limit');
const reviewMatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/reviewmatch', reviewMatchLimiter);

// Add Stripe webhook endpoint (raw body parser)
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), (req, res) => {
  // Webhook handling code - implement later
  res.json({received: true});
});

// Routes

// ENHANCED PROFILE ROUTES

app.post('/api/payments/create-intent', auth, async (req, res) => {
  // Calculate amounts based on tier
  // Create Stripe payment intent
  // Store payment record
});

// Process journalist payout
app.post('/api/payments/payout/:paymentId', auth, async (req, res) => {
  // Verify story publication
  // Release escrow to journalist
  // Update payment status
});

// Handle webhooks
app.post('/api/payments/webhook', (req, res) => {
  // Handle Stripe webhooks
  // Update payment statuses
  // Trigger notifications
});

// Get journalist profile
app.get('/api/profiles/journalist/:id', auth, async (req, res) => {
  try {
    const profile = await JournalistProfile.findOne({ userId: req.params.id })
      .populate('userId', 'name email');
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Check if user can view this profile
    const canView = profile.visibility.profilePublic || 
                   req.user._id.toString() === req.params.id ||
                   req.user.role === 'company';
    
    if (!canView) {
      return res.status(403).json({ message: 'Profile is private' });
    }
    
    // Increment view count if different user
    if (req.user._id.toString() !== req.params.id) {
      profile.analytics.profileViews += 1;
      await profile.save();
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get journalist profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update journalist profile
app.put('/api/profiles/journalist', auth, async (req, res) => {
  try {
    if (req.user.role !== 'journalist') {
      return res.status(403).json({ message: 'Only journalists can update journalist profiles' });
    }
    
    const profileData = {
      ...req.body,
      userId: req.user._id,
      updated: new Date()
    };
    
    // Calculate profile completeness
    profileData.profileCompleteness = calculateProfileCompleteness(profileData);
    
    const profile = await JournalistProfile.findOneAndUpdate(
      { userId: req.user._id },
      profileData,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json(profile);
  } catch (error) {
    console.error('Update journalist profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get company profile
app.get('/api/profiles/company/:id', auth, async (req, res) => {
  try {
    const profile = await CompanyProfile.findOne({ userId: req.params.id })
      .populate('userId', 'name email');
    
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    
    // Increment view count if different user
    if (req.user._id.toString() !== req.params.id) {
      profile.analytics.profileViews += 1;
      await profile.save();
    }
    
    res.json(profile);
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update company profile
app.put('/api/profiles/company', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can update company profiles' });
    }
    
    const profileData = {
      ...req.body,
      userId: req.user._id,
      updated: new Date()
    };
    
    const profile = await CompanyProfile.findOneAndUpdate(
      { userId: req.user._id },
      profileData,
      { new: true, upsert: true, runValidators: true }
    );
    
    res.json(profile);
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize default pricing tiers
app.post('/api/admin/initialize-pricing', async (req, res) => {
  try {
    // Create default announcement pricing tiers
    const pricingTiers = [
      {
        name: 'Basic',
        price: 14900, // $149
        journalistPayout: 2980, // $29.80 (20%)
        payoutPercentage: 20,
        features: {
          maxJournalists: 10,
          priorityPlacement: false,
          aiMatching: false,
          analyticsIncluded: false,
          pressKitAccess: false,
          guaranteedPickup: false,
          whiteGloveService: false
        },
        description: 'Perfect for small announcements and testing the platform'
      },
      {
        name: 'Professional',
        price: 29900, // $299
        journalistPayout: 7475, // $74.75 (25%)
        payoutPercentage: 25,
        features: {
          maxJournalists: 25,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: false,
          whiteGloveService: false
        },
        description: 'Most popular - enhanced matching and analytics included'
      },
      {
        name: 'Enterprise',
        price: 59900, // $599
        journalistPayout: 14975, // $149.75 (25%)
        payoutPercentage: 25,
        features: {
          maxJournalists: 50,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: false,
          whiteGloveService: true
        },
        description: 'For major announcements requiring wide coverage'
      },
      {
        name: 'Premium Exclusive',
        price: 99900, // $999
        journalistPayout: 29970, // $299.70 (30%)
        payoutPercentage: 30,
        features: {
          maxJournalists: 100,
          priorityPlacement: true,
          aiMatching: true,
          analyticsIncluded: true,
          pressKitAccess: true,
          guaranteedPickup: true,
          whiteGloveService: true
        },
        description: 'Guaranteed pickup with top-tier journalists only'
      }
    ];
    
    await AnnouncementPricing.insertMany(pricingTiers);
    
    // Create default subscription plans
    const subscriptionPlans = [
      {
        name: 'Analytics Pro',
        price: 9900, // $99/month
        description: 'Advanced analytics and performance tracking',
        features: [
          'Unlimited analytics queries',
          'Custom reporting',
          'Competitor tracking',
          'ROI measurement',
          'Export capabilities'
        ],
        limits: {
          profileViews: 10000,
          analyticsRetention: 365,
          pressKitAssets: 0,
          aiCredits: 0
        }
      },
      {
        name: 'Press Kit Manager',
        price: 4900, // $49/month
        description: 'Digital press kit management and sharing',
        features: [
          'Unlimited asset storage',
          'Brand guidelines management',
          'Auto-sharing with journalists',
          'Usage analytics',
          'Custom branding'
        ],
        limits: {
          profileViews: 0,
          analyticsRetention: 0,
          pressKitAssets: -1, // unlimited
          aiCredits: 0
        }
      },
      {
        name: 'AI Assistant',
        price: 19900, // $199/month
        description: 'AI-powered features and automation',
        features: [
          'Smart pitch personalization',
          'Optimal timing predictions',
          'Story performance scoring',
          'Auto-generated follow-ups',
          'Trend analysis'
        ],
        limits: {
          profileViews: 0,
          analyticsRetention: 0,
          pressKitAssets: 0,
          aiCredits: 500
        }
      },
      {
        name: 'Complete Suite',
        price: 24900, // $249/month (save $25)
        description: 'All premium features included',
        features: [
          'Everything in Analytics Pro',
          'Everything in Press Kit Manager', 
          'Everything in AI Assistant',
          'Priority support',
          'Custom integrations'
        ],
        limits: {
          profileViews: -1, // unlimited
          analyticsRetention: -1, // unlimited
          pressKitAssets: -1, // unlimited
          aiCredits: 1000
        }
      }
    ];
    
    await SubscriptionPlan.insertMany(subscriptionPlans);
    
    res.json({ message: 'Pricing tiers and subscription plans initialized successfully' });
  } catch (error) {
    console.error('Initialize pricing error:', error);
    res.status(500).json({ message: 'Failed to initialize pricing' });
  }
});

// Get pricing tiers
app.get('/api/pricing/announcements', async (req, res) => {
  try {
    const pricing = await AnnouncementPricing.find({ isActive: true }).sort({ price: 1 });
    res.json(pricing);
  } catch (error) {
    console.error('Get pricing error:', error);
    res.status(500).json({ message: 'Failed to get pricing' });
  }
});



// Get subscription plans
app.get('/api/pricing/subscriptions', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json(plans);
  } catch (error) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({ message: 'Failed to get subscription plans' });
  }
});

// Create payment intent for announcement
app.post('/api/payments/announcement/create-intent', auth, async (req, res) => {
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
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
      storyRequirements: {
        minWordCount: pricingTier.name === 'Premium Exclusive' ? 800 : 500,
        requiresInterview: pricingTier.features.whiteGloveService,
        requiredQuotes: pricingTier.name === 'Premium Exclusive' ? 3 : 1,
        deadlineHours: pricingTier.features.guaranteedPickup ? 24 : 72
      },
      revenueSplit: {
        journalist: pricingTier.journalistPayout,
        platform: platformFee,
        processing: stripeFee
      },
      storyDeadline: new Date(Date.now() + (pricingTier.features.guaranteedPickup ? 24 : 72) * 60 * 60 * 1000)
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
app.post('/api/payments/announcement/confirm', auth, async (req, res) => {
  try {
    const { paymentId, paymentIntentId } = req.body;
    
    const payment = await EnhancedPayment.findById(paymentId)
      .populate('pricingTierId')
      .populate('announcementId');
    
    if (!payment || payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Verify payment with Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update payment status
      payment.escrowStatus = 'funds_held';
      payment.fundsHeldDate = new Date();
      await payment.save();
      
      // Update announcement with pricing tier features
      const announcement = payment.announcementId;
      announcement.plan = payment.pricingTierId.name;
      announcement.fee = payment.totalAmount / 100; // Convert to dollars for display
      announcement.status = 'awaiting_claim';
      
      // Add premium features based on pricing tier
      if (payment.pricingTierId.features.priorityPlacement) {
        announcement.priorityPlacement = true;
      }
      if (payment.pricingTierId.features.aiMatching) {
        announcement.useAiMatching = true;
      }
      
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

// Process story completion and journalist payout
app.post('/api/payments/complete-story', auth, async (req, res) => {
  try {
    const { paymentId, storyUrl, wordCount, publicationName } = req.body;
    
    const payment = await EnhancedPayment.findById(paymentId)
      .populate('journalistId')
      .populate('pricingTierId');
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Verify user is the journalist who claimed it
    if (req.user.role === 'journalist' && payment.journalistId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update story delivery information
    payment.storyDelivery = {
      isCompleted: true,
      storyUrl,
      wordCount,
      publishDate: new Date(),
      publicationName,
      verificationStatus: 'pending'
    };
    
    await payment.save();
    
    // Auto-approve if meets requirements
    if (wordCount >= payment.storyRequirements.minWordCount) {
      await processJournalistPayout(payment);
      payment.storyDelivery.verificationStatus = 'approved';
      payment.escrowStatus = 'released_to_journalist';
      await payment.save();
    }
    
    res.json({ 
      success: true, 
      message: 'Story submitted successfully',
      payoutStatus: payment.escrowStatus
    });
  } catch (error) {
    console.error('Complete story error:', error);
    res.status(500).json({ message: 'Failed to process story completion' });
  }
});

// Process journalist payout
async function processJournalistPayout(payment) {
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Get journalist's Stripe Connect account
    const journalistProfile = await JournalistProfile.findOne({ userId: payment.journalistId });
    
    if (!journalistProfile || !journalistProfile.stripeConnectAccountId) {
      throw new Error('Journalist Stripe account not found');
    }
    
    // Create transfer to journalist
    const transfer = await stripe.transfers.create({
      amount: payment.journalistPayout,
      currency: 'usd',
      destination: journalistProfile.stripeConnectAccountId,
      metadata: {
        paymentId: payment._id.toString(),
        announcementId: payment.announcementId.toString()
      }
    });
    
    payment.stripeTransferId = transfer.id;
    payment.payoutProcessedDate = new Date();
    
    // Create revenue share record
    const revenueShare = new RevenueShare({
      journalistId: payment.journalistId,
      paymentId: payment._id,
      grossEarning: payment.journalistPayout,
      platformFee: Math.round(payment.journalistPayout * 0.03), // 3% platform fee on journalist earnings
      netEarning: Math.round(payment.journalistPayout * 0.97),
      payoutStatus: 'completed',
      payoutDate: new Date(),
      payoutTransactionId: transfer.id,
      taxableAmount: payment.journalistPayout,
      taxYear: new Date().getFullYear()
    });
    
    await revenueShare.save();
    
    // Update journalist analytics
    await JournalistProfile.findOneAndUpdate(
      { userId: payment.journalistId },
      {
        $inc: {
          'analytics.storiesPublished': 1,
          'analytics.totalEarnings': payment.journalistPayout
        }
      }
    );
    
    return transfer;
  } catch (error) {
    console.error('Process payout error:', error);
    throw error;
  }
}

// Subscribe to premium features
app.post('/api/subscriptions/subscribe', auth, async (req, res) => {
  try {
    const { planId, paymentMethodId } = req.body;
    
    const plan = await SubscriptionPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    // Create or get Stripe customer
    let customer;
    const existingSubscription = await UserSubscription.findOne({ userId: req.user._id });
    
    if (existingSubscription && existingSubscription.stripeCustomerId) {
      customer = await stripe.customers.retrieve(existingSubscription.stripeCustomerId);
    } else {
      customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: {
          userId: req.user._id.toString()
        }
      });
    }
    
    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });
    
    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripePriceId }],
      default_payment_method: paymentMethodId,
      metadata: {
        userId: req.user._id.toString(),
        planId: planId
      }
    });
    
    // Save subscription to database
    const userSubscription = new UserSubscription({
      userId: req.user._id,
      planId: planId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      usageResetDate: new Date(subscription.current_period_end * 1000)
    });
    
    await userSubscription.save();
    
    res.json({
      success: true,
      subscription: userSubscription,
      plan: plan
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ message: 'Failed to create subscription' });
  }
});

// Check feature access
app.get('/api/features/check/:feature', auth, async (req, res) => {
  try {
    const { feature } = req.params;
    const hasAccess = await checkFeatureAccess(req.user._id, feature);
    
    res.json({ hasAccess, feature });
  } catch (error) {
    console.error('Check feature access error:', error);
    res.status(500).json({ message: 'Failed to check feature access' });
  }
});

// Feature access checking function
async function checkFeatureAccess(userId, feature) {
  try {
    const subscription = await UserSubscription.findOne({ 
      userId, 
      status: 'active',
      currentPeriodEnd: { $gt: new Date() }
    }).populate('planId');
    
    if (!subscription) {
      return false; // No active subscription
    }
    
    const plan = subscription.planId;
    
    // Check feature-specific limits
    switch (feature) {
      case 'analytics_pro':
        return plan.limits.analyticsRetention > 0 || plan.limits.analyticsRetention === -1;
      
      case 'press_kit_manager':
        return plan.limits.pressKitAssets > 0 || plan.limits.pressKitAssets === -1;
      
      case 'ai_assistant':
        return plan.limits.aiCredits > 0 || plan.limits.aiCredits === -1;
      
      case 'enhanced_profiles':
        return plan.limits.profileViews > 0 || plan.limits.profileViews === -1;
      
      default:
        return false;
    }
  } catch (error) {
    console.error('Check feature access error:', error);
    return false;
  }
}

// Track feature usage
async function trackFeatureUsage(userId, feature, cost = 1) {
  try {
    const usage = new FeatureUsage({
      userId,
      feature,
      cost,
      billingMonth: new Date().getMonth() + 1,
      billingYear: new Date().getFullYear()
    });
    
    await usage.save();
    
    // Update subscription usage
    await UserSubscription.findOneAndUpdate(
      { userId, status: 'active' },
      { $inc: { [`usage.${feature.replace('_', '')}`]: cost } }
    );
    
    return true;
  } catch (error) {
    console.error('Track feature usage error:', error);
    return false;
  }
}

// Get user's current subscriptions and usage
app.get('/api/subscriptions/current', auth, async (req, res) => {
  try {
    const subscriptions = await UserSubscription.find({ 
      userId: req.user._id,
      status: { $in: ['active', 'trialing'] }
    }).populate('planId');
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Get current subscriptions error:', error);
    res.status(500).json({ message: 'Failed to get subscriptions' });
  }
});

// Stripe webhooks
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle successful payment
      handlePaymentSucceeded(event.data.object);
      break;
    
    case 'invoice.payment_succeeded':
      // Handle successful subscription payment
      handleSubscriptionPayment(event.data.object);
      break;
    
    case 'customer.subscription.deleted':
      // Handle subscription cancellation
      handleSubscriptionCanceled(event.data.object);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({received: true});
});

async function handlePaymentSucceeded(paymentIntent) {
  try {
    const payment = await EnhancedPayment.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });
    
    if (payment) {
      payment.escrowStatus = 'funds_held';
      payment.fundsHeldDate = new Date();
      await payment.save();
    }
  } catch (error) {
    console.error('Handle payment succeeded error:', error);
  }
}

async function handleSubscriptionPayment(invoice) {
  try {
    const subscription = await UserSubscription.findOne({
      stripeSubscriptionId: invoice.subscription
    });
    
    if (subscription) {
      subscription.status = 'active';
      subscription.updated = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Handle subscription payment error:', error);
  }
}

async function handleSubscriptionCanceled(subscription) {
  try {
    await UserSubscription.findOneAndUpdate(
      { stripeSubscriptionId: subscription.id },
      { status: 'canceled', updated: new Date() }
    );
  } catch (error) {
    console.error('Handle subscription canceled error:', error);
  }
}

// Search journalist profiles
app.get('/api/profiles/search/journalists', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can search journalist profiles' });
    }
    
    const {
      beats,
      location,
      experience,
      publications,
      responseTime,
      storyTypes,
      verified,
      limit = 20,
      offset = 0
    } = req.query;
    
    let query = { 'visibility.searchable': true };
    
    // Build search filters
    if (beats) {
      const beatArray = beats.split(',');
      query['beatDetails.category'] = { $in: beatArray };
    }
    
    if (location) {
      query.$or = [
        { 'geographicCoverage.primary': new RegExp(location, 'i') },
        { 'geographicCoverage.secondary': new RegExp(location, 'i') }
      ];
    }
    
    if (experience) {
      query.yearsExperience = { $gte: parseInt(experience) };
    }
    
    if (publications) {
      const pubArray = publications.split(',');
      query['publications.name'] = { $in: pubArray };
    }
    
    if (responseTime) {
      query['preferences.responseTime'] = responseTime;
    }
    
    if (storyTypes) {
      const typeArray = storyTypes.split(',');
      query['preferences.storyTypes'] = { $in: typeArray };
    }
    
    if (verified === 'true') {
      query['verification.isVerified'] = true;
    }
    
    const profiles = await JournalistProfile.find(query)
      .populate('userId', 'name email')
      .sort({ 'verification.trustScore': -1, 'analytics.profileViews': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));
    
    const total = await JournalistProfile.countDocuments(query);
    
    res.json({ profiles, total, hasMore: total > offset + profiles.length });
  } catch (error) {
    console.error('Search journalists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get enhanced matching suggestions
app.get('/api/profiles/match/:announcementId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can get matches' });
    }
    
    const announcement = await Announcement.findById(req.params.announcementId);
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Enhanced matching algorithm
    const matches = await getEnhancedMatches(announcement);
    
    res.json(matches);
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Profile verification endpoint
app.post('/api/profiles/verify/:userId', auth, async (req, res) => {
  try {
    // This would typically be admin-only in production
    const { verificationType, verificationData } = req.body;
    
    if (req.user.role === 'journalist') {
      const profile = await JournalistProfile.findOne({ userId: req.params.userId });
      if (profile) {
        profile.verification.isVerified = true;
        profile.verification.verificationDate = new Date();
        profile.verification.verificationMethod = verificationType;
        profile.verification.trustScore = Math.min(profile.verification.trustScore + 25, 100);
        await profile.save();
      }
    } else if (req.user.role === 'company') {
      const profile = await CompanyProfile.findOne({ userId: req.params.userId });
      if (profile) {
        profile.verification.isVerified = true;
        profile.verification.verificationDate = new Date();
        profile.verification.verificationMethod = verificationType;
        await profile.save();
      }
    }
    
    res.json({ message: 'Profile verified successfully' });
  } catch (error) {
    console.error('Verify profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function for profile completeness
function calculateProfileCompleteness(profile) {
  let score = 0;
  const maxScore = 100;
  
  // Basic information (30 points)
  if (profile.bio) score += 10;
  if (profile.yearsExperience) score += 5;
  if (profile.specializations && profile.specializations.length > 0) score += 10;
  if (profile.geographicCoverage && profile.geographicCoverage.primary) score += 5;
  
  // Beat details (25 points)
  if (profile.beatDetails && profile.beatDetails.length > 0) {
    score += 15;
    if (profile.beatDetails.some(beat => beat.description)) score += 10;
  }
  
  // Portfolio (20 points)
  if (profile.portfolio && profile.portfolio.length > 0) {
    score += 10;
    if (profile.portfolio.length >= 3) score += 5;
    if (profile.portfolio.some(item => item.url)) score += 5;
  }
  
  // Publications (15 points)
  if (profile.publications && profile.publications.length > 0) {
    score += 10;
    if (profile.publications.some(pub => pub.isPrimary)) score += 5;
  }
  
  // Social media & contact (10 points)
  if (profile.socialMedia) {
    if (profile.socialMedia.twitter) score += 3;
    if (profile.socialMedia.linkedin) score += 3;
    if (profile.socialMedia.personal) score += 2;
    if (profile.socialMedia.other && profile.socialMedia.other.length > 0) score += 2;
  }
  
  return Math.min(score, maxScore);
}

// Enhanced matching algorithm
async function getEnhancedMatches(announcement) {
  const journalists = await JournalistProfile.find({
    'visibility.searchable': true,
    'beatDetails.category': { $in: announcement.journalistBeatTags }
  }).populate('userId', 'name email');
  
  // Calculate match scores
  const matches = journalists.map(journalist => {
    let score = 0;
    
    // Beat matching (40 points)
    const matchingBeats = journalist.beatDetails.filter(beat =>
      announcement.journalistBeatTags.includes(beat.category)
    );
    score += matchingBeats.length * 10;
    
    // Expertise level bonus (10 points)
    const expertBeats = matchingBeats.filter(beat => beat.expertiseLevel === 'expert');
    score += expertBeats.length * 10;
    
    // Response time preference (15 points)
    if (journalist.preferences.responseTime === 'immediate') score += 15;
    else if (journalist.preferences.responseTime === 'same-day') score += 10;
    else if (journalist.preferences.responseTime === 'within-week') score += 5;
    
    // Exclusive interest (15 points)
    if (journalist.preferences.exclusiveInterest === 'high') score += 15;
    else if (journalist.preferences.exclusiveInterest === 'medium') score += 10;
    else score += 5;
    
    // Trust score (10 points)
    score += journalist.verification.trustScore * 0.1;
    
    // Recent activity (5 points)
    const daysSinceActive = (Date.now() - journalist.lastActive) / (1000 * 60 * 60 * 24);
    if (daysSinceActive <= 7) score += 5;
    else if (daysSinceActive <= 30) score += 3;
    
    // Profile completeness (5 points)
    score += journalist.profileCompleteness * 0.05;
    
    return {
      journalist,
      score: Math.round(score),
      matchingBeats: matchingBeats.map(beat => beat.category),
      reasons: generateMatchReasons(matchingBeats, journalist, score)
    };
  });
  
  // Sort by score and return top matches
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function generateMatchReasons(matchingBeats, journalist, score) {
  const reasons = [];
  
  if (matchingBeats.length > 0) {
    reasons.push(`Covers ${matchingBeats.map(beat => beat.category).join(', ')}`);
  }
  
  if (matchingBeats.some(beat => beat.expertiseLevel === 'expert')) {
    reasons.push('Expert-level knowledge in relevant beats');
  }
  
  if (journalist.preferences.responseTime === 'immediate') {
    reasons.push('Fast response time');
  }
  
  if (journalist.preferences.exclusiveInterest === 'high') {
    reasons.push('High interest in exclusives');
  }
  
  if (journalist.verification.isVerified) {
    reasons.push('Verified journalist');
  }
  
  if (journalist.verification.trustScore > 80) {
    reasons.push('High trust score');
  }
  
  return reasons;
}


// PR GENERATOR ROUTES

// Generate PR content
app.post('/api/pr/generate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can generate press releases' });
    }

    const {
      announcementType,
      companyDetails,
      announcementDetails,
      quotes,
      additionalInfo
    } = req.body;

    // Generate PR content based on template
    const generatedPR = generatePRContent({
      announcementType,
      companyDetails,
      announcementDetails,
      quotes,
      additionalInfo
    });

    res.json({
      title: generatedPR.title,
      summary: generatedPR.summary,
      fullContent: generatedPR.fullContent,
      suggestedTags: generatedPR.suggestedTags
    });
  } catch (error) {
    console.error('PR generation error:', error);
    res.status(500).json({ message: 'Failed to generate press release' });
  }
});

// Save PR template for reuse
app.post('/api/pr/save-template', auth, async (req, res) => {
  try {
    const { templateName, templateData } = req.body;
    
    // Save custom template (implement based on needs)
    res.json({ message: 'Template saved successfully' });
  } catch (error) {
    console.error('Save template error:', error);
    res.status(500).json({ message: 'Failed to save template' });
  }
});

// Helper function for PR generation
function generatePRContent({ announcementType, companyDetails, announcementDetails, quotes, additionalInfo }) {
  const audienceType = announcementDetails.audienceType || 'b2b'; // 'b2b' or 'b2c'
  
  const templates = {
    funding: audienceType === 'b2c' ? generateFundingPR_B2C : generateFundingPR_B2B,
    product_launch: audienceType === 'b2c' ? generateProductLaunchPR_B2C : generateProductLaunchPR_B2B,
    partnership: audienceType === 'b2c' ? generatePartnershipPR_B2C : generatePartnershipPR_B2B,
    executive_hire: audienceType === 'b2c' ? generateExecutiveHirePR_B2C : generateExecutiveHirePR_B2B,
    company_news: audienceType === 'b2c' ? generateCompanyNewsPR_B2C : generateCompanyNewsPR_B2B,
    acquisition: audienceType === 'b2c' ? generateAcquisitionPR_B2C : generateAcquisitionPR_B2B
  };

  const generator = templates[announcementType] || templates.company_news;
  return generator({ companyDetails, announcementDetails, quotes, additionalInfo });
}

// B2B PR Template Functions
function generateFundingPR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Secures ${announcementDetails.fundingAmount} ${announcementDetails.fundingRound} to Accelerate ${companyDetails.industry} Innovation`;
  
  const summary = `${companyDetails.companyName}, a leading ${companyDetails.industry} technology provider, has closed ${announcementDetails.fundingAmount} in ${announcementDetails.fundingRound} funding led by ${announcementDetails.leadInvestor}. The capital will fuel expansion of enterprise solutions and accelerate market penetration.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName}, a leading provider of ${companyDetails.industry} solutions, today announced the successful completion of its ${announcementDetails.fundingAmount} ${announcementDetails.fundingRound} funding round. The investment was led by ${announcementDetails.leadInvestor}${announcementDetails.otherInvestors ? `, with strategic participation from ${announcementDetails.otherInvestors}` : ''}.

The funding enables ${companyDetails.companyName} to accelerate product development, expand enterprise sales capabilities, and strengthen its market position in the rapidly growing ${companyDetails.industry} sector.

"This investment validates our technology leadership and enterprise market strategy," said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}. "${quotes.ceoQuote}"

${companyDetails.companyName}'s proprietary ${companyDetails.technology || 'platform'} delivers measurable ROI for enterprise clients through ${announcementDetails.valueProposition || 'advanced automation and analytics capabilities'}. The company serves Fortune 500 clients across multiple verticals, driving operational efficiency and cost reduction.

${announcementDetails.marketOpportunity ? `The ${companyDetails.industry} market represents a ${announcementDetails.marketSize || 'multi-billion'} opportunity, with enterprises increasingly investing in ${announcementDetails.marketDrivers || 'digital transformation initiatives'}.` : ''}

${quotes.investorQuote ? `"${quotes.investorQuote}" said ${quotes.investorName}, ${quotes.investorTitle} at ${announcementDetails.leadInvestor}. "We see significant potential in ${companyDetails.companyName}'s enterprise-focused approach."` : ''}

Key investment priorities include:
• Expanding enterprise sales and customer success teams
• Accelerating product development and platform capabilities
• Strategic partnerships and integrations
• International market expansion

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `Founded in ${companyDetails.foundedYear || new Date().getFullYear()}, ${companyDetails.companyName} provides enterprise-grade ${companyDetails.industry} solutions that drive measurable business outcomes for leading organizations worldwide.`}

For more information, visit ${companyDetails.website || 'www.' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}
${companyDetails.mediaContactPhone || ''}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['B2B', 'Enterprise Funding', 'Investment', companyDetails.industry, announcementDetails.fundingRound]
  };
}

function generateFundingPR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Raises ${announcementDetails.fundingAmount} to Bring ${announcementDetails.consumerBenefit || 'Innovation'} to More People`;
  
  const summary = `${companyDetails.companyName}, the company behind ${announcementDetails.popularProduct || 'popular consumer solutions'}, has raised ${announcementDetails.fundingAmount} to expand its reach and help more people ${announcementDetails.consumerValue || 'improve their daily lives'}.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName}, the innovative company making ${companyDetails.consumerMission || companyDetails.industry + ' more accessible'}, today announced ${announcementDetails.fundingAmount} in new funding led by ${announcementDetails.leadInvestor}.

The investment will help ${companyDetails.companyName} reach more customers and continue developing products that ${announcementDetails.consumerImpact || 'make everyday life easier and better'}.

"We're thrilled to have this support as we work to ${announcementDetails.consumerGoal || 'help more people access our solutions'}," said ${quotes.ceoName}, ${quotes.ceoTitle} and founder of ${companyDetails.companyName}. "${quotes.ceoQuote}"

${companyDetails.companyName} has already helped ${announcementDetails.customerCount || 'thousands of'} customers ${announcementDetails.customerSuccess || 'achieve their goals'}, with users reporting ${announcementDetails.customerBenefits || 'significant improvements in their daily routines'}.

The new funding will be used to:
• Expand the team to serve more customers
• Develop new features customers have been requesting
• Make the service available to more people
• Improve the user experience

${quotes.customerQuote ? `"${quotes.customerQuote}" said ${quotes.customerName}, a longtime user of ${companyDetails.companyName}'s services.` : ''}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} was founded with the mission to ${companyDetails.consumerMission || 'make life better for everyday people'}. Since launch, the company has focused on creating simple, effective solutions that deliver real value.`}

To learn more, visit ${companyDetails.website || 'www.' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Consumer', 'Funding', 'Innovation', companyDetails.industry, 'Startup']
  };
}

function generateProductLaunchPR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Launches ${announcementDetails.productName}: Advanced ${announcementDetails.productCategory} for Enterprise Clients`;
  
  const summary = `${companyDetails.companyName} today unveiled ${announcementDetails.productName}, a comprehensive ${announcementDetails.productCategory} solution designed to address critical enterprise challenges in ${companyDetails.industry}. The platform delivers measurable ROI through ${announcementDetails.keyValue || 'enhanced operational efficiency'}.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName}, a leading provider of enterprise ${companyDetails.industry} solutions, today announced the launch of ${announcementDetails.productName}, an innovative ${announcementDetails.productCategory} platform engineered for large-scale enterprise deployments.

${announcementDetails.productName} addresses critical business challenges including ${announcementDetails.businessProblem || 'operational inefficiencies, compliance requirements, and scalability constraints'} through ${announcementDetails.technicalSolution || 'advanced automation, analytics, and integration capabilities'}.

Enterprise-Grade Features:
${announcementDetails.enterpriseFeatures ? announcementDetails.enterpriseFeatures.split(',').map(feature => `• ${feature.trim()}`).join('\n') : '• Advanced security and compliance controls\n• Scalable architecture supporting millions of transactions\n• Comprehensive API and integration capabilities\n• Real-time analytics and reporting dashboard\n• 24/7 enterprise support and SLA guarantees'}

"${quotes.ceoQuote}" said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}. "Our enterprise clients require solutions that deliver immediate ROI while scaling with their growth."

Beta testing with Fortune 500 clients demonstrated ${announcementDetails.betaResults || 'significant improvements in operational efficiency and cost reduction'}. ${announcementDetails.clientTestimonial || 'Early adopters report measurable impact within the first quarter of implementation.'}

${announcementDetails.productName} integrates seamlessly with existing enterprise technology stacks, including ${announcementDetails.integrations || 'major CRM, ERP, and data platforms'}. Implementation typically takes ${announcementDetails.implementationTime || '30-60 days'} with comprehensive migration support.

Pricing and Availability:
${announcementDetails.enterprisePricing || `${announcementDetails.productName} is available immediately for enterprise clients with flexible licensing options and volume discounts.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} delivers enterprise-grade ${companyDetails.industry} solutions to Fortune 500 companies worldwide, driving digital transformation and operational excellence.`}

For enterprise sales inquiries, contact ${companyDetails.salesEmail || 'sales@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'} or visit ${announcementDetails.productWebsite || companyDetails.website}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['B2B', 'Enterprise Software', 'Product Launch', companyDetails.industry, announcementDetails.productCategory]
  };
}

function generateProductLaunchPR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Introduces ${announcementDetails.productName}${announcementDetails.consumerBenefit ? ': ' + announcementDetails.consumerBenefit : ''}`;
  
  const summary = `${companyDetails.companyName} today launched ${announcementDetails.productName}, making ${announcementDetails.consumerValue || 'everyday life easier'} for people everywhere. The new ${announcementDetails.productCategory} is designed to ${announcementDetails.consumerSolution || 'solve common problems people face'}.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName} today introduced ${announcementDetails.productName}, designed to help people ${announcementDetails.consumerGoal || 'save time and simplify their daily routines'}.

${announcementDetails.consumerProblem ? `Many people struggle with ${announcementDetails.consumerProblem}. ${announcementDetails.productName} solves this by ${announcementDetails.consumerSolution}.` : `${announcementDetails.productName} makes it easy to ${announcementDetails.consumerValue || 'achieve your goals'}.`}

What makes ${announcementDetails.productName} special:
${announcementDetails.consumerFeatures ? announcementDetails.consumerFeatures.split(',').map(feature => `• ${feature.trim()}`).join('\n') : '• Simple and intuitive to use\n• Works seamlessly with your lifestyle\n• Delivers results you can see\n• Affordable for everyone'}

"We created ${announcementDetails.productName} because we believe ${announcementDetails.productMission || 'everyone deserves access to great solutions'}," said ${quotes.ceoName}, founder of ${companyDetails.companyName}. "${quotes.ceoQuote}"

${announcementDetails.earlyUsers ? `Early users are loving ${announcementDetails.productName}. ${announcementDetails.userFeedback || 'People report seeing results within days of getting started.'}` : ''}

${quotes.customerQuote ? `"${quotes.customerQuote}" said ${quotes.customerName}, one of the first people to try ${announcementDetails.productName}.` : ''}

Getting Started:
${announcementDetails.consumerPricing || `${announcementDetails.productName} is available now`} ${announcementDetails.availability || 'for everyone'}. ${announcementDetails.specialOffer ? `For a limited time, ${announcementDetails.specialOffer}.` : ''}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} creates products that make life better for real people. We believe in simple solutions that actually work.`}

To learn more or get started, visit ${announcementDetails.productWebsite || companyDetails.website || 'www.' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Consumer Product', 'Launch', 'Innovation', companyDetails.industry, 'Lifestyle']
  };
}

// Continue with B2B Partnership template
function generatePartnershipPR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} and ${announcementDetails.partnerName} Form Strategic Alliance to Enhance Enterprise ${companyDetails.industry} Solutions`;
  
  const summary = `${companyDetails.companyName} and ${announcementDetails.partnerName} today announced a strategic partnership to deliver integrated ${companyDetails.industry} solutions for enterprise clients. The collaboration combines complementary technologies to address complex business challenges.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName}, a leading ${companyDetails.industry} solutions provider, today announced a strategic partnership with ${announcementDetails.partnerName} to deliver comprehensive enterprise solutions that ${announcementDetails.businessValue || 'drive operational efficiency and competitive advantage'}.

The partnership enables joint enterprise customers to leverage ${companyDetails.companyName}'s ${companyDetails.coreTechnology || 'core platform capabilities'} alongside ${announcementDetails.partnerName}'s ${announcementDetails.partnerTechnology || 'specialized solutions'}, creating a unified technology stack that addresses ${announcementDetails.enterpriseChallenge || 'complex business requirements'}.

"This strategic alliance represents a significant milestone in our enterprise growth strategy," said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}. "${quotes.ceoQuote}"

${quotes.partnerQuote ? `"${quotes.partnerQuote}" said ${quotes.partnerName}, ${quotes.partnerTitle} at ${announcementDetails.partnerName}. "Together, we can deliver enterprise solutions that neither company could provide independently."` : ''}

Joint Solution Benefits:
${announcementDetails.enterpriseBenefits ? announcementDetails.enterpriseBenefits.split(',').map(benefit => `• ${benefit.trim()}`).join('\n') : '• Reduced total cost of ownership through integrated solutions\n• Accelerated time-to-value for enterprise deployments\n• Comprehensive support and professional services\n• Enhanced security and compliance capabilities\n• Scalable architecture supporting global operations'}

The partnership includes joint go-to-market initiatives, integrated product development, and shared enterprise sales efforts. ${announcementDetails.timeline ? `Implementation begins ${announcementDetails.timeline} with` : 'Initial'} joint solutions available to enterprise clients ${additionalInfo.availability || 'in Q2 2024'}.

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} provides enterprise-grade ${companyDetails.industry} solutions to Fortune 500 companies worldwide.`}

About ${announcementDetails.partnerName}
${announcementDetails.partnerDescription || `${announcementDetails.partnerName} is a leading technology company specializing in enterprise solutions.`}

For enterprise partnership inquiries, contact ${companyDetails.partnershipsEmail || 'partnerships@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['B2B Partnership', 'Enterprise Alliance', 'Strategic Collaboration', companyDetails.industry]
  };
}

function generatePartnershipPR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Teams Up with ${announcementDetails.partnerName} to Bring ${announcementDetails.consumerBenefit || 'New Benefits'} to Customers`;
  
  const summary = `${companyDetails.companyName} and ${announcementDetails.partnerName} have joined forces to make ${announcementDetails.consumerValue || 'life even better'} for their customers. This exciting partnership means ${announcementDetails.partnershipImpact || 'more choices and better experiences'} for everyone.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName} and ${announcementDetails.partnerName} today announced an exciting partnership that will ${announcementDetails.consumerOutcome || 'bring new benefits and experiences to customers'}.

${announcementDetails.partnershipStory || `The collaboration combines ${companyDetails.companyName}'s expertise in ${companyDetails.consumerStrength || companyDetails.industry} with ${announcementDetails.partnerName}'s ${announcementDetails.partnerStrength || 'unique capabilities'}.`}

"We're excited to work with ${announcementDetails.partnerName} to ${announcementDetails.sharedGoal || 'create something amazing for our customers'}," said ${quotes.ceoName}, founder of ${companyDetails.companyName}. "${quotes.ceoQuote}"

${quotes.partnerQuote ? `"${quotes.partnerQuote}" said ${quotes.partnerName} from ${announcementDetails.partnerName}.` : ''}

What this means for customers:
${announcementDetails.customerBenefits ? announcementDetails.customerBenefits.split(',').map(benefit => `• ${benefit.trim()}`).join('\n') : '• More options and choices\n• Better value and savings\n• Improved experience\n• Access to new features'}

${announcementDetails.launchDetails || `The partnership launches ${additionalInfo.timeline || 'this month'}, with customers able to ${announcementDetails.customerAction || 'take advantage of the new benefits right away'}.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} is dedicated to ${companyDetails.consumerMission || 'making life better for our customers'}.`}

About ${announcementDetails.partnerName}
${announcementDetails.partnerDescription || `${announcementDetails.partnerName} shares our commitment to ${announcementDetails.sharedValues || 'putting customers first'}.`}

For more information, visit ${companyDetails.website || 'www.' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Partnership', 'Collaboration', 'Customer Benefits', companyDetails.industry]
  };
}

// Continue with remaining B2B/B2C templates for Executive Hire, Company News, and Acquisition
function generateExecutiveHirePR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Appoints Industry Veteran ${announcementDetails.executiveName} as ${announcementDetails.executiveRole} to Drive Enterprise Growth`;
  
  const summary = `${companyDetails.companyName} today announced the appointment of ${announcementDetails.executiveName} as ${announcementDetails.executiveRole}. ${announcementDetails.executiveName} brings ${announcementDetails.executiveExperience} years of enterprise leadership experience and proven expertise in scaling ${companyDetails.industry} organizations.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName}, a leading provider of enterprise ${companyDetails.industry} solutions, today announced the appointment of ${announcementDetails.executiveName} as ${announcementDetails.executiveRole}, effective immediately.

${announcementDetails.executiveName} brings over ${announcementDetails.executiveExperience} years of proven leadership in scaling enterprise technology organizations. ${announcementDetails.executiveBackground || `Most recently serving as ${announcementDetails.executivePreviousRole || 'senior executive'} at ${announcementDetails.executivePreviousCompany || 'a leading technology company'}, ${announcementDetails.executiveName} has a track record of driving revenue growth, operational excellence, and market expansion.`}

"${announcementDetails.executiveName}'s proven expertise in enterprise markets and operational scale makes them the ideal leader to drive our next phase of growth," said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}. "${quotes.ceoQuote}"

"${quotes.executiveQuote || `I'm excited to join ${companyDetails.companyName} at this pivotal moment and help scale the organization to serve the growing enterprise market demand.`}" said ${announcementDetails.executiveName}.

In this role, ${announcementDetails.executiveName} will spearhead:
${announcementDetails.executiveResponsibilities ? announcementDetails.executiveResponsibilities.split(',').map(resp => `• ${resp.trim()}`).join('\n') : `• Enterprise sales strategy and market expansion\n• Operational scaling and process optimization\n• Strategic partnerships and channel development\n• Team building and organizational development`}

${announcementDetails.executiveName}'s appointment supports ${companyDetails.companyName}'s strategic focus on enterprise market penetration and international expansion. ${announcementDetails.growthPlans || 'The company plans to double its enterprise client base over the next 18 months.'}

${announcementDetails.executiveEducation ? `${announcementDetails.executiveName} holds ${announcementDetails.executiveEducation} and` : ''} has previously held leadership positions at ${announcementDetails.executivePreviousCompanies || 'several high-growth technology companies'}, where ${announcementDetails.executiveAchievements || 'they successfully led major business transformations and revenue growth initiatives'}.

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} provides enterprise-grade ${companyDetails.industry} solutions that drive measurable business outcomes for leading organizations worldwide.`}

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Executive Hire', 'Leadership', 'Enterprise Growth', companyDetails.industry]
  };
}

function generateExecutiveHirePR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} Welcomes ${announcementDetails.executiveName} as New ${announcementDetails.executiveRole}`;
  
  const summary = `${companyDetails.companyName} today welcomed ${announcementDetails.executiveName} as its new ${announcementDetails.executiveRole}. ${announcementDetails.executiveName} joins the team with a passion for ${announcementDetails.executivePassion || 'helping people'} and ${announcementDetails.executiveExperience} years of experience creating products people love.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${companyDetails.companyName} today announced that ${announcementDetails.executiveName} has joined the company as ${announcementDetails.executiveRole}.

${announcementDetails.executiveName} brings a wealth of experience in ${announcementDetails.executiveExpertise || 'creating amazing customer experiences'} and shares ${companyDetails.companyName}'s commitment to ${companyDetails.customerMission || 'putting customers first'}.

"We're thrilled to have ${announcementDetails.executiveName} join our team," said ${quotes.ceoName}, founder of ${companyDetails.companyName}. "${quotes.ceoQuote || `Their experience and passion for helping people aligns perfectly with our mission.`}"

"${quotes.executiveQuote || `I'm excited to help ${companyDetails.companyName} continue growing and serving its amazing community of customers.`}" said ${announcementDetails.executiveName}.

${announcementDetails.executiveName} will focus on:
${announcementDetails.executiveGoals ? announcementDetails.executiveGoals.split(',').map(goal => `• ${goal.trim()}`).join('\n') : `• Making the customer experience even better\n• Building new features customers want\n• Growing the team\n• Expanding to serve more people`}

Before joining ${companyDetails.companyName}, ${announcementDetails.executiveName} ${announcementDetails.executiveBackground || `worked at companies focused on creating positive impact for consumers`}. ${announcementDetails.executivePersonal || `When not working, ${announcementDetails.executiveName} enjoys ${announcementDetails.executiveHobbies || 'spending time with family and giving back to the community'}.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} is dedicated to ${companyDetails.consumerMission || 'making life better for our customers'} through simple, effective solutions.`}

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['New Hire', 'Team Growth', 'Leadership', companyDetails.industry]
  };
}

function generateCompanyNewsPR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = announcementDetails.newsTitle || `${companyDetails.companyName} ${announcementDetails.newsType || 'Announces Strategic Initiative'} to Strengthen Enterprise Market Position`;
  
  const summary = announcementDetails.newsSummary || `${companyDetails.companyName} today announced ${announcementDetails.newsType || 'a strategic initiative'} designed to enhance its enterprise offerings and strengthen market leadership in the ${companyDetails.industry} sector.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${summary}

${announcementDetails.businessRationale || 'This strategic move aligns with current market demands and enterprise customer requirements in the rapidly evolving ' + companyDetails.industry + ' landscape.'}

"${quotes.ceoQuote || `This announcement reflects our continued commitment to delivering enterprise-grade solutions that drive measurable business outcomes.`}" said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}.

The initiative addresses key enterprise challenges including ${announcementDetails.enterpriseChallenges || 'scalability, security, and integration complexity'} while positioning ${companyDetails.companyName} for sustained growth in the ${companyDetails.targetMarket || 'enterprise market'}.

Strategic Implications:
${announcementDetails.businessImpact ? announcementDetails.businessImpact.split(',').map(impact => `• ${impact.trim()}`).join('\n') : '• Enhanced competitive positioning in enterprise markets\n• Expanded addressable market opportunity\n• Strengthened customer value proposition\n• Improved operational efficiency and margins'}

${additionalInfo.marketContext || `The ${companyDetails.industry} market continues to experience strong demand from enterprise clients seeking comprehensive solutions that deliver ROI and competitive advantage.`}

${announcementDetails.nextSteps || `Implementation begins immediately with full deployment expected over the next ${announcementDetails.timeline || '6-12 months'}.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} provides enterprise-grade ${companyDetails.industry} solutions to leading organizations worldwide, enabling digital transformation and operational excellence.`}

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Corporate News', 'Business Strategy', companyDetails.industry, 'Enterprise']
  };
}

function generateCompanyNewsPR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = announcementDetails.newsTitle || `${companyDetails.companyName} ${announcementDetails.newsType || 'Shares Exciting News'} with Its Community`;
  
  const summary = announcementDetails.newsSummary || `${companyDetails.companyName} today shared exciting news with its community of customers and supporters, announcing ${announcementDetails.newsType || 'an important milestone'} that will benefit everyone who uses their services.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${summary}

${announcementDetails.newsStory || `This news represents an important step forward for ${companyDetails.companyName} and reflects the company's commitment to its customers and community.`}

"${quotes.ceoQuote || `We're so grateful to our amazing community and excited to share this milestone with everyone who has supported us.`}" said ${quotes.ceoName}, founder of ${companyDetails.companyName}.

What this means for customers:
${announcementDetails.customerImpact ? announcementDetails.customerImpact.split(',').map(impact => `• ${impact.trim()}`).join('\n') : '• Continued commitment to quality and service\n• Even better experiences ahead\n• More ways to connect and engage\n• Continued focus on customer needs'}

${announcementDetails.communityMessage || `${companyDetails.companyName} remains focused on its mission to ${companyDetails.consumerMission || 'make life better for its customers'} and looks forward to continuing to serve its growing community.`}

${additionalInfo.celebration || `The company plans to celebrate this milestone with special offers and events for its community.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} is passionate about ${companyDetails.consumerMission || 'creating positive experiences'} for its customers and community.`}

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Company News', 'Community', 'Milestone', companyDetails.industry]
  };
}

function generateAcquisitionPR_B2B({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} ${announcementDetails.acquisitionType === 'acquiring' ? 'Acquires' : 'Acquired by'} ${announcementDetails.targetCompany} to Accelerate Enterprise Growth Strategy`;
  
  const summary = `${companyDetails.companyName} today announced ${announcementDetails.acquisitionType === 'acquiring' ? 'the strategic acquisition of' : 'it has been acquired by'} ${announcementDetails.targetCompany}${announcementDetails.acquisitionAmount ? ` for ${announcementDetails.acquisitionAmount}` : ''}. The transaction strengthens ${companyDetails.companyName}'s enterprise capabilities and market position.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${summary}

The strategic transaction combines complementary technologies and expertise to create a comprehensive enterprise solution portfolio that addresses evolving market demands in the ${companyDetails.industry} sector.

"${quotes.ceoQuote || `This acquisition represents a significant milestone in our enterprise growth strategy and enhances our ability to serve large-scale clients.`}" said ${quotes.ceoName}, ${quotes.ceoTitle} of ${companyDetails.companyName}.

Strategic Benefits:
${announcementDetails.businessBenefits ? announcementDetails.businessBenefits.split(',').map(benefit => `• ${benefit.trim()}`).join('\n') : '• Expanded enterprise product portfolio and capabilities\n• Enhanced market reach and customer base\n• Accelerated innovation through combined R&D resources\n• Strengthened competitive positioning\n• Improved operational scale and efficiency'}

The combined organization will serve ${announcementDetails.combinedCustomers || 'over 500 enterprise clients'} across ${announcementDetails.marketCoverage || 'multiple industry verticals'}, with enhanced capabilities in ${announcementDetails.combinedStrengths || 'platform integration, security, and scalability'}.

${announcementDetails.integrationPlan || `Integration activities begin immediately with full operational integration expected within ${announcementDetails.integrationTimeline || '12-18 months'}.`} ${announcementDetails.customerContinuity || 'All existing customer relationships and commitments will be maintained throughout the transition.'}

${quotes.targetCeoQuote ? `"${quotes.targetCeoQuote}" said ${quotes.targetCeoName}, ${quotes.targetCeoTitle} of ${announcementDetails.targetCompany}.` : ''}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} provides enterprise-grade ${companyDetails.industry} solutions to leading organizations worldwide.`}

About ${announcementDetails.targetCompany}
${announcementDetails.targetCompanyDescription || `${announcementDetails.targetCompany} is a recognized leader in enterprise technology solutions with a strong track record of innovation and customer success.`}

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Press Team'}
${companyDetails.mediaContactEmail || 'press@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['M&A', 'Acquisition', 'Enterprise Growth', 'Strategic Transaction', companyDetails.industry]
  };
}

function generateAcquisitionPR_B2C({ companyDetails, announcementDetails, quotes, additionalInfo }) {
  const title = `${companyDetails.companyName} ${announcementDetails.acquisitionType === 'acquiring' ? 'Joins Forces with' : 'Joins'} ${announcementDetails.targetCompany} to Better Serve Customers`;
  
  const summary = `${companyDetails.companyName} and ${announcementDetails.targetCompany} today announced they're ${announcementDetails.acquisitionType === 'acquiring' ? 'joining forces' : 'coming together'} to create even better experiences for their customers. This exciting development means ${announcementDetails.customerBenefit || 'more great features and services'} for everyone.`;
  
  const fullContent = `FOR IMMEDIATE RELEASE

${title}

${companyDetails.location} - ${new Date().toLocaleDateString()} - ${summary}

${announcementDetails.acquisitionStory || `Both companies share a commitment to putting customers first and creating products that make life better. Together, they'll be able to do even more for the people they serve.`}

"${quotes.ceoQuote || `We're excited to join forces with ${announcementDetails.targetCompany} to create something amazing for our customers.`}" said ${quotes.ceoName}, founder of ${companyDetails.companyName}.

What this means for customers:
${announcementDetails.customerBenefits ? announcementDetails.customerBenefits.split(',').map(benefit => `• ${benefit.trim()}`).join('\n') : '• Access to more features and services\n• Even better customer support\n• Continued focus on quality and value\n• Exciting new developments ahead'}

${announcementDetails.customerMessage || `Nothing changes for existing customers - all services continue as normal, with exciting improvements coming soon.`}

${quotes.targetCeoQuote ? `"${quotes.targetCeoQuote}" said ${quotes.targetCeoName} from ${announcementDetails.targetCompany}.` : ''}

${additionalInfo.futurePlans || `The combined team is already working on new ways to serve customers better, with exciting announcements planned for the coming months.`}

About ${companyDetails.companyName}
${companyDetails.aboutCompany || `${companyDetails.companyName} is dedicated to ${companyDetails.consumerMission || 'creating great experiences for its customers'}.`}

About ${announcementDetails.targetCompany}
${announcementDetails.targetCompanyDescription || `${announcementDetails.targetCompany} shares our passion for ${announcementDetails.sharedValues || 'putting customers first'}.`}

For more information, visit ${companyDetails.website || 'www.' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}.

Media Contact:
${companyDetails.mediaContactName || companyDetails.companyName + ' Team'}
${companyDetails.mediaContactEmail || 'hello@' + companyDetails.companyName.toLowerCase().replace(/\s+/g, '') + '.com'}

###`;

  return {
    title,
    summary,
    fullContent,
    suggestedTags: ['Company News', 'Partnership', 'Customer Benefits', companyDetails.industry]
  };
}

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, role, beatTags, companyName, publication, bio } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      beatTags: beatTags || [],
      companyName,
      publication,
      bio
    });

    await user.save();

    // Create corresponding profile
    if (role === 'company') {
      const companyProfile = new CompanyProfile({
        userId: user._id,
        companyName: companyName || name,
        industry: 'Other' // default to avoid validation error
      });
      await companyProfile.save();
    } else if (role === 'journalist') {
      const journalistProfile = new JournalistProfile({
        userId: user._id,
        bio,
        beats: beatTags || [],
        name
      });
      await journalistProfile.save();
    }

    // Return token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Login: check if profile exists, if not create it
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check and create profile if not exists
    if (user.role === 'journalist') {
      let profile = await JournalistProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = new JournalistProfile({
          userId: user._id,
          bio: user.bio || ''
        });
        await profile.save();
      }
    } else if (user.role === 'company') {
      let profile = await CompanyProfile.findOne({ userId: user._id });
      if (!profile) {
        profile = new CompanyProfile({
          userId: user._id,
          companyName: user.companyName || '',
          industry: ''
        });
        await profile.save();
      }
    }

    // Create and return JWT token
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// COMPANY USER FLOW ROUTES

// Create Announcement
app.post('/api/announcements', auth, async (req, res) => {
  try {
    // Ensure user is a company
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Only companies can create announcements' });
    }
    
    const {
      title,
      summary,
      fullContent,
      attachments,
      industryTags,
      journalistBeatTags,
      embargoDateTime,
      plan,
      fee,
      targetOutlets,
      needsWritingSupport,
      writingSupportType
    } = req.body;
    
    const announcement = new Announcement({
      companyId: req.user._id,
      title,
      summary,
      fullContent,
      attachments: attachments || [],
      industryTags: industryTags || [],
      journalistBeatTags: journalistBeatTags || [],
      embargoDateTime,
      plan,
      fee,
      targetOutlets: targetOutlets || [],
      needsWritingSupport: needsWritingSupport || false,
      writingSupportType: writingSupportType || 'none'
    });
    
    await announcement.save();
    
    // Create a payment record
    const payment = new Payment({
      announcementId: announcement._id,
      amount: fee
    });
    
    await payment.save();
    
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Company's Announcements
app.get('/api/company/announcements', auth, async (req, res) => {
  try {
    // Ensure user is a company
    if (req.user.role !== 'company') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const announcements = await Announcement.find({ companyId: req.user._id })
      .populate('exclusiveClaimedBy', 'name email publication')
      .sort({ created: -1 });
    
    res.json(announcements);
  } catch (error) {
    console.error('Get company announcements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// JOURNALIST USER FLOW ROUTES

// Get Available Announcements (for journalists)
app.get('/api/journalist/announcements', auth, async (req, res) => {
  try {
    // Ensure user is a journalist
    if (req.user.role !== 'journalist') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get announcements that match journalist's beats and are not claimed
    const announcements = await Announcement.find({
      status: 'awaiting_claim',
      journalistBeatTags: { $in: req.user.beatTags },
      embargoDateTime: { $gt: new Date() } // Only show if embargo hasn't passed
    })
    .populate('companyId', 'name companyName')
    .select('title summary industryTags embargoDateTime plan created');
    
    res.json(announcements);
  } catch (error) {
    console.error('Get journalist announcements error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Announcement Details (for journalists)
app.get('/api/announcements/:id', auth, async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
      .populate('companyId', 'name companyName email')
      .populate('exclusiveClaimedBy', 'name email publication');
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Only allow access to company who created it or journalists with matching beats
    const isOwner = announcement.companyId._id.toString() === req.user._id.toString();
    const isClaimer = announcement.exclusiveClaimedBy && 
                    announcement.exclusiveClaimedBy._id.toString() === req.user._id.toString();
    const hasMatchingBeat = req.user.role === 'journalist' && 
                          announcement.journalistBeatTags.some(tag => req.user.beatTags.includes(tag));
    
    if (!isOwner && !isClaimer && !hasMatchingBeat) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(announcement);
  } catch (error) {
    console.error('Get announcement details error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Claim Exclusive
app.post('/api/announcements/:id/claim', auth, async (req, res) => {
  try {
    // Ensure user is a journalist
    if (req.user.role !== 'journalist') {
      return res.status(403).json({ message: 'Only journalists can claim exclusives' });
    }
    
    // Find the announcement
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Check if already claimed
    if (announcement.status !== 'awaiting_claim') {
      return res.status(400).json({ message: 'This announcement has already been claimed' });
    }
    
    // Check if journalist has matching beat
    const hasMatchingBeat = announcement.journalistBeatTags.some(tag => req.user.beatTags.includes(tag));
    if (!hasMatchingBeat) {
      return res.status(403).json({ message: 'You do not have a matching beat for this announcement' });
    }
    
    // Update announcement status
    announcement.status = 'claimed';
    announcement.exclusiveClaimedBy = req.user._id;
    await announcement.save();
    
    // Create claim record
    const claim = new Claim({
      journalistId: req.user._id,
      announcementId: announcement._id
    });
    await claim.save();
    
    // Create chat thread
    const chat = new Chat({
      announcementId: announcement._id,
      messages: [{
        senderId: req.user._id,
        message: 'I have claimed this exclusive and am interested in covering it.',
        timestamp: new Date()
      }]
    });
    await chat.save();
    
    res.json({ message: 'Exclusive successfully claimed', announcement, chatId: chat._id });
  } catch (error) {
    console.error('Claim exclusive error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as Published
app.post('/api/announcements/:id/publish', auth, async (req, res) => {
  try {
    const { publishedUrl } = req.body;
    
    // Find the announcement
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    // Verify user is the claiming journalist
    if (req.user.role === 'journalist' && 
        (!announcement.exclusiveClaimedBy || 
         announcement.exclusiveClaimedBy.toString() !== req.user._id.toString())) {
      return res.status(403).json({ message: 'Only the journalist who claimed this can mark it as published' });
    }
    
    // Or verify user is the company that created it
    if (req.user.role === 'company' && announcement.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Update announcement status
    announcement.status = 'published';
    await announcement.save();
    
    // Update claim status
    const claim = await Claim.findOne({ announcementId: announcement._id });
    if (claim) {
      claim.status = 'published';
      claim.publishedUrl = publishedUrl;
      await claim.save();
    }
    
    // If applicable, process journalist payout
    if (announcement.plan === 'Premium') {
      const payment = await Payment.findOne({ announcementId: announcement._id });
      if (payment) {
        payment.payoutTo = announcement.exclusiveClaimedBy;
        payment.payoutSplit = 30; // Example: 30% goes to journalist
        payment.status = 'completed';
        await payment.save();
      }
    }
    
    res.json({ message: 'Announcement marked as published', announcement });
  } catch (error) {
    console.error('Publish announcement error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// CHAT FUNCTIONALITY

// Get Chat for an Announcement
app.get('/api/announcements/:id/chat', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({ announcementId: req.params.id })
      .populate('messages.senderId', 'name role');
    
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }
    
    // Verify user is either company owner or claiming journalist
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    const isCompanyOwner = announcement.companyId.toString() === req.user._id.toString();
    const isClaimingJournalist = announcement.exclusiveClaimedBy && 
                               announcement.exclusiveClaimedBy.toString() === req.user._id.toString();
    
    if (!isCompanyOwner && !isClaimingJournalist) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(chat);
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send Chat Message
app.post('/api/announcements/:id/chat', auth, async (req, res) => {
  try {
    const { message } = req.body;
    
    // Find announcement and verify access
    const announcement = await Announcement.findById(req.params.id);
    
    if (!announcement) {
      return res.status(404).json({ message: 'Announcement not found' });
    }
    
    const isCompanyOwner = announcement.companyId.toString() === req.user._id.toString();
    const isClaimingJournalist = announcement.exclusiveClaimedBy && 
                               announcement.exclusiveClaimedBy.toString() === req.user._id.toString();
    
    if (!isCompanyOwner && !isClaimingJournalist) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Find or create chat thread
    let chat = await Chat.findOne({ announcementId: req.params.id });
    
    if (!chat) {
      chat = new Chat({
        announcementId: req.params.id,
        messages: []
      });
    }
    
    // Add new message
    chat.messages.push({
      senderId: req.user._id,
      message,
      timestamp: new Date()
    });
    
    await chat.save();
    
    res.json(chat);
  } catch (error) {
    console.error('Send chat message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;