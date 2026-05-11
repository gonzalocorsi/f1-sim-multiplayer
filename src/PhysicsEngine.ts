import Matter from 'matter-js';
import { Server } from 'socket.io';
import { Car } from './Car.js';
import { PlayerInput, Room } from './types.js';

export class PhysicsEngine {
    private engine: Matter.Engine;
    private io: Server;
    private players: Map<string, { car: Car, roomId: string }> = new Map();
    private trackWalls: Matter.Body[];
    private tireBarrier: Matter.Body[] = [];
    private lockedRooms: Set<string> = new Set();
    private onRaceFinished: (roomId: string, winnerId: string) => void;
    private getRooms: () => Room[];

    private readonly GRID_START_X = 740;
    private readonly GRID_START_Y = 610;
    private readonly OFFSET_X = -100;
    private readonly OFFSET_Y = 80;

    constructor(
        io: Server,
        onRaceFinished: (roomId: string, winnerId: string) => void,
        getRooms: () => Room[]
    ) {
        this.io = io;
        this.onRaceFinished = onRaceFinished;
        this.getRooms = getRooms;

        this.engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } });

        const { Bodies, Composite, Events } = Matter;

        this.trackWalls = [
            Bodies.rectangle(800, 0, 1600, 40, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(800, 900, 1600, 40, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(0, 450, 40, 900, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(1600, 450, 40, 900, { isStatic: true, label: 'wall' }),
            Bodies.rectangle(800, 450, 850, 250, {
                isStatic: true,
                isSensor: true,
                chamfer: { radius: 50 },
                label: 'grass_center'
            })
        ];

        const barrierY = 450;
        const tireRadius = 18;
        for (let x = 650; x <= 950; x += tireRadius * 2) {
            const tire = Bodies.circle(x, barrierY, tireRadius, {
                isStatic: true, restitution: 0.5, friction: 0.8, label: 'tire_barrier'
            });
            this.tireBarrier.push(tire);
        }

        Composite.add(this.engine.world, [...this.trackWalls, ...this.tireBarrier]);

        Events.on(this.engine, 'collisionStart', (event) => {
            event.pairs.forEach((pair) => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;
                const carBody = bodyA.label === 'car' ? bodyA : (bodyB.label === 'car' ? bodyB : null);
                const otherBody = carBody === bodyA ? bodyB : bodyA;

                if (carBody && otherBody.label !== 'grass_center') {
                    const entry = Array.from(this.players.values()).find(e => e.car.body === carBody);
                    if (entry) {
                        this.io.to(entry.car.id).emit('haptic_feedback', 'collision');
                    }
                }
            });
        });

        this.startHighFrequencyLoop();
        this.startLowFrequencyLoop();
    }

    public setRoomLocked(roomId: string, locked: boolean) {
        if (locked) this.lockedRooms.add(roomId);
        else this.lockedRooms.delete(roomId);
    }

    public addCar(socketId: string, roomId: string) {
        if (this.players.has(socketId)) return;

        const index = this.players.size;
        const row = Math.floor(index / 2);
        const col = index % 2;

        const posX = this.GRID_START_X + (row * this.OFFSET_X);
        const posY = this.GRID_START_Y + (col * this.OFFSET_Y);

        const car = new Car(
            socketId,
            '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            posX,
            posY
        );

        car.body.label = 'car';
        this.players.set(socketId, { car, roomId });
        Matter.Composite.add(this.engine.world, car.body);
    }

    public removeCar(socketId: string) {
        const entry = this.players.get(socketId);
        if (entry) {
            Matter.Composite.remove(this.engine.world, entry.car.body);
            this.players.delete(socketId);
        }
    }

    public handleInput(socketId: string, data: PlayerInput) {
        const entry = this.players.get(socketId);
        if (!entry) return;
        if (this.lockedRooms.has(entry.roomId)) return;

        const { car } = entry;
        car.isGas = data.gas;
        car.turnValue = data.turn || 0;
        car.isTurbo = data.turbo || false;
        car.isReverse = data.reverse || false;
    }

    public getPlayerCount(roomId: string): number {
        return Array.from(this.players.values()).filter(e => e.roomId === roomId).length;
    }
	public getLeaderboard(roomId: string): { id: string; color: string; laps: number }[] {
    return Array.from(this.players.values())
        .filter(e => e.roomId === roomId)
        .map(e => ({
            id: e.car.id,
            color: (e.car as any).color,
            laps: e.car.laps
        }))
        .sort((a, b) => b.laps - a.laps);
}

    private startHighFrequencyLoop() {
        setInterval(() => {
            Matter.Engine.update(this.engine, 1000 / 60);

            const entries = Array.from(this.players.values());
            entries.forEach(({ car }) => car.update());

            const roomIds = new Set(entries.map(e => e.roomId));
            roomIds.forEach(roomId => {
                const roomPlayers = entries.filter(e => e.roomId === roomId);
                this.io.to(roomId).emit('state_update', {
                    tireBarrier: this.tireBarrier.map(t => ({ x: t.position.x, y: t.position.y })),
                    players: roomPlayers.map(({ car }) => this.formatCarData(car))
                });
            });
        }, 1000 / 60);
    }

    private startLowFrequencyLoop() {
        const finishedRooms = new Set<string>();

        setInterval(() => {
            const rooms = this.getRooms();

            this.players.forEach((entry, socketId) => {
                const { car, roomId } = entry;
                const px = car.body.position.x;
                const py = car.body.position.y;

                const onOuterGrass = px < 225 || px > 1375 || py < 175 || py > 725;
                const collision = Matter.Query.collides(car.body, [this.trackWalls[4]]);

                car.isOnGrass = collision.length > 0 || onOuterGrass;
                car.checkLap();

                this.io.to(car.id).emit('telemetry', {
                    tireHealth: Math.floor(car.tireHealth * 100),
                    energy: Math.floor(car.energy * 100),
                    speed: Math.floor(car.body.speed * 20),
                    isOnGrass: car.isOnGrass
                });

                if (car.isOnGrass && car.body.speed > 2) {
                    this.io.to(car.id).emit('haptic_feedback', 'grass');
                }

                // Verificar fin de carrera
                const room = rooms.find(r => r.id === roomId);
                if (
                    room?.laps &&
                    car.laps >= room.laps &&
                    !finishedRooms.has(roomId)
                ) {
                    finishedRooms.add(roomId);
                    this.onRaceFinished(roomId, socketId);
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
            laps: car.laps,
            isOnGrass: car.isOnGrass,
            speed: car.body.speed
        };
    }
}