"use strict";

// Modules dependencies
// ---------------------------
var airvantage = require('../model/airvantage');
var _ = require('underscore');
var async = require('async');


exports.get = function(req, resp) {

    var uid = req.query.uid;

    async.parallel({
        // get system info
        system : airvantage.systems_query({uid: uid, fields : "uid,name", access_token : req.session.access_token}),
        datas : airvantage.data_raw_query({uid: uid, targetIds: uid, dataIds:"greenhouse.temperature,greenhouse.humidity,greenhouse.luminosity", size: 500, access_token : req.session.access_token}),
        
        // get all alerts
        alerts : airvantage.alerts_query({access_token : req.session.access_token}) 
        
        
    },
    function(err, res) {
        if (err) {
            console.log("ERR: " + err);
        } else {

            // count number of not acknowled alerts
            var alerts_count = _.size(_.reject(res.alerts.items, function(alert){return alert.acknowledgedAt}));

            var system = res.system.items[0] || {name: ""};

            // attach alerts to their system
            system.alerts = _.groupBy(res.alerts.items, 'target')[uid] || [];
            
            //attach datas to system
            system.temperature = changeformat(res.datas[uid]["greenhouse.temperature"]);
            system.luminosity = changeformat(res.datas[uid]["greenhouse.luminosity"]);
            system.humidity = changeformat(res.datas[uid]["greenhouse.humidity"]);

            // render the page
            resp.render('systemdetails', {
                alerts_count : alerts_count,
                system : system,
                redirect: req.originalUrl,
                active : 'none'
            });
        }
    });

};

var changeformat = function (datalist){
	//convert datapoint from {<timestamp> : {value : <value>}} to [{timestamp : <timestamp>, value : <value>}]
	datalist =  _.map(datalist, function (v,k) {return { timestamp:k, value:v.value}});
	
	//convert datapoint to {x:<timestamp>/1000, y:<value>}
	datalist = _.map(datalist, function(val){ return {x:Math.floor(val.timestamp/1000), y:val.value}});
	
	//sort elements by timestamp
	return _.sortBy(datalist, function(val){return val.x;});
}
