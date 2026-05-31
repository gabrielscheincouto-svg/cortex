package handler

import (
	"errors"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/cecopel/api/internal/auth"
	"github.com/cecopel/api/internal/models"
	"github.com/cecopel/api/internal/repo"
	"github.com/cecopel/api/internal/services"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

var uploadNameCleaner = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

// POST /api/v1/uploads/preparar
//
// Body esperado:
// {
//   "contexto": "robo_entrega|manual_entrega|solicitacao|mural|chat|avatar|logo_org|cliente_arquivo",
//   "contexto_id": "uuid opcional",
//   "contexto_payload": {"cnpj_extraido":"...", "competencia":"yyyy-MM", "obrigacao_id":"..."},
//   "nome_original": "arquivo.pdf",
//   "mime_type": "application/pdf",
//   "tamanho_bytes": 12345,
//   "hash_sha256": "opcional"
// }
func (h *Handler) PrepararUpload(c *fiber.Ctx) error {
	orgID := auth.CurrentOrg(c)
	userID := auth.MustUserID(c)
	if orgID == uuid.Nil {
		return badReq(c, "selecione uma org primeiro")
	}

	var dto models.PrepararUploadRequest
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.Contexto == "" || dto.NomeOriginal == "" || dto.TamanhoBytes <= 0 {
		return badReq(c, "contexto, nome_original e tamanho_bytes são obrigatórios")
	}
	if dto.ContextoPayload == nil {
		dto.ContextoPayload = map[string]any{}
	}
	bucket, ok := services.BucketParaContexto(dto.Contexto)
	if !ok {
		return badReq(c, "contexto inválido")
	}
	if !services.MimePermitido(dto.Contexto, dto.MimeType) {
		return c.Status(415).JSON(fiber.Map{"error": "mime_not_allowed"})
	}
	if dto.Contexto == "robo_entrega" && !hasPayload(dto.ContextoPayload, "cnpj_extraido", "competencia", "obrigacao_id") {
		return badReq(c, "robo_entrega exige cnpj_extraido, competencia e obrigacao_id")
	}

	planoCodigo, usado, err := h.Repo.GetPlanoCodigoEUsoStorage(c.UserContext(), orgID)
	if err != nil {
		return internalErr(c, err)
	}
	limites := services.LimitesParaPlano(planoCodigo)
	if dto.TamanhoBytes > limites.MaxBytesPorArquivo {
		return c.Status(413).JSON(fiber.Map{"error": "arquivo_muito_grande", "max_bytes": limites.MaxBytesPorArquivo})
	}
	if usado+dto.TamanhoBytes > limites.MaxBytesTotalOrg {
		return c.Status(413).JSON(fiber.Map{"error": "storage_org_excedido", "max_bytes": limites.MaxBytesTotalOrg})
	}

	storage, err := h.storageClient()
	if err != nil {
		return internalErr(c, err)
	}

	uploadID := uuid.New()
	now := time.Now().UTC()
	storagePath := fmt.Sprintf("%s/%s/%s/%s-%s",
		orgID, dto.Contexto, now.Format("2006-01"), uploadID, sanitizeUploadName(dto.NomeOriginal))
	uploadURL, err := storage.CreateSignedUploadURL(c.UserContext(), bucket, storagePath, 300)
	if err != nil {
		return internalErr(c, err)
	}

	mime := strings.TrimSpace(dto.MimeType)
	if mime == "" {
		mime = "application/octet-stream"
	}
	var hash *string
	if dto.HashSHA256 != "" {
		hash = &dto.HashSHA256
	}
	expiresAt := now.Add(15 * time.Minute)
	up := &models.UploadPendente{
		ID:                 uploadID,
		OrgID:              orgID,
		UserID:             &userID,
		Bucket:             bucket,
		StoragePath:        storagePath,
		NomeOriginal:       dto.NomeOriginal,
		MimeType:           &mime,
		TamanhoEsperado:    dto.TamanhoBytes,
		HashSHA256Esperado: hash,
		Contexto:           dto.Contexto,
		ContextoID:         dto.ContextoID,
		ContextoPayload:    dto.ContextoPayload,
		ExpiraEm:           expiresAt,
	}
	if err := h.Repo.CreateUploadPendente(c.UserContext(), up); err != nil {
		return internalErr(c, err)
	}

	return c.Status(201).JSON(models.PrepararUploadResponse{
		UploadID:    uploadID,
		UploadURL:   uploadURL,
		StoragePath: storagePath,
		Bucket:      bucket,
		ExpiresAt:   expiresAt,
		MaxBytes:    limites.MaxBytesPorArquivo,
	})
}

// POST /api/v1/uploads/:upload_id/confirmar
func (h *Handler) ConfirmarUpload(c *fiber.Ctx) error {
	uploadID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	userID := auth.MustUserID(c)
	var dto models.ConfirmarUploadRequest
	if err := c.BodyParser(&dto); err != nil {
		return badReq(c, "invalid_body")
	}
	if dto.ContextoPayload == nil {
		dto.ContextoPayload = map[string]any{}
	}

	up, err := h.Repo.GetUploadPendente(c.UserContext(), uploadID)
	if errorsIsNotFound(err) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	if up.HashSHA256Esperado != nil && dto.HashSHA256 != "" && *up.HashSHA256Esperado != dto.HashSHA256 {
		return c.Status(409).JSON(fiber.Map{"error": "hash_mismatch"})
	}

	storage, err := h.storageClient()
	if err != nil {
		return internalErr(c, err)
	}
	size, err := storage.HeadObject(c.UserContext(), up.Bucket, up.StoragePath)
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"error": "storage_object_missing", "detail": err.Error()})
	}
	if size > 0 && sizeDeltaMaiorQue10(up.TamanhoEsperado, size) {
		return c.Status(422).JSON(fiber.Map{"error": "size_mismatch", "expected": up.TamanhoEsperado, "actual": size})
	}
	if up.Contexto == "avatar" || up.Contexto == "logo_org" {
		dto.ContextoPayload["public_url"] = storage.PublicURL(up.Bucket, up.StoragePath)
	}

	resp, err := h.Repo.ConfirmUploadPendente(c.UserContext(), uploadID, userID, dto.ContextoPayload)
	if errorsIsNotFound(err) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return c.Status(422).JSON(fiber.Map{"error": "confirmacao_falhou", "detail": err.Error()})
	}
	return c.JSON(resp)
}

// POST /api/v1/uploads/:upload_id/cancelar
func (h *Handler) CancelarUpload(c *fiber.Ctx) error {
	uploadID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	up, err := h.Repo.GetUploadPendente(c.UserContext(), uploadID)
	if errorsIsNotFound(err) {
		return c.SendStatus(204)
	}
	if err != nil {
		return internalErr(c, err)
	}
	if storage, err := h.storageClient(); err == nil {
		_ = storage.DeleteObject(c.UserContext(), up.Bucket, up.StoragePath)
	}
	_ = h.Repo.CancelUploadPendente(c.UserContext(), uploadID, "cancelado pelo usuário")
	return c.SendStatus(204)
}

// GET /api/v1/arquivos/:arquivo_id/download-url
func (h *Handler) GetArquivoDownloadURL(c *fiber.Ctx) error {
	arquivoID, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return badReq(c, "id inválido")
	}
	bucket, path, err := h.Repo.GetArquivoStorage(c.UserContext(), arquivoID)
	if errorsIsNotFound(err) {
		return c.Status(404).JSON(fiber.Map{"error": "not_found"})
	}
	if err != nil {
		return internalErr(c, err)
	}
	storage, err := h.storageClient()
	if err != nil {
		return internalErr(c, err)
	}
	url, err := storage.CreateSignedDownloadURL(c.UserContext(), bucket, path, 3600)
	if err != nil {
		return internalErr(c, err)
	}
	return c.JSON(models.DownloadURLResponse{URL: url, ExpiresAt: time.Now().UTC().Add(time.Hour)})
}

func (h *Handler) storageClient() (*services.StorageClient, error) {
	return services.NewStorageClient(h.Cfg)
}

func sanitizeUploadName(name string) string {
	base := filepath.Base(strings.TrimSpace(name))
	if base == "." || base == "/" || base == "" {
		base = "arquivo"
	}
	base = uploadNameCleaner.ReplaceAllString(base, "-")
	return strings.Trim(base, "-")
}

func hasPayload(payload map[string]any, keys ...string) bool {
	for _, key := range keys {
		v, ok := payload[key]
		if !ok || fmt.Sprint(v) == "" || fmt.Sprint(v) == "<nil>" {
			return false
		}
	}
	return true
}

func sizeDeltaMaiorQue10(expected, actual int64) bool {
	if expected <= 0 {
		return false
	}
	diff := expected - actual
	if diff < 0 {
		diff = -diff
	}
	return diff*100 > expected*10
}

func errorsIsNotFound(err error) bool {
	return errors.Is(err, repo.ErrNotFound)
}
