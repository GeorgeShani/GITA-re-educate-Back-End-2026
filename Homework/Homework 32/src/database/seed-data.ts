import { ProductCategory } from '../products/enums/product-category.enum';
import { Gender } from '../users/enums/gender.enum';

export interface SeedMovie {
  name: string;
  genre: string;
  year: number;
  description: string;
}

export interface SeedDirector {
  firstName: string;
  lastName: string;
  birthYear: number;
  nationality: string;
  films: SeedMovie[];
}

export const DIRECTORS_SEED: SeedDirector[] = [
  {
    firstName: 'Charlie',
    lastName: 'Chaplin',
    birthYear: 1889,
    nationality: 'British',
    films: [
      {
        name: 'City Lights',
        genre: 'Comedy',
        year: 1931,
        description:
          'A silent romantic comedy about the Tramp and a blind flower girl.',
      },
      {
        name: 'Modern Times',
        genre: 'Comedy',
        year: 1936,
        description:
          "A satire on industrial life through the Tramp's misadventures.",
      },
      {
        name: 'The Great Dictator',
        genre: 'Comedy',
        year: 1940,
        description:
          "Chaplin's first true talkie satirizing Adolf Hitler and fascism.",
      },
    ],
  },
  {
    firstName: 'Orson',
    lastName: 'Welles',
    birthYear: 1915,
    nationality: 'American',
    films: [
      {
        name: 'Citizen Kane',
        genre: 'Drama',
        year: 1941,
        description:
          'The rise and fall of publishing tycoon Charles Foster Kane.',
      },
      {
        name: 'Touch of Evil',
        genre: 'Film-Noir',
        year: 1958,
        description:
          'A police captain frames a suspect in a border-town murder case.',
      },
    ],
  },
  {
    firstName: 'Alfred',
    lastName: 'Hitchcock',
    birthYear: 1899,
    nationality: 'British',
    films: [
      {
        name: 'Rear Window',
        genre: 'Thriller',
        year: 1954,
        description:
          'A wheelchair-bound photographer suspects his neighbor of murder.',
      },
      {
        name: 'Vertigo',
        genre: 'Thriller',
        year: 1958,
        description:
          'A former detective becomes obsessed with a woman he is following.',
      },
      {
        name: 'Psycho',
        genre: 'Horror',
        year: 1960,
        description: 'A secretary on the run checks into the Bates Motel.',
      },
      {
        name: 'North by Northwest',
        genre: 'Thriller',
        year: 1959,
        description:
          'An advertising executive is mistaken for a government agent.',
      },
    ],
  },
  {
    firstName: 'Akira',
    lastName: 'Kurosawa',
    birthYear: 1910,
    nationality: 'Japanese',
    films: [
      {
        name: 'Rashomon',
        genre: 'Drama',
        year: 1950,
        description: 'A crime is retold from four conflicting perspectives.',
      },
      {
        name: 'Seven Samurai',
        genre: 'Adventure',
        year: 1954,
        description: 'A village hires seven samurai to defend it from bandits.',
      },
      {
        name: 'Ran',
        genre: 'War',
        year: 1985,
        description:
          "An aging warlord's kingdom collapses in a feudal Japan epic.",
      },
    ],
  },
  {
    firstName: 'Federico',
    lastName: 'Fellini',
    birthYear: 1920,
    nationality: 'Italian',
    films: [
      {
        name: 'La Dolce Vita',
        genre: 'Drama',
        year: 1960,
        description:
          'A tabloid journalist drifts through the high life of Rome.',
      },
      {
        name: '8½',
        genre: 'Drama',
        year: 1963,
        description:
          'A blocked film director wrestles with his creative and personal life.',
      },
    ],
  },
  {
    firstName: 'Ingmar',
    lastName: 'Bergman',
    birthYear: 1918,
    nationality: 'Swedish',
    films: [
      {
        name: 'The Seventh Seal',
        genre: 'Drama',
        year: 1957,
        description:
          'A medieval knight plays chess with Death during the plague.',
      },
      {
        name: 'Persona',
        genre: 'Drama',
        year: 1966,
        description:
          "A nurse and her mute patient's identities begin to merge.",
      },
    ],
  },
  {
    firstName: 'Francis Ford',
    lastName: 'Coppola',
    birthYear: 1939,
    nationality: 'American',
    films: [
      {
        name: 'The Godfather',
        genre: 'Crime',
        year: 1972,
        description:
          'The patriarch of a crime dynasty transfers control to his son.',
      },
      {
        name: 'The Godfather Part II',
        genre: 'Crime',
        year: 1974,
        description:
          "Michael Corleone's reign is intercut with young Vito's rise.",
      },
      {
        name: 'Apocalypse Now',
        genre: 'War',
        year: 1979,
        description:
          'A captain travels upriver to assassinate a renegade colonel.',
      },
    ],
  },
  {
    firstName: 'Steven',
    lastName: 'Spielberg',
    birthYear: 1946,
    nationality: 'American',
    films: [
      {
        name: 'Jaws',
        genre: 'Thriller',
        year: 1975,
        description:
          'A giant great white shark terrorizes a New England beach town.',
      },
      {
        name: 'Jurassic Park',
        genre: 'Adventure',
        year: 1993,
        description: 'A theme park of cloned dinosaurs spirals into chaos.',
      },
      {
        name: "Schindler's List",
        genre: 'Drama',
        year: 1993,
        description:
          'A German businessman saves Jewish refugees during the Holocaust.',
      },
    ],
  },
  {
    firstName: 'Martin',
    lastName: 'Scorsese',
    birthYear: 1942,
    nationality: 'American',
    films: [
      {
        name: 'Taxi Driver',
        genre: 'Drama',
        year: 1976,
        description: 'An unhinged veteran drives nights through New York City.',
      },
      {
        name: 'Goodfellas',
        genre: 'Crime',
        year: 1990,
        description: 'The rise and fall of a mob associate over three decades.',
      },
      {
        name: 'The Departed',
        genre: 'Crime',
        year: 2006,
        description:
          'A mole in the police and an undercover cop try to expose each other.',
      },
    ],
  },
  {
    firstName: 'Ridley',
    lastName: 'Scott',
    birthYear: 1937,
    nationality: 'British',
    films: [
      {
        name: 'Alien',
        genre: 'Horror',
        year: 1979,
        description:
          'The crew of a commercial spacecraft encounters a deadly lifeform.',
      },
      {
        name: 'Blade Runner',
        genre: 'Sci-Fi',
        year: 1982,
        description:
          'A blade runner hunts down rogue replicants in a dystopian future.',
      },
      {
        name: 'Gladiator',
        genre: 'Action',
        year: 2000,
        description: 'A betrayed Roman general seeks revenge as a gladiator.',
      },
    ],
  },
  {
    firstName: 'Hayao',
    lastName: 'Miyazaki',
    birthYear: 1941,
    nationality: 'Japanese',
    films: [
      {
        name: 'My Neighbor Totoro',
        genre: 'Animation',
        year: 1988,
        description:
          'Two sisters befriend friendly forest spirits in rural Japan.',
      },
      {
        name: 'Princess Mononoke',
        genre: 'Animation',
        year: 1997,
        description:
          'A prince is drawn into a war between forest gods and humans.',
      },
      {
        name: 'Spirited Away',
        genre: 'Animation',
        year: 2001,
        description:
          'A girl must work in a spirit world bathhouse to free her parents.',
      },
    ],
  },
  {
    firstName: 'Quentin',
    lastName: 'Tarantino',
    birthYear: 1963,
    nationality: 'American',
    films: [
      {
        name: 'Pulp Fiction',
        genre: 'Crime',
        year: 1994,
        description:
          'The lives of two hitmen, a boxer, and gangsters intertwine.',
      },
      {
        name: 'Kill Bill: Volume 1',
        genre: 'Action',
        year: 2003,
        description: 'A former assassin seeks revenge on her ex-colleagues.',
      },
      {
        name: 'Inglourious Basterds',
        genre: 'War',
        year: 2009,
        description:
          'Jewish soldiers plot to bring down the Nazi high command.',
      },
    ],
  },
  {
    firstName: 'David',
    lastName: 'Fincher',
    birthYear: 1962,
    nationality: 'American',
    films: [
      {
        name: 'Se7en',
        genre: 'Thriller',
        year: 1995,
        description:
          'Two detectives hunt a serial killer who uses the seven deadly sins.',
      },
      {
        name: 'Fight Club',
        genre: 'Drama',
        year: 1999,
        description:
          'An insomniac office worker forms an underground fight club.',
      },
      {
        name: 'The Social Network',
        genre: 'Drama',
        year: 2010,
        description: 'The founding of Facebook and the lawsuits that followed.',
      },
    ],
  },
  {
    firstName: 'Christopher',
    lastName: 'Nolan',
    birthYear: 1970,
    nationality: 'British-American',
    films: [
      {
        name: 'Memento',
        genre: 'Thriller',
        year: 2000,
        description:
          "A man with short-term memory loss hunts his wife's killer.",
      },
      {
        name: 'The Dark Knight',
        genre: 'Action',
        year: 2008,
        description:
          'Batman faces the Joker, a criminal mastermind bent on chaos.',
      },
      {
        name: 'Inception',
        genre: 'Sci-Fi',
        year: 2010,
        description:
          'A thief who steals secrets through dream-sharing takes on one last job.',
      },
      {
        name: 'Interstellar',
        genre: 'Sci-Fi',
        year: 2014,
        description: 'Explorers travel through a wormhole to save humanity.',
      },
    ],
  },
  {
    firstName: 'Wong',
    lastName: 'Kar-wai',
    birthYear: 1958,
    nationality: 'Hong Konger',
    films: [
      {
        name: 'Chungking Express',
        genre: 'Romance',
        year: 1994,
        description:
          'Two heartbroken Hong Kong policemen fall in love with strangers.',
      },
      {
        name: 'In the Mood for Love',
        genre: 'Romance',
        year: 2000,
        description:
          'Two neighbors grow close after discovering their spouses are having an affair.',
      },
    ],
  },
  {
    firstName: 'Bong',
    lastName: 'Joon-ho',
    birthYear: 1969,
    nationality: 'South Korean',
    films: [
      {
        name: 'Memories of Murder',
        genre: 'Crime',
        year: 2003,
        description:
          "Detectives investigate South Korea's first serial murder case.",
      },
      {
        name: 'Snowpiercer',
        genre: 'Sci-Fi',
        year: 2013,
        description:
          'The last survivors of a frozen Earth live aboard a perpetually moving train.',
      },
      {
        name: 'Parasite',
        genre: 'Drama',
        year: 2019,
        description:
          'A poor family schemes to become employed by a wealthy household.',
      },
    ],
  },
  {
    firstName: 'Denis',
    lastName: 'Villeneuve',
    birthYear: 1967,
    nationality: 'Canadian',
    films: [
      {
        name: 'Arrival',
        genre: 'Sci-Fi',
        year: 2016,
        description:
          'A linguist is recruited to communicate with alien visitors.',
      },
      {
        name: 'Blade Runner 2049',
        genre: 'Sci-Fi',
        year: 2017,
        description:
          'A new blade runner unearths a secret that could plunge society into chaos.',
      },
      {
        name: 'Dune',
        genre: 'Sci-Fi',
        year: 2021,
        description:
          "A noble family's fate is tied to a desert planet's precious resource.",
      },
    ],
  },
  {
    firstName: 'Jordan',
    lastName: 'Peele',
    birthYear: 1979,
    nationality: 'American',
    films: [
      {
        name: 'Get Out',
        genre: 'Horror',
        year: 2017,
        description:
          "A young man uncovers a disturbing secret at his girlfriend's family estate.",
      },
      {
        name: 'Us',
        genre: 'Horror',
        year: 2019,
        description:
          'A family is terrorized by their own sinister doppelgangers.',
      },
    ],
  },
  {
    firstName: 'Greta',
    lastName: 'Gerwig',
    birthYear: 1983,
    nationality: 'American',
    films: [
      {
        name: 'Lady Bird',
        genre: 'Comedy',
        year: 2017,
        description:
          'A headstrong teenager navigates her senior year in Sacramento.',
      },
      {
        name: 'Little Women',
        genre: 'Drama',
        year: 2019,
        description:
          'The four March sisters come of age in Civil War-era Massachusetts.',
      },
      {
        name: 'Barbie',
        genre: 'Comedy',
        year: 2023,
        description:
          'Barbie and Ken venture from Barbieland into the real world.',
      },
    ],
  },
];

export interface SeedUser {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender: Gender;
  age: number;
  /** Plain-text password — the seed script hashes it before saving. */
  password: string;
}

/** Every seeded user shares this password so you can log in and try the API immediately. */
export const SEED_USER_PASSWORD = 'Password123!';

export const USERS_SEED: SeedUser[] = [
  {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada.lovelace@example.com',
    phoneNumber: '+1-555-0101',
    gender: Gender.FEMALE,
    age: 28,
    password: SEED_USER_PASSWORD,
  },
  {
    firstName: 'Alan',
    lastName: 'Turing',
    email: 'alan.turing@example.com',
    phoneNumber: '+1-555-0102',
    gender: Gender.MALE,
    age: 34,
    password: SEED_USER_PASSWORD,
  },
  {
    firstName: 'Grace',
    lastName: 'Hopper',
    email: 'grace.hopper@example.com',
    phoneNumber: '+1-555-0103',
    gender: Gender.FEMALE,
    age: 41,
    password: SEED_USER_PASSWORD,
  },
  {
    firstName: 'Linus',
    lastName: 'Torvalds',
    email: 'linus.torvalds@example.com',
    phoneNumber: '+1-555-0104',
    gender: Gender.MALE,
    age: 36,
    password: SEED_USER_PASSWORD,
  },
  {
    firstName: 'Margaret',
    lastName: 'Hamilton',
    email: 'margaret.hamilton@example.com',
    phoneNumber: '+1-555-0105',
    gender: Gender.FEMALE,
    age: 45,
    password: SEED_USER_PASSWORD,
  },
  {
    firstName: 'Tim',
    lastName: 'Berners-Lee',
    email: 'tim.bernerslee@example.com',
    phoneNumber: '+1-555-0106',
    gender: Gender.MALE,
    age: 52,
    password: SEED_USER_PASSWORD,
  },
];

export interface SeedProduct {
  name: string;
  description: string;
  category: ProductCategory;
  price: number;
  quantity: number;
}

export const PRODUCTS_SEED: SeedProduct[] = [
  {
    name: 'Wireless Noise-Cancelling Headphones',
    description:
      'Over-ear Bluetooth headphones with active noise cancellation and 30-hour battery life.',
    category: ProductCategory.ELECTRONICS,
    price: 199.99,
    quantity: 50,
  },
  {
    name: 'Mechanical Keyboard',
    description:
      'Compact 75% mechanical keyboard with hot-swappable switches and RGB backlighting.',
    category: ProductCategory.ELECTRONICS,
    price: 89.99,
    quantity: 75,
  },
  {
    name: 'Cotton Crewneck T-Shirt',
    description:
      'Classic-fit 100% organic cotton t-shirt, available in multiple colors.',
    category: ProductCategory.CLOTHING,
    price: 19.99,
    quantity: 200,
  },
  {
    name: 'Denim Jacket',
    description: 'Vintage-wash denim jacket with a relaxed fit.',
    category: ProductCategory.CLOTHING,
    price: 64.99,
    quantity: 40,
  },
  {
    name: 'Organic Dark Chocolate Bar',
    description: '70% cacao dark chocolate bar made with fair-trade cocoa.',
    category: ProductCategory.FOOD,
    price: 4.99,
    quantity: 300,
  },
  {
    name: 'Cold Brew Coffee Concentrate',
    description:
      'Smooth, low-acid cold brew concentrate — makes up to 8 servings.',
    category: ProductCategory.FOOD,
    price: 12.99,
    quantity: 120,
  },
  {
    name: 'Clean Code',
    description:
      'A Handbook of Agile Software Craftsmanship, by Robert C. Martin.',
    category: ProductCategory.BOOKS,
    price: 34.99,
    quantity: 60,
  },
  {
    name: 'Designing Data-Intensive Applications',
    description:
      'The big ideas behind reliable, scalable, and maintainable systems, by Martin Kleppmann.',
    category: ProductCategory.BOOKS,
    price: 44.99,
    quantity: 45,
  },
  {
    name: 'Wooden Building Blocks Set',
    description: '100-piece natural wood building block set for ages 3 and up.',
    category: ProductCategory.TOYS,
    price: 29.99,
    quantity: 80,
  },
  {
    name: 'Remote-Control Race Car',
    description:
      '1:16 scale RC race car with a rechargeable battery, up to 20 mph.',
    category: ProductCategory.TOYS,
    price: 39.99,
    quantity: 55,
  },
  {
    name: 'Standing Desk Converter',
    description:
      'Height-adjustable desktop riser for switching between sitting and standing.',
    category: ProductCategory.FURNITURE,
    price: 149.99,
    quantity: 25,
  },
  {
    name: 'Ergonomic Office Chair',
    description:
      'Mesh-back office chair with lumbar support and adjustable armrests.',
    category: ProductCategory.FURNITURE,
    price: 219.99,
    quantity: 30,
  },
  {
    name: 'Vitamin C Serum',
    description:
      'Brightening facial serum with 15% vitamin C and hyaluronic acid.',
    category: ProductCategory.BEAUTY,
    price: 24.99,
    quantity: 90,
  },
  {
    name: 'Ceramic Hair Straightener',
    description:
      'Dual-voltage flat iron with adjustable temperature up to 450°F.',
    category: ProductCategory.BEAUTY,
    price: 54.99,
    quantity: 65,
  },
  {
    name: 'Yoga Mat',
    description: 'Non-slip 6mm-thick yoga mat with a carrying strap.',
    category: ProductCategory.SPORTS,
    price: 29.99,
    quantity: 100,
  },
  {
    name: 'Adjustable Dumbbell Set',
    description:
      'Pair of adjustable dumbbells, 5-50 lbs each, space-saving design.',
    category: ProductCategory.SPORTS,
    price: 299.99,
    quantity: 20,
  },
  {
    name: 'Scented Soy Candle',
    description:
      'Hand-poured soy candle in a reusable glass jar, 40-hour burn time.',
    category: ProductCategory.OTHER,
    price: 16.99,
    quantity: 150,
  },
  {
    name: 'Travel Umbrella',
    description: 'Compact windproof umbrella with automatic open/close.',
    category: ProductCategory.OTHER,
    price: 22.99,
    quantity: 110,
  },
];
