app.controller('fileCtrl', function($scope,$state,$http,$stateParams,$translate)
{
	$scope.baseStr;
	$scope.userPattern;
	$scope.pattern;
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.file = {};
	$scope.progress = 0;
	$scope.progressStatus = 'waiting';
	$scope.captchatActive = false;
	$scope.notified = false;

	$(function () {		//instantiate tooltip
	  $('[data-toggle="tooltip"]').tooltip()
	});

	$scope.exportFile = {};
	$http({
	  method: 'GET',
	  url: '/api/file/'+$stateParams.fileId
	}).then(function successCallback(response) {
		parseFileData(response.data);
		$scope.canEditTags = true;
		$scope.canStartProcess = true;
	}, function errorCallback(response) {
		$scope.retreiveInfoError();
	});

	var parseFileData = function(data){
		$scope.file = data.items[0];
		if(!$scope.file){
			$scope.retreiveInfoError();
			return;
		}
		$scope.exportFile.image = getBestThumbnail($scope.file.snippet.thumbnails);
		$scope.exportFile.year = $scope.file.snippet.publishedAt.substr(0,4);
		$scope.exportFile.id = $stateParams.fileId;

		//check if the file duration is longer than 10 min
		var dur = $scope.file.contentDetails.duration;
		if(YTDurationToSeconds(dur) > 600){
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			alert($translate.instant("error.fileTooLong"));
			$state.go("^.main");
			return;
		}

		var pt = $scope.file.snippet.localized.title.split(" - ");
		$scope.userPattern = "%artist% - %title%";
		// if xx - xx format
		if(pt.length == 2){
			$scope.baseStr =  $scope.file.snippet.localized.title;
		}

		else {
			$scope.baseStr =  $scope.file.snippet.channelTitle+" - "+$scope.file.snippet.localized.title;
		}

		$scope.genPattern();
	}

	$scope.genPattern = function(){
		$scope.pattern = $scope.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)");
		$scope.vars = $scope.userPattern.match(/%([a-zA-Z0-9])\w+%/g);
		for (var i = 0; i < $scope.vars.length; i++)
		{
			$scope.vars[i] = $scope.vars[i].replace("%","").replace("%",""); //remove %x%
		};
		var extrData = $scope.baseStr.match(new RegExp($scope.pattern));
		if(!extrData)
		{
			$scope.canDownload = false;
			return;
		}

		for (var i = 0; i < $scope.vars.length; i++)
		{
			if(extrData[i+1])
			{
				$scope.exportFile[$scope.vars[i]] = extrData[i+1];
			}
		};

	}

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
		//console.log(ev);
		if(ev["event"] == "progress"){
			if(ev.data.videoId == $scope.exportFile.id){
				$scope.processing = true;
				$scope.canEditTags = false;
				$scope.canStartProcess = false;
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
}