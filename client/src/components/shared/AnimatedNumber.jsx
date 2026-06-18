import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedNumber — counts from 0 to `value` with a smooth animation.
 * Supports integers, decimals, percentages, and currency.
 */
export default function AnimatedNumber({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  decimals = 0,
  style,
  className,
}) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const numericValue = parseFloat(String(value).replace(/[^0-9.\-]/g, '')) || 0;
    const start = performance.now();

    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(numericValue * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  const formatted = display.toFixed(decimals);
  const parts = formatted.split('.');
  const intPart = Number(parts[0]).toLocaleString('en-US');
  const decPart = parts[1] ? `.${parts[1]}` : '';

  return (
    <span className={className} style={style}>
      {prefix}
      {intPart}
      {decPart}
      {suffix}
    </span>
  );
}
