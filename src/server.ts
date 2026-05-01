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