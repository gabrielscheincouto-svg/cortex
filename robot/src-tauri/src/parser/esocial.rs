//! Parser XML do eSocial.
//!
//! Extrai o CNPJ do empregador e o período de apuração em eventos periódicos.

use super::{FileParser, ParseHint};
use quick_xml::{events::Event, Reader};
use std::{fs, path::Path};

pub struct EsocialParser;

impl FileParser for EsocialParser {
    fn parse(&self, path: &Path) -> ParseHint {
        let Ok(content) = fs::read_to_string(path) else { return ParseHint::default() };
        parse_xml(&content)
    }
}

fn parse_xml(content: &str) -> ParseHint {
    let mut reader = Reader::from_str(content);
    reader.trim_text(true);
    let mut current = String::new();
    let mut cnpj = None;
    let mut competencia = None;

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => {
                current = String::from_utf8_lossy(e.local_name().as_ref()).to_string();
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().map(|t| t.to_string()).unwrap_or_default();
                match current.as_str() {
                    "nrInsc" if cnpj.is_none() => {
                        let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
                        if digits.len() == 14 { cnpj = Some(digits); }
                    }
                    "perApur" | "perRef" if competencia.is_none() => {
                        competencia = normalize_periodo(&text);
                    }
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
    }

    ParseHint { cnpj, competencia, razao_social: None }
}

fn normalize_periodo(s: &str) -> Option<String> {
    let text = s.trim();
    if text.len() >= 7 && text.as_bytes().get(4) == Some(&b'-') {
        return Some(text[..7].to_string());
    }
    let digits: String = text.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() == 6 {
        return Some(format!("{}-{}", &digits[0..4], &digits[4..6]));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extrai_xml_esocial() {
        let xml = r#"<eSocial><evtRemun><ideEmpregador><tpInsc>1</tpInsc><nrInsc>12345678000190</nrInsc></ideEmpregador><ideEvento><perApur>2026-05</perApur></ideEvento></evtRemun></eSocial>"#;
        let hint = parse_xml(xml);
        assert_eq!(hint.cnpj.as_deref(), Some("12345678000190"));
        assert_eq!(hint.competencia.as_deref(), Some("2026-05"));
    }
}
