# Puppeteer-ready Chromium image
FROM ghcr.io/puppeteer/puppeteer:23.10.4

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

WORKDIR /app
USER root

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

USER pptruser
EXPOSE 8080
CMD ["node", "server.js"]
