# Build Stage
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
ENV FORCE_REBUILD=v2
# Build-time arg for Google Maps API key (passed from docker-compose build.args)
ARG VITE_GOOGLE_MAPS_KEY
ENV VITE_GOOGLE_MAPS_KEY=$VITE_GOOGLE_MAPS_KEY
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=450" npm run build

# Production Stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
