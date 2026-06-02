# Barber Pro Web (Next.js)

Aplicación principal del proyecto **BarberSite**. Vive dentro del monorepo en la raíz del repositorio [BarberSite](https://github.com/k3v1bvo/BarberSite).

## Requisitos

- Node.js 18+
- Proyecto Supabase configurado
- (Opcional) Cuenta Resend para correos

## Configuración

```bash
npm install
cp .env.example .env.local
# Editar .env.local con tus claves
npm run dev
```

Variables: ver `.env.example` y [AVANCE_PROYECTO.md](../AVANCE_PROYECTO.md) en la raíz.

## Scripts

| Comando | Uso |
|---------|-----|
| `npm run dev` | Desarrollo en localhost:3000 |
| `npm run build` | Build de producción |
| `npm run start` | Servidor tras build |
| `npm run lint` | ESLint |

## Rutas principales

| Ruta | Rol |
|------|-----|
| `/` | Landing pública |
| `/reservar` | Reserva de citas |
| `/admin` | Panel administrador |
| `/agenda` | Agenda general |
| `/agenda/[id]` | Agenda barbero |
| `/admin/asistencia` | Control de personal |
| `/notificaciones` | Historial y preferencias |
| `/recepcion` | Recepción del día |
| `/barbero` | Panel barbero |
| `/cliente` | Portal cliente |

## APIs destacadas

- `POST /api/notificaciones/dispatch` — eventos de notificación
- `GET /api/citas/agenda` — datos de calendario
- `POST /api/asistencias/auto-cerrar` — cierre 22:00

## Estructura `src/`

```
src/
├── app/              # App Router (páginas y API routes)
├── components/       # UI, admin, providers
├── lib/
│   ├── notifications/  # dispatch, email, templates
│   ├── agenda/
│   ├── asistencia/
│   └── navigation/
└── hooks/
```

Documentación completa del producto: carpeta raíz del repo (`../README.md`).
