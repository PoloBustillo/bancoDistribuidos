# 🏦 Sistema Bancario Distribuido con WebSockets

Un sistema hybrid frontend-backend que simula un banco en un **sistema distribuido con recursos compartidos**. Demuestra conceptos avanzados de concurrencia, sincronización y control de acceso en sistemas distribuidos con soporte para múltiples clientes conectados simultáneamente.

## 📋 Descripción

Este proyecto simula una institución bancaria moderna donde múltiples clientes pueden realizar operaciones concurrentes sobre cuentas compartidas. El sistema implementa mecanismos de control de concurrencia para evitar condiciones de carrera y asegurar la integridad de los datos. **Todos los tipos, variables y métodos están nombrados en español**.

### Características Principales

✅ **Múltiples cuentas bancarias** con saldos compartidos  
✅ **Operaciones bancarias completas**: Depósitos, retiros, transferencias  
✅ **Gestión de tarjetas**: Débito, crédito y prepagadas  
✅ **Sistema de préstamos**: Con amortización y pagos mensuales  
✅ **Inversiones**: Plazo fijo, fondos, acciones y bonos  
✅ **Beneficiarios**: Gestión de contactos frecuentes  
✅ **Notificaciones**: Sistema de alertas con prioridades  
✅ **Pagos programados**: Transferencias recurrentes automáticas  
✅ **Límites de operación**: Control de transacciones diarias  
✅ **Sistema de bloqueos distribuido** para evitar race conditions  
✅ **Transacciones atómicas** entre cuentas (ACID)  
✅ **Log de auditoría** completo de todas las operaciones  
✅ **API REST** documentada con Swagger/OpenAPI  
✅ **WebSockets (Socket.IO)** para comunicación en tiempo real  
✅ **Multi-cliente simultáneo**: Múltiples clientes conectados a la vez  
✅ **Sincronización en tiempo real**: Todos ven los cambios instantáneamente  
✅ **Documentación interactiva**: Swagger UI para probar la API  
✅ **Frontend interactivo** con React  
✅ **Código 100% en español**  

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│         FRONTEND (React)                │
│  - Gestión de cuentas                   │
│  - Formulario de transacciones          │
│  - Historial y auditoría               │
│  - Dashboard administrativo             │
└────────────────┬────────────────────────┘
                 │ HTTP/REST
┌────────────────▼────────────────────────┐
│    BACKEND (Node.js + Express)          │
│  - API REST endpoints                   │
│  - Validación de operaciones            │
│  - Control de bloqueos distribuido      │
│  - Manejo de transacciones atómicas     │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│  GESTOR DE RECURSOS DISTRIBUIDOS       │
│  - Sistema de locks (mutex)             │
│  - Manejo de cuentas compartidas        │
│  - Log de transacciones                │
│  - Sincronización de estado            │
└─────────────────────────────────────────┘
```

## 🔧 Tecnologías

### Backend
- **Node.js** - Runtime de JavaScript en servidor
- **Express.js** - Framework web minimalista
- **TypeScript** - Tipado fuerte en JavaScript
- **UUID** - Generación de IDs únicos

### Frontend
- **React** - Librería de UI
- **TypeScript** - Tipado fuerte
- **Axios** - Cliente HTTP
- **React Icons** - Iconos SVG
- **CSS3** - Estilos modernos (Flexbox, Grid)

### Shared
- **Types.ts** - Tipos compartidos entre frontend y backend

## 📁 Estructura del Proyecto

```
/Banco
├── backend/
│   ├── src/
│   │   ├── server.ts           # Servidor Express principal
│   │   ├── resourceManager.ts  # Gestor de recursos distribuidos
│   │   └── types.ts            # Tipos compartidos
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx             # Componente principal
│   │   ├── index.tsx           # Entry point
│   │   ├── api.ts              # Cliente HTTP
│   │   ├── types.ts            # Tipos
│   │   ├── components/
│   │   │   ├── AccountList.tsx
│   │   │   ├── TransactionForm.tsx
│   │   │   ├── TransactionHistory.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── styles/
│   │   │   ├── AccountList.css
│   │   │   ├── TransactionForm.css
│   │   │   ├── TransactionHistory.css
│   │   │   └── AdminDashboard.css
│   │   ├── index.css
│   │   └── App.css
│   ├── public/
│   │   └── index.html
│   └── package.json
├── shared/
│   └── types.ts                # Tipos compartidos
└── docs/
```

## 🚀 Quick Start

### Instalación

1. **Instalar dependencias del Backend**
```bash
cd backend && npm install && cd ..
```

2. **Instalar dependencias del Frontend**
```bash
cd frontend && npm install && cd ..
```

### Ejecución

**Terminal 1: Backend**
```bash
cd backend && npm run dev
```

**Terminal 2: Frontend**
```bash
cd frontend && npm start
```

✅ Backend: http://localhost:3001
✅ Frontend: http://localhost:3000
✅ **Swagger API Docs**: http://localhost:3001/api-docs

## 📚 Documentación de la API (Swagger)

El sistema incluye documentación interactiva de la API usando **Swagger/OpenAPI 3.0**.

### Acceder a Swagger UI

Una vez que el backend esté corriendo, visita:

🔗 **http://localhost:3001/api-docs**

### Características de Swagger UI

- 📖 **Documentación completa** de todos los endpoints REST
- 🧪 **Pruebas interactivas** - Ejecuta requests directamente desde el navegador
- 📋 **Esquemas de datos** - Visualiza todas las estructuras de tipos
- 🏷️ **Agrupación por tags** - Endpoints organizados por categoría:
  - 💳 Cuentas
  - 💸 Transacciones (Depósito, Retiro, Transferencia)
  - 🎴 Tarjetas (Débito, Crédito, Prepagadas)
  - 💰 Préstamos
  - 📈 Inversiones
  - 👥 Beneficiarios
  - 🔔 Notificaciones
  - ⏰ Pagos Programados
  - 🛡️ Límites
  - 📊 Historial y Auditoría
  - ⚙️ Administración

### Ejemplo de uso de Swagger

1. Abre http://localhost:3001/api-docs
2. Selecciona un endpoint (ej: `POST /api/transacciones/depositar`)
3. Click en "Try it out"
4. Modifica el JSON de ejemplo con tus datos
5. Click en "Execute"
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

## 🎓 Conceptos Aprendidos

✅ Sincronización de recursos compartidos  
✅ Manejo de condiciones de carrera  
✅ Transacciones ACID  
✅ Auditoría y logging  
✅ APIs REST  
✅ Desarrollo full-stack  

---

**¡Explora los sistemas distribuidos!** 🚀
