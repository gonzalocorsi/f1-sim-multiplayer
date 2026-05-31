import Matter from 'matter-js';
import { Server } from 'socket.io';
import { Car } from './Car.js';
import { PlayerInput, Room } from './types.js';
import { MAPS_CONFIG } from './MapConfigs.js';

export class PhysicsEngine {
	
    private engine: Matter.Engine;
    private io: Server;
    private players: Map<string, { car: Car, roomId: string, mapId:string }> = new Map();
    private trackWalls: Matter.Body[];
    private lockedRooms: Set<string> = new Set();
	private finishedRooms: Set<string> = new Set();
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
            
        ];

        /*const barrierY = 450;
        const tireRadius = 18;
        for (let x = 650; x <= 950; x += tireRadius * 2) {
            const tire = Bodies.circle(x, barrierY, tireRadius, {
                isStatic: true, restitution: 0.5, friction: 0.8, label: 'tire_barrier'
            });
            this.tireBarrier.push(tire);
        }*/

        Composite.add(this.engine.world, [...this.trackWalls]);

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
		//this.startPositionLoop();
        this.startLowFrequencyLoop();
    }

    public setRoomLocked(roomId: string, locked: boolean) {
        if (locked) this.lockedRooms.add(roomId);
        else this.lockedRooms.delete(roomId);
    }

    public addCar(socketId: string, roomId: string, mapId: string) {
        if (this.players.has(socketId)) return;

		// 1. Buscá la configuración en el diccionario usando el mapId que entra por parámetro
		const mapConfig = MAPS_CONFIG[mapId]||MAPS_CONFIG['figure-0'];

		// 2. Extraé la grilla de ese mapa
		const grid = mapConfig.grid;

		const index = this.players.size;
		const row = Math.floor(index / 2);
		const col = index % 2;

		const posX = grid.gridStartX + (row * grid.offsetX);

		// Si existe offsetYLane, calcula centrado (col - 0.5), si no, usa el col directo del mapa viejo
		const laneOffset = grid.offsetYLane 
			? (col - 0.5) * grid.offsetYLane 
			: col * grid.offsetY;

		const rowAngleOffset = row * (grid.offsetYRow || 0);
		const posY = grid.gridStartY + laneOffset + rowAngleOffset;
		
        const car = new Car(
            socketId,
            '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
            posX,
            posY
        );

        car.body.label = 'car';
        this.players.set(socketId, { car, roomId, mapId });
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
	public resetRace(roomId: string){
		this.finishedRooms.delete(roomId)
		this.players.forEach((entry) =>{
		if(roomId ===entry.roomId){
			entry.car.laps=0;}
		});
	}

	private startHighFrequencyLoop() {
			setInterval(() => {
				Matter.Engine.update(this.engine, 1000 / 60);

				const entries = Array.from(this.players.values());
				
				// 1. Recorremos los jugadores
				entries.forEach((entry) => {
					const { car, mapId } = entry;
					car.update();

					// 2. Aquí realizamos el chequeo de obstáculos usando los datos del entry
					const map = MAPS_CONFIG[mapId || 'figure-0'];
					// Ejemplo conceptual de sintaxis para calcular un punto desplazado:
					const frontX = car.body.position.x + Math.cos(car.body.angle) * 25;
					const frontY = car.body.position.y + Math.sin(car.body.angle) * 25;
					const centroX =car.body.position.x;
					const centroY=car.body.position.y;
					const backX = car.body.position.x - Math.cos(car.body.angle) * 25;
					const backY = car.body.position.y - Math.sin(car.body.angle) * 25;
					if (map && (map.checkSolidObstacles(centroX, centroY) || map.checkSolidObstacles(frontX, frontY) || map.checkSolidObstacles(backX, backY))) {
						// 1. Frenamos el auto al impactar
						Matter.Body.setVelocity(car.body, { x: 0, y: 0 });

						// 2. Lo empujamos hacia afuera de la pared
						const retroceso = 5;
						const nuevaX = car.body.position.x - (Math.cos(car.body.angle) * retroceso);
						const nuevaY = car.body.position.y - (Math.sin(car.body.angle) * retroceso);
						
						Matter.Body.setPosition(car.body, { x: nuevaX, y: nuevaY });
					}
				});

				// 3. Emitimos el estado (limpio de tireBarrier)
				const roomIds = new Set(entries.map(e => e.roomId));
				roomIds.forEach(roomId => {
					const roomPlayers = entries.filter(e => e.roomId === roomId);
					this.io.to(roomId).emit('state_update', {
						players: roomPlayers.map(({ car }) => this.formatCarData(car))
					});
				});
			}, 1000 / 60);
		}

    private startLowFrequencyLoop() {


        setInterval(() => {
            const rooms = this.getRooms();

            this.players.forEach((entry, socketId) => {
                const { car, roomId, mapId } = entry;
                const px = car.body.position.x;
                const py = car.body.position.y;

				const mapConfig = MAPS_CONFIG[mapId|| 'figure-0'];
				
                const onOuterGrass = mapConfig ? mapConfig.checkGrass(px, py) : false;
				
                car.isOnGrass = mapConfig ? mapConfig.checkGrass(px, py) : false;
                car.checkLap(mapConfig);

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
                    !this.finishedRooms.has(roomId)
                ) {
                    this.finishedRooms.add(roomId);
                    this.onRaceFinished(roomId, socketId);
                }
            });
        }, 150);
    }
	/*public startPositionLoop() {
		setInterval(() => {
			this.players.forEach((entry, socketId) => {
				const { car } = entry;
				console.log(`Auto ${socketId} | X: ${car.body.position.x} | Y: ${car.body.position.y}`);
			});
		}, 3000);
	}*/

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