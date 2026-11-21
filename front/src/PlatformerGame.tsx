import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import './PlatformerGame.css'

// An original side-scrolling platformer: guide the little container bot
// past the bugs, grab the coins and reach the deploy flag.

const TILE = 32
const VIEW_W = 640
const VIEW_H = 320
const GRAVITY = 1800
const MOVE_SPEED = 220
const JUMP_SPEED = 640
const ENEMY_SPEED = 60

// Legend:
//   # ground   = brick   ? coin box   o coin   E bug enemy   F flag   P player start
// The level is built from placements so every row has the same width.
// Jump height is ~3.5 tiles and a jump spans ~4.5 tiles, so all gaps are clearable.
const COLS = 90
const ROWS = 10
const LEVEL: string[] = (() => {
  const g = Array.from({ length: ROWS }, () => Array<string>(COLS).fill(' '))
  const put = (r: number, c: number, s: string) => s.split('').forEach((ch, i) => (g[r][c + i] = ch))
  const gaps = new Set([24, 25, 26, 47, 48, 49, 70, 71])
  for (let c = 0; c < COLS; c++) if (!gaps.has(c)) g[9][c] = '#'
  put(8, 3, 'P')
  put(5, 10, '?')
  put(5, 15, '=?=')
  put(7, 19, 'o o o')
  put(6, 30, '=====')
  put(5, 30, 'o o o')
  put(3, 37, '====')
  put(2, 37, 'oooo')
  put(5, 52, '?=?')
  put(6, 60, '====')
  put(5, 60, 'oooo')
  // Staircase before the finish
  put(8, 74, '###')
  put(7, 75, '##')
  put(6, 76, '#')
  for (const c of [20, 40, 58, 64, 81]) g[8][c] = 'E'
  put(4, 85, 'F')
  return g.map((row) => row.join(''))
})()
const FLAG_COL = LEVEL[4].indexOf('F')
const WORLD_W = COLS * TILE

type Enemy = { x: number; y: number; vx: number; vy: number; alive: boolean }
type Coin = { x: number; y: number; taken: boolean }
type Pop = { x: number; y: number; t: number }
type Status = 'ready' | 'playing' | 'dead' | 'won'

type World = {
  tiles: string[][]
  player: { x: number; y: number; vx: number; vy: number; onGround: boolean; facing: 1 | -1 }
  enemies: Enemy[]
  coins: Coin[]
  pops: Pop[]
  camX: number
  score: number
  coinCount: number
  status: Status
  time: number
}

const PW = 22
const PH = 28
const EW = 26
const EH = 22

function buildWorld(): World {
  const tiles: string[][] = []
  const enemies: Enemy[] = []
  const coins: Coin[] = []
  let px = TILE
  let py = TILE
  LEVEL.forEach((row, r) => {
    tiles.push(
      row.split('').map((ch, c) => {
        const x = c * TILE
        const y = r * TILE
        if (ch === 'P') {
          px = x + (TILE - PW) / 2
          py = y + TILE - PH
          return ' '
        }
        if (ch === 'E') {
          enemies.push({ x: x + (TILE - EW) / 2, y: y + TILE - EH, vx: -ENEMY_SPEED, vy: 0, alive: true })
          return ' '
        }
        if (ch === 'o') {
          coins.push({ x: x + TILE / 2, y: y + TILE / 2, taken: false })
          return ' '
        }
        return ch
      }),
    )
  })
  return {
    tiles,
    player: { x: px, y: py, vx: 0, vy: 0, onGround: false, facing: 1 },
    enemies,
    coins,
    pops: [],
    camX: 0,
    score: 0,
    coinCount: 0,
    status: 'ready',
    time: 0,
  }
}

function tileAt(w: World, c: number, r: number) {
  if (c < 0 || c >= COLS) return '#'
  if (r < 0 || r >= ROWS) return ' '
  return w.tiles[r][c]
}

function isSolid(ch: string) {
  return ch === '#' || ch === '=' || ch === '?' || ch === 'x'
}

type Body = { x: number; y: number; vx: number; vy: number }

// Move a body along one axis and resolve tile collisions.
// Returns which sides were hit, plus the tile hit from below (for coin boxes).
function moveAndCollide(w: World, b: Body, bw: number, bh: number, dt: number) {
  const hit = { left: false, right: false, top: false, bottom: false, headTile: null as null | [number, number] }

  b.x += b.vx * dt
  const top = Math.floor(b.y / TILE)
  const bottom = Math.floor((b.y + bh - 1) / TILE)
  if (b.vx > 0) {
    const c = Math.floor((b.x + bw) / TILE)
    for (let r = top; r <= bottom; r++) {
      if (isSolid(tileAt(w, c, r))) {
        b.x = c * TILE - bw
        hit.right = true
        break
      }
    }
  } else if (b.vx < 0) {
    const c = Math.floor(b.x / TILE)
    for (let r = top; r <= bottom; r++) {
      if (isSolid(tileAt(w, c, r))) {
        b.x = (c + 1) * TILE
        hit.left = true
        break
      }
    }
  }

  b.y += b.vy * dt
  const left = Math.floor(b.x / TILE)
  const right = Math.floor((b.x + bw - 1) / TILE)
  if (b.vy > 0) {
    const r = Math.floor((b.y + bh) / TILE)
    for (let c = left; c <= right; c++) {
      if (isSolid(tileAt(w, c, r))) {
        b.y = r * TILE - bh
        b.vy = 0
        hit.bottom = true
        break
      }
    }
  } else if (b.vy < 0) {
    const r = Math.floor(b.y / TILE)
    // Prefer the tile under the body's centre when bumping a box
    const mid = Math.floor((b.x + bw / 2) / TILE)
    const order = [mid, left, right]
    for (const c of order) {
      if (isSolid(tileAt(w, c, r))) {
        b.y = (r + 1) * TILE
        b.vy = 0
        hit.top = true
        hit.headTile = [c, r]
        break
      }
    }
  }
  return hit
}

function overlaps(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by
}

function update(w: World, keys: Set<string>, dt: number) {
  w.time += dt
  w.pops = w.pops.filter((p) => (p.t += dt) < 0.5)
  if (w.status !== 'playing') return

  const p = w.player
  const left = keys.has('ArrowLeft') || keys.has('KeyA')
  const right = keys.has('ArrowRight') || keys.has('KeyD')
  const jump = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW')

  p.vx = (right ? MOVE_SPEED : 0) - (left ? MOVE_SPEED : 0)
  if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1
  if (jump && p.onGround) p.vy = -JUMP_SPEED
  // Variable jump height: release early for a short hop
  if (!jump && p.vy < -200) p.vy = -200
  p.vy = Math.min(p.vy + GRAVITY * dt, 900)

  const hit = moveAndCollide(w, p, PW, PH, dt)
  p.onGround = hit.bottom
  if (hit.headTile) {
    const [c, r] = hit.headTile
    if (w.tiles[r][c] === '?') {
      w.tiles[r][c] = 'x'
      w.coinCount++
      w.score += 100
      w.pops.push({ x: c * TILE + TILE / 2, y: r * TILE, t: 0 })
    }
  }

  for (const coin of w.coins) {
    if (!coin.taken && overlaps(p.x, p.y, PW, PH, coin.x - 8, coin.y - 8, 16, 16)) {
      coin.taken = true
      w.coinCount++
      w.score += 50
    }
  }

  for (const e of w.enemies) {
    if (!e.alive) continue
    // Only simulate enemies near the camera so they wait for the player
    if (e.x > w.camX + VIEW_W + TILE * 2) continue
    e.vy = Math.min(e.vy + GRAVITY * dt, 900)
    const eh = moveAndCollide(w, e, EW, EH, dt)
    if (eh.left || eh.right) e.vx = -e.vx
    // Turn around at ledges
    if (eh.bottom) {
      const aheadC = Math.floor((e.vx > 0 ? e.x + EW + 1 : e.x - 1) / TILE)
      const belowR = Math.floor((e.y + EH + 1) / TILE)
      if (!isSolid(tileAt(w, aheadC, belowR))) e.vx = -e.vx
    }
    if (e.y > ROWS * TILE) e.alive = false

    if (overlaps(p.x, p.y, PW, PH, e.x, e.y, EW, EH)) {
      if (p.vy > 0 && p.y + PH - e.y < 16) {
        e.alive = false
        p.vy = -JUMP_SPEED * 0.6
        w.score += 200
        w.pops.push({ x: e.x + EW / 2, y: e.y, t: 0 })
      } else {
        w.status = 'dead'
      }
    }
  }

  if (p.y > ROWS * TILE + 64) w.status = 'dead'

  // Touching the flag pole wins
  if (Math.floor((p.x + PW / 2) / TILE) === FLAG_COL) {
    w.status = 'won'
    w.score += 1000
  }

  const target = p.x + PW / 2 - VIEW_W / 2
  w.camX = Math.max(0, Math.min(WORLD_W - VIEW_W, target))
}

function draw(ctx: CanvasRenderingContext2D, w: World) {
  const cam = Math.round(w.camX)

  // Sky
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H)
  sky.addColorStop(0, '#2b1a4a')
  sky.addColorStop(1, '#7a4fd1')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, VIEW_W, VIEW_H)

  // Parallax "server rack" skyline
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (let i = 0; i < 30; i++) {
    const bx = i * 110 - ((cam * 0.3) % 110)
    const bh = 60 + ((i * 37) % 90)
    ctx.fillRect(bx, VIEW_H - TILE - bh, 70, bh)
  }

  ctx.save()
  ctx.translate(-cam, 0)

  const c0 = Math.max(0, Math.floor(cam / TILE))
  const c1 = Math.min(COLS - 1, Math.ceil((cam + VIEW_W) / TILE))
  for (let r = 0; r < ROWS; r++) {
    for (let c = c0; c <= c1; c++) {
      const ch = w.tiles[r][c]
      const x = c * TILE
      const y = r * TILE
      if (ch === '#') {
        ctx.fillStyle = '#3b2f5c'
        ctx.fillRect(x, y, TILE, TILE)
        if (tileAt(w, c, r - 1) !== '#') {
          ctx.fillStyle = '#4ade80'
          ctx.fillRect(x, y, TILE, 6)
        }
      } else if (ch === '=') {
        ctx.fillStyle = '#c2410c'
        ctx.fillRect(x, y, TILE, TILE)
        ctx.strokeStyle = '#7c2d12'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE / 2 - 1)
        ctx.strokeRect(x + 1, y + TILE / 2, TILE - 2, TILE / 2 - 1)
      } else if (ch === '?' || ch === 'x') {
        ctx.fillStyle = ch === '?' ? '#22d3ee' : '#475569'
        ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2)
        if (ch === '?') {
          ctx.fillStyle = '#0e7490'
          ctx.font = 'bold 18px monospace'
          ctx.textAlign = 'center'
          ctx.fillText('$', x + TILE / 2, y + 22)
        }
      } else if (ch === 'F') {
        // Flag pole + banner
        ctx.fillStyle = '#e5e7eb'
        ctx.fillRect(x + TILE / 2 - 2, y, 4, TILE * 5)
        ctx.fillStyle = '#facc15'
        ctx.beginPath()
        ctx.moveTo(x + TILE / 2 + 2, y + 2)
        ctx.lineTo(x + TILE / 2 + 30, y + 12)
        ctx.lineTo(x + TILE / 2 + 2, y + 22)
        ctx.fill()
      }
    }
  }

  // Coins
  for (const coin of w.coins) {
    if (coin.taken) continue
    const squash = Math.abs(Math.sin(w.time * 4 + coin.x))
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.ellipse(coin.x, coin.y, 3 + 5 * squash, 8, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Enemies: little red bugs
  for (const e of w.enemies) {
    if (!e.alive) continue
    ctx.fillStyle = '#ef4444'
    ctx.beginPath()
    ctx.ellipse(e.x + EW / 2, e.y + EH / 2 + 2, EW / 2, EH / 2 - 1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    const leg = Math.sin(w.time * 16) * 3
    for (let i = 0; i < 3; i++) {
      const lx = e.x + 6 + i * 7
      ctx.beginPath()
      ctx.moveTo(lx, e.y + EH - 3)
      ctx.lineTo(lx + (i % 2 ? leg : -leg), e.y + EH + 1)
      ctx.stroke()
    }
    ctx.fillStyle = '#fff'
    const ex = e.vx < 0 ? e.x + 5 : e.x + EW - 11
    ctx.fillRect(ex, e.y + 6, 6, 6)
    ctx.fillStyle = '#111'
    ctx.fillRect(ex + (e.vx < 0 ? 0 : 3), e.y + 8, 3, 3)
  }

  // Player: a container bot
  const p = w.player
  if (w.status !== 'dead' || Math.floor(w.time * 10) % 2 === 0) {
    const px = Math.round(p.x)
    const py = Math.round(p.y)
    ctx.fillStyle = '#38bdf8'
    ctx.fillRect(px, py + 4, PW, PH - 10)
    ctx.fillStyle = '#0369a1'
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 3 + i * 5, py + 8, 2, PH - 18)
    ctx.fillStyle = '#e0f2fe'
    ctx.fillRect(px + (p.facing > 0 ? 12 : 3), py, 7, 7)
    ctx.fillStyle = '#111'
    ctx.fillRect(px + (p.facing > 0 ? 16 : 3), py + 2, 3, 3)
    ctx.fillStyle = '#1e293b'
    const step = p.onGround && p.vx !== 0 ? Math.sin(w.time * 20) * 3 : 0
    ctx.fillRect(px + 2 + step, py + PH - 6, 7, 6)
    ctx.fillRect(px + PW - 9 - step, py + PH - 6, 7, 6)
  }

  // Score pops
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 14px monospace'
  ctx.textAlign = 'center'
  for (const pop of w.pops) ctx.fillText('+', pop.x, pop.y - pop.t * 60)

  ctx.restore()

  // HUD
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'left'
  ctx.fillText(`SCORE ${String(w.score).padStart(5, '0')}`, 12, 22)
  ctx.textAlign = 'right'
  ctx.fillText(`COINS ${w.coinCount}`, VIEW_W - 12, 22)

  if (w.status !== 'playing') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, VIEW_W, VIEW_H)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'center'
    ctx.font = 'bold 28px monospace'
    const title = { ready: 'BUG HOPPER', dead: 'BUILD FAILED', won: 'DEPLOYED!' }[w.status]
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 10)
    ctx.font = '16px monospace'
    ctx.fillText(
      w.status === 'ready' ? 'Click or press Enter to start' : 'Press Enter or click to play again',
      VIEW_W / 2,
      VIEW_H / 2 + 22,
    )
  }
}

export function PlatformerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World>(buildWorld())
  const keysRef = useRef<Set<string>>(new Set())
  const [status, setStatus] = useState<Status>('ready')

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const w = worldRef.current
      update(w, keysRef.current, dt)
      draw(ctx, w)
      setStatus((s) => (s === w.status ? s : w.status))
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const start = () => {
    const w = worldRef.current
    if (w.status === 'playing') return
    if (w.status !== 'ready') worldRef.current = buildWorld()
    worldRef.current.status = 'playing'
    keysRef.current.clear()
    canvasRef.current?.focus()
  }

  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW']

  // Touch controls map to the same key codes
  const hold = (code: string) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault()
      if (worldRef.current.status !== 'playing') start()
      keysRef.current.add(code)
    },
    onPointerUp: () => keysRef.current.delete(code),
    onPointerLeave: () => keysRef.current.delete(code),
    onPointerCancel: () => keysRef.current.delete(code),
  })

  return (
    <section id="game" aria-label="Bug Hopper platformer game">
      <h2>Bug Hopper</h2>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={VIEW_W}
        height={VIEW_H}
        tabIndex={0}
        aria-label={`Game canvas. Status: ${status}. Use arrow keys or A/D to move, Space or Up to jump.`}
        onClick={start}
        onKeyDown={(e) => {
          if (e.code === 'Enter') start()
          if (GAME_KEYS.includes(e.code)) {
            e.preventDefault()
            keysRef.current.add(e.code)
          }
        }}
        onKeyUp={(e) => keysRef.current.delete(e.code)}
        onBlur={() => keysRef.current.clear()}
      />
      <div className="game-touch" aria-hidden="true">
        <button type="button" {...hold('ArrowLeft')}>◀</button>
        <button type="button" {...hold('ArrowRight')}>▶</button>
        <button type="button" className="jump" {...hold('Space')}>⤒</button>
      </div>
      <p className="game-help">
        Click the game, then use <kbd>←</kbd> <kbd>→</kbd> to move and <kbd>Space</kbd> to jump.
        Stomp the bugs, grab the coins and reach the deploy flag!
      </p>
    </section>
  )
}
