var socket = io();
var container = document.getElementById("room-list");
var modal = document.getElementById("device-modal");
var btnCerrar = document.getElementById("btn-cerrar-modal");
var roleText = document.getElementById("current-role-text");
var btnCreateRace = document.getElementById("btn-create-race"); 



// 1. Verificar si ya existe una modalidad guardada al cargar
window.addEventListener('load', () => {
    const savedRole = localStorage.getItem('f1pro_role');
    if (savedRole) {
        modal.style.display = "none"; // Si ya eligió antes, ocultamos el modal
        btnCerrar.style.display = "block"; // Habilitamos que pueda cerrar el modal si lo abre después
    }
});

function updateRoleUI() {
    const savedRole = localStorage.getItem('f1pro_role');
    if (savedRole) {
        modal.style.display = "none"; 
        btnCerrar.style.display = "block"; // Permite cerrar el modal si se abre manualmente
        roleText.innerText = savedRole.toUpperCase(); // Muestra qué rol tienes (PC, TV, MANDO)
		
		// LÓGICA DEL BOTÓN CREAR: Solo se muestra si es 'mando'
        if (savedRole === 'mando') {
            btnCreateRace.style.display = "block";
        } else {
            btnCreateRace.style.display = "none";
        }
    } else {
        modal.style.display = "flex";
        btnCerrar.style.display = "none"; // Obligatorio elegir si no hay nada guardado
        roleText.innerText = "Ninguno";
    }
}
// 2. Función para guardar la elección y cerrar modal
window.selectDevice = function(type) {
    localStorage.setItem('f1pro_role', type);
    modal.style.display = "none";
    btnCerrar.style.display = "block";
	updateRoleUI();
    console.log("Modalidad guardada:", type);
};
// Ejecutar al cargar la página
window.addEventListener('load', updateRoleUI);
// Función para actualizar la interfaz según el rol guardado


// Abrir el modal manualmente (desde el botón del header)
window.openModalForce = function() {
    modal.style.display = "flex";
};

window.closeModal = function() {
    // Solo permite cerrar si ya existe un rol en memoria
    if (localStorage.getItem('f1pro_role')) {
        modal.style.display = "none";
    }
};

// 3. Función al hacer clic en una sala
window.joinRoom = function(roomId) {
    const role = localStorage.getItem('f1pro_role');
    
    if (!role) {
        modal.style.display = "flex";
        return;
    }

    let targetPage = "";
    if (role === "mando") targetPage = "mando.html";
    else if (role === "tv") targetPage = "tv.html";
    else targetPage = "solo.html";

    window.location.href = `/${targetPage}?room=${roomId}`;
};

socket.on("update_rooms", (rooms) => {
    if (!container) return;
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<div class="loading">No hay sesiones activas.</div>';
        return;
    }
    container.innerHTML = "";
    rooms.forEach((room) => {
        const isAvailable = room.status !== "coming_soon";
        let statusClass = isAvailable ? (room.status === "waiting" ? "status-waiting" : "status-racing") : "status-disabled";
        let statusText = isAvailable ? (room.status === "waiting" ? "EN BOXES" : "EN CARRERA") : "SIN FECHA";
        
        const card = document.createElement("div");
        card.className = "room-card";
        
        if (isAvailable) {
            // Ahora llama directamente a joinRoom
            card.onclick = () => joinRoom(room.id);
        } else {
            card.style.opacity = "0.5";
            card.style.cursor = "not-allowed";
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="room-name">${room.name}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <div class="room-details">
                <span>MAPA: ${room.mapName}</span>
                <span>${isAvailable ? `PILOTOS: ${room.playerCount}/${room.maxPlayers}` : "PRÓXIMAMENTE"}</span>
            </div>
            ${isAvailable ? '<button class="join-btn">Ingresar a Boxes</button>' : ""}
        `;
        container.appendChild(card);
    });
});