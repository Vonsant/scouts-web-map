export const stationTypes = {
  'bc': 'Бизнес-центр',
  'engineeringStation': 'Инженерная станция',
  'ps': 'Пиратская станция',
  'sb': 'Научная станция'
};

export const races = {
  'hu': 'Человек',
  'wo': 'Ворлок',
  'bo': 'Ботан',
  'sm': 'Сморглоф',
  'fr': 'Фреон'
};

export const terrains = {
  'sand': 'Песчаная',
  'ice': 'Ледяная',
  'metal': 'Металлическая',
  'ocean': 'Океаническая',
  'forest': 'Лесная',
  'rock': 'Скалистая',
  'mount': 'Горная'
};

export const resources = {
  'natrium': 'Натрий',
  'titanium': 'Титан',
  'aluminium': 'Алюминий',
  'ferrum': 'Железо',
  'hydrogen': 'Водород',
  'aurum': 'Золото',
  'cuprum': 'Медь',
  'oxygen': 'Кислород',
  'helium': 'Гелий',
  'tritium': 'Тритий',
  'minerals': 'Минералы',
  'carbon': 'Углерод'
};

export const economics = {
  'agricultural': 'Аграрная',
  'industrial': 'Индустриальная',
  'raw': 'Сырьевая'
};

export const politics = {
  'anarchy': 'Анархия',
  'monarchy': 'Монархия',
  'democracy': 'Демократия',
  'dictatorship': 'Диктатура',
  'republic': 'Республика'
};

/**
 * Generic translation helper.
 * @param {object} dictionary The dictionary to use (e.g., races, terrains).
 * @param {string} key The key to translate.
 * @returns {string} The translated string or the original key if not found.
 */
export function translate(dictionary, key) {
  return dictionary[key] || key;
}
