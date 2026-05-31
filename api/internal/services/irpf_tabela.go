package services

type IRPFResultado struct {
	RendimentosTotalCents int64  `json:"rendimentos_total_cents"`
	DeducoesTotalCents    int64  `json:"deducoes_total_cents"`
	ImpostoDevidoCents    int64  `json:"imposto_devido_cents"`
	ImpostoRetidoCents    int64  `json:"imposto_retido_cents"`
	SaldoCents            int64  `json:"saldo_cents"`
	SituacaoFinal         string `json:"situacao_final"`
}

type irpfFaixa struct {
	limiteCents  int64
	aliquota     float64
	deducaoCents int64
}

// Tabela anual oficial da Receita Federal para exercício 2026, ano-calendário 2025.
// Fonte: Receita Federal, "Tributação de 2025", incidência anual a partir do exercício 2026.
func tabelaAnualIRPF(anoCalendario int) []irpfFaixa {
	switch anoCalendario {
	case 2025:
		return []irpfFaixa{
			{limiteCents: 2846720, aliquota: 0, deducaoCents: 0},
			{limiteCents: 3391980, aliquota: 0.075, deducaoCents: 213504},
			{limiteCents: 4501260, aliquota: 0.15, deducaoCents: 467903},
			{limiteCents: 5597616, aliquota: 0.225, deducaoCents: 805497},
			{limiteCents: 1<<62 - 1, aliquota: 0.275, deducaoCents: 1085378},
		}
	default:
		return tabelaAnualIRPF(2025)
	}
}

func DeducaoDependenteCents(anoCalendario int) int64 {
	switch anoCalendario {
	case 2025:
		return 227508
	default:
		return 227508
	}
}

func CalcularImpostoIRPF(rendimentosCents, deducoesCents, impostoRetidoCents int64, anoCalendario int) IRPFResultado {
	base := rendimentosCents - deducoesCents
	if base < 0 {
		base = 0
	}
	var devido int64
	for _, faixa := range tabelaAnualIRPF(anoCalendario) {
		if base <= faixa.limiteCents {
			devido = int64(float64(base)*faixa.aliquota) - faixa.deducaoCents
			break
		}
	}
	if devido < 0 {
		devido = 0
	}
	saldo := devido - impostoRetidoCents
	situacao := "sem_imposto"
	if saldo > 0 {
		situacao = "a_pagar"
	}
	if saldo < 0 {
		situacao = "a_restituir"
	}
	return IRPFResultado{
		RendimentosTotalCents: rendimentosCents,
		DeducoesTotalCents:    deducoesCents,
		ImpostoDevidoCents:    devido,
		ImpostoRetidoCents:    impostoRetidoCents,
		SaldoCents:            saldo,
		SituacaoFinal:         situacao,
	}
}
