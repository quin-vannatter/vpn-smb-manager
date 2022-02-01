import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BaseService } from './base.service';
import { Observable } from 'rxjs';
import { Certificate } from '../models/certificate.interface';

@Injectable({
  providedIn: 'root'
})
export class CertificateService extends BaseService {

  protected getEndpoint(): string {
      return "certificates";
  }

  constructor(http: HttpClient, router: Router) {
    super(http, router);
  }

  getCertificates(): Observable<Certificate[] | undefined> {
    return this.get<Certificate[] | undefined>();
  }
}
