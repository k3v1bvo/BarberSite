# BarberSite ERP - Sistema Integral de Gestión para Barberías

![BarberSite Hero](https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1920)

**BarberSite** no es un simple sistema de reservas. Es un **ERP (Enterprise Resource Planning)** diseñado y construido desde cero para cubrir absolutamente todas las necesidades operativas, contables, logísticas y de marketing de una barbería moderna o salón de belleza de alto nivel.

Aplicación principal del proyecto **BarberSite**. Vive dentro del monorepo en la raíz del repositorio [BarberSite](https://github.com/k3v1bvo/BarberSite).

---

## 🔥 Características Estrella (Lo que hemos construido)

### 1. Sistema Multi-Rol de Alta Precisión
El sistema maneja 4 niveles estrictos de seguridad y control:
- **👑 Administrador**: Dueño del negocio. Acceso global a configuración, reportes financieros, manejo de roles, auditoría y reglas laborales.
- **🎯 Coordinador (Recepción/Caja)**: Encargado de la operación en tiempo real. Maneja el POS, la caja chica, las agendas de todos, aprueba adelantos, registra faltas y cierra caja.
- **✂️ Barbero**: Staff operativo. Tienen un panel blindado donde solo ven sus propias citas, asisten a sus turnos y revisan cuánto dinero han generado en comisiones al día.
- **👤 Cliente**: El usuario final. Inicia sesión para reservar, ver sus puntos de lealtad, historial de visitas y comprar productos.

### 2. Ecosistema Contable y Punto de Venta (POS)
Adiós a los cuadernos y Excel. El sistema hace que todo el flujo de dinero sea rastreable:
- **POS Dinámico**: Cobro de citas con un clic, aplicando métodos de pago (Efectivo, QR, Tarjeta, Transferencia). Al cobrar, descuenta el stock de productos y calcula comisiones automáticamente.
- **Arqueo de Caja Diario**: Sistema ciego de cierre. El coordinador cuenta los billetes, ingresa el monto y el sistema audita si falta o sobra dinero basado en la contabilidad del día.
- **Caja Chica y Bancos**: Separación de libros mayores. Manejo de adelantos en efectivo, depósitos bancarios, y pagos de egresos recurrentes (luz, agua, alquiler).

### 3. Motor de Nóminas y Recursos Humanos
- **Cálculo de Comisiones en Tiempo Real**: El sistema calcula cuánto porcentaje de cada corte o producto le toca al barbero, lo agrupa por quincena/mes y genera un recibo de pago digital detallado.
- **Gestión de Bonos y Sanciones**: El coordinador puede sancionar (por llegar tarde o faltas de respeto) o premiar con bonos, y estos montos alteran automáticamente el pago final de la nómina del empleado.
- **Control de Asistencia**: Fichaje de entrada y salida para medir puntualidad.

### 4. Fidelización y Marketing Integrado
- **Programa de Lealtad (Niveles)**: El sistema rastrea la inversión histórica de cada cliente y lo sube de rango automáticamente (`Bronce`, `Plata`, `Oro`, etc.), habilitando recompensas exclusivas.
- **Moderación de Reseñas / Testimonios**: Los clientes escriben comentarios post-cita. El administrador tiene un panel donde evalúa estos testimonios y con un botón los aprueba para ser públicos en la portada.
- **Página de Inicio Configurable (No-code)**: El dueño puede editar el Título, Subtítulo, la imagen principal (Hero), el código QR del negocio y la sección de "Acerca de Nosotros" en vivo desde el panel de configuración, sin tocar una línea de código.

### 5. Control de Inventario y Operaciones
- **Sincronización de Historial**: Permite vincular citas manuales antiguas a nuevos usuarios registrados, para no perder su historial de puntos.
- **Inventario y Conteo Físico**: Alerta de stock bajo, entrada/salida de mercancía, e interfaz para conteo físico en tienda (ajustes de pérdida o merma).

---

## 📋 Documentación Técnica Extendida

Para ver el manual de uso de cada página y los diagramas de base de datos, revisa la documentación:
- [📄 Manual de Usuario y Flujos de Páginas (MANUAL_DE_USUARIO_Y_FLUJOS.md)](./MANUAL_DE_USUARIO_Y_FLUJOS.md)
- [🏗️ Arquitectura y Roles del Sistema (DOCUMENTACION_SISTEMA.md)](./DOCUMENTACION_SISTEMA.md)
- [📈 Avance Global del Proyecto](../AVANCE_PROYECTO.md)

---

## ⚙️ Stack Tecnológico y Requisitos

- **Framework**: Node.js 18+ y Next.js 14 (App Router)
- **Base de Datos y Backend**: Proyecto Supabase configurado (PostgreSQL, Auth, Storage)
- **Estilos**: Tailwind CSS + ShadcnUI
- **Correo**: Cuenta Resend para correos transaccionales (Opcional)

---

## 🛠️ Despliegue y Configuración Local

1. Instala las dependencias:
```bash
npm install
```

2. Crea tu archivo de entorno y conéctalo a Supabase:
```bash
cp .env.example .env.local
# IMPORTANTE: Editar .env.local con las URLs y Keys de tu proyecto Supabase
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

El proyecto estará corriendo en `http://localhost:3000`.

---

## 💻 Scripts Disponibles

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desarrollo en localhost:3000 |
| `npm run build` | Build optimizado de producción |
| `npm run start` | Servidor de producción tras el build |
| `npm run lint` | ESLint para validar sintaxis |

---

## 🗺️ Mapa de Rutas Principales

| Ruta | Rol | Uso Principal |
|------|-----|---------------|
| `/` | Público | Landing page dinámica |
| `/reservar` | Público / Cliente | Motor de reservas paso a paso |
| `/cliente` | Cliente | Portal personal, lealtad y citas pasadas |
| `/barbero` | Barbero | Panel privado de citas del día y ganancias |
| `/agenda` | Admin / Coord | Calendario global interactivo |
| `/admin/caja` | Admin / Coord | POS y cobro de servicios |
| `/admin/comisiones`| Admin / Coord | Cálculo de nómina y pagos |
| `/coordinador/*` | Admin / Coord | Módulos contables (Ventas, Caja Chica, Arqueo) |
| `/admin/configuracion`| Admin | Edición en vivo de la Landing y códigos QR |
| `/admin/usuarios` | Admin | Asignación de roles al personal |

---

## 🔌 APIs Destacadas (Rutas Internas)

- `POST /api/notificaciones/dispatch` — Motor central de eventos de notificación
- `POST /api/asistencias/auto-cerrar` — Cronjob para cierre automático a las 22:00
- `POST /api/admin/comisiones/recalcular` — Motor de recálculo masivo de nóminas
- `POST /api/admin/caja/checkout` — Transacción atómica de cobro POS, inventario y comisiones

---

## 🗂️ Estructura del Código (`src/`)

```
src/
├── app/              # App Router (páginas públicas, (dashboard) y API routes)
├── components/       # Componentes UI de Shadcn, Layouts y Providers
├── lib/
│   ├── lealtad/        # Lógica matemática de puntos y niveles (Bronce, Plata, Oro)
│   ├── notifications/  # Servicios de envío de emails y plantillas
│   ├── navigation/     # Configuración de menús dinámicos por rol
│   └── supabase/       # Clientes de base de datos (Server y Client)
├── hooks/            # Custom React hooks
└── types/            # Tipados de TypeScript y base de datos compartidos
```

---
*Desarrollado con arquitectura sólida para el mundo real, diseñado para escalar.*
