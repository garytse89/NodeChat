
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

var chance = require('Chance')();

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
} else {
	// Heroku won't actually allow us to use WebSockets
	// so we have to setup polling instead.
	// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
	io.configure(function () {
	  io.set("transports", ["xhr-polling"]);
	  io.set("polling duration", 10);
	});
}

app.get('/', routes.index);
app.get('/users', user.list);

/*
notes:

io.emit sends out to everyone including yourself
socket.broadcast.emit sends to everyone except yourself

*/

var usernames = {}; // key: socket-id, value: username

io.on('connection', function(socket) {
	socket.on('chat message', function(msg){
		var msgObject = {'username': usernames[socket.id],
						 'message': msg};
		socket.broadcast.emit('chat message', JSON.stringify(msgObject));
	});

	// disconnection
	socket.on('disconnect', function(){
		socket.broadcast.emit('user list update', usernames);
		socket.broadcast.emit('notification', usernames[socket.id] + ' has disconnected');
		delete usernames[socket.id];
	});

	socket.on('connected', function(){
		var newName = chance.first() + chance.integer({min:1,max:1000});
		usernames[socket.id] = newName;
		socket.emit('assign username', newName);
		socket.broadcast.emit('notification', newName + ' has connected');
		io.emit('user list update', usernames);
	});

	socket.on('typing', function() {
		socket.broadcast.emit('started typing', usernames[socket.id]);
	});

	socket.on('stopped typing', function(){
		socket.broadcast.emit('stopped typing', usernames[socket.id]);
	});
});

http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




