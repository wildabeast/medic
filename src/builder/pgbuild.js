var shell        = require('shelljs'),
    path         = require('path'),
    request      = require('request'),
    config       = require('../../config'),
    argv         = require('optimist').argv,
    error_writer = require('../error_writer');

var package_id = "org.apache.cordova.example";


module.exports = function(platform) {
    return function(job, callback) {

        var output      = job.output_location,
            timestamp   = job.timestamp,
            devices     = job.devices,
            entry_point = job.entry;

        function log(msg) {
            console.log('[' + platform + '] ' + msg + ' (stamp: ' + timestamp + ')');
        }

        // compile
        log('Compiling for ' + platform + ' on PhoneGap Build...');

        var pgb = require('./api');

        var zip_path = path.join(output, platform, 'www.zip');
        var cmd = 'cd ' + path.join(output, platform, 'test') + ' && zip -r ' + zip_path + ' ./*';

        var options = {
            platform: platform,
            zip_path: zip_path,
            output_path: path.join(output, platform)
        };

        shell.exec(cmd, {silent:true, async:true}, function(code, checkout_output) {

            pgb.auth({ username: config.pgb.username, password: config.pgb.password, host: job.host || argv.host || null }, function() {

                var start = Date.now();

                pgb.build(options, function(error, id, pf, binpath) {

                    if (error) {
                        console.log('[PGB] Build failed (' + error.toString().trim() + ')');
                        callback(error);
                        return;
                    }

                    var end = Date.now();
                    var duration = Math.round((end - start) / 1000);
                    postBuildTime(duration, pf, id, start);

                    var output_dir = path.join(output, pf);

                    if (pf == "ios") {
                        var cmd = 'cd ' + output_dir + ' && unzip ' + binpath;

                        shell.exec(cmd, {silent:true, async:false});
                        shell.cp('-Rf', path.join(output_dir, 'Payload', 'cordovaExample.app'), output_dir);

                        binpath = path.join(output_dir, 'cordovaExample.app');
                        shell.rm('-rf', path.join(output_dir, 'Payload'));

                        if (config.ios.keychainLocation && config.ios.keychainPassword) {
                            var cmd = 'security unlock-keychain -p ' + config.ios.keychainPassword + ' ' + config.ios.keychainLocation;
                            shell.exec(cmd, {silent:false, async:false});
                        }
                        var entitlements_plist = path.join(__dirname, 'app_files', 'Entitlements.plist');
                        var codesign = "codesign -f -s \"iPhone Developer\" --entitlements " + entitlements_plist + " " + binpath;
                        
                        console.log('[PGB] Re-signing iOS app bundle');
                        shell.exec(codesign, {silent:false, async:false});
                    }

                    var platform_scanner = require('../platforms/' + pf + '/devices');

                    console.log('[PGB] [BUILD] Scanning for ' + pf + ' devices')
                    platform_scanner(function(err, devices) {
                        if (err) console.log('[BUILD] Error scanning for ' + pf + ' devices: ' + devices);
                        else {
                            var deploy = require('../platforms/' + pf + '/deploy')
                            deploy(timestamp, devices, binpath, package_id, callback);
                        }
                    });

                });
            });
        });

    }
}

function postBuildTime(duration, pf, id, time) {
    var url = config.couchdb.host + "/build_times/" + id;
    request.put({ url: url, json: { 'duration': duration, 'platform': pf, 'time': time }});
}
