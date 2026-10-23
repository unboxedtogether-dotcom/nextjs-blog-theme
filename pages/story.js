import Image from 'next/image';
import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import { siteConfig } from '../utils/site-config';

const photo = (file, width, height, alt) => ({ src: `/images/story/${file}`, width, height, alt });

const photos = {
  today: photo('lee-jones-today.jpg', 1600, 1600, 'Lee Jones today, a head-and-shoulders selfie in a black polo shirt'),
  spanner: photo('lee-toddler-spanner-motorbike.jpg', 879, 594, 'Lee as a toddler holding a spanner beside a motorbike'),
  bikeFrame: photo('lee-toddler-bike-frame.jpg', 868, 536, 'Lee as a toddler with a young girl, looking at a bare motorbike frame on a patio'),
  christmas: photo('lee-childhood-christmas-family.jpg', 466, 397, 'Lee as a young child at Christmas, sitting with family on a sofa'),
  armsUp: photo('lee-childhood-garden-arms-up.jpg', 482, 370, 'Lee as a child in a garden with both arms in the air, pulling a face'),
  workshop: photo('lee-child-workshop-red-overalls.jpg', 800, 600, 'Lee as a child in red overalls, holding the handlebars of a motorbike in a workshop'),
  miniBike: photo('lee-child-mini-motorbike.jpg', 845, 1220, 'Lee as a child riding a small motorbike across a wet patio'),
  motocross: photo('lee-teenage-motocross.jpg', 1600, 1200, 'Lee as a teenager in motocross kit, sitting on a blue dirt bike beside a track'),
  poolside: photo('lee-childhood-poolside.jpg', 1224, 845, 'Lee as a child by a pool, drinking from a large bottle, with a girl beside him'),
  holidayHat: photo('lee-childhood-holiday-hat.jpg', 580, 372, 'Lee as a child wearing a novelty hat, sitting next to a woman'),
  night: photo('lee-young-adult-night.jpg', 640, 480, 'Lee as a young adult at night, wearing a black sleeveless top'),
  field: photo('lee-rapeseed-field.jpg', 900, 1600, 'Lee standing in a field of yellow rapeseed flowers under a blue sky'),
  portrait: photo('lee-jones-portrait-brick-wall.jpg', 900, 1600, 'Lee Jones today, a portrait against a pale brick wall'),
};

// Chapter 5 photo. Swap this for the photo of the Unboxed books on autumn leaves once it is uploaded.
const bookPhoto = {
  src: '/images/book/unboxed-front-cover.jpg',
  width: 1200,
  height: 1702,
  alt: `Front cover of ${siteConfig.bookTitle} by ${siteConfig.bookAuthor}`,
  caption: null,
};

function StoryPhoto({ image, caption, sizes, priority = false, className = '', fit }) {
  return (
    <figure className={`story-photo ${fit ? `story-photo--${fit}` : ''} ${className}`}>
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={sizes}
        priority={priority}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// Photos share one row height and keep their original proportions, so nothing gets cropped.
function PhotoRow({ images, className = '' }) {
  return (
    <div className={`story-photo-row ${className}`}>
      {images.map((image) => (
        <figure key={image.src} style={{ flexGrow: image.width / image.height, flexBasis: 0 }}>
          <Image src={image.src} alt={image.alt} width={image.width} height={image.height} sizes="(max-width: 640px) 50vw, 380px" />
        </figure>
      ))}
    </div>
  );
}

function PullQuote({ children }) {
  return (
    <blockquote className="story-quote">
      <p>{children}</p>
    </blockquote>
  );
}

function ChapterHeading({ number, title, id }) {
  return (
    <header className="story-chapter__heading">
      <p className="story-chapter__number">Chapter {number}</p>
      <h2 id={id}>{title}</h2>
    </header>
  );
}

export default function Story() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.story.title}
        description={siteConfig.seo.story.description}
      />

      <div className="story-page">
        {/* Header */}
        <section className="story-hero" aria-labelledby="story-title">
          <div className="story-wrap story-hero__grid">
            <div className="story-hero__copy">
              <p className="story-hero__eyebrow">{siteConfig.bookAuthor} · Author of Unboxed</p>
              <h1 id="story-title">My Story</h1>
              <p className="story-hero__subtitle">The journey behind Unboxed Together</p>
            </div>
            <StoryPhoto
              image={photos.today}
              sizes="(max-width: 760px) 13rem, 24rem"
              priority
              className="story-hero__photo"
            />
          </div>
        </section>

        {/* Chapter 1 */}
        <section className="story-chapter" aria-labelledby="chapter-1">
          <div className="story-wrap story-split story-split--photo-left">
            <div className="story-split__media">
              <StoryPhoto
                image={photos.spanner}
                caption="Always building something."
                sizes="(max-width: 760px) 100vw, 34rem"
                priority
              />
            </div>
            <div className="story-split__text story-text">
              <ChapterHeading number={1} title="Before I understood myself" id="chapter-1" />
              <p className="story-opening">For most of my life I thought I was just built differently.</p>
              <p>
                Always intense, always "on", full of ideas, full of drive… but also constantly battling my own head.
              </p>
              <p>I didn't have the words for it back then.</p>
            </div>
          </div>
          <div className="story-wrap">
            <PhotoRow images={[photos.bikeFrame, photos.christmas, photos.armsUp]} className="story-photo-row--three" />
          </div>
        </section>

        {/* Chapter 2 */}
        <section className="story-chapter" aria-labelledby="chapter-2">
          <div className="story-wrap story-split story-split--photo-right">
            <div className="story-split__text story-text">
              <ChapterHeading number={2} title="Always on" id="chapter-2" />
              <p>I could hyperfocus for hours, then crash.</p>
              <p>
                I could be the most capable person in the room, then feel like I couldn't cope with basic life the next day.
              </p>
            </div>
            <div className="story-split__media">
              <PhotoRow images={[photos.workshop, photos.miniBike]} />
              <p className="story-caption">Curiosity was never the problem.</p>
            </div>
          </div>

          <div className="story-wrap">
            <StoryPhoto image={photos.motocross} sizes="(max-width: 1100px) 100vw, 66rem" className="story-photo--wide" fit="wide" />
          </div>

          <div className="story-wrap story-narrow story-text">
            <p>
              I just kept pushing. Work, business, family… trying to be strong, trying to be reliable, trying to be the version of me everyone needed.
            </p>
          </div>

          <div className="story-wrap story-narrow">
            <PhotoRow images={[photos.poolside, photos.holidayHat]} />
          </div>
        </section>

        {/* Chapter 3 */}
        <section className="story-chapter story-chapter--quiet" aria-labelledby="chapter-3">
          <div className="story-wrap story-split story-split--photo-left story-split--small-media">
            <div className="story-split__media">
              <StoryPhoto image={photos.night} sizes="(max-width: 760px) 100vw, 26rem" />
            </div>
            <div className="story-split__text story-text">
              <ChapterHeading number={3} title="When everything caught up with me" id="chapter-3" />
              <p>Over time, it caught up with me.</p>
              <p>
                The exhaustion wasn't just tiredness — it was like my brain had lost its grip. My mood, my focus, my sleep, my gut… everything felt off, but nobody could point to one simple reason.
              </p>
              <p>
                It wasn't a single dramatic moment — it was the slow realisation that I was living in survival mode and calling it normal.
              </p>
              <p>I'd reached a point where I didn't recognise myself.</p>
              <p>
                I wasn't lazy. I wasn't weak. I wasn't "not trying hard enough". I was overloaded, under-recovered, and unknowingly feeding my body and brain things that made everything worse.
              </p>
              <p>
                It felt like trying to build a life on quicksand — and the harder you fight, the deeper you sink.
              </p>
            </div>
          </div>
        </section>

        {/* Chapter 4 */}
        <section className="story-chapter" aria-labelledby="chapter-4">
          <div className="story-wrap story-split story-split--photo-right">
            <div className="story-split__text story-text">
              <ChapterHeading number={4} title="The turning point" id="chapter-4" />
              <p>
                When I finally got clarity around ADHD and started making changes, I expected medication or "mindset" to be the main fix.
              </p>
              <p>
                Then something clicked: I started noticing patterns — not "woo" patterns, real ones. Certain foods would hit me like a wave. Certain ingredients would leave me anxious, foggy, wired, flat, or unable to sleep.
              </p>
              <p>
                And once I saw it, I couldn't unsee it. That's when I started pulling at the thread: what's actually in our food… and what is it doing to people who are already sensitive?
              </p>
              <p>But the biggest surprise was this:</p>
              <p className="story-emphasis">
                When I cleaned up what I was consuming, my brain started behaving differently.
              </p>
              <p className="story-note">
                That's my own experience, not a prescription. Food isn't a cure for ADHD, autism or burnout, and what helped me won't look the same for everyone.
              </p>
            </div>
            <div className="story-split__media">
              <StoryPhoto image={photos.field} sizes="(max-width: 760px) 100vw, 28rem" fit="portrait" />
            </div>
          </div>

          <div className="story-wrap">
            <PullQuote>Not perfect. Not cured. But clearer. Calmer. More stable. More like&nbsp;me.</PullQuote>
          </div>

          <div className="story-wrap story-narrow story-text">
            <p>
              That's when the anger kicked in too — because I realised how many people are stuck blaming themselves, when the playing field isn't even level.
            </p>
            <p>
              Especially neurodivergent people, stressed parents, people with anxiety, gut issues, hormonal problems… we're trying to function in a system that quietly stacks the deck against us.
            </p>
          </div>
        </section>

        {/* Chapter 5 */}
        <section className="story-chapter story-chapter--book" aria-labelledby="chapter-5">
          <div className="story-wrap story-split story-split--photo-left story-split--book">
            <div className="story-split__media">
              <StoryPhoto
                image={bookPhoto}
                caption={bookPhoto.caption}
                sizes="(max-width: 760px) 100vw, 36rem"
                className="story-book-photo"
              />
            </div>
            <div className="story-split__text story-text">
              <ChapterHeading number={5} title="Why I wrote Unboxed" id="chapter-5" />
              <p>I wrote Unboxed because I don't want people to waste years thinking they're broken.</p>
              <p>
                This book isn't about perfection. It's not about fear. And it's definitely not about shaming anyone for what they eat — I've lived the real-life version, the busy-life version, the "just get through today" version.
              </p>
              <p>It's about something simple:</p>
              <PullQuote>Giving people their power back.</PullQuote>
              <p>
                When you understand what's in your food — and what certain additives can do to mood, focus, sleep, gut, hormones, and dopamine — you stop guessing. You stop spiralling. You stop making it your personality flaw. You start making better choices without becoming obsessed.
              </p>
            </div>
          </div>

          <div className="story-wrap story-narrow story-text">
            <p>I wrote it for the people who feel like they're running a mental marathon just to look "normal".</p>
            <p>I wrote it for the parents who can't figure out why their kid flips after certain foods.</p>
            <p>I wrote it for the person who's tried everything… and still feels foggy, anxious, inflamed, or flat.</p>
            <p>And most of all, I wrote it to say:</p>
            <p className="story-emphasis">You're not imagining it. You're not alone. And you're not the problem.</p>
            <div className="story-actions">
              <Link href="/book" className="ut-btn ut-btn--primary">Discover Unboxed — the book</Link>
            </div>
          </div>
        </section>

        {/* Chapter 6 */}
        <section className="story-chapter" aria-labelledby="chapter-6">
          <div className="story-wrap story-split story-split--photo-right">
            <div className="story-split__text story-text">
              <ChapterHeading number={6} title="Why Unboxed Together exists" id="chapter-6" />
              <p>
                Unboxed Together exists because reading labels shouldn't feel like decoding a foreign language.
              </p>
              <p>Right now, the system is backwards:</p>
              <ul>
                <li>The burden is on the consumer to "be healthy"</li>
                <li>but the information is hidden, confusing, or designed to be ignored</li>
                <li>and the people most affected are usually the ones with the least time, energy, or support</li>
              </ul>
              <p>So we're building something different. Unboxed Together is a movement and a toolkit:</p>
              <ul>
                <li>A book that tells the truth in a way real people can actually understand</li>
                <li>A food database that explains ingredients and additives in plain English</li>
                <li>An app, still in development, that helps you scan, track, and spot patterns without obsessing</li>
                <li>A community that says, "You're not doing this alone — we'll figure it out together."</li>
              </ul>
            </div>
            <div className="story-split__media story-founder">
              <StoryPhoto image={photos.portrait} sizes="(max-width: 760px) 100vw, 26rem" fit="portrait" className="story-photo--top" />
              <Image
                className="story-founder__logo"
                src="/images/brand/unboxed-together-horizontal.png"
                alt="Unboxed Together logo"
                width={960}
                height={646}
                sizes="10rem"
              />
            </div>
          </div>

          <div className="story-wrap">
            <PullQuote>This isn't about being perfect. It's about being aware.</PullQuote>
          </div>

          <div className="story-wrap story-narrow story-text">
            <p>It's about small changes that create big shifts.</p>
            <p>
              If you've ever felt like your brain is fighting you…
              <br />
              If you've ever wondered why food hits you differently…
              <br />
              If you're tired of being dismissed…
            </p>
            <p className="story-strong">Then you're exactly why we started this.</p>
            <p>
              And if you choose to follow, share, support, or join early access — you're not just backing a product.
            </p>
            <p className="story-emphasis">You're helping build a safer, clearer world for people like us.</p>
          </div>
        </section>

        {/* Invitation */}
        <section className="story-invite" aria-labelledby="story-invite-title">
          <div className="story-wrap story-narrow">
            <h2 id="story-invite-title">My story is still being written.</h2>
            <p>Unboxed Together started with my own questions.</p>
            <p>Now I'm building something that I hope will help others ask theirs.</p>
            <p>
              Whether you're here to understand your food, explore your wellbeing, share your experiences or simply connect with people who understand, you're welcome.
            </p>
            <p>You don't need to have everything figured out.</p>
            <p className="story-strong">You just need somewhere to start.</p>
            <div className="story-actions story-actions--invite">
              <Link href="/signup" className="ut-btn ut-btn--primary">Join Unboxed Together — free</Link>
              <Link href="/book" className="ut-btn ut-btn--secondary">Discover the book</Link>
              <Link href="/additives" className="ut-btn ut-btn--secondary">Explore the food database</Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
