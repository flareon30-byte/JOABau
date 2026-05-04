
cd /var/www
mkdir -p joa-demo
tar -xzf app.tar.gz -C joa-demo
sudo -u postgres psql -c "CREATE USER joa_user WITH PASSWORD 'joa_pass';" || true
sudo -u postgres psql -c "CREATE DATABASE joa_demo OWNER joa_user;" || true
sudo -u postgres psql -c "ALTER USER joa_user CREATEDB;" || true
cd joa-demo/server
echo "DATABASE_URL=postgresql://joa_user:joa_pass@localhost:5432/joa_demo?schema=public" > .env
npm install
npx prisma generate
npx prisma db push --accept-data-loss
node seed_demo.js
pm2 start src/server.js --name joa-api || pm2 start server.js --name joa-api || pm2 restart joa-api
cd ../client
echo "VITE_API_URL=http://164.92.231.176/api" > .env
npm install
npm run build
cat << 'EOF' > /etc/nginx/sites-available/joa-demo
server {
    listen 80;
    server_name _;
    root /var/www/joa-demo/client/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads/ {
        alias /var/www/joa-demo/server/uploads/;
        autoindex off;
    }
}
EOF
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/joa-demo /etc/nginx/sites-enabled/
systemctl restart nginx

