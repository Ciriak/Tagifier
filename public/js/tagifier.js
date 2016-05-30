var app=angular.module("tagifier",["ui.router","ui.bootstrap","youtube-embed","ngSanitize","pascalprecht.translate","cgNotify","angular-electron"]);app.config(["$stateProvider","$urlRouterProvider",function($stateProvider,$urlRouterProvider){$urlRouterProvider.otherwise("/"),$stateProvider.state("main",{url:"/",templateUrl:"views/index.html",reload:!0}).state("about",{url:"/about",templateUrl:"views/about.html"}).state("file",{url:"/{fileUrl:.*?}",templateUrl:"views/file.html",controller:"fileCtrl",reload:!0})}]),app.config(["$translateProvider",function($translateProvider){$translateProvider.useSanitizeValueStrategy("sanitize"),$translateProvider.useStaticFilesLoader({prefix:"locales/",suffix:".json"}),$translateProvider.preferredLanguage("en")}]),app.filter("trustUrl",["$sce",function($sce){return function(recordingUrl){return $sce.trustAsResourceUrl(recordingUrl)}}]),app.controller("mainCtrl",["$scope","$http","$rootScope","$translate","$window","$location","$state",function($scope,$http,$rootScope,$translate,$window,$location,$state){$rootScope.remote=require("electron").remote;var Menu=$rootScope.remote.Menu,template=($rootScope.remote.MenuItem,[{label:"File",submenu:[{label:"New task",click:function(){$state.go("main")}}]},{label:"About",role:"about",submenu:[{label:"Tagifier (Beta)"},{type:"separator"},{label:"Github page",click:function(){$rootScope.remote.shell.openExternal("https://github.com/Cyriaqu3/tagifier")}},{label:"Report an issue",click:function(){$rootScope.remote.shell.openExternal("https://github.com/Cyriaqu3/tagifier/issues/new")}},{label:"Facebook Page",click:function(){$rootScope.remote.shell.openExternal("https://www.facebook.com/Tagifier-1172453299437404/")}}]}]),menu=Menu.buildFromTemplate(template);Menu.setApplicationMenu(menu),$scope.docReady=!1,$(window).load(function(){$window.ga("create","UA-48635201-13","auto"),$scope.docReady=!0,$scope.$apply()}),$scope.socket=io.connect("http://localhost:8080"),$scope.socket.on("connect",function(){console.log("Socket connected !")}),$(document).hover(function(){$("#youtube-url").focus()}),$(document).click(function(){$("#youtube-url").focus()}),$scope.lastCommit="Tagifier",$http({method:"GET",url:"https://api.github.com/repos/CYRIAQU3/tagifier/commits"}).then(function(response){$scope.lastCommit=response.data[0].sha.substring(0,8),$scope.lastUser=response.data[0].author.login}),$rootScope.$on("$stateChangeStart",function(event,toState,toParams,fromState,fromParams){$(".toast").remove()}),$rootScope.$on("$stateChangeSuccess",function(event){$window.ga("send","pageview",$location.path())})}]),app.directive("targetBlank",function(){return{restrict:"A",link:function(scope,element,attrs){element.href;element.attr("target","_blank")}}});
app.controller("fileCtrl",function($scope,$rootScope,$state,$http,$stateParams,$translate,$location,notify,dialog,ipcRenderer,shell){$scope.canStartProcess=!1,$scope.processing=!1,$scope.canEditTags=!1,$scope.fileAvailable=!1,$scope.singleFile=!0,$scope.files={},$scope.dlFileName,$scope.fileReady=!1,$scope.currentFileIndex=0,$scope.exportFiles=[],$scope.progress=0,$scope.captchatActive=!1,$scope.notified=!1,$scope.canRemoveFile=!1,$scope.canAddFile=!0,$scope.filePlayer,$scope.playerStatus="stop",$scope.exportDir;var date=new Date;$scope.filePlayer=document.getElementById("file-player"),$scope.retreiveFilesInfos=function(url){$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.fileAvailable=!1,$scope.canAddFile=!1,$scope.socket.emit("fileInfo",{url:url})};var requestUrl=decodeURI($location.url().substr(1)).replace(/~2F/g,"/");$scope.retreiveFilesInfos(requestUrl);var parseFileData=function(data){var baseIndex=$scope.exportFiles.length;if(baseIndex>0&&($scope.canRemoveFile=!0,$scope.singleFile=!1,$scope.$$phase||$scope.$apply()),data.constructor===Object)$scope.setFileVars(baseIndex,data);else{$scope.singleFile=!1,$scope.canRemoveFile=!0;for(var i=baseIndex;i<data.length;i++)$scope.setFileVars(i,data[i])}};$scope.retreiveInfoError=function(){notify($translate.instant("error.unableToRetreiveFileData")),1==$scope.exportFiles.length&&$state.go("^.main")},$scope.requestFiles=function(exportDir){exportDir&&($scope.processing||($scope.fileReady=!1,$scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.canRemoveFile=!1,$scope.socket.emit("fileRequest",{files:$scope.exportFiles,path:exportDir})))},$scope.removeFileFromList=function(file){if(!$scope.canRemoveFile)return void console.log("You are trying to remove a file from the list... but it seem you cant !");var index=$scope.exportFiles.indexOf(file);$scope.exportFiles.splice(index,1),$scope.exportFiles.length<2&&($scope.singleFile=!0,$scope.canRemoveFile=!1),fileIndex>0?$scope.setCurrentFile(fileIndex-1):$scope.setCurrentFile(0),$scope.$$phase||$scope.$apply()},$scope.reloadPage=function(){location.reload()},$scope.requestProcess=function(){if(!$scope.canStartProcess)return void notify($translate.instant("error.plsFixFileErrors"));var exportDir=dialog.showOpenDialog({properties:["openFile","openDirectory"]});$scope.exportDir=exportDir[0],$scope.requestFiles($scope.exportDir)},$scope.generateCaptchat=function(){$scope.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},$scope.setCurrentFile=function(i){$scope.currentFileIndex=i,$scope.filePlayer.pause(),$scope.playerStatus="stop"},$scope.socket.on("yd_event",function(ev){if(console.log(ev),"file_info"==ev.event&&(parseFileData(ev.data),$scope.canEditTags=!0,$scope.canStartProcess=!0,$scope.fileAvailable=!0,$scope.canAddFile=!0),"file_info_error"==ev.event&&$scope.retreiveInfoError(),"file_download_started"==ev.event){$scope.fileReady=!1;var index=ev.data;$scope.exportFiles[index].processing=!0,$scope.$$phase||$scope.$apply()}if("progress"==ev.event){$scope.fileReady=!1;var data=ev.data,perc=data.size/$scope.exportFiles[data.index].filesize*100;100==perc&&($scope.exportFiles[data.index].converting=!0,$scope.$$phase||$scope.$apply()),$scope.exportFiles[data.index].progress=perc}if("file_error"==ev.event){$scope.fileReady=!1;var data=ev.data;$scope.exportFiles[data.index].error=!0,$scope.$$phase||$scope.$apply()}if("file_finished"==ev.event){$scope.fileReady=!1;var i=ev.data.index;$scope.exportFiles[i].progress=100,$scope.exportFiles[i].converting=!0,$scope.$$phase||$scope.$apply()}if("finished"==ev.event){$scope.fileReady=!0,$scope.notifyExportDir($scope.exportDir);for(var i=0;i<$scope.exportFiles.length;i++)$scope.exportFiles[i].progress=0,$scope.exportFiles[i].converting=!1,$scope.exportFiles[i].processing=!1,$scope.exportFiles[i].error=!1;$scope.processing=!1,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.canRemoveFile=!1,$scope.canAddFile=!1}$scope.$$phase||$scope.$apply()}),$scope.setFileVars=function(index,data){$scope.files[index]=data,$scope.exportFiles[index]={lockedAttrs:[],converting:!1,processing:!1,error:!1,progress:0},$scope.exportFiles[index].webpage_url=$scope.files[index].webpage_url,$scope.exportFiles[index].image=$scope.files[index].thumbnail,$scope.exportFiles[index].filesize=0;for(var o=0;o<$scope.files[index].formats.length;o++)if($scope.files[index].formats[o].filesize){var t=$scope.files[index].formats[o].filesize;t>$scope.exportFiles[index].filesize&&($scope.exportFiles[index].filesize=t)}$scope.files[index].formats[$scope.files[index].formats.length-1].filesize&&($scope.exportFiles[index].filesize=$scope.files[index].formats[$scope.files[index].formats.length-1].filesize),$scope.exportFiles[index].year=date.getFullYear(),data.upload_date&&($scope.exportFiles[index].year=data.upload_date.substr(0,4)),$scope.exportFiles[index].track=index+1;var pt=$scope.files[index].fulltitle.split(" - ");pt.length>1?($scope.exportFiles[index].tagPattern="%artist% - %title%",$scope.exportFiles[index].fileNamePattern="%artist% - %title%",$scope.singleFile||($scope.exportFiles[index].tagPattern="%album% - %title%",$scope.exportFiles[index].fileNamePattern="%track% - %title%")):($scope.exportFiles[index].tagPattern="%title%",$scope.exportFiles[index].fileNamePattern="%title%",data.uploader&&($scope.exportFiles[index].artist=data.uploader)),$scope.genPattern(index);var dur=returnDur($scope.files[index].duration),duration=moment.duration({seconds:dur.s,minutes:dur.m,hours:dur.h});duration.asMinutes()>10&&($scope.exportFiles[index].error=!0,$scope.canStartProcess=!1,notify($translate.instant("error.fileTooLong")))},$scope.overrideProp=function(propName,sourceIndex,isPattern){for(var file in $scope.exportFiles){var targetIndex=parseInt(file);sourceIndex==file||$scope.propIsLocked(propName,targetIndex)||($scope.exportFiles[targetIndex][propName]=$scope.exportFiles[sourceIndex][propName],setAnimation("tag-updated",$(".file-"+targetIndex))),sourceIndex!=file&&$scope.propIsLocked(propName,targetIndex)&&setAnimation("tag-locked",$(".file-"+targetIndex)),isPattern&&$scope.genPattern(targetIndex)}console.log('The tag "'+$scope.exportFiles[sourceIndex][propName]+'" ('+propName+") from the track "+sourceIndex+" has been applyed to all tracks")},$scope.togglePropLock=function(propName,sourceIndex){if(isInArray(propName,$scope.exportFiles[sourceIndex].lockedAttrs)){var index=$scope.exportFiles[sourceIndex].lockedAttrs.indexOf(propName);$scope.exportFiles[sourceIndex].lockedAttrs.splice(index,1)}else $scope.exportFiles[sourceIndex].lockedAttrs.push(propName)},$scope.propIsLocked=function(propName,sourceIndex){return $scope.exportFiles[sourceIndex]?!!isInArray(propName,$scope.exportFiles[sourceIndex].lockedAttrs):!1},$scope.genPattern=function(index){console.log("Generating pattern for "+$scope.files[index].fulltitle+"...");for(var fileData=$scope.exportFiles[index],pattern=fileData.tagPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)"),fileVars=fileData.tagPattern.match(/%([a-zA-Z0-9])\w+%/g),i=0;i<fileVars.length;i++)fileVars[i]=fileVars[i].replace("%","").replace("%","");var extrData=$scope.files[index].fulltitle.match(new RegExp(pattern));if(extrData){for(var i=0;i<fileVars.length;i++)extrData[i+1]&&(fileData[fileVars[i]]=extrData[i+1]);if($scope.getDynamicHeight=function(elem){var w=$("."+elem).width();return w},!fileData.fileNamePattern)return void(fileData.fileName=fileData.artist+" - "+fileData.title);for(var fileVars=fileData.fileNamePattern.match(/%([a-zA-Z0-9])\w+%/g),fnp=fileData.fileNamePattern,i=0;i<fileVars.length;i++){var tag=fileVars[i].replace("%","").replace("%","");fnp=fnp.replace(fileVars[i],fileData[tag])}fileData.fileName=fnp}},$scope.togglePlayer=function(){$scope.filePlayer.paused?($scope.filePlayer.play(),$scope.playerStatus="play"):($scope.filePlayer.pause(),$scope.playerStatus="pause")},$scope.showAddFileModal=function(){$("#add-file-modal").modal("show")},$scope.hideAddFileModal=function(){$("#add-file-modal").modal("hide")},$scope.openExportDir=function(path){shell.openItem(path)},$scope.notifyExportDir=function(path){var notification,nOptions={title:"File Ready",body:"Your file(s) are ready, click here to open them",icon:"img/tgf/icon_circle.png"};if("granted"===Notification.permission&&!$scope.notified){$scope.notified=!0;var notification=new Notification(nOptions.title,nOptions);notification.onclick=function(){$scope.openExportDir($scope.exportDir),notification.close()}}}});var YTDurationToSeconds=function(duration){var match=duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/),hours=parseInt(match[1])||0,minutes=parseInt(match[2])||0,seconds=parseInt(match[3])||0;return 3600*hours+60*minutes+seconds},getBestThumbnail=function(t){return t.maxres?t.maxres.url:t.high?t.high.url:t.medium?t.medium.url:t.standard?t.standard.url:""},returnDur=function(dur){var d={h:0,m:0,s:0},dur=dur.split(":");return 3==dur.length&&(d.h=dur[0],d.m=dur[1],d.s=dur[2]),2==dur.length?(d.m=dur[0],d.s=dur[1]):d.s=dur[0],d},isInArray=function(value,array){return array.indexOf(value)>-1},setAnimation=function(animation,target){target.addClass(animation),setTimeout(function(){target.removeClass(animation)},500)};
app.controller("mainInputCtrl",function($scope,$state,$translate){$scope.currentUrl,$scope.goodUrl=!1,$scope.playlist=!1,$scope.currentId,$scope.checkUrl=function(){$scope.goodUrl=!0},$scope.miSubmit=function(){var convertUrl=encodeURI($scope.currentUrl);console.log(convertUrl),$scope.goodUrl?$state.go("file",{fileUrl:convertUrl}):alert($translate.instant("error.invalidLink"))}});
app.controller("youtubeCtrl",function($scope,$state,$http,$stateParams,$translate){$scope.baseStr,$scope.userPattern,$scope.pattern,$scope.canStartProcess=!1,$scope.processing=!1,$scope.canEditTags=!1,$scope.file={},$scope.progress=0,$scope.progressStatus="waiting",$scope.captchatActive=!1,$scope.notified=!1,$scope.exportFile={},$scope.retreiveInfoError=function(){$scope.canEditTags=!1,$scope.canStartProcess=!1,Materialize.toast($translate.instant("error.unableToRetreiveFileData"),1e4),$scope.$apply()},$scope.requestFile=function(){$scope.processing=!0,$scope.socket.emit("fileRequest",{file:$scope.exportFile})},$scope.requestProcess=function(){$scope.captchatActive?$scope.checkCaptchat():(Materialize.toast($translate.instant("file.pleaseEnterCaptchat"),4e3),$scope.generateCaptchat())},$scope.generateCaptchat=function(){$scope.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},$scope.checkCaptchat=function(){var resp=$("#adcopy_response").val(),chal=$("#adcopy_challenge").val();$http({method:"POST",url:"/checker",data:{chal:chal,resp:resp}}).then(function(r){$scope.captchatActive=!1,$scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.requestFile()},function(r){$scope.processing=!1,Materialize.toast($translate.instant("error.invalidCaptchat"),4e3),$scope.generateCaptchat()})},$scope.socket.on("yd_event",function(ev){console.log(ev),"progress"==ev.event&&ev.data.videoId==$scope.exportFile.id&&($scope.processing=!0,$scope.canEditTags=!1,$scope.canStartProcess=!1,$scope.progress=ev.data.progress.percentage,$scope.progressStatus="processing",$scope.$apply()),"error"==ev.event&&($scope.buttonLabel="Download",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,Materialize.toast($translate.instant("error.internalError"),4e3)),"finished"==ev.event&&ev.data.id==$scope.exportFile.id&&($scope.progressStatus="ready",$scope.processing=!1,$scope.canEditTags=!0,$scope.canStartProcess=!0,$scope.exportFile.url=ev.data.url.replace("./exports/","musics/"),$scope.tgfDownload()),$scope.$apply()}),$scope.tgfDownload=function(){var notification,nOptions={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||$scope.notified)Materialize.toast("Your file is ready",4e3);else{$scope.notified=!0;var notification=new Notification(nOptions.title,nOptions);notification.onclick=function(){window.open($scope.exportFile.url+"?name="+$scope.exportFile.artist+" - "+$scope.exportFile.title,"_blank"),notification.close()}}},$scope.YTDurationToSeconds=function(duration){var match=duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/),hours=parseInt(match[1])||0,minutes=parseInt(match[2])||0,seconds=parseInt(match[3])||0;return 3600*hours+60*minutes+seconds},$scope.getBestThumbnail=function(t){return t.maxres?t.maxres.url:t.high?t.high.url:t.medium?t.medium.url:t.standard?t.standard.url:""}});