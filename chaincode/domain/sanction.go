package domain

import (
	"errors"
	"strings"
	"time"
)

type Sanction struct {
	ID          string    `json:"id"`
	LicenseID   string    `json:"licenseId"`
	Penalty     int       `json:"penalty"`
	Reason      string    `json:"reason"`
	IssuedAt    time.Time `json:"issuedAt"`
	InspectorID string    `json:"inspectorId"`
}

func NewSanction(id string, licenseID string, penalty int, reason string, issuedAt time.Time, inspectorID string) (*Sanction, error) {
	if strings.TrimSpace(id) == "" {
		return nil, errors.New("ID cannot be empty")
	}
	if strings.TrimSpace(licenseID) == "" {
		return nil, errors.New("License ID cannot be empty")
	}
	if penalty <= 0 {
		return nil, errors.New("Penalty must be greater than 0")
	}
	if strings.TrimSpace(reason) == "" {
		return nil, errors.New("Reason cannot be empty")
	}
	if strings.TrimSpace(inspectorID) == "" {
		return nil, errors.New("Inspector ID cannot be empty")
	}
	if issuedAt.IsZero() {
		return nil, errors.New("IssuedAt cannot be zero")
	}
	return &Sanction{
		ID:          strings.TrimSpace(id),
		LicenseID:   strings.TrimSpace(licenseID),
		Penalty:     penalty,
		Reason:      strings.TrimSpace(reason),
		IssuedAt:    issuedAt,
		InspectorID: strings.TrimSpace(inspectorID),
	}, nil
}
