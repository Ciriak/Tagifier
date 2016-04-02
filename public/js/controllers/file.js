app.controller('fileCtrl', function($scope,$state,$http,$stateParams)
{
	$scope.baseStr;
	$scope.userPattern;
	$scope.pattern;
	$scope.canDownload = false;
	$scope.processing = false;
	$scope.file = {};
	$scope.fileHeadingLabel = {};

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

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);
		if(ev["event"] == "progress"){
			$scope.processing = true;
			$scope.fileHeadingLabel.h2 = "Processing... ("+Math.round(ev.data.progress.percentage)+"%)";
		}
		if(ev["event"] == "error"){
			$scope.buttonLabel = "Download";
			$scope.processing = false;
		}
		if(ev["event"] == "finished"){
			console.log("File Ready");
			$scope.processing = false;
			$scope.fileHeadingLabel.h2 = "Your file is ready !";
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