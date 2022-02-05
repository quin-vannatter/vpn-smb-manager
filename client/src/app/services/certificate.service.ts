import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BaseService } from './base.service';
import { Observable } from 'rxjs';
import { Certificate } from '../models/certificate.interface';
import { MatDialog } from '@angular/material/dialog';

const FETCH_TIMEOUT = 5000;

@Injectable({
  providedIn: 'root'
})
export class CertificateService extends BaseService {

  protected getEndpoint(): string {
      return "certificates";
  }

  constructor(http: HttpClient, router: Router, dialog: MatDialog) {
    super(http, router, dialog);
  }

  getCertificates(): Observable<Certificate[] | undefined> {
    return this.get<Certificate[] | undefined>();
  }

  getCertificate(): void {
    this.getDownloadFile("download");
  }

  getCertificateById(id: string): Observable<void> {
    return this.getDownloadFile(`${id}/download`);
  }

  createCertificate(password: string): Observable<void> {
    return this.postDownloadFile({ password: btoa(password)});
  }

  deleteCertificate(id: string): Observable<void> {
    return this.delete(id);
  }
}
