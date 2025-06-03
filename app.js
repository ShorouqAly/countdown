// ExclusiveWire Backend - app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'exclusivewire-secret-key';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

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
  companyName: String,
  publication: String,
  bio: String,
  created: { type: Date, default: Date.now }
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
  amount: { type: Number, required: true },
  payoutSplit: { type: Number, default: 0 }, // percentage for journalist
  payoutTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'], 
    default: 'pending' 
  },
  transactionDate: { type: Date, default: Date.now }
});

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

// Routes

// ENHANCED PROFILE ROUTES

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

// User Registration

app.post('/api/users/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      beatTags,
      companyName,
      publication,
      bio,
      industry // required for CompanyProfile
    } = req.body;

    if (!role || !['journalist', 'company'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Check for required company fields
    if (role === 'company') {
      if (!companyName || !industry) {
        return res.status(400).json({ message: 'Company name and industry are required for company accounts' });
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create base User
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

    // Create role-specific profile
    if (role === 'journalist') {
      const journalistProfile = new JournalistProfile({
        userId: user._id
      });
      await journalistProfile.save();
    } else if (role === 'company') {
      const companyProfile = new CompanyProfile({
        userId: user._id,
        companyName,
        industry
      });
      await companyProfile.save();
    }

    // Generate JWT
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