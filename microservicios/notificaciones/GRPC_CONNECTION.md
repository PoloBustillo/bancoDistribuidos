# Conexión gRPC - Microservicio de Notificaciones

## 📡 Arquitectura de la Conexión gRPC

### 1. Definición del Servicio (Proto File)

El archivo `notificaciones.proto` define el contrato del servicio:

```protobuf
syntax = "proto3";

package notificaciones;

service NotificacionesService {
  rpc EnviarNotificacion (NotificacionRequest) returns (NotificacionResponse);
}

message NotificacionRequest {
  string to = 1;       // Email destinatario
  string subject = 2;  // Asunto del email
  string message = 3;  // Contenido del email
}

message NotificacionResponse {
  bool success = 1;    // Indica si se envió exitosamente
  string error = 2;    // Mensaje de error (vacío si success = true)
}
```

### 2. Servidor gRPC (grpcServer.ts)

El servidor se implementa en varios pasos:

#### Paso 1: Cargar el archivo .proto
```typescript
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";

// Cargar el archivo .proto
const PROTO_PATH = path.join(__dirname, "proto", "notificaciones.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {});
const proto = grpc.loadPackageDefinition(packageDefinition).notificaciones;
```

#### Paso 2: Crear servidor e implementar métodos
```typescript
const server = new grpc.Server();

server.addService(proto.NotificacionesService.service, {
  // Implementar el método EnviarNotificacion
  EnviarNotificacion: async (call, callback) => {
    const { to, subject, message } = call.request;
    
    try {
      await sendNotification(to, subject, message);
      callback(null, { success: true, error: "" });
    } catch (err) {
      callback(null, { success: false, error: err.message });
    }
  },
});
```

#### Paso 3: Iniciar el servidor
```typescript
export function startGrpcServer(port = 50051) {
  server.bindAsync(
    `0.0.0.0:${port}`,
    grpc.ServerCredentials.createInsecure(), // Sin TLS (para desarrollo)
    (err, bindPort) => {
      if (err) throw err;
      console.log(`gRPC server listening on port ${bindPort}`);
    }
  );
}
```

### 3. Cliente gRPC (Cómo Consumir el Servicio)

Aquí hay ejemplos de cómo conectarse al servicio desde diferentes lenguajes:

#### 📘 Node.js/TypeScript

```typescript
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";

// 1. Cargar el mismo archivo .proto
const PROTO_PATH = path.join(__dirname, "proto", "notificaciones.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const NotificacionesProto = grpc.loadPackageDefinition(packageDefinition).notificaciones;

// 2. Crear cliente
const client = new NotificacionesProto.NotificacionesService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

// 3. Usar el cliente
function enviarNotificacion(to: string, subject: string, message: string) {
  return new Promise((resolve, reject) => {
    client.EnviarNotificacion(
      { to, subject, message },
      (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      }
    );
  });
}

// 4. Ejemplo de uso
async function main() {
  try {
    const result = await enviarNotificacion(
      'usuario@ejemplo.com',
      'Prueba gRPC',
      'Este es un mensaje de prueba enviado via gRPC'
    );
    
    console.log('Respuesta:', result);
    // { success: true, error: '' }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
```

#### 🐍 Python

```python
import grpc
import notificaciones_pb2
import notificaciones_pb2_grpc

# 1. Crear canal de comunicación
channel = grpc.insecure_channel('localhost:50051')

# 2. Crear stub (cliente)
stub = notificaciones_pb2_grpc.NotificacionesServiceStub(channel)

# 3. Crear request
request = notificaciones_pb2.NotificacionRequest(
    to='usuario@ejemplo.com',
    subject='Prueba gRPC desde Python',
    message='Este es un mensaje de prueba'
)

# 4. Llamar al servicio
try:
    response = stub.EnviarNotificacion(request)
    print(f"Success: {response.success}")
    if response.error:
        print(f"Error: {response.error}")
except grpc.RpcError as e:
    print(f"gRPC Error: {e.code()} - {e.details()}")
```

#### ☕ Java

```java
import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;

public class NotificacionesClient {
    public static void main(String[] args) {
        // 1. Crear canal
        ManagedChannel channel = ManagedChannelBuilder
            .forAddress("localhost", 50051)
            .usePlaintext()
            .build();
        
        // 2. Crear stub
        NotificacionesServiceGrpc.NotificacionesServiceBlockingStub stub =
            NotificacionesServiceGrpc.newBlockingStub(channel);
        
        // 3. Crear request
        NotificacionRequest request = NotificacionRequest.newBuilder()
            .setTo("usuario@ejemplo.com")
            .setSubject("Prueba gRPC desde Java")
            .setMessage("Este es un mensaje de prueba")
            .build();
        
        // 4. Llamar al servicio
        try {
            NotificacionResponse response = stub.enviarNotificacion(request);
            System.out.println("Success: " + response.getSuccess());
            if (!response.getError().isEmpty()) {
                System.out.println("Error: " + response.getError());
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            channel.shutdown();
        }
    }
}
```

#### 🦀 Rust

```rust
use tonic::transport::Channel;
use notificaciones::notificaciones_service_client::NotificacionesServiceClient;
use notificaciones::NotificacionRequest;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Crear canal
    let channel = Channel::from_static("http://localhost:50051")
        .connect()
        .await?;
    
    // 2. Crear cliente
    let mut client = NotificacionesServiceClient::new(channel);
    
    // 3. Crear request
    let request = tonic::Request::new(NotificacionRequest {
        to: "usuario@ejemplo.com".to_string(),
        subject: "Prueba gRPC desde Rust".to_string(),
        message: "Este es un mensaje de prueba".to_string(),
    });
    
    // 4. Llamar al servicio
    let response = client.enviar_notificacion(request).await?;
    println!("Success: {}", response.get_ref().success);
    
    Ok(())
}
```

### 4. Integración Actual en el Proyecto

En este proyecto, **NO usamos gRPC directamente** desde el worker. En su lugar, usamos **RabbitMQ** por las siguientes razones:

#### ¿Por qué RabbitMQ en lugar de gRPC?

| Aspecto | gRPC | RabbitMQ |
|---------|------|----------|
| **Tipo** | Síncrono (request/response) | Asíncrono (queue) |
| **Acoplamiento** | Fuerte (cliente-servidor) | Débil (productor-consumidor) |
| **Resiliencia** | Si el servidor cae, falla | Los mensajes se encolan |
| **Rendimiento** | Rápido para llamadas síncronas | Mejor para procesamiento asíncrono |
| **Caso de uso** | Consultas que necesitan respuesta inmediata | Tareas que pueden procesarse después |

#### Flujo Actual (Worker → RabbitMQ → Notificaciones)

```
┌─────────┐      ┌─────────────┐      ┌──────────────────┐
│ Worker  │─────▶│  RabbitMQ   │─────▶│  Notificaciones  │
└─────────┘      └─────────────┘      └──────────────────┘
   Publica          Cola                  Consume
   mensaje        "notificaciones"         y envía email
```

**Ventajas de este enfoque:**
- ✅ El retiro no se bloquea esperando el email
- ✅ Si el servicio de notificaciones está caído, los mensajes se acumulan
- ✅ Puedes escalar agregando más consumidores
- ✅ Retry automático si falla el envío

### 5. Cuándo Usar gRPC vs RabbitMQ

**Usa gRPC cuando:**
- ✅ Necesitas respuesta inmediata
- ✅ Comunicación entre microservicios internos
- ✅ Baja latencia es crítica
- ✅ Streaming bidireccional

**Usa RabbitMQ cuando:**
- ✅ Operaciones asíncronas (emails, notificaciones)
- ✅ Necesitas garantizar entrega (persistencia)
- ✅ Desacoplamiento entre servicios
- ✅ Necesitas distribuir carga entre múltiples trabajadores

### 6. Ejemplo Completo: Cliente gRPC desde Worker

Si quisieras usar gRPC en lugar de RabbitMQ, así sería:

```typescript
// worker/src/services/grpcNotificationClient.ts
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";

const PROTO_PATH = path.join(__dirname, "../../../microservicios/notificaciones/src/proto/notificaciones.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {});
const proto: any = grpc.loadPackageDefinition(packageDefinition).notificaciones;

class GrpcNotificationClient {
  private client: any;

  constructor() {
    const NOTIF_SERVICE_URL = process.env.NOTIF_GRPC_URL || "localhost:50051";
    this.client = new proto.NotificacionesService(
      NOTIF_SERVICE_URL,
      grpc.credentials.createInsecure()
    );
  }

  async sendNotification(to: string, subject: string, message: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.EnviarNotificacion(
        { to, subject, message },
        (error: any, response: any) => {
          if (error) {
            console.error("Error gRPC:", error);
            reject(error);
          } else if (!response.success) {
            console.error("Error enviando notificación:", response.error);
            reject(new Error(response.error));
          } else {
            console.log(`✅ Notificación enviada via gRPC: ${to}`);
            resolve(true);
          }
        }
      );
    });
  }
}

export const grpcNotificationClient = new GrpcNotificationClient();
```

### 7. Resumen

🎯 **El servidor gRPC está implementado** en el microservicio de notificaciones (puerto 50051)

🎯 **Actualmente usamos RabbitMQ** porque es mejor para notificaciones asíncronas

🎯 **Puedes usar ambos:** gRPC está disponible si lo necesitas en el futuro

🎯 **El servidor gRPC está listo** para ser consumido por cualquier cliente que lo necesite

## 🧪 Probar el Servidor gRPC

### Con grpcurl (recomendado para testing)

```bash
# Instalar grpcurl
brew install grpcurl  # macOS
choco install grpcurl # Windows

# Listar servicios disponibles
grpcurl -plaintext localhost:50051 list

# Llamar al método
grpcurl -plaintext -d '{
  "to": "test@ejemplo.com",
  "subject": "Prueba gRPC",
  "message": "Mensaje de prueba"
}' localhost:50051 notificaciones.NotificacionesService/EnviarNotificacion
```

### Con BloomRPC (GUI)

1. Descargar [BloomRPC](https://github.com/bloomrpc/bloomrpc)
2. Importar el archivo `notificaciones.proto`
3. Conectar a `localhost:50051`
4. Enviar requests desde la interfaz gráfica

¿Necesitas ayuda para implementar un cliente gRPC específico o tienes dudas sobre alguna parte?
