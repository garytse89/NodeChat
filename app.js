
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
	user_id: { type: String },
	username: { type: String },
	info: {
		gender: { type: String },
  		country: { type: String },
	},
	conversations: {}
});

var chatSchema = new mongoose.Schema({
	chat_id: { type: String },
	messages: {}
});

var User = mongoose.model('User', userSchema);
var Chat = mongoose.model('Chat', chatSchema);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
} 

app.get('/', routes.index);
app.get('/users', user.list);

app.post('/login', function(request, response){
    console.log(request.body);

    // validate data
    if(request.body.gender && request.body.country) {    

	    // store data in mongoDB; assign a username
	    var newID = uuid.v4()
	    var newName = chance.first() + chance.integer({min:1,max:1000});
	    var newUser = new User({
	    	user_id: newID,
	    	username: newName,
	    	info: {
  				gender : request.body.gender,
  				country : request.body.country
  			}
  		});

  		newUser.save(function(err, user) {
		  if (err) return console.error('Error', err);
		  console.dir('Created record for user', user);
		});

		// write back the username and user_id to be saved on Android app
		response.setHeader('Content-Type', 'text/html');
	    response.writeHead(200);
	    response.write(JSON.stringify( { 'username' : newName,
										 'user_id' : newID }));
	    response.end();
	} else {
		response.setHeader('Content-Type', 'text/html');
	    response.writeHead(404);
	    response.write("Invalid fields");
	    response.end();
	}
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
	ws.send(JSON.stringify({ 'event': 'assign_id', 'data': newID, 'username' : newName })); // assign UUID

	console.log('New user connected');

	// notify everyone else that newcomer has joined
	updateOtherUsers(newID);	

	ws.on('message', function(message) {

		// message is for updating convo list. check if JSON
		try {
			var jsonObj = JSON.parse(message)
			console.log(jsonObj);

			if(jsonObj.event == "forceadd") {
				console.log("OK GOOD");
				User.update( { 'user_id' : 'b521dd6b-3cd1-422b-953e-36cbc4cdd656' },
							 { $push: { 'conversations' : { 'hicres' : 'bing' }} },
							 { upsert: true },
							 function(err){
						        if(err){
						                console.log(err);
						        } else{
						                console.log("Successfully added");
						        }
						    });
			} else if(jsonObj.event == "checkexist") {
				// var found = false;
				// var originID = jsonObj.data.originID;
				// var destinationID = jsonObj.data.destinationID;

				// // check whether or not the origin user's conversation array contains the destinationID as a key
				// User.find( { 'user_id' : jsonObj.data.originID },
				// 			 function (err, docs) {
				// 			 	chats = docs[0].toObject().conversations;

				// 			 	// O(n) time... :()
				// 			 	for(var i in chats) {
				// 					if( chats[i][destinationID] ) {
				// 						chatID = chats[i][destinationID];
				// 						found = true;
				// 						console.log('found');
				// 					}
				// 				}

				// 				if(found) {
				// 					writeChatLog(chatID,ws); // found chat document, write it back
				// 				} else {
				// 					createChatLog(originID, destinationID); // create a new chat log in mongoDB
				// 				}
				// 		     });					
			} else if(jsonObj.event == "message") {
				// { 'event' : 'message', 'data': { 'from': user_id, 'to': some_users_id, 'message' : 'hello world' } }
				// update chat document
				var originID = jsonObj.data.from;
				var destinationID = jsonObj.data.to;
				var msg = jsonObj.data.message;

				// update it
				var messageObj = { 'from' : originID,
								   'to' : destinationID,
								   'message' : msg };

				checkIfChatExists(originID, destinationID, messageObj);		
			}

		} catch(e) {
			console.log("Not JSON: ", e);
		}
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

function writeChatLog(chatID, destination, messageObj) {
	console.log("Found existing chat log");
	Chat.update( { 'chat_id' : chatID },
	 { $push: { 'messages' : messageObj } },
	 { upsert: true },
	 function(err){
        if(err){
            console.log(err);
        } else{
        	console.log("pushed new message = ", messageObj.message);
        	// UPDATE USERS HERE
        	// push downstream

        	Chat.find( { 'chat_id' : chatID }, function(err,docs) {
        		var chatDoc = docs[0].toObject();
        		var updateObj = { 'event' : 'chat_message', 'data' : chatDoc };

        		// send to destination
    			// get socket of destination (what if hes not online??)
    			var targetSocket = sockets[destination];
    			targetSocket.send( JSON.stringify(updateObj));
        	});        	       	
        }
    });
}

function createChatLog(originID, destinationID, messageObj) {
	// see http://stackoverflow.com/questions/9305987/nodejs-mongoose-which-approach-is-preferable-to-create-a-document
	console.log("Chat not found, make a new one");
	var newChatID = uuid.v4()
	Chat.create( { 'chat_id' : newChatID }, function(err) {
		console.log("Error on making new chat");
	});

	// update the convo for both parties
	var push_for_origin = {};
	push_for_origin[destinationID] = newChatID;
	User.update( { 'user_id' : originID },
	 { $push: { 'conversations' : push_for_origin } },
	 { upsert: true },
	 function(err){
        if(err){
                console.log(err);
        } else{
                console.log("Successfully added new chat for party 1 - ", originID);
                var push_for_dest = {};
				push_for_dest[originID] = newChatID;
				User.update( { 'user_id' : destinationID },
				 { $push: { 'conversations' : push_for_dest } },
				 { upsert: true },
				 function(err){
			        if(err){
			                console.log(err);
			        } else{
			                console.log("Successfully added new chat for party 2 - ", destinationID);
			                writeChatLog(newChatID, destinationID, messageObj);
			        }
			    });
        }
    });	
}

function checkIfChatExists(origin, destination, messageObj) {
	// check whether or not the origin user's conversation array contains the destinationID as a key
	User.find( { 'user_id' : origin },
				 function (err, docs) {
				 	chats = docs[0].toObject().conversations;
				 	var found = false;
				 	// O(n) time... :()
				 	for(var i in chats) {
						if( chats[i][destination] ) {
							chatID = chats[i][destination];
							found = true;
							console.log('found');
						}
					}

					if(found) {
						writeChatLog(chatID, destination, messageObj); // found chat document, write it back
					} else {
						createChatLog(origin, destination, messageObj); // create a new chat log in mongoDB
					}
			     });	
}


http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




