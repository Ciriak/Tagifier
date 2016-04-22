var app = angular.module('tagifier', [
'ui.router',
'youtube-embed',
'ngSanitize',
'pascalprecht.translate'
    ]);

app.config(function($stateProvider, $urlRouterProvider) {
  //
  // For any unmatched url, redirect to /
  $urlRouterProvider.otherwise("/");
  $urlRouterProvider.when('/{sheetId:int}', '/{sheetId:int}/chat');
  $urlRouterProvider.when('/{sheetId:int}/settings', '/{sheetId:int}/settings/info');
  $urlRouterProvider.when('/{sheetId:int}/users', '/{sheetId:int}/users/list');
  //
  // Now set up the states
  $stateProvider
    .state('main', {
      url: "/",
      templateUrl: "views/index.html",
      reload:true
    })
    .state('about', {
      url: "/about",
      templateUrl: "views/about.html"
    })
    .state('file', {
      url: "/{fileId}",
      templateUrl: "views/file.html",
      controller: "fileCtrl",
      reload:true
    })
    .state('playlist', {
      url: "/playlist/{fileId}",
      templateUrl: "views/playlist.html",
      controller: "playlistCtrl",
      reload:true
    });
});

app.config(['$translateProvider', function($translateProvider) {
  $translateProvider.useSanitizeValueStrategy('sanitize');
  $translateProvider.useStaticFilesLoader({
    prefix: '../locales/',
    suffix: '.json'
});
  $translateProvider.preferredLanguage('en');
}]);

app.controller('mainCtrl', ['$scope', '$http','$rootScope','$translate','$window','$location', function($scope, $http,$rootScope,$translate,$window,$location)
{
  $scope.docReady = false;
  $(window).load(function(){

    $window.ga('create', 'UA-48635201-13', 'auto');  //initialize GA
    $scope.docReady = true;
    $scope.$apply();

    // load the fb plugin after a small delay (prevent screen freezing)
    setTimeout(function(){FB.XFBML.parse(),500});
  });

  $scope.socket = io.connect();
  $scope.socket.on('connect', function()
  {
    console.log("Socket connected !");
  });

  //auto focus the form
  $(document).hover(function(){
    $("#youtube-url").focus();
  });

  $(document).click(function(){
    $("#youtube-url").focus();
  });

  //retreive last commit infos
  $scope.lastCommit = "Tagifier";
  $http({
  	method: 'GET',
  	url: 'https://api.github.com/repos/CYRIAQU3/tagifier/commits'
	}).then(function successCallback(response) {
    	$scope.lastCommit = response.data[0].sha.substring(0,8);
    	$scope.lastUser = response.data[0].author.login;
  });

	// request permission for notifications (used when the file is ready)
  	if (Notification.permission !== 'denied' || Notification.permission === "default") {
    	if(!isMobile.any)
  		{
        console.log("notMobile");
  			Notification.requestPermission();
  		}
  	}
  $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){
    //remove all the notifs when a page change
    $('.toast').remove();
  });
  $rootScope.$on('$stateChangeSuccess', function (event) {
      //ga event for page change
      $window.ga('send', 'pageview', $location.path());
  });

}]);

app.directive('targetBlank', function () {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          var href = element.href;
          if(true) {  // replace with your condition
            element.attr("target", "_blank");
          }
        }
    };
});

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

		$scope.exportFile.image = getBestThumbnail($scope.file.snippet.thumbnails);
		$scope.exportFile.year = $scope.file.snippet.publishedAt.substr(0,4);
		$scope.exportFile.id = $stateParams.fileId;

		//check if the file duration is longer than 10 min
		var dur = $scope.file.contentDetails.duration;
		if(YTDurationToSeconds(dur) > 600){
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			console.log($translate.instant("error.fileTooLong"), 10000);
			$scope.$apply();
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
		console.log($translate.instant("error.unableToRetreiveFileData"), 10000);
		$scope.$apply();
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
			console.log($translate.instant("error.invalidCaptchat"));
			$scope.generateCaptchat();
		});
	}

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);
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
			console.log($translate.instant("error.internalError"));
		}
		if(ev["event"] == "finished"){
			if(ev.data.id == $scope.exportFile.id){
				$scope.progressStatus = "ready";
				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
				$scope.exportFile.url = ev.data.url.replace("./exports/","musics/");
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
				window.open($scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title, '_blank');
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
app.controller('playlistCtrl', function($scope,$state,$http,$stateParams,$translate)
{
	$scope.baseStr;
	$scope.userPattern;
	$scope.pattern;
	$scope.canStartProcess = false;
	$scope.processing = false;
	$scope.canEditTags = false;
	$scope.playlist = {};
	$scope.progress = 0;
	$scope.progressStatus = 'waiting';
	$scope.captchatActive = false;
	$scope.notified = false;

	$scope.modelFile = {};
	$http({
	  method: 'GET',
	  url: '/api/playlist/'+$stateParams.fileId
	}).then(function successCallback(response) {
		parseFileData(response.data);
		$scope.canEditTags = true;
		$scope.canStartProcess = true;
	}, function errorCallback(response) {
		
		$scope.retreiveInfoError();
	});

	var parseFileData = function(data){
		console.log(data);
		$scope.playlist = data;

		$scope.modelFile.image = getBestThumbnail($scope.playlist[0].thumbnails);
		$scope.modelFile.year = $scope.playlist[0].publishedAt.substr(0,4);
		$scope.modelFile.id = $stateParams.fileId;
		
		//check if the file duration is longer than 10 min 
		/*var dur = $scope.playlist.contentDetails.duration;
		if(YTDurationToSeconds(dur) > 600){
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			Materialize.toast($translate.instant("error.fileTooLong"), 10000);
			$scope.$apply();
			return;
		}*/

		var pt = $scope.playlist[0].title.split(" - ");
		$scope.userPattern = "%album% - %title%";
		// if xx - xx format
		if(pt.length == 2){
			$scope.baseStr =  $scope.playlist[0].title;
		}

		else {
			$scope.baseStr =  $scope.playlist[0].channelTitle+" - "+$scope.playlist[0].localized.title;
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
				$scope.modelFile[$scope.vars[i]] = extrData[i+1];
			}
		};
		
	}

	$scope.retreiveInfoError = function(){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		Materialize.toast($translate.instant("error.unableToRetreiveFileData"), 10000);
		$scope.$apply();
	}

	$scope.requestFile = function(){
		$scope.processing = true;
		$scope.socket.emit("fileRequest",{file:$scope.modelFile});
	}

	$scope.requestProcess = function(){
		if($scope.captchatActive){
			$scope.checkCaptchat();
		}
		else {
			Materialize.toast($translate.instant("file.pleaseEnterCaptchat"), 4000);
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
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			$scope.requestFile();
		}, function errorCallback(r) {
			$scope.processing = false;
			Materialize.toast($translate.instant("error.invalidCaptchat"), 4000);
			$scope.generateCaptchat();
		});
	}

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);
		if(ev["event"] == "progress"){
			if(ev.data.videoId == $scope.modelFile.id){
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
			Materialize.toast($translate.instant("error.internalError"), 4000);
		}
		if(ev["event"] == "finished"){
			if(ev.data.id == $scope.modelFile.id){
				$scope.progressStatus = "ready";
				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
				$scope.modelFile.url = ev.data.url.replace("./exports/","musics/");
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
				window.open($scope.modelFile.url+"?name="+$scope.modelFile.artist+" - "+$scope.modelFile.title, '_blank');
				notification.close();
			};
		}
		else{
			Materialize.toast("Your file is ready", 4000);
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
app.controller('youtubeCtrl', function($scope,$state,$http,$stateParams,$translate)
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

	$scope.exportFile = {};

	$scope.retreiveInfoError = function(){
		$scope.canEditTags = false;
		$scope.canStartProcess = false;
		Materialize.toast($translate.instant("error.unableToRetreiveFileData"), 10000);
		$scope.$apply();
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
			Materialize.toast($translate.instant("file.pleaseEnterCaptchat"), 4000);
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
			$scope.canEditTags = false;
			$scope.canStartProcess = false;
			$scope.requestFile();
		}, function errorCallback(r) {
			$scope.processing = false;
			Materialize.toast($translate.instant("error.invalidCaptchat"), 4000);
			$scope.generateCaptchat();
		});
	}

	$scope.socket.on("yd_event",function(ev){
		console.log(ev);
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
			Materialize.toast($translate.instant("error.internalError"), 4000);
		}
		if(ev["event"] == "finished"){
			if(ev.data.id == $scope.exportFile.id){
				$scope.progressStatus = "ready";
				$scope.processing = false;
				$scope.canEditTags = true;
				$scope.canStartProcess = true;
				$scope.exportFile.url = ev.data.url.replace("./exports/","musics/");
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
				window.open($scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title, '_blank');
				notification.close();
			};
		}
		else{
			Materialize.toast("Your file is ready", 4000);
		}
	};

	$scope.YTDurationToSeconds = function(duration) {
	  var match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)

	  var hours = (parseInt(match[1]) || 0);
	  var minutes = (parseInt(match[2]) || 0);
	  var seconds = (parseInt(match[3]) || 0);

	  return hours * 3600 + minutes * 60 + seconds;
	}

	$scope.getBestThumbnail = function(t){
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
});