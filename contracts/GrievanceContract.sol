// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title GrievanceContractOptimized
 * @dev Gas-optimized version with reduced storage
 * Stores only critical data on-chain, full details in events
 */
contract GrievanceContractOptimized {
    
    // Location structure for users and complaints
    struct Location {
        string pin;             // PIN code
        string district;        // District name
        string city;            // City name
        string state;           // State name
        string municipal;       // Municipal area (for users)
        string locality;        // Locality name
    }
    
    // Simplified User structure
    struct User {
        bytes32 emailHash;      // 32 bytes
        bytes32 aadhaarHash;    // 32 bytes
        bytes32 locationHash;   // 32 bytes - hash of location for verification
        uint64 registrationDate; // 8 bytes
        bool isActive;          // 1 byte
    }
    
    // Simplified Complaint structure
    struct Complaint {
        bytes32 complainantIdHash;  // Hash of complainant ID
        bytes32 descriptionHash;    // Hash of description
        bytes32 attachmentHash;     // Hash of attachment
        bytes32 locationHash;       // Hash of location for verification
        uint64 submissionDate;      // 8 bytes
        uint64 lastUpdated;         // 8 bytes
        uint32 upvoteCount;         // 4 bytes
        uint8 urgencyLevel;         // 1=LOW, 2=MEDIUM, 3=HIGH, 4=CRITICAL
        uint8 statusCode;           // 1=REGISTERED, 2=PROCESSING, 3=COMPLETED, etc.
        bool isPublic;              // 1 byte
    }

    struct StatusAuditEntry {
        uint8 oldStatus;
        uint8 newStatus;
        uint64 changedAt;
        address changedBy;
        bytes32 reasonHash;
    }

    struct SlaRecord {
        uint64 expectedBy;
        uint64 recordedAt;
        uint64 breachedAt;
        bool breached;
        bytes32 noteHash;
    }

    struct EscalationRecord {
        uint8 fromStatus;
        uint8 toStatus;
        uint64 escalatedAt;
        address escalatedBy;
        bytes32 reasonHash;
    }

    struct DuplicateAssessment {
        bytes32 leafHash;
        bytes32 merkleRoot;
        bool isDuplicate;
        uint64 assessedAt;
        address assessedBy;
    }

    struct AgentPerformance {
        uint32 resolvedCount;
        uint32 escalatedCount;
        uint32 duplicateFlags;
        uint32 score;
        uint64 lastUpdated;
    }

    struct CivicPriority {
        bytes32 creatorHash;
        uint64 createdAt;
        uint64 endsAt;
        uint32 voteCount;
        bool active;
    }

    struct MerkleCommitment {
        bytes32 root;
        uint64 committedAt;
        uint32 itemCount;
        bytes32 batchLabelHash;
    }
    
    // Mappings - using bytes32 for gas efficiency
    mapping(bytes32 => User) public users;
    mapping(bytes32 => Complaint) public complaints;
    mapping(bytes32 => bool) public userExists;
    mapping(bytes32 => bool) public complaintExists;
    mapping(bytes32 => StatusAuditEntry[]) private complaintStatusHistory;
    mapping(bytes32 => SlaRecord) private complaintSlaRecords;
    mapping(bytes32 => EscalationRecord[]) private complaintEscalationHistory;
    mapping(bytes32 => DuplicateAssessment) private complaintDuplicateAssessments;
    mapping(bytes32 => mapping(address => bool)) private complaintUpvoters;
    mapping(bytes32 => uint32) private complaintReassignmentCounts;
    mapping(bytes32 => bytes32) private complaintDepartmentHashes;
    mapping(bytes32 => bool) private resolutionCertificatesIssued;
    mapping(bytes32 => AgentPerformance) private agentPerformanceRecords;
    mapping(bytes32 => CivicPriority) private civicPriorityRecords;
    mapping(bytes32 => mapping(address => bool)) private civicPriorityVotes;
    mapping(uint256 => MerkleCommitment) private merkleCommitments;
    
    // Counters
    uint256 public totalUsers;
    uint256 public totalComplaints;
    uint256 public totalAuditLogs;
    uint256 public totalMerkleBatches;
    
    // Events store full data (cheaper than storage)
    event UserRegistered(
        string indexed userId,
        string name,
        string role,
        bytes32 emailHash,
        bytes32 aadhaarHash,
        bytes32 locationHash,
        uint256 timestamp
    );
    
    // Separate event for full location details (gas efficient - stored in logs)
    event UserLocationStored(
        string indexed userId,
        string pin,
        string district,
        string city,
        string state,
        string municipal,
        uint256 timestamp
    );
    
    event ComplaintRegistered(
        string indexed complaintId,
        string indexed complainantId,
        string categoryId,
        string subCategory,
        string department,
        uint8 urgency,
        bytes32 descriptionHash,
        bytes32 attachmentHash,
        bytes32 locationHash,
        bool isPublic,
        uint256 timestamp
    );
    
    // Separate event for complaint location details
    event ComplaintLocationStored(
        string indexed complaintId,
        string pin,
        string district,
        string city,
        string locality,
        string state,
        uint256 timestamp
    );
    
    event ComplaintStatusUpdated(
        string indexed complaintId,
        uint8 oldStatus,
        uint8 newStatus,
        string statusName,
        uint256 timestamp
    );

    event ComplaintStatusAudited(
        string indexed complaintId,
        uint8 oldStatus,
        uint8 newStatus,
        address indexed changedBy,
        bytes32 reasonHash,
        uint256 timestamp
    );

    event ComplaintSlaRecorded(
        string indexed complaintId,
        uint64 expectedBy,
        bytes32 noteHash,
        uint256 timestamp
    );

    event ComplaintSlaBreached(
        string indexed complaintId,
        uint64 expectedBy,
        uint64 breachedAt,
        bytes32 noteHash,
        uint256 timestamp
    );

    event ComplaintEscalated(
        string indexed complaintId,
        uint8 fromStatus,
        uint8 toStatus,
        address indexed escalatedBy,
        bytes32 reasonHash,
        uint256 timestamp
    );

    event AnonymousComplaintRegistered(
        string indexed complaintId,
        bytes32 commitmentHash,
        bytes32 metadataHash,
        uint256 timestamp
    );

    event DuplicateAssessmentRecorded(
        string indexed complaintId,
        bytes32 leafHash,
        bytes32 merkleRoot,
        bool isDuplicate,
        uint256 timestamp
    );

    event ComplaintUpvoted(
        string indexed complaintId,
        address indexed voter,
        uint32 newCount,
        uint256 timestamp
    );

    event AgentPerformanceRecorded(
        string indexed agentId,
        string indexed complaintId,
        uint32 resolvedCount,
        uint32 escalatedCount,
        uint32 duplicateFlags,
        uint32 score,
        uint256 timestamp
    );

    event CivicPriorityCreated(
        string indexed priorityId,
        bytes32 creatorHash,
        uint64 endsAt,
        uint256 timestamp
    );

    event CivicPriorityVoted(
        string indexed priorityId,
        address indexed voter,
        uint32 voteCount,
        uint256 timestamp
    );

    event CrossDepartmentCorruptionFlagged(
        string indexed complaintId,
        uint32 reassignmentCount,
        bytes32 departmentHash,
        uint256 timestamp
    );

    event ResolutionCertificateIssued(
        string indexed complaintId,
        string indexed recipientId,
        bytes32 certificateHash,
        uint256 timestamp
    );

    event ComplaintVerificationCodeCreated(
        string indexed complaintId,
        bytes32 verificationCode,
        uint256 timestamp
    );

    event MerkleBatchCommitted(
        uint256 indexed batchId,
        bytes32 root,
        bytes32 batchLabelHash,
        uint32 itemCount,
        uint256 timestamp
    );
    
    event ComplaintAssigned(
        string indexed complaintId,
        string assignedTo,
        uint256 timestamp
    );
    
    event ComplaintResolved(
        string indexed complaintId,
        uint256 timestamp
    );
    
    event AuditLogCreated(
        string indexed logId,
        string action,
        string userId,
        string complaintId,
        string details,
        uint256 timestamp
    );
    
    event UpvoteAdded(
        string indexed complaintId,
        uint32 newCount,
        uint256 timestamp
    );
    
    /**
     * @dev Register a new user with location
     * Full details in event, only hashes stored
     */
    function registerUser(
        string calldata _userId,
        string calldata _name,
        string calldata _role,
        bytes32 _emailHash,
        bytes32 _aadhaarHash,
        bytes32 _locationHash,
        string calldata _pin,
        string calldata _district,
        string calldata _city,
        string calldata _state,
        string calldata _municipal
    ) external {
        bytes32 userIdHash = keccak256(bytes(_userId));
        require(!userExists[userIdHash], "User already exists");
        
        users[userIdHash] = User({
            emailHash: _emailHash,
            aadhaarHash: _aadhaarHash,
            locationHash: _locationHash,
            registrationDate: uint64(block.timestamp),
            isActive: true
        });
        
        userExists[userIdHash] = true;
        totalUsers++;
        
        emit UserRegistered(
            _userId,
            _name,
            _role,
            _emailHash,
            _aadhaarHash,
            _locationHash,
            block.timestamp
        );
        
        // Emit location details separately
        emit UserLocationStored(
            _userId,
            _pin,
            _district,
            _city,
            _state,
            _municipal,
            block.timestamp
        );
    }
    
    /**
     * @dev Register a new complaint with location
     */
    function registerComplaint(
        string calldata _complaintId,
        string calldata _complainantId,
        string calldata _categoryId,
        string calldata _subCategory,
        string calldata _department,
        uint8 _urgency,
        bytes32 _descriptionHash,
        bytes32 _attachmentHash,
        bytes32 _locationHash,
        bool _isPublic,
        string calldata _pin,
        string calldata _district,
        string calldata _city,
        string calldata _locality,
        string calldata _state
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(!complaintExists[complaintIdHash], "Complaint already exists");
        require(_urgency >= 1 && _urgency <= 4, "Invalid urgency");
        
        complaints[complaintIdHash] = Complaint({
            complainantIdHash: keccak256(bytes(_complainantId)),
            descriptionHash: _descriptionHash,
            attachmentHash: _attachmentHash,
            locationHash: _locationHash,
            submissionDate: uint64(block.timestamp),
            lastUpdated: uint64(block.timestamp),
            upvoteCount: 0,
            urgencyLevel: _urgency,
            statusCode: 1, // REGISTERED
            isPublic: _isPublic
        });
        
        complaintExists[complaintIdHash] = true;
        totalComplaints++;

        _appendStatusHistory(
            complaintIdHash,
            0,
            1,
            keccak256(bytes("REGISTERED"))
        );
        
        emit ComplaintRegistered(
            _complaintId,
            _complainantId,
            _categoryId,
            _subCategory,
            _department,
            _urgency,
            _descriptionHash,
            _attachmentHash,
            _locationHash,
            _isPublic,
            block.timestamp
        );
        
        // Emit location details separately
        emit ComplaintLocationStored(
            _complaintId,
            _pin,
            _district,
            _city,
            _locality,
            _state,
            block.timestamp
        );
    }

    function registerAnonymousComplaint(
        string calldata _complaintId,
        bytes32 _identityCommitment,
        string calldata _categoryId,
        string calldata _subCategory,
        string calldata _department,
        uint8 _urgency,
        bytes32 _descriptionHash,
        bytes32 _attachmentHash,
        bytes32 _locationHash,
        string calldata _pin,
        string calldata _district,
        string calldata _city,
        string calldata _locality,
        string calldata _state
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(!complaintExists[complaintIdHash], "Complaint already exists");
        require(_urgency >= 1 && _urgency <= 4, "Invalid urgency");

        complaints[complaintIdHash] = Complaint({
            complainantIdHash: _identityCommitment,
            descriptionHash: _descriptionHash,
            attachmentHash: _attachmentHash,
            locationHash: _locationHash,
            submissionDate: uint64(block.timestamp),
            lastUpdated: uint64(block.timestamp),
            upvoteCount: 0,
            urgencyLevel: _urgency,
            statusCode: 1,
            isPublic: false
        });

        complaintExists[complaintIdHash] = true;
        totalComplaints++;

        _appendStatusHistory(
            complaintIdHash,
            0,
            1,
            keccak256(bytes("ANONYMOUS_REGISTERED"))
        );

        emit AnonymousComplaintRegistered(
            _complaintId,
            _identityCommitment,
            _descriptionHash,
            block.timestamp
        );

        emit ComplaintRegistered(
            _complaintId,
            "ANONYMOUS",
            _categoryId,
            _subCategory,
            _department,
            _urgency,
            _descriptionHash,
            _attachmentHash,
            _locationHash,
            false,
            block.timestamp
        );

        emit ComplaintLocationStored(
            _complaintId,
            _pin,
            _district,
            _city,
            _locality,
            _state,
            block.timestamp
        );
    }
    
    /**
     * @dev Update complaint status
     */
    function updateComplaintStatus(
        string calldata _complaintId,
        uint8 _newStatus,
        string calldata _statusName
    ) external {
        _updateComplaintStatus(_complaintId, _newStatus, _statusName, string(""));
    }

    function updateComplaintStatusWithReason(
        string calldata _complaintId,
        uint8 _newStatus,
        string calldata _statusName,
        string calldata _reason
    ) external {
        _updateComplaintStatus(_complaintId, _newStatus, _statusName, _reason);
    }

    function _updateComplaintStatus(
        string calldata _complaintId,
        uint8 _newStatus,
        string calldata _statusName,
        string memory _reason
    ) internal {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(_newStatus >= 1 && _newStatus <= 9, "Invalid status");
        
        Complaint storage complaint = complaints[complaintIdHash];
        uint8 oldStatus = complaint.statusCode;
        bytes32 reasonHash = bytes(_reason).length == 0
            ? keccak256(bytes(_statusName))
            : keccak256(bytes(_reason));
        
        complaint.statusCode = _newStatus;
        complaint.lastUpdated = uint64(block.timestamp);

        _appendStatusHistory(complaintIdHash, oldStatus, _newStatus, reasonHash);
        
        emit ComplaintStatusUpdated(
            _complaintId,
            oldStatus,
            _newStatus,
            _statusName,
            block.timestamp
        );

        emit ComplaintStatusAudited(
            _complaintId,
            oldStatus,
            _newStatus,
            msg.sender,
            reasonHash,
            block.timestamp
        );
    }

    function recordComplaintSla(
        string calldata _complaintId,
        uint64 _expectedBy,
        string calldata _note
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(_expectedBy > 0, "Invalid SLA deadline");

        complaintSlaRecords[complaintIdHash] = SlaRecord({
            expectedBy: _expectedBy,
            recordedAt: uint64(block.timestamp),
            breachedAt: 0,
            breached: false,
            noteHash: keccak256(bytes(_note))
        });

        emit ComplaintSlaRecorded(
            _complaintId,
            _expectedBy,
            keccak256(bytes(_note)),
            block.timestamp
        );
    }

    function markComplaintSlaBreached(
        string calldata _complaintId,
        string calldata _note
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");

        SlaRecord storage slaRecord = complaintSlaRecords[complaintIdHash];
        require(slaRecord.expectedBy > 0, "SLA not recorded");

        slaRecord.breached = true;
        slaRecord.breachedAt = uint64(block.timestamp);
        slaRecord.noteHash = keccak256(bytes(_note));

        emit ComplaintSlaBreached(
            _complaintId,
            slaRecord.expectedBy,
            slaRecord.breachedAt,
            slaRecord.noteHash,
            block.timestamp
        );
    }

    function escalateComplaint(
        string calldata _complaintId,
        uint8 _toStatus,
        string calldata _reason
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(_toStatus >= 1 && _toStatus <= 9, "Invalid status");

        Complaint storage complaint = complaints[complaintIdHash];
        uint8 fromStatus = complaint.statusCode;
        bytes32 reasonHash = keccak256(bytes(_reason));

        complaint.statusCode = _toStatus;
        complaint.lastUpdated = uint64(block.timestamp);

        complaintEscalationHistory[complaintIdHash].push(
            EscalationRecord({
                fromStatus: fromStatus,
                toStatus: _toStatus,
                escalatedAt: uint64(block.timestamp),
                escalatedBy: msg.sender,
                reasonHash: reasonHash
            })
        );

        _appendStatusHistory(complaintIdHash, fromStatus, _toStatus, reasonHash);

        emit ComplaintEscalated(
            _complaintId,
            fromStatus,
            _toStatus,
            msg.sender,
            reasonHash,
            block.timestamp
        );
    }
    
    /**
     * @dev Assign complaint
     */
    function assignComplaint(
        string calldata _complaintId,
        string calldata _assignedTo
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");

        bytes32 departmentHash = keccak256(bytes(_assignedTo));
        bytes32 previousDepartmentHash = complaintDepartmentHashes[complaintIdHash];
        complaintDepartmentHashes[complaintIdHash] = departmentHash;
        if (previousDepartmentHash != bytes32(0) && previousDepartmentHash != departmentHash) {
            complaintReassignmentCounts[complaintIdHash] += 1;
            if (complaintReassignmentCounts[complaintIdHash] >= 2) {
                emit CrossDepartmentCorruptionFlagged(
                    _complaintId,
                    complaintReassignmentCounts[complaintIdHash],
                    departmentHash,
                    block.timestamp
                );
            }
        }
        
        Complaint storage complaint = complaints[complaintIdHash];
        complaint.statusCode = 2; // UNDER_PROCESSING
        complaint.lastUpdated = uint64(block.timestamp);
        
        emit ComplaintAssigned(_complaintId, _assignedTo, block.timestamp);
    }
    
    /**
     * @dev Resolve complaint
     */
    function resolveComplaint(string calldata _complaintId) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        
        Complaint storage complaint = complaints[complaintIdHash];
        complaint.statusCode = 5; // COMPLETED
        complaint.lastUpdated = uint64(block.timestamp);
        
        _appendStatusHistory(
            complaintIdHash,
            2,
            5,
            keccak256(bytes("RESOLVED"))
        );
        
        emit ComplaintResolved(_complaintId, block.timestamp);
    }

    function upvoteComplaint(string calldata _complaintId) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(!complaintUpvoters[complaintIdHash][msg.sender], "Already upvoted");

        complaintUpvoters[complaintIdHash][msg.sender] = true;

        Complaint storage complaint = complaints[complaintIdHash];
        require(complaint.upvoteCount < type(uint32).max, "Upvote overflow");
        complaint.upvoteCount += 1;
        complaint.lastUpdated = uint64(block.timestamp);

        emit ComplaintUpvoted(
            _complaintId,
            msg.sender,
            complaint.upvoteCount,
            block.timestamp
        );

        emit UpvoteAdded(_complaintId, complaint.upvoteCount, block.timestamp);
    }

    function recordDuplicateAssessment(
        string calldata _complaintId,
        bytes32 _leafHash,
        bytes32 _merkleRoot,
        bytes32[] calldata _proof,
        bool _isDuplicate
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(verifyMerkleProof(_leafHash, _merkleRoot, _proof), "Invalid Merkle proof");

        complaintDuplicateAssessments[complaintIdHash] = DuplicateAssessment({
            leafHash: _leafHash,
            merkleRoot: _merkleRoot,
            isDuplicate: _isDuplicate,
            assessedAt: uint64(block.timestamp),
            assessedBy: msg.sender
        });

        emit DuplicateAssessmentRecorded(
            _complaintId,
            _leafHash,
            _merkleRoot,
            _isDuplicate,
            block.timestamp
        );
    }

    function recordAgentPerformance(
        string calldata _agentId,
        string calldata _complaintId,
        uint8 _outcomeStatus,
        uint32 _scoreDelta
    ) external {
        bytes32 agentIdHash = keccak256(bytes(_agentId));
        require(complaintExists[keccak256(bytes(_complaintId))], "Complaint does not exist");

        AgentPerformance storage performance = agentPerformanceRecords[agentIdHash];

        if (_outcomeStatus == 5) {
            performance.resolvedCount += 1;
        }
        if (_outcomeStatus == 7 || _outcomeStatus == 8) {
            performance.escalatedCount += 1;
        }
        if (_outcomeStatus == 6) {
            performance.duplicateFlags += 1;
        }

        performance.score += _scoreDelta;
        performance.lastUpdated = uint64(block.timestamp);

        emit AgentPerformanceRecorded(
            _agentId,
            _complaintId,
            performance.resolvedCount,
            performance.escalatedCount,
            performance.duplicateFlags,
            performance.score,
            block.timestamp
        );
    }

    function createCivicPriority(
        string calldata _priorityId,
        bytes32 _creatorHash,
        uint64 _endsAt
    ) external {
        bytes32 priorityHash = keccak256(bytes(_priorityId));
        require(!civicPriorityRecords[priorityHash].active, "Priority exists");
        require(_endsAt > block.timestamp, "Invalid end time");

        civicPriorityRecords[priorityHash] = CivicPriority({
            creatorHash: _creatorHash,
            createdAt: uint64(block.timestamp),
            endsAt: _endsAt,
            voteCount: 0,
            active: true
        });

        emit CivicPriorityCreated(_priorityId, _creatorHash, _endsAt, block.timestamp);
    }

    function voteCivicPriority(string calldata _priorityId) external {
        bytes32 priorityHash = keccak256(bytes(_priorityId));
        CivicPriority storage priority = civicPriorityRecords[priorityHash];
        require(priority.active, "Priority does not exist");
        require(block.timestamp <= priority.endsAt, "Voting ended");
        require(!civicPriorityVotes[priorityHash][msg.sender], "Already voted");

        civicPriorityVotes[priorityHash][msg.sender] = true;
        priority.voteCount += 1;

        emit CivicPriorityVoted(_priorityId, msg.sender, priority.voteCount, block.timestamp);
    }

    function issueResolutionCertificate(
        string calldata _complaintId,
        string calldata _recipientId
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        require(!resolutionCertificatesIssued[complaintIdHash], "Certificate already issued");

        Complaint storage complaint = complaints[complaintIdHash];
        require(complaint.statusCode == 5, "Complaint not resolved");

        resolutionCertificatesIssued[complaintIdHash] = true;

        bytes32 certificateHash = keccak256(
            abi.encodePacked(_complaintId, _recipientId, complaint.lastUpdated, block.timestamp)
        );

        emit ResolutionCertificateIssued(
            _complaintId,
            _recipientId,
            certificateHash,
            block.timestamp
        );
    }

    function getComplaintVerificationCode(string calldata _complaintId)
        external
        view
        returns (bytes32)
    {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");

        Complaint storage complaint = complaints[complaintIdHash];
        bytes32 verificationCode = keccak256(
            abi.encodePacked(
                _complaintId,
                complaint.complainantIdHash,
                complaint.descriptionHash,
                complaint.submissionDate,
                complaint.lastUpdated
            )
        );

        return verificationCode;
    }

    function commitMerkleBatch(
        bytes32 _root,
        uint32 _itemCount,
        string calldata _batchLabel
    ) external returns (uint256) {
        require(_root != bytes32(0), "Invalid root");
        require(_itemCount > 0, "Invalid item count");

        uint256 batchId = totalMerkleBatches + 1;
        merkleCommitments[batchId] = MerkleCommitment({
            root: _root,
            committedAt: uint64(block.timestamp),
            itemCount: _itemCount,
            batchLabelHash: keccak256(bytes(_batchLabel))
        });

        totalMerkleBatches++;

        emit MerkleBatchCommitted(
            batchId,
            _root,
            keccak256(bytes(_batchLabel)),
            _itemCount,
            block.timestamp
        );

        return batchId;
    }

    function verifyMerkleProof(
        bytes32 _leaf,
        bytes32 _root,
        bytes32[] calldata _proof
    ) public pure returns (bool) {
        bytes32 computedHash = _leaf;

        for (uint256 i = 0; i < _proof.length; i++) {
            bytes32 proofElement = _proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == _root;
    }
    
    /**
     * @dev Update upvote count
     */
    function updateUpvoteCount(
        string calldata _complaintId,
        uint32 _newCount
    ) external {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        
        complaints[complaintIdHash].upvoteCount = _newCount;
        complaints[complaintIdHash].lastUpdated = uint64(block.timestamp);
        
        emit UpvoteAdded(_complaintId, _newCount, block.timestamp);
    }
    
    /**
     * @dev Create audit log (only emits event, doesn't store)
     * This saves massive gas costs
     */
    function createAuditLog(
        string calldata _logId,
        string calldata _action,
        string calldata _userId,
        string calldata _complaintId,
        string calldata _details
    ) external {
        totalAuditLogs++;
        
        emit AuditLogCreated(
            _logId,
            _action,
            _userId,
            _complaintId,
            _details,
            block.timestamp
        );
    }
    
    /**
     * @dev Get complaint by ID (returns struct)
     */
    function getComplaint(string calldata _complaintId) 
        external 
        view 
        returns (Complaint memory) 
    {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        return complaints[complaintIdHash];
    }
    
    /**
     * @dev Get user by ID (returns struct)
     */
    function getUser(string calldata _userId) 
        external 
        view 
        returns (User memory) 
    {
        bytes32 userIdHash = keccak256(bytes(_userId));
        require(userExists[userIdHash], "User does not exist");
        return users[userIdHash];
    }

    function getComplaintStatusHistory(string calldata _complaintId)
        external
        view
        returns (StatusAuditEntry[] memory)
    {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        return complaintStatusHistory[complaintIdHash];
    }

    function getComplaintSla(string calldata _complaintId)
        external
        view
        returns (SlaRecord memory)
    {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        return complaintSlaRecords[complaintIdHash];
    }

    function getComplaintEscalationHistory(string calldata _complaintId)
        external
        view
        returns (EscalationRecord[] memory)
    {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        return complaintEscalationHistory[complaintIdHash];
    }
    
    /**
     * @dev Get total counts
     */
    function getCounts() 
        external 
        view 
        returns (uint256 userCount, uint256 complaintCount, uint256 auditLogCount) 
    {
        return (totalUsers, totalComplaints, totalAuditLogs);
    }
    
    /**
     * @dev Verify complaint hash
     */
    function verifyHash(
        string calldata _complaintId,
        bytes32 _descriptionHash
    ) external view returns (bool) {
        bytes32 complaintIdHash = keccak256(bytes(_complaintId));
        require(complaintExists[complaintIdHash], "Complaint does not exist");
        
        return complaints[complaintIdHash].descriptionHash == _descriptionHash;
    }
    
    /**
     * @dev Check if user exists
     */
    function checkUserExists(string calldata _userId) external view returns (bool) {
        return userExists[keccak256(bytes(_userId))];
    }
    
    /**
     * @dev Check if complaint exists
     */
    function checkComplaintExists(string calldata _complaintId) external view returns (bool) {
        return complaintExists[keccak256(bytes(_complaintId))];
    }

    function _appendStatusHistory(
        bytes32 _complaintIdHash,
        uint8 _oldStatus,
        uint8 _newStatus,
        bytes32 _reasonHash
    ) internal {
        complaintStatusHistory[_complaintIdHash].push(
            StatusAuditEntry({
                oldStatus: _oldStatus,
                newStatus: _newStatus,
                changedAt: uint64(block.timestamp),
                changedBy: msg.sender,
                reasonHash: _reasonHash
            })
        );
    }
}

/**
 * STATUS CODES:
 * 1 = REGISTERED
 * 2 = UNDER_PROCESSING
 * 3 = FORWARDED
 * 4 = ON_HOLD
 * 5 = COMPLETED
 * 6 = REJECTED
 * 7 = ESCALATED_MUNICIPAL
 * 8 = ESCALATED_STATE
 * 9 = DELETED
 * 
 * URGENCY LEVELS:
 * 1 = LOW
 * 2 = MEDIUM
 * 3 = HIGH
 * 4 = CRITICAL
 */