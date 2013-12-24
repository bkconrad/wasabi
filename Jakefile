task('doc', function () {
    var options = {
        paths: [ './src' ],
        outdir: './doc'
    };

    var Y = require('yuidocjs');
    var json = (new Y.YUIDoc(options)).run();

    options = Y.Project.mix(json, options);
 
    if (!options.parseOnly) {
        var builder = new Y.DocBuilder(options, json);
        builder.compile(function() {
            var endtime = (new Date).getTime();
        });
    }
});

task('build', function () {
    var fs = require('fs');
    var path = require('path');
    var browserify = require('browserify');
    var b = browserify();
    var UglifyJS = require('uglify-js');
    b.add('./src/wasabi.js');
    b.require('./src/wasabi');

    b.bundle(function(err, src) {
        var filename, result;

        if(err) {
            console.log(err);
            process.exit(1);
        }

        if(!fs.existsSync('build')) {
            fs.mkdirSync('build');
        }

        // write the browserified source
        filename = path.join('build', 'wasabi_browser.js');
        fs.writeFileSync(filename, src);
        console.log('Wrote to ' + filename + '. Size: ' + src.length);

        // write the browserified and minified source
        filename = path.join('build', 'wasabi_browser_min.js');
        result = UglifyJS.minify(src, {fromString: true});
        fs.writeFileSync(filename, result.code);
        console.log('Wrote to ' + filename + '. Size: ' + result.code.length);
    });
});

task('test', function () {
    var Mocha = require('mocha');
    var fs = require('fs');
    var path = require('path');
    var testFiles = fs.readdirSync('test').map(function(x) { return path.join('test', x); });
    var srcFiles = fs.readdirSync('src').map(function(x) { return path.join('src', x); });
    var mocha = new Mocha();
    var coverage = require('./coverage.js');

    // make sure the library can survive Object.prototype modification
    Object.prototype.foo = 'bar';

    coverage.hookRequire();

    srcFiles.forEach(function(name) {
        coverage.addInstrumentCandidate(name);
    });

    testFiles.forEach(function(name) {
        mocha.addFile(name);
    });

    mocha.run(function(failures) {
        coverage.writeReports('cov');
        process.exit(failures);
    });
});

task('bench', function () {
    process.stdout.write("\nBenchmarks: \n");
    require('./bench/cpu.js');
    // require('./bench/net.js');
});

task('lint', function () {
    var beautify = require('js-beautify').js_beautify;
    var JSHINT = require('jshint').JSHINT;
    var JSLINT = require('jslint').load();
    var fs = require('fs');
    var path = require('path');

    var JSBEAUTIFY_OPTS = {
        jslint_happy: true,
        indent_size: 4
    };

    var JSHINT_OPTS = {
    };

    var JSLINT_OPTS = {
        bitwise: true,
        nomen: true,
        sloppy: true,
        vars: true,
        plusplus: true,
        node: true,
        predef: ['it', 'describe', 'beforeEach']
    };

    var srcFiles = fs.readdirSync('src').map(function(x) { return path.join('src', x); });
    var testFiles = fs.readdirSync('test').map(function(x) { return path.join('test', x); });
    var files = srcFiles.concat(testFiles);
    var totalErrors = 0;

    files.forEach(function(name) {
        process.stdout.write("Linting " + name + "\n");
        var data = fs.readFileSync(name);
        data = beautify(data.toString(), JSBEAUTIFY_OPTS)
        fs.writeFileSync(name, data);

        if(!JSHINT(data, JSHINT_OPTS)) {
            process.stdout.write("jshint:\n");
            var hintData = JSHINT.data();
            for(var i = 0; i < hintData.errors.length; i++) {
                var error = hintData.errors[i];
                if(error) {
                    process.stdout.write(name + ":" + error.line + ":" + error.character + " " + error.reason + "\n");
                    totalErrors++;
                }
            }
        }

        if(!JSLINT(data, JSLINT_OPTS)) {
            process.stdout.write("jslint:\n");
            for(var i = 0; i < JSLINT.errors.length; i++) {
                var error = JSLINT.errors[i];
                if(error) {
                    process.stdout.write(name + ":" + error.line + ":" + error.character + " " + error.reason + "\n");
                    totalErrors++;
                }
            }
        }
    });

    if(totalErrors > 0) {
        process.stdout.write(totalErrors + " errors detected!\n");
        process.exit(1);
    } else {
        process.stdout.write("Lint-free!\n");
    }
});
