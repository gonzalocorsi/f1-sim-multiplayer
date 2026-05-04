import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import Matter from 'matter-js';
import { Car } from './Car.js';
import { PlayerInput } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

app.get('/tv', (req, res) => res.sendFile(path.join(__dirname, '../public', 'tv.html')));
app.get('/mando', (req, res) => res.sendFile(path.join(__dirname, '../public', 'index.html')));

// --- MOTOR FÍSICO ---
const { Engine, Bodies, Composite } = Matter;
const engine = Engine.create({ gravity: { x: 0, y: 0 } });

// --- CONFIGURACIÓN DEL CIRCUITO ---
const WORLD = { width: 1600, height: 900 };
const TRACK = {
    width: 1000,
    height: 400,
    x: 800,
    y: 450,        // sigue siendo el centro
    thickness: 150, // ← era 250, ahora coincide con roadWidth del canvas
    radius: 100
};

const trackWalls = [
    Bodies.rectangle(800, 0, 1600, 40, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(800, 900, 1600, 40, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(0, 450, 40, 900, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(1600, 450, 40, 900, { isStatic: true, label: 'wall' }),
    Bodies.rectangle(TRACK.x, TRACK.y, TRACK.width - TRACK.thickness, TRACK.height - TRACK.thickness, { 
        isStatic: true, 
        isSensor: true, 
        chamfer: { radius: TRACK.radius - 50 },  // ← era TRACK.radius: 30, incorrecto
        label: 'grass_center'
    })

];
Composite.add(engine.world, trackWalls);
// --- BARRERA DE RUEDAS EN EL CENTRO ---
const tireBarrier: Matter.Body[] = [];
const barrierY = TRACK.y; // Centro vertical del mundo (450)
const barrierStartX = TRACK.x - 150; // Empieza 150px a la izquierda del centro
const barrierEndX = TRACK.x + 150;   // Termina 150px a la derecha
const tireRadius = 18;

for (let x = barrierStartX; x <= barrierEndX; x += tireRadius * 2) {
    const tire = Bodies.circle(x, barrierY, tireRadius, {
        isStatic: true,
        restitution: 0.5,
        friction: 0.8,
        label: 'tire_barrier'
    });
    tireBarrier.push(tire);
}
Composite.add(engine.world, tireBarrier);

const players: Map<string, Car> = new Map();


// --- CONFIGURACIÓN DE LA PARRILLA ---
const GRID_START_X = 740; // Un poco a la derecha del centro (800) como pediste
const GRID_START_Y = 610; // En la zona de la meta (recta inferior)
const OFFSET_X = -100;    // Cuánto se mueve hacia atrás (izquierda en pantalla)
const OFFSET_Y = 80;     // Cuánto se desplaza lateralmente (abajo en pantalla)
// --- SOCKETS ---
io.on('connection', (socket) => {
    console.log('Conectado:', socket.id);

socket.on('register_player', () => {
    if (players.has(socket.id)) return;

    // Calculamos la posición según el número de autos actuales
    const index = players.size; // 0 para el primero, 1 para el segundo, etc.
    
    /**
     * LÓGICA DE PARRILLA:
     * - El 'piso' de la división (index / 2) nos dice en qué fila está.
     * - El módulo (index % 2) nos dice si está en la columna de la derecha o izquierda.
     */
    const row = Math.floor(index / 2);
    const col = index % 2;

    const posX = GRID_START_X + (row * OFFSET_X);
    const posY = GRID_START_Y + (col * OFFSET_Y);

    const newCar = new Car(
        socket.id,
        '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        posX,
        posY
    );

    players.set(socket.id, newCar);
    Composite.add(engine.world, newCar.body);
});

    socket.on('drive', (data: PlayerInput) => {
        const car = players.get(socket.id);
        if (car) {
            car.isGas = data.gas;
            car.turnValue = data.turn || 0;
            car.isTurbo = data.turbo || false;
			car.isReverse = data.reverse || false;
        }
    });

    socket.on('disconnect', () => {
        const car = players.get(socket.id);
        if (car) {
            Composite.remove(engine.world, car.body);
            players.delete(socket.id);
        }
    });
});

setInterval(() => {
    Engine.update(engine, 1000 / 60);
    const playerList = Array.from(players.values());

   playerList.forEach((car) => {
    const px = car.body.position.x;
    const py = car.body.position.y;
    const onOuterGrass = px < 225  || px > 1375  || py < 175  || py > 725;
    const collision = Matter.Collision.collides(car.body, trackWalls[4]); // ← solo una vez
    car.isOnGrass = collision !== null || onOuterGrass;

    car.update();
    car.checkLap();

    io.to(car.id).emit('telemetry', {
        tireHealth: Math.floor(car.tireHealth * 100),
        energy: Math.floor(car.energy * 100),
        speed: Math.floor(car.body.speed * 20),
        isOnGrass: car.isOnGrass
    });
});

    io.emit('state_update', {
        tireBarrier: tireBarrier.map(t => ({ x: t.position.x, y: t.position.y })),
        players: playerList.map(car => {
            const angle = car.body.angle;
            const right = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
            const lateralVel = Math.abs(car.body.velocity.x * right.x + car.body.velocity.y * right.y);
            return {
                id: car.id,
                x: car.body.position.x,
                y: car.body.position.y,
                angle: angle,
                color: car.color,
                isTurbo: car.isTurbo,
                laps: car.laps,
                isOnGrass: car.isOnGrass,
                speed: car.body.speed,
                isDrifting: (car.isOnGrass && (lateralVel > 1 || car.body.speed > 2))
            };
        })
    });
}, 1000 / 60);

const PORT = 3000;
httpServer.listen(PORT, () => console.log(`>>> F1 Engine (TS) en puerto: ${PORT}`));