import { useEffect, useState } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import ReviewCard from '../components/book/ReviewCard';
import ReviewForm from '../components/book/ReviewForm';
import { siteConfig } from '../utils/site-config';
import { useAuth } from '../components/auth/AuthProvider';

const { bookLinks } = siteConfig;
const pageUrl = `https://${siteConfig.domain}/book`;
const coverPath = '/images/book/unboxed-front-cover.jpg';
const coverAlt = 'Front cover of Unboxed: The Dirty Secret Hiding in Our Diet by Lee Jones — a glowing figure rising from an open cardboard box, surrounded by the words ADHD, Hijacked, Lost, Fatigue, Burnout, Overload and Additives.';

const insideTopics = [
  ['ADHD & Nutrition', 'Explore the relationship between nutrition, brain chemistry and everyday functioning.'],
  ['The Modern Food Industry', 'Question how modern food is produced, marketed and presented to consumers.'],
  ['Additives & Ingredients', 'Look beyond packaging claims and understand more about the ingredients in everyday products.'],
  ['Dopamine & Motivation', 'Explore the role of nutrients and brain chemistry in motivation and wellbeing.'],
  ['Burnout & Mental Wellbeing', 'Discover the personal experiences that led to the writing of Unboxed.'],
  ['Understanding Your Body', 'Encourage curiosity, awareness and informed personal choices.'],
];

// Existing, verified listings. Stock and prices are set by each retailer, so none are shown here.
const retailers = [
  { name: 'Amazon UK', format: 'Paperback', url: bookLinks.amazonUK },
  { name: 'Amazon Kindle', format: 'eBook', url: bookLinks.amazonKindle },
  { name: 'Waterstones', format: 'Paperback', url: bookLinks.waterstones },
  { name: "Blackwell's", format: 'Paperback', url: bookLinks.blackwells },
];

const reviewPlatforms = [
  { name: 'Review on Amazon', url: bookLinks.amazonWriteReview, note: 'You will need to sign in to an Amazon account. Amazon applies its own eligibility rules for who can post reviews.' },
  { name: 'Review on Waterstones', url: bookLinks.waterstonesReviews, note: 'You will need to sign in to, or create, a Waterstones account to write a review.' },
];

const closingCards = [
  { title: 'Explore our food database', text: "Search ingredients and additives and learn more about what's in everyday products.", href: '/additives', cta: 'Explore the database' },
  { title: 'The 30-Day Barcode Challenge', text: 'Discover a practical way to become more aware of everyday ingredients and food choices.', href: '/barcode-challenge', cta: 'Learn more', soon: true },
  { title: 'Join Unboxed Together', text: 'Create your free account, explore the community and access available resources.', href: '/signup', cta: 'Join for free', memberHref: '/members', memberCta: 'Go to my dashboard' },
];

function ExternalLink({ href, className, children, label }) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="sr-only"> (opens {label || 'an external site'} in a new tab)</span>
      <svg className="external-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </a>
  );
}

// Book structured data with the supplied genuine reviews. No aggregate rating until there is enough real review data.
function bookJsonLd(reviews) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: 'Unboxed: The Dirty Secret Hiding in Our Diet',
    alternateName: siteConfig.bookTitle,
    author: { '@type': 'Person', name: siteConfig.bookAuthor, url: `https://${siteConfig.domain}/story` },
    isbn: siteConfig.bookIsbn,
    bookFormat: 'https://schema.org/Paperback',
    inLanguage: 'en-GB',
    image: `https://${siteConfig.domain}${coverPath}`,
    url: pageUrl,
    description: 'A personal journey into the relationship between modern food, nutrition, ADHD, burnout and our physical and mental wellbeing.',
    potentialAction: { '@type': 'BuyAction', target: bookLinks.ingramSpark, seller: { '@type': 'Organization', name: 'IngramSpark' } },
    review: reviews.map((review) => ({
      '@type': 'Review',
      name: review.headline,
      reviewBody: review.text,
      reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: review.name },
      ...(review.date ? { datePublished: review.date } : {}),
    })),
  };
}

export default function Book() {
  const [siteReviews, setSiteReviews] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    fetch('/api/reviews')
      .then((response) => (response.ok ? response.json() : { reviews: [] }))
      .then((data) => setSiteReviews(data.reviews || []))
      .catch(() => {});
  }, []);

  const reviews = [...siteConfig.customerReviews, ...siteReviews];

  return (
    <Layout>
      <SEO title={siteConfig.seo.book.title} description={siteConfig.seo.book.description} path="/book" />
      <Head>
        <meta property="og:image" content={`https://${siteConfig.domain}${coverPath}`} />
        <meta property="og:image:alt" content="Front cover of Unboxed by Lee Jones" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(bookJsonLd(siteConfig.customerReviews)) }} />
      </Head>

      <div className="book-page">
        <section className="book-hero" aria-labelledby="book-title">
          <div className="site-container book-hero__grid">
            <div className="book-hero__cover">
              <Image src={coverPath} alt={coverAlt} width={1200} height={1702} priority sizes="(max-width: 860px) 70vw, 420px" />
            </div>
            <div className="book-hero__copy">
              <p className="book-kicker">The book · By {siteConfig.bookAuthor}</p>
              <h1 id="book-title"><span className="book-title">Unboxed</span><span className="book-subtitle">The Dirty Secret Hiding in Our Diet</span></h1>
              <p className="book-byline">By {siteConfig.bookAuthor}</p>
              <h2 className="book-headline">What if the food you eat is affecting more than just your weight?</h2>
              <div className="book-description">
                <p>Unboxed is a personal journey into the relationship between modern food, nutrition, ADHD, burnout and our physical and mental wellbeing.</p>
                <p>After experiencing severe burnout and questioning his own health, Lee Jones began exploring the ingredients in everyday food and the nutrients our bodies need.</p>
                <p>What started as a personal search for answers became a book about questioning what we eat, understanding ourselves and making more informed choices.</p>
                <p>This book shares that journey, the questions it raised and the discoveries that followed.</p>
              </div>
              <div className="book-actions">
                <ExternalLink href={bookLinks.ingramSpark} className="book-btn book-btn--primary book-btn--large" label="IngramSpark">Buy direct — support Unboxed Together</ExternalLink>
                <a href="#where-to-buy" className="book-btn book-btn--secondary">Where else can I buy this?</a>
              </div>
              <p className="book-checkout-note">You will complete your purchase securely on IngramSpark, our official publishing partner. Unboxed Together does not take payments or card details on this website.</p>
            </div>
          </div>
        </section>

        <section className="book-support" aria-labelledby="support-heading">
          <div className="site-container book-support__inner">
            <h2 id="support-heading">Your purchase supports more than a book.</h2>
            <p>Buying directly helps support the continued development of Unboxed Together, including our free resources, community and support services.</p>
          </div>
        </section>

        <section className="book-section book-why" aria-labelledby="why-heading">
          <div className="site-container book-why__grid">
            <div>
              <p className="book-kicker">Why I wrote Unboxed</p>
              <h2 id="why-heading">This was never supposed to be a book.</h2>
              <blockquote className="book-pullquote">
                <p>We think we’re choosing our food. But what if it’s been choosing us all along?</p>
                <footer>From the back cover of Unboxed</footer>
              </blockquote>
            </div>
            <div className="book-why__story">
              <p>Unboxed began with my own experiences.</p>
              <p>After struggling with burnout, ADHD and my mental wellbeing, I started questioning things I had previously taken for granted.</p>
              <p>One of those things was food.</p>
              <p>Not just calories, protein or whether something was marketed as healthy.</p>
              <p>I wanted to understand what was actually in the food I was eating, where it came from and how it might affect me.</p>
              <p>What started as a personal journey became something much bigger.</p>
              <p>I wrote Unboxed to share my experience, the questions I asked and what I discovered along the way.</p>
              <p>Not to tell people what they should eat.</p>
              <p>But to encourage people to understand what they are eating and make their own informed decisions.</p>
              <p className="book-why__close">Because understanding yourself starts with asking questions.</p>
              <p className="book-signature">— Lee Jones</p>
              <Link href="/story" className="book-btn book-btn--secondary">Read my full story</Link>
            </div>
          </div>
        </section>

        <section className="book-section book-inside" aria-labelledby="inside-heading">
          <div className="site-container">
            <div className="book-section__heading">
              <p className="book-kicker">Topics explored</p>
              <h2 id="inside-heading">What’s inside the book?</h2>
            </div>
            <ul className="book-topic-grid">
              {insideTopics.map(([title, text], index) => (
                <li key={title} className="book-topic">
                  <span className="book-topic__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="book-section book-reviews" aria-labelledby="reviews-heading">
          <div className="site-container">
            <div className="book-section__heading">
              <p className="book-kicker">Reader reviews</p>
              <h2 id="reviews-heading">What readers are saying</h2>
            </div>
            <div className="review-grid">
              {reviews.map((review) => <ReviewCard key={review.id || `${review.name}-${review.headline}`} review={review} />)}
            </div>
            <p className="book-note">Reviews are shared by readers and reflect their own experiences. <ExternalLink href={bookLinks.amazonReview} className="text-link" label="Amazon">Read a reader review on Amazon</ExternalLink></p>
          </div>
        </section>

        <section className="book-section book-leave-review" id="leave-a-review" aria-labelledby="leave-review-heading">
          <div className="site-container book-leave-review__grid">
            <div>
              <p className="book-kicker">Your experience matters</p>
              <h2 id="leave-review-heading">Have you read Unboxed?</h2>
              <p>Whether you loved the book, found something interesting or simply have thoughts to share, we’d love to hear from you.</p>
              <p>Your review helps other readers discover Unboxed and decide whether it’s right for them.</p>
            </div>
            <ReviewForm />
          </div>
        </section>

        <section className="book-section book-elsewhere-review" aria-labelledby="elsewhere-review-heading">
          <div className="site-container">
            <div className="book-section__heading">
              <h2 id="elsewhere-review-heading">Prefer to review where you bought it?</h2>
              <p>Already purchased Unboxed through Amazon, Waterstones or another retailer? You are welcome to leave your review directly with that retailer.</p>
              <p>Your feedback helps other readers discover the book.</p>
            </div>
            <ul className="platform-grid">
              {reviewPlatforms.map((platform) => (
                <li key={platform.name} className="platform-card">
                  <ExternalLink href={platform.url} className="book-btn book-btn--secondary" label={platform.name.replace('Review on ', '')}>{platform.name}</ExternalLink>
                  <p>{platform.note}</p>
                </li>
              ))}
              <li className="platform-card">
                <a href="#leave-a-review" className="book-btn book-btn--secondary">Review on our website</a>
                <p>Bought it somewhere else, such as IngramSpark or a local bookshop? Use the form above — no account needed.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="book-section book-where" id="where-to-buy" aria-labelledby="where-heading">
          <div className="site-container">
            <div className="book-section__heading">
              <h2 id="where-heading">Where else can I buy Unboxed?</h2>
              <p>Prefer to buy from your favourite bookshop? No problem.</p>
              <p>Unboxed is available to order through participating book retailers. Whether you prefer shopping online or supporting your local independent bookshop, the choice is yours.</p>
            </div>
            <ul className="retailer-grid">
              <li className="retailer-card retailer-card--featured">
                <span className="retailer-tag">Recommended · Buy direct</span>
                <h3>IngramSpark</h3>
                <p>Buying direct supports Unboxed Together. Checkout takes place on IngramSpark.</p>
                <ExternalLink href={bookLinks.ingramSpark} className="book-btn book-btn--primary" label="IngramSpark">Buy direct</ExternalLink>
              </li>
              {retailers.map((retailer) => (
                <li key={retailer.name} className="retailer-card">
                  <span className="retailer-tag">{retailer.format}</span>
                  <h3>{retailer.name}</h3>
                  <p>View the listing on {retailer.name.replace('Amazon Kindle', 'Amazon')}.</p>
                  <ExternalLink href={retailer.url} className="book-btn book-btn--secondary" label={retailer.name}>Buy now<span className="sr-only"> from {retailer.name}</span></ExternalLink>
                </li>
              ))}
              <li className="retailer-card">
                <span className="retailer-tag">In person</span>
                <h3>Your local bookshop</h3>
                <p>Ask your local bookshop to order it using the ISBN:</p>
                <p className="retailer-isbn">{siteConfig.bookIsbn}</p>
              </li>
            </ul>
            <p className="book-note">Prices, formats, delivery and availability are set by each retailer and may vary by region.</p>
          </div>
        </section>

        <section className="book-section book-beginning" aria-labelledby="beginning-heading">
          <div className="site-container">
            <div className="book-section__heading">
              <p className="book-kicker">More than just a book</p>
              <h2 id="beginning-heading">The book was just the beginning.</h2>
              <p>Unboxed Together is about taking what we learn and putting it into practice.</p>
              <ul className="book-beginning__list">
                <li>Understanding ingredients.</li>
                <li>Learning more about nutrition.</li>
                <li>Exploring everyday habits.</li>
                <li>Supporting one another.</li>
              </ul>
              <p>And building a community where people feel comfortable asking questions and sharing their experiences.</p>
            </div>
            <ul className="feature-card-grid">
              {closingCards.map((card) => (
                <li key={card.title} className="ut-card">
                  {card.soon && <span className="soon-badge">Coming soon</span>}
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                  <Link href={(user && card.memberHref) || card.href} className={`ut-btn ${card.soon ? 'ut-btn--secondary' : 'ut-btn--primary'}`}>{(user && card.memberCta) || card.cta}</Link>
                </li>
              ))}
            </ul>
            <p className="book-note">{siteConfig.disclaimer} Unboxed shares the author’s personal experiences and is not a substitute for advice from a qualified health professional.</p>
          </div>
        </section>
      </div>
    </Layout>
  );
}
