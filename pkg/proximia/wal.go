package proximia

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

type walEvent struct {
	Action     string         `json:"action"`
	Collection string         `json:"collection"`
	Metric     DistanceMetric `json:"metric,omitempty"`
	Document   *Document      `json:"document,omitempty"`
	Documents  []*Document    `json:"documents,omitempty"` // batch_upsert
	ID         string         `json:"id,omitempty"`
	IDs        []string       `json:"ids,omitempty"`       // batch_delete
}

type WAL struct {
	path string
	file *os.File
	mu   sync.Mutex
}

func NewWAL(path string) (*WAL, error) {
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR|os.O_APPEND, 0o644)
	if err != nil {
		return nil, fmt.Errorf("open wal: %w", err)
	}
	return &WAL{path: path, file: file}, nil
}

func (w *WAL) Append(record *walEvent) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	line, err := json.Marshal(record)
	if err != nil {
		return err
	}
	if _, err := w.file.Write(append(line, '\n')); err != nil {
		return fmt.Errorf("wal append: %w", err)
	}
	if err := w.file.Sync(); err != nil {
		return fmt.Errorf("wal sync: %w", err)
	}
	return nil
}

func (w *WAL) Replay(handler func(record *walEvent) error) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if _, err := w.file.Seek(0, 0); err != nil {
		return fmt.Errorf("wal seek: %w", err)
	}

	scanner := bufio.NewScanner(w.file)
	lineNumber := 0
	for scanner.Scan() {
		lineNumber++
		var record walEvent
		if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
			return fmt.Errorf("wal replay line %d: %w", lineNumber, err)
		}
		if err := handler(&record); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("wal scan: %w", err)
	}
	return nil
}

// Truncate truncates the WAL file to zero length.
// This is safe to call after a successful snapshot has been taken.
func (w *WAL) Truncate() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file == nil {
		return nil
	}

	// Close the current file
	if err := w.file.Close(); err != nil {
		return fmt.Errorf("wal truncate close: %w", err)
	}

	// Reopen, truncating to zero
	file, err := os.OpenFile(w.path, os.O_CREATE|os.O_RDWR|os.O_TRUNC, 0o644)
	if err != nil {
		return fmt.Errorf("wal truncate reopen: %w", err)
	}
	w.file = file
	return nil
}

func (w *WAL) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file == nil {
		return nil
	}
	return w.file.Close()
}
