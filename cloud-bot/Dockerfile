FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    xvfb \
    nginx \
    nodejs \
    npm \
    procps \
    curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN mv /usr/bin/Xvfb /usr/bin/system-display

RUN useradd -m -u 1000 user
WORKDIR /home/user

RUN mkdir -p /home/user/decoy

COPY --chown=user:user public/index.html /home/user/decoy/index.html
COPY --chown=user:user nginx.conf /home/user/nginx.conf
COPY --chown=user:user entrypoint.sh /home/user/entrypoint.sh
COPY --chown=user:user package.json /home/user/package.json
COPY --chown=user:user server.js /home/user/server.js

USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    DISPLAY=:0 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROMIUM_PATH=/usr/bin/chromium

RUN npm install --production

RUN chmod +x /home/user/entrypoint.sh

EXPOSE 7860

CMD ["/home/user/entrypoint.sh"]
