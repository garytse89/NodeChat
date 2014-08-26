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
		var msg = $('#chatmessage').val();
		socket.emit('chat message', msg);
		$('#chatmessage').val('');
		$('#messages').append($('<li>').text('Me: ' + msg));
		return false;
	};
});

socket.on('chat message', function(msgObject){
	var msg = JSON.parse(msgObject);
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
	$('#username').text('My username is ' + name);
});