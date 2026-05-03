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
}