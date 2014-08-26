var socket = io();
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