
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

/*
notes:

io.emit sends out to everyone including yourself
socket.broadcast.emit sends to everyone except yourself

*/
io.on('connection', function(socket) {
	socket.on('chat message', function(msg){
		console.log('A user sent: ' + msg);
		io.emit('chat message', msg);
	});

	// connection - broadcast to others except yourself
	socket.broadcast.emit('chat message', 'A user has connected');

	// disconnection
	socket.on('disconnect', function(){
		io.emit('chat message', 'A user has disconnected');
	});
});

http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




