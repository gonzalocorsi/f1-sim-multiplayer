// Definimos la estructura del mapa
export interface MapProperties {
    id: string;
    name: string;
    grid: {
        gridStartX: number;
        gridStartY: number;
        offsetX: number;
        offsetY: number;
        offsetYRow?: number; // El signo ? lo hace opcional
        offsetYLane?: number;
		startAngle?: number;
    };
    checkGrass: (x: number, y: number) => boolean;
    checkSolidObstacles: (x: number, y: number) => boolean;
    checkpoints: ((x: number, y: number) => boolean)[];
}

const TRACK_WIDTH = 182;
const TRACK_HALF_WIDTH = TRACK_WIDTH / 2;


// Calcula un punto de una curva Bézier cúbica
function bezierPoint(
    p0: { x: number, y: number },
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number },
    t: number
) {
    const mt = 1 - t;

    return {
        x:
            mt * mt * mt * p0.x +
            3 * mt * mt * t * p1.x +
            3 * mt * t * t * p2.x +
            t * t * t * p3.x,

        y:
            mt * mt * mt * p0.y +
            3 * mt * mt * t * p1.y +
            3 * mt * t * t * p2.y +
            t * t * t * p3.y
    };
}


// Distancia de un punto a un segmento
function distanceToSegment(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number
): number {

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Segmento de longitud 0
    if (dx === 0 && dy === 0) {
        return Math.hypot(px - x1, py - y1);
    }

    // Proyección del punto sobre el segmento
    let t =
        ((px - x1) * dx + (py - y1) * dy) /
        (dx * dx + dy * dy);

    // Limitamos al segmento
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.hypot(
        px - closestX,
        py - closestY
    );
}

function createTrackCenterline() {

    const points: { x: number, y: number }[] = [];

    function addBezier(
    p0: { x: number, y: number },
    p1: { x: number, y: number },
    p2: { x: number, y: number },
    p3: { x: number, y: number }
) {

    const STEPS = 40;

    for (let i = 0; i <= STEPS; i++) {

        // Si no es la primera curva, evitamos repetir p0
        if (points.length > 0 && i === 0) {
            continue;
        }

        const t = i / STEPS;

        points.push(
            bezierPoint(p0, p1, p2, p3, t)
        );
    }
}


    // Punto inicial
    let current = { x: 100, y: 400 };


    // 1 ─────────────────────────────
    // Subida
    addBezier(
        current,
        { x: 50, y: 737 },
        { x: 200, y: 1100 },
        { x: 300, y: 400 }
    );

    current = { x: 300, y: 400 };


    // 2 ─────────────────────────────
    // Chicana
    addBezier(
        current,
        { x: 350, y: 260 },
        { x: 450, y: 260 },
        { x: 600, y: 260 }
    );

    current = { x: 600, y: 260 };


    // 3 ─────────────────────────────
    // Gran curva derecha
    addBezier(
        current,
        { x: 700, y: 260 },
        { x: 1000, y: 240 },
        { x: 1200, y: 650 }
    );

    current = { x: 1200, y: 650 };


    // 4 ─────────────────────────────
    addBezier(
        current,
        { x: 1250, y: 850 },
        { x: 1480, y: 850 },
        { x: 1500, y: 700 }
    );

    current = { x: 1500, y: 700 };


    // 5 ─────────────────────────────
    addBezier(
        current,
        { x: 1500, y: 700 },
        { x: 1500, y: 500 },
        { x: 1500, y: 200 }
    );

    current = { x: 1500, y: 200 };


    // 6 ─────────────────────────────
    addBezier(
        current,
        { x: 1500, y: 200 },
        { x: 1500, y: 0 },
        { x: 1300, y: 200 }
    );

    current = { x: 1300, y: 200 };


    // 7 ─────────────────────────────
    addBezier(
        current,
        { x: 1290, y: 200 },
        { x: 1200, y: 300 },
        { x: 1190, y: 100 }
    );

    current = { x: 1190, y: 100 };


    // 8 ─────────────────────────────
    addBezier(
        current,
        { x: 1200, y: 100 },
        { x: 400, y: 100 },
        { x: 300, y: 100 }
    );

    current = { x: 300, y: 100 };


    // 9 ─────────────────────────────
    // Regreso al inicio
    addBezier(
        current,
        { x: 100, y: 110 },
        { x: 130, y: 200 },
        { x: 100, y: 400 }
    );


    return points;
}

const trackCenterline = createTrackCenterline();

function isOnGrass(x: number, y: number): boolean {

    let minDistance = Infinity;

    for (let i = 0; i < trackCenterline.length - 1; i++) {

        const p1 = trackCenterline[i];
        const p2 = trackCenterline[i + 1];

        const distance = distanceToSegment(
            x,
            y,
            p1.x,
            p1.y,
            p2.x,
            p2.y
        );

        if (distance < minDistance) {
            minDistance = distance;
        }
    }

    return minDistance > TRACK_HALF_WIDTH;
}



// Estructura abstracta para MapConfigs.ts
export const MAPS_CONFIG : Record<string, MapProperties> = {
    'figure-0': {
        id: 'figure-0',
        name: 'Vuelta simple',
        grid: {
            gridStartX: 740,
            gridStartY: 610,
            offsetX: -100,
            offsetY: 80,
            offsetYRow: 0,
			
        },
		checkGrass: (x: number, y: number) => {
				return (x < 225 || x > 1375 || y < 175 || y > 725) || (x > 375 && x < 1225 && y > 325 && y < 575);
			},
		checkSolidObstacles: (x: number, y: number): boolean => {
			
			if (x >= 632 && x <= 968 && y >= 432&& y <= 468 ){
			
			return true;}
			else{return false;}
			
		},
		checkpoints: [
			(x, y) => {	return y > 160 && y < 340 && x > 760 && x < 850;}, 
			(x, y) =>  {   return y > 560 && y < 730 && x > 760 && x < 850;} 
		],
		

    },
'figure-8': {
        id: 'figure-8',
        name: 'Figure-8 Circuit',
        grid: {
            // Colocá acá los valores correspondientes calculados de tu código de dibujo
            gridStartX: 1050, 
            gridStartY: 260,
            offsetX: -65,
            offsetY: 50, // Usando tu OFFSET_Y_LANE
            offsetYRow: 16, // El ángulo que sube cada fila
			offsetYLane: 50// Usá el OFFSET_Y_LANE o la separación que desees entre carriles
		},
			checkGrass: (x: number, y: number) =>
			{
				// 1. Constantes del circuito
				const cx = 800, cy = 450;
				const leftCX = 510, rightCX = 1090;
				
				// Radios exteriores (con margen de piano) e interiores de la elipse
				const rxExt = 300 + (150 / 2) + (28 / 2); // 389
				const ryExt = 190 + (150 / 2) + (28 / 2); // 279
				// El radio interior es donde el asfalto termina hacia adentro (isla)
				// Definido por tu irx = 225, iry = 115
				const rxInt = 225; 
				const ryInt = 115;

				// 2. Ecuación de elipse para el óvalo izquierdo
				const distLeftExt = Math.pow(x - leftCX, 2) / Math.pow(rxExt, 2) + Math.pow(y - cy, 2) / Math.pow(ryExt, 2);
				const distLeftInt = Math.pow(x - leftCX, 2) / Math.pow(rxInt, 2) + Math.pow(y - cy, 2) / Math.pow(ryInt, 2);
				const onLeftLoop = distLeftExt <= 1 && distLeftInt >= 1;

				// 3. Ecuación de elipse para el óvalo derecho
				const distRightExt = Math.pow(x - rightCX, 2) / Math.pow(rxExt, 2) + Math.pow(y - cy, 2) / Math.pow(ryExt, 2);
				const distRightInt = Math.pow(x - rightCX, 2) / Math.pow(rxInt, 2) + Math.pow(y - cy, 2) / Math.pow(ryInt, 2);
				const onRightLoop = distRightExt <= 1 && distRightInt >= 1;

				// 4. Zona del cruce central (Rectángulo)
				const crossW = 110 + 20 + 30; // 160
				const crossH = 110 + 10;     // 120
				const onCenterPatch = (x >= cx - crossW/2 && x <= cx + crossW/2) && (y >= cy - crossH/2 && y <= cy + crossH/2);

				// Si está en el óvalo izquierdo, o en el derecho, o en el parche central... ¡Está en ASFALTO!
				const onAsphalt = onLeftLoop || onRightLoop || onCenterPatch;

				// Retornamos TRUE si está en el pasto (es decir, NO está en el asfalto)
				return !onAsphalt;
			},
		checkSolidObstacles: (x: number, y: number): boolean => {
			// 1. Validar si la Y está en el rango del diámetro de la barrera
			// 2. Validar si la X está entre el inicio y el fin de la barrera
			// 3. Devolver true si cumple, false si no.
			return false; 
		},
		checkpoints: [
			
			//(x, y) =>  {   return y > 360 && y < 540 && x > 1430 && x < 1520;} ,
			
			(x, y) =>  {   return y > 400 && y < 490 && x > 1330 && x < 1500;},
			(x, y) =>  {   return y > 410 && y < 500 && x > 695 && x < 890;},
			(x, y) => {	return y > 410 && y < 500 && x > 88 && x <273;},
			(x, y) =>  {   return y > 410 && y < 500 && x > 695 && x < 890;},
			(x, y) => {	return y > 170 && y < 340 && x > 1080 && x < 1170;}, 
		],
	},
	
    'monaco': {
        id: 'monaco',
        name: 'Vuelta simple',
        grid: {
            gridStartX: 450,
            gridStartY: 55,
            offsetX: 100,
            offsetY: 80,
            offsetYRow: 0,
			startAngle: Math.PI,

			
        },
		 checkGrass: (x: number, y: number) => {
        return isOnGrass(x, y);
    },

		checkSolidObstacles: (x: number, y: number): boolean => {
			
			if (x >= 632 && x <= 968 && y >= 432&& y <= 468 ){
			
			return true;}
			else{return false;}
			
		},
		checkpoints: [
			(x, y) =>  {   return y > 595 && y < 685 && x > 0 && x < 180;} ,
			(x, y) =>  {   return y > 595 && y < 685 && x >  180&& x < 360;} ,
			(x, y) =>  {   return y > 200 && y < 370 && x > 555 && x < 645;} ,
			(x, y) =>  {   return y > 635 && y < 725 && x > 1400 && x < 1580;} ,
			(x, y) =>  {   return y > 235 && y < 325 && x > 1400 && x < 1580;} ,
			
			
			(x, y) => {	return y > 30 && y < 210 && x > 305 && x < 395;} 
			
		],
		

    }
};