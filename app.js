var http = require('http');
var fs = require('fs-sync');
var ofs = require('fs');  // old fs
var port = 80;
var express = require('express');
var request = require('request');
var id3 = require('node-id3');
var random = require('random-gen');
var async = require('async');
var bodyParser = require('body-parser');
var AdmZip = require('adm-zip');
var compression = require('compression');
var youtubedl = require('youtube-dl');
var fid = require('fast-image-downloader');


// CONVERT VARS

var maxProcess = 3;     //max simul
var processList = 0;   //list of current processing items
var waitingList = 0;   // list of items inside the waiting queue

//

var fidOpt = {
  TIMEOUT : 2000, // timeout in ms
  ALLOWED_TYPES : ['jpg', 'png'] // allowed image types
};

var app = express();
var server = app.listen(port,function(){
  console.log("Tagifier is listening on port "+port);
});
server.timeout = 180000;  //3min

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


app.get('/musics/:file(*)', function(req,res){
  console.log('exports/'+req.params.file);
  res.download('exports/'+req.params.file, req.query.name, function(err){
    if (err) {
      console.log(err);
    }
  });
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
    var session = {
      id : random.alphaNum(16),
      processEnded : 0,
      files : data.files
    }
    session.path = "exports/"+session.id;

    //create the temp session path
    if (!ofs.existsSync(session.path)){
      ofs.mkdirSync(session.path);
    }

    var processEnded = 0;

    for (var fileIndex = 0; fileIndex < session.files.length; fileIndex++) {
      requestFileProcess(session,fileIndex,socket);
    }
  });
});

function processFileDl(session,fileIndex,socket,callback){
  var file = session.files[fileIndex];
  fid(file.image, fidOpt.TIMEOUT, fidOpt.ALLOWED_TYPES, "", function(err, img){ //download the file image
    if (err) {
      callback(err);  //return error
      return;
    }

    var dir = "./public/img/temps"; // create the temp folder if not exist (thumbnail)
    if (!fs.exists(dir)){
        fs.mkdir(dir);
    }

    dir = "./exports/"+session.id; // create the export folder if not exist (mp3)
    if (!fs.exists(dir)){
        fs.mkdir(dir);
    }

    var imgPath = "./public/img/temps/"+session.id+"-"+fileIndex+"."+img.fileType.ext;
    fs.write(imgPath, img.body);
    file.image = imgPath;
    file.exportPath = dir+"/"+fileIndex+".mp3";

    youtubedl.getInfo(file.webpage_url, function(err, info) { //retreive file infos for checking size
      if(err){
        callback(err);  //return error
        return;
      }

      file.ytdlInfos = info;
      file.size = retreiveFileSize(file.ytdlInfos);  //retreive file size
      if(!file.size && !file.duration){
        var err = "INVALID_FILE_SIZE";
        socket.emit("yd_event",{event:"file_error",data:{index:fileIndex,error:err}});
        callback(err);  //return error
        return;
      }
      if(file.size){
        if(file.size > 1677721600){ //200 mo
          var err = "FILE_TOO_BIG";
          socket.emit("yd_event",{event:"file_error",data:{index:fileIndex,error:err}});
          callback(err);  //return error
          return;
        }
      }
      //
      // START DOWNLOAD //
      //

      // send the file size every 500 ms
      file.lastProgress = 0;
      var progressPing = setInterval(function(){
        var stats = ofs.statSync(file.exportPath);
        var fileSizeInBytes = stats["size"];
        var sinfo = {
          session : session.id,
          index : fileIndex,
          size : fileSizeInBytes
        }
        if(sinfo.size > file.lastProgress){  //send progress only if progress
          file.lastProgress = sinfo.size;

          socket.emit("yd_event",{event:"progress",data:sinfo});
        }

      },1000);

      var ytdlProcess = youtubedl(file.webpage_url,
        // Optional arguments passed to youtube-dl.
        ['-x', '--audio-format', 'mp3'],
        // Additional options can be given for calling `child_process.execFile()`.
        { cwd: __dirname });

      ytdlProcess.pipe(ofs.createWriteStream('exports/'+session.id+'/'+fileIndex+'.mp3'));

      // Will be called when the download starts.
      ytdlProcess.on('info', function(info) {
        socket.emit("yd_event",{event:"file_download_started",data:fileIndex}); //send a status for this file
      });

      ytdlProcess.on('error', function error(err) {
        socket.emit("yd_event",{event:"file_error",data:{index:fileIndex,error:err}});
      });

      ytdlProcess.on('end', function() {

        //file downloaded, apply the tags
        socket.emit("yd_event",{event:"file_finished",data:{index:fileIndex}});

        clearInterval(progressPing);  //end the filesize ping

        processFileTag(file,function(err,ffile){
          callback(null,ffile);   //return the final result
        });
      });
    });
  });
}

function processFileTag(file,callback){
  // tags + little ad :)
  var tags = {
    encodedBy : "tagifier.net",
    remixArtist : "tagifier.net",
    comment : "tagifier.net",
    title : file.title,
    artist : file.artist,
    composer : file.artist,
    image : file.image,
    album : file.album,
    year : file.year
  }

  var tagsWrite = id3.write(tags, file.exportPath);   //Pass tags and filepath
  if(!tagsWrite){
    callback(tagsWrite);  //return error
    return;
  }

  if (fs.exists(file.image)) {   //remove the temp thumbnail
    fs.remove(file.image);
  }

  callback(null,file);  //success, return the file for socket sending
}

 //used to insert a file inside a waiting queue and process it when possible
function requestFileProcess(session,fileIndex,socket){
  waitingList++;  //increment waiting list count
  var fileQueue = setInterval(function(){   //check every 5 sec if the process can start

    if(processList >= maxProcess){
      return; //no place available... retry in 5s
    }

    //remove from waiting list and place to process list
    waitingList--;
    processList++;
    clearInterval(fileQueue); //stop the loop
    processFileDl(session,fileIndex,socket,function(err,data){
      processList--;  // process ended (give a place to the waiting list)
      if(err){
        console.log("--- PROCESSING ERROR ---");
        console.log("(Session "+session.id+" | File "+fileIndex+")");
        console.log(err);
        socket.emit("error",err);
        return;
      }
      session.processEnded++;

      if(session.processEnded == session.files.length){ //if all files are converted


        //remove the session folder after 10 min (600 sec)*/
        setTimeout(function(){
          rmDir(session.path,true);
        },600*1000);

        if(session.files.length > 1){
          genZip(session,function(err,path){
            if(err){
              socket.emit("error",err);
              return;
            }
            socket.emit("yd_event",{event:"finished",data:{path:path}}); // Return a final zip
          });
        }
        else{
          socket.emit("yd_event",{event:"finished",data:{path:data.exportPath}}); // return the file
        }
      }
    });
  },5000);
}

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

function genZip(session,callback){

  var zipPath = "./exports/"+session.id+".zip";
  var zip = new AdmZip();
  var ended = 0;
  var fileFuncList = [];

  async.forEachOf(session.files, function (file, index, callback) {
    ofs.readFile(file.exportPath, function(err,fileData){
      zip.addFile(file.fileName+".mp3", fileData);
      return callback(null, file);
    });
  }, function (err) {
      if (err){
        return callback(err);
      }

      var zipData = zip.toBuffer();
      ofs.writeFile(zipPath, zipData,function(err){
        if (err){
          return callback(err);
        }
        return callback(null,zipPath);
      });
  });
}

var returnDur = function(dur){
	var d = {
		h : 0,
		m : 0,
		s : 0
	};
	var dur = dur.split(":");
	if(dur.length == 3){
		d.h = dur[0];
		d.m = dur[1];
		d.s = dur[2];
	}
	if(dur.length == 2){
		d.m = dur[0];
		d.s = dur[1];
	}
	else{
		d.s = dur[0];
	}

  var f = d.s+(d.m*60)+((d.h*60)*60);

	return f;
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

app.use('/', express.static(__dirname + '/public/'));
