import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

// The guide visitors can download from the challenge / resources sections.
const GUIDE_DOWNLOAD = '/images/barcode-challenge.png';

const buildingBlocks = [
  {
    emoji: '🥚',
    title: 'Protein',
    subtitle: 'The repair crew',
    items: ['Eggs', 'Chicken', 'Fish', 'Beans & lentils', 'Greek yoghurt', 'Nuts'],
    description:
      'Protein helps your body repair, build and stay full for longer. Getting some with every meal helps steady your energy and curb the mid-afternoon crash.',
  },
  {
    emoji: '🥑',
    title: 'Healthy Fats',
    subtitle: 'Brain fuel',
    items: ['Avocado', 'Olive oil', 'Nuts & seeds', 'Oily fish', 'Eggs'],
    description:
      'Fats are not the enemy. The right ones support your brain, hormones and help you absorb vitamins. They also make food taste good — which makes real food easier to stick with.',
  },
  {
    emoji: '🍠',
    title: 'Carbohydrates',
    subtitle: 'Steady energy',
    items: ['Oats', 'Potatoes', 'Rice', 'Wholegrains', 'Squash', 'Bread you recognise'],
    description:
      'Carbs are your body’s easiest energy source. Less-processed ones release that energy slowly, so you feel steady instead of spiking and crashing.',
  },
  {
    emoji: '🍓',
    title: 'Natural Sugars',
    subtitle: 'Sweetness with fibre',
    items: ['Whole fruit', 'Berries', 'Dates', 'Honey (a little)'],
    description:
      'Sweetness isn’t off-limits. When it comes wrapped in fibre — like whole fruit — your body handles it far better than the isolated sugars hidden in processed products.',
  },
  {
    emoji: '🫒',
    title: 'Healthy Oils',
    subtitle: 'How you cook matters',
    items: ['Extra virgin olive oil', 'Cold-pressed rapeseed', 'Butter', 'Coconut oil'],
    description:
      'Swapping heavily refined oils for simpler, less-processed ones is one of the quietest upgrades you can make to everyday cooking.',
  },
  {
    emoji: '🧂',
    title: 'Salt & Minerals',
    subtitle: 'Small but essential',
    items: ['Sea salt', 'Leafy greens', 'Seeds', 'Wholefoods'],
    description:
      'Your body needs minerals to function. Cooking real food at home usually means better balance than the hidden salt loaded into ultra-processed products.',
  },
  {
    emoji: '🥦',
    title: 'Vegetables',
    subtitle: 'The free upgrade',
    items: ['Broccoli', 'Carrots', 'Spinach', 'Peppers', 'Whatever you’ll actually eat'],
    description:
      'Vegetables bring fibre, colour and nutrients to the plate. The best vegetable is the one you’ll genuinely eat — start there, no pressure to be perfect.',
  },
];

const plateGroups = [
  { key: 'protein', label: 'Protein', color: '#4b39ef', options: ['Eggs', 'Chicken', 'Salmon', 'Chickpeas'] },
  { key: 'fat', label: 'Healthy Fat', color: '#16a34a', options: ['Avocado', 'Olive oil', 'Nuts', 'Cheese'] },
  { key: 'carb', label: 'Carbohydrate', color: '#ea580c', options: ['Potatoes', 'Rice', 'Oats', 'Wholegrain bread'] },
  { key: 'veg', label: 'Fruit / Vegetable', color: '#db2777', options: ['Broccoli', 'Berries', 'Spinach', 'Peppers'] },
];

// Small reusable Netlify newsletter form used in several sections.
function NewsletterForm({ source, buttonLabel, dark = false }) {
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    try {
      const formData = new FormData(event.target);
      const response = await fetch('/__forms.html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString(),
      });
      if (response.ok) {
        setStatus('success');
        event.target.reset();
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  const inputClasses = dark
    ? 'w-full px-4 py-3 rounded-lg bg-white/10 border border-white/30 text-white placeholder-white/70 focus:ring-2 focus:ring-white focus:border-transparent outline-none'
    : 'w-full px-4 py-3 rounded-lg bg-white border border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#4b39ef] focus:border-transparent outline-none';
  const buttonClasses = dark
    ? 'btn whitespace-nowrap font-semibold disabled:opacity-50 bg-white text-[#4b39ef] hover:bg-gray-100'
    : 'btn whitespace-nowrap font-semibold disabled:opacity-50 btn-primary';

  return (
    <form name="newsletter" onSubmit={handleSubmit} className="w-full">
      <input type="hidden" name="form-name" value="newsletter" />
      <input type="hidden" name="source" value={source} />
      <p className="hidden">
        <label>
          Don&#x27;t fill this out if you&#x27;re human: <input name="bot-field" />
        </label>
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email"
          required
          placeholder="Your email address"
          aria-label="Email address"
          name="email"
          className={inputClasses}
        />
        <button type="submit" disabled={status === 'submitting'} className={buttonClasses}>
          {status === 'submitting' ? 'Sending...' : buttonLabel}
        </button>
      </div>
      {status === 'success' ? (
        <p className={`mt-3 text-sm font-semibold ${dark ? 'text-white' : 'text-green-700'}`}>
          Thanks — you’re on the list! We’ll be in touch.
        </p>
      ) : (
        <p className={`mt-3 text-xs ${dark ? 'text-white/70' : 'text-gray-500'}`}>
          No spam. Unsubscribe any time. We only email things worth opening.
        </p>
      )}
      {status === 'error' && (
        <p className={`mt-2 text-sm ${dark ? 'text-white' : 'text-red-600'}`}>
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}

export default function Home() {
  const [openBlock, setOpenBlock] = useState(0);
  const [plate, setPlate] = useState({ protein: null, fat: null, carb: null, veg: null });

  // Reveal-on-scroll: add `is-visible` to `.reveal` elements as they enter view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll('.reveal'));
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const togglePlate = (group, option) => {
    setPlate((prev) => ({ ...prev, [group]: prev[group] === option ? null : option }));
  };

  return (
    <Layout>
      <SEO
        title={siteConfig.seo.home.title}
        description={siteConfig.seo.home.description}
      />

      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div
          className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-[#6b5cf7]/30 blur-3xl animate-blob"
          style={{ animationDelay: '4s' }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 md:py-28 lg:grid-cols-2">
          <div className="reveal">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">
              <span className="h-2 w-2 animate-bob rounded-full bg-white" /> A movement, not a diet
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              MY STORY.
              <br />
              MY WHY.
              <br />
              <span className="text-white/90">OUR MISSION.</span>
            </h1>
            <div className="mt-6 space-y-4 text-lg text-white/90">
              <p>I spent years struggling with burnout, brain fog, exhaustion and ADHD symptoms.</p>
              <p>
                What I didn’t realise was how much the food, drinks and habits around me were influencing how I felt every
                day.
              </p>
              <p className="font-medium text-white">
                Unboxed Together exists to help people understand food ingredients, reduce highly processed foods and make
                better choices — without judgement.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#challenge"
                className="btn bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold animate-pulse-ring text-center"
              >
                Start The Barcode Challenge
              </a>
              <a
                href="/story"
                className="btn border-2 border-white text-white hover:bg-white hover:text-[#4b39ef] font-semibold text-center"
              >
                Read My Story
              </a>
            </div>
          </div>
          <div className="reveal relative mx-auto w-full max-w-md" style={{ transitionDelay: '150ms' }}>
            <div className="relative h-[420px] sm:h-[480px]">
              <div className="absolute right-0 top-0 w-40 rotate-3 animate-float-slow sm:w-52">
                <div className="overflow-hidden rounded-xl border-4 border-white/80 shadow-2xl">
                  <img
                    src="/images/challenge-poster.png"
                    alt="The Unboxed Together 30-Day Barcode Challenge poster"
                    className="h-auto w-full"
                  />
                </div>
                <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4b39ef] shadow">
                  30-Day Challenge
                </span>
              </div>
              <div className="absolute bottom-0 left-0 w-40 -rotate-6 animate-float sm:w-48">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-r-lg rounded-l-sm shadow-2xl">
                  <div className="absolute left-0 top-0 z-10 h-full w-2 bg-black/20" />
                  <img
                    src="/images/book-cover.jpg"
                    alt="Unboxed — The Dirty Secret Hiding In Our Diet, by Lee Jones"
                    className="h-full w-full object-cover"
                  />
                </div>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-bold text-[#4b39ef] shadow">
                  The Book
                </span>
              </div>
              <div className="absolute bottom-8 right-6 flex h-32 w-32 flex-col items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-white/30 to-white/10 text-center shadow-2xl backdrop-blur sm:h-40 sm:w-40">
                <svg className="h-12 w-12 text-white/80" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.5-1.8 4.5-4.5S14.7 3 12 3 7.5 4.8 7.5 7.5 9.3 12 12 12zm0 2.2c-3 0-9 1.5-9 4.5V21h18v-2.3c0-3-6-4.5-9-4.5z" />
                </svg>
                <span className="mt-1 text-xs font-bold text-white">Lee Jones</span>
                <span className="text-[10px] text-white/80">Founder</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Unboxed Together Exists */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <div className="reveal">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Why Unboxed Together Exists</h2>
            <div className="mx-auto mt-8 max-w-2xl space-y-4 text-lg text-gray-600">
              <p>Today I feel better than I did ten years ago.</p>
              <p>Not because of a miracle cure.</p>
              <p>Not because of a perfect diet.</p>
              <p className="font-semibold text-gray-900">But because I started understanding what was going into my body.</p>
            </div>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {[
              { emoji: '🍽️', label: 'One Meal At A Time' },
              { emoji: '🔁', label: 'One Habit At A Time' },
              { emoji: '✅', label: 'One Choice At A Time' },
            ].map((item, i) => (
              <div
                key={item.label}
                className="reveal group rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:border-[#4b39ef]/30 hover:shadow-xl"
                style={i ? { transitionDelay: `${i * 120}ms` } : undefined}
              >
                <div className="text-4xl transition-transform group-hover:scale-110">{item.emoji}</div>
                <p className="mt-4 text-lg font-bold text-[#4b39ef]">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Is Unboxed Together? */}
      <section className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">What Is Unboxed Together?</h2>
            <p className="mt-4 text-lg text-gray-600">
              A growing community helping people feel better through better awareness.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: 'Understand food ingredients',
                body: 'Learn what’s actually on the label — in plain English, not chemistry jargon.',
                path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
              },
              {
                title: 'Reduce highly processed foods',
                body: 'Swap products for real food at a pace that fits your real, busy life.',
                path: 'M19 14l-7 7m0 0l-7-7m7 7V3',
              },
              {
                title: 'Improve energy and focus',
                body: 'Notice the patterns between what you eat and how clear and steady you feel.',
                path: 'M13 10V3L4 14h7v7l9-11h-7z',
              },
              {
                title: 'Support ADHD and burnout recovery',
                body: 'For brains that feel everything more — small changes can make a real difference.',
                path: 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z',
              },
              {
                title: 'Make informed choices without judgement',
                body: 'No good foods, no bad foods, no guilt. Just better awareness, your way.',
                path: 'M5 13l4 4L19 7',
              },
            ].map((card, i) => (
              <div
                key={card.title}
                className="reveal rounded-2xl bg-white p-7 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
                style={i % 3 ? { transitionDelay: `${(i % 3) * 100}ms` } : undefined}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4b39ef]/10 text-[#4b39ef]">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d={card.path} />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">{card.title}</h3>
                <p className="mt-2 text-gray-600">{card.body}</p>
              </div>
            ))}
            <div className="reveal flex flex-col justify-center rounded-2xl bg-[#4b39ef] p-7 text-white shadow-lg">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">No Extremes</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">No Perfection</span>
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">No Nonsense</span>
              </div>
              <p className="mt-4 text-lg font-medium">Just better awareness and better building blocks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* The 30-Day Barcode Challenge */}
      <section id="challenge" className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2">
          <div className="reveal order-2 lg:order-1">
            <span className="inline-block rounded-full bg-[#4b39ef]/10 px-4 py-1.5 text-sm font-bold text-[#4b39ef]">
              30 Days · No Calorie Counting · Just Food
            </span>
            <h2 className="mt-4 text-3xl font-black text-gray-900 md:text-4xl">The 30-Day Barcode Challenge</h2>
            <p className="mt-5 text-lg text-gray-600">For 30 days we’re choosing real food over products.</p>
            <ul className="mt-5 space-y-2 text-gray-600">
              {['No calorie counting.', 'No complicated rules.', 'No ingredient lists to memorise.'].map((point) => (
                <li key={point} className="flex items-center gap-3">
                  <span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-[#4b39ef] text-xs text-white">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-lg font-semibold text-gray-900">Just simple building blocks and better awareness.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#join" className="btn btn-primary text-center">
                Join The Challenge
              </a>
              <a href={GUIDE_DOWNLOAD} download className="btn btn-outline text-center">
                Download The Free Guide
              </a>
            </div>
          </div>
          <div className="reveal order-1 lg:order-2" style={{ transitionDelay: '150ms' }}>
            <div className="relative mx-auto max-w-sm">
              <div className="absolute inset-0 -rotate-3 rounded-3xl bg-[#4b39ef]/10" />
              <img
                src="/images/challenge-poster.png"
                alt="The Unboxed Together 30-Day Barcode Challenge — real food, real fuel, real you"
                className="relative w-full rounded-2xl border-4 border-white shadow-2xl"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Building Blocks */}
      <section className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Your Body Needs Building Blocks Every Day</h2>
            <p className="mt-4 text-lg text-gray-600">Tap each block to see real examples and a plain-language explanation.</p>
          </div>
          <div className="reveal mt-12" style={{ transitionDelay: '100ms' }}>
            <div className="grid gap-3 sm:grid-cols-2">
              {buildingBlocks.map((block, index) => {
                const isOpen = openBlock === index;
                return (
                  <div
                    key={block.title}
                    className={`rounded-2xl border transition-all duration-300 ${
                      isOpen
                        ? 'border-[#4b39ef] bg-white shadow-lg sm:col-span-2'
                        : 'border-gray-200 bg-white hover:border-[#4b39ef]/50 hover:shadow-md'
                    }`}
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenBlock(isOpen ? -1 : index)}
                      className="flex w-full items-center gap-4 p-5 text-left"
                    >
                      <span className="text-3xl" aria-hidden="true">
                        {block.emoji}
                      </span>
                      <span className="flex-grow">
                        <span className="block text-lg font-bold text-gray-900">{block.title}</span>
                        <span className="block text-sm text-gray-500">{block.subtitle}</span>
                      </span>
                      <span
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold transition-transform duration-300 ${
                          isOpen ? 'rotate-45 bg-[#4b39ef] text-white' : 'bg-[#4b39ef]/10 text-[#4b39ef]'
                        }`}
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="px-5 pb-5">
                          <div className="mb-4 flex flex-wrap gap-2">
                            {block.items.map((item) => (
                              <span
                                key={item}
                                className="rounded-full bg-[#4b39ef]/8 px-3 py-1 text-sm font-medium text-[#4b39ef]"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          <p className="text-gray-600">{block.description}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Simple Beats Perfect — plate builder */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Simple Beats Perfect</h2>
            <p className="mt-4 text-lg text-gray-600">You don’t need a diet plan. You need a framework.</p>
            <p className="mt-2 font-semibold text-[#4b39ef]">Protein + Healthy Fat + Carbohydrate + Fruit/Vegetable</p>
          </div>
          <div className="reveal mt-12" style={{ transitionDelay: '100ms' }}>
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div className="order-2 lg:order-1">
                <div className="relative mx-auto aspect-square w-full max-w-sm">
                  <div className="absolute inset-0 rounded-full bg-gray-100 shadow-inner" />
                  <div className="absolute inset-[8%] rounded-full border-4 border-white bg-white shadow-lg" />
                  <div className="absolute inset-[8%] grid grid-cols-2 grid-rows-2 overflow-hidden rounded-full">
                    {plateGroups.map((group) => {
                      const selected = plate[group.key];
                      return (
                        <div
                          key={group.key}
                          className="flex flex-col items-center justify-center p-3 text-center transition-colors duration-300"
                          style={{ backgroundColor: selected ? `${group.color}1f` : 'transparent' }}
                        >
                          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: group.color }}>
                            {group.label}
                          </span>
                          <span className="mt-1 text-sm font-bold text-gray-800">{selected || '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[84%] -translate-x-1/2 -translate-y-1/2 bg-gray-200" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-[84%] w-px -translate-x-1/2 -translate-y-1/2 bg-gray-200" />
                </div>
                <p className="mt-4 text-center text-sm font-medium text-gray-500">
                  Tap an option from each block to build your plate.
                </p>
              </div>
              <div className="order-1 space-y-5 lg:order-2">
                {plateGroups.map((group) => (
                  <div key={group.key}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
                      <span className="text-sm font-bold text-gray-700">{group.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((option) => {
                        const active = plate[group.key] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => togglePlate(group.key, option)}
                            className="rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200"
                            style={
                              active
                                ? { borderColor: group.color, color: group.color, backgroundColor: `${group.color}14` }
                                : { borderColor: '#e5e7eb', color: '#374151' }
                            }
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* I Thought I Was Broken */}
      <section className="bg-[#4b39ef] py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-[280px_1fr]">
          <div className="reveal mx-auto">
            <div className="relative">
              <div className="flex aspect-[4/5] w-64 flex-col items-center justify-center rounded-3xl border-4 border-white/30 bg-white/10 text-center backdrop-blur">
                <svg className="h-20 w-20 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.7 0 4.5-1.8 4.5-4.5S14.7 3 12 3 7.5 4.8 7.5 7.5 9.3 12 12 12zm0 2.2c-3 0-9 1.5-9 4.5V21h18v-2.3c0-3-6-4.5-9-4.5z" />
                </svg>
                <span className="mt-3 text-sm text-white/70">Professional photo</span>
                <span className="text-xs text-white/50">coming soon</span>
              </div>
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-4 py-1 text-sm font-bold text-[#4b39ef] shadow">
                Lee Jones · Founder
              </span>
            </div>
          </div>
          <div className="reveal" style={{ transitionDelay: '120ms' }}>
            <h2 className="text-3xl font-black md:text-4xl">I Thought I Was Broken</h2>
            <div className="mt-6 space-y-3 text-lg text-white/90">
              <p>For years I blamed stress.</p>
              <p>I blamed work.</p>
              <p>I blamed myself.</p>
              <p className="font-semibold text-white">
                Learning how food, additives and lifestyle choices affected me changed everything.
              </p>
              <p>Today I’m sharing what I wish someone had taught me sooner.</p>
            </div>
            <a className="btn mt-8 inline-block bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold" href="/story">
              Read The Full Story
            </a>
          </div>
        </div>
      </section>

      {/* Start With The Book */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-2">
          <div className="reveal mx-auto w-48 sm:w-60">
            <div className="animate-float">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-r-lg rounded-l-sm shadow-2xl">
                <div className="absolute left-0 top-0 z-10 h-full w-2 bg-black/20" />
                <img
                  src="/images/book-cover.jpg"
                  alt="Unboxed — The Dirty Secret Hiding In Our Diet, by Lee Jones"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
          <div className="reveal" style={{ transitionDelay: '120ms' }}>
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Start With The Book</h2>
            <p className="mt-5 text-lg text-gray-600">
              Everything I learned that helped me rebuild my health, clarity and wellbeing.
            </p>
            <p className="mt-3 font-semibold text-gray-900">Available in paperback and ebook.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={siteConfig.bookLinks.amazonUK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-center"
              >
                Buy The Book
              </a>
              <a className="btn btn-outline text-center" href="/book">
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* The App Is Coming */}
      <section className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-2">
          <div className="reveal">
            <span className="inline-block rounded-full bg-[#4b39ef]/10 px-4 py-1.5 text-sm font-bold text-[#4b39ef]">
              In development
            </span>
            <h2 className="mt-4 text-3xl font-black text-gray-900 md:text-4xl">The App Is Coming</h2>
            <p className="mt-4 text-lg text-gray-600">
              A pocket sidekick for the movement — here to support your choices, not run your life.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Scan products',
                'Understand ingredients',
                'Learn what additives do',
                'Track challenge progress',
                'Make better choices in seconds',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-gray-700">
                  <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-[#4b39ef] text-xs text-white">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-8 max-w-md">
              <p className="mb-2 text-sm font-semibold text-gray-700">Want to be first to try it?</p>
              <NewsletterForm source="app-waitlist" buttonLabel="Join The Waitlist" />
            </div>
          </div>
          <div className="reveal flex justify-center" style={{ transitionDelay: '150ms' }}>
            <div className="animate-float">
              <div className="relative mx-auto aspect-[9/19] w-[230px] rounded-[2.5rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl">
                <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-gray-900" />
                <div className="h-full w-full overflow-hidden rounded-[1.8rem] bg-white">
                  <div className="bg-[#4b39ef] px-4 pb-4 pt-7 text-white">
                    <p className="text-[11px] uppercase tracking-widest text-white/70">Unboxed Together</p>
                    <p className="text-lg font-bold">Scan a product</p>
                  </div>
                  <img
                    src="/images/app-screenshot.png"
                    alt="Preview of the Unboxed Together app scanning a product"
                    className="h-auto w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Watch Your 30 Days Add Up */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Watch Your 30 Days Add Up</h2>
            <p className="mt-4 text-lg text-gray-600">
              A sneak peek at the progress tracker and community leaderboard launching with the challenge.
            </p>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <div className="reveal rounded-2xl border border-gray-100 bg-gray-50 p-7 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Your progress</h3>
                <span className="text-sm font-semibold text-[#4b39ef]">Day 12 / 30</span>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full w-2/5 rounded-full bg-[#4b39ef]" />
              </div>
              <div className="mt-5 grid grid-cols-10 gap-1.5">
                {Array.from({ length: 30 }, (_, i) => (
                  <span
                    key={i}
                    className={`aspect-square rounded-md ${i < 12 ? 'bg-[#4b39ef]' : 'bg-gray-200'}`}
                    title={`Day ${i + 1}`}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Tick off each day. Build a streak. Celebrate progress, not perfection.
              </p>
            </div>
            <div className="reveal rounded-2xl border border-gray-100 bg-gray-50 p-7 shadow-sm" style={{ transitionDelay: '120ms' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Community leaderboard</h3>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">Coming soon</span>
              </div>
              <ul className="mt-4 space-y-2">
                {[
                  { rank: 1, name: 'Your name here', days: 30 },
                  { rank: 2, name: 'Community member', days: 28 },
                  { rank: 3, name: 'Community member', days: 27 },
                ].map((row) => (
                  <li key={row.rank} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-[#4b39ef]/10 text-sm font-bold text-[#4b39ef]">
                      {row.rank}
                    </span>
                    <span className="flex-grow font-medium text-gray-700">{row.name}</span>
                    <span className="text-sm font-semibold text-gray-500">{row.days} days</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-gray-500">
                Friendly, optional, and all about encouragement — never competition over health.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured In */}
      <section className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Featured In</h2>
            <p className="mt-4 text-lg text-gray-600">Building credibility one honest conversation at a time.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="reveal rounded-2xl bg-white p-7 text-center shadow-sm">
              <p className="text-2xl font-black text-[#4b39ef]">BRAINZ</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Magazine</p>
              <p className="mt-3 font-bold text-gray-900">Executive Contributor</p>
              <a className="mt-2 inline-block text-sm font-semibold text-[#4b39ef] hover:underline" href="/brainz">
                Read the articles →
              </a>
            </div>
            <div
              className="reveal flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-7 text-center"
              style={{ transitionDelay: '100ms' }}
            >
              <span className="text-3xl">🎙️</span>
              <p className="mt-2 font-bold text-gray-900">Podcast Appearances</p>
              <p className="mt-1 text-sm text-gray-500">Coming soon</p>
            </div>
            <div
              className="reveal flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white p-7 text-center"
              style={{ transitionDelay: '200ms' }}
            >
              <span className="text-3xl">📰</span>
              <p className="mt-2 font-bold text-gray-900">Media Mentions</p>
              <p className="mt-1 text-sm text-gray-500">Coming soon</p>
            </div>
          </div>
          <div className="reveal mt-10">
            <h3 className="text-center text-sm font-bold uppercase tracking-widest text-gray-400">
              What people are starting to say
            </h3>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {[
                'Someone finally explained this in a way I understand.',
                'No fear, no extremes — just changes I can actually keep.',
                'The first time food advice made sense for my brain.',
              ].map((quote) => (
                <div key={quote} className="rounded-2xl bg-white p-6 shadow-sm">
                  <p className="text-yellow-500">★★★★★</p>
                  <p className="mt-3 italic text-gray-600">“{quote}”</p>
                  <p className="mt-4 text-sm font-semibold text-gray-400">— Early member · testimonial spot reserved</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Success story */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4">
          <div className="reveal rounded-3xl bg-gradient-to-br from-[#4b39ef] to-[#6b5cf7] p-8 text-white shadow-xl md:p-12">
            <p className="text-sm font-bold uppercase tracking-widest text-white/70">Success story</p>
            <blockquote className="mt-4 text-2xl font-bold leading-snug md:text-3xl">
              “I stopped blaming myself and started understanding my body. The brain fog lifted, my energy came back, and
              food finally felt simple again.”
            </blockquote>
            <p className="mt-6 text-white/80">
              — Founder’s own story. Real member success stories will live here as the community grows.
            </p>
            <a className="btn mt-8 inline-block bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold" href="/story">
              Read the full story
            </a>
          </div>
        </div>
      </section>

      {/* You're Not Doing This Alone */}
      <section id="join" className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">You’re Not Doing This Alone</h2>
            <p className="mt-4 text-lg text-gray-600">
              Join a community of people figuring this out together — supportive, honest and judgement-free.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { emoji: '👥', label: 'Facebook Community', href: siteConfig.social.facebook },
              { emoji: '📸', label: 'Instagram', href: siteConfig.social.instagram },
              { emoji: '🎵', label: 'TikTok', href: siteConfig.social.tiktok },
              { emoji: '💼', label: 'LinkedIn', href: 'https://www.linkedin.com/company/unboxed-together' },
            ].map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="reveal flex items-center gap-3 rounded-2xl bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                style={i ? { transitionDelay: `${i * 80}ms` } : undefined}
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="font-bold text-gray-900">{item.label}</span>
              </a>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="reveal flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-5 text-gray-500">
              <span className="text-2xl">📍</span>
              <span className="font-semibold">Local meetups — coming soon</span>
            </div>
            <div
              className="reveal flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-5 text-gray-500"
              style={{ transitionDelay: '80ms' }}
            >
              <span className="text-2xl">🤝</span>
              <span className="font-semibold">Community ambassadors — coming soon</span>
            </div>
          </div>
          <div className="reveal mx-auto mt-10 max-w-xl rounded-2xl bg-white p-7 shadow-sm">
            <h3 className="text-center text-lg font-bold text-gray-900">Get the newsletter</h3>
            <p className="mb-4 mt-1 text-center text-sm text-gray-500">
              Practical, judgement-free tips and challenge updates — straight to your inbox.
            </p>
            <NewsletterForm source="community" buttonLabel="Join The Community" />
          </div>
        </div>
      </section>

      {/* Why People Stay */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-5xl px-4">
          <div className="reveal text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Why People Stay</h2>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Simple', body: 'No jargon, no overwhelm. Just clear next steps.' },
              { title: 'Practical', body: 'Built for real kitchens, real budgets, real life.' },
              { title: 'Family Friendly', body: 'Changes the whole household can get behind.' },
              { title: 'No Judgement', body: 'Progress over perfection, always.' },
              { title: 'Science Aware', body: 'Evidence-informed, never hype or fear.' },
              { title: 'Community Driven', body: 'We figure it out together, not alone.' },
            ].map((item, i) => (
              <div
                key={item.title}
                className="reveal rounded-2xl border border-gray-100 bg-gray-50 p-6 transition-all hover:-translate-y-1 hover:border-[#4b39ef]/30 hover:bg-white hover:shadow-lg"
                style={i % 3 ? { transitionDelay: `${(i % 3) * 100}ms` } : undefined}
              >
                <h3 className="text-lg font-bold text-[#4b39ef]">{item.title}</h3>
                <p className="mt-2 text-gray-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Challenge Resources */}
      <section id="resources" className="bg-gray-50 py-20 md:py-28">
        <div className="mx-auto max-w-4xl px-4">
          <div className="reveal text-center">
            <h2 className="text-3xl font-black text-gray-900 md:text-4xl">Challenge Resources</h2>
            <p className="mt-4 text-lg text-gray-600">Tap to grab everything you need to start.</p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              { href: '#join', download: false, title: 'Join The Challenge', sub: 'Sign up and start your 30 days' },
              {
                href: GUIDE_DOWNLOAD,
                download: true,
                title: 'Download The Free Guide',
                sub: 'The barcode challenge starter guide',
              },
              { href: '/book', download: false, title: 'Get The Book', sub: 'Paperback & ebook' },
              {
                href: siteConfig.social.facebook,
                download: false,
                title: 'Join The Community',
                sub: 'Connect with the movement',
              },
            ].map((card, i) => (
              <div key={card.title} className="reveal" style={i ? { transitionDelay: `${i * 80}ms` } : undefined}>
                <a
                  href={card.href}
                  {...(card.download ? { download: true } : {})}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#4b39ef] hover:shadow-lg"
                >
                  <span className="grid h-16 w-16 flex-shrink-0 grid-cols-4 grid-rows-4 gap-0.5 rounded-lg bg-white p-1 ring-1 ring-gray-200">
                    {[1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1].map((on, idx) => (
                      <span
                        key={idx}
                        className="rounded-[1px]"
                        style={{ backgroundColor: on ? '#4b39ef' : '#fff' }}
                      />
                    ))}
                  </span>
                  <span>
                    <span className="block font-bold text-gray-900 group-hover:text-[#4b39ef]">{card.title}</span>
                    <span className="block text-sm text-gray-500">{card.sub}</span>
                  </span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="hero-gradient relative overflow-hidden py-20 text-white md:py-28">
        <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-blob" />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <div className="reveal">
            <h2 className="text-3xl font-black leading-tight md:text-5xl">
              You Don’t Need To Be Perfect.
              <br />
              You Just Need To Start.
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/90">
              Together, we’re making food simpler, healthier and easier to understand.
            </p>
            <div className="mt-8 flex flex-col flex-wrap justify-center gap-3 sm:flex-row">
              <a href="#challenge" className="btn bg-white text-[#4b39ef] hover:bg-gray-100 font-semibold text-center">
                Join The Barcode Challenge
              </a>
              <a
                href="/book"
                className="btn border-2 border-white text-white hover:bg-white hover:text-[#4b39ef] font-semibold text-center"
              >
                Read The Book
              </a>
              <a
                href="#join"
                className="btn border-2 border-white text-white hover:bg-white hover:text-[#4b39ef] font-semibold text-center"
              >
                Join The Community
              </a>
            </div>
            <div className="mx-auto mt-10 max-w-md">
              <NewsletterForm source="final-cta" buttonLabel="Keep Me Posted" dark />
            </div>
          </div>
        </div>
      </section>

      {/* SEO copy block */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="reveal">
            <h2 className="text-2xl font-bold text-gray-900">A real food movement for the ultra-processed age</h2>
            <div className="mt-5 grid gap-8 text-gray-600 md:grid-cols-2">
              <div>
                <h3 className="font-bold text-gray-800">Understanding food additives</h3>
                <p className="mt-2 text-sm">
                  Many everyday products contain food additives most of us never think about. Unboxed Together helps you
                  read ingredient labels with confidence and understand what those additives actually do — no chemistry
                  degree required.
                </p>
                <h3 className="mt-5 font-bold text-gray-800">Reducing ultra-processed foods</h3>
                <p className="mt-2 text-sm">
                  Ultra-processed foods have quietly become the default. The 30-Day Barcode Challenge is a simple,
                  judgement-free way to swap products for real food and rebuild your energy one choice at a time.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-800">ADHD, burnout and nutrition</h3>
                <p className="mt-2 text-sm">
                  For people managing ADHD symptoms or burnout, the link between food and focus is often overlooked. We
                  share evidence-aware, practical ideas — never extreme claims — to help you notice what works for your
                  body.
                </p>
                <h3 className="mt-5 font-bold text-gray-800">Ingredient awareness, made simple</h3>
                <p className="mt-2 text-sm">
                  From the barcode challenge to the book and the upcoming app, everything we build is about ingredient
                  awareness and better building blocks — a real food movement people want to join, not a product being
                  sold.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
