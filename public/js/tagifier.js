var app=angular.module("tagifier",["ui.router","ui.bootstrap","youtube-embed","ngSanitize","pascalprecht.translate"]);app.config(["$stateProvider","$urlRouterProvider",function($stateProvider,$urlRouterProvider){$urlRouterProvider.otherwise("/"),$urlRouterProvider.when("/{sheetId:int}","/{sheetId:int}/chat"),$urlRouterProvider.when("/{sheetId:int}/settings","/{sheetId:int}/settings/info"),$urlRouterProvider.when("/{sheetId:int}/users","/{sheetId:int}/users/list"),$stateProvider.state("main",{url:"/",templateUrl:"views/index.html",reload:!0}).state("about",{url:"/about",templateUrl:"views/about.html"}).state("file",{url:"/{fileId}",templateUrl:"views/file.html",controller:"fileCtrl",reload:!0}).state("playlist",{url:"/playlist/{fileId}",templateUrl:"views/playlist.html",controller:"playlistCtrl",reload:!0})}]),app.config(["$translateProvider",function($translateProvider){$translateProvider.useSanitizeValueStrategy("sanitize"),$translateProvider.useStaticFilesLoader({prefix:"../locales/",suffix:".json"}),$translateProvider.preferredLanguage("en")}]),app.controller("mainCtrl",["$scope","$http","$rootScope","$translate","$window","$location",function($scope,$http,$rootScope,$translate,$window,$location){$scope.docReady=!1,$(window).load(function(){$window.ga("create","UA-48635201-13","auto"),$scope.docReady=!0,$scope.$apply(),setTimeout(function(){FB.XFBML.parse(),500})}),$scope.socket=io.connect(),$scope.socket.on("connect",function(){console.log("Socket connected !")}),$(document).hover(function(){$("#youtube-url").focus()}),$(document).click(function(){$("#youtube-url").focus()}),$scope.lastCommit="Tagifier",$http({method:"GET",url:"https://api.github.com/repos/CYRIAQU3/tagifier/commits"}).then(function(response){$scope.lastCommit=response.data[0].sha.substring(0,8),$scope.lastUser=response.data[0].author.login}),"denied"===Notification.permission&&"default"!==Notification.permission||isMobile.any||(console.log("notMobile"),Notification.requestPermission()),$rootScope.$on("$stateChangeStart",function(event,toState,toParams,fromState,fromParams){$(".toast").remove()}),$rootScope.$on("$stateChangeSuccess",function(event){$window.ga("send","pageview",$location.path())})}]),app.directive("targetBlank",function(){return{restrict:"A",link:function(scope,element,attrs){element.href;element.attr("target","_blank")}}});

app.controller("fileCtrl",function($scope,$state,$http,$stateParams,$translate){$scope.baseStr,$scope.userPattern,$scope.pattern,$scope.canStartProcess=!1,$scope.processing=!1,$scope.canEditTags=!1,$scope.file={},$scope.progress=0,$scope.progressStatus="waiting",$scope.captchatActive=!1,$scope.notified=!1,$(function(){$('[data-toggle="tooltip"]').tooltip()}),$scope.exportFile={},$http({method:"GET",url:"/api/file/"+$stateParams.fileId}).then(function(response){parseFileData(response.data),$scope.canEditTags=!0,$scope.canStartProcess=!0},function(response){$scope.retreiveInfoError()});var parseFileData=function(data){if($scope.file=data.items[0],!$scope.file)return void $scope.retreiveInfoError();$scope.exportFile.image=getBestThumbnail($scope.file.snippet.thumbnails),$scope.exportFile.year=$scope.file.snippet.publishedAt.substr(0,4),$scope.exportFile.id=$stateParams.fileId;var dur=$scope.file.contentDetails.duration;if(YTDurationToSeconds(dur)>600)return $scope.canEditTags=!1,$scope.canStartProcess=!1,alert($translate.instant("error.fileTooLong")),void $state.go("^.main");var pt=$scope.file.snippet.localized.title.split(" - ");$scope.userPattern="%artist% - %title%",2==pt.length?$scope.baseStr=$scope.file.snippet.localized.title:$scope.baseStr=$scope.file.snippet.channelTitle+" - "+$scope.file.snippet.localized.title,$scope.genPattern()};$scope.genPattern=function(){$scope.pattern=$scope.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)"),$scope.vars=$scope.userPattern.match(/%([a-zA-Z0-9])\w+%/g);for(var i=0;i<$scope.vars.length;i++)$scope.vars[i]=$scope.vars[i].replace("%","").replace("%","");var extrData=$scope.baseStr.match(new RegExp($scope.pattern));if(!extrData)return void($scope.canDownload=!1);for(var i=0;i<$scope.vars.length;i++)extrData[i+1]&&($scope.exportFile[$scope.vars[i]]=extrData[i+1])},$scope.retreiveInfoError=function(){$scope.canEditTags=!1,$scope.canStartProcess=!1,alert($translate.instant("error.unableToRetreiveFileData")),$state.go("^.main")},$scope.requestFile=function(){$scope.processing=!0,$scope.socket.emit("fileRequest",{file:$scope.exportFile})},$scope.reloadPage=function(){location.reload()},$scope.requestProcess=function(){$scope.captchatActive?$scope.checkCaptchat():(console.log($translate.instant("file.pleaseEnterCaptchat")),$scope.generateCaptchat(),$("#captchat-modal").modal("show"))},$scope.generateCaptchat=function(){$scope.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},$scope.checkCaptchat=function(){var resp=$("#adcopy_response").val(),chal=$("#adcopy_challenge").val();$http({method:"POST",url:"/checker",data:{chal:chal,resp:resp}}).then(function(r){$("#captchat-modal").modal("hide"),$scope.captchatActive=!1,$scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.requestFile()},function(r){$("#captchat-modal").modal("show"),$scope.processing=!1,alert($translate.instant("error.invalidCaptchat")),$scope.generateCaptchat()})},$scope.socket.on("yd_event",function(ev){"progress"==ev.event&&ev.data.videoId==$scope.exportFile.id&&($scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.progress=ev.data.progress.percentage,$scope.progressStatus="processing",$scope.$apply()),"error"==ev.event&&($scope.buttonLabel="Download",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,alert($translate.instant("error.internalError"))),"finished"==ev.event&&ev.data.id==$scope.exportFile.id&&($scope.progressStatus="ready",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,$scope.exportFile.url=ev.data.url.replace("./exports/","musics/"),$scope.exportFile.fullUrl=$scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title,$scope.tgfDownload()),$scope.$apply()}),$scope.tgfDownload=function(){var notification,nOptions={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||$scope.notified||isMobile.any)console.log("Your file is ready");else{$scope.notified=!0;var notification=new Notification(nOptions.title,nOptions);notification.onclick=function(){window.open($scope.exportFile.fullUrl,"_blank"),notification.close()}}}});var YTDurationToSeconds=function(duration){var match=duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/),hours=parseInt(match[1])||0,minutes=parseInt(match[2])||0,seconds=parseInt(match[3])||0;return 3600*hours+60*minutes+seconds},getBestThumbnail=function(t){return t.maxres?t.maxres.url:t.high?t.high.url:t.medium?t.medium.url:t.standard?t.standard.url:""};
app.controller("mainInputCtrl",function($scope,$state,$translate){$scope.currentUrl,$scope.goodUrl=!1,$scope.playlist=!1,$scope.currentId,$scope.checkUrl=function(){var r=youtube_parser($scope.currentUrl);return r.id||r.playlist?(r.id&&($scope.goodUrl=!0,$scope.currentId=r.id),void(r.playlist&&($scope.goodUrl=!0,$scope.playlist=!0,$scope.currentId=r.playlist))):(console.log(r),$scope.goodUrl=!1,void console.log("bad"))},$scope.miSubmit=function(){if($scope.goodUrl){if($scope.playlist)return void $state.go("playlist",{fileId:$scope.currentId});$state.go("file",{fileId:$scope.currentId})}else alert($translate.instant("error.invalidLink"))};var youtube_parser=function(url){var r={},regExp=/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/,match=url.match(regExp);match&&11==match[7].length&&(r.id=match[7]),regExp=/(?:(?:\?|&)list=)((?!videoseries)[a-zA-Z0-9_-]*)/g;var match=regExp.exec(url);return match&&match[1]&&(r.playlist=match[1]),r}});
app.controller("playlistCtrl",function($scope,$state,$http,$stateParams,$translate){$scope.baseStr,$scope.userPattern,$scope.pattern,$scope.canStartProcess=!1,$scope.processing=!1,$scope.canEditTags=!1,$scope.playlist={},$scope.progress=0,$scope.progressStatus="waiting",$scope.captchatActive=!1,$scope.notified=!1,$scope.modelFile={},$http({method:"GET",url:"/api/playlist/"+$stateParams.fileId}).then(function(response){parseFileData(response.data),$scope.canEditTags=!0,$scope.canStartProcess=!0},function(response){$scope.retreiveInfoError()});var parseFileData=function(data){console.log(data),$scope.playlist=data,$scope.modelFile.image=getBestThumbnail($scope.playlist[0].thumbnails),$scope.modelFile.year=$scope.playlist[0].publishedAt.substr(0,4),$scope.modelFile.id=$stateParams.fileId;var pt=$scope.playlist[0].title.split(" - ");$scope.userPattern="%album% - %title%",2==pt.length?$scope.baseStr=$scope.playlist[0].title:$scope.baseStr=$scope.playlist[0].channelTitle+" - "+$scope.playlist[0].localized.title,$scope.genPattern()};$scope.genPattern=function(){$scope.pattern=$scope.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)"),$scope.vars=$scope.userPattern.match(/%([a-zA-Z0-9])\w+%/g);for(var i=0;i<$scope.vars.length;i++)$scope.vars[i]=$scope.vars[i].replace("%","").replace("%","");var extrData=$scope.baseStr.match(new RegExp($scope.pattern));if(!extrData)return void($scope.canDownload=!1);for(var i=0;i<$scope.vars.length;i++)extrData[i+1]&&($scope.modelFile[$scope.vars[i]]=extrData[i+1])},$scope.retreiveInfoError=function(){$scope.canEditTags=!1,$scope.canStartProcess=!1,Materialize.toast($translate.instant("error.unableToRetreiveFileData"),1e4),$scope.$apply()},$scope.requestFile=function(){$scope.processing=!0,$scope.socket.emit("fileRequest",{file:$scope.modelFile})},$scope.requestProcess=function(){$scope.captchatActive?$scope.checkCaptchat():(Materialize.toast($translate.instant("file.pleaseEnterCaptchat"),4e3),$scope.generateCaptchat())},$scope.generateCaptchat=function(){$scope.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},$scope.checkCaptchat=function(){var resp=$("#adcopy_response").val(),chal=$("#adcopy_challenge").val();$http({method:"POST",url:"/checker",data:{chal:chal,resp:resp}}).then(function(r){$scope.captchatActive=!1,$scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.requestFile()},function(r){$scope.processing=!1,Materialize.toast($translate.instant("error.invalidCaptchat"),4e3),$scope.generateCaptchat()})},$scope.socket.on("yd_event",function(ev){console.log(ev),"progress"==ev.event&&ev.data.videoId==$scope.modelFile.id&&($scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.progress=ev.data.progress.percentage,$scope.progressStatus="processing",$scope.$apply()),"error"==ev.event&&($scope.buttonLabel="Download",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,Materialize.toast($translate.instant("error.internalError"),4e3)),"finished"==ev.event&&ev.data.id==$scope.modelFile.id&&($scope.progressStatus="ready",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,$scope.modelFile.url=ev.data.url.replace("./exports/","musics/"),$scope.tgfDownload()),$scope.$apply()}),$scope.tgfDownload=function(){var notification,nOptions={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||$scope.notified||isMobile.any)Materialize.toast("Your file is ready",4e3);else{$scope.notified=!0;var notification=new Notification(nOptions.title,nOptions);notification.onclick=function(){window.open($scope.modelFile.url+"?name="+$scope.modelFile.artist+" - "+$scope.modelFile.title,"_blank"),notification.close()}}}});var YTDurationToSeconds=function(duration){var match=duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/),hours=parseInt(match[1])||0,minutes=parseInt(match[2])||0,seconds=parseInt(match[3])||0;return 3600*hours+60*minutes+seconds},getBestThumbnail=function(t){return t.maxres?t.maxres.url:t.high?t.high.url:t.medium?t.medium.url:t.standard?t.standard.url:""};
app.controller("youtubeCtrl",function($scope,$state,$http,$stateParams,$translate){$scope.baseStr,$scope.userPattern,$scope.pattern,$scope.canStartProcess=!1,$scope.processing=!1,$scope.canEditTags=!1,$scope.file={},$scope.progress=0,$scope.progressStatus="waiting",$scope.captchatActive=!1,$scope.notified=!1,$scope.exportFile={},$scope.retreiveInfoError=function(){$scope.canEditTags=!1,$scope.canStartProcess=!1,Materialize.toast($translate.instant("error.unableToRetreiveFileData"),1e4),$scope.$apply()},$scope.requestFile=function(){$scope.processing=!0,$scope.socket.emit("fileRequest",{file:$scope.exportFile})},$scope.requestProcess=function(){$scope.captchatActive?$scope.checkCaptchat():(Materialize.toast($translate.instant("file.pleaseEnterCaptchat"),4e3),$scope.generateCaptchat())},$scope.generateCaptchat=function(){$scope.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},$scope.checkCaptchat=function(){var resp=$("#adcopy_response").val(),chal=$("#adcopy_challenge").val();$http({method:"POST",url:"/checker",data:{chal:chal,resp:resp}}).then(function(r){$scope.captchatActive=!1,$scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.requestFile()},function(r){$scope.processing=!1,Materialize.toast($translate.instant("error.invalidCaptchat"),4e3),$scope.generateCaptchat()})},$scope.socket.on("yd_event",function(ev){console.log(ev),"progress"==ev.event&&ev.data.videoId==$scope.exportFile.id&&($scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.progress=ev.data.progress.percentage,$scope.progressStatus="processing",$scope.$apply()),"error"==ev.event&&($scope.buttonLabel="Download",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,Materialize.toast($translate.instant("error.internalError"),4e3)),"finished"==ev.event&&ev.data.id==$scope.exportFile.id&&($scope.progressStatus="ready",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,$scope.exportFile.url=ev.data.url.replace("./exports/","musics/"),$scope.tgfDownload()),$scope.$apply()}),$scope.tgfDownload=function(){var notification,nOptions={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||$scope.notified||isMobile.any)Materialize.toast("Your file is ready",4e3);else{$scope.notified=!0;var notification=new Notification(nOptions.title,nOptions);notification.onclick=function(){window.open($scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title,"_blank"),notification.close()}}},$scope.YTDurationToSeconds=function(duration){var match=duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/),hours=parseInt(match[1])||0,minutes=parseInt(match[2])||0,seconds=parseInt(match[3])||0;return 3600*hours+60*minutes+seconds},$scope.getBestThumbnail=function(t){return t.maxres?t.maxres.url:t.high?t.high.url:t.medium?t.medium.url:t.standard?t.standard.url:""}});