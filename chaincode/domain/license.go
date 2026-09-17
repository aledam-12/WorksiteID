package domain

import (
	"errors"
	"fmt"
	"strings"
)

type PublicLicenseState struct {
	LicenseRef string `json:"licenseRef"`
	Commitment string `json:"commitment"`
	Version    int    `json:"version"`
}

func NewPublicLicenseState(
	licenseRef string,
	commitment string,
) (*PublicLicenseState, error) {
	if licenseRef == "" {
		return nil, errors.New("licenseRef cannot be empty")
	}

	if commitment == "" {
		return nil, errors.New("commitment cannot be empty")
	}

	return &PublicLicenseState{
		LicenseRef: licenseRef,
		Commitment: commitment,
		Version:    1,
	}, nil
}

func (p *PublicLicenseState) UpdateCommitment(
	newCommitment string,
	expectedVersion int,
) error {
	if strings.TrimSpace(newCommitment) == "" {
		return errors.New("new commitment cannot be empty")
	}

	if expectedVersion != p.Version {
		return fmt.Errorf(
			"version mismatch: expected %d, current %d",
			expectedVersion,
			p.Version,
		)
	}

	p.Commitment = newCommitment
	p.Version++

	return nil
}
