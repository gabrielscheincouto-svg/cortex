import type { BalanceteConta, ReplaceBalanceteContaDTO } from './api'

export type CategoriaBalancete =
  | 'receita_bruta' | 'deducoes' | 'impostos_sobre_receita' | 'cmv'
  | 'despesas_operacionais' | 'despesas_financeiras' | 'receitas_financeiras'
  | 'outras_receitas' | 'outras_despesas' | 'provisoes_ir_csll'
  | 'ativo_circulante' | 'ativo_nao_circulante' | 'passivo_circulante'
  | 'passivo_nao_circulante' | 'patrimonio_liquido'

export interface ContaAnalitica extends Pick<BalanceteConta, 'codigo' | 'descricao' | 'saldo_atual'> {
  categoria: CategoriaBalancete | null
}

export interface IndicadoresBalancete {
  receitaBruta: number
  receitaLiquida: number
  resultado: number
  liquidezCorrente: number
  liquidezGeral: number
  endividamento: number
  margemLiquida: number
  ativoTotal: number
  passivoTotal: number
}

function normDesc(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

export function classificarConta(descricao: string): CategoriaBalancete | null {
  const d = normDesc(descricao)
  if (!d) return null
  const isCredito = /CREDITO/.test(d)
  if (/DEDUC(AO|OES)/.test(d) && /(ICMS|COFINS|PIS|ISS|IBS|CBS|IRRF|IR NA FONTE|IR FONTE|IMPOSTO|CSLL|TRIBUTO|SIMPLES)/.test(d)) return 'impostos_sobre_receita'
  if (/IMPOSTOS? SOBRE (VENDAS?|RECEITA|SERVIC|FATURAMENTO)/.test(d)) return 'impostos_sobre_receita'
  if (/TRIBUTOS? SOBRE (VENDAS?|RECEITA|FATURAMENTO)/.test(d)) return 'impostos_sobre_receita'
  if (!isCredito && /\b(ICMS|COFINS|ISS|IBS|CBS|IRRF|CSL|CSLL|SIMPLES NACIONAL|DIFAL)\b/.test(d) && !/PROVIS/.test(d)) return 'impostos_sobre_receita'
  if (!isCredito && /\bPIS\b/.test(d) && !/PROVIS/.test(d)) return 'impostos_sobre_receita'
  if (/DESCONTO (INCONDICIONAL|COMERCIAL|S VENDA|SOBRE VENDA|DE VENDA|EM VENDA)/.test(d)) return 'deducoes'
  if (/DEVOLUC(AO|OES) DE VENDA|DEVOLUC(AO|OES)$|ABATIMENTO (CONCEDIDO|EM VENDA|S VENDA|SOBRE VENDA)/.test(d)) return 'deducoes'
  if (/RECEITAS? FINANCEIRAS?/.test(d)) return 'receitas_financeiras'
  if (/RENDIMENTOS? (DE )?APLIC|RENDIMENTO FINANC|JUROS ATIVOS?|JUROS RECEBIDOS?|JUROS E DESCONTOS? (OBTIDO|RECEBIDO|ATIVO)|DESCONTOS? OBTIDO|DESCONTO FINANCEIRO|VARIAC(AO|OES) (MONETARIA|CAMBIAL) ATIVA/.test(d)) return 'receitas_financeiras'
  if (/RECEITA (BRUTA|OPERACIONAL|DE VENDA|DE SERVIC)|FATURAMENTO|VENDAS? BRUTAS?|VENDA (DE )?(MERCADORIA|PRODUTO|BEM|SERVIC)|VENDAS?$|PRESTAC(AO|OES) DE SERVIC|RECEITA DE SERVIC|REVENDA DE MERCADORIA/.test(d)) return 'receita_bruta'
  if (/OUTRAS RECEITAS|RECEITAS? DIVERSAS?|RECEITAS? EVENTUAIS?|RECEITAS? NAO OPERACIONAIS?|BRINDES E BONIFIC/.test(d)) return 'outras_receitas'
  if (/PROVIS(AO|OES).*(IRPJ|CSLL|IMPOSTO DE RENDA|CONTRIBUICAO SOCIAL)/.test(d)) return 'provisoes_ir_csll'
  if (/(IRPJ|CSLL) (A PAGAR|DEVIDO|DO EXERCICIO)/.test(d)) return 'provisoes_ir_csll'
  if (/CMV|CPV|CSV|CUSTO (DA|DAS|DO|DOS) (MERCADORIAS?|PRODUTOS?|SERVIC|VENDAS?|BEM|BENS)|CUSTO DE VENDA|CUSTO DE AQUISIC|CUSTO DE IMPORTAC|CUSTOS? DE IMPORTAC|COMPRAS? DE MERCADORIAS?|COMPRAS? DE PRODUTOS?|COMPRAS? DE COMBUSTIVEIS?|ESTOQUE (INICIAL|FINAL)|VARIAC(AO|OES) DE ESTOQUE|OUTROS CUSTOS|FRETES? E CARRETOS?|EMBALAGENS?/.test(d)) return 'cmv'
  if (/^CUSTOS?$/.test(d.trim())) return 'cmv'
  if (isCredito && /\b(ICMS|PIS|COFINS)\b/.test(d)) return 'cmv'
  if (/DESPESAS? (FINANCEIRAS?|BANCARIAS?)|JUROS PASSIVOS?|TAXAS? BANCARIAS?|TARIFAS? BANCARIAS?|IOF|JUROS DE MORA|MULTA DE MORA|JUROS E COMISS(AO|OES)|VARIAC(AO|OES) (MONETARIA|CAMBIAL) PASSIVA/.test(d)) return 'despesas_financeiras'
  if (/OUTRAS DESPESAS|DESPESAS? DIVERSAS?|DESPESAS? EVENTUAIS?|DESPESAS? NAO OPERACIONAIS?/.test(d)) return 'outras_despesas'
  if (/DESPESAS? (OPERACIONAIS?|ADMINISTRATIVAS?|COMERCIAIS?|COM VENDAS?|DE VENDAS?|COM PESSOAL|GERAIS|TRIBUTARIAS?|COM IMPOSTOS?)/.test(d)) return 'despesas_operacionais'
  if (/^DESPESAS?$/.test(d.trim())) return 'despesas_operacionais'
  if (/ATIVO CIRCULANTE/.test(d)) return 'ativo_circulante'
  if (/ATIVO (NAO )?CIRCULANTE|REALIZAVEL (A )?LONGO PRAZO|INVESTIMENTOS?|IMOBILIZADO|INTANGIVEL|DEPRECIAC(AO|OES) ACUMULADA|AMORTIZAC(AO|OES) ACUMULADA/.test(d) && !/ATIVO CIRCULANTE/.test(d)) return 'ativo_nao_circulante'
  if (/PASSIVO CIRCULANTE/.test(d)) return 'passivo_circulante'
  if (/PASSIVO (NAO )?CIRCULANTE|EXIGIVEL (A )?LONGO PRAZO/.test(d) && !/PASSIVO CIRCULANTE/.test(d)) return 'passivo_nao_circulante'
  if (/PATRIMONIO LIQUIDO|CAPITAL SOCIAL|RESERVA (DE |S DE )?(LUCRO|CAPITAL|REAVALIAC)|LUCROS? ACUMULADOS?|PREJUIZOS? ACUMULADOS?|LUCROS? OU PREJUIZOS? ACUMULADOS?/.test(d)) return 'patrimonio_liquido'
  return null
}

function sum(contas: ContaAnalitica[], categoria: CategoriaBalancete | CategoriaBalancete[], absoluto = true) {
  const cats = Array.isArray(categoria) ? categoria : [categoria]
  const total = contas.filter(conta => conta.categoria && cats.includes(conta.categoria)).reduce((acc, conta) => acc + conta.saldo_atual, 0)
  return absoluto ? Math.abs(total) : total
}

export function analisarContas(contas: BalanceteConta[]): ContaAnalitica[] {
  return contas.map(conta => ({
    codigo: conta.codigo,
    descricao: conta.descricao,
    saldo_atual: conta.saldo_atual,
    categoria: classificarConta(conta.grupo || conta.descricao),
  }))
}

export function calcularIndicadores(contasOriginais: BalanceteConta[]): IndicadoresBalancete {
  const contas = analisarContas(contasOriginais)
  const receitaBruta = sum(contas, 'receita_bruta', true)
  const devolucoes = sum(contas, 'deducoes', true)
  const impostos = sum(contas, 'impostos_sobre_receita', true)
  const receitaLiquida = receitaBruta - devolucoes - impostos
  const cmv = sum(contas, 'cmv', true)
  const lucroBruto = receitaLiquida - cmv
  const despesasAdmin = sum(contas, 'despesas_operacionais', true)
  const despesasFin = sum(contas, 'despesas_financeiras', true)
  const receitasFin = sum(contas, 'receitas_financeiras', true)
  const lucroOperacional = lucroBruto - (despesasAdmin + despesasFin - receitasFin)
  const resultado = lucroOperacional + sum(contas, 'outras_receitas', true) - sum(contas, 'outras_despesas', true) - sum(contas, 'provisoes_ir_csll', true)
  const ativoCirculante = sum(contas, 'ativo_circulante', true)
  const ativoNaoCirculante = sum(contas, 'ativo_nao_circulante', true)
  const passivoCirculante = sum(contas, 'passivo_circulante', true)
  const passivoNaoCirculante = sum(contas, 'passivo_nao_circulante', true)
  const ativoTotal = ativoCirculante + ativoNaoCirculante
  const passivoTotal = passivoCirculante + passivoNaoCirculante
  return {
    receitaBruta,
    receitaLiquida,
    resultado,
    liquidezCorrente: passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0,
    liquidezGeral: passivoTotal > 0 ? ativoTotal / passivoTotal : 0,
    endividamento: ativoTotal > 0 ? passivoTotal / ativoTotal : 0,
    margemLiquida: receitaBruta !== 0 ? resultado / receitaBruta : 0,
    ativoTotal,
    passivoTotal,
  }
}

export function normalizarContaImportada(row: Record<string, unknown>, ordem: number): ReplaceBalanceteContaDTO | null {
  const get = (...keys: string[]) => {
    const found = Object.entries(row).find(([key]) => keys.includes(normDesc(key).replace(/\s+/g, ' ').trim()))
    return found?.[1]
  }
  const codigo = String(get('CODIGO', 'CONTA', 'CLASSIFICACAO') ?? '').trim()
  const descricao = String(get('DESCRICAO', 'NOME', 'CONTA CONTABIL') ?? '').trim()
  if (!codigo || !descricao) return null
  const numero = (value: unknown) => {
    if (typeof value === 'number') return value
    const text = String(value ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
    return Number(text) || 0
  }
  const saldoAtual = numero(get('SALDO ATUAL', 'SALDO', 'SALDO FINAL'))
  return {
    codigo,
    descricao,
    saldo_anterior: numero(get('SALDO ANTERIOR', 'SALDO INICIAL')),
    debito: numero(get('DEBITO', 'DEBITOS')),
    credito: numero(get('CREDITO', 'CREDITOS')),
    saldo_atual: saldoAtual,
    natureza: saldoAtual < 0 ? 'C' : 'D',
    ordem,
  }
}
