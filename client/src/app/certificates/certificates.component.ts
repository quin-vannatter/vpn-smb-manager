import { Component, Inject, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LoadingComponent } from '../loading/loading.component';
import { Certificate } from '../models/certificate.interface';
import { User } from '../models/user.interface';
import { CertificateService } from '../services/certificate.service';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.css']
})
export class CertificatesComponent {

  columns: string[] = ["id", "isConnected", "actions"]

  public certificateTableData: Certificate[] = [];
  private currentUser?: User;

  constructor(private dialogRef: MatDialogRef<CertificatesComponent>, @Inject(MAT_DIALOG_DATA) public data: any, private certificateService: CertificateService, private dialog: MatDialog) {
    this.currentUser = data.currentUser;
    this.certificateTableData = data.certificateTableData;
  }

  close(): void {
    this.dialogRef.close();
  }

  hasAccess(certificate: Certificate) {
    return this.currentUser?.isAdmin || certificate.username === this.currentUser?.username;
  }

  downloadCertificate(certificate: Certificate) {
    this.certificateService.getCertificateById(certificate.id)
  }

  getCertificateTableData() {
    this.certificateService.getCertificates().subscribe(certificates => {

    });
    
  }

  deleteCertificate(certificate: Certificate) {
    if(this.hasAccess(certificate)) {
      var dialogRef = this.dialog.open(LoadingComponent);
      this.certificateService.deleteCertificate(certificate.id).subscribe(() => {
        this.certificateTableData = this.certificateTableData.filter(val => val.id !== certificate.id);
        if(this.certificateTableData.length === 0) {
          this.dialogRef.close();
        }
        dialogRef.close()
      });
    }
  }
}
