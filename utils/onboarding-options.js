export const onboardingQuestions = [
  {
    key: 'improvementGoals', heading: 'What would you most like to improve?', help: 'Choose up to three. There is no perfect answer.', type: 'multi', max: 3,
    options: ['Energy', 'Focus and mental clarity', 'Motivation', 'Mood', 'Sleep', 'Digestion or gut comfort', 'Food choices', 'Understanding ingredients', 'Reducing ultra-processed foods', 'Supporting my family', 'Something else'],
  },
  { key: 'generalWellbeingScore', heading: 'How are you feeling most days right now?', type: 'score', options: ['Struggling', 'Not great', 'Up and down', 'Mostly okay', 'Feeling good'] },
  { key: 'energyScore', heading: 'How would you rate your energy on an average day?', type: 'scale', low: 'Very low', high: 'Strong and steady' },
  { key: 'focusScore', heading: 'How clear and focused does your mind usually feel?', type: 'scale', low: 'Foggy or scattered', high: 'Clear and focused' },
  { key: 'sleepScore', heading: 'How well are you sleeping at the moment?', type: 'scale', low: 'Poorly', high: 'Very well' },
  { key: 'digestionScore', heading: 'How settled does your digestion usually feel?', type: 'scale', low: 'Often uncomfortable', high: 'Usually settled', optional: true },
  { key: 'ingredientListExposure', heading: 'How much of your food currently comes with an ingredient list?', type: 'single', options: ['Almost all of it', 'Most of it', 'About half', 'Not much', 'Hardly any', 'I am not sure'] },
  {
    key: 'barriers', heading: 'What usually gets in the way?', help: 'Choose up to three.', type: 'multi', max: 3,
    options: ['Time', 'Cost', 'Tiredness', 'Motivation', 'Family preferences', 'Confusing food labels', 'Not knowing what to eat', 'Convenience', 'Cravings', 'Work or routine', 'Nothing in particular', 'Something else'],
  },
  {
    key: 'desiredFeatures', heading: 'What would make Unboxed Together most useful to you?', help: 'Choose up to three.', type: 'multi', max: 3,
    options: ['Search food additives', 'Scan products', 'Understand ingredient lists', 'Find simpler alternatives', 'Track how food affects me', 'Improve daily meals', 'Follow the 30-Day Barcode Challenge', 'Support my child or family', 'Learn through short, simple guides', 'Join a supportive community'],
  },
];

export const emptyBaseline = {
  improvementGoals: [], generalWellbeingScore: null, energyScore: null, focusScore: null,
  sleepScore: null, digestionScore: null, ingredientListExposure: '', barriers: [], desiredFeatures: [],
};

export function baselineFromDatabase(value) {
  if (!value) return emptyBaseline;
  return {
    improvementGoals: value.improvement_goals || [],
    generalWellbeingScore: value.general_wellbeing_score,
    energyScore: value.energy_score,
    focusScore: value.focus_score,
    sleepScore: value.sleep_score,
    digestionScore: value.digestion_score,
    ingredientListExposure: value.ingredient_list_exposure || '',
    barriers: value.barriers || [],
    desiredFeatures: value.desired_features || [],
  };
}
