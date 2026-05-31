package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/cecopel/api/internal/config"
)

type StorageClient struct {
	baseURL string
	key     string
	client  *http.Client
}

func NewStorageClient(cfg *config.Config) (*StorageClient, error) {
	if cfg == nil || cfg.SupabaseURL == "" || cfg.SupabaseSvcKey == "" {
		return nil, fmt.Errorf("storage: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios")
	}
	return &StorageClient{
		baseURL: strings.TrimRight(cfg.SupabaseURL, "/"),
		key:     cfg.SupabaseSvcKey,
		client:  &http.Client{Timeout: 15 * time.Second},
	}, nil
}

func (s *StorageClient) CreateSignedUploadURL(ctx context.Context, bucket, path string, expiresInSeconds int) (string, error) {
	endpoint := fmt.Sprintf("%s/storage/v1/object/upload/sign/%s/%s?expiresIn=%d",
		s.baseURL, url.PathEscape(bucket), escapeStoragePath(path), expiresInSeconds)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader([]byte("{}")))
	if err != nil {
		return "", err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("storage signed upload: status %d", resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	return s.resolveURL(firstString(body, "url", "signedURL", "signedUrl")), nil
}

func (s *StorageClient) CreateSignedDownloadURL(ctx context.Context, bucket, path string, expiresInSeconds int) (string, error) {
	endpoint := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s?expiresIn=%d",
		s.baseURL, url.PathEscape(bucket), escapeStoragePath(path), expiresInSeconds)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader([]byte("{}")))
	if err != nil {
		return "", err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("storage signed download: status %d", resp.StatusCode)
	}

	var body map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", err
	}
	return s.resolveURL(firstString(body, "signedURL", "signedUrl", "url")), nil
}

func (s *StorageClient) HeadObject(ctx context.Context, bucket, path string) (int64, error) {
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, url.PathEscape(bucket), escapeStoragePath(path))
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, endpoint, nil)
	if err != nil {
		return 0, err
	}
	s.auth(req)
	resp, err := s.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return 0, fmt.Errorf("storage object not_found")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return 0, fmt.Errorf("storage head: status %d", resp.StatusCode)
	}
	return resp.ContentLength, nil
}

func (s *StorageClient) DeleteObject(ctx context.Context, bucket, path string) error {
	endpoint := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, url.PathEscape(bucket), escapeStoragePath(path))
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, endpoint, nil)
	if err != nil {
		return err
	}
	s.auth(req)
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("storage delete: status %d", resp.StatusCode)
	}
	return nil
}

func (s *StorageClient) PublicURL(bucket, path string) string {
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.baseURL, url.PathEscape(bucket), escapeStoragePath(path))
}

func (s *StorageClient) auth(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+s.key)
	req.Header.Set("apikey", s.key)
}

func (s *StorageClient) resolveURL(raw string) string {
	if raw == "" || strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		return raw
	}
	if strings.HasPrefix(raw, "/") {
		return s.baseURL + raw
	}
	return s.baseURL + "/" + raw
}

func firstString(m map[string]any, keys ...string) string {
	for _, key := range keys {
		if v, ok := m[key].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

func escapeStoragePath(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
