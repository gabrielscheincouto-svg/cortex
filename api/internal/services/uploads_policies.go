// Package services contém integrações e regras de domínio compartilhadas.
package services

import (
	"strings"
)

const (
	MB int64 = 1024 * 1024
	GB int64 = 1024 * MB
)

type LimitesUpload struct {
	MaxBytesPorArquivo int64
	MaxBytesTotalOrg   int64
}

func BucketParaContexto(contexto string) (string, bool) {
	switch contexto {
	case "robo_entrega", "manual_entrega", "cliente_arquivo":
		return "entregas", true
	case "solicitacao":
		return "solicitacoes", true
	case "mural":
		return "mural", true
	case "chat":
		return "chat", true
	case "avatar":
		return "avatars", true
	case "logo_org":
		return "logos-orgs", true
	default:
		return "", false
	}
}

func LimitesParaPlano(codigo string) LimitesUpload {
	switch codigo {
	case "pro":
		return LimitesUpload{MaxBytesPorArquivo: 1 * GB, MaxBytesTotalOrg: 25 * GB}
	case "enterprise":
		return LimitesUpload{MaxBytesPorArquivo: 5 * GB, MaxBytesTotalOrg: 250 * GB}
	default:
		return LimitesUpload{MaxBytesPorArquivo: 100 * MB, MaxBytesTotalOrg: 1 * GB}
	}
}

var MimesPermitidos = map[string][]string{
	"robo_entrega":    {"application/octet-stream", "text/plain", "application/xml", "text/xml", "application/pdf"},
	"manual_entrega":  {"application/octet-stream", "text/plain", "application/xml", "text/xml", "application/pdf", "image/jpeg", "image/png"},
	"solicitacao":     {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
	"mural":           {"image/jpeg", "image/png", "image/webp", "application/pdf"},
	"chat":            {"image/jpeg", "image/png", "image/webp", "application/pdf", "application/octet-stream"},
	"avatar":          {"image/jpeg", "image/png", "image/webp"},
	"logo_org":        {"image/jpeg", "image/png", "image/webp", "image/svg+xml"},
	"cliente_arquivo": {"application/pdf", "image/jpeg", "image/png", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"},
}

var MimesBloqueados = []string{
	"application/x-msdownload",
	"application/x-msdos-program",
	"application/x-executable",
	"application/x-mach-binary",
	"application/vnd.debian.binary-package",
}

func MimePermitido(contexto, mime string) bool {
	mime = strings.ToLower(strings.TrimSpace(mime))
	if mime == "" {
		mime = "application/octet-stream"
	}
	for _, blocked := range MimesBloqueados {
		if mime == blocked {
			return false
		}
	}
	for _, allowed := range MimesPermitidos[contexto] {
		if mime == allowed {
			return true
		}
	}
	return false
}
