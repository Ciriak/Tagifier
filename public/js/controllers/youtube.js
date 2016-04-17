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