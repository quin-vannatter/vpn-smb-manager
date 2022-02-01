import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, BehaviorSubject } from 'rxjs';


@Injectable({
  providedIn: 'root'
})
export abstract class BaseService {

  protected abstract getEndpoint(): string;
  static headers = new HttpHeaders();

  static tokenSubject: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    BaseService.headers.append("Content-Type", "application/json");
    var token = localStorage.getItem("token");
    if (token) {
      this.setAuthToken(token);
    }
  }

  protected setAuthToken(token: string) {
    localStorage.setItem("token", token);
    BaseService.headers = BaseService.headers.set("Authorization", token);
    BaseService.tokenSubject?.next(true);
  }

  protected isTokenSet() {
    return BaseService.tokenSubject?.asObservable();
  }

  protected clearAuthToken() {
    BaseService.tokenSubject?.next(false);
    localStorage.removeItem("token");
    BaseService.headers.delete("Authorization");
    this.router.navigate(['login']);
  }

  private getUrl(action?: string) {
    return `/api/${this.getEndpoint()}/${action || ""}`;
  }

  private getErrorCallback() {
    return (err: any) => {
      if(/^40\d{1}$/.test(err.status)) {
        this.clearAuthToken();
        this.router.navigate(['login']);
      }
      throw err;
    };
  }

  protected get<T>(action?: string) {
    return this.http.get<T>(this.getUrl(action), { headers: BaseService.headers }).pipe(catchError(this.getErrorCallback()));
  }

  protected post<T>(body?: object, action?: string) {
    return this.http.post<T>(this.getUrl(action), body, { headers: BaseService.headers }).pipe(catchError(this.getErrorCallback()));
  }

  protected put<T>(action?: string) {
    return this.http.put<T>(this.getUrl(action), undefined, { headers: BaseService.headers }).pipe(catchError(this.getErrorCallback()));
  }

  protected delete<T>(action?: string) {
    return this.http.delete<T>(this.getUrl(action), { headers: BaseService.headers }).pipe(catchError(this.getErrorCallback()));
  }
}
