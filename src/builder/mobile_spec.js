var shell     = require('shelljs'),
    path      = require('path'),
    config    = require('../../config'),
    fs        = require('fs');

var jasmineReporter = path.join(__dirname, 'app_files', 'jasmine-jsreporter.js');
var configXML = path.join(__dirname, 'app_files', 'config.xml');

module.exports = function(output_location, sha, name, entry_point, git_url, gap_version, callback) {

    console.log('[PGB] Preparing mobile spec');

    shell.rm('-Rf', output_location);
    shell.mkdir('-p', output_location);
    var tempAll = path.join(output_location, 'autotest', 'pages', 'all.html');
    var libDir = path.join(__dirname, '..', '..', '..', 'lib');
    var lib = name;

    var contents = [];
    if (fs.existsSync(libDir))
        contents = fs.readdirSync(libDir);

    var cmd = null;
    if (contents.indexOf(lib) == -1) {
        // Don't have the lib, get it.
        cmd = 'git clone ' + git_url + ' ' + path.join(libDir, lib);
    } else {
        // Have the lib, update it.
        cmd = 'cd ' + path.join(libDir, lib) + ' && git checkout -- . && git pull origin master';
    }

    // checkout correct sha
    /*
    if (sha)
        cmd += ' && git checkout ' + sha;
    */

    shell.exec(cmd, {silent:true, async:true}, function(code, output) {
        if (code > 0) {
            console.error('[ERROR] [BUILDER] [TEST APP] Error during git-checkout of test app SHA! command executed was: ' + cmd + ', output: ' + output);
            callback(true);
        } else {
            // copy relevant bits of mobile-spec project to output_location location
            shell.cp('-Rf', [path.join(libDir, lib, 'autotest'), path.join(libDir, lib, 'cordova.js'), path.join(libDir, lib, 'master.css'), path.join(libDir, lib, 'main.js')], output_location);

            // copy jasmine reporter into output_location location
            shell.cp('-Rf', jasmineReporter, output_location);
            shell.cp('-Rf', configXML, output_location);

            // create an app into output dir
            console.log('[PGB] Modifying app in ' + output_location);
            try {
                if (entry_point) {
                    console.log('[PGB] Adding redirect to ' + entry_point);
                    fs.writeFileSync(path.join(output_location, 'index.html'), '<html><body onload="window.location.href=\'' + entry_point + '\'"></body><html>');
                    
                    /*
                    var tempConfig = path.join(output_location, "config.xml");
                    var xml = fs.readFileSync(tempConfig, 'utf-8').replace(/<content src=.index.html. \/>/, '<content src="' + entry_point + '" />' );
                    fs.writeFileSync(tempConfig, xml, 'utf-8');
                    */
                }

            } catch (e) {
                error_writer(platform, sha, 'Exception thrown modifying test application.', e.message);
                callback(true);
                return;
            }
            
            // drop sha to the top of the jasmine reporter
            var tempJasmine = path.join(output_location, 'jasmine-jsreporter.js');
            var jsString = "var library_sha = '" + sha + "'; \n    var db_name = 'mobilespec_results';\n";
            fs.writeFileSync(tempJasmine, jsString + fs.readFileSync(tempJasmine, 'utf-8'), 'utf-8');

            // replace a few lines under the "all" tests autopage
            fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/<script type=.text.javascript. src=.\.\..html.TrivialReporter\.js.><.script>/, '<script type="text/javascript" src="../html/TrivialReporter.js"></script><script type="text/javascript" src="../../jasmine-jsreporter.js"></script>'), 'utf-8');
            fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/jasmine.HtmlReporter.../, 'jasmine.HtmlReporter(); var jr = new jasmine.JSReporter("' + config.couchdb.host + '");'), 'utf-8');
            fs.writeFileSync(tempAll, fs.readFileSync(tempAll, 'utf-8').replace(/addReporter.htmlReporter../, 'addReporter(htmlReporter);jasmineEnv.addReporter(jr);'), 'utf-8');
            callback();
        }
    });
}
