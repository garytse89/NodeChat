
/**
 * Module dependencies.
 */

/*

TLDR; messages are sent in checkIfChatExists...() -> writeChatLog()

*/

var express = require('express');
var app = express();
var http = require('http').Server(app);
var WebSocketServer = require('ws').Server,
	wss = new WebSocketServer({port: 8080});	
var mongoose = require('mongoose');
var gcm = require('node-gcm');

var routes = require('./routes');
var user = require('./routes/user');
var path = require('path');

var chance = require('chance')();
var uuid = require('node-uuid');

var sockets = {};
var usernames = {};

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
	regid: { type: String }, // for GCM
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

// gcm code
var sender = new gcm.Sender('AIzaSyDBshmmMIZz30_NhzQ4qpT5MVhtorvnXrI');
// var registrationIds = {}; // stores all registered users with the app; now stored in db

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
} 

app.get('/', routes.index);
app.get('/users', user.list);

app.post('/login', function(request, response){
    console.log(request.body);

    // validate data
    if(request.body.gender && request.body.country && request.body.regid) {    

	    // store data in mongoDB; assign a username
	    var newID = uuid.v4()
	    var newName = chance.first() + chance.integer({min:1,max:1000});
	    var newUser = new User({
	    	user_id: newID,
	    	username: newName,
	    	regid: request.body.regid,
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

function manualAddUsers(name) {
	var new_id = uuid.v4();
	usernames[new_id] = name;
	console.log('Added new user ', name, ' with id = ', new_id);

	var newUser = new User({
	    	user_id: new_id,
	    	username: name,
	    	info: {
  				gender : 'Socket',
  				country : 'HK'
  			}
  		});

	newUser.save(function(err, user) {
	  if (err) return console.error('Error', err);
	  console.dir('Created record for user', user);
	});

	return new_id;
}

// WebSocket

/* 

Protocol:
{ 'event' : '...',
  'data' : '...' }

update_userlist
*/

// manually add a few users
var origin_tester_id = manualAddUsers('Paul');
// manualAddUsers('Clara');
// manualAddUsers('Nathan');

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
	//updateOtherUsers(newID);

	runTests();	

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
				checkIfChatExistsAndSendMsg(originID, destinationID, msg);		
			} else if(jsonObj.event == "register") {
				// Android client registering its socket
				var clientID = jsonObj.data;
				console.log("Registering Android client socket ", clientID);
				sockets[clientID] = ws;
				// usernames[clientID] = jsonObj.username; // client doesnt send its own username upstream
			}

		} catch(e) {
			console.log("Not JSON: ", e);
			if( message == "MANUALREGISTER" ) { // for dwst only (socket terminal)
				var newID = uuid.v4()
			    var newName = chance.first() + chance.integer({min:1,max:1000});
			    var newUser = new User({
			    	user_id: newID,
			    	username: newName,
			    	info: {
		  				gender : 'Socket',
		  				country : 'HK'
		  			}
		  		});

		  		newUser.save(function(err, user) {
				  if (err) return console.error('Error', err);
				  console.dir('Created record for user', user);
				});

				// add to username list
				sockets[newID] = ws; // update sockets table
				// updateNewUser(newID); // no point
				usernames[newID] = newName; // update usernames table
				ws.send('Welcome to Secret10');	
				console.log("Assigned the socket a userID = ", newID);
				ws.send(JSON.stringify({ 'event': 'assign_id', 'data': newID, 'username' : newName })); // assign UUID

			}

		}
	});	

	ws.on('close', function() {
		for( var id in sockets ) {
			if(sockets[id] == ws) {	
				console.log('a user has disconnected'); 
				delete sockets[id];
				//updateOtherUsers(id);
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

/* This function does the duty of actually sending the chat message */
function writeChatLog(chatID, origin, destination, message, target_regid) {
	console.log("Found existing chat log");
	Chat.update( { 'chat_id' : chatID },
	 { $push: { 'messages' : { 'message' : message, 'timestamp' : getDateTime() } } },
	 { upsert: true },
	 function(err){
        if(err){
            console.log(err);
        } else{
        	console.log("pushed new message = ", message);
        	// UPDATE USERS HERE
        	// push downstream

        	Chat.find( { 'chat_id' : chatID }, function(err,docs) {
        		var chatDoc = docs[0].toObject();

        		// add extra parameter to chatDoc that we don't store server side
        		chatDoc.origin = origin;

        		var updateObj = { 'event' : 'chat_message', 'data' : chatDoc };

        		// check if user is online to send message directly via socket (faster)
        		var targetSocket = sockets[destination];
        		targetSocket.send(JSON.stringify(updateObj)); // and we should probably send message only, not the whole doc

        		// slower method if user is not online or app is not in front
        		// wrap anything you're sending in gcm Message
			    var message = new gcm.Message({
				    data: updateObj // data is object not string
				    // should be in same format as socket send for reusability
				});

			    sender.send(message, [target_regid], 4, function (err, result) { // second param must be a list
				    if(err) {
				    	console.log(err);
				    } else {
				    	console.log(result);
				    }
				});;
        	});        	       	
        }
    });
}

function createChatLog(originID, destinationID, message, target_regid) {
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
			                writeChatLog(newChatID, originID, destinationID, message, target_regid);
			        }
			    });
        }
    });	
}

function checkIfChatExistsAndSendMsg(origin, destination, message) {
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

					var target_regid = docs[0].toObject().regid; // needed to send notification using GCM to target device

					if(found) {
						writeChatLog(chatID, origin, destination, message, target_regid); // found chat document, write it back
					} else {
						createChatLog(origin, destination, message, target_regid); // create a new chat log in mongoDB
					}
			     });	
}

function getDateTime() {

    var date = new Date();
    
    var hour = date.getHours();
    hour = (hour < 10 ? "0" : "") + hour;

    var min  = date.getMinutes();
    min = (min < 10 ? "0" : "") + min;

    var sec  = date.getSeconds();
    sec = (sec < 10 ? "0" : "") + sec;

    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return year + ":" + month + ":" + day + ":" + hour + ":" + min + ":" + sec;

}

/* all code that is sent to incoming client initially should be put here 
Example: you just sign in with Android, and you want to test if you can receive messages
without having to copy and paste chat message delivery JSON strings into websocket terminal
*/
function runTests() {
	// use organic function to test sending messages to android upon signin
	checkIfChatExistsAndSendMsg(origin_tester_id, newID, 'hello');
	// these tests show a bug where if you send three messages quickly in a row, then 
	// three different chat docs will get made (because the first doesnt run fast enough asycnhronusly)
	checkIfChatExistsAndSendMsg(origin_tester_id, newID, 'this is a test');
	checkIfChatExistsAndSendMsg(origin_tester_id, newID, '1-2-3 microphone');
}


http.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});




