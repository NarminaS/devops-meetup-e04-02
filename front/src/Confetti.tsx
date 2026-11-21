import type { CSSProperties } from 'react'
import type { ConfettiPiece } from './confettiBurst'
import './Confetti.css'

export function Confetti({ pieces }: { pieces: ConfettiPiece[] }) {
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className={p.round ? 'confetti-piece round' : 'confetti-piece'}
          style={
            {
              left: p.x,
              top: p.y,
              width: p.size,
              height: p.round ? p.size : p.size * 0.45,
              background: p.color,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--rot': `${p.rotate}deg`,
              animationDuration: `${p.duration}ms`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}
