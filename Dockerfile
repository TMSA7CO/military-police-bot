FROM node:24-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
COPY .npmrc ./

RUN npm install --legacy-peer-deps --omit=dev

COPY . .

EXPOSE 8000
EXPOSE 8001

CMD ["sh", "-c", "node index.js & node index-monitor.js & wait"]