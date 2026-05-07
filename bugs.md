#Bugs y features a añadir en el F1

##Bugs
* Salir disparado despues de patinar mucho tiempo en el pasto
* Corregir el mecanismo de la marcha atras *
*Mejorar particulas
*Contador de vueltas
##Features de pista y de juego

###Features de pista
*Rebufo
*Recargar el DRL cada 1 vuelta
*Choques intencionales

###Features del juego
*Lobby y mensajes publicos
*Semaforo de largada
*Elegir nro de vueltas
*Crear usuarios e iniciar sesion
*Elegir mapa

*Scanear codigo QR para ingresar
*App nativa para android TV




*Mejorar el layout de los botones.


/f1-project
│
├── /src                        # Código fuente de TypeScript (Servidor)
│   ├── server.ts               # Punto de entrada (Orquestador)
│   ├── LobbyManager.ts         # Clase: Maneja salas, jugadores y estados
│   ├── PhysicsEngine.ts        # Clase: El motor de Matter.js (Genérico)
│   ├── Car.ts                  # Clase: Definición física y comportamiento del auto
│   │
│   ├── /tracks                 # LA CLAVE: Definiciones de cada circuito
│   │   ├── TrackBase.ts        # Clase padre o Interface con parámetros comunes
│   │   ├── Monza.ts            # Parámetros específicos: fricción, pasto, spawn points
│   │   └── Spa.ts              # Otra pista con sus propias reglas físicas
│   │
│   └── types.ts                # Interfaces y Types compartidos
│
├── /public                     # Archivos estáticos (Cliente / Navegador)
│   ├── /assets                 # Imágenes, sonidos, texturas de pistas
│   │   ├── monza-map.png
│   │   └── car-sprite.png
│   │
│   ├── /js                     # Scripts del lado del cliente
│   │   ├── lobby-client.js     # Maneja la UI del lobby y selección de modo
│   │   ├── mando-client.js     # Captura giroscopio y envía inputs
│   │   └── tv-client.js        # Renderiza el canvas de la carrera
│   │
│   ├── index.html              # Puerta de entrada (Lobby)
│   ├── mando.html              # Interfaz del volante
│   └── tv.html                 # Pantalla de visualización (Carrera)
│   └── solo.html        	# Pantalla partida (Cámara + Controles)
│   
│
├── tsconfig.json               # Configuración de TypeScript
├── package.json                # Dependencias (Express, Socket.io, Matter.js)
└── .gitignore                  # Para no subir node_modules