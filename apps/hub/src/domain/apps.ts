// The apps the hub lists, and the dev ports it proxies to under one origin.
// Each app adds itself here when it joins the suite.
export interface SuiteApp {
  name: string
  path: string
  latin: string
  catchphrase?: string
  aliases?: string[]
  description: string
  port: number
}

export const suiteApps: SuiteApp[] = [
  {
    name: 'Folio',
    catchphrase: 'Your Notes',
    path: '/folio/',
    latin: 'a leaf',
    description: 'Notes with rich text, tags and pins.',
    port: 5101,
  },
  {
    name: 'Acta',
    catchphrase: 'Your Tasks',
    path: '/acta/',
    latin: 'things done',
    description: 'Tasks with categories, due dates and filters.',
    port: 5102,
  },
  {
    name: 'Virtus',
    catchphrase: 'Your Habits',
    path: '/virtus/',
    latin: 'strength of character',
    description: 'Habits with streaks, a heatmap and badges.',
    port: 5103,
  },
  {
    name: 'Dictum',
    path: '/dictum/',
    latin: 'a thing said',
    description: 'Markdown writing with a live preview and versions.',
    port: 5104,
  },
  {
    name: 'Merces',
    catchphrase: 'Your Money',
    path: '/merces/',
    aliases: ['/aurum/'],
    latin: 'earnings',
    description: 'Income and expenses, filtered and summed, in your account.',
    port: 5105,
  },
]
