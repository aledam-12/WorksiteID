package main

import (
	"log"

	"chaincode/contracts"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	chaincode, err := contractapi.NewChaincode(&contracts.SanctionsContract{})
	if err != nil {
		log.Panicf("Error creating sanctions chaincode: %v", err)
	}

	if err := chaincode.Start(); err != nil {
		log.Panicf("Error starting sanctions chaincode: %v", err)
	}
}
