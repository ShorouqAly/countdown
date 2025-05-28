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
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/exclusivewire', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

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

// User Registration
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, role, beatTags, companyName, publication, bio } = req.body;
    
    // Check if user already exists
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
    
    // Create and return JWT token
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

// User Login
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