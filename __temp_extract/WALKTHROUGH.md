# Guía de Uso - Fiber Optics Management App

Esta aplicación gestiona el flujo de trabajo completo para la instalación de fibra óptica, desde el soplado hasta la activación final.

## 🚀 Inicio Rápido

### 1. Iniciar el Servidor (Backend)
En una terminal:
```bash
cd server
npm start
```
El servidor correrá en `http://localhost:3000`.

### 2. Iniciar el Cliente (Frontend)
En otra terminal:
```bash
cd client
npm run dev
```
La aplicación se abrirá en `http://localhost:5173`.

### 3. Acceso Inicial
- **Usuario Super Admin**: `jane.orden.hidalgo@gmail.com`
- **Contraseña**: `2122000`

---

## 📋 Flujos de Trabajo

### 1. Configuración Inicial (Admin/Super Admin)
1.  **Crear Usuarios**: Ve a **Usuarios** y crea cuentas para tus empleados asignando el rol correcto (`BLOWER`, `ACTIVATOR`, `BACK_OFFICE`, etc.).
2.  **Crear Equipos**: Ve a **Equipos** y forma parejas de trabajo (ej. 2 sopladores o 2 activadores).
3.  **Crear Proyectos**: Ve a **Proyectos**.
    -   Puedes crear uno manualmente.
    -   O usar **Importar Excel** para cargar masivamente direcciones. El Excel debe tener columnas: `NVT`, `CALLE`, `NUMERO`.

### 2. Departamento de Soplado (Blowing)
*Rol: BLOWER*
1.  Inicia sesión y ve a **Soplado**.
2.  Selecciona el **Proyecto**.
3.  Busca la dirección (por NVT o Calle).
4.  Reporta el estado:
    -   **OK**: Ingresa metros, TK y color del tubo.
    -   **FALLIDO**: Indica el motivo y (opcionalmente) sube fotos.

### 3. Departamento de Fusión
*Rol: BLOWER (o FUSIONIST si se separa)*
1.  Ve a **Fusión**.
2.  Selecciona Proyecto y Dirección.
3.  Ingresa la descripción del trabajo y fotos.

### 4. Back Office (Gestión de Citas)
*Rol: BACK_OFFICE*
1.  Ve a **Citas (Back Office)**.
2.  Verás las direcciones con **Soplado OK** que aún no tienen cita.
3.  **Contactar**: Registra intentos de llamada (No contesta, Buzón, etc.).
4.  **Agendar**: Si el cliente acepta, asigna una **Fecha** y un **Equipo de Activación**.

### 5. Departamento de Activaciones
*Rol: ACTIVATOR*
1.  Ve a **Activaciones**.
2.  Verás la lista de citas asignadas a tu equipo para hoy/futuro.
3.  Entra a una cita y completa el formulario:
    -   Tipo de instalación (BP, SDU, etc. - esto calcula los puntos automáticamente).
    -   Datos técnicos (Potencia, Puertos, etc.).
    -   **Fotos** (Obligatorio).
4.  Al guardar, la cita se marca como **COMPLETADA**.

### 6. Dashboard y Nómina
*Rol: ADMIN/SUPER_ADMIN*
1.  En el **Resumen**, verás contadores en tiempo real.
2.  Verás una tabla de **Rendimiento de Equipos** con el total de activaciones y puntos acumulados en el mes actual para el cálculo de nómina.
