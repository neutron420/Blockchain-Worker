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

# Note: Solidity artifacts are already compiled and committed to the repo
# Skipping Hardhat compile to avoid network/config issues in Docker
# If you need to recompile, do it locally and commit the artifacts

# Verify artifacts exist before compiling
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
COPY --from=builder /app/bun.lockb ./bun.lockb

# Install only production dependencies
RUN bun install --production

# Run the worker
CMD ["bun", "dist/src/worker.js"]
