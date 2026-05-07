import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { PhysicsEngine } from './PhysicsEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, '../public')));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

const physics = new PhysicsEngine(io); 

const AVAILABLE_SESSIONS = [
    { id: 'gp-argentina', name: 'GP de Argentina', mapName: 'Bahía Blanca', maxPlayers: 20, status: 'waiting' },
    { id: 'gp-monaco', name: 'GP de Mónaco', mapName: 'Monte Carlo', maxPlayers: 20, status: 'coming_soon' },
    { id: 'interlagos', name: 'GP de Brasil', mapName: 'Interlagos', maxPlayers: 20, status: 'coming_soon' }
];

// --- Función Maestra de Sincronización ---
// Esta función asegura que el Lobby siempre reciba los nombres que espera (playerCount, mapName, etc.)
const broadcastRoomUpdate = () => {
    const dataToSend = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id),
        status: s.status === 'coming_soon' ? 'coming_soon' : (physics.getPlayerCount(s.id) > 0 ? 'racing' : 'waiting')
    }));
    io.emit('update_rooms', dataToSend);
};



// Rutas
app.get('/api/servers', (req, res) => {
    const data = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id)
    }));
    res.json(data);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// --- Socket.io ---
io.on('connection', (socket) => {
    console.log(`📡 Conectado: ${socket.id}`);

    // ENVIAR DATOS INICIALES AL CONECTAR
    const initialData = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id),
        status: s.status === 'coming_soon' ? 'coming_soon' : (physics.getPlayerCount(s.id) > 0 ? 'racing' : 'waiting')
    }));
    socket.emit('update_rooms', initialData, lobbyManager.getRooms());

    socket.on('join_session', ({ roomId, type }) => {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(roomId);
        
        if (type === 'mando' || type === 'solo' || type === 'tv') {
            if (type !== 'tv') physics.addCar(socket.id, roomId);
            
            // Actualizar a todos los que están en el Lobby
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
    });
});

const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Corriendo en http://localhost:${PORT}`);
});