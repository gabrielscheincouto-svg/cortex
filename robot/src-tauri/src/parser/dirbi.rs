//! Parser tolerante para arquivos DIRBI gerados por sistemas próprios.
//!
//! A IN RFB 2.198/2024 prevê arquivo eletrônico mensal assinado; como layouts
//! podem variar por fornecedor, extraímos CNPJ e período por padrões comuns.

use super::{FileParser, ParseHint};
use regex::Regex;
use std::{fs, path::Path};

pub struct DirbiParser;

impl FileParser for DirbiParser {
    fn parse(&self, path: &Path) -> ParseHint {
        let Ok(content) = fs::read_to_string(path) else { return ParseHint::default() };
        ParseHint {
            cnpj: find_cnpj(&content),
            competencia: find_competencia(&content),
            razao_social: None,
        }
    }
}

fn find_cnpj(content: &str) -> Option<String> {
    let re = Regex::new(r"(?i)(?:cnpj\D*)?(\d{2}\.?\d{3}\.?\d{3}/?\d{4}-?\d{2})").ok()?;
    re.captures(content)
        .and_then(|c| c.get(1))
        .map(|m| digits_only(m.as_str()))
        .filter(|s| s.len() == 14)
}

fn find_competencia(content: &str) -> Option<String> {
    let iso = Regex::new(r"(?i)(?:competencia|periodo|apuracao|pa)\D*(20\d{2})[-/]?([01]\d)").ok()?;
    if let Some(c) = iso.captures(content) {
        return Some(format!("{}-{}", c.get(1)?.as_str(), c.get(2)?.as_str()));
    }
    let br = Regex::new(r"(?i)(?:competencia|periodo|apuracao|pa)\D*([01]\d)[-/](20\d{2})").ok()?;
    br.captures(content).map(|c| format!("{}-{}", c.get(2).unwrap().as_str(), c.get(1).unwrap().as_str()))
}

fn digits_only(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_digit()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extrai_cnpj_e_competencia() {
        let txt = "CNPJ: 12.345.678/0001-90\nCompetencia: 2026-05";
        assert_eq!(find_cnpj(txt).as_deref(), Some("12345678000190"));
        assert_eq!(find_competencia(txt).as_deref(), Some("2026-05"));
    }
}
