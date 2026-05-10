import { Room } from './types.js';

(window as any).socket = (window as any).io();
const socket = (window as any).socket;
const roomListContainer = document.getElementById('room-list') as HTMLElement;
const createForm = document.getElementById('create-room-form') as HTMLFormElement;

// ── 1. RECIBIR LISTA DE SALAS ──────────────────────────────────────────────
socket.on('update_rooms', (rooms: Room[]) => {
    renderLobby(rooms);
});

function renderLobby(rooms: Room[]) {
    if (!roomListContainer) return;
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
    <button class="join-btn" data-room-id="${room.id}" style="background:var(--f1-red); color:white; border:none; padding: 8px 16px; cursor:pointer;">
        Entrar
    </button>
`;
        roomListContainer.appendChild(card);
    });
	// Fuera del forEach, una sola vez
/*roomListContainer.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.join-btn') as HTMLElement;
    if (!btn) return;
    const roomId = btn.dataset.roomId!;
    socket.emit('join_session', { roomId, type: 'mando' });
    window.location.href = `/mando.html?room=${roomId}`;
});*/
}

// ── 2. CREAR SALA ──────────────────────────────────────────────────────────
if (createForm) {
    createForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name    = (document.getElementById('room-name') as HTMLInputElement).value;
        const mapName = (document.getElementById('map-select') as HTMLSelectElement).value;
        const laps    = (document.getElementById('laps-count') as HTMLInputElement).value;

        socket.emit('create_room', { name, mapName, laps: Number(laps) });
        createForm.reset();
    });
}

// ── 3. RESPUESTA DEL SERVIDOR AL CREADOR ──────────────────────────────────
socket.on('room_created', ({ roomId }: { roomId: string }) => {
    // El creador va directo al joystick
    window.location.href = `/mando.html?room=${roomId}`;
});

// ── 4. UNIRSE A UNA SALA EXISTENTE (botón "Entrar") ────────────────────────
(window as any).joinRoom = (roomId: string) => {
    // Usamos join_session que ya tenés implementado en server.ts
    socket.emit('join_session', { roomId, type: 'mando' });
    indow.location.href = `/mando.html?room=${roomId}`;
};