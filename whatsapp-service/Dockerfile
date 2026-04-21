# whatsapp-web.js requires Chromium via Puppeteer
FROM node:20-bullseye-slim

# Install Chromium and required fonts/libs
RUN apt-get update && apt-get install -y \
    chromium \
    git \
    ca-certificates \
    fonts-noto-color-emoji \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" && \
    npm install --only=production

COPY index.js .

RUN mkdir -p /app/sessions

EXPOSE 3001

CMD ["node", "index.js"]
