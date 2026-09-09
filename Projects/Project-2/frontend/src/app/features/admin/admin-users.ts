import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { RoleDto, UserDto } from '@/app/core/api/dto';
import { AdminUsersService } from '@/app/core/services/admin-users.service';
import { ToastService } from '@/app/core/services/toast.service';
import { toUnionValue } from '@/app/core/util/string-union';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 25;

// Every RoleDto value — 'customer' included, since demoting staff back to
// an ordinary shopper is a valid, reachable state from this screen.
const ROLE_VALUES = ['customer', 'editor', 'support', 'manager', 'admin'] as const satisfies readonly RoleDto[];

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'editor', label: 'Editor' },
  { value: 'support', label: 'Support' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

@Component({
  selector: 'admin-users-page',
  imports: [DataTable, DrawerForm, EmptyState, FilterBar, PageToolbar, SelectField, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Users & roles" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <text-field label="Search by email" placeholder="name@example.com" [value]="emailFilter()" (valueChange)="onEmailFilterChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (users().length === 0) {
      <empty-state message="No users match this search." icon="circle-user" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (u of users(); track u.id) {
            <tr>
              <td>{{ u.firstName }} {{ u.lastName }}</td>
              <td>{{ u.email }}</td>
              <td>{{ roleLabel(u.roles[0]) }}</td>
              <td>
                <status-badge variant="custom" [background]="u.isBanned ? 'var(--color-error)' : 'var(--color-success)'" color="var(--color-neutral-07)">
                  {{ u.isBanned ? 'Banned' : 'Active' }}
                </status-badge>
              </td>
              <td class="actions">
                <button type="button" (click)="startEditRoles(u)">Edit role</button>
                <button type="button" class="danger" (click)="toggleBanned(u)">{{ u.isBanned ? 'Unban' : 'Ban' }}</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      title="Edit role"
      [open]="roleFormOpen()"
      [saving]="saving()"
      saveLabel="Save"
      (openChange)="roleFormOpen.set($event)"
      (cancel)="roleFormOpen.set(false)"
      (save)="saveRole()"
    >
      @if (roleTarget(); as t) {
        <p class="context">{{ t.firstName }} {{ t.lastName }} — {{ t.email }}</p>
      }
      <select-field label="Role" [options]="roleOptions" [value]="roleValue()" (valueChange)="onRoleValueChange($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td.actions {
      display: flex;
      gap: var(--space-3);
      white-space: nowrap;
    }

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }

    td.actions .danger {
      color: var(--color-error);
    }

    .context {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-05);
    }
  `,
})
export default class AdminUsers implements OnInit {
  private readonly usersService = inject(AdminUsersService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly roleOptions = ROLE_OPTIONS;

  protected readonly users = signal<UserDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly emailFilter = signal('');
  protected readonly saving = signal(false);

  protected readonly roleFormOpen = signal(false);
  protected readonly roleTarget = signal<UserDto | null>(null);
  protected readonly roleValue = signal<RoleDto>('customer');

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  private emailFilterTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.load();
  }

  protected roleLabel(role: RoleDto | undefined): string {
    if (!role) return '—';
    return this.roleOptions.find((o) => o.value === role)?.label ?? role;
  }

  protected onEmailFilterChange(value: string): void {
    this.emailFilter.set(value);
    clearTimeout(this.emailFilterTimeout);
    this.emailFilterTimeout = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }

  private load(): void {
    this.loading.set(true);
    this.usersService.list({ email: this.emailFilter().trim() || undefined, page: this.page(), take: TAKE }).subscribe({
      next: (result) => {
        this.users.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected startEditRoles(user: UserDto): void {
    this.roleTarget.set(user);
    this.roleValue.set(user.roles[0] ?? 'customer');
    this.roleFormOpen.set(true);
  }

  /** `select-field` emits a bare `string`; narrowed against the same values `roleOptions` actually offers. */
  protected onRoleValueChange(value: string): void {
    this.roleValue.set(toUnionValue(value, ROLE_VALUES) ?? this.roleValue());
  }

  protected saveRole(): void {
    const target = this.roleTarget();
    if (!target) return;
    this.saving.set(true);
    this.usersService.updateRoles(target.id, [this.roleValue()]).subscribe({
      next: () => {
        this.saving.set(false);
        this.roleFormOpen.set(false);
        this.toast.show('Role updated', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected toggleBanned(user: UserDto): void {
    if (user.isBanned) {
      this.usersService.setBanned(user.id, false).subscribe(() => {
        this.toast.show('User unbanned', 'success');
        this.load();
      });
      return;
    }

    this.confirmService
      .confirm({
        title: 'Ban this user?',
        message: `${user.firstName} ${user.lastName} will be signed out everywhere and unable to sign back in.`,
        confirmLabel: 'Ban',
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.usersService.setBanned(user.id, true).subscribe(() => {
          this.toast.show('User banned', 'success');
          this.load();
        });
      });
  }
}
