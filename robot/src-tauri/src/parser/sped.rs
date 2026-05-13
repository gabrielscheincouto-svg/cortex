//! Parser leve do registro 0000 do SPED.
//!
//! O registro 0000 (cabeçalho) tem este layout aproximado:
//!   |0000|DD_MM_YYYY|DD_MM_YYYY|RAZAO_SOCIAL|CNPJ|...
//!
//! Lemos só a primeira linha não-vazia do arquivo e extraímos CNPJ e competência (do DT_INI).

use super::{FileParser, ParseHint};
use std::{fs::File, io::{BufRead, BufReader}, path::Path};

pub struct SpedParser;

impl FileParser for SpedParser {
    fn parse(&self, path: &Path) -> ParseHint {
        let Ok(file) = File::open(path) else { return ParseHint::default() };
        let mut reader = BufReader::new(file);
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() || line.is_empty() {
            return ParseHint::default();
        }

        // Campos delimitados por '|'. Ignora o vazio inicial/final.
        let parts: Vec<&str> = line.trim_end_matches('\n').split('|').collect();
        if parts.len() < 6 || parts.get(1).map(|s| *s) != Some("0000") {
            return ParseHint::default();
        }

        let dt_ini       = parts.get(2).map(|s| s.trim()).unwrap_or("");
        let razao_social = parts.get(4).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let cnpj_raw     = parts.get(5).map(|s| s.trim()).unwrap_or("");

        ParseHint {
            cnpj: digits_only(cnpj_raw).filter(|s| s.len() == 14),
            competencia: dt_ini_to_competencia(dt_ini),
            razao_social,
        }
    }
}

fn digits_only(s: &str) -> Option<String> {
    let out: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if out.is_empty() { None } else { Some(out) }
}

/// DD_MM_YYYY (ou ddmmyyyy) → "YYYY-MM"
fn dt_ini_to_competencia(s: &str) -> Option<String> {
    let digits = digits_only(s)?;
    if digits.len() != 8 { return None; }
    let mm = &digits[2..4];
    let yyyy = &digits[4..8];
    Some(format!("{yyyy}-{mm}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parse_competencia() {
        assert_eq!(dt_ini_to_competencia("01_05_2026").as_deref(), Some("2026-05"));
        assert_eq!(dt_ini_to_competencia("01052026").as_deref(),    Some("2026-05"));
        assert_eq!(dt_ini_to_competencia(""),                       None);
    }
}
