const illustrations = {
  scan: (
    <svg viewBox="0 0 640 520" aria-hidden="true">
      <path d="M95 405c72-92 145-135 220-127 91 10 115 89 230 54v138H95z" fill="currentColor" opacity=".11" />
      <rect x="275" y="91" width="185" height="300" rx="28" fill="#fff" opacity=".96" />
      <rect x="298" y="122" width="139" height="211" rx="18" fill="currentColor" opacity=".09" />
      <path d="M323 195h89M323 216h62M323 273h89" stroke="currentColor" strokeWidth="8" strokeLinecap="round" opacity=".45" />
      <path d="M317 155v-14h14m72 0h14v14m0 126v14h-14m-72 0h-14v-14" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      <path d="M160 344c25-61 59-90 103-87 45 4 69 39 94 104l-58 40-75-9-64-48z" fill="#65C7FF" />
      <circle cx="230" cy="221" r="58" fill="#FAFCFF" />
      <path d="M183 220c14-33 40-51 77-52 15 22 19 45 10 68-38-3-67-8-87-16z" fill="#082B73" />
      <path d="M192 293c23-20 46-23 69-8l42 76-79 31-32-99z" fill="#146CFF" />
      <path d="M264 305l65-34 21 29-48 62" fill="none" stroke="#10213A" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  food: (
    <svg viewBox="0 0 640 520" aria-hidden="true">
      <path d="M68 401c85-77 167-103 246-78 91 28 160 13 258-56v203H68z" fill="currentColor" opacity=".1" />
      <ellipse cx="323" cy="367" rx="211" ry="62" fill="#fff" />
      <path d="M232 356c-34-46-26-97 23-151 48 47 57 98 27 153" fill="#65C7FF" />
      <path d="M354 356c-50-71-39-151 34-238 70 80 74 160 10 242" fill="#0D47B5" />
      <path d="M443 366c-31-55-18-107 40-157 50 65 50 118 0 161" fill="#146CFF" opacity=".72" />
      <circle cx="180" cy="346" r="61" fill="#F3B85B" />
      <circle cx="505" cy="352" r="55" fill="#E66B4E" />
      <path d="M181 285c13-30 32-47 58-53-5 28-24 48-58 53zM504 297c-5-28-21-47-48-58 1 30 17 49 48 58z" fill="#167A5B" />
      <path d="M112 389h414" stroke="#082B73" strokeWidth="8" strokeLinecap="round" opacity=".25" />
    </svg>
  ),
  family: (
    <svg viewBox="0 0 640 520" aria-hidden="true">
      <path d="M61 406c95-106 204-133 326-82 61 26 126 17 192-26v172H61z" fill="currentColor" opacity=".1" />
      <path d="M174 238h297l-31 154H207z" fill="#fff" stroke="#0D47B5" strokeWidth="8" strokeLinejoin="round" />
      <path d="M215 278h203M230 323h172M273 239l-10 153M370 239l11 153" stroke="#65C7FF" strokeWidth="7" opacity=".8" />
      <circle cx="249" cy="414" r="22" fill="#082B73" /><circle cx="404" cy="414" r="22" fill="#082B73" />
      <circle cx="175" cy="143" r="51" fill="#FAFCFF" />
      <path d="M128 146c10-43 34-66 73-68 25 29 29 58 13 87-35-4-64-10-86-19z" fill="#061A40" />
      <path d="M142 207c32-28 65-26 98 6l44 77-55 28-53-67-46 40-39-31 51-53z" fill="#146CFF" />
      <circle cx="478" cy="173" r="42" fill="#FAFCFF" />
      <path d="M440 171c9-34 28-52 58-54 20 24 23 47 10 70-28-3-51-8-68-16z" fill="#0D47B5" />
      <path d="M449 226c24-20 48-19 73 5l36 66-45 23-36-51-33 25-29-28 34-40z" fill="#65C7FF" />
    </svg>
  ),
  founder: (
    <svg viewBox="0 0 640 520" aria-hidden="true">
      <path d="M85 419c70-114 159-164 266-151 93 11 160 66 203 164v38H85z" fill="currentColor" opacity=".1" />
      <rect x="171" y="65" width="298" height="391" rx="145" fill="#fff" opacity=".98" />
      <circle cx="320" cy="205" r="91" fill="#E4EDF7" />
      <path d="M236 203c16-72 58-109 126-111 43 48 50 96 22 144-60-6-109-17-148-33z" fill="#061A40" />
      <path d="M208 434c19-101 71-151 156-151 82 0 132 50 151 151" fill="#0D47B5" />
      <path d="M279 287l42 59 45-60" fill="#FAFCFF" />
      <path d="M185 119h-31v64M454 339h31v64" fill="none" stroke="#65C7FF" strokeWidth="9" strokeLinecap="round" />
    </svg>
  ),
};

export default function PhotoPlaceholder({ type, alt, className = '' }) {
  return (
    <div className={`photo-placeholder photo-placeholder--${type} ${className}`} role="img" aria-label={alt}>
      <span className="photo-placeholder__scanlines" aria-hidden="true" />
      {illustrations[type]}
    </div>
  );
}
