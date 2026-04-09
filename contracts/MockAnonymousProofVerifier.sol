// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MockAnonymousProofVerifier {
    bool private shouldVerify = true;

    function setShouldVerify(bool _shouldVerify) external {
        shouldVerify = _shouldVerify;
    }

    function verifyProof(bytes calldata, bytes32) external view returns (bool) {
        return shouldVerify;
    }
}
