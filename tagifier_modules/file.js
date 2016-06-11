const electron = require('electron');
const ipc = electron.ipcMain;
var id3 = require('node-id3');
var id3Parser = require("id3-parser");
var path = require('path');
var fs = require('fs');
var random = require('random-gen');

function File() {



  this.id = random.alphaNum(8);
  this.filename = "tagifier.mp3";
  this.title = "";
  this.artist = "";
  this.composer = "";
  this.album = "";


};


// retreive informations for the file and return them
fileRetreiveMetaData = function(file,callback) {
  if(file.external){
    console.log("External");
  }
  else{
    file.filename = path.basename(file.uri);
    var fileBuffer = fs.readFileSync(file.uri);
    var tempId = file.id;
    id3Parser.parse(fileBuffer).then(function(tags) {
      //if img exist, write it
      if(tags.image){
        saveCover(tags.image.data,"img/temps",tempId+".jpg",function(err,path){
            if(err){
              return callback(err,null);
            }
            tags.originalePictureUri = path;
            tags.pictureUri = path;
            callback(null,tags);
        });
      }
      else{
        callback(null,tags);
      }
    });
  }
};

fileProcess = function (file,callback){
  //dl with YoutubeDL if external
  if(file.external === true){
    console.log("Downloading the file...");
    fileDownload(file, function(err){
      console.log("Downloaded");
    });
  }
  else{
    console.log("Tagging the file...");
    fileTag(file, callback,function(err){
      if(err){
        console.log("Failed to tag the file");
        console.log(err);
        callback(err);
        return;
      }
      console.log("File tagged successfully");
      callback(null);
    });
  }
}

fileTag = function (file,callback){

  var imgPath = file.pictureUri.replace("./","./public/");

  var tags = {
    encodedBy : "tagifier.net",
    remixArtist : "tagifier.net",
    comment : "tagifier.net",
    title : String(file.title),
    artist : String(file.artist),
    composer : String(file.artist),
    album : String(file.album),
    year : String(file.year),
    image : imgPath
  }

  console.log(tags);

  var tagsWrite = id3.write(tags, file.uri);   //Pass tags and filepath
  if(!tagsWrite){
    callback(tagsWrite);  //return error
  }

  callback(null);  //success, return the file for socket sending
}

function saveCover(data,path,fileName,callback){
  var fullPath = "./public/"+path;
  if (!fs.existsSync("./public/img/temps")){
    fs.mkdirSync("./public/img/temps");
  }
  var imgData = new Buffer(data, 'binary').toString('base64');
  fs.writeFile(fullPath+"/"+fileName, imgData, 'base64', function (err,data) {
    if (err) {
      callback(err,null);
    }
    callback(null,path+"/"+fileName);
  });

}

/*
fileDownload = function(file,callback){
  var ytdlProcess = youtubedl(File.uri,
    // Optional arguments passed to youtube-dl.
    ['-x'],
    // Additional options can be given for calling `child_process.execFile()`.
    { cwd: __dirname });

  ytdlProcess.pipe(ofs.createWriteStream('./exports/'+session.id+'/'+index+'.mp4'));

  // Will be called when the download starts.
  ytdlProcess.on('info', function (info) {
    ipc.emit('file_event', {event: 'file_download_started', data: index}); // send a status for this file
  });

  ytdlProcess.on('error', function error(err) {
    console.log(err);
    ipc.emit('file_event', {event: 'file_error', data: {index: index, error: err}});
  });

  ytdlProcess.on('end', function() {  // DL ending
    processFileConvert(file,function(err,file){ //convert the mp4 to mp3
      if(err){                        //stop all if error
        return callback(err);
      }
      processFileTag(file,function(err,file){    //tag the given mp3
        if(err){                        //stop all if error
          return callback(err);
        }
        callback(null,file);   //return the final result
      });
    });
    //file downloaded, apply the tags
    ipc.emit("file_event",{event:"file_finished",data:{index:index}});

    clearInterval(progressPing);  //end the filesize ping
  });
}
*/

module.exports = File;
