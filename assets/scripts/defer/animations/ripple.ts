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

      if (key === "width" || key === "height") {
        value = value < 0 ? 0 : value;
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
  const viewportCenter = window.innerHeight / 2;

  return (
    rect.bottom > 0 &&               // element is not above viewport
    rect.top < window.innerHeight && // element is not below viewport
    rect.top < viewportCenter        // element is above center
  );
}

async function fetchImageAsDataURL(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function createRippleSvg (filterId: string) {
  const svgNS = "http://www.w3.org/2000/svg";

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
  const url = "/assets/images/ripple.png";
  const feImage = document.createElementNS(svgNS, "feImage");
  feImage.setAttribute("href", url);
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
  filter.append(feImage, feDisplacementMap, feComposite1, feComposite2);
  
  defs.appendChild(filter);
  svg.appendChild(defs);
  return svg
}

function rippleAnimation(
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

  const size = Math.max(Math.max(bounds.width, bounds.height) * 1, 1); // never smaller than 1px
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
const ripple = async () => {
  const ripples = document.querySelectorAll('.ripple') as NodeListOf<HTMLElement>;

  if (ripples.length === 0) {
    return;
  }

  const svg = await createRippleSvg("filter-ripple-1");
  document.body.appendChild(svg);
  const feImage = svg.querySelector('feImage') as SVGFEImageElement;
  const feDisplacementMap = svg.querySelector('feDisplacementMap') as SVGFEDisplacementMapElement;
  
  const triggeredElements = new Set<HTMLElement>();
  ripples.forEach(element => {
    element.style.filter = "url(#filter-ripple-1)";
    const visible = isElementVisible(element);
    if (visible) {
      triggeredElements.add(element);
      rippleAnimation(element, feImage, feDisplacementMap);
    }
  })

  window.addEventListener('scroll', () => {
    ripples.forEach(element => {
      if (triggeredElements.has(element)) return; // already triggered

      const centered = isElementInCenter(element)
      if (centered) {
        console.log('centered');
        triggeredElements.add(element);
        rippleAnimation(element, feImage, feDisplacementMap);
      }
    })
  });
}

// (async () => {
//   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
//   if (!prefersReducedMotion) {
//     await ripple();
//   }  
// })();
