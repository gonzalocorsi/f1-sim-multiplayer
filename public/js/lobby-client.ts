// public/js/lobby-client.js
const socket = io();
const container = document.getElementById('room-list');
let selectedRoom = '';

// --- 1. FUNCIONES GLOBALES (Para que el HTML las vea) ---

window.openDeviceModal = function(roomId) {
    selectedRoom = roomId;
    document.getElementById('device-modal').style.display = 'flex';
};

window.closeModal = function() {
    document.getElementById('device-modal').style.display = 'none';
};

window.selectDevice = function(type) {
    if (!selectedRoom) return;
    
    let targetPage = '';
    if (type === 'mando') targetPage = 'mando.html';
    else if (type === 'tv') targetPage = 'tv.html';
    else targetPage = 'solo.html';

    window.location.href = `/${targetPage}?room=${selectedRoom}`;
};

// Cerrar con Escape
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// --- 2. ESCUCHA DE SALAS ---

socket.on('update_rooms', (rooms) => {
    console.log("Salas recibidas:", rooms);
    if (!container) return;
    
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="loading">No hay sesiones activas.</div>';
        return;
    }

    container.innerHTML = ''; 

    rooms.forEach(room => {
        const isAvailable = room.status !== 'coming_soon';
        let statusClass = isAvailable ? (room.status === 'waiting' ? 'status-waiting' : 'status-racing') : 'status-disabled';
        let statusText = isAvailable ? (room.status === 'waiting' ? 'EN BOXES' : 'EN CARRERA') : 'SIN FECHA';

        const card = document.createElement('div');
        card.className = 'room-card';
        
        // Si la sala está disponible, abrimos el modal moderno
        if (isAvailable) {
            card.onclick = () => openDeviceModal(room.id);
        } else {
            card.style.opacity = '0.5';
            card.style.cursor = 'not-allowed';
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="room-name">${room.name}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="room-details">
                <span>MAPA: ${room.mapName}</span>
                <span>${isAvailable ? `PILOTOS: ${room.playerCount}/${room.maxPlayers}` : 'PRÓXIMAMENTE'}</span>
            </div>
            ${isAvailable ? '<button class="join-btn">Ingresar a Boxes</button>' : ''}
        `;

        container.appendChild(card);
    });
});