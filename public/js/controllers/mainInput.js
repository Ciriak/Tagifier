app.controller('mainInputCtrl', function($scope,$state)
{
	$scope.currentUrl;
	$scope.goodUrl = false;
	$scope.playlist = false;
	$scope.currentId;
  	$scope.checkUrl = function() {
  		var r = youtube_parser($scope.currentUrl);
	  	if(r.id){
	  		$scope.goodUrl = true;
	  		$scope.currentId = r.id;
	  		if(r.playlist){
	  			$scope.playlist = true;
	  			$scope.currentId = r.playlist;
	  		}
	  		else{
	  			$scope.playlist = false;
	  		}
	  	}
	  	else
	  	{
	  		$scope.goodUrl = false;
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
	    }else{
	        return false;
	    }
	    
	    regExp = /(?:(?:\?|&)list=)((?!videoseries)[a-zA-Z0-9_]*)/g;
		var match = regExp.exec(url);
		if(match && match[1]){
			r.playlist = match[1];
		}
		console.log(r);
		return r;
	    
	}

	var ytPlaylistChecker = function(url){
		var reg = new RegExp("^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?.*?(?:v|list)=(.*?)(?:&|$)|^(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?(?:(?!=).)*\/(.*)$","i");
		var match = reg.exec(url);
		return match[1];
	}
});