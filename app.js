var http = require('http');
var fs = require('fs-sync');
var ofs = require('fs');  // old fs
var port = 80;
var express = require('express');
var request = require('request');
var nodeID3 = require('node-id3');
var random = require('random-gen');
var bodyParser = require('body-parser');
var compression = require('compression');
var youtubedl = require('youtube-dl');
var fid = require('fast-image-downloader');

var fidOpt = {
  TIMEOUT : 2000, // timeout in ms
  ALLOWED_TYPES : ['jpg', 'png'] // allowed image types
}

var app = express();
var server = app.listen(port,function(){
  console.log("Tagifier is listening on port "+port);
});

// clean function remove all temp thumbnails and mp3

// dir cleaner function
var rmDir = function(dirPath, removeSelf) {
      if (removeSelf === undefined)
        removeSelf = true;
      try { var files = ofs.readdirSync(dirPath); }
      catch(e) { return; }
      if (files.length > 0)
        for (var i = 0; i < files.length; i++) {
          var filePath = dirPath + '/' + files[i];
          if (ofs.statSync(filePath).isFile())
            fs.remove(filePath);
          else
            rmDir(filePath);
        }
      if (removeSelf)
        ofs.rmdirSync(dirPath);
    };


rmDir('./public/img/temps',false);
rmDir('./exports',false);
console.log("Temp files cleaned");

var io = require('socket.io').listen(server);

var config = {};

// retreive config file
config = fs.readJSON("config.json");

app.use(compression());
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

app.get('/api/infos/:fileId(*)', function(req,res){
  var fileUrl = req.params.fileId+getToStr(req.query);
  console.log(fileUrl);
	retreiveVideoInfos(fileUrl,function(infos,err){
    if(err){
      res.status(405).send(err);
      return;
    }
    res.send(infos);
  });
});

io.on('connection', function (socket){

  socket.on('fileRequest', function (data) {
    var session = random.alphaNum(16);
    var file = data.file;

    fid(file.image, fidOpt.TIMEOUT, fidOpt.ALLOWED_TYPES, "", function(err, img){
      if (err) {
        console.log(err.error);
      } else {

        var dir = "./public/img/temps"; // create the temp folder if not exist (thumbnail)
        if (!fs.exists(dir)){
            fs.mkdir(dir);
        }

        dir = "./exports"; // create the export folder if not exist (mp3)
        if (!fs.exists(dir)){
            fs.mkdir(dir);
        }

        var imgPath = "./public/img/temps/"+session+"."+img.fileType.ext;
        fs.write(imgPath, img.body);
        file.image = imgPath;

        var poptions = {
          url: "https://youtu.be/"+data.file.id,
          exportPath : dir+"/"+session+".mp3"
        };

        youtubedl.getInfo(poptions.url, function(err, info) {
          if (err) throw err;
          file.info = info;

          file.size = retreiveFileSize(info);
          socket.emit("yd_event",{event:"file_infos",data:file});

          //
          // check if the download can be done
          //
          retreiveVideoInfos(data.file.id,function(infos,err){
            if(err){
              return;
            }
            var file = infos.items[0];
            var ytDur = YTDurationToSeconds(file.contentDetails.duration);
            var maxDur = 10*60;

            if(ytDur > maxDur){
              var validE = "VIDEO_TOO_LONG";
            }

            if(validE){
              socket.emit("yd_event",{event:"error",data:err});
              return;
            }


                //
                // START DOWNLOAD //
                //

                // send the file size every 500 ms
            var progressPing = setInterval(function(){
              /*var stats = ofs.statSync(poptions.exportPath);
              var fileSizeInBytes = stats["size"];
              socket.emit("yd_event",{event:"progress",data:fileSizeInBytes});*/
            },500);

            var v = youtubedl.exec(poptions.url, ['-x', '--audio-format', 'mp3','--output','exports/'+session+'.%(ext)s"'], {}, function(err, output) {
              console.log(output.join('\n'));
            if (err){
              socket.emit("yd_event",{event:"error",data:err});
              clearInterval(progressPing);
              return;
            }

            console.log(output);



            // little ad :)
            file.encodedBy = "tagifier.net";
            file.remixArtist = "tagifier.net";
            file.comment = "tagifier.net";

            var t = nodeID3.write(file, poptions.exportPath);   //Pass tags and filepath
            if(!t){
              socket.emit("yd_event",{event:"error",data:"tag"});
              clearInterval(progressPing);
              return;
            }
              if (fs.exists(imgPath)) {
                fs.remove(imgPath);
              }
              file.url = poptions.exportPath;
              socket.emit("yd_event",{event:"finished",data:file});
              clearInterval(progressPing);

              setTimeout(function(){
                if (fs.exists(poptions.exportPath)) {
                  fs.remove(poptions.exportPath);
                }
              },600*1000); //remove the file after 10 min (600 sec)*/

            });

          });

        });
      }
    });
  });
});

function retreiveFileSize(info){
  var f = 0;
  for (var i = 0; i < info.formats.length; i++) {
    if(info.formats[i].filesize){
      if(info.formats[i].filesize > f){
        f = info.formats[i].filesize;
      }
    }
  }
  return f;
}

function retreiveVideoInfos(url,callback){
  youtubedl.getInfo(url, "", function(err, info) {
    if (err) {
      callback("",err);
    }
    else {
      callback(info);
    }
  });
}

// convert an $_get object to a string list
function getToStr(get){
  var separator = "?";
  var ret = "";
  for(var key in get) {
      ret+=""+separator+""+key+"="+get[key];
      separator = "&";
  }
  return ret;
}

function YTDurationToSeconds(duration) {
  var match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

  var hours = (parseInt(match[1]) || 0);
  var minutes = (parseInt(match[2]) || 0);
  var seconds = (parseInt(match[3]) || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

app.use('/', express.static(__dirname + '/public/'));
