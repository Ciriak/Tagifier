var app = angular.module('tagifier', [
'ui.router',
'ui.bootstrap',
'youtube-embed',
'ngSanitize',
'pascalprecht.translate'
    ]);

app.config(function($stateProvider, $urlRouterProvider) {
  //
  // For any unmatched url, redirect to /
  $urlRouterProvider.otherwise("/");
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
      url: "/{fileId:.*?}",
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
