interface HeroProps {
  total: number
  done: number
  progress: number
}

export function Hero({ total, done, progress }: HeroProps) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <section className="hero" aria-labelledby="acta-title">
      <p className="label hero__day">{today}</p>
      <h1 id="acta-title" className="hero__title">
        Your <em>tasks</em>
      </h1>
      {total > 0 && (
        <div className="progress">
          <div
            className="progress__track"
            role="progressbar"
            aria-label="Tasks done"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${done} of ${total} done`}
          >
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="label progress__count">
            {done} of {total} done
          </span>
        </div>
      )}
    </section>
  )
}
