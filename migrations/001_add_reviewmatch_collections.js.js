const mongoose = require('mongoose');

const up = async () => {
  // Create indexes for better performance
  await mongoose.connection.collection('products').createIndex({ 
    'productInfo.category': 1, 
    'status': 1 
  });
  
  await mongoose.connection.collection('reviewrequests').createIndex({ 
    'companyId': 1, 
    'companyReview.status': 1 
  });
};

module.exports = { up };