
/**
 * Module dependencies.
 */

var express = require('express');
var app = express();
var http = require('http').Server(app);
var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8080});	
var mongoose = require('mongoose');

var routes = require('./routes');
var user = require('./routes/user');
var path = require('path');

var chance = require('chance')();
var uuid = require('node-uuid');

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

// mongoose
mongoose.connect('mongodb://localhost/users');
var userSchema = new mongoose.Schema({
  gender: { type: String },
  country: { type: String}
});
var User = mongoose.model('User', userSchema);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
} 

app.get('/', routes.index);
app.get('/users', user.list);

app.post('/login', function(request, response){
    console.log(request.body);

    response.setHeader('Content-Type', 'text/html');
    response.writeHead(200);
    response.write('ok');
    response.end();
});

var sockets = {};
var usernames = {};

function manualAddUsers(name) {
	usernames[uuid.v4()] = name;
}

// WebSocket

/* 

Protocol:
{ 'event' : '...',
  'data' : '...' }

update_userlist
*/

// manually add a few users
manualAddUsers('Paul');
manualAddUsers('Clara');
manualAddUsers('Nathan');

wss.on('connection', function(ws) {	

	// add to username list
	var newName = chance.first() + chance.integer({min:1,max:1000});
	var newID = uuid.v4()

	sockets[newID] = ws; // update sockets table

	// update new user on who else is on the server
	// do this before you update the usernames list
	updateNewUser(newID);

	usernames[newID] = newName; // update usernames table
	
	ws.send('Welcome to Secret10');	
	console.log('New user connected');

	// notify everyone else that newcomer has joined
	updateOtherUsers(newID);	

	ws.on('message', function(message) {
		var senderName = null;

		for( var id in sockets ) {
			if(sockets[id] == ws) {
				senderName = usernames[id];
			}
		}

		for( var id in sockets ) {
			if(sockets[id] != ws) {
				var obj = { 'event': 'message', 'user': senderName, 'data': message };
				sockets[id].send( JSON.stringify(obj) );
			}
		}
		console.log('Received message = ', message);
	});	

	ws.on('close', function() {
		for( var id in sockets ) {
			if(sockets[id] == ws) {				
				delete sockets[id];
				updateOtherUsers(id);
			}
		}		
	});
});

function updateOtherUsers(id) {
	// update all users except the id passed in
	var obj = { 'event' : 'update_userlist', 'data' : usernames }
	for( var s_id in sockets ) {
		if(s_id != id)
			sockets[s_id].send( JSON.stringify(obj) );
	}
}

function updateNewUser(id) {
	var obj = { 'event' : 'update_userlist', 'data' : usernames }
	sockets[id].send(JSON.stringify(obj));
}


http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




