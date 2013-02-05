task('test', function () {
	var testProcess = require('child_process').spawn('expresso');
	testProcess.stderr.on('data', function (data)
	{
		console.log("" + data);
	});

	testProcess.stdout.on('data', function (data)
	{
		console.log("" + data);
	});
});

task('coverage', function () {
	var ChildProcess = require('child_process')
	  , fs = require('fs')
	  ;

	ChildProcess.spawn('node-jscoverage', ['src', 'src-cov']);


	var err = '', out = '';
	var testProcess = require('child_process').spawn('expresso', ['-c']);
	testProcess.stderr.on('data', function (data)
	{
		err += data;
	});

	testProcess.stdout.on('data', function (data)
	{
		out += data;
	});

	testProcess.on('exit', function (result) {
		// remove the coverage stuff
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

		console.log(err, out);
	});

});
