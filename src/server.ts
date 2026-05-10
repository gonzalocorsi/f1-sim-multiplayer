import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { PhysicsEngine } from './PhysicsEngine.js';
import { Room } from './types.js';

// 1. CONFIGURACIÓN DE RUTAS (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. INICIALIZACIÓN DE LA APP (Importante: Declarar 'app' antes de usarla)
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// 3. CONFIGURACIÓN DE ESTÁTICOS
// Buscamos 'public' un nivel arriba de 'dist' (donde vive este archivo compilado)
app.use(express.static(path.join(__dirname, '../public')));
app.use('/dist', express.static(path.join(__dirname, '../dist')));


// 4. MOTOR DE FÍSICA Y DATOS
const physics = new PhysicsEngine(io); 

// Cambiamos a let y tipamos con Room


let rooms: Room[] = [
    { 
        id: 'gp-argentina', 
        name: 'GP de Argentina', 
        mapName: 'Bahía Blanca', 
        maxPlayers: 20, 
        playerCount: 0,
        status: 'waiting' 
    },
];

const broadcastRoomUpdate = () => {
    const dataToSend = rooms.map(r => ({
        ...r,
        playerCount: physics.getPlayerCount(r.id),
        status: r.status === 'coming_soon' ? 'coming_soon' 
              : (physics.getPlayerCount(r.id) > 0 ? 'racing' : 'waiting')
    }));
    io.emit('update_rooms', dataToSend);
};


// 5. RUTAS API
app.get('/api/servers', (req, res) => {
    const data = rooms.map(r => ({
        ...r,
        playerCount: physics.getPlayerCount(r.id)
    }));
    res.json(data);
});

// Ruta raíz para servir el index.html expresamente si es necesario
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// 6. LÓGICA DE SOCKETS
io.on('connection', (socket) => {
    console.log(`📡 Conectado: ${socket.id}`);

    // ENVIAR DATOS INICIALES AL CONECTAR
 socket.emit('update_rooms', rooms.map(r => ({
    ...r,
    playerCount: physics.getPlayerCount(r.id),
    status: r.status === 'coming_soon' ? 'coming_soon'
          : (physics.getPlayerCount(r.id) > 0 ? 'racing' : 'waiting')
})));
    // Eliminada la referencia inexistente a lobbyManager


    // Escuchar pedido manual por si el lag de Render lo requiere
socket.on('get_initial_rooms', () => {
    broadcastRoomUpdate();
});

    socket.on('join_session', ({ roomId, type }) => {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(roomId);
        
        if (type === 'mando' || type === 'solo' || type === 'tv') {
            if (type !== 'tv') physics.addCar(socket.id, roomId);
			// Marcar que esta sala tuvo jugadores
        const room = rooms.find(r => r.id === roomId);
        if (room) room.hadPlayers = true;
            broadcastRoomUpdate();
        }
    });

    socket.on('drive', (input) => {
        physics.handleInput(socket.id, input);
    });

    socket.on('disconnect', () => {
        physics.removeCar(socket.id);
        broadcastRoomUpdate();
        console.log(`❌ Desconectado: ${socket.id}`);
		    // Limpiar salas vacías (excepto las predefinidas)
    rooms = rooms.filter(r => 
        r.id === 'gp-argentina' ||  // las fijas que quieras mantener siempre
		    !r.hadPlayers ||                      // salas nuevas sin nadie aún → mantener

        physics.getPlayerCount(r.id) > 0
    );
    
    broadcastRoomUpdate();
    console.log(`❌ Desconectado: ${socket.id}`);
    });
	
	
	socket.on('create_room', (data: { name: string; mapName: string; laps: number }) => {
    const roomId = `room-${Date.now()}`;
    
    const newRoom: Room = {
        id: roomId,
        name: data.name,
        mapName: `${data.mapName} · ${data.laps} vueltas`,
        playerCount: 0,
        maxPlayers: 12,
        status: 'waiting'
    };

    rooms.push(newRoom);
    console.log(`Nueva sala creada: ${newRoom.name}`);
    
    // Avisamos a todos que hay sala nueva
    broadcastRoomUpdate();
    
    // Al creador lo redirigimos directo
    socket.emit('room_created', { roomId });
});
});

// 7. PUERTO (Render usa process.env.PORT)
const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Corriendo en el puerto ${PORT}`);
});