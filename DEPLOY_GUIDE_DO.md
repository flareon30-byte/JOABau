# Guía de Despliegue en Digital Ocean

Para actualizar tu servidor en Digital Ocean con los últimos cambios (corrección de búsqueda), sigue estos pasos:

## Paso 1: Subir cambios locales a GitHub

Desde tu terminal local (en Visual Studio Code):

1.  Añade los cambios al control de versiones:
    ```powershell
    git add .
    ```

2.  Guarda los cambios con un mensaje descriptivo:
    ```powershell
    git commit -m "Corrección de búsqueda y restauración de administrador"
    ```

3.  Envía los cambios a GitHub:
    ```powershell
    git push origin master
    ```

---

## Paso 2: Conectar al Servidor

Abre una terminal nueva o usa PuTTY para conectar a tu servidor Digital Ocean:

```bash
ssh root@139.59.141.99
```
*(Si te pide contraseña, úsala. Si tienes llave SSH configurada, entrarás directo)*.

---

## Paso 3: Actualizar el Proyecto en el Servidor

Una vez dentro del servidor, ejecuta los siguientes comandos uno por uno:

1.  Navega a la carpeta del proyecto (ajusta la ruta si es diferente, por ejemplo `/var/www/joa-technologien` o `~/Joa-Technologien`):
    ```bash
    cd Joa-Technologien
    ```
    *(Si no recuerdas la carpeta, usa `ls` para buscarla)*.

2.  Descarga los últimos cambios de GitHub:
    ```bash
    git pull origin master
    ```

3.  Reconstruye y reinicia los contenedores (si usas Docker):
    ```bash
    docker-compose up -d --build
    ```
    
    *O si usas PM2 directamente:*
    ```bash
    cd server
    npm install
    pm2 restart all
    cd ../client
    npm run build
    ```

## Notas Importantes
- Si la base de datos en el servidor también está vacía o dañada, es posible que necesites ejecutar el script de creación de administrador (`node server/create_admin.js`) dentro del contenedor o servidor.
- Para ver los logs en tiempo real si algo falla: `docker-compose logs -f`.
