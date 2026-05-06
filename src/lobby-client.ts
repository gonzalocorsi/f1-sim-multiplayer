// 1. Quitá cualquier import de socket.io-client si vas a usar el declare
import { Room } from './types.js'; 

// 2. Usamos declare para decirle a TS que "io" vendrá del HTML (CDN)
declare var io: any;

// 3. Declaramos socket UNA SOLA VEZ
const socket = io();

// En lugar de import { io } from 'socket.io-client', usamos:
declare var io: any; 
const socket = io();

const socket: Socket = io();
const roomContainer = document.getElementById('room-list') as HTMLDivElement;

socket.on('update_rooms', (rooms: Room[]) => {
    const roomContainer = document.getElementById('room-container'); // Aseguramos que existe
    if (!roomContainer) return;
    
    roomContainer.innerHTML = '';

    rooms.forEach((room: Room) => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div class="card-header">
                <h3>${room.name}</h3>
                <span class="status ${room.status}">${room.status.toUpperCase()}</span>
            </div>
            <p>Mapa: <strong>${room.mapName}</strong></p>
            <div class="capacity">
                Pilotos: ${room.playerCount} / ${room.maxPlayers}
            </div>
            <button onclick="joinRoom('${room.id}')">INGRESAR A BOXES</button>
        `;
        roomContainer.appendChild(card);
    });
});

// Exponemos la función al window para el onclick del HTML
(window as any).joinRoom = (roomId: string) => {
    socket.emit('select_room', roomId);
};

// lobby-client.ts
socket.on('redirect', (data: { port: number, roomId: string }) => {
    // Si entraste por 192.168.0.154:4000, host será 192.168.0.154
    const host = window.location.hostname; 
    
    // Armamos la URL final
    const destino = `http://${host}:${data.port}/mando?room=${data.roomId}`;
    
    console.log("Redirigiendo a:", destino);
    window.location.href = destino;
});
// En lobby-client.ts
card.innerHTML = `
    <div class="card-header">
        <h3 class="room-name">${room.name}</h3>
        <span class="status-badge status-${room.status}">${room.status.toUpperCase()}</span>
    </div>
    <div class="room-details">
        <span>Mapa: <strong>${room.mapName}</strong></span>
        <span>Pilotos: ${room.playerCount} / ${room.maxPlayers}</span>
    </div>
    <button class="join-btn" onclick="joinRoom('${room.id}')">INGRESAR A BOXES</button>
`;