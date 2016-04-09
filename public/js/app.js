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

app.controller('mainCtrl', ['$scope', '$http','$rootScope','$translate', function($scope, $http,$rootScope,$translate)
{
  $scope.docReady = false;
  $(window).load(function(){
    $scope.docReady = true;
    $scope.$apply();
  });
  $scope.socket = io.connect();
  $scope.socket.on('connect', function()
  {
    console.log("Socket connected !");
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
    	if(isNewNotificationSupported())
		{
			Notification.requestPermission();
		}
  	}
  $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){
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

function isNewNotificationSupported() {
    if (!window.Notification || !Notification.requestPermission)
        return false;
    if (Notification.permission == 'granted')
        //throw new Error('You must only call this *before* calling Notification.requestPermission(), otherwise this feature detect would bug the user with an actual notification!');
    try {
        new Notification('');
    } catch (e) {
        if (e.name == 'TypeError')
            return false;
    }
    return true;
}