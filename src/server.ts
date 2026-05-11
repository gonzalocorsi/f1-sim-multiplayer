import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { PhysicsEngine } from './PhysicsEngine.js';
import { Room } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '../public')));
app.use('/dist', express.static(path.join(__dirname, '../dist')));

const physics = new PhysicsEngine(
    io,
    (roomId, winnerId) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room || room.status === 'finished') return;
        room.status = 'finished';
        physics.setRoomLocked(roomId, true);
		const podio = physics.getLeaderboard(roomId);
        io.to(roomId).emit('race_finished', { winnerId, podio });
        broadcastRoomUpdate();
    },
    () => rooms
);

let rooms: Room[] = [
    {
        id: 'gp-argentina',
        name: 'GP de Argentina',
        mapName: 'Bahía Blanca',
        maxPlayers: 20,
        playerCount: 0,
        status: 'waiting'
        // Sin laps ni creatorId — la sala fija no tiene límite de vueltas ni creador
    }
];

const broadcastRoomUpdate = () => {
    const dataToSend = rooms.map(r => ({
        ...r,
        playerCount: physics.getPlayerCount(r.id),
        status: r.status === 'coming_soon' ? 'coming_soon'
              : r.status === 'countdown'   ? 'countdown'
              : r.status === 'finished'    ? 'finished'
              : physics.getPlayerCount(r.id) > 0 ? 'racing' : 'waiting'
    }));
    io.emit('update_rooms', dataToSend);
};

app.get('/api/servers', (req, res) => {
    res.json(rooms.map(r => ({ ...r, playerCount: physics.getPlayerCount(r.id) })));
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

io.on('connection', (socket) => {
    console.log(`📡 Conectado: ${socket.id}`);

    socket.emit('update_rooms', rooms.map(r => ({
        ...r,
        playerCount: physics.getPlayerCount(r.id),
        status: r.status === 'coming_soon' ? 'coming_soon'
              : physics.getPlayerCount(r.id) > 0 ? 'racing' : 'waiting'
    })));

    socket.on('get_initial_rooms', () => {
        broadcastRoomUpdate();
    });

socket.on('join_session', ({ roomId, type, creatorToken }) => {
    console.log(`join_session → type:${type} roomId:${roomId} token:${creatorToken}`);
	    const room = rooms.find(r => r.id === roomId);

    console.log(`room.creatorId: ${room?.creatorId}`);

    socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
    socket.join(roomId);

    if (type === 'mando' || type === 'solo' || type === 'tv') {
        if (type !== 'tv') physics.addCar(socket.id, roomId);
        
        const room = rooms.find(r => r.id === roomId);
        if (room) {
            room.hadPlayers = true;
            // Lockear salas custom (las que tienen creatorId) hasta que el creador inicie
            if (room.creatorId && room.status === 'waiting') {
                physics.setRoomLocked(roomId, true); // ← esto bloquea el input hasta start_race
            }
        }
 // ← Identificar creador por token en vez de socketId
        if (type === 'mando' && creatorToken && room?.creatorId === creatorToken) {
            room.creatorId = socket.id; // actualizar al socketId real
            socket.emit('you_are_creator');
        }
        
        broadcastRoomUpdate();
    }
});

    socket.on('drive', (input) => {
        physics.handleInput(socket.id, input);
    });

    socket.on('create_room', (data: { name: string; mapName: string; laps: number }) => {
        const roomId = `room-${Date.now()}`;
        const newRoom: Room = {
            id: roomId,
            name: data.name,
            mapName: `${data.mapName} · ${data.laps} vueltas`,
            playerCount: 0,
            maxPlayers: 12,
            laps: data.laps,
            creatorId: roomId,
            status: 'waiting'
        };
        rooms.push(newRoom);
        console.log(`Nueva sala creada: ${newRoom.name}`);
		    console.log(`Emitiendo room_created a ${socket.id} con token ${roomId}`); // ← agregá esto

        broadcastRoomUpdate();
        socket.emit('room_created', { roomId, creatorToken: roomId });
    });

    // ✅ start_race ADENTRO del bloque connection
    socket.on('start_race', (roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        if (!room || room.creatorId !== socket.id) return;
        if (room.status !== 'waiting') return;

        room.status = 'countdown';
        broadcastRoomUpdate();
        physics.setRoomLocked(roomId, true);

        let count = 3;
        const interval = setInterval(() => {
            io.to(roomId).emit('countdown', count);
            count--;
            if (count < 0) {
                clearInterval(interval);
                room.status = 'racing';
                physics.setRoomLocked(roomId, false);
                broadcastRoomUpdate();
            }
        }, 1000);
    });

    socket.on('disconnect', () => {
        physics.removeCar(socket.id);
        console.log(`❌ Desconectado: ${socket.id}`);
        rooms = rooms.filter(r =>
            r.id === 'gp-argentina' ||
            !r.hadPlayers ||
            physics.getPlayerCount(r.id) > 0
        );
        broadcastRoomUpdate();
    });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Corriendo en el puerto ${PORT}`);
});