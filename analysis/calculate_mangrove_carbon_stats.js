// Calculate mangrove soil carbon stats
// @author Edward P. Morris (Vizzuality)

// ON-THE-FLY ANALYSIS

// MAIN FUNCTION
function app(fid){
  
  // OPTIONS (CONSIDER SUPPLYING THESE?)
  // USE BEST EFFORT?
  var bestEffort = false
  // SET SCALE OF ANALYSIS
  var scale = ee.Number(30)
  // YEAR LIST
  var year_list = ee.List([2016])

  // GET FEATURE (CONSIDER CHANGING THIS TO A SUPPLIED GEOMETRY?)
  var feature = ee.FeatureCollection('projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old')
  .filterMetadata('id', 'equals', fid)
  // Convert feature to a geometry
  var aoi = feature.geometry()
  
  // GET DATA LAYERS
  // mangrove properties
  // soc: mangrove soil organic carbon
  // t OC / m2
  var ic_soc = ee.ImageCollection(ee.Image('projects/global-mangrove-watch/mangrove-properties/mangroves_SOC30m_0_100cm'))
  .map(function(im){
    return im
    .divide(10000)
    .set({"system:time_start":im.get("system:time_start")})
    
  })
  // agb: above ground biomss
  // t / m2
  var ic_agb = ee.ImageCollection('projects/global-mangrove-watch/mangrove-properties/mangrove_aboveground_biomass_1996-2016')
  .map(function(im){
    return im
    .divide(10000)
    .set({"system:time_start":im.get("system:time_start")})
    
  })
  
  // SET CONSTANTS
  // factor to convert above-ground biomass to below-ground biomass (Simard et al. 2019)
  var agb_to_bgb = ee.Number(0.49)
  // factor to convert above-ground biomass to organic carbon (Simard et al. 2019)
  var agb_to_OC = ee.Number(0.451)
  // factor to convert organic carbon to CO2 equivilent
  var OC_to_CO2e = ee.Number(11).divide(3)
      
  // HELPER FUNCTIONS
  // Helper to calculate empty histogram
  function nullFixedHistogram(name, min, max, count){
        var vals = ee.List.sequence({'start':min,'end':max,'count':count.add(1)})
        return ee.Dictionary({'0': 
          vals.zip(ee.List.repeat(0.0, vals.size())).slice(0,-1)
          
        })
        .rename(['0'],[name])
      }
  // Helper to restructure a fixed histrogram
  function restructureFixedHistogram(hist, name, min, max, count){
            var step = max.subtract(min).divide(count)
            hist = ee.Dictionary(hist).values()
            var breaks = ee.Array(ee.List(hist).get(0)).slice(1, 0, null, 2)
            .reshape([-1])
            var bl = breaks.toList().map(function(n){
              return ee.String(ee.Number(n).int().format())
              .cat('--')
              .cat(ee.String(ee.Number(n).add(step).int().format()))
            })
            var values = ee.Array(ee.List(hist).get(0)).slice(1, 1, null, 2)
            .reshape([-1]).int().toList()
            return ee.Dictionary({'0': ee.Dictionary.fromLists(bl, values)})
              .rename(['0'],[name])
      }
  // Helper to create sldStyle color ramp form fixed histogram
  function hist_to_ramp(hist, min, max, count, colors){
        var step = max.subtract(min).divide(count)
        hist = ee.Dictionary(hist).values()
        var breaks = ee.Array(ee.List(hist).get(0)).slice(1, 0, -1).reshape([-1])
        var bl = breaks.toList().map(function(n){
        return ee.String(ee.Number(n).int().format())
        .cat('--')
        .cat(ee.String(ee.Number(n).add(step).int().format()))
        })
        var str_quantity = breaks.toList().map(function(l){
          return ee.String(' quantity="').cat(ee.Number(l).int().format()).cat('"')
        })
        var str_label = bl.map(function(l){
          return ee.String(' label="').cat(l).cat('"')
        }) 
        var str_color = colors.map(function(l){
          return ee.String(' color="').cat(l).cat('"')
        }) 
        var ramp = ee.List.sequence(0, count.subtract(1)).map(function(i) {
          return ee.String('<ColorMapEntry ')
          .cat(ee.List(str_color).get(i))
          .cat(str_quantity.get(i))
          .cat(str_label.get(i))
          .cat('/>')
        }).flatten()
        return ee.String('<RasterSymbolizer><ColorMap type="ramp" extended="false" >')
        .cat(ramp.join(" "))
        .cat('</ColorMap></RasterSymbolizer>')
      }
      
  // Map over year list
  var out = year_list.map(
    function(year){
          
      // GET SOC IMAGE [t OC / m2]
      var soc = ic_soc
          .filterDate(ee.Date.fromYMD(year, 1, 1))
          .filterBounds(aoi)
          .first()
          //.clip(aoi)
          
      // CONVERT TO CO2e [t CO2e / m2]
      soc = soc
          .updateMask(soc.gt(0))
          .multiply(OC_to_CO2e)
          .rename('soc_co2e')
          
      // GET AGB IMAGE [t / m2]
      var agb = ee.Image(
          ic_agb
          .filterDate(ee.Date.fromYMD(year, 1, 1))
          .filterBounds(aoi)
          .first()
          //.clip(aoi)
          )
          
      // CONVERT TO CO2e [t CO2e / m2]
      agb = agb
          .updateMask(agb.gt(0))
          .multiply(agb_to_OC)
          .multiply(OC_to_CO2e)
          .rename('agb_co2e')
          
      // CONVERT TO BGB CO2e [t CO2e / m2]
      var bgb = agb
          .multiply(agb_to_bgb)
          .multiply(agb_to_OC)
          .multiply(OC_to_CO2e)
          .rename('bgb_co2e')
      
      // Combine into single image
      var im = soc.addBands(agb).addBands(bgb)
          
      // TOTALS PER GEOMETRY
      // Create reducers
      var reducers = ee.Reducer.sum()
          
      // Apply reducers to area-weighted values
      var res_total = im
          .multiply(ee.Image.pixelArea())
          .reduceRegion({
            reducer: reducers,
            geometry: aoi,
            scale: scale,
            maxPixels: 1e13,
            bestEffort: bestEffort
          })
          
      // HISTOGRAM TOTAL CARBON
      var bn = ee.String('toc_co2eha-1')
      var min = ee.Number(0)
      var max = ee.Number(3500)
      var count = ee.Number(5)
      var reducer_hist = ee.Reducer.fixedHistogram({'min':min,'max':max,'steps':count})
          
      // convert to toc [t CO2e / ha]
      im = im
          .multiply(10000)
          .rename(['soc_co2eha-1', 'agb_co2eha-1', 'bgb_co2eha-1'])
      
      // Select soc and agb
      var toc = im
          .select(['soc_co2eha-1', 'agb_co2eha-1'])
          .reduce(ee.Reducer.sum())
          .rename(bn)
          
      // create zero histogram
      var null_hist = nullFixedHistogram(bn, min, max, count)
          
      // create data histrogram
      var res_hist = toc 
          .reduceRegion({
            reducer: reducer_hist,
            geometry: aoi,
            scale: scale,
            maxPixels: 1e13,
            bestEffort: bestEffort
          })
          
      // IF NULL RETURN ZERO HISTOGRAM
      var testHist = ee.Number(ee.List(res_hist.values()).removeAll([null]).size()).gt(0.0)
      res_hist = ee.Algorithms.If(testHist, res_hist, null_hist)
          
      // CREATE DICT OF SLD STYLES FOR OUTPUT
      var colors = ee.List(["#5c4a3d","#933a06","#b84e17","#e68518","#eeb66b"]).reverse()
      var sld_dict = ee.Dictionary({
            'sldStyles': ee.Dictionary.fromLists(
              ee.List([bn]),
              ee.List([hist_to_ramp(res_hist, min, max, count, colors)])
            )})
          
      // RESTRUCTURE HISTOGRAM FOR OUTPUT
      var res_hist_out = restructureFixedHistogram(res_hist, bn, min, max, count)
          
      // SET BAND NAMES FOR OUTPUT
      var band_names = ee.Dictionary({
            'band_names': ee.List(['toc_co2eha-1', 'soc_co2eha-1', 'agb_co2eha-1', 'bgb_co2eha-1'])
          })
          
      // RETURN RESULTS FOR YEAR
      return res_total
          .combine({'image': im.addBands(toc)})
          .combine(res_hist_out)
          .combine(sld_dict)
          .combine(band_names)
      
      // MAP OVER YEARS
      year_list = year_list.map(function(n){return ee.Number(n).format()})
      return ee.Dictionary.fromLists(year_list, out)
    })
    // DO CALCS AND ADD TO FEATURE 
    return feature
    .set({'total_mangrove_carbon': out})
    .set({'system:index': fid})
}
exports.app = app;