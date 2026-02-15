<div align="center">

# Swaraj Blockchain Network

<br/>

<div>
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white" alt="Solidity">
  <img src="https://img.shields.io/badge/Hardhat-FFF100?style=for-the-badge&logo=hardhat&logoColor=black" alt="Hardhat">
  <img src="https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Ethereum">
  <img src="https://img.shields.io/badge/IPFS-65C2CB?style=for-the-badge&logo=ipfs&logoColor=white" alt="IPFS">
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun">
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker">
</div>

<br/>

**A blockchain worker service for SwarajDesk that processes grievance complaints and user registrations from Redis queues, uploads metadata to IPFS via Pinata, stores immutable records on Ethereum blockchain, and syncs data to cloud database for transparent and tamper-proof complaint management.**

<p>
  <a href="#about-the-project">About</a> •
  <a href="#key-features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

[**SwarajDesk**](https://github.com/neutron420/sih-swarajdesk-2025) · [**Report a Bug**](https://github.com/neutron420/swaraj-blockchain-network/issues) · [**Request a Feature**](https://github.com/neutron420/swaraj-blockchain-network/issues)

</div>

## About The Project

Swaraj Blockchain Network is a critical component of the SwarajDesk citizen grievance redressal system. This worker service acts as a bridge between the application layer and blockchain, ensuring every complaint and user registration is permanently and immutably recorded on the Ethereum blockchain. By processing Redis queue messages, uploading metadata to IPFS, and storing transaction hashes on both blockchain and cloud database (Pinata DB), it provides complete transparency and accountability in the grievance management process.

### How It Works

```
SwarajDesk App → Redis Queue → Worker → IPFS (Pinata) → Ethereum → Cloud DB (Pinata DB)
                                  ↓
                            Etherscan Verification
```

1. **Queue Processing**: Listens to Redis queues for new complaints and user registrations
2. **IPFS Upload**: Uploads complaint metadata to IPFS via Pinata for decentralized storage
3. **Blockchain Recording**: Stores complaint hash on Ethereum blockchain via smart contracts
4. **Cloud Sync**: Syncs transaction details to Pinata cloud database
5. **Verification**: All transactions are visible on Etherscan for public verification

### Built With

This worker service combines modern blockchain technologies with robust queue processing for reliable data persistence.

* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **Runtime:** [Bun](https://bun.sh/) (High-performance JavaScript runtime)
* **Smart Contracts:** [Solidity](https://soliditylang.org/)
* **Development Framework:** [Hardhat](https://hardhat.org/)
* **Blockchain:** [Ethereum](https://ethereum.org/)
* **Decentralized Storage:** [IPFS](https://ipfs.io/) via [Pinata](https://www.pinata.cloud/)
* **Message Queue:** [Redis](https://redis.io/)
* **Containerization:** [Docker](https://www.docker.com/)
* **Deployment:** [AWS ECS](https://aws.amazon.com/ecs/)

## Key Features

* **Automated Queue Processing:** Continuously monitors Redis queues for new complaints and user registrations
* **Blockchain Immutability:** Permanently stores complaint hashes on Ethereum blockchain
* **IPFS Integration:** Uploads complaint metadata to IPFS via Pinata for decentralized storage
* **Dual Database Sync:** Stores transaction data in both blockchain and Pinata cloud database
* **Etherscan Verification:** All transactions are publicly verifiable on Etherscan
* **Retry Mechanism:** Built-in exponential backoff retry logic for failed transactions
* **Smart Contract Integration:** Uses Solidity smart contracts for data storage
* **Production Ready:** Fully Dockerized with AWS ECS deployment support
* **Health Monitoring:** Built-in health checks for production deployment
* **Type Safety:** Full TypeScript implementation for reliability

## Architecture

### Queue Structure

**User Registration Queue:** `user:registration:queue`
- User details (ID, email, phone, name)
- Aadhaar information
- Location data (PIN, district, city, state, municipal)
- Timestamp

**Complaint Queue:** `complaint:blockchain:queue`
- Complaint details (category, subcategory, description)
- Urgency level and status
- Attachment URLs
- Department assignment
- Location information
- User ID and submission date
- Public/private visibility flag

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     SwarajDesk App                       │
│              (User-FE, Admin-FE, Backend)                │
└────────────────────┬────────────────────────────────────┘
                     │ Push to Queue
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Redis Queues                          │
│   user:registration:queue | complaint:blockchain:queue  │
└────────────────────┬────────────────────────────────────┘
                     │ Poll
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Blockchain Worker (This Repo)               │
│                                                          │
│  1. Fetch from Queue → 2. Upload to IPFS (Pinata)       │
│  3. Store on Ethereum → 4. Sync to Pinata DB            │
└────┬────────────────┬──────────────────┬────────────────┘
     │                │                  │
     ▼                ▼                  ▼
  ┌──────┐      ┌──────────┐      ┌────────────┐
  │ IPFS │      │Ethereum  │      │ Pinata DB  │
  │Pinata│      │Blockchain│      │(Cloud DB)  │
  └──────┘      └─────┬────┘      └────────────┘
                      │
                      ▼
                ┌──────────┐
                │Etherscan │
                │Verification│
                └──────────┘
```

## Getting Started

### Prerequisites

* **Bun** (1.0+) or **Node.js** (18+)
  ```sh
  curl -fsSL https://bun.sh/install | bash
  ```

* **Redis** (7.0+)
  ```sh
  # Docker
  docker run -d -p 6379:6379 redis:7-alpine
  ```

* **Ethereum RPC Access**
  - Infura, Alchemy, or any Ethereum RPC provider
  - Private key with ETH for gas fees

* **Pinata Account**
  - JWT token for IPFS uploads
  - API access for cloud database

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/neutron420/swaraj-blockchain-network.git
    cd swaraj-blockchain-network
    ```

2.  **Install dependencies:**
    ```sh
    bun install
    # or
    npm install
    ```

3.  **Set up environment variables:**
    Copy `.env.example` to `.env` and configure:
    ```env
    # Redis Configuration
    REDIS_URL=redis://localhost:6379

    # Blockchain Configuration
    BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
    PRIVATE_KEY=your_ethereum_private_key
    CONTRACT_ADDRESS=0xYourDeployedContractAddress

    # IPFS/Pinata Configuration
    PINATA_JWT=your_pinata_jwt_token
    PINATA_API_URL=https://api.pinata.cloud

    # Worker Configuration
    WORKER_POLL_INTERVAL=5000
    MAX_RETRIES=3
    ```

4.  **Deploy smart contracts (if not deployed):**
    ```sh
    # Compile contracts
    bun run compile

    # Deploy to network
    bunx hardhat run scripts/deploy.ts --network sepolia
    ```

5.  **Start the worker:**
    ```sh
    # Development
    bun run worker

    # Production
    bun run build
    bun dist/src/worker.js
    ```

## Project Structure

```
swaraj-blockchain-network/
├── contracts/              # Solidity smart contracts
│   └── GrievanceStorage.sol
├── src/
│   └── worker.ts          # Main worker implementation
├── scripts/               # Deployment and utility scripts
├── test/                  # Smart contract tests
├── artifacts/             # Compiled contract ABIs
├── typechain-types/       # TypeChain generated types
├── doc/                   # Additional documentation
├── Dockerfile             # Docker configuration
├── aws-ecs-task-definition.json  # ECS task definition
├── hardhat.config.ts      # Hardhat configuration
└── package.json           # Dependencies
```

## Smart Contracts

### GrievanceStorage.sol

Main contract for storing complaint and user data:

```solidity
// Store complaint hash
function storeComplaint(
    string memory complaintId,
    string memory ipfsHash,
    uint256 timestamp
) public returns (bool)

// Store user registration
function registerUser(
    string memory userId,
    string memory dataHash,
    uint256 timestamp
) public returns (bool)
```

### Deployment

```sh
# Deploy to Sepolia testnet
bunx hardhat run scripts/deploy.ts --network sepolia

# Deploy to mainnet
bunx hardhat run scripts/deploy.ts --network mainnet
```

## Running with Docker

### Build Image

```sh
docker build -t swaraj-blockchain-worker .
```

### Run Container

```sh
docker run -d \
  --name swaraj-worker \
  --env-file .env \
  -p 8080:8080 \
  swaraj-blockchain-worker
```

### Docker Compose

```sh
docker-compose up -d
```

## AWS ECS Deployment

### Prerequisites

* AWS CLI configured
* ECR repository created
* Secrets in AWS Secrets Manager

### Deployment Steps

1. **Push to ECR:**
   ```sh
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin \
     <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com

   docker build -t swaraj-blockchain-worker .
   docker tag swaraj-blockchain-worker:latest \
     <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/swaraj-blockchain-worker:latest
   docker push <ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com/swaraj-blockchain-worker:latest
   ```

2. **Register Task Definition:**
   ```sh
   aws ecs register-task-definition \
     --cli-input-json file://aws-ecs-task-definition.json
   ```

3. **Create/Update Service:**
   ```sh
   aws ecs create-service \
     --cluster swaraj-cluster \
     --service-name blockchain-worker \
     --task-definition swaraj-blockchain-worker \
     --desired-count 1 \
     --launch-type FARGATE
   ```

### Monitoring

```sh
# View logs
aws logs tail /ecs/swaraj-blockchain-worker --follow

# Check service status
aws ecs describe-services \
  --cluster swaraj-cluster \
  --services blockchain-worker
```

## Testing

```sh
# Run Hardhat tests
bun test

# Run with coverage
bun run coverage

# Test specific file
bun test test/GrievanceStorage.test.ts
```

## Integration with SwarajDesk

This worker is part of the SwarajDesk ecosystem:

1. **User-BE/Admin-BE** pushes complaints to Redis
2. **Worker** processes queue and stores on blockchain
3. **Frontend** can verify transactions on Etherscan
4. **Pinata DB** provides fast query access to blockchain data

See [SwarajDesk Repository](https://github.com/neutron420/sih-swarajdesk-2025) for complete system documentation.

## Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `REDIS_URL` | Redis connection string | Yes |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint | Yes |
| `PRIVATE_KEY` | Wallet private key | Yes |
| `CONTRACT_ADDRESS` | Deployed contract address | Yes |
| `PINATA_JWT` | Pinata JWT token | Yes |
| `PINATA_API_URL` | Pinata API endpoint | No |
| `WORKER_POLL_INTERVAL` | Queue poll interval (ms) | No |
| `MAX_RETRIES` | Max retry attempts | No |

## Troubleshooting

### Worker not processing

* Check Redis connection and queue names
* Verify environment variables
* Review CloudWatch/Docker logs

### Transaction failures

* Ensure wallet has sufficient ETH
* Verify RPC endpoint accessibility
* Check contract address is correct
* Monitor Etherscan for transaction status

### IPFS upload failures

* Verify Pinata JWT token validity
* Check API rate limits
* Ensure network connectivity

## Security Best Practices

* Never commit private keys to version control
* Use AWS Secrets Manager for production secrets
* Implement rate limiting on queue processing
* Monitor transaction costs and set gas limits
* Use secure Redis connections (TLS) in production

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## License

ISC License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

* Built for **Smart India Hackathon 2025**
* Part of the **SwarajDesk** citizen grievance redressal system
* [Hardhat](https://hardhat.org/) for smart contract development
* [Pinata](https://www.pinata.cloud/) for IPFS infrastructure
* [Bun](https://bun.sh/) for high-performance runtime

## Contact

Project Link: [https://github.com/neutron420/swaraj-blockchain-network](https://github.com/neutron420/swaraj-blockchain-network)

---

**Swaraj Blockchain Network** - Ensuring Transparency and Accountability in Governance
