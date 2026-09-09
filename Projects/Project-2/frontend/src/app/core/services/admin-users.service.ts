import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminUserQuery, Paginated, RoleDto, UserDto } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminUsersService {
  private readonly api = inject(ApiClient);

  list(query: AdminUserQuery): Observable<Paginated<UserDto>> {
    return this.api.get<Paginated<UserDto>>('/admin/users', toHttpParams({ ...query }));
  }

  getOne(id: string): Observable<UserDto> {
    return this.api.get<UserDto>(`/admin/users/${id}`);
  }

  updateRoles(id: string, roles: RoleDto[]): Observable<UserDto> {
    return this.api.patch<UserDto>(`/admin/users/${id}/roles`, { roles });
  }

  setBanned(id: string, banned: boolean): Observable<UserDto> {
    return this.api.post<UserDto>(`/admin/users/${id}/ban`, { banned });
  }
}
