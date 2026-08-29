/* =============================================
   BIRTHDAY ENGINE — Particles, Confetti, Effects
   ============================================= */

// ===== FLOATING PARTICLES =====
(function initParticles() {
  const canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const colors = ['#d4a853', '#e8a0bf', '#c9b1ff', '#f5d69e', '#f8bbd0'];

  class Particle {
    constructor(randomY) {
      this.x = Math.random() * canvas.width;
      this.y = randomY ? Math.random() * canvas.height : canvas.height + 10;
      this.size = Math.random() * 4 + 1;
      this.speedY = -(Math.random() * 1.5 + 0.3);
      this.speedX = (Math.random() - 0.5) * 0.8;
      this.opacity = Math.random() * 0.6 + 0.2;
      this.color = colors[Math.floor(Math.random() * colors.length)];
      this.isStar = Math.random() > 0.6;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.y * 0.01) * 0.3;
      this.opacity -= 0.001;
      if (this.y < -10 || this.opacity <= 0) this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height + 10;
      this.opacity = Math.random() * 0.6 + 0.2;
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.color;
      if (this.isStar) {
        ctx.font = `${this.size * 6}px serif`;
        ctx.fillText('✦', this.x, this.y);
      } else {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  for (let i = 0; i < 50; i++) particles.push(new Particle(true));

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();
})();

// ===== CONFETTI ENGINE =====
const ConfettiEngine = (function () {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let pieces = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const confettiColors = [
    '#d4a853', '#e8a0bf', '#c9b1ff', '#f5d69e', '#c94b7c',
    '#f8bbd0', '#ff6b6b', '#48dbfb', '#feca57', '#ff9ff3'
  ];

  class Piece {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = -20;
      this.size = Math.random() * 10 + 5;
      this.speedY = Math.random() * 5 + 3;
      this.speedX = (Math.random() - 0.5) * 6;
      this.rotation = Math.random() * 360;
      this.rotSpeed = (Math.random() - 0.5) * 12;
      this.color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      this.shape = Math.floor(Math.random() * 3);
      this.opacity = 1;
      this.wobble = Math.random() * 10;
    }
    update() {
      this.y += this.speedY;
      this.x += this.speedX + Math.sin(this.wobble) * 0.5;
      this.rotation += this.rotSpeed;
      this.wobble += 0.05;
      this.speedY += 0.05;
      this.opacity -= 0.003;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = this.opacity;
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation * Math.PI / 180);
      ctx.fillStyle = this.color;
      if (this.shape === 0) {
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size * 0.6);
      } else if (this.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.lineTo(this.size / 2, this.size / 2);
        ctx.lineTo(-this.size / 2, this.size / 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter(p => p.opacity > 0 && p.y < canvas.height + 50);
    pieces.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
  }
  animate();

  return {
    launch(count) {
      count = count || 200;
      for (let i = 0; i < count; i++) {
        setTimeout(() => pieces.push(new Piece()), i * 15);
      }
      // second wave
      setTimeout(() => {
        for (let i = 0; i < 150; i++) {
          setTimeout(() => pieces.push(new Piece()), i * 15);
        }
      }, 1500);
    }
  };
})();

// ===== CURSOR SPARKLE =====
document.addEventListener('mousemove', function (e) {
  if (Math.random() > 0.85) createSparkle(e.clientX, e.clientY);
});

function createSparkle(x, y) {
  const s = document.createElement('div');
  const symbols = ['✦', '✧', '⋆', '·', '💖'];
  const sparkColors = ['#d4a853', '#e8a0bf', '#c9b1ff', '#f5d69e'];
  s.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  s.style.cssText = `
    position:fixed; left:${x}px; top:${y}px;
    pointer-events:none;
    font-size:${Math.random() * 14 + 8}px;
    color:${sparkColors[Math.floor(Math.random() * sparkColors.length)]};
    z-index:99999; transition:all 1s; opacity:1;
  `;
  document.body.appendChild(s);
  requestAnimationFrame(() => {
    s.style.transform = `translateY(-${Math.random() * 40 + 20}px) rotate(${Math.random() * 180}deg)`;
    s.style.opacity = '0';
  });
  setTimeout(() => s.remove(), 1000);
}

// ===== SCROLL REVEAL =====
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}

// Run on load
document.addEventListener('DOMContentLoaded', initScrollReveal);

// ===== GLOBAL HELPERS =====
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
