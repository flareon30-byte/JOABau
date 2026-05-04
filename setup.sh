
sudo -u postgres psql -c "CREATE USER joa_user WITH PASSWORD 'joa_pass';"
sudo -u postgres psql -c "CREATE DATABASE joa_demo OWNER joa_user;"
sudo -u postgres psql -c "ALTER USER joa_user CREATEDB;"
git clone https://github.com/flareon30-byte/Joa-Technologien.git /var/www/joa-demo
cd /var/www/joa-demo/server
echo "DATABASE_URL=postgresql://joa_user:joa_pass@localhost:5432/joa_demo?schema=public" > .env
npm install
npx prisma generate
npx prisma db push
cd ../client
echo "VITE_API_URL=http://164.92.231.176/api" > .env
npm install
npm run build
cd ../server
pm2 start server.js --name joa-api

