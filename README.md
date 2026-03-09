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
  <img src="https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white" alt="Terraform">
  <img src="https://img.shields.io/badge/AWS-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white" alt="AWS">
  <img src="https://img.shields.io/badge/HCL-7B42BC?style=for-the-badge&logo=hcl&logoColor=white" alt="HCL">
  <img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white" alt="Nginx">
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express">
  <img src="https://img.shields.io/badge/ECS%20Fargate-FF9900?style=for-the-badge&logo=amazonecs&logoColor=white" alt="ECS Fargate">
  <img src="https://img.shields.io/badge/ECR-FF9900?style=for-the-badge&logo=amazonecr&logoColor=white" alt="ECR">
  <img src="https://img.shields.io/badge/CloudWatch-FF4F8B?style=for-the-badge&logo=amazoncloudwatch&logoColor=white" alt="CloudWatch">
</div>

<br/>

**A blockchain worker service for SwarajDesk that processes grievance complaints and user registrations from Redis queues, uploads metadata to IPFS via Pinata, stores immutable records on Ethereum blockchain, and syncs data to cloud database for transparent and tamper-proof complaint management.**

<p>
  <a href="#about-the-project">About</a> •
  <a href="#key-features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#deployment">Deployment</a> •
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

| Category | Technology |
|----------|-----------|
| 🔤 **Language** | [TypeScript](https://www.typescriptlang.org/) |
| ⚡ **Runtime** | [Bun](https://bun.sh/) |
| 🌐 **Server** | [Express](https://expressjs.com/) |
| 📜 **Smart Contracts** | [Solidity](https://soliditylang.org/) |
| 🔨 **Dev Framework** | [Hardhat](https://hardhat.org/) |
| ⛓️ **Blockchain** | [Ethereum (Sepolia)](https://ethereum.org/) |
| 📦 **Decentralized Storage** | [IPFS](https://ipfs.io/) via [Pinata](https://www.pinata.cloud/) |
| 📮 **Message Queue** | [Redis](https://redis.io/) |
| 🐳 **Containerization** | [Docker](https://www.docker.com/) |
| 🔄 **Reverse Proxy** | [Nginx](https://nginx.org/) |
| ☁️ **Cloud** | [AWS ECS Fargate](https://aws.amazon.com/ecs/) |
| 🏗️ **Infrastructure as Code** | [Terraform](https://www.terraform.io/) (HCL) |
| 📊 **Monitoring** | [AWS CloudWatch](https://aws.amazon.com/cloudwatch/) |
| 🗃️ **Image Registry** | [AWS ECR](https://aws.amazon.com/ecr/) |

## Key Features

* 🔄 **Automated Queue Processing** — Continuously monitors Redis queues for new complaints and user registrations
* ⛓️ **Blockchain Immutability** — Permanently stores complaint hashes on Ethereum blockchain
* 📦 **IPFS Integration** — Uploads complaint metadata to IPFS via Pinata for decentralized storage
* 💾 **Dual Database Sync** — Stores transaction data in both blockchain and Pinata cloud database
* 🔍 **Etherscan Verification** — All transactions are publicly verifiable on Etherscan
* 🔁 **Retry Mechanism** — Built-in exponential backoff retry logic for failed transactions
* 📜 **Smart Contract Integration** — Uses Solidity smart contracts for data storage
* 🐳 **Production Ready** — Fully Dockerized with AWS ECS Fargate deployment via Terraform
* 💚 **Health Monitoring** — Built-in `/health` endpoint with uptime and status
* 🔒 **Type Safety** — Full TypeScript implementation for reliability
* 🔄 **Nginx Reverse Proxy** — Port 80 proxying for clean URLs, easy DNS setup

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
    ```

3.  **Set up environment variables:**
    Copy `.env.example` to `.env` and configure:
    ```env
    BLOCKCHAIN_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
    PRIVATE_KEY=your_ethereum_private_key
    CONTRACT_ADDRESS=0xYourDeployedContractAddress

    WORKER_POLL_INTERVAL=5000
    QUEUE_NAME=blockchain_tasks

    REDIS_URL=redis://localhost:6379

    PINATA_API_KEY=your_pinata_api_key
    PINATA_API_SECRET=your_pinata_api_secret
    PINATA_JWT=your_pinata_jwt_token
    ```

4.  **Deploy smart contracts (if not deployed):**
    ```sh
    bun run compile
    bunx hardhat run scripts/deploy.ts --network sepolia
    ```

5.  **Start the worker:**
    ```sh
    # Development
    bun run worker

    # Production
    bun run build
    bun dist/server.js
    ```

## Project Structure

```
swaraj-blockchain-network/
├── contracts/              # Solidity smart contracts
│   └── GrievanceContract.sol
├── src/
│   ├── server.ts           # Express server with health endpoints
│   └── worker.ts           # Main blockchain worker
├── terraform/              # Infrastructure as Code
│   ├── main.tf             # AWS resources (VPC, ECR, ECS, IAM)
│   ├── variables.tf        # Configurable variables
│   ├── terraform.tfvars    # Actual values (gitignored)
│   └── outputs.tf          # ECR URL, push commands
├── scripts/                # Deployment scripts
├── test/                   # Smart contract tests
├── artifacts/              # Compiled contract ABIs
├── nginx.conf              # Nginx reverse proxy config
├── start.sh                # Container startup script
├── Dockerfile              # Multi-stage Docker build
├── hardhat.config.ts       # Hardhat configuration
└── package.json            # Dependencies
```

## API Endpoints

| Method | Endpoint | Description | Response |
|--------|----------|-------------|----------|
| `GET` | `/` | Service status | `Worker is running!` |
| `GET` | `/health` | Health check | `{"status":"healthy","uptime":123,"timestamp":"..."}` |

## Deployment

### 🏗️ Infrastructure (Terraform)

All infrastructure is managed via Terraform — no manual AWS console needed.

**Prerequisites:**
- AWS CLI configured (`aws configure`)
- Terraform installed (`>= v1.5`)
- Docker installed

**Deploy infrastructure:**
```sh
cd terraform
terraform init
terraform plan
terraform apply
```

This creates: **VPC** → **Subnets** → **ECR** → **ECS Cluster** → **Security Groups** → **IAM Roles** → **CloudWatch Logs**

### 🐳 Deploy Application

```sh
# 1. Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <ECR_URL>

# 2. Build & Push
docker build -t blockchain-worker .
docker tag blockchain-worker:latest <ECR_URL>:latest
docker push <ECR_URL>:latest

# 3. Force new deployment
aws ecs update-service \
  --cluster blockchain-worker-cluster \
  --service blockchain-worker-service \
  --force-new-deployment \
  --region ap-south-1
```

### 📊 Monitoring

```sh
# Stream logs in real-time
aws logs tail /ecs/blockchain-worker --follow --region ap-south-1

# Last 5 minutes of logs
aws logs tail /ecs/blockchain-worker --since 5m --region ap-south-1

# Check service status
aws ecs describe-services \
  --cluster blockchain-worker-cluster \
  --services blockchain-worker-service \
  --region ap-south-1 \
  --query "services[0].{running:runningCount,desired:desiredCount,pending:pendingCount}" \
  --output table
```

### 🗑️ Teardown

```sh
cd terraform
terraform destroy
```

### Running with Docker (Local)

```sh
docker build -t blockchain-worker .
docker run -d --name blockchain-worker --env-file .env -p 80:80 blockchain-worker
```

## Smart Contracts

### GrievanceContract.sol

Main contract for storing complaint and user data on Ethereum:

```solidity
function registerUser(
    string memory userId,
    string memory name,
    string memory role,
    bytes32 emailHash,
    bytes32 aadhaarHash,
    bytes32 locationHash,
    string memory pin,
    string memory district,
    string memory city,
    string memory state,
    string memory municipal
) public returns (bool)

function registerComplaint(
    string memory complaintId,
    string memory userId,
    string memory categoryId,
    string memory subCategory,
    string memory department,
    uint256 urgency,
    bytes32 descriptionHash,
    bytes32 attachmentHash,
    bytes32 locationHash,
    bool isPublic,
    string memory pin,
    string memory district,
    string memory city,
    string memory locality,
    string memory state
) public returns (bool)
```

## Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `BLOCKCHAIN_RPC_URL` | Ethereum RPC endpoint (Alchemy/Infura) | ✅ |
| `PRIVATE_KEY` | Ethereum wallet private key | ✅ |
| `CONTRACT_ADDRESS` | Deployed smart contract address | ✅ |
| `REDIS_URL` | Redis connection string | ✅ |
| `PINATA_API_KEY` | Pinata API key | ✅ |
| `PINATA_API_SECRET` | Pinata API secret | ✅ |
| `PINATA_JWT` | Pinata JWT token | ✅ |
| `WORKER_POLL_INTERVAL` | Queue poll interval in ms (default: 5000) | ❌ |
| `QUEUE_NAME` | Redis queue name (default: blockchain_tasks) | ❌ |

## Troubleshooting

### Worker not processing
- Check Redis connection and queue names
- Verify environment variables
- Review CloudWatch/Docker logs

### Transaction failures
- Ensure wallet has sufficient ETH for gas
- Verify RPC endpoint accessibility
- Check contract address is correct
- Monitor Etherscan for transaction status

### IPFS upload failures
- Verify Pinata JWT token validity
- Check API rate limits
- Ensure network connectivity

### ECS task failing health checks
- Check logs: `aws logs tail /ecs/blockchain-worker --follow --region ap-south-1`
- Verify Nginx is running on port 80
- Verify Express is running on port 3000
- Ensure `curl` is installed in the Docker image

## Security Best Practices

- 🔒 Never commit private keys to version control
- 🔑 `terraform.tfvars` is gitignored — contains all secrets
- 🛡️ Use AWS Secrets Manager for production secrets
- ⚡ Implement rate limiting on queue processing
- 💰 Monitor transaction costs and set gas limits
- 🔐 Use secure Redis connections (TLS) in production

## Integration with SwarajDesk

This worker is part of the SwarajDesk ecosystem:

1. **User-BE/Admin-BE** pushes complaints to Redis
2. **Worker** processes queue and stores on blockchain
3. **Frontend** can verify transactions on Etherscan
4. **Pinata DB** provides fast query access to blockchain data

See [SwarajDesk Repository](https://github.com/neutron420/sih-swarajdesk-2025) for complete system documentation.

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
* [Terraform](https://www.terraform.io/) for infrastructure as code
* [AWS ECS Fargate](https://aws.amazon.com/ecs/) for serverless containers

## Contact

Project Link: [https://github.com/neutron420/swaraj-blockchain-network](https://github.com/neutron420/swaraj-blockchain-network)

---

**Swaraj Blockchain Network** — Ensuring Transparency and Accountability in Governance 🇮🇳
