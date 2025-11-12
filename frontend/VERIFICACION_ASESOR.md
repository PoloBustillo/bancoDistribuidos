# 🔐 Sistema de Verificación para Asesores - Frontend

## 📋 Descripción

El sistema permite a los **clientes** generar códigos temporales de 6 dígitos para que los **asesores bancarios** puedan acceder a su información de forma segura.

## 🎯 Componentes Implementados

### 1. `VerificationCode.tsx`
Componente principal que:
- Genera códigos de verificación de 6 dígitos
- Muestra el código con countdown timer (10 minutos)
- Maneja errores y estados de carga
- Permite regenerar códigos

### 2. `VerificationModal.tsx`
Modal que envuelve el componente de verificación:
- Overlay con blur effect
- Botón de cierre en esquina superior derecha
- Click fuera del modal para cerrar

### 3. Integración en `Dashboard.tsx`
Botón "👤 Atención con Asesor" en la cabecera del dashboard

## 🔄 Flujo de Uso

### Para el Cliente (Frontend)

1. **Cliente** hace clic en "👤 Atención con Asesor"
2. Se abre el modal con el componente de verificación
3. **Cliente** hace clic en "Generar Código de Verificación"
4. El sistema muestra:
   ```
   ┌──────────────────────────┐
   │ Tu código de verificación│
   │                          │
   │      1 2 3 4 5 6        │
   │                          │
   │   Expira en: 9:45       │
   └──────────────────────────┘
   ```
5. **Cliente** comunica al asesor:
   - El código de 6 dígitos
   - Los últimos 4 dígitos de su cuenta/tarjeta

### Para el Asesor (Terminal)

6. **Asesor** ejecuta: `bun run terminal:asesor`
7. Ingresa:
   - ID del asesor
   - Número de cuenta/tarjeta del cliente
   - Últimos 4 dígitos
   - Código de 6 dígitos (que el cliente le proporcionó)
8. Sistema verifica y da acceso por 30 minutos

## 🔌 Endpoint Backend Utilizado

```typescript
POST /api/client/verification-code
Headers: {
  Authorization: Bearer <JWT_TOKEN>
}

Response: {
  codigo: "123456",        // El código de 6 dígitos
  expiresAt: "2025-11-10T...",
  expiresIn: 600          // Segundos restantes (10 min)
}
```

## 🎨 Características Visuales

- ✅ Diseño moderno con gradientes púrpura
- ✅ Animaciones suaves (hover, scale)
- ✅ Countdown timer en tiempo real
- ✅ Responsive design
- ✅ Estados de carga y error
- ✅ Instrucciones claras para el usuario

## 🔐 Seguridad

1. **Código temporal**: Expira en 10 minutos
2. **Un solo uso**: El código se invalida después de ser usado
3. **Requiere autenticación**: El cliente debe estar logueado
4. **Doble verificación**: Código + últimos 4 dígitos
5. **Sesión limitada**: El asesor solo tiene acceso por 30 minutos
6. **Solo lectura**: El asesor no puede hacer transferencias

## 🚀 Cómo Probar

### 1. Asegúrate de que el backend esté corriendo:
\`\`\`bash
cd worker
bun run dev
\`\`\`

### 2. Inicia el frontend:
\`\`\`bash
cd frontend
bun run dev
\`\`\`

### 3. Flujo de prueba:
1. Accede a http://localhost:3000
2. Inicia sesión con un usuario
3. Haz clic en "👤 Atención con Asesor"
4. Genera un código
5. Copia el código de 6 dígitos
6. En otra terminal: `cd worker && bun run terminal:asesor`
7. Ingresa los datos solicitados
8. ¡El asesor tendrá acceso!

## 📝 Notas Importantes

- El **código se muestra solo al cliente**, nunca al asesor
- El **cliente debe comunicar el código al asesor** (teléfono, chat, etc.)
- El **asesor solo puede ver información**, no modificar
- Todas las acciones del asesor quedan **registradas en auditoría**

## 🔧 Personalización

Si necesitas cambiar los colores o estilos, edita:
- `VerificationCode.tsx` → Clases de Tailwind CSS
- Puedes cambiar de púrpura a otro color modificando las clases `purple-*`

## 📚 Ejemplo de Uso en Código

\`\`\`tsx
import { VerificationModal } from '@/components/VerificationModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Hablar con Asesor
      </button>

      <VerificationModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
\`\`\`
