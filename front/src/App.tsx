import { useState } from 'react'
import type { MouseEvent } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import { Confetti } from './Confetti'
import { MAX_CONFETTI_DURATION_MS, createBurst } from './confettiBurst'
import type { ConfettiPiece } from './confettiBurst'
import { PlatformerGame } from './PlatformerGame'
import './App.css'

const CELEBRATION_COUNT = 10

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function App() {
  const [count, setCount] = useState(0)
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([])

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const next = count + 1
    setCount(next)

    if (prefersReducedMotion()) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    let pieces = createBurst(x, y, 30)
    if (next === CELEBRATION_COUNT) {
      // Big celebration: extra bursts across the top of the screen
      pieces = pieces.concat(
        createBurst(window.innerWidth * 0.2, window.innerHeight * 0.3, 60),
        createBurst(window.innerWidth * 0.5, window.innerHeight * 0.2, 60),
        createBurst(window.innerWidth * 0.8, window.innerHeight * 0.3, 60),
      )
    }
    setConfetti((current) => current.concat(pieces))

    // Remove this burst once every piece has finished animating
    const ids = new Set(pieces.map((p) => p.id))
    window.setTimeout(() => {
      setConfetti((current) => current.filter((p) => !ids.has(p.id)))
    }, MAX_CONFETTI_DURATION_MS + 100)
  }

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>DevOps Meetup Team 02</h1>
          <p>
            Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button type="button" className="counter" onClick={handleClick}>
          Count is {count}
        </button>
        <p className="celebration" role="status" aria-live="polite">
          {count === CELEBRATION_COUNT && (
            <span>🎉 You reached {CELEBRATION_COUNT}! Party time! 🎉</span>
          )}
        </p>
      </section>

      <PlatformerGame />

      <Confetti pieces={confetti} />

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
