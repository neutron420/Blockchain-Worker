import * as dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import FormData from "form-data";

const GRIEVANCE_CONTRACT_ABI = [
  "function registerUser(string,string,string,bytes32,bytes32,bytes32,string,string,string,string,string)",
  "function registerComplaint(string,string,string,string,string,uint8,bytes32,bytes32,bytes32,bool,string,string,string,string,string)",
  "function registerAnonymousComplaint(string,bytes32,string,string,string,uint8,bytes32,bytes32,bytes32,string,string,string,string,string)",
  "function updateComplaintStatusWithReason(string,uint8,string,string)",
  "function recordComplaintSla(string,uint64,string)",
  "function markComplaintSlaBreached(string,string)",
  "function escalateComplaint(string,uint8,string)",
  "function upvoteComplaint(string)",
  "function recordDuplicateAssessment(string,bytes32,bytes32,bytes32[],bool)",
  "function recordAgentPerformance(string,string,uint8,uint32)",
  "function createCivicPriority(string,bytes32,uint64)",
  "function voteCivicPriority(string)",
  "function issueResolutionCertificate(string,string)",
  "function getComplaintVerificationCode(string) view returns (bytes32)",
  "function commitMerkleBatch(bytes32,uint32,string) returns (uint256)",
] as const;

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
  anonymous?: boolean;
  identityCommitment?: string;
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
  statusName?: string;
  statusReason?: string;
  slaDueAt?: string | number;
  slaNote?: string;
  slaBreachNote?: string;
  escalateToStatus?: number;
  escalationReason?: string;
  upvoteOnChain?: boolean;
  duplicateLeaf?: string;
  duplicateMerkleRoot?: string;
  duplicateProof?: string[];
  duplicateDecision?: boolean;
  agentId?: string;
  agentOutcomeStatus?: number;
  agentScoreDelta?: number;
  issueResolutionCertificate?: boolean;
  resolutionRecipientId?: string;
  priorityId?: string;
  priorityCreatorHash?: string;
  priorityEndsAt?: string | number;
  votePriority?: boolean;
  verificationCodeLabel?: string;
  batchMerkleRoot?: string;
  batchMerkleLabel?: string;
  batchItemCount?: number;
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
      GRIEVANCE_CONTRACT_ABI,
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

        // Try complaint queue up to 3 times
        let found = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const processed = await this.processComplaintQueue();
          if (processed) {
            found = true;
            break;
          }
          if (attempt < 3) await this.sleep(1000);
        }
        if (!found) {
          console.log("No complaints found in queue after 3 attempts.");
        }
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

    const receipt = await tx.wait();
    await this.storeChainMetadata(`user:${data.id}`, cid, receipt);
    return receipt;
  }

  /** ========== COMPLAINT REGISTRATION ========== */
  private async processComplaintQueue(): Promise<boolean> {
    const raw = await this.redis.lpop(Q_COMPLAINTS);
    if (!raw) return false;

    const rawData = JSON.parse(raw);
    const id = rawData.id || `COMP-${uuidv4()}`;

    // Fill in defaults for missing fields so everything gets stored on-chain
    const data: ComplaintQueueData = {
      id,
      categoryId: rawData.categoryId || "UNKNOWN",
      subCategory: rawData.subCategory || "Unknown",
      description: rawData.description || `Complaint ${id}`,
      urgency: rawData.urgency || "MEDIUM",
      attachmentUrl: rawData.attachmentUrl || "",
      assignedDepartment: rawData.assignedDepartment || "GENERAL",
      isPublic: rawData.isPublic ?? true,
      userId: rawData.userId || rawData.assignedTo?.id || `USER-${id}`,
      submissionDate: rawData.submissionDate || new Date().toISOString(),
      location: rawData.location || {
        pin: rawData.pin || "",
        district: rawData.district || "",
        city: rawData.city || "",
        locality: rawData.locality || "",
        state: rawData.state || "India",
      },
    };

    console.log(`Processing complaint ${id}`);

    try {
      await this.registerComplaint(id, data);

      if (data.upvoteOnChain) {
        await this.upvoteComplaint(id);
      }

      if (data.duplicateMerkleRoot) {
        await this.recordDuplicateAssessment(id, data);
      }

      if (data.agentId) {
        await this.recordAgentPerformance(id, data);
      }

      if (data.priorityId) {
        await this.handleCivicPriority(data);
      }

      if (data.issueResolutionCertificate) {
        await this.issueResolutionCertificate(id, data);
      }

      if (data.verificationCodeLabel) {
        await this.storeVerificationCode(id, data.verificationCodeLabel);
      }

      if (data.batchMerkleRoot) {
        await this.commitMerkleBatch(data);
      }

      console.log("Complaint registered:", id);
    } catch (err: any) {
      console.error("Complaint failed:", err.message);
    }
    return true;
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

    const isAnonymous = Boolean(data.anonymous || data.identityCommitment);
    const fnName = isAnonymous ? "registerAnonymousComplaint" : "registerComplaint";
    const fn = this.contract.getFunction(fnName);
    const tx = isAnonymous
      ? await fn(
          id,
          data.identityCommitment || ethers.ZeroHash,
          data.categoryId,
          data.subCategory,
          data.assignedDepartment,
          urgency,
          descHash,
          attachmentHash,
          locHash,
          safePin,
          safeDistrict,
          safeCity,
          safeLocality,
          safeState
        )
      : await fn(
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

    await this.storeChainMetadata(`complaint:${id}`, cid, receipt);

    if (typeof data.slaDueAt !== "undefined") {
      await this.recordComplaintSla(id, data);
    }

    if (typeof data.statusName === "string" && data.statusName.length > 0) {
      await this.updateComplaintStatus(id, data);
    }

    if (typeof data.escalateToStatus === "number") {
      await this.escalateComplaint(id, data);
    }

    return receipt;
  }

  private async upvoteComplaint(id: string) {
    const fn = this.contract.getFunction("upvoteComplaint");
    const tx = await fn(id);
    const receipt = await tx.wait();
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordDuplicateAssessment(id: string, data: ComplaintQueueData) {
    const leafHash = data.duplicateLeaf || this.buildComplaintLeafHash(id, data);
    const merkleRoot = data.duplicateMerkleRoot as string;
    const proof = data.duplicateProof || [];
    const isDuplicate = Boolean(data.duplicateDecision);

    const fn = this.contract.getFunction("recordDuplicateAssessment");
    const tx = await fn(id, leafHash, merkleRoot, proof, isDuplicate);
    const receipt = await tx.wait();
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordAgentPerformance(id: string, data: ComplaintQueueData) {
    const fn = this.contract.getFunction("recordAgentPerformance");
    const outcomeStatus = data.agentOutcomeStatus || STATUS_MAP.COMPLETED;
    const scoreDelta = data.agentScoreDelta ?? 1;
    const tx = await fn(data.agentId, id, outcomeStatus, scoreDelta);
    const receipt = await tx.wait();
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async handleCivicPriority(data: ComplaintQueueData) {
    const priorityId = data.priorityId!;
    const endsAtSource = data.priorityEndsAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
    const endsAt = this.normalizeUnixTime(endsAtSource);

    if (data.priorityCreatorHash) {
      const createFn = this.contract.getFunction("createCivicPriority");
      const tx = await createFn(priorityId, data.priorityCreatorHash, endsAt);
      const receipt = await tx.wait();
      await this.storeChainMetadata(`priority:${priorityId}`, undefined, receipt);
    }

    if (data.votePriority) {
      const voteFn = this.contract.getFunction("voteCivicPriority");
      const tx = await voteFn(priorityId);
      const receipt = await tx.wait();
      await this.storeChainMetadata(`priority:${priorityId}`, undefined, receipt);
    }
  }

  private async issueResolutionCertificate(id: string, data: ComplaintQueueData) {
    const recipientId = data.resolutionRecipientId || data.userId;
    const fn = this.contract.getFunction("issueResolutionCertificate");
    const tx = await fn(id, recipientId);
    const receipt = await tx.wait();
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async storeVerificationCode(id: string, label: string) {
    const fn = this.contract.getFunction("getComplaintVerificationCode");
    const code = await fn(id);
    await this.redis.set(`complaint:${id}:verification:${label}`, code.toString());
  }

  private async commitMerkleBatch(data: ComplaintQueueData) {
    const fn = this.contract.getFunction("commitMerkleBatch");
    const tx = await fn(
      data.batchMerkleRoot,
      data.batchItemCount || 1,
      data.batchMerkleLabel || "weekly-commitment"
    );
    const receipt = await tx.wait();
    await this.storeChainMetadata(`batch:${data.batchMerkleLabel || "weekly-commitment"}`, undefined, receipt);
  }

  private buildComplaintLeafHash(id: string, data: ComplaintQueueData): string {
    const source = JSON.stringify({
      id,
      categoryId: data.categoryId,
      subCategory: data.subCategory,
      description: data.description,
      urgency: data.urgency || "MEDIUM",
      department: data.assignedDepartment,
      userId: data.userId,
      submissionDate: data.submissionDate,
      pin: data.location.pin,
      district: data.location.district,
      city: data.location.city,
      locality: data.location.locality || "",
      state: data.location.state,
    });

    return ethers.keccak256(ethers.toUtf8Bytes(source));
  }

  private async updateComplaintStatus(id: string, data: ComplaintQueueData) {
    const statusName = data.statusName || "UNDER_PROCESSING";
    const statusCode = STATUS_MAP[statusName] || STATUS_MAP.UNDER_PROCESSING;
    const reason = data.statusReason || statusName;

    const fn = this.contract.getFunction("updateComplaintStatusWithReason");
    const tx = await fn(id, statusCode, statusName, reason);
    const receipt = await tx.wait();

    console.log(`Complaint status updated: ${id} → ${statusName}`);
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordComplaintSla(id: string, data: ComplaintQueueData) {
    const expectedBySource = data.slaDueAt ?? Date.now();
    const expectedBy = this.normalizeUnixTime(expectedBySource);
    const note = data.slaNote || `SLA recorded for ${id}`;
    const fn = this.contract.getFunction("recordComplaintSla");
    const tx = await fn(id, expectedBy, note);
    const receipt = await tx.wait();

    console.log(`Complaint SLA recorded: ${id} → ${expectedBy.toString()}`);
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);

    if (data.slaBreachNote) {
      const breachFn = this.contract.getFunction("markComplaintSlaBreached");
      const breachTx = await breachFn(id, data.slaBreachNote);
      const breachReceipt = await breachTx.wait();
      console.log(`Complaint SLA breach recorded: ${id}`);
      await this.storeChainMetadata(`complaint:${id}`, undefined, breachReceipt);
    }
  }

  private async escalateComplaint(id: string, data: ComplaintQueueData) {
    const escalateToStatus = data.escalateToStatus;
    if (typeof escalateToStatus !== "number") {
      return;
    }

    const reason = data.escalationReason || `Escalated to status ${escalateToStatus}`;
    const fn = this.contract.getFunction("escalateComplaint");
    const tx = await fn(id, escalateToStatus, reason);
    const receipt = await tx.wait();

    console.log(`Complaint escalated: ${id} → ${escalateToStatus}`);
    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async storeChainMetadata(
    keyPrefix: string,
    cid: string | undefined,
    receipt: ethers.TransactionReceipt
  ) {
    const updates: Record<string, string> = {
      [`${keyPrefix}:txhash`]: receipt.hash,
      [`${keyPrefix}:block`]: receipt.blockNumber.toString(),
      [`${keyPrefix}:isOnChain`]: "true",
    };

    if (cid) {
      updates[`${keyPrefix}:cid`] = cid;
    }

    await this.redis.mset(updates);
  }

  private normalizeUnixTime(value: string | number): bigint {
    if (typeof value === "number") {
      return BigInt(Math.floor(value > 1_000_000_000_000 ? value / 1000 : value));
    }

    const parsedNumber = Number(value);
    if (!Number.isNaN(parsedNumber) && parsedNumber > 0) {
      return BigInt(Math.floor(parsedNumber > 1_000_000_000_000 ? parsedNumber / 1000 : parsedNumber));
    }

    const parsedDate = Date.parse(value);
    if (Number.isNaN(parsedDate)) {
      throw new Error(`Invalid SLA deadline: ${value}`);
    }

    return BigInt(Math.floor(parsedDate / 1000));
  }

  private sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
  }
}

const worker = new BlockchainWorker();
worker.start();
