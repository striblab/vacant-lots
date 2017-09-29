/**
 * Vacant lot analysis
 */

// Dependencies
const path = require('path');
const fs = require('fs');
const csv = require('d3-dsv').dsvFormat(',');
const _ = require('lodash');
const moment = require('moment');
const turf = require('turf');
const ss = require('simple-statistics');
require('console.table');

// Inputs
let lots = csv.parse(fs.readFileSync(process.argv[2], 'utf-8'));
let tracts = JSON.parse(fs.readFileSync(process.argv[3], 'utf-8'));
let tractsMeta = JSON.parse(fs.readFileSync(process.argv[4], 'utf-8'));

// Parse
lots = _.map(lots, l => {
  // ADDRESS: '1672 BUSH AVE',
  // 'VACANT AS OF': '03/27/2015 12:00:00 AM',
  // WARD: '7',
  // 'DWELLING TYPE': 'Single Family Residential',
  // DISTRICT: '2',
  // 'VACANT BUILDING CATEGORY': '2',
  // 'CENSUS TRACT': '31801',
  // 'MAP LOCATION': '(44.9647847344860, -93.029724967995)'

  let parsed = {
    address: l.ADDRESS,
    ward: l.WARD,
    type: l['DWELLING TYPE'],
    district: l.DISTRICT,
    category: l['VACANT BUILDING CATEGORY'],
    tract: l['CENSUS TRACT']
  };

  parsed.date = moment(l['VACANT AS OF'], 'MM/DD/YYYY');
  parsed.days = moment().diff(parsed.date, 'days');

  let location = l['MAP LOCATION'].match(/\(([0-9.-]+), ([0-9.-]+)\)/);
  if (location) {
    parsed.latitude = parseFloat(location[1]);
    parsed.longitude = parseFloat(location[2]);
  }

  return parsed;
});

// Combine with census tracts
tracts.features = _.map(tracts.features, feature => {
  let p = feature.properties;

  // Better column names
  p.total = p.B02001001;
  p.totalError = p.B02001001 ? p['B02001001, Error'] / p.B02001001 : 1;
  p.white = p.B02001002;
  p.whitePer = p.white / p.total;
  p.whiteError = p.B02001002 ? p['B02001002, Error'] / p.B02001002 : 1;
  p.nonWhite = p.total - p.white;
  p.nonWhitePer = p.nonWhite / p.total;
  p.black = p.B02001003;
  p.blackError = p.B02001003 ? p['B02001003, Error'] / p.B02001003 : 1;
  p.native = p.B02001004;
  p.nativeError = p.B02001004 ? p['B02001004, Error'] / p.B02001004 : 1;
  p.asian = p.B02001005;
  p.asianError = p.B02001005 ? p['B02001005, Error'] / p.B02001005 : 1;

  // Poverty
  p.poverty = p.B17001002;
  p.povertyPer = p.poverty / p.B17001001;
  p.povertyError = p.B17001002 ? p['B17001002, Error'] / p.B17001002 : 1;

  // Find lots in feature
  let intersectedLots = [];
  _.each(lots, l => {
    if (turf.inside(turf.point([l.longitude, l.latitude]), feature)) {
      intersectedLots.push(l);
    }
  });

  p.lots = intersectedLots;

  return feature;
});

// Analysis.  Total by type.
console.table(
  _.map(_.groupBy(lots, 'type'), g => {
    return {
      type: g[0].type,
      count: g.length,
      'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
      'median days': ss.median(_.map(g, 'days'))
    };
  })
);

// Total by ward.
console.table(
  _.sortBy(
    _.map(_.groupBy(lots, 'ward'), g => {
      return {
        ward: g[0].ward,
        count: g.length,
        'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
        'median days': ss.median(_.map(g, 'days'))
      };
    }),
    'count'
  ).reverse()
);

// Total by category.
console.table(
  _.sortBy(
    _.map(_.groupBy(lots, 'category'), g => {
      return {
        category: g[0].category,
        count: g.length,
        'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
        'median days': ss.median(_.map(g, 'days'))
      };
    }),
    'count'
  ).reverse()
);

// Total by district.
console.table(
  _.sortBy(
    _.map(_.groupBy(lots, 'district'), g => {
      return {
        district: g[0].district,
        count: g.length,
        'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
        'median days': ss.median(_.map(g, 'days'))
      };
    }),
    'count'
  ).reverse()
);

// Total by ward and type
console.table(
  _.sortBy(
    _.map(
      _.groupBy(lots, l => {
        return l.type + l.ward;
      }),
      g => {
        return {
          ward: g[0].ward,
          type: g[0].type,
          count: g.length,
          'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
          'median days': ss.median(_.map(g, 'days'))
        };
      }
    ),
    'count'
  ).reverse()
);

// Total by census tract and type
console.table(
  _.sortBy(
    _.map(
      _.groupBy(lots, l => {
        return l.tract + l.ward;
      }),
      g => {
        return {
          ward: g[0].ward,
          tract: g[0].tract,
          type: g[0].type,
          count: g.length,
          'mean days': Math.round(_.meanBy(g, 'days') * 10) / 10,
          'median days': ss.median(_.map(g, 'days'))
        };
      }
    ),
    'count'
  ).reverse()
);

// Census tracts and race
console.table(
  _.sortBy(
    _.map(tracts.features, f => {
      let p = f.properties;
      let filtered = _.filter(p.lots, l => {
        return (
          ~['Single Family Residential', 'Duplex'].indexOf(l.type) &&
          ~['2', '3'].indexOf(l.category)
        );
      });

      return {
        geoid: p.geoid,
        lots: filtered.length,
        population: p.total,
        'lots per 1000': filtered.length / (p.total / 1000),
        'non-white pop': p.nonWhite,
        'non-white per': p.nonWhitePer,
        'lots per 1000 non-white': filtered.length / (p.nonWhite / 1000)
      };
    }),
    'non-white per'
  ).reverse()
);

// Census tracts and poverty
console.table(
  _.sortBy(
    _.map(tracts.features, f => {
      let p = f.properties;
      let filtered = _.filter(p.lots, l => {
        return (
          ~['Single Family Residential', 'Duplex'].indexOf(l.type) &&
          ~['2', '3'].indexOf(l.category)
        );
      });

      return {
        geoid: p.geoid,
        lots: filtered.length,
        population: p.total,
        'lots per 1000': filtered.length / (p.total / 1000),
        'poverty pop': p.poverty,
        'poverty per': p.povertyPer,
        'lots per 1000 poverty': filtered.length / (p.poverty / 1000)
      };
    }),
    'poverty per'
  ).reverse()
);
