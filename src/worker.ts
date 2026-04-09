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
  "function verifyAnonymousIdentityProof(bytes32,bytes) returns (bool)",
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
  "function issueResolutionCertificateToWallet(string,string,address,string) returns (uint256)",
  "function getComplaintVerificationCode(string) view returns (bytes32)",
  "function emitComplaintVerificationCode(string) returns (bytes32)",
  "function commitMerkleBatch(bytes32,uint32,string) returns (uint256)",
] as const;

const DEFAULT_USER_QUEUE = "user:registration:queue";
const DEFAULT_COMPLAINT_QUEUE = "complaint:blockchain:queue";
const DEFAULT_METADATA_SYNC_QUEUE = "blockchain:metadata:queue";

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
  id: string;
  categoryId: string;
  subCategory: string;
  description: string;
  urgency?: string;
  attachmentUrl?: string;
  assignedDepartment: string;
  isPublic: boolean;
  complainantId?: string;
  userId?: string;
  anonymous?: boolean;
  identityCommitment?: string;
  anonymousProof?: string;
  anonymousSigner?: string;
  anonymousSignature?: string;
  location: {
    pin: string;
    district: string;
    city: string;
    locality?: string;
    state: string;
  };
  submissionDate: string;
  retryCount?: number;
  lastError?: string;
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
  resolutionRecipientWallet?: string;
  resolutionTokenUri?: string;
  priorityId?: string;
  priorityCreatorHash?: string;
  priorityEndsAt?: string | number;
  votePriority?: boolean;
  verificationCodeLabel?: string;
  batchMerkleRoot?: string;
  batchMerkleLabel?: string;
  batchItemCount?: number;
}

interface ChainMetadataPayload {
  entityType: string;
  entityId: string;
  keyPrefix: string;
  blockchainHash: string;
  blockchainBlock: number;
  ipfsHash?: string;
  isOnChain: boolean;
  updatedAt: string;
}

class BlockchainWorker {
  private redis: Redis;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract: ethers.Contract;
  private pollInterval: number;
  private maxQueueRetries: number;
  private maxTxRetries: number;
  private baseRetryDelayMs: number;
  private maxRetryDelayMs: number;
  private userQueueName: string;
  private complaintQueueName: string;
  private metadataSyncQueueName: string;
  private userProcessingQueueName: string;
  private complaintProcessingQueueName: string;
  private userDlqQueueName: string;
  private complaintDlqQueueName: string;
  private backendSyncUrl?: string;
  private backendSyncToken?: string;
  private emitVerificationCodeTx: boolean;
  private isRunning = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    this.redis = redisUrl
      ? new Redis(redisUrl)
      : new Redis({
          host: process.env.REDIS_HOST || "127.0.0.1",
          port: this.parseIntEnv("REDIS_PORT", 6379),
          password: process.env.REDIS_PASSWORD || undefined,
        });
    this.redis.on("error", (err) => {
      console.error("Redis connection error", err);
    });

    const rpcUrl = this.requireEnv("BLOCKCHAIN_RPC_URL");
    const privateKey = this.requireEnv("PRIVATE_KEY");
    const contractAddress = this.requireEnv("CONTRACT_ADDRESS");

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    this.contract = new ethers.Contract(contractAddress, GRIEVANCE_CONTRACT_ABI, this.wallet);

    this.pollInterval = this.parseIntEnv("WORKER_POLL_INTERVAL", 5000);
    this.maxQueueRetries = this.parseIntEnv("MAX_RETRIES", 5);
    this.maxTxRetries = this.parseIntEnv("MAX_TX_RETRIES", 3);
    this.baseRetryDelayMs = this.parseIntEnv("BASE_RETRY_DELAY_MS", 1000);
    this.maxRetryDelayMs = this.parseIntEnv("MAX_RETRY_DELAY_MS", 30000);

    this.userQueueName = process.env.USER_QUEUE_NAME || DEFAULT_USER_QUEUE;
    this.complaintQueueName =
      process.env.COMPLAINT_QUEUE_NAME || process.env.QUEUE_NAME || DEFAULT_COMPLAINT_QUEUE;
    this.metadataSyncQueueName = process.env.METADATA_SYNC_QUEUE || DEFAULT_METADATA_SYNC_QUEUE;

    this.userProcessingQueueName = `${this.userQueueName}:processing`;
    this.complaintProcessingQueueName = `${this.complaintQueueName}:processing`;
    this.userDlqQueueName = `${this.userQueueName}:dlq`;
    this.complaintDlqQueueName = `${this.complaintQueueName}:dlq`;

    this.backendSyncUrl = process.env.BACKEND_SYNC_URL;
    this.backendSyncToken = process.env.BACKEND_SYNC_TOKEN;
    this.emitVerificationCodeTx =
      (process.env.EMIT_VERIFICATION_CODE_TX || "true").toLowerCase() !== "false";

    console.log("Worker initialized", {
      userQueue: this.userQueueName,
      complaintQueue: this.complaintQueueName,
      metadataQueue: this.metadataSyncQueueName,
      maxQueueRetries: this.maxQueueRetries,
      maxTxRetries: this.maxTxRetries,
    });
  }

  async start() {
    await this.recoverProcessingQueues();

    this.isRunning = true;
    while (this.isRunning) {
      try {
        const userProcessed = await this.processUserQueue();
        const complaintProcessed = await this.processComplaintQueue();

        if (!userProcessed && !complaintProcessed) {
          await this.sleep(this.pollInterval);
        }
      } catch (e) {
        console.error("Worker loop error:", e);
        await this.sleep(this.pollInterval);
      }
    }
  }

  async stop() {
    this.isRunning = false;
    await this.redis.quit();
  }

  private async recoverProcessingQueues() {
    await this.requeueAll(this.userProcessingQueueName, this.userQueueName);
    await this.requeueAll(this.complaintProcessingQueueName, this.complaintQueueName);
  }

  private async requeueAll(fromQueue: string, toQueue: string) {
    let recovered = 0;

    while (true) {
      const message = await this.redis.rpop(fromQueue);
      if (!message) {
        break;
      }

      await this.redis.lpush(toQueue, message);
      recovered += 1;
    }

    if (recovered > 0) {
      console.warn(`Recovered ${recovered} messages from ${fromQueue} to ${toQueue}`);
    }
  }

  private async uploadToPinata(json: unknown): Promise<string> {
    const pinataJwt = this.requireEnv("PINATA_JWT");

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
            Authorization: `Bearer ${pinataJwt}`,
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

  private async processUserQueue(): Promise<boolean> {
    const raw = await this.claimMessage(this.userQueueName, this.userProcessingQueueName);
    if (!raw) {
      return false;
    }

    let data: UserQueueData | undefined;
    try {
      data = JSON.parse(raw) as UserQueueData;
      this.validateUserPayload(data);
      await this.registerUser(data);
      console.log("User registered:", data.id);
      await this.ackMessage(this.userProcessingQueueName, raw);
    } catch (err) {
      await this.handleQueueFailure(
        this.userQueueName,
        this.userProcessingQueueName,
        this.userDlqQueueName,
        raw,
        data,
        err
      );
    }

    return true;
  }

  private async registerUser(data: UserQueueData) {
    const jsonData: Record<string, unknown> = {
      ...data,
      role: "CITIZEN",
    };

    const cid = await this.uploadToPinata(jsonData);

    await this.redis.set(`user:json:${data.id}`, JSON.stringify(jsonData));
    await this.redis.set(`user:cid:${data.id}`, cid);

    const emailHash = ethers.keccak256(ethers.toUtf8Bytes(data.email));
    const aadhaarValue = data.aadhaarId || "AADHAAR_NOT_PROVIDED";
    const aadhaarHash = ethers.keccak256(ethers.toUtf8Bytes(aadhaarValue));
    const locHash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${data.location.pin}|${data.location.district}|${data.location.city}|${data.location.state}|${data.location.municipal}`
      )
    );

    const receipt = await this.sendTransactionWithRetry("registerUser", async () => {
      const fn = this.contract.getFunction("registerUser");
      return fn(
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
    });

    await this.storeChainMetadata(`user:${data.id}`, cid, receipt);
  }

  private async processComplaintQueue(): Promise<boolean> {
    const raw = await this.claimMessage(this.complaintQueueName, this.complaintProcessingQueueName);
    if (!raw) {
      return false;
    }

    let data: ComplaintQueueData | undefined;

    try {
      const rawData = JSON.parse(raw) as Record<string, unknown>;
      data = this.normalizeComplaintPayload(rawData);

      await this.registerComplaint(data.id, data);

      if (data.upvoteOnChain) {
        await this.upvoteComplaint(data.id);
      }

      if (data.duplicateMerkleRoot) {
        await this.recordDuplicateAssessment(data.id, data);
      }

      if (data.agentId) {
        await this.recordAgentPerformance(data.id, data);
      }

      if (data.priorityId) {
        await this.handleCivicPriority(data);
      }

      if (data.issueResolutionCertificate) {
        await this.issueResolutionCertificate(data.id, data);
      }

      if (data.verificationCodeLabel) {
        await this.storeVerificationCode(data.id, data.verificationCodeLabel);
      }

      if (data.batchMerkleRoot) {
        await this.commitMerkleBatch(data);
      }

      console.log("Complaint processed:", data.id);
      await this.ackMessage(this.complaintProcessingQueueName, raw);
    } catch (err) {
      await this.handleQueueFailure(
        this.complaintQueueName,
        this.complaintProcessingQueueName,
        this.complaintDlqQueueName,
        raw,
        data,
        err
      );
    }

    return true;
  }

  private normalizeComplaintPayload(rawData: Record<string, unknown>): ComplaintQueueData {
    const id = this.normalizeString(rawData.id) || `COMP-${uuidv4()}`;
    const hasAnonymousCommitment = Boolean(this.normalizeString(rawData.identityCommitment));
    const isAnonymous = Boolean(rawData.anonymous) || hasAnonymousCommitment;

    const complainantId =
      this.normalizeString(rawData.complainantId) ||
      this.normalizeString(rawData.userId) ||
      this.normalizeString((rawData.assignedTo as Record<string, unknown> | undefined)?.id);
    const anonymousProof =
      this.normalizeString(rawData.anonymousProof) || this.normalizeString(rawData.anonymousSignature);

    if (!isAnonymous && !complainantId) {
      throw new Error(`Missing complainantId/userId for complaint ${id}`);
    }

    return {
      id,
      categoryId: this.normalizeString(rawData.categoryId) || "UNKNOWN",
      subCategory: this.normalizeString(rawData.subCategory) || "Unknown",
      description: this.normalizeString(rawData.description) || `Complaint ${id}`,
      urgency: (this.normalizeString(rawData.urgency) || "MEDIUM").toUpperCase(),
      attachmentUrl: this.normalizeString(rawData.attachmentUrl) || "",
      assignedDepartment: this.normalizeString(rawData.assignedDepartment) || "GENERAL",
      isPublic: typeof rawData.isPublic === "boolean" ? rawData.isPublic : !isAnonymous,
      complainantId: complainantId || undefined,
      userId: complainantId || undefined,
      anonymous: isAnonymous,
      identityCommitment: this.normalizeString(rawData.identityCommitment) || undefined,
      anonymousProof: anonymousProof || undefined,
      anonymousSigner: this.normalizeString(rawData.anonymousSigner) || undefined,
      anonymousSignature: this.normalizeString(rawData.anonymousSignature) || undefined,
      location: this.normalizeLocation(rawData),
      submissionDate: this.normalizeString(rawData.submissionDate) || new Date().toISOString(),
      retryCount: this.extractRetryCount(rawData),
      statusName: this.normalizeString(rawData.statusName) || undefined,
      statusReason: this.normalizeString(rawData.statusReason) || undefined,
      slaDueAt: (rawData.slaDueAt as string | number | undefined) || undefined,
      slaNote: this.normalizeString(rawData.slaNote) || undefined,
      slaBreachNote: this.normalizeString(rawData.slaBreachNote) || undefined,
      escalateToStatus: typeof rawData.escalateToStatus === "number" ? rawData.escalateToStatus : undefined,
      escalationReason: this.normalizeString(rawData.escalationReason) || undefined,
      upvoteOnChain: Boolean(rawData.upvoteOnChain),
      duplicateLeaf: this.normalizeString(rawData.duplicateLeaf) || undefined,
      duplicateMerkleRoot: this.normalizeString(rawData.duplicateMerkleRoot) || undefined,
      duplicateProof: Array.isArray(rawData.duplicateProof)
        ? (rawData.duplicateProof as string[])
        : undefined,
      duplicateDecision: typeof rawData.duplicateDecision === "boolean" ? rawData.duplicateDecision : undefined,
      agentId: this.normalizeString(rawData.agentId) || undefined,
      agentOutcomeStatus:
        typeof rawData.agentOutcomeStatus === "number" ? rawData.agentOutcomeStatus : undefined,
      agentScoreDelta:
        typeof rawData.agentScoreDelta === "number" ? rawData.agentScoreDelta : undefined,
      issueResolutionCertificate: Boolean(rawData.issueResolutionCertificate),
      resolutionRecipientId:
        this.normalizeString(rawData.resolutionRecipientId) || complainantId || undefined,
      resolutionRecipientWallet: this.normalizeString(rawData.resolutionRecipientWallet) || undefined,
      resolutionTokenUri: this.normalizeString(rawData.resolutionTokenUri) || undefined,
      priorityId: this.normalizeString(rawData.priorityId) || undefined,
      priorityCreatorHash: this.normalizeString(rawData.priorityCreatorHash) || undefined,
      priorityEndsAt: (rawData.priorityEndsAt as string | number | undefined) || undefined,
      votePriority: Boolean(rawData.votePriority),
      verificationCodeLabel: this.normalizeString(rawData.verificationCodeLabel) || undefined,
      batchMerkleRoot: this.normalizeString(rawData.batchMerkleRoot) || undefined,
      batchMerkleLabel: this.normalizeString(rawData.batchMerkleLabel) || undefined,
      batchItemCount: typeof rawData.batchItemCount === "number" ? rawData.batchItemCount : undefined,
    };
  }

  private normalizeLocation(rawData: Record<string, unknown>): ComplaintQueueData["location"] {
    const location = (rawData.location || {}) as Record<string, unknown>;

    return {
      pin: this.normalizeString(location.pin) || this.normalizeString(rawData.pin) || "",
      district: this.normalizeString(location.district) || this.normalizeString(rawData.district) || "",
      city: this.normalizeString(location.city) || this.normalizeString(rawData.city) || "",
      locality: this.normalizeString(location.locality) || this.normalizeString(rawData.locality) || "",
      state:
        this.normalizeString(location.state) || this.normalizeString(rawData.state) || "Jharkhand",
    };
  }

  private async registerComplaint(id: string, data: ComplaintQueueData) {
    const jsonData: Record<string, unknown> = {
      complaintId: id,
      ...data,
    };

    const cid = await this.uploadToPinata(jsonData);
    await this.redis.set(`complaint:json:${id}`, JSON.stringify(jsonData));
    await this.redis.set(`complaint:cid:${id}`, cid);

    const descHash = ethers.keccak256(ethers.toUtf8Bytes(data.description));
    const attachmentHash = data.attachmentUrl
      ? ethers.keccak256(ethers.toUtf8Bytes(data.attachmentUrl))
      : ethers.ZeroHash;

    const safePin = data.location.pin || "";
    const safeDistrict = data.location.district || "";
    const safeCity = data.location.city || "";
    const safeLocality = data.location.locality || "";
    const safeState = data.location.state || "Jharkhand";

    const locHash = ethers.keccak256(
      ethers.toUtf8Bytes(`${safePin}|${safeDistrict}|${safeCity}|${safeLocality}|${safeState}`)
    );

    const urgency = URGENCY_MAP[(data.urgency || "MEDIUM").toUpperCase()] || URGENCY_MAP.MEDIUM;
    const isAnonymous = Boolean(data.anonymous || data.identityCommitment);
    const complainantId = data.complainantId || data.userId;

    let receipt: ethers.TransactionReceipt;

    if (isAnonymous) {
      const identityCommitment = this.toBytes32(data.identityCommitment, `${id}:${data.submissionDate}`);

      if (data.anonymousProof) {
        await this.verifyAnonymousProof(id, identityCommitment, data.anonymousProof);
      }

      receipt = await this.sendTransactionWithRetry("registerAnonymousComplaint", async () => {
        const fn = this.contract.getFunction("registerAnonymousComplaint");
        return fn(
          id,
          identityCommitment,
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
        );
      });
    } else {
      if (!complainantId) {
        throw new Error(`Missing complainantId/userId for non-anonymous complaint ${id}`);
      }

      receipt = await this.sendTransactionWithRetry("registerComplaint", async () => {
        const fn = this.contract.getFunction("registerComplaint");
        return fn(
          id,
          complainantId,
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
      });
    }

    await this.storeChainMetadata(`complaint:${id}`, cid, receipt);

    if (typeof data.slaDueAt !== "undefined") {
      await this.recordComplaintSla(id, data);
    }

    if (data.statusName) {
      await this.updateComplaintStatus(id, data);
    }

    if (typeof data.escalateToStatus === "number") {
      await this.escalateComplaint(id, data);
    }
  }

  private async upvoteComplaint(id: string) {
    const receipt = await this.sendTransactionWithRetry("upvoteComplaint", async () => {
      const fn = this.contract.getFunction("upvoteComplaint");
      return fn(id);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordDuplicateAssessment(id: string, data: ComplaintQueueData) {
    const leafHash = this.toBytes32(data.duplicateLeaf, this.buildComplaintLeafHash(id, data));
    const merkleRoot = this.toBytes32(data.duplicateMerkleRoot, "");
    if (merkleRoot === ethers.ZeroHash) {
      throw new Error(`Missing duplicateMerkleRoot for complaint ${id}`);
    }

    const proof = (data.duplicateProof || []).map((item) => this.toBytes32(item, ""));
    const isDuplicate = Boolean(data.duplicateDecision);

    const receipt = await this.sendTransactionWithRetry("recordDuplicateAssessment", async () => {
      const fn = this.contract.getFunction("recordDuplicateAssessment");
      return fn(id, leafHash, merkleRoot, proof, isDuplicate);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordAgentPerformance(id: string, data: ComplaintQueueData) {
    if (!data.agentId) {
      return;
    }

    const outcomeStatus = data.agentOutcomeStatus || STATUS_MAP.COMPLETED;
    const scoreDelta = data.agentScoreDelta ?? 1;

    const receipt = await this.sendTransactionWithRetry("recordAgentPerformance", async () => {
      const fn = this.contract.getFunction("recordAgentPerformance");
      return fn(data.agentId, id, outcomeStatus, scoreDelta);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async handleCivicPriority(data: ComplaintQueueData) {
    if (!data.priorityId) {
      return;
    }

    const priorityId = data.priorityId;
    const endsAtSource = data.priorityEndsAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000;
    const endsAt = this.normalizeUnixTime(endsAtSource);

    if (data.priorityCreatorHash) {
      const creatorHash = this.toBytes32(data.priorityCreatorHash, priorityId);
      const createReceipt = await this.sendTransactionWithRetry("createCivicPriority", async () => {
        const fn = this.contract.getFunction("createCivicPriority");
        return fn(priorityId, creatorHash, endsAt);
      });

      await this.storeChainMetadata(`priority:${priorityId}`, undefined, createReceipt);
    }

    if (data.votePriority) {
      const voteReceipt = await this.sendTransactionWithRetry("voteCivicPriority", async () => {
        const fn = this.contract.getFunction("voteCivicPriority");
        return fn(priorityId);
      });

      await this.storeChainMetadata(`priority:${priorityId}`, undefined, voteReceipt);
    }
  }

  private async issueResolutionCertificate(id: string, data: ComplaintQueueData) {
    const recipientId = data.resolutionRecipientId || data.complainantId || data.userId || "ANONYMOUS";
    const recipientWallet = data.resolutionRecipientWallet;
    const tokenUri = data.resolutionTokenUri || "";

    const receipt = await this.sendTransactionWithRetry("issueResolutionCertificate", async () => {
      if (recipientWallet && ethers.isAddress(recipientWallet)) {
        const fn = this.contract.getFunction("issueResolutionCertificateToWallet");
        return fn(id, recipientId, recipientWallet, tokenUri);
      }

      const fn = this.contract.getFunction("issueResolutionCertificate");
      return fn(id, recipientId);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async storeVerificationCode(id: string, label: string) {
    if (this.emitVerificationCodeTx) {
      const emitReceipt = await this.sendTransactionWithRetry("emitComplaintVerificationCode", async () => {
        const fn = this.contract.getFunction("emitComplaintVerificationCode");
        return fn(id);
      });

      await this.storeChainMetadata(`complaint:${id}`, undefined, emitReceipt);
    }

    const getFn = this.contract.getFunction("getComplaintVerificationCode");
    const code = await getFn(id);
    await this.redis.set(`complaint:${id}:verification:${label}`, code.toString());
  }

  private async commitMerkleBatch(data: ComplaintQueueData) {
    const merkleRoot = this.toBytes32(data.batchMerkleRoot, "");
    if (merkleRoot === ethers.ZeroHash) {
      throw new Error("batchMerkleRoot is required for merkle batch commits");
    }

    const batchLabel = data.batchMerkleLabel || "weekly-commitment";
    const batchItemCount = data.batchItemCount || 1;

    const receipt = await this.sendTransactionWithRetry("commitMerkleBatch", async () => {
      const fn = this.contract.getFunction("commitMerkleBatch");
      return fn(merkleRoot, batchItemCount, batchLabel);
    });

    await this.storeChainMetadata(`batch:${batchLabel}`, undefined, receipt);
  }

  private async updateComplaintStatus(id: string, data: ComplaintQueueData) {
    const statusName = data.statusName || "UNDER_PROCESSING";
    const statusCode = STATUS_MAP[statusName] || STATUS_MAP.UNDER_PROCESSING;
    const statusReason = data.statusReason || statusName;

    const receipt = await this.sendTransactionWithRetry("updateComplaintStatus", async () => {
      const fn = this.contract.getFunction("updateComplaintStatusWithReason");
      return fn(id, statusCode, statusName, statusReason);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private async recordComplaintSla(id: string, data: ComplaintQueueData) {
    const dueAt = this.normalizeUnixTime(data.slaDueAt ?? Date.now());
    const note = data.slaNote || `SLA recorded for ${id}`;

    const slaReceipt = await this.sendTransactionWithRetry("recordComplaintSla", async () => {
      const fn = this.contract.getFunction("recordComplaintSla");
      return fn(id, dueAt, note);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, slaReceipt);

    if (data.slaBreachNote) {
      const breachReceipt = await this.sendTransactionWithRetry("markComplaintSlaBreached", async () => {
        const fn = this.contract.getFunction("markComplaintSlaBreached");
        return fn(id, data.slaBreachNote);
      });

      await this.storeChainMetadata(`complaint:${id}`, undefined, breachReceipt);
    }
  }

  private async escalateComplaint(id: string, data: ComplaintQueueData) {
    if (typeof data.escalateToStatus !== "number") {
      return;
    }

    const escalationReason = data.escalationReason || `Escalated to status ${data.escalateToStatus}`;

    const receipt = await this.sendTransactionWithRetry("escalateComplaint", async () => {
      const fn = this.contract.getFunction("escalateComplaint");
      return fn(id, data.escalateToStatus, escalationReason);
    });

    await this.storeChainMetadata(`complaint:${id}`, undefined, receipt);
  }

  private buildComplaintLeafHash(id: string, data: ComplaintQueueData): string {
    const source = JSON.stringify({
      id,
      complainantId: data.complainantId || data.userId || "ANONYMOUS",
      categoryId: data.categoryId,
      subCategory: data.subCategory,
      description: data.description,
      urgency: data.urgency || "MEDIUM",
      department: data.assignedDepartment,
      submissionDate: data.submissionDate,
      pin: data.location.pin,
      district: data.location.district,
      city: data.location.city,
      locality: data.location.locality || "",
      state: data.location.state,
    });

    return ethers.keccak256(ethers.toUtf8Bytes(source));
  }

  private async verifyAnonymousProof(
    complaintId: string,
    identityCommitment: string,
    proof: string
  ): Promise<void> {
    const proofBytes = this.toBytes(proof);

    await this.sendTransactionWithRetry("verifyAnonymousIdentityProof", async () => {
      const fn = this.contract.getFunction("verifyAnonymousIdentityProof");
      return fn(identityCommitment, proofBytes);
    });

    console.log(`Anonymous proof verified for complaint ${complaintId}`);
  }

  private async sendTransactionWithRetry(
    operation: string,
    sendTx: () => Promise<ethers.ContractTransactionResponse>
  ): Promise<ethers.TransactionReceipt> {
    const maxAttempts = this.maxTxRetries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const tx = await sendTx();
        const receipt = await tx.wait();

        if (!receipt) {
          throw new Error(`No receipt returned for ${operation}`);
        }

        return receipt;
      } catch (err) {
        lastError = err;

        if (attempt >= maxAttempts) {
          break;
        }

        const retryDelay = this.computeBackoffDelayMs(attempt);
        console.warn(
          `${operation} failed on attempt ${attempt}/${maxAttempts}. Retrying in ${retryDelay}ms: ${this.errorMessage(err)}`
        );
        await this.sleep(retryDelay);
      }
    }

    throw new Error(`${operation} failed after ${maxAttempts} attempts: ${this.errorMessage(lastError)}`);
  }

  private async storeChainMetadata(
    keyPrefix: string,
    cid: string | undefined,
    receipt: ethers.TransactionReceipt
  ) {
    const updatedAt = new Date().toISOString();

    const updates: Record<string, string> = {
      [`${keyPrefix}:txhash`]: receipt.hash,
      [`${keyPrefix}:block`]: receipt.blockNumber.toString(),
      [`${keyPrefix}:isOnChain`]: "true",
      [`${keyPrefix}:blockchainHash`]: receipt.hash,
      [`${keyPrefix}:blockchainBlock`]: receipt.blockNumber.toString(),
      [`${keyPrefix}:updatedAt`]: updatedAt,
    };

    if (cid) {
      updates[`${keyPrefix}:cid`] = cid;
      updates[`${keyPrefix}:ipfsHash`] = cid;
    }

    await this.redis.mset(updates);

    const metadata = this.buildMetadataPayload(
      keyPrefix,
      receipt.hash,
      receipt.blockNumber,
      cid,
      updatedAt
    );

    await this.redis.rpush(this.metadataSyncQueueName, JSON.stringify(metadata));
    await this.syncMetadataToBackend(metadata);
  }

  private buildMetadataPayload(
    keyPrefix: string,
    txHash: string,
    blockNumber: number,
    cid: string | undefined,
    updatedAt: string
  ): ChainMetadataPayload {
    const [entityType, ...entityParts] = keyPrefix.split(":");

    return {
      entityType,
      entityId: entityParts.join(":"),
      keyPrefix,
      blockchainHash: txHash,
      blockchainBlock: blockNumber,
      ipfsHash: cid,
      isOnChain: true,
      updatedAt,
    };
  }

  private async syncMetadataToBackend(metadata: ChainMetadataPayload) {
    if (!this.backendSyncUrl) {
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.backendSyncToken) {
        headers.Authorization = `Bearer ${this.backendSyncToken}`;
      }

      await axios.post(this.backendSyncUrl, metadata, {
        headers,
        timeout: 5000,
      });
    } catch (err) {
      console.error("Backend metadata sync failed:", this.errorMessage(err));
    }
  }

  private async claimMessage(queueName: string, processingQueueName: string): Promise<string | null> {
    return this.redis.rpoplpush(queueName, processingQueueName);
  }

  private async ackMessage(processingQueueName: string, rawMessage: string): Promise<void> {
    await this.redis.lrem(processingQueueName, 1, rawMessage);
  }

  private async handleQueueFailure(
    queueName: string,
    processingQueueName: string,
    dlqQueueName: string,
    rawMessage: string,
    parsedPayload: unknown,
    err: unknown
  ): Promise<void> {
    const nextRetry = this.extractRetryCount(parsedPayload) + 1;
    const message = this.errorMessage(err);
    const payload = this.createRetryPayload(parsedPayload, rawMessage, nextRetry, message);

    if (nextRetry > this.maxQueueRetries) {
      await this.redis.rpush(
        dlqQueueName,
        JSON.stringify({
          ...payload,
          sourceQueue: queueName,
          failedAt: new Date().toISOString(),
        })
      );
      await this.ackMessage(processingQueueName, rawMessage);
      console.error(`Message moved to DLQ ${dlqQueueName}: ${message}`);
      return;
    }

    const retryDelay = this.computeBackoffDelayMs(nextRetry);
    console.warn(
      `Queue processing failed for ${queueName}. Retrying in ${retryDelay}ms (attempt ${nextRetry}/${this.maxQueueRetries}): ${message}`
    );

    await this.sleep(retryDelay);
    await this.redis.rpush(queueName, JSON.stringify(payload));
    await this.ackMessage(processingQueueName, rawMessage);
  }

  private createRetryPayload(
    parsedPayload: unknown,
    rawMessage: string,
    retryCount: number,
    errorMessage: string
  ): Record<string, unknown> {
    const base =
      parsedPayload && typeof parsedPayload === "object" && !Array.isArray(parsedPayload)
        ? { ...(parsedPayload as Record<string, unknown>) }
        : { rawPayload: rawMessage };

    return {
      ...base,
      retryCount,
      lastError: errorMessage,
      lastTriedAt: new Date().toISOString(),
    };
  }

  private validateUserPayload(data: UserQueueData) {
    if (!data.id) {
      throw new Error("User payload is missing id");
    }
    if (!data.name) {
      throw new Error(`User payload is missing name for id ${data.id}`);
    }
    if (!data.email) {
      throw new Error(`User payload is missing email for id ${data.id}`);
    }
    if (!data.location) {
      throw new Error(`User payload is missing location for id ${data.id}`);
    }
  }

  private toBytes32(value: string | undefined, fallbackInput: string): string {
    if (value && /^0x[0-9a-fA-F]{64}$/.test(value)) {
      return value;
    }

    const source = value && value.length > 0 ? value : fallbackInput;
    if (!source || source.length === 0) {
      return ethers.ZeroHash;
    }

    return ethers.keccak256(ethers.toUtf8Bytes(source));
  }

  private toBytes(value: string): string {
    if (ethers.isHexString(value)) {
      return value;
    }

    return ethers.hexlify(ethers.toUtf8Bytes(value));
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
      throw new Error(`Invalid unix time value: ${value}`);
    }

    return BigInt(Math.floor(parsedDate / 1000));
  }

  private normalizeString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
  }

  private extractRetryCount(payload: unknown): number {
    if (!payload || typeof payload !== "object") {
      return 0;
    }

    const value = (payload as Record<string, unknown>).retryCount;
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  private computeBackoffDelayMs(attempt: number): number {
    const exponentialDelay = Math.min(
      this.baseRetryDelayMs * Math.pow(2, Math.max(0, attempt - 1)),
      this.maxRetryDelayMs
    );

    const jitter = Math.floor(Math.random() * 250);
    return exponentialDelay + jitter;
  }

  private parseIntEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) {
      return fallback;
    }

    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  private requireEnv(name: string): string {
    const value = process.env[name];
    if (!value || value.trim().length === 0) {
      throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
  }

  private errorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }

    return String(err);
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const worker = new BlockchainWorker();
worker.start().catch((err) => {
  console.error("Worker failed to start", err);
  process.exit(1);
});
