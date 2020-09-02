/**
 * Google Earth Engine analysis for mangrove-atlas
 * 
 * @author Edward P. Morris (vizzuality)
 * @author David Inga (vizzuality)
 * 
 * @description This code contains the main analysis RESTful API service definition 
 * used to get analysis results from Google Earth Engine (GEE).
 * 
 */

//////////////////////////////////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////////////////////////////////

// IMPORT ENV VARIABLES
// To change edit .env file, available in JS as process.env.MY_VARAIBLE
require('dotenv').config()

// PARSE CREDENTIALS
const PRIVATE_KEY = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);

// IMPORT LIBRARIES
// Google Earth Engine client library (interact with GEE)
const ee = require('@google/earthengine');

// Google Cloud Storage client library (GCS file I/O)
const { Storage } = require('@google-cloud/storage');

// Custom JS utilities
// To load a file with functions, make sure it is included in the Docker definition!
// Also remember to add to required libaries to header of file 
// like`const ee = require('@google/earthengine');`
const uts = require('./utilities.js')

// Custom GEE JS analysis
// To load a file with functions, make sure it is included in the Docker definition!
// Also remember to add to required libaries to header of file 
// like`const ee = require('@google/earthengine');`
const hfs = require('./helper_functions.js')

// SET VERSION
// Package analysis service version tag using semantic versioning 2.0, see https://semver.org/
// TODO: automate this using something like https://github.com/semantic-release/semantic-release?
// MAJOR version when you make incompatible API changes
// MINOR version when you add functionality in a backwards compatible manner
// PATCH version when you make backwards compatible bug fixes
const v = uts.getPckgVersion()

//////////////////////////////////////////////////////////////////////////////
// REST WRAPPER
//////////////////////////////////////////////////////////////////////////////

exports.analyse = (req, res) => {
  console.log('\n', '\ninfo: Request started')

  //////////////////////////////////////////////////////////////////////////////
  // CONFIG
  //////////////////////////////////////////////////////////////////////////////

  // Set response permissions
  res.set('Access-Control-Allow-Origin', '*');

  // Set response to request.method === options
  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  //////////////////////////////////////////////////////////////////////////////
  // PARAMETERS
  //////////////////////////////////////////////////////////////////////////////
  
  // TODO: Make more generic? POST and accept a JSON object, automatically parse the JSON
  // object? Maybe no need for a specific parsers, instead a validator?

  // Define parameters used in the analysis
  // optionally give defaults or error if not given
  // if using html with the form '?' 
  // params are in the req.query object

  // View the req object
  //console.log('\ninfo: The req object\n', req)

  console.log('\ninfo: Parsed paramaters:')
  // @param {!string} fid Feature ID
  var fid = uts.parseRequest(req.query, 'fid', 'String', true, null)

  // @param {?array strings} 
  // [analysis_types=["land-cover", "mangrove-properties", "mangrove-carbon", "length-coast"]]
  // analysis_types The keywords for the types of analysis to return 
  var analysis_types = uts.parseRequest(req.query, 'analysis_types', 'Array', false,
    '["land-cover", "mangrove-properties", "mangrove-carbon", "length-coast"]');

  // @param {?array strings} [timestamps=["2016-01-01T00:00:00"]] JSON array of ISO8601 timestamp strings 
  var timestamps = uts.parseRequest(req.query, 'timestamps', 'Array', false, '["2016-01-01T00:00:00"]');

  // @param {?number} [buffer_distance_m=200] The distance in meters to buffer pixels of interest when using vector line intersection
  var buffer_distance_m = uts.parseRequest(req.query, 'buffer_distance_m', 'Number', false, 200);

  // @param {?number} [scale=30] The scale in meters for reducer calculations and simplifying of vectors
  var scale = uts.parseRequest(req.query, 'scale', 'Number', false, 30)

  // @param {?boolean} [bestEffort=false] Use bestEffort in reducer calculations;
  var bestEffort = uts.parseRequest(req.query, 'bestEffort', 'Boolean', false, false)

  // @param {?boolean} [show_exports_status=false] Return metadata about analysis exports;
  var show_exports_status = uts.parseRequest(req.query, 'show_exports_status', 'Boolean', false, false)

  //////////////////////////////////////////////////////////////////////////////
  // UTILITIES
  //////////////////////////////////////////////////////////////////////////////

  // RETURN METADATA ABOUT OPERATIONS
  // TODO: Make this a seperate endpoint? 
  if (show_exports_status === true) {
    // AUTHENTICATE EARTH ENGINE
    ee.data.authenticateViaPrivateKey(PRIVATE_KEY, function (e) {
      console.log('\ninfo: Authenticating earth-engine')

      // INITIALISE EARTH ENGINE
      ee.initialize(null, null, function () {
        console.log('\ninfo: Initializing earth-engine')

        ee.data.listOperations(100,
          function (json) {
            console.log('\ninfo: Status of last 20 export tasks \n', json.map(function (x) { return x["Serializable$values"] }))
            res.status(200).json( json.map(function (x) { return x["Serializable$values"] }))
            console.log('\ninfo: Request finished')
          });
      })
    })
  } else {

  //////////////////////////////////////////////////////////////////////////////
  // ANALYSIS
  //////////////////////////////////////////////////////////////////////////////

  // FIXME: correctly return errors

  // GET GEOJSON FEATURE COLLECTION 

  // Create (http) URL to (public) asset
  const url = uts.mkUrl(fid, process.env.GCS_PUBLIC_URL)
  // If using gs://
  // const url = uts.mkUrl(fid, "", "")

  // Fetch JSON
  // note using fetchJSON to fetch from public https:// 
  // seems quicker than using gcsfetchJSON from gs:// 
  uts.fetchJSON(url, function (json) {

    // Get Single Feature
    const f = json.features[0]

    // Get Feature properties
    var fp = f.properties
    //console.log('\ninfo: Feature properties ', uts.type(fp));

    // Get list of stored analysis_types keywords from Feature properties
    var stored_analysis_types = fp["analysis_types"]
    if (stored_analysis_types === undefined) { stored_analysis_types = [] }
    //console.log('\ninfo: Stored analysis types ', uts.type(stored_analysis_types), ' ', stored_analysis_types);

    // Create list of the new analysis types requested
    var new_analysis_types = analysis_types
      .filter(function (json) { return stored_analysis_types.indexOf(json) < 0; });
    console.log('\ninfo: New analysis types ', uts.type(new_analysis_types), '\n', new_analysis_types);

    //////////////////////////////////////////////////////////////////////////////
    // IF NO NEW ANALYSIS TYPES RETURN FEATURE COLLECTION
    if (new_analysis_types.length === 0) {
      console.log('\ninfo: All requested analysis types are already stored...')
      console.log('\ninfo: Returning stored results as a GeoJSON FeatureCollecion', uts.type(json))
      res.status(200).json(json)
    }

    //////////////////////////////////////////////////////////////////////////////
    // IF NEW ANALYSIS TYPES, START GEE ANALYSIS
    else {
      console.log('\ninfo: Running requested analysis on GEE')

      // Update Feature properties dict 
      fp["analysis_version"] = v.version
      fp["analysis_types"] = analysis_types
      //console.log('\ninfo: Updated analysis properties ', uts.type(fp));

      // Get GeoJSON geometry as dict
      var aoi = f["geometry"]
      //console.log('\ninfo: Geometry ', uts.type(aoi));

      // AUTHENTICATE EARTH ENGINE
      ee.data.authenticateViaPrivateKey(PRIVATE_KEY, function (e) {
        console.log('\ninfo: Authenticating earth-engine')

        // INITIALISE EARTH ENGINE
        ee.initialize(null, null, function () {
          console.log('\ninfo: Initializing earth-engine')

          //////////////////////////////////////////////////////////////////////////////
          // GEE ANALYSIS CODE
          //////////////////////////////////////////////////////////////////////////////
          // Add your  GEE analysis code here
          // use asyncrounous ee calls to the console for debugging, e.g.;
          // ee.Object.evaluate( function (info) { 
          // do something with the result (info);  console.log(info); });

          // CONVERT PARAMS TO EE OBJECTS
          aoi = ee.Geometry(aoi);
          //aoi.evaluate(function (info) { console.log(info); })

          // Convert timestamps from list of strings to ee.List of ee.Date
          timestamps = ee.List(timestamps).map(function (s) { return ee.Date(s) });
          //timestamps.evaluate(function (info) { console.log(info); })

          // Convert buffer_distance_m from number to ee.Number 
          buffer_distance_m = ee.Number(buffer_distance_m);
          //buffer_distance_m.evaluate(function (info) { console.log(info); })

          // Convert buffer_distance_m from number to ee.Number 
          scale = ee.Number(scale);
          //scale.evaluate(function (info) { console.log(info); })

          // Convert new analysis_types from list of strings to ee.List of ee.String
          new_analysis_types = ee.List(new_analysis_types);
          //new_analysis_types.evaluate(function (info) { console.log(info); })

          // GET ANALYSIS RESULTS
          var results = ee.Dictionary({})
          results = hfs.calc_mangrove_analysis(new_analysis_types, aoi, timestamps, buffer_distance_m, scale, bestEffort)
          //results.evaluate(function (json) { console.log('\ninfo: Analysis results ', uts.type(json)) });

          // Update Feature properties and add to FeatureCollection
          var out = ee.FeatureCollection([ee.Feature(aoi).set(results).set(fp)])
          //out.evaluate(function (json) { console.log('\ninfo: Updated Feature Collection ', uts.type(json)) });

          // Export updated Feature Collection
          // If analysis is ready in reasonable time write to GeoJSON file
          // otherwise start ee.batch.Export.table.toCloudStorage task 


          // FIXME: Should we prevent export if a task is already submitted?
          var task = ee.batch.Export.table.toCloudStorage({
            "collection": out,
            "description": [process.env.ANALYSIS_DIR, "v" + v.MAJOR, fid].join("_"),
            "bucket": process.env.GCS_BUCKET,
            "fileNamePrefix": [process.env.ANALYSIS_DIR, "v" + v.MAJOR, fid].join("/"),
            "fileFormat": 'GeoJSON'
          });
          task.start(
            function () { console.log('\ninfo: Started export task #' + task.id); },
            function (error) { console.log('error: ' + error); }
          );
          // Status of last 10 export task
          //ee.data.listOperations(10,
          //  function (array) {
          //    console.log('\ninfo: Status of last 10 export tasks \n',
          //      array.map(function (json) { return x.metadata }))
          //  });

          // RETURN RESULT AS JSON TO CLIENT AND SAVE TO FILE
          out.evaluate((json) => {
            uts.gcsUploadJSON(json, uts.mkUrl(fid, "", ""))
            console.log('\ninfo: Returned new results to client as a GeoJSON FeatureCollecion', uts.type(json))
            res.status(200).json(json)
            console.log('\ninfo: Request finished')

          });
        }); // End initialise earth engine
      }); // End authenticate using a service account.
    }// End GEE ANALYSIS

  }); // End fetchJSON
  }
}; // End exports.analyse
