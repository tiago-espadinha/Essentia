// The apps the hub lists, and the dev ports it proxies to under one origin.
// Each app adds itself here when it joins the suite; a retired app stays for
// the proxy, since its page still points people on, but is no longer listed.
export interface SuiteApp {
  name: string
  path: string
  latin: string
  catchphrase?: string
  aliases?: string[]
  port: number
  retired?: true
}

export const suiteApps: SuiteApp[] = [
  {
    name: 'Folio',
    catchphrase: 'Your Notes',
    path: '/folio/',
    latin: 'a leaf',
    port: 5101,
  },
  {
    name: 'Acta',
    catchphrase: 'Your Tasks',
    path: '/acta/',
    latin: 'things done',
    port: 5102,
  },
  {
    name: 'Virtus',
    catchphrase: 'Your Habits',
    path: '/virtus/',
    latin: 'strength of character',
    port: 5103,
  },
  {
    name: 'Dictum',
    path: '/dictum/',
    latin: 'a thing said',
    port: 5104,
    // Part of Folio now: /dictum/ says so and links there.
    retired: true,
  },
  {
    name: 'Merces',
    catchphrase: 'Your Money',
    path: '/merces/',
    aliases: ['/aurum/'],
    latin: 'earnings',
    port: 5105,
  },
]
