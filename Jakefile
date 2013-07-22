task('doc', {async: true}, function () {
    jake.exec("yuidoc src -o doc", function () {
        complete();
    }, {printStdout: true, printStderr: true});
});

task('build', {async: true}, function () {
    jake.exec("browserify -r ./src/wasabi src/wasabi.js -o build/wasabi_browser.js", function () {
        complete();
    }, {printStdout: true, printStderr: true});
});

task('test', {async: true}, function () {
    jake.exec("mocha", function () {
        complete();
    }, {printStdout: true, printStderr: true});
});

task('bench', {async: true}, function () {
    require('./bench/wasabi.js');
});

task('coverage', {async: true}, function () {
    var fs = require('fs');
    process.env.COVERAGE = 'YES';
    jake.exec("jscoverage src src-cov", function () {
        var ex = jake.createExec("mocha --reporter html-cov");
        var output = '';

        ex.addListener('stdout', function (data) {
            output += data;
        });

        ex.addListener('cmdEnd', function() {
            // remove coverage data
            var dirPath = __dirname + '/src-cov';
            try { var files = fs.readdirSync(dirPath); }
            catch(e) { console.log('unable to remove ' + dirPath); return; }
            if (files.length > 0)
                for (var i = 0; i < files.length; i++) {
                    var filePath = dirPath + '/' + files[i];
                    if (fs.statSync(filePath).isFile())
                        fs.unlinkSync(filePath);
                    else
                        rmDir(filePath);
                }
            fs.rmdirSync(dirPath);
            fs.writeFileSync('coverage.html', output);
        });

        ex.run();
    }, {printStdout: true, printStderr: true});
});
