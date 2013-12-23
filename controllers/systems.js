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
         alerts : airvantage.alerts_query({fields : "uid,date,target,acknowledgedAt",access_token : req.session.access_token}),
         
         //get company values 
         user : async.apply(
	             async.waterfall, [airvantage.current_user({access_token : req.session.access_token}),
	                 function(user, callback){
		            	 airvantage.data_fleet_query(
	                		{targetIds : user.company.uid,
	                		dataIds : "greenhouse.temperature,greenhouse.luminosity,greenhouse.humidity",
	                		size : 10,
	                		access_token : req.session.access_token}
	                )(function(err, data) {
	                      if (data) {
	                    	  var companydata = data[user.company.uid];
	                    	  user.company.timestamp = 9999999999999;
	                    	  if ("greenhouse.temperature" in companydata && _.size(companydata["greenhouse.temperature"]) !== 0) {
	                    		  var datapoint = getFirtDatapoint(companydata["greenhouse.temperature"]);
	                    		  user.company.temperature = datapoint.v;
	                    		  if (datapoint.ts < user.company.timestamp){ user.company.timestamp = datapoint.ts;}
	                    	  }
	                    	  if ("greenhouse.luminosity" in companydata && _.size(companydata["greenhouse.luminosity"]) !== 0) {
	                    		  var datapoint = getFirtDatapoint(companydata["greenhouse.luminosity"]);
	                    		  user.company.luminosity = datapoint.v;
	                    		  if (datapoint.ts < user.company.timestamp){ user.company.timestamp = datapoint.ts;}
	                    	  }
	                    	  if ("greenhouse.humidity" in companydata && _.size(companydata["greenhouse.humidity"]) !== 0) {
	                    		  var datapoint = getFirtDatapoint(companydata["greenhouse.humidity"]);
	                    		  user.company.humidity = datapoint.v;
	                    		  if (datapoint.ts < user.company.timestamp){ user.company.timestamp = datapoint.ts;}
	                    	  }
	                      }
	                      callback(err, user);
               });
	         }
         ])
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
                    system.alerts_count = alerts_count;
                } else {
                	system.alerts_count = 0;
                }
                return system;
            });
            
            //compute the alert count for the company
            res.user.company.alerts_count = _.reduce(systems, function (sum, system) {console.log(system.alerts_count);return sum + system.alerts_count;}, 0);
            
            // render the page
            resp.render('systems', {
                alerts_count : alerts_count,
                systems : systems,
                company : res.user.company,
                active : "systems"
            });
        }
    });

};

function getDataValue(data){
	//get the last data value
	return data[0].v;
}

function getFirtDatapoint(data){
	return _.reject(data, function (e) { return e.v === null;})[0];
}

