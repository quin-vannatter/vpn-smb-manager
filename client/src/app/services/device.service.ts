import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BaseService } from './base.service';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { Device } from '../models/device.interface';

const FETCH_TIMEOUT = 5000;

@Injectable({
  providedIn: 'root'
})
export class DeviceService extends BaseService {

  protected getEndpoint(): string {
      return "devices";
  }

  constructor(http: HttpClient, router: Router, dialog: MatDialog) {
    super(http, router, dialog);
  }

  getDevices(): Observable<Device[] | undefined> {
    return this.get<Device[] | undefined>();
  }

  createOrUpdateDevice(name: string, mac: string): Observable<void> {
    return this.post({ name, mac });
  }
}
