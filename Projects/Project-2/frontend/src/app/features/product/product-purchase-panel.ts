import { Component, computed, inject, input, signal } from '@angular/core';

import type { ProductDto, ProductVariantDto } from '@/app/core/api/dto';
import { CartService } from '@/app/core/services/cart.service';
import { CatalogService } from '@/app/core/services/catalog.service';
import { ToastService } from '@/app/core/services/toast.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { ActionButton } from '@/app/shared/ui/action-button';
import { QuantityStepper } from '@/app/shared/ui/quantity-stepper';
import { RatingStars } from '@/app/shared/ui/rating-stars';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';

interface AttributeGroup {
  readonly key: string;
  readonly label: string;
  readonly options: SelectOption[];
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * The "buy box" — rating, name, description, price, variant pickers,
 * quantity, add-to-cart, live stock. One component because these all
 * derive from the same selected-variant state; splitting it further would
 * just move that state up to a parent with no real gain.
 */
@Component({
  selector: 'product-purchase-panel',
  imports: [RatingStars, MoneyPipe, SelectField, QuantityStepper, ActionButton],
  template: `
    <div class="meta">
      <rating-stars
        [value]="product().ratingAverage"
        [count]="product().ratingCount || undefined"
      />
    </div>

    <h1>{{ product().name }}</h1>
    <p class="description">{{ product().description }}</p>

    <div class="price">
      <span class="current">{{ activePriceMinor() | money }}</span>
      @if (activeCompareAtMinor(); as compareAt) {
        <span class="original">{{ compareAt | money }}</span>
      }
    </div>

    @if (attributeGroups().length) {
      <div class="variants">
        @for (group of attributeGroups(); track group.key) {
          <select-field
            [label]="group.label"
            [options]="group.options"
            [value]="selected()[group.key]"
            [placeholder]="'Choose ' + group.label.toLowerCase()"
            (valueChange)="pick(group.key, $event)"
          />
        }
      </div>
    }

    <div class="purchase-row">
      <quantity-stepper
        [value]="quantity()"
        [max]="stockCap()"
        (valueChange)="quantity.set($event)"
      />
      <action-button
        size="m"
        [fullWidth]="true"
        [disabled]="!selectedVariant()"
        [loading]="adding()"
        (click)="addToCart()"
      >
        {{ selectedVariant() ? 'Add to cart' : 'Select options' }}
      </action-button>
    </div>

    @if (selectedVariant(); as variant) {
      <p
        class="stock"
        [class.is-low]="stock.value()?.lowStock"
        [class.is-out]="stock.value()?.inStock === false"
      >
        @if (stock.isLoading()) {
          Checking stock...
        } @else if (stock.value(); as s) {
          @if (!s.inStock) {
            Out of stock
          } @else if (s.lowStock) {
            Only {{ s.quantityAvailable }} left
          } @else {
            In stock
          }
        }
      </p>
      <p class="sku">SKU: {{ variant.sku }}</p>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .meta {
      margin-bottom: var(--space-4);
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .description {
      @include type.body-2;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-05);
    }

    .price {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      margin-bottom: var(--space-6);

      .current {
        @include type.headline-6;
        color: var(--color-price);
      }

      .original {
        @include type.body-2;
        color: var(--color-neutral-04);
        text-decoration: line-through;
      }
    }

    .variants {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 22rem;
      margin-bottom: var(--space-6);
    }

    .purchase-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-4);

      action-button {
        flex: 1;
      }
    }

    .stock {
      @include type.caption-1-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-success);

      &.is-low {
        color: var(--color-warning-text);
      }

      &.is-out {
        color: var(--color-neutral-04);
      }
    }

    .sku {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }
  `,
})
export class ProductPurchasePanel {
  private readonly cart = inject(CartService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);

  readonly product = input.required<ProductDto>();

  protected readonly selected = signal<Record<string, string>>({});
  protected readonly quantity = signal(1);
  protected readonly adding = signal(false);

  protected readonly attributeGroups = computed<AttributeGroup[]>(() => {
    const variants = this.product().variants.filter((v) => v.isActive);
    const keys = [...new Set(variants.flatMap((v) => Object.keys(v.attributes)))];
    return keys.map((key) => {
      const values = [
        ...new Set(variants.map((v) => v.attributes[key]).filter((v): v is string => !!v)),
      ];
      return {
        key,
        label: titleCase(key),
        options: values.map((value) => ({ value, label: value })),
      };
    });
  });

  protected readonly selectedVariant = computed<ProductVariantDto | undefined>(() => {
    const groups = this.attributeGroups();
    const chosen = this.selected();
    if (groups.length && groups.some((g) => !chosen[g.key])) return undefined;
    return this.product().variants.find(
      (v) => v.isActive && groups.every((g) => v.attributes[g.key] === chosen[g.key]),
    );
  });

  protected readonly activePriceMinor = computed(
    () => this.selectedVariant()?.priceMinor ?? this.product().basePriceMinor,
  );

  protected readonly activeCompareAtMinor = computed(
    () => this.selectedVariant()?.compareAtPriceMinor ?? this.product().compareAtPriceMinor,
  );

  protected readonly stock = this.catalog.stockResource(() => {
    const variant = this.selectedVariant();
    const productId = this.product()?.id;
    return variant && productId ? { productId, variantSku: variant.sku } : undefined;
  });

  protected readonly stockCap = computed(() => {
    const available = this.stock.value()?.quantityAvailable;
    return available && available > 0 ? Math.min(available, 99) : 99;
  });

  protected pick(key: string, value: string): void {
    this.selected.update((current) => ({ ...current, [key]: value }));
    this.quantity.set(1);
  }

  protected addToCart(): void {
    const variant = this.selectedVariant();
    if (!variant || this.adding()) return;

    // No error handler here: error.interceptor already turns a failed
    // mutation into a toast (a 429 gets its own specific message there) —
    // adding a second one here would just double up.
    this.adding.set(true);
    this.cart.addItem(this.product().id, variant.sku, this.quantity()).subscribe({
      next: () => {
        this.adding.set(false);
        this.toast.show(`${this.product().name} added to cart`, 'success');
      },
      error: () => this.adding.set(false),
    });
  }
}
