var app=angular.module("tagifier",["ui.router","youtube-embed","ngSanitize","pascalprecht.translate"]);app.config(function(t,e){e.otherwise("/"),e.when("/{sheetId:int}","/{sheetId:int}/chat"),e.when("/{sheetId:int}/settings","/{sheetId:int}/settings/info"),e.when("/{sheetId:int}/users","/{sheetId:int}/users/list"),t.state("main",{url:"/",templateUrl:"views/index.html",reload:!0}).state("about",{url:"/about",templateUrl:"views/about.html"}).state("file",{url:"/{fileId}",templateUrl:"views/file.html",controller:"fileCtrl",reload:!0}).state("playlist",{url:"/playlist/{fileId}",templateUrl:"views/playlist.html",controller:"playlistCtrl",reload:!0})}),app.config(["$translateProvider",function(t){t.useSanitizeValueStrategy("sanitize"),t.useStaticFilesLoader({prefix:"../locales/",suffix:".json"}),t.preferredLanguage("en")}]),app.controller("mainCtrl",["$scope","$http","$rootScope","$translate","$window","$location",function(t,e,i,o,n,a){t.docReady=!1,$(window).load(function(){n.ga("create","UA-48635201-13","auto"),t.docReady=!0,t.$apply(),setTimeout(function(){FB.XFBML.parse(),500})}),t.socket=io.connect(),t.socket.on("connect",function(){console.log("Socket connected !")}),$(document).hover(function(){$("#youtube-url").focus()}),$(document).click(function(){$("#youtube-url").focus()}),t.lastCommit="Tagifier",e({method:"GET",url:"https://api.github.com/repos/CYRIAQU3/tagifier/commits"}).then(function(e){t.lastCommit=e.data[0].sha.substring(0,8),t.lastUser=e.data[0].author.login}),"denied"===Notification.permission&&"default"!==Notification.permission||isMobile.any||(console.log("notMobile"),Notification.requestPermission()),i.$on("$stateChangeStart",function(t,e,i,o,n){$(".toast").remove()}),i.$on("$stateChangeSuccess",function(t){n.ga("send","pageview",a.path())})}]),app.directive("targetBlank",function(){return{restrict:"A",link:function(t,e,i){e.href;e.attr("target","_blank")}}});

app.controller("fileCtrl",function(e,t,a,r,i){e.baseStr,e.userPattern,e.pattern,e.canStartProcess=!1,e.processing=!1,e.canEditTags=!1,e.file={},e.progress=0,e.progressStatus="waiting",e.captchatActive=!1,e.notified=!1,e.exportFile={},a({method:"GET",url:"/api/file/"+r.fileId}).then(function(t){n(t.data),e.canEditTags=!0,e.canStartProcess=!0},function(t){e.retreiveInfoError()});var n=function(t){e.file=t.items[0],e.exportFile.image=getBestThumbnail(e.file.snippet.thumbnails),e.exportFile.year=e.file.snippet.publishedAt.substr(0,4),e.exportFile.id=r.fileId;var a=e.file.contentDetails.duration;if(YTDurationToSeconds(a)>600)return e.canEditTags=!1,e.canStartProcess=!1,Materialize.toast(i.instant("error.fileTooLong"),1e4),void e.$apply();var n=e.file.snippet.localized.title.split(" - ");e.userPattern="%artist% - %title%",2==n.length?e.baseStr=e.file.snippet.localized.title:e.baseStr=e.file.snippet.channelTitle+" - "+e.file.snippet.localized.title,e.genPattern()};e.genPattern=function(){e.pattern=e.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)"),e.vars=e.userPattern.match(/%([a-zA-Z0-9])\w+%/g);for(var t=0;t<e.vars.length;t++)e.vars[t]=e.vars[t].replace("%","").replace("%","");var a=e.baseStr.match(new RegExp(e.pattern));if(!a)return void(e.canDownload=!1);for(var t=0;t<e.vars.length;t++)a[t+1]&&(e.exportFile[e.vars[t]]=a[t+1])},e.retreiveInfoError=function(){e.canEditTags=!1,e.canStartProcess=!1,Materialize.toast(i.instant("error.unableToRetreiveFileData"),1e4),e.$apply()},e.requestFile=function(){e.processing=!0,e.socket.emit("fileRequest",{file:e.exportFile})},e.requestProcess=function(){e.captchatActive?e.checkCaptchat():(Materialize.toast(i.instant("file.pleaseEnterCaptchat"),4e3),e.generateCaptchat())},e.generateCaptchat=function(){e.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},e.checkCaptchat=function(){var t=$("#adcopy_response").val(),r=$("#adcopy_challenge").val();a({method:"POST",url:"/checker",data:{chal:r,resp:t}}).then(function(t){e.captchatActive=!1,e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.requestFile()},function(t){e.processing=!1,Materialize.toast(i.instant("error.invalidCaptchat"),4e3),e.generateCaptchat()})},e.socket.on("yd_event",function(t){console.log(t),"progress"==t.event&&t.data.videoId==e.exportFile.id&&(e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.progress=t.data.progress.percentage,e.progressStatus="processing",e.$apply()),"error"==t.event&&(e.buttonLabel="Download",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,Materialize.toast(i.instant("error.internalError"),4e3)),"finished"==t.event&&t.data.id==e.exportFile.id&&(e.progressStatus="ready",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,e.exportFile.url=t.data.url.replace("./exports/","musics/"),e.tgfDownload()),e.$apply()}),e.tgfDownload=function(){var t,a={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||e.notified||isMobile.any)Materialize.toast("Your file is ready",4e3);else{e.notified=!0;var t=new Notification(a.title,a);t.onclick=function(){window.open(e.exportFile.url+"?name="+e.exportFile.artist+" - "+e.exportFile.title,"_blank"),t.close()}}}});var YTDurationToSeconds=function(e){var t=e.match(/PT(\d+H)?(\d+M)?(\d+S)?/),a=parseInt(t[1])||0,r=parseInt(t[2])||0,i=parseInt(t[3])||0;return 3600*a+60*r+i},getBestThumbnail=function(e){return e.maxres?e.maxres.url:e.high?e.high.url:e.medium?e.medium.url:e.standard?e.standard.url:""};
app.controller("mainInputCtrl",function(r,l,i){r.currentUrl,r.goodUrl=!1,r.playlist=!1,r.currentId,r.checkUrl=function(){var l=t(r.currentUrl);return l.id||l.playlist?(l.id&&(r.goodUrl=!0,r.currentId=l.id),void(l.playlist&&(r.goodUrl=!0,r.playlist=!0,r.currentId=l.playlist))):(console.log(l),r.goodUrl=!1,void console.log("bad"))},r.miSubmit=function(){if(r.goodUrl){if(r.playlist)return void l.go("playlist",{fileId:r.currentId});l.go("file",{fileId:r.currentId})}else Materialize.toast(i.instant("error.invalidLink"),4e3)};var t=function(r){var l={},i=/^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/,t=r.match(i);t&&11==t[7].length&&(l.id=t[7]),i=/(?:(?:\?|&)list=)((?!videoseries)[a-zA-Z0-9_-]*)/g;var t=i.exec(r);return t&&t[1]&&(l.playlist=t[1]),l}});
app.controller("playlistCtrl",function(e,t,a,r,i){e.baseStr,e.userPattern,e.pattern,e.canStartProcess=!1,e.processing=!1,e.canEditTags=!1,e.playlist={},e.progress=0,e.progressStatus="waiting",e.captchatActive=!1,e.notified=!1,e.modelFile={},a({method:"GET",url:"/api/playlist/"+r.fileId}).then(function(t){n(t.data),e.canEditTags=!0,e.canStartProcess=!0},function(t){e.retreiveInfoError()});var n=function(t){console.log(t),e.playlist=t,e.modelFile.image=getBestThumbnail(e.playlist[0].thumbnails),e.modelFile.year=e.playlist[0].publishedAt.substr(0,4),e.modelFile.id=r.fileId;var a=e.playlist[0].title.split(" - ");e.userPattern="%album% - %title%",2==a.length?e.baseStr=e.playlist[0].title:e.baseStr=e.playlist[0].channelTitle+" - "+e.playlist[0].localized.title,e.genPattern()};e.genPattern=function(){e.pattern=e.userPattern.replace(/%([a-zA-Z0-9])\w+%/g,"(.*)"),e.vars=e.userPattern.match(/%([a-zA-Z0-9])\w+%/g);for(var t=0;t<e.vars.length;t++)e.vars[t]=e.vars[t].replace("%","").replace("%","");var a=e.baseStr.match(new RegExp(e.pattern));if(!a)return void(e.canDownload=!1);for(var t=0;t<e.vars.length;t++)a[t+1]&&(e.modelFile[e.vars[t]]=a[t+1])},e.retreiveInfoError=function(){e.canEditTags=!1,e.canStartProcess=!1,Materialize.toast(i.instant("error.unableToRetreiveFileData"),1e4),e.$apply()},e.requestFile=function(){e.processing=!0,e.socket.emit("fileRequest",{file:e.modelFile})},e.requestProcess=function(){e.captchatActive?e.checkCaptchat():(Materialize.toast(i.instant("file.pleaseEnterCaptchat"),4e3),e.generateCaptchat())},e.generateCaptchat=function(){e.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},e.checkCaptchat=function(){var t=$("#adcopy_response").val(),r=$("#adcopy_challenge").val();a({method:"POST",url:"/checker",data:{chal:r,resp:t}}).then(function(t){e.captchatActive=!1,e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.requestFile()},function(t){e.processing=!1,Materialize.toast(i.instant("error.invalidCaptchat"),4e3),e.generateCaptchat()})},e.socket.on("yd_event",function(t){console.log(t),"progress"==t.event&&t.data.videoId==e.modelFile.id&&(e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.progress=t.data.progress.percentage,e.progressStatus="processing",e.$apply()),"error"==t.event&&(e.buttonLabel="Download",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,Materialize.toast(i.instant("error.internalError"),4e3)),"finished"==t.event&&t.data.id==e.modelFile.id&&(e.progressStatus="ready",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,e.modelFile.url=t.data.url.replace("./exports/","musics/"),e.tgfDownload()),e.$apply()}),e.tgfDownload=function(){var t,a={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||e.notified||isMobile.any)Materialize.toast("Your file is ready",4e3);else{e.notified=!0;var t=new Notification(a.title,a);t.onclick=function(){window.open(e.modelFile.url+"?name="+e.modelFile.artist+" - "+e.modelFile.title,"_blank"),t.close()}}}});var YTDurationToSeconds=function(e){var t=e.match(/PT(\d+H)?(\d+M)?(\d+S)?/),a=parseInt(t[1])||0,r=parseInt(t[2])||0,i=parseInt(t[3])||0;return 3600*a+60*r+i},getBestThumbnail=function(e){return e.maxres?e.maxres.url:e.high?e.high.url:e.medium?e.medium.url:e.standard?e.standard.url:""};
app.controller("youtubeCtrl",function(e,t,a,r,i){e.baseStr,e.userPattern,e.pattern,e.canStartProcess=!1,e.processing=!1,e.canEditTags=!1,e.file={},e.progress=0,e.progressStatus="waiting",e.captchatActive=!1,e.notified=!1,e.exportFile={},e.retreiveInfoError=function(){e.canEditTags=!1,e.canStartProcess=!1,Materialize.toast(i.instant("error.unableToRetreiveFileData"),1e4),e.$apply()},e.requestFile=function(){e.processing=!0,e.socket.emit("fileRequest",{file:e.exportFile})},e.requestProcess=function(){e.captchatActive?e.checkCaptchat():(Materialize.toast(i.instant("file.pleaseEnterCaptchat"),4e3),e.generateCaptchat())},e.generateCaptchat=function(){e.captchatActive=!0,ACPuzzle.create("buxt.317r8uls-ge9STPl6ilzpmYgl8G","solve-media-container","")},e.checkCaptchat=function(){var t=$("#adcopy_response").val(),r=$("#adcopy_challenge").val();a({method:"POST",url:"/checker",data:{chal:r,resp:t}}).then(function(t){e.captchatActive=!1,e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.requestFile()},function(t){e.processing=!1,Materialize.toast(i.instant("error.invalidCaptchat"),4e3),e.generateCaptchat()})},e.socket.on("yd_event",function(t){console.log(t),"progress"==t.event&&t.data.videoId==e.exportFile.id&&(e.processing=!0,e.canEditTags=!1,e.canStartProcess=!1,e.progress=t.data.progress.percentage,e.progressStatus="processing",e.$apply()),"error"==t.event&&(e.buttonLabel="Download",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,Materialize.toast(i.instant("error.internalError"),4e3)),"finished"==t.event&&t.data.id==e.exportFile.id&&(e.progressStatus="ready",e.processing=!1,e.canEditTags=!0,e.canStartProcess=!0,e.exportFile.url=t.data.url.replace("./exports/","musics/"),e.tgfDownload()),e.$apply()}),e.tgfDownload=function(){var t,a={title:"File Ready",body:"Your file is ready to download, click on this notification to download it !",icon:"img/tgf/icon_circle.png"};if("granted"!==Notification.permission||e.notified||isMobile.any)Materialize.toast("Your file is ready",4e3);else{e.notified=!0;var t=new Notification(a.title,a);t.onclick=function(){window.open(e.exportFile.url+"?name="+e.exportFile.artist+" - "+e.exportFile.title,"_blank"),t.close()}}},e.YTDurationToSeconds=function(e){var t=e.match(/PT(\d+H)?(\d+M)?(\d+S)?/),a=parseInt(t[1])||0,r=parseInt(t[2])||0,i=parseInt(t[3])||0;return 3600*a+60*r+i},e.getBestThumbnail=function(e){return e.maxres?e.maxres.url:e.high?e.high.url:e.medium?e.medium.url:e.standard?e.standard.url:""}});