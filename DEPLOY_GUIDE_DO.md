# Guía de Despliegue en Digital Ocean

¡El despliegue de esta aplicación está automatizado! Cada vez que subes cambios a la rama principal (`master`) en GitHub, un flujo de trabajo automático (GitHub Actions) se encarga de actualizar y reiniciar el servidor en tu Droplet de Digital Ocean.

---

## 🚀 Despliegue Automático (Recomendado)

Para subir y desplegar tus cambios locales:

1.  Añade los cambios al control de versiones:
    ```powershell
    git add .
    ```

2.  Guarda los cambios con un mensaje descriptivo:
    ```powershell
    git commit -m "Descripción de los cambios realizados"
    ```

3.  Envía los cambios a GitHub (esto inicia el despliegue automático):
    ```powershell
    git push origin master
    ```

Puedes monitorear el progreso del despliegue en la pestaña **Actions** de tu repositorio en GitHub.

---

## 🛠️ Acceso Manual y Diagnóstico

Si necesitas conectarte directamente al servidor para verificar logs, reiniciar contenedores manualmente o depurar algún problema:

### 1. Conectar al Servidor por SSH

Usa tu terminal o cliente SSH (como PuTTY) con la IP del servidor correcto:

```bash
ssh root@161.35.68.77
```

### 2. Navegar al Directorio del Proyecto

El proyecto está ubicado en el siguiente directorio del servidor:

```bash
cd /opt/JOABau
```

### 3. Comandos Útiles de Docker

Una vez dentro de `/opt/JOABau`, puedes ejecutar:

*   **Ver logs en tiempo real (Backend/Frontend/BD):**
    ```bash
    docker-compose logs -f
    ```
*   **Ver logs de un contenedor específico (ej. server):**
    ```bash
    docker-compose logs -f server
    ```
*   **Reiniciar manualmente los contenedores:**
    ```bash
    docker-compose down
    docker-compose up -d
    ```
*   **Forzar recreación y reconstrucción manual de contenedores:**
    ```bash
    docker-compose up -d --build --force-recreate
    ```

### 4. Inicializar o Modificar la Base de Datos

Si necesitas forzar una actualización del esquema de la base de datos (Prisma) o sembrar datos de prueba desde el servidor:

*   **Actualizar esquema (Prisma db push):**
    ```bash
    docker-compose exec -T server npx prisma db push --accept-data-loss
    ```
*   **Ejecutar un script específico (ej. crear admin o seed):**
    ```bash
    docker-compose exec -T server node src/seed_admin.js
    ```

