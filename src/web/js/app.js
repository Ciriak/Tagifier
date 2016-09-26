var app = angular.module('tagifier', [
'ui.bootstrap',
'ngSanitize',
'pascalprecht.translate',
'angular-electron',
'ngAudio'
    ]);

app.config(['$translateProvider', function($translateProvider) {
  $translateProvider.useStaticFilesLoader({
    prefix: 'locales/',
    suffix: '.json'
  });
  var remote = require('electron').remote;
  var lang = remote.app.getLocale();
  $translateProvider.preferredLanguage(lang).fallbackLanguage('en');
}]);

app.filter("trustUrl", ['$sce', function ($sce) { //used by media player
    return function (recordingUrl) {
        return $sce.trustAsResourceUrl(recordingUrl);
    };
}]);

app.controller('mainCtrl', ['$scope', '$http','$rootScope','$translate','$window','$location', function($scope, $http,$rootScope,$translate,$window,$location)
{
  $rootScope.remote = require('electron').remote;

    var Menu = $rootScope.remote.Menu;
    var MenuItem = $rootScope.remote.MenuItem;
    $rootScope.version = $rootScope.remote.app.getVersion();

    var template = [
    {
      label: 'About',
      role: 'about',
      submenu: [
        {
          label: 'Tagifier (v'+$rootScope.version+')'
        },
        {
          type: 'separator'
        },
        {
          label: 'Github page',
          click : function() { $rootScope.remote.shell.openExternal('https://github.com/Cyriaqu3/tagifier'); }
        },
        {
          label: 'Report an issue',
          click : function() { $rootScope.remote.shell.openExternal('https://github.com/Cyriaqu3/tagifier/issues/new'); }
        },
        {
          label: 'Author Website',
          click : function(){ $rootScope.remote.shell.openExternal('http://www.cyriaquedelaunay.fr'); }
        }
      ]
    }
  ];
  var menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  $rootScope.ipc = $rootScope.remote.ipcMain;

  //player logged
  $rootScope.ipc.on("updateAvailable", function(update){
    $rootScope.updateAvailable = true;
    if(!$scope.$$phase) {
      $scope.$apply();
    }
  });

  $rootScope.installUpdate = function(){
    $rootScope.ipc.emit("installUpdate");
  }

}]);
