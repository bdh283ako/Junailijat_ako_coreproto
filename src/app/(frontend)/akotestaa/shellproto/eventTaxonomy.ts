export const CANONICAL_AGE_FILTERS = [
  'Vauvat & taaperot (0–3v)',
  'Leikki-ikäiset (4–6v)',
  'Kouluikäiset (7–12v)',
  'Nuoret & teinit (13–18v)',
  'Kaikenikäisille / Perheet',
] as const

export const CANONICAL_THEME_FILTERS = [
  'Liikunta & urheilu',
  'Ulkoilu & puistotreffit',
  'Kulttuuri & esitykset',
  'Askartelu & työpajat',
  'Satutuokiot & kirjasto',
  'Musiikki & muskari',
  'Vertaistuki & vanhemmuus',
  'Kiertotalous & arjen apu',
] as const

export const CANONICAL_EVENT_FILTERS = [
  ...CANONICAL_AGE_FILTERS,
  ...CANONICAL_THEME_FILTERS,
] as const

export type CanonicalEventFilter = (typeof CANONICAL_EVENT_FILTERS)[number]
