import { useCallback, useRef } from 'react'
import { PixelImage } from './effect/PixelImage'
import type { MaskCorners } from './effect/mosaic'
import { Panel } from './effect/Panel'
import { SettingsProvider } from './effect/settings'
import { MakeGraphic, PickGraphic, PromptGraphic } from './motion/StepGraphics'
import './App.css'

const img = (name: string) => `/img/${name}`

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

/** photo with black corner markers that ride along with the mask reveal */
function FramedPhoto({ src, alt, order }: { src: string; alt: string; order: number }) {
  const corners = useRef<(HTMLElement | null)[]>([])
  const onMaskFrame = useCallback((c: MaskCorners | null) => {
    CORNERS.forEach((k, i) => {
      const el = corners.current[i]
      if (el) el.style.transform = c ? `translate(${c[k].x}px, ${c[k].y}px)` : ''
    })
  }, [])
  return (
    <div className="framed">
      {CORNERS.map((k, i) => (
        <i key={k} ref={(el) => void (corners.current[i] = el)} className={`corner ${k}`} />
      ))}
      <PixelImage src={src} alt={alt} className="framed-img" order={order} onMaskFrame={onMaskFrame} />
    </div>
  )
}

function Nav() {
  return (
    <header className="nav">
      <a href="#" className="nav-logo" aria-label="Base44 × NYU home">
        <img src={img('logo-nav.svg')} alt="" width={121} height={48} />
      </a>
      <nav className="nav-links">
        <a href="#">Home</a>
        <a href="#ambassadors">At NYU</a>
        <a href="#start">Projects</a>
      </nav>
      <a href="#" className="btn-cta btn-cta--dark btn-cta--nav">
        Start building
      </a>
    </header>
  )
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-media">
        <video className="fill hero-video" poster={img('hero.png')} autoPlay muted loop playsInline preload="auto" aria-hidden>
          <source src={img('harmonic-hd.webm')} type="video/webm" />
          <source src={img('harmonic-hd.mp4')} type="video/mp4" />
        </video>
      </div>
      <div className="hero-copy dots">
        <div className="hero-text">
          <h1 className="t-title-l">Bring your idea to life with Base 44.</h1>
          <p className="t-p-s">Turn ideas into apps and websites with Base44. No coding needed — just start building.</p>
        </div>
        <a href="#start" className="link-circled hero-link">
          <img src={img('arrow-circle.svg')} alt="" />
          Get Started
        </a>
      </div>
    </section>
  )
}

const AMBASSADORS = [
  { name: 'Tash Lin', photo: 'amb-tash.png' },
  { name: 'Sandra Wesley', photo: 'amb-sandra.png' },
  { name: 'Jackson Tao', photo: 'amb-jackson.png' },
]

function Ambassadors() {
  return (
    <section className="amb" id="ambassadors">
      <div className="amb-intro">
        <PixelImage src={img('amb-icon.png')} className="amb-icon" />
        <div className="amb-intro-text">
          <h2 className="t-title-xs">Meet Your NYU Ambassadors</h2>
          <p className="t-p-s">Tash is an NYU student who loves using Base44 to turn random ideas into fun, experimental projects.</p>
        </div>
      </div>
      <div className="amb-list">
        {AMBASSADORS.map((a, i) => (
          <article key={a.name} className="amb-card">
            <FramedPhoto src={img(a.photo)} alt={a.name} order={i} />
            <div className="amb-meta">
              <h3 className="t-h-xs-d">{a.name}</h3>
              <p className="t-p-xs">School / Major • Class of 20XX</p>
              <p className="t-p-xxs">
                Tash is an NYU student who loves using Base44 to turn random ideas into fun, experimental projects. Outside of school, she loves film
                photography and exploring new coffee shops around NYC.
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

const EVENTS = [
  {
    title: 'Design-a-thon',
    date: '2026-11-02',
    time: '10:00 AM – 6:00 PM',
    desc: 'Team up with other students, tackle a real design challenge, and bring your idea to life with Base44.',
    photo: 'ev-designathon.png',
    focusY: 0.2,
    tone: 'orange',
  },
  {
    title: 'Design Mixer',
    date: '2026-11-13',
    time: '6:00 – 9:00 PM',
    desc: 'A networking event with creative panels, social activities, food, drinks, and new people to meet.',
    photo: 'ev-mixer.png',
    focusY: 0.2,
    tone: 'blue',
  },
  {
    title: 'Base44 Workshop',
    date: '2026-12-03',
    time: '5:00 – 7:00 PM',
    desc: 'Learn directly from the Base44 team how to turn a simple prompt into a product you can ship.',
    photo: 'ev-workshop.png',
    focusY: 0.6,
    tone: 'green',
  },
]

function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function Events() {
  return (
    <section className="events">
      <header className="ev-head">
        <div className="ev-head-title">
          <span className="ev-eyebrow">Fall 2026</span>
          <h2 className="ev-title">Upcoming Events</h2>
        </div>
        <div className="ev-intro">
          <img src={img('arrow-circle-light.svg')} alt="" width={26} height={26} />
          <p>Design-a-thon, networking events, and workshops hosted by Base44 and UX Club NYU.</p>
        </div>
      </header>

      <ul className="ev-grid">
        {EVENTS.map((e, i) => {
          const d = parseDay(e.date)
          const date = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          return (
            <li key={e.title} className="ev-card">
              <PixelImage src={img(e.photo)} alt="" className="ev-photo" focusY={e.focusY} order={i} />
              <div className="ev-body">
                <time dateTime={e.date} className="ev-date">
                  {date} · {e.time}
                </time>
                <h3 className="ev-name">{e.title}</h3>
                <p className="ev-desc">{e.desc}</p>
                <div className="ev-foot">
                  <span>Kimmel Center, FL 2</span>
                  <a href="#" className="link-tertiary">
                    Register <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const STEPS = [
  {
    title: 'Pick a template',
    body: 'Find a project that’s close to what you want to build. Choose from websites, tools, and apps to get a head start.',
    Visual: PickGraphic,
  },
  {
    title: 'Prompt it',
    body: 'Tell Base44 what you want to change in plain English. Add features, switch things up, or take the project in a completely new direction.',
    Visual: PromptGraphic,
  },
  {
    title: 'Make it yours',
    body: 'Keep prompting, tweaking and testing until you’ve created something you actually want to use.',
    Visual: MakeGraphic,
  },
]

function GettingStarted() {
  return (
    <section className="start" id="start">
      <div className="start-intro">
        <h2 className="t-title-m">
          Build it.
          <br />
          Try it.
          <br />
          Keep going.
        </h2>
        <p className="t-p-m">Start with a template, tell Base44 what you want to change, and make it yours</p>
        <a href="#" className="btn-cta btn-cta--orange">
          Explore Templates
        </a>
      </div>
      <ol className="start-steps">
        {STEPS.map((s) => (
          <li key={s.title}>
            <s.Visual />
            <div className="step-text">
              <h3 className="t-h-m">{s.title}</h3>
              <p className="t-p-m">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const PERKS = [
  '50% off Starter or Builder Plan up to 12 months',
  'Build unlimited apps with your own custom domain',
  'Verify with your NYU email, your account can stay on a personal email',
]

const CLAIM = [
  { n: '01', title: 'Verify your NYU email', body: 'Open the discount banner on your Plans page and enter your NYU email.' },
  { n: '02', title: 'Enter the code', body: 'Base44 sends a 6-digit code to your inbox. Type it in to confirm it’s you.' },
  { n: '03', title: 'Activate and subscribe', body: 'Pick Starter or Builder plan, discount applied at checkout.' },
]

function Discount() {
  return (
    <section className="discount dots">
      <div className="discount-top">
        <div className="discount-copy">
          <h2 className="t-title-m">Students Discount</h2>
          <ul className="perks">
            {PERKS.map((p) => (
              <li key={p}>
                <img src={img('compass.svg')} alt="" width={30} height={30} />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <a href="#" className="btn-cta btn-cta--dark btn-claim">
            Claim Student Discount
          </a>
        </div>
        <PixelImage src={img('discount.png')} alt="Students working together at a table" className="discount-art" fit="contain" />
      </div>
      <div className="claim">
        <h3 className="claim-title">
          <img src={img('arrow-circle.svg')} alt="" width={26} height={26} />
          How to Claim
        </h3>
        <div className="claim-cards">
          {CLAIM.map((c) => (
            <div key={c.n} className="claim-card">
              <div className="claim-head">
                <span className="claim-n">{c.n}</span>
                <span>{c.title}</span>
              </div>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WalkIn() {
  return (
    <section className="walk">
      <p className="t-title-xs">Walk in curious.</p>
      <PixelImage src={img('walk.png')} alt="" className="walk-art" fit="contain" />
      <p className="t-title-xs">Walk out a builder.</p>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div className="footer-brand">
          <img src={img('logo-footer-dark.svg')} alt="Base44 × UXC NYU" width={127} height={38} />
          <p>Some filler text idk maybe like last updated or idk a contact maybe tash has some ideas</p>
          <div className="socials">
            {[0, 1, 2, 3].map((i) => (
              <a key={i} href="#" aria-label="X (Twitter)">
                <img src={img('x-icon-dark.svg')} alt="" width={22} height={22} />
              </a>
            ))}
          </div>
        </div>
        <div className="footer-links">
          <div>
            <h4>Resources</h4>
            <a href="#">Base44 Website</a>
            <a href="#">Student Ambassador</a>
          </div>
          <div>
            <h4>Navigation</h4>
            <a href="#">Home</a>
            <a href="#ambassadors">At NYU</a>
            <a href="#">Events</a>
            <a href="#start">Projects</a>
          </div>
        </div>
      </div>
      <p className="footer-legal">© 2026 UX Club NYU × Base44</p>
      <PixelImage src={img('footer-blocks.png')} alt="" className="footer-blocks" fit="contain" />
    </footer>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <div className="page">
        <Nav />
        <Hero />
        <Ambassadors />
        <Events />
        <GettingStarted />
        <Discount />
        <WalkIn />
        <Footer />
      </div>
      <Panel />
    </SettingsProvider>
  )
}
