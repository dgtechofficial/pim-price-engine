const path = require('path');
const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes/api');
const appConfig = require('./lib/appConfig');

const app = express();
const publicPath = path.join(__dirname, '..', 'public');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiRouter);
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

const port = process.env.PORT || 3020;
app.listen(port, () => {
  console.log(`${appConfig.name} listening on http://localhost:${port}`);
});

module.exports = app;
