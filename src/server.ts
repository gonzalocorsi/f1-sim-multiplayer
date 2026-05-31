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
		mapId: 'figure-0',
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
app.get('/tv.html', (req, res) => {
    // 1. Agarramos el ID de la sala que viene en la URL (?room=...)
    const roomId = req.query.room as string;
    
    // 2. Buscamos el objeto de la sala en tu array global 'rooms'
    const room = rooms.find(r => r.id === roomId);

    // 3. Evaluamos qué mapa tiene asignado y enviamos el HTML correcto
    if (room && room.mapId) {
        res.sendFile(path.join(__dirname, '../public', `${room.mapId}.html`));
    } else {
        // Si no es el 8, o no existe, mandamos el óvalo clásico por defecto
        res.sendFile(path.join(__dirname, '../public/figure-0.html'));
    }
});

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

    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(roomId);

   // 1. Buscamos la sala inmediatamente después de socket.join(roomId)
	const room = rooms.find(r => r.id === roomId);

	// 2. Ahora sí el log es seguro
	console.log(`room.creatorId: ${room?.creatorId}`);

	if (type === 'mando' || type === 'solo' || type === 'tv') {
		
		

		if (room) {
			console.log('Token del mando:', creatorToken, 'Token real:', room.creatorId);
			if (type === 'tv') {
					socket.emit('init_track', { mapId: room.mapId });
			}
			// 3. Si no es la TV, agregamos el auto usando el mapId de la sala que encontramos arriba
			if (type !== 'tv') {
				physics.addCar(socket.id, roomId, room?.mapId || 'figure-0');
			}
			room.hadPlayers = true;
			if (room.creatorId && room.status === 'waiting') {
				physics.setRoomLocked(roomId, true);
			}
			
			if (type === 'mando' && creatorToken && room.creatorId === creatorToken) {
				room.creatorSocketId = socket.id;
				socket.emit('you_are_creator', { token: creatorToken });
			}
		} else {
			console.log(`Alerta: No se encontró la sala con ID ${roomId}`);
		}
	}

        broadcastRoomUpdate();
    
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
            status: 'waiting',
			mapId: data.mapName
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
        if (!room || room.creatorSocketId !== socket.id) return;
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
	
	

		socket.on('request_restart', (roomId)=>{
			console.log("Evento recibido para sala:", roomId);
			const room = rooms.find(r => r.id === roomId);
			if (!room || room.status !== 'finished') return;
			physics.resetRace(roomId)
			room.status = 'waiting';
			room.creatorSocketId = socket.id;
			broadcastRoomUpdate();
			io.to(roomId).emit('force_reload');
			console.log("=== DIAGNÓSTICO DE REINICIO ===");
			console.log("1. Objeto sala completo en server.ts:", JSON.stringify(room));
			console.log("2. Contador de jugadores activos en física:", physics.getPlayerCount(roomId));
			
			
			
			
			
			
console.log("Estado actual de la sala encontrado:", room ? room.status : "No existe");
console.log("Auditoría de reinicio - Vueltas de la sala:", room?.laps);
				});

    socket.on('disconnect', () => {
        physics.removeCar(socket.id);
        console.log(`❌ Desconectado: ${socket.id}`);
        rooms = rooms.filter(r =>
            r.id === 'gp-argentina' ||
			r.status === 'waiting' ||
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