var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var sass = require('gulp-sass');
var htmlmin = require('gulp-htmlmin');
var jsonminify = require('gulp-jsonminify');
var del = require('del');
var imageop = require('gulp-image-optimization');
var ngmin = require('gulp-ngmin');
var plumber = require('gulp-plumber');  //prevent watch crash
var gulpsync = require('gulp-sync')(gulp);

gulp.task('sass', function () {
  return gulp.src('./src/style/**/*.scss')
    .pipe(plumber())
    .pipe(sass({outputStyle: 'compressed'}).on('error', sass.logError))
    .pipe(gulp.dest('./public/css'));
});

gulp.task('clean:public', function() {
  return del('./public/**/*');
});

gulp.task('scripts', function() {
  return gulp.src('./src/js/**/*.js')
    .pipe(plumber())
    .pipe(ngmin())
  	.pipe(uglify({mangle: false}))
    .pipe(concat('tagifier.js'))
    .pipe(gulp.dest('./public/js/'));
});

gulp.task('images', function(cb) {
    gulp.src(['src/**/*.png','src/**/*.jpg','src/**/*.gif','src/**/*.jpeg']).pipe(imageop({
        optimizationLevel: 5,
        progressive: true,
        interlaced: true
    })).pipe(gulp.dest('./public')).on('end', cb).on('error', cb);
});

gulp.task('bower', function() {
  gulp.src('./src/bower_components/**/*')
  .pipe(gulp.dest('./public/dep/'));
});

gulp.task('html', function() {
  return gulp.src('src/**/*.html')
    .pipe(plumber())
    .pipe(htmlmin({collapseWhitespace: true}))
    .pipe(gulp.dest('./public/'))
});

gulp.task('locales', function () {
    return gulp.src(['./src/locales/*.json'])
        .pipe(jsonminify())
        .pipe(gulp.dest('./public/locales/'));
});

gulp.task('watch', function () {
  gulp.watch('./src/style/**/*.scss', ['sass']);
  gulp.watch('./src/**/*.html', ['html']);
  gulp.watch('./src/**/*.js', ['scripts']);
});

gulp.task('default', gulpsync.sync([
    // sync
    'clean:public',
    [
        // async
        'sass',
        'scripts',
        'html',
        'bower',
        'images',
        'locales'
    ]
]));
