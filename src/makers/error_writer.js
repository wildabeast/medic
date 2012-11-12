var path = require('path'),
    fs   = require('fs'),
    generate_templates = require('../generate_templates');

var posts = path.join(__dirname, '..', '..', 'posts');

module.exports = function error_writer(platform, sha, failure, details) {
    var filename = path.join(posts, platform, sha, new Date().valueOf() + '.json');
    var contents = JSON.stringify({
        failure:failure,
        details:details
    });
    fs.writeFile(filename, contents, 'utf-8', function(err) {
        if (err) throw ('Failed to write out error file to ' + filename);
        console.error('[ERROR] [' + platform[0].toUpperCase() + platform.substr(1) + '] (sha: ' + sha.substr(0,7) +')');
        console.error(failure);
        generate_templates(platform, sha, failure, details);
    });
}