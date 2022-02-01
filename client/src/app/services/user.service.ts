import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, map, Observable, tap } from 'rxjs';
import { User } from '../models/user.interface';
import { BaseService } from './base.service';

@Injectable({
  providedIn: 'root'
})
export class UserService extends BaseService {

  private currentUserSubject: BehaviorSubject<User | undefined> = new BehaviorSubject<User | undefined>(undefined);
  
  protected getEndpoint(): string {
    return "users";
  }

  constructor(http: HttpClient, router: Router) {
    super(http, router);
  }

  login(username: string, password: string): Observable<void> {
    return this.post<any>({
      username,
      password
    }, "login").pipe(tap((response: any) => {
      this.setAuthToken(response.id);
      this.currentUserSubject.next(undefined);
    }));
  }

  invite(): Observable<any> {
    return this.post(undefined, "invite").pipe(map((res: any) => `${location.origin}/login/${res.inviteCode}`))
  }

  logout(): void {
    this.clearAuthToken();
  }

  isLoggedIn(): Observable<boolean> {
    return this.isTokenSet();
  }

  getCurrentUser(): Observable<User | undefined> {
    if (!this.currentUserSubject.value) {
      this.get<User>("current").subscribe(user => {
        this.currentUserSubject.next(user);
      });
    }

    return this.currentUserSubject.asObservable();
  }

  getUsers(): Observable<User[]> {
    return this.get<User[]>();
  }

  createUser(inviteCode: string, username: string, password: string): Observable<any> {
    return this.post<any>({
      inviteCode,
      username,
      password
    });
  }

  deleteUser(username: string): Observable<any> {
    return this.delete(username);
  }
}
