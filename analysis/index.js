// Import earthengine package
const ee = require('@google/earthengine');

// Define private key for service account
// see https://developers.google.com/earth-engine/service_account
const PRIVATE_KEY = require('./credentials.json');

// Define your earthengine function
var app = (name) => {
  return "Hello" + name;
}

// REST analysis wrapper
exports.analyse = (req, res) => {

  // Define parameters for the function
  // passed via GET (query)
  var name = req.query.name;

  // Set permissions
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  // Error if required parameter(s) not given
  if (!name) {
    return res.json({
      error: 'name is required'
    });
  }

  // Authenticate, initiate ee, do analysis, and return the result
  ee.data.authenticateViaPrivateKey(PRIVATE_KEY, () => {
    ee.initialize(null, null, function () {
      var result = app(name);
      result.evaluate((json) => res.status(200).json(json));
    }, function (e) {
      return res.json({ error: 'Initialization error: ' + e });
    });
  });
};
