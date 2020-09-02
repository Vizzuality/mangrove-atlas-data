//////////////////////////////////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////////////////////////////////

// Google Earth Engine client library (interact with GEE)
const ee = require('@google/earthengine');

// Google Cloud Storage client library (GCS file I/O)
const { Storage } = require('@google-cloud/storage');

// node-fetch library (fetch remote JSON) 
const fetch = require('node-fetch');

// Package version
const v = getPckgVersion()

//////////////////////////////////////////////////////////////////////////////
// FILE I/O
//////////////////////////////////////////////////////////////////////////////

/**
 * Get the analysis package version
 * 
 * @param {?string} separator String to split version string by
 * 
 * @returns {Object} Dictionary decribing the package version;
 *  version {string} Full version string
 *  MAJOR {number} Major version number
 *  MINOR {number} Minor version number
 *  PATCH {number} Patch version number
 */

function getPckgVersion(separator = ".") {
    var v = process.env.npm_package_version;
    var vs = v.split(".");
    return {
        "version": v,
        "MAJOR": v[0],
        "MINOR": v[2],
        "PATCH": v[4]
    };

}
exports.getPckgVersion = getPckgVersion
//console.log('Test getPckgVersion ', getPckgVersion());

/**
 * Make a URL path for read/write results
 * 
 * e.g., https://storage.googleapis.com/my-bucket/analysis/v1/fid.geojson
 * or gs://my-bucket/analysis/v1/fid.geojson
 * 
 * @param {!string} fid Feature ID, e.g., "1_2_22"
 * @param {!string} url_prefix The Public URL prefix, e.g., "gs://"
 * @param {?string} [bucket=process.env.GCS_BUCKET] The Cloud bucket name, default process.env.GCS_BUCKET
 * @param {?string} [dir_path = ""] Optional directory path, e.g., "my-dir/", default "" 
 * @param {?string} [version="v" + v.MAJOR] The analysis API MAJOR version, e.g., "v1", default "v" + v.MAJOR 
 * @param {?string} [directory=process.env.ANALYSIS_DIR] The Directory with analysis results, default process.env.ANALYSIS_DIR 
 * @param {?string} [file_ext = process.env.FN_EXTENSION] The file end type
 * 
 * @returns {!string} A URL string
 */

function mkUrl(
    fid,
    url_prefix,
    bucket = process.env.GCS_BUCKET,
    dir_path = "",
    version = "v" + v.MAJOR,
    directory = process.env.ANALYSIS_DIR,
    file_ext = process.env.FN_EXTENSION) {
    if (bucket === "" && url_prefix === "") {
        var out  = [directory, version, dir_path + fid + file_ext].join('/')
    } else {
        var out  = [url_prefix + bucket, directory, version, dir_path + fid + file_ext].join('/')
    }
    return out
}
exports.mkUrl = mkUrl
const url = mkUrl('1_2_22', 'https://storage.googleapis.com/');
//console.log('\nTest mkUrl:\n', url, '\n');

/**
 * Fetch JSON from URL
 * 
 * @param {!string} url The URL path to access the GeoJSON FeatureCollection
 * @param {!callback} callback A callback function 
 * 
 * @returns {promise object} Array of Feature properties
 */

const fetchJSON = async (url, callback) => {
    try {
        const response = await fetch(url);
        const json = await response.json();
        console.log('\ninfo: Fetched JSON from', url)
        return callback(json)
    } catch (error) {
        console.log(error);
    }
};
exports.fetchJSON = fetchJSON
//fetchJSON(url, (json) => console.log('\nTest fetchJSON:\n', json, '\n'));


/**
 * Fetch JSON from GCS
 * 
 * e.g., gs://my-bucket/analysis/v1/fid.geojson
 * 
 * @param {!string} file_path File path, e.g., "analysis/v1/fid.geojson"
 * @param {?string} [bucket=process.env.GCS_BUCKET] Cloud bucket name, default process.env.GCS_BUCKET
 * @param {?string} [gc_creds_path=process.env.GOOGLE_APPLICATION_CREDENTIALS] Path to GC credentials json, default process.env.GOOGLE_APPLICATION_CREDENTIALS

 * @returns {promise object} Prints message to console if completed
 */

const gcsFetchJSON = async (file_path, callback, bucket = process.env.GCS_BUCKET, gc_creds_path = process.env.GOOGLE_APPLICATION_CREDENTIALS) => {
    try {
        // Create storage object
        const storage = new Storage({ "keyFilename": gc_creds_path });
        const response = await storage
        .bucket(bucket)
        .file(file_path)
        .download();
        console.log('\ninfo: JSON downloaded from: ', 'gs://' + bucket + '/' + file_path);
        const json = await JSON.parse(response[0].toString());
        return callback(json)
    } catch (error) {
        console.log(error);
    };
}
exports.gcsFetchJSON = gcsFetchJSON
//gcsFetchJSON("analysis/v1/1_2_22.geojson", (json) => console.log('\nTest gcsFetchJSON:\n', json, '\n'));

/**
 * Upload JSON to GCS
 * 
 * e.g., gs://my-bucket/analysis/v1/fid.geojson
 * 
 * @param {!string} file_path File path, e.g., "analysis/v1/fid.geojson"
 * @param {?string} [bucket=process.env.GCS_BUCKET] Cloud bucket name, default process.env.GCS_BUCKET
 * @param {?string} [gc_creds_path=process.env.GOOGLE_APPLICATION_CREDENTIALS] Path to GC credentials json, default process.env.GOOGLE_APPLICATION_CREDENTIALS

 * @returns {promise} Prints message to console if completed
 */

const gcsUploadJSON = async (json, file_path, bucket = process.env.GCS_BUCKET, gc_creds_path = process.env.GOOGLE_APPLICATION_CREDENTIALS) => {
    try {
        // Create storage object
        const storage = new Storage({ "keyFilename": gc_creds_path });
        const response = await storage
        .bucket(bucket)
        .file(file_path)
        .save(JSON.stringify(json))
        .then(() => console.log('\ninfo: JSON uploaded to: ', 'gs://' + bucket + '/' + file_path))
    } catch (error) {
        console.log(error);
    };
}
exports.gcsUploadJSON = gcsUploadJSON
//const json = {"test": "This is a test"}
//console.log('\nTest gcsUploadJSON:\n', gcsUploadJSON(json, "analysis/v1/test.geojson"));

//////////////////////////////////////////////////////////////////////////////
// PARSERS
//////////////////////////////////////////////////////////////////////////////

/**
 * Get basic object type
 * 
 * @param {!any} obj The object to check
 * 
 * @returns {!string} The (simple) object type
 * 
 * @exports
 *  
 */

function type(obj) {
    return Object.prototype.toString.call(obj).slice(8, -1)
}
exports.type = type
//fetchJSON(url, (json) => console.log('\nTest type:\n', type(json), '\n'));

/**
 * Parse string parameters returned from REST query or params object using JSON.parse
 *  
 * @param {!object} req REST query or params object
 * @param {!string} key Key of parameter
 * @param {!string} dtype Data type of parameter
 * @param {?boolean} [required=false] Required parameter, if true creates error response as JSON if not given
 * @param {?any} [def_value=null] Default value for parameter, if required = false and def_value given, assigns default value
 * 
 * @returns {String|Array|Boolean|Number} The parsed paramater, a defualt value, or an error response 
 */

function parseRequest(req, key, dtype, required = false, def_value = null) {
    var out = req[key]
    if (out === undefined && required === true) {
        out = name + ' is required'
        res.json({ error: out })
    }
    if (out === undefined && required === false) { out = def_value }
    if (dtype === 'String') { out = '{"value": "' + out + '"}' }
    if (dtype === 'Array') { out = '{"value": ' + out + '}' }
    if (dtype === 'Number') { out = '{"value": ' + out + '}' }
    if (dtype === 'Boolean') { out = '{"value": ' + out + '}' }
    out = JSON.parse(out).value;
    console.log('\ninfo:     ' + key + '=' + out + ' dType: ' + type(out));
    return out
}
exports.parseRequest = parseRequest
//fetchJSON(url, (json) =>
//    console.log('\nTest parseRequest:\n', parseRequest(json, 'type', 'String'), '\n'));
