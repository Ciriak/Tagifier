const electron = require('electron');
const app = electron.app;
const ipc = electron.ipcMain;
var ID3Writer = require('browser-id3-writer');
var id3Parser = require("id3-parser");
var path = require('path');
var fs = require('fs');
var fileExists = require('file-exists');
var random = require('random-gen');
var request = require('request');

function File() {
  this.id = random.alphaNum(8);
  this.filename = "tagifier.mp3";
  this.title = "";
  this.artist = "";
  this.composer = "";
  this.album = "";
  this.year = "";
};


// retreive informations for the file and return them
fileRetreiveMetaData = function(file,callback) {
  if(!file.uri){
    callback("Invalid uri",null);
    return;
  }
  if(!fileExists(file.uri)){
    callback("File does not exist",null);
    return;
  }
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
              console.log(err);
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

  var coverBuffer = "";
  var songBuffer = fs.readFileSync(file.uri);
  var writer = new ID3Writer(songBuffer);

  setCover(file, writer, function(err){
    if(err){
      console.log(err);
    }
    writer.setFrame('TIT2', String(file.title))
        .setFrame('TPE1', [String(file.artist)])
        .setFrame('TPE2', String(file.artist))
        .setFrame('TALB', String(file.album))
        .setFrame('TYER', String(file.year))
    writer.addTag();

    var taggedSongBuffer = new Buffer(writer.arrayBuffer);
    fs.writeFileSync(file.uri, taggedSongBuffer);

    callback(null);  //success, return the file for socket sending
  });
}

function saveCover(data,path,fileName,callback){
  var fullPath = __dirname+"/web/"+path;
  console.log("Saving the cover to "+fullPath);
  if (!fs.existsSync(__dirname+"/web/img/temps")){
    console.log("Creating the temps folder...");
    fs.mkdirSync(__dirname+"/web/img/temps");
  }
  var imgData = new Buffer(data, 'binary').toString('base64');
  fs.writeFile(fullPath+"/"+fileName, imgData, 'base64', function (err,data) {
    if (err) {
      callback(err,null);
    }
    callback(null,fullPath+"/"+fileName);
  });

}

function setCover(file, writer, callback){
  var isUrl = false;
  var imgPath = file.pictureUri;

  //check if the cover is an external file
  if(imgPath.substring(0,4) === "http"){
    isUrl = true;
  }
  console.log("Cover image uri :");
  console.log(imgPath);

  //write cover only if updated
  if(fileExists(imgPath) && !isUrl){
    var coverBuffer = fs.readFileSync(imgPath);
    console.log("Updating cover from "+imgPath+" ...");
    writer.setFrame('APIC', coverBuffer);
    console.log("...done !");
    callback(null);
  }
  if(isUrl){
    console.log("Updating cover from "+imgPath+" ...");
    request({url: imgPath, encoding:null}, function (error, response, body) {
      if(error){
        callback(error);
      }
      var tid = random.alphaNum(8);
      console.log("Updating cover from "+imgPath);
      saveCover(body, "img/temps", tid+".jpg", function(err,path){
          if(err){
            callback(err);
          }
          fs.readFile(path, (err, data) => {
            if(err){
              callback(err);
            }
            writer.setFrame('APIC', data);
            callback(null);
          });
      });
    });
  }
}

module.exports = File;
