import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AccountExportDto,
  AddressDto,
  AddressInput,
  NotificationPreferenceDto,
  UpdateProfileRequest,
  UserDto,
} from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

/**
 * Everything under /users/me — profile, address book, notification
 * preferences, and the two GDPR endpoints. Grouped into one service
 * because the backend groups them into one controller (UsersController);
 * AuthService stays scoped to session/token concerns (login, register,
 * refresh) rather than growing to cover this too.
 */
@Service()
export class AccountService {
  private readonly api = inject(ApiClient);

  updateProfile(input: UpdateProfileRequest): Observable<UserDto> {
    return this.api.patch<UserDto>('/users/me', input);
  }

  listAddresses(): Observable<AddressDto[]> {
    return this.api.get<AddressDto[]>('/users/me/addresses');
  }

  addAddress(input: AddressInput): Observable<AddressDto[]> {
    return this.api.post<AddressDto[]>('/users/me/addresses', input);
  }

  updateAddress(addressId: string, input: Partial<AddressInput>): Observable<AddressDto[]> {
    return this.api.patch<AddressDto[]>(`/users/me/addresses/${addressId}`, input);
  }

  removeAddress(addressId: string): Observable<AddressDto[]> {
    return this.api.delete<AddressDto[]>(`/users/me/addresses/${addressId}`);
  }

  getNotificationPreferences(): Observable<NotificationPreferenceDto> {
    return this.api.get<NotificationPreferenceDto>('/users/me/notification-preferences');
  }

  updateNotificationPreferences(marketingOptIn: boolean): Observable<NotificationPreferenceDto> {
    return this.api.patch<NotificationPreferenceDto>('/users/me/notification-preferences', {
      marketingOptIn,
    });
  }

  exportData(): Observable<AccountExportDto> {
    return this.api.get<AccountExportDto>('/users/me/export');
  }

  /** GDPR right to erasure — anonymizes the account. Orders/reviews stay as frozen historical records. */
  deleteAccount(): Observable<void> {
    return this.api.delete<void>('/users/me');
  }
}
