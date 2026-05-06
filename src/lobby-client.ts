import { Room } from './types.js';

// 1. Declaración para el navegador
declare var io: any;

// 2. Única instancia del socket
const socket = io();

// 3. Referencia al contenedor (usamos el ID que tengas en tu HTML, 'room-container' es el estándar)
const roomContainer = document.getElementById('room-container');

socket.on('connect', () => {
    console.log('Conectado al Lobby');
});

// 4. Actualización de salas
socket.on('update_rooms', (rooms: Room[]) => {
    if (!roomContainer) return;
    
    roomContainer.innerHTML = '';

    rooms.forEach((room: Room) => {
        const card = document.createElement('div');
        card.className = 'room-card';
        
        // Usamos las clases que tenías en tu diseño original
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
        roomContainer.appendChild(card);
    });
});

// 5. Función para unirse a sala
(window as any).joinRoom = (roomId: string) => {
    socket.emit('select_room', roomId);
};

// 6. Redirección a la carrera
socket.on('redirect', (data: { port: number, roomId: string }) => {
    const host = window.location.hostname; 
    const destino = `http://${host}:${data.port}/mando?room=${data.roomId}`;
    
    console.log("Redirigiendo a:", destino);
    window.location.href = destino;
});