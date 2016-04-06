var path = require('path');
var temp = require('temp');
var test = require('tap').test;
var Module = require('module');
var browserify = require('browserify');
var mendelify = require('../packages/mendel-browserify');
var requirify = require('../packages/mendel-requirify');
var Loader = require('../packages/mendel-loader-server');

var srcDir = path.resolve(__dirname, './app-samples/1');
var buildDir = temp.mkdirSync('mendel-loader-server');
var mountDir = path.join(buildDir, 'server');

test('mendel-loader-server', function(t){
    t.plan(12);
    temp.track();

    var b = browserify({
        entries: [
            path.join(srcDir, 'app/index.js'),
            path.join(srcDir, 'app/throws.js'),
        ],
        outfile: path.join(buildDir, 'app.js'),
        basedir: srcDir
    });

    b.plugin(mendelify);
    b.plugin(requirify, {
        outdir: mountDir
    });

    b.bundle(function(err) {
        if (err) {
            return t.fail(err.message || err);
        }
        setTimeout(function() {
            var loader = new Loader({
                basedir: srcDir,
                mountdir: mountDir
            });

            var inputs = [{
                variations: ['test_B'],
                expect: 7
            }, {
                variations: ['test_C'],
                expect: 11
            }, {
                variations: ['test_B', 'test_C'],
                expect: 7
            }, {
                variations: ['test_C', 'test_B'],
                expect: 7
            }];

            inputs.forEach(function (i) {
                var resolver = loader.resolver({
                    bundle: 'app',
                    variations: i.variations
                });

                var variation = i.variations.join(',');

                var someNumber = resolver.require('some-number.js');
                t.equal(someNumber(), i.expect, 'some-number.js ' + variation + ' variation');

                var numberList = resolver.require('number-list.js');
                t.equal(numberList()[0], i.expect, 'number-list.js ' + variation + ' variation');

                t.throws(function() {
                    var throwyFile = resolver.require('throws.js');
                }, {
                    name: 'Error',
                    message: 'Intentional error'
                });
            });

            temp.cleanup(function() {
                t.end();
            });
        }, 1000);
    });
});

test('mendel-loader-server-syntax-error', function(t){
    t.plan(2);

    var prevDir = process.cwd();

    process.chdir(srcDir);

    try {
        // test without 'new'
        var loader = Loader();
        var resolver = loader.resolver({
            bundle: 'app',
            variations: ['test_B']
        });

        var invalidFile = path.join(srcDir, 'app/syntax-error.js');
        t.throws(function() {
            resolver.require(invalidFile);
        }, {
            name: 'ReferenceError',
            message: 'yes is not defined'
        });

        t.ok(Module._cache[invalidFile] === undefined);
    } finally {
        process.chdir(prevDir);
        t.end();
    }
});
