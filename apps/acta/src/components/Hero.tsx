import { currentLocale, formatNumber } from '@essentia/ui'
import { t } from '../locale'
interface HeroProps {
  total: number
  done: number
  progress: number
}

export function Hero({ total, done, progress }: HeroProps) {
  const today = new Date().toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'short' })

  return (
    <section className="hero" aria-labelledby="acta-title">
      <p className="label hero__day">{today}</p>
      <h1 id="acta-title" className="hero__title">
        {t('Your ')}<em>{t("tasks")}</em>
      </h1>
      {total > 0 && (
        <div className="progress">
          <div
            className="progress__track"
            role="progressbar"
            aria-label={t("Tasks done")}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={t('{done} of {total} done', { done: formatNumber(done), total: formatNumber(total) })}
          >
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="label progress__count">
            {t("{done} of {total} done", { done: formatNumber(done), total: formatNumber(total) })}
          </span>
        </div>
      )}
    </section>
  )
}
