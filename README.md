# 🏦 Sistema Bancario Distribuido con Locks Coordinados

Un sistema bancario distribuido que implementa el patrón **Coordinador-Trabajador** para gestionar operaciones concurrentes sobre cuentas bancarias compartidas usando **locks distribuidos**.

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

│  • Cola de espera con prioridades                          │✅ **Beneficiarios**: Gestión de contactos frecuentes  

│  • Detección de deadlocks                                  │✅ **Notificaciones**: Sistema de alertas con prioridades  

│  • Monitoreo de salud de trabajadores                      │✅ **Pagos programados**: Transferencias recurrentes automáticas  

└──────────────────┬──────────────────────────────────────────┘✅ **Límites de operación**: Control de transacciones diarias  

                   │✅ **Sistema de bloqueos distribuido** para evitar race conditions  

        ┌──────────┼──────────┐✅ **Transacciones atómicas** entre cuentas (ACID)  

        │          │          │✅ **Log de auditoría** completo de todas las operaciones  

        ▼          ▼          ▼✅ **API REST** documentada con Swagger/OpenAPI  

   ┌────────┐ ┌────────┐ ┌────────┐✅ **WebSockets (Socket.IO)** para comunicación en tiempo real  

   │ WORKER │ │ WORKER │ │ WORKER │✅ **Multi-cliente simultáneo**: Múltiples clientes conectados a la vez  

   │  3001  │ │  3002  │ │  3003  │✅ **Sincronización en tiempo real**: Todos ven los cambios instantáneamente  

   └────────┘ └────────┘ └────────┘✅ **Documentación interactiva**: Swagger UI para probar la API  

        │          │          │✅ **Frontend interactivo** con React  

        └──────────┼──────────┘✅ **Código 100% en español**  

                   │

                   ▼## 🏗️ Arquitectura

          ┌────────────────┐

          │   PostgreSQL   │```

          │   (Compartida) │┌─────────────────────────────────────────┐

          └────────────────┘│         FRONTEND (React)                │

```│  - Gestión de cuentas                   │

│  - Formulario de transacciones          │

### 🔐 Flujo de Operación con Locks│  - Historial y auditoría               │

│  - Dashboard administrativo             │

**Ejemplo: Transferencia entre cuentas**└────────────────┬────────────────────────┘

                 │ HTTP/REST

```┌────────────────▼────────────────────────┐

1. Cliente → Worker1: "Transferir $100 de CTA-A a CTA-B"│    BACKEND (Node.js + Express)          │

│  - API REST endpoints                   │

2. Worker1 → Coordinador: LOCK_REQUEST [CTA-A, CTA-B]│  - Validación de operaciones            │

   │  - Control de bloqueos distribuido      │

3. Coordinador verifica:│  - Manejo de transacciones atómicas     │

   - ¿Están disponibles CTA-A y CTA-B?└────────────────┬────────────────────────┘

   - ✅ SÍ → LOCK_GRANTED                 │

   - ❌ NO → Agrega a cola de espera┌────────────────▼────────────────────────┐

│  GESTOR DE RECURSOS DISTRIBUIDOS       │

4. Worker1 recibe LOCK_GRANTED:│  - Sistema de locks (mutex)             │

   - Lee saldos de BD│  - Manejo de cuentas compartidas        │

   - Valida operación│  - Log de transacciones                │

   - Actualiza saldos en BD│  - Sincronización de estado            │

   - Worker1 → Coordinador: LOCK_RELEASE [CTA-A, CTA-B]└─────────────────────────────────────────┘

```

5. Coordinador libera locks:

   - Procesa cola de espera## 🔧 Tecnologías

   - Concede locks a siguiente en fila

```### Backend

- **Node.js** - Runtime de JavaScript en servidor

### 📁 Estructura del Proyecto- **Express.js** - Framework web minimalista

- **TypeScript** - Tipado fuerte en JavaScript

```- **UUID** - Generación de IDs únicos

Banco/

├── coordinador/          # Servidor coordinador de locks### Frontend

│   ├── src/- **React** - Librería de UI

│   │   ├── server.ts    # Servidor Socket.IO en puerto 4000- **TypeScript** - Tipado fuerte

│   │   ├── coordinator.ts- **Axios** - Cliente HTTP

│   │   └── types.ts- **React Icons** - Iconos SVG

│   ├── package.json- **CSS3** - Estilos modernos (Flexbox, Grid)

│   └── tsconfig.json

│### Shared

├── worker/              # Instancias del banco (workers)- **Types.ts** - Tipos compartidos entre frontend y backend

│   ├── src/

│   │   ├── server.ts    # API REST + Auth## 📁 Estructura del Proyecto

│   │   ├── auth/        # Autenticación

│   │   ├── services/    # Lógica de negocio```

│   │   ├── client/      # Cliente del coordinador/Banco

│   │   └── prisma/      # Schema de BD├── backend/

│   ├── package.json│   ├── src/

│   └── tsconfig.json│   │   ├── server.ts           # Servidor Express principal

││   │   ├── resourceManager.ts  # Gestor de recursos distribuidos

├── shared/              # Tipos compartidos│   │   └── types.ts            # Tipos compartidos

│   └── types.ts         # Protocolo de comunicación│   ├── package.json

││   └── tsconfig.json

└── scripts/             # Scripts de deployment├── frontend/

    ├── start-all.sh     # Inicia coordinador + 3 workers│   ├── src/

    └── stop-all.sh│   │   ├── App.tsx             # Componente principal

```│   │   ├── index.tsx           # Entry point

│   │   ├── api.ts              # Cliente HTTP

### 🚀 Inicio Rápido│   │   ├── types.ts            # Tipos

│   │   ├── components/

```bash│   │   │   ├── AccountList.tsx

# 1. Instalar dependencias│   │   │   ├── TransactionForm.tsx

cd coordinador && bun install│   │   │   ├── TransactionHistory.tsx

cd ../worker && bun install│   │   │   └── AdminDashboard.tsx

│   │   ├── styles/

# 2. Configurar base de datos│   │   │   ├── AccountList.css

cd worker│   │   │   ├── TransactionForm.css

echo "DATABASE_URL=postgresql://user:pass@host:5432/banco" > .env│   │   │   ├── TransactionHistory.css

bunx prisma db push│   │   │   └── AdminDashboard.css

│   │   ├── index.css

# 3. Iniciar coordinador│   │   └── App.css

cd ../coordinador│   ├── public/

bun run dev    # Puerto 4000│   │   └── index.html

│   └── package.json

# 4. Iniciar workers (en terminales separadas)├── shared/

cd ../worker│   └── types.ts                # Tipos compartidos

PORT=3001 WORKER_ID=worker-1 bun run dev└── docs/

PORT=3002 WORKER_ID=worker-2 bun run dev```

PORT=3003 WORKER_ID=worker-3 bun run dev

```## 🚀 Quick Start



### 🔒 Protocolo de Locks### Instalación



#### Mensajes Worker → Coordinador1. **Instalar dependencias del Backend**

```bash

| Mensaje | Descripción |cd backend && npm install && cd ..

|---------|-------------|```

| `REGISTER_WORKER` | Registrar trabajador al conectar |

| `LOCK_REQUEST` | Solicitar lock sobre recursos |2. **Instalar dependencias del Frontend**

| `LOCK_RELEASE` | Liberar lock |```bash

| `HEARTBEAT` | Señal de vida (cada 3s) |cd frontend && npm install && cd ..

```

#### Mensajes Coordinador → Worker

### Ejecución

| Mensaje | Descripción |

|---------|-------------|**Terminal 1: Backend**

| `WORKER_REGISTERED` | Confirmación de registro |```bash

| `LOCK_GRANTED` | Lock concedido |cd backend && npm run dev

| `LOCK_DENIED` | Lock denegado (en cola) |```

| `FORCE_RELEASE` | Forzar liberación por timeout |

**Terminal 2: Frontend**

### 📊 Ejemplo de Request```bash

cd frontend && npm start

```typescript```

// Worker solicita lock para transferencia

{✅ Backend: http://localhost:3001

  tipo: "LOCK_REQUEST",✅ Frontend: http://localhost:3000

  workerId: "worker-1",✅ **Swagger API Docs**: http://localhost:3001/api-docs

  requestId: "uuid-123",

  recursos: [## 📚 Documentación de la API (Swagger)

    { tipo: "CUENTA", id: "cuenta-abc" },

    { tipo: "CUENTA", id: "cuenta-xyz" }El sistema incluye documentación interactiva de la API usando **Swagger/OpenAPI 3.0**.

  ],

  prioridad: 1,  // 0=BAJA, 1=NORMAL, 2=ALTA, 3=CRITICA### Acceder a Swagger UI

  timeout: 10000,  // 10 segundos

  operacion: "transferencia"Una vez que el backend esté corriendo, visita:

}

```🔗 **http://localhost:3001/api-docs**



### ⚡ Características### Características de Swagger UI



- ✅ **Locks distribuidos** con coordinación centralizada- 📖 **Documentación completa** de todos los endpoints REST

- ✅ **Prioridades** en cola de espera- 🧪 **Pruebas interactivas** - Ejecuta requests directamente desde el navegador

- ✅ **Timeouts** automáticos para evitar deadlocks- 📋 **Esquemas de datos** - Visualiza todas las estructuras de tipos

- ✅ **Heartbeats** para detección de workers caídos- 🏷️ **Agrupación por tags** - Endpoints organizados por categoría:

- ✅ **Liberación automática** al desconectar worker  - 💳 Cuentas

- ✅ **Múltiples recursos** en una sola solicitud (atomicidad)  - 💸 Transacciones (Depósito, Retiro, Transferencia)

- ✅ **Base de datos compartida** (PostgreSQL)  - 🎴 Tarjetas (Débito, Crédito, Prepagadas)

  - 💰 Préstamos

### 🛠️ Tecnologías  - 📈 Inversiones

  - 👥 Beneficiarios

- **Runtime**: Bun  - 🔔 Notificaciones

- **Framework**: Express.js  - ⏰ Pagos Programados

- **WebSockets**: Socket.IO (coordinador ↔ workers)  - 🛡️ Límites

- **Base de Datos**: PostgreSQL + Prisma ORM  - 📊 Historial y Auditoría

- **Auth**: JWT + bcrypt  - ⚙️ Administración

- **Validación**: Zod

- **Rate Limiting**: express-rate-limit### Ejemplo de uso de Swagger



---1. Abre http://localhost:3001/api-docs

2. Selecciona un endpoint (ej: `POST /api/transacciones/depositar`)

**Autor**: Sistema Bancario Distribuido  3. Click en "Try it out"

**Patrón**: Coordinador-Trabajador  4. Modifica el JSON de ejemplo con tus datos

**Licencia**: MIT5. Click en "Execute"

6. Observa la respuesta en tiempo real

### Exportar especificación OpenAPI

El spec JSON completo está disponible en:
```
GET http://localhost:3001/api-docs.json
```

Puedes importar este JSON en herramientas como Postman, Insomnia, o cualquier cliente que soporte OpenAPI 3.0.## 📊 Datos de Ejemplo

| Cuenta | Titular | Número | Saldo |
|--------|---------|--------|-------|
| acc-001 | Juan Pérez | 1000001 | $5,000 |
| acc-002 | María García | 1000002 | $3,500 |
| acc-003 | Carlos López | 1000003 | $7,200 |

## 🔐 Control de Concurrencia

El sistema implementa:
- ✅ **Mutex**: Exclusión mutua para acceso a cuentas
- ✅ **Bloqueos Distribuidos**: Prevención de race conditions
- ✅ **Transacciones Atómicas**: Operaciones indivisibles
- ✅ **Prevención de Deadlock**: Adquisición ordenada de locks

## 📡 Operaciones Disponibles

- **Depósitos**: POST `/api/transactions/deposit`
- **Retiros**: POST `/api/transactions/withdrawal`
- **Transferencias**: POST `/api/transactions/transfer`
- **Historial**: GET `/api/transactions/{accountId}`
- **Auditoría**: GET `/api/audit/{accountId}`
- **Admin**: GET `/api/admin/state`

## 🚀 Deployment

### Deployment Automático con GitHub Actions

El proyecto incluye deployment automático usando **GitHub Actions** y **appleboy/ssh-action**:

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

3. **GitHub Actions** automáticamente:
   - 📦 Clona/actualiza el código en el servidor
   - 🔧 Instala dependencias con Bun
   - 🗄️ Ejecuta migraciones de Prisma
   - 🚀 Inicia Coordinador (puerto 4000) y 3 Workers (3001, 3002, 3003)
   - ✅ Verifica health de los servicios

### Deployment Manual

Usa el script incluido:

```bash
# Dar permisos de ejecución
chmod +x deploy.sh

# Deployment local (en el servidor)
./deploy.sh

# Deployment remoto (desde tu máquina)
./deploy.sh --remote tu-servidor.com root
```

### Gestión con PM2

```bash
# Ver todos los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs

# Reiniciar servicios
pm2 restart all

# Monitor en tiempo real
pm2 monit

# Detener todos
pm2 stop all
```

### Arquitectura de Deployment

```
GitHub Push → GitHub Actions → SSH al Servidor → PM2
                                                    ├── coordinador:4000
                                                    ├── worker-3001:3001
                                                    ├── worker-3002:3002
                                                    └── worker-3003:3003
```

📚 **Documentación completa**: Ver [DEPLOYMENT.md](./DEPLOYMENT.md)

## 🎓 Conceptos Aprendidos

✅ Sincronización de recursos compartidos  
✅ Manejo de condiciones de carrera  
✅ Transacciones ACID  
✅ Auditoría y logging  
✅ APIs REST  
✅ Desarrollo full-stack  
✅ **CI/CD con GitHub Actions**  
✅ **Deployment automatizado con SSH**  
✅ **Gestión de procesos con PM2**  

---

**¡Explora los sistemas distribuidos!** 🚀

