app.controller('fileCtrl', function($scope,$state,$http,$stateParams)
{
	$scope.userPattern = "%title%";
	$scope.pattern;
	$scope.file = {};

	$scope.exportFile = {};
	$http({
	  method: 'GET',
	  url: '/api/'+$stateParams.fileId
	}).then(function successCallback(response) {
		parseFileData(response.data);
	// this callback will be called asynchronously
	// when the response is available
	}, function errorCallback(response) {
	// called asynchronously if an error occurs
	// or server returns response with an error status.
	});

	var parseFileData = function(data){
		$scope.file = data;
		var pt = data.snippet.localized.title.split(" - ");
		
		// if xx - xx format
		if(pt.length == 2){
			$scope.pattern = "%artist% - %title%";
		}

		else {
			$scope.pattern = "%title%";
			$scope.exportFile.title = data.snippet.localized.title;
			$scope.exportFile.artist = data.snippet.channelName;
		}
	}

	$scope.genPattern = function(){
		$scope.pattern = $scope.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)");
		console.log($scope.pattern);
	}
});