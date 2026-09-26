const jwt = require('jsonwebtoken');

const ISSUER = 'uae-sme-cip';
const AUDIENCE = 'uae-sme-cip-api';

const auth = (req, res, next) => {
  const match = /^Bearer\s+([^\s]+)$/i.exec(req.get('authorization') || '');
  if (!match) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    req.user = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE
    });
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
};

auth.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You are not authorized to perform this action.' });
  }
  return next();
};

auth.tokenOptions = { expiresIn: '30m', issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256' };

module.exports = auth;
