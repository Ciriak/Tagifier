var http = require('http');
var fs = require('fs');
var port = 80;
var express = require('express');
var request = require('request');
var nodeID3 = require('node-id3');
var random = require('random-gen');
var bodyParser = require('body-parser')
var YoutubeMp3Downloader = require('youtube-mp3-downloader');
var fid = require('fast-image-downloader');
var fidOpt = {
  TIMEOUT : 2000, // timeout in ms
  ALLOWED_TYPES : ['jpg', 'png'] // allowed image types
}

var app = express();
var server = app.listen(port,function(){
  console.log("Tagifier is listening on port "+port);
});
var io = require('socket.io').listen(server);

var config = {};

var YD = new YoutubeMp3Downloader({
    "ffmpegPath": "ffmpeg/ffmpeg.exe",        // Where is the FFmpeg binary located? 
    "outputPath": "exports",    // Where should the downloaded and encoded files be stored? 
    "youtubeVideoQuality": "highest",       // What video quality should be used? 
    "queueParallelism": 2,                  // How many parallel downloads/encodes should be started? 
    "progressTimeout": 1000                 // How long should be the interval of the progress reports 
});

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

app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

app.use('/', express.static(__dirname + '/public/'));

//
// Used for Captchat confirmation
//

app.post('/checker', function(req,res)
{
  var r;
  var turl = "http://verify.solvemedia.com/papi/verify";
  var form =  {
      challenge: req.body.chal,
      response : req.body.resp,
      privatekey : config.solvemedia_key,
      remoteip : req.connection.remoteAddress
    };
  request.post({
    url:turl,
    form: form
  },
  function(err,httpResponse,body){
    if(body.substring(0,4) == "true") // if good captchat response by solvemedia
    {
      res.sendStatus(200);
      return;
    }
    res.sendStatus(403);
  });
});

//
//
//

//


app.get('/musics/:file', function(req,res){
  res.download('exports/'+req.params.file,req.query.name+".mp3");
});

app.get('/api/:fileId(*{1,11})', function(req,res){
	var uriInfos = "https://www.googleapis.com/youtube/v3/videos?id="+req.params.fileId+"&part=snippet&key="+config.youtube_api_key;
	var uriDetails = "https://www.googleapis.com/youtube/v3/videos?id="+req.params.fileId+"&part=contentDetails&key="+config.youtube_api_key;
	var vid = {};

	request(uriInfos, function (error, response, body) {
  	if (!error && response.statusCode == 200) {
  		body = JSON.parse(body);
  		for (var attr in body.items[0]) { vid[attr] = body.items[0][attr]; }
    	request(uriDetails, function (error2, response2, body2) {
	  	if (!error2 && response2.statusCode == 200) {
	    	body2 = JSON.parse(body2);
	    	for (var attr in body2.items[0]) { vid[attr] = body2.items[0][attr]; }
	    	res.send(vid);
	  	}
	  	else
	  	{
	  		res.send("Invalid query for contentDetails");
	  	}
		});
  	}
  	else
  	{
  		res.send("Invalid query for Snippet");
  	}
	});
});

io.on('connection', function (socket){
  console.log("User connected");

  socket.on('fileRequest', function (data) {
    var session = random.alphaNum(16);
    var file = data.file;

    fid(file.image, fidOpt.TIMEOUT, fidOpt.ALLOWED_TYPES, "", function(err, img){
      if (err) {
        console.log(err.error);
      } else {
        
        console.log(data);
        var imgPath = "./public/img/temps/"+session+"."+img.fileType.ext;
        fs.writeFile(imgPath, img.body, function(err) {
          if(err) {
              return console.log(err);
          }

            file.image = imgPath;
            console.log(imgPath);
            YD.download(file.id,session+".mp3");

            YD.on("finished", function(data) {
                var success = nodeID3.write(file, data.file);   //Pass tags and filepath
                console.log(success); 
                if (fs.existsSync(imgPath)) {
                  fs.unlink(imgPath);
                }
                socket.emit("yd_event",{event:"finished",data:data});

                setTimeout(function(){
                  if (fs.existsSync(data.file)) {
                    fs.unlink(data.file);
                  }
                },600*1000); //remove the file after 10 min (600 sec)
            });
             
            YD.on("error", function(error) {
                console.log(error);
                socket.emit("yd_event",{event:"error",data:error});
            });
             
            YD.on("progress", function(progress) {
                socket.emit("yd_event",{event:"progress",data:progress});
            });
        }); 
      }
    });
  });
});

app.use('/', express.static(__dirname + '/public/'));