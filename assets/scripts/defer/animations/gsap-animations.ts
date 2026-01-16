// ----- gsap marker by Ryan Mulligan: https://codepen.io/hexagoncircle/pen/gOPMwvd

import { gsap } from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import { SplitText } from "gsap/SplitText";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";
gsap.registerPlugin(SplitText, ScrollTrigger, Physics2DPlugin);

// const marks = document.querySelectorAll('mark');
// marks.forEach(element => {
//   element.classList.add('gsap-highlight');
// });

// gsap.registerPlugin(ScrollTrigger);

// gsap.utils.toArray('.gsap-highlight').forEach(highlight => {
//   ScrollTrigger.create({
//     trigger: highlight,
//     start: '-100px center',
//     onEnter: () => highlight.classList.add('active')
//   });
// });

export const splitTextAnimation = (selector: string) => {
  let split = SplitText.create(selector, { type: "words" });

  // now animate the characters in a staggered fashion
  // gsap.from(split.chars, {
  //   x: 150,
  //   opacity: 0,
  //   duration: 0.01, 
  //   ease: "power4",
  //   stagger: 0.04
  // });
  // gsap.from(split.words, {
  //   y: -100,
  //   opacity: 0,
  //   rotation: "random(-80, 80)",
  //   duration: 0.7, 
  //   ease: "back",
  //   stagger: 0.15
  // });
  gsap.from(split.words, {
    y: -100,
    opacity: 0,
    rotation: "random(-10, 10)",
    duration: 0.7, 
    ease: "back",
    stagger: 0.05,
    scrollTrigger: {
      trigger: selector,
      markers: true,
      start: "top bottom",
      end: "top center",
      // scrub: true
    }
  });

  // let split = SplitText.create(selector, {
  //   type: "words", // only split into words and lines (not characters)
  //   mask: "lines", // adds extra wrapper element around lines with overflow: clip (v3.13.0+)
  //   linesClass: "line++", // adds "line" class to each line element, plus an incremented one too ("line1", "line2", "line3", etc.)
  // });
  // gsap.from(split.chars, {
  //   duration: 1, 
  //   y: 100,         // animate from 100px below
  //   autoAlpha: 0,   // fade in from opacity: 0 and visibility: hidden
  //   stagger: 0.05,  // 0.05 seconds between each
  // });
  // SplitText.create(selector, {
  //   type: "words, chars",
  //   onSplit(self) { // runs every time it splits
  //     gsap.from(self.chars, {
  //       duration: 1, 
  //       y: 100, 
  //       autoAlpha: 0, 
  //       stagger: 0.05
  //     });
  //   }
  // });
}

export const confettiAnimation = (selector: string) => {
  console.clear();

  const masterTl = gsap.timeline({
    paused: true,
  });
  const cannon = document.querySelector(selector);
  // const angle = 20;
  // const tl1 = gsap
  //   .timeline()
  //   .to(cannon, {
  //     rotation: -angle,
  //     duration: 0.65,
  //     ease: "power1.inOut"
  //   })
  //   .to(
  //     cannon,
  //     {
  //       rotation: angle,
  //       ease: "power1.inOut",
  //       duration: 1,
  //       repeat: 3,
  //       yoyo: true
  //     }
  //   )
  // .to(cannon, {
  //     rotation: 0,
  //     duration: 0.65,
  //     ease: "power1.inOut"
  //   });
  // const tl1Time = tl1.duration();

  const bullets = [];
  const bulletsContainer = document.querySelector(".flair-container")!;
  const tl1Time = 4;

  for (let i = 0; i < 40; i++) {
    const className = "flair--" + gsap.utils.random(2, 3, 1);
    const flairBullet = document.createElement("div");
    flairBullet.setAttribute("class", "flair flair-bullet " + className);
    bulletsContainer.appendChild(flairBullet);
    bullets.push(flairBullet);
    gsap.set(flairBullet, { scale: "random(0.4, 0.6)" });
  }

  const tl2 = gsap
    .timeline()
    .to(bullets, {
      opacity: 1,
      duration: 0.25,
      stagger: {
        amount: tl1Time
      }
    })
    .to(
      bullets,
      {
        duration: tl1Time,
        physics2D: {
          velocity: "random(300, 550)",
          // angle: () => 270 + parseInt(gsap.getProperty(cannon, "rotation")),
          angle: () => -45,
          gravity: 600
        },
        stagger: {
          amount: tl1Time
        }
      },
      0
    );
  masterTl
    // .add(tl1, 0)
    .add(tl2, 0)
    .play();
  window.addEventListener("click", () => masterTl.restart());
}

export const confettiAnimation2 = (selector: string) => {
  console.clear();

  const masterTl = gsap.timeline({
    paused: true,
  });
  const fisch = document.querySelector(selector)!;

  const bullets = [];
  const bulletsContainer = document.querySelector(".flair-container")!;
  const tl1Time = 10;

  for (let i = 0; i < 40; i++) {
    // const className = "flair--" + gsap.utils.random(2, 3, 1);
    // const flairBullet = document.createElement("div");
    // flairBullet.setAttribute("class", "flair flair-bullet " + className);

    const cloned = fisch.cloneNode(true); // deep clone
    const svgNS = "http://www.w3.org/2000/svg";

    const newSvg = document.createElementNS(svgNS, 'svg');
    newSvg.setAttribute('viewBox', '0 0 150 150');
    newSvg.classList.add('my-flair');
    newSvg.classList.add('flair');
    newSvg.classList.add('flair-bullet');
    newSvg.appendChild(cloned);

    bulletsContainer.appendChild(newSvg);
    bullets.push(newSvg);
    // gsap.set(newSvg, { scale: "random(0.4, 0.6)" });
  }

  const tl2 = gsap
    .timeline()
    .to(bullets, {
      opacity: 1,
      duration: 0.15,
      stagger: {
        amount: tl1Time
      }
    })
    .to(bullets, {
      duration: tl1Time,
      rotate: 360,
      stagger: {
        amount: tl1Time
      },
    }, 0)
    .to(
      bullets,
      {
        duration: tl1Time,
        physics2D: {
          velocity: "random(400, 550)",
          // accelerationAngle: 120,
          // angle: () => 270 + parseInt(gsap.getProperty(cannon, "rotation")),
          angle: () => 180,
          gravity: 600
        },
        stagger: {
          amount: tl1Time
        },
      },
      0
    );
    masterTl
      // .add(tl1, 0)
      .add(tl2, 0)
      // .play();
      ScrollTrigger.create({
        animation: masterTl,
        trigger: bulletsContainer,
        start: "top center",
        end: "+=2000", // scroll distance controls animation length
        scrub: true,
        markers: true
      });

  // window.addEventListener("click", () => masterTl.restart());
}

const fisch = (selector: string) => {
  gsap.to(selector, {
    // y: 50,
    // opacity: 0,
    transformOrigin: "center",
    rotation: "360",
    duration: 4.7, 
    // ease: "back",
    stagger: 0.2,
  })
}

// fisch(".ffmh-fish");
// confettiAnimation2(".ffmh-fish");

// confettiAnimation(".cannon");
// gsap.utils.toArray('.gsap-highlight').forEach(el => {
//   gsap.to(el, {
//     scale: 1.2,
//     scrollTrigger: {
//       trigger: el,
//       start: "top center",
//       end: "bottom center",
//       scrub: true
//     }
//   });
// });

const fireworks = () => {
  const fireworksCanvas = document.getElementById("fireworksCanvas")! as HTMLCanvasElement;
  const fwCtx = fireworksCanvas.getContext("2d")!;
  let fireworks: Firework[] = [];
  let particles: FwParticle[] = [];

  function resizeFireworksCanvas() {
    fireworksCanvas.width = window.innerWidth;
    fireworksCanvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeFireworksCanvas);
  resizeFireworksCanvas();

  class Firework {
    x: number;
    y: number;
    targetY: number;
    hue: number;
    brightness: number;
    element: { x: number; y: number };

    constructor(x: number, targetY: number) {
      this.x = x;
      this.y = window.innerHeight;
      this.targetY = targetY;
      this.hue = Math.random() * 360;
      this.brightness = 50 + Math.random() * 50;
      this.element = { x: this.x, y: this.y }; // For GSAP animation
      this.animate();
    }

    animate() {
      // Animate firework rising using GSAP
      gsap.to(this.element, {
        y: this.targetY,
        duration: 2,
        ease: "power2.out",
        onUpdate: () => {
          this.y = this.element.y;
          this.draw();
        },
        onComplete: () => {
          explode(this.x, this.y, this.hue);
          fireworks = fireworks.filter((f) => f !== this); // Remove firework after explosion
        }
      });
    }

    draw() {
      fwCtx.beginPath();
      fwCtx.arc(this.x, this.y, 3, 0, 2 * Math.PI);
      fwCtx.fillStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`;
      fwCtx.fill();
    }
  }

  class FwParticle {
    x: number;
    y: number;
    hue: number;
    brightness: number;
    angle: number;
    speed: number;
    friction: number;
    gravity: number;
    opacity: number;
    decay: number;
    element: { x: number; y: number; opacity: number };

    constructor(x: number, y: number, hue: number) {
      this.x = x;
      this.y = y;
      this.hue = hue;
      this.brightness = 50 + Math.random() * 50;
      this.angle = Math.random() * Math.PI * 2;
      this.speed = 2 + Math.random() * 5;
      this.friction = 0.95;
      this.gravity = 0.5;
      this.opacity = 1;
      this.decay = 0.015 + Math.random() * 0.03;
      this.element = { x: this.x, y: this.y, opacity: this.opacity };
      this.animate();
    }

    animate() {
      // Animate particle using GSAP
      gsap.to(this.element, {
        x: this.x + Math.cos(this.angle) * this.speed * 50,
        y: this.y + Math.sin(this.angle) * this.speed * 50 + this.gravity * 50,
        opacity: 0,
        duration: 1,
        ease: "power1.out",
        onUpdate: () => {
          this.x = this.element.x;
          this.y = this.element.y;
          this.opacity = this.element.opacity;
          this.draw();
        },
        onComplete: () => {
          particles = particles.filter((p) => p !== this); // Remove particle after animation
        }
      });
    }

    draw() {
      fwCtx.save();
      fwCtx.globalAlpha = this.opacity;
      fwCtx.beginPath();
      fwCtx.arc(this.x, this.y, 2, 0, 2 * Math.PI);
      fwCtx.fillStyle = `hsl(${this.hue}, 100%, ${this.brightness}%)`;
      fwCtx.fill();
      fwCtx.restore();
    }
  }

  function createFirework(x: number, y: number) {
    const firework = new Firework(x, y);
    fireworks.push(firework);
  }

  function explode(x: number, y: number, hue: number) {
    for (let i = 0; i < 50; i++) {
      particles.push(new FwParticle(x, y, hue));
    }
  }

  function animateFireworks() {
    // Clear canvas with slight fade for trail effect
    fwCtx.fillStyle = "rgba(255, 255, 255, 0.1)";
    fwCtx.fillRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    requestAnimationFrame(animateFireworks);
  }

  // Start automatic fireworks
  function startAutoFireworks(interval = 600) {
    setInterval(() => {
      createFirework(
        Math.random() * fireworksCanvas.width,
        Math.random() * fireworksCanvas.height * 0.5
      );
    }, interval);
  }

  // Initialize
  animateFireworks();
  startAutoFireworks();
}
// fireworks();

const ripple = () => {
  var isFF = !!navigator.userAgent.match(/firefox/i);
  var bt = document.querySelectorAll('.ripple')[0];
  var turb = document.querySelectorAll('#filter-ripple-1 feImage')[0];
  var dm = document.querySelectorAll('#filter-ripple-1 feDisplacementMap')[0];
  
  const bounds = bt.getBoundingClientRect();

  ScrollTrigger.create({
    trigger: bt,
    start: "top center",
    markers: true,
    onEnter: () => {

      gsap.set(turb, {
        attr: {
          x: bounds.width / 2,
          y: bounds.height / 2,
          width: 0,
          height: 0
        }
      });
      const size = bounds.width*1.4
      gsap.to(turb, {
        duration: 2,
        attr: {
          x: `-=${size/2}`,
          y: `-=${size/2}`,
          width: size,
          height: size
        }
      });

      gsap.fromTo(dm,
        { attr: { scale: 20 } },
        { duration: 2, attr: { scale: 0 } }
      );
    }
  });
}
// ripple();

type AttrMap = { [key: string]: number | string };
// Animate SVG attributes
function animateAttr(
  element: SVGElement,
  attrStart: AttrMap,
  attrEnd: AttrMap,
  duration: number,
  callback?: () => void
) {
  const startTime = performance.now();

  function step(now: number) {
    const t = Math.min((now - startTime) / duration, 1); // progress 0 → 1

    for (const key in attrStart) {
      const start = attrStart[key];
      const end = attrEnd[key];

      let value: number;

      if (typeof end === 'string' && end.startsWith('-=')) {
        const offset = parseFloat(end.slice(2));
        value = Number(start) - offset * t;
      } else {
        value = Number(start) + (Number(end) - Number(start)) * t;
      }

      element.setAttribute(key, value.toString());
    }

    if (t < 1) {
      requestAnimationFrame(step);
    } else if (callback) {
      callback();
    }
  }

  requestAnimationFrame(step);
}

// Check if element is vertically centered in viewport
function isElementInCenter(el: HTMLElement, tolerance = 50): boolean {
  const rect = el.getBoundingClientRect();
  const viewportCenter = window.innerHeight / 2;

  // rect.top is relative to viewport
  const elementMid = rect.top + rect.height / 2;

  return Math.abs(elementMid - viewportCenter) <= tolerance;
}

// Helper: check if element is already visible in viewport
function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function createRippleSvg (filterId: string) {
  const svgNS = "http://www.w3.org/2000/svg";
  const xlinkNS = "http://www.w3.org/1999/xlink";

  // 1️⃣ Create the <svg> element
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("xmlns", svgNS);
  svg.setAttribute("version", "1.1");
  svg.classList.add("svg-filters");
  svg.setAttribute(
    "style",
    "position: absolute; visibility: hidden; width: 1px; height: 1px;"
  );

  // 2️⃣ Create <defs>
  const defs = document.createElementNS(svgNS, "defs");

  // 3️⃣ Create <filter>
  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", filterId);

  // 4️⃣ Create <feImage>
  const feImage = document.createElementNS(svgNS, "feImage");
  feImage.setAttributeNS(xlinkNS, "xlink:href", "/assets/images/ripple.png");
  feImage.setAttribute("x", "30");
  feImage.setAttribute("y", "20");
  feImage.setAttribute("width", "0");
  feImage.setAttribute("height", "0");
  feImage.setAttribute("result", "ripple");

  // 5️⃣ Create <feDisplacementMap>
  const feDisplacementMap = document.createElementNS(svgNS, "feDisplacementMap");
  feDisplacementMap.setAttribute("xChannelSelector", "R");
  feDisplacementMap.setAttribute("yChannelSelector", "G");
  feDisplacementMap.setAttribute("color-interpolation-filters", "sRGB");
  feDisplacementMap.setAttribute("in", "SourceGraphic");
  feDisplacementMap.setAttribute("in2", "ripple");
  feDisplacementMap.setAttribute("scale", "20");
  feDisplacementMap.setAttribute("result", "dm");

  // 6️⃣ Create <feComposite> (first)
  const feComposite1 = document.createElementNS(svgNS, "feComposite");
  feComposite1.setAttribute("operator", "in");
  feComposite1.setAttribute("in2", "ripple");

  // 7️⃣ Create <feComposite> (second)
  const feComposite2 = document.createElementNS(svgNS, "feComposite");
  feComposite2.setAttribute("in2", "SourceGraphic");

  // 8️⃣ Append children
  filter.appendChild(feImage);
  filter.appendChild(feDisplacementMap);
  filter.appendChild(feComposite1);
  filter.appendChild(feComposite2);

  defs.appendChild(filter);
  svg.appendChild(defs);
  return svg
}

function ripple2Animation(
  element: HTMLElement,
  image: SVGFEImageElement,
  displacementMap: SVGFEDisplacementMapElement,
  duration: number = 1500
) {
  const bounds = element.getBoundingClientRect();

  // Set initial state
  image.setAttribute('x', (bounds.width / 2).toString());
  image.setAttribute('y', (bounds.height / 2).toString());
  image.setAttribute('width', '0');
  image.setAttribute('height', '0');

  const size = Math.max(Math.max(bounds.width, bounds.height) * 1.4, 1); // never smaller than 1px
  const startX = bounds.width / 2;
  const startY = bounds.height / 2;

  const endX = startX - size / 2;
  const endY = startY - size / 2;

  animateAttr(
    image,
    { x: startX, y: startY, width: 0, height: 0 },
    { x: endX, y: endY, width: size, height: size },
    duration
  );

  // Animate dm
  animateAttr(
    displacementMap,
    { scale: 20 },
    { scale: 0 },
    duration
  );
}
const ripple2 = () => {
  const ripples = document.querySelectorAll('.ripple') as NodeListOf<HTMLElement>;

  if (ripples.length === 0) {
    return;
  }

  const svg = createRippleSvg("filter-ripple-1");
  document.body.appendChild(svg);
  const feImage = svg.querySelector('feImage') as SVGFEImageElement;
  const feDisplacementMap = svg.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement;
  
  const triggeredElements = new Set<HTMLElement>();
  ripples.forEach(element => {
    const visible = isElementVisible(element);
    if (visible) {
      triggeredElements.add(element);
      ripple2Animation(element, feImage, feDisplacementMap);
    }
  })

  window.addEventListener('scroll', () => {
    ripples.forEach(element => {
      if (triggeredElements.has(element)) return; // already triggered

      const centered = isElementInCenter(element)
      if (centered) {
        triggeredElements.add(element);
        ripple2Animation(element, feImage, feDisplacementMap);
      }
    })
  });
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReducedMotion) {
  ripple2();
}