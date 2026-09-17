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

// CreateLicense inizializza lo stato pubblico della patente sul ledger.
// Nessun dato privato della patente viene memorizzato on-chain.
func (s *SanctionsContract) CreateLicense(
	ctx contractapi.TransactionContextInterface,
	licenseRef string,
	initialCommitment string,
) error {
	existing, err := ctx.GetStub().GetState(licenseRef)
	if err != nil {
		return err
	}

	if existing != nil {
		return fmt.Errorf("license %s already exists", licenseRef)
	}

	state, err := domain.NewPublicLicenseState(
		licenseRef,
		initialCommitment,
	)
	if err != nil {
		return err
	}

	bytes, err := json.Marshal(state)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(licenseRef, bytes)
}

// GetLicenseState restituisce esclusivamente lo stato pubblico
// della patente presente sul ledger.
func (s *SanctionsContract) GetLicenseState(
	ctx contractapi.TransactionContextInterface,
	licenseRef string,
) (*domain.PublicLicenseState, error) {
	bytes, err := ctx.GetStub().GetState(licenseRef)
	if err != nil {
		return nil, err
	}

	if bytes == nil {
		return nil, fmt.Errorf("license %s not found", licenseRef)
	}

	var state domain.PublicLicenseState

	if err := json.Unmarshal(bytes, &state); err != nil {
		return nil, err
	}

	return &state, nil
}

// IssueSanction registra una sanzione e aggiorna il commitment pubblico
// della patente.
//
// I dati privati della sanzione, inclusi penalty e reason, non vengono
// memorizzati sul ledger.
//
// La correttezza della transizione dello stato privato, ad esempio:
//
//	creditsNew = creditsOld - penalty
//
// sarà verificata successivamente tramite ZKP.
func (s *SanctionsContract) IssueSanction(
	ctx contractapi.TransactionContextInterface,
	sanctionID string,
	licenseRef string,
	sanctionCommitment string,
	newCommitment string,
	inspectorRef string,
) error {
	existingSanction, err := ctx.GetStub().GetState(sanctionID)
	if err != nil {
		return err
	}

	if existingSanction != nil {
		return fmt.Errorf("sanction %s already exists", sanctionID)
	}

	pubState, err := s.GetLicenseState(ctx, licenseRef)
	if err != nil {
		return err
	}

	if newCommitment == "" {
		return fmt.Errorf("new commitment cannot be empty")
	}

	if newCommitment == pubState.Commitment {
		return fmt.Errorf("new commitment must differ from current commitment")
	}

	txTime, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return err
	}

	issuedAt := time.Unix(
		txTime.Seconds,
		int64(txTime.Nanos),
	)

	newVersion := pubState.Version + 1

	sanction, err := domain.NewSanction(
		sanctionID,
		licenseRef,
		sanctionCommitment,
		issuedAt,
		inspectorRef,
		newVersion,
	)
	if err != nil {
		return err
	}

	pubState.Commitment = newCommitment
	pubState.Version = newVersion

	licenseBytes, err := json.Marshal(pubState)
	if err != nil {
		return err
	}

	if err := ctx.GetStub().PutState(
		licenseRef,
		licenseBytes,
	); err != nil {
		return err
	}

	sanctionBytes, err := json.Marshal(sanction)
	if err != nil {
		return err
	}

	return ctx.GetStub().PutState(
		sanctionID,
		sanctionBytes,
	)
}

// GetSanction restituisce esclusivamente i dati pubblici della sanzione.
func (s *SanctionsContract) GetSanction(
	ctx contractapi.TransactionContextInterface,
	sanctionID string,
) (*domain.Sanction, error) {
	bytes, err := ctx.GetStub().GetState(sanctionID)
	if err != nil {
		return nil, err
	}

	if bytes == nil {
		return nil, fmt.Errorf("sanction %s not found", sanctionID)
	}

	var sanction domain.Sanction

	if err := json.Unmarshal(bytes, &sanction); err != nil {
		return nil, err
	}

	return &sanction, nil
}
