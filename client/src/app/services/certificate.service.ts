import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BaseService } from './base.service';
import { Observable, tap } from 'rxjs';
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

  isMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  getCertificates(): Observable<Certificate[] | undefined> {
    return this.get<Certificate[] | undefined>();
  }

  getCertificateById(id: string, type: "tun" | "tap" | undefined): Observable<void> {
    if (type === undefined) {
      type = this.isMobile() ? "tun" : "tap";
    }
    return this.getDownloadFile(`download/${id}/${type}`);
  }

  getGuestCertificateById(id: string): Observable<void> {
    return this.getDownloadFile(`guest/download/${id}/${this.isMobile() ? "tun" : "tap"}`);
  }

  createCertificate(password: string): Observable<Certificate> {
    return this.post({ password: btoa(password) });
  }

  deleteCertificate(id: string): Observable<void> {
    return this.delete(id);
  }

  deleteCertificates(): Observable<void> {
    return this.delete();
  }
}
