# Microservicio de Notificaciones

Microservicio para envío de notificaciones por email usando **Resend** como proveedor de correos.

## 🚀 Características

- ✅ **Servidor HTTP (REST API)** - Puerto 4001
- ✅ **Servidor gRPC** - Puerto 50051
- ✅ **Cola RabbitMQ** - Consumo asíncrono de notificaciones
- ✅ **Docker Ready** - Incluye Dockerfile y docker-compose
- ✅ **TypeScript** - Código tipado y seguro

## 📋 Requisitos

- Node.js 20+
- RabbitMQ (incluido en docker-compose)
- Cuenta en [Resend](https://resend.com) para obtener API key

## 🛠️ Instalación

### Opción 1: Con Docker (Recomendado)

```bash
cd microservicios/notificaciones
docker-compose up --build
```

Esto iniciará:

- RabbitMQ en puerto 5672 (AMQP) y 15672 (UI de gestión)
- Servicio de notificaciones en puertos 4001 (HTTP) y 50051 (gRPC)

### Opción 2: Sin Docker

```bash
cd microservicios/notificaciones

# Instalar dependencias
npm install

# Configurar variables de entorno (ver sección siguiente)
# Editar .env con tu API key de Resend

# Ejecutar en desarrollo
npm run dev

# O compilar y ejecutar en producción
npm run build
npm start
```

## ⚙️ Configuración

El archivo `.env` ya está creado con valores por defecto. **Solo necesitas actualizar la API key de Resend**:

```env
# RabbitMQ connection
RABBITMQ_URL=amqp://user:password@localhost:5672

# Resend API key (REEMPLAZAR con tu clave real)
RESEND_API_KEY=tu_api_key_aqui

# Email remitente
RESEND_FROM="Banco <no-reply@psicologopuebla.com>"

# Puertos
PORT=4001
GRPC_PORT=50051

# Nombre de la cola
NOTIF_QUEUE=notificaciones

# Entorno
NODE_ENV=development
```

### Obtener API Key de Resend

1. Crear cuenta en https://resend.com
2. Ir a API Keys en el dashboard
3. Crear una nueva API key
4. Copiar la key y pegarla en el `.env`

## 🔗 Integración con el Worker

El microservicio ya está integrado con el worker de banco. Cuando se realiza un **retiro**, automáticamente se envía un email al usuario con:

- 📅 Fecha y hora de la operación
- 💵 Monto retirado
- 🏦 Número de cuenta
- 💰 Saldo anterior y nuevo

### Cómo funciona

1. Usuario realiza un retiro desde el worker
2. Worker publica un mensaje en la cola RabbitMQ
3. Microservicio de notificaciones consume el mensaje
4. Email se envía usando Resend

## 📡 API Endpoints

### HTTP (Puerto 4001)

**POST** `/api/notificaciones/send`

Enviar una notificación directamente (para pruebas):

```json
{
  "to": "usuario@ejemplo.com",
  "subject": "Prueba de notificación",
  "message": "Este es un mensaje de prueba"
}
```

### gRPC (Puerto 50051)

Servicio: `NotificacionesService`

Método: `EnviarNotificacion`

Request:

```protobuf
{
  "to": "usuario@ejemplo.com",
  "subject": "Prueba",
  "message": "Mensaje"
}
```

Response:

```protobuf
{
  "success": true,
  "error": ""
}
```

## 🧪 Pruebas

### Probar endpoint HTTP

```bash
curl -X POST http://localhost:4001/api/notificaciones/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "tu@email.com",
    "subject": "Prueba",
    "message": "Este es un mensaje de prueba"
  }'
```

### Ver interfaz de RabbitMQ

Abrir en el navegador: http://localhost:15672

- Usuario: `user`
- Contraseña: `password`

## 📁 Estructura del Proyecto

```
microservicios/notificaciones/
├── src/
│   ├── index.ts              # Punto de entrada principal
│   ├── grpcServer.ts         # Servidor gRPC
│   ├── proto/
│   │   └── notificaciones.proto  # Definición del servicio gRPC
│   ├── queue/
│   │   └── rabbit.ts         # Cliente de RabbitMQ
│   └── services/
│       └── notifier.ts       # Servicio de envío de emails (Resend)
├── .env                      # Variables de entorno
├── .dockerignore
├── docker-compose.yml        # Orquestación con RabbitMQ
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🔧 Scripts Disponibles

- `npm run dev` - Ejecutar en modo desarrollo con ts-node
- `npm run build` - Compilar TypeScript a JavaScript
- `npm start` - Ejecutar versión compilada
- `npm run copy:proto` - Copiar archivos .proto al directorio dist

## 🐛 Troubleshooting

### Error: ECONNREFUSED al conectar a RabbitMQ

Asegúrate de que RabbitMQ esté ejecutándose:

```bash
docker-compose up rabbitmq
```

### Error: API key inválida de Resend

1. Verifica que la API key en `.env` sea correcta
2. Verifica que el dominio del email remitente esté verificado en Resend

### Worker no envía notificaciones

1. Verifica que el worker tenga configurado `RABBITMQ_URL` en su `.env`
2. Verifica que ambos servicios usen el mismo nombre de cola (`NOTIF_QUEUE`)

## 📚 Recursos

- [Documentación de Resend](https://resend.com/docs)
- [RabbitMQ Tutorial](https://www.rabbitmq.com/tutorials/tutorial-one-javascript.html)
- [gRPC Node.js](https://grpc.io/docs/languages/node/)

## 🤝 Soporte

Para problemas o preguntas, contactar al equipo de desarrollo.
