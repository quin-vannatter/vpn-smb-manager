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

  public isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  getCertificates(): Observable<Certificate[] | undefined> {
    return this.get<Certificate[] | undefined>();
  }

  getCertificate(): void {
    this.getDownloadFile(`download/${this.isMobile() ? "tun" : "tap"}`);
  }

  getCertificateById(id: string): Observable<void> {
    return this.getDownloadFile(`download/${id}/${this.isMobile() ? "tun" : "tap"}`);
  }

  getGuestCertificateById(id: string): Observable<void> {
    return this.getDownloadFile(`guest/download/${id}/${this.isMobile() ? "tun" : "tap"}`);
  }

  createCertificate(password: string): Observable<void> {
    return this.postDownloadFile({ password: btoa(password), type: this.isMobile() ? "tun" : "tap"});
  }

  deleteCertificate(id: string): Observable<void> {
    return this.delete(id);
  }
}
