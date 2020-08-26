
// Load earthengine package
const ee = require('@google/earthengine');
// Load privateKey
const privateKey = require('./credentials.json');
console.log('info: ee package and Private key loaded');

// INSERT GEE FUNCTIONS
// To load a file with functions, make sure it is included in the Docker definition!
// Also remember to add to header of file `const ee = require('@google/earthengine');`
const hfs = require('./helper_functions.js')
console.log('info: helper functions loaded');

// REST analysis wrapper
exports.analyse = (req, res) => {

  // Define required parameters
  // optionally give defaults
  // if using 'analysis?' params are in req.query object

  // Set fid [list of strings] if not given 
  var fids = req.query.fids;
  if (fids === undefined) { fids = ['1_2_22']; }
  console.log('info: fids=' + fids);

  // Set analysis_types [list of strings] if not given 
  var analysis_types = req.query.analysis_types;
  if (analysis_types === undefined) { 
    analysis_types = ['land-cover', 'mangrove-properties', 'mangrove-carbon', 'length-coast']; 
  }
  console.log('info: analysis_types=' + analysis_types);

  // Set timestamps [list of strings] if not given 
  var timestamps = req.query.timestamps;
  if (timestamps === undefined) { timestamps = ['2016-01-01T00:00:00']; }
  console.log('info: timestamps=' + timestamps);

  // Set buffer distance [m] if not given
  var buffer_distance_m = req.query.buffer_distance_m;
  if (buffer_distance_m === undefined) { buffer_distance_m = 200; }
  console.log('info: buffer_distance_m=' + buffer_distance_m);

  // Set nominal scale [m] if not given
  var scale = req.query.scale;
  if (scale === undefined) { scale = 30; }
  console.log('info: scale=' + scale);

  // Set bestEffort [boolean] if not given
  var bestEffort = req.query.bestEffort;
  if (bestEffort === undefined) { bestEffort = false; }
  console.log('info: bestEffort=' + bestEffort);

  // Set response permissions
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  // Optionally give error if parameteres are not given
  //if (!fid) {
  //  return res.json({
  //    error: 'FID is required'
  // });
  //}

  // Authenticate, initiate ee, do analysis, and return the result
  // Authenticate using a service account.
  ee.data.authenticateViaPrivateKey(privateKey, function (e) {
    console.log('info: Authenticating earth-engine')
    // Initialise earth engine
    ee.initialize(null, null, function () {
      console.log('info: Initializing earth-engine')

      // Test we are using earthengine
      // use asyncrounous ee calls to console for debugging
      //ee.String('info: Hello from earthengine')
      //.evaluate(function (info) { console.log(info); });

      // Convert params to ee objects
      fids = ee.List(fids);
      //fids.evaluate(function(info) {console.log(info);})
      timestamps = ee.List(timestamps).map(function (s) { return ee.Date(s) });
      //timestamps.evaluate(function(info) {console.log(info);})
      buffer_distance_m = ee.Number(buffer_distance_m);
      //buffer_distance_m.evaluate(function(info) {console.log(info);})
      analysis_types = ee.List(analysis_types);
      //analysis_types.evaluate(function(info) {console.log(info);})  

      // Get featureCollection
      console.log('info: Getting ee.featureCollection')
      const fc = hfs.get_features_by_fid(fids)
      //fc.evaluate(function(info) {console.log(info);});

      // Get geometry of fc (if single fid, this is geometry of the feature)
      console.log('info: Converting to ee.Geometry')
      const aoi = fc.geometry()
      //aoi.evaluate(function(info) {console.log(info);});

      // Get analysis
      console.log('info: Getting analysis results dictionary')
      var out = hfs.calc_mangrove_analysis(
        analysis_types,aoi, timestamps, buffer_distance_m, scale, bestEffort)
      //console.log('test: analysis \n') 
      //out.evaluate((info) => { return console.log(info); });

      // Return results as JSON to client
      out.evaluate((json) => res.status(200).json(json))
    });
  });

};
