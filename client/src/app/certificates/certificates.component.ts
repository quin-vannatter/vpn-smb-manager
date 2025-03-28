import { Component, Inject, OnDestroy } from '@angular/core';
import { AppComponent } from '../app.component';
import { DeviceService } from '../services/device.service';
import { MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Certificate } from '../models/certificate.interface';
import { BehaviorSubject, concat, debounceTime, filter, first, Observable, Subject, Subscription, takeUntil, tap } from 'rxjs';
import { Device } from '../models/device.interface';
import { LoadingComponent } from '../loading/loading.component';
import { CertificateService } from '../services/certificate.service';
import { PasswordPromptComponent } from '../password-prompt/password-prompt.component';
import { PING_INT } from '../main/main.component';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.css']
})
export class CertificatesComponent extends AppComponent implements OnDestroy {

  public devices: Device[] = [];
  public certificates: Certificate[] = [];
  timeout?: NodeJS.Timeout;
  private deviceMap: { [s:string]: BehaviorSubject<string | undefined> } = {};

  private destroySubject: Subject<void> = new Subject<void>();

  constructor(private deviceService: DeviceService, 
    private certificateService: CertificateService, private dialog: MatDialog) {
    super();
    this.getCertificateDate();
    deviceService.getDevices().pipe(first()).subscribe(devices => {
      this.devices = devices || [];
      this.deviceMap = this.devices.map(device => {
        const subject = new BehaviorSubject<string | undefined>(undefined);
        this.watchForUpdates(device.mac, subject);
        return { 
          [device.mac]: subject
        }
      }).reduce((a, b) => ({ ...a, ...b}), {});
    })
  }

  getCertificateDate() {
      this.certificateService.getCertificates().pipe(first()).subscribe(result => {
        this.certificates = (this.certificates.map(x => result?.find(y => y.id === x.id))?.filter(x => x) ?? []) as Certificate[];
        this.certificates = this.certificates.concat(result?.filter(x => !this.certificates.some(y => x.id === y.id) && x) as Certificate[]);
        if (this.timeout != undefined) {
          clearTimeout(this.timeout);
        }
        if (!this.destroySubject.closed) {
          this.timeout = setTimeout(() => this.getCertificateDate(), PING_INT);
        }
      });
  }

  removeCertificate(id: string) {
    this.certificates.splice(this.certificates.findIndex(x => x.id === id), 1);
  }

  identify(_: any, item: Certificate) {
    return item.id;
  }
  
  downloadCertificate(certificate: Certificate, type: "tun" | "tap" | undefined = undefined) {
    this.certificateService.getCertificateById(certificate.id, type);
  }

  deleteCertificates() {
    if (this.certificates.length > 0) {
      let dialogRef = this.dialog.open(LoadingComponent);
      this.certificateService.deleteCertificates().pipe(first()).subscribe(() => {
        this.certificates = [];
        dialogRef.close();
      })
    }
  }

  deleteCertificate(certificate: Certificate) {
    let dialogRef = this.dialog.open(LoadingComponent);
    this.certificateService.deleteCertificate(certificate.id).subscribe(() => {
      this.removeCertificate(certificate.id);
      dialogRef.close();
    });
  }

  createCertificate() {
    this.dialog.open(PasswordPromptComponent).afterClosed().pipe(first()).subscribe((password: string) => {
      if (password) {
        let dialogRef = this.dialog.open(LoadingComponent);
        this.certificateService.createCertificate(password).pipe(first()).subscribe(certificate => {
          dialogRef.close();
          this.certificates.push(certificate);
        });
      }
    });
  }

  getDeviceName(mac: string) {
    return this.devices.find(x => x.mac === mac)?.name || '';
  }

  triggerDeviceUpdate(mac: string, event: KeyboardEvent) {
    const name = (event.target as HTMLInputElement)?.value;
    if (name !== undefined && name !== null) {
      if (this.deviceMap[mac] == undefined) {
        this.deviceMap[mac] = new BehaviorSubject<string | undefined>(undefined);
        this.watchForUpdates(mac, this.deviceMap[mac]);
      }
  
      this.deviceMap[mac].next(name);
      const device = this.devices.find(x => x.mac === mac);
      if(device !== undefined) {
        device.name = name;
      } else {
        this.devices.push({
          mac,
          name
        })
      }
    }
  }

  watchForUpdates(mac: string, subject: BehaviorSubject<string | undefined>) {
    subject.pipe(filter(x => x !== undefined && x !== null), debounceTime(600), takeUntil(this.destroySubject))
      .subscribe(name => this.deviceService.createOrUpdateDevice(name || '', mac).pipe(first()).subscribe());
  }

  ngOnDestroy(): void {
    console.log("destroy")
    this.destroySubject.next();
    this.destroySubject.complete();
    this.destroySubject.closed = true;
  }
}
