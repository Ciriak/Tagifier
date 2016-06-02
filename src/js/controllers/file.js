app.controller('fileCtrl', function($scope, $rootScope,$state,$http,$stateParams,$translate,$location,notify,dialog,ipcRenderer,shell)
{
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.singleFile = true;
	$scope.files = {};
	$scope.fileReady = false;
	$scope.currentFileIndex = 0;
	$scope.exportFiles = [];
	$scope.progress = 0;
	$scope.filePlayer;
	$scope.canRemoveFile = false;
	$scope.playerStatus = "stop";
	$scope.exportDir;
	var date = new Date();

	$scope.addFile = function(uri,external){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		$scope.fileAvailable = false;
		$scope.canAddFile = false;

		//check if the file is already in the list

		var c = _.findIndex($scope.exportFiles, { 'uri': uri});
		if(c == -1){
			$scope.ipc.emit("addFile",{uri : uri, external : external});
		}
		else{
			console.log("File already added");
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			$scope.fileAvailable = true;
			$scope.canAddFile = true;
		}
	};

	var parseFileData = function(data){
		var index = $scope.exportFiles.length;
		if(index > 0){
			$scope.canRemoveFile = true;	// they will be more than 1 file so the user can remove them from thhe list
			$scope.singleFile = false;
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}

		$scope.exportFiles[index] = {
			lockedAttrs : [],
			converting : false,
			processing : false,
			error : false,
			progress : 0
		};

		for(var attr in data){
			$scope.exportFiles[index][attr] = data[attr];
		}

		$scope.exportFiles[index].fulltitle = $scope.exportFiles[index].filename.replace(".mp3","");

		if(!$scope.exportFiles[index].pictureUri){
			$scope.exportFiles[index].pictureUri = "./img/default_cover.png";
		}

		//set release year if defined, else current year
		$scope.exportFiles[index].year = date.getFullYear();
		if(data.upload_date){
			$scope.exportFiles[index].year = data.upload_date.substr(0,4);
		}
		//

		$scope.exportFiles[index].track = index+1;

		//Define the pattern, depending of the file name format
		var pt = "";
		if($scope.exportFiles[index].fulltitle){
			pt = $scope.exportFiles[index].fulltitle.split(" - ");
		}

		if(pt.length > 1){
			$scope.exportFiles[index].tagPattern = "%artist% - %title%";
			$scope.exportFiles[index].fileNamePattern = "%artist% - %title%";

			if(!$scope.singleFile){		//if this is an album, set the track as first word
				$scope.exportFiles[index].tagPattern = "%album% - %title%";
				$scope.exportFiles[index].fileNamePattern = "%track% - %title%";
			}

		}
		else{
			$scope.exportFiles[index].tagPattern = "%title%";
			$scope.exportFiles[index].fileNamePattern = "%title%";
			// in this case, we set the Uploader as the "artist"
			if(data.uploader){
				$scope.exportFiles[index].artist = data.uploader;
			}
		}

	};

	$scope.retreiveInfoError = function(){
		notify($translate.instant("error.unableToRetreiveFileData"));
		if($scope.exportFiles.length == 1){	// if only one file, return to the main page
			$state.go('^.main');
		}
	};

	$scope.removeFileFromList = function(file){
		if(!$scope.canRemoveFile){
			console.log("You are trying to remove a file from the list... but it seem you cant !");
			return;
		}
		var index = $scope.exportFiles.indexOf(file);
		$scope.exportFiles.splice(index, 1);

		if($scope.exportFiles.length < 2){
			$scope.singleFile = true;
			$scope.canRemoveFile = false;		//only 1 file in the list , cannnot remove files
		}
		if(fileIndex > 0){
			$scope.setCurrentFile(fileIndex-1);
		}
		else{
			$scope.setCurrentFile(0);
		}

		if(!$scope.$$phase) {
			$scope.$apply();
		}
	};

	$scope.reloadPage = function(){
		location.reload();
	};

	$scope.requestProcess = function(){
		if($scope.processing){
			return;
		}
		$scope.fileReady = false;
		$scope.processing = true;
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		$scope.canRemoveFile = false;
		$scope.ipc.emit("processRequest",{files:$scope.exportFiles});
	};

	$scope.setCurrentFile = function(i){
		$scope.currentFileIndex = i;
		$scope.filePlayer.pause();	//stop the audio player if playing
		$scope.playerStatus = "stop";
	};

	$scope.ipc.on("file_event",function(ev){
		console.log("Event - "+ev["event"]);
		console.log(ev.data);

		if(ev["event"] == "file_infos"){
			parseFileData(ev.data);
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			$scope.fileAvailable = true;
			$scope.canAddFile = true;
		}

		if(ev['event'] == "file_infos_error"){
			$scope.retreiveInfoError(ev.data);
		}

		if(ev["event"] == "file_download_started"){
			$scope.fileReady = false;
			var index = ev.data;
			$scope.exportFiles[index].processing = true;
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}

		if(ev["event"] == "progress"){
			$scope.fileReady = false;
			var data = ev.data;
			var perc = data.size/$scope.exportFiles[data.index].filesize*100;
			if(perc == 100){
				$scope.exportFiles[data.index].converting = true;
				if(!$scope.$$phase) {
					$scope.$apply();
				}
			}
			$scope.exportFiles[data.index].progress = perc;
		}
		if(ev["event"] == "file_error"){
			$scope.fileReady = false;
			$scope.exportFiles[ev.index].error = ev.err;
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}
		if(ev["event"] == "process_error"){
			$scope.fileReady = true;

			for (var i = 0; i < $scope.exportFiles.length; i++) {
				$scope.exportFiles[i].progress = 0;
				$scope.exportFiles[i].converting = false;
				$scope.exportFiles[i].processing = false;
				$scope.exportFiles[i].error = true;
			}

			$scope.processing = false;
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			$scope.canRemoveFile = true;
			$scope.canAddFile = true;
		}
		if(ev["event"] == "file_finished"){
				$scope.fileReady = false;
				var i = ev.index;
				$scope.exportFiles[i].progress = 100;
				$scope.exportFiles[i].converting = true;
				if(!$scope.$$phase) {
					$scope.$apply();
				}
		}
		if(ev["event"] == "finished"){

				$scope.fileReady = true;

				$scope.notifyProcessEnded(ev.err);

				for (var i = 0; i < $scope.exportFiles.length; i++) {
					$scope.exportFiles[i].progress = 0;
					$scope.exportFiles[i].converting = false;
					$scope.exportFiles[i].processing = false;
				}

				$scope.processing = false;
				$scope.canEditTags = false;
				$scope.canStartProcess = false;
				$scope.canRemoveFile = false;
				$scope.canAddFile = false;
		}

		if(!$scope.$$phase) {
			$scope.$apply();
		}
	});

	$scope.overrideProp = function(propName,sourceIndex,isPattern){
		for (var file in  $scope.exportFiles) {
			var targetIndex = parseInt(file);
			// apply the new defined tag to all files
			if(sourceIndex != file && !$scope.propIsLocked(propName,targetIndex)){
				$scope.exportFiles[targetIndex][propName] = $scope.exportFiles[sourceIndex][propName];
				setAnimation("tag-updated",$(".file-"+targetIndex));
			}
			if(sourceIndex != file && $scope.propIsLocked(propName,targetIndex)){	//different animation if the tag is locked for this track
				setAnimation("tag-locked",$(".file-"+targetIndex));
			}

			if(isPattern){	//regen the patern if it has been changed
				$scope.genPattern(targetIndex);
			}

		}
		console.log('The tag "'+$scope.exportFiles[sourceIndex][propName]+'" ('+propName+') from the track '+sourceIndex+' has been applyed to all tracks');
	};

	$scope.togglePropLock = function(propName,sourceIndex){
		if(isInArray(propName,$scope.exportFiles[sourceIndex].lockedAttrs)){
			//remove the attr from array
			var index = $scope.exportFiles[sourceIndex].lockedAttrs.indexOf(propName);
			$scope.exportFiles[sourceIndex].lockedAttrs.splice(index, 1);
		}
		else {
			$scope.exportFiles[sourceIndex].lockedAttrs.push(propName);
		}
	}

	$scope.propIsLocked = function(propName,sourceIndex){
		if(!$scope.exportFiles[sourceIndex]){
			return false;
		}
		if(isInArray(propName,$scope.exportFiles[sourceIndex].lockedAttrs)){
			return true;
		}
		else{
			return false;
		}
	}

	$scope.genPattern = function(index){

		console.log("Generating pattern for "+$scope.exportFiles[index].filename+"...");
		var fileData = $scope.exportFiles[index];
		var pattern = fileData.tagPattern.replace(/%([a-zA-Z0-9])\w+%/g, '(.*)');
		var fileVars = fileData.tagPattern.match(/%([a-zA-Z0-9])\w+%/g);

		for (var i = 0; i < fileVars.length; i++)
		{
			fileVars[i] = fileVars[i].replace("%","").replace("%",""); //remove %x%
		};

		//Find tags inside the filename
		if($scope.exportFiles[index].filename){
			var extrData = $scope.exportFiles[index].filename.match(new RegExp(pattern));
		}
		if(!extrData)
		{
			return;
		}

		for (var i = 0; i <fileVars.length; i++)
		{
			if(extrData[i+1])	//apply tag if prop exist
			{
				fileData[fileVars[i]] = extrData[i+1];
			}
		};

		$scope.getDynamicHeight = function(elem){
			var w = $("."+elem).width();
			return w;
		}

		//generate the fileName (based on the fileName pattern)
		if(!fileData.fileNamePattern){	//if no pattern defined set %artist - %title% model
			fileData.fileName = fileData.artist+" - "+fileData.title;
			return;
		}

		var fileVars = fileData.fileNamePattern.match(/%([a-zA-Z0-9])\w+%/g);
		var altFileVars = [];

		var fnp = fileData.fileNamePattern;	//avoid to replace the in-view tag
		for (var i = 0; i < fileVars.length; i++)
		{
			var tag = fileVars[i].replace("%","").replace("%","");  //remove %x%
			fnp = fnp.replace(fileVars[i],fileData[tag]);	//%x% -> file.x
		};
		fileData.fileName = fnp;

	};

	$scope.togglePlayer = function(){
		$scope.filePlayer = document.getElementById("file-player");
		if($scope.filePlayer.paused){
			$scope.filePlayer.play();
			$scope.playerStatus = "play";
		}
		else{
			$scope.filePlayer.pause();
			$scope.playerStatus = "pause";
		}

	}

	$scope.setExportPath = function(fileIndex){
		var exportPath = dialog.showOpenDialog({properties: ['openDirectory','createDirectory']});
		if(exportPath){
			$scope.exportFiles[fileIndex].exportPath = exportPath[0];
		}
	}

	$scope.showAddFileModal = function(){
		//$('#add-file-modal').modal('show');
		var fileUri = dialog.showOpenDialog({properties: ['openFile','multiSelections'],filters: [
	    {name: 'Mp3', extensions: ['mp3']}
	  ]});
		if(fileUri){
			console.log(fileUri);
			for (var i = 0; i < fileUri.length; i++) {
				$scope.addFile(fileUri[i],false);
			}
		}
	}

	$scope.hideAddFileModal = function(){
		$('#add-file-modal').modal('hide');
	}

	$scope.openDir = function(path,pathExplore){
		if(pathExplore){
			shell.showItemInFolder(path);
		}
		else{
			shell.openItem(path);
		}
	}

	$scope.notifyProcessEnded = function(errorAppend){
		var notification;
		var body = "Your file(s) are ready";
		if(errorAppend){
			body = "Some errors occurred during the process";
		}

		var nOptions = {
			title : "Proces finished",
		    body: body,
		    icon: "img/tgf/icon_circle.png"
		}

		if (Notification.permission === "granted" && !$scope.notified) {
			$scope.notified = true;
			var notification = new Notification(nOptions.title,nOptions);
			notification.onclick = function() {
				notification.close();
			};
		}
	};
});

var YTDurationToSeconds = function(duration) {
  var match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

  var hours = (parseInt(match[1]) || 0);
  var minutes = (parseInt(match[2]) || 0);
  var seconds = (parseInt(match[3]) || 0);

  return hours * 3600 + minutes * 60 + seconds;
}

var getBestThumbnail = function(t){
	if(t.maxres){
		return t.maxres.url;
	}
	if(t.high){
		return t.high.url;
	}
	if(t.medium){
		return t.medium.url;
	}
	if(t.standard){
		return t.standard.url;
	}
	else{
		return "";
	}
};

var isInArray = function (value, array) {
  return array.indexOf(value) > -1;
}

var setAnimation = function(animation,target){
	target.addClass(animation);

	setTimeout(function () {
	    target.removeClass(animation);
	}, 500);
};
