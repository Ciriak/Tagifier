//
// THIS APP REQUIRE FFMPEG AND liblamemp3  CODEC !!!
//

const electron = require('electron');
const app = electron.app;
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const ipc = electron.ipcMain;
let mainWindow
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 600,
    minWidth: 1024,
    icon: __dirname + '/public/img/tgf/icon_circle.png'
  });
  mainWindow.loadURL(`file://${__dirname}/public/index.html`);

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  });
}
app.on('ready', createWindow);
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

var fs = require('fs-sync');
var ofs = require('fs');  // old fs
var util = require('util');
var port = 80;
var request = require('request');
var id3 = require('node-id3');
var random = require('random-gen');
var os = require('os');
var _ = require('lodash');
var async = require('async');
var bodyParser = require('body-parser');
var fid = require('fast-image-downloader');
var video2mp3 = require('video2mp3');
var sanitize = require("sanitize-filename");
var ffmpeg = require('fluent-ffmpeg');

//File class
var file = require("./tagifier_modules/file.js");
//

var fidOpt = {
  TIMEOUT : 2000, // timeout in ms
  ALLOWED_TYPES : ['jpg', 'png'] // allowed image types
};

//set the ffmpeg binary location (path)
if(os.platform() === 'win32'){
     var ffmpegPath = './bin/ffmpeg/ffmpeg.exe'
 }else{
     var ffmpegPath = './bin/ffmpeg/ffmpeg'
 }
ffmpeg.setFfmpegPath(ffmpegPath);
// create the "exports" folder
var p = "./exports";
if (!ofs.existsSync(p)){
    ofs.mkdirSync(p);
}

// retreive config file
var config = fs.readJSON("config.json");



//
//   FILE ADDED
//

ipc.on('addFile', function (data) {
  console.log("New file added : "+data.uri);
  var f = new file(data.uri,data.external);
  f.retreiveMetaData(function(err,md){
    if(err){
      ipc.emit("file_event",{event:"file_infos_error",data:err});
      return
    }

    //hydrate with the metadada
    for(var d in md) {
      f[d] = md[d];
    };


    ipc.emit("file_event",{event:"file_infos",data:f});
  });
});


//
//  When the client start the process
//

ipc.on('processRequest', function (data) {
  console.log("Starting the process...");

  var session = {
    id : random.alphaNum(4),
    files : data.files
  }
  session.tempPath = "./exports/"+session.id;

  //create the temp session path
  if (!ofs.existsSync(session.tempPath)){
    ofs.mkdirSync(session.tempPath);
  }

  for (var fileIndex = 0; fileIndex < session.files.length; fileIndex++) {
    //add each file to the waiting queue
    AddFileToProcessQueue(session,fileIndex);
  }
});

function processFileDl(session,fileIndex,callback){
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
    file.exportPath = dir+"/"+fileIndex+".mp4";
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

        ipc.emit("yd_event",{event:"progress",data:sinfo});
      }

    },1000);


  });
}

function processFileConvert(file,callback){ //convert the given file from mp4 to mp3
  var mainFormat = '.mp4';
  var newFormat = '.mp3';
  // find the index of last time word was used
  // please note lastIndexOf() is case sensitive
  var n = file.exportPath.toLowerCase().lastIndexOf(mainFormat.toLowerCase());
  var pat = new RegExp(mainFormat, 'i');
  // slice the string in 2, one from the start to the lastIndexOf
  // and then replace the word in the rest
  var mp3ExportPath = file.exportPath.slice(0, n) + file.exportPath.slice(n).replace(pat, newFormat);

  video2mp3.convert(file.exportPath, {mp3path: mp3ExportPath, }, function (err) {
    if (err){
      return callback(err);
    }
    // set the new exportPath
    var vep = file.exportPath;
    file.exportPath = mp3ExportPath;
    file.videoExportPath = vep;
    // confirm converting succes and return the obj with the new exportPath
    callback(null,file);
  });
}

function processFileTag(file,callback){ //tags the given file
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

//Insert a file inside a waiting queue and process it when possible
var waitingList = 0;
var processList = 0;

function AddFileToProcessQueue(session,fileIndex){
  waitingList++;  //increment waiting list count
  var fileQueue = setInterval(function(){   //check every 5 sec if the process can start

    if(processList >= config.max_process){
      return;
    }

    //remove from waiting list and place to process list
    waitingList--;
    processList++;
    clearInterval(fileQueue); //stop the loop

    var f = new file();
    f.hydrate(session.files[fileIndex]);
    f.process(session,fileIndex);
    return;
    processFileDl(session,fileIndex,function(err,data){
      processList--;  // process ended (give a place to the waiting list)
      if(err){
        console.log("--- PROCESSING ERROR ---");
        console.log("(Session "+session.id+" | File "+fileIndex+")");
        console.log(err);
        ipc.emit('yd_event', {event: 'file_error', data: {index: fileIndex, error: err}});
        session.processEnded++;
        if(session.processEnded == session.files.length){ //if all files are converted
          ipc.emit("yd_event",{event:"process_error",data:{err:err}});
        }
        return;
      }
      if(!err){
        //move the downloaded file to it final folder
        moveFile(session,fileIndex,function(err,filePath){
          if(err){
            ipc.emit('yd_event', {event: 'file_error', data: {index: fileIndex, error: err}});
          }
          session.processEnded++;
          if(session.processEnded == session.files.length){ //if all files are converted
            ipc.emit("yd_event",{event:"finished",data:{path:session.path}});
          }
        });
      }
    });
  },1000);
}

function moveFile(session,fileIndex,callback){
  var file = session.files[fileIndex];
  //create the exportDir if not exist yet
  if (!ofs.existsSync(session.path)){
      ofs.mkdirSync(session.path);
  }

  //prevent invalid char inside filename
  var nFileName = sanitize(file.fileName);

  //copy the file , this method prevent a nodejs error with rename
  copyFile(file.exportPath,session.path+"/"+nFileName+".mp3",function(err){
    if(err){
      return callback(err);
    }
    if(ofs.existsSync(file.exportPath)){
      ofs.unlink(file.exportPath);
      callback(null, session.path+"/"+nFileName+".mp3");
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

function copyFile(source, target, cb) {
  var cbCalled = false;

  var rd = ofs.createReadStream(source);
  rd.on("error", function(err) {
    done(err);
  });
  var wr = ofs.createWriteStream(target);
  wr.on("error", function(err) {
    done(err);
  });
  wr.on("close", function(ex) {
    done();
  });
  rd.pipe(wr);

  function done(err) {
    if (!cbCalled) {
      cb(err);
      cbCalled = true;
    }
  }
}

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
