FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . .

RUN npm ci --include=dev
RUN npx prisma generate --schema packages/db/prisma/schema.prisma

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "start", "-w", "@symposium/server"]
