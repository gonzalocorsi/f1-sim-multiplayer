import express, { Application, Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { Room } from './types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class LobbyServer {
    private app: Application;
    private httpServer: HttpServer;
    private io: Server;
    private readonly PORT: number = 4000;

    // "Base de datos" temporal de salas
    private rooms: Room[] = [
        { 
            id: 'gp-argentina', 
            name: 'Gran Premio de Bahía Blanca', 
            port: 3000, 
            playerCount: 0, 
            maxPlayers: 10, 
            mapName: 'Classic',
            status: 'waiting' 
        },
        { 
            id: 'gp-monaco', 
            name: 'Circuito Callejero Mónaco', 
            port: 3001, 
            playerCount: 0, 
            maxPlayers: 6, 
            mapName: 'Street',
            status: 'coming_soon' 
        }
    ];

    constructor() {
        this.app = express();
        this.httpServer = createServer(this.app);
        
        // Configuración de Socket.io con CORS abierto para el celular
        this.io = new Server(this.httpServer, {
            cors: { origin: "*" }
        });

        // Middleware para leer JSON (necesario para el post de actualización)
        this.app.use(express.json());

        this.setupRoutes();
        this.setupSockets();
        this.setupStatusEndpoint();
    }

    private setupRoutes(): void {
        // Sirve la carpeta del lobby (donde está tu lista de salas)
        this.app.use(express.static(path.join(__dirname, '../public-lobby')));
    }

    private setupStatusEndpoint(): void {
        // Endpoint que llamará el servidor de carrera (puerto 3000) al Lobby (puerto 4000)
        this.app.post('/update-status', (req: Request, res: Response) => {
            const { roomId, playerCount, status } = req.body;
            const room = this.rooms.find(r => r.id === roomId);
            
            if (room) {
                room.playerCount = playerCount;
                room.status = status;
                // Avisamos a todos los celulares conectados al lobby que algo cambió
                this.io.emit('update_rooms', this.rooms);
                console.log(`Sala ${roomId} actualizada: ${playerCount} pilotos.`);
            }
            res.sendStatus(200);
        });
    }

    private setupSockets(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Usuario conectado al lobby: ${socket.id}`);

            // Enviamos las salas actuales apenas se conecta
            socket.emit('update_rooms', this.rooms);

            socket.on('select_room', (roomId: string) => {
                const room = this.rooms.find(r => r.id === roomId);
                if (room) {
                    // Solo enviamos el puerto. El cliente construye la URL con su hostname actual.
                    socket.emit('redirect', { port: room.port, roomId: room.id });
                }
            });

            socket.on('disconnect', () => {
                console.log(`Usuario salió del lobby: ${socket.id}`);
            });
        });
    }

    public listen(): void {
        this.httpServer.listen(this.PORT, () => {
            console.log(`>>> LOBBY SERVER running on: http://localhost:${this.PORT}`);
        });
    }
}

// Ejecución única del servidor
const lobby = new LobbyServer();
lobby.listen();