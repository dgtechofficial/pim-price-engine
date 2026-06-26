const express = require('express');
const router = express.Router();
const appConfig = require('../lib/appConfig');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

router.get('/meta', (req, res) => {
  res.json({
    name: appConfig.name,
    version: appConfig.version,
    author: appConfig.author,
    pages: ['/', '/modifier.html', '/product_mapping/index.html'],
  });
});

router.post('/upload', (req, res) => {
  const { filename, contentType } = req.body || {};
  res.json({
    status: 'received',
    filename: filename || null,
    contentType: contentType || null,
    message: 'Upload endpoint is available for future SaaS integration.',
  });
});

module.exports = router;
