package domain

import (
	"errors"
	"strings"
	"time"
)

type Sanction struct {
	ID                 string    `json:"id"`
	LicenseRef         string    `json:"licenseRef"`
	SanctionCommitment string    `json:"sanctionCommitment"`
	IssuedAt           time.Time `json:"issuedAt"`
	InspectorRef       string    `json:"inspectorRef"`
	Version            int       `json:"version"`
}

func NewSanction(
	id string,
	licenseRef string,
	sanctionCommitment string,
	issuedAt time.Time,
	inspectorRef string,
	version int,
) (*Sanction, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID cannot be empty")
	}

	if strings.TrimSpace(licenseRef) == "" {
		return nil, errors.New("LicenseRef cannot be empty")
	}

	if strings.TrimSpace(sanctionCommitment) == "" {
		return nil, errors.New("SanctionCommitment cannot be empty")
	}

	if issuedAt.IsZero() {
		return nil, errors.New("IssuedAt cannot be zero")
	}

	if strings.TrimSpace(inspectorRef) == "" {
		return nil, errors.New("InspectorRef cannot be empty")
	}

	if version < 1 {
		return nil, errors.New("Version must be greater than or equal to 1")
	}

	return &Sanction{
		ID:                 strings.TrimSpace(id),
		LicenseRef:         strings.TrimSpace(licenseRef),
		SanctionCommitment: strings.TrimSpace(sanctionCommitment),
		IssuedAt:           issuedAt,
		InspectorRef:       strings.TrimSpace(inspectorRef),
		Version:            version,
	}, nil
}
