var http = require('http');
var fs = require('fs');
var port = 8080;
var express = require('express');
app = module.exports.app = express();
var server = http.createServer(app);
var request = require('request');
var config = {};

// retreive config file
fs.readFile("config.json", function (err, data) {
    if(err) {
      console.error(err);
      return;
    }
    try {
      config = JSON.parse(data);
    } catch(exception) {
      console.error(exception);
    }
  });

app.use('/', express.static(__dirname + '/public/'));

app.get('/api', function(req, res) {
  res.send('hello world');
});

app.listen(port, function () {
  console.log('Tagifier is active on port '+port);
});