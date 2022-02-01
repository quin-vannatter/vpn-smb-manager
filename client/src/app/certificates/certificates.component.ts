import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Certificate } from '../models/certificate.interface';

@Component({
  selector: 'app-certificates',
  templateUrl: './certificates.component.html',
  styleUrls: ['./certificates.component.css']
})
export class CertificatesComponent {

  columns: string[] = ["id", "isConnected", "actions"]

  constructor(private dialogRef: MatDialogRef<CertificatesComponent>, @Inject(MAT_DIALOG_DATA) public certificateTableData: Certificate[]) {}

  close(): void {
    this.dialogRef.close();
  }

  downloadCertificate(certificate: Certificate) {

  }

  revokeCertificate(certificate: Certificate) {

  }
}
