'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

// Блок с GSAP-анимацией появления (fade + сдвиг). Для «дорогих» входных анимаций.
export default function Reveal({ children, className, delay = 0, y = 26, duration = 0.8, as: Tag = 'div' }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(el, { opacity: 0, y }, { opacity: 1, y: 0, duration, delay, ease: 'power3.out' });
    }, el);
    return () => ctx.revert();
  }, [delay, y, duration]);

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
