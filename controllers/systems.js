"use strict";

// Modules dependencies
// ---------------------------
var airvantage = require('../model/airvantage');
var _ = require('underscore');
var async = require('async');


/**
 * Manage get request on systems.
 */
exports.get = function(req, resp, next) {

    async.parallel({
         // get all systems and their data         
         systems : async.apply(
             async.waterfall, [
                 airvantage.systems_query({fields : "uid,name,lastCommDate",access_token : req.session.access_token}),
                 function(systems, callback){
                	 airvantage.data_raw_query(
	                		{targetIds : _.reduce(systems.items,function(memo, system) {return memo+system.uid+",";},""),
	                		dataIds : "greenhouse.temperature,greenhouse.luminosity,greenhouse.humidity",
	                		size : 1,
	                		access_token : req.session.access_token}
	                )(function(err, data) {
	                      if (data) {
	                    	  _.each(systems.items, function (system){
		                    	  var systemdata = data[system.uid];
		                    	  if ("greenhouse.temperature" in systemdata && _.size(systemdata["greenhouse.temperature"]) !== 0) {
		                    		  system.temperature = getDataValue(systemdata["greenhouse.temperature"]);
		                    	  }
		                    	  if ("greenhouse.luminosity" in systemdata && _.size(systemdata["greenhouse.luminosity"]) !== 0) {
		                    		  system.luminosity = getDataValue(systemdata["greenhouse.luminosity"]);
		                    	  }
		                    	  if ("greenhouse.humidity" in systemdata && _.size(systemdata["greenhouse.humidity"]) !== 0) {
		                    		  system.humidity = getDataValue(systemdata["greenhouse.humidity"]);
		                    	  }
	                    	  });
	                      }
	                      callback(err, systems);
	               });
                 }
            ]
         ),
         // get all alerts
         alerts : airvantage.alerts_query({fields : "uid,date,target,acknowledgedAt",access_token : req.session.access_token}) 
    },
    function(err, res) {
        if (err) {
            console.log("ERR: " + err);
            next(err);
        } else {
        	
            // count number of not acknowled alerts
            var alerts_count = _.size(_.reject(res.alerts.items, function(alert){return alert.acknowledgedAt;}));

            // attach alerts to their system
            var alerts = _.groupBy(res.alerts.items, 'target');

            var systems = _.map(res.systems.items, function(system) {
                var a = alerts[system.uid];
                if (a) {
                    var alerts_count = _.size(_.reject(a, function(alert){return alert.acknowledgedAt;}));
                    if (alerts_count > 0) system.alerts_count = alerts_count;
                }
                return system;
            });

            // render the page
            resp.render('systems', {
                alerts_count : alerts_count,
                systems : systems,
                active : "systems"
            });
        }
    });

};

function getDataValue(data){
	//Remove the timestamp from elements
	data = _.map(data ,function (v){return v;});
	
	//get the last data value
	return data[0].value;
}

