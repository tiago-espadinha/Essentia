// The apps the hub lists, and the dev ports it proxies to under one origin.
// Each app adds itself here when it joins the suite.
export interface SuiteApp {
  name: string
  path: string
  latin: string
  description: string
  port: number
}

export const suiteApps: SuiteApp[] = [
  {
    name: 'Folio',
    path: '/folio/',
    latin: 'a leaf',
    description: 'Notes with rich text, tags and pins.',
    port: 5101,
  },
  {
    name: 'Acta',
    path: '/acta/',
    latin: 'things done',
    description: 'Tasks with categories, due dates and filters.',
    port: 5102,
  },
]
