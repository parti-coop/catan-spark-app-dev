var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mustacheLayout = require("mustache-layout");

var dbpath = path.join(__dirname, '_db');
var dbm = require("./dbm");
dbm.open(dbpath);

var users = require('./routes/users');
var myapi = require('./routes/api');

var app = express();

// some environment variables
app.locals.title = "Parti WebDemo";

// view engine setup
app.set('views', path.join(__dirname, 'templates'));
app.set('view engine', 'html');
app.set("view options", {layout: true});
app.engine('html', mustacheLayout);

// uncomment after placing your favicon in /static
//app.use(favicon(path.join(__dirname, 'static', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'static')));

app.get('/', users.mainPageHandler);
app.get('/_AppStart', users.appstartPageHandler);
app.use('/user', users.routes);
app.use('/api', myapi);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
