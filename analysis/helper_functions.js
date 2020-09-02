// MANGROVE ATLAS HELPER FUNCTIONS 

// @author Edward P. Morris (vizzuality.)

// This script is used for on-the-fly analysis, change with care!
// Ensure every function is documented!
// Ensure every function is tested!

//////////////////////////////////////////////////////////////////////////////
// FIXME
//////////////////////////////////////////////////////////////////////////////

// Disabled group_values property in fixed histogram summaries due to strange bug
// "DateRange: Cannot interpret [0, 13] as a Date."
// Stand alone functions work ok, but when wrapped in calc_fixed_histogram
// gives error related to update_fixed_histogram.
// Do not see why it is looking for Dates in this function. 


//////////////////////////////////////////////////////////////////////////////
// CONFIG
//////////////////////////////////////////////////////////////////////////////

// Set these depending on the working environment to show tests or not
var ee_js = false;
var show_tests = false;

// If using nodejs need to load ee package
const ee = require('@google/earthengine');

//////////////////////////////////////////////////////////////////////////////
// DATA I/O
//////////////////////////////////////////////////////////////////////////////

/**
 * Import an ee.Object from a (Geo)JSON file stored in GCS 
 * 
 * @param {ee.String} gcs_url Google Cloud Storage path, e.g., gs://...
 * 
 * @returns {ee.Dictionary} The parse JSON object as a ee.Dictionary
 * 
 * @export
 */

function import_json(gcs_url) {
    return ee.Dictionary(ee.Blob(gcs_url)
        .string()
        .decodeJSON()
    );
}
exports.import_json = import_json;


/**
 * Parse a FeatureCollection from an ee.Dictionary
 * 
 * @param {ee.Dictionary} dict An ee.Dictionary describing a single feature FeatureCollecion, 
 * as returned by parsing a GeoJSON from file from GCS
 * 
 * @returns {ee.FeatureCollection} a single feature FeatureCollecion
 * 
 * @exports
 */

function parse_fc_dict(dict) {

    // Get dict keys
    var keys = ee.Dictionary(dict).keys();

    // Get fc properties
    var fc_props = ee.Algorithms.If(
        keys.contains('properties'),
        ee.Dictionary(dict).get('properties'),
        ee.Dictionary({})
    );

    // Get features (list of dictionaries)
    var fs = ee.List(ee.Dictionary(dict).get('features'));

    // Client loop over features list
    var size = fs.size().getInfo();
    var features = ee.List([]);
    for (var i = 0; i < size; i++) {
        var f_dict = fs.get(i);
        var p = ee.Dictionary(ee.Dictionary(f_dict).get('properties'));
        // Need to call geometry GeoJSON to client side??
        var g = ee.Geometry(ee.Dictionary(f_dict).get('geometry').getInfo());
        features = features.add(
            ee.Feature(g, p)
                .set({ 'system:index': p.get('id') })
        );
    }

    return ee.FeatureCollection(ee.List(features))
        .set(fc_props);
}
exports.parse_fc_dict = parse_fc_dict;

//////////////////////////////////////////////////////////////////////////////
// FEATURES AND GEOMETRIES
//////////////////////////////////////////////////////////////////////////////

/**
 * Filter feature collection by a single feature id
 * 
 * @param {ee.String} fid Single feature id (FID), e.g., '1_2_22'
 * @param {ee.String} fid_field Name of the fid property
 * @param {ee.String} asset_id Either the table asset id string;
 * defaults to "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old"
 * or a GCS path to a GeoJSON FeatureCollection.
 * 
 * @returnss {ee.Feature} A single feature with matching FID
 * 
 * @export
 */

function get_feature_by_fid(fid, asset_id, fid_key) {

    // Default FID key
    if (fid_key === undefined) {
        fid_key = "id";
    }

    // Default asset
    if (asset_id === undefined) {
        asset_id = "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old";
        // Parse string
        var fc = ee.FeatureCollection(asset_id);
    } else {
        // Parse from GCS path
        if (ee.List(ee.String(asset_id).split("//")).contains('gs:')) {
            var fc = ee.FeatureCollection(
                parse_fc_dict(
                    import_json(asset_id)
                )
            );
        } else {
            // Parse string
            var fc = ee.FeatureCollection(asset_id);
        }

    }
    // Return Feature
    return ee.Feature(fc.filterMetadata(fid_key, 'equals', fid).first());
}
exports.get_feature_by_fid = get_feature_by_fid;

/**
 * Filter feature collection by a list of feature ids
 * 
 * @param {ee.List} fids List of feature ids, e.g., ['1_2_22', '1_2_13']
 * @param {ee.String} fid_field Name of the fid property
 * @param {ee.String} asset_id The table asset id string to filter, defaults to "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old"
 * 
 * @returns {ee.FeatureCollection} Feature collection with selected features
 * 
 * @export
 */

function get_features_by_fids(fids, fid_key, asset_id) {
    if (fid_key === undefined) { fid_key = "id"; }
    if (asset_id === undefined) {
        asset_id = "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old";
    }
    return ee.FeatureCollection(asset_id)
        .filter(ee.Filter.inList(fid_key, ee.List(fids)));
}
exports.get_features_by_fids = get_features_by_fids;

/**
 * Filter feature collection by single iso code
 * 
 * @param {ee.List} iso_list List of Alpha 3 ISO codes, e.g., 'TZA'
 * @param {ee.String} iso_key Name of the iso property
 * @param {ee.String} asset_id The table asset id string to filter, defaults to "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old"
 * 
 * @returns {ee.Feature} Single selected Feature
 * 
 * @export
 */

function get_feature_by_country(iso, iso_field, asset_id) {
    if (iso_field === undefined) { iso_field = "iso"; }
    if (asset_id === undefined) {
        asset_id = "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old";
    }
    return ee.FeatureCollection(asset_id)
        .filterMetadata('type', 'equals', 'country')
        .filterMetadata(iso_field, 'equals', iso)
        .first();
}
exports.get_feature_by_country = get_feature_by_country;

/**
 * Filter feature collection by list of iso codes
 * 
 * @param {ee.List} iso_list List of Alpha 3 ISO codes, e.g., ['TZA', 'SEN']
 * @param {ee.String} iso_key Name of the iso property
 * @param {ee.String} asset_id The table asset id string to filter, defaults to "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old"
 * 
 * @returns {ee.FeatureCollection} Feature collection with selected countries
 * 
 * @export
 */

function get_features_by_countries(iso_list, iso_field, asset_id) {
    if (iso_field === undefined) { iso_field = "iso"; }
    if (asset_id === undefined) {
        asset_id = "projects/global-mangrove-watch/boundaries/locations_aoi-country-wdpa_old";
    }
    return ee.FeatureCollection(asset_id)
        .filterMetadata('type', 'equals', 'country')
        .filter(ee.Filter.inList(iso_field, ee.List(iso_list)));
}
exports.get_features_by_countries = get_features_by_countries;

/**
 * Create universal unique identifier (RFC4122)
 * 
 * code from https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
 * see also https://en.wikipedia.org/wiki/Universally_unique_identifier and // http://www.ietf.org/rfc/rfc4122.txt
 * 
 * @returnss {ee.String} A RFC4122 UUID 
 * 
 * @export
 * 
 */

function createUUID() {
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) { s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1); }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";
    return s.join("");

}
exports.createUUID = createUUID;

/**
 * Update a features system index from a property
 * 
 * @param {ee.Feature} f Single ee.Feature
 * @param {ee.String} fid_key Name of the Features fid property
* 
 * @returns {ee.Feature} A single feature with an updated `ssystem:index` value
 * 
 * @export
 */

function update_system_index(f, fid_key) {
    var fid = f.get(fid_key);
    return f.set('system:index', fid);
}
exports.update_system_index = update_system_index;

/**
 * Check if a features (multi) polygon geometry has inner holes
 * 
 * @returnss {ee.Feature} Feature with property 'hasHoles' 
 * 
 * @export
 * 
 */

function check_has_holes(feature) {
    var hasHoles = feature.geometry()
        .geometries()
        .map(function (g) { return ee.Geometry(g).coordinates().size().gt(1) });
    return feature.set({ 'hasHoles': hasHoles });
}
exports.check_has_holes = check_has_holes;

/**
 * Remove inner holes from a (multi) polygon geometry
 * 
 * @returnss {ee.Geometry} A multipolygon geometry with inner holes removed 
 * 
 * @export
 * 
 */

function remove_holes(geometry) {
    return ee.Geometry.MultiPolygon(
        geometry
            .geometries()
            .map(function (g) {
                return ee.Geometry(g).coordinates().get(0);
            }));
}
exports.remove_holes = remove_holes;

/**
 * Intersect with geometry and simplify
 * 
 * @param {ee.FeatureCollection} fc  The feature collection to intersect
 * @param {ee.Geometry} aoi  The geometry to interect with
 * @param {ee.Number} scale  The scale to simplify too
 * 
 * @returnss {ee.FeatureCollection} Feature collection clipped to aoi 
 * 
 * @export
 * 
 */

function intersect_and_simplify(fc, aoi, scale) {

    // Filter by bounds and simplify
    fc = ee.FeatureCollection(fc)
        .filterBounds(aoi)
        .map(function (f) {
            return ee.Feature(f.geometry().simplify(ee.Number(scale)), {})
                .copyProperties(f);
        });

    // Filter features to find which are contained within AOI
    fc = fc
        .map(function (f) {
            var inside = aoi.contains(f.geometry(), scale);
            return f.set('containedIn', inside);
        });
    var f_in = fc.filter(ee.Filter.eq("containedIn", true));
    var f_out = fc.filter(ee.Filter.eq("containedIn", false));

    // Intersect features not contained in AOI
    f_out = f_out.map(function (f) { return f.intersection(aoi, scale) });

    // Recombine fc
    // returns fc
    return f_in.merge(f_out);
}
exports.intersect_and_simplify = intersect_and_simplify;

//////////////////////////////////////////////////////////////////////////////
// DATASETS
//////////////////////////////////////////////////////////////////////////////

/**
 * Convert biomass/carbon units
 * 
 * @params {ee.ImageCollection} ic  The image collection to convert
 * @params {ee.String} from_to  The conversion keyword:
    'agb_to_bgb' : above-ground to below ground biomass 
    'bio_to_OC' : biomass to organic carbon
    'OC_to_CO2e' : organic carbon to units CO2 equivalent
    'bio_to_CO2e' : biomass to organic carbon with units CO2 equivalent
 * 
 * @returns {ee.ImageCollection} Image collection with converted values
 * 
 */

function convert_carbon(ic, from_to) {

    // Set constants
    // factor to convert above-ground biomass to below-ground biomass (Simard et al. 2019)
    var agb_to_bgb = ee.Number(0.49);
    // factor to convert above-ground biomass to organic carbon (Simard et al. 2019)
    var bio_to_OC = ee.Number(0.451);
    // factor to convert organic carbon to CO2 equivilent
    var OC_to_CO2e = ee.Number(11).divide(3);

    // Cast ic
    ic = ee.ImageCollection(ic);

    // Dictionary of conversions
    var out = ee.Dictionary({
        'agb_to_bgb': ic.map(function (i) {
            return i.updateMask(i.gt(0))
                .multiply(agb_to_bgb)
                .rename('bgb')
                .copyProperties(i)
                .set('system:time_start', i.get('system:time_start'));
        }),
        'bio_to_OC': ic.map(function (i) {
            return i.updateMask(i.gt(0))
                .multiply(bio_to_OC)
                .rename(ee.String(i.bandNames().get(0)).cat('_oc'))
                .copyProperties(i)
                .set('system:time_start', i.get('system:time_start'));
        }),
        'OC_to_CO2e': ic.map(function (i) {
            return i.updateMask(i.gt(0))
                .multiply(OC_to_CO2e)
                .rename(ee.String(i.bandNames().get(0)).cat('_co2e'))
                .copyProperties(i)
                .set('system:time_start', i.get('system:time_start'));
        }),
        'bio_to_CO2e': ic.map(function (i) {
            return i.updateMask(i.gt(0))
                .multiply(bio_to_OC).multiply(OC_to_CO2e)
                .rename(ee.String(i.bandNames().get(0)).cat('_oc_co2e'))
                .copyProperties(i)
                .set('system:time_start', i.get('system:time_start'));
        })

    });

    // Return conversion
    return ee.ImageCollection(out.get(from_to));

}
exports.convert_carbon = convert_carbon;

/**
 * Get a dataset
 * 
 * @param {ee.String} name Name of dataset to retrieve:
 *  'coastline-vector': Latest coastline linestring vectors,
    'coastline-raster': Latest coastline linestring burnt to raster at 30m resolution,
    'mangrove-extent': Multitemporal extent of mangrove habitat [1],
    'mangrove-distance': Multitemporal linear distance from mangrove habitat [m],
    'mangrove-gain': Multitemporal gain of mangrove habitat between consequative time-intervals [1],
    'mangrove-loss': Multitemporal loss of mangrove habitat between consequative time-intervals [1],
    'mangrove-agb': Multitemporal above-ground biomass of mangrove habitat [t / m2],
    'mangrove-hmax': Multitemporal maximum canopy height of mangrove habitat [m],
    'mangrove-hba': Multitemporal basal-area weight height of mangrove habitat [m],
    'mangrove-soc': 2016 soil organic carbon of mangrove habitat [t / m2],
    'mangrove-hotspots': Polygons of 2016 conservation status for Africa
 * 
 * @returns {ee.Image, ee.ImageCollection or ee.FeatureCollection} The selected dataset
 */

function get_dataset(name) {
    switch (name) {

        //////////////////////////////////////////////////////////////////////////////
        // LAND-COVER
        //////////////////////////////////////////////////////////////////////////////

        // Extent of mangrove habitat
        // multi-year binary raster representing precense of mangrove habitat in each year
        // units: 1
        case 'mangrove-extent':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/land-cover/mangrove-extent_version-2-0_1996--2016');
            break;

        // Distance from mangrove land-cover (time-series of linear distance in meters rasters)
        // units: m
        case 'mangrove-distance':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/land-cover/mangrove-extent-distance_version-2-0_1996--2016')
                .map(function (im) {
                    var y = ee.String(im.get('system:index')).split('_').get(1);
                    var ts = ee.Date.fromYMD(ee.Number.parse(y), 1, 1);
                    return im
                        .copyProperties(im)
                        .set({ 'system:time_start': ts });

                });
            break;

        // Gain in mangrove extent
        // multi-year binary raster representing increase in mangrove habitat between each time-interval
        // units: 1
        case 'mangrove-gain':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/land-cover/mangrove-extent-gain_version-2-0_1996--2016')
                .map(function (im) {
                    var ts = ee.Date.fromYMD(ee.Number.parse(im.get('end_year')), 1, 1).millis();
                    return im
                        .copyProperties(im)
                        .set({ 'system:time_start': ts });
                });
            break;

        // Loss in mangrove extent
        // multi-year binary raster representing decrease in mangrove habitat between each time-interval
        // units: 1
        case 'mangrove-loss':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/land-cover/mangrove-extent-loss_version-2-0_1996--2016')
                .map(function (im) {
                    var ts = ee.Date.fromYMD(ee.Number.parse(im.get('end_year')), 1, 1).millis();
                    return im
                        .copyProperties(im)
                        .set({ 'system:time_start': ts });
                });
            break;

        //////////////////////////////////////////////////////////////////////////////
        // COASTLINE
        //////////////////////////////////////////////////////////////////////////////

        // Coastline using OSM coastline export 2020-06-29
        // units: 1
        case 'coastline-vector':
            var out = ee.FeatureCollection(
                'projects/global-mangrove-watch/physical-environment/coastlines-split-4326');
            break;
        case 'coastline-raster':
            var out = ee.Image(
                'projects/global-mangrove-watch/physical-environment/coastlines-split-4326-raster');
            break;

        //////////////////////////////////////////////////////////////////////////////  
        // MANGROVE-PROPERTIES
        //////////////////////////////////////////////////////////////////////////////

        // agb: above ground biomss density
        // units: t / m2
        case 'mangrove-agb':
            var out = ee.ImageCollection('projects/global-mangrove-watch/mangrove-properties/mangrove_aboveground_biomass_1996-2016')
                .map(function (im) {
                    return im
                        .rename('agb')
                        .divide(10000)
                        .copyProperties(im)
                        .set({ "system:time_start": im.get("system:time_start") });

                });
            break;

        // hmax: maximum canopy height
        // units: m
        case 'mangrove-hmax':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/mangrove-properties/mangrove_max_canopy_height_1996-2016')
                .map(function (im) {
                    return im
                        .rename('hmax')
                        .copyProperties(im)
                        .set({ "system:time_start": im.get("system:time_start") });

                });
            break;

        // hba: basal-area weight canopy height
        // units: m
        case 'mangrove-hba':
            var out = ee.ImageCollection(
                'projects/global-mangrove-watch/mangrove-properties/mangrove_basal-area_weighted_height_1996-2016')
                .map(function (im) {
                    return im
                        .rename('hba')
                        .copyProperties(im)
                        .set({ "system:time_start": im.get("system:time_start") });

                });
            break;

        // soc: mangrove soil organic carbon; ONLY 2016
        // units: t OC / m2
        case 'mangrove-soc':
            var out = ee.ImageCollection(ee.Image('projects/global-mangrove-watch/mangrove-properties/mangroves_SOC30m_0_100cm'))
                .map(function (im) {
                    return im
                        .divide(10000)
                        .set({ "system:time_start": im.get("system:time_start") });

                });
            break;

        //////////////////////////////////////////////////////////////////////////////  
        // ENVIRONMENTAL PRESSURES
        //////////////////////////////////////////////////////////////////////////////

        // Conservation hotspots data (vector); ONLY AFRICA
        // units: 1
        case 'mangrove-hotspots':
            var out = ee.FeatureCollection(
                'projects/global-mangrove-watch/environmental-pressures/cons_hotspots_simplified');
            break;


        default:
            var out = "No dataset found";
    } // end switch

    // Return the object
    return out;

}
exports.get_dataset = get_dataset;

/*for(var i=1; i<8; i++) {
  panel.widgets().set(i, ui.Button('button ' + i))
}
*
 * Get a datasets legend definition
 * 
 * @param {ee.String} name Name of dataset to retrieve:
 *  'coastline-vector': Latest coastline linestring vectors,
    'coastline-raster': Latest coastline linestring burnt to raster at 30m resolution,
    'mangrove-extent': Multitemporal extent of mangrove habitat [1],
    'mangrove-distance': Multitemporal linear distance from mangrove habitat [m],
    'mangrove-gain': Multitemporal gain of mangrove habitat between consequative time-intervals [1],
    'mangrove-loss': Multitemporal loss of mangrove habitat between consequative time-intervals [1],
    'mangrove-agb': Multitemporal above-ground biomass of mangrove habitat [t / m2],
    'mangrove-hmax': Multitemporal maximum canopy height of mangrove habitat [m],
    'mangrove-hba': Multitemporal basal-area weight height of mangrove habitat [m],
    'mangrove-soc': 2016 soil organic carbon of mangrove habitat [t / m2],
    'mangrove-hotspots': Polygons of 2016 conservation status for Africa
 * 
 * @returns {ee.Dictionary} The selected datasets properties, as: {"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250]}
 * 
 * 
 * @export
 */

function get_dataset_legend(name) {

    // make group labels
    var group_labels = function (params) {
        return ee.List(params.get('group_lower')).zip(params.get('group_upper'))
            .map(function (l) { return ee.List(l).join('--') });

    };

    // COASTLINE
    // Coastline using OSM coastline export 2020-06-29
    // units: 1
    var coastline_vector = null;
    var coastline_raster = null;

    // LAND-COVER
    // Extent of mangrove habitat
    // multi-year binary raster representing precense of mangrove habitat in each year
    // units: 1
    var mg_extent = ee.Dictionary({
        'group_colors': ee.List(["#01C4BE"]),
        'group_labels': ee.List(["Presence"]),
        'group_lower': ee.List([0]),
        'group_upper': ee.List([1]),
    });

    // Distance from mangrove land-cover (time-series of linear distance in meters rasters)
    // units: m
    var mg_distance = ee.Dictionary({
        'group_colors': null,
        'group_labels': null,
        'group_lower': null,
        'group_upper': null,
    });

    // Gain in mangrove extent
    // multi-year binary raster representing increase in mangrove habitat between each time-interval
    // units: 1
    var mg_gain = ee.Dictionary({
        'group_colors': ee.List(["#a6cb10"]),
        'group_labels': ee.List(["Gain"]),
        'group_lower': ee.List([0]),
        'group_upper': ee.List([1]),
    });

    // Loss in mangrove extent
    // multi-year binary raster representing decrease in mangrove habitat between each time-interval
    // units: 1
    var mg_loss = ee.Dictionary({
        'group_colors': ee.List(["#eb6240"]),
        'group_labels': ee.List(["Loss"]),
        'group_lower': ee.List([0]),
        'group_upper': ee.List([1]),
    });

    // MANGROVE-PROPERTIES
    // agb: above ground biomss density
    // units: t / ha
    var mg_agb = ee.Dictionary({
        'group_colors': ee.List(["#EAF19D", "#B8E98E", "#1B97C1", "#1C52A3", "#13267F"]),
        'group_labels': null,
        'group_lower': ee.List([0, 250, 500, 750, 1000]),
        'group_upper': ee.List([250, 500, 750, 1000, 1250])
    });
    mg_agb = mg_agb.set('group_labels', group_labels(mg_agb));

    // hmax: maximum canopy height
    var mg_hmax = ee.Dictionary({
        'group_colors': ee.List(["#C9BB42", "#8BA205", "#428710", "#0A6624", "#103C1F"]),
        'group_labels': null,
        'group_lower': ee.List([0, 13, 26, 39, 52]),
        'group_upper': ee.List([13, 26, 39, 52, 65])
    });
    mg_hmax = mg_hmax.set('group_labels', group_labels(mg_hmax));

    // hba: basal-area weight canopy height
    // units: m
    var mg_hba = null;

    // soc: mangrove soil organic carbon; ONLY 2016
    // units: t OC / m2
    var mg_soc = ee.Dictionary({
        'group_colors': ee.List(["#5c4a3d", "#933a06", "#b84e17", "#e68518", "#eeb66b"]).reverse(),
        'group_labels': null,
        'group_lower': ee.List([0, 700, 1400, 2100, 2800]),
        'group_upper': ee.List([700, 1400, 2100, 2800, 3500]),
    });
    mg_soc = null;

    // soc: mangrove soil organic carbon; ONLY 2016
    // units: t OC / m2
    var mg_toc = ee.Dictionary({
        'group_colors': ee.List(["#5c4a3d", "#933a06", "#b84e17", "#e68518", "#eeb66b"]).reverse(),
        'group_labels': null,
        'group_lower': ee.List([0, 700, 1400, 2100, 2800]),
        'group_upper': ee.List([700, 1400, 2100, 2800, 3500]),
    });
    mg_toc = mg_toc.set('group_labels', group_labels(mg_toc));

    // ENVIRONMENTAL PRESSURES
    // Conservation hotspots data (vector); ONLY AFRICA
    // units: 1
    var mg_hotspots = null;

    var out = ee.Dictionary({
        'coastline-vector': coastline_vector,
        'coastline-raster': coastline_raster,
        'mangrove-extent': mg_extent,
        'mangrove-distance': mg_distance,
        'mangrove-gain': mg_gain,
        'mangrove-loss': mg_loss,
        'mangrove-agb': mg_agb,
        'mangrove-hmax': mg_hmax,
        'mangrove-hba': mg_hba,
        'mangrove-soc': mg_soc,
        'mangrove-toc': mg_toc,
        'mangrove-hotspots': mg_hotspots
    });

    return out.get(name);
}
exports.get_dataset_legend = get_dataset_legend;

//////////////////////////////////////////////////////////////////////////////
// DATES
//////////////////////////////////////////////////////////////////////////////

/**
 * Get timestamps from image collection and return as a feature collection
 * 
 * @param {ee.ImageCollection} ic Image collection to extract time stamps ('system_time_start')
 * 
 * @returns {ee.FeatureCollection} With empty features with property 'system_time_start' which contains an ee.String representing the date in ISO8601 format
 * 
 * @export
 * 
 */

function get_ic_timestamp_fc(ic) {
    return ee.FeatureCollection(ee.List(ee.List(ee.ImageCollection(ic).aggregate_array('system:time_start')))
        .map(function (d) {
            return ee.Feature(null, { 'system_time_start': ee.String(ee.Date(d).format()) });

        }));
}
exports.get_ic_timestamp_fc = get_ic_timestamp_fc;

/**
 * Get timestamps from feature collection and return as list of dates
 * 
 * @param {ee.FeatureCollection} fc Feature collection to extract time stamps ('system_time_start')
 * 
 * @returns {ee.List of ee.Dates} List of ee.Date objects
 * 
 * @export
 * 
 */

function get_fc_timestamps(fc) {
    return ee.List(fc.aggregate_array('system_time_start'))
        .map(function (s) { return ee.Date(s) });
}
exports.get_fc_timestamps = get_fc_timestamps;

/**
 * Convert list of date objects to ISO8601 strings
 * 
 * @param {ee.List of ee.Dates} timestamps List of ee.Date objects
 * 
 * @returns {ee.List of ee.Strings} List of ee.Strings representing dates in ISO8601 format
 * 
 * @export
 * 
 */

function timestamps_to_strings(timestamps) {
    return ee.List(ee.List(timestamps)
        .map(function (d) { return ee.String(ee.Date(d).format()) }));
}
exports.timestamps_to_strings = timestamps_to_strings;

/**
 * Filter list of date objects to those matching dates in an image collection 
 *
 * @param {ee.ImageCollection} ic Image collection to extract time stamps ('system_time_start')
 * @param {ee.List of ee.Dates} timestamps List of ee.Date objects
 * 
 * @returns {ee.List of ee.Dates} List of ee.Dates found both within the timestamps and the image collection
 * 
 * @export
 * 
 */

function filter_timestamps(ic, timestamps) {
    var ic_ts = get_ic_timestamp_fc(ic);
    var ts = timestamps_to_strings(timestamps);
    var fc = ic_ts.filter(ee.Filter.inList('system_time_start', ts));
    return get_fc_timestamps(fc);
}
exports.filter_timestamps = filter_timestamps;

//////////////////////////////////////////////////////////////////////////////
// HISTOGRAMS
//////////////////////////////////////////////////////////////////////////////

/**
 * Return an empty fixed histogram object
 *
 * @param {ee.Dictionary} params Parameters used to create the fixed histogram object:
 *  {ee.Number} min Minimum value of breaks
 *  {ee.Number} max Maximum value of breaks
 *  {ee.Number} step Size of step between each break
 *  {ee.List} group_lower Lower boundaries of groupings for legend
 *  {ee.List} group_upper Upper boundaries of groupings for legend
 *  {ee.List} group_colors Colors for groupings of legend
 * 
 * @returns {ee.Dict} A fixed histogram object with values of zero: {"breaks_lower":[0,10,20,...,2480,2490],"group_colors":["#eeb66b","#e68518","#b84e17","#933a06","#5c4a3d"],"group_labels":["0--500","500--1000","1000--1500","1500--2000","2000--2500"],"group_lower":[0,500,1000,1500,2000],"group_upper":[500,1000,1500,2000,2500],"max":2500,"min":0,"n_breaks":250,"step":10,"values":[0,0,0,...,0,0]}
 * 
 * @export
 */

function null_fixed_histogram(params) {
    params = ee.Dictionary(params);
    var breaks = ee.List.sequence({
        'start': params.get('min'),
        'end': params.get('max'),
        'step': params.get('step')
    })
        .slice(0, -1);
    var group_labels = ee.List(params.get('group_lower'))
        .zip(params.get('group_upper'))
        .map(function (l) { return ee.List(l).join('--') });
    return ee.Dictionary({
        'n_breaks': breaks.size(),
        'breaks_lower': breaks,
        'values': ee.List.repeat(0.0, breaks.size()),
        'group_labels': group_labels,
    }).combine(params);
}
exports.null_fixed_histogram = null_fixed_histogram;

/**
 * Extract breaks from result of a ee.Reducer.fixedHistogram object
 *
 * @param {ee.List of ee.List} hist List of lists with break and value, e.g., [[0,3], [3,6]]
 * 
 * @returns {ee.Array} Breaks (lower bound) extracted from the histogram 
 */

function extract_breaks(hist) {
    hist = ee.Array(ee.Dictionary(hist).values().get(0));
    return ee.Array(hist.slice(1, 0, null, 2).reshape([-1]));
}
exports.extract_breaks = extract_breaks;

/**
 * Extract values from result of a ee.Reducer.fixedHistogram object
 *
 * @param {ee.List of ee.List} hist List of lists with break and value, e.g., [[0,3], [3,6]]
 * 
 * @returns {ee.Array} Values extracted from the histogram 
 */

function extract_values(hist) {
    hist = ee.Array(ee.Dictionary(hist).values().get(0));
    return ee.Array(hist.slice(1, 1, null, 2).reshape([-1]).int().toList());
}
exports.extract_values = extract_values;

/**
 * Calculate sums for intervals from arrays of breaks and values
 *
 * @param {ee.List} breaks Lower breaks
 * @param {ee.List} values Values
 * @param {ee.List of ee.List} group_bounds List of lists representing bounds for calculating sums, [[0,3], [3,6]]
 * 
 * @returns {ee.Dict} A fixed histogram object with values from the hist object: {"breaks_lower":[0,10,20,...,2480,2490],"group_colors":["#eeb66b","#e68518","#b84e17","#933a06","#5c4a3d"],"group_labels":["0--500","500--1000","1000--1500","1500--2000","2000--2500"],"group_lower":[0,500,1000,1500,2000],"group_upper":[500,1000,1500,2000,2500],"max":2500,"min":0,"n_breaks":250,"step":10,"values":[0,0,0,...,0,0]}
 * 
 * @export
 */

function group_sums(breaks, values, group_bounds) {
    breaks = ee.Array(breaks);
    values = ee.Array(values);
    return group_bounds
        .map(function (bound) {
            bound = ee.List(bound);
            var lb = ee.Number(bound.get(0));
            var ub = ee.Number(bound.get(1));
            var mask = breaks.lt(ub).and(breaks.gte(lb));
            var vals = ee.Array(values.mask(mask));
            return vals.reduce(ee.Reducer.sum(), [0]).toList().get(0);
        });
}
exports.group_sums = group_sums;

/**
 * Update a fixed histogram object
 *
 * @param {ee.Dict} hist A histogram object returned from ee.Reducer.fixedHistogram
 * @param {ee.Dict} null_hist A null historgam object
 * 
 * @returns {ee.Dict} A fixed histogram object with values from the hist object: {"breaks_lower":[0,10,20,...,2480,2490],"group_colors":["#eeb66b","#e68518","#b84e17","#933a06","#5c4a3d"],"group_labels":["0--500","500--1000","1000--1500","1500--2000","2000--2500"],"group_lower":[0,500,1000,1500,2000],"group_upper":[500,1000,1500,2000,2500],"max":2500,"min":0,"n_breaks":250,"step":10,"values":[0,0,0,...,0,0]}
 * 
 * @export
 */

function update_fixed_histogram(hist, null_hist) {

    // Cast null histogram as Dict
    null_hist = ee.Dictionary(null_hist);

    // Extract hist breaks and values 
    var breaks = extract_values(hist);
    var values = extract_values(hist);

    // Make group sums
    var group_lower = ee.List(null_hist.get('group_lower'));
    var group_upper = ee.List(null_hist.get('group_upper'));
    var group_bounds = ee.List(group_lower.zip(group_upper));
    var group_values = group_sums(breaks, values, group_bounds);

    // Update null histogram
    return ee.Dictionary(null_hist)
        // FIXME: error DateRange: Cannot interpret [0, 13] as a Date.
        //.set('group_values', group_values)
        .set('breaks_lower', breaks)
        .set('values', values);

}
exports.update_fixed_histogram = update_fixed_histogram;

/**
 * Create SLD color ramp style from a fixed histogram object
 *
 * @param {ee.Dict} hist A fixed histogram object
 * 
 * @returns {ee.String} A SLD color ramp XML string:  
 * 
 * @export
 */

function hist_to_sldStyle(hist) {
    hist = ee.Dictionary(hist);
    var group_lower = ee.List(hist.get('group_lower'));
    var group_labels = ee.List(hist.get('group_labels'));
    var group_colors = ee.List(hist.get('group_colors'));
    var str_quantity = group_lower.map(function (l) { return ee.String(' quantity="').cat(ee.Number(l).int().format()).cat('"') });
    var str_label = group_labels.map(function (l) { return ee.String(' label="').cat(l).cat('"') });
    var str_color = group_colors.map(function (l) { return ee.String(' color="').cat(l).cat('"') });
    var ramp = ee.List.sequence(0, group_colors.size().subtract(1)).map(function (i) {
        return ee.String('<ColorMapEntry ')
            .cat(ee.List(str_color).get(i))
            .cat(str_quantity.get(i))
            .cat(str_label.get(i))
            .cat('/>');
    }).flatten();
    return ee.String('<RasterSymbolizer><ColorMap type="ramp" extended="false" >')
        .cat(ramp.join(" "))
        .cat('</ColorMap></RasterSymbolizer>');
}
exports.hist_to_sldStyle = hist_to_sldStyle;

//////////////////////////////////////////////////////////////////////////////
// EXPORTS
//////////////////////////////////////////////////////////////////////////////

function params_export_table_cloud(f, analysis_type, bucket, dir_path, version, fileFormat) {

    // Set defaults
    if (bucket === undefined) { bucket = 'mangrove_atlas' }
    if (dir_path === undefined) { dir_path = 'analysis' }
    if (version === undefined) { version = 'v1' }
    if (fileFormat === undefined) { fileFormat = 'GeoJSON' }

    // Get FID
    // FIXME how to use evaluate??
    fid = f.get('system:index');

    // Create description
    var description = ee.List([fid, analysis_type]).join('_');
    //.evaluate(function(info){return info});

    // Create fileNamePrefix
    var fileNamePrefix = ee.List([dir_path, version, analysis_type, fid]).join('/');
    //.evaluate(function(info){return info});

    // Return export params
    return ee.Dictionary({
        'collection': ee.FeatureCollection(f),
        'description': description,
        'bucket': bucket,
        'fileNamePrefix': fileNamePrefix,
        'fileFormat': fileFormat
    });

}
exports.params_export_table_cloud = params_export_table_cloud;

//////////////////////////////////////////////////////////////////////////////
// ANALYSIS FUNCTIONS
//////////////////////////////////////////////////////////////////////////////

/** 
 * Calculate sum within a geometry for a multi-temporal single-band image collection
 * 
 * Image collection should be a single band (only first band used).
 * The band should be a binary layer (0,1) for total area
 * or have cell values in units of value per m2.
 * Each image should have system:time_start set.
 *
 * @param {ee.Image Collection} ic  An image collection 
 * @param {ee.Geometry} aoi The area of interest for the zonal stats
 * @param {ee.List of ee.Date objects} timestamps List of timestamps
 * @param {ee.Dictionary} props_dict  Properies dict: 
 *  standard_name {ee.String} CF-standard style variable name,
 *  short_name {ee.String} Short name of variable, used as property name
 *  title {ee.String} Title of variable, as html e.g. for a legend
 *  units {ee.String} Units of variable, as html e.g. for a legend
 * @param {ee.Number} scale  Nominal scale of calculations, optional, default is 30 m
 * @param {boolean} bestEffort  Use bestEffort for the calculations, optional, default is false
 * 
 * @returns {ee.Dictionary} Named dictionary object with example structure: {"area_mangrove_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_m2","standard_name":"total_area_of_mangrove_coverage","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Total area of mangrove habitat","units":"m<sup>2</sup>","values":[1143883236.0951018,1126095420.9578004,1127900043.3124146]}}
 * 
 * @export
 * 
 */

function calc_area_sum(ic, aoi, timestamps, props_dict, scale, bestEffort) {

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30) }
    // Set bestEffort if not given
    if (bestEffort === undefined) { bestEffort = false; }

    // Map over year list
    var out = timestamps.map(
        function (timestamp) {

            // Test if timestamp exists
            var testTS = ic.filterDate(timestamp).size().gt(0);

            // Get image for year
            var im = ic
                .filterDate(timestamp)
                .filterBounds(aoi)
                .first();

            // Create reducers
            var reducers = ee.Reducer.sum();

            // Apply reducer(s) to area-weighted values
            // returns list with value per band
            var res = im
                .select(0)
                .multiply(ee.Image.pixelArea())
                .reduceRegion({
                    reducer: reducers,
                    geometry: aoi,
                    scale: scale,
                    maxPixels: 1e13,
                    bestEffort: bestEffort
                }).values();

            // Return value OR zero
            return ee.Algorithms.If(testTS, ee.Number(res.get(0)), ee.Number(0));
        }); // End map over year list

    // Return a named dictionary
    out = ee.Dictionary({
        'values': out,
        'timestamps': timestamps.map(function (timestamp) { return ee.Date(timestamp).format() }),
        'scale': scale,
        'bestEffort': bestEffort

    }).combine(props_dict);
    return ee.Dictionary({ out_name: out }).rename(['out_name'], [props_dict.get('short_name')]);

}
exports.calc_area_sum = calc_area_sum;

/** 
 * Calculate summary statistics within a geometry for a multi-temporal single-band image collection
 * 
 * Image collection should be a single band (only first band used).
 * Each image should have system:time_start set.
 * 
 * @param {ee.Image Collection} ic  An image collection 
 * @param {ee.Geometry} aoi The area of interest for the zonal stats
 * @param {ee.List of ee.Date objects} timestamps List of timestamps
 * @param {ee.Dictionary} props_dict  Properies dict: 
 *  standard_name {ee.String} CF-standard style variable name,
 *  short_name {ee.String} Short name of variable, used as property name
 *  title {ee.String} Title of variable, as html e.g. for a legend
 *  units {ee.String} Units of variable, as html e.g. for a legend
 * @param {ee.Number} scale  Nominal scale of calculations, optional, default is 30 m
 * @param {boolean} bestEffort  Use bestEffort for the calculations, optional, default is false
 *
 * @returns Named dictionary object with example structure: {"soc_t_ha-1":{"bestEffort":false,"scale":30,"short_name":"soc_t_ha-1","standard_name":"mangrove_soil_organic_carbon_density","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove soil organic carbon density","units":"t / ha","values":[{"max":646.9999999999999,"mean":290.51790950694783,"median":277.4845878701804,"min":110,"p1":190.16996630160068,"p25":249.5090431156787,"p75":321.47171420404845,"p99":477.49482288828335,"std":60.52754812140288}]}}
 * 
 * @export
 * 
 */

function calc_area_summary_stats(ic, aoi, timestamps, props_dict, scale, bestEffort) {

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30); }
    // Set bestEffort if not given
    if (bestEffort === undefined) { bestEffort = false; }

    // Map over year list
    var out = timestamps.map(
        function (timestamp) {

            // Get image for year
            var im = ic
                .filterDate(timestamp)
                .filterBounds(aoi)
                .first();

            // Create reducers
            var reducers = ee.Reducer.mean()
                .combine(ee.Reducer.stdDev(), null, true)
                .combine(ee.Reducer.percentile([0]), null, true)
                .combine(ee.Reducer.percentile([1]), null, true)
                .combine(ee.Reducer.percentile([25]), null, true)
                .combine(ee.Reducer.percentile([50]), null, true)
                .combine(ee.Reducer.percentile([75]), null, true)
                .combine(ee.Reducer.percentile([99]), null, true)
                .combine(ee.Reducer.percentile([100]), null, true)
                .setOutputs(['mean', 'std', 'min', 'p1', 'p25', 'median', 'p75', 'p99', 'max']);

            // Apply reducer(s) to area-weighted values
            // returns list with value per band
            var res = im
                .select(0)
                .reduceRegion({
                    reducer: reducers,
                    geometry: aoi,
                    scale: scale,
                    maxPixels: 1e13,
                    bestEffort: bestEffort
                });
            // rename
            res = res
                .rename(res.keys(),
                    ['max', 'mean', 'median', 'min', 'p1', 'p25', 'p75', 'p99', 'std']);

            // Return value OR null
            return ee.Algorithms.If(ee.Image(im), res, null);
        }); // End map over year list

    // Return a named dictionary
    out = ee.Dictionary({
        'values': out,
        'timestamps': timestamps.map(function (timestamp) { return ee.Date(timestamp).format() }),
        'scale': scale,
        'bestEffort': bestEffort

    }).combine(props_dict);
    return ee.Dictionary({ out_name: out }).rename(['out_name'], [props_dict.get('short_name')]);

}
exports.calc_area_summary_stats = calc_area_summary_stats;

/** 
 * Calculate fixed histogram within a geometry for a multi-temporal single-band image collection
 * 
 * Image collection should be a single band (only first band used).
 * Each image should have system:time_start set.
 *
 * @param {ee.Image Collection} ic An image collection 
 * @param {ee.Geometry} aoi The area of interest for the zonal stats
 * @param {ee.List of ee.Date objects} timestamps List of timestamps
 * @param {ee.Dictionary} props_dict  Properies dict: 
 *  standard_name {ee.String} CF-standard style variable name,
 *  short_name {ee.String} Short name of variable, used as property name
 *  title {ee.String} Title of variable, as html e.g. for a legend
 *  units {ee.String} Units of variable, as html e.g. for a legend
 * @param {ee.Dictionary} hist_dict  Parameters used to create the fixed histogram object:
 *  min {ee.Number} min Minimum value of breaks
 *  max {ee.Number} max Maximum value of breaks
 *  step {ee.Number} step Size of step between each break
 *  group_lower {ee.List} Lower boundaries of groupings for legend
 *  group_upper {ee.List} Upper boundaries of groupings for legend
 *  group_colors {ee.List} Colors for groupings of legend
 * @param {ee.Number} scale  Nominal scale of calculations, optional, default is 30m
 * @param {boolean} bestEffort  Use bestEffort for the calculations, optional, default is false
 * 
 * @returns {ee.Dictionary} Named dictionary object with example structure: {"soc_tha-1_hist":{"bestEffort":false,"scale":30,"short_name":"soc_tha-1_hist","standard_name":"histogram_of_mangrove_soil_organic_carbon_density","timestamps":["2016-01-01T00:00:00"],"title":"Histogram of mangrove soil organic carbon density","units":"t / ha","values":[{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#eeb66b","#e68518","#b84e17","#933a06","#5c4a3d"],"group_labels":["0--700","700--1400","1400--2100","2100--2800","2800--3500"],"group_lower":[0,700,1400,2100,2800],"group_upper":[700,1400,2100,2800,3500],"group_values":[1284270,0,0,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[0,0,0,0,0,0,0,0,0,0,0,7,9,41,157,440,1155,2790,6162,13177,25164,42190,63186,84168,101034,110897,110424,98597,86630,75786,66977,57700,50354,43725,38998,34596,29512,24962,21368,17146,13270,10747,9862,7046,7386,6718,5750,4792,3708,2834,2083,1034,723,352,195,96,85,60,66,54,28,19,8,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]}} 
 * 
 * @export
 * 
 */

function calc_fixed_histogram(ic, aoi, timestamps, props_dict, hist_dict, scale, bestEffort) {

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30); }
    // Set bestEffort if not given
    if (bestEffort === undefined) { bestEffort = false; }

    // Map over year list
    var out = timestamps.map(
        function (timestamp) {

            // Get image for year
            var im = ic
                .filterDate(timestamp)
                .filterBounds(aoi)
                .first();

            // Create null fixed histogram
            var null_hist = null_fixed_histogram(hist_dict);

            // Create fixed histogram reducer
            var reducers = ee.Reducer.fixedHistogram({
                'min': null_hist.get('min'),
                'max': null_hist.get('max'),
                'steps': null_hist.get('n_breaks')

            });

            // Apply reducer within aoi
            var hist = im
                .select(0)
                .reduceRegion({
                    reducer: reducers,
                    geometry: aoi,
                    scale: scale,
                    maxPixels: 1e13,
                    bestEffort: bestEffort

                });

            // Check if null, and return result or null histogram
            var testHist = ee.Number(ee.List(hist.values()).removeAll([null]).size()).gt(0.0);
            return ee.Algorithms.If(testHist, update_fixed_histogram(hist, null_hist), null_hist);
        }); // End map over year list

    // Return a named dictionary
    out = ee.Dictionary({
        'values': out,
        'timestamps': timestamps_to_strings(timestamps),
        'scale': scale,
        'bestEffort': bestEffort

    }).combine(props_dict);
    return ee.Dictionary({ name: out }).rename(['name'], [props_dict.get('short_name')]);
}
exports.calc_fixed_histogram = calc_fixed_histogram;

/** 
 * Calculate length of linestring that intersects
 * a multi-temporal distance raster within a geometry
 * 
 * For example length of coastline within distance from mangrove habitat.
 * Image collection should be a single band (only first band used) image, 
 * representing linear distance from feature of interest. 
 * Each image should have system:time_start set.
 * Feature collection should be a (multi) linestring
 *
 * @params fc {ee.FeatueCollection} Feature collection of linestrings
 * @param ic {ee.Image Collection} Image collection, where each image 
 * represents linear distance in m from pixels of interest
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps
 * @params buffer_distance_m {ee.Number} Distance from pixels of interest
 * @param props_dict {ee.Dictionary} Properies dict: 
 *  standard_name {ee.String} CF-standard style variable name,
 *  short_name {ee.String} Short name of variable, used as property name
 *  title {ee.String} Title of variable, as html e.g. for a legend
 *  units {ee.String} Units of variable, as html e.g. for a legend
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"length_mangrove_m":{"bestEffort":false,"buffer_distance_m":200,"hasHoles":[0],"scale":30,"short_name":"length_mangrove_m","standard_name":"length_of_coast_with_mangrove_cover","timestamps":["2016-01-01T00:00:00"],"title":"Length of coast with mangroves","units":"m","values":[1283406.2149864181]}}
 * 
 * @export
 * 
 */

function calc_length_intersect(fc, ic, aoi, timestamps, buffer_distance_m, props_dict, scale, bestEffort) {

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30) }

    // Set bestEffort if not given
    if (bestEffort === undefined) { bestEffort = false; }

    // Check for holes in geometry
    var hasHoles = aoi.geometries().map(function (g) { return ee.Geometry(g).coordinates().size().gt(1) });
    //feature = feature.set({'hasHoles': hasHoles})

    // Remove holes from geometries
    aoi = remove_holes(aoi);

    // Intersect with aoi and simplify fc
    fc = intersect_and_simplify(fc, aoi, scale);


    // Map over year list
    var out = timestamps.map(
        function (timestamp) {

            // Get image for year
            var im = ee.ImageCollection(ic)
                .filterDate(timestamp)
                .filterBounds(aoi)
                .first();

            // Create buffered vector
            var imb = ee.Image(1).byte().updateMask(im.lte(buffer_distance_m));
            var imb_vec = imb.reduceToVectors({
                geometry: aoi,
                scale: scale,
                reducer: ee.Reducer.countEvery(),
                geometryType: 'polygon',
                maxPixels: 1e13,
                bestEffort: bestEffort,
                tileScale: 1
            });

            // Intersect
            var imb_fc = fc
                .geometry()
                .intersection(imb_vec.geometry(), scale);

            // Return length
            return ee.Number(imb_fc.length());

        }); // End map over year list

    // Return a named dictionary
    out = ee.Dictionary({
        'values': out,
        'timestamps': timestamps.map(function (timestamp) { return ee.Date(timestamp).format() }),
        'scale': scale,
        'bestEffort': bestEffort,
        'buffer_distance_m': buffer_distance_m,
        'hasHoles': hasHoles

    }).combine(props_dict);
    return ee.Dictionary({ out_name: out }).rename(['out_name'], [props_dict.get('short_name')]);
}
exports.calc_length_intersect = calc_length_intersect;

//////////////////////////////////////////////////////////////////////////////
// PROJECT SPECIFIC ANALYSIS
//////////////////////////////////////////////////////////////////////////////

/** 
 * Calculate length of coastline that intersects a geometry
 * 
 * 
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * 
 * @returns Named dictionary object with example structure: 
 * 
 * @export
 * 
 */

function calc_length_coastline(aoi, scale) {

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30) }

    // GET DATA LAYERS
    var fc = ee.FeatureCollection(get_dataset('coastline-vector'));

    // Set timestamps
    var timestamps = [ee.Date(fc.get('system:time_start')).format()];

    // ANALYSIS
    var out = ee.Dictionary({
        'values': [intersect_and_simplify(fc, aoi, scale).geometry().length(scale)],
        'timestamps': timestamps,
        'scale': scale,
        'units': 'm',
        'standard_name': 'length_of_coastline',
        'short_name': 'length_coast_m',
        'title': 'Total length of coastline'

    });
    return ee.Dictionary({ name: out }).rename(['name'], [out.get('short_name')]);
}
exports.calc_length_coastline = calc_length_coastline;

/** 
 * Calculate length of coastline that intersects
 * multi-temporal coverage of mangroves within a geometry
 * 
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps
 * @params buffer_distance_m {ee.Number} Distance from pixels of interest
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"length_mangrove_m":{"bestEffort":false,"buffer_distance_m":200,"hasHoles":[0],"scale":30,"short_name":"length_mangrove_m","standard_name":"length_of_coast_with_mangrove_cover","timestamps":["2016-01-01T00:00:00"],"title":"Length of coast with mangroves","units":"m","values":[1283406.2149864181]}}
 * 
 * @export
 * 
 */

function calc_length_mangroves(aoi, timestamps, buffer_distance_m, scale, bestEffort) {

    // Set buffer distance if not given
    if (buffer_distance_m === undefined) { buffer_distance_m = ee.Number(200); }

    // Set nominal scale if not given
    if (scale === undefined) { scale = ee.Number(30); }

    // Set bestEffort if not given
    if (bestEffort === undefined) { bestEffort = false; }

    // GET DATASETS
    // coastline vector line strings
    var fc = ee.FeatureCollection(get_dataset('coastline-vector'));

    // mangrove distance
    var mg_dist = ee.ImageCollection(get_dataset('mangrove-distance'));

    // ANALYSIS
    return calc_length_intersect(fc, mg_dist, aoi, timestamps, buffer_distance_m,
        // properties
        ee.Dictionary({
            'short_name': 'length_mangrove_m',
            'standard_name': 'length_of_coast_with_mangrove_cover',
            'title': 'Length of coast with mangroves',
            'units': 'm'
        }), scale, bestEffort);

}
exports.calc_length_mangroves = calc_length_mangroves;

/** 
 * Calculate mangrove land-cover total sum of area within a geometry
 * 
 * The extent, gain and loss of mangrove habitat in units square meters
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps;
 * note if an image is not available null is retruned.
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"area_mangrove_gain_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_gain_m2","standard_name":"total_gain_in_area_of_mangroves","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove extent gain","units":"m<sup>2</sup>","values":[null,7547852.242736816,5759939.01361084]},"area_mangrove_loss_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_loss_m2","standard_name":"total_loss_in_area_of_mangroves","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove extent loss","units":"m<sup>2</sup>","values":[null,25464623.50570499,3972450.1892089844]},"area_mangrove_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_m2","standard_name":"total_area_of_mangroves","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove extent","units":"m<sup>2</sup>","values":[1143883236.0951018,1126095420.9578004,1127900043.3124146]}}
 * 
 * @export
 * 
 */

function calc_land_cover_sum_area(aoi, timestamps, scale, bestEffort) {

    // GET DATA LAYERS
    // mangrove extent [1]
    var mg_extent = ee.ImageCollection(get_dataset('mangrove-extent'));

    // mangrove extent gain [1]
    var mg_gain = ee.ImageCollection(get_dataset('mangrove-gain'));

    // mangrove extent loss [1]
    var mg_loss = ee.ImageCollection(get_dataset('mangrove-loss'));

    // ANALYSIS
    // Total area of mangrove habitat within geometry [m2]
    var ma = calc_area_sum(mg_extent, aoi, timestamps, ee.Dictionary({
        'short_name': 'area_mangrove_m2',
        'standard_name': 'total_area_of_mangroves',
        'title': 'Mangrove extent',
        'units': 'm<sup>2</sup>'
    }), scale, bestEffort);

    // Total area of mangrove habitat gain within geometry [m2]
    var mag = calc_area_sum(mg_gain, aoi, timestamps, ee.Dictionary({
        'short_name': 'area_mangrove_gain_m2',
        'standard_name': 'total_gain_in_area_of_mangroves',
        'title': 'Mangrove extent gain',
        'units': 'm<sup>2</sup>'
    }), scale, bestEffort);

    // Total area of mangrove habitat loss within geometry [m2]
    var mal = calc_area_sum(mg_loss, aoi, timestamps, ee.Dictionary({
        'short_name': 'area_mangrove_loss_m2',
        'standard_name': 'total_loss_in_area_of_mangroves',
        'title': 'Mangrove extent loss',
        'units': 'm<sup>2</sup>'
    }), scale, bestEffort);

    // Combine dictionaries
    return ma.combine(mag).combine(mal);
}
exports.calc_land_cover_sum_area = calc_land_cover_sum_area;

/** 
 * Calculate mangrove properties histogram within a geometry
 * 
 * The summary stats and histograms of agb [t / ha], and hmax [m]
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps;
 * note if an image is not available null is returned.
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"agb_mangrove_hist_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_hist_tha-1","standard_name":"histogram_of_mangrove_aboveground_biomass_density","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Histogram of mangrove above-ground biomass density","units":"t / ha","values":[{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[1015577,203298,73114,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[64357,55734,76258,88426,0,95936,0,105312,0,0,115225,0,0,118057,0,0,112446,0,0,0,99651,0,0,0,84175,0,0,0,0,69182,0,0,0,0,56435,0,0,0,0,44381,0,0,0,0,0,33300,0,0,0,0,0,73114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[997742,201183,72717,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[59053,54652,75105,87342,0,94866,0,104071,0,0,113827,0,0,116492,0,0,110853,0,0,0,98346,0,0,0,83135,0,0,0,0,68438,0,0,0,0,55813,0,0,0,0,43919,0,0,0,0,0,33013,0,0,0,0,0,72717,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[999477,201579,72840,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[58797,54596,75160,87467,0,95039,0,104341,0,0,114140,0,0,116864,0,0,111191,0,0,0,98547,0,0,0,83335,0,0,0,0,68545,0,0,0,0,55937,0,0,0,0,44009,0,0,0,0,0,33088,0,0,0,0,0,72840,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"hmax_mangrove_hist_m":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_hist_m","standard_name":"histogram_of_mangrove_maximum_canopy_height","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Histogram of mangrove maximum canopy height","units":"m","values":[{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[486023,699552,106414,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[16553,15689,0,32115,0,55734,76258,0,88426,0,95936,105312,0,115225,0,118057,112446,0,99651,0,84175,0,69182,56435,0,44381,0,33300,73114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[475089,690823,105730,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[12976,14756,0,31321,0,54652,75105,0,87342,0,94866,104071,0,113827,0,116492,110853,0,98346,0,83135,0,68438,55813,0,43919,0,33013,72717,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[475400,692568,105928,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[12742,14673,0,31382,0,54596,75160,0,87467,0,95039,104341,0,114140,0,116864,111191,0,98547,0,83335,0,68545,55937,0,44009,0,33088,72840,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]}}
 * 
 * @export
 * 
 */

function calc_mangrove_properties_histograms(aoi, timestamps, scale, bestEffort) {

    // GET DATA LAYERS
    // mangrove above ground biomass [t / ha]
    var mg_agb = ee.ImageCollection(get_dataset('mangrove-agb'))
        .map(function (i) {
            return i.multiply(10000).set('system:time_start', i.get('system:time_start'));

        });
    // mangrove maximum canopy height [m]
    var mg_hmax = ee.ImageCollection(get_dataset('mangrove-hmax'));
    // mangrove basal-weighted canopy height [m]
    //var mg_hba = ee.ImageCollection(get_dataset('mangrove-hba'))

    // ANALYSIS
    // Histogram of mangrove agb with geometry [t /ha]
    var magb_hist = calc_fixed_histogram(mg_agb, aoi, timestamps,
        // properties definition
        ee.Dictionary({
            'short_name': 'agb_mangrove_hist_tha-1',
            'standard_name': 'histogram_of_mangrove_aboveground_biomass_density',
            'title': 'Histogram of mangrove above-ground biomass density',
            'units': 't / ha'
        }),
        // histogram definition
        ee.Dictionary({
            min: ee.Number(0),
            max: ee.Number(1000),
            step: ee.Number(10)

        }).combine(get_dataset_legend('mangrove-agb'))
        , scale, bestEffort);

    // Histogram of mangrove hmax within geometry [m]
    var mhmax_hist = calc_fixed_histogram(mg_hmax, aoi, timestamps,
        // properties definition
        ee.Dictionary({
            'short_name': 'hmax_mangrove_hist_m',
            'standard_name': 'histogram_of_mangrove_maximum_canopy_height',
            'title': 'Histogram of mangrove maximum canopy height',
            'units': 'm'
        }),
        // histogram definition
        ee.Dictionary({
            min: ee.Number(0),
            max: ee.Number(100),
            step: ee.Number(1)

        }).combine(get_dataset_legend('mangrove-hmax'))
        , scale, bestEffort);
    return magb_hist.combine(mhmax_hist);

}
exports.calc_mangrove_properties_histograms = calc_mangrove_properties_histograms;

/** 
 * Calculate mangrove properties summary stats within a geometry
 * 
 * The summary stats of agb [t / ha], and hmax [m]
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps;
 * note if an image is not available null is returned.
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"agb_mangrove_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_tha-1","standard_name":"summary_stats_of_mangrove_aboveground_biomass_density","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove above-ground biomass density","units":"t / ha","values":[{"max":519.070556640625,"mean":168.90203153520727,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7515772072736179,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":142.96580119528184},{"max":519.070556640625,"mean":169.7585205925301,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7952520664199406,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":143.04897715854202},{"max":519.070556640625,"mean":169.83037272708188,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7982523247640367,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":143.01423063366389}]},"hmax_mangrove_m":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_m","standard_name":"summary_stats_of_mangrove_maximum_canopy_height","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove maximum canopy height","units":"m","values":[{"max":28.849000930786133,"mean":15.316873869282484,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":7.0337223811905325},{"max":28.849000930786133,"mean":15.378616499374601,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":6.999446881422505},{"max":28.849000930786133,"mean":15.384893134057247,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":6.99438453203036}]}}
 *  
 * @export
 * 
 */

function calc_mangrove_properties_summary_stats(aoi, timestamps, scale, bestEffort) {

    // GET DATA LAYERS
    // mangrove above ground biomass [t / ha]
    var mg_agb = ee.ImageCollection(get_dataset('mangrove-agb'))
        .map(function (i) {
            return i.multiply(10000).set('system:time_start', i.get('system:time_start'));

        });
    // mangrove maximum canopy height [m]
    var mg_hmax = ee.ImageCollection(get_dataset('mangrove-hmax'));
    // mangrove basal-weighted canopy height [m]
    //var mg_hba = ee.ImageCollection(get_dataset('mangrove-hba'))

    // ANALYSIS
    // Summary stats mangrove agb within geometry [t / ha]
    var magb = calc_area_summary_stats(mg_agb, aoi, timestamps,
        // properties definition
        ee.Dictionary({
            'short_name': 'agb_mangrove_tha-1',
            'standard_name': 'summary_stats_of_mangrove_aboveground_biomass_density',
            'title': 'Mangrove above-ground biomass density',
            'units': 't / ha'
        })
        , scale, bestEffort);

    // Summary stats mangrove hmax within geometry [m]
    var mhmax = calc_area_summary_stats(mg_hmax, aoi, timestamps,
        // properties definition
        ee.Dictionary({
            'short_name': 'hmax_mangrove_m',
            'standard_name': 'summary_stats_of_mangrove_maximum_canopy_height',
            'title': 'Mangrove maximum canopy height',
            'units': 'm'
        })
        , scale, bestEffort);

    return magb.combine(mhmax);

}
exports.calc_mangrove_properties_summary_stats = calc_mangrove_properties_summary_stats;

/** 
 * Calculate total mangrove organic carbon within a geometry
 * 
 * The area sums of agb [t CO2e ], soc [t CO2e ] and toc [t CO2e ]
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps;
 * note if an image is not available null is returned.
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: {"agb_mangrove_hist_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_hist_tha-1","standard_name":"histogram_of_mangrove_aboveground_biomass_density","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Histogram of mangrove above-ground biomass density","units":"t / ha","values":[{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[1015577,203298,73114,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[64357,55734,76258,88426,0,95936,0,105312,0,0,115225,0,0,118057,0,0,112446,0,0,0,99651,0,0,0,84175,0,0,0,0,69182,0,0,0,0,56435,0,0,0,0,44381,0,0,0,0,0,33300,0,0,0,0,0,73114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[997742,201183,72717,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[59053,54652,75105,87342,0,94866,0,104071,0,0,113827,0,0,116492,0,0,110853,0,0,0,98346,0,0,0,83135,0,0,0,0,68438,0,0,0,0,55813,0,0,0,0,43919,0,0,0,0,0,33013,0,0,0,0,0,72717,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[999477,201579,72840,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[58797,54596,75160,87467,0,95039,0,104341,0,0,114140,0,0,116864,0,0,111191,0,0,0,98547,0,0,0,83335,0,0,0,0,68545,0,0,0,0,55937,0,0,0,0,44009,0,0,0,0,0,33088,0,0,0,0,0,72840,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"agb_mangrove_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_tha-1","standard_name":"summary_stats_of_mangrove_aboveground_biomass_density","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove above-ground biomass density","units":"t / ha","values":[{"max":519.070556640625,"mean":168.90203153520727,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7515772072736179,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":142.96580119528184},{"max":519.070556640625,"mean":169.7585205925301,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7952520664199406,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":143.04897715854202},{"max":519.070556640625,"mean":169.83037272708188,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.7982523247640367,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":143.01423063366389}]},"hmax_mangrove_hist_tha-1":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_hist_tha-1","standard_name":"histogram_of_mangrove_maximum_canopy_height","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Histogram of mangrove maximum canopy height","units":"m","values":[{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[486023,699552,106414,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[16553,15689,0,32115,0,55734,76258,0,88426,0,95936,105312,0,115225,0,118057,112446,0,99651,0,84175,0,69182,56435,0,44381,0,33300,73114,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[475089,690823,105730,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[12976,14756,0,31321,0,54652,75105,0,87342,0,94866,104071,0,113827,0,116492,110853,0,98346,0,83135,0,68438,55813,0,43919,0,33013,72717,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]},{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[475400,692568,105928,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[12742,14673,0,31382,0,54596,75160,0,87467,0,95039,104341,0,114140,0,116864,111191,0,98547,0,83335,0,68545,55937,0,44009,0,33088,72840,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"hmax_mangrove_m":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_m","standard_name":"summary_stats_of_mangrove_maximum_canopy_height","timestamps":["1996-01-01T00:00:00","2007-01-01T00:00:00","2008-01-01T00:00:00"],"title":"Mangrove maximum canopy height","units":"m","values":[{"max":28.849000930786133,"mean":15.316873869282484,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":7.0337223811905325},{"max":28.849000930786133,"mean":15.378616499374601,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":6.999446881422505},{"max":28.849000930786133,"mean":15.384893134057247,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":6.99438453203036}]}}
 * 
 * @export
 * 
 */

function calc_mangrove_carbon_sum_area(aoi, timestamps, scale, bestEffort) {

    // GET DATA LAYERS
    // mangrove above-ground biomass density as CO2e [t CO2e / m2]
    var mg_agb = convert_carbon(ee.ImageCollection(get_dataset('mangrove-agb')), 'bio_to_CO2e');

    // mangrove soil organic carbon density as CO2e [t CO2e / m2]
    var mg_soc = convert_carbon(ee.ImageCollection(get_dataset('mangrove-soc')), 'OC_to_CO2e');

    // ANALYSIS
    // Total sum of mangrove above-ground biomass organic carbon as CO2e [t CO2e] 
    var agb_tco2e = calc_area_sum(mg_agb, aoi, timestamps,
        // properties
        ee.Dictionary({
            'short_name': 'agb_tco2e',
            'standard_name': 'total_mangrove_above_ground_biomass_organic_carbon_as_carbon_dioxide_equivilent',
            'title': 'Total above-ground biomass carbon',
            'units': 't CO<sub>2</sub>e'
        })
        , scale, bestEffort);
    // Total sum of mangrove soil organic carbon as CO2e [t CO2e] 
    var soc_tco2e = calc_area_sum(mg_soc, aoi, timestamps,
        // properties
        ee.Dictionary({
            'short_name': 'soc_tco2e',
            'standard_name': 'total_mangrove_soil_organic_carbon_as_carbon_dioxide_equivilent',
            'title': 'Total soil carbon',
            'units': 't CO<sub>2</sub>e'
        })
        , scale, bestEffort);

    // Total sum of mangrove organic carbon (AGB and SOC) as CO2e [t CO2e] 
    var add_and_mask = function () {
        var agb = ee.Array(ee.Dictionary(agb_tco2e.values().get(0)).get('values'));
        var soc = ee.Array(ee.Dictionary(soc_tco2e.values().get(0)).get('values'));
        var mask = agb.and(soc).toList();
        var res = agb.add(soc).toList();
        return ee.List(res).zip(ee.List(mask))
            .map(function (l) {
                return ee.Algorithms.If(
                    ee.List(l).get(1),
                    ee.List(l).get(0),
                    ee.List(l).get(1));

            });
    };
    var toc_tco2e = ee.Dictionary({
        'timestamps': timestamps.map(function (timestamp) { return ee.Date(timestamp).format() }),
        'values': add_and_mask()
    })
        // properties
        .combine(ee.Dictionary({
            'short_name': 'toc_tco2e',
            'standard_name': 'total_mangrove_organic_carbon_as_carbon_dioxide_equivilent',
            'title': 'Total organic carbon',
            'units': 't CO<sub>2</sub>e'
        }));
    toc_tco2e = ee.Dictionary({ name: toc_tco2e })
        .rename(['name'], [toc_tco2e.get('short_name')]);

    return agb_tco2e.combine(soc_tco2e).combine(toc_tco2e);

}
exports.calc_mangrove_carbon_sum_area = calc_mangrove_carbon_sum_area;

/** 
 * Calculate total mangrove organic carbon density histogram within a geometry
 * 
 * The histogram toc [t CO2e / ha]
 *
 * @param aoi {ee.Geometry} The area of interest for the calculations
 * @param timestamps {ee.List of ee.Date objects} List of timestamps;
 * note if an image is not available null is returned.
 * @param scale {ee.Number} Nominal scale of calculations, optional, default is 30m
 * @param bestEffort {boolean} Use bestEffort for the calculations, optional, default is false
 * 
 * @returns Named dictionary object with example structure: 
 * 
 * @export
 * 
 */

function calc_mangrove_carbon_histogram(aoi, timestamps, scale, bestEffort) {


    // GET DATA LAYERS
    // mangrove above-ground biomass density as CO2e [t CO2e / ha]
    var mg_agb = convert_carbon(ee.ImageCollection(get_dataset('mangrove-agb')), 'bio_to_CO2e')
        .map(function (i) {
            return i.multiply(10000).set('system:time_start', i.get('system:time_start'));

        });

    // mangrove soil organic carbon density as CO2e [t CO2e / ha]
    var mg_soc = convert_carbon(ee.ImageCollection(get_dataset('mangrove-soc')), 'OC_to_CO2e')
        .map(function (i) {
            return i.multiply(10000).set('system:time_start', i.get('system:time_start'));

        });

    // FILTER TIMESTAMPS
    timestamps = filter_timestamps(mg_agb, filter_timestamps(mg_soc, timestamps));

    // CREATE TOC
    // total organic carbon as CO2e [t CO2e / ha]
    var mg_toc = ee.ImageCollection(
        timestamps.map(function (timestamp) {
            var agb = ee.Image(mg_agb.filterDate(timestamp).first());
            var soc = ee.Image(mg_soc.filterDate(timestamp).first());
            return agb.add(soc)
                .set({ 'system:time_start': agb.get('system:time_start') })
                .rename(["toc_co2e"]);
        }));

    // ANALYSIS
    // Histogram of toc with geometry [t /ha]
    var toc_hist = calc_fixed_histogram(mg_toc, aoi, timestamps,
        // properties definition
        ee.Dictionary({
            'short_name': 'toc_hist_tco2eha-1',
            'standard_name': 'histogram_of_mangrove_total_organic_carbon_density_as_carbon_dioxide_equivilent',
            'title': 'Histogram of total organic carbon density',
            'units': 't CO<sub>2</sub>e / ha'
        }),
        // histogram definition
        ee.Dictionary({
            min: ee.Number(0),
            max: ee.Number(5000),
            step: ee.Number(50)

        }).combine(get_dataset_legend('mangrove-toc'))
        , scale, bestEffort);

    return toc_hist;
}
exports.calc_mangrove_carbon_histogram = calc_mangrove_carbon_histogram;

/** 
 * Helper to choose which mangrove analysis to apply within a geometry
 * 
 * Note 'length-coast' is slow for large geometries.
 * 
 * @param {ee.List} analysis_types  Analysis type keywords to apply, giving properties:
 *  'length-coast': 'length_coast_m', 'length_mangrove_m'
 *  'land-cover': 'area_mangrove_m2', 'area_mangrove_gain_m2', 'area_mangrove_loss_m2'
 *  'mangrove-properties': 'agb_mangrove_m', 'agb_mangrove_hist_m', 'hmax_mangrove_m', 'hmax_mangrove_hist_m'
 *  'mangrove-carbon': 'agb_tco2e', 'soc_tco2e', 'toc_tco2e', 'agb_hist_tco2eha-1', 'soc_hist_tco2eha-1', 'toc_hist_tco2eha-1' 
 * @param {ee.Geometry} aoi  The area of interest for the calculations
 * @param {ee.List of ee.Date objects} timestamps List of timestamps;
 * note if an image is not available null is returned.
 * @param {ee.Number}  buffer_distance_m Distance to buffer mangrove extent for length-coast calculations, optional, default is 200 m
 * @param {ee.Number} scale Nominal scale of calculations, optional, default is 30 m
 * @param {boolean} bestEffort Use bestEffort for the calculations, optional, default is false
 * 
 * @returns {ee.Dictionary} Named dictionary object with example structure: {"agb_mangrove_hist_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_hist_tha-1","standard_name":"histogram_of_mangrove_aboveground_biomass_density","timestamps":["2016-01-01T00:00:00"],"title":"Histogram of mangrove above-ground biomass density","units":"t / ha","values":[{"breaks_lower":[0,10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340,350,360,370,380,390,400,410,420,430,440,450,460,470,480,490,500,510,520,530,540,550,560,570,580,590,600,610,620,630,640,650,660,670,680,690,700,710,720,730,740,750,760,770,780,790,800,810,820,830,840,850,860,870,880,890,900,910,920,930,940,950,960,970,980,990],"group_colors":["#EAF19D","#B8E98E","#1B97C1","#1C52A3","#13267F"],"group_labels":["0--250","250--500","500--750","750--1000","1000--1250"],"group_lower":[0,250,500,750,1000],"group_upper":[250,500,750,1000,1250],"group_values":[985764,200545,72483,0,0],"max":1000,"min":0,"n_breaks":100,"step":10,"values":[57417,53120,73578,85934,0,93543,0,102940,0,0,112719,0,0,115600,0,0,110254,0,0,0,97894,0,0,0,82765,0,0,0,0,68179,0,0,0,0,55618,0,0,0,0,43790,0,0,0,0,0,32958,0,0,0,0,0,72483,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"agb_mangrove_tha-1":{"bestEffort":false,"scale":30,"short_name":"agb_mangrove_tha-1","standard_name":"summary_stats_of_mangrove_aboveground_biomass_density","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove above-ground biomass density","units":"t / ha","values":[{"max":519.070556640625,"mean":170.58400793528858,"median":133.98153686523438,"min":0.2844082713127136,"p1":0.775247307184068,"p25":56.501323699951165,"p75":247.23045349121088,"p99":519.070556640625,"std":143.1557643355937}]},"agb_tco2e":{"bestEffort":false,"scale":30,"short_name":"agb_tco2e","standard_name":"total_mangrove_above_ground_biomass_organic_carbon_as_carbon_dioxide_equivilent","timestamps":["2016-01-01T00:00:00"],"title":"Total above-ground biomass carbon","units":"t CO<sub>2</sub>e","values":[31425649.05915624]},"area_mangrove_gain_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_gain_m2","standard_name":"total_gain_in_area_of_mangroves","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove extent gain","units":"m<sup>2</sup>","values":[15086297.491149902]},"area_mangrove_loss_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_loss_m2","standard_name":"total_loss_in_area_of_mangroves","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove extent loss","units":"m<sup>2</sup>","values":[19874671.181396484]},"area_mangrove_m2":{"bestEffort":false,"scale":30,"short_name":"area_mangrove_m2","standard_name":"total_area_of_mangroves","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove extent","units":"m<sup>2</sup>","values":[1114221645.32688]},"hmax_mangrove_hist_m":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_hist_m","standard_name":"histogram_of_mangrove_maximum_canopy_height","timestamps":["2016-01-01T00:00:00"],"title":"Histogram of mangrove maximum canopy height","units":"m","values":[{"breaks_lower":[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99],"group_colors":["#C9BB42","#8BA205","#428710","#0A6624","#103C1F"],"group_labels":["0--13","13--26","26--39","39--52","52--65"],"group_lower":[0,13,26,39,52],"group_upper":[13,26,39,52,65],"group_values":[466532,686819,105441,0,0],"max":100,"min":0,"n_breaks":100,"step":1,"values":[13417,14035,0,29965,0,53120,73578,0,85934,0,93543,102940,0,112719,0,115600,110254,0,97894,0,82765,0,68179,55618,0,43790,0,32958,72483,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"hmax_mangrove_m":{"bestEffort":false,"scale":30,"short_name":"hmax_mangrove_m","standard_name":"summary_stats_of_mangrove_maximum_canopy_height","timestamps":["2016-01-01T00:00:00"],"title":"Mangrove maximum canopy height","units":"m","values":[{"max":28.849000930786133,"mean":15.425064860959022,"median":15.27299976348877,"min":0.8485000133514404,"p1":0.8485000133514404,"p25":10.182000160217285,"p75":20.36400032043457,"p99":28.849000930786133,"std":6.993273183593068}]},"length_coast_m":{"scale":30,"timestamps":["2020-06-29T00:00:00"],"units":"m","values":[2789862.8040602216]},"length_mangrove_m":{"bestEffort":false,"buffer_distance_m":200,"hasHoles":[0],"scale":30,"short_name":"length_mangrove_m","standard_name":"length_of_coast_with_mangrove_cover","timestamps":["2016-01-01T00:00:00"],"title":"Length of coast with mangroves","units":"m","values":[1283406.2149864181]},"soc_tco2e":{"bestEffort":false,"scale":30,"short_name":"soc_tco2e","standard_name":"total_mangrove_soil_organic_carbon_as_carbon_dioxide_equivilent","timestamps":["2016-01-01T00:00:00"],"title":"Total soil carbon","units":"t CO<sub>2</sub>e","values":[121190692.75639571]},"toc_hist_tco2eha-1":{"bestEffort":false,"scale":30,"short_name":"toc_hist_tco2eha-1","standard_name":"histogram_of_mangrove_total_organic_carbon_density_as_carbon_dioxide_equivilent","timestamps":["2016-01-01T00:00:00"],"title":"Histogram of total organic carbon density","units":"t CO<sub>2</sub>e / ha","values":[{"breaks_lower":[0,50,100,150,200,250,300,350,400,450,500,550,600,650,700,750,800,850,900,950,1000,1050,1100,1150,1200,1250,1300,1350,1400,1450,1500,1550,1600,1650,1700,1750,1800,1850,1900,1950,2000,2050,2100,2150,2200,2250,2300,2350,2400,2450,2500,2550,2600,2650,2700,2750,2800,2850,2900,2950,3000,3050,3100,3150,3200,3250,3300,3350,3400,3450,3500,3550,3600,3650,3700,3750,3800,3850,3900,3950,4000,4050,4100,4150,4200,4250,4300,4350,4400,4450,4500,4550,4600,4650,4700,4750,4800,4850,4900,4950],"group_colors":["#eeb66b","#e68518","#b84e17","#933a06","#5c4a3d"],"group_labels":["0--700","700--1400","1400--2100","2100--2800","2800--3500"],"group_lower":[0,700,1400,2100,2800],"group_upper":[700,1400,2100,2800,3500],"group_values":[793,709091,466317,7753,0],"max":5000,"min":0,"n_breaks":100,"step":50,"values":[0,0,0,0,0,0,0,0,0,1,5,25,158,604,1828,4576,10152,19127,32922,49368,61928,72690,78218,78390,81343,77356,72328,68865,62426,58194,53095,47936,43599,40357,36602,31555,26602,21778,16534,12762,8860,6017,3670,2051,953,533,240,125,63,51,27,25,6,5,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]},"toc_tco2e":{"short_name":"toc_tco2e","standard_name":"total_mangrove_organic_carbon_as_carbon_dioxide_equivilent","timestamps":["2016-01-01T00:00:00"],"title":"Total organic carbon","units":"t CO<sub>2</sub>e","values":[152616341.81555194]}}
 * 
 * @export
 * 
 */

function calc_mangrove_analysis(analysis_types, aoi, timestamps, buffer_distance_m, scale, bestEffort) {

    analysis_type = ee.List(analysis_types);
    var out = ee.Dictionary({});
    out = ee.Algorithms.If(
        analysis_type.contains('length-coast'),
        ee.Dictionary(out).combine(calc_length_coastline(aoi, scale))
            .combine(calc_length_mangroves(aoi, timestamps, buffer_distance_m, scale, bestEffort)),
        out);
    out = ee.Algorithms.If(
        analysis_type.contains('land-cover'),
        ee.Dictionary(out).combine(calc_land_cover_sum_area(aoi, timestamps, scale, bestEffort)),
        out);
    out = ee.Algorithms.If(
        analysis_type.contains('mangrove-properties'),
        ee.Dictionary(out).combine(calc_mangrove_properties_histograms(aoi, timestamps, scale, bestEffort))
            .combine(calc_mangrove_properties_summary_stats(aoi, timestamps, scale, bestEffort)),
        out);
    out = ee.Algorithms.If(
        analysis_type.contains('mangrove-carbon'),
        ee.Dictionary(out).combine(calc_mangrove_carbon_sum_area(aoi, timestamps, scale, bestEffort))
            .combine(calc_mangrove_carbon_histogram(aoi, timestamps, scale, bestEffort)),
        out);

    return out;
}
exports.calc_mangrove_analysis = calc_mangrove_analysis;

//////////////////////////////////////////////////////////////////////////////
// TESTS
//////////////////////////////////////////////////////////////////////////////

if (show_tests === true) {
    if (ee_js === true) {

        // Set some testing objects
        var gcs_url = 'gs://mangrove_atlas/analysis/v1/1_2_22.geojson';
        var fid = ee.String('1_2_22');
        var fids = ee.List(['1_2_22', '1_2_13']);
        var iso = ee.String('TZA');
        var isos = ee.List(['TZA', 'SEN']);
        var feature = get_feature_by_fid(fid);
        //print(feature)
        var aoi = feature.geometry();
        var feature_with_holes = get_feature_by_country('IDN');
        var aoi_with_holes = feature_with_holes.geometry();
        var timestamps = ee.List([1996, 2010, 2016])
            .map(function (y) { return ee.Date.fromYMD(y, 1, 1) });
        var timestamps_2016 = ee.List([2016])
            .map(function (y) { return ee.Date.fromYMD(y, 1, 1) });
        var hist_dict_soc = ee.Dictionary({
            min: ee.Number(0),
            max: ee.Number(2500),
            step: ee.Number(10),
            group_lower: ee.List([0, 500, 1000, 1500, 2000]),
            group_upper: ee.List([500, 1000, 1500, 2000, 2500]),
            group_colors: ee.List(["#5c4a3d", "#933a06", "#b84e17", "#e68518", "#eeb66b"]).reverse()

        });
        var analysis_types = ee.List(['land-cover', 'mangrove-properties', 'mangrove-carbon', 'length-coast']);
        var ic_hmax = ee.ImageCollection(get_dataset('mangrove-hmax'));
        var hist_hmax = ic_hmax.first().select(0).reduceRegion({
            reducer: ee.Reducer.fixedHistogram({ 'min': 0, 'max': 100, 'steps': 100 }),
            geometry: aoi,
            scale: 30,
            maxPixels: 1e13,
            bestEffort: false

        });
        var props_dict_hmax = ee.Dictionary({
            'short_name': 'hmax_hist_m',
            'standard_name': 'histogram_of_mangrove_maximum_canopy_height',
            'title': 'Histogram of mangrove maximum canopy height',
            'units': 'm'
        });
        var hist_dict_hmax = ee.Dictionary({
            min: ee.Number(0),
            max: ee.Number(100),
            step: ee.Number(1)

        }).combine(get_dataset_legend('mangrove-hmax'))

        // Print results of functions
        print('Test import_json', import_json(gcs_url));
        print('Test parse_fc_dict', parse_fc_dict(import_json(gcs_url)));
        print('Test get_feature_by_fid (asset table)', get_feature_by_fid(fid));
        print('Test get_feature_by_fid (GCS file)', get_feature_by_fid(fid, gcs_url));
        print('Test params_export_table_cloud', params_export_table_cloud(update_system_index(feature, 'id'), 'land-cover'));
        print('Test update_system_index', update_system_index(feature, 'id'));
        print('Test get_features_by_fids:', get_features_by_fids(fids));
        print('Test get_feature_by_country:', get_feature_by_country(iso));
        print('Test get_features_by_countries:', get_features_by_countries(isos));
        print('Test createUUID', createUUID());
        print('Test check_has_holes', check_has_holes(feature_with_holes));
        print('Test remove_holes', remove_holes(aoi_with_holes));
        print('Test intersect_and_simplify', intersect_and_simplify(get_dataset('coastline-vector'), aoi, ee.Number(1000)));
        print('Test convert_carbon AGB to OC CO2e', convert_carbon(get_dataset('mangrove-agb'), 'bio_to_CO2e'));
        print('Test convert_carbon AGB to BGB', convert_carbon(get_dataset('mangrove-agb'), 'agb_to_bgb'));
        print('Test convert_carbon SOC to OC CO2e', convert_carbon(get_dataset('mangrove-soc'), 'OC_to_CO2e'));
        print('Test get_dataset', get_dataset('mangrove-gain'));
        print('Test get_dataset_legend', get_dataset_legend('mangrove-agb'));
        print('Test get_ic_timestamp_fc', get_ic_timestamp_fc(get_dataset('mangrove-soc')));
        print('Test get_fc_timestamps', get_fc_timestamps(get_ic_timestamp_fc(get_dataset('mangrove-soc'))));
        print('Test timestamps_to_strings', timestamps_to_strings(timestamps));
        print('Test filter_timestamps', filter_timestamps(get_dataset('mangrove-soc'), timestamps));
        print('Test null_fixed_histogram', null_fixed_histogram(hist_dict_soc));
        print('Test group_sums',
            group_sums(
                ee.List.sequence({ 'start': 0, 'end': 10, 'step': 1 }).slice(0, -1),
                ee.List.repeat(1, 10),
                ee.List([ee.List([0, 3]), ee.List([6, 9])])
            ));
        print('Test update_fixed_histogram', update_fixed_histogram(hist_hmax, null_fixed_histogram(hist_dict_hmax)));
        print('Test hist_to_sldStyle', hist_to_sldStyle(null_fixed_histogram(hist_dict_soc)));
        print('Test calc_area_sum of mangrove habitat',
            calc_area_sum(
                ee.ImageCollection(get_dataset('mangrove-extent')), aoi, timestamps,
                // properties definition
                ee.Dictionary({
                    'short_name': 'area_mangrove_m2',
                    'standard_name': 'total_area_of_mangrove_coverage',
                    'title': 'Total area of mangrove habitat',
                    'units': 'm<sup>2</sup>'

                })
            ));
        print('Test calc_area_sum of gain in mangrove habitat',
            calc_area_sum(
                ee.ImageCollection(get_dataset('mangrove-gain')), aoi, timestamps,
                // properties definition
                ee.Dictionary({
                    'short_name': 'area_mangrove_gain_m2',
                    'standard_name': 'total_gain_in_area_of_mangrove_coverage',
                    'title': 'Total gain in area of mangrove habitat',
                    'units': 'm<sup>2</sup>',
                })
            ));
        print('Test calc_area_sum of mangrove SOC',
            calc_area_sum(
                ee.ImageCollection(get_dataset('mangrove-soc')), aoi, timestamps,
                // properties definition
                ee.Dictionary({
                    'short_name': 'soc_t',
                    'standard_name': 'total_mangrove_soil_organic_carbon',
                    'title': 'Total soil organic carbon in mangrove habitat',
                    'units': 't'
                })
            ));
        print('Test calc_area_summary_stats of mangrove AGB',
            calc_area_summary_stats(
                ee.ImageCollection(get_dataset('mangrove-agb')).map(function (i) {
                    return i.multiply(10000).set('system:time_start', i.get('system:time_start'));

                }), aoi, timestamps_2016,
                // properties definition
                ee.Dictionary({
                    'short_name': 'agb_t_ha-1',
                    'standard_name': 'mangrove_above_ground_biomass_density',
                    'title': 'Mangrove above ground biomass density',
                    'units': 't / ha'
                })
            ));
        print('Test calc_fixed_histogram of Hmax',
            calc_fixed_histogram(
                ee.ImageCollection(get_dataset('mangrove-hmax')), aoi, timestamps,
                // properties definition
                ee.Dictionary({
                    'short_name': 'hmax_hist_m',
                    'standard_name': 'histogram_of_mangrove_maximum_canopy_height',
                    'title': 'Histogram of mangrove maximum canopy height',
                    'units': 'm'
                }),
                // histogram definition
                ee.Dictionary({
                    min: ee.Number(0),
                    max: ee.Number(100),
                    step: ee.Number(1)

                }).combine(get_dataset_legend('mangrove-hmax'))
            ));
        print('Test calc_length_intersect coast within 200 m of mangroves',
            calc_length_intersect(
                ee.FeatureCollection(get_dataset('coastline-vector')),
                ee.ImageCollection(get_dataset('mangrove-distance')),
                aoi, timestamps_2016,
                ee.Number(200),
                // properties definition
                ee.Dictionary({
                    'short_name': 'length_mangrove_m',
                    'standard_name': 'length_of_coast_with_mangrove_cover',
                    'title': 'Length of coast with mangroves',
                    'units': 'm'
                })
            ));
        print('Test calc_length_coastline', calc_length_coastline(aoi));
        print('Test calc_length_mangroves', calc_length_mangroves(aoi, timestamps));
        print('Test calc_land_cover_sum_area', calc_land_cover_sum_area(aoi, timestamps));
        print('Test calc_mangrove_properties_histograms', calc_mangrove_properties_histograms(aoi, timestamps));
        print('Test calc_mangrove_properties_summary_stats', calc_mangrove_properties_summary_stats(aoi, timestamps_2016));
        print('Test calc_mangrove_carbon_sum_area', calc_mangrove_carbon_sum_area(aoi, timestamps));
        print('Test calc_mangrove_carbon_histogram', calc_mangrove_carbon_histogram(aoi, timestamps));
        print('Test calc_mangrove_analysis', analysis_types.map(function (at) { return calc_mangrove_analysis(at, aoi, timestamps_2016) }));
    }// end ee_js === true
} // end show_tests === true
