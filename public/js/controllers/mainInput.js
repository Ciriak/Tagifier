app.controller('mainInputCtrl', function($scope,$state)
{
	$scope.currentUrl;
	$scope.goodUrl = false;
	$scope.currentId;
  	$scope.checkUrl = function() {
	  	if(youtube_parser($scope.currentUrl)){
	  		$scope.goodUrl = true;
	  		$scope.currentId = youtube_parser($scope.currentUrl);
	  	}
	  	else
	  	{
	  		$scope.goodUrl = false;
	  	}
	  	console.log($scope.goodUrl);
	}

	$scope.miSubmit = function(){
		if($scope.goodUrl){
			$state.go('file',{fileId:$scope.currentId});
		}
		else{
			Materialize.toast($translate.instant("error.invalidLink"), 4000);
		}
	};

	var youtube_parser = function (url){
	    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
	    var match = url.match(regExp);
	    return (match&&match[7].length==11)? match[7] : false;
	}
});