package contracts

import (
	"chaincode/domain"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type SanctionsContract struct {
	contractapi.Contract
}

// CreateLicense creates a new license
func (s *SanctionsContract) CreateLicense(ctx contractapi.TransactionContextInterface, licenseID string, credits int) error {
	license, err := domain.NewLicense(licenseID, credits)
	if err != nil {
		return err
	}
	bytes, err := json.Marshal(license)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(license.ID, bytes)
}

// GetLicense returns a license
func (s *SanctionsContract) GetLicense(ctx contractapi.TransactionContextInterface, licenseID string) (*domain.License, error) {
	bytes, err := ctx.GetStub().GetState(licenseID)
	if err != nil {
		return nil, err
	}
	if bytes == nil {
		return nil, nil
	}
	var license domain.License
	err = json.Unmarshal(bytes, &license)
	if err != nil {
		return nil, err
	}
	return &license, nil
}

func (s *SanctionsContract) IssueSanction(ctx contractapi.TransactionContextInterface, sanctionID string, licenseID string, penalty int, reason string, issuedAt time.Time, inspectorID string) error {
	sanction, err := domain.NewSanction(sanctionID, licenseID, penalty, reason, issuedAt, inspectorID)
	if err != nil {
		return err
	}

	existingSanction, err := s.GetSanction(ctx, sanction.ID)
	if err != nil {
		return err
	}
	if existingSanction != nil {
		return fmt.Errorf("sanction %s already exists", sanction.ID)
	}

	license, err := s.GetLicense(ctx, licenseID)
	if err != nil {
		return err
	}
	if license == nil {
		return fmt.Errorf("license %s not found", licenseID)
	}

	err = license.ApplyPenalty(penalty)
	if err != nil {
		return err
	}

	licenseBytes, err := json.Marshal(license)
	if err != nil {
		return err
	}
	err = ctx.GetStub().PutState(license.ID, licenseBytes)
	if err != nil {
		return err
	}

	sanctionBytes, err := json.Marshal(sanction)
	if err != nil {
		return err
	}
	return ctx.GetStub().PutState(sanction.ID, sanctionBytes)
}
func (s *SanctionsContract) GetSanction(ctx contractapi.TransactionContextInterface, sanctionID string) (*domain.Sanction, error) {
	bytes, err := ctx.GetStub().GetState(sanctionID)
	if err != nil {
		return nil, err
	}
	if bytes == nil {
		return nil, nil
	}
	var sanction domain.Sanction
	err = json.Unmarshal(bytes, &sanction)
	if err != nil {
		return nil, err
	}
	return &sanction, nil
}
