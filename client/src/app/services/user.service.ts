import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
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

  constructor(http: HttpClient, router: Router, dialog: MatDialog) {
    super(http, router, dialog);
  }

  login(username: string, password: string): Observable<void> {
    return this.post<any>({
      username,
      password: btoa(password)
    }, "login").pipe(tap((response: any) => {
      this.setAuthToken(response.id);
      this.currentUserSubject.next(undefined);
    }));
  }

  invite(isGuest: boolean): Observable<any> {
    return this.post(undefined, isGuest ? "guest" : "invite").pipe(map((res: any) => `${location.origin}/login/${res.inviteCode}/${isGuest ? "guest" : "new-user"}`))
  }

  getScripts(): Observable<string[]> {
    return this.get("scripts");
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

  getSmb(): Observable<void> {
    return this.getDownloadFile("smb");
  }

  getUsers(): Observable<User[]> {
    return this.get<User[]>();
  }

  createUser(inviteCode: string, username: string, password: string): Observable<any> {
    return this.post({
      inviteCode,
      username,
      password: btoa(password)
    });
  }

  deleteUser(username: string): Observable<any> {
    return this.delete(username);
  }

  promoteUser(username: string): Observable<any> {
    return this.put("promote", {
      username
    });
  }
}
