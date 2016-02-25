/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var browserify = require('browserify');
var through = require('through2');
var shasum = require('shasum');
var path = require('path');
var fs = require('fs');
var async = require('async');
var mkdirp = require('mkdirp');
var JSONStream = require('JSONStream');

function existsRelativeDir(dir) {
  return fs.existsSync(path.join(process.cwd(), dir));
}

function variationsDir(dir) {
  return path.join(config.variations_root, dir);
}

function logObj(obj) {
  console.log(require('util').inspect(obj,false,null,true));
  return obj;
}

var config = require('./config')();
// logObj((config));

var basePath = path.join(process.cwd(), config.base);
if (!fs.existsSync(basePath)) {
  console.log('base must exist in config');
  process.exit(1);
}

var bundles = Object.keys(config.bundles).map(function(bundleName) {
  var bundle = config.bundles[bundleName];
  bundle.id = bundleName;
  return bundle;
});

logObj(bundles);

var variations = Object.keys(config.variations||[]).map(function(dir) {
  var chain = [dir]
                  .concat(config.variations[dir] || [])
                  .map(variationsDir)
                  .concat([config.base])
                  .filter(existsRelativeDir);
  return {
    id: dir,
    chain: chain,
  };
}).filter(function(variation) {
  return variation.id !== 'base' && variation.chain.length > 1;
});

variations.unshift({
  id: 'base',
  chain: [config.base],
});

variations.forEach(function(variation) {
  variation.matchList = variation.chain.map(function(path) {
    path = path.replace(/(^\/|\/$)/g,'');
    return new RegExp('(.*)/('+path+')/(.*)')
  });
});

function findVariationMatch(path) {
  var match;
  variations.some(function(variation) {
    variation.matchList.some(function(regex) {
      match = path.match(regex);
      return match;
    });
    return match;
  });
  return match;
}

logObj(variations);

async.each(bundles, function(rawBundle, doneBundle) {
  var bundleManifest = {};
  function pushBundleManifest(dep) {
    var id = dep.id;
    var variation = dep.variation;
    var data = JSON.parse(JSON.stringify(dep));
    delete data.source;
    delete data.sha;
    delete data.file;

    if (!bundleManifest[id]) {
      bundleManifest[id] = {
        variations: [variation],
        data: [data],
      };
    } else {
      var variationIndex = bundleManifest[id].variations.indexOf(variation);
      if (variationIndex === -1) {
        bundleManifest[id].variations.push(variation);
        bundleManifest[id].data.push(data);
      } else if (bundleManifest[id].data[variationIndex].sha !== dep.sha) {
        console.log('Same id should not yield same sha');
        // throw new Error('Same id should not yield same sha');
      }
    }
  }
  async.each(variations, function(variation, doneVariation) {
    var bundle = JSON.parse(JSON.stringify(rawBundle));

    // validate entries honorring chain
    bundle.entries = (bundle.entries||[]).map(function(file) {
      var found;
      variation.chain.some(function(dir) {
        found = path.join(dir, file);
        return fs.existsSync(found);
      });
      return found;
    });
    bundle.bundleExternal = !bundle.external;

    var b = browserify(bundle);

    // Prepare output files
    var bundleFileName = (bundle.dest || bundle.id+'.js');
    var destDir = path.join(process.cwd(), config.dest, variation.id);
    var destBundle = path.join(destDir, bundleFileName);
    var destDeps = path.join(destDir, bundle.id+'.manifest.json');
    mkdirp.sync(destDir);

    var bundleStream = fs.createWriteStream(destBundle);
    var depsStream = JSONStream.stringify();
    depsStream.pipe(fs.createWriteStream(destDeps));

    b.transform(path.join(__dirname, "packages/mendel-treenherit"), {"dirs": variation.chain});

    var mendelify = through.obj(function (row, enc, next) {
      var match = findVariationMatch(row.file);

      if (match) {
        row.id = match[3];
        row.variation = match[2];
        Object.keys(row.deps).forEach(function (key) {
          var rowMatch = findVariationMatch(key);
          if (rowMatch) {
            row.deps[key] = rowMatch[3];
          }
        });
      }

      row.sha = shasum(row.source);

      pushBundleManifest(row);

      this.push(row);
      depsStream.write(row);
      next();
    });
    b.pipeline.get('deps').push(mendelify);

    // bundle
    var bundler = b.bundle();
    bundler.on('end', function(){
      depsStream.end();
      doneVariation();
    });
    bundler.pipe(bundleStream);
  }, function() {
    var manifestPath = path.join(process.cwd(), config.dest, rawBundle.id+'.manifest.json');
    fs.writeFile(manifestPath, JSON.stringify(bundleManifest), function (err) {
      if (err) {
        return console.log(err);
      }
      doneBundle();
    });
  });
});
