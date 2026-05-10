export interface PlayerInput {
    turn: number;
    gas: boolean;
    turbo: boolean;
	reverse: boolean; 
}

export interface PlayerState {
    id: string;
    x: number;
    y: number;
    angle: number;
    color: string;
    laps: number;
    isTurbo: boolean;
	isOnGrass?: boolean; // Útil para el visualizador
    speed?: number;      // Útil para la telemetría del mando
}
// --- NUEVOS TIPOS PARA EL LOBBY ---
export interface Room {
    id: string;
    name: string;
    port?: number;
    playerCount: number;
    maxPlayers: number;
    mapName: string;
    status: 'waiting' | 'racing' | 'finished'| 'coming_soon';
	hadPlayers?: boolean; 
}

export interface RedirectData {
    url: string;
    roomId: string;
}