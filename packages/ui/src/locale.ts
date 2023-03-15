import { createTranslator } from './domain/locale'

export const messages = {
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
