# Guía de Migración de Base de Datos (Excel a Supabase)

Esta herramienta automatizada fue diseñada para importar el historial de clientes al sistema **BarberSite / BarberWeb**, asegurando que conserven sus datos en el "Salón de la Fama" y su nivel en el "Loyalty Circle".

Repositorio: [github.com/k3v1bvo/BarberSite](https://github.com/k3v1bvo/BarberSite) · Avance general: [AVANCE_PROYECTO.md](../AVANCE_PROYECTO.md)

## 1. Preparación del Entorno (Solo la primera vez)

Necesitas tener **Python** instalado en tu computadora. Abre una terminal (o PowerShell) en esta carpeta (`scripts`) y ejecuta el siguiente comando para instalar las librerías necesarias:

```bash
pip install pandas supabase openpyxl python-dotenv
```

## 2. Generar la Plantilla (Opcional pero recomendado)

Para que el script funcione, el Excel debe tener las columnas escritas de manera exacta. Para facilitar esto, hemos creado un generador automático de plantilla.

Ejecuta:
```bash
python generar_plantilla.py
```
> Esto creará un archivo llamado `clientes.xlsx` en esta misma carpeta.
> **Instrucción:** Entrégale ese archivo Excel a tu cliente para que copie y pegue su base de datos antigua dentro de él. (O hazlo tú mismo). Recuerda borrar los datos de ejemplo (Juan Pérez, etc.) y solo dejar los reales.

## 3. Consideraciones de los Datos en el Excel
*   **Nombre:** Es obligatorio. Si la fila no tiene nombre, el script la ignorará.
*   **Visitas_Totales:** Escribe solo el número (ej: `5`). Si está vacío, el script le pondrá `0`.
*   **Dinero_Gastado:** Escribe el monto numérico sin símbolos de moneda (ej: `150.50`).
*   **Cumpleaños:** Preferiblemente en formato `YYYY-MM-DD` (ej: 1995-12-30).

## 4. Ejecutar la Migración

Una vez que el archivo `clientes.xlsx` tenga los datos reales de los clientes y esté guardado en esta carpeta (`scripts`), simplemente ejecuta:

```bash
python migrar_clientes.py
```

### ¿Qué sucederá?
1. El script leerá de manera automática el archivo `.env.local` que está en tu carpeta de Next.js para saber cómo conectarse a tu Supabase de forma segura.
2. Empezará a importar cliente por cliente. Verás en la consola un mensaje verde ✅ por cada éxito o rojo ❌ si hubo algún error en una fila específica.
3. ¡Felicidades! Todos los clientes aparecerán al instante en tu base de datos y en el Dashboard de BarberWeb con su respectivo historial de visitas intacto.

---

## 5. ⚠️ REGLA CRÍTICA: Conciliación de Saldos y Corte Contable (`18/07/2026`)

Al realizar auditorías, limpieza de tablas o futuras migraciones/importaciones de transacciones contables, **se debe respetar estrictamente la conciliación base del Excel finalizada al 18 de julio de 2026**:

* **Saldo Físico en Caja Chica al 18/07/2026**: `Bs. 210,00`
* **Saldo Real en Banco / QR al 18/07/2026**: `Bs. 642,54`

### Directriz de Consulta e Importación:
* **Solo procesar datos posteriores al corte (`> '2026-07-18'`)**: Todo el historial de transacciones desde 2024 hasta el 18 de julio de 2026 ya se encuentra auditado, resumido y fijado como punto de anclaje inicial en los paneles de **BarberWeb** (`/admin`, `/coordinador`, `/caja-chica` y `/banco`).
* **Inmutabilidad del Historial Antiguo**: Si en una futura importación masiva de Excel o limpieza de base de datos se requiere alterar, borrar o sobreescribir transacciones viejas de 2024 o 2025, no afectarán los saldos actuales del sistema siempre que se mantenga este punto de corte en el código para sumar únicamente las operaciones posteriores al **18/07/2026**.
