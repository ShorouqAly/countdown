const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const authHeader = req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // using your .env secret
    req.user = decoded; // Attach decoded user info to the request
    next(); // Allow request to continue
  } catch (err) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};
