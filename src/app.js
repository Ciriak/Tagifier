const electron = require('electron');
const {app} = require('electron');
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const GhReleases = require('electron-gh-releases');
const commandLineArgs = require('command-line-args');
const ipc = electron.ipcMain;
const ChildProcess = require('child_process');
const path = require('path');
const appFolder = path.resolve(process.execPath, '..');
const rootAtomFolder = path.resolve(appFolder, '..');
const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
const exeName = "Tagifier.exe";
var regedit = require('regedit');
let mainWindow
//retreive package.json properties
var pjson = require('./package.json');


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
var sanitize = require("sanitize-filename");
var ws = require('windows-shortcuts');

//File class
var File = require(__dirname+"/file.js");

console.log("Tagifier V."+pjson.version);

//define the possible command line args
const optionDefinitions = [
  { name: 'files', type: String, multiple: true, defaultOption: true },
  { name: 'squirrel-updated' }
];


  //Define updater options
  let options = {
    repo: 'Cyriaqu3/Tagifier',
    currentVersion: pjson.version
  }
  const updater = new GhReleases(options);

//parse the launch options
var argsOptions = commandLineArgs(optionDefinitions);

singleInstanceChecker();


// Hook the squirrel update events
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];

  var exePath = app.getPath("exe");
  var lnkPath = ["%APPDATA%/Microsoft/Windows/Start Menu/Programs/Tagifier.lnk",
  "%UserProfile%/Desktop/Tagifier.lnk"];

  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      //write in the registry if windows OS
      if(process.platform === 'win32') {
        registerRegistry();
      }

      // Install desktop and start menu shortcuts


      //create windows shortcuts
      if(process.platform === 'win32') {
        for (var i = 0; i < lnkPath.length; i++) {
          ws.create(lnkPath[i], {
              target : exePath,
              desc : pjson.description
          });
        }
      }
      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers
      spawnUpdate(['--removeShortcut', exeName]);

      // Remove desktop and start menu shortcuts
      if(process.platform === 'win32') {
        for (var i = 0; i < lnkPath.length; i++) {
          ofs.access(lnkPath[i], ofs.F_OK, function(err) {
              if (!err) {
                ofs.unlink(lnkPath[i]);
              }
          });
        }
      }

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
};

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});



app.on('ready', () => {
  openApp();

  //write in the registry if windows OS
  if(process.platform === 'win32') {
    registerRegistry();
  }
  registerProtocol();
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    openApp();
  }
});

//open the tagifier main process
function openApp(){
  var mainWindow = new BrowserWindow({
    show:false,
    width: 1024,
    height: 600,
    minWidth: 1024,
    icon: __dirname + '/web/img/tgf/icon_circle.png'
  });
  mainWindow.loadURL(`file://${__dirname}/web/index.html`);
  //display the main app and close the
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    checkArgsOptions(argsOptions);
    checkUpdates();
  });
}

var fidOpt = {
  TIMEOUT : 2000, // timeout in ms
  ALLOWED_TYPES : ['jpg', 'png'] // allowed image types
};

// create the "exports" folder
var p = __dirname+"/exports";
if (!ofs.existsSync(p)){
    ofs.mkdirSync(p);
}

//check if some files were defined at the app launch and automaticly add them
function checkArgsOptions(arguments){
  console.log("Checking given launch arguments...");
  if(arguments.files){
    for (var i = 0; i < arguments.files.length; i++) {
      console.log("Adding a file from "+arguments.files[i]);
      var f = {uri : arguments.files[i]};
      if(path.extname(f.uri) === ".mp3"){
        addFile(f);
      }
      else{
        console.log("The file is not a mp3 file !");
      }
    }
  }
  else{
    console.log("... none");
  }
}

function checkUpdates(){

  // Check for updates
  // `status` returns true if there is a new update available
  console.log("Looking for update");
  updater.check((err, status) => {
    if(err){
      console.log("No new version / unable to check");
      console.log("details :");
      console.log(err);
    }
    //update available
    else{
      // Download the update
      updater.download();
    }
  });

  // When an update has been downloaded
  updater.on('update-downloaded', (info) => {
    console.log(info);
    ipc.emit("updateAvailable", info);
    // Restart the app and install the update
    //updater.install()
  })

  // Access electrons autoUpdater
  //updater.autoUpdater
}

//
ipc.on('installUpdate', function (fileData) {
  updater.install();
});

//
//   FILE ADDED
//

ipc.on('addFile', function (fileData) {
  addFile(fileData);
});

function addFile(fileData){
  console.log("New file added : "+fileData.uri);
  var file = new File();

  //hydrating the File object
  var k =  Object.keys(fileData);

  for(var i=0, len = k.length; i<len; i++){
      file[k[i]] = fileData[k[i]];
      console.log(k[i]+" = "+fileData[k[i]]);
  }

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
}

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

  session.tempPath = __dirname+"/exports/"+session.id;

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

    if(processList >= 3){
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

//add contexttual menu inside the windows registry
function registerRegistry(){
  var progId;
  regedit.list('HKCU\\SOFTWARE\\Classes\\.mp3', function (err, result) {
    if(err){
      console.log(err);
    }
    progId = result['HKCU\\SOFTWARE\\Classes\\.mp3'].values[''].value;
    var newKeysList = ['HKCU\\SOFTWARE\\Classes\\*\\shell\\Tagifier',
    'HKCU\\SOFTWARE\\Classes\\*\\shell\\Tagifier\\command'];

    regedit.createKey(newKeysList, function(err) {
      if(err){
        console.log(err);
      }else{
        console.log("Registry keys created / updated");
      }
    });

    var exePath = app.getPath("exe");
    var appPath = app.getAppPath();
    console.log("Process exec path = ");
    console.log(exePath);

    var valuesToPut = {
        [newKeysList[0]]: {
            'uselessname': {
                value: 'Open with Tagifier',
                type: 'REG_DEFAULT'
            },
            'icon': {
                value: '"'+appPath+'\\web\\img\\tgf\\icon_circle.ico"',
                type: 'REG_SZ'
            },
            'AppliesTo': {
                value: '.mp3',
                type: 'REG_SZ'
            }
        },
        [newKeysList[1]]: {
            'uselessname': {
                value: '"'+exePath+'" --files "%1"',
                type: 'REG_DEFAULT'
            }
        },
        'HKCU\\Software\\Classes\\.mp3': {
            'uselessname': {
                value: progId,
                type: 'REG_DEFAULT'
            }
        }
    }

    regedit.putValue(valuesToPut, function(err) {
      if(err){
        console.log(err);
      }
    });

  });
}

function singleInstanceChecker(){
  //check if another instance exist
  // if exist, send it the command line arguments and focus the window
  const shouldQuit = app.makeSingleInstance((args, workingDirectory) => {
    var parsedArgs = commandLineArgs(optionDefinitions, args);
    checkArgsOptions(parsedArgs);
    if (mainWindow) {
      if (mainWindow.isMinimized()){
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  if (shouldQuit) {
    app.quit();
    return;
  }
}

function registerProtocol(){
  const {protocol} = require('electron');
  protocol.registerFileProtocol('tagifier', (request, callback) => {
    console.log(request);
    const url = request.url.substr(7);
    callback({path: path.normalize(__dirname + '/' + url)});
  }, (error) => {
    if (error)
      console.error('Failed to register protocol');
  });
}



rmDir(__dirname+'/web/img/temps',false);
rmDir(__dirname+'/exports',false);
console.log("Temp files cleaned");
