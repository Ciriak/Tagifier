app.controller('fileCtrl', function($scope,$state,$http,$stateParams,notify)
{
	$('[data-toggle="tooltip"]').tooltip();	//initialize tooltips
	$scope.baseStr;
	$scope.userPattern;
	$scope.pattern;
	$scope.canDownload = false;
	$scope.processing = false;
	$scope.canEditTags = true;
	$scope.file = {};
	$scope.fileHeadingLabel = {};
	$scope.progress = 0;
	$scope.progressStatus = 'waiting',

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
		
		var extrData = $scope.baseStr.match(new RegExp($scope.pattern));
		if(!extrData)
		{
			console.log("Invalid regex");
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

		$scope.fileHeadingLabel.h1 = $scope.exportFile.title;
		$scope.fileHeadingLabel.h2 = $scope.exportFile.artist;

		$scope.canDownload = true;
		$scope.processing = false;
	}

	$scope.requestFile = function(){
		$scope.processing = true;
		$scope.socket.emit("fileRequest",{file:$scope.exportFile});
		$scope.fileHeadingLabel.h2 = "In Waiting list..";
	}

	$scope.showConfirmModal = function(){
		$('#confirm-dl-modal').modal();
		$scope.generateCaptchat();
	}

	$scope.generateCaptchat = function(){
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
			$('#confirm-dl-modal').modal('hide');
			$scope.processing = true;
			$scope.requestFile();
		}, function errorCallback(r) {
			$scope.processing = false;
			notify({ message:'The captchat is invalid !', duration:5000} );
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
				$scope.fileHeadingLabel.h2 = "Processing... ("+Math.round(ev.data.progress.percentage)+"%)";
				$scope.$apply();
			}
		}
		if(ev["event"] == "error"){
			$scope.buttonLabel = "Download";
			$scope.processing = false;
			notify({ message:'Internal error, please retry', duration:5000} );
		}
		if(ev["event"] == "finished"){
			$scope.progressStatus = "ready";
			var url = ev.data.file.replace("public/","");
			setTimeout(function(){
				download(url, $scope.exportFile.fileName+".mp3","audio/mp3");
			},1000);
		}

		$scope.$apply();
	});
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