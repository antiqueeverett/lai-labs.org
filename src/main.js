import './styles.css'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="page-shell" aria-labelledby="hero-title">
    <section class="hero-card">
      <div class="brand-row" aria-label="LAI Labs">
        <span class="brand-mark">LAI</span>
        <span class="brand-name">LAI Labs</span>
      </div>

      <p class="eyebrow">Learning. Applied. Intelligence.</p>

      <h1 id="hero-title">Building what comes next.</h1>

      <p class="hero-copy">
        We are shaping practical AI systems for real-world decisions.
        The full site is coming soon.
      </p>

      <div class="status-strip" aria-label="Launch status">
        <span class="pulse" aria-hidden="true"></span>
        <span>Studio online soon</span>
      </div>
    </section>
  </main>
`
