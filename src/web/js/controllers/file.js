app.controller('fileCtrl', function($scope, $rootScope, $http, $translate, $location, dialog, ipcRenderer, shell, ngAudio) {
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.singleFile = true;
	$scope.files = {};
	$scope.ady = false;
	$scope.currentFileIndex = 0;
	$scope.exportFiles = [];
	$scope.progress = 0;
	$scope.filePlayer = {};
	$scope.playerStatus = "stop";
	$scope.playingFileIndex = null;
	$scope.exportDir;
	var date = new Date();

	ngAudio.setUnlock( false );

	$scope.addFile = function(uri,external){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		$scope.fileAvailable = false;
		$scope.canAddFile = false;

		//check if the file is already in the list

		var c = _.findIndex($scope.exportFiles, { 'uri': uri});
		if(c == -1){
			$scope.ipc.emit("addFile",{uri : uri, external : external});
			$scope.setCurrentFile($scope.exportFiles.length);
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
			var x = "./img/default_cover.png";
			$scope.exportFiles[index].pictureUri = x;
			$scope.exportFiles[index].originalPictureUri = x;
		}
		else{
			$scope.exportFiles[index].originalPictureUri = angular.copy($scope.exportFiles[index].pictureUri);
		}


		//set release year if defined, else current year
		if(!data.year){
			$scope.exportFiles[index].year = date.getFullYear();
			if(data.upload_date){
				$scope.exportFiles[index].year = data.upload_date.substr(0,4);
			}
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

		$scope.retreiveSuggestions(index);
	};

	$scope.retreiveSuggestions = function(fileIndex){
		$scope.canEditTags = false;
		// try to retreive info from musicbrainz API

		//Ex : http://musicbrainz.org/ws/2/recording/?query="Spider Dance"artist:"Toby fox"album&fmt=json

		// build the query URL
		var qUrl = "http://musicbrainz.org/ws/2/recording/?fmt=json&query=";
		if($scope.exportFiles[fileIndex].title != ""){
			qUrl = qUrl+'title:"'+encodeURIComponent($scope.exportFiles[fileIndex].title)+'"';
		}

		if($scope.exportFiles[fileIndex].artist != ""){
			qUrl = qUrl+'artist:"'+encodeURIComponent($scope.exportFiles[fileIndex].artist)+'"';
		}

		if($scope.exportFiles[fileIndex].album != ""){
			qUrl = qUrl+'album:"'+encodeURIComponent($scope.exportFiles[fileIndex].album)+'"';
		}

		$http({
		  method: 'GET',
		  url: qUrl
		}).then(function(response) {
			//try to retreive the covers
			$scope.exportFiles[fileIndex].suggestions = parseSuggestions(response.data.recordings);
			$scope.retreiveSuggestionCovers(fileIndex, response.data.recordings);
		});
	}

	$scope.removeFileFromList = function(file){
		var fileIndex = _.indexOf($scope.exportFiles,file);
		if(fileIndex <= -1){
			return;
		}
		$scope.exportFiles.splice(fileIndex, 1);

		//If their is only one file remaining
		if($scope.exportFiles.length == 1){
			$scope.singleFile = true;
		}
		// if their is no file on the list
		if($scope.exportFiles.length == 0){
			$scope.canStartProcess = false;
			$scope.canEditTags = false;
			$scope.fileAvailable = false;
		}
		if(fileIndex > 0){
			$scope.setCurrentFile(fileIndex-1);
		}
		else{
			$scope.setCurrentFile(0);
		}

		//if the "player file" is the removed one
		if(fileIndex === $scope.playingFileIndex){
			$scope.filePlayer.audio.pause();
			$scope.playingFileIndex = null;
		}

		if(!$scope.$$phase) {
			$scope.$apply();
		}
	};

	$scope.removeAllFiles = function(){
		$scope.currentFileIndex = null;
		$scope.exportFiles = [];
		$scope.canStartProcess = false;
		$scope.canEditTags = false;
		$scope.fileAvailable = false;
		$scope.filePlayer.audio.pause();
		$scope.playingFileIndex = null;
	}

	$scope.reloadPage = function(){
		location.reload();
	};

	//start process when "Enter key" is pressed
	$(window).bind('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
      switch (String.fromCharCode(event.which).toLowerCase()) {
      case 's':
	      event.preventDefault();
	      $scope.requestProcess();
	      break;
      }
	  }
	});

	$scope.requestProcess = function(){
		if($scope.processing || !$scope.canStartProcess){
			return;
		}

		$scope.processing = true;
		$scope.canEditTags = false;
		$scope.canStartProcess = false;

		if(!$scope.$$phase) {
			$scope.$apply();
		}

		$scope.ipc.emit("processRequest",{files:$scope.exportFiles});
	};

	$scope.setCurrentFile = function(i){
		$scope.currentFileIndex = i;
	};

	$scope.ipc.on("file_event",function(ev){
		console.log("Event - "+ev["event"]);
		console.log(ev);


		if(ev["event"] == "file_infos"){
			parseFileData(ev.data);
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			$scope.fileAvailable = true;
			$scope.canAddFile = true;
		}

		if(ev["event"] == "progress"){

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

			$scope.exportFiles[ev.index].error = ev.err;
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}
		if(ev["event"] == "process_error"){


			for (var i = 0; i < $scope.exportFiles.length; i++) {
				$scope.exportFiles[i].progress = 0;
				$scope.exportFiles[i].converting = false;
				$scope.exportFiles[i].processing = false;
				$scope.exportFiles[i].error = true;
			}

			$scope.processing = false;
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
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

				$scope.notifyProcessEnded(ev.err);

				for (var i = 0; i < $scope.exportFiles.length; i++) {
					$scope.exportFiles[i].progress = 0;
					$scope.exportFiles[i].converting = false;
					$scope.exportFiles[i].processing = false;
				}

				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
				$scope.canAddFile = true;
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

	$scope.togglePlayer = function(index){

		if($scope.playingFileIndex !== index){
			$scope.playingFileIndex = index;
			if($scope.filePlayer.audio){
				$scope.filePlayer.audio.pause();
			}
			$scope.filePlayer = ngAudio.load($scope.exportFiles[index].uri);
			$scope.filePlayer.play();
			$scope.playerStatus = "play";
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}
		else{
			if($scope.filePlayer.paused){
				$scope.filePlayer.play();
				$scope.playerStatus = "play";
			}
			else{
				$scope.filePlayer.pause();
				$scope.playerStatus = "pause";
			}
		}
	};

	var lastSavedVol = 1;
	$scope.togglePlayerMute = function(){
		if($scope.filePlayer.muting){
			$scope.filePlayer.muting = false;
		}
		else{
			$scope.filePlayer.muting = true;
		}
	};

	$scope.togglePlayerRepeat = function(){
		if($scope.filePlayer.loop === true){
			$scope.filePlayer.loop = 0;
		}
		else{
			$scope.filePlayer.loop = true;
		}
	}

	$scope.setExportPath = function(fileIndex){
		var exportPath = dialog.showOpenDialog({properties: ['openDirectory','createDirectory']});
		if(exportPath){
			$scope.exportFiles[fileIndex].exportPath = exportPath[0];
		}
	}

	$scope.setCoverImage = function(fileIndex){
		var coverPath = dialog.showOpenDialog({properties: ['openFile'],filters: [
    {name: 'Images', extensions: ['jpg', 'png', 'gif']}]});
		if(coverPath){
			$scope.exportFiles[fileIndex].pictureUri = coverPath[0];
		}
	}

	$scope.showAddFileModal = function(){
		//$('#add-file-modal').modal('show');
		var fileUri = dialog.showOpenDialog({properties: ['openFile','multiSelections'],filters: [
	    {name: 'Mp3', extensions: ['mp3']}
	  ]});
		if(fileUri){
			for (var i = 0; i < fileUri.length; i++) {
				$scope.addFile(fileUri[i],false);
			}
		}
	}

	$scope.hideAddFileModal = function(){
		$('#add-file-modal').modal('hide');
	}

	//open the file folder or play it
	$scope.openDir = function(path,pathExplore){
		if(!$scope.canEditTags){
			return;
		}

		if(pathExplore){
			$rootScope.remote.shell.showItemInFolder(path);
		}
		else{
			$rootScope.remote.shell.openItem(path);
			//pause the player if playing the file
			$scope.filePlayer.audio.pause();
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

	//try to retreive some cover suggestions
	$scope.retreiveSuggestionCovers = function(fileIndex, recordings){
		$scope.exportFiles[fileIndex].suggestions.covers = [];
		var sc = $scope.exportFiles[fileIndex].suggestions.covers;

		for (var i = 0; i < recordings.length; i++) {
			var qUrl = "http://coverartarchive.org/release/%/front";
			if(recordings[i]["releases"]){
				var id = recordings[i]["releases"][0].id;
				qUrl = qUrl.replace("%", id);
				$http({
				  method: 'GET',
				  url: qUrl
				}).then(function successCallback(response) {
					//add the cover to the url list
					if(_.indexOf(sc, response.config.url) === -1 && sc.length <= 6){
						sc.push(response.config.url);
					}
							$scope.canEditTags = true;
				});
			}
		}
	}

	$scope.setCover = function(fileId, pictureUri){
		$scope.exportFiles[fileId].pictureUri = pictureUri;
		console.log(pictureUri);
	}


	//use arrow keys to select file
	document.onkeydown = checkKey;
	function checkKey(e) {

	    e = e || window.event;

			//up
	    if (e.keyCode == '38') {
	      if($scope.currentFileIndex > 0){
					$scope.currentFileIndex--;
				}
	    }
			//down
	    else if (e.keyCode == '40') {
				if($scope.currentFileIndex < $scope.exportFiles.length-1){
					$scope.currentFileIndex++;
				}
	    }
			if(!$scope.$$phase) {
				$scope.$apply();
			}
	}

});

// parse the suggested tags (prevent the duplicates values)
var parseSuggestions = function(recordings){
	var r = {
		artists: [],
		tracks: [],
		albums: [],
		years: [],
		titles: []
	};

	for (var i = 0; i < recordings.length; i++) {

		//Title tag
		if(recordings[i]["title"]){
			var av = recordings[i]["title"];
			if(_.indexOf(r.titles, av) === -1 && av !== "" && av !== 0 && av !== "NaN" && r.titles.length <= 7){
				r.titles.push(av);
			}
		}

		//album tag
		if(recordings[i]["releases"]){
			var av = recordings[i]["releases"][0].title;
			if(_.indexOf(r.albums, av) === -1 && av !== "" && av !== 0 && av !== "NaN" && r.albums.length <= 7){
				r.albums.push(av);
			}
		}

		//Artist tag
		if(recordings[i]["artist-credit"]){
			var av = recordings[i]["artist-credit"][0].artist.name;
			if(_.indexOf(r.artists, av) === -1 && av !== "" && av !== 0 && av !== "NaN" && r.artists.length <= 7){
				r.artists.push(av);
			}
		}

		//year tag
		if(recordings[i]["releases"]){
			var d = new Date(recordings[i]["releases"][0].date);
			var av = d.getFullYear();
			if(_.indexOf(r.years, av) === -1 && av !== "" && av !== 0 && av !== "NaN" && r.years.length <= 7){
				r.years.push(av);
			}
		}

	}

	//return the suggestions list
	return r;
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
