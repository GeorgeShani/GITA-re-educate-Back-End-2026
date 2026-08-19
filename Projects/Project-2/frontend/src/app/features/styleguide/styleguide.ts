import { Component, TemplateRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Dialog } from '@angular/cdk/dialog';
import { map } from 'rxjs';

import { CartService } from '@/app/core/services/cart.service';
import { ProductService } from '@/app/core/services/product.service';
import { ToastService } from '@/app/core/services/toast.service';
import { WishlistService } from '@/app/core/services/wishlist.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { AccordionGroup } from '@/app/shared/ui/accordion-group';
import { AccordionPanel } from '@/app/shared/ui/accordion-panel';
import { ActionButton } from '@/app/shared/ui/action-button';
import { BreadcrumbTrail, type BreadcrumbItem } from '@/app/shared/ui/breadcrumb-trail';
import { CarouselDots } from '@/app/shared/ui/carousel-dots';
import { CarouselTrack } from '@/app/shared/ui/carousel-track';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { DrawerPanel } from '@/app/shared/ui/drawer-panel';
import { IconButton } from '@/app/shared/ui/icon-button';
import { IconGlyph, type IconName } from '@/app/shared/ui/icon-glyph';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { ModalDialog } from '@/app/shared/ui/modal-dialog';
import { NavLink } from '@/app/shared/ui/nav-link';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { PriceTag } from '@/app/shared/ui/price-tag';
import { ProductCard, type ProductCardProduct, toProductCardProduct } from '@/app/shared/ui/product-card';
import { QuantityStepper } from '@/app/shared/ui/quantity-stepper';
import { RadioField } from '@/app/shared/ui/radio-field';
import { RatingStars } from '@/app/shared/ui/rating-stars';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { SwatchPicker, type SwatchOption } from '@/app/shared/ui/swatch-picker';
import { TabGroup, type TabItem } from '@/app/shared/ui/tab-group';
import { TextField } from '@/app/shared/ui/text-field';
import { TextareaField } from '@/app/shared/ui/textarea-field';
import { TooltipHint } from '@/app/shared/ui/tooltip-hint';

/**
 * Dev-only component workshop. Guarded by devOnlyGuard so it never ships
 * in production (see app.routes.ts).
 *
 * Each Phase F1 primitive adds its own <section> here — every variant and
 * state, rendered through the real app shell so what's shown here is
 * exactly what ships. The Motion section is the exception: it proves the
 * [reveal] directive itself (plain viewport reveal + stagger), ahead of
 * any component that will actually consume it.
 */
@Component({
  selector: 'styleguide-page',
  imports: [
    RevealDirective,
    AccordionGroup,
    AccordionPanel,
    ActionButton,
    BreadcrumbTrail,
    CarouselDots,
    CarouselTrack,
    CheckboxField,
    DrawerPanel,
    IconButton,
    IconGlyph,
    ImagePlaceholder,
    ModalDialog,
    NavLink,
    PageContainer,
    PageSection,
    PaginationNav,
    PriceTag,
    ProductCard,
    QuantityStepper,
    RadioField,
    RatingStars,
    SelectField,
    SkeletonBlock,
    StatusBadge,
    SwatchPicker,
    TabGroup,
    TextField,
    TextareaField,
    TooltipHint,
  ],
  template: `
    <div class="styleguide">
      <h1>Style Guide</h1>
      <p>Dev-only. Components land here section by section as Phase F1 builds them.</p>

      <section class="demo-section">
        <h2>Icons</h2>
        <p>Placeholder set — hand-authored geometric shapes pending real Figma icon exports.</p>
        <div class="icon-gallery">
          @for (icon of iconNames; track icon) {
            <div class="icon-gallery__item">
              <icon-glyph [name]="icon" />
              <span>{{ icon }}</span>
            </div>
          }
        </div>
      </section>

      <section class="demo-section">
        <h2>Status Badge</h2>
        <div class="demo-row">
          <status-badge variant="sale">Sale</status-badge>
          <status-badge variant="new">New</status-badge>
          <status-badge variant="custom" background="#141718" color="#fefefe">Limited</status-badge>
        </div>
      </section>

      <section class="demo-section">
        <h2>Rating Stars</h2>
        <div class="demo-column">
          <rating-stars [value]="3.5" [count]="24" />
          <rating-stars [value]="5" />
          <rating-stars [value]="0" />
          <rating-stars [interactive]="true" [value]="interactiveRating()" (valueChange)="interactiveRating.set($event)" />
          <p class="demo-hint">Interactive value: {{ interactiveRating() }}</p>
        </div>
      </section>

      <section class="demo-section">
        <h2>Price Tag</h2>
        <div class="demo-row">
          <price-tag [price]="129" />
          <price-tag [price]="99" [originalPrice]="129" />
        </div>
      </section>

      <section class="demo-section">
        <h2>Image Placeholder</h2>
        <div class="demo-row">
          <image-placeholder
            class="image-demo"
            src="/demo/placeholder-product.svg"
            alt="Placeholder golf accessory"
            [width]="200"
            [height]="200"
          />
          <image-placeholder class="image-demo" alt="Empty placeholder, no image yet" [width]="200" [height]="200" />
        </div>
      </section>

      <section class="demo-section">
        <h2>Skeleton Block</h2>
        <div class="demo-column">
          <skeleton-block width="240px" height="16px" />
          <skeleton-block width="180px" height="16px" />
          <skeleton-block width="200px" height="200px" radius="var(--radius-md)" />
        </div>
      </section>

      <section class="demo-section">
        <h2>Action Button</h2>
        <div class="demo-row">
          <action-button variant="primary">Add to Cart</action-button>
          <action-button variant="secondary">Secondary</action-button>
          <action-button variant="ghost">Ghost</action-button>
          <action-button variant="link">Link style</action-button>
        </div>
        <div class="demo-row">
          <action-button size="m">Size M</action-button>
          <action-button size="s">Size S</action-button>
          <action-button size="xs">Size XS</action-button>
        </div>
        <div class="demo-row">
          <action-button [loading]="true">Loading</action-button>
          <action-button [disabled]="true">Disabled</action-button>
          <action-button href="https://example.com">As a link</action-button>
        </div>
        <div class="demo-row">
          <action-button [fullWidth]="true">Full width</action-button>
        </div>
      </section>

      <section class="demo-section">
        <h2>Icon Button</h2>
        <div class="demo-row">
          <icon-button icon="search" ariaLabel="Search" />
          <icon-button
            icon="heart"
            ariaLabel="Add to wishlist"
            [pressed]="wishlisted()"
            (clicked)="wishlisted.set(!wishlisted())"
          />
          <icon-button icon="user" ariaLabel="Account" [disabled]="true" />
        </div>
      </section>

      <section class="demo-section">
        <h2>Text Field</h2>
        <div class="demo-column">
          <text-field label="Email" placeholder="you@example.com" hint="We'll never share it." />
          <text-field label="Password" type="password" error="Password is too short" />
          <text-field label="Search" [height]="48">
            <span prefix><icon-glyph name="search" [size]="16" /></span>
          </text-field>
          <text-field label="Disabled" [disabled]="true" value="Can't touch this" />
        </div>
      </section>

      <section class="demo-section">
        <h2>Textarea Field</h2>
        <textarea-field label="Order notes" placeholder="Anything we should know?" hint="Optional" />
      </section>

      <section class="demo-section">
        <h2>Checkbox &amp; Radio</h2>
        <div class="demo-column">
          <checkbox-field
            label="Subscribe to newsletter"
            [checked]="subscribed()"
            (checkedChange)="subscribed.set($event)"
          />
          <checkbox-field label="Disabled" [disabled]="true" />
          <div class="demo-row" role="radiogroup" aria-label="Shipping method">
            @for (option of shippingOptions; track option) {
              <radio-field
                name="shipping"
                [value]="option"
                [label]="option"
                [checked]="shipping() === option"
                (selected)="shipping.set($event)"
              />
            }
          </div>
        </div>
      </section>

      <section class="demo-section">
        <h2>Quantity Stepper</h2>
        <div class="demo-row">
          <quantity-stepper [value]="quantity()" [min]="1" [max]="5" (valueChange)="quantity.set($event)" />
          <p class="demo-hint">Value: {{ quantity() }} (bounded 1–5)</p>
        </div>
      </section>

      <section class="demo-section">
        <h2>Swatch Picker</h2>
        <swatch-picker
          [options]="swatchOptions"
          [value]="swatchValue()"
          (valueChange)="swatchValue.set($event)"
        />
      </section>

      <section class="demo-section">
        <h2>Modal Dialog</h2>
        <action-button (click)="openDemoDialog()">Open Modal</action-button>
      </section>

      <ng-template #demoDialogTemplate>
        <modal-dialog title="Subscribe">
          <p>Get 10% off your first order.</p>
          <div footer class="demo-dialog-footer">
            <action-button variant="ghost" size="s">Not now</action-button>
            <action-button size="s">Subscribe</action-button>
          </div>
        </modal-dialog>
      </ng-template>

      <section class="demo-section">
        <h2>Accordion</h2>
        <accordion-group>
          <accordion-panel label="Shipping &amp; Returns">
            <p>Free shipping on orders over $75. Returns accepted within 30 days.</p>
          </accordion-panel>
          <accordion-panel label="Size Guide">
            <p>See our size chart for club grips and glove sizing.</p>
          </accordion-panel>
          <accordion-panel label="Warranty">
            <p>All clubs carry a 1-year manufacturer warranty.</p>
          </accordion-panel>
        </accordion-group>
      </section>

      <section class="demo-section">
        <h2>Tab Group</h2>
        <tab-group
          [tabs]="pdpTabs"
          [selected]="activeTab()"
          (selectedChange)="activeTab.set($event)"
          ariaLabel="Product details"
        />
        <div class="demo-tab-panel">
          @switch (activeTab()) {
            @case ('description') {
              <p>Premium leather golf glove with reinforced palm.</p>
            }
            @case ('reviews') {
              <p>4.6 average from 128 reviews.</p>
            }
            @case ('shipping') {
              <p>Ships within 2 business days.</p>
            }
          }
        </div>
      </section>

      <section class="demo-section">
        <h2>Drawer Panel</h2>
        <action-button (click)="cartOpen.set(true)">Open Cart Drawer</action-button>
        <drawer-panel [open]="cartOpen()" (openChange)="cartOpen.set($event)">
          <h2>Your Cart</h2>
          <p>3 items</p>
        </drawer-panel>
      </section>

      <section class="demo-section">
        <h2>Select Field</h2>
        <select-field
          label="Club type"
          placeholder="Choose a club"
          [options]="clubOptions"
          [value]="selectedClub()"
          (valueChange)="selectedClub.set($event)"
        />
        <p class="demo-hint">Selected: {{ selectedClub() ?? 'none' }}</p>
      </section>

      <section class="demo-section">
        <h2>Tooltip Hint</h2>
        <div class="demo-row">
          <icon-button icon="heart" ariaLabel="Add to wishlist" tooltipHint="Add to wishlist" />
          <action-button tooltipHint="Adds the current build to your cart" tooltipPosition="bottom">
            Add to Cart
          </action-button>
        </div>
      </section>

      <section class="demo-section">
        <h2>Toast Stack</h2>
        <p>Toasts render at the app root (top-right), not inline here.</p>
        <div class="demo-row">
          <action-button variant="secondary" size="s" (click)="toastService.show('Added to cart', 'success')">
            Success toast
          </action-button>
          <action-button variant="secondary" size="s" (click)="toastService.show('Something went wrong', 'error')">
            Error toast
          </action-button>
          <action-button variant="secondary" size="s" (click)="toastService.show('Heads up')">
            Info toast
          </action-button>
        </div>
      </section>

      <section class="demo-section">
        <h2>Nav Link</h2>
        <div class="demo-row">
          <nav-link href="#">Home</nav-link>
          <nav-link href="#" [chevron]="true">Shop</nav-link>
          <nav-link href="#">Contact Us</nav-link>
        </div>
      </section>

      <section class="demo-section">
        <h2>Breadcrumb Trail</h2>
        <breadcrumb-trail [items]="breadcrumbItems" />
      </section>

      <section class="demo-section">
        <h2>Pagination Nav</h2>
        <pagination-nav [page]="currentPage()" [total]="12" (pageChange)="currentPage.set($event)" />
      </section>

      <section class="demo-section">
        <h2>Carousel Track + Dots</h2>
        <carousel-track #track (activeChange)="carouselActive.set($event)">
          @for (n of carouselItems; track n) {
            <div class="carousel-demo-item">{{ n }}</div>
          }
        </carousel-track>
        <carousel-dots
          class="carousel-demo-dots"
          [count]="carouselItems.length"
          [active]="carouselActive()"
          (activeChange)="scrollCarousel($event)"
        />
      </section>

      <section class="demo-section">
        <h2>Product Card</h2>
        <p>
          Backed by the real ProductService (MockProductService fixtures) and the real
          WishlistService/CartService — the heart toggle and Quick Add here are genuine app
          state, not local demo signals. Quick Add writes to the real CartService cart.
        </p>
        <div class="product-card-demo-grid">
          @for (product of demoProducts(); track product.slug) {
            <product-card
              [product]="product"
              [wishlisted]="wishlistService.has(product.slug)"
              (wishlistToggled)="wishlistService.toggle(product.slug)"
              (quickAdd)="addToCart(product)"
            />
          }
        </div>
      </section>

      <section class="demo-section">
        <h2>Page Container &amp; Section</h2>
        <div class="page-demo-frame">
          <page-container class="page-demo-container">
            <page-section spacing="sm">1120px max-width, responsive page padding.</page-section>
          </page-container>
        </div>
      </section>

      <section class="motion-demo">
        <h2>Motion — reveal directive</h2>
        <p>
          Scroll down. The single box reveals on its own; the grid below staggers in tile by
          tile.
        </p>

        <div class="motion-demo__spacer" aria-hidden="true"></div>

        <div class="motion-demo__single" reveal>Reveals alone on scroll</div>

        <div class="motion-demo__grid">
          @for (tile of revealDemoTiles; track tile; let i = $index) {
            <div class="motion-demo__tile" reveal [revealIndex]="i" [revealStagger]="60">
              {{ tile }}
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    // The app shell (app.ts) now provides the page's real <main> landmark
    // — this is a plain wrapper, not a second one.
    .styleguide {
      max-width: var(--container-max);
      margin-inline: auto;
      padding: var(--space-8) var(--page-padding);
    }

    h1 {
      @include type.headline-4;
      margin-bottom: var(--space-3);
    }

    p {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .demo-section {
      margin-top: var(--space-10);
    }

    .demo-section h2 {
      @include type.headline-5;
      margin-bottom: var(--space-2);
    }

    .demo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }

    .demo-column {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }

    .demo-hint {
      @include type.caption-1;
    }

    .icon-gallery {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin-top: var(--space-4);
    }

    .icon-gallery__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-neutral-06);
    }

    .icon-gallery__item span {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .image-demo {
      width: 200px;
    }

    .demo-tab-panel {
      padding-top: var(--space-4);
    }

    .demo-dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      margin-top: var(--space-6);
    }

    .carousel-demo-item {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 160px;
      block-size: 100px;
      background: var(--color-neutral-02);
      border-radius: var(--radius-md);
      color: var(--color-neutral-05);
      scroll-snap-align: start;
      @include type.body-2;
    }

    .carousel-demo-dots {
      display: flex;
      justify-content: center;
      margin-top: var(--space-4);
    }

    .product-card-demo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-6);
      margin-top: var(--space-4);
    }

    .page-demo-frame {
      margin-top: var(--space-4);
      background: var(--color-neutral-02);
    }

    .page-demo-container {
      background: var(--color-white);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .motion-demo {
      margin-top: var(--space-10);
    }

    .motion-demo h2 {
      @include type.headline-5;
      margin-bottom: var(--space-2);
    }

    .motion-demo__spacer {
      block-size: 60vh;
    }

    .motion-demo__single,
    .motion-demo__tile {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-neutral-02);
      border-radius: var(--radius-md);
      color: var(--color-neutral-05);
      @include type.body-2;
    }

    .motion-demo__single {
      block-size: 96px;
      margin-block-end: var(--space-6);
    }

    .motion-demo__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: var(--space-4);
      margin-block-end: var(--space-10);
    }

    .motion-demo__tile {
      block-size: 100px;
    }
  `,
})
export class Styleguide {
  protected readonly revealDemoTiles = [1, 2, 3, 4, 5, 6];
  protected readonly iconNames: IconName[] = [
    'star',
    'chevron-down',
    'chevron-right',
    'close',
    'search',
    'heart',
    'cart',
    'user',
    'check',
    'plus',
    'minus',
  ];
  protected readonly interactiveRating = signal(0);

  protected readonly wishlisted = signal(false);
  protected readonly subscribed = signal(false);
  protected readonly shipping = signal('Standard');
  protected readonly shippingOptions = ['Standard', 'Express', 'Overnight'];
  protected readonly quantity = signal(1);
  protected readonly swatchValue = signal('black');
  protected readonly swatchOptions: SwatchOption[] = [
    { value: 'black', label: 'Black', color: '#141718' },
    { value: 'white', label: 'White', color: '#fefefe' },
    { value: 'green', label: 'Green', color: '#38cb89' },
  ];

  private readonly dialog = inject(Dialog);
  private readonly demoDialogTemplate = viewChild.required<TemplateRef<unknown>>('demoDialogTemplate');

  protected readonly pdpTabs: TabItem[] = [
    { id: 'description', label: 'Description' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'shipping', label: 'Shipping' },
  ];
  protected readonly activeTab = signal('description');

  protected readonly cartOpen = signal(false);

  protected readonly clubOptions: SelectOption[] = [
    { value: 'driver', label: 'Driver' },
    { value: 'iron', label: 'Iron Set' },
    { value: 'putter', label: 'Putter' },
    { value: 'wedge', label: 'Wedge' },
  ];
  protected readonly selectedClub = signal<string | undefined>(undefined);

  protected readonly toastService = inject(ToastService);

  protected openDemoDialog(): void {
    this.dialog.open(this.demoDialogTemplate(), { panelClass: 'modal-overlay-pane' });
  }

  protected readonly breadcrumbItems: BreadcrumbItem[] = [
    { label: 'Home', link: ['/'] },
    { label: 'Shop', link: ['/'] },
    { label: 'Gloves' },
  ];

  protected readonly currentPage = signal(4);

  protected readonly carouselItems = [1, 2, 3, 4, 5, 6];
  protected readonly carouselActive = signal(0);
  private readonly track = viewChild<CarouselTrack>('track');

  protected scrollCarousel(index: number): void {
    this.carouselActive.set(index);
    this.track()?.scrollTo(index);
  }

  protected readonly productService = inject(ProductService);
  protected readonly wishlistService = inject(WishlistService);
  private readonly cartService = inject(CartService);

  protected readonly demoProducts = toSignal(
    this.productService.list().pipe(map((products) => products.map(toProductCardProduct))),
    { initialValue: [] },
  );

  protected addToCart(product: ProductCardProduct): void {
    this.cartService.add({
      productId: product.slug,
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: 1,
    });
    this.toastService.show(`${product.name} added to cart`, 'success');
  }
}
