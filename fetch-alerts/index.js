const { BigQuery } = require('@google-cloud/bigquery');
const axios = require('axios').default;

const bigquery = new BigQuery();

const getLocation = async (locationId) => {
  if (!locationId) return null;
  console.log('Getting geometry from locations API');
  const response = await axios.get(`https://mangrove-atlas-api-staging.herokuapp.com/api/locations/${locationId}`);
  if (response && response.data) return response.data.data;
  return null;
};

/**
 * Data aggregated by month
 */
const aggregated = async (locationId) => {
  const location = await getLocation(locationId);
  const whereQuery = location ? `AND ST_INTERSECTS(ST_GEOGFROMGEOJSON('${location.geometry}'), ST_GEOGPOINT(longitude, latitude))` : '';
  const query = `SELECT DATE_TRUNC(scr5_obs_date, MONTH) as date, count(scr5_obs_date) as count
  FROM deforestation_alerts.alerts_dev
  WHERE confident = 5 ${whereQuery}
  GROUP BY date`;

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
  };

  // Run the query as a job
  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  // Wait for the query to finish
  const [rows] = await job.getQueryResults();

  return rows;
}

/**
 * Data aggregated by month, latitude and longitude
 */
const layer = async (locationId) => {
  const location = await getLocation(locationId);
  const whereQuery = location ? `AND ST_INTERSECTS(ST_GEOGFROMGEOJSON('${location.geometry}'), ST_GEOGPOINT(longitude, latitude))` : '';
  const query = `SELECT latitude, longitude, DATE_TRUNC(scr5_obs_date, MONTH) as date, count(scr5_obs_date) as count
  FROM deforestation_alerts.alerts_dev
  WHERE confident = 5 ${whereQuery}
  GROUP BY latitude, longitude, date`;

  const options = {
    query,
    // Location must match that of the dataset(s) referenced in the query.
    location: 'US',
  };

  // Run the query as a job
  const [job] = await bigquery.createQueryJob(options);
  console.log(`Job ${job.id} started.`);

  // Wait for the query to finish
  const [rows] = await job.getQueryResults();

  return rows;
};

const serializeToGeoJSON = (data) => ({
  type: 'FeatureCollection',
  name: 'deforestation-alerts',
  features: data.map((d) => ({
    type: 'Feature',
    properties: d,
    geometry: {
      type: 'Point',
      coordinates: [d.latitude, d.longitude],
    },
  })),
});

exports.fetchAlerts = (req, res) => {
  // Get data and return a JSON
  async function fetch() {
    const locationId = req.query.location_id;
    if (req.query.format === 'geojson') {
      const result =  await layer(locationId);
      res.json(serializeToGeoJSON(result));
    } else {
      const result =  await aggregated(locationId);
      res.json(result);
    }
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
