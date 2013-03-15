var path             = require('path'),
    fs               = require('fs'),
    pgbuild          = require('./pgbuild');

var builders = {
    'cordova-android':pgbuild('android'),
    'cordova-ios':pgbuild('ios'),
    'cordova-blackberry':pgbuild('blackberry')
};
var tempDir = path.join(__dirname, '..', '..', '..', '..', 'temp');

function build_the_queue(q, callback) {
    var job = q.shift();
    if (job) {
        job.builder(job.output_location, job.sha, job.devices, job.entry, function(err) {
            if (err) console.error('[BUILDER] Previous build failed, continuing.');
            build_the_queue(q, callback);
        });
    } else callback();
}

function createJob(commits, app_entry_point, callback) {
    var miniq = [];
    for (var lib in commits) if (commits.hasOwnProperty(lib)) {
        if (builders.hasOwnProperty(lib)) {
            var job = {
                library:lib,
                builder:builders[lib],
                output_location:path.join(tempDir, 'test'),
                entry:app_entry_point
            };

            // Some jobs might be for all devices, or specific devices
            if (typeof commits[lib] == 'string') {
                job.sha = commits[lib];
            } else {
                job.sha = commits[lib].sha;
                job.devices = commits[lib].devices;
            }
            miniq.push(job);
        }
    }
    build_the_queue(miniq, callback);
}

module.exports = function(app_builder, app_entry_point, static) {

    return function builder(commits, callback) {
        // commits format:
        // { cordova-android:'sha'}
        // OR
        // { cordova-android:{
        //     sha:'sha',
        //     devices:[]
        //   }
        // }

        builders[app_builder] = require('./' + app_builder);

        builders[app_builder](path.join(tempDir, 'test'), null, null, app_entry_point, function(err) {
            if (err) {
                throw new Error('Could not build Test App! Aborting!');
            }
            console.log('[MEDIC] [PGB] Test app built + ready.');
            createJob(commits, app_entry_point, callback);
        });
    }
};