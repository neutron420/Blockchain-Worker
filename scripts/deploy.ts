import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GrievanceContractOptimized...");

  const GrievanceContractOptimized = await ethers.getContractFactory("GrievanceContractOptimized");
  const contract = await GrievanceContractOptimized.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log(`GrievanceContractOptimized deployed to: ${address}`);
  
  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
