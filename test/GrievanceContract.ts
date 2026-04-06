import { expect } from "chai";
import { ethers } from "hardhat";
import { GrievanceContractOptimized } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("GrievanceContractOptimized", function () {
  let contract: GrievanceContractOptimized;
  let owner: HardhatEthersSigner;
  let citizen: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, citizen] = await ethers.getSigners();
    
    const GrievanceContractOptimized = await ethers.getContractFactory("GrievanceContractOptimized");
    contract = await GrievanceContractOptimized.deploy();
    await contract.waitForDeployment();
  });

  describe("Register Complaint", function () {
    it("Should register a new complaint with location data", async function () {
      const complaintId = "COMP-001";
      const complainantId = citizen.address;
      const categoryId = "PWD";
      const subCategory = "Road Repair";
      const department = "DEPT-PWD";
      const urgency = 2; // MEDIUM (valid: 1, 2, 3, 4)
      const descHash = ethers.id("complaint description");
      const attachHash = ethers.id("attachment");
      const locationHash = ethers.id("lat,lng");
      const pin = "560001";
      const district = "Bangalore";
      const city = "Bangalore";
      const locality = "Indiranagar";
      const state = "Karnataka";

      await contract.registerComplaint(
        complaintId,
        complainantId,
        categoryId,
        subCategory,
        department,
        urgency,
        descHash,
        attachHash,
        locationHash,
        true,
        pin,
        district,
        city,
        locality,
        state
      );

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.urgencyLevel).to.equal(urgency);
      expect(complaint.statusCode).to.equal(1); // REGISTERED
      expect(complaint.isPublic).to.be.true;
    });

    it("Should not allow duplicate complaint IDs", async function () {
      const complaintId = "COMP-002";
      const baseParams = [
        complaintId,
        citizen.address,
        "CAT1",
        "SubCat1",
        "DEPT1",
        1, // urgency between 1-4
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "123456",
        "District",
        "City",
        "Locality",
        "State"
      ] as const;

      await contract.registerComplaint(...baseParams);

      await expect(
        contract.registerComplaint(...baseParams)
      ).to.be.revertedWith("Complaint already exists");
    });

    it("Should reject invalid urgency levels", async function () {
      const complaintId = "COMP-003";
      
      await expect(
        contract.registerComplaint(
          complaintId,
          citizen.address,
          "PWD",
          "Pothole",
          "DEPT-PWD",
          0, // Invalid urgency (must be 1-4)
          ethers.id("desc"),
          ethers.id("attach"),
          ethers.id("loc"),
          true,
          "560001",
          "Bangalore",
          "Bangalore",
          "MG Road",
          "Karnataka"
        )
      ).to.be.revertedWith("Invalid urgency");
    });
  });

  describe("Anonymous Complaints", function () {
    it("Should register anonymous complaint", async function () {
      const complaintId = "ANON-001";
      const identityCommitment = ethers.id("secret-identity");

      await contract.registerAnonymousComplaint(
        complaintId,
        identityCommitment,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("description"),
        ethers.id("attachment"),
        ethers.id("location"),
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.urgencyLevel).to.equal(2);
      expect(complaint.statusCode).to.equal(1); // REGISTERED
      expect(complaint.isPublic).to.be.false;
    });

    it("Should not allow duplicate anonymous complaint IDs", async function () {
      const complaintId = "ANON-002";
      const identityCommitment = ethers.id("secret-identity");

      await contract.registerAnonymousComplaint(
        complaintId,
        identityCommitment,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("description"),
        ethers.id("attachment"),
        ethers.id("location"),
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      await expect(
        contract.registerAnonymousComplaint(
          complaintId,
          identityCommitment,
          "PWD",
          "Pothole",
          "DEPT-PWD",
          1,
          ethers.id("description"),
          ethers.id("attachment"),
          ethers.id("location"),
          "560001",
          "Bangalore",
          "Bangalore",
          "MG Road",
          "Karnataka"
        )
      ).to.be.revertedWith("Complaint already exists");
    });
  });

  describe("Assign Complaint", function () {
    beforeEach(async function () {
      await contract.registerComplaint(
        "COMP-005",
        citizen.address,
        "EDU",
        "School Infrastructure",
        "DEPT-EDU",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "Yeshwantpur",
        "Karnataka"
      );
    });

    it("Should assign complaint to department", async function () {
      const departmentId = "DEPT-PWD-001";
      
      await contract.assignComplaint("COMP-005", departmentId);
      
      const complaint = await contract.getComplaint("COMP-005");
      expect(complaint.statusCode).to.equal(2); // PROCESSING
    });

    it("Should emit ComplaintAssigned event", async function () {
      await expect(contract.assignComplaint("COMP-005", "DEPT-HEALTH"))
        .to.emit(contract, "ComplaintAssigned");
    });

    it("Should revert for non-existent complaint", async function () {
      await expect(
        contract.assignComplaint("COMP-NONEXISTENT", "DEPT-PWD")
      ).to.be.revertedWith("Complaint does not exist");
    });
  });

  describe("Resolve Complaint", function () {
    beforeEach(async function () {
      await contract.registerComplaint(
        "COMP-006",
        citizen.address,
        "TRN",
        "Bus Service",
        "DEPT-TRN",
        3,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "Whitefield",
        "Karnataka"
      );
      
      // First assign it to move status from 1 (REGISTERED) to 2 (PROCESSING)
      await contract.assignComplaint("COMP-006", "DEPT-TRN");
    });

    it("Should resolve complaint", async function () {
      await contract.resolveComplaint("COMP-006");
      
      const complaint = await contract.getComplaint("COMP-006");
      expect(complaint.statusCode).to.equal(5); // COMPLETED
    });

    it("Should emit ComplaintResolved event", async function () {
      await expect(contract.resolveComplaint("COMP-006"))
        .to.emit(contract, "ComplaintResolved");
    });

    it("Should revert for non-existent complaint", async function () {
      await expect(
        contract.resolveComplaint("COMP-NONEXISTENT")
      ).to.be.revertedWith("Complaint does not exist");
    });
  });

  describe("SLA & Escalation", function () {
    it("Should record complaint SLA", async function () {
      const complaintId = "COMP-SLA-001";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      const dueTimestamp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      await contract.recordComplaintSla(complaintId, dueTimestamp, "7-day SLA");

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.statusCode).to.equal(1); // Status unchanged
    });

    it("Should escalate complaint with new status", async function () {
      const complaintId = "COMP-ESC-001";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      // Status 7 = ESCALATED
      await contract.escalateComplaint(complaintId, 7, "SLA breach");

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.statusCode).to.equal(7);
    });

    it("Should mark SLA as breached", async function () {
      const complaintId = "COMP-SLA-BREACH";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      const pastTime = Math.floor(Date.now() / 1000) - 1;
      await contract.recordComplaintSla(complaintId, pastTime, "already overdue");
      
      await contract.markComplaintSlaBreached(complaintId, "Breach confirmed");
      
      const sla = await contract.getComplaintSla(complaintId);
      expect(sla.breached).to.be.true;
    });
  });

  describe("Upvotes & Integrity", function () {
    it("Should record upvote on complaint", async function () {
      const complaintId = "COMP-UPVOTE-001";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      await contract.upvoteComplaint(complaintId);

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.upvoteCount).to.equal(1);
    });

    it("Should prevent duplicate upvotes from same address", async function () {
      const complaintId = "COMP-UPVOTE-002";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      await contract.upvoteComplaint(complaintId);

      await expect(
        contract.upvoteComplaint(complaintId)
      ).to.be.revertedWith("Already upvoted");
    });

    it("Should track upvote count correctly", async function () {
      const complaintId = "COMP-UPVOTE-003";
      const [owner, addr1, addr2] = await ethers.getSigners();
      
      await contract.registerComplaint(
        complaintId,
        owner.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      await contract.upvoteComplaint(complaintId);
      await contract.connect(addr1).upvoteComplaint(complaintId);
      await contract.connect(addr2).upvoteComplaint(complaintId);

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.upvoteCount).to.equal(3);
    });
  });

  describe("Duplicate Assessment & Agent Performance", function () {
    it("Should record duplicate assessment with merkle proof", async function () {
      const complaintId = "COMP-DUP-001";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      const leafHash = ethers.id("complaint-leaf");
      // Simple merkle root (for testing: just the leaf hash itself)
      const merkleRoot = leafHash;
      const proof: string[] = [];

      await contract.recordDuplicateAssessment(
        complaintId,
        leafHash,
        merkleRoot,
        proof,
        true
      );

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.statusCode).to.equal(1); // Status unchanged
    });

    it("Should record agent performance on complaint", async function () {
      const complaintId = "COMP-AGENT-001";
      const agentId = "AGENT-001";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        2,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      // Record agent performance when complaint is COMPLETED (statusCode 5)
      // First resolve the complaint
      await contract.assignComplaint(complaintId, "DEPT-PWD");
      await contract.resolveComplaint(complaintId);
      
      // Now record performance with outcome status 5 (COMPLETED)
      await contract.recordAgentPerformance(agentId, complaintId, 5, 10);

      const complaint = await contract.getComplaint(complaintId);
      expect(complaint.statusCode).to.equal(5); // COMPLETED
    });
  });

  describe("Query Functions", function () {
    it("Should get complaint count", async function () {
      await contract.registerComplaint(
        "C1",
        citizen.address,
        "CAT1",
        "Sub1",
        "DEPT1",
        1,
        ethers.id("h1"),
        ethers.id("h2"),
        ethers.id("loc1"),
        true,
        "123456",
        "D1",
        "C1",
        "L1",
        "S1"
      );
      
      await contract.registerComplaint(
        "C2",
        citizen.address,
        "CAT2",
        "Sub2",
        "DEPT2",
        2,
        ethers.id("h3"),
        ethers.id("h4"),
        ethers.id("loc2"),
        true,
        "654321",
        "D2",
        "C2",
        "L2",
        "S2"
      );
      
      const count = await contract.totalComplaints();
      expect(count).to.equal(2);
    });

    it("Should verify complaint hash", async function () {
      const descHash = ethers.id("unique-complaint-description");
      
      await contract.registerComplaint(
        "C-HASH",
        citizen.address,
        "CAT",
        "Sub",
        "DEPT",
        3,
        descHash,
        ethers.id("h2"),
        ethers.id("loc"),
        true,
        "123456",
        "D",
        "C",
        "L",
        "S"
      );
      
      const isValid = await contract.verifyHash("C-HASH", descHash);
      expect(isValid).to.be.true;
    });

    it("Should get complaint status history", async function () {
      const complaintId = "COMP-HISTORY";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );
      
      // Now assign and escalate to create history
      await contract.assignComplaint(complaintId, "DEPT-PWD");
      await contract.escalateComplaint(complaintId, 7, "urgent");
      
      const history = await contract.getComplaintStatusHistory(complaintId);
      expect(history.length).to.be.greaterThan(0);
    });

    it("Should get complaint escalation history", async function () {
      const complaintId = "COMP-ESC-HISTORY";
      
      await contract.registerComplaint(
        complaintId,
        citizen.address,
        "PWD",
        "Pothole",
        "DEPT-PWD",
        1,
        ethers.id("desc"),
        ethers.id("attach"),
        ethers.id("loc"),
        true,
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );
      
      await contract.escalateComplaint(complaintId, 7, "urgent");
      await contract.escalateComplaint(complaintId, 8, "critical");
      
      const escalations = await contract.getComplaintEscalationHistory(complaintId);
      expect(escalations.length).to.equal(2);
    });
  });

  describe("User Management", function () {
    it("Should register a user", async function () {
      const userId = "USER-001";
      const name = "John Doe";
      const role = "citizen";
      
      await contract.registerUser(
        userId,
        name,
        role,
        ethers.id("email@example.com"),
        ethers.id("aadhaar-123"),
        ethers.id("location-hash"),
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      );

      const user = await contract.getUser(userId);
      expect(user.isActive).to.be.true;
    });

    it("Should not allow duplicate user registration", async function () {
      const userId = "USER-002";
      const params = [
        userId,
        "John Doe",
        "citizen",
        ethers.id("email@example.com"),
        ethers.id("aadhaar-123"),
        ethers.id("location-hash"),
        "560001",
        "Bangalore",
        "Bangalore",
        "MG Road",
        "Karnataka"
      ] as const;

      await contract.registerUser(...params);

      await expect(
        contract.registerUser(...params)
      ).to.be.revertedWith("User already exists");
    });
  });
});
