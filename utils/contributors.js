// Contributor profiles — edit this file to update Trisha's biography, articles and the
// Brainz Magazine contributor cards. Lee's original Brainz details stay in site-config.js.
import { siteConfig } from './site-config';

// Photos of Trisha live in /public/images/trisha/. Upload them with these file names
// (.jpg, .jpeg, .png or .webp all work). Until a file exists, the page shows a neutral
// "photo coming soon" panel instead — no stock or AI-generated substitutes.
export const trishaPhotos = {
  portrait: {
    name: 'trisha-britton-portrait',
    alt: 'Trisha Britton, RN, smiling in a tan leather jacket on a sunlit city street',
  },
  about: {
    name: 'trisha-britton-about',
    alt: 'Trisha Britton, RN',
    // Optional. Until a separate photo is uploaded, the main portrait is used here.
    fallback: 'portrait',
  },
};

export const trisha = {
  name: 'Trisha Britton',
  displayName: 'Trisha Britton, RN',
  title: 'Neuroregulation & Integrative Health Practitioner',
  designation: 'Brainz Magazine Executive Contributor',
  profilePath: '/trisha-britton',
  // Verified: linked from each of Trisha's Brainz Magazine articles.
  brainzProfileUrl: 'https://www.brainzmagazine.com/executive-contributor/trisha-britton',

  introQuote:
    'Understanding ourselves goes beyond what we eat. It includes how our nervous system responds to the world around us, the environments we live in and the demands we place on our bodies and minds.',
  intro:
    'Trisha brings a complementary perspective to Unboxed Together, exploring how the nervous system, our surroundings and the pace of everyday life shape how we think, feel and function.',
  shortIntro:
    'A Registered Nurse and Applied Neuroregulation & Integrative Health Practitioner exploring nervous system regulation, burnout, recovery and the environments that shape our wellbeing.',

  about: [
    'Trisha Britton is a Registered Nurse and Applied Neuroregulation & Integrative Health Practitioner whose work focuses on restoring stability, clarity and sustainable capacity through a whole-person approach.',
    'With a background spanning healthcare, nutrition and applied neuroscience, Trisha explores how the nervous system, physiology, environment and everyday lifestyle interact to influence our wellbeing.',
    'Her work goes beyond managing individual symptoms. She focuses on recognising patterns of overload, understanding how our surroundings influence nervous system responses and identifying practical changes that can support recovery and long-term resilience.',
    'Her approach includes nervous system regulation, cellular health, environmental design, daily routines and restorative experiences.',
    "Trisha shares Unboxed Together's interest in looking beyond surface symptoms and understanding the influences that shape how people think, feel and function.",
  ],

  // `icon` picks one of the line icons defined on the profile page.
  interests: [
    { icon: 'nervous', title: 'Nervous System Regulation', text: 'Understanding how prolonged stress and environmental demands influence nervous system function.' },
    { icon: 'nutrition', title: 'Nutrition & Integrative Health', text: 'Exploring the relationship between nutrition, physiology and whole-person wellbeing.' },
    { icon: 'recovery', title: 'Burnout & Recovery', text: 'Recognising patterns of chronic overload and supporting sustainable recovery.' },
    { icon: 'environment', title: 'Environmental Influences', text: 'Understanding how our physical surroundings, sensory inputs and daily routines affect wellbeing.' },
    { icon: 'cell', title: 'Cellular Health & Resilience', text: 'Exploring biological health and the conditions that support long-term resilience.' },
    { icon: 'travel', title: 'Restorative Environments & Travel', text: 'Using carefully considered environments and restorative experiences to support regulation and recovery.' },
  ],

  // Brainz Magazine articles. All links below were checked against brainzmagazine.com.
  // To add an article whose link isn't confirmed yet, set `link: null` and the card
  // shows a clearly labelled "Link coming soon" placeholder instead of a button.
  articles: [
    {
      title: 'Restoring Stability and Performance with Nervous System Regulation – Interview with Trisha Britton',
      excerpt: 'Trisha talks about her work helping people restore stability, clarity and sustainable capacity when effort alone stops working.',
      link: 'https://www.brainzmagazine.com/post/restoring-stability-and-performance-with-nervous-system-regulation-interview-with-trisha-britton',
      image: { src: '/images/brainz/trisha-nervous-system-regulation-interview.jpg', width: 1004, height: 656, alt: 'Trisha Britton photographed on a city street, from her Brainz Magazine interview' },
      label: 'Interview',
    },
    {
      title: 'After Rupture, Awareness Is Not Enough and Why Women Need Reconstruction, Not Reinvention',
      excerpt: 'When the old life no longer fits, knowing what changed is only the start. Trisha explores why rebuilding matters more than reinventing.',
      link: 'https://www.brainzmagazine.com/post/after-rupture-awareness-is-not-enough-and-why-women-need-reconstruction-not-reinvention',
      image: { src: '/images/brainz/trisha-after-rupture.jpg', width: 960, height: 630, alt: 'A woman with her eyes closed and face turned towards a shaft of warm light' },
      label: 'Article',
    },
    {
      title: "Confusion Around Direction Isn't a Lack of Clarity, It's Too Many Competing Signals",
      excerpt: "Feeling unsure of your direction isn't always about not knowing what you want. Often, too many signals are competing for attention at once.",
      link: 'https://www.brainzmagazine.com/post/confusion-around-direction-isn-t-a-lack-of-clarity-it-s-too-many-competing-signals',
      image: { src: '/images/brainz/trisha-competing-signals.jpg', width: 960, height: 640, alt: 'A woman in a trench coat studying a large map on a station wall' },
      label: 'Article',
    },
    {
      title: 'The Hidden Reason Life Feels Overwhelming From Conflicting Signals in Your Life Systems',
      excerpt: 'When the systems of your life pull against each other, your nervous system carries the cost — and motivation or discipline is rarely the real problem.',
      link: 'https://www.brainzmagazine.com/post/the-hidden-reason-life-feels-overwhelming-from-conflicting-signals-in-your-life-systems',
      image: { src: '/images/brainz/trisha-conflicting-life-systems.jpg', width: 960, height: 540, alt: 'A woman at a home office desk holding her head in her hands' },
      label: 'Article',
    },
  ],
};

export const lee = {
  name: siteConfig.brainzContributor.name,
  title: 'Founder of Unboxed Together · Author of Unboxed',
  designation: 'Brainz Magazine Executive Contributor',
  award: siteConfig.brainzContributor.award,
  profilePath: '/story',
  profileLabel: "Read Lee's story",
  brainzProfileUrl: 'https://www.brainzmagazine.com/executive-contributor/lee-jones',
  shortIntro:
    'Founder of Unboxed Together and author of Unboxed, Lee writes about nutrition, food ingredients, ADHD and the impact everyday dietary choices can have on wellbeing, informed by his own experience of burnout and recovery.',
  photo: {
    src: '/images/story/lee-jones-brainz-portrait.jpg',
    width: 1200,
    height: 1500,
    alt: 'Lee Jones, founder of Unboxed Together, head-and-shoulders portrait in warm sunlight',
  },
  articles: siteConfig.brainzArticles,
};

// Founder profiles shown in the "Two Perspectives. One Shared Understanding." section.
// Title segments are shown separated by "|" and only wrap between segments on small screens.
export const founderProfiles = {
  intro: [
    'Founded on a shared passion for understanding how we think, feel and function, Unboxed Together brings together two different backgrounds with one common purpose.',
    'Lee Jones combines engineering, innovation and independent nutritional research with lived experience of ADHD and burnout.',
    'Trisha Britton brings her background in nursing, applied neuroscience, integrative health and nervous system regulation.',
    'Together, as Founder and Co-Founder of Unboxed Together, they explore the connections between nutrition, environment, human behaviour and wellbeing, helping people better understand the influences shaping their everyday lives.',
  ],
  lee: {
    name: 'Lee Jones',
    title: ['Founder, Unboxed Together', 'Engineer', 'Entrepreneur', 'Author'],
    bio: 'Engineer, craftsman, entrepreneur, published author and Brainz Magazine Executive Contributor. Founder of Unboxed Together, combining technical expertise, systems thinking and independent nutritional research to explore human behaviour, modern living and wellbeing.',
  },
  trisha: {
    name: 'Trisha Britton, RN',
    title: ['Co-Founder, Unboxed Together', 'Founder, World Travel Collective', 'Registered Nurse & Author'],
    bio: 'Entrepreneur, Registered Nurse, author and Brainz Magazine Executive Contributor. Co-Founder of Unboxed Together and Founder of World Travel Collective, bringing together applied neuroscience, nutrition, integrative health and nervous system regulation to explore human resilience, environmental influences and restorative wellbeing.',
  },
};
