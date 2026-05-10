// src/LobbyManager.ts
import { Room } from './types.js';

export class LobbyManager {
    private rooms: Map<string, Room>;

    constructor() {
        this.rooms = new Map();
        this.initializeDefaultRooms();
    }

    private initializeDefaultRooms() {
        // Aquí definís tus pistas iniciales
        this.rooms.set("gp-bahia", {
            id: "gp-bahia",
            name: "Gran Premio Bahía Blanca",
            mapName: "Circuito del Puerto",
            status: "waiting",
            playerCount: 0,
            maxPlayers: 12
        });
        
        this.rooms.set("gp-monza", {
            id: "gp-monza",
            name: "Monza (Classic)",
            mapName: "Autodromo Nazionale",
            status: "waiting",
            playerCount: 0,
            maxPlayers: 20
        });
    }

    public getAllRooms(): Room[] {
        return Array.from(this.rooms.values());
    }

    public updatePlayerCount(roomId: string, count: number) {
        const room = this.rooms.get(roomId);
        if (room) {
            room.playerCount = count;
        }
    }

    public getRoom(roomId: string): Room | undefined {
        return this.rooms.get(roomId);
    }
	
	public addRoom(newRoom: Room) {
        this.rooms.set(newRoom.id, newRoom);
    }
}
