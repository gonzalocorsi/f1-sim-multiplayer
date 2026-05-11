import Matter from 'matter-js';
const { Body, Bodies } = Matter;

export class Car {
	// Agregar estas propiedades a la clase:
public prevX: number = 0;
public prevY: number = 0;
public lastLapTime: number = 0;
private readonly LAP_COOLDOWN = 1000; // ms
    public body: Matter.Body;
    public isGas: boolean = false;
    public isTurbo: boolean = false;
    public turnValue: number = 0;
    public laps: number = 0;
	
    public passedHalf: boolean = false;
    public tireHealth: number = 1.0; 
    public energy: number = 1.0; // Añadido para el ERS
	public isOnGrass: boolean = false;
	public isReverse: boolean = false;
	public inFinishZone: boolean = false;
	public inCheckpointZone: boolean = false;

    constructor(public id: string, public color: string, x: number, y: number) {
        this.body = Bodies.rectangle(x, y, 50, 25, {
			 // ← agregar
            density: 0.1,
            frictionAir: 0.016,
            restitution: 0.3,
            label: 'car'
        });
		this.prevX = x;
			this.prevY = y; 
    }

    update() {
		const velocity = this.body.velocity; // <--- AGREGÁ ESTA LÍNEA
        const angle = this.body.angle;
        const speed = this.body.speed; // Usamos la variable local
		const x = this.body.position.x;  // ← agregar
		const y = this.body.position.y;
        const forward = { x: Math.cos(angle), y: Math.sin(angle) };
        const right = { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };

// Dentro de update(), al principio o después de calcular speed:
if (!this.isGas && !this.isReverse && speed < 0.2) {
    Body.setVelocity(this.body, { x: 0, y: 0 });
    Body.setAngularVelocity(this.body, 0);
    return; // Salimos del update para que no calcule grip ni fuerzas
}
       // --- LÓGICA DE GRIP SEGÚN SUPERFICIE ---
        let baseGrip = 0.98; // Grip en asfalto
        let traction = 1.0;

        if (this.isOnGrass) {
            baseGrip = 0.15; // <--- EL AUTO SE VUELVE JABÓN
            traction = 0.4;  // Pierde potencia de aceleración
            this.tireHealth -= 0.0005; // El pasto/tierra ensucia y gasta
        }
this.tireHealth = Math.max(0, this.tireHealth);
const performanceFactor = 0.8 + (this.tireHealth * 0.2);
		const currentGrip = Math.max(0.05, baseGrip * this.tireHealth);
        const lateralVel = velocity.x * right.x + velocity.y * right.y;
		// 1. Calculamos cuánto de nuestra velocidad actual es lateral (el derrape)
const lateralVelX = right.x * (velocity.x * right.x + velocity.y * right.y);
const lateralVelY = right.y * (velocity.x * right.x + velocity.y * right.y);

// 2. Calculamos la velocidad frontal (lo que sí queremos mantener)
const forwardVelX = velocity.x - lateralVelX;
const forwardVelY = velocity.y - lateralVelY;

// 3. Aplicamos el grip: mantenemos la frontal y reducimos la lateral
// Si currentGrip es 0.15 (pasto), el auto conserva el 85% de su deslizamiento lateral
// Si currentGrip es 0.98 (asfalto), el auto conserva solo el 2% (se pega al suelo)
const gripFactor = 1 - currentGrip;
        
       Body.setVelocity(this.body, {
    x: forwardVelX + (lateralVelX * gripFactor),
    y: forwardVelY + (lateralVelY * gripFactor)
});
const MAX_SPEED = 15; // Ajustá este valor a tu gusto
if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    Body.setVelocity(this.body, {
        x: this.body.velocity.x * scale,
        y: this.body.velocity.y * scale
    });
}

        // --- Lógica de Energía (ERS) ---
if (this.isGas && this.isTurbo && this.energy > 0) {
    this.energy -= 0.015;
} else if (this.energy < 1.0) {
    this.energy += 0.001;
}
if (this.energy <= 0) this.isTurbo = false;

       // --- ACELERACIÓN (Afectada por la tracción del pasto) ---
if (this.isGas) {
    const power = ((this.isTurbo && this.energy > 0) ? 0.065 : 0.025) * traction* performanceFactor;
    Body.applyForce(this.body, this.body.position, {
        x: Math.cos(angle) * power,
        y: Math.sin(angle) * power
    });
}
		// --- MARCHA ATRÁS --- más débil que la normal
if (this.isReverse) {
    const reversePower = 0.010 * traction;
    Body.applyForce(this.body, this.body.position, {
        x: -Math.cos(angle) * reversePower,
        y: -Math.sin(angle) * reversePower
    });
}

        // --- GIRO ---
        if (speed > 0.2) {
            // En el pasto es más difícil girar con precisión
            const turnMultiplier = this.isOnGrass ? 1.5 : 1.0; 
            const turnAbility = Math.min(speed / 8, 1.2);
            Body.setAngularVelocity(this.body, this.turnValue * 0.08 * turnAbility * turnMultiplier);}
			
			
			    
    }


// Utilidad: intersección de segmentos
private segmentsIntersect(
    p1x: number, p1y: number, p2x: number, p2y: number,
    p3x: number, p3y: number, p4x: number, p4y: number
): boolean {
    const d1x = p2x - p1x, d1y = p2y - p1y;
    const d2x = p4x - p3x, d2y = p4y - p3y;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false; // paralelos

    const dx = p3x - p1x, dy = p3y - p1y;
    const t = (dx * d2y - dy * d2x) / cross;
    const u = (dx * d1y - dy * d1x) / cross;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

checkLap() {
    const x = this.body.position.x;
    const y = this.body.position.y;
    const now = Date.now();

    if (now - this.lastLapTime < this.LAP_COOLDOWN) return;

    // CHECKPOINT: franja horizontal donde pasa el auto en la recta de arriba
    const atCheckpoint = y > 160 && y < 340 && x > 760 && x < 850;

    // META: franja horizontal donde pasa el auto en la recta de abajo
    const atFinish = y > 560 && y < 730 && x > 760 && x < 850;

    if (atCheckpoint && !this.inCheckpointZone) {
        this.passedHalf = true;
    }
    this.inCheckpointZone = atCheckpoint;

    if (atFinish && !this.inFinishZone && this.passedHalf) {
        this.laps++;
        this.passedHalf = false;
        this.lastLapTime = now;
        console.log(`✅ Vuelta! Car ${this.id} | laps: ${this.laps}`);
    }
    this.inFinishZone = atFinish;
}

public destroy(world: Matter.World) {
    Matter.Composite.remove(world, this.body);
}
getData() {
    return {
        id: this.id,
        x: this.body.position.x,
        y: this.body.position.y,
        angle: this.body.angle,
        color: this.color,
        isTurbo: this.isTurbo,
        laps: this.laps,
        isOnGrass: this.isOnGrass,
        speed: this.body.speed
    };
}
}