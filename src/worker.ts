import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import FormData from "form-data";

import GrievanceContractArtifact from "../artifacts/contracts/GrievanceContract.sol/GrievanceContractOptimized.json";

const Q_USERS = "user:registration:queue";
const Q_COMPLAINTS = "complaint:blockchain:queue";

const URGENCY_MAP: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const STATUS_MAP: Record<string, number> = {
  REGISTERED: 1,
  UNDER_PROCESSING: 2,
  FORWARDED: 3,
  ON_HOLD: 4,
  COMPLETED: 5,
  REJECTED: 6,
  ESCALATED_TO_MUNICIPAL_LEVEL: 7,
  ESCALATED_TO_STATE_LEVEL: 8,
  DELETED: 9,
};

interface UserQueueData {
  id: string;
  email: string;
  phoneNumber?: string;
  name: string;
  aadhaarId: string;
  dateOfCreation: string;
  location: {
    pin: string;
    district: string;
    city: string;
    locality?: string;
    municipal: string;
    state: string;
  };
  retryCount?: number;
}

interface ComplaintQueueData {
  id?: string;
  categoryId: string;
  subCategory: string;
  description: string;
  urgency?: string;
  attachmentUrl?: string;
  assignedDepartment: string;
  isPublic: boolean;
  location: {
    pin: string;
    district: string;
    city: string;
    locality?: string;
    state: string;
  };
  userId: string;
  submissionDate: string;
  retryCount?: number;
}

class BlockchainWorker {
  private redis: Redis;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private pollInterval: number;
  private isRunning = false;

  constructor() {
    this.redis = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL)
      : new Redis();
    this.redis.on("error", (err) => {
      console.error("Redis connection error", err);
    });

    this.provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);

    this.contract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS!,
      GrievanceContractArtifact.abi,
      this.wallet
    );

    this.pollInterval = parseInt(process.env.WORKER_POLL_INTERVAL || "5000");

    console.log("Worker initialized with Pinata support");
  }

  async start() {
    this.isRunning = true;
    while (this.isRunning) {
      try {
        await this.processUserQueue();
        await this.processComplaintQueue();
      } catch (e) {
        console.error("Worker loop error:", e);
      }
      await this.sleep(this.pollInterval);
    }
  }

  async stop() {
    this.isRunning = false;
    await this.redis.quit();
  }

  /** UPLOAD JSON TO PINATA */
  private async uploadToPinata(json: any): Promise<string> {
    try {
      const form = new FormData();
      form.append("file", Buffer.from(JSON.stringify(json)), {
        filename: "data.json",
      });

      const res = await axios.post(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        form,
        {
          maxBodyLength: Infinity,
          headers: {
            Authorization: `Bearer ${process.env.PINATA_JWT}`,
            ...form.getHeaders(),
          },
        }
      );

      return res.data.IpfsHash;
    } catch (err: any) {
      console.error("Pinata upload failed:", err.response?.data || err);
      throw err;
    }
  }

  /** ========== USER REGISTRATION ========== */
  private async processUserQueue() {
    const raw = await this.redis.lpop(Q_USERS);
    if (!raw) return;

    const data: UserQueueData = JSON.parse(raw);

    try {
      await this.registerUser(data);
      console.log("User registered:", data.id);
    } catch (err: any) {
      console.error("User registration failed:", err.message);
    }
  }

  private async registerUser(data: UserQueueData) {
    const jsonData = {
      ...data,
      role: "CITIZEN",
    };

    let cid = await this.uploadToPinata(jsonData);

    await this.redis.set(`user:json:${data.id}`, JSON.stringify(jsonData));
    await this.redis.set(`user:cid:${data.id}`, cid);

    console.log(`User JSON uploaded to IPFS → CID: ${cid}`);

    const emailHash = ethers.keccak256(ethers.toUtf8Bytes(data.email));
    // Use placeholder if aadhaarId is missing
    const aadhaarValue = data.aadhaarId || "AADHAAR_NOT_PROVIDED";
    const aadhaarHash = ethers.keccak256(ethers.toUtf8Bytes(aadhaarValue));
    
    const locHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${data.location.pin}|${data.location.district}|${data.location.city}|${data.location.state}|${data.location.municipal}`
      )
    );

    const tx = await this.contract.registerUser(
      data.id,
      data.name,
      "CITIZEN",
      emailHash,
      aadhaarHash,
      locHash,
      data.location.pin,
      data.location.district,
      data.location.city,
      data.location.state,
      data.location.municipal
    );

    await tx.wait();
  }

  /** ========== COMPLAINT REGISTRATION ========== */
  private async processComplaintQueue() {
    const raw = await this.redis.lpop(Q_COMPLAINTS);
    if (!raw) return;

    const data: ComplaintQueueData = JSON.parse(raw);
    const id = data.id || `COMP-${uuidv4()}`;

    // Validate required fields
    if (!data.description || !data.userId || !data.categoryId || !data.location) {
      console.error(`❌ Skipping invalid complaint ${id} - missing required fields:`, {
        hasDescription: !!data.description,
        hasUserId: !!data.userId,
        hasCategoryId: !!data.categoryId,
        hasLocation: !!data.location
      });
      return;
    }

    try {
      await this.registerComplaint(id, data);
      console.log("Complaint registered:", id);
    } catch (err: any) {
      console.error("Complaint failed:", err.message);
    }
  }

  private async registerComplaint(id: string, data: ComplaintQueueData) {
    const jsonData = {
      complaintId: id,
      ...data,
    };

    let cid = await this.uploadToPinata(jsonData);

    await this.redis.set(`complaint:json:${id}`, JSON.stringify(jsonData));
    await this.redis.set(`complaint:cid:${id}`, cid);

    console.log(`Complaint JSON uploaded to IPFS → CID: ${cid}`);

    const descHash = ethers.keccak256(ethers.toUtf8Bytes(data.description));
    const attachmentHash = data.attachmentUrl
      ? ethers.keccak256(ethers.toUtf8Bytes(data.attachmentUrl))
      : ethers.ZeroHash;

    const { pin, district, city, locality, state = "Jharkhand" } = data.location;

    // Ensure all string parameters are not null/undefined
    const safePin = pin || "";
    const safeDistrict = district || "";
    const safeCity = city || "";
    const safeLocality = locality || "";
    const safeState = state || "Jharkhand";

    const locHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${safePin}|${safeDistrict}|${safeCity}|${safeLocality}|${safeState}`)
    );

    const urgency = URGENCY_MAP[data.urgency || "MEDIUM"];

    console.log(`Registering complaint with params:`, {
      id,
      userId: data.userId,
      categoryId: data.categoryId,
      subCategory: data.subCategory,
      department: data.assignedDepartment,
      urgency,
      pin: safePin,
      district: safeDistrict,
      city: safeCity,
      locality: safeLocality,
      state: safeState
    });

    const fn = this.contract.getFunction("registerComplaint");
    const tx = await fn(
      id,
      data.userId,
      data.categoryId,
      data.subCategory,
      data.assignedDepartment,
      urgency,
      descHash,
      attachmentHash,
      locHash,
      data.isPublic,
      safePin,
      safeDistrict,
      safeCity,
      safeLocality,
      safeState
    );

    const receipt = await tx.wait();
    console.log(`Complaint registered: ${id} → Block ${receipt.blockNumber}`);
    return receipt;
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}

const worker = new BlockchainWorker();
worker.start();
