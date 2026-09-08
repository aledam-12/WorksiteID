package domain

import "errors"

const (
	LicenseStatusActive  = "ACTIVE"
	LicenseStatusRevoked = "REVOKED"
)

type License struct {
	ID      string `json:"id"`
	Credits int    `json:"credits"`
	Status  string `json:"status"`
}

/*├── creare una patente valida
├── applicare una penalità
├── verificare se è revocata
└── verificare se può essere attiva */

func NewLicense(id string, credits int) (*License, error) {
	if credits < 0 {
		return nil, errors.New("Credits cannot be negative")
	}
	if id == "" {
		return nil, errors.New("ID cannot be empty")
	}
	if credits >= 15 {
		return &License{
			ID:      id,
			Credits: credits,
			Status:  LicenseStatusActive,
		}, nil
	}
	return &License{
		ID:      id,
		Credits: credits,
		Status:  LicenseStatusRevoked,
	}, nil
}

func (l *License) ApplyPenalty(penalty int) error {
	if penalty <= 0 {
		return errors.New("Penalty must be greater than 0")
	}
	l.Credits = max(0, l.Credits-penalty)
	if l.Credits < 15 {
		l.Status = LicenseStatusRevoked
	}
	return nil
}

func (l *License) IsRevoked() bool {
	return l.Status == LicenseStatusRevoked && l.Credits < 15
}

func (l *License) IsActive() bool {
	return l.Status == LicenseStatusActive && l.Credits >= 15
}
