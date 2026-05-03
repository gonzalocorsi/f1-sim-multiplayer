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

app.use(express.static(path.join(__dirname, '../public')));

let hostId: string | null = null;

io.on('connection', (socket) => {
    console.log('Nuevo dispositivo conectado:', socket.id);
    
    // Asignar Host
    if (!hostId) {
        hostId = socket.id;
        socket.emit('is_host', true);
    }

    // Cambiamos broadcast.emit por io.emit para que la TV 
    // reciba SIEMPRE la actualización, sin importar quién la mande.
    socket.on('drive', (data) => {
        io.emit('player_update', { id: socket.id, ...data });
    });

    socket.on('request_restart', () => {
        if (socket.id === hostId) {
            io.emit('start_countdown');
        }
    });

    socket.on('disconnect', () => {
        console.log('Desconectado:', socket.id);
        io.emit('player_disconnected', socket.id);
        if (socket.id === hostId) {
            hostId = null;
            // Al desconectarse el host, el próximo mensaje 'drive' de otro podría reclamarlo
        }
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`>>> Servidor corriendo en puerto: ${PORT}`);
});