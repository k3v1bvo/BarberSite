# 💈 Manual Oficial de Operaciones y Administración Integral - Barber Pro Web

**Versión del Documento:** 3.0.0 (Edición Visual Definitiva)
**Plataforma:** Barber Pro Web (PWA - Next.js 16 + Supabase)

Este documento representa el manual definitivo y detallado para la operación del sistema **Barber Pro Web**. Ha sido redactado con **diagramas visuales de texto (compatibles con cualquier lector)** para asegurar la total comprensión de la arquitectura, flujos y límites de la plataforma.

---

## Índice General
1. [Introducción y Ecosistema Tecnológico](#1-introducción-y-ecosistema-tecnológico)
2. [Arquitectura del Sistema (Diagramas Visuales)](#2-arquitectura-del-sistema-diagramas-visuales)
3. [Panel de Administración (Control Maestro)](#3-panel-de-administración-control-maestro)
4. [Módulo del Barbero (Operación Individual)](#4-módulo-del-barbero-operación-individual)
5. [Módulo de Recepción (Control de Piso)](#5-módulo-de-recepción-control-de-piso)
6. [Motor Financiero y Comisiones](#6-motor-financiero-y-comisiones)
7. [Plan de Despliegue y Migración](#7-plan-de-despliegue-y-migración)

---

## 1. Introducción y Ecosistema Tecnológico

Barber Pro Web es una aplicación de grado empresarial diseñada para digitalizar el 100% de las operaciones de una barbería moderna.

*   **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4.
*   **Backend & DB:** Supabase (PostgreSQL).
*   **Métricas:** Recharts.
*   **Emails:** Resend API.

---

## 2. Arquitectura del Sistema (Diagramas Visuales)

A continuación, se detalla cómo se comunican las piezas del sistema, diseñado para que funcione en cualquier dispositivo.

### DIAGRAMA 1: Flujo de Datos Global (Topología)

```text
 📱 CLIENTE / BARBERO (Navegador Móvil o PC)
          │
          ▼  (Peticiones Seguras HTTP)
 ┌──────────────────────────────────────────────┐
 │             🖥️ SERVIDOR VERCEL              │
 │  (Next.js 16 - Renderizado de UI y Rutas)    │
 └───────┬───────────────────────────────┬──────┘
         │                               │
         ▼                               ▼
 ┌───────────────┐               ┌───────────────┐
 │ 🔒 SUPABASE   │               │ ✉️ RESEND API │
 │ - Base Datos  │ ────────────▶ │ - Envío Email │
 │ - Usuarios    │  (Triggers)   │ - Alertas     │
 └───────────────┘               └───────────────┘
```
*Este diagrama muestra cómo el cliente interactúa con Next.js, que a su vez se conecta a Supabase para leer datos y dispara correos mediante Resend.*

### DIAGRAMA 2: Árbol de Directorios del Panel (Rutas Reales)

```text
/ (Página Principal)
├── /reservar          [PÚBLICO] ➡️ Agendamiento automático
├── /tienda            [PÚBLICO] ➡️ Venta de productos
├── /galeria           [PÚBLICO] ➡️ Carrusel y fotos de cortes
│
└── /(dashboard)/      [PRIVADO - Requiere Login y RLS]
    ├── admin/         🔑 Dueño del negocio (Acceso Total)
    │   ├── /comisiones  (Liquidar pagos a barberos)
    │   ├── /portafolio  (Editar la galería pública)
    │   └── /pedidos     (Gestionar ventas de tienda)
    │
    ├── barbero/       ✂️ Trabajador (Acceso Restringido)
    │   └── /agenda      (Ver solo sus propias citas)
    │
    ├── recepcion/     🏪 Cajero del Local
    │   └── /walkin      (Registrar cliente sin cita)
    │
    └── cliente/       👤 Usuario Final
        └── /perfil      (Historial de cortes pasados)
```

---

## 3. Panel de Administración (Control Maestro)

El Administrador tiene acceso total a `/(dashboard)/admin`. Aquí están los alcances de sus módulos.

### DIAGRAMA 3: Mapa de Poder del Administrador

```text
               👑 ADMINISTRADOR (Dueño)
                          │
      ┌───────────────────┼───────────────────┐
      ▼                   ▼                   ▼
 ⚙️ GESTIÓN WEB      💰 FINANZAS         👥 PERSONAL
 - Edita Carrusel    - Paga Comisiones   - Crea Barberos
 - Edita Tienda      - Cambia Precios    - Controla Horarios
 - Sube Fotos        - Ve Reportes       - Sube Fotos de Perfil
```

### Detalle de Funciones:
1. **Gestión Front-End (`/portafolio`, `/tienda`):** El administrador puede editar en tiempo real qué fotos aparecen en el carrusel de la página de inicio, subir nuevos cortes a la galería y agregar productos físicos (ceras, pomadas) para la venta web, sin tocar código.
2. **Finanzas (`/reportes`, `/comisiones`):**
   * Gráficas de ingresos en tiempo real.
   * Sistema de "Liquidación": Un botón que permite pagarle al barbero lo acumulado en la semana y reiniciar su cuenta a $0 en el sistema, enviando ese dinero al historial general de gastos.
3. **Control Humano (`/usuarios`, `/equipo`, `/asistencia`):**
   * Único rol capaz de convertir a un usuario registrado normal en un "Barbero".
   * Determina a qué hora entra y sale cada trabajador y controla ausencias.

---

## 4. Módulo del Barbero (Operación Individual)

El entorno `/(dashboard)/barbero` es un sistema cerrado por seguridad.

### DIAGRAMA 4: Ciclo de Trabajo del Barbero

```text
 1️⃣ Ver Agenda ──▶ 2️⃣ Atender Cliente ──▶ 3️⃣ Marcar "Completado" ──▶ 4️⃣ Cobrar Comisión
 (Bloqueado a        (Sabe qué corte       (Dispara algoritmo         (Ver dinero en
 su propia vista)     le toca hacer)        financiero)                su panel)
```

**Lo que NO puede hacer:**
* Alterar precios o catálogos.
* Ver la agenda o las ganancias generadas por sus colegas.
* Cancelar pagos.

---

## 5. Módulo de Recepción (Control de Piso)

El recepcionista (`/(dashboard)/recepcion`) maneja la tablet física en la entrada del local.

*   **Walk-ins:** Usa una interfaz rápida para atender a alguien que entra de la calle sin cita. Lo asigna al barbero disponible en el momento.
*   **Control Maestro Visual:** Ve una tabla de calendario gigante con todos los barberos simultáneamente.
*   **Cobros Físicos:** Marca si un cliente pagó en tarjeta o efectivo. No puede alterar parámetros del sistema ni ver reportes acumulados.

---

## 6. Motor Financiero y Comisiones (Deep Dive)

El código ubicado en `src/lib/comisiones/helpers.ts` es el cerebro económico. Se ejecuta cada vez que una cita se marca como completada.

### DIAGRAMA 5: Flujo del Algoritmo de Pago

```text
 💰 INICIO: CITA "COMPLETADA" ($20 USD Corte + $4 Propina)
          │
          ▼
 ⚙️ ¿TIPO DE COMISIÓN CONFIGURADA EN EL SERVICIO?
          │
   ┌──────┼────────────────────┬────────────────────┐
   ▼      ▼                    ▼                    ▼
 NINGUNA  FIJA ($)       PORCENTAJE (%)       FALLBACK (Defecto)
 Gana $0  Gana ej: $5    Gana ej: 40%         Usa base del Barbero (30%)
          │                    │                    │
          └────────┬───────────┴────────────────────┘
                   ▼
 ➕ ¿LA PROPINA ES ACUMULABLE?
 ──▶ SÍ: Se le suma el 50% de la propina ($2 USD extra)
 ──▶ NO: Gana solo su comisión del corte.
                   │
                   ▼
 💵 FIN: SE GUARDA COMO "SALDO PENDIENTE POR PAGAR" EN EL PERFIL DEL BARBERO
```

---

## 7. Plan de Despliegue y Migración

### Flujo de Migración Seguro (Sin Contraseñas)
El negocio cuenta con clientes viejos en Excel. Por leyes de ciberseguridad, no se migran contraseñas.

### DIAGRAMA 6: Migración de Clientes Antiguos

```text
 [Excel Viejo] ───(Exporta)──▶ [Script CSV] ───(Inyecta Nombres)──▶ [Supabase Nuevo]
                                                                          │
                                                                   (Cuenta Creada
                                                                    Sin Clave)
                                                                          │
 [Cliente Intenta Entrar] ◀──(Clic en "Recuperar")── [Email de Resend] ◀──┘
           │
           └──▶ [Crea Nueva Contraseña Segura] ──▶ ¡HISTORIAL UNIFICADO! ✅
```

*Nota: Si la vinculación no es posible por correo electrónico, se mejorará este método de inserción en su momento.*
