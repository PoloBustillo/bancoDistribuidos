# 🏦 Sistema Bancario Distribuido con Locks Coordinados

Un sistema bancario distribuido que implementa el patrón **Coordinador-Trabajador** para gestionar operaciones concurrentes sobre cuentas bancarias compartidas usando **locks distribuidos**.

## 🚀 Quick Start

Existen **3 formas** de ejecutar el sistema. Elige la que mejor se adapte a tu entorno:

### 🐋 Opción 1: Docker con PostgreSQL Incluido (Más Fácil)

Ideal para **desarrollo local** o **testing**. Incluye base de datos PostgreSQL en contenedor.

```bash
# 1. Clonar repositorio
git clone https://github.com/PoloBustillo/bancoDistribuidos.git
cd bancoDistribuidos

# 2. Configurar password de base de datos
echo "DB_PASSWORD=tu_password_seguro" > .env

# 3. Iniciar TODOS los servicios (PostgreSQL + Coordinador + 3 Workers)
docker compose -f docker-compose.full.yml up -d

# 4. Ejecutar migraciones de base de datos (solo primera vez)
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate deploy"

# 5. (Opcional) Cargar datos de prueba
docker exec banco-worker-1 sh -c "cd /app/worker && bun run seed:advisor"

# 6. Verificar que todo funciona
docker compose -f docker-compose.full.yml ps
# Deberías ver: postgres, coordinador, worker-1, worker-2, worker-3 (5 contenedores)

# 7. Ver logs en tiempo real
docker compose -f docker-compose.full.yml logs -f
```

✅ **URLs de acceso:**

- Coordinador: `http://localhost:4000`
- Worker 1: `http://localhost:3001`
- Worker 2: `http://localhost:3002`
- Worker 3: `http://localhost:3003`
- PostgreSQL: `localhost:5432` (usuario: `banco_user`, db: `banco`)

---

### 🌐 Opción 2: Docker con Base de Datos Externa (Producción)

Ideal para **servidores en producción** con BD PostgreSQL existente.

```bash
# 1. Clonar repositorio
git clone https://github.com/PoloBustillo/bancoDistribuidos.git
cd bancoDistribuidos

# 2. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar DATABASE_URL, JWT_SECRET, CORS_ORIGIN

# Ejemplo de .env:
# DATABASE_URL=postgresql://usuario:password@tu-servidor.com:5432/banco
# JWT_SECRET=tu_secreto_super_seguro_cambiar_en_produccion
# CORS_ORIGIN=https://tudominio.com

# 3. Iniciar servicios (Coordinador + 3 Workers)
docker compose up -d

# 4. Ejecutar migraciones en la base de datos externa
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate deploy"

# 5. Verificar estado
docker compose ps
docker compose logs -f coordinador
docker compose logs -f worker-1
```

📝 **Nota:** Si tu BD está en `localhost` del servidor y tienes problemas de conexión, descomenta `network_mode: "host"` en los workers del `docker-compose.yml`.

---

### � Opción 3: Desarrollo Local Sin Docker (Más Control)

Ideal para **desarrollo activo** con hot-reload y debugging.

#### Prerequisitos

- [Bun](https://bun.sh) v1.0+ instalado
- PostgreSQL corriendo (local o remoto)
- Node.js v18+ (opcional, Bun es suficiente)

```bash
# 1. Clonar repositorio
git clone https://github.com/PoloBustillo/bancoDistribuidos.git
cd bancoDistribuidos

# 2. Instalar dependencias en todos los workspaces
bun install

# 3. Configurar base de datos
cd worker
echo "DATABASE_URL=postgresql://usuario:password@localhost:5432/banco" > .env
echo "JWT_SECRET=dev_secret_123" >> .env

# 4. Ejecutar migraciones
bun run prisma:migrate:dev

# 5. (Opcional) Cargar datos de prueba
bun run seed:advisor

# 6. Iniciar servicios en terminales separadas

# Terminal 1: Coordinador
cd coordinador
bun run dev  # Puerto 4000

# Terminal 2: Worker 1
cd worker
PORT=3001 bun run dev

# Terminal 3: Worker 2
cd worker
PORT=3002 bun run dev

# Terminal 4: Worker 3
cd worker
PORT=3003 bun run dev

# Terminal 5 (Opcional): Frontend
cd frontend
bun run dev  # Puerto 3000
```

**🔥 Comando rápido para iniciar todo a la vez:**

```bash
# Desde la raíz del proyecto
bun run dev:backend  # Inicia coordinador + 1 worker
```

---

### � Documentación Adicional

- 🐋 [Docker Setup Completo](./DOCKER-SETUP.md)
- 🔄 [GitHub Actions CI/CD](./DEPLOYMENT-GITHUB-ACTIONS.md)
- 📋 [Deployment Manual en Servidor](./DEPLOYMENT-FINAL.md)
- 🚨 [Troubleshooting Común](#-troubleshooting-común)

## � Arquitectura

### 🎯 Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    COORDINADOR CENTRAL                       │
│                      (Puerto 4000)                           │
│                                                              │
│  • Gestiona locks de recursos (cuentas bancarias)          │
│  • Cola de prioridad para solicitudes de locks             │
│  • Verificación de heartbeats de workers                   │
│  • Liberación automática de locks expirados                │
│  • Estadísticas en tiempo real                             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼────────┐    ┌───────▼────────┐    ┌──────▼─────────┐
│   WORKER 1     │    │   WORKER 2     │    │   WORKER 3     │
│ Puerto: Auto   │    │ Puerto: Auto   │    │ Puerto: Auto   │
│                │    │                │    │                │
│ • Auth (JWT)   │    │ • Auth (JWT)   │    │ • Auth (JWT)   │
│ • Operaciones  │    │ • Operaciones  │    │ • Operaciones  │
│   bancarias    │    │   bancarias    │    │   bancarias    │
│ • Solicita     │    │ • Solicita     │    │ • Solicita     │
│   locks        │    │   locks        │    │   locks        │
└────────┬───────┘    └────────┬───────┘    └────────┬───────┘
         │                     │                     │
         └─────────────────────┴─────────────────────┘
                              │
                   ┌──────────▼──────────┐
                   │   PostgreSQL DB     │
                   │  (Compartida)       │
                   │                     │
                   │ • Usuarios          │
                   │ • Sesiones          │
                   │ • Cuentas           │
                   └─────────────────────┘
```

## ✨ Características Principales

### 🔐 Autenticación Distribuida

- ✅ **JWT tokens** compartidos entre workers
- ✅ **Sesión única**: Login en un worker invalida sesiones en otros (configurable)
- ✅ **Base de datos compartida**: Todos los workers ven las mismas sesiones
- ✅ **SINGLE_SESSION mode**: `true` = 1 sesión por usuario, `false` = múltiples dispositivos

### 💰 Operaciones Bancarias con Locks

- ✅ **Depósitos**: Con lock de cuenta individual
- ✅ **Retiros**: Validación de saldo + lock
- ✅ **Transferencias**: Lock de 2 cuentas ordenadas (previene deadlock)
- ✅ **Consulta saldo**: Sin locks (lectura simple)

### 🔒 Sistema de Locks Distribuidos

- ✅ **Coordinador central**: Gestiona todos los locks
- ✅ **Cola de prioridad**: BAJA, NORMAL, ALTA, CRÍTICA
- ✅ **Timeouts automáticos**: Locks expiran en 30s
- ✅ **Heartbeat monitoring**: Workers muertos liberan sus locks
- ✅ **Prevención de deadlocks**: Ordenamiento consistente de recursos

### 🛡️ Seguridad Avanzada

- ✅ **Tokens en sessionStorage**: Más seguro que localStorage (se borran al cerrar navegador)
- ✅ **Timeout automático**: Sesión expira tras 30 min de inactividad
- ✅ **Rate limiting**: Máximo 60 peticiones/minuto por endpoint
- ✅ **Monitoreo de actividad**: Detecta interacción del usuario
- ✅ **Alertas visuales**: Notificaciones cuando quedan <5 min de sesión
- ✅ **Persistencia en recargas**: La sesión NO se pierde al refrescar
- ✅ **Migración segura**: Limpieza automática de tokens antiguos

📖 **[Ver documentación completa de seguridad](frontend/SECURITY.md)**

│ • Cola de espera con prioridades │✅ **Beneficiarios**: Gestión de contactos frecuentes

│ • Detección de deadlocks │✅ **Notificaciones**: Sistema de alertas con prioridades

│ • Monitoreo de salud de trabajadores │✅ **Pagos programados**: Transferencias recurrentes automáticas

└──────────────────┬──────────────────────────────────────────┘✅ **Límites de operación**: Control de transacciones diarias

                   │✅ **Sistema de bloqueos distribuido** para evitar race conditions

        ┌──────────┼──────────┐✅ **Transacciones atómicas** entre cuentas (ACID)

        │          │          │✅ **Log de auditoría** completo de todas las operaciones

        ▼          ▼          ▼✅ **API REST** documentada con Swagger/OpenAPI

┌────────┐ ┌────────┐ ┌────────┐✅ **WebSockets (Socket.IO)** para comunicación en tiempo real

│ WORKER │ │ WORKER │ │ WORKER │✅ **Multi-cliente simultáneo**: Múltiples clientes conectados a la vez

│ 3001 │ │ 3002 │ │ 3003 │✅ **Sincronización en tiempo real**: Todos ven los cambios instantáneamente

└────────┘ └────────┘ └────────┘✅ **Documentación interactiva**: Swagger UI para probar la API

        │          │          │✅ **Frontend interactivo** con React

        └──────────┼──────────┘✅ **Código 100% en español**

                   │

---

## 🏗️ Arquitectura del Sistema

### 📐 Patrón Coordinador-Trabajador (Coordinator-Worker)

Este sistema implementa un **patrón de arquitectura distribuida** donde múltiples workers procesan operaciones bancarias concurrentes de forma segura mediante un coordinador central que gestiona locks distribuidos.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAPA DE CLIENTE                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  FRONTEND (Next.js + React + TypeScript)                 │   │
│  │  - Dashboard de usuario                                   │   │
│  │  - Gestión de cuentas y tarjetas                         │   │
│  │  - Transferencias y operaciones                          │   │
│  │  - Sistema de notificaciones real-time (Socket.IO)       │   │
│  └───────────────────┬──────────────────────────────────────┘   │
└────────────────────────┼───────────────────────────────────────┘
                         │ HTTP/REST + WebSocket
┌────────────────────────┼───────────────────────────────────────┐
│                        ▼  CAPA DE APLICACIÓN                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │          WORKER 1        WORKER 2        WORKER 3        │   │
│  │         (Port 3001)     (Port 3002)     (Port 3003)      │   │
│  │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │   │
│  │  │ API REST    │   │ API REST    │   │ API REST    │    │   │
│  │  │ Express.js  │   │ Express.js  │   │ Express.js  │    │   │
│  │  ├─────────────┤   ├─────────────┤   ├─────────────┤    │   │
│  │  │ Auth JWT    │   │ Auth JWT    │   │ Auth JWT    │    │   │
│  │  ├─────────────┤   ├─────────────┤   ├─────────────┤    │   │
│  │  │ Servicios:  │   │ Servicios:  │   │ Servicios:  │    │   │
│  │  │ • Banco     │   │ • Banco     │   │ • Banco     │    │   │
│  │  │ • Cuentas   │   │ • Cuentas   │   │ • Cuentas   │    │   │
│  │  │ • Tarjetas  │   │ • Tarjetas  │   │ • Tarjetas  │    │   │
│  │  │ • Asesor    │   │ • Asesor    │   │ • Asesor    │    │   │
│  │  ├─────────────┤   ├─────────────┤   ├─────────────┤    │   │
│  │  │ Prisma ORM  │   │ Prisma ORM  │   │ Prisma ORM  │    │   │
│  │  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘    │   │
│  └─────────┼─────────────────┼─────────────────┼───────────┘   │
│            │ Socket.IO        │                 │               │
│            └─────────┬────────┴─────────────────┘               │
│                      │ (Lock Protocol)                          │
│  ┌───────────────────▼──────────────────────────────────────┐   │
│  │           COORDINADOR (Port 4000)                        │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Gestor de Locks Distribuidos                      │  │   │
│  │  │  • Registro de workers                             │  │   │
│  │  │  • Gestión de locks (mutex distribuido)            │  │   │
│  │  │  • Cola FIFO de solicitudes                        │  │   │
│  │  │  • Detección de deadlocks                          │  │   │
│  │  │  • Manejo de timeouts                              │  │   │
│  │  │  • Heartbeat monitoring                            │  │   │
│  │  │  • Sistema de prioridades (3 niveles)              │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      CAPA DE DATOS                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            PostgreSQL (Puerto 5432)                      │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │  Base de Datos Compartida (ACID)                   │  │   │
│  │  │  • usuarios                                         │  │   │
│  │  │  • cuentas_bancarias                               │  │   │
│  │  │  • tarjetas                                         │  │   │
│  │  │  • transacciones                                    │  │   │
│  │  │  • movimientos                                      │  │   │
│  │  │  • sesiones                                         │  │   │
│  │  │  • cuentas_compartidas (rol-based access)          │  │   │
│  │  │  • asesores                                         │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🔄 Flujo de Operación con Locks Distribuidos

#### Ejemplo: Transferencia entre cuentas

```
┌────────────┐     1. POST /api/banco/transferir     ┌──────────┐
│  Cliente   │─────────────────────────────────────▶│ Worker 1 │
│  (React)   │   {origen: "A", destino: "B", $100}  │ (3001)   │
└────────────┘                                        └────┬─────┘
                                                           │
                 2. LOCK_REQUEST ["cuenta-A", "cuenta-B"] │
                 ┌──────────────────────────────────────────┘
                 │
                 ▼
          ┌──────────────┐
          │ Coordinador  │  3. Verificar disponibilidad
          │   (4000)     │     de recursos
          └──────┬───────┘
                 │
         ┌───────┴────────┐
         │                │
    ✅ Disponible    ❌ Ocupado
         │                │
         │                └──▶ Agregar a cola FIFO
         │                     ⏱️  Esperar liberación
         ▼
   LOCK_GRANTED ───────────┐
         │                 │
         │                 ▼
         │          ┌──────────┐
         └─────────▶│ Worker 1 │  4. Sección crítica:
                    │ (3001)   │     - Leer saldos (BD)
                    └────┬─────┘     - Validar fondos
                         │           - Actualizar saldos
                         │           - Registrar transacción
                         │
                         │  5. LOCK_RELEASE ["cuenta-A", "cuenta-B"]
                         └────────────┐
                                      ▼
                               ┌──────────────┐
                               │ Coordinador  │  6. Liberar locks
                               │   (4000)     │     Procesar cola
                               └──────┬───────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                    Siguiente en cola?        Cola vacía
                         │                         │
                    LOCK_GRANTED ───▶ Worker X    ✅ Fin
```

**🎓 Conceptos de Sistemas Distribuidos Aplicados:**

- **Exclusión Mutua**: Solo un worker puede modificar una cuenta a la vez
- **Sección Crítica**: Código protegido por lock (lectura + validación + escritura)
- **Atomicidad**: Operación completa o rollback (transacciones ACID)
- **Orden FIFO**: Prevención de starvation en cola de espera
- **Deadlock Prevention**: Ordenamiento canónico de recursos
- **Timeout Management**: Liberación automática de locks colgados

---

### 📁 Estructura del Proyecto

```
bancoDistribuidos/
├── coordinador/                # 🎯 Servidor coordinador de locks
│   ├── src/
│   │   ├── server.ts          # Socket.IO server (puerto 4000)
│   │   └── coordinator/
│   │       ├── coordinator.ts  # Lógica principal del coordinador
│   │       ├── locks.ts       # Gestión de locks distribuidos
│   │       ├── queue.ts       # Cola FIFO con prioridades
│   │       ├── deadlock.ts    # Detección y prevención de deadlocks
│   │       ├── workers.ts     # Registro y monitoreo de workers
│   │       ├── events.ts      # Manejo de eventos Socket.IO
│   │       └── types.ts       # Tipos del protocolo de locks
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── worker/                     # 🏢 Instancias del banco (workers)
│   ├── src/
│   │   ├── server.ts          # Express API REST + Socket.IO client
│   │   ├── auth/
│   │   │   └── authService.ts # Autenticación JWT + bcrypt
│   │   ├── services/
│   │   │   ├── bancoService.ts           # 💰 Operaciones bancarias con locks
│   │   │   ├── cuentasService.ts         # Gestión de cuentas
│   │   │   ├── tarjetasService.ts        # Gestión de tarjetas
│   │   │   ├── cuentasCompartidasService.ts # Cuentas multi-usuario
│   │   │   └── advisorService.ts         # Sistema de asesoría
│   │   ├── prisma/
│   │   │   └── client.ts      # Cliente Prisma singleton
│   │   └── client/
│   │       └── coordinatorClient.ts # Cliente del coordinador
│   ├── prisma/
│   │   ├── schema.prisma      # 📊 Schema de base de datos
│   │   └── migrations/        # Migraciones versionadas
│   ├── scripts/
│   │   └── seed-advisor.ts    # Datos de prueba
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                   # 🎨 Interfaz de usuario
│   ├── src/
│   │   ├── app/               # Next.js App Router
│   │   │   ├── page.tsx       # Landing page
│   │   │   ├── dashboard/     # Dashboard principal
│   │   │   ├── accounts/      # Gestión de cuentas
│   │   │   ├── cards/         # Gestión de tarjetas
│   │   │   ├── transfer/      # Transferencias
│   │   │   ├── operations/    # Depósitos y retiros
│   │   │   ├── transactions/  # Historial
│   │   │   ├── advisor/       # Sistema de asesoría
│   │   │   └── settings/      # Configuración
│   │   ├── components/
│   │   │   ├── AuthForm.tsx           # Login/Register
│   │   │   ├── Dashboard.tsx          # Dashboard principal
│   │   │   ├── AccountCard.tsx        # Tarjeta de cuenta
│   │   │   ├── ConnectionStatus.tsx   # Estado de conexión
│   │   │   ├── NotificationCenter.tsx # Notificaciones real-time
│   │   │   ├── SessionMonitor.tsx     # Monitor de sesión
│   │   │   └── ui/            # Componentes reutilizables
│   │   ├── context/
│   │   │   ├── AppContext.tsx # Estado global de la app
│   │   │   └── ToastContext.tsx # Sistema de notificaciones
│   │   ├── hooks/
│   │   │   └── useSocket.ts   # Hook de Socket.IO
│   │   ├── lib/
│   │   │   ├── api.ts         # Cliente HTTP (Axios)
│   │   │   ├── auth.ts        # Utilidades de autenticación
│   │   │   └── validation.ts  # Validaciones de formularios
│   │   └── types/
│   │       └── index.ts       # Tipos TypeScript
│   ├── package.json
│   ├── next.config.ts
│   └── tsconfig.json
│
├── shared/                     # 🔧 Código compartido
│   ├── types.ts               # Tipos compartidos
│   ├── validation.ts          # Validaciones Zod
│   ├── logger.ts              # Logger Winston
│   └── errorHandling.ts       # Manejo de errores
│
├── microservicios/             # 🔔 Microservicios adicionales
│   └── notificaciones/
│       └── src/
│           ├── index.ts       # Servidor de notificaciones
│           ├── grpcServer.ts  # gRPC server
│           └── services/      # Lógica de notificaciones
│
├── scripts/                    # 🛠️ Scripts de utilidad
│   ├── health-check.sh        # Health check (Bash)
│   └── health-check.ps1       # Health check (PowerShell)
│
├── docker-compose.yml          # 🐋 Docker sin PostgreSQL
├── docker-compose.full.yml     # 🐋 Docker con PostgreSQL
├── docker-compose.dev.yml      # 🐋 Docker para desarrollo
├── Caddyfile                   # Reverse proxy config
├── ecosystem.config.json       # PM2 config
├── .env.example                # Template de variables de entorno
└── README.md                   # Este archivo
```

---

### 🔧 Stack Tecnológico

#### Backend (Workers)

| Tecnología           | Versión | Propósito                          |
| -------------------- | ------- | ---------------------------------- |
| **Bun**              | v1.0+   | Runtime JavaScript ultra-rápido    |
| **Node.js**          | v18+    | Runtime alternativo (compatible)   |
| **Express.js**       | v4.18+  | Framework web minimalista          |
| **TypeScript**       | v5.0+   | Tipado estático                    |
| **Prisma ORM**       | v5.0+   | ORM type-safe para PostgreSQL      |
| **PostgreSQL**       | v15+    | Base de datos relacional (ACID)    |
| **Socket.IO Client** | v4.6+   | Cliente WebSocket para coordinador |
| **JWT**              | v9.0+   | Autenticación stateless            |
| **bcrypt**           | v5.1+   | Hash de contraseñas                |
| **Zod**              | v3.22+  | Validación de schemas              |
| **Winston**          | v3.11+  | Sistema de logging                 |

#### Coordinador

| Tecnología     | Versión | Propósito                      |
| -------------- | ------- | ------------------------------ |
| **Bun**        | v1.0+   | Runtime JavaScript             |
| **Socket.IO**  | v4.6+   | WebSocket server bidireccional |
| **TypeScript** | v5.0+   | Tipado estático                |
| **UUID**       | v9.0+   | Generación de IDs únicos       |

#### Frontend

| Tecnología           | Versión | Propósito                     |
| -------------------- | ------- | ----------------------------- |
| **React**            | v18+    | Librería de UI                |
| **Next.js**          | v14+    | Framework React con SSR       |
| **TypeScript**       | v5.0+   | Tipado estático               |
| **Axios**            | v1.6+   | Cliente HTTP                  |
| **Socket.IO Client** | v4.6+   | WebSocket para notificaciones |
| **Tailwind CSS**     | v3.4+   | Utility-first CSS framework   |
| **React Icons**      | v4.12+  | Iconos SVG                    |
| **React Hook Form**  | v7.49+  | Manejo de formularios         |

#### DevOps

| Tecnología         | Propósito                        |
| ------------------ | -------------------------------- |
| **Docker**         | Containerización                 |
| **Docker Compose** | Orquestación multi-contenedor    |
| **GitHub Actions** | CI/CD pipeline                   |
| **Caddy**          | Reverse proxy y HTTPS automático |
| **PM2**            | Process manager para Node.js     |

---

### 🔒 Protocolo de Locks Distribuidos

#### Mensajes Worker → Coordinador

| Mensaje           | Parámetros                                       | Descripción                   |
| ----------------- | ------------------------------------------------ | ----------------------------- |
| `REGISTER_WORKER` | `{ workerId, capabilities }`                     | Registrar worker al conectar  |
| `LOCK_REQUEST`    | `{ lockId, resourceIds[], operation, priority }` | Solicitar lock sobre recursos |
| `LOCK_RELEASE`    | `{ lockId }`                                     | Liberar lock                  |
| `HEARTBEAT`       | `{ workerId, timestamp }`                        | Señal de vida (cada 5s)       |
| `CANCEL_LOCK`     | `{ lockId }`                                     | Cancelar solicitud en cola    |

#### Mensajes Coordinador → Worker

| Mensaje             | Parámetros                             | Descripción                |
| ------------------- | -------------------------------------- | -------------------------- |
| `WORKER_REGISTERED` | `{ workerId, timestamp }`              | Confirmación de registro   |
| `LOCK_GRANTED`      | `{ lockId, resourceIds[], grantedAt }` | Lock concedido ✅          |
| `LOCK_DENIED`       | `{ lockId, reason, retryAfter }`       | Lock denegado ❌           |
| `LOCK_QUEUED`       | `{ lockId, position, estimatedWait }`  | Agregado a cola ⏱️         |
| `LOCK_TIMEOUT`      | `{ lockId }`                           | Lock expiró por timeout ⏰ |
| `DEADLOCK_DETECTED` | `{ lockId, involvedResources[] }`      | Deadlock detectado 🔴      |

#### Estados de un Lock

```
┌──────────────┐
│  REQUESTED   │  ──▶  Lock solicitado
└──────┬───────┘
       │
       ├──▶ ┌──────────────┐
       │    │   QUEUED     │  ──▶  En cola de espera
       │    └──────┬───────┘
       │           │
       ▼           ▼
┌──────────────────────┐
│      GRANTED         │  ──▶  Lock concedido (sección crítica)
└──────┬───────────────┘
       │
       ├──▶ ┌──────────────┐
       │    │   RELEASED   │  ──▶  Lock liberado
       │    └──────────────┘
       │
       ├──▶ ┌──────────────┐
       │    │   TIMEOUT    │  ──▶  Expiró por timeout
       │    └──────────────┘
       │
       └──▶ ┌──────────────┐
            │   DENIED     │  ──▶  Denegado (error)
            └──────────────┘
```

#### Prioridades de Locks

| Nivel    | Valor | Uso                                            | Timeout |
| -------- | ----- | ---------------------------------------------- | ------- |
| `HIGH`   | 3     | Operaciones críticas (retiros, transferencias) | 60s     |
| `NORMAL` | 2     | Operaciones estándar (depósitos, consultas)    | 30s     |
| `LOW`    | 1     | Operaciones administrativas (reportes)         | 15s     |

---

### 🎓 Conceptos de Sistemas Distribuidos Implementados

#### 1. Exclusión Mutua (Mutual Exclusion)

```typescript
// bancoService.ts
async transferir(origenId: string, destinoId: string, monto: number) {
  // 🔒 Solicitar lock de AMBAS cuentas (orden canónico)
  const lockId = await this.coordinatorClient.lockCuenta(
    [origenId, destinoId].sort(), // Prevenir deadlock
    `transferencia de $${monto}`,
    Prioridad.HIGH
  );

  try {
    // ✅ SECCIÓN CRÍTICA: Solo este worker puede acceder
    const [origen, destino] = await Promise.all([
      prisma.cuenta.findUnique({ where: { id: origenId } }),
      prisma.cuenta.findUnique({ where: { id: destinoId } })
    ]);

    // Validar y ejecutar transacción...

  } finally {
    // 🔓 Siempre liberar locks
    await this.coordinatorClient.releaseLock(lockId);
  }
}
```

#### 2. Prevención de Deadlocks

**Estrategia: Ordenamiento Canónico de Recursos**

```typescript
// Siempre solicitar recursos en el mismo orden (alfabético de IDs)
const recursos = [cuentaA, cuentaB, cuentaC].sort();
await lockMultiple(recursos); // Previene ciclos de espera
```

**Ejemplo de deadlock prevenido:**

```
❌ SIN ORDENAMIENTO:
Worker 1: Lock(A) → espera Lock(B)
Worker 2: Lock(B) → espera Lock(A)  ← DEADLOCK!

✅ CON ORDENAMIENTO:
Worker 1: Lock(A) → Lock(B)  ✓
Worker 2: Lock(A) → cola...  ⏱️ (espera a que Worker 1 libere A)
```

#### 3. Transacciones ACID

```typescript
// Prisma garantiza atomicidad
await prisma.$transaction(async (tx) => {
  await tx.cuenta.update({
    where: { id: origenId },
    data: { saldo: { decrement: monto } },
  });

  await tx.cuenta.update({
    where: { id: destinoId },
    data: { saldo: { increment: monto } },
  });

  await tx.transaccion.create({
    data: { origenId, destinoId, monto, tipo: "TRANSFERENCIA" },
  });
}); // Todo o nada
```

#### 4. Tolerancia a Fallos

- **Heartbeat Monitoring**: Workers envían señal cada 5s
- **Timeout Management**: Locks expirados liberados automáticamente
- **Reconnection Logic**: Workers se reconectan al coordinador
- **Worker Failure Detection**: Coordinador detecta workers caídos
- **Lock Recovery**: Locks de workers caídos liberados automáticamente

---

### 🌐 Comunicación y Eventos

#### Socket.IO Events (Real-time)

**Worker ↔ Coordinador:**

```typescript
// Worker solicita lock
socket.emit("LOCK_REQUEST", {
  lockId: uuid(),
  resourceIds: ["cuenta-123", "cuenta-456"],
  operation: "transferencia",
  priority: Prioridad.HIGH,
});

// Coordinador responde
socket.on("LOCK_GRANTED", (data) => {
  console.log(`Lock concedido: ${data.lockId}`);
  // Ejecutar sección crítica...
});
```

**Frontend ↔ Worker:**

```typescript
// Frontend recibe notificación de operación
socket.on("TRANSACTION_COMPLETED", (data) => {
  toast.success(`Transferencia exitosa: $${data.monto}`);
  updateBalance();
});
```

#### REST API Endpoints (HTTP)

**Autenticación:**

- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión (retorna JWT)
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Obtener usuario actual

**Operaciones Bancarias:**

- `POST /api/banco/transferir` - Transferencia entre cuentas
- `POST /api/banco/depositar` - Depósito en cuenta
- `POST /api/banco/retirar` - Retiro de cuenta
- `GET /api/banco/saldo/:cuentaId` - Consultar saldo

**Gestión de Cuentas:**

- `GET /api/cuentas` - Listar cuentas del usuario
- `POST /api/cuentas` - Crear nueva cuenta
- `GET /api/cuentas/:id` - Detalle de cuenta
- `DELETE /api/cuentas/:id` - Cerrar cuenta

**Tarjetas:**

- `GET /api/tarjetas` - Listar tarjetas
- `POST /api/tarjetas` - Solicitar nueva tarjeta
- `PUT /api/tarjetas/:id/activar` - Activar tarjeta
- `PUT /api/tarjetas/:id/bloquear` - Bloquear tarjeta

**Transacciones:**

- `GET /api/transacciones` - Historial de transacciones
- `GET /api/transacciones/:id` - Detalle de transacción
- `GET /api/movimientos/:cuentaId` - Movimientos de cuenta

**Cuentas Compartidas:**

- `GET /api/cuentas-compartidas` - Listar cuentas compartidas
- `POST /api/cuentas-compartidas/agregar-usuario` - Compartir cuenta
- `PUT /api/cuentas-compartidas/cambiar-rol` - Cambiar permisos
- `DELETE /api/cuentas-compartidas/remover-usuario` - Remover acceso

**Sistema de Asesoría:**

- `GET /api/advisor/asesores` - Listar asesores disponibles
- `POST /api/advisor/solicitar` - Solicitar asesoría
- `GET /api/advisor/sesiones` - Sesiones de asesoría
- `PUT /api/advisor/sesiones/:id/completar` - Completar sesión

---

### 🔐 Seguridad

#### Autenticación y Autorización

```typescript
// JWT con expiración de 24 horas
const token = jwt.sign({ usuarioId, email, rol }, process.env.JWT_SECRET!, {
  expiresIn: "24h",
});

// Middleware de autenticación
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
```

#### Control de Acceso Basado en Roles (RBAC)

Cuentas compartidas con 3 niveles de permisos:

| Rol          | Permisos                                                                  |
| ------------ | ------------------------------------------------------------------------- |
| `TITULAR`    | Todas las operaciones (transferir, depositar, retirar, compartir, cerrar) |
| `AUTORIZADO` | Operaciones limitadas (transferir, depositar, retirar)                    |
| `CONSULTA`   | Solo consultar saldo y movimientos                                        |

```typescript
// Verificar permisos antes de operación
const permiso = await prisma.usuarioCuenta.findUnique({
  where: { usuarioId_cuentaId: { usuarioId, cuentaId } },
});

if (permiso.rol === "CONSULTA") {
  throw new Error("No tienes permisos para realizar esta operación");
}
```

#### Validación de Datos

```typescript
// Zod schema para validación
const transferenciaSchema = z.object({
  cuentaOrigenId: z.string().uuid(),
  cuentaDestinoId: z.string().min(1),
  monto: z.number().positive().max(1000000),
  concepto: z.string().optional(),
});

// Validar antes de procesar
const data = transferenciaSchema.parse(req.body);
```

#### Protección contra Ataques

- **SQL Injection**: Prisma ORM con prepared statements
- **XSS**: Sanitización de inputs + CSP headers
- **CSRF**: Tokens CSRF en formularios
- **Rate Limiting**: 60 requests/minuto por IP
- **CORS**: Whitelist de orígenes permitidos
- **Password Hashing**: bcrypt con salt rounds=10

## 🚀 Deployment

### 🐳 Deployment con Docker (Recomendado)

El proyecto incluye deployment automático usando **Docker** + **GitHub Actions**:

1. **Configura los GitHub Secrets** (Settings → Secrets → Actions):

   - `SSH_HOST`: IP o dominio de tu servidor
   - `SSH_USERNAME`: Usuario SSH (ej: `root`, `ubuntu`)
   - `SSH_PRIVATE_KEY`: Tu llave privada SSH completa
   - `SSH_PORT`: Puerto SSH (opcional, default: 22)

2. **Push a main** para deployment automático:
   ```bash
   git add .
   git commit -m "feat: nueva funcionalidad"
   git push origin main
   ```

````

3. **GitHub Actions** automáticamente:
   - 📦 Clona/actualiza el código en el servidor
   - � Construye imágenes Docker optimizadas
   - 🗄️ Ejecuta migraciones de Prisma
   - 🚀 Inicia contenedores:
     - PostgreSQL (puerto 5432)
     - Coordinador (puerto 4000)
     - 3 Workers (puertos 3001, 3002, 3003)
     - Backup automático (2 AM diario)
   - ✅ Verifica health de todos los servicios
   - 🔄 Rollback automático si algo falla

### Inicio Rápido con Docker

```bash
# 1. Clonar repositorio
git clone https://github.com/PoloBustillo/bancoDistribuidos.git
cd bancoDistribuidos

# 2. Configurar variables de entorno
cp .env.example .env
nano .env  # Editar DB_PASSWORD y JWT_SECRET

# 3. Iniciar todos los servicios
docker compose up -d

# 4. Ver logs en tiempo real
docker compose logs -f

# 5. Ver estado de contenedores
docker compose ps
```

### 🎛️ Gestión con Docker Compose

#### Comandos Básicos

```bash
# Ver estado de todos los contenedores
docker compose ps
# O si usas docker-compose.full.yml:
docker compose -f docker-compose.full.yml ps

# Ver logs en tiempo real
docker compose logs -f                    # Todos los servicios
docker compose logs -f coordinador        # Solo coordinador
docker compose logs -f worker-1 worker-2  # Múltiples servicios

# Ver últimas 100 líneas de logs
docker compose logs --tail=100 worker-1

# Reiniciar servicios
docker compose restart worker-2           # Un servicio específico
docker compose restart                    # Todos los servicios

# Detener todo (mantiene volúmenes)
docker compose down

# Detener y eliminar volúmenes (⚠️ BORRA LA BD)
docker compose down -v

# Detener sin eliminar contenedores
docker compose stop

# Iniciar contenedores existentes
docker compose start
```

#### Reconstruir Imágenes

```bash
# Reconstruir una imagen específica
docker compose build coordinador

# Reconstruir todas las imágenes sin cache
docker compose build --no-cache

# Reconstruir y reiniciar
docker compose up -d --build

# Forzar recreación de contenedores
docker compose up -d --force-recreate
```

#### Monitoreo y Debugging

```bash
# Ver recursos consumidos (CPU, RAM, Red)
docker stats

# Inspeccionar un contenedor
docker inspect banco-worker-1

# Entrar a un contenedor (shell interactivo)
docker exec -it banco-worker-1 sh

# Ejecutar comando en contenedor
docker exec banco-worker-1 ps aux

# Ver health status
docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}"

# Ver puertos mapeados
docker compose port worker-1 3001
```

#### Limpieza

```bash
# Eliminar contenedores huérfanos
docker compose down --remove-orphans

# Limpiar imágenes no usadas
docker image prune -a

# Limpiar TODO (⚠️ contenedores, redes, volúmenes, imágenes)
docker system prune -a --volumes
```

### Backups Automáticos

- 💾 Backups diarios a las 2 AM
- 📦 Guardados en `./backups/`
- 🗓️ Retención: 7 días, 4 semanas, 6 meses

```bash
# Backup manual
bash scripts/backup-manual.sh

# Restaurar backup
bash scripts/restore-backup.sh backups/backup_20241121.sql.gz
```

### Arquitectura de Deployment

```
GitHub Push → GitHub Actions → SSH al Servidor → Docker Compose
                                                    ├── postgres:5432
                                                    ├── postgres-backup
                                                    ├── coordinador:4000
                                                    ├── worker-1:3001
                                                    ├── worker-2:3002
                                                    └── worker-3:3003
```

📚 **Documentación completa Docker**: Ver [DOCKER-SETUP.md](./DOCKER-SETUP.md)
📚 **Deployment manual (sin Docker)**: Ver [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🚨 Troubleshooting Común

### 🐳 Problemas con Docker

#### ❌ Error: "Cannot connect to the Docker daemon"

```bash
# Windows/Mac: Asegúrate de que Docker Desktop esté corriendo
# Linux: Inicia el servicio
sudo systemctl start docker

# Verifica que Docker funciona
docker --version
docker ps
```

#### ❌ Error: "port is already allocated"

Un puerto ya está en uso (3001, 3002, 3003, 4000, 5432).

```bash
# Ver qué proceso usa el puerto
# Windows:
netstat -ano | findstr :3001

# Linux/Mac:
lsof -i :3001

# Solución 1: Matar el proceso
# Windows:
taskkill /PID <PID> /F

# Linux/Mac:
kill -9 <PID>

# Solución 2: Cambiar el puerto en docker-compose.yml
ports:
  - "3011:3001"  # Mapea puerto 3011 del host → 3001 del contenedor
```

#### ❌ Workers no se conectan al Coordinador

```bash
# 1. Verifica que el coordinador esté corriendo
docker compose logs coordinador

# 2. Verifica la variable COORDINADOR_URL en workers
docker exec banco-worker-1 printenv COORDINADOR_URL
# Debe ser: http://coordinador:4000

# 3. Verifica que estén en la misma red
docker network inspect bancodistribuidos_banco-network

# 4. Test de conectividad desde un worker
docker exec banco-worker-1 ping coordinador
docker exec banco-worker-1 curl http://coordinador:4000/health
```

#### ❌ Contenedores se reinician constantemente

```bash
# Ver logs para identificar el error
docker compose logs --tail=50 worker-1

# Errores comunes:
# - "Connection refused" → Base de datos no disponible
# - "EADDRINUSE" → Puerto ya en uso
# - "MODULE_NOT_FOUND" → Falta reconstruir imagen

# Solución: Reconstruir imagen
docker compose build worker --no-cache
docker compose up -d worker-1
```

---

### 🗄️ Problemas con Base de Datos

#### ❌ Error: "Can't reach database server"

```bash
# Con docker-compose.full.yml:
# 1. Verifica que PostgreSQL esté corriendo
docker compose -f docker-compose.full.yml ps postgres

# 2. Verifica health check
docker inspect banco-postgres --format='{{.State.Health.Status}}'
# Debe ser: healthy

# 3. Test de conexión
docker exec banco-postgres psql -U banco_user -d banco -c "SELECT 1;"

# Con base de datos externa:
# 1. Verifica DATABASE_URL en .env
cat .env | grep DATABASE_URL

# 2. Test desde tu máquina
psql "postgresql://usuario:password@host:5432/banco" -c "SELECT 1;"

# 3. Verifica firewall/security groups del servidor de BD
```

#### ❌ Error: "Prisma schema not found"

```bash
# Regenerar Prisma Client
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma generate"

# Ejecutar migraciones
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate deploy"

# Verificar schema
docker exec banco-worker-1 cat /app/worker/prisma/schema.prisma
```

#### ❌ Migraciones fallan

```bash
# Ver estado de migraciones
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate status"

# Resetear base de datos (⚠️ BORRA TODO)
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate reset"

# Forzar una migración específica
docker exec banco-worker-1 sh -c "cd /app/worker && bunx prisma migrate resolve --applied <migration_name>"
```

---

### 🔐 Problemas de Autenticación

#### ❌ Error: "Invalid token" / "Token expired"

```bash
# 1. Verifica que JWT_SECRET sea el mismo en todos los workers
docker exec banco-worker-1 printenv JWT_SECRET
docker exec banco-worker-2 printenv JWT_SECRET
docker exec banco-worker-3 printenv JWT_SECRET

# 2. Limpia el sessionStorage del navegador
# Abre DevTools (F12) → Console:
sessionStorage.clear()
location.reload()

# 3. Verifica la fecha/hora del servidor
docker exec banco-worker-1 date
# Si está mal configurada, los tokens expiran inmediatamente
```

#### ❌ CORS Error en el navegador

```bash
# 1. Verifica CORS_ORIGIN en .env
cat .env | grep CORS_ORIGIN

# 2. Debe incluir el dominio del frontend (sin slash al final)
CORS_ORIGIN=https://banco-distribuidos.vercel.app,http://localhost:3000

# 3. Reinicia los workers después de cambiar .env
docker compose restart worker-1 worker-2 worker-3
```

---

### 🔧 Desarrollo Local Sin Docker

#### ❌ Error: "bun: command not found"

```bash
# Instalar Bun
# Mac/Linux:
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell como admin):
powershell -c "irm bun.sh/install.ps1|iex"

# Verificar instalación
bun --version
```

#### ❌ Error al instalar dependencias

```bash
# Limpiar cache de Bun
rm -rf node_modules
rm -f bun.lockb

# Reinstalar
bun install

# Si persiste, usa npm
npm install
```

#### ❌ Puerto ya en uso (sin Docker)

```bash
# Cambiar puerto al iniciar
PORT=3005 bun run dev

# O editar el .env del servicio
echo "PORT=3005" >> worker/.env
```

---

### 📡 Problemas de Red y Conectividad

#### ❌ Frontend no conecta con Backend

```bash
# 1. Verifica que el backend esté corriendo
curl http://localhost:3001/api/health

# 2. Verifica variables de entorno del frontend
cat frontend/.env.local
# Debe contener:
NEXT_PUBLIC_API_URL=http://localhost:3001

# 3. Verifica CORS en el backend
docker compose logs worker-1 | grep CORS
```

#### ❌ WebSocket disconnected (Coordinador)

```bash
# 1. Verifica que el coordinador esté activo
curl http://localhost:4000/health

# 2. Ver logs del coordinador
docker compose logs -f coordinador

# 3. Verifica que workers puedan llegar al coordinador
docker exec banco-worker-1 nc -zv coordinador 4000
```

---

### 🛠️ Comandos de Diagnóstico Rápido

```bash
# Verificar TODOS los servicios
./scripts/health-check.sh  # Si existe

# O manualmente:
echo "=== DOCKER ==="
docker compose ps
echo "\n=== COORDINADOR ==="
curl -s http://localhost:4000/health | jq
echo "\n=== WORKERS ==="
curl -s http://localhost:3001/api/health | jq
curl -s http://localhost:3002/api/health | jq
curl -s http://localhost:3003/api/health | jq
echo "\n=== DATABASE ==="
docker exec banco-postgres pg_isready -U banco_user
```

---

### 📞 Obtener Ayuda

Si ninguna solución funciona:

1. **Crea un issue** en GitHub con:

   - Comando que ejecutaste
   - Error completo (logs)
   - Sistema operativo
   - Versión de Docker / Bun

2. **Revisa issues cerrados** → Puede que ya esté resuelto

3. **Logs completos**:
   ```bash
   docker compose logs > logs.txt
   ```

---

## 🎓 Conceptos Aprendidos

✅ Sincronización de recursos compartidos
✅ Manejo de condiciones de carrera
✅ Transacciones ACID
✅ Auditoría y logging
✅ APIs REST
✅ Desarrollo full-stack
✅ **CI/CD con GitHub Actions**
✅ **Deployment automatizado con SSH**
✅ **Gestión de procesos con Docker**
✅ **Sistema de locks distribuidos**
✅ **Coordinación de workers**

---

**¡Explora los sistemas distribuidos!** 🚀

Si encuentras algún problema no documentado, [abre un issue](https://github.com/PoloBustillo/bancoDistribuidos/issues/new) 📝
````
