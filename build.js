#!/usr/bin/env node
/*
Copyright (c) 2012 Adobe Systems Incorporated. All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
var path          = require('path'),
    shell         = require('shelljs'),
    config        = require('./config'),
    q             = require('./src/build/queue');

// Clean out temp directory, where we keep our generated apps
var temp = path.join(__dirname, 'temp');
shell.rm('-rf', temp);
shell.mkdir(temp);


var queue = new q();

function go(maker) {
    var name = maker.name;

    console.log('[MEDIC] Running maker ' + name);

    // main initializes the builder, updating build tools
    var main = require('./src/build/projects/' + name + '/build');

    // the hook detects updates to repos and triggers medic to run specs
    var hook = require('./src/build/projects/' + name + '/hook');

    main(config.makers[i], function() {
        hook(function(job) {
            for (var i in job) {
                if (job.hasOwnProperty(i)) 
                    job[i].builder = require('./src/build/projects/' + name + '/builder')('mobile_spec', "autotest/pages/all.html");
            }
            //job.builder = require('./src/build/projects/' + name + '/builder')('mobile_spec');
            queue.push(job);
        });
    });

}

for (var i in config.makers) go(config.makers[i]);

