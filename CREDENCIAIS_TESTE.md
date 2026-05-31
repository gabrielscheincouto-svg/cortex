# Credenciais de teste · Cortex 2.0

> ⚠ Documento sensível. Não comitar com credenciais reais — só de TESTE.

## URLs

| App | URL |
|---|---|
| Escritório (web) | https://usecortex-app.netlify.app |
| Admin Cecopel | https://usecortex-admin.netlify.app |
| PWA Cliente | https://usecortex-cliente.netlify.app |
| Supabase Studio | https://supabase.com/dashboard/project/ocbohmnmqtnrcwgvenus |

---

## 👔 Escritório — Admin (você)

| | |
|---|---|
| URL | https://usecortex-app.netlify.app |
| Email | `gabrielscheincouto@gmail.com` |
| Senha | *a que você já usa* |
| Papel | admin da org **Cortex Demo** |

## 👨‍💼 Escritório — Gerente (criado para teste)

| | |
|---|---|
| URL | https://usecortex-app.netlify.app |
| Email | `gerente.demo@usecortex.com.br` |
| Senha | `CortexGerente2026` |
| Cargo | Gerente Operacional |
| Salário base | R$ 8.500 |

---

## 🏪 Cliente — Padaria Bom Pão (dados ricos)

| | |
|---|---|
| URL | https://usecortex-cliente.netlify.app |
| Email | `dono.bompao@usecortex.com.br` |
| Senha | `BomPao2026` |
| Empresa | Padaria Bom Pão Ltda |
| CNPJ | 22.555.888/0001-70 |

**O que ver aqui:**
- 4 obrigações **atrasadas** (DCTFWeb 04/26, SPED 04/26, DIRBI 04/26, eSocial 03/26)
- 4 obrigações **vencendo** (DCTFWeb 05/26 em 3 dias, eSocial 05/26 em 5 dias…)
- 4 obrigações **entregues** (Balancetes mar/abr + DCTFWeb 03/26 + eSocial 02/26)
- **3 balancetes** com 18 contas (fev, mar, abr)
- Balancete de abril tem **2 problemas plantados pra auditoria detectar** (receita zerada, despesa de energia 3× da média)
- **5 notificações** no sino
- **3 chamados** em estados diferentes (nova, em atendimento, resolvida)

## 🏬 Cliente — Modelo (mais simples)

| | |
|---|---|
| URL | https://usecortex-cliente.netlify.app |
| Email | `cliente.teste@cortex.dev` |
| Senha | `Cortex@Teste2026` |
| Empresa | Cliente Modelo Comércio Ltda |
| CNPJ | 11.444.777/0001-61 |

4 entregas, 3 notificações, 1 chamado. Use pra primeiros testes mais simples.

---

## Como recuperar / resetar senha

Via Supabase Studio:

1. https://supabase.com/dashboard/project/ocbohmnmqtnrcwgvenus
2. Authentication → Users
3. Clica nos três pontinhos do usuário → **Send password recovery**

Ou via SQL (mais rápido):

```sql
UPDATE auth.users
SET encrypted_password = crypt('NovaSenha123', gen_salt('bf', 10))
WHERE email = 'email@dominio.com';
```
