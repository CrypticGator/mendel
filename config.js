/* Copyright 2015, Yahoo Inc.
   Inspired by https://github.com/babel/babel/blob/d06cfe63c272d516dc4d6f1f200b01b8dfdb43b1/packages/babel-cli/src/babel-doctor/rules/has-config.js
   Copyrights licensed under the MIT License.
   See the accompanying LICENSE file for terms. */

var path = require("path");
var fs = require("fs");
var yaml = require('js-yaml');

module.exports = function() {
  var config;
  var cwd = process.cwd();
  var parts = cwd.split(path.sep);

  do {
    var loc = parts.join(path.sep);
    if (!loc) break;

    var rc = path.join(loc, ".mendelrc");
    if (fs.existsSync(rc)) {
      return loadFromYaml(rc);
    }

    var packagejson = path.join(loc, "package.json");
    if (fs.existsSync(packagejson)) {
      var pkg = require(packagejson);
      if (pkg.mendel) {
        return pkg.mendel;
      }
    }

    parts.pop();
  } while (parts.length);

  throw new Error('No .mendelrc found nor package.json `mendel` entry.');
}

function loadFromYaml(path) {
  return yaml.safeLoad(fs.readFileSync(path, 'utf8'));
}
