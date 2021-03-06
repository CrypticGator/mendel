#!/usr/bin/env node
/* Copyright 2015, Yahoo Inc.
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var browserify = require('browserify');
var fs = require('fs');
var mkdirp = require('mkdirp');
var xtend = require('xtend');
var path = require('path');
var async = require('async');

var parseConfig = require('mendel-config');
var applyExtraOptions = require('mendel-development/apply-extra-options');
var mendelBrowserify = require('mendel-browserify');
var mendelRequirify = require('mendel-requirify');

var config = parseConfig();
logObj(config);

var outdir = config.bundlesoutdir || config.outdir;
mkdirp.sync(outdir);

async.each(config.bundles, function(rawBundle, doneBundle) {
    var bundle = JSON.parse(JSON.stringify(rawBundle));
    var conf = {
        basedir: config.basedir,
        outfile: path.join(bundle.bundlesoutdir, config.base, bundle.outfile)
    };
    mkdirp.sync(path.dirname(conf.outfile));

    var entries = bundle.entries;
    delete bundle.entries;

    var b = browserify(xtend(conf, bundle));
    b.plugin(mendelBrowserify, bundle);

    if (config.serveroutdir) {
        b.plugin(mendelRequirify, {
            outdir: config.serveroutdir
        });
    }

    applyExtraOptions(b, bundle);

    if (entries) {
        // TODO: aync ../lib/resolve-dirs instead of hardcoded base
        entries.forEach(function(entry) {
            b.add(path.join(config.basedir, config.basetree, entry));
        });
    }

    var finalBundle = b.bundle();
    finalBundle.on('end', doneBundle);
    if (conf.outfile) {
        finalBundle.pipe(fs.createWriteStream(conf.outfile));
    } else {
        finalBundle.pipe(process.stdout);
    }
});

function logObj(obj) {
  console.log(require('util').inspect(obj,false,null,true));
  return obj;
}
