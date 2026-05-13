# Templates

`ci.yml.template` é o GitHub Actions CI pronto pra rodar. Pra ativá-lo:

```bash
mkdir -p .github/workflows
cp .github/templates/ci.yml.template .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: ativa GitHub Actions"
git push
```

Pra push funcionar, o seu Personal Access Token precisa do scope `workflow`
(além de `repo`). Gerar novo em https://github.com/settings/tokens/new.
