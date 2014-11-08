var args = require('yargs').argv;
var gulp = require('gulp');
var gulpIf = require('gulp-if');
var debug = require('gulp-debug');
var jshint = require('gulp-jshint');
var todo = require('gulp-todo');
var jasmine = require('gulp-jasmine');

var isDebug = !!args.debug;
var isVerbose = !!args.verbose;
var isStackTrace = !!args.stackTrace;
var cliSrc = args.files;

var config = {
  paths: {
    scripts: ['./**/*.js', '!./**/*.spec.js', '!./node_modules/**/*.js'],
    specs: ['./**/*.spec.js', '!./node_modules/**/*.js'],
    all: ['./**/*.js', '!./node_modules/**/*.js']
  }
};

gulp.task('default', function () {
  // place code for your default task here
});

gulp.task('lint', function (done) {
  return lint(cliSrc || config.paths.scripts);
});

gulp.task('lint:all', function (done) {
  return lint(config.paths.all);
});

gulp.task('lint:spec', function (done) {
  return lint(config.paths.specs);
});

gulp.task('test', ['lint:all'], function (done) {
  return testRunner(cliSrc || config.paths.specs);
});

gulp.task('watch', ['test:unit'], function (done) {
  return gulp.watch(cliSrc || config.paths.all, ['test']);
});

gulp.task('todo', function (done) {
  return gulp.src(config.paths.all)
    .pipe(todo({
      //fileName: 'todo.md',
      verbose: isVerbose,
      //newLine: gutil.linefeed,
      /*
      transformComment: function (file, line, text) {
          return ['| ' + file + ' | ' + line + ' | ' + text];
      },
      transformHeader: function (kind) {
          return ['### ' + kind + 's',
              '| Filename | line # | todo',
              '|:------|:------:|:------'
          ];
      }
      */
    }))
    .pipe(gulp.dest('./'));
});

function testRunner(src) {
  return gulp.src(src)
    .pipe(gulpIf(isDebug, debug()))
    .pipe(jasmine({
      verbose: isVerbose,
      includeStackTrace: isStackTrace
    }));
}

function lint(src) {
  return gulp.src(src)
    .pipe(gulpIf(isDebug, debug()))
    .pipe(jshint())
    .pipe(jshint.reporter('default', {verbose: isVerbose}));
}
