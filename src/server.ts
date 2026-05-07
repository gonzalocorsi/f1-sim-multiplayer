import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { PhysicsEngine } from './PhysicsEngine.js';

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

// 4. MOTOR DE FÍSICA Y DATOS
const physics = new PhysicsEngine(io); 

const AVAILABLE_SESSIONS = [
    { id: 'gp-argentina', name: 'GP de Argentina', mapName: 'Bahía Blanca', maxPlayers: 20, status: 'waiting' },
    { id: 'gp-monaco', name: 'GP de Mónaco', mapName: 'Monte Carlo', maxPlayers: 20, status: 'coming_soon' },
    { id: 'interlagos', name: 'GP de Brasil', mapName: 'Interlagos', maxPlayers: 20, status: 'coming_soon' }
];

// --- Función Maestra de Sincronización ---
const broadcastRoomUpdate = () => {
    const dataToSend = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id),
        status: s.status === 'coming_soon' ? 'coming_soon' : (physics.getPlayerCount(s.id) > 0 ? 'racing' : 'waiting')
    }));
    io.emit('update_rooms', dataToSend);
};

// 5. RUTAS API
app.get('/api/servers', (req, res) => {
    const data = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id)
    }));
    res.json(data);
});

// Ruta raíz para servir el index.html expresamente si es necesario
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

// 6. LÓGICA DE SOCKETS
io.on('connection', (socket) => {
    console.log(`📡 Conectado: ${socket.id}`);

    // ENVIAR DATOS INICIALES AL CONECTAR
    const initialData = AVAILABLE_SESSIONS.map(s => ({
        ...s,
        playerCount: physics.getPlayerCount(s.id),
        status: s.status === 'coming_soon' ? 'coming_soon' : (physics.getPlayerCount(s.id) > 0 ? 'racing' : 'waiting')
    }));
    
    // Eliminada la referencia inexistente a lobbyManager
    socket.emit('update_rooms', initialData);

    // Escuchar pedido manual por si el lag de Render lo requiere
    socket.on('get_initial_rooms', () => {
        socket.emit('update_rooms', initialData);
    });

    socket.on('join_session', ({ roomId, type }) => {
        socket.rooms.forEach(room => { if (room !== socket.id) socket.leave(room); });
        socket.join(roomId);
        
        if (type === 'mando' || type === 'solo' || type === 'tv') {
            if (type !== 'tv') physics.addCar(socket.id, roomId);
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

// 7. PUERTO (Render usa process.env.PORT)
const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 Corriendo en el puerto ${PORT}`);
});