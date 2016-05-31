const electron = require('electron');
const ipc = electron.ipcMain;
var youtubedl = require('youtube-dl');
var id3 = require('node-id3');
var jsmediatags = require("jsmediatags");
var path = require('path');
var fs = require('fs');

function file(uri,external) {
  this.uri = uri;           //path to the file (absolute or relative)
  this.external = external; //is the file a local one ?
  this.metadata = {};       //metadata added by Youtube DL OR node_id3
  this.filename = "tagifier.mp3";
  this.hydrate = function(data){
      Object.keys(data).forEach(function(key){
          this[key] = data[key];
      });
  };
};


// retreive informations for the file and return them
file.prototype.retreiveMetaData = function retreiveMetaData(callback) {
  if(this.external){
    youtubedl.getInfo(this.uri, "", function(err, metadatas) {
      if (err) {
        return callback(err,"");
      }
      callback(null,metadatas);
    });
  }
  else{
    this.filename = path.basename(this.uri);
    jsmediatags.read(this.uri, {
      onSuccess: function(data) {
        //if img exist, write it
        if(data.tags.APIC){

        }
        callback(null,data.tags);
      },
      onError: function(error) {
        console.log(error);
        callback(error,null);
      }
    });
  }
};

file.prototype.process = function process(session,index){
  //dl with YoutubeDL if external
  if(this.external === true){
    console.log("Downloading the file...");
    this.download(function(err){
      console.log("Downloaded");
    });
  }
  else{
    console.log("Copy the file");
  }
}

file.prototype.download = function download(callback){
  var ytdlProcess = youtubedl(file.uri,
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

module.exports = file;
