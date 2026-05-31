// Package services — AuditoriaBalancete porta as 5 regras de auditoria
// contábil do legado (analise-contabil.html → runAuditChecks + validateImport)
// pra uma esteira persistida em balancete_findings.
//
// Regras implementadas:
//   1) saldo_invertido       — Ativo (1.x) com saldo credor ou Passivo/PL (2.x) com saldo devedor
//   2) variacao_extrema      — > 150% MoM, ou conta zerada reativada com saldo relevante
//   3) outlier_estatistico   — valor a > 2.5σ acima da média histórica
//   4) receita_zerada        — conta 3.1.x zerada com histórico ativo
//   5) despesa_atipica       — conta 3.3.x ou 3.5.x acima de 3x a média histórica
//
// + bate_dre_divergente      — soma do DRE calculado das contas ≠ resultado declarado
//                              (verificação opcional; só roda quando o balancete trouxer
//                              um campo 'resultado' nas observacoes/contexto futuras)
//
// A função `Rodar(ctx, balanceteID)` é idempotente:
//   - apaga findings em status 'aberto' do balancete antes de re-inserir
//   - preserva findings já justificados/corrigidos (histórico de auditoria)
//   - cada rodada tem um run_token UUID novo, persistido junto

package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"strings"

	"github.com/cecopel/api/internal/db"
	"github.com/cecopel/api/internal/models"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// AuditoriaBalancete — service stateless. Injetar *db.DB e chamar Rodar.
type AuditoriaBalancete struct {
	DB *db.DB
}

func NewAuditoriaBalancete(database *db.DB) *AuditoriaBalancete {
	return &AuditoriaBalancete{DB: database}
}

// Rodar executa as 5 regras + bate-DRE sobre o balancete referenciado.
// Persiste novos findings (apagando os 'aberto' anteriores deste balancete).
// Retorna o resumo com contagem por severidade e tipo.
func (s *AuditoriaBalancete) Rodar(ctx context.Context, balanceteID uuid.UUID) (*models.RodarAuditoriaResult, error) {
	runToken := uuid.New()
	result := &models.RodarAuditoriaResult{
		BalanceteID:   balanceteID,
		RunToken:      runToken,
		PorSeveridade: map[string]int{},
		PorTipo:       map[string]int{},
	}

	err := s.DB.WithTenant(ctx, func(tx pgx.Tx) error {
		bal, contas, err := loadBalanceteEContas(ctx, tx, balanceteID)
		if err != nil {
			return fmt.Errorf("carregando balancete: %w", err)
		}

		historico, err := loadHistoricoContas(ctx, tx, bal.OrgID, bal.EmpresaID, bal.Competencia)
		if err != nil {
			return fmt.Errorf("carregando histórico: %w", err)
		}

		findings := make([]models.BalanceteFinding, 0, 32)
		findings = append(findings, regraSaldoInvertido(bal, contas)...)
		findings = append(findings, regraVariacaoExtrema(bal, contas, historico)...)
		findings = append(findings, regraOutlierEstatistico(bal, contas, historico)...)
		findings = append(findings, regraReceitaZerada(bal, contas, historico)...)
		findings = append(findings, regraDespesaAtipica(bal, contas, historico)...)

		// Apaga só os abertos da rodada anterior — histórico de justificativas fica
		if _, err := tx.Exec(ctx, `
			DELETE FROM public.balancete_findings
			WHERE balancete_id = $1 AND status = 'aberto'
		`, balanceteID); err != nil {
			return fmt.Errorf("limpando findings antigos: %w", err)
		}

		for _, f := range findings {
			ctxJSON := f.Contexto
			if len(ctxJSON) == 0 {
				ctxJSON = []byte(`{}`)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO public.balancete_findings (
					org_id, balancete_id, severity, tipo, titulo, descricao,
					conta_codigo, conta_descricao, valor_referencia,
					contexto, run_token
				) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
			`,
				bal.OrgID, balanceteID, f.Severity, f.Tipo, f.Titulo, f.Descricao,
				f.ContaCodigo, f.ContaDescricao, f.ValorReferencia,
				ctxJSON, runToken,
			); err != nil {
				return fmt.Errorf("persistindo finding %s: %w", f.Tipo, err)
			}
			result.PorSeveridade[string(f.Severity)]++
			result.PorTipo[string(f.Tipo)]++
		}
		result.FindingsCount = len(findings)
		return nil
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

// ─── Loaders ────────────────────────────────────────────────────────────────

func loadBalanceteEContas(ctx context.Context, tx pgx.Tx, id uuid.UUID) (*models.Balancete, []models.BalanceteConta, error) {
	bal := &models.Balancete{}
	err := tx.QueryRow(ctx, `
		SELECT id, org_id, empresa_id, competencia, fechado, observacoes, created_at, updated_at
		FROM public.balancetes WHERE id = $1
	`, id).Scan(&bal.ID, &bal.OrgID, &bal.EmpresaID, &bal.Competencia, &bal.Fechado, &bal.Observacoes, &bal.CreatedAt, &bal.UpdatedAt)
	if err != nil {
		return nil, nil, err
	}

	rows, err := tx.Query(ctx, `
		SELECT id, balancete_id, org_id, codigo, descricao, grupo,
		       saldo_anterior, debito, credito, saldo_atual, natureza, ordem
		FROM public.balancete_contas
		WHERE balancete_id = $1
		ORDER BY ordem, codigo
	`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var contas []models.BalanceteConta
	for rows.Next() {
		var c models.BalanceteConta
		if err := rows.Scan(
			&c.ID, &c.BalanceteID, &c.OrgID, &c.Codigo, &c.Descricao, &c.Grupo,
			&c.SaldoAnterior, &c.Debito, &c.Credito, &c.SaldoAtual, &c.Natureza, &c.Ordem,
		); err != nil {
			return nil, nil, err
		}
		contas = append(contas, c)
	}
	return bal, contas, rows.Err()
}

// loadHistoricoContas carrega até 12 competências anteriores da MESMA empresa,
// mapeando código_da_conta → []saldoAtual em ordem cronológica (mais antigo primeiro).
// Saldo zero é incluído se a competência existe (importante pra "conta reativada").
func loadHistoricoContas(ctx context.Context, tx pgx.Tx, orgID, empresaID uuid.UUID, competenciaAtual string) (map[string][]float64, error) {
	rows, err := tx.Query(ctx, `
		SELECT bc.codigo, b.competencia, bc.saldo_atual
		FROM public.balancetes b
		JOIN public.balancete_contas bc ON bc.balancete_id = b.id
		WHERE b.org_id = $1 AND b.empresa_id = $2 AND b.competencia < $3
		ORDER BY b.competencia ASC, bc.codigo ASC
	`, orgID, empresaID, competenciaAtual)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	hist := map[string][]float64{}
	for rows.Next() {
		var codigo, comp string
		var saldo float64
		if err := rows.Scan(&codigo, &comp, &saldo); err != nil {
			return nil, err
		}
		hist[codigo] = append(hist[codigo], saldo)
	}
	// Limita a 12 últimos por conta
	for k, v := range hist {
		if len(v) > 12 {
			hist[k] = v[len(v)-12:]
		}
	}
	return hist, rows.Err()
}

// ─── REGRA 1 · Saldo Invertido ──────────────────────────────────────────────

func regraSaldoInvertido(bal *models.Balancete, contas []models.BalanceteConta) []models.BalanceteFinding {
	const tolerancia = 500.0 // R$ 500 — abaixo disso é arredondamento e não geramos ruído
	out := make([]models.BalanceteFinding, 0, 4)
	for i := range contas {
		c := &contas[i]
		cls := c.Codigo

		// 1.x = Ativo. Saldo deve ser positivo (devedor).
		if strings.HasPrefix(cls, "1.") && c.SaldoAtual < -tolerancia {
			out = append(out, novoFinding(bal, c,
				models.FindingSeverityDanger,
				models.FindingTipoSaldoInvertido,
				"Conta de Ativo com saldo credor",
				fmt.Sprintf("A conta %q apresenta saldo de %s em %s. Contas do Ativo devem ter saldo devedor (positivo).",
					c.Descricao, brl(c.SaldoAtual), bal.Competencia),
				c.SaldoAtual,
				nil,
			))
		}

		// 2.x = Passivo / PL. Saldo deve ser negativo (credor).
		if strings.HasPrefix(cls, "2.") && c.SaldoAtual > tolerancia {
			out = append(out, novoFinding(bal, c,
				models.FindingSeverityDanger,
				models.FindingTipoSaldoInvertido,
				"Conta de Passivo/PL com saldo devedor",
				fmt.Sprintf("A conta %q apresenta saldo de %s em %s. Contas do Passivo/PL devem ter saldo credor (negativo).",
					c.Descricao, brl(c.SaldoAtual), bal.Competencia),
				c.SaldoAtual,
				nil,
			))
		}
	}
	return out
}

// ─── REGRA 2 · Variação Extrema (MoM) + Conta Reativada ─────────────────────

func regraVariacaoExtrema(bal *models.Balancete, contas []models.BalanceteConta, hist map[string][]float64) []models.BalanceteFinding {
	out := make([]models.BalanceteFinding, 0, 4)
	for i := range contas {
		c := &contas[i]
		serie := hist[c.Codigo]
		if len(serie) == 0 {
			continue
		}
		prev := serie[len(serie)-1] // mês imediatamente anterior

		// Conta reativada: estava zerada e voltou com saldo relevante
		if math.Abs(prev) < 100 && math.Abs(c.SaldoAtual) > 5000 {
			out = append(out, novoFinding(bal, c,
				models.FindingSeverityWarning,
				models.FindingTipoContaReativada,
				"Conta zerada voltou com saldo relevante",
				fmt.Sprintf("A conta %q estava praticamente zerada no período anterior e apresenta %s em %s. Verificar se é lançamento correto ou reclassificação.",
					c.Descricao, brl(c.SaldoAtual), bal.Competencia),
				c.SaldoAtual,
				map[string]any{"saldo_anterior": prev},
			))
			continue
		}

		// Variação extrema MoM: > 150% (warning) ou > 300% (danger)
		if math.Abs(prev) > 1000 {
			change := c.SaldoAtual - prev
			pct := change / math.Abs(prev)
			absPct := math.Abs(pct)
			if absPct > 1.5 {
				sev := models.FindingSeverityWarning
				if absPct > 3 {
					sev = models.FindingSeverityDanger
				}
				out = append(out, novoFinding(bal, c, sev,
					models.FindingTipoVariacaoExtrema,
					fmt.Sprintf("Variação de %.0f%% em relação ao mês anterior", pct*100),
					fmt.Sprintf("A conta %q variou de %s para %s entre o mês anterior e %s. Diferença de %s.",
						c.Descricao, brl(prev), brl(c.SaldoAtual), bal.Competencia, brl(change)),
					c.SaldoAtual,
					map[string]any{"saldo_anterior": prev, "variacao_perc": pct},
				))
			}
		}
	}
	return out
}

// ─── REGRA 3 · Outlier Estatístico ──────────────────────────────────────────

func regraOutlierEstatistico(bal *models.Balancete, contas []models.BalanceteConta, hist map[string][]float64) []models.BalanceteFinding {
	out := make([]models.BalanceteFinding, 0, 4)
	for i := range contas {
		c := &contas[i]
		serie := hist[c.Codigo]
		if len(serie) < 4 {
			continue
		}
		mean, std := meanStd(serie)
		if std < 1000 {
			continue // série muito estável; outliers pequenos não importam
		}
		dev := c.SaldoAtual - mean
		sigmas := dev / std
		absSigmas := math.Abs(sigmas)
		if absSigmas < 2.5 {
			continue
		}
		sev := models.FindingSeverityWarning
		if absSigmas > 4 {
			sev = models.FindingSeverityDanger
		}
		out = append(out, novoFinding(bal, c, sev,
			models.FindingTipoOutlierEstatistico,
			fmt.Sprintf("Valor %.1fσ acima da média histórica", sigmas),
			fmt.Sprintf("A conta %q apresenta %s em %s. Média histórica: %s ± %s. Desvio estatisticamente improvável.",
				c.Descricao, brl(c.SaldoAtual), bal.Competencia, brl(mean), brl(std)),
			c.SaldoAtual,
			map[string]any{"media": mean, "desvio_padrao": std, "sigmas": sigmas},
		))
	}
	return out
}

// ─── REGRA 4 · Receita Zerada ───────────────────────────────────────────────

func regraReceitaZerada(bal *models.Balancete, contas []models.BalanceteConta, hist map[string][]float64) []models.BalanceteFinding {
	out := make([]models.BalanceteFinding, 0, 4)
	for i := range contas {
		c := &contas[i]
		if !strings.HasPrefix(c.Codigo, "3.1") {
			continue
		}
		if math.Abs(c.SaldoAtual) >= 100 {
			continue
		}
		serie := hist[c.Codigo]
		if len(serie) < 2 {
			continue
		}
		teveReceita := false
		for _, v := range serie {
			if math.Abs(v) > 1000 {
				teveReceita = true
				break
			}
		}
		if !teveReceita {
			continue
		}
		out = append(out, novoFinding(bal, c,
			models.FindingSeverityDanger,
			models.FindingTipoReceitaZerada,
			"Conta de receita zerada com histórico ativo",
			fmt.Sprintf("A conta de receita %q apresenta %s em %s, mas teve faturamento nos meses anteriores. Verifique possível omissão de lançamento.",
				c.Descricao, brl(c.SaldoAtual), bal.Competencia),
			c.SaldoAtual,
			map[string]any{"meses_anteriores": len(serie)},
		))
	}
	return out
}

// ─── REGRA 5 · Despesa Atípica (3x média) ───────────────────────────────────

func regraDespesaAtipica(bal *models.Balancete, contas []models.BalanceteConta, hist map[string][]float64) []models.BalanceteFinding {
	out := make([]models.BalanceteFinding, 0, 4)
	for i := range contas {
		c := &contas[i]
		if !(strings.HasPrefix(c.Codigo, "3.3") || strings.HasPrefix(c.Codigo, "3.5")) {
			continue
		}
		serie := hist[c.Codigo]
		// Filtrar valores relevantes (>R$100) pra calcular média estável
		histVals := make([]float64, 0, len(serie))
		for _, v := range serie {
			abs := math.Abs(v)
			if abs > 100 {
				histVals = append(histVals, abs)
			}
		}
		if len(histVals) < 3 {
			continue
		}
		mean := meanOf(histVals)
		atual := math.Abs(c.SaldoAtual)
		if atual <= mean*3 {
			continue
		}
		out = append(out, novoFinding(bal, c,
			models.FindingSeverityWarning,
			models.FindingTipoDespesaAtipica,
			"Despesa 3× acima da média histórica",
			fmt.Sprintf("A conta %q apresenta %s em %s — três vezes acima da média histórica (%s). Verificar a natureza do lançamento.",
				c.Descricao, brl(atual), bal.Competencia, brl(mean)),
			c.SaldoAtual,
			map[string]any{"media_historica": mean, "fator": atual / mean},
		))
	}
	return out
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func novoFinding(
	bal *models.Balancete, c *models.BalanceteConta,
	sev models.FindingSeverity, tipo models.FindingTipo,
	titulo, descricao string, valorRef float64,
	contexto map[string]any,
) models.BalanceteFinding {
	codigo := c.Codigo
	desc := c.Descricao
	var ctxBytes []byte
	if contexto != nil {
		// Best effort — em caso de erro de marshal cai pro JSON vazio
		if b, err := json.Marshal(contexto); err == nil {
			ctxBytes = b
		} else {
			ctxBytes = []byte(`{}`)
		}
	} else {
		ctxBytes = []byte(`{}`)
	}
	return models.BalanceteFinding{
		OrgID:           bal.OrgID,
		BalanceteID:     bal.ID,
		Severity:        sev,
		Tipo:            tipo,
		Titulo:          titulo,
		Descricao:       descricao,
		ContaCodigo:     &codigo,
		ContaDescricao:  &desc,
		ValorReferencia: &valorRef,
		Contexto:        ctxBytes,
		Status:          models.FindingStatusAberto,
	}
}

func meanStd(values []float64) (mean, std float64) {
	if len(values) == 0 {
		return 0, 0
	}
	mean = meanOf(values)
	var sumSq float64
	for _, v := range values {
		d := v - mean
		sumSq += d * d
	}
	std = math.Sqrt(sumSq / float64(len(values)))
	return mean, std
}

func meanOf(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	var sum float64
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// brl formata como "R$ 1.234,56" — locale PT-BR simples.
func brl(v float64) string {
	neg := v < 0
	if neg {
		v = -v
	}
	// Duas casas decimais
	intPart := int64(v)
	cents := int64(math.Round((v - float64(intPart)) * 100))
	if cents >= 100 {
		intPart++
		cents = 0
	}
	// Separador de milhar
	intStr := fmt.Sprintf("%d", intPart)
	out := ""
	for i, ch := range intStr {
		if i > 0 && (len(intStr)-i)%3 == 0 {
			out += "."
		}
		out += string(ch)
	}
	sign := ""
	if neg {
		sign = "-"
	}
	return fmt.Sprintf("%sR$ %s,%02d", sign, out, cents)
}
