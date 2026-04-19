import type { HTMLAttributes, ReactNode } from 'react'
import './OverlayScreen.css'

function joinClassNames(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ')
}

export interface OverlayScreenProps {
  ariaLabel?: string
  backdropClassName?: string
  bodyClassName?: string
  cardClassName?: string
  children: ReactNode
  description?: string
  eyebrow?: string
  footer?: ReactNode
  onBackdropMouseDown?: HTMLAttributes<HTMLDivElement>['onMouseDown']
  onKeyDown?: HTMLAttributes<HTMLDivElement>['onKeyDown']
  title: string
}

export function OverlayScreen({
  ariaLabel,
  backdropClassName,
  bodyClassName,
  cardClassName,
  children,
  description,
  eyebrow,
  footer,
  onBackdropMouseDown,
  onKeyDown,
  title,
}: OverlayScreenProps) {
  return (
    <div
      className={joinClassNames('mf-overlay-screen-backdrop', backdropClassName)}
      onKeyDown={onKeyDown}
      onMouseDown={onBackdropMouseDown}
    >
      <section
        className={joinClassNames('mf-overlay-screen-card', cardClassName)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel ?? title}
      >
        <header className="mf-overlay-screen-header">
          {eyebrow ? <span className="mf-overlay-screen-eyebrow">{eyebrow}</span> : null}
          <h2 className="mf-overlay-screen-title">{title}</h2>
          {description ? <p className="mf-overlay-screen-description">{description}</p> : null}
        </header>
        <div className={joinClassNames('mf-overlay-screen-body', bodyClassName)}>{children}</div>
        {footer ? <footer className="mf-overlay-screen-footer">{footer}</footer> : null}
      </section>
    </div>
  )
}
