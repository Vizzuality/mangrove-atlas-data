const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { format } = require('date-fns');
const { chain } = require('stream-chain');
const { parser } = require('stream-json');
const Stringer = require('stream-json/jsonl/Stringer');
const { pick } = require('stream-json/filters/Pick');
const { streamArray } = require('stream-json/streamers/StreamArray');

const filePath = path.join(process.cwd(), './data/results.json.gz');

const pipeline = chain([
  fs.createReadStream(filePath),
  zlib.createGunzip(),
  parser(),
  pick({ filter: 'features' }),
  streamArray(),
  ({ value }) => {
    const { geometry, properties } = value;
    const {
      firstobsyear,
      firstobsmonth,
      firstobsday,
      lastobsyear,
      lastobsmonth,
      lastobsday,
      scr5obsyear,
      scr5obsmonth,
      scr5obsday,
      score,
      uid,
    } = properties;
    const first_obs_date = new Date(firstobsyear, firstobsmonth, firstobsday);
    const last_obs_date = new Date(lastobsyear, lastobsmonth, lastobsday);
    const scr5_obs_date = new Date(scr5obsyear, scr5obsmonth, scr5obsday);
    const result = {
      id: uid,
      confident: score,
      first_obs_date: format(first_obs_date, 'yyyy-MM-dd'),
      last_obs_date: format(last_obs_date, 'yyyy-MM-dd'),
      scr5_obs_date: format(scr5_obs_date, 'yyyy-MM-dd'),
      latitude: geometry.coordinates[0],
      longitude: geometry.coordinates[1],
    };
    return result;
  },
  new Stringer(),
  fs.createWriteStream('./data/edited.json')
]);

pipeline.on('end', () => console.log(`Process has been finished successfully`));
