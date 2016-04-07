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
  
  var availableLang = [
  'fr',
  'en'];

  for (var i = 0; i < availableLang.length; i++)
  {

  };
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
  $scope.socket = io.connect('http://localhost:8080');
  $scope.socket.on('connect', function()
  {
    console.log("Socket connected !");
  });

  $rootScope.$on('$stateChangeStart', 
  function(event, toState, toParams, fromState, fromParams)
  {
    /*if(!$cookies.get("sbstr_token") && document.location.hash != "#/"){ //auto redirect unlogged users
      document.location.hash = "/";
      location.reload();
    }*/
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