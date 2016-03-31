var http = require('http');
var port = 8080;
var express = require('express');
app = module.exports.app = express();
var server = http.createServer(app);
var request = require('request');

app.use('/', express.static(__dirname + '/public/'));

app.listen(port, function () {
  console.log('Tagifier is active on port '+port);
});