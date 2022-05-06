import { AppHeader } from './AppHeader'

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })

export default function App() {
  return (
    <>
      <AppHeader />
      <main className="acta">
        <section className="hero" aria-labelledby="acta-title">
          <p className="label hero__day">{today}</p>
          <h1 id="acta-title" className="hero__title">
            Your <em>tasks</em>
          </h1>
        </section>
      </main>
    </>
  )
}
