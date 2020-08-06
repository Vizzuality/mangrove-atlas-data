const ee = require('@google/earthengine');
const PRIVATE_KEY = require('./credentials.json');

/// Insert GEE function
console.log('checkpoint 1: ee and Private key ok)');
function app(locations){
  
  // GET DATA LAYERS
  // Get mangrove land-cover
  var mg_extent = ee.ImageCollection('projects/global-mangrove-watch/land-cover/mangrove-extent_version-2-0_1996--2016')

  // Get mangrove extent gain
  var mg_gain = ee.ImageCollection('projects/global-mangrove-watch/land-cover/mangrove-extent-gain_version-2-0_1996--2016')
  .map(function(im){
    var ts = ee.Date.fromYMD(ee.Number.parse(im.get('end_year')),1,1)
    return im
    .copyProperties(im)
    .set({'system:time_start':ts})
  })
  
  // Get mangrove extent loss
  var mg_loss = ee.ImageCollection('projects/global-mangrove-watch/land-cover/mangrove-extent-loss_version-2-0_1996--2016')
  .map(function(im){
    var ts = ee.Date.fromYMD(ee.Number.parse(im.get('end_year')),1,1)
    return im
    .copyProperties(im)
    .set({'system:time_start':ts})
  })
  
  
  // ANALYSIS PER GEOMETRY
  function get_zonal_stats(feature){
    
    // PROPERTY NAME LIST 
    var pnl = ee.List(['area_mangrove_gain_m2', 'area_mangrove_loss_m2', 'area_mangrove_m2'])
    
    // USE BEST EFFORT?
    var bestEffort = false
    
    // YEAR LIST
    var year_list = ee.List([1996, 2007, 2008, 2009, 2010, 2015, 2016])
    var year_list_change = ee.List([2007, 2008, 2009, 2010, 2015, 2016])
    
    // SCALE (M) OF CALCULATION
    var ns = mg_extent
    .first()
    .projection()
    .nominalScale()
    
    var scale = ns//ee.Number(30)
    
    
    // Convert feature to a geometry
    var aoi = feature.geometry()
    
    /** Helper to calculate zonal stats
     *  
     * @param ic {ee.Image Collection} An image collection 
     * @param aoi {ee.Geometry} The area of interest for the zonal stats
     * @param year_list {ee.List of Ints} List of years
     * @param scale {ee.Number} Scale of calculations
     * @param bestEffort {boolean} Use bestEffort
     */
      
    function calc_stats(ic, aoi, year_list, scale, bestEffort){
      
      // Map over year list
      var out = year_list.map(
        function(year){
          
          // Get image
          var im = ee.Image(
          ic
          .filterDate(ee.Date.fromYMD(year, 1, 1))
          .filterBounds(aoi)
          .first()
          .clip(aoi)
          )
          
          // Get band name(s)
          var bn = im.bandNames()
          
          // Create reducers
          var reducers = ee.Reducer.sum()
          
          // Apply reducers to area-weighted values
          var res = im
          .select(bn)
          .multiply(ee.Image.pixelArea())
          .reduceRegion({
            reducer: reducers,
            geometry: aoi,
            scale: scale,
            maxPixels: 1e13,
            bestEffort: bestEffort
          }).values()
          
          // Remove any null values
          //res = ee.List(res).removeAll([null])
          
          return ee.Algorithms.If(
            ee.Number(res.size()).gt(0.0)
            , res.get(0)
            , ee.Number(0.00))
      })
      
      year_list = year_list.map(function(n){return ee.Number(n).format()})
      var out_dict = ee.Dictionary.fromLists(year_list, out)
      return out_dict

    }
    
    // MANGROVE AREA [M2]
    var ma = calc_stats(mg_extent, aoi, year_list, scale, bestEffort)
    
    // MANGROVE AREA GAIN [M2̀]
    var mag = calc_stats(mg_gain, aoi, year_list_change, scale, bestEffort)
    
    // MANGROVE AREA LOSS [M2]
    var mal = calc_stats(mg_loss, aoi, year_list_change, scale, bestEffort)
    
    // Combine  into list
    var res = ee.List([mag, mal, ma])
    
    var out = ee.Feature(feature.set(ee.Dictionary.fromLists(pnl, res)))
    .set({'scale_m': scale})
    .set({'nominal_scale_m': ns})
    
    return out;
}
}
console.log('checkpoint 2: function read)');

// REST analysis wrapper
exports.analyse = (req, res) => {
  // define parameters needed
  //const assetId = req.body.assetId;
  const locations = req.body.locations;


  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }

  // Error if parameteres are not given
  if (!locations) {
    return res.json({
      error: 'location is required'
    });
  }

  // Authenticate, initiate ee, do analysis, and return the result
  ee.data.authenticateViaPrivateKey(PRIVATE_KEY, () => {
    ee.initialize(null, null, () => {
      //const result = calcHistogram(assetId, geometry); // app(name)
      const result = app(locations);
      result.evaluate((json) => res.status(200).json(json));
    });
  });
};
