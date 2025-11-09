# 🏦 Sistema Bancario Distribuido - Frontend

Interfaz web educativa para demostrar conceptos de sistemas distribuidos.

## 🚀 Características

### ✅ Implementado

- **Selector Dinámico de Workers**: Agrega workers en cualquier puerto (1024-65535)
- **Multi-Worker**: Prueba el sistema con múltiples workers simultáneamente
- **Autenticación**: Registro e inicio de sesión
- **Gestión de Cuentas**: 
  - Ver todas tus cuentas
  - Crear cuentas adicionales (Cheques, Débito, Crédito)
  - Compartir cuentas con otros usuarios (con roles)
- **Operaciones Bancarias**:
  - Transferencias entre cuentas
  - Depósitos
  - Retiros
- **Interfaz en Español**: Toda la UI está en español
- **Diseño Moderno**: UI oscura con Tailwind CSS

## 🛠️ Tecnologías

- **Next.js 15** - Framework React
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos
- **Bun** - Runtime y gestor de paquetes

## 📦 Instalación

```bash
# Instalar dependencias
bun install

# Ejecutar en modo desarrollo
bun run dev

# Compilar para producción
bun run build

# Ejecutar producción
bun start
```

## 🎯 Uso

### 1. Iniciar Workers del Backend

Primero, asegúrate de tener los workers corriendo:

```bash
# Terminal 1: Coordinador
cd ../coordinador
bun run dev

# Terminal 2: Worker 1 (puerto 3001)
cd ../worker
PORT=3001 bun run dev

# Terminal 3: Worker 2 (puerto 3002)
cd ../worker
PORT=3002 bun run dev
```

### 2. Iniciar el Frontend

```bash
# Terminal 4: Frontend
cd frontend
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

### 3. Agregar Workers Dinámicamente

En la interfaz:
1. Click en **"➕ Agregar Worker"**
2. Ingresa el puerto (ej: 3003, 3004, etc.)
3. Click en **"Agregar"**

¡Ahora puedes seleccionar entre todos los workers disponibles!

## 🎓 Conceptos Demostrados

### 1. Recursos Compartidos (Cuentas)
- Múltiples usuarios pueden acceder a la misma cuenta
- Los locks distribuidos previenen condiciones de carrera
- Operaciones concurrentes se sincronizan correctamente

### 2. Recursos Individuales (Tarjetas)
- Cada usuario tiene sus propias tarjetas
- No requieren locks (son recursos individuales)
- Solo el dueño puede modificar su tarjeta

### 3. Control de Acceso (RBAC)
- **TITULAR**: Acceso completo, puede agregar/remover usuarios
- **AUTORIZADO**: Puede realizar operaciones bancarias
- **CONSULTA**: Solo puede ver el saldo

### 4. Multi-Worker
- Selecciona el worker que procesará cada petición
- Observa cómo diferentes workers coordinan
- Prueba operaciones simultáneas desde diferentes workers

## 📂 Estructura del Proyecto

```
frontend/
├── src/
│   ├── app/                 # App Router de Next.js
│   │   ├── layout.tsx       # Layout principal con AppProvider
│   │   ├── page.tsx         # Página principal
│   │   └── globals.css      # Estilos globales
│   ├── components/          # Componentes React
│   │   ├── WorkerSelector.tsx      # Selector dinámico de workers
│   │   ├── AuthForm.tsx            # Formulario login/registro
│   │   ├── Dashboard.tsx           # Panel principal
│   │   ├── AccountCard.tsx         # Tarjeta de cuenta
│   │   └── BankingOperations.tsx   # Operaciones bancarias
│   ├── context/            # Estado global
│   │   └── AppContext.tsx  # Contexto con workers dinámicos
│   ├── lib/                # Utilidades
│   │   └── api.ts          # Cliente API
│   └── types/              # Tipos TypeScript
│       └── index.ts        # Definiciones de tipos
├── public/                 # Archivos estáticos
└── package.json           # Dependencias
```

## 🔧 Configuración de Workers

Por defecto, la aplicación viene configurada con:
- Worker 1: `http://localhost:3001`
- Worker 2: `http://localhost:3002`

Pero puedes agregar más workers dinámicamente desde la UI.

## 🎨 Características de la UI

- **Tema Oscuro**: Diseño moderno y amigable con la vista
- **Responsive**: Funciona en desktop, tablet y móvil
- **Feedback Visual**: Indicadores de estado y carga
- **Colores por Worker**: Cada worker tiene su color distintivo
- **Animaciones**: Transiciones suaves y pulsos de estado

## 🚀 Flujo de Trabajo Típico

1. **Agregar Workers**: Configura los workers que necesites
2. **Seleccionar Worker**: Elige desde qué worker operar
3. **Registrarse**: Crea una cuenta de usuario
4. **Crear Cuentas**: Agrega cuentas de diferentes tipos
5. **Compartir**: Comparte cuentas con otros usuarios
6. **Operar**: Realiza transferencias, depósitos, retiros
7. **Observar**: Ve cómo los locks coordinan las operaciones

## 🐛 Troubleshooting

### Error de conexión al worker
- Verifica que el worker esté corriendo en el puerto especificado
- Revisa la consola del worker para errores
- Asegúrate de que el coordinador esté activo

### Sesión expirada
- El token JWT expira después de 24 horas
- Cierra sesión y vuelve a iniciar sesión

### CORS errors
- Los workers deben tener CORS habilitado
- Verifica la configuración de CORS en el backend

## 📝 Notas

- Este es un proyecto educativo para demostrar conceptos de sistemas distribuidos
- No usar en producción sin las debidas medidas de seguridad
- Los datos se almacenan en PostgreSQL compartida entre todos los workers

## 🤝 Contribuir

Este es un proyecto educativo. Sugerencias y mejoras son bienvenidas!

## 📄 Licencia

MIT
- React Context API
