import { createPortal } from 'react-dom';
import { useSkin } from './useSkin';

/** A surface-bound frame; its separate pieces keep their proportions on narrow cards. */
export function ScarletHeroFrame() {
  const { skin } = useSkin();
  if (skin !== 'scarlet') return null;
  return (
    <div className="scarlet-hero-frame" aria-hidden="true">
      <span className="scarlet-hero-lace scarlet-hero-lace-top" />
      <span className="scarlet-hero-lace scarlet-hero-lace-bottom" />
      <span className="scarlet-hero-corner scarlet-hero-corner-tl" />
      <span className="scarlet-hero-corner scarlet-hero-corner-tr" />
      <span className="scarlet-hero-corner scarlet-hero-corner-bl" />
      <span className="scarlet-hero-corner scarlet-hero-corner-br" />
      <span className="scarlet-hero-crest" />
      <span className="scarlet-hero-pendant" />
    </div>
  );
}

/** Original, code-native ornaments. No remote fonts, images or per-frame JS. */
export function VampireCrest({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 80" fill="none" aria-hidden="true">
      <path d="M77 35C60 14 36 6 8 12C24 24 25 34 24 47C38 40 47 45 52 57C60 48 66 48 72 58L80 72L88 58C94 48 100 48 108 57C113 45 122 40 136 47C135 34 136 24 152 12C124 6 100 14 83 35" fill="currentColor" opacity=".22" />
      <path d="M77 35C60 14 36 6 8 12C24 24 25 34 24 47C38 40 47 45 52 57C60 48 66 48 72 58L80 72L88 58C94 48 100 48 108 57C113 45 122 40 136 47C135 34 136 24 152 12C124 6 100 14 83 35" stroke="currentColor" strokeWidth="1.5" />
      <path d="M80 16L91 36L80 56L69 36Z" fill="currentColor" />
      <path d="M76 32L80 44L84 32" stroke="var(--scarlet-gold)" strokeWidth="2" />
      <path d="M40 20L54 40M120 20L106 40M80 4V10M76 7H84" stroke="currentColor" />
    </svg>
  );
}

function MansionClock() {
  return (
    <svg viewBox="0 0 240 240" fill="none" className="mansion-clock" aria-hidden="true">
      <circle cx="120" cy="120" r="112" stroke="currentColor" strokeWidth=".6" />
      <circle cx="120" cy="120" r="104" stroke="currentColor" strokeWidth="2" />
      <circle cx="120" cy="120" r="96" stroke="currentColor" strokeDasharray="1 6" strokeWidth="4" />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d="M120 32V42" stroke="currentColor" strokeWidth="1.5" transform={`rotate(${i * 30} 120 120)`} />)}
      <g fontFamily="Georgia, serif" fontSize="17" textAnchor="middle" fill="currentColor">
        <text x="120" y="65">XII</text><text x="180" y="126">III</text><text x="120" y="187">VI</text><text x="60" y="126">IX</text>
      </g>
      <path className="scarlet-hour-hand" d="M120 124V78M114 85L120 73L126 85" stroke="currentColor" strokeWidth="3" />
      <path className="scarlet-minute-hand" d="M120 136V53M115 61L120 49L125 61" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="120" cy="120" r="5" fill="currentColor" />
      <path d="M20 120H33M207 120H220M120 20V33M120 207V220" stroke="currentColor" />
    </svg>
  );
}

export function ScarletAtmosphere() {
  const { skin } = useSkin();
  if (skin !== 'scarlet') return null;
  return createPortal(
    <div className="scarlet-atmosphere" aria-hidden="true">
      <div className="scarlet-moon" />
      <VampireCrest className="scarlet-flight scarlet-flight-one" />
      <VampireCrest className="scarlet-flight scarlet-flight-two" />
      <div className="scarlet-thorns" />
      <div className="scarlet-corner-clock"><MansionClock /></div>
      <FrozenKnives />
    </div>, document.body,
  );
}

/** Stopped silver knives and clockwork form a static, non-interactive corner vignette. */
function FrozenKnives() {
  return (
    <svg className="scarlet-frozen-knives" viewBox="0 0 220 220" fill="none" aria-hidden="true">
      <path d="M20 200A180 180 0 0 1 200 20" stroke="currentColor" strokeWidth=".7" strokeDasharray="2 8" />
      {[[-12, 28, 52], [22, 70, 34], [52, 112, 30], [78, 151, 47]].map(([angle, x, y]) => (
        <g key={angle} transform={`translate(${x} ${y}) rotate(${angle} 12 55)`}>
          <path d="M12 0L19 62L12 77L5 62Z" stroke="currentColor" fill="currentColor" fillOpacity=".12" />
          <path d="M12 9V69M0 78H24M8 82V99H16V82M6 102H18" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="12" cy="108" r="3" stroke="currentColor" />
        </g>
      ))}
      <path d="M22 180L25 187L32 190L25 193L22 200L19 193L12 190L19 187ZM182 19V29M177 24H187" stroke="currentColor" />
    </svg>
  );
}
