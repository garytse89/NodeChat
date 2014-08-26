
/**
 * Module dependencies.
 */

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var routes = require('./routes');
var user = require('./routes/user');
var path = require('path');

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

io.on('connection', function(socket) {
	console.log('socket ocnnected');
});

http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




