app.controller('fileCtrl', function($scope,$state,$http,$stateParams)
{
	$scope.baseStr;
	$scope.userPattern;
	$scope.pattern;
	$scope.processing = false;
	$scope.canEditTags = true;
	$scope.file = {};
	$scope.progress = 0;
	$scope.progressStatus = 'waiting';
	$scope.captchatActive = false;

	$scope.exportFile = {};
	$http({
	  method: 'GET',
	  url: '/api/'+$stateParams.fileId
	}).then(function successCallback(response) {
		parseFileData(response.data);
	}, function errorCallback(response) {
		console.log(response);
	});

	var parseFileData = function(data){
		console.log(data);
		$scope.file = data;
		$scope.exportFile.image = getBestThumbnail(data.snippet.thumbnails);
		$scope.exportFile.id = $stateParams.fileId;
		

		var pt = data.snippet.localized.title.split(" - ");
		$scope.userPattern = "%artist% - %title%";
		// if xx - xx format
		if(pt.length == 2){
			$scope.baseStr =  data.snippet.localized.title;
		}

		else {
			$scope.baseStr =  data.snippet.channelTitle+" - "+data.snippet.localized.title;
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
		
		console.log($scope.baseStr);
		var extrData = $scope.baseStr.match(new RegExp($scope.pattern));
		console.log(extrData);
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

	$scope.requestFile = function(){
		$scope.processing = true;
		$scope.socket.emit("fileRequest",{file:$scope.exportFile});
	}

	$scope.requestProcess = function(){
		if($scope.captchatActive){
			$scope.checkCaptchat();
		}
		else {
			Materialize.toast('Veuillez remplir le Captchat', 4000);
			$scope.generateCaptchat();
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
			$scope.captchatActive = false;
			$scope.processing = true;
			$scope.requestFile();
		}, function errorCallback(r) {
			$scope.processing = false;
			Materialize.toast('The Captchat is invalid !', 4000);
			$scope.generateCaptchat();
		});
	}

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);
		if(ev["event"] == "progress"){
			if(ev.data.videoId == $scope.exportFile.id){
				$scope.processing = true;
				$scope.progress = ev.data.progress.percentage;
				$scope.progressStatus = "processing";
				$scope.$apply();
			}
		}
		if(ev["event"] == "error"){
			$scope.buttonLabel = "Download";
			$scope.processing = false;
			Materialize.toast('Internal error, please retry', 4000);
		}
		if(ev["event"] == "finished"){
			$scope.progressStatus = "ready";
			$scope.processing = false;
			$scope.exportFile.url = ev.data.file.replace("exports/","musics/");
			Materialize.toast('Your file is ready', 4000);
			$scope.tgfDownload();
		}

		$scope.$apply();
	});

	$scope.tgfDownload = function(){
		window.open($scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title);
	};
});

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