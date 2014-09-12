
io.on('connection', function(socket) {

	console.log('new connection');

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

	socket.on('signup', function(data){
		// do some mongoose shit
		var data = JSON.parse(data);
		console.log(data);
		var user = new User({
  			gender : data.gender,
  			country : data.country
  		});

		user.save(function(err, user) {
		  if (err) return console.error(err);
		  console.dir(user);
		});

		// display how many current users
		User.find(function(err, users) {
		  if (err) return console.error(err);
		  console.dir('Current users = ' + users.length);
		});
	});

	socket.on('psst', function() {
		console.log('ANDROID CLIENT CONNECTED\n\n\n');
		socket.emit('echo back', 'ass');
	});
});