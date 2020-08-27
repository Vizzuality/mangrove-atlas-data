
//////////////////////////////////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////////////////////////////////

// Imports the Google Earth Engine client library
const ee = require('@google/earthengine');

// Imports the Google Cloud client library
//const {Storage} = require('@google-cloud/storage');

// Imports node-fetch library 
const fetch = require('node-fetch');

// Load privateKey
const privateKey = require('./credentials.json');
console.log('info: ee package and Private key loaded');

// Creates a GCS client from a Google service account key.
//const storage = new Storage({keyFilename: "./credentials.json"});

// Load GEE JS functions
// To load a file with functions, make sure it is included in the Docker definition!
// Also remember to add to header of file `const ee = require('@google/earthengine');`
const hfs = require('./helper_functions.js')
console.log('info: helper functions loaded');

//////////////////////////////////////////////////////////////////////////////
// FILE I/O
//////////////////////////////////////////////////////////////////////////////

// Make a URL path from FID and analysis_type
function mkURL(
  fid,
  analysis_type,
  path = "https://storage.googleapis.com/mangrove_atlas/ee-export-tables/",
  end = ".geojson"
 ) {return path + analysis_type + "/" + fid + end} 

// Fetch GeoJSON properties 
function fetchProperties(url, settings = { method: "Get" }) {
  return fetch(url, settings)
    .then(res => {return res.json()})
    .then(json => {return json.features[0].properties})
}

// Export analysis results

 

//////////////////////////////////////////////////////////////////////////////
// REST WRAPPER
//////////////////////////////////////////////////////////////////////////////

exports.analyse = (req, res) => {

  //////////////////////////////////////////////////////////////////////////////
  // CONFIG
  //////////////////////////////////////////////////////////////////////////////

  // Set response permissions
  res.set('Access-Control-Allow-Origin', '*');

  // Set response to request.method is options
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  //////////////////////////////////////////////////////////////////////////////
  // PARSERS
  //////////////////////////////////////////////////////////////////////////////

  function type(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1)
  }

  function parseRequest(s, name, type, required, def_value) {
    var out = s
    if (s === undefined && required === true) {
      out = name + ' is required'
      res.json({ error: out })
    }
    if (s === undefined && required === false) { out = def_value }
    if (type === 'String'){out = '{"value": "' + out + '"}'}
    if (type === 'Array'){out = '{"value": ' + out + '}'}
    if (type === 'Number'){out = '{"value": ' + out + '}'}
    if (type === 'Boolean'){out = '{"value": ' + out + '}'}
    return JSON.parse(out).value
  }

  //////////////////////////////////////////////////////////////////////////////
  // PARAMETERS
  //////////////////////////////////////////////////////////////////////////////

  // Define parameters used in the analysis
  // optionally give defaults or error if not given
  // if using html with the form '?' 
  // params are in the req.query object

  // @param {string} fid Feature ID  
  // default: REQUIRED
  var fid = parseRequest(req.query.fid, 'fid', 'String', true, null)
  console.log('info: fid=' + fid);
  console.log(type(fid));

  // @param {list of strings} analysis_types The keywords for the types of analysis to return 
  // default: ['land-cover', 'mangrove-properties', 'mangrove-carbon', 'length-coast']
  var analysis_types = parseRequest(req.query.analysis_types, 'analysis_types', 'Array', false, '["land-cover","mangrove-properties", "mangrove-carbon"]');
  console.log('info: analysis_types=' + analysis_types);
  console.log(type(analysis_types));

  // @param {list of strings} timestamps List of ISO8601 timestamp strings 
  // default: ['2016-01-01T00:00:00']
  var timestamps = parseRequest(req.query.timestamps, 'timestamps', 'Array', false, '["2016-01-01T00:00:00"]');
  console.log('info: timestamps=' + timestamps);
  console.log(type(timestamps));

  // @param {number} buffer distance The distance in meters to buffer pixels of interest when using vector line intersection
  // default: 200
  var buffer_distance_m = parseRequest(req.query.buffer_distance_m, 'buffer_distance_m', 'Number', false, 200);
  console.log('info: buffer_distance_m=' + buffer_distance_m);
  console.log(type(buffer_distance_m));

  // @param {number} scale The scale in meters for reducer calculations and simplifying of vectors
  // default: 30
  var scale = parseRequest(req.query.scale, 'scale', 'Number', false, 30)
  console.log('info: scale=' + scale);
  console.log(type(scale));

  // @param {boolean} bestEffort Use bestEffort in reducer calculations;
  // this can allow faster calculations for larger geometries, but at an undefined scale 
  // default: false
  var bestEffort = parseRequest(req.query.bestEffort, 'bestEffort', 'Boolean', false, false)
  console.log('info: bestEffort=' + bestEffort);
  console.log(type(bestEffort));

  //////////////////////////////////////////////////////////////////////////////
  // FETCH PREVIOUS RESULTS
  //////////////////////////////////////////////////////////////////////////////
  
  // TODO: Check if precalculated results are available and fetch, 
  // if not do analysis and save results.

  const tst_fetch = fetchProperties(mkURL(fid, analysis_types[0]))
  console.log(tst_fetch)
  
  //////////////////////////////////////////////////////////////////////////////
  // ANALYSIS
  //////////////////////////////////////////////////////////////////////////////

  // FIXME: correctly return errors

  // Authenticate using a service account.
  ee.data.authenticateViaPrivateKey(privateKey, function (e) {
    console.log('info: Authenticating earth-engine')

    // Initialise earth engine
    ee.initialize(null, null, function () {
      console.log('info: Initializing earth-engine')

      //////////////////////////////////////////////////////////////////////////////
      // ANALYSIS CODE
      //////////////////////////////////////////////////////////////////////////////

      // Add your analysis code here
      // use asyncrounous ee calls to the console for debugging, e.g.;
      // eeObject.evaluate( function (info) { // do something with the result (info);  console.log(info); });

      // CONVERT PARAMS TO EE OBJECTS
      // this may not be needed, but is usually good practice:
      // "ee server functions should always take and return ee objects"

      // Convert fid from string to ee.String
      fid = ee.String(fid);
      fid.evaluate(function(info) {console.log(info);})

      // Convert timestamps from list of strings to ee.List of ee.Date
      timestamps = ee.List(timestamps).map(function (s) { return ee.Date(s) });
      timestamps.evaluate(function(info) {console.log(info);})

      // Convert buffer_distance_m from number to ee.Number 
      buffer_distance_m = ee.Number(buffer_distance_m);
      buffer_distance_m.evaluate(function(info) {console.log(info);})

      // Convert buffer_distance_m from number to ee.Number 
      scale = ee.Number(scale);
      scale.evaluate(function(info) {console.log(info);})

      // Convert analysis_types from list of strings to ee.List of ee.String
      analysis_types = ee.List(analysis_types);
      analysis_types.evaluate(function(info) {console.log(info);})  

      //////////////////////////////////////////////////////////////////////////////
      // GET SINGLE FEATURE
      console.log('info: Getting ee.Feature')
      const f = hfs.get_feature_by_fid(fid)
      //f.evaluate(function(info) {console.log(info);});

      //////////////////////////////////////////////////////////////////////////////
      // GET GEOMETRY OF FEATURE COLLECTION 
      // if single fid, this is geometry of the feature)
      console.log('info: Converting to ee.Geometry')
      const aoi = f.geometry()
      //aoi.evaluate(function(info) {console.log(info);});

      //////////////////////////////////////////////////////////////////////////////
      // GET ANALYSIS
      console.log('info: Getting analysis results')
      const results = hfs.calc_mangrove_analysis(
        analysis_types, aoi, timestamps, buffer_distance_m, scale, bestEffort)
      //results.evaluate((info) => {console.log(info);});

      //////////////////////////////////////////////////////////////////////////////
      // ADD TO FEATURE COLLECTION
      console.log('info: Adding analysis results to ee.Feature')
      var out = hfs.update_system_index(f.set(results), 'id')
      out = ee.FeatureCollection([out])
      //out.evaluate((info) => {console.log(info);});
      
      // EXPORT FEATURE COLLECTION
      var task = ee.batch.Export.table.toCloudStorage({
        'collection': out,
        'description': 'test',
        'bucket': 'mangrove_atlas',
        'fileNamePrefix': 'ee-export-tables-v1/test',
        'fileFormat': 'GeoJSON'
      });

      task.start(() => {
        console.log('Started task #' + task.id);},
        (error) => {console.log('Error: ' + error);});
      
      console.log(ee.data.listOperations(10).map(function(x){return x.metadata}))
      console.log(ee.data.listOperations(10).map(function(x){return x.error}))  

      //////////////////////////////////////////////////////////////////////////////
      // RETURN RESULT AS JSON TO CLIENT
      console.log('info: Returning results as a GeoJSON Feature')
      out.evaluate((json) => res.status(200).json(json))

    }); // End initialise earth engine
  }); // End authenticate using a service account.

}; // End exports.analyse
