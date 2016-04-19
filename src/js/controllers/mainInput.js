app.controller('mainInputCtrl', function($scope,$state,$translate)
{
	$scope.currentUrl;
	$scope.goodUrl = false;
	$scope.playlist = false;
	$scope.currentId;
  	$scope.checkUrl = function() {
  		var r = youtube_parser($scope.currentUrl);
	  	if(!r.id && !r.playlist){
	  		console.log(r);
	  		$scope.goodUrl = false;
	  		console.log("bad");
	  		return;
	  	}
	  	if(r.id){
	  		$scope.goodUrl = true;
	  		$scope.currentId = r.id;
	  	}
	  	if(r.playlist){
	  		$scope.goodUrl = true;
	  		$scope.playlist = true;
	  		$scope.currentId = r.playlist;
	  	}
	}

	$scope.miSubmit = function(){
		if($scope.goodUrl){
			if($scope.playlist){
				$state.go('playlist',{fileId:$scope.currentId});
				return;
			}

			$state.go('file',{fileId:$scope.currentId});
		}
		else{
			Materialize.toast($translate.instant("error.invalidLink"), 4000);
		}
	};

	var youtube_parser = function (url){
		var r = {};
		var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
	    var match = url.match(regExp);
	    if ( match && match[7].length == 11 ){
	        r.id = match[7];
	    }
	    
	    regExp = /(?:(?:\?|&)list=)((?!videoseries)[a-zA-Z0-9_-]*)/g;
		var match = regExp.exec(url);
		if(match && match[1]){
			r.playlist = match[1];
		}
		return r;
	    
	}

	var ytPlaylistChecker = function(url){
		var reg = new RegExp("^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?.*?(?:v|list)=(.*?)(?:&|$)|^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?(?:(?!=).)*\/(.*)$","i");
		var match = reg.exec(url);
		return match[1];
	}
});