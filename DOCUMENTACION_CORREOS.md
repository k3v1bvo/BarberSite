# Configuración de Correos en Barber Pro

Este proyecto soporta el envío de correos electrónicos a través de dos métodos principales:
1. **Nodemailer con Gmail (Contraseñas de aplicación)** - *(Activo por defecto actualmente)*
2. **Resend** - *(Comentado en el código, ideal para producción profesional)*

A continuación, se explica cómo usar y cambiar entre ambos.

---

## 1. Usar Nodemailer con Gmail (Contraseñas de Aplicación)

Este es el método más rápido si ya tienes una cuenta de Gmail y no quieres lidiar con dominios personalizados o servicios de terceros como Resend.

### Prerrequisitos (Instalación)
Si vas a usar Nodemailer, asegúrate de instalar las dependencias necesarias. Puedes instalarlo corriendo los siguientes comandos:

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

### Configuración de la cuenta de Gmail
1. Ve a los ajustes de seguridad de tu cuenta de Google: https://myaccount.google.com/security
2. Activa la **Verificación en 2 pasos** si no la tienes activa.
3. Busca la opción **Contraseñas de aplicaciones** (App Passwords) dentro de Seguridad.
4. Genera una nueva contraseña para la aplicación (por ejemplo, nómbrala "Barber Pro Web").
5. Google te mostrará una contraseña de 16 caracteres (ej: `nray vsaf seuo uajn`). **Guárdala**, ya que no podrás volver a verla.

### Variables de entorno (`.env`)
Agrega estas variables a tu archivo `.env`:

```env
SMTP_USER=tu-correo@gmail.com
SMTP_PASS="nray vsaf seuo uajn" # La contraseña de aplicación 
SMTP_FROM="Barber Pro <tu-correo@gmail.com>"
```

*Nota: En el código actual (`email.ts`), si no defines estas variables, tomará las credenciales que se dejaron por defecto (las que probaste).*

---

## 2. Usar Resend (Recomendado para Producción)

Resend es un servicio diseñado para enviar correos transaccionales de forma masiva y profesional. Evita que tus correos lleguen a Spam con mayor eficacia.

### Prerrequisitos (Instalación)
Si decides usar Resend, la librería ya debería estar instalada, pero por si acaso:

```bash
npm install resend
```

### Configuración en la Plataforma
1. Crea una cuenta en [Resend](https://resend.com).
2. Agrega y verifica tu propio dominio (ej: `tu-barberia.com`).
3. Genera una API Key desde el panel de Resend.

### Variables de entorno (`.env`)
```env
RESEND_API_KEY=re_tuApiKeyAca_12345
RESEND_FROM_EMAIL=Barber Pro <onboarding@resend.dev> # O tu dominio verificado
```

---

## ¿Cómo cambiar entre Nodemailer y Resend en el código?

Ambas implementaciones se encuentran en el archivo:
`src/lib/notifications/email.ts`

Si abres ese archivo verás dos bloques grandes:
- `// 1. CONFIGURACIÓN CON RESEND (Comentada)`
- `// 2. CONFIGURACIÓN CON NODEMAILER (Gmail App Password)`

**Para volver a usar Resend en el futuro:**
1. En `src/lib/notifications/email.ts`, descomenta todo el bloque `1` de Resend.
2. Descomenta la importación `import { Resend } from 'resend'` al inicio del archivo.
3. Comenta o elimina completamente el bloque `2` de Nodemailer.
4. Asegúrate de tener tus variables `RESEND_API_KEY` en tu archivo `.env`.
5. ¡Listo! El proyecto volverá a enviar correos usando la infraestructura de Resend.
