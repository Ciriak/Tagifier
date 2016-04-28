app.controller('fileCtrl', function($scope,$state,$http,$stateParams,$translate,$location)
{
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.fileAvailable = false;
	$scope.singleFile = true;
	$scope.files = {};
	$scope.currentFileIndex = 0;
	$scope.exportFiles = {};
	$scope.progress = 0;
	$scope.progressStatus = 'waiting';
	$scope.captchatActive = false;
	$scope.notified = false;
	$scope.requestUrl = decodeURI($location.url().substr(1)).replace(/~2F/g,'/');

	var date = new Date();

	$http({
	  method: 'GET',
	  url: '/api/infos/'+$scope.requestUrl
	}).then(function successCallback(response) {
		parseFileData(response.data);
		$scope.canEditTags = true;
		$scope.canStartProcess = true;
		$scope.fileAvailable = true;
	}, function errorCallback(response) {
		$scope.retreiveInfoError();
	});

	var parseFileData = function(data){

		if(data.constructor === Object){	// 1 item
			$scope.setFileVars(0,data);
		}
		else{
			$scope.singleFile = false;
			for (var i = 0; i < data.length; i++) {
					$scope.setFileVars(i,data[i]);
			}
		}
	};

	$scope.retreiveInfoError = function(){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		alert($translate.instant("error.unableToRetreiveFileData"));
		$state.go('^.main');
	}

	$scope.requestFile = function(){
		$scope.processing = true;
		$scope.socket.emit("fileRequest",{file:$scope.exportFile});
	}

	$scope.reloadPage = function(){
		location.reload();
	};

	$scope.requestProcess = function(){
		if($scope.captchatActive){
			$scope.checkCaptchat();
		}
		else {
			console.log($translate.instant("file.pleaseEnterCaptchat"));
			$scope.generateCaptchat();
			$('#captchat-modal').modal('show');
		}

	}

	$scope.generateCaptchat = function(){
		$scope.captchatActive = true;
		ACPuzzle.create('buxt.317r8uls-ge9STPl6ilzpmYgl8G', 'solve-media-container', "");
	}

	$scope.setCurrentFile = function(i){
		$scope.currentFileIndex = i;
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
			$scope.processing = true;
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			$scope.requestFile();
		}, function errorCallback(r) {
			$('#captchat-modal').modal('show');
			$scope.processing = false;
			alert($translate.instant("error.invalidCaptchat"));
			$scope.generateCaptchat();
		});
	}

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);

		if(ev["event"] == "file_infos"){
			console.log(ev.data);
		}

		if(ev["event"] == "progress"){
			if(ev.data.videoId == $scope.exportFiles.id){
				$scope.processing = true;
				$scope.canEditTags = false;
				$scope.canStartProcess = false;
				var dlSize = ev.data;
				$scope.progress = ev.data.progress.percentage;
				$scope.progressStatus = "processing";
				$scope.$apply();
			}
		}
		if(ev["event"] == "error"){
			$scope.buttonLabel = "Download";
			$scope.processing = false;
			$scope.canEditTags = true;
			$scope.canStartProcess = true;
			alert($translate.instant("error.internalError"));
		}
		if(ev["event"] == "finished"){
			if(ev.data.id == $scope.exportFile.id){
				$scope.progressStatus = "ready";
				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
				$scope.exportFile.url = ev.data.url.replace("./exports/","musics/");
				$scope.exportFile.fullUrl = $scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title;
				$scope.tgfDownload();
			}
		}

		$scope.$apply();
	});

	$scope.setFileVars = function(index,data){
		$scope.files[index] = data;
		$scope.exportFiles[index] = {
			lockedAttrs : []
		};


		$scope.exportFiles[index].image = $scope.files[index].thumbnail;

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
		}


		$scope.genPattern(index);

		//check if the file duration is longer than 10 min
		//TODO
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

	$scope.tgfDownload = function(){
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
				window.open($scope.exportFile.fullUrl, '_blank');
				notification.close();
			};
		}
		else{
			console.log("Your file is ready");
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
