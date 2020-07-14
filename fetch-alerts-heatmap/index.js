const { BigQuery } = require('@google-cloud/bigquery');
const axios = require('axios').default;
const reverse = require('turf-reverse');
const http = require('http');
const https = require('https');

const httpAgent = new http.Agent({keepAlive: true});
const httpsAgent = new https.Agent({keepAlive: true});

const bigquery = new BigQuery();
const cache = {};

const getLocation = async (locationId) => {
  if (!locationId) return null;
  console.log('Getting geometry from locations API');
  const response = await axios.get(`https://mangrove-atlas-api-staging.herokuapp.com/api/locations/${locationId}`, { httpAgent, httpsAgent});
  if (response && response.data) return response.data.data;
  return null;
};

const makeQuery = (location, year) => {
  let whereQuery = '';

  if (location) {
    const geoJSON = {
      type: 'Feature',
      properties: {},
      geometry: JSON.parse(location.geometry),
    };
    // Reverse coordinates to get [latitude, longitude]
    const geoJSONreverse = reverse(geoJSON);
    whereQuery = `AND ST_INTERSECTS(ST_GEOGFROMGEOJSON('${JSON.stringify(geoJSONreverse.geometry)}'), ST_GEOGPOINT(longitude, latitude))`;
  }

  return `SELECT latitude, longitude, count(ST_GEOGPOINT(longitude, latitude)) as count
  FROM deforestation_alerts.alerts
  WHERE confident = 5
    AND EXTRACT(YEAR FROM scr5_obs_date) = ${year}
    ${whereQuery}
  GROUP BY latitude, longitude`;
};

/**
 * Data aggregated by month, latitude and longitude
 */
const alertsJob = async (locationId, year = '2020') => {
  // First try to get data from cache in order to reduce costs
  const cacheKey = `${locationId || ''}_${year}`;
  if (cache[cacheKey]) {
    console.log(`Rensponse from cache ${cacheKey}`);
    return cache[cacheKey];
  }

  const location = await getLocation(locationId);
  const options = {
    query: makeQuery(location, year),
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
  };

  // Run the query as a job
  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  // Wait for the query to finish
  const [rows] = await job.getQueryResults();

  // Store in cache
  cache[cacheKey] = rows;

  return rows;
};

const serializeToGeoJSON = (data) => ({
  type: 'FeatureCollection',
  name: 'deforestation-alerts',
  features: data.map((d) => ({
    type: 'Feature',
    properties: {
      count: d.count,
    },
    geometry: {
      type: 'Point',
      coordinates: [d.latitude, d.longitude],
    },
  })),
});

exports.fetchAlertsHeatmap = (req, res) => {
  // Get data and return a JSON
  async function fetch() {
    const result =  await alertsJob(req.query.location_id, req.query.year);
    res.json(serializeToGeoJSON(result));
  }

  // Set CORS headers for preflight requests
  // Allows GETs from any origin with the Content-Type header
  // and caches preflight response for 3600s
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  } else {
    fetch();
  }
};
