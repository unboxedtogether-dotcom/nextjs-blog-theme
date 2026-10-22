// Member-facing wording for the welcome questionnaire. Keep text exactly as
// supplied by Unboxed Together; do not reword questions or options.

export const privacyNoticePath = '/privacy';
export const privacyContactEmail = 'support@unboxedtogether.com';

const scaleRow = (key, label, note) => ({ key, type: 'scale', label, note });

export const questionnaireSections = [
  {
    number: 1,
    title: 'Welcome to Unboxed Together',
    blocks: [
      { kind: 'paragraph', text: 'We would love to get to know you, what matters to you and what would make everyday life a little easier. You can join the community now and choose support whenever you are ready. There is no obligation to book or buy anything.' },
      { kind: 'paragraph', text: 'Start with this page. The later pages are optional and can be completed another time, or talked through with Lee. Short answers are fine. Please share only what you are comfortable sharing. This version is for adults aged 18 and over.' },
      { kind: 'heading', text: 'Your details' },
      { kind: 'question', number: 1, label: 'Name you would like us to use', required: true, fields: [{ key: 'preferredName', type: 'text', required: true, autoComplete: 'name' }] },
      { kind: 'question', number: 2, label: 'Email address', required: true, fields: [{ key: 'email', type: 'email', required: true, autoComplete: 'email' }] },
      { kind: 'question', number: 3, required: true, fields: [{ key: 'adultConfirmed', type: 'checkbox', required: true, label: 'I confirm I am aged 18 or over.' }] },
      { kind: 'question', number: 4, label: 'Town or general area', fields: [{ key: 'town', type: 'text', autoComplete: 'address-level2' }] },
      { kind: 'question', number: 5, label: 'Phone number', fields: [{ key: 'phone', type: 'tel', autoComplete: 'tel' }] },
      { kind: 'heading', text: 'What brings you here' },
      { kind: 'paragraph', text: 'Choose any that fit. You can add personal or health reasons on the optional health page.' },
      {
        kind: 'question', number: 6, label: 'What brings you here?',
        fields: [{ key: 'reasons', type: 'multi', options: ['Understand food labels', 'Learn to cook', 'Organise meals', 'Find affordable food', 'Meet people', 'Join walks', 'Build everyday routines', 'Have someone to talk to', 'Just looking'] }],
      },
      { kind: 'question', number: 7, label: 'What do you enjoy doing or talking about?', fields: [{ key: 'enjoys', type: 'text' }] },
      {
        kind: 'question', number: 8, label: 'How would you like to take part?',
        fields: [{ key: 'participation', type: 'multi', options: ['Community only for now', 'Group activities', 'Tell me about practical support', 'I would like a free introductory conversation', 'Not sure yet'] }],
      },
      { kind: 'heading', text: 'Keeping in touch' },
      {
        kind: 'question', number: 9, label: 'Marketing email consent',
        // Stored on the member profile with its own consent history, not with the answers.
        fields: [{ key: 'marketingConsent', type: 'checkbox', profileField: true, label: 'Yes, email me Unboxed Together news, events, new services and offers. I can unsubscribe at any time. This is optional and separate from membership or service messages.' }],
      },
      { kind: 'privacy' },
      { kind: 'note', text: '* Required to set up an adult membership. All other answers are optional.' },
    ],
  },
  {
    number: 2,
    title: 'Your food and drink',
    tagline: 'Optional baseline | You can skip this page and still join',
    blocks: [
      { kind: 'paragraph', text: 'Before completing pages 2 to 4, read the privacy notice linked on page 1. These pages can include health and wellbeing information. They help us understand your starting point and tailor practical support you choose to request.' },
      {
        kind: 'consent',
        heading: 'Explicit consent',
        label: 'I explicitly consent to Unboxed Together collecting, storing and using the information I choose to give on pages 2 to 4 for my member baseline, personal check-ins and any practical support I request. I can withdraw this consent using the privacy contact on page 1. Joining the community does not depend on completing these pages.',
        skipText: 'If you leave the consent box unticked, please skip pages 2 to 4.',
      },
      {
        kind: 'question', number: 10, label: 'What does a usual day of food look like?',
        fields: [{ key: 'breakfast', type: 'text', label: 'Breakfast' }, { key: 'lunch', type: 'text', label: 'Lunch' }, { key: 'eveningMeal', type: 'text', label: 'Evening meal' }, { key: 'snacks', type: 'text', label: 'Snacks' }],
      },
      {
        kind: 'question', number: 11, label: 'Foods or meals you enjoy and foods you avoid',
        fields: [{ key: 'foodLikes', type: 'text', label: 'Likes' }, { key: 'foodAvoids', type: 'text', label: 'Avoids or dislikes' }],
      },
      {
        kind: 'question', number: 12, label: 'Where do you usually get your food?',
        fields: [{ key: 'foodSources', type: 'multi', options: ['Supermarket', 'Local shops or markets', 'Farm shop', 'Takeaway', 'Meal delivery', 'Community food support', 'Someone else shops', 'Other'], otherKey: 'foodSourcesOther' }],
      },
      {
        kind: 'question', number: 13, label: 'In the past 7 days, on how many days did you have these?', help: 'These can overlap. Estimates are fine.',
        fields: [{ key: 'readyMealDays', type: 'integer', min: 0, max: 7, label: 'Ready meals' }, { key: 'takeawayDays', type: 'integer', min: 0, max: 7, label: 'Takeaways' }, { key: 'cookedMealDays', type: 'integer', min: 0, max: 7, label: 'A meal cooked from ingredients' }],
      },
      {
        kind: 'question', number: 14, label: 'Plain water on a usual day',
        fields: [{ key: 'waterAmount', type: 'text', prefix: 'About', suffix: 'glasses, bottles or ml.', inline: true }, { key: 'waterContainerSize', type: 'text', label: 'Size of glass or bottle:' }],
      },
      {
        kind: 'question', number: 15, label: 'Other drinks on a usual day',
        fields: [{ key: 'tea', type: 'text', label: 'Tea' }, { key: 'coffee', type: 'text', label: 'Coffee' }, { key: 'energyDrinks', type: 'text', label: 'Energy drinks' }, { key: 'otherDrinks', type: 'text', label: 'Other drinks' }, { key: 'drinkSizeOrBrand', type: 'text', label: 'Usual size or brand' }, { key: 'lastCaffeinatedDrink', type: 'text', label: 'Last caffeinated drink at about' }],
      },
      {
        kind: 'question', number: 16, label: 'Alcohol in the past 7 days',
        fields: [
          { key: 'alcohol', type: 'single', options: ['None', 'Prefer not to say', 'Had alcohol'] },
          { key: 'alcoholDays', type: 'integer', min: 0, max: 7, label: 'Drinking days', intro: 'If applicable:' },
          { key: 'alcoholDetails', type: 'text', label: 'Type, amount and strength if known', help: 'For example 2 x 330 ml beers at 5%.' },
        ],
      },
    ],
  },
  {
    number: 3,
    title: 'Your everyday life and starting point',
    tagline: 'Optional | Complete only if you ticked the consent box on page 2',
    blocks: [
      {
        kind: 'question', number: 17, label: 'What fills most of your week?',
        fields: [{ key: 'weekActivities', type: 'multi', options: ['Paid work', 'Shift work', 'Study', 'Caring', 'Looking for work', 'Retired', 'Taking time out', 'Other'], otherKey: 'weekActivitiesOther' }],
      },
      {
        kind: 'question', number: 18, label: 'What makes shopping or cooking difficult at the moment?',
        fields: [
          { key: 'shoppingDifficulties', type: 'multi', options: ['Time', 'Cost', 'Energy', 'Planning', 'Cooking skills', 'Getting to shops', 'Equipment or storage', 'Pain or mobility', 'Sensory preferences', 'Nothing currently'] },
          { key: 'shoppingHelp', type: 'text', label: 'Anything that would help:' },
        ],
      },
      {
        kind: 'question', number: 19, label: 'What would make support easier to use?',
        fields: [
          { key: 'supportFormats', type: 'multi', options: ['Short written steps', 'Pictures or demonstrations', 'Cooking alongside someone', 'Quiet setting', 'Extra time', 'Online', 'In person'] },
          { key: 'supportOther', type: 'text', label: 'Something else:' },
        ],
      },
      {
        kind: 'question', number: 20, label: 'Your usual sleep over the past 7 days',
        fields: [
          { key: 'sleepHours', type: 'decimal', min: 0, max: 24, prefix: 'About', suffix: 'hours per night', inline: true },
          { key: 'bedtime', type: 'time', label: 'Usual bedtime' },
          { key: 'wakeTime', type: 'time', label: 'Wake time' },
          { key: 'sleepPattern', type: 'single', options: ['Mostly regular', 'Changes with shifts or responsibilities', 'Varies a lot'] },
        ],
      },
      {
        kind: 'question', number: 21, label: 'Movement and time outside in the past 7 days',
        fields: [
          { key: 'movementDays', type: 'integer', min: 0, max: 7, label: 'Days with a walk or other movement you chose:' },
          { key: 'activitiesEnjoyed', type: 'text', label: 'Activities you enjoy or would like to try:' },
        ],
      },
      {
        kind: 'question', number: 22, label: 'Think about the past 7 days. Circle one number per row, or leave it blank. These are personal check-in questions, not a clinical test.',
        fields: [
          scaleRow('moodScore', 'Overall mood', '1 very low; 5 very good'),
          scaleRow('energyScore', 'Daytime energy', '1 very low; 5 very good'),
          scaleRow('sleepQualityScore', 'Sleep quality', '1 very poor; 5 very good'),
          scaleRow('focusScore', 'Ability to focus on everyday tasks', '1 very difficult; 5 very easy'),
          scaleRow('managingDemandsScore', 'Feeling able to manage daily demands', '1 not at all; 5 very well'),
          scaleRow('cookingConfidenceScore', 'Confidence cooking a basic meal', '1 not confident; 5 very confident'),
        ],
      },
      { kind: 'question', number: 23, label: 'What would you like to become easier over the next month?', fields: [{ key: 'easierNextMonth', type: 'text' }] },
      { kind: 'question', fields: [{ key: 'baselineDate', type: 'date', label: 'Baseline date:', defaultToday: true }] },
      { kind: 'paragraph', text: 'You can revisit the same questions in 4 weeks.' },
    ],
  },
  {
    number: 4,
    title: 'Health information you want us to know',
    tagline: 'Optional | Complete only if you ticked the consent box on page 2',
    blocks: [
      { kind: 'paragraph', text: 'Please share relevant information rather than your full medical history. We use this to understand your needs, adapt practical activities and recognise when qualified advice is needed. Unboxed Together offers food education, cooking skills and community support. Medical care stays with your healthcare team.' },
      {
        kind: 'question', number: 24, label: 'Are health or personal experiences part of why you joined?',
        fields: [
          { key: 'joiningExperiences', type: 'multi', options: ['ADHD', 'Autism', 'Burnout', 'Feeling low or overwhelmed', 'Recovery or a difficult period', 'Something else', 'Prefer to discuss privately'] },
          { key: 'joiningExperiencesDetail', type: 'textarea', label: 'Tell us only what you want us to understand. A diagnosis is not needed to join:' },
        ],
      },
      {
        kind: 'question', number: 25, label: 'Any health conditions, past health issues or recent changes relevant to support?',
        fields: [{ key: 'healthConditionsChoice', type: 'multi', options: ['Nothing to share', 'Prefer to discuss privately'] }, { key: 'healthConditionsDetail', type: 'textarea' }],
      },
      {
        kind: 'question', number: 26, label: 'Any diagnosed food allergies, intolerances or clinician advised dietary restrictions?',
        fields: [
          { key: 'allergiesChoice', type: 'multi', options: ['None known', 'Prefer to discuss before a food activity'] },
          { key: 'allergiesDetail', type: 'textarea', label: 'Please say which are diagnosed allergies and what needs to be avoided:' },
        ],
      },
      {
        kind: 'question', number: 27, label: 'Any medicines or supplements relevant to eating, sleep or activities?',
        fields: [
          { key: 'medicinesChoice', type: 'multi', options: ['Nothing to share', 'Prefer to discuss privately'] },
          { key: 'medicinesDetail', type: 'textarea', label: 'You do not need to list everything. We do not advise changes to medication:' },
        ],
      },
      {
        kind: 'question', number: 28, label: 'Anything else that could affect practical food support?',
        fields: [{ key: 'otherFoodSupportFactors', type: 'textarea', label: 'For example, pregnancy or breastfeeding, swallowing difficulties, a prescribed diet, or a current or past eating difficulty. You can ask to discuss this privately:' }],
      },
      {
        kind: 'question', number: 29, label: 'Are you already receiving advice we should take into account?',
        fields: [{ key: 'existingAdvice', type: 'textarea', label: 'For example, from a GP, dietitian or another professional. Please share relevant advice only. Giving their name does not authorise us to contact them:' }],
      },
      { kind: 'question', number: 30, label: 'Anything else you want Lee to understand about you?', fields: [{ key: 'anythingElseForLee', type: 'textarea' }] },
      { kind: 'paragraph', text: 'You can update your answers or ask to discuss something privately. Before a cooking session or food is provided, we will confirm the relevant allergy and safety information with you.' },
    ],
  },
];

export const healthSectionNumbers = [2, 3, 4];

export function sectionFields(sectionNumber) {
  const section = questionnaireSections.find((item) => item.number === sectionNumber);
  if (!section) return [];
  return section.blocks.filter((block) => block.kind === 'question').flatMap((block) => block.fields.flatMap((field) => (
    field.otherKey ? [field, { key: field.otherKey, type: 'text', otherFor: field.key }] : [field]
  )));
}

export const checkInRows = questionnaireSections[2].blocks.find((block) => block.number === 22).fields;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const textLimits = { text: 300, email: 254, tel: 40, textarea: 3000 };

// Validates one page of answers against the field definitions above. Unknown
// keys are dropped, so only defined questions can ever be stored.
export function cleanSectionAnswers(sectionNumber, input = {}) {
  const values = {};
  for (const field of sectionFields(sectionNumber)) {
    if (field.profileField) continue;
    const raw = input[field.key];
    let value;
    switch (field.type) {
      case 'text': case 'textarea': case 'email': case 'tel':
        value = typeof raw === 'string' ? raw.trim().slice(0, textLimits[field.type]) : '';
        if (field.type === 'email' && value && !emailPattern.test(value)) return { error: 'Please enter a valid email address.' };
        if (field.type === 'tel' && value && !/^[0-9+()\s.-]+$/.test(value)) return { error: 'Please enter a valid phone number.' };
        break;
      case 'checkbox':
        value = raw === true;
        break;
      case 'multi':
        value = Array.isArray(raw) ? [...new Set(raw.filter((item) => field.options.includes(item)))] : [];
        break;
      case 'single':
        value = field.options.includes(raw) ? raw : '';
        break;
      case 'integer': case 'decimal': case 'scale': {
        if (raw === null || raw === undefined || raw === '') { value = null; break; }
        const number = Number(raw);
        const [min, max] = field.type === 'scale' ? [1, 5] : [field.min, field.max];
        const validType = field.type === 'decimal' ? Number.isFinite(number) : Number.isInteger(number);
        if (!validType || number < min || number > max) return { error: `Please enter a number from ${min} to ${max}${field.label ? ` for “${field.label.replace(/:$/, '')}”` : ''}.` };
        value = field.type === 'decimal' ? Math.round(number * 10) / 10 : number;
        break;
      }
      case 'time':
        value = typeof raw === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw) ? raw : '';
        break;
      case 'date':
        value = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) ? raw : '';
        break;
      default:
        continue;
    }
    if (field.otherFor && !(values[field.otherFor] || []).includes('Other')) value = '';
    values[field.key] = value;
  }
  return { values };
}

export function emptyAnswers() {
  return Object.fromEntries(questionnaireSections.flatMap((section) => sectionFields(section.number)).map((field) => {
    if (field.type === 'multi') return [field.key, []];
    if (field.type === 'checkbox') return [field.key, false];
    if (['integer', 'decimal', 'scale'].includes(field.type)) return [field.key, null];
    return [field.key, ''];
  }));
}
