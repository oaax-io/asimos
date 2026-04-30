# Puppeteer-ready Chromium image (Chrome ships at /home/pptruser/.cache/puppeteer)
FROM ghcr.io/puppeteer/puppeteer:23.10.4

# IMPORTANT: do NOT set PUPPETEER_EXECUTABLE_PATH to /usr/bin/google-chrome —
# the base image does not install Chrome there. Let puppeteer auto-discover
# the bundled Chromium from its cache directory.
ENV NODE_ENV=production

WORKDIR /app
USER root

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

USER pptruser
EXPOSE 8080
CMD ["node", "server.js"]
