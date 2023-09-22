// Require the packages we will use:
// Require the functionality we need to use:
var http = require('http'),
	url = require('url'),
	path = require('path'),
	mime = require('mime'),
	path = require('path'),
	fs = require('fs');

// Make a simple fileserver for all of our static content.
// Everything underneath <STATIC DIRECTORY NAME> will be served.
var server = http.createServer(function(req, resp){
	var filename = path.join(__dirname, url.parse(req.url).pathname);
	(fs.exists || path.exists)(filename, function(exists){
		if (exists) {
			fs.readFile(filename, function(err, data){
				if (err) {
					// File exists but is not readable (permissions issue?)
					resp.writeHead(500, {
						"Content-Type": "text/plain"
					});
					resp.write("Internal server error: could not read file");
					resp.end();
					return;
				}
				
				// File exists and is readable
				var mimetype = mime.getType(filename);
				resp.writeHead(200, {
					"Content-Type": mimetype
				});
				resp.write(data);
				resp.end();
				return;
			});
		}else{
			// File does not exist
			resp.writeHead(404, {
				"Content-Type": "text/plain"
			});
			resp.write("Requested file not found: "+filename);
			resp.end();
			return;
		}
	});
});
server.listen(3456);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

// Attach our Socket.IO server to our HTTP server to listen
users = [];
const roomMap = new Map();
const bannedMap = new Map();
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.

    function getUserSocket() {
        return io.sockets.sockets.get(socket.id);
    }

    function getUserRoom() {
        rooms = Array.from(socket.rooms);

        if (rooms.length > 1) {
            return rooms[1];
        }

        return "";
    }

    // This callback sets the socket username. It also makes sure duplicated do not occur
    socket.on('createUser', function(data){
        userSocket = getUserSocket();
        console.log(data["username"]);
        if(users.indexOf(data["username"]) == -1){
            if(socket.username!=null){
                let i = users.indexOf[socket.username];
                users.splice(i, 1);
            }
            users.push(data["username"]);
            socket.username=data["username"];
            userSocket.emit('createdUser', {username : socket.username});
        }else{
            userSocket.emit('alert', "Username already in use");
        }
    });

    socket.on('message_to_server', function (data) {
        // This callback runs when the server receives a new message from the client.
        console.log("message: " + data["message"]+ " user: "+socket.username+" Room: "+Array.from(socket.rooms)[1]); // log it to the Node.JS output
        io.to(Array.from(socket.rooms)[1]).emit("message_to_client", { message: data["message"], usr: socket.username }) // broadcast the message to other users
    });

    socket.on('private_message_to_server', function (data) {
        userSocket = getUserSocket();
        userRoom = getUserRoom();

        if (userRoom && userRoom.length > 0) {
            let users = io.sockets.adapter.rooms.get(userRoom);
    
            if (users) {
                users.forEach((clientID) => {
                    let tempUserSocket = io.sockets.sockets.get(clientID);
                    if (tempUserSocket.username == data['user']) {
                        tempUserSocket.emit("private_message_to_client", { message: data["message"], usr: socket.username });
                        userSocket.emit("private_message_to_client", { message: data["message"], usr: socket.username });
                    }
                });
            }
        }
    });

    socket.on('enterRoom', function(data){
        userSocket = getUserSocket();
        if(socket.rooms.size > 1){
            socket.leave(Array.from(socket.rooms)[1]);
        }
        if (bannedMap.get(data['roomName']+ socket.username)) {
            userSocket.emit('alert', "You have been banned from that chat room!");
        }
        else if(roomMap.has(data["roomName"])){
            console.log(roomMap.get(data["roomName"])["password"])
            if(roomMap.get(data["roomName"])["password"] == data["password"]){
                socket.join(data["roomName"]);
                userSocket.emit('alert', "Joined Room");
            }else{
                userSocket.emit('alert', "Incorrect Password");
            }
        }else{
            if (data["roomName"] != "") {
                roomMap.set(data["roomName"],{password:data["password"], creator:socket.username});
                userSocket.emit('alert', "Room Created");
            }
            else {
                userSocket.emit('alert', "Room must have a name");
            }
        }
    });

    socket.on('updateAll', function() {
        io.sockets.emit('updateMyPage');
    });

    socket.on('getPageData', function() {
        userSocket = getUserSocket();
        userRoom = getUserRoom();

        let allRooms = Array.from(roomMap.keys());
        let numUsersInRoom = [];
        allRooms.forEach((room) => {
            if (!io.sockets.adapter.rooms.get(room)) {
                numUsersInRoom.push(0);
            }
            else {
                numUsersInRoom.push(io.sockets.adapter.rooms.get(room).size);
            }
        });

        let usersInRoom = [];
        if (userRoom && userRoom.length > 0) {
            let users = io.sockets.adapter.rooms.get(userRoom);
    
            if (users) {
                users.forEach((clientID) => {
                    let tempUserSocket = io.sockets.sockets.get(clientID);
                    usersInRoom.push(tempUserSocket.username);
                });
            }
        }
    
        userSocket.emit("update_page_data", { rooms: allRooms, numUsersInRoom: numUsersInRoom, users: usersInRoom});
    });

    socket.on('kick_user', function(data) {
        userSocket = getUserSocket();
        userRoom = getUserRoom();

        if (userRoom != "" && roomMap.get(userRoom)["creator"] == socket.username && socket.username != data['user']) {
            let users = io.sockets.adapter.rooms.get(userRoom);
    
            if (users) {
                users.forEach((clientID) => {
                    let tempUserSocket = io.sockets.sockets.get(clientID);
                    if (tempUserSocket.username == data['user']) {
                        tempUserSocket.leave(Array.from(tempUserSocket.rooms)[1]);
                    }
                });
            }
        }
        else if(socket.username == data['user']){
            userSocket.emit('alert', "You silly goose! You almost kicked yourself!");
        }
        else {
            userSocket.emit('alert', "Must be in a room and be the room creator!");
        }
    });

    socket.on('ban_user', function(data) {
        userSocket = getUserSocket();
        userRoom = getUserRoom();

        if (userRoom != "" && roomMap.get(userRoom)["creator"] == socket.username && socket.username != data['user']) {
            let users = io.sockets.adapter.rooms.get(userRoom);
    
            if (users) {
                users.forEach((clientID) => {
                    let tempUserSocket = io.sockets.sockets.get(clientID);
                    if (tempUserSocket.username == data['user']) {
                        tempUserSocket.leave(Array.from(tempUserSocket.rooms)[1]);
                        bannedMap.set(userRoom + tempUserSocket.username, 1);
                    }
                });
            }
        }
        else if(socket.username == data['user']){
            userSocket.emit('alert', "You silly goose! You almost banned yourself!");
        }
        else {
            userSocket.emit('alert', "Must be in a room and be the room creator!");
        }
    });

    socket.on('delete_room', function() {
        userSocket = getUserSocket();
        userRoom = getUserRoom();

        if (userRoom != "" && roomMap.get(userRoom)["creator"] == socket.username) {
            let users = io.sockets.adapter.rooms.get(userRoom);
    
            if (users) {
                users.forEach((clientID) => {
                    let tempUserSocket = io.sockets.sockets.get(clientID);
                    tempUserSocket.leave(Array.from(tempUserSocket.rooms)[1]);
                });
            }
            roomMap.delete(userRoom);
        }
        else {
            userSocket.emit('alert', "Must be in a room and be the room creator!");
        }
    });
});
