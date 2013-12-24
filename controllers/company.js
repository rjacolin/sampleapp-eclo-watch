"use strict";

// Modules dependencies
// ---------------------------
var airvantage = require('../model/airvantage');
var _ = require('underscore');
var async = require('async');


exports.get = function(req, resp, next) {

	async.parallel({
	//ask for current user to know the company
    user : async.apply(async.waterfall, [airvantage.current_user({access_token : req.session.access_token}),
         function(user, callback){
    		 //ask for datas
        	 airvantage.data_fleet_query(
        		{targetIds : user.company.uid,
        		dataIds : "greenhouse.temperature,greenhouse.luminosity,greenhouse.humidity",
        		access_token : req.session.access_token}
        	)
        (function(err, data) {
              if (data) {
            	  var companydata = data[user.company.uid];
            	  if ("greenhouse.temperature" in companydata && _.size(companydata["greenhouse.temperature"]) !== 0) {
            		  user.company.temperature = changeFormat(companydata["greenhouse.temperature"]);
            	  }
            	  if ("greenhouse.luminosity" in companydata && _.size(companydata["greenhouse.luminosity"]) !== 0) {
            		  user.company.luminosity = changeFormat(companydata["greenhouse.luminosity"]);
            	  }
            	  if ("greenhouse.humidity" in companydata && _.size(companydata["greenhouse.humidity"]) !== 0) {
            		  user.company.humidity = changeFormat(companydata["greenhouse.humidity"]);
            	  }
              }
              callback(err, user);
        });
	    }]),
	 // get all alerts
	 alerts : airvantage.alerts_query({access_token : req.session.access_token})
	    
	},
    function(err, res) {
        if (err) {
        	console.log(user);
            console.log("ERR: " + err);
            next(err);
        } else {
            // count number of not acknowled alerts
            var alerts_count = _.size(_.reject(res.alerts.items, function(alert){return alert.acknowledgedAt;}));
            
            // render the page
            resp.render('company', {
            	company : res.user.company,
            	alerts_count : alerts_count,
                redirect: req.originalUrl,
                active : 'company'
            });
        }
    });

};

var changeFormat = function (datalist){
	//convert datapoint to {x:<timestamp>/1000, y:<value>}
	datalist = _.map(datalist, function(val){ return {x:Math.floor(val.ts/1000), y:val.v};});
	
	//convert string values into numbers for rickshaw
	datalist = _.map(datalist, function (val) { if (Object.prototype.toString.call(val.y) === "[object String]") {val.y =  parseFloat(val.y); } return val; });
	
	//sort elements by timestamp
	return _.sortBy(datalist, function(val){return val.x;});
};
