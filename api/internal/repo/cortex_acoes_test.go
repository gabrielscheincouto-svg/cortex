// Testes do detector de intenção de ação do Cortex.
// Rodar com: cd api && go test ./internal/repo -run TestDetectarAcao -v
package repo

import "testing"

func TestDetectarAcao(t *testing.T) {
	cases := []struct {
		nome             string
		entrada          string
		ferramentaEspera string
		// não comparamos args/resumo aqui — só validamos roteamento da intenção
	}{
		// criar tarefa
		{"cria tarefa simples",       "cria tarefa: revisar DCTFWeb da Aquarela",     "criar_tarefa_kanban"},
		{"criar tarefa com 'uma'",    "criar uma tarefa para Carol amanhã",           "criar_tarefa_kanban"},
		{"adicionar tarefa",          "adicionar tarefa: bater o ponto",              "criar_tarefa_kanban"},

		// mural
		{"poste no mural",            "poste no mural: feriado amanhã",               "postar_mural"},
		{"publique no mural",         "publique um aviso no mural: ponto facultativo","postar_mural"},

		// pontos
		{"lançar pontos +5",          "lança +5 pontos para Carol",                   "lancar_pontos_manual"},
		{"adicionar -3 pontos",       "adicione -3 pontos para Beto",                 "lancar_pontos_manual"},

		// memória
		{"lembre que",                "lembre que eu prefiro ver Contábil primeiro",  "lembrar_fato"},
		{"lembra que",                "lembra que Aquarela é cliente premium",        "lembrar_fato"},
		{"anote",                     "anote: o escritório fecha às 17h",             "lembrar_fato"},
		{"guarde que",                "guarde que Carol é gerente do Pessoal",        "lembrar_fato"},

		// esquecer
		{"esqueça que",               "esqueça que prefiro Contábil",                 "esquecer_fato"},

		// — NÃO devem casar —
		{"pergunta sobre memória",    "que memórias você tem sobre mim?",             ""},
		{"do que você lembra",        "do que você lembra sobre mim?",                ""},
		{"frase neutra",              "quais são as entregas atrasadas?",             ""},
		{"vazio",                     "",                                             ""},
	}

	for _, c := range cases {
		c := c
		t.Run(c.nome, func(t *testing.T) {
			f, _, _ := DetectarAcao(c.entrada)
			if f != c.ferramentaEspera {
				t.Errorf("DetectarAcao(%q): ferramenta = %q, esperava %q", c.entrada, f, c.ferramentaEspera)
			}
		})
	}
}

func TestInferirTipoMemoria(t *testing.T) {
	cases := []struct {
		fato string
		tipo string
	}{
		{"eu prefiro ver Contábil primeiro",       "preferencia"},
		{"sempre entrego DCTFWeb na 2a quinzena",  "rotina"},
		{"usamos o termo 'fechamento' aqui",       "terminologia"},
		{"Carol está de férias até 25/05",         "contexto_temporario"},
		{"Aquarela é cliente premium",             "cliente_chave"},
		{"o escritório atende mais Simples",       "fato_org"},
		{"Beto é responsável pelo Fiscal",         "fato_user"},
	}
	for _, c := range cases {
		got := inferirTipoMemoria(c.fato)
		if got != c.tipo {
			t.Errorf("inferirTipoMemoria(%q): got=%q want=%q", c.fato, got, c.tipo)
		}
	}
}
