# Blockchain Features — Suggestions for iit-test

This document contains a curated list of blockchain features that make sense for the civic complaint system in the repository. Use this to brief your blockchain engineer or to plan implementation.

---

## Overview

These features are prioritized by business value and implementation effort. They are chosen to directly improve transparency, immutability, and citizen trust in the complaint system.

---

## Tier 1 — High Impact, Directly Solves Problems

1. On-Chain Status Audit Trail
   - Problem: Admins can change complaint status without an immutable record.
   - How: Record every status change as a blockchain transaction. Store who changed it, when, and old/new status.
   - Value: Citizens can verify the full, tamper-proof history.

2. SLA Breach Recording
   - Problem: `sla` exists in DB but isn’t enforced or visible publicly.
   - How: Smart contract records SLA expectations and emits an `SLA_BREACHED` event when breached.
   - Value: Public accountability for departments.

3. Duplicate Detection via Merkle Proof
   - Problem: `isDuplicate` is AI-based and not transparent.
   - How: Use on-chain detection or commit similarity hashes; record decisions on-chain for transparency.
   - Value: Citizens can verify duplicate determinations.

4. Agent Performance Score on Chain
   - Problem: Agent workload exists in DB but not an immutable performance record.
   - How: Record resolved complaint events per agent on-chain to build a public performance record.
   - Value: Objective, verifiable agent track record.

---

## Tier 2 — Strong Features, Moderate Effort

5. Upvote Integrity via Blockchain
   - Problem: `upvoteCount` is in DB and subject to manipulation.
   - How: Use on-chain upvotes (one per wallet / identity) enforced by smart contract.
   - Value: Tamper-proof community prioritization.

6. Whistleblower Complaints (Zero-Knowledge)
   - Problem: Sensitive complaints require anonymity.
   - How: Allow anonymous wallet-signed submissions or encrypt data before IPFS upload.
   - Value: Increased participation for sensitive issues.

7. Resolution NFT / Certificate
   - Problem: No tangible recognition for citizens who file or confirm resolutions.
   - How: Mint a non-transferable SBT (soulbound token) upon confirmed resolution.
   - Value: Recognition and incentive to use the platform.

8. Escalation Trail
   - Problem: Escalations are not visible to citizens.
   - How: Record each escalation event (reason, from, to) on-chain.
   - Value: Clear, immutable escalation history.

---

## Tier 3 — Interesting, Lower Priority

9. Decentralized Voting on Civic Priorities
   - How: Citizens stake or use tokens to vote on priority issues.
   - Value: Transparent civic prioritization.

10. Cross-Department Corruption Detection
    - How: Flag complaints that are repeatedly reassigned; record reassignment events on-chain.
    - Value: Publicly visible sign of process abuse.

11. Complaint Hash as Public Verification Code
    - How: Provide printable/SMS-able blockchain TX hash; officers can verify in-person.
    - Value: Trust-building for offline verification.

12. Batch Weekly Merkle Commitments
    - How: Batch multiple complaints into one Merkle root and write that single root on-chain.
    - Value: Huge gas savings on mainnet while keeping verifiability via proofs.

---

## Summary by Business Value (short)

- Highest value: On-Chain Status Audit Trail, SLA Breach Recording, Escalation Trail.
- Important integrity features: Upvote Integrity, Duplicate Detection, Agent Performance on Chain.
- Scaling & cost control: Merkle batching, IPFS pinning, Layer 2 rollups.

---

## Quick Recommendations

1. Start with: On-Chain Status Audit Trail + SLA Breach Recording + Escalation Trail.
2. Use IPFS (public) for complaint payloads; store CID on-chain and tx hash in DB.
3. Use Sepolia for development; plan Layer 2 (Polygon/Arbitrum) for production to reduce gas costs.
4. Consider batching (Merkle roots) if moving to mainnet to save costs.

---

## Notes for the Engineer

- Provide Solidity contract with `registerComplaint`, `updateStatus`, `getComplaint`, and relevant events.
- Build a `blockchain-worker` service to:
  - Pop `complaint:blockchain:queue` from Redis,
  - Upload JSON + image CIDs to IPFS,
  - Call smart contract and wait for confirmations,
  - Update DB with `blockchainHash`, `ipfsHash`, `isOnChain`.
- Pin IPFS data (Pinata/Infura) to ensure availability.
- Add DB migration to include `blockchainHash`, `ipfsHash`, `isOnChain`, and `blockchainBlock` fields.

---

*Document generated from assistant suggestions on additional blockchain features for the project.*
