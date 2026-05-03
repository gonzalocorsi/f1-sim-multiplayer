import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import Matter from 'matter-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/mando', (req, res) => res.sendFile(path.join(__dirname, 'public', 'mando.html')));

// --- MOTOR FÍSICO ---
const { Engine, Bodies, Composite, Body } = Matter;
const engine = Engine.create();
engine.gravity.y = 0;

// Paredes de la pista
const trackWalls = [
    Bodies.rectangle(800, 0, 1600, 40, { isStatic: true }),   // Arriba
    Bodies.rectangle(800, 900, 1600, 40, { isStatic: true }), // Abajo
    Bodies.rectangle(0, 450, 40, 900, { isStatic: true }),    // Izquierda
    Bodies.rectangle(1600, 450, 40, 900, { isStatic: true }),  // Derecha
    Bodies.rectangle(800, 450, 1000, 400, { isStatic: true, chamfer: { radius: 100 } }) // Centro
];
Composite.add(engine.world, trackWalls);

// --- VARIABLES DE CARRERA ---
const players = {};

const checkpoints = {
    meta: { x: 800, y: 750, width: 40, height: 150 }, // Línea de salida
    mitad: { x: 800, y: 150, width: 40, height: 150 } // Lado opuesto
};

// --- SOCKETS ---
io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);

    socket.on('register_player', () => {
        if (players[socket.id]) return;
        
        const carBody = Bodies.rectangle(800, 750, 50, 25, {
            density: 0.1,
            frictionAir: 0.05,
            restitution: 0.3,
            label: 'car'
        });
        
        players[socket.id] = {
            id: socket.id,
            body: carBody,
            color: '#' + Math.floor(Math.random()*16777215).toString(16),
            isGas: false,
            turnValue: 0,
			laps: 0,
			passedHalf: false,
			lastCheckpoint: Date.now()
		};
        Composite.add(engine.world, carBody);
    });

    socket.on('drive', (data) => {
        if (players[socket.id]) {
            players[socket.id].isGas = data.gas;
            players[socket.id].turnValue = data.turn || 0;
			players[socket.id].isTurbo = data.turbo || false;
		// Capturamos el turbo
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            Composite.remove(engine.world, players[socket.id].body);
            delete players[socket.id];
        }
    });
});

// --- LOOP ÚNICO DE FÍSICA Y EMISIÓN ---
setInterval(() => {
    // Actualización del motor físico (paso de tiempo fijo)
    Matter.Engine.update(engine, 1000 / 60);

    // 1. Procesar lógica individual de cada auto
    const playerArray = Array.from(players.values());

    playerArray.forEach((car: Car) => {
        car.update(); // Aquí se calcula el desgaste de gomas y ERS

        // Telemetría privada al mando del jugador
        io.to(car.id).emit('telemetry', {
            tireHealth: Math.floor(car.tireHealth * 100),
            energy: Math.floor(car.energy * 100),
            speed: Math.floor(car.body.speed * 20)
        });
    });

    // 2. Envío del estado global a la pantalla (TV)
    io.emit('state_update', {
        players: playerArray.map((car: Car) => ({
            id: car.id,
            x: car.body.position.x,
            y: car.body.position.y,
            angle: car.body.angle,
            color: car.color,
            isTurbo: car.isTurbo,
            laps: car.laps,
			speed: car.body.speed,  // Mandamos la velocidad para la lógica de partículas
			isOnGrass: car.isOnGrass // Usamos la propiedad que ya calculaste arriba
        }))
    });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`>>> F1 Engine corriendo en puerto: ${PORT}`));