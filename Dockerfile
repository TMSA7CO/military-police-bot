FROM node:18-bullseye

RUN apt-get update && apt-get install -y \
    ffmpeg \
    fonts-noto \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 8000
CMD ["npm", "start"]