// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");

// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
	
	fs.readFile("chatroom.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
		
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);

// Do the Socket.IO magic:
var io = socketio.listen(app);

var usergroup ={
    allUsers:{},
    lobby:{}
};
var rooms ={
    lobby :{private: false, creator: "theAuthor", banList: {}}
};

io.sockets.on("connection", function(socket){

// new user
    socket.on('username', function(username){

        //check if the username has already existed
        if(usergroup.allUsers.hasOwnProperty(String(username))){
            socket.emit('nameUsed', username+" has been used!"); 
        }else{
            socket.username = String(username);
            socket.roomname = "lobby";
            
            socket.emit('nameOK',  username); 
            socket.join("lobby");
            usergroup.allUsers[socket.username] = {socket: socket};
            usergroup.lobby[socket.username] = socket.username;
            //console.log(usergroup.allUsers);
            socket.emit('updateroomlist', rooms);
            io.to(socket.roomname).emit('usersInRoom', usergroup[socket.roomname]);
        }
    });

    //add rooms
    socket.on('addRoom', function(roomname){
        rooms[roomname] = {};
 		rooms[roomname]["creator"] = socket.username;
		rooms[roomname]["private"] = false;
        rooms[roomname]["banList"] = {};

        io.sockets.emit('updateroomlist', rooms);
        usergroup[roomname] = {};

    });

    socket.on('addPrivateRoom', function(roomname){
		var name = roomname["roomName"];
		var password = roomname["password"];

		rooms[name] = {};
		rooms[name]["creator"] = socket.username;
		rooms[name]["private"] = true;
		rooms[name]["password"] = password;
        rooms[name]["banList"] = {};
        
        usergroup[name] = {};

		io.sockets.emit('updateroomlist', rooms);
    });
    function loaduser(rm){

	io.sockets.to(rm).emit('usersInRoom', {"userlist":usergroup[rm],"creator":rooms[rm]["creator"]});

	}
    // join rooms
    socket.on('joinRoom', function(roomname){
        
        if(!(rooms[roomname]["banList"].hasOwnProperty(socket.username))){
            //console.log(socket.roomname);
            if(socket.roomname != roomname ){
                
                socket.leave(socket.roomname);
                delete usergroup[socket.roomname][socket.username];
                //console.log(usergroup[socket.roomname]);
                loaduser(socket.roomname);
            }

            socket.roomname = String(roomname);
            usergroup[socket.roomname][socket.username] = socket.username;
            socket.join(socket.roomname);
            loaduser(socket.roomname);
            socket.emit('roomname', roomname);
           

            
        }else{
            socket.emit('banfromtheroom', " you are banned by the room creator!");
        }
    });
//kick user
    socket.on('kickuser', function(info){

        usergroup["allUsers"][info["name"]]["socket"].leave(info["room"]);
        delete usergroup[info["room"]][info["name"]];
        loaduser(socket.roomname);

        usergroup["lobby"][info["name"]] = info["name"];
        usergroup["allUsers"][info["name"]]["socket"].join("lobby");
        loaduser("lobby");
        var id = usergroup["allUsers"][info["name"]]["socket"].id;
        socket.to(id).emit('backtolobby', "lobby");

    });
//ban user
    socket.on('banuser', function(info){

        usergroup["allUsers"][info["name"]]["socket"].leave(info["room"]);
        delete usergroup[info["room"]][info["name"]];
        rooms[info["room"]]["banList"][info['name']] = info['name'];
        loaduser(socket.roomname);

        usergroup["lobby"][info["name"]] = info["name"];
        usergroup["allUsers"][info["name"]]["socket"].join("lobby");
        loaduser("lobby");
        var id = usergroup["allUsers"][info["name"]]["socket"].id;
        socket.to(id).emit('backtolobby', "lobby");

    });

    socket.on('checkpassword', function(pwd){
        if(pwd["pswd"] === rooms[pwd["rmnm"]]["password"]){//pwd correct
            if(!(rooms[pwd["rmnm"]]["banList"].hasOwnProperty(socket.username))){
                if(socket.roomname != pwd["rmnm"] ){    
                    socket.leave(socket.roomname);
                    delete usergroup[socket.roomname][socket.username];
                    //console.log(usergroup[socket.roomname]);
                    loaduser(socket.roomname);
                }
    
                socket.roomname = String(pwd["rmnm"]);
                usergroup[socket.roomname][socket.username] = socket.username;
                socket.join(socket.roomname);
                loaduser(socket.roomname);
                socket.emit('roomname', pwd["rmnm"]);
            }else{
                    socket.emit('banfromtheroom', " you are banned by the room creator!");
            }
            
        }else{// incorrect
            socket.emit('passwordwrongmsg', " password incorrect!");
        }
            
            
        //console.log("send guolai de :" + pwd["pswd"]+": "+pwd["rmnm"]);
        //console.log("room de :" +rooms[pwd["rmnm"]]["password"]);
    });

// send message back to client
    socket.on('message_to_server', function(msg2server){
        // console.log(msg2server["message"]);
        // console.log(msg2server["sender"]);
        // console.log(msg2server["timestamp"]);
        // console.log(msg2server["rmnm"]);
        io.sockets.to(socket.roomname).emit('message_to_client', msg2server);
    });

    socket.on('private_message_to_server', function(primsg2server){
        // console.log(primsg2server["message"]);
        // console.log(primsg2server["sender"]);
        // console.log(primsg2server["timestamp"]);
        // console.log(primsg2server["rmnm"]);
        // var id = usergroup.allUsers[primsg2server["receiver"]][socket_id];
        // console.log(usergroup.allUsers[primsg2server["receiver"]]);
        // console.log(id);
        io.sockets.to(usergroup.allUsers[primsg2server["receiver"]].socket.id).emit('primessage_to_client', primsg2server);
        io.sockets.to(socket.id).emit('primessage_to_client', primsg2server);
    });
   

    

});
