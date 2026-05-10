const socket = io();
const roomListContainer = document.getElementById('room-list');
const createForm = document.getElementById('create-room-form');

// 1. RECIBIR SALAS
socket.on('update_rooms', (rooms) => {
    roomListContainer.innerHTML = '';
    const joinable = rooms.filter(r => r.status === 'waiting' || r.status === 'racing');

    if (joinable.length === 0) {
        roomListContainer.innerHTML = '<div class="loading">No hay pistas activas. ¡Creá una!</div>';
        return;
    }

    joinable.forEach(room => {
        const card = document.createElement('div');
        card.className = 'room-card';
        card.innerHTML = `
            <div>
                <strong>${room.name}</strong>
                <div style="font-size:12px; color:#aaa; margin-top:4px;">
                    ${room.mapName} · ${room.playerCount}/${room.maxPlayers} pilotos
                </div>
            </div>
            <button class="join-btn" data-room-id="${room.id}" 
                style="background:var(--f1-red);color:white;border:none;padding:8px 16px;cursor:pointer;">
                Entrar
            </button>
        `;
        roomListContainer.appendChild(card);
    });

    roomListContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.join-btn');
        if (!btn) return;
        const roomId = btn.dataset.roomId;
        socket.emit('join_session', { roomId, type: 'mando' });
        window.location.href = `/mando.html?room=${roomId}`;
    });
});

// 2. CREAR SALA
if (createForm) {
    createForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name    = document.getElementById('room-name').value;
        const mapName = document.getElementById('map-select').value;
        const laps    = document.getElementById('laps-count').value;
        socket.emit('create_room', { name, mapName, laps: Number(laps) });
        createForm.reset();
    });
}

// 3. RESPUESTA AL CREADOR
socket.on('room_created', ({ roomId }) => {
    window.location.href = `/mando.html?room=${roomId}`;
});