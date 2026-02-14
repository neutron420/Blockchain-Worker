# Build stage
FROM oven/bun:1 AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install all dependencies (needs dev deps for TypeScript build)
RUN bun install

# Copy everything needed for build (including artifacts)
COPY artifacts ./artifacts
COPY src ./src
COPY tsconfig.json ./

RUN ls -la artifacts/contracts/GrievanceContract.sol/ && \
    test -f artifacts/contracts/GrievanceContract.sol/GrievanceContractOptimized.json || \
    (echo "Error: Artifacts not found!" && exit 1)

# Build TypeScript worker (generates dist/)
RUN ./node_modules/.bin/tsc -p tsconfig.json

# Production stage
FROM oven/bun:1-slim
WORKDIR /app

# Copy built output and artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/artifacts ./artifacts
COPY --from=builder /app/package.json ./


    # Install only production dependencies
    RUN bun install --production

    # Expose port for Render
    EXPOSE 3008

    # Start the Express server
    CMD ["bun", "run", "server.ts"]

# Run the worker
CMD ["bun", "dist/src/worker.js"]
