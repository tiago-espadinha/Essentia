import { AppHeader } from './AppHeader'

export default function App() {
  return (
    <>
      <AppHeader />
      <main className="virtus">
        <section className="hero" aria-labelledby="virtus-title">
          <h1 id="virtus-title" className="hero__title">
            Your <em>habits</em>
          </h1>
        </section>
      </main>
    </>
  )
}
