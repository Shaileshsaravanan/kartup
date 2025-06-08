const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;
app.use(express.static("./public"));
app.use(express.json());

app.set('view engine', 'pug')
app.set('views', path.join(__dirname, 'src'));

let rooms = {};

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function cleanupEmptyRooms() {
    for (const roomCode in rooms) {
        if (!rooms[roomCode].player1 && !rooms[roomCode].player2) {
            delete rooms[roomCode];
            console.log(`Cleaned up empty room: ${roomCode}`);
        }
    }
}

app.get("/", (req, res) => {
    res.render("lobby");
});

app.get("/create", (req, res) => {
    const roomCode = generateRoomCode();
    rooms[roomCode] = {
        player1: null,
        player2: null,
        gameReady: false
    };
    res.render("index", {
        player: 1,
        roomCode: roomCode,
        isHost: true
    });
});

app.get("/join/:code", (req, res) => {
    const roomCode = req.params.code.toUpperCase();
    if (!rooms[roomCode]) {
        return res.render("error", { message: "Room not found!" });
    }
    if (rooms[roomCode].player1 && rooms[roomCode].player2) {
        return res.render("full");
    }
    const playerNumber = rooms[roomCode].player1 ? 2 : 1;
    res.render("index", {
        player: playerNumber,
        roomCode: roomCode,
        isHost: false
    });
});

const server = app.listen(port, () => {
    console.log(`listening to ${port}...`);
});

// Clean up empty rooms every 5 minutes
setInterval(cleanupEmptyRooms, 5 * 60 * 1000);

const io = require("socket.io")(server);
console.log("started....");

io.on("connection", socket => {
    console.log("someone joined.....with id : " + socket.id);
    
    socket.on("joinRoom", (roomCode) => {
        if (!rooms[roomCode]) {
            socket.emit("error", "Room not found");
            return;
        }
        
        socket.join(roomCode);
        socket.roomCode = roomCode;
        
        if (!rooms[roomCode].player1) {
            rooms[roomCode].player1 = socket.id;
            socket.playerNumber = 1;
            console.log(`Player 1 joined room ${roomCode}`);
        } else if (!rooms[roomCode].player2) {
            rooms[roomCode].player2 = socket.id;
            socket.playerNumber = 2;
            console.log(`Player 2 joined room ${roomCode}`);
            // Notify both players that the room is now full
            io.to(roomCode).emit("roomReady");
        } else {
            socket.emit("error", "Room is full");
            return;
        }
        
        socket.to(roomCode).emit("playerJoined", socket.playerNumber);
    });

    socket.on("disconnect", () => {
        if (socket.roomCode && rooms[socket.roomCode]) {
            const room = rooms[socket.roomCode];
            
            if (room.player1 === socket.id) {
                room.player1 = null;
                console.log(`Player 1 left room ${socket.roomCode}`);
            } else if (room.player2 === socket.id) {
                room.player2 = null;
                console.log(`Player 2 left room ${socket.roomCode}`);
            }
            
            // Reset game state when a player leaves
            room.gameReady = false;
            
            socket.to(socket.roomCode).emit("playerLeft", socket.playerNumber);
            
            // Clean up empty room
            if (!room.player1 && !room.player2) {
                delete rooms[socket.roomCode];
                console.log(`Room ${socket.roomCode} deleted`);
            }
        }
    });

    socket.on("myCar", data => {
        if (socket.roomCode) {
            socket.to(socket.roomCode).emit("updateCar", data);
        }
    });
    
    socket.on("win", player => {
        if (socket.roomCode) {
            io.to(socket.roomCode).emit("restart_game", player);
        }
    });

    socket.on("ready", () => {
        if (socket.roomCode && rooms[socket.roomCode]) {
            const room = rooms[socket.roomCode];
            if (room.gameReady) {
                if (room.gameReady !== socket.id) {
                    room.gameReady = false;
                    io.to(socket.roomCode).emit("game_start");
                }
            } else {
                room.gameReady = socket.id;
                socket.emit("wait");
            }
        }
    });
});