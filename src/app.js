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
    icon: __dirname + '/web/img/tgf/icon_circle.png'
  });
  mainWindow.loadURL(`file://${__dirname}/web/index.html`);

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
var path = require('path');
var sanitize = require("sanitize-filename");
var ffmpeg = require('fluent-ffmpeg');

//File class
var File = require("./file.js");
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

ipc.on('addFile', function (fileData) {
  console.log("New file added : "+fileData.uri);
  var file = new File();

  //hydrating the File object
  var k =  Object.keys(fileData);

  for(var i=0, len = k.length; i<len; i++){
      file[k[i]] = fileData[k[i]];
      console.log(k[i]+" = "+fileData[k[i]]);
  }

  console.log(file);

  fileRetreiveMetaData(file, function(err,md){
    if(err){
      console.log(err);
      ipc.emit("file_event",{event:"file_infos_error",data:err});
      return
    }

    //hydrate with the metadada
    for(var d in md) {
      file[d] = md[d];
    };

    if(!file.exportPath && file.uri){
      file.exportPath = path.dirname(file.uri);
    }

    ipc.emit("file_event",{event:"file_infos",data:file});
  });
});


//
//  When the client start the process
//

ipc.on('processRequest', function (data) {
  console.log("Process request by from the client");

  var session = {
    id : random.alphaNum(4),
    files : []
  }

  for (var i = 0; i < data.files.length; i++) {
    var file = new File();
    //hydrate with the metadada
    for(var d in data.files[i]) {
      file[d] = data.files[i][d];
    };

    if(!file.exportPath && file.uri){
      file.exportPath = path.dirname(file.uri);
    }

    session.files.push(file);
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

//Insert a file inside a waiting queue and process it when possible
var waitingList = 0;
var processList = 0;
var errorDuringProcess = false;

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

    fileProcess(session.files[fileIndex],function(err){
      if(err){
        console.log("ERROR while processing File "+fileIndex);
        console.log('"'+err+'"');
        //return the error to the client
        ipc.emit('file_event', {event: 'file_error', err: err, index:fileIndex});
        errorDuringProcess = true;
      }
      else{
        //return the file finished signal to the client
        console.log("File "+fileIndex+" finished");
        ipc.emit('file_event', {event: 'file_finished', index:fileIndex});
      }
      processList--;

      //if everything is finished
      if(waitingList === 0){
        console.log("Process finished");
        ipc.emit('file_event', {event: 'finished',err : errorDuringProcess});
      }

      return;
    });
    return;
  },1000);
}

function moveFile(session,fileIndex,callback){
  var file = session.files[fileIndex];
  //create the exportDir if not exist yet
  if (!ofs.existsSync(session.path)){
      ofs.mkdirSync(session.path);
  }

  //prevent invalid char inside filename
  var nFileName = sanitize(File.fileName);

  //copy the file , this method prevent a nodejs error with rename
  copyFile(File.exportPath,session.path+"/"+nFileName+".mp3",function(err){
    if(err){
      return callback(err);
    }
    if(ofs.existsSync(File.exportPath)){
      ofs.unlink(File.exportPath);
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



rmDir('./web/img/temps',false);
rmDir('./exports',false);
console.log("Temp files cleaned");
