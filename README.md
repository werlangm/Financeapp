# App de Financas (Web)

Aplicativo web de financas pessoais com UI estatica em HTML/CSS/JS e servidor Node simples para servir a pagina e os dados iniciais.

## Estrutura
- `web/` interface web estatica
- `web/finance.seed.json` base inicial carregada pelo navegador
- `server.js` servidor HTTP simples
- `package.json` scripts de execucao para ambiente local ou hospedado
- `data/` arquivos auxiliares e dados usados em outras iteracoes do projeto

## Executar
```bash
npm install
npm start
```
Acesse `http://localhost:3000`.

## Publicar em um repositorio GitHub
1. Crie um repositorio vazio no GitHub.
2. Copie o conteudo desta pasta para o repositorio.
3. Execute:
```bash
git init
git add .
git commit -m "Add finance web app"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Conectar ao Codex Web
1. No ChatGPT, abra o Codex.
2. Conecte sua conta do GitHub, se ainda nao estiver conectada.
3. Selecione o repositorio publicado.
4. Crie ou selecione o ambiente associado ao repositorio.
5. Abra o projeto no Codex Web para editar, revisar e rodar tarefas sobre ele.

## Observacoes
- O app atual nao depende de framework de build.
- O deploy pode ser feito em qualquer host que execute Node.js ou sirva os arquivos estaticos com fallback simples.
- O Codex Web nao hospeda a pagina publica por si; ele trabalha conectado ao repositorio e ao ambiente do projeto.
