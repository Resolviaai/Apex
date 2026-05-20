/**
* @license
* SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { Play, ArrowUpRight, Inbox, Scissors, Palette, CheckCircle, Star, ChevronLeft, ChevronRight, ArrowUp, ChevronDown, Loader2, Sun, Moon } from 'lucide-react';
import { supabase } from './lib/supabase';

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entry.target.setAttribute('data-revealed', 'true');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });

    const targets = document.querySelectorAll('.reveal-target');
    targets.forEach((el) => {
      observer.observe(el);
      el.classList.add('is-visible');
      el.setAttribute('data-revealed', 'true');
    });

    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const el = mutation.target as HTMLElement;
          if (el.getAttribute('data-revealed') === 'true' && !el.classList.contains('is-visible')) {
            el.classList.add('is-visible');
          }
        }
      });
    });

    targets.forEach((el) => {
      mutationObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);
}

function ScrollCounter({ value, duration = 1600, suffix = "" }: { value: number, duration?: number, suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isCounting = false;
    let observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isCounting) {
        isCounting = true;
        let startTimestamp: number | null = null;

        const step = (timestamp: number) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const progress = Math.min((timestamp - startTimestamp) / duration, 1);
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);
          setCount(Math.floor(easeOutQuart * value));
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        };
        window.requestAnimationFrame(step);
        observer.disconnect();
      }
    }, { threshold: 0.15 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [value, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

// Animates 0 → 1B+ using a logarithmic scale so every order of magnitude
// (K → M → B) gets equal screen time — the number visibly climbs through
// hundreds of Ks, then hundreds of Ms, before landing on 1B+.
function BillionCounter({ duration = 3000 }: { duration?: number }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let isCounting = false;

    const fmt = (n: number): string => {
      if (n < 1_000) return Math.floor(n).toString();
      if (n < 1_000_000) return `${Math.floor(n / 1_000)}K`;
      if (n < 1_000_000_000) return `${Math.floor(n / 1_000_000)}M`;
      return '1B';
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isCounting) {
        isCounting = true;
        let startTimestamp: number | null = null;

        const step = (timestamp: number) => {
          if (!startTimestamp) startTimestamp = timestamp;
          const rawProgress = Math.min((timestamp - startTimestamp) / duration, 1);

          // Logarithmic mapping: progress 0→1 maps to value 0→1B
          // Each decade (K, M, B) occupies ~1/9 of the total log range
          const current = rawProgress === 0 ? 0 : Math.min(Math.pow(10, rawProgress * 9) - 1, 1_000_000_000);

          setDisplay(fmt(current));

          if (rawProgress < 1) {
            window.requestAnimationFrame(step);
          } else {
            setDisplay('1B');
          }
        };

        window.requestAnimationFrame(step);
        observer.disconnect();
      }
    }, { threshold: 0.15 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [duration]);

  return <span ref={ref}>{display}+</span>;
}

function MagneticButton({ children, href, className, style }: any) {
  const buttonRef = React.useRef<HTMLAnchorElement>(null);

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();

      const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
      const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
      const distanceToEdge = Math.sqrt(dx * dx + dy * dy);

      if (distanceToEdge < 80) {
        const btnCenterX = rect.left + rect.width / 2;
        const btnCenterY = rect.top + rect.height / 2;
        const distanceX = e.clientX - btnCenterX;
        const distanceY = e.clientY - btnCenterY;

        buttonRef.current.style.transform = `translate(${distanceX * 0.3}px, ${distanceY * 0.3}px) scale(1.02)`;
      } else {
        buttonRef.current.style.transform = `translate(0px, 0px) scale(1)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <a
      ref={buttonRef}
      href={href}
      className={className}
      style={{ ...style, transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
    >
      {children}
    </a>
  );
}

// ─── Phase 3: DinoGame Component ────────────────────────────────────────────
// The game runs in an isolated iframe pointing to /dino-game/index.html
// (served from /public/dino-game/). The iframe is completely borderless and
// transparent so the game appears to float directly on the page background.
// Using an iframe isolates the GDevelop scripts and namespace, and ensures
// that key inputs like Space and Arrow keys do not scroll the parent webpage.
function DinoGame() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const focusIframe = () => {
    if (iframeRef.current) {
      iframeRef.current.focus();
    }
  };

  return (
    <div
      onClick={focusIframe}
      className="relative z-20 w-[calc(100%+2rem)] -mx-4 md:w-full md:mx-auto max-w-[640px] cursor-pointer"
    >
      <div className="w-full aspect-video overflow-hidden relative">
        <iframe
          ref={iframeRef}
          src="/dino-game/index.html"
          title="Dino Game"
          allow="autoplay"
          scrolling="no"
          tabIndex={0}
          className="absolute inset-0 w-full h-full border-0 z-30"
        />
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function AnimatedWaveform() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hoverXRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    let time = 0;
    const numBars = 75; // Between 60 and 80
    const barWidth = 3;

    const svg = svgRef.current;
    if (!svg) return;

    if (svg.childNodes.length === 0) {
      for (let i = 0; i < numBars; i++) {
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", barWidth.toString());
        rect.setAttribute("rx", "1.5");

        const centerDist = Math.abs(numBars / 2 - i) / (numBars / 2);
        const r = Math.round(0 * (1 - centerDist) + 180 * centerDist);
        const g = Math.round(110 * (1 - centerDist) + 180 * centerDist);
        const b = Math.round(252 * (1 - centerDist) + 180 * centerDist);

        rect.setAttribute("fill", `rgb(${r}, ${g}, ${b})`);
        rect.setAttribute("data-phase", (Math.random() * Math.PI * 2).toString());
        rect.setAttribute("data-speed", (0.015 + Math.random() * 0.02).toString());
        rect.setAttribute("data-baseamp", (10 + Math.random() * 20).toString());
        svg.appendChild(rect);
      }
    }

    const render = () => {
      time += 1;
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = 80;

      const actualGap = width > 0 ? Math.max(1, (width - numBars * barWidth) / (numBars - 1)) : 4;
      const totalWidth = numBars * barWidth + (numBars - 1) * actualGap;
      const offsetX = width > 0 ? (width - totalWidth) / 2 : 0;

      const rects = Array.from(svg.querySelectorAll("rect")) as SVGRectElement[];
      let hoverIndex: number | null = null;

      if (hoverXRef.current !== null) {
        hoverIndex = (hoverXRef.current - offsetX) / (barWidth + actualGap);
      }

      rects.forEach((rect, i) => {
        const x = offsetX + i * (barWidth + actualGap);
        rect.setAttribute("x", x.toString());

        let edgeFade = 1;
        const edgeWindow = 15;
        if (i < edgeWindow) edgeFade = Math.pow(i / edgeWindow, 1.5);
        if (i > numBars - 1 - edgeWindow) edgeFade = Math.pow((numBars - 1 - i) / edgeWindow, 1.5);

        const phase = parseFloat(rect.getAttribute("data-phase") || "0");
        const speed = parseFloat(rect.getAttribute("data-speed") || "0");
        const baseAmp = parseFloat(rect.getAttribute("data-baseamp") || "0");

        const wave1 = Math.sin(time * speed + phase);
        const wave2 = Math.sin(time * speed * 0.5 + phase * 1.5);
        let baseHeight = (wave1 * 0.6 + wave2 * 0.4) * baseAmp + 15;

        let hoverBoost = 0;
        if (hoverIndex !== null) {
          const dist = Math.abs(hoverIndex - i);
          if (dist < 8) {
            hoverBoost = (8 - dist) * 5;
          }
        }

        let barHeight = (baseHeight + hoverBoost) * edgeFade;
        barHeight = Math.max(2 * edgeFade, Math.min(barHeight, height - 2));

        const y = (height - barHeight) / 2;
        rect.setAttribute("y", y.toString());
        rect.setAttribute("height", barHeight.toString());
        rect.setAttribute("opacity", (0.2 + 0.8 * edgeFade).toString());
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    hoverXRef.current = e.clientX - rect.left;
  };

  const handleMouseLeave = () => {
    hoverXRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-[80px] relative"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <svg ref={svgRef} className="w-full h-full" preserveAspectRatio="none" />
    </div>
  );
}

function ProcessTimeline({ isNight }: { isNight: boolean }) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.3 });

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const steps = [
    { title: "Brief & Assets", desc: "You share the raw footage + creative direction", icon: <Inbox size={18} /> },
    { title: "Rough Cut", desc: "I build the structure, pacing, and narrative flow", icon: <Scissors size={18} /> },
    { title: "Color & Sound", desc: "Grade, SFX, music sync, and motion refinements", icon: <Palette size={18} /> },
    { title: "Delivery", desc: "Final export in your format, revisions included", icon: <CheckCircle size={18} /> }
  ];

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto mt-16 mb-8 px-4 sm:px-8 relative reveal-target reveal-slide-up" style={{ transitionDelay: '400ms' }}>
      <div className="flex flex-col md:flex-row justify-between relative w-full gap-8 md:gap-0">

        {/* Background line */}
        <div className="absolute left-[19px] md:left-[12.5%] top-[20px] md:top-[19px] h-[calc(100%-40px)] md:h-[2px] w-[2px] md:w-[75%] bg-border/40 z-0" />

        {/* Foreground animated svg line */}
        <svg
          className="absolute left-[19px] md:left-[12.5%] top-[20px] md:top-[19px] h-[calc(100%-40px)] md:h-[2px] w-[2px] md:w-[75%] z-0 overflow-visible pointer-events-none"
        >
          {/* Vertical line (Mobile) */}
          <line
            x1="0" y1="0"
            x2="0" y2="100%"
            pathLength="100"
            className="md:hidden stroke-[#006EFC]"
            strokeWidth="2"
            strokeDasharray="100"
            strokeDashoffset={isVisible ? "0" : "100"}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s' }}
          />
          {/* Horizontal line (Desktop) */}
          <line
            x1="0" y1="0"
            x2="100%" y2="0"
            pathLength="100"
            className="hidden md:block stroke-[#006EFC]"
            strokeWidth="2"
            strokeDasharray="100"
            strokeDashoffset={isVisible ? "0" : "100"}
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s' }}
          />
        </svg>

        {steps.map((step, i) => (
          <div
            key={i}
            className={`relative z-10 flex flex-row md:flex-col items-center md:items-start text-left md:text-center w-full md:w-1/4 transition-all duration-500 ease-out 
              ${isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.6] translate-y-4'}`}
            style={{ transitionDelay: `${i * 200 + 400}ms` }}
          >
            <div className="w-[40px] h-[40px] rounded-full bg-background border-2 border-[#006EFC] text-[#006EFC] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(0,110,252,0.4)] mx-0 md:mx-auto mb-0 md:mb-5 bg-[#050505]">
              {step.icon}
            </div>
            <div className="pl-6 md:pl-0 flex-1 md:w-full flex md:items-center flex-col md:px-3">
              <h4 className={`font-bold text-[0.9rem] tracking-tight mb-2 transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`}>{step.title}</h4>
              <p className={`text-[0.75rem] leading-relaxed transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Testimonial {
  imageUrl: string;
  client: string;
  quote: string;
  metric: string;
  rating: number;
}

const testimonialData: Testimonial[] = [
  {
    imageUrl: '/testimonials/testimonial-01.png',
    client: 'Sniperscaretem (Discord)',
    quote: 'Absolutely flawless video pacing and retention cuts. The team delivered ahead of schedule and incorporated feedback perfectly.',
    metric: '10/10 Quality',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-02.png',
    client: 'YouTube Partner (Direct Msg)',
    quote: 'Our click-through rate shot up immediately after uploading. These custom thumbnails are complete click magnets.',
    metric: '+48% CTR Boost',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-03.png',
    client: 'SaaS Founder (Email Feedback)',
    quote: 'They completely understand retention mechanics. They turned a complex, technical product explanation into an incredibly engaging narrative.',
    metric: 'AVD Doubled',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-04.png',
    client: 'Gaming Creator (Discord)',
    quote: 'Incredibly fast turnaround time and excellent communication. They keep you updated at every step of the editing pipeline.',
    metric: '24h Delivery',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-05.png',
    client: 'Tech Influencer (Chat Log)',
    quote: 'Pacing, sound design, and custom graphics are completely spot-on. They turned my raw footage into a cinematic masterpiece.',
    metric: 'Elite Cuts',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-06.png',
    client: 'Documentary Channel (Discord)',
    quote: 'Apex has completely transformed our storytelling. Our average view duration increased significantly within the first month.',
    metric: '+35% AVD Increase',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-07.png',
    client: 'Agency Partner (WhatsApp)',
    quote: 'The most reliable team I have collaborated with. High attention to detail, proactive editing, and superb reliability.',
    metric: '100% Reliable',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-08.png',
    client: 'Podcast Producer (Discord)',
    quote: 'Audio levels are perfect, typography integration is superb, and the high-retention shorts cuts are driving massive traffic.',
    metric: '+1.2M Views',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-09.png',
    client: 'Finance Creator (Chat Log)',
    quote: 'Clickable visuals that capture target curiosity hooks instantly. Their designs stand out in even the most competitive niches.',
    metric: 'High-CTR Visuals',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-10.png',
    client: 'Lifestyle Vlogger (Email)',
    quote: 'I have tested numerous editors, but their creative direction and storytelling depth is on a whole different level.',
    metric: 'Premium Retainer',
    rating: 5
  },
  {
    imageUrl: '/testimonials/testimonial-11.png',
    client: 'Entertainment Host (Discord)',
    quote: 'They capture the core emotion of the script flawlessly. Outstanding motion graphics and sound effects integration.',
    metric: 'Flawless pacing',
    rating: 5
  }
];

function TestimonialCarousel({ isNight }: { isNight: boolean }) {
  const [current, setCurrent] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % testimonialData.length);
  };

  const handlePrev = () => {
    setCurrent((prev) => (prev === 0 ? testimonialData.length - 1 : prev - 1));
  };

  // Keyboard navigation within the Lightbox when open
  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') setIsLightboxOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  // Disable body scroll when lightbox is open
  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isLightboxOpen]);

  return (
    <div className="w-full max-w-4xl mx-auto mt-16 px-4">
      <div 
        className={`w-full rounded-[32px] border transition-all duration-500 relative overflow-hidden p-6 md:p-10 flex flex-col md:flex-row items-center gap-8 md:gap-12 ${
          isNight 
            ? 'bg-gradient-to-br from-white/[0.03] via-white/[0.01] to-transparent border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl' 
            : 'bg-gradient-to-br from-black/[0.02] via-black/[0.005] to-transparent border-black/10 text-foreground shadow-[0_20px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl'
        }`}
      >
        {/* Background glow design */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-[#006EFC]/5 filter blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-[#006EFC]/3 filter blur-3xl pointer-events-none" />

        {/* Left Column: Review Content, Verification, and Metrics */}
        <div className="w-full md:w-1/2 flex flex-col items-start text-left justify-center order-2 md:order-1 gap-6">
          <div className="w-full flex items-center justify-between gap-4">
            {/* Verified chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Verified Chat Proof
            </div>

            {/* Stars */}
            <div className="flex gap-0.5">
              {Array.from({ length: testimonialData[current].rating }).map((_, i) => (
                <Star key={i} size={14} fill="#FFD700" stroke="#FFD700" />
              ))}
            </div>
          </div>

          {/* Client Platform */}
          <div className={`text-[10px] font-bold uppercase tracking-widest ${isNight ? 'text-white/40' : 'text-black/40'}`}>
            Client: {testimonialData[current].client}
          </div>

          {/* Large Quote */}
          <blockquote 
            className="text-lg md:text-xl font-medium leading-relaxed italic text-foreground font-sans min-h-[100px] flex items-center"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            "{testimonialData[current].quote}"
          </blockquote>

          {/* Metric Highlight Badge */}
          <div className="inline-flex">
            <span className="px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#006EFC]/10 text-[#006EFC] border border-[#006EFC]/20 shadow-[0_0_15px_rgba(0,110,252,0.1)]">
              🔑 {testimonialData[current].metric}
            </span>
          </div>

          {/* Navigation controls underneath review (Desktop) */}
          <div className="hidden md:flex items-center gap-4 mt-4 w-full">
            <button 
              onClick={handlePrev}
              className={`p-2.5 rounded-full border transition-all duration-300 cursor-pointer flex items-center justify-center ${
                isNight 
                  ? 'border-white/10 bg-white/[0.02] hover:bg-white/10 hover:border-white/30 text-white' 
                  : 'border-black/10 bg-black/[0.01] hover:bg-black/5 hover:border-black/30 text-foreground'
              }`}
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Dot Indicators */}
            <div className="flex gap-2">
              {testimonialData.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrent(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    current === index 
                      ? 'w-5 bg-[#006EFC]' 
                      : `w-1.5 ${isNight ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40'}`
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            <button 
              onClick={handleNext}
              className={`p-2.5 rounded-full border transition-all duration-300 cursor-pointer flex items-center justify-center ${
                isNight 
                  ? 'border-white/10 bg-white/[0.02] hover:bg-white/10 hover:border-white/30 text-white' 
                  : 'border-black/10 bg-black/[0.01] hover:bg-black/5 hover:border-black/30 text-foreground'
              }`}
              aria-label="Next testimonial"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Screenshot Mockup Container */}
        <div className="w-full md:w-1/2 flex items-center justify-center order-1 md:order-2 relative">
          {/* Neon-like ambient glow aura behind mockup */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-[#006EFC]/8 via-[#FF2DF5]/2 to-transparent filter blur-2xl opacity-80 rounded-full pointer-events-none" />

          {/* Screenshot Frame mockup */}
          <div 
            onClick={() => setIsLightboxOpen(true)}
            className={`relative group w-full max-w-[280px] md:max-w-[320px] h-[340px] md:h-[380px] flex flex-col overflow-hidden rounded-2xl cursor-zoom-in transition-all duration-500 hover:scale-[1.04] hover:-rotate-1 shadow-2xl border ${
              isNight 
                ? 'bg-black/40 border-white/10 hover:border-white/25' 
                : 'bg-white/40 border-black/10 hover:border-black/25'
            }`}
          >
            {/* Top Mockup Header Bar */}
            <div className={`w-full h-8 flex items-center justify-between px-3 border-b shrink-0 ${isNight ? 'bg-white/[0.03] border-white/5' : 'bg-black/[0.03] border-black/5'}`}>
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
              </div>
              <span className={`text-[8px] font-mono tracking-widest uppercase opacity-40 ${isNight ? 'text-white' : 'text-black'}`}>
                Verified_Proof.png
              </span>
              <div className="w-8" />
            </div>

            {/* Viewport Area */}
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/[0.05] dark:bg-black/20 p-3">
              {/* Subtle blurred background for visual depth */}
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-[0.08] filter blur-xl select-none pointer-events-none scale-110"
                style={{ backgroundImage: `url(${testimonialData[current].imageUrl})` }}
              />

              {/* The screenshot */}
              <img 
                src={testimonialData[current].imageUrl} 
                alt={`Verified client testimonial screenshot proof ${current + 1}`}
                className="relative z-10 max-w-full max-h-full object-contain rounded-lg shadow-lg select-none"
                draggable="false"
              />

              {/* Zoom Hover Overlay */}
              <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[1px] pointer-events-none">
                <div className="bg-white text-black px-4 py-2 rounded-full text-[9px] font-bold tracking-wider uppercase shadow-xl flex items-center gap-2 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                  🔍 View Original Image
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation controls (Mobile only) */}
        <div className="flex md:hidden items-center justify-between w-full order-3 mt-4">
          <button 
            onClick={handlePrev}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer flex items-center justify-center ${
              isNight 
                ? 'border-white/10 bg-white/[0.02] hover:bg-white/10 hover:border-white/30 text-white' 
                : 'border-black/10 bg-black/[0.01] hover:bg-black/5 hover:border-black/30 text-foreground'
            }`}
            aria-label="Previous testimonial"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Dot Indicators */}
          <div className="flex gap-2">
            {testimonialData.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  current === index 
                    ? 'w-5 bg-[#006EFC]' 
                    : `w-1.5 ${isNight ? 'bg-white/20 hover:bg-white/40' : 'bg-black/20 hover:bg-black/40'}`
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          <button 
            onClick={handleNext}
            className={`p-2 rounded-full border transition-all duration-300 cursor-pointer flex items-center justify-center ${
              isNight 
                ? 'border-white/10 bg-white/[0.02] hover:bg-white/10 hover:border-white/30 text-white' 
                : 'border-black/10 bg-black/[0.01] hover:bg-black/5 hover:border-black/30 text-foreground'
            }`}
            aria-label="Next testimonial"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md select-none animate-fadeIn"
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(false); }}
            className="absolute top-6 right-6 p-3 text-white/70 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all duration-300 cursor-pointer z-50 shadow-lg border border-white/5"
            aria-label="Close fullscreen view"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          {/* Left Arrow Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-4 md:left-10 p-4 text-white/70 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all duration-300 cursor-pointer z-50 shadow-lg border border-white/5"
            aria-label="Previous image"
          >
            <ChevronLeft size={28} />
          </button>

          {/* Image Container with info caption */}
          <div className="relative max-w-5xl max-h-[80vh] w-full px-4 md:px-20 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img 
              src={testimonialData[current].imageUrl} 
              alt={`Verified client testimonial screenshot proof ${current + 1}`}
              className="max-w-full max-h-[70vh] object-contain rounded-2xl shadow-[0_0_50px_rgba(0,110,252,0.15)] border border-white/10 select-none animate-scaleUp"
              draggable="false"
            />
            {/* Info Badge */}
            <div className="mt-6 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/75 text-[10px] font-bold tracking-wider uppercase font-mono shadow-md">
              {current + 1} / {testimonialData.length}
            </div>
          </div>

          {/* Right Arrow Button */}
          <button 
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-4 md:right-10 p-4 text-white/70 hover:text-white bg-white/5 hover:bg-white/15 rounded-full transition-all duration-300 cursor-pointer z-50 shadow-lg border border-white/5"
            aria-label="Next image"
          >
            <ChevronRight size={28} />
          </button>
        </div>
      )}
    </div>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  'Motion Graphics': '#4F7FFF',
  'Map Animation': '#22c55e',
  '2D Hoodie Guy Style': '#f97316',
  '2D Animation': '#a855f7',
  'SaaS Animation': '#06b6d4',
  'AMV': '#e94dff',
  'Typography': '#eab308',
  'Simple Shorts': '#ef4444',
  'Documentary': '#14b8a6',
};

const FILTER_CATEGORIES = ['All', ...Object.keys(CATEGORY_COLORS)];

interface Project {
  id: number;
  title: string;
  category: string;
  type: string;
  mediaType: 'video';
  description: string;
  youtubeId: string;
  videoUrl: string;
  poster: string;
}

function getYouTubeEmbedUrl(youtubeId: string, mode: 'preview' | 'modal') {
  const baseUrl = `https://www.youtube.com/embed/${youtubeId}`;

  if (mode === 'preview') {
    return `${baseUrl}?autoplay=1&mute=1&controls=0&loop=1&playlist=${youtubeId}&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&vq=hd1080&hd=1`;
  }

  return `${baseUrl}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&vq=hd1080&hd=1`;
}

const projects: Project[] = [
  {
    id: 1,
    title: 'Typography edit',
    category: 'Typography',
    type: 'Typography Short',
    mediaType: 'video',
    description: 'Punchy type-led motion built for fast retention, crisp pacing, and high-scroll stopping power.',
    youtubeId: 'tp6cVrtNaQM',
    videoUrl: 'https://youtube.com/shorts/tp6cVrtNaQM',
    poster: 'https://i.ytimg.com/vi/tp6cVrtNaQM/hqdefault.jpg'
  },
  {
    id: 2,
    title: 'cartoon animation',
    category: '2D Animation',
    type: 'Cartoon Animation',
    mediaType: 'video',
    description: 'Character-driven animation with playful timing, readable staging, and a clean short-form hook.',
    youtubeId: '7xiSD9sFVPc',
    videoUrl: 'https://youtube.com/shorts/7xiSD9sFVPc',
    poster: 'https://i.ytimg.com/vi/7xiSD9sFVPc/hqdefault.jpg'
  },
  {
    id: 3,
    title: 'documentary',
    category: 'Documentary',
    type: 'Documentary Edit',
    mediaType: 'video',
    description: 'A documentary-style short shaped around clarity, mood, and narrative momentum in a compact runtime.',
    youtubeId: 'pyaagZpUIE4',
    videoUrl: 'https://youtube.com/shorts/pyaagZpUIE4',
    poster: 'https://i.ytimg.com/vi/pyaagZpUIE4/hqdefault.jpg'
  },
  {
    id: 4,
    title: 'Aot AMV 4k',
    category: 'AMV',
    type: 'Anime Music Video',
    mediaType: 'video',
    description: 'High-energy anime edit work with sync-heavy pacing, sharp cuts, and cinematic impact.',
    youtubeId: 'J2zRqtzjwLk',
    videoUrl: 'https://youtube.com/shorts/J2zRqtzjwLk',
    poster: 'https://i.ytimg.com/vi/J2zRqtzjwLk/hqdefault.jpg'
  },
  {
    id: 5,
    title: 'BMW edit 2k',
    category: 'AMV',
    type: 'Automotive Edit',
    mediaType: 'video',
    description: 'An automotive short focused on polish, speed, and premium visual rhythm for car content.',
    youtubeId: 'j86KkVflx08',
    videoUrl: 'https://youtube.com/shorts/j86KkVflx08',
    poster: 'https://i.ytimg.com/vi/j86KkVflx08/hqdefault.jpg'
  },
  {
    id: 6,
    title: 'Moolah promotional ad',
    category: 'SaaS Animation',
    type: 'SaaS Animation',
    mediaType: 'video',
    description: 'A promotional ad cut built to sell quickly, highlight value fast, and keep the CTA front and center.',
    youtubeId: '1DA9knqlZoA',
    videoUrl: 'https://youtube.com/shorts/1DA9knqlZoA',
    poster: 'https://i.ytimg.com/vi/1DA9knqlZoA/hqdefault.jpg'
  },
  {
    id: 7,
    title: 'Results matters 2k',
    category: 'Motion Graphics',
    type: 'Motion Graphics',
    mediaType: 'video',
    description: 'A direct response-focused short that keeps the message lean, visual, and conversion-minded.',
    youtubeId: 'opXh54yLjSk',
    videoUrl: 'https://youtube.com/shorts/opXh54yLjSk',
    poster: 'https://i.ytimg.com/vi/opXh54yLjSk/hqdefault.jpg'
  },
  {
    id: 8,
    title: 'animated explainer shorts',
    category: 'Motion Graphics',
    type: 'Motion Graphics',
    mediaType: 'video',
    description: 'An animated explainer short designed for fast education, clarity, and high audience retention.',
    youtubeId: 'AttmmiJe9uc',
    videoUrl: 'https://youtube.com/shorts/AttmmiJe9uc',
    poster: 'https://i.ytimg.com/vi/AttmmiJe9uc/hqdefault.jpg'
  },
  {
    id: 9,
    title: 'How to justify your rates',
    category: 'Motion Graphics',
    type: 'Motion Graphics',
    mediaType: 'video',
    description: 'A talking-point driven short built for authority, clarity, and repeat watch value.',
    youtubeId: 'fAYGVCJ7jgM',
    videoUrl: 'https://youtube.com/shorts/fAYGVCJ7jgM',
    poster: 'https://i.ytimg.com/vi/fAYGVCJ7jgM/hqdefault.jpg'
  },
  {
    id: 10,
    title: 'Map Animation',
    category: 'Map Animation',
    type: 'Map Animation Short',
    mediaType: 'video',
    description: 'A data-driven map animation short combining geo-visual storytelling with fluid motion and sharp transitions.',
    youtubeId: 'gjesrgWAFZc',
    videoUrl: 'https://youtube.com/shorts/gjesrgWAFZc',
    poster: 'https://i.ytimg.com/vi/gjesrgWAFZc/hqdefault.jpg'
  },
  {
    id: 11,
    title: 'Weird Crimes and Punishments from Ancient Rome',
    category: '2D Hoodie Guy Style',
    type: '2D Hoodie Guy Animation',
    mediaType: 'video',
    description: 'An educational animated short in the hoodie-guy style — punchy narration, expressive character work, and high retention pacing.',
    youtubeId: 'NV-hvS1M59Y',
    videoUrl: 'https://youtube.com/shorts/NV-hvS1M59Y',
    poster: 'https://i.ytimg.com/vi/NV-hvS1M59Y/hqdefault.jpg'
  },
  {
    id: 12,
    title: '7 Reasons Why Everyone Hated Socrates',
    category: '2D Hoodie Guy Style',
    type: '2D Hoodie Guy Animation',
    mediaType: 'video',
    description: 'A history-meets-animation short using the iconic hoodie-guy format — tight scripting, clear motion, and irresistible curiosity hooks.',
    youtubeId: 'f7VM2PEiWVQ',
    videoUrl: 'https://youtube.com/shorts/f7VM2PEiWVQ',
    poster: 'https://i.ytimg.com/vi/f7VM2PEiWVQ/hqdefault.jpg'
  }
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Arranges projects so that in every row of COLS cards, no category
 * appears more than MAX_PER_ROW times. Within each category the order
 * is shuffled randomly on every page load.
 */
function arrangeByCategory(arr: Project[], COLS = 4, MAX_PER_ROW = 2): Project[] {
  // Group and shuffle within each category
  const groups = new Map<string, Project[]>();
  arr.forEach(p => {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  });
  groups.forEach((items, key) => groups.set(key, shuffleArray(items)));

  const result: Project[] = [];
  const hasRemaining = () => [...groups.values()].some(g => g.length > 0);

  while (hasRemaining()) {
    const rowCatCount = new Map<string, number>();

    for (let col = 0; col < COLS; col++) {
      // Pick from the category with the most items remaining
      // that hasn't yet hit MAX_PER_ROW in this row
      const available = [...groups.entries()]
        .filter(([cat, items]) => items.length > 0 && (rowCatCount.get(cat) ?? 0) < MAX_PER_ROW)
        .sort(([, a], [, b]) => b.length - a.length);

      if (available.length === 0) break; // every remaining category is capped for this row

      const [pickedCat, pickedItems] = available[0];
      result.push(pickedItems.shift()!);
      rowCatCount.set(pickedCat, (rowCatCount.get(pickedCat) ?? 0) + 1);
    }
  }

  return result;
}

// Arranged once per page load — category-spread with per-category randomness
const arrangedProjects = arrangeByCategory(projects);

function PortfolioCard({ project, priority = false }: { project: Project; priority?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    cardRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    const glare = cardRef.current.querySelector('.glare-layer') as HTMLElement;
    if (glare) {
      glare.style.opacity = '1';
      glare.style.background = `radial-gradient(circle at ${percentX}% ${percentY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`;
    }
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `rotateX(0deg) rotateY(0deg)`;
    const glare = cardRef.current.querySelector('.glare-layer') as HTMLElement;
    if (glare) {
      glare.style.opacity = '0';
    }
  };

  const categoryColor = CATEGORY_COLORS[project.category] || '#006EFC';

  return (
    <div style={{ perspective: '800px' }} className="h-full w-full">
      <style>{`
        .play-overlay { transform: scale(1); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .group:hover .play-overlay { transform: scale(1.15); }
      `}</style>
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative h-[85vw] sm:h-auto sm:aspect-[9/16] overflow-hidden rounded-[28px] border border-border/20 transition-transform duration-200 ease-out preserve-3d bg-black"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <iframe
          src={getYouTubeEmbedUrl(project.youtubeId, 'preview')}
          title={`${project.title} preview`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 z-10 h-full w-full pointer-events-none"
        />

        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30" />
        <div className="glare-layer absolute inset-0 z-40 opacity-0 pointer-events-none transition-opacity duration-300 mix-blend-overlay" />

        <div className="absolute top-3 left-3 z-50 bg-black/70 backdrop-blur-xl px-3 py-1.5 rounded-md shadow-sm border border-white/10" style={{ borderLeftWidth: '4px', borderLeftColor: categoryColor }}>
          <span className="text-[10px] uppercase font-bold tracking-wider text-white border-0">{project.category}</span>
        </div>

        <div className="absolute bottom-4 right-4 z-50">
          <a
            href={project.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pointer-events-auto font-sans flex items-center gap-1 text-xs text-white/70 drop-shadow-md pb-0.5 border-b border-white/30 hover:text-white transition-colors"
          >
            YouTube <ArrowUpRight size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}

interface ThumbnailProject {
  id: number;
  title: string;
  category: string;
  imageUrl: string;
  aspectRatio: '16:9' | '4:5' | '1:1';
}

const thumbnailProjects: ThumbnailProject[] = [
  { id: 1, title: 'Epstein Files Secret', category: 'Documentary', imageUrl: '/thumbnails/thumbnail_8.png', aspectRatio: '1:1' },
  { id: 2, title: 'F1 210 MPH Reaction', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_9.png', aspectRatio: '1:1' },
  { id: 3, title: 'Escape Simulator Thumbnails', category: 'Gaming', imageUrl: '/thumbnails/thumbnail_10.png', aspectRatio: '1:1' },
  { id: 4, title: 'Geopolitical Strategy', category: 'Documentary', imageUrl: '/thumbnails/thumbnail_11.png', aspectRatio: '1:1' },
  { id: 5, title: 'Porn & TikTok Brain', category: 'Lifestyle', imageUrl: '/thumbnails/thumbnail_12.png', aspectRatio: '1:1' },
  { id: 6, title: 'Too Late Dilemma', category: 'Business', imageUrl: '/thumbnails/thumbnail_13.png', aspectRatio: '1:1' },
  { id: 7, title: 'AI Facial Enhancement', category: 'Tech', imageUrl: '/thumbnails/thumbnail_14.png', aspectRatio: '1:1' },
  { id: 8, title: 'Ego Confession Visual', category: 'Lifestyle', imageUrl: '/thumbnails/thumbnail_15.png', aspectRatio: '1:1' },
  { id: 9, title: 'Xiaomi Samsung VS', category: 'Tech', imageUrl: '/thumbnails/thumbnail_16.png', aspectRatio: '1:1' },
  { id: 10, title: '158M² House Project', category: 'Lifestyle', imageUrl: '/thumbnails/thumbnail_17.png', aspectRatio: '1:1' },
  { id: 11, title: 'Videography Success Secret', category: 'Education', imageUrl: '/thumbnails/thumbnail_18.png', aspectRatio: '1:1' },
  { id: 12, title: 'AI Wasp Laser Concept', category: 'Tech', imageUrl: '/thumbnails/thumbnail_19.png', aspectRatio: '1:1' },
  { id: 13, title: 'AI Laser Wasp', category: 'Tech', imageUrl: '/thumbnails/thumbnail_20.png', aspectRatio: '1:1' },
  { id: 14, title: 'Anatomical Shock Visual', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_21.png', aspectRatio: '1:1' },
  { id: 15, title: 'Modern Debt Slavery', category: 'Finance', imageUrl: '/thumbnails/thumbnail_22.png', aspectRatio: '1:1' },
  { id: 16, title: 'Hidden Camera Tech', category: 'Tech', imageUrl: '/thumbnails/thumbnail_23.png', aspectRatio: '1:1' },
  { id: 17, title: 'I AM NOT SORRY Thumbnail', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_24.png', aspectRatio: '1:1' },
  { id: 18, title: 'Cinematic AI Thumbnail', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_25.png', aspectRatio: '1:1' },
  { id: 19, title: 'Indira Gandhi Conspiracy Thumbnail', category: 'Documentary', imageUrl: '/thumbnails/thumbnail_26.png', aspectRatio: '1:1' },
  { id: 20, title: 'AI Cyborg Design', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_27.png', aspectRatio: '1:1' },
  { id: 21, title: 'Project 28', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_28.png', aspectRatio: '1:1' },
  { id: 22, title: 'Project 29', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_29.png', aspectRatio: '1:1' },
  { id: 23, title: 'Project 30', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_30.png', aspectRatio: '1:1' },
  { id: 24, title: 'Project 31', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_31.png', aspectRatio: '1:1' },
  { id: 25, title: 'Project 32', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_32.png', aspectRatio: '1:1' },
  { id: 26, title: 'Project 33', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_33.png', aspectRatio: '1:1' },
  { id: 27, title: 'Project 34', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_34.png', aspectRatio: '1:1' },
  { id: 28, title: 'Project 35', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_35.png', aspectRatio: '1:1' },
  { id: 29, title: 'Project 36', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_36.png', aspectRatio: '1:1' },
  { id: 30, title: 'Project 37', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_37.png', aspectRatio: '1:1' },
  { id: 31, title: 'Project 38', category: 'Entertainment', imageUrl: '/thumbnails/thumbnail_38.png', aspectRatio: '1:1' },
];

function Lightbox({ images, initialIndex, onClose }: { images: ThumbnailProject[], initialIndex: number, onClose: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const goToPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrentIndex((prev) => (prev + 1) % images.length);
      if (e.key === 'ArrowLeft') setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <button 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>

      <button 
        onClick={goToPrev}
        className="absolute left-4 md:left-10 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
      >
        <ChevronLeft size={28} />
      </button>

      <div className="relative max-w-7xl max-h-[85vh] w-full px-4 md:px-20 flex items-center justify-center select-none" onClick={(e) => e.stopPropagation()}>
         <img 
            src={images[currentIndex].imageUrl} 
            alt={images[currentIndex].title}
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-transform duration-300"
         />
         <div className="absolute bottom-[-40px] left-0 right-0 text-center text-white/70 font-medium">
            {currentIndex + 1} / {images.length}
         </div>
      </div>

      <button 
        onClick={goToNext}
        className="absolute right-4 md:right-10 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all cursor-pointer z-50"
      >
        <ChevronRight size={28} />
      </button>
    </div>
  );
}






function ThumbnailsSection({ isNight }: { isNight: boolean }) {
  const [visibleCount, setVisibleCount] = useState(6);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Shuffle all 31 thumbnails exactly once on page load
  const shuffledProjects = React.useMemo(() => {
    const list = [...thumbnailProjects];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }, []);

  const triggerReveal = () => {
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
  
      document.querySelectorAll('.reveal-target:not(.is-visible)').forEach((el) => {
        observer.observe(el);
      });
    }, 100);
  };

  const handleLoadMore = () => {
    setVisibleCount(prev => Math.min(prev + 6, shuffledProjects.length));
    triggerReveal();
  };

  return (
    <>
      <section id="thumbnails" className="relative z-10 w-full py-24 md:py-32 bg-transparent">
        <div className="max-w-7xl mx-auto px-6 md:px-16">
          <div className="reveal-target reveal-slide-left flex flex-col md:flex-row justify-between items-center md:items-end text-center md:text-left mb-12 gap-4 border-b border-border/50 pb-8">
            <div>
              <h2 className={`text-5xl md:text-6xl tracking-tight transition-colors duration-500 ${isNight ? 'text-white' : ''}`} style={{ fontFamily: 'var(--font-display)' }}>Thumbnail Design</h2>
              <p className={`text-xs uppercase tracking-widest font-semibold mt-2 transition-colors duration-500 ${isNight ? 'text-white/50' : 'text-black/40'}`}>Click-optimized visuals for modern audiences</p>
            </div>
            <p className={`max-w-sm text-sm uppercase tracking-widest font-semibold transition-colors duration-500 ${isNight ? 'text-white/70' : 'text-black/60'}`}>The art of the click.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full items-start">
            {shuffledProjects.slice(0, visibleCount).map((item, index) => (
              <div key={item.id} className="reveal-target reveal-slide-up" style={{ transitionDelay: `${(index % 6) * 100}ms` }}>
                <ThumbnailCard item={item} onClick={() => setLightboxIndex(index)} />
              </div>
            ))}
          </div>

          {visibleCount < shuffledProjects.length && (
            <div className="w-full flex justify-center mt-12 reveal-target reveal-slide-up">
              <button 
                onClick={handleLoadMore} 
                className={`bg-transparent border rounded-full px-6 py-3 text-xs uppercase font-medium tracking-widest transition-colors cursor-pointer ${isNight ? 'border-white/40 text-white/80 hover:bg-white/10 hover:text-white' : 'border-black/60 text-foreground hover:bg-foreground hover:text-background'}`}
              >
                Load More
              </button>
            </div>
          )}
        </div>
      </section>

      {lightboxIndex !== null && (
        <Lightbox 
          images={shuffledProjects} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxIndex(null)} 
        />
      )}
    </>
  );
}

function ThumbnailCard({ item, onClick }: { item: ThumbnailProject, onClick?: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    cardRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = `rotateX(0deg) rotateY(0deg)`;
  };

  return (
    <div style={{ perspective: '1000px' }} className="w-full h-full">
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        className="group relative overflow-hidden rounded-[20px] border border-border/20 transition-all duration-300 ease-out bg-black cursor-pointer shadow-lg hover:shadow-2xl hover:border-white/20 aspect-square"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100"
        />
      </div>
    </div>
  );
}

interface FAQItem {
  q: string;
  a: string;
}

const faqItems: FAQItem[] = [
  {
    q: "What is your typical turnaround time?",
    a: "Short-form video edits and high-CTR thumbnails are delivered within 24 to 48 hours. For larger packages or complex motion graphics, we establish custom timelines to ensure maximum quality."
  },
  {
    q: "How many rounds of revisions are included?",
    a: "We offer unlimited revisions until you are 100% satisfied. Pacing, color grade, sound design, and typography will be dialed in to match your precise brand style."
  },
  {
    q: "What tools and software do you work with?",
    a: "We use the latest industry-standard creative tools: Adobe Premiere Pro, After Effects, Photoshop, and DaVinci Resolve for elite color-grading and high-fidelity sound design."
  },
  {
    q: "How do we collaborate on asset delivery?",
    a: "We set up a secure, shared folder via Google Drive or Dropbox. Simply upload your raw footage, assets, and project brief, and we'll handle the rest."
  },
  {
    q: "Do you offer monthly retainer plans?",
    a: "Yes! We offer customized monthly retainers for consistent creators and brands. Retainers lock in dedicated capacity on our calendar and guarantee consistent upload pacing."
  }
];

function FAQ({ isNight }: { isNight: boolean }) {
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex(prev => (prev === i ? null : i));

  return (
    <section id="faq" className="relative z-10 w-full py-32 bg-transparent">
      <div className="max-w-4xl mx-auto px-6 md:px-16">
        {/* Header */}
        <div className="reveal-target reveal-slide-up flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border/50 pb-10 mb-14">
          <div>
            <span className={`text-xs uppercase tracking-[0.2em] font-semibold inline-block border px-4 py-1.5 rounded-full backdrop-blur-sm mb-5 transition-colors duration-500 ${isNight ? 'text-white border-white/20 bg-white/5' : 'text-black/90 border-black/20 bg-black/5 font-bold'}`}>Quick Answers</span>
            <h2 className={`text-5xl md:text-6xl tracking-tight leading-none transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>Frequently<br />Asked</h2>
          </div>
          <p className={`text-sm max-w-xs leading-relaxed transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>Everything you need to know before we start working together. Still have questions? Just reach out.</p>
        </div>

        {/* Accordion */}
        <div className="flex flex-col divide-y divide-border/30">
          {faqItems.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i} className="reveal-target reveal-slide-up" style={{ transitionDelay: `${i * 60}ms` }}>
                <button
                  id={`faq-btn-${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => toggle(i)}
                  className="w-full flex justify-between items-center py-6 text-left gap-6 cursor-pointer group"
                >
                  <span
                    className={`text-base md:text-lg font-medium transition-colors leading-snug duration-300 ${isNight ? 'text-white/90 group-hover:text-white' : 'text-foreground/90 group-hover:text-foreground'}`}
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {item.q}
                  </span>
                  <span
                    className="shrink-0 w-8 h-8 rounded-full border border-border/60 flex items-center justify-center text-muted-foreground group-hover:border-[#006EFC] group-hover:text-[#006EFC] transition-all duration-300"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, color 0.3s' }}
                  >
                    <ChevronDown size={16} strokeWidth={2} />
                  </span>
                </button>

                {/* Answer panel — CSS height transition */}
                <div
                  id={`faq-panel-${i}`}
                  role="region"
                  aria-labelledby={`faq-btn-${i}`}
                  style={{
                    display: 'grid',
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.4s cubic-bezier(0.16,1,0.3,1)'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <p className={`text-[15px] leading-relaxed pb-7 max-w-2xl transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA row */}
        <div className="reveal-target reveal-slide-up mt-14 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-10 border-t border-border/30" style={{ transitionDelay: '500ms' }}>
          <p className={`text-sm transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>Still unsure? Let's talk it through on a quick call.</p>
          <a
            href="https://calendly.com/reachresolve89/schedule-a-meeting-with-us"
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-full flex flex-row items-center pl-6 pr-2 py-2 gap-3 text-sm font-medium transition-colors cursor-pointer inline-flex ${
              isNight 
                ? 'bg-white text-black font-semibold hover:bg-white/90' 
                : 'bg-[#222] text-white hover:bg-black'
            }`}
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Book a Free Call
            <div className={`rounded-full p-2 flex items-center justify-center ${
              isNight ? 'bg-black/10' : 'bg-white/20'
            }`}>
              <ArrowUpRight size={16} className={isNight ? 'text-black' : 'text-white'} />
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}

function ParallaxBackground({ isNight }: { isNight: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const scrolled = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const pct = docHeight > 0 ? scrolled / docHeight : 0;
          
          // Get the actual height of the image.
          // Because the image is w-full and h-auto, it scales proportionally to the screen width.
          const imgHeight = containerRef.current.scrollHeight;
          const viewportHeight = window.innerHeight;
          
          if (imgHeight > viewportHeight) {
            // Translate up by exactly the overflow amount
            const maxTranslate = imgHeight - viewportHeight;
            const translateY = -(pct * maxTranslate);
            containerRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
          } else {
            containerRef.current.style.transform = `translate3d(0, 0, 0)`;
          }
        }
        ticking = false;
      });
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    
    handleScroll();
    const timeout = setTimeout(handleScroll, 150);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      clearTimeout(timeout);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none" style={{ willChange: 'transform' }}>
      <div ref={containerRef} className="w-full relative will-change-transform">
        {/* Day background - drives the height of the container based on its aspect ratio */}
        <img
          src="/day.png"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          onLoad={() => window.dispatchEvent(new Event('scroll'))}
          className={`block w-full h-auto min-h-screen object-cover transition-opacity duration-1000 ${isNight ? 'opacity-0' : 'opacity-100'}`}
          style={{ filter: 'blur(1.5px)' }}
        />
        {/* Night background - absolutely positioned to perfectly overlay the day image */}
        <img
          src="/night.png"
          alt=""
          aria-hidden="true"
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${isNight ? 'opacity-100' : 'opacity-0'}`}
          style={{ filter: 'blur(1.5px)' }}
        />
      </div>
    </div>
  );
}

function PageLoader() {
  const [visible, setVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    const handleLoad = () => {
      setVisible(false);
    };

    if (document.readyState === 'complete') {
      setVisible(false);
    } else {
      window.addEventListener('load', handleLoad);
    }

    const timeout = setTimeout(() => {
      setVisible(false);
    }, 1500);

    return () => {
      window.removeEventListener('load', handleLoad);
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      const timeout = setTimeout(() => {
        setShouldRender(false);
      }, 600);
      return () => clearTimeout(timeout);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="relative flex flex-col items-center gap-4">
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-[#006EFC] animate-spin" />
          <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-[#00D26A] animate-spin [animation-direction:reverse] [animation-duration:1s]" />
        </div>
        <span className="text-white/80 font-medium tracking-[0.2em] text-xs uppercase animate-pulse select-none" style={{ fontFamily: 'var(--font-display)' }}>
          Apex
        </span>
      </div>
    </div>
  );
}

function ScrollProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        setProgress((scrolled / totalHeight) * 100);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 w-full h-[3px] bg-transparent z-[999] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-[#006EFC] via-[#00D26A] to-[#006EFC] transition-all duration-75 ease-out rounded-r-full"
        style={{ width: `${progress}%`, boxShadow: '0 0 10px rgba(0, 110, 252, 0.5)' }}
      />
    </div>
  );
}

function BackToTopButton({ isNight }: { isNight: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 400) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed bottom-6 right-6 z-50 p-3.5 rounded-full border shadow-xl backdrop-blur-md cursor-pointer transition-all duration-300 transform ${
        visible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-4 scale-75 pointer-events-none'
      } ${
        isNight 
          ? 'bg-black/80 hover:bg-black border-white/10 text-white hover:border-[#006EFC]' 
          : 'bg-white/80 hover:bg-white border-black/10 text-black hover:border-[#006EFC]'
      }`}
      style={{
        boxShadow: isNight ? '0 10px 25px -5px rgba(0,0,0,0.7)' : '0 10px 25px -5px rgba(0,0,0,0.1)'
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-transform duration-300 group-hover:-translate-y-0.5"
      >
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  );
}

function SectionDivider() {
  return (
    <div className="w-full h-24 overflow-hidden pointer-events-none">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full fill-background">
        <path d="M0,0 C25,100 75,100 100,0 L100,100 L0,100 Z" />
      </svg>
    </div>
  );
}

function WhyMe({ isNight }: { isNight: boolean }) {
  const pros = [
    { emoji: '🏆', title: 'Elite quality & creative depth' },
    { emoji: '🚀', title: 'Never miss your upload schedule' },
    { emoji: '📈', title: 'Engineered for high CTR & retention' },
    { emoji: '⚡', title: 'Save 20+ hours of editing & design weekly' },
    { emoji: '🤝', title: 'Seamless, fluid collaboration' },
    { emoji: '⏰', title: 'Ultra-fast support & direct access' },
  ];
  const cons = [
    { emoji: '🔍', title: 'Will stalk your channel', sub: 'for research, obviously' },
    { emoji: '💡', title: 'Unsolicited growth advice', sub: "you're welcome in advance" },
    { emoji: '😂', title: 'Good humour (sometimes)', sub: 'meetings run 5 min over. my fault' },
    { emoji: '📅', title: 'Often fully booked', sub: 'check availability at the bottom' },
    { emoji: '⚡', title: 'Startup founder on the side', sub: 'multi-threading at its finest' },
  ];
  return (
    <section className="relative z-10 w-full py-24 bg-transparent overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 md:px-16">
        <div className="reveal-target reveal-slide-up flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-border/50 pb-8 mb-12">
          <div>
            <span className={`text-xs uppercase tracking-[0.2em] font-semibold inline-block border px-4 py-1.5 rounded-full backdrop-blur-sm mb-4 transition-colors duration-500 ${isNight ? 'text-white border-white/20 bg-white/5' : 'text-black/90 border-black/20 bg-black/5 font-bold'}`}>Why work with me?</span>
            <h2 className={`text-5xl md:text-6xl tracking-tight leading-none transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>Pros &amp; Cons</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div className="flex flex-col gap-2 md:gap-3 reveal-target reveal-slide-up">
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] font-bold text-[#00D26A] mb-1">✔ Pros</span>
            {pros.map((item, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-[#00D26A]/10 bg-[#00D26A]/[0.04] hover:bg-[#00D26A]/[0.09] hover:border-[#00D26A]/25 transition-all duration-300 cursor-default">
                <span className="text-sm md:text-lg shrink-0 leading-none">{item.emoji}</span>
                <span className={`text-[10px] md:text-[13px] font-medium leading-snug transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground/85'}`}>{item.title}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2 md:gap-3 reveal-target reveal-slide-up" style={{ transitionDelay: '200ms' }}>
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] font-bold text-[#FF4B5C] mb-1">⚠ Cons</span>
            {cons.map((item, i) => (
              <div key={i} className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3.5 rounded-xl md:rounded-2xl border border-[#FF4B5C]/10 bg-[#FF4B5C]/[0.04] hover:bg-[#FF4B5C]/[0.09] hover:border-[#FF4B5C]/25 transition-all duration-300 cursor-default">
                <span className="text-sm md:text-lg shrink-0 leading-none">{item.emoji}</span>
                <div className="min-w-0">
                  <div className={`text-[10px] md:text-[13px] font-medium leading-snug transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground/85'}`}>{item.title}</div>
                  <div className={`text-[9px] md:text-[11px] italic mt-0.5 truncate transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-black/60'}`}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// This UUID uniquely identifies this specific portfolio.
const PORTFOLIO_ID = '3a5f9737-142f-48d6-95af-ec090287a38b';

export default function App() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '', _contact_phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isNight, setIsNight] = useState(false);

  // Day/Night Cycle Timer: Auto-toggles theme every 15 seconds ONLY when the dinosaur game is active and running
  useEffect(() => {
    let playTime = 0;

    const checkGameAndCycle = () => {
      try {
        const iframe = document.querySelector('iframe[title="Dino Game"]') as HTMLIFrameElement | null;
        if (!iframe) {
          playTime = 0;
          return;
        }

        let gdjsGame = null;
        try {
          if (iframe.contentWindow) {
            gdjsGame = (iframe.contentWindow as any).gdjsGame;
          }
        } catch (innerErr) {
          // Silent catch for cross-origin domain access restrictions
        }

        if (gdjsGame) {
          const sceneStack = gdjsGame.getSceneStack();
          if (sceneStack) {
            const scene = sceneStack.getCurrentScene();
            if (scene) {
              const timeScale = scene.getTimeManager().getTimeScale();
              // GDevelop sets the timescale to 0.00001 or 0 when it's game over or paused.
              // If timescale is close to 1, the game is actively playing.
              if (timeScale > 0.1) {
                playTime += 1;
                if (playTime >= 15) {
                  setIsNight(prev => !prev);
                  playTime = 0;
                }
                return;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Could not read GDevelop timeScale, falling back to page timer.', e);
        playTime += 1;
        if (playTime >= 15) {
          setIsNight(prev => !prev);
          playTime = 0;
        }
        return;
      }
      // Reset playTime if not actively playing so the 15-second cycle restarts fresh on next run
      playTime = 0;
    };

    const cycleTimer = setInterval(checkGameAndCycle, 1000);
    return () => clearInterval(cycleTimer);
  }, []);

  // Filtering System State
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(12);
  const [animatingCards, setAnimatingCards] = useState(false);
  const [displayProjects, setDisplayProjects] = useState<Project[]>(arrangedProjects.slice(0, 12));

  useScrollReveal();

  const handleCategoryClick = (cat: string) => {
    if (cat === activeCategory) return;
    setAnimatingCards(true);
    setTimeout(() => {
      setActiveCategory(cat);
      const newFiltered = arrangedProjects.filter(p => cat === 'All' || p.category === cat);
      setVisibleCount(12);
      setDisplayProjects(newFiltered.slice(0, 12));
      setAnimatingCards(false);
    }, 150);
  };

  const handleLoadMore = () => {
    const newCount = visibleCount + 12;
    const newFiltered = arrangedProjects.filter(p => activeCategory === 'All' || p.category === activeCategory);
    setVisibleCount(newCount);
    setDisplayProjects(newFiltered.slice(0, newCount));
  };

  const currentTotal = arrangedProjects.filter(p => activeCategory === 'All' || p.category === activeCategory).length;

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    // Honeypot spam protection check
    const isSpam = formData._contact_phone.trim().length > 0;

    try {
      // Fetch detailed location (City, Region, Country) instead of just relying on the 2-letter country code server-side
      let locationDetail = undefined;
      try {
        const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const geoData = await geoRes.json();
        const parts = [geoData.city, geoData.region, geoData.country].filter(Boolean);
        if (parts.length > 0) {
          locationDetail = parts.join(', ');
        }
      } catch (err) {
        console.warn('Could not fetch detailed location, falling back to server default', err);
      }

      const insertPayload: any = {
        portfolio_id: PORTFOLIO_ID,
        portfolio_url: window.location.origin,
        name: formData.name,
        email: formData.email,
        project_details: formData.message,
        is_spam: isSpam
      };

      if (locationDetail) {
        insertPayload.location = locationDetail;
      }

      const { error } = await supabase.from('leads').insert(insertPayload);

      if (error) {
        console.error('Submission error:', error);
        setSubmitStatus('error');
      } else {
        setSubmitStatus('success');
        setFormData({ name: '', email: '', message: '', _contact_phone: '' });
        setTimeout(() => setSubmitStatus('idle'), 4000);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen text-foreground overflow-x-hidden selection:bg-foreground selection:text-background font-sans">
      <PageLoader />
      <ScrollProgressBar />
      <BackToTopButton isNight={isNight} />

      <ParallaxBackground isNight={isNight} />

      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-row items-center justify-between px-3 py-2 w-[95%] max-w-5xl bg-gray-200/55 backdrop-blur-2xl backdrop-saturate-[1.8] border border-white/20 rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:bg-gray-200/65 transition-all duration-500">
        <a href="#home" className="pl-3 text-[17px] font-semibold text-black/90 tracking-tight hover:text-black transition-colors duration-200" style={{ fontFamily: 'var(--font-body)' }}>
          Apex
        </a>
        <nav className="hidden md:flex flex-row items-center gap-1">
          <a href="#about" className="text-sm font-medium text-black/70 hover:text-black/95 px-4 py-2 rounded-xl transition-all duration-300" style={{ fontFamily: 'var(--font-body)' }}>About</a>
          <a href="#projects" className="text-sm font-medium text-black/70 hover:text-black/95 px-4 py-2 rounded-xl transition-all duration-300" style={{ fontFamily: 'var(--font-body)' }}>Video</a>
          <a href="#thumbnails" className="text-sm font-medium text-black/70 hover:text-black/95 px-4 py-2 rounded-xl transition-all duration-300" style={{ fontFamily: 'var(--font-body)' }}>Thumbnails</a>
          <a href="#testimonial" className="text-sm font-medium text-black/70 hover:text-black/95 px-4 py-2 rounded-xl transition-all duration-300" style={{ fontFamily: 'var(--font-body)' }}>Testimonials</a>
          <a href="#faq" className="text-sm font-medium text-black/70 hover:text-black/95 px-4 py-2 rounded-xl transition-all duration-300" style={{ fontFamily: 'var(--font-body)' }}>FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNight(!isNight)}
            className="flex items-center justify-center p-2 rounded-lg text-black/70 hover:text-black hover:bg-black/5 transition-all duration-300"
            aria-label="Toggle Theme"
          >
            {isNight ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <a href="https://calendly.com/reachresolve89/schedule-a-meeting-with-us" target="_blank" rel="noopener noreferrer" className="bg-black text-white rounded-xl flex flex-row items-center pl-4 pr-1.5 py-1.5 gap-2 text-[13px] font-medium hover:bg-black/80 transition-all duration-300 inline-flex" style={{ fontFamily: 'var(--font-body)' }}>
            Book Meeting
            <div className="bg-white/10 rounded-lg p-1.5 flex items-center justify-center">
              <ArrowUpRight size={14} className="text-white" />
            </div>
          </a>
        </div>
      </header>

      <main>
        {/* ── Hero Section ─────────────────────────────────────────── */}
        <section
          id="home"
          className="relative z-10 flex items-center justify-center px-4 md:px-6 pt-[4.5rem] lg:pt-32 pb-12 lg:pb-24 min-h-screen"
        >
          <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* ── Left Column: Hero Copy ── */}
            <div className="lg:col-span-6 flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
              {/* Main headline */}
              <h1
                className={`text-[clamp(2.5rem,5.5vw,4.25rem)] font-bold leading-[1.08] tracking-tight transition-colors duration-500 ${
                  isNight ? 'text-white' : 'text-foreground'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className="lg:whitespace-nowrap">Videos &amp; Thumbnails</span>
                <br />
                that <span className="text-[#006EFC]">perform.</span>
              </h1>

              {/* Sub-headline */}
              <p
                className={`text-base md:text-lg max-w-xl lg:max-w-2xl leading-relaxed mt-2.5 lg:mt-5 transition-colors duration-500 ${
                  isNight ? 'text-white/75' : 'text-black/65'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                High-retention edits and high-CTR thumbnails. Delivered fast.
              </p>

              {/* CTA row */}
              <div className="flex flex-col items-center lg:items-start gap-3 mt-4 lg:mt-6">
                <MagneticButton
                  href="https://calendly.com/reachresolve89/schedule-a-meeting-with-us"
                  className={`rounded-full flex flex-row items-center pl-6 pr-2 py-2.5 gap-3 text-sm font-medium transition-all duration-300 inline-flex ${
                    isNight 
                      ? 'bg-white text-black font-semibold hover:bg-white/90' 
                      : 'bg-black text-white hover:bg-black/80'
                  }`}
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Book a Free Call
                  <div className={`rounded-full p-2 flex items-center justify-center ${
                    isNight ? 'bg-black/10' : 'bg-white/15'
                  }`}>
                    <ArrowUpRight size={15} className={isNight ? 'text-black' : 'text-white'} />
                  </div>
                </MagneticButton>
                <p className={`text-[11px] font-medium tracking-wide transition-colors duration-500 ${isNight ? 'text-white/50' : 'text-black/50'}`} style={{ fontFamily: 'var(--font-body)' }}>
                  ✓ Unlimited revisions until you're 100% satisfied
                </p>
              </div>

              {/* Quick trust signals with breathing space */}
              <div className={`flex items-center gap-6 mt-6 lg:mt-8 text-[11px] uppercase tracking-[0.15em] font-semibold transition-colors duration-500 ${isNight ? 'text-white/60' : 'text-black/60'}`}>
                <span>118+ Clients</span>
                <span className="w-1 h-1 rounded-full bg-current" />
                <span>1000+ Edits</span>
                <span className="w-1 h-1 rounded-full bg-current" />
                <span>1B+ Views</span>
              </div>
            </div>

            <div className="lg:col-span-6 w-full flex justify-center items-center order-1 lg:order-2">
              <DinoGame />
            </div>
          </div>
        </section>
        <SectionDivider />

        <section id="stats" className="relative z-10 w-full py-24 bg-transparent overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,110,252,0.03)_0%,transparent_50%)] pointer-events-none" />

          <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, var(--color-foreground) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          <div className="max-w-7xl mx-auto px-6 md:px-16 relative z-10">
            <div className="text-center mb-16 reveal-target reveal-slide-up">
              <h3 className={`text-xs uppercase tracking-[0.2em] font-semibold inline-block border px-4 py-1.5 rounded-full backdrop-blur-sm transition-colors duration-500 ${isNight ? 'text-white border-white/20 bg-white/5' : 'text-black/90 border-black/20 bg-black/5'}`}>By The Numbers</h3>
            </div>

            {/* Row 1: Big platform stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-4 mb-20 relative">
              <div className="hidden lg:block absolute left-1/4 top-0 bottom-0 w-[1px] bg-border/20"></div>
              <div className="hidden lg:block absolute left-2/4 top-0 bottom-0 w-[1px] bg-border/20"></div>
              <div className="hidden lg:block absolute left-3/4 top-0 bottom-0 w-[1px] bg-border/20"></div>

              <div className="text-center flex flex-col items-center justify-center py-4 reveal-target reveal-slide-up" style={{ transitionDelay: '0ms' }}>
                <div className="text-[clamp(2.8rem,6vw,5rem)] font-bold text-[#006EFC] mb-2 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  <ScrollCounter value={118} suffix="+" />
                </div>
                <div className={`text-[0.75rem] uppercase tracking-[0.15em] font-medium transition-colors duration-500 ${isNight ? 'text-white' : 'text-black font-bold'}`}>Clients Served</div>
              </div>

              <div className="text-center flex flex-col items-center justify-center py-4 reveal-target reveal-slide-up" style={{ transitionDelay: '100ms' }}>
                <div className="text-[clamp(2.8rem,6vw,5rem)] font-bold text-[#006EFC] mb-2 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  <ScrollCounter value={1000} suffix="+" />
                </div>
                <div className={`text-[0.75rem] uppercase tracking-[0.15em] font-medium transition-colors duration-500 ${isNight ? 'text-white' : 'text-black font-bold'}`}>Videos Edited</div>
              </div>

              <div className="text-center flex flex-col items-center justify-center py-4 reveal-target reveal-slide-up" style={{ transitionDelay: '200ms' }}>
                <div className="text-[clamp(2.8rem,6vw,5rem)] font-bold text-[#006EFC] mb-2 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  <BillionCounter duration={3000} />
                </div>
                <div className={`text-[0.75rem] uppercase tracking-[0.15em] font-medium transition-colors duration-500 ${isNight ? 'text-white' : 'text-black font-bold'}`}>Views Generated</div>
              </div>

              <div className="text-center flex flex-col items-center justify-center py-4 reveal-target reveal-slide-up" style={{ transitionDelay: '300ms' }}>
                <div className="text-[clamp(2.8rem,6vw,5rem)] font-bold text-[#006EFC] mb-2 leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  <span>4.8<span style={{ fontSize: '0.55em' }}>★</span></span>
                </div>
                <div className={`text-[0.75rem] uppercase tracking-[0.15em] font-medium transition-colors duration-500 ${isNight ? 'text-white' : 'text-black font-bold'}`}>Average Star Rating</div>
              </div>
            </div>

            {/* Row 2: Trust signals */}
            <div className="flex flex-wrap justify-center items-center gap-4 reveal-target reveal-slide-up" style={{ transitionDelay: '400ms' }}>
              {[
                { text: "⚡ 24-Hour Avg Delivery" },
                { text: "🔁 Unlimited Revisions" },
                { text: "🎯 Retention-First Editing" },
                { text: "🌍 Worked with Creators in 6 Countries" }
              ].map((badge, i) => (
                <div key={i} className="group flex items-center justify-center gap-2 bg-background border border-border/40 text-foreground/80 hover:text-foreground hover:border-[#006EFC] px-4 py-2 rounded-full transition-all duration-300 hover:shadow-[0_0_12px_rgba(0,110,252,0.15)] cursor-default">
                  <span className="text-[13px] font-medium whitespace-nowrap">{badge.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <SectionDivider />

        <WhyMe isNight={isNight} />
        <SectionDivider />

        <section id="projects" className="relative z-10 w-full py-32 bg-transparent">
          <style>{`
            .filter-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .filter-scrollbar {
              -ms-overflow-style: none;  
              scrollbar-width: none;  
              -webkit-overflow-scrolling: touch;
            }
          `}</style>
          <div className="max-w-7xl mx-auto px-6 md:px-16">
            <div className="reveal-target reveal-slide-left flex flex-col md:flex-row justify-between items-center md:items-end text-center md:text-left mb-12 gap-4 border-b border-border/50 pb-8">
              <h2 className={`text-5xl md:text-6xl tracking-tight transition-colors duration-500 ${isNight ? 'text-white' : ''}`} style={{ fontFamily: 'var(--font-display)' }}>Selected Works</h2>
              <p className={`max-w-sm text-sm uppercase tracking-widest font-semibold transition-colors duration-500 ${isNight ? 'text-white/70' : 'text-black/60'}`}>A collection of movement & sound.</p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap lg:flex-nowrap justify-center gap-2 lg:gap-1.5 xl:gap-2 pb-4 mb-10 w-full reveal-target reveal-slide-up">
              {FILTER_CATEGORIES.map((cat, i) => {
                const isActive = activeCategory === cat;

                return (
                  <button
                    key={i}
                    onClick={() => handleCategoryClick(cat)}
                    className={`px-4 py-2.5 md:px-5 md:py-2.5 lg:px-3 xl:px-4 rounded-full text-[10px] md:text-[11px] font-semibold leading-none uppercase tracking-wider md:tracking-widest lg:tracking-wider transition-all duration-300 flex-shrink-0 cursor-pointer whitespace-nowrap ${isActive
                      ? 'bg-[#006EFC] text-white shadow-[0_0_15px_rgba(0,110,252,0.4)] border border-[#006EFC]'
                      : `bg-transparent border border-border/60 hover:border-foreground/40 hover:text-foreground transition-all duration-300 ${isNight ? 'text-white/70' : 'text-black/60'}`
                      }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 w-full transition-all duration-150 ease-out ${animatingCards ? 'opacity-0 scale-[0.95]' : 'opacity-100 scale-100'}`}>
              {displayProjects.map((project, index) => (
                <div key={`${project.id}`} className="w-full">
                  <PortfolioCard project={project} priority={index < 4} />
                </div>
              ))}
              {displayProjects.length === 0 && (
                <div className="py-20 text-center w-full col-span-full">
                  <p className="text-muted-foreground/60 tracking-widest uppercase text-sm">No items matching your criteria.</p>
                </div>
              )}
            </div>

            {/* Load More Pagination */}
            {visibleCount < currentTotal && (
              <div className="w-full flex justify-center mt-6">
                <button onClick={handleLoadMore} className="bg-transparent text-foreground border border-border/60 rounded-full px-6 py-3 text-xs uppercase font-medium tracking-widest hover:bg-foreground hover:text-background transition-colors cursor-pointer">
                  Load More
                </button>
              </div>
            )}
          </div>
        </section>

        <ThumbnailsSection isNight={isNight} />
        <SectionDivider />

        <section id="about" className="relative z-10 w-full py-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black/5 to-background">
          <div className="max-w-4xl mx-auto px-8 text-center flex flex-col items-center">
            <h2 className={`text-5xl md:text-[5.5rem] font-normal tracking-tight mb-8 leading-tight transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>
              {"I shape the narrative.".split(" ").map((word, i, arr) => (
                <span key={i} className="inline-block reveal-target reveal-slide-up" style={{ transitionDelay: `${i * 100}ms` }}>
                  {word}{i !== arr.length - 1 && '\u00A0'}
                </span>
              ))}
            </h2>
            <p className={`text-lg md:text-xl leading-relaxed font-sans mb-12 max-w-2xl px-4 transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>
              I am a specialized freelance video editor and thumbnail designer focusing on high-retention cuts, dynamic color grading, and clickable visuals. With a deep understanding of platform algorithms, I transform raw footage and concepts into highly engaging content that grabs attention.
            </p>

            <ProcessTimeline isNight={isNight} />

            <TestimonialCarousel isNight={isNight} />

            {/* ANIMATED WAVEFORM VISUALIZER */}
            <div className="reveal-target reveal-scale-up w-full max-w-3xl mx-auto mt-24 md:mt-32 mb-8 w-[90%] md:w-full" style={{ transitionDelay: '500ms' }}>
              <AnimatedWaveform />
              <p className={`text-center text-[10px] uppercase tracking-[0.2em] font-mono mt-8 opacity-70 transition-colors duration-500 ${isNight ? 'text-white' : 'text-muted-foreground'}`}>
                Every frame, shaped with intention.
              </p>
            </div>

          </div>
        </section>

        <FAQ isNight={isNight} />
        <SectionDivider />

        {/* ── Last Call to Action ── */}
        <section className="relative z-10 w-full py-20 px-6 md:px-16 overflow-hidden">
          <div className={`max-w-5xl mx-auto rounded-3xl p-10 md:p-16 border relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10 transition-all duration-500 ${
            isNight 
              ? 'border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent backdrop-blur-md bg-black/10' 
              : 'border-black/10 bg-gradient-to-br from-black/[0.02] to-transparent backdrop-blur-md bg-white/20'
          }`}>
            {/* Background decorative blue glow */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-[#006EFC]/10 filter blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-[#006EFC]/5 filter blur-3xl pointer-events-none" />

            <div className="flex flex-col gap-4 text-center md:text-left z-10 max-w-xl">
              <h2 className={`text-4xl md:text-5xl font-bold tracking-tight leading-tight transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>
                Ready to make <br />
                <span className="text-[#006EFC]">viewers stay?</span>
              </h2>
              <p className={`text-sm md:text-base leading-relaxed transition-colors duration-500 ${isNight ? 'text-white/70' : 'text-black/70'}`} style={{ fontFamily: 'var(--font-body)' }}>
                Stop leaving views and engagement on the table. Secure your spot now to collaborate and transform your ideas into high-retention videos and high-CTR thumbnails.
              </p>
            </div>

            <div className="flex flex-col items-center md:items-end gap-3 z-10 shrink-0">
              <MagneticButton
                href="https://calendly.com/reachresolve89/schedule-a-meeting-with-us"
                className={`rounded-full flex flex-row items-center pl-6 pr-2 py-2.5 gap-3 text-sm font-medium transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.15)] inline-flex ${
                  isNight 
                    ? 'bg-white text-black font-semibold hover:bg-white/90' 
                    : 'bg-black text-white hover:bg-black/80'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Book your call now
                <div className={`rounded-full p-2 flex items-center justify-center ${
                  isNight ? 'bg-black/10' : 'bg-white/15'
                }`}>
                  <ArrowUpRight size={15} className={isNight ? 'text-black' : 'text-white'} />
                </div>
              </MagneticButton>
              <p className={`text-[10px] uppercase tracking-widest font-semibold transition-colors duration-500 ${isNight ? 'text-white/40' : 'text-black/40'}`}>
                ✓ Spots are limited for this month
              </p>
            </div>
          </div>
        </section>

        <SectionDivider />

        <footer id="testimonial" className="relative z-10 w-full bg-transparent pt-32 pb-12 px-8 md:px-16 overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-start gap-20">

            <div className="w-full lg:w-1/2 reveal-target reveal-slide-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-widest mb-6">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Availability slot: {Math.floor(Math.random() * 2) + 1}
              </div>
              <h2 className={`text-6xl md:text-[64px] mb-6 leading-none tracking-tight transition-colors duration-500 ${isNight ? 'text-white' : 'text-foreground'}`} style={{ fontFamily: 'var(--font-display)' }}>Let's work<br />together.</h2>

              <p className={`text-sm leading-relaxed mb-6 max-w-sm transition-colors duration-500 ${isNight ? 'text-white/80' : 'text-muted-foreground'}`}>Ready to upgrade your videos and thumbnails? Fill out the form or reach out directly.</p>
              <a href="mailto:reachresolve005@gmail.com" className={`text-base underline underline-offset-4 transition-colors duration-500 font-medium ${isNight ? 'text-white decoration-white/30 hover:decoration-white' : 'text-foreground decoration-border hover:decoration-foreground'}`}>reachresolve005@gmail.com</a>

              <form onSubmit={handleFormSubmit} className="flex flex-col gap-8 mt-12 w-full max-w-md">
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    required
                    value={formData.name}
                    onChange={handleFormChange}
                    className={`group peer w-full bg-transparent border-b pb-3 text-[15px] focus:outline-none transition-colors duration-500 placeholder-transparent ${isNight ? 'text-white border-white/30 focus:border-white' : 'text-foreground border-border focus:border-foreground'}`}
                    placeholder="Name"
                  />
                  <label htmlFor="name" className={`absolute left-0 top-0 text-[13px] transition-all duration-500 peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-0 peer-focus:-top-5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-widest ${isNight ? 'text-white/60 peer-focus:text-white' : 'text-muted-foreground peer-focus:text-foreground'}`}>Name</label>
                </div>

                <div className="relative mt-2">
                  <input
                    type="email"
                    name="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={handleFormChange}
                    className={`group peer w-full bg-transparent border-b pb-3 text-[15px] focus:outline-none transition-colors duration-500 placeholder-transparent ${isNight ? 'text-white border-white/30 focus:border-white' : 'text-foreground border-border focus:border-foreground'}`}
                    placeholder="Email"
                  />
                  <label htmlFor="email" className={`absolute left-0 top-0 text-[13px] transition-all duration-500 peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-0 peer-focus:-top-5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-widest ${isNight ? 'text-white/60 peer-focus:text-white' : 'text-muted-foreground peer-focus:text-foreground'}`}>Email Address</label>
                </div>

                <div className="relative mt-2">
                  <textarea
                    name="message"
                    id="message"
                    required
                    rows={1}
                    value={formData.message}
                    onChange={handleFormChange}
                    className={`group peer w-full bg-transparent border-b pb-3 text-[15px] focus:outline-none transition-colors resize-y min-h-[40px] duration-500 placeholder-transparent ${isNight ? 'text-white border-white/30 focus:border-white' : 'text-foreground border-border focus:border-foreground'}`}
                    placeholder="Message"
                  />
                  <label htmlFor="message" className={`absolute left-0 top-0 text-[13px] transition-all duration-500 peer-placeholder-shown:text-[15px] peer-placeholder-shown:top-0 peer-focus:-top-5 peer-focus:text-[11px] peer-focus:uppercase peer-focus:tracking-widest ${isNight ? 'text-white/60 peer-focus:text-white' : 'text-muted-foreground peer-focus:text-foreground'}`}>Project Details</label>
                </div>

                {/* Honeypot field for spam bots */}
                <div style={{ position: 'absolute', opacity: 0, top: 0, left: -9999, zIndex: -1 }}>
                  <input
                    type="text"
                    name="_contact_phone"
                    tabIndex={-1}
                    value={formData._contact_phone}
                    onChange={handleFormChange}
                    autoComplete="off"
                    aria-hidden="true"
                  />
                </div>

                <div className="flex flex-col items-center lg:items-start mt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`rounded-full flex flex-row items-center pl-6 pr-2 py-2 gap-3 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      isNight 
                        ? 'bg-white text-black font-semibold hover:bg-white/90' 
                        : 'bg-[#222] text-white hover:bg-black'
                    }`}
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {isSubmitting ? 'Sending...' : submitStatus === 'success' ? 'Message Sent!' : 'Submit Query'}
                    <div className={`rounded-full p-2 flex items-center justify-center ${
                      isNight ? 'bg-black/10' : 'bg-white/20'
                    }`}>
                      {isSubmitting ? (
                        <Loader2 size={16} className={isNight ? 'text-black animate-spin' : 'text-white animate-spin'} />
                      ) : submitStatus === 'success' ? (
                        <CheckCircle size={16} className={isNight ? 'text-black' : 'text-white'} />
                      ) : (
                        <ArrowUpRight size={16} className={isNight ? 'text-black' : 'text-white'} />
                      )}
                    </div>
                  </button>
                  {submitStatus === 'error' && (
                    <span className="text-[#006EFC] text-xs font-medium mt-3 tracking-wide uppercase">Something went wrong. Please try again.</span>
                  )}
                </div>
              </form>
            </div>

          </div>

          <div className={`max-w-7xl mx-auto mt-32 pt-8 border-t flex flex-col md:flex-row justify-between items-center text-[11px] uppercase tracking-widest gap-4 transition-colors duration-500 ${isNight ? 'border-white/30 text-white/60' : 'border-black/30 text-black/80 font-semibold'}`}>
            <p>&copy; 2026 Apex. All rights reserved.</p>
            <p>Designed with Intent</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

