FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install

COPY artifacts ./artifacts
COPY src ./src
COPY tsconfig.json ./

RUN ls -la artifacts/contracts/GrievanceContract.sol/ && \
    test -f artifacts/contracts/GrievanceContract.sol/GrievanceContractOptimized.json || \
    (echo "Error: Artifacts not found!" && exit 1)

RUN ./node_modules/.bin/tsc -p tsconfig.json

FROM oven/bun:1-slim
RUN apt-get update && apt-get install -y curl nginx && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/artifacts ./artifacts
COPY --from=builder /app/package.json ./

RUN bun install --production

COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh ./start.sh
RUN chmod +x start.sh

EXPOSE 80

CMD ["./start.sh"]