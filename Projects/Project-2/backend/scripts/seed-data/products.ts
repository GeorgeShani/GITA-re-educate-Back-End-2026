export interface VariantSeed {
  sku: string;
  attributes: Record<string, string>;
  priceMinor?: number;
}

export interface ProductSeed {
  name: string;
  slug: string;
  brand: string;
  description: string;
  categorySlug: string;
  basePriceMinor: number;
  tags: string[];
  imageQuery: string;
  isFeatured?: boolean;
  variants: VariantSeed[];
}

// --- Variant-generator helpers, kept terse so the ~80-entry catalog
// below stays scannable. Each returns { sku, attributes } pairs.

function single(prefix: string): VariantSeed[] {
  return [{ sku: prefix, attributes: {} }];
}

function sizes(prefix: string, values: string[]): VariantSeed[] {
  return values.map((size) => ({
    sku: `${prefix}-${size}`,
    attributes: { size },
  }));
}

function handAndSize(
  prefix: string,
  handSizes: string[] = ['S', 'M', 'L', 'XL'],
): VariantSeed[] {
  return ['L', 'R'].flatMap((hand) =>
    handSizes.map((size) => ({
      sku: `${prefix}-${hand}-${size}`,
      attributes: { hand, size },
    })),
  );
}

function colors(prefix: string, values: string[]): VariantSeed[] {
  return values.map((colourway) => ({
    sku: `${prefix}-${colourway.slice(0, 3).toUpperCase()}`,
    attributes: { colourway },
  }));
}

function colorAndSize(
  prefix: string,
  colourways: string[],
  sizeValues: string[],
): VariantSeed[] {
  return colourways.flatMap((colourway) =>
    sizeValues.map((size) => ({
      sku: `${prefix}-${colourway.slice(0, 3).toUpperCase()}-${size}`,
      attributes: { colourway, size },
    })),
  );
}

function packSize(prefix: string, values: string[]): VariantSeed[] {
  return values.map((packSizeValue) => ({
    sku: `${prefix}-${packSizeValue.replace(/\s+/g, '')}`,
    attributes: { packSize: packSizeValue },
  }));
}

// --- The catalog. Real, well-known golf brands throughout — same
// convention the original 3legant template used (its own fixtures
// named Callaway/G-FORE/Air Jordan). ~80 products across every SCOPE.md
// A8 category. imageQuery is deliberately specific ("golf glove
// leather", not "glove") — a generic query for "glove" alone returned
// a medical glove during manual testing, so every query here anchors
// on "golf" plus a concrete visual descriptor.
export const PRODUCT_SEEDS: ProductSeed[] = [
  // Gloves
  {
    name: 'Tour Authentic Cabretta Leather Glove',
    slug: 'tour-authentic-cabretta-leather-glove',
    brand: 'FootJoy',
    description:
      'Premium cabretta leather across the entire glove for tour-level feel and durability, with a stretch mesh backing for breathability.',
    categorySlug: 'gloves',
    basePriceMinor: 2499,
    tags: ['leather', 'cabretta', 'tour'],
    imageQuery: 'golf glove leather hand',
    isFeatured: true,
    variants: handAndSize('TOUR-AUTH'),
  },
  {
    name: 'RainGrip All-Weather Glove Pair',
    slug: 'raingrip-all-weather-glove-pair',
    brand: 'FootJoy',
    description:
      'A pair designed to grip better the wetter it gets — the only glove built to be worn on both hands in the rain.',
    categorySlug: 'gloves',
    basePriceMinor: 3299,
    tags: ['rain', 'all-weather', 'pair'],
    imageQuery: 'golf glove rain wet grip',
    variants: sizes('RAINGRIP', ['S', 'M', 'L', 'XL']),
  },
  {
    name: 'StaSof Soft-Feel Glove',
    slug: 'stasof-soft-feel-glove',
    brand: 'FootJoy',
    description:
      'Ultra-soft leather that breaks in fast without breaking down, for golfers who prioritize feel above all else.',
    categorySlug: 'gloves',
    basePriceMinor: 2199,
    tags: ['leather', 'soft', 'feel'],
    imageQuery: 'golf glove soft leather texture',
    variants: handAndSize('STASOF'),
  },
  {
    name: 'Players Fit Glove',
    slug: 'titleist-players-fit-glove',
    brand: 'Titleist',
    description:
      'A tailored, low-profile fit that mirrors the shape of the hand for a barely-there feel through impact.',
    categorySlug: 'gloves',
    basePriceMinor: 2399,
    tags: ['leather', 'tour', 'fit'],
    imageQuery: 'golfer wearing glove swing',
    variants: handAndSize('TPFG'),
  },
  {
    name: 'Collection Leather Glove',
    slug: 'gfore-collection-leather-glove',
    brand: 'G/FORE',
    description:
      "Cabretta leather with G/FORE's signature colourways — performance built for golfers who care about the details.",
    categorySlug: 'gloves',
    basePriceMinor: 2799,
    tags: ['leather', 'colourway', 'premium'],
    imageQuery: 'golf glove colorful leather',
    variants: colorAndSize(
      'GFORE-GLV',
      ['White', 'Black', 'Navy'],
      ['S', 'M', 'L'],
    ),
  },
  {
    name: 'HyperGrip Synthetic Glove',
    slug: 'hypergrip-synthetic-glove',
    brand: 'Callaway',
    description:
      'A durable synthetic build with a tacky palm print for consistent grip in any weather.',
    categorySlug: 'gloves',
    basePriceMinor: 1899,
    tags: ['synthetic', 'grip', 'durable'],
    imageQuery: 'golf glove synthetic material',
    variants: handAndSize('HYPERGRIP'),
  },
  {
    name: "Player's Glove",
    slug: 'taylormade-players-glove',
    brand: 'TaylorMade',
    description:
      'AAA-grade leather in the areas that matter most, with a breathable mesh backing.',
    categorySlug: 'gloves',
    basePriceMinor: 2099,
    tags: ['leather', 'breathable'],
    imageQuery: 'golf glove hand close up',
    variants: handAndSize('TM-PLAYER'),
  },
  {
    name: 'ColdGear Winter Thermal Glove Pair',
    slug: 'coldgear-winter-thermal-glove-pair',
    brand: 'Under Armour',
    description:
      'Thermal-lined pair for cold-weather rounds — worn on both hands to keep grip and warmth through 18.',
    categorySlug: 'gloves',
    basePriceMinor: 3499,
    tags: ['winter', 'thermal', 'pair'],
    imageQuery: 'winter gloves cold weather golf',
    variants: sizes('COLDGEAR', ['S', 'M', 'L', 'XL']),
  },

  // Golf Balls
  {
    name: 'Pro V1 Golf Balls',
    slug: 'pro-v1-golf-balls',
    brand: 'Titleist',
    description:
      'The #1 ball in golf. A soft, responsive urethane cover with consistent flight and greenside spin.',
    categorySlug: 'golf-balls',
    basePriceMinor: 5499,
    tags: ['tour', 'urethane', 'dozen'],
    imageQuery: 'titleist golf balls dozen box',
    isFeatured: true,
    variants: packSize('PROV1', ['1 dozen']),
  },
  {
    name: 'Pro V1x Golf Balls',
    slug: 'pro-v1x-golf-balls',
    brand: 'Titleist',
    description:
      'A higher flight and firmer feel than the Pro V1, with a slightly lower long-game spin for more distance.',
    categorySlug: 'golf-balls',
    basePriceMinor: 5499,
    tags: ['tour', 'urethane', 'dozen'],
    imageQuery: 'golf balls dozen sleeve',
    variants: packSize('PROV1X', ['1 dozen']),
  },
  {
    name: 'Chrome Soft Golf Balls',
    slug: 'chrome-soft-golf-balls',
    brand: 'Callaway',
    description:
      'A dual SoftFast Core delivers tour-level speed with an unmistakably soft feel.',
    categorySlug: 'golf-balls',
    basePriceMinor: 4999,
    tags: ['soft', 'tour', 'dozen'],
    imageQuery: 'golf balls stack white',
    variants: packSize('CHROMESOFT', ['1 dozen']),
  },
  {
    name: 'TP5 Golf Balls',
    slug: 'tp5-golf-balls',
    brand: 'TaylorMade',
    description:
      '5-layer tour construction built for total distance without giving up short-game control.',
    categorySlug: 'golf-balls',
    basePriceMinor: 4999,
    tags: ['tour', '5-layer', 'dozen'],
    imageQuery: 'golf ball on tee course',
    variants: packSize('TP5', ['1 dozen']),
  },
  {
    name: 'e12 Contact Golf Balls',
    slug: 'e12-contact-golf-balls',
    brand: 'Bridgestone',
    description:
      'A surlyn cover and larger contact area promote a straighter, more forgiving ball flight.',
    categorySlug: 'golf-balls',
    basePriceMinor: 3299,
    tags: ['distance', 'forgiving', 'dozen'],
    imageQuery: 'golf balls fairway grass',
    variants: packSize('E12', ['1 dozen']),
  },
  {
    name: 'Velocity Golf Balls',
    slug: 'velocity-golf-balls',
    brand: 'Titleist',
    description:
      'A high-speed core built for maximum distance off every club in the bag.',
    categorySlug: 'golf-balls',
    basePriceMinor: 2999,
    tags: ['distance', 'value', 'dozen'],
    imageQuery: 'golf balls pile close up',
    variants: packSize('VELOCITY', ['1 dozen']),
  },
  {
    name: 'Signature Golf Balls',
    slug: 'kirkland-signature-golf-balls',
    brand: 'Kirkland',
    description:
      'A 3-piece urethane-cover ball that punches well above its price point.',
    categorySlug: 'golf-balls',
    basePriceMinor: 2499,
    tags: ['value', 'urethane', 'dozen'],
    imageQuery: 'golf balls box open',
    variants: packSize('KS-BALL', ['2 dozen']),
  },
  {
    name: 'Z-Star Golf Balls',
    slug: 'z-star-golf-balls',
    brand: 'Srixon',
    description:
      'A SpinSkin coating and urethane cover combine for exceptional greenside control.',
    categorySlug: 'golf-balls',
    basePriceMinor: 4599,
    tags: ['tour', 'spin', 'dozen'],
    imageQuery: 'golf ball green grass macro',
    variants: packSize('ZSTAR', ['1 dozen']),
  },

  // Tees
  {
    name: 'Bamboo Golf Tees',
    slug: 'bamboo-golf-tees-100-pack',
    brand: '3legant Golf',
    description:
      'Sustainably harvested bamboo tees — stronger than wood and kinder to the planet.',
    categorySlug: 'tees',
    basePriceMinor: 999,
    tags: ['bamboo', 'sustainable', 'pack'],
    imageQuery: 'wooden golf tee grass',
    variants: sizes('BAMBOO-TEE', ['2.75in', '3.25in']),
  },
  {
    name: 'Professional Tour Wooden Tees',
    slug: 'pride-professional-tour-wooden-tees',
    brand: 'Pride',
    description:
      'The tee that started it all — the standard for wooden tees since 1958.',
    categorySlug: 'tees',
    basePriceMinor: 799,
    tags: ['wood', 'classic', 'pack'],
    imageQuery: 'golf tee pile wood',
    variants: sizes('PRIDE-TEE', ['2.75in', '3.25in']),
  },
  {
    name: 'Zero Friction Tour 3-Prong Tees',
    slug: 'zero-friction-tour-3-prong-tees',
    brand: 'Zero Friction',
    description:
      'A patented 3-prong tee top that reduces friction for more consistent, longer drives.',
    categorySlug: 'tees',
    basePriceMinor: 899,
    tags: ['low-friction', 'distance', 'pack'],
    imageQuery: 'golf tee closeup driving range',
    variants: single('ZF-TEE-40'),
  },
  {
    name: 'Evolution Tour Tees',
    slug: 'champkey-evolution-tour-tees',
    brand: 'Champkey',
    description:
      'A flexible, unbreakable tee head engineered to last hundreds of rounds.',
    categorySlug: 'tees',
    basePriceMinor: 1299,
    tags: ['durable', 'flexible', 'pack'],
    imageQuery: 'golf tee ball setup',
    variants: single('CHAMP-TEE-30'),
  },
  {
    name: 'Castle Tees',
    slug: 'pride-castle-tees',
    brand: 'Pride',
    description:
      'A castle-top head design that reduces friction while keeping traditional tee looks.',
    categorySlug: 'tees',
    basePriceMinor: 699,
    tags: ['wood', 'classic', 'pack'],
    imageQuery: 'golf tee course sunrise',
    variants: single('CASTLE-TEE-100'),
  },
  {
    name: 'XL Driver Tees',
    slug: '3legant-xl-driver-tees',
    brand: '3legant Golf',
    description:
      'Extra-long tees built for modern drivers, giving low-spin, high-launch setups room to work.',
    categorySlug: 'tees',
    basePriceMinor: 899,
    tags: ['xl', 'driver', 'pack'],
    imageQuery: 'golf tee long driver',
    variants: single('XL-DRIVER-TEE-50'),
  },

  // Headcovers
  {
    name: 'Driver Headcover',
    slug: 'driver-headcover',
    brand: 'TaylorMade',
    description:
      'A padded, form-fitting cover that protects the crown and face from bag chatter.',
    categorySlug: 'headcovers',
    basePriceMinor: 3499,
    tags: ['driver', 'protection'],
    imageQuery: 'golf club headcover driver',
    variants: colors('DRV-COVER', ['Black', 'Red', 'White']),
  },
  {
    name: 'Fairway Wood Headcover Set',
    slug: 'fairway-wood-headcover-set',
    brand: 'Callaway',
    description: 'A matching 2-piece set sized for 3- and 5-wood heads.',
    categorySlug: 'headcovers',
    basePriceMinor: 4299,
    tags: ['fairway', 'set'],
    imageQuery: 'golf club covers set bag',
    variants: single('FW-COVER-SET'),
  },
  {
    name: 'Blade Putter Headcover',
    slug: 'blade-putter-headcover',
    brand: 'Titleist',
    description: 'A magnetic-closure cover sized for blade-style putters.',
    categorySlug: 'headcovers',
    basePriceMinor: 2999,
    tags: ['putter', 'blade'],
    imageQuery: 'putter headcover golf',
    variants: colors('BLADE-COVER', ['Black', 'Navy']),
  },
  {
    name: 'Mallet Putter Headcover',
    slug: 'mallet-putter-headcover',
    brand: 'Odyssey',
    description:
      'Wide-body construction to fit mallet and midsize putter heads.',
    categorySlug: 'headcovers',
    basePriceMinor: 3199,
    tags: ['putter', 'mallet'],
    imageQuery: 'golf putter cover white',
    variants: colors('MALLET-COVER', ['White', 'Black']),
  },
  {
    name: 'Iron Headcover Set',
    slug: 'iron-headcover-set-9pc',
    brand: 'PING',
    description:
      'A numbered 9-piece set that protects irons from clanging together in the bag.',
    categorySlug: 'headcovers',
    basePriceMinor: 5999,
    tags: ['iron', 'set'],
    imageQuery: 'golf iron covers numbered set',
    variants: single('IRON-COVER-9PC'),
  },
  {
    name: 'Animal Driver Headcover',
    slug: 'animal-driver-headcover',
    brand: 'Sunfish',
    description:
      'A novelty animal-shaped cover for golfers who want their bag to stand out.',
    categorySlug: 'headcovers',
    basePriceMinor: 3999,
    tags: ['novelty', 'driver'],
    imageQuery: 'golf club cover animal novelty',
    variants: single('ANIMAL-COVER'),
  },

  // Towels
  {
    name: 'Waffle Golf Towel',
    slug: 'waffle-golf-towel',
    brand: '3legant Golf',
    description:
      'A waffle-weave microfiber towel that cuts through mud and grass stains fast.',
    categorySlug: 'towels',
    basePriceMinor: 1499,
    tags: ['microfiber', 'waffle'],
    imageQuery: 'golf towel waffle texture',
    variants: colors('WAFFLE-TOWEL', ['White', 'Grey', 'Navy']),
  },
  {
    name: 'Tour Microfiber Towel',
    slug: 'tour-microfiber-towel',
    brand: 'TaylorMade',
    description:
      'A tri-fold tour towel with a carabiner clip for easy bag attachment.',
    categorySlug: 'towels',
    basePriceMinor: 1999,
    tags: ['microfiber', 'tour', 'clip'],
    imageQuery: 'golf towel bag clip',
    variants: single('TM-TOWEL'),
  },
  {
    name: 'Cart Towel',
    slug: 'titleist-cart-towel',
    brand: 'Titleist',
    description:
      'An oversized cotton-blend towel built to hang off the cart all round long.',
    categorySlug: 'towels',
    basePriceMinor: 1799,
    tags: ['cart', 'oversized'],
    imageQuery: 'golf cart towel course',
    variants: single('TITL-CART-TOWEL'),
  },
  {
    name: 'Players Towel',
    slug: 'nike-golf-players-towel',
    brand: 'Nike Golf',
    description: 'A compact, absorbent towel sized to clip onto any bag.',
    categorySlug: 'towels',
    basePriceMinor: 1299,
    tags: ['compact', 'clip'],
    imageQuery: 'golf towel clipped bag',
    variants: colors('NIKE-TOWEL', ['Black', 'White']),
  },
  {
    name: 'Caddy Towel',
    slug: 'ping-caddy-towel',
    brand: 'PING',
    description:
      'A large, plush towel with a grommet and clip for hands-free carrying.',
    categorySlug: 'towels',
    basePriceMinor: 1699,
    tags: ['plush', 'grommet'],
    imageQuery: 'golf towel folded plush',
    variants: single('PING-CADDY-TOWEL'),
  },

  // Bags
  {
    name: 'Cart Bag 14-Way',
    slug: 'cart-bag-14-way',
    brand: 'Sun Mountain',
    description:
      'A 14-way top with full-length dividers keeps every club separated and easy to grab.',
    categorySlug: 'bags',
    basePriceMinor: 22999,
    tags: ['cart', '14-way', 'divider'],
    imageQuery: 'golf cart bag course',
    isFeatured: true,
    variants: colors('CARTBAG14', ['Black', 'Charcoal', 'Navy']),
  },
  {
    name: 'Players 4 Stand Bag',
    slug: 'titleist-players-4-stand-bag',
    brand: 'Titleist',
    description:
      'A lightweight 4-way top built for golfers who carry or push their bag.',
    categorySlug: 'bags',
    basePriceMinor: 27999,
    tags: ['stand', 'lightweight'],
    imageQuery: 'golf stand bag carrying',
    variants: colors('STANDBAG', ['Black', 'Grey']),
  },
  {
    name: 'Tour Staff Bag',
    slug: 'taylormade-tour-staff-bag',
    brand: 'TaylorMade',
    description:
      'The same bag tour pros carry — full-size, fully-loaded, and built for a lifetime.',
    categorySlug: 'bags',
    basePriceMinor: 44999,
    tags: ['staff', 'tour', 'premium'],
    imageQuery: 'golf tour staff bag',
    isFeatured: true,
    variants: colors('STAFFBAG', ['Black', 'White']),
  },
  {
    name: 'Carry Stand Bag',
    slug: 'callaway-carry-stand-bag',
    brand: 'Callaway',
    description:
      'A dual-strap carry bag with an integrated stand for quick setup on any lie.',
    categorySlug: 'bags',
    basePriceMinor: 18999,
    tags: ['carry', 'stand', 'lightweight'],
    imageQuery: 'golf bag stand legs',
    variants: colors('CALL-CARRY', ['Black', 'Red']),
  },
  {
    name: 'Hoofer Lite Stand Bag',
    slug: 'ping-hoofer-lite-stand-bag',
    brand: 'PING',
    description:
      "PING's lightest stand bag, built for walking without giving up storage.",
    categorySlug: 'bags',
    basePriceMinor: 21999,
    tags: ['stand', 'lightweight', 'walking'],
    imageQuery: 'golf bag walking course',
    variants: colors('HOOFER-LITE', ['Black', 'Navy']),
  },
  {
    name: 'All Elements Cart Bag',
    slug: 'ogio-all-elements-cart-bag',
    brand: 'Ogio',
    description:
      'A weatherproof cart bag with a rainhood and a dedicated cooler pocket.',
    categorySlug: 'bags',
    basePriceMinor: 19999,
    tags: ['cart', 'weatherproof'],
    imageQuery: 'golf cart bag pockets',
    variants: colors('OGIO-CART', ['Black', 'Camo']),
  },
  {
    name: 'Travel Cover',
    slug: 'club-glove-travel-cover',
    brand: 'Club Glove',
    description:
      'A padded, wheeled travel cover built to protect clubs through airline handling.',
    categorySlug: 'bags',
    basePriceMinor: 32999,
    tags: ['travel', 'wheeled', 'protection'],
    imageQuery: 'golf travel bag airport',
    variants: single('TRAVEL-COVER'),
  },
  {
    name: 'Range Bag',
    slug: 'titleist-range-bag',
    brand: 'Titleist',
    description:
      'A compact duffel-style bag sized for shoes, balls, and range essentials.',
    categorySlug: 'bags',
    basePriceMinor: 8999,
    tags: ['range', 'duffel'],
    imageQuery: 'golf range bag duffel',
    variants: single('RANGE-BAG'),
  },

  // Rangefinders & GPS
  {
    name: 'Tour V6 Shift Laser Rangefinder',
    slug: 'bushnell-tour-v6-shift-laser-rangefinder',
    brand: 'Bushnell',
    description:
      'Pinpoint accuracy to the yard with slope-adjusted and regulation modes in one device.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 29999,
    tags: ['laser', 'slope', 'tour'],
    imageQuery: 'golf rangefinder laser device',
    isFeatured: true,
    variants: single('BUSH-V6'),
  },
  {
    name: 'Approach S70 GPS Watch',
    slug: 'garmin-approach-s70-gps-watch',
    brand: 'Garmin',
    description:
      'Full-color course maps and green views on the wrist, with over 43,000 courses preloaded.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 59999,
    tags: ['gps', 'watch', 'course-maps'],
    imageQuery: 'golf gps watch wrist',
    isFeatured: true,
    variants: colors('GARMIN-S70', ['Black', 'White']),
  },
  {
    name: 'SX550 GPS Rangefinder',
    slug: 'skycaddie-sx550-gps-rangefinder',
    brand: 'SkyCaddie',
    description:
      'A dedicated handheld GPS with a high-resolution color touchscreen.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 34999,
    tags: ['gps', 'handheld', 'touchscreen'],
    imageQuery: 'golf gps handheld device',
    variants: single('SKYC-SX550'),
  },
  {
    name: 'Coolshot Pro Stabilized Laser Rangefinder',
    slug: 'nikon-coolshot-pro-stabilized-laser-rangefinder',
    brand: 'Nikon',
    description:
      'Image stabilization keeps the display steady for a precise read, even at max zoom.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 31999,
    tags: ['laser', 'stabilized'],
    imageQuery: 'golf laser rangefinder hand',
    variants: single('NIKON-COOLSHOT'),
  },
  {
    name: 'Phantom 2 GPS Handheld',
    slug: 'bushnell-phantom-2-gps-handheld',
    brand: 'Bushnell',
    description:
      'A slim, pocket-sized GPS with a full-color display and 38,000+ preloaded courses.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 17999,
    tags: ['gps', 'handheld', 'compact'],
    imageQuery: 'golf gps device pocket',
    variants: colors('PHANTOM2', ['Black', 'Blue']),
  },
  {
    name: 'NX9 Slope Rangefinder',
    slug: 'precision-pro-nx9-slope-rangefinder',
    brand: 'Precision Pro',
    description:
      'Tour-accurate readings to 0.1 yards with pulse vibration confirming target lock.',
    categorySlug: 'rangefinders-gps',
    basePriceMinor: 24999,
    tags: ['laser', 'slope', 'vibration'],
    imageQuery: 'golf rangefinder green flag',
    variants: single('PP-NX9'),
  },

  // Apparel
  {
    name: 'Performance Polo Shirt',
    slug: 'performance-polo-shirt',
    brand: 'Greg Norman',
    description:
      'Moisture-wicking stretch fabric that moves through the swing without restriction.',
    categorySlug: 'apparel',
    basePriceMinor: 6999,
    tags: ['polo', 'performance', 'stretch'],
    imageQuery: 'golf polo shirt course',
    isFeatured: true,
    variants: colorAndSize(
      'POLO',
      ['White', 'Navy', 'Sage'],
      ['S', 'M', 'L', 'XL'],
    ),
  },
  {
    name: 'Storm Quarter-Zip Pullover',
    slug: 'under-armour-storm-quarter-zip-pullover',
    brand: 'Under Armour',
    description:
      'Water-resistant Storm technology keeps the elements out without adding bulk.',
    categorySlug: 'apparel',
    basePriceMinor: 8999,
    tags: ['pullover', 'water-resistant'],
    imageQuery: 'golf pullover jacket course',
    variants: colorAndSize('QTRZIP', ['Black', 'Grey'], ['S', 'M', 'L', 'XL']),
  },
  {
    name: 'Flex Golf Shorts',
    slug: 'nike-flex-golf-shorts',
    brand: 'Nike Golf',
    description:
      'Four-way stretch fabric built for a full range of motion through the swing.',
    categorySlug: 'apparel',
    basePriceMinor: 5999,
    tags: ['shorts', 'stretch'],
    imageQuery: 'golf shorts course walking',
    variants: colorAndSize(
      'SHORTS',
      ['Khaki', 'Navy', 'Black'],
      ['30', '32', '34', '36'],
    ),
  },
  {
    name: 'HydroLite Rain Jacket',
    slug: 'footjoy-hydrolite-rain-jacket',
    brand: 'FootJoy',
    description:
      'A fully waterproof, packable jacket that fits in a back pocket for surprise weather.',
    categorySlug: 'apparel',
    basePriceMinor: 12999,
    tags: ['rain', 'waterproof', 'packable'],
    imageQuery: 'golf rain jacket weather',
    variants: colorAndSize('RAINJKT', ['Black', 'Navy'], ['S', 'M', 'L', 'XL']),
  },
  {
    name: 'Sensor Cool Golf Trousers',
    slug: 'ping-sensor-cool-golf-trousers',
    brand: 'PING',
    description:
      'Lightweight, breathable trousers engineered to stay cool through a full round.',
    categorySlug: 'apparel',
    basePriceMinor: 8499,
    tags: ['trousers', 'breathable'],
    imageQuery: 'golf trousers walking fairway',
    variants: colorAndSize(
      'TROUSERS',
      ['Grey', 'Navy'],
      ['30', '32', '34', '36'],
    ),
  },
  {
    name: 'Windbreaker Vest',
    slug: 'taylormade-windbreaker-vest',
    brand: 'TaylorMade',
    description:
      'A lightweight, packable vest that blocks wind without limiting your swing.',
    categorySlug: 'apparel',
    basePriceMinor: 6499,
    tags: ['vest', 'windbreaker'],
    imageQuery: 'golf vest windy course',
    variants: colorAndSize('VEST', ['Black', 'Navy'], ['S', 'M', 'L', 'XL']),
  },
  {
    name: 'Players Sun Hat',
    slug: 'titleist-players-sun-hat',
    brand: 'Titleist',
    description: 'Wide-brim UPF protection for long days on the course.',
    categorySlug: 'apparel',
    basePriceMinor: 3499,
    tags: ['hat', 'sun-protection'],
    imageQuery: 'golf sun hat course',
    variants: sizes('SUNHAT', ['S/M', 'L/XL']),
  },
  {
    name: 'Tour Cap',
    slug: 'taylormade-tour-cap',
    brand: 'TaylorMade',
    description:
      'An adjustable, structured cap worn by tour players week in and week out.',
    categorySlug: 'apparel',
    basePriceMinor: 2999,
    tags: ['cap', 'adjustable'],
    imageQuery: 'golf cap hat course',
    variants: colors('TOURCAP', ['White', 'Black', 'Navy']),
  },
  {
    name: 'ColdGear Base Layer',
    slug: 'under-armour-coldgear-base-layer',
    brand: 'Under Armour',
    description: 'A snug, warm base layer for cold-morning tee times.',
    categorySlug: 'apparel',
    basePriceMinor: 4999,
    tags: ['thermal', 'base-layer'],
    imageQuery: 'golf thermal shirt cold',
    variants: sizes('COLDGEAR-BASE', ['S', 'M', 'L', 'XL']),
  },
  {
    name: 'Ultimate365 Golf Skort',
    slug: 'adidas-ultimate365-golf-skort',
    brand: 'Adidas',
    description:
      'Four-way stretch with a built-in liner, designed for full mobility on the course.',
    categorySlug: 'apparel',
    basePriceMinor: 6499,
    tags: ['skort', 'stretch'],
    imageQuery: 'golf skirt womens course',
    variants: sizes('SKORT', ['XS', 'S', 'M', 'L']),
  },

  // Training Aids
  {
    name: 'Golf Alignment Sticks',
    slug: 'sklz-golf-alignment-sticks',
    brand: 'SKLZ',
    description:
      'A pair of collapsible sticks for setup, swing-path, and putting alignment drills.',
    categorySlug: 'training-aids',
    basePriceMinor: 1999,
    tags: ['alignment', 'practice'],
    imageQuery: 'golf alignment sticks range',
    variants: single('ALIGN-STICKS'),
  },
  {
    name: 'Gold Flex Swing Trainer',
    slug: 'sklz-gold-flex-swing-trainer',
    brand: 'SKLZ',
    description:
      'A weighted, flexible shaft that builds tempo, timing, and swing-plane awareness.',
    categorySlug: 'training-aids',
    basePriceMinor: 4499,
    tags: ['swing', 'tempo'],
    imageQuery: 'golf swing trainer practice',
    variants: single('GOLDFLEX'),
  },
  {
    name: 'Pressure Putt Trainer Mat',
    slug: 'puttout-pressure-putt-trainer-mat',
    brand: 'PuttOut',
    description:
      'A precision putting mat with a return ramp that rejects off-center strikes.',
    categorySlug: 'training-aids',
    basePriceMinor: 3999,
    tags: ['putting', 'mat'],
    imageQuery: 'golf putting mat indoor',
    variants: single('PUTTOUT-MAT'),
  },
  {
    name: 'Impact Bag',
    slug: 'sklz-impact-bag',
    brand: 'SKLZ',
    description:
      'A weighted bag that trains proper hand and body position at impact.',
    categorySlug: 'training-aids',
    basePriceMinor: 2999,
    tags: ['impact', 'swing'],
    imageQuery: 'golf swing practice bag',
    variants: single('IMPACT-BAG'),
  },
  {
    name: 'Tempo Trainer',
    slug: 'orange-whip-tempo-trainer',
    brand: 'Orange Whip',
    description:
      'A weighted, flexible training club that grooves tempo, balance, and rhythm in one swing.',
    categorySlug: 'training-aids',
    basePriceMinor: 12999,
    tags: ['tempo', 'balance'],
    imageQuery: 'golf training club swing',
    variants: single('ORANGE-WHIP'),
  },
  {
    name: 'Practice Chipping Net',
    slug: 'sklz-practice-chipping-net',
    brand: 'SKLZ',
    description:
      'A collapsible target net with a built-in ball return for at-home short-game reps.',
    categorySlug: 'training-aids',
    basePriceMinor: 3499,
    tags: ['chipping', 'net'],
    imageQuery: 'golf chipping net backyard',
    variants: single('CHIP-NET'),
  },

  // Accessories
  {
    name: 'Divot Repair Tool',
    slug: '3legant-divot-repair-tool',
    brand: '3legant Golf',
    description:
      'A durable, pocket-sized tool for fixing ball marks and keeping greens in shape.',
    categorySlug: 'accessories',
    basePriceMinor: 1299,
    tags: ['divot', 'tool'],
    imageQuery: 'golf divot tool green',
    variants: colors('DIVOT-TOOL', ['Black', 'Silver', 'Green']),
  },
  {
    name: 'Ball Marker Set',
    slug: 'titleist-ball-marker-set',
    brand: 'Titleist',
    description:
      'A set of magnetic ball markers that snap onto a matching hat clip.',
    categorySlug: 'accessories',
    basePriceMinor: 1799,
    tags: ['ball-marker', 'set'],
    imageQuery: 'golf ball marker coin',
    variants: single('MARKER-SET'),
  },
  {
    name: 'Tour Storm Golf Umbrella',
    slug: 'taylormade-tour-storm-golf-umbrella',
    brand: 'TaylorMade',
    description:
      'A double-canopy, 68-inch umbrella built to hold up in genuine course weather.',
    categorySlug: 'accessories',
    basePriceMinor: 4499,
    tags: ['umbrella', 'weather'],
    imageQuery: 'golf umbrella rain course',
    variants: colors('UMBRELLA', ['Black', 'Navy']),
  },
  {
    name: 'Scorecard Holder',
    slug: '3legant-scorecard-holder',
    brand: '3legant Golf',
    description:
      'A leather scorecard and pencil holder that clips onto any bag or cart.',
    categorySlug: 'accessories',
    basePriceMinor: 1999,
    tags: ['scorecard', 'leather'],
    imageQuery: 'golf scorecard holder leather',
    variants: single('SCORECARD-HOLDER'),
  },
  {
    name: 'GPS Watch Charging Cable',
    slug: 'garmin-gps-watch-charging-cable',
    brand: 'Garmin',
    description:
      'A replacement charging cable compatible with Garmin Approach GPS watches.',
    categorySlug: 'accessories',
    basePriceMinor: 1499,
    tags: ['charger', 'gps'],
    imageQuery: 'watch charging cable device',
    variants: single('GARMIN-CABLE'),
  },
  {
    name: 'Club Cleaning Brush',
    slug: '3legant-club-cleaning-brush',
    brand: '3legant Golf',
    description:
      'A dual-sided brush with a groove pick for keeping clubface grooves spin-ready.',
    categorySlug: 'accessories',
    basePriceMinor: 999,
    tags: ['cleaning', 'brush'],
    imageQuery: 'golf club cleaning brush',
    variants: single('CLEAN-BRUSH'),
  },
  {
    name: 'Telescopic Ball Retriever',
    slug: '3legant-telescopic-ball-retriever',
    brand: '3legant Golf',
    description:
      'An 6-to-15-foot telescoping retriever for pond and rough recoveries.',
    categorySlug: 'accessories',
    basePriceMinor: 2499,
    tags: ['retriever', 'telescopic'],
    imageQuery: 'golf ball retriever pond',
    variants: single('BALL-RETRIEVER'),
  },
  {
    name: 'Course Yardage Book',
    slug: '3legant-course-yardage-book',
    brand: '3legant Golf',
    description:
      'A blank, weatherproof yardage book template for charting any course by hand.',
    categorySlug: 'accessories',
    basePriceMinor: 1699,
    tags: ['yardage', 'book'],
    imageQuery: 'golf yardage book notes',
    variants: single('YARDAGE-BOOK'),
  },
  {
    name: '12-in-1 Golf Multi-Tool',
    slug: '3legant-12-in-1-golf-multi-tool',
    brand: '3legant Golf',
    description:
      'A divot tool, groove cleaner, club wrench, and ball marker in one compact piece.',
    categorySlug: 'accessories',
    basePriceMinor: 2199,
    tags: ['multi-tool', 'compact'],
    imageQuery: 'golf multi tool metal',
    variants: single('MULTI-TOOL'),
  },
  {
    name: 'UA Cooling Towel',
    slug: 'under-armour-cooling-towel',
    brand: 'Under Armour',
    description:
      'A wet-activated towel that cools instantly for hot-weather rounds.',
    categorySlug: 'accessories',
    basePriceMinor: 1499,
    tags: ['cooling', 'towel'],
    imageQuery: 'cooling towel sports hot',
    variants: colors('COOL-TOWEL', ['Black', 'Blue']),
  },
];
