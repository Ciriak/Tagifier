var electronVersion = "1.0.1";


var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var sass = require('gulp-sass');
var htmlmin = require('gulp-htmlmin');
var jsonminify = require('gulp-jsonminify');
var install = require("gulp-install");
var del = require('del');
var imageop = require('gulp-image-optimization');
var ngmin = require('gulp-ngmin');
var nodemon = require('gulp-nodemon');
var bower = require('gulp-bower');
var packager = require('electron-packager');
var packageJson = require('./src/package.json');
var plumber = require('gulp-plumber');  //prevent watch crash
var gulpsync = require('gulp-sync')(gulp);
var winInstaller = require('electron-winstaller');

//retreive package.json data
var pjson = require('./package.json');

gulp.task('server', function () {
  nodemon({
    script: 'app.js'
  , ext: 'js html css scss'
  , env: { 'NODE_ENV': 'development' }
  })
});

gulp.task('sass', function () {
  return gulp.src('./src/web/style/**/*.scss')
    .pipe(plumber())
    .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
    .pipe(gulp.dest('./dist/web/css'));
});

gulp.task('clean:dist', function() {
  return del('./dist/**/*');
});

gulp.task('clean:build', function() {
  return del('./build/**/*');
});

gulp.task('install-dependencies', function() {
  return bower({ cwd: './src/web',interactive:true });
});

gulp.task('scripts', function() {
  return gulp.src('./src/web/js/**/*.js')
    .pipe(plumber())
    .pipe(ngmin())
  	.pipe(uglify({mangle: false}))
    .pipe(concat('tagifier.js'))
    .pipe(gulp.dest('./dist/web/js/'));
});

gulp.task('images', function(cb) {
    gulp.src(['src/web/**/*.png','src/web/**/*.jpg','src/web/**/*.gif','src/web/**/*.jpeg','src/web/**/*.svg','src/web/**/*.ico']).pipe(imageop({
        optimizationLevel: 5,
        progressive: true,
        interlaced: true
    })).pipe(gulp.dest('./dist/web')).on('end', cb).on('error', cb);
});

gulp.task('copy-dependencies', function() {
  gulp.src('./src/web/bower_components/**/*')
  .pipe(gulp.dest('./dist/web/dep/'));
});

gulp.task('html', function() {
  return gulp.src('src/web/**/*.html')
    .pipe(plumber())
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('./dist/web'))
});

gulp.task('locales', function () {
    return gulp.src(['./src/web/locales/*.json'])
        .pipe(jsonminify())
        .pipe(gulp.dest('./dist/web/locales/'));
});

gulp.task('install-dist-dep',function(){
  return gulp.src(['./dist/package.json'])
  .pipe(install());
});

gulp.task('copy-electron-components',function(){
  return gulp.src(['./src/*.js', './src/*.json'])
  .pipe(gulp.dest('./dist'))
});

gulp.task('electron-build', function(callback) {
  var options = {
        dir: "./dist",
        name: "tagifier",
        platform: "win32",
        arch: "x64",
        'app-version':pjson.version,
        'build-version':pjson.version,
        overwrite: true,
        icon: "./dist/web/img/tgf/icon_circle.png",
        out: "build"
    };
    packager(options, function done (err, appPath) {
        if(err) { return console.log(err); }
        callback();
    });
});

gulp.task('watch', function () {
  gulp.watch('./src/web/style/**/*.scss', ['sass']);
  gulp.watch('./src/web/**/*.html', ['html']);
  gulp.watch('./src/web/**/*.js', ['scripts']);
  gulp.watch('./src/*', ['copy-electron-components']);
});

gulp.task('create-windows-installer',function(){
  del('./release/**/*');
  return resultPromise = winInstaller.createWindowsInstaller({
    appDirectory: './build/tagifier-win32-x64',
    outputDirectory: './release',
    authors: 'Cyriaque DELAUNAY',
    setupIcon : './src/web/img/tgf/icon_setup.ico',
    exe: 'Tagifier.exe',
    noMsi : true,
    title : 'Tagifier'
  });

resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`));

});

gulp.task('prepare-dev-env', gulpsync.sync([
    // sync
    'clean:dist',
    ['install-dependencies'],
    [
        // async
        'sass',
        'scripts',
        'html',
        'copy-dependencies',
        'images',
        'locales',
        'copy-electron-components',
    ],
    ['install-dist-dep']
]));

gulp.task('build', gulpsync.sync([
    ['clean:build'],
    ['prepare-dev-env'],
    ['electron-build'],
    ['create-windows-installer']
]));

gulp.task('default', gulpsync.sync([
    ['prepare-dev-env'],
    ['watch']
]));
