import Matter from 'matter-js';
import { Server } from 'socket.io';
import { Car } from './Car.js';
import { PlayerInput } from './types.js';

export class PhysicsEngine {
    private engine: Matter.Engine;
    private io: Server;
    private players: Map<string, Car> = new Map();
    private trackWalls: Matter.Body[];
    private tireBarrier: Matter.Body[] = [];

    // --- CONFIGURACIÓN DEL CIRCUITO ---
    private readonly GRID_START_X = 740;
    private readonly GRID_START_Y = 610;
    private readonly OFFSET_X = -100;
    private readonly OFFSET_Y = 80;

    constructor(io: Server) {
        this.io = io;
        this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

        const { Bodies, Composite, Events } = Matter;
        
        // 1. Paredes del circuito
        this.trackWalls = [
            Bodies.rectangle(800, 0, 1600, 40, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(800, 900, 1600, 40, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(0, 450, 40, 900, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(1600, 450, 40, 900, { isStatic: true, label: 'wall' }),
            // El sensor del centro (pasto)
            Bodies.rectangle(800, 450, 850, 250, { 
                isStatic: true, 
                isSensor: true, 
                chamfer: { radius: 50 }, 
                label: 'grass_center' 
            })
        ];

        // 2. Barrera de neumáticos
        const barrierY = 450;
        const tireRadius = 18;
        for (let x = 650; x <= 950; x += tireRadius * 2) {
            const tire = Bodies.circle(x, barrierY, tireRadius, {
                isStatic: true, restitution: 0.5, friction: 0.8, label: 'tire_barrier'
            });
            this.tireBarrier.push(tire);
        }

        Composite.add(this.engine.world, [...this.trackWalls, ...this.tireBarrier]);

        // 3. Sistema de detección de colisiones para Feedback Háptico
        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                // Identificamos si uno de los cuerpos es un auto
                const carBody = bodyA.label === 'car' ? bodyA : (bodyB.label === 'car' ? bodyB : null);
                const otherBody = carBody === bodyA ? bodyB : bodyA;

                // Si chocó contra una pared o neumático (no pasto)
                if (carBody && otherBody.label !== 'grass_center') {
                    const car = Array.from(this.players.values()).find(c => c.body === carBody);
                    if (car) {
                        this.io.to(car.id).emit('haptic_feedback', 'collision');
                    }
                }
            });
        });

        this.startHighFrequencyLoop();
        this.startLowFrequencyLoop();
    }

    public addCar(socketId: string, roomId: string) {
        if (this.players.has(socketId)) return;

        const index = this.players.size;
        const row = Math.floor(index / 2);
        const col = index % 2;

        const posX = this.GRID_START_X + (row * this.OFFSET_X);
        const posY = this.GRID_START_Y + (col * this.OFFSET_Y);

        const newCar = new Car(
            socketId,
            '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
            posX,
            posY
        );
        
        // Etiqueta para el motor de colisiones
        newCar.body.label = 'car';
        (newCar as any).roomId = roomId; 

        this.players.set(socketId, newCar);
        Matter.Composite.add(this.engine.world, newCar.body);
    }

    public removeCar(socketId: string) {
        const car = this.players.get(socketId);
        if (car) {
            Matter.Composite.remove(this.engine.world, car.body);
            this.players.delete(socketId);
        }
    }

    public handleInput(socketId: string, data: PlayerInput) {
        const car = this.players.get(socketId);
        if (car) {
            car.isGas = data.gas;
            car.turnValue = data.turn || 0;
            car.isTurbo = data.turbo || false;
            car.isReverse = data.reverse || false;
        }
    }

    public getPlayerCount(roomId: string): number {
        return Array.from(this.players.values()).filter(car => (car as any).roomId === roomId).length;
    }

    private startHighFrequencyLoop() {
        setInterval(() => {
            Matter.Engine.update(this.engine, 1000 / 60);

            const playerList = Array.from(this.players.values());
            playerList.forEach(car => car.update());

            const rooms = new Set(playerList.map(c => (c as any).roomId));
            
            rooms.forEach(roomId => {
                const roomPlayers = playerList.filter(c => (c as any).roomId === roomId);
                this.io.to(roomId as string).emit('state_update', {
                    tireBarrier: this.tireBarrier.map(t => ({ x: t.position.x, y: t.position.y })),
                    players: roomPlayers.map(car => this.formatCarData(car))
                });
            });
        }, 1000 / 60);
    }

    private startLowFrequencyLoop() {
        setInterval(() => {
            this.players.forEach(car => {
                const px = car.body.position.x;
                const py = car.body.position.y;

                // Lógica de detección de pasto
                const onOuterGrass = px < 225 || px > 1375 || py < 175 || py > 725;
                const collision = Matter.Query.collides(car.body, [this.trackWalls[4]]);
                
                car.isOnGrass = collision.length > 0 || onOuterGrass;
                car.checkLap();

                // 1. Enviar telemetría al mando
                this.io.to(car.id).emit('telemetry', {
                    tireHealth: Math.floor(car.tireHealth * 100),
                    energy: Math.floor(car.energy * 100),
                    speed: Math.floor(car.body.speed * 20),
                    isOnGrass: car.isOnGrass
                });

                // 2. Feedback de vibración por pasto
                if (car.isOnGrass && car.body.speed > 2) {
                    this.io.to(car.id).emit('haptic_feedback', 'grass');
                }
            });
        }, 150); 
    }

    private formatCarData(car: Car) {
        return {
            id: car.id,
            x: car.body.position.x,
            y: car.body.position.y,
            angle: car.body.angle,
            color: (car as any).color,
            isTurbo: car.isTurbo,
            laps: (car as any).laps,
            isOnGrass: car.isOnGrass,
            speed: car.body.speed
        };
    }
}