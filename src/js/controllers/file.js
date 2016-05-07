app.controller('fileCtrl', function($scope,$state,$http,$stateParams,$translate,$location,notify)
{
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.fileAvailable = false;
	$scope.singleFile = true;
	$scope.files = {};
	$scope.dlFileUrl;
	$scope.dlFileName;
	$scope.fileReady = false;
	$scope.currentFileIndex = 0;
	$scope.exportFiles = [];
	$scope.progress = 0;
	$scope.captchatActive = false;
	$scope.notified = false;
	$scope.canRemoveFile = false;
	$scope.filePlayer;
	$scope.playerStatus = "stop";

	var date = new Date();
	$scope.filePlayer = document.getElementById("file-player");

	$scope.retreiveFilesInfos = function(url){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		$scope.fileAvailable = false;
		$http({
		  method: 'GET',
		  url: '/api/infos/'+url
		}).then(function successCallback(response) {
			parseFileData(response.data);
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			$scope.fileAvailable = true;
		}, function errorCallback(response) {
			$scope.retreiveInfoError();
		});
	};

	var requestUrl = decodeURI($location.url().substr(1)).replace(/~2F/g,'/');
	$scope.retreiveFilesInfos(requestUrl);

	var parseFileData = function(data){

		var baseIndex = $scope.exportFiles.length;
		if(baseIndex > 0){
			$scope.canRemoveFile = true;	// they will be more than 1 file so the user can remove them from thhe list
		}

		if(data.constructor === Object){	// 1 item
			$scope.setFileVars(baseIndex,data);
		}
		else{
			$scope.singleFile = false;
			for (var i = baseIndex; i < data.length; i++) {
					$scope.setFileVars(i,data[i]);
			}
		}
	};

	$scope.retreiveInfoError = function(){
		notify($translate.instant("error.unableToRetreiveFileData"));
		if($scope.exportFiles.length == 1){	// if only one file, return to the main page
			$state.go('^.main');
		}
	};

	$scope.requestFiles = function (){
		if($scope.processing){
			return;
		}
		$scope.fileReady = false;
		$scope.processing = true;
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		$scope.socket.emit("fileRequest",{files:$scope.exportFiles});
	};

	$scope.removeFileFromList = function(fileIndex){
		$scope.exportFiles.splice(fileIndex, 1);
		if($scope.exportFiles.length < 2){
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
		if(!$scope.canStartProcess){
			notify($translate.instant("error.plsFixFileErrors"));
			return;
		}
		if($scope.captchatActive){
			$scope.checkCaptchat();
		}
		else {
			$scope.generateCaptchat();
			$('#captchat-modal').modal('show');
		}
	};

	$scope.generateCaptchat = function(){
		$scope.captchatActive = true;
		ACPuzzle.create('buxt.317r8uls-ge9STPl6ilzpmYgl8G', 'solve-media-container', "");
	};

	$scope.setCurrentFile = function(i){
		$scope.currentFileIndex = i;
		$scope.filePlayer.pause();	//stop the audio player if playing
		$scope.playerStatus = "stop";
	};

	$scope.checkCaptchat = function(){
		var resp = $("#adcopy_response").val();
		var chal = $("#adcopy_challenge").val();

		$http({
		  method: 'POST',
		  url: '/checker',
		  data : {
		  	chal : chal,
		  	resp : resp
		  }
		}).then(function successCallback(r) {
			$('#captchat-modal').modal('hide');
			$scope.captchatActive = false;
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			$scope.requestFiles();
		}, function errorCallback(r) {
			$('#captchat-modal').modal('show');
			$scope.processing = false;
			notify($translate.instant("error.invalidCaptchat"));
			$scope.generateCaptchat();
		});
	};

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);

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
			var data = ev.data;
			$scope.exportFiles[data.index].error = true;
			if(!$scope.$$phase) {
				$scope.$apply();
			}
		}
		if(ev["event"] == "file_finished"){
				$scope.fileReady = false;
				var i = ev.data.index;
				$scope.exportFiles[i].progress = 100;
				$scope.exportFiles[i].converting = true;
				if(!$scope.$$phase) {
					$scope.$apply();
				}
		}
		if(ev["event"] == "finished"){
				var url = ev.data.path.replace("./exports/","musics/");
				$scope.dlFileUrl = url;

				$scope.fileReady = true;
				if($scope.singleFile){
					$scope.tgfDownload($scope.dlFileUrl,$scope.exportFiles[0].fileName+".mp3");
					$scope.dlFileName = $scope.exportFiles[0].fileName+".mp3";
				}
				else{
					var zipFileName = "Album.zip";
					if($scope.exportFiles[0].album){
						$scope.dlFileName = $scope.exportFiles[0].album+".zip";
					}
					$scope.tgfDownload($scope.dlFileUrl,$scope.dlFileName);
				}

				for (var i = 0; i < $scope.exportFiles.length; i++) {
					$scope.exportFiles[i].progress = 0;
					$scope.exportFiles[i].converting = false;
					$scope.exportFiles[i].processing = false;
					$scope.exportFiles[i].error = false;
				}

				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
		}

		if(!$scope.$$phase) {
			$scope.$apply();
		}
	});

	$scope.setFileVars = function(index,data){
		$scope.files[index] = data;
		$scope.exportFiles[index] = {
			lockedAttrs : [],
			converting : false,
			processing : false,
			error : false,
			progress : 0
		};

		$scope.exportFiles[index].webpage_url = $scope.files[index].webpage_url;
		$scope.exportFiles[index].image = $scope.files[index].thumbnail;

		//set the final filesize (bigger file)
		$scope.exportFiles[index].filesize = 0;
		// ... only if specified
		for (var o = 0; o < $scope.files[index].formats.length; o++) {
			if($scope.files[index].formats[o].filesize){	//continue only if filesize is specified
				var t = $scope.files[index].formats[o].filesize;
				if(t > $scope.exportFiles[index].filesize){	//update only if superior
					$scope.exportFiles[index].filesize = t;
				}
			}
		}
		if($scope.files[index].formats[$scope.files[index].formats.length-1].filesize){
			$scope.exportFiles[index].filesize = $scope.files[index].formats[$scope.files[index].formats.length-1].filesize;
		}

		//set release year if defined, else current year
		$scope.exportFiles[index].year = date.getFullYear();
		if(data.upload_date){
			$scope.exportFiles[index].year = data.upload_date.substr(0,4);
		}
		//

		$scope.exportFiles[index].track = index+1;

		//Define the pattern, depending of the file name format
		var pt = $scope.files[index].fulltitle.split(" - ");
		if(pt.length > 1){
			$scope.exportFiles[index].tagPattern = "%artist% - %title%";
			$scope.exportFiles[index].fileNamePattern = "%artist% - %title%";
		}
		else{
			$scope.exportFiles[index].tagPattern = "%title%";
			$scope.exportFiles[index].fileNamePattern = "%title%";
			// in this case, we set the Uploader as the "artist"
			if(data.uploader){
				$scope.exportFiles[index].artist = data.uploader;
			}
		}


		$scope.genPattern(index);

		var dur = returnDur($scope.files[index].duration);
		var duration = moment.duration({
	    seconds: dur.s,
	    minutes: dur.m,
	    hours: dur.h
		});
		if(duration.asMinutes() > 10){
			$scope.exportFiles[index].error = true;
			$scope.canStartProcess = false;
			notify($translate.instant("error.fileTooLong"));
		}
	};

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

		console.log("Generating pattern for "+$scope.files[index].fulltitle+"...");
		var fileData = $scope.exportFiles[index];
		var pattern = fileData.tagPattern.replace(/%([a-zA-Z0-9])\w+%/g, '(.*)');
		var fileVars = fileData.tagPattern.match(/%([a-zA-Z0-9])\w+%/g);

		for (var i = 0; i < fileVars.length; i++)
		{
			fileVars[i] = fileVars[i].replace("%","").replace("%",""); //remove %x%
		};

		//Find tags inside the fulltitle
		var extrData = $scope.files[index].fulltitle.match(new RegExp(pattern));
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

		if($scope.filePlayer.paused){
			$scope.filePlayer.play();
			$scope.playerStatus = "play";
		}
		else{
			$scope.filePlayer.pause();
			$scope.playerStatus = "pause";
		}

	}

	$scope.showAddFileModal = function(){
		$('#add-file-modal').modal('show');
	}

	$scope.hideAddFileModal = function(){
		$('#add-file-modal').modal('hide');
	}

	$scope.tgfDownload = function(url,name){
		var fullUrl = url+"?name="+name;
		var notification;
		var nOptions = {
			title : "File Ready",
		    body: "Your file is ready to download, click on this notification to download it !",
		    icon: "img/tgf/icon_circle.png"
		}

		if (Notification.permission === "granted" && !$scope.notified && !isMobile.any) {
			$scope.notified = true;
			var notification = new Notification(nOptions.title,nOptions);
			notification.onclick = function() {
				window.open(fullUrl, '_blank');
				notification.close();
			};
		}
		else{
			window.open(fullUrl, '_blank');
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

	return d;
}

var isInArray = function (value, array) {
  return array.indexOf(value) > -1;
}

var setAnimation = function(animation,target){
	target.addClass(animation);

	setTimeout(function () {
	    target.removeClass(animation);
	}, 500);
};
