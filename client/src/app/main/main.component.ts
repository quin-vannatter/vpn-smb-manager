import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CertificatesComponent } from '../certificates/certificates.component';
import { InviteCodeComponent } from '../invite-code/invite-code.component';
import { Certificate } from '../models/certificate.interface';
import { User } from '../models/user.interface';
import { CertificateService } from '../services/certificate.service';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent {
  columns: string[] = ['username', 'isConnected', 'actions'];
  currentUser?: User;
  userTableData: User[] = [];

  isLoggedIn: boolean = false

  constructor(private userService: UserService, private certificateService: CertificateService, private dialog: MatDialog) {
    userService.isLoggedIn().subscribe(result => {
      this.isLoggedIn = result;
      if (this.isLoggedIn) {
        this.getTableData();
      }
    });

    userService.getCurrentUser().subscribe(user => this.currentUser = user);
  }

  getCurrentUser(): void {
    this.userService.getCurrentUser().subscribe(user => {
      this.currentUser = user;
      this.getTableData();
    });
  }

  getTableData(): void {
    this.userService.getUsers().subscribe(users => {
      this.certificateService.getCertificates().subscribe(certificates => {
        if (certificates) {
          users.forEach(user => user.certificates = certificates.filter(certificate => certificate.username === user.username));
        }
        this.userTableData = users;
      })
    })
  }

  viewCertificates(certificates: Certificate[] | undefined) {
    if (certificates) {
      this.dialog.open(CertificatesComponent, {
        data: certificates
      });
    }
  }

  generateInviteLink() {
    this.dialog.open(InviteCodeComponent);
  }

  getCertificate() {

  }

  hasAccess(username: string) {
    return this.currentUser?.isAdmin || this.currentUser?.username === username;
  }

  deleteUser(user: User) {
    if (this.currentUser?.username === user.username || this.currentUser?.isAdmin) {
      this.userService.deleteUser(user.username);
    }
  }

  logout(): void {
    if (this.userService.isLoggedIn()) {
      this.userService.logout();
    }
  }
}
