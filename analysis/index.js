const ee = require('@google/earthengine');
const PRIVATE_KEY = require('./credentials.json');

const arrSum = arr => arr.reduce((a, b) => a + b, 0);

const serialize = (originalData) => {
  if (!originalData || !originalData.length) return null;

  const props = originalData[0].properties;
  const data = props.histogram;
  const bucketWidth = data.bucketWidth;
  const countSum = arrSum(data.histogram);

  return {
    rows: data.histogram.map((d, i) => ({
      min: data.bucketMin + (bucketWidth * i),
      max: data.bucketMin + (bucketWidth * (i + 1)),
      count: d,
      percent: d / countSum
    })),
    fields: {
      min: { type: 'number' },
      max: { type: 'number' },
      count: { type: 'number' },
      percent: { type: 'number' }
    },
    total_rows: data.histogram.length,
    stats: {
       min: props.min,
      max: props.max,
      mean: props.mean,
      stdev: props.stdDev,
      sum: props.sum
    }
  };
};

// const calcHistogram = (assetId, geometry) => {
//   const image = ee.Image(assetId);
//   const reducers = ee.Reducer.histogram(20)
//       .combine(ee.Reducer.minMax(), '', true)
//       .combine(ee.Reducer.mean(),'', true )
//       .combine(ee.Reducer.stdDev(), '', true)
//       .combine(ee.Reducer.sum(), '', true);
//   const regReducer = {
//     collection: ee.FeatureCollection(geometry.features),
//     reducer: reducers
//   };
//   const histogram = image.reduceRegions(regReducer).toList(10000);

//   return histogram;
// };


// Define your earthengine function
var app = (name) => {
  return "Hello" + name;
}


exports.analyse = (req, res) => {
  const assetId = req.body.assetId;
  const geometry = req.body.geometry;
  const name = req.query.name;
  const test = req.query.this;

  // Error if required parameter(s) not given

  // req.body ==> json payload in POST request
  // if payload contains the key 'geometry' ==> req.body.geometry

  // req.query ==> localhost:8080?analysis=mean&period=[2015, 2019]
  // anything after the ? gets cast to  an object
  // key=value e.g. req.query.analysis ==> 'mean'
  // separated by &
  // always return a string: period=[2015, 2019] ==> req.query.period = '[2015, 2019]'


  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  // if (!assetId || !geometry) {
  //   return res.json({
  //     error: 'assetId and geometry are required'
  //   });
  // // Error if required parameter(s) not given
  // if (test || name) {
  //   return res.json({
  //     error: `name is ${name} and this is ${test} and asset is ${assetId}`
  //   });
  // }

  ee.data.authenticateViaPrivateKey(PRIVATE_KEY, () => {
    ee.initialize(null, null, () => {
      // const result = calcHistogram(assetId, geometry);
      var result = app(name);
      result.evaluate((json) => res.status(200).json(json));
    });
  });


};

