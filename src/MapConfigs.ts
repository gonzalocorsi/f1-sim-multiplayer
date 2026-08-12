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


function isOnGrass(
    x: number,
    y: number,
    curves: number[][][],
    trackWidth: number
): boolean {

    const halfWidth = trackWidth / 2;
    const steps = 20;

    for (const curve of curves) {

        const [p0, p1, p2, p3] = curve;

        let previousX = p0[0];
        let previousY = p0[1];

        for (let i = 1; i <= steps; i++) {

            const t = i / steps;
            const mt = 1 - t;

            const currentX =
                mt * mt * mt * p0[0] +
                3 * mt * mt * t * p1[0] +
                3 * mt * t * t * p2[0] +
                t * t * t * p3[0];

            const currentY =
                mt * mt * mt * p0[1] +
                3 * mt * mt * t * p1[1] +
                3 * mt * t * t * p2[1] +
                t * t * t * p3[1];

            const dx = currentX - previousX;
            const dy = currentY - previousY;

            const lengthSquared = dx * dx + dy * dy;

            let tSegment =
                ((x - previousX) * dx +
                 (y - previousY) * dy) /
                lengthSquared;

            tSegment = Math.max(0, Math.min(1, tSegment));

            const closestX =
                previousX + tSegment * dx;

            const closestY =
                previousY + tSegment * dy;

            const distance =
                Math.hypot(
                    x - closestX,
                    y - closestY
                );

            if (distance <= halfWidth) {
                return false; // está sobre asfalto
            }

            previousX = currentX;
            previousY = currentY;
        }
    }

    return true; // está sobre pasto
}

const MONACO_TRACK = [

    [
        [100, 400],
        [50, 737],
        [200, 1100],
        [300, 400]
    ],

    [
        [300, 400],
        [350, 260],
        [450, 260],
        [600, 260]
    ],

    [
        [600, 260],
        [700, 260],
        [1000, 240],
        [1200, 650]
    ],

    [
        [1200, 650],
        [1250, 850],
        [1480, 850],
        [1500, 700]
    ],

    [
        [1500, 700],
        [1500, 500],
        [1500, 200],
        [1500, 200]
    ],

    [
        [1500, 200],
        [1500, 0],
        [1500, 0],
        [1300, 200]
    ],

    [
        [1300, 200],
        [1290, 200],
        [1200, 300],
        [1190, 100]
    ],

    [
        [1190, 100],
        [1200, 100],
        [400, 100],
        [300, 100]
    ],

    [
        [300, 100],
        [100, 110],
        [130, 200],
        [100, 400]
    ]
];






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
			startAngle: Math.PI/2,

			
        },
		 checkGrass: (x: number, y: number) => {
    if (
        x >= 400 &&
        x <= 1000 &&
        y >= 550 &&
        y <= 650
    ) {
        return false;
    }

    return isOnGrass(x, y, MONACO_TRACK, 182);
},
	checkSolidObstacles: (x: number, y: number): boolean => {
			
			if (x >= 420 && x <= 870 && y >= 650&& y <= 685 ){
			
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