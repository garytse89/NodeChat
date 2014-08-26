var socket = io();
var clientID = null;

$(function(){
	$('#send').click(function(){
		sendMessage();
	});

	$('form#chatbox').submit(function() {
		sendMessage();
	});

	function sendMessage(){	
		event.preventDefault();	
		socket.emit('chat message', $('#chatmessage').val());
		$('#chatmessage').val('');
		return false;
	};
});

socket.on('chat message', function(msgObject){
	var msg = JSON.parse(msgObject);
	if(clientID == msg.username)
		$('#messages').append($('<li>').text('Me: ' + msg.message));
	else
		$('#messages').append($('<li>').text(msg.username + ': ' + msg.message));
});

socket.on('notification', function(msg){
	$('#messages').append($('<li>').text(msg));
});

socket.on('connect', function(){
	console.log(socket);
	socket.emit('connected');
});

socket.on('assign username', function(name){
	clientID = name;
	$('#username').text(name);
});