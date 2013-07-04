
var request = require('request'),
    path    = require('path'),
    shell   = require('shelljs'),
    fs      = require('fs'),
    argv    = require('optimist').argv,
    config  = require('../../config'),
    aws     = require('aws-sdk'),
    libDir  = path.join(__dirname, '..', '..', 'lib');

// Runs some initializations like retrieving the specs list
module.exports = function(specs, callback) {
    if (argv.spec) {
        var name = argv.name || argv.spec.match(/.*\/([^/]+)\.[^\.]+$/)[1];
        var gap_versions = argv.gap_versions || "2.3.0,2.5.0,2.7.0";

        specs.push({
            name: name,
            git: argv.spec,
            gap_versions: gap_versions
        });

        getSpecs(specs, callback);
    } else if (argv.server || argv.queue) {
        getSpecs(specs, callback);
    } else {
        console.log('[BUILD] Getting specs from ' + config.specs_url);

        request.get({ url:config.specs_url, json:true }, function(e, r, data) {

            if (e) {
                console.log('[PGB] Could not retrieve specs.json');
            } else {
                try {
                    Object.keys(data.specs).forEach(function(name) {
                        var spec = data.specs[name];
                        specs.push({
                            name: name,
                            git: spec.repo,
                            gap_versions: spec.gap_versions
                        });
                    });
                } catch (ex) {
                    console.log('[PGB] Could not parse specs.json (' + ex.message + ')');
                }
            }

            getSpecs(specs, callback);
        });
    }
};

function getSpecs(specs, cb) {
    specs.forEach(function(spec) {
        console.log('.');
        shell.rm('-rf', path.join(libDir, spec.name));
        if (spec.git) {
            cloneSpec(spec);
            cb([]);
        } else if (spec.zip) {
            if (spec.zip.match(/s3.amazonaws.com/)) {
                unzipFromS3(spec, cb);
            } else {
                unzipFromURL(spec, cb);
            }
        }
    })
}

function cloneSpec(spec) {

    var contents = [];
    if (fs.existsSync(libDir))
        contents = fs.readdirSync(libDir);

    var cmd = null;
    if (contents.indexOf(spec.name) == -1) {
        // Don't have the lib, get it.
        cmd = 'git clone ' + spec.git + ' ' + path.join(libDir, spec.name) + ' && cd ' + path.join(libDir, spec.name) + ' && git fetch';
    } else {
        // Have the lib, update it.
        cmd = 'cd ' + path.join(libDir, spec.name) + ' && git checkout -- . && git pull origin master';
    }

    shell.exec(cmd, {silent:true, async:false});
}

function unzipFromS3(spec, cb) {
    console.log('[INIT] Downloading from s3 ' + spec.zip);

    aws.config.accessKeyId = config.accessKeyId;
    aws.config.secretAccessKey = config.secretAccessKey;
    aws.config.region = 'us-east-1';

    var r = spec.zip.match(/(?:\/\/s3\.amazonaws.com\/(.*)\/([^\/]+))/);
    var bucket = r[1];
    var id = r[2];

    var zip_file = path.join(libDir, spec.name + '.zip');
    shell.mkdir('-p', libDir);
    var file = fs.createWriteStream(zip_file);

    var s3 = new aws.S3();
    var params = {
        "Bucket": bucket,
        "Key": id
    };

    s3.getObject(params).
    on('httpData', function(chunk) { 
        file.write(chunk); 
    }).on('httpDone', function() { 
        file.end(); 
        unzip(zip_file, spec.name);
        cb([]);
    }).send();

}

function unzipFromURL(spec, cb) {
    console.log('[INIT] Downloading ' + spec.zip);
    
    var zip_file = path.join(libDir, spec.name + '.zip');
    shell.mkdir('-p', libDir);

    var r = request(spec.zip).pipe(fs.createWriteStream(zip_file));
    r.on('close', function() {
        unzip(zip_file, spec.name);
        cb([]);
    });

}

function unzip(file, dirName) {
        console.log('[INIT] unzipping.')
        var cmd = 'cd ' + libDir + ' && mkdir ' + dirName + ' && unzip ' + file + ' -d ' + dirName;
        var result = shell.exec(cmd, {silent:true, async:false});

        if (result.code != 0) {
            console.log("[UNZIP] [ERROR] " + result.output.substring(0, 200));
        } else {
            shell.rm(file);
        }
}

