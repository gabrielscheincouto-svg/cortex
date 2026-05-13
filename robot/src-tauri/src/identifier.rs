//! Identificação do tipo de obrigação a partir do nome do arquivo.
//!
//! A API expõe `GET /api/v1/robo/catalogo` com a lista de obrigações da org
//! e seus regex patterns. O robô cacheia essa lista em memória e atualiza
//! periodicamente.

use crate::error::{RoboError, RoboResult};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;

/// Entrada do catálogo de obrigações que o robô recebe da API.
/// Espelha campos relevantes de `public.obrigacoes_catalogo`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObrigacaoCatalogo {
    pub id: String,
    pub codigo: String,                // ex: "DCTFWeb"
    pub nome: String,
    pub departamento: String,
    pub regex_arquivo: Option<String>, // ex: "^DCTFWEB_(\\d{14})_(\\d{6})\\.txt$"
    pub parser_tipo: Option<String>,   // ex: "dctfweb" | "sped_efd_contrib" | "dirbi" | "pdf_guia"
}

#[derive(Debug, Clone)]
struct CompiledEntry {
    cat: ObrigacaoCatalogo,
    regex: Regex,
}

/// Match resultante: qual obrigação foi identificada + grupos capturados (CNPJ, competência).
#[derive(Debug, Clone, Serialize)]
pub struct IdentifiedFile {
    pub obrigacao_codigo: String,
    pub obrigacao_id: String,
    pub parser_tipo: Option<String>,
    pub cnpj_extraido: Option<String>,   // 14 dígitos, se o regex tem grupo
    pub competencia_extraida: Option<String>, // "yyyy-MM" se identificável
}

#[derive(Debug, Clone, Default)]
pub struct Catalog {
    compiled: Vec<CompiledEntry>,
}

impl Catalog {
    /// Compila o catálogo recebido da API. Entradas sem regex_arquivo são ignoradas.
    pub fn compile(items: Vec<ObrigacaoCatalogo>) -> RoboResult<Self> {
        let mut compiled = Vec::with_capacity(items.len());
        for it in items {
            let Some(pat) = it.regex_arquivo.clone() else { continue };
            let regex = Regex::new(&pat).map_err(|e| {
                RoboError::Identifier(format!("regex inválido em {}: {e}", it.codigo))
            })?;
            compiled.push(CompiledEntry { cat: it, regex });
        }
        Ok(Self { compiled })
    }

    /// Tenta identificar um arquivo pelo nome. Retorna a primeira regra que casa.
    pub fn identify(&self, path: &Path) -> Option<IdentifiedFile> {
        let filename = path.file_name()?.to_string_lossy().to_string();
        for entry in &self.compiled {
            if let Some(caps) = entry.regex.captures(&filename) {
                // Captura comum: grupo 1 = CNPJ (14 dígitos), grupo 2 = competência (yyyymm ou yyyy-mm)
                let cnpj = caps.get(1).map(|m| sanitize_cnpj(m.as_str()));
                let competencia = caps.get(2).map(|m| normalize_competencia(m.as_str()));
                return Some(IdentifiedFile {
                    obrigacao_codigo: entry.cat.codigo.clone(),
                    obrigacao_id: entry.cat.id.clone(),
                    parser_tipo: entry.cat.parser_tipo.clone(),
                    cnpj_extraido: cnpj,
                    competencia_extraida: competencia,
                });
            }
        }
        None
    }

    pub fn is_empty(&self) -> bool {
        self.compiled.is_empty()
    }

    pub fn len(&self) -> usize {
        self.compiled.len()
    }
}

fn sanitize_cnpj(raw: &str) -> String {
    raw.chars().filter(|c| c.is_ascii_digit()).collect::<String>()
}

/// Aceita "202405", "2024-05", "05/2024" → "2024-05"
fn normalize_competencia(raw: &str) -> String {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    match digits.len() {
        6 => format!("{}-{}", &digits[0..4], &digits[4..6]),       // yyyymm
        _ if digits.len() == 6 && raw.contains('/') => {
            format!("{}-{}", &digits[2..6], &digits[0..2])         // mm/yyyy
        }
        _ => raw.to_string(),
    }
}
