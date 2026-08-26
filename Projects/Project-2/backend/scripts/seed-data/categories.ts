// SCOPE.md A8's category list. `parentId` is always null here — the
// storefront backend plan doesn't call for subcategories, but
// CategoriesService.findTree()/findSelfAndDescendantIds() both handle
// a real tree if one gets added later.
export interface CategorySeed {
  name: string;
  slug: string;
  description: string;
  imageQuery: string;
}

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    name: 'Gloves',
    slug: 'gloves',
    description:
      'Leather and synthetic gloves for grip and feel in every condition.',
    imageQuery: 'golf glove close up',
  },
  {
    name: 'Golf Balls',
    slug: 'golf-balls',
    description: 'Tour-level and distance balls across every major brand.',
    imageQuery: 'golf balls on tee',
  },
  {
    name: 'Tees',
    slug: 'tees',
    description: 'Wood, bamboo, and low-friction tees in every length.',
    imageQuery: 'wooden golf tee grass',
  },
  {
    name: 'Headcovers',
    slug: 'headcovers',
    description: 'Driver, fairway wood, and putter covers.',
    imageQuery: 'golf club headcover',
  },
  {
    name: 'Towels',
    slug: 'towels',
    description: 'Microfiber and waffle-weave towels for the bag and the cart.',
    imageQuery: 'golf towel bag',
  },
  {
    name: 'Bags',
    slug: 'bags',
    description: 'Cart bags, stand bags, and tour staff bags.',
    imageQuery: 'golf bag course',
  },
  {
    name: 'Rangefinders & GPS',
    slug: 'rangefinders-gps',
    description: 'Laser rangefinders and GPS watches for precise yardages.',
    imageQuery: 'golf rangefinder laser',
  },
  {
    name: 'Apparel',
    slug: 'apparel',
    description: 'Polos, outerwear, and everything for the course.',
    imageQuery: 'golf apparel polo shirt',
  },
  {
    name: 'Training Aids',
    slug: 'training-aids',
    description: 'Alignment sticks, putting mats, and swing trainers.',
    imageQuery: 'golf training aid practice',
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description: 'Divot tools, ball markers, umbrellas, and everything else.',
    imageQuery: 'golf accessories divot tool',
  },
];
