import { createTranslator } from './domain/locale'

export const messages = {
  "Search": "Pesquisar",
  "Find an app": "Encontrar uma aplicação",
  "Find an app or a record": "Encontrar uma aplicação ou um registo",
  "Loading records…": "A carregar registos…",
  "Records are unavailable. You can still open an app.": "Os registos estão indisponíveis. Pode abrir uma aplicação.",
  "Choose an app, or type to find records in this app.": "Escolha uma aplicação ou escreva para encontrar registos nesta aplicação.",
  "No results. Try another search.": "Sem resultados. Tente outra pesquisa.",
  "{shown} of {total} matching records": "{shown} de {total} registos encontrados",
  "Choose an app.": "Escolha uma aplicação.",
  "Search results": "Resultados da pesquisa",
  "Apps": "Aplicações",
  "Untitled": "Sem título",
  "↑ ↓ to choose · Enter to open · Esc to close": "↑ ↓ para escolher · Enter para abrir · Esc para fechar",
  "Language": "Idioma",
  "Language changed for this page. Your browser could not save it.": "Idioma alterado nesta página. O navegador não conseguiu guardá-lo.",
  "Accent": "Cor de destaque",
  "Terracotta": "Terracota",
  "Blue": "Azul",
  "Violet": "Violeta",
  "Accent changed for this page. Your browser could not save it.": "Cor alterada nesta página. O navegador não conseguiu guardá-la.",
  "Dark theme": "Tema escuro",
  "Back to ": "Voltar a ",
  "Close": "Fechar"
}
export const t = createTranslator(messages)
