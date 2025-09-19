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
  'minerals': 'Минералы',
  'hydrogen': 'Водород',
  'tritium': 'Тритий',
  'helium': 'Гелий',
  'oxygen': 'Кислород',
  'carbon': 'Углерод',
  'natrium': 'Натрий',
  'aluminium': 'Алюминий',
  'titanium': 'Титан',
  'cuprum': 'Медь',
  'ferrum': 'Железо',
  'aurum': 'Золото',
  'reagents': 'Химикаты',
  'metalPlates': 'Металлическая обшивка',
  'compositeMaterials': 'Композитные материалы',
  'superconductors': 'Сверхпроводники',
  'electronics': 'Электронные компоненты',
  'carbonFiber': 'Углеволокно',
  'batteries': 'Батареи',
  'magneticCoils': 'Магнитные кольца',
  'opticCrystals': 'Оптические кристаллы',
  'polymers': 'Полимеры',
  'robomodules': 'Роботизированные модули',
  'syntheticMaterials': 'Синтетические материалы',
  'insulators': 'Изолирующие материалы',
  'food': 'Продукты питания',
  'alcohol': 'Алкоголь',
  'medicine': 'Медикаменты',
  'drugs': 'Наркотики'
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
