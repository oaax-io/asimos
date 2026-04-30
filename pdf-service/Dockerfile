# Puppeteer-ready Chromium image (Chrome ships at /home/pptruser/.cache/puppeteer)
FROM ghcr.io/puppeteer/puppeteer:23.10.4

# IMPORTANT: do NOT set PUPPETEER_EXECUTABLE_PATH to /usr/bin/google-chrome —
# the base image does not install Chrome there. Let puppeteer auto-discover
# the bundled Chromium from its cache directory.
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/home/pptruser/.cache/puppeteer

WORKDIR /app
USER root

RUN mkdir -p /app /home/pptruser/.cache/puppeteer \
 && chown -R pptruser:pptruser /app /home/pptruser/.cache/puppeteer

COPY --chown=pptruser:pptruser package.json ./
USER pptruser
RUN npm install --omit=dev

COPY --chown=pptruser:pptruser server.js ./
EXPOSE 8080
CMD ["node", "server.js"]
