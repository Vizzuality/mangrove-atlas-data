const { BigQuery } = require('@google-cloud/bigquery');

const bigquery = new BigQuery();

/**
 * Data aggregated by month
 */
const aggregated = async () => {
  const query = `SELECT DATE_TRUNC(scr5_obs_date, MONTH) as date, count(scr5_obs_date) as count
  FROM deforestation_alerts.alerts_dev
  WHERE confident = 5
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
const layer = async () => {
  const query = `SELECT latitude, longitude, DATE_TRUNC(scr5_obs_date, MONTH) as date, count(scr5_obs_date) as count
  FROM deforestation_alerts.alerts_dev
  WHERE confident = 5
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
    if (req.query.format === 'geojson') {
      const result =  await layer();
      res.json(serializeToGeoJSON(result));
    } else {
      const result =  await aggregated();
      res.json(result);
    }
  }
  fetch();
};
