export type LatLngTuple = [number, number]

export type PksCityName = 'Helsinki' | 'Espoo' | 'Vantaa' | 'Kauniainen'

export interface PksAreaEntry {
  name: string
  city: PksCityName
  coords: LatLngTuple
  aliases: string[]
}

export const DEFAULT_PKS_COORDS: LatLngTuple = [60.2055, 24.6559]

export const PKS_CITY_CENTERS: Record<PksCityName, LatLngTuple> = {
  Helsinki: [60.1699, 24.9384],
  Espoo: [60.2055, 24.6559],
  Vantaa: [60.2934, 25.0378],
  Kauniainen: [60.2134, 24.7267],
}

export const PKS_AREAS: PksAreaEntry[] = [
  // --- HELSINKI ---
  { name: 'Kamppi / Keskusta', city: 'Helsinki', coords: [60.1686, 24.9324], aliases: ['kamppi', 'keskusta', 'kaartinkaupunki', 'kaivopuisto', 'kiasma'] },
  { name: 'Kruununhaka / Katajanokka', city: 'Helsinki', coords: [60.1725, 24.956], aliases: ['kruununhaka', 'katajanokka', 'senaatintori'] },
  { name: 'Punavuori / Eira', city: 'Helsinki', coords: [60.1605, 24.9395], aliases: ['punavuori', 'eira', 'ullankatu'] },
  { name: 'Ruoholahti / Jätkäsaari', city: 'Helsinki', coords: [60.1618, 24.9162], aliases: ['ruoholahti', 'jätkäsaari', 'vattuniemi'] },
  { name: 'Etu- ja Taka-Töölö', city: 'Helsinki', coords: [60.1815, 24.9225], aliases: ['töölö', 'etutöölö', 'takatöölö', 'oodi', 'töölönlahti', 'laakso', 'ruskeasuo', 'pikku-huopalahti', 'pikku huopalahti'] },
  { name: 'Kallio', city: 'Helsinki', coords: [60.1841, 24.9502], aliases: ['kallio', 'karhupuisto', 'hakaniemi'] },
  { name: 'Sörnäinen / Kurvi', city: 'Helsinki', coords: [60.1886, 24.9612], aliases: ['sörnäinen', 'kurvi', 'suvilahti'] },
  { name: 'Vallila / Hermanni', city: 'Helsinki', coords: [60.1956, 24.9585], aliases: ['vallila', 'hermanni', 'kumpula'] },
  { name: 'Pasila', city: 'Helsinki', coords: [60.1986, 24.9333], aliases: ['pasila', 'länsi-pasila', 'itä-pasila', 'tripla', 'messukeskus'] },
  { name: 'Arabia / Toukola / Vanhakaupunki', city: 'Helsinki', coords: [60.2097, 24.9647], aliases: ['arabia', 'arabianranta', 'toukola', 'vanhakaupunki', 'koskela'] },
  { name: 'Kulosaari', city: 'Helsinki', coords: [60.1885, 25.0085], aliases: ['kulosaari'] },
  { name: 'Munkkiniemi / Meilahti', city: 'Helsinki', coords: [60.1985, 24.8785], aliases: ['munkkiniemi', 'munkkivuori', 'niemenmäki', 'meilahti', 'kuusisaari', 'lehtisaari'] },
  { name: 'Lauttasaari', city: 'Helsinki', coords: [60.1585, 24.8825], aliases: ['lauttasaari'] },
  { name: 'Haaga / Lassila', city: 'Helsinki', coords: [60.2134, 24.8952], aliases: ['haaga', 'etelä-haaga', 'pohjois-haaga', 'lassila', 'huopalahti'] },
  { name: 'Pitäjänmäki / Konala', city: 'Helsinki', coords: [60.2225, 24.8585], aliases: ['pitäjänmäki', 'konala', 'reimarla', 'pajamäki'] },
  { name: 'Kannelmäki / Malminkartano', city: 'Helsinki', coords: [60.2385, 24.8685], aliases: ['kannelmäki', 'malminkartano', 'kaarela', 'maununneva'] },
  { name: 'Maunula / Käpylä / Oulunkylä', city: 'Helsinki', coords: [60.222, 24.945], aliases: ['maunula', 'käpylä', 'oulunkylä', 'metsälä', 'veräjämäki', 'suursuo'] },
  { name: 'Pakila / Paloheinä / Tuomarinkylä', city: 'Helsinki', coords: [60.246, 24.942], aliases: ['pakila', 'länsi-pakila', 'itä-pakila', 'paloheinä', 'tuomarinkylä', 'torpparinmäki'] },
  { name: 'Malmi / Pukinmäki / Tapanila', city: 'Helsinki', coords: [60.2512, 25.0112], aliases: ['malmi', 'pukinmäki', 'tapanila', 'tapaninvainio', 'savela', 'siltamäki', 'puistola', 'suutarila'] },
  { name: 'Viikki', city: 'Helsinki', coords: [60.2275, 25.014], aliases: ['viikki', 'latokartano'] },
  { name: 'Herttoniemi / Roihuvuori / Laajasalo', city: 'Helsinki', coords: [60.1945, 25.035], aliases: ['herttoniemi', 'roihuvuori', 'laajasalo', 'tammisalo', 'jollas', 'santahamina', 'suomenlinna'] },
  { name: 'Itäkeskus / Puotila / Myllypuro', city: 'Helsinki', coords: [60.2116, 25.0816], aliases: ['itäkeskus', 'puotila', 'puotinharju', 'myllypuro', 'marjaniemi', 'easton'] },
  { name: 'Kontula / Mellunkylä / Vartiokylä', city: 'Helsinki', coords: [60.2368, 25.0829], aliases: ['kontula', 'mellunkylä', 'vesala', 'kurkimäki', 'vartiokylä', 'vartioharju', 'jakomäki', 'suurmetsä'] },
  { name: 'Vuosaari', city: 'Helsinki', coords: [60.2082, 25.1445], aliases: ['vuosaari', 'aurinkolahti', 'columbus', 'rastila'] },

  // --- ESPOO ---
  { name: 'Tapiola', city: 'Espoo', coords: [60.1756, 24.8045], aliases: ['tapiola', 'pohjois-tapiola', 'otsolahti', 'länsikorkee', 'weegee', 'emma'] },
  { name: 'Otaniemi / Keilaniemi', city: 'Espoo', coords: [60.1869, 24.8286], aliases: ['otaniemi', 'keilaniemi', 'aalto', 'maari'] },
  { name: 'Westend / Haukilahti / Niittykumpu', city: 'Espoo', coords: [60.1635, 24.805], aliases: ['westend', 'haukilahti', 'niittykumpu', 'laajalahti'] },
  { name: 'Mankkaa', city: 'Espoo', coords: [60.1935, 24.782], aliases: ['mankkaa', 'koivu-mankkaa', 'klovi'] },
  { name: 'Matinkylä / Olari / Henttaa', city: 'Espoo', coords: [60.1583, 24.7376], aliases: ['matinkylä', 'olari', 'henttaa', 'friisilä', 'kuitinmäki', 'lystimäki', 'iirislahti', 'iso omena'] },
  { name: 'Leppävaara', city: 'Espoo', coords: [60.2188, 24.8124], aliases: ['leppävaara', 'etelä-leppävaara', 'pohjois-leppävaara', 'mäkkylä', 'perkkaa', 'sello'] },
  { name: 'Kilo / Karakallio / Viherlaakso', city: 'Espoo', coords: [60.215, 24.772], aliases: ['kilo', 'karakallio', 'viherlaakso', 'kera', 'nihtisilta', 'sepänkylä'] },
  { name: 'Laaksolahti / Lippajärvi / Järvenperä', city: 'Espoo', coords: [60.236, 24.772], aliases: ['laaksolahti', 'lippajärvi', 'järvenperä', 'jupperi', 'lähderanta', 'lintuvaara'] },
  { name: 'Espoon keskus / Tuomarila / Suvela', city: 'Espoo', coords: [60.2055, 24.6559], aliases: ['espoon keskus', 'tuomarila', 'suvela', 'kirkkojärvi', 'kaupunginkallio', 'muurala', 'karvasmäki', 'jorvi', 'bemböle'] },
  { name: 'Espoonlahti / Kivenlahti / Soukka', city: 'Espoo', coords: [60.1476, 24.6566], aliases: ['espoonlahti', 'kivenlahti', 'soukka', 'kaitaa', 'nöykkiö', 'saunalahti', 'latokaski', 'finnoo', 'lippulaiva'] },
  { name: 'Kauklahti', city: 'Espoo', coords: [60.1905, 24.6025], aliases: ['kauklahti', 'kurttila', 'espoonkartano', 'vanttila'] },
  { name: 'Pohjois-Espoo / Nuuksio / Kalajärvi', city: 'Espoo', coords: [60.278, 24.645], aliases: ['nuuksio', 'kalajärvi', 'niipperi', 'perusmäki', 'bodom', 'lahnus', 'siikajärvi', 'karhusuo', 'gumböle'] },

  // --- VANTAA ---
  { name: 'Tikkurila', city: 'Vantaa', coords: [60.2934, 25.041], aliases: ['tikkurila', 'heureka', 'dixi', 'hakkila', 'hiekkaharju', 'ruskeasanta', 'veromies'] },
  { name: 'Myyrmäki / Martinlaakso / Kivistö', city: 'Vantaa', coords: [60.2602, 24.8548], aliases: ['myyrmäki', 'martinlaakso', 'kivistö', 'hämeenkylä', 'hämevaara', 'kaivoksela', 'varisto', 'petikko', 'keimola', 'seutula'] },
  { name: 'Aviapolis / Pakkala / Lentokenttä', city: 'Vantaa', coords: [60.2927, 24.9653], aliases: ['aviapolis', 'pakkala', 'lentokenttä', 'jumbo', 'viinikkala', 'ylästö'] },
  { name: 'Hakunila / Länsimäki', city: 'Vantaa', coords: [60.276, 25.092], aliases: ['hakunila', 'länsimäki', 'länsisalmi', 'itähakkila', 'ojanko'] },
  { name: 'Koivukylä / Korso / Rekola', city: 'Vantaa', coords: [60.324, 25.053], aliases: ['koivukylä', 'korso', 'rekola', 'havukoski', 'pejas', 'mikkola', 'leppäkorpi', 'vallinoja'] },

  // --- KAUNIAINEN ---
  { name: 'Kauniainen', city: 'Kauniainen', coords: [60.2134, 24.7267], aliases: ['kauniainen', 'grankulla'] },
]