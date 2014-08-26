var socket = io();
var clientID = null;

$(function(){
	$('#send').click(function(){
		sendMessage();
	});

	$('form#chatbox').submit(function() {
		sendMessage();
	});

	$('#chatmessage').on('input', function() {
		// detected when user is typing
		var contents = $('#chatmessage').val();
		if(contents.length > 0)
			socket.emit('typing');
		else
			socket.emit('stopped typing');
	});

	function sendMessage(){	
		event.preventDefault();	
		var msg = $('#chatmessage').val();
		socket.emit('chat message', msg);
		socket.emit('stopped typing');
		$('#chatmessage').val('');
		$('#messages').append($('<li>').text('Me: ' + msg));
		return false;
	};	
});

socket.on('chat message', function(msgObject){
	var msg = JSON.parse(msgObject);
	$('#messages').append($('<li>').text(msg.username + ': ' + msg.message));
});

socket.on('assign username', function(name) {
	clientID = name;
	$('#username').text("My username is " + name);
});

socket.on('notification', function(msg){
	$('#messages').append($('<li>').text(msg));
});

socket.on('connect', function(){
	console.log(socket);
	socket.emit('connected');
});

socket.on('started typing', function(username){
	var typingID = '#' + username;
	if($(typingID).length == 0)
		$('#messages').append($('<li id = "' + username + '">').text(username + ' is typing...'));
});

socket.on('stopped typing', function(username){
	var typingID = '#' + username;
	if($(typingID).length > 0)
		$(typingID).remove();
});

socket.on('user list update', function(userlist) {
	// flush
	$('#onlineUsers').empty();
	for( user_id in userlist ) {
		console.log(clientID);
		if(userlist[user_id] != clientID){
			$('#onlineUsers').append($('<li class=\'private\'>').text(userlist[user_id]));
		}
	}

	// bind listener, can't do it when DOM loads (because this list wouldn't have been populated)
	$('.private').click(function(){
		console.log("initiate pm");
		$('#pmTitle').text('PM-ing ' + $(this).text());
	});
});
