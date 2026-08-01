import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import PhotoPlaceholder from '../components/PhotoPlaceholder';
import { siteConfig } from '../utils/site-config';

export default function Story() {
  return (
    <Layout>
      <SEO
        title={siteConfig.seo.story.title}
        description={siteConfig.seo.story.description}
      />

      {/* Hero Section */}
      <section className="bg-[#0D47B5] text-white py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">My Story</h1>
          <p className="text-xl text-gray-100">
            The journey behind Unboxed Together
          </p>
        </div>
      </section>

      {/* Story Content */}
      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <PhotoPlaceholder
            type="founder"
            alt="Founder portrait placeholder for the Unboxed Together story"
            className="story-founder-photo"
          />
          {/* My Journey */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0D47B5] mb-6">
              My journey
            </h2>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                For most of my life I thought I was just built differently — always intense, always "on", full of ideas, full of drive… but also constantly battling my own head. I could hyperfocus for hours, then crash. I could be the most capable person in the room, then feel like I couldn't cope with basic life the next day.
              </p>
              <p>
                I didn't have the words for it back then. I just kept pushing. Work, business, family… trying to be strong, trying to be reliable, trying to be the version of me everyone needed. Over time, it caught up with me. The exhaustion wasn't just tiredness — it was like my brain had lost its grip. My mood, my focus, my sleep, my gut… everything felt off, but nobody could point to one simple reason.
              </p>
              <p>
                Then something clicked: I started noticing patterns — not "woo" patterns, real ones. Certain foods would hit me like a wave. Certain ingredients would leave me anxious, foggy, wired, flat, or unable to sleep. And once I saw it, I couldn't unsee it. That's when I started pulling at the thread: what's actually in our food… and what is it doing to people who are already sensitive?
              </p>
            </div>
          </div>

          {/* The Turning Point */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0D47B5] mb-6">
              The turning point
            </h2>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                My turning point wasn't a single dramatic moment — it was the slow realisation that I was living in survival mode and calling it normal.
              </p>
              <p>
                I'd reached a point where I didn't recognise myself. I wasn't lazy. I wasn't weak. I wasn't "not trying hard enough". I was overloaded, under-recovered, and unknowingly feeding my body and brain things that made everything worse. It felt like trying to build a life on quicksand — and the harder you fight, the deeper you sink.
              </p>
              <p>
                When I finally got clarity around ADHD and started making changes, I expected medication or "mindset" to be the main fix. But the biggest surprise was this:
              </p>
              <p className="font-semibold text-[#0D47B5]">
                When I cleaned up what I was consuming, my brain started behaving differently.
              </p>
              <p>
                Not perfect. Not cured. But clearer. Calmer. More stable. More like me.
              </p>
              <p>
                That's when the anger kicked in too — because I realised how many people are stuck blaming themselves, when the playing field isn't even level. Especially neurodivergent people, stressed parents, people with anxiety, gut issues, hormonal problems… we're trying to function in a system that quietly stacks the deck against us.
              </p>
            </div>
          </div>

          {/* Why I Wrote the Book */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0D47B5] mb-6">
              Why I wrote Unboxed – The Dirty Secret Hiding In Our Diet
            </h2>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                I wrote Unboxed because I don't want people to waste years thinking they're broken.
              </p>
              <p>
                This book isn't about perfection. It's not about fear. And it's definitely not about shaming anyone for what they eat — I've lived the real-life version, the busy-life version, the "just get through today" version.
              </p>
              <p>
                It's about something simple:
              </p>
              <p className="font-semibold text-[#0D47B5] text-xl">
                Giving people their power back.
              </p>
              <p>
                When you understand what's in your food — and what certain additives can do to mood, focus, sleep, gut, hormones, and dopamine — you stop guessing. You stop spiralling. You stop making it your personality flaw. You start making better choices without becoming obsessed.
              </p>
              <p>
                I wrote it for the people who feel like they're running a mental marathon just to look "normal".
                <br />
                I wrote it for the parents who can't figure out why their kid flips after certain foods.
                <br />
                I wrote it for the person who's tried everything… and still feels foggy, anxious, inflamed, or flat.
              </p>
              <p>
                And most of all, I wrote it to say:
              </p>
              <p className="font-semibold text-[#0D47B5]">
                You're not imagining it. You're not alone. And you're not the problem.
              </p>
            </div>
          </div>

          {/* Why Unboxed Together */}
          <div className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0D47B5] mb-6">
              Why Unboxed Together
            </h2>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                Unboxed Together exists because reading labels shouldn't feel like decoding a foreign language.
              </p>
              <p>
                Right now, the system is backwards:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The burden is on the consumer to "be healthy"</li>
                <li>but the information is hidden, confusing, or designed to be ignored</li>
                <li>and the people most affected are usually the ones with the least time, energy, or support</li>
              </ul>
              <p>
                So we're building something different.
              </p>
              <p>
                Unboxed Together is a movement and a toolkit:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>A book that tells the truth in a way real people can actually understand</li>
                <li>An app that helps you scan, track, and spot patterns without obsessing</li>
                <li>A community that says, "You're not doing this alone — we'll figure it out together."</li>
              </ul>
              <p>
                This isn't about being perfect. It's about being aware.
                <br />
                It's about small changes that create big shifts.
              </p>
              <p>
                If you've ever felt like your brain is fighting you…
                <br />
                If you've ever wondered why food hits you differently…
                <br />
                If you're tired of being dismissed…
              </p>
              <p className="font-semibold">
                Then you're exactly why we started this.
              </p>
              <p>
                And if you choose to follow, share, support, or join early access — you're not just backing a product.
              </p>
              <p className="font-semibold text-[#0D47B5]">
                You're helping build a safer, clearer world for people like us.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-lg text-gray-700 mb-6">
              Follow the journey, join the early testers, and help us make clarity normal.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/book"
                className="btn btn-primary text-center"
              >
                Buy the book
              </Link>
              <Link
                href="/#signup"
                className="btn btn-outline text-center"
              >
                Join early testers
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
