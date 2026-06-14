# Barber Pro Web (Next.js)

Aplicación principal del proyecto **BarberSite**. Sistema ERP completo diseñado específicamente para barberías y salones de belleza. 

## 🚀 Características Principales

Este sistema va más allá de un simple gestor de citas, incluyendo:
- **Punto de Venta (POS)**: Registro de ventas, cobro de citas, descuentos de inventario.
- **Roles y Permisos**: 
  - `Admin`: Control total, reportes, configuraciones.
  - `Coordinador`: Gestión de caja, arqueos, agenda global y personal.
  - `Barbero`: Vista enfocada en sus propias citas y ganancias.
  - `Cliente`: Reservas, historial y tienda.
- **Contabilidad Integrada**: Caja chica, egresos, control de bancos, arqueos de caja diarios.
- **Recursos Humanos**: Control de asistencia, cálculo automatizado de comisiones, bonos y sanciones.
- **Marketing y Fidelización**: Programa de Lealtad (Niveles Bronce, Plata, Oro), Reseñas públicas moderables y Tienda E-commerce.
- **Personalización**: Configuración de Hero, Acerca de Nosotros y código QR directamente desde el panel.

## 📋 Documentación Extendida

Para entender a fondo cada flujo, roles, y el modelo de base de datos, revisa la documentación en la raíz de este proyecto:
- [📄 Manual de Usuario y Flujos (MANUAL_DE_USUARIO_Y_FLUJOS.md)](./MANUAL_DE_USUARIO_Y_FLUJOS.md)
- [🏗️ Documentación del Sistema (DOCUMENTACION_SISTEMA.md)](./DOCUMENTACION_SISTEMA.md)

## ⚙️ Requisitos

- Node.js 18+
- Proyecto Supabase configurado (Auth, Database, Storage)
- (Opcional) Cuenta Resend para envío de correos

## 🛠️ Configuración Local

```bash
npm install
cp .env.example .env.local
# Editar .env.local con las URLs y Keys de tu proyecto Supabase
npm run dev
```

## 🗂️ Estructura Principal `src/`

```
src/
├── app/              # App Router (Rutas, páginas, (dashboard) y API routes)
├── components/       # Componentes UI reutilizables y layouts
├── lib/
│   ├── lealtad/      # Lógica de cálculo de puntos y niveles
│   ├── navigation/   # Menús dinámicos por rol
│   └── supabase/     # Clientes de Supabase (Server y Client)
└── types/            # Tipados de TypeScript compartidos
```

## 🌐 Rutas Administrativas Destacadas

| Ruta | Uso |
|------|-----|
| `/admin/caja` | POS y cobro de citas (Flujo principal) |
| `/admin/comisiones` | Recibos de pago y nómina automatizada |
| `/coordinador/arqueo` | Cierre diario de caja |
| `/admin/configuracion`| Landing Page personalizable dinámicamente |
| `/admin/resenas` | Moderación de testimonios del Home |

## 📦 Scripts Disponibles

| Comando | Acción |
|---------|--------|
| `npm run dev` | Inicia servidor de desarrollo en localhost:3000 |
| `npm run build` | Genera la versión de producción optimizada |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Corre ESLint para validar la sintaxis |
