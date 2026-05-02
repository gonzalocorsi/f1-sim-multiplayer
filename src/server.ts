import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// Servimos archivos estáticos
// Asegúrate de que index.html y tv.html estén en una carpeta llamada 'public'
app.use(express.static(path.join(__dirname, '../public')));


// Agregá esta variable arriba del io.on
let hostId: string | null = null;

io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);
    
    // Si no hay host, el primero que entra toma el mando
    if (!hostId) {
        hostId = socket.id;
        socket.emit('is_host', true);
    }

    socket.on('drive', (data) => {
        socket.broadcast.emit('player_update', { id: socket.id, ...data });
    });

    // Escuchar el pedido de reinicio
    socket.on('request_restart', () => {
        if (socket.id === hostId) {
            io.emit('start_countdown'); // Le avisamos a todos (especialmente a la TV)
        }
    });

    socket.on('disconnect', () => {
        io.emit('player_disconnected', socket.id);
        if (socket.id === hostId) {
            hostId = null;
            // Opcional: Podrías buscar otro socket para pasarle el host, 
            // pero para simplificar, el próximo que conecte será el host.
        }
    });
});

io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);
    
    socket.on('drive', (data) => {
        // Enviamos la info a la TV y otros jugadores
        socket.broadcast.emit('player_update', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        io.emit('player_disconnected', socket.id);
        console.log('Desconectado:', socket.id);
    });
});

// Render asigna el puerto automáticamente en process.env.PORT
const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
    console.log(`>>> Servidor corriendo en puerto: ${PORT}`);
});